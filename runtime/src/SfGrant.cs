using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Players;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Runs;

namespace SpireForge.Runtime;

/// <summary>
/// 「一键在游戏中获得卡」文件桥。
/// 编辑器把 Entry 清单写入本 mod 目录的 sf_grant.json（{"entries":[...]}），
/// Runtime 在每场战斗开始（Hook.BeforeCombatStart 后缀、首次抽牌前，此时抽牌堆
/// 已由 PopulateCombatState 填好）消费一次。**发放是本局永久的**：卡总是先加入
/// 玩家的主牌组（Player.Deck，跨战斗持久、随存档保存）；若发放时正在战斗中，
/// 再按开局同款配方（CombatState.CloneCard + DeckVersion 回指）克隆一份进当前
/// 抽牌堆，本场合计立刻可用。消费即删除，不重复发放。
/// 文件本身就是用户意图（编辑器按钮/控制台），因此不受 DEBUG 开关限制；
/// 游戏内也可用 sf_grant 控制台命令手动拿卡（仅调试模式可见）。
/// </summary>
public static class SfGrant
{
    /// <summary>拿卡清单路径（与 SpireForgeRuntime.dll 同目录）。</summary>
    public static string QueuePath => Path.Combine(
        Path.GetDirectoryName(typeof(SfGrant).Assembly.Location) ?? "",
        "sf_grant.json");

    /// <summary>登记拿卡清单（编辑器写；保留顺序、去重）。</summary>
    public static void Enqueue(IEnumerable<string> entries)
    {
        var existing = new List<string>();
        try
        {
            if (File.Exists(QueuePath))
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(QueuePath));
                if (doc.RootElement.TryGetProperty("entries", out var arr)
                    && arr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var e in arr.EnumerateArray())
                    {
                        var s = e.GetString();
                        if (!string.IsNullOrEmpty(s))
                        {
                            existing.Add(s);
                        }
                    }
                }
            }
        }
        catch (Exception)
        {
            // 旧文件损坏：覆盖重写
            existing.Clear();
        }
        foreach (var e in entries)
        {
            var s = (e ?? "").Trim().ToUpperInvariant();
            if (s.Length > 0 && !existing.Contains(s))
            {
                existing.Add(s);
            }
        }
        var payload = JsonSerializer.Serialize(new { entries = existing });
        var tmp = QueuePath + ".tmp";
        File.WriteAllText(tmp, payload);
        File.Move(tmp, QueuePath, overwrite: true);
    }

    /// <summary>读取并清空清单（消费语义：无论后续发放成败，文件都移除并逐条记日志）。</summary>
    private static List<string> TakeQueue()
    {
        var entries = new List<string>();
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(QueuePath));
            if (doc.RootElement.TryGetProperty("entries", out var arr)
                && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var e in arr.EnumerateArray())
                {
                    var s = e.GetString();
                    if (!string.IsNullOrEmpty(s))
                    {
                        entries.Add(s);
                    }
                }
            }
        }
        catch (Exception e)
        {
            SpireForge.Api.SfLog.Error($"grant queue unreadable, discarding: {e.Message}");
        }
        File.Delete(QueuePath);
        return entries;
    }

    /// <summary>Hook.BeforeCombatStart 后缀调用。吞掉一切异常——战斗绝不能被破坏。</summary>
    public static void ConsumeAtCombatStart(IRunState? runState, ICombatState? combatState)
    {
        try
        {
            if (runState == null || !File.Exists(QueuePath))
            {
                return;
            }
            var entries = TakeQueue();
            if (entries.Count == 0)
            {
                return;
            }
            var player = runState.Players.FirstOrDefault();
            if (player == null)
            {
                SpireForge.Api.SfLog.Error("grant queue skipped: run has no player");
                return;
            }
            bool inCombat = combatState != null;
            SpireForge.Api.SfLog.Info(
                $"grant queue: {entries.Count} card(s) -> deck (permanent){(inCombat ? " + draw pile" : "")}");
            _ = GrantAllAsync(player, entries, inCombat);
        }
        catch (Exception e)
        {
            SpireForge.Api.SfLog.Error($"consume grant queue failed: {e}");
        }
    }

    private static async Task GrantAllAsync(Player player, List<string> entries, bool inCombat)
    {
        foreach (var entry in entries)
        {
            try
            {
                var err = await GrantAsync(player, entry, inCombat);
                if (err != null)
                {
                    SpireForge.Api.SfLog.Error($"grant {entry} FAILED: {err}");
                }
                else
                {
                    SpireForge.Api.SfLog.Info($"granted {entry} (deck{(inCombat ? "+draw" : "")})");
                }
            }
            catch (Exception e)
            {
                SpireForge.Api.SfLog.Error($"grant {entry} failed: {e}");
            }
        }
    }

    /// <summary>把一张卡**永久**发给玩家：总是先加入本局主牌组（Player.Deck，跨战斗
    /// 持久、随存档保存，与游戏 card &lt;X&gt; Deck 控制台命令同配方）；战斗中再克隆一份
    /// 进当前抽牌堆（开局 PopulateCombatState 的 Deck→Draw 同款：CloneCard + DeckVersion
    /// 回指），本场合计立刻可用。返回 null = 成功，否则为错误说明。</summary>
    public static async Task<string?> GrantAsync(Player player, string entry, bool inCombat)
    {
        var model = ModelDb.AllCards.FirstOrDefault(c =>
            string.Equals(c.Id.Entry, entry, StringComparison.OrdinalIgnoreCase));
        if (model == null)
        {
            return $"card '{entry}' not found";
        }
        var run = RunManager.Instance.DebugOnlyGetState()
            ?? throw new InvalidOperationException("run state unavailable");
        var deckCard = run.CreateCard(model, player);
        // 战斗中跳过入组动画：飘向顶栏牌组的特效在战斗画面下语义不明，静默入组
        var added = await CardPileCmd.Add(deckCard, PileType.Deck, skipVisuals: inCombat);
        if (!added.success)
        {
            return "add to deck prevented (Hook.ShouldAddToDeck)";
        }
        SpireForge.Api.SfEvents.RaiseCardGranted(entry, inCombat);
        if (!inCombat)
        {
            return null;
        }
        var combat = CombatManager.Instance.DebugOnlyGetState()
            ?? throw new InvalidOperationException("combat state unavailable");
        var clone = combat.CloneCard(deckCard);
        clone.DeckVersion = deckCard;
        await CardPileCmd.Add(clone, PileType.Draw);
        return null;
    }
}

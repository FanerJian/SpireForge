using System;
using System.Collections.Generic;
using System.Diagnostics;
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
/// 「添加至卡组」文件桥。
/// 编辑器把 Entry 清单写入本 mod 目录的 sf_grant.json（{"entries":[...]}），
/// Runtime 每帧轮询（SceneTree.ProcessFrame，250ms 节流）**即时消费**：
///  - 战斗外：卡加入本局主牌组（Player.Deck，跨战斗持久、随存档保存）；
///  - 战斗中：入组之外**额外塞一张到手牌**（本场立即可用；满手牌走官方分支）。
/// Deck 牌堆战斗内外同指 player.Deck（CardPile.Get），所以战斗中发放的卡
/// 本场从手牌拿、下一场起从抽牌堆抽。消费即删除，不重复发放；还没进局
/// （主菜单）时清单保留，进局后轮询自动入组。
/// 登记只在同一次游戏会话内有效：编辑器在游戏未运行时拒绝登记；启动时清掉
/// 上个会话遗留的清单（ClearStaleQueue），绝不跨会话补发。
/// 文件本身就是用户意图（编辑器按钮/控制台），因此不受 DEBUG 开关限制；
/// 游戏内也可用 sf_grant 控制台命令手动拿卡（仅调试模式可见）。
/// </summary>
public static class SfGrant
{
    /// <summary>拿卡清单路径（与 SpireForgeRuntime.dll 同目录）。</summary>
    public static string QueuePath => Path.Combine(
        Path.GetDirectoryName(typeof(SfGrant).Assembly.Location) ?? "",
        "sf_grant.json");

    private static readonly Stopwatch PollClock = Stopwatch.StartNew();
    private static long _nextPollMs;

    /// <summary>把轮询挂到 SceneTree 每帧信号（主线程执行）。</summary>
    public static void InstallPolling(Godot.SceneTree tree)
    {
        tree.ProcessFrame += OnTick;
    }

    private static void OnTick()
    {
        long now = PollClock.ElapsedMilliseconds;
        if (now < _nextPollMs)
        {
            return;
        }
        _nextPollMs = now + 250;
        try
        {
            if (File.Exists(QueuePath))
            {
                ConsumePending();
            }
        }
        catch (Exception)
        {
            // 吞掉一切：轮询失败下轮再试，绝不能拖垮游戏主循环
        }
    }

    /// <summary>游戏启动时清掉上个会话遗留的拿卡清单：登记不跨会话，
    /// 排队后未消费就退出游戏的清单到下次启动一律作废。</summary>
    public static void ClearStaleQueue()
    {
        try
        {
            if (File.Exists(QueuePath))
            {
                File.Delete(QueuePath);
                SpireForge.Api.SfLog.Info("discarded stale grant queue from a previous session");
            }
        }
        catch (Exception e)
        {
            SpireForge.Api.SfLog.Error("clear stale grant queue failed: " + e.Message);
        }
    }

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

    /// <summary>读取并清空清单（消费语义：无论后续发放成败，文件都移除并逐条记日志）。
    /// 编辑器写入是「删旧+改名」两步，存在极短的文件空窗——文件恰好消失时按没排队处理。</summary>
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
        catch (FileNotFoundException)
        {
            return entries;
        }
        catch (DirectoryNotFoundException)
        {
            return entries;
        }
        catch (Exception e)
        {
            SpireForge.Api.SfLog.Error($"grant queue unreadable, discarding: {e.Message}");
        }
        try
        {
            File.Delete(QueuePath);
        }
        catch (Exception)
        {
            // 删不掉就留着，下轮重新消费（消费失败重读的风险远小于误删用户意图）
        }
        return entries;
    }

    /// <summary>轮询消费入口：有局才消费（主菜单登记的清单进局后自动入组）。
    /// Hook.BeforeCombatStart 后缀也调用本方法兜底（轮询失效时战斗开始仍会消费）。</summary>
    public static void ConsumePending()
    {
        try
        {
            if (!File.Exists(QueuePath))
            {
                return;
            }
            var run = RunManager.Instance?.DebugOnlyGetState();
            if (run == null)
            {
                return;
            }
            var player = run.Players.FirstOrDefault();
            if (player == null)
            {
                SpireForge.Api.SfLog.Error("grant queue skipped: run has no player");
                return;
            }
            var entries = TakeQueue();
            if (entries.Count == 0)
            {
                return;
            }
            SpireForge.Api.SfLog.Info(
                $"grant queue: {entries.Count} card(s) -> run deck (permanent)");
            _ = GrantAllAsync(player, entries);
        }
        catch (Exception e)
        {
            SpireForge.Api.SfLog.Error($"consume grant queue failed: {e}");
        }
    }

    private static async Task GrantAllAsync(Player player, List<string> entries)
    {
        foreach (var entry in entries)
        {
            try
            {
                var err = await GrantAsync(player, entry);
                if (err != null)
                {
                    SpireForge.Api.SfLog.Error($"grant {entry} FAILED: {err}");
                }
            }
            catch (Exception e)
            {
                SpireForge.Api.SfLog.Error($"grant {entry} failed: {e}");
            }
        }
    }

    /// <summary>把一张卡**永久**发给玩家：加入本局主牌组（Player.Deck，跨战斗
    /// 持久、随存档保存，与游戏 card &lt;X&gt; Deck 控制台命令同配方）；
    /// **战斗进行中额外塞一张到手牌**（本场立即可用）。发放结果在此统一记日志。
    /// 返回 null = 成功，否则为错误说明。</summary>
    public static async Task<string?> GrantAsync(Player player, string entry)
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
        var added = await CardPileCmd.Add(deckCard, PileType.Deck);
        if (!added.success)
        {
            return "add to deck prevented (Hook.ShouldAddToDeck)";
        }
        // 与原版事件塞牌同款：入组结果交给官方预览动画（卡牌飞向牌组）
        MegaCrit.Sts2.Core.Commands.CardCmd.PreviewCardPileAdd(added);
        bool inCombat = CombatManager.Instance is { IsInProgress: true };
        if (inCombat)
        {
            // 战斗中额外塞一张到手牌。手牌副本必须走官方战斗生成卡配方：
            //  ICombatState.CreateCard（把卡注册进 CombatState——RunState.CreateCard 只注册
            //  RunState，牌堆流转校验 "must be added to a CombatState" 会炸死回合循环）
            //  + AddGeneratedCardToCombat（ForgeCmd/DualWield/BundleOfJoy 同款入口）
            var combatState = player.Creature.CombatState
                ?? throw new InvalidOperationException("combat state unavailable");
            var handCard = combatState.CreateCard(model, player);
            var handAdded = await CardPileCmd.AddGeneratedCardToCombat(
                handCard, PileType.Hand, player);
            if (handAdded.success)
            {
                MegaCrit.Sts2.Core.Commands.CardCmd.PreviewCardPileAdd(handAdded);
                SpireForge.Api.SfLog.Info($"granted {entry} (deck +1 hand)");
            }
            else
            {
                SpireForge.Api.SfLog.Warn($"granted {entry} (deck); hand copy prevented");
            }
        }
        else
        {
            SpireForge.Api.SfLog.Info($"granted {entry} (deck)");
        }
        SpireForge.Api.SfEvents.RaiseCardGranted(entry, inCombat);
        return null;
    }
}

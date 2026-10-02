using System;
using System.Linq;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.DevConsole;
using MegaCrit.Sts2.Core.DevConsole.ConsoleCommands;
using MegaCrit.Sts2.Core.Entities.Players;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Runs;

namespace SpireForge.Runtime;

/// <summary>
/// 游戏内控制台命令 sf_grant [ENTRY ...]：
/// 无参数 = 列出已安装 SpireForge 卡包的全部 Entry；带参数 = 拿卡
/// （战斗中 → 抽牌堆；否则 → 牌组）。原版 Entry 同样可用（如 sf_grant BASH）。
/// DebugOnly 保持默认 true —— 拿卡属于测试/自查功能，仅在调试会话出现。
/// 游戏通过 ReflectionHelper.GetSubtypesInMods 自动发现本类，无需手动注册。
/// </summary>
public sealed class SfGrantConsoleCmd : AbstractConsoleCmd
{
    public override string CmdName => "sf_grant";

    public override string Args => "[card-entry ...]";

    public override string Description =>
        "List SpireForge card entries (no args), or add card(s) to deck / draw pile in combat.";

    public override bool IsNetworked => false;

    public override CmdResult Process(Player? issuingPlayer, string[] args)
    {
        if (args.Length == 0)
        {
            var entries = PackLoader.Defs.Keys.OrderBy(k => k, StringComparer.Ordinal).ToList();
            return new CmdResult(success: true,
                entries.Count > 0
                    ? $"SpireForge cards ({entries.Count}):\n" + string.Join("\n", entries)
                    : "No SpireForge cards installed.");
        }
        if (!RunManager.Instance.IsInProgress)
        {
            return new CmdResult(success: false, "A run is currently not in progress!");
        }
        if (issuingPlayer == null)
        {
            return new CmdResult(success: false,
                "No issuing player (in multiplayer use each player's own console).");
        }
        bool inCombat = CombatManager.Instance is { IsInProgress: true };
        return new CmdResult(GrantAll(issuingPlayer, args, inCombat), success: true,
            $"Granting {args.Length} card(s) to {(inCombat ? "draw pile" : "deck")}...");
    }

    private static async Task GrantAll(Player player, string[] entries, bool inCombat)
    {
        foreach (var raw in entries)
        {
            var entry = raw.Trim().ToUpperInvariant();
            try
            {
                var err = await SfGrant.GrantAsync(player, entry, inCombat);
                if (err != null)
                {
                    SpireForge.Api.SfLog.Error($"sf_grant {entry} FAILED: {err}");
                }
                else
                {
                    SpireForge.Api.SfLog.Info($"sf_grant: granted {entry} ({(inCombat ? "draw" : "deck")})");
                }
            }
            catch (Exception e)
            {
                SpireForge.Api.SfLog.Error($"sf_grant {entry} failed: {e}");
            }
        }
    }

    public override CompletionResult GetArgumentCompletions(Player? player, string[] args)
    {
        if (args.Length <= 1)
        {
            var candidates = ModelDb.AllCards.Select(c => c.Id.Entry).ToList();
            return CompleteArgument(candidates, Array.Empty<string>(), args.FirstOrDefault() ?? "");
        }
        return new CompletionResult
        {
            Type = CompletionType.Argument,
            ArgumentContext = CmdName,
        };
    }
}

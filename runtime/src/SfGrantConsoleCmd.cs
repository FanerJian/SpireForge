using System;
using System.Linq;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.DevConsole;
using MegaCrit.Sts2.Core.DevConsole.ConsoleCommands;
using MegaCrit.Sts2.Core.Entities.Players;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Runs;

namespace SpireForge.Runtime;

/// <summary>
/// 游戏内控制台命令 sf_grant [ENTRY ...]：
/// 无参数 = 列出已安装 SpireForge 卡包的全部 Entry；带参数 = 永久拿卡
/// （加入本局主牌组；战斗中额外塞一张到手牌）。
/// 原版 Entry 同样可用（如 sf_grant BASH）。
/// DebugOnly 保持默认 true —— 拿卡属于测试/自查功能，仅在调试会话出现。
/// 游戏通过 ReflectionHelper.GetSubtypesInMods 自动发现本类，无需手动注册。
/// </summary>
public sealed class SfGrantConsoleCmd : AbstractConsoleCmd
{
    public override string CmdName => "sf_grant";

    public override string Args => "[card-entry ...]";

    public override string Description =>
        "List SpireForge card entries (no args), or permanently add card(s) to your run deck.";

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
        return new CmdResult(GrantAll(issuingPlayer, args), success: true,
            $"Granting {args.Length} card(s) to run deck (permanent)...");
    }

    private static async Task GrantAll(Player player, string[] entries)
    {
        foreach (var raw in entries)
        {
            var entry = raw.Trim().ToUpperInvariant();
            try
            {
                var err = await SfGrant.GrantAsync(player, entry);
                if (err != null)
                {
                    // 成功日志由 GrantAsync 统一记（含是否塞了手牌）
                    SpireForge.Api.SfLog.Error($"sf_grant {entry} FAILED: {err}");
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

using System.Linq;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Context;
using MegaCrit.Sts2.Core.DevConsole;
using MegaCrit.Sts2.Core.DevConsole.ConsoleCommands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Multiplayer;
using MegaCrit.Sts2.Core.Entities.Players;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Runs;

namespace SpireForge.Runtime;

/// <summary>
/// 调试自测控制台命令（游戏自动发现 mod 程序集里的 AbstractConsoleCmd 子类）。
/// 战斗中输入 sf_hooktest：自动生成尖牌并弃置/抽取/消耗，
/// 触发 on_discard / on_draw / on_exhaust 钩子与 sf_test_echo 自定义效果。
/// 全程看日志：过滤 SPIREFORGE: HOOKTEST 与 hook on_*。
/// on_enter_combat 用 `card SF_SPIKE_INNATE Draw`（战斗前）+ `fight` 验证；
/// on_turn_end_in_hand 用 `card SF_SPIKE_OMEN` 后结束回合验证。
/// </summary>
public class SfHookTestCmd : AbstractConsoleCmd
{
    public override string CmdName => "sf_hooktest";
    public override string Args => "";
    public override string Description =>
        "SpireForge: auto-test card hooks + custom effect (in combat, debug mode only)";
    public override bool IsNetworked => false;

    public override CmdResult Process(Player? issuingPlayer, string[] args)
    {
        if (!RuntimeEntry.DebugChecksEnabled)
        {
            return new CmdResult(success: false, "SpireForge debug mode is off (SpireForgeRuntime.debug file)");
        }
        if (issuingPlayer == null)
        {
            return new CmdResult(success: false, "SpireForge: a run must be in progress");
        }
        if (CombatManager.Instance == null || !CombatManager.Instance.IsInProgress)
        {
            return new CmdResult(success: false, "SpireForge: must be used during combat");
        }
        var ctx = new HookPlayerChoiceContext(issuingPlayer, LocalContext.NetId.Value, GameActionType.Combat);
        Task work = Run(issuingPlayer, ctx);
        return new CmdResult(
            ctx.AssignTaskAndWaitForPauseOrCompletion(work), success: true,
            "SpireForge hook test running - see godot.log (SPIREFORGE: HOOKTEST)");
    }

    private static CardModel? Spawn(string entry, ICardScope scope, Player owner)
    {
        var template = ModelDb.AllCards.FirstOrDefault((CardModel c) => c.Id.Entry == entry);
        return template == null ? null : scope.CreateCard(template, owner);
    }

    private static async Task Run(Player player, PlayerChoiceContext ctx)
    {
        Log.Info("SPIREFORGE: HOOKTEST begin");
        var scope = CombatManager.Instance.DebugOnlyGetState();

        // 1) on_discard 钩子 + 自定义效果（随机敌人目标 + params 透传）
        var trigger = Spawn("SF_SPIKE_TRIGGER", scope, player);
        if (trigger != null)
        {
            await CardPileCmd.Add(trigger, PileType.Hand);
            await CardCmd.Discard(ctx, [trigger]);
        }
        else
        {
            Log.Error("SPIREFORGE: HOOKTEST SF_SPIKE_TRIGGER not found");
        }

        // 2) on_draw 钩子：PYRE 置顶抽牌堆后抽 1 张
        var pyre = Spawn("SF_SPIKE_PYRE", scope, player);
        if (pyre != null)
        {
            await CardPileCmd.Add(pyre, PileType.Draw, CardPilePosition.Top);
            await CardPileCmd.Draw(ctx, 1, player);
        }

        // 3) on_exhaust 钩子：直接消耗刚抽到的 PYRE
        if (pyre != null && pyre.Pile?.Type == PileType.Hand)
        {
            await CardCmd.Exhaust(ctx, pyre);
        }

        Log.Info("SPIREFORGE: HOOKTEST end - PASS requires on_discard + sf_test_echo + on_draw + on_exhaust lines above");
    }
}

using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Godot;
using HarmonyLib;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.Entities.Powers;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Models;

namespace SpireForge.Runtime;

/// <summary>
/// 「下几回合」延迟效果的承载力量：打出 delayed 效果时施加给玩家，剩余回合数即层数，
/// 每回合按 timing 触发内嵌效果清单并减层（到 0 由 ShouldRemoveDueToAmount 自动移除）。
/// Side 选择触发哪一方：player（缺省，我方回合时机）/ enemy（敌方回合时机）/ both（双方都触发）。
/// EveryTurn=false 时改为静默倒计时，仅在最后一层（Amount==1，减层即移除）的那次时机触发，
/// =「等 N 回合后触发一次」。
/// 内嵌效果挂在力量实例上（ConditionalWeakTable，不阻止 GC）；Apply 传入的是本实例
/// （不克隆），标记先于施加。InstanceType=Instanced：重复打出各建各的实例，互不叠加，
/// 各自携带各自的内嵌清单与倒计时。
/// 当回合跳过：打出当回合 AmountOnTurnStart==0（回合开始时尚未施加），钩子里据此
/// 不触发也不减层——"下 N 回合"从下一回合起算，与卡面文案一致。
/// </summary>
public sealed class SfDelayedPower : PowerModel
{
    private sealed class Payload
    {
        public required CardModel Card;
        public required List<SfEffect> Effects;
        public required bool EveryTurn;
        public required string Side;
        public required string Timing;
        /// <summary>图标 spec：力量名或包内路径（空 = 不换图，走官方空白行为）。</summary>
        public string Icon = "";
        /// <summary>施加卡所属包命名空间（包内图标路径的 res:// 前缀）。</summary>
        public string Pack = "";
        /// <summary>解析后的图标纹理（懒解析一次；null 且 IconTried=失败/无图标）。</summary>
        public Texture2D? IconTex;
        public bool IconTried;
    }

    private static readonly ConditionalWeakTable<PowerModel, Payload> Payloads = new();

    private const string LocKey = "SF_DELAYED_POWER";

    public override PowerType Type => PowerType.Buff;

    public override PowerStackType StackType => PowerStackType.Counter;

    public override PowerInstanceType InstanceType => PowerInstanceType.Instanced;

    public override LocString Title
    {
        get
        {
            EnsureLoc();
            return base.Title;
        }
    }

    public override LocString Description
    {
        get
        {
            EnsureLoc();
            return base.Description;
        }
    }

    /// <summary>注入力量名/描述词条（幂等；语言切换后表重载，靠 Title/Description 读取路径兜底重注）。</summary>
    private static void EnsureLoc()
    {
        try
        {
            var entries = LocManager.Instance.Language == "eng"
                ? new Dictionary<string, string>
                {
                    [LocKey + ".title"] = "Delayed effect",
                    [LocKey + ".description"] =
                        "Triggers the applying card's delayed effect. Turns remaining: [blue]{Amount}[/blue].",
                }
                : new Dictionary<string, string>
                {
                    [LocKey + ".title"] = "延迟效果",
                    [LocKey + ".description"] =
                        "触发施加此效果的卡牌的延迟效果。剩余 [blue]{Amount}[/blue] 回合。",
                };
            LocManager.Instance.GetTable("powers").MergeWith(entries);
        }
        catch (System.Exception e)
        {
            MegaCrit.Sts2.Core.Logging.Log.Error($"SPIREFORGE: delayed power loc inject failed: {e.Message}");
        }
    }

    /// <summary>施加延迟效果（SfEffectEngine 的 delayed 种类走这里）。
    /// ctx 可为 null（on_enter_combat 调度场景），施加动作本身用 Throwing 上下文兜底。
    /// side：player（缺省，我方回合时机）/ enemy（敌方回合时机）/ both（双方都触发）。
    /// icon：力量图标（力量名或包内路径，可空）。</summary>
    public static async Task Schedule(
        ICombatState combat, CardModel source, PlayerChoiceContext? ctx,
        List<SfEffect> effects, int turns, string timing, bool everyTurn, string side,
        string icon = "")
    {
        var template = ModelDb.Power<SfDelayedPower>().ToMutable();
        var entry = source.Id?.Entry ?? "";
        var pack = PackLoader.PackOf.TryGetValue(entry, out var pk) ? pk
            : SfVanillaOverride.TryPackOfEntry(entry, out var vk) ? vk : "";
        Payloads.Add(template, new Payload
        {
            Card = source, Effects = effects, EveryTurn = everyTurn, Side = side,
            Timing = string.Equals(timing?.Trim(), "turn_start", System.StringComparison.OrdinalIgnoreCase) ? "turn_start" : "turn_end",
            Icon = icon ?? "", Pack = pack,
        });
        EnsureLoc();
        await PowerCmd.Apply(
            ctx ?? new ThrowingPlayerChoiceContext(), template, source.Owner.Creature,
            turns, null, source, false);
        MegaCrit.Sts2.Core.Logging.Log.Info(
            $"SPIREFORGE: delayed effect scheduled on {source.Id} ({turns} turn(s), {timing}, every_turn={everyTurn}, side={side})");
    }

    public override async Task BeforeSideTurnStart(
        PlayerChoiceContext choiceContext, CombatSide side, IReadOnlyList<Creature> participants, ICombatState combatState)
    {
        if (AmountOnTurnStart <= 0 || !Payloads.TryGetValue(this, out var payload) || payload == null)
        {
            return;
        }
        if (payload.Timing != "turn_start" || !SideMatches(payload.Side, side))
        {
            return;
        }
        // 我方时机保持历史门控（本力量挂在玩家身上）；敌方时机 participants 是敌方怪，
        // 玩家必然不在其中，不能作为触发条件
        if (side == CombatSide.Player && !participants.Contains(Owner))
        {
            return;
        }
        await FireAndTick(payload, choiceContext, "turn_start");
    }

    public override async Task AfterSideTurnEnd(
        PlayerChoiceContext choiceContext, CombatSide side, IEnumerable<Creature> participants)
    {
        if (AmountOnTurnStart <= 0 || !Payloads.TryGetValue(this, out var payload) || payload == null)
        {
            return;
        }
        if (payload.Timing != "turn_end" || !SideMatches(payload.Side, side))
        {
            return;
        }
        if (side == CombatSide.Player && !participants.Contains(Owner))
        {
            return;
        }
        await FireAndTick(payload, choiceContext, "turn_end");
    }

    /// <summary>side 配置与当前时机侧的匹配：enemy → 敌方；both/any → 双方；其余（缺省）→ 我方。</summary>
    private static bool SideMatches(string side, CombatSide current)
    {
        var s = (side ?? "").Trim().ToLowerInvariant();
        if (s == "enemy")
        {
            return current == CombatSide.Enemy;
        }
        if (s == "both" || s == "any")
        {
            return true;
        }
        return current == CombatSide.Player;
    }

    private async Task FireAndTick(Payload payload, PlayerChoiceContext choiceContext, string trigger)
    {
        // every_turn=false：只在最后一层（减层即移除）的那次时机触发，其余回合静默倒计时
        if (!payload.EveryTurn && Amount > 1)
        {
            await PowerCmd.Decrement(this);
            return;
        }
        Flash();
        await SfEffectEngine.RunAsync(payload.Card, payload.Effects, choiceContext, null, "delayed_" + trigger,
            useVarBinding: false);
        await PowerCmd.Decrement(this); // 减到 0 自动移除
    }

    /// <summary>安装图标后缀：PowerModel.Icon/BigIcon 不是虚属性，NPower 直接读它们，
    /// 只能 Harmony 后缀改写返回值（覆盖卡立绘 HookPortrait 同款思路，仅作用于本力量实例）。</summary>
    public static void InstallIconHook(Harmony harmony)
    {
        var postfix = new HarmonyMethod(typeof(SfDelayedPower), nameof(IconPostfix));
        harmony.Patch(AccessTools.PropertyGetter(typeof(PowerModel), "Icon"), postfix: postfix);
        harmony.Patch(AccessTools.PropertyGetter(typeof(PowerModel), "BigIcon"), postfix: postfix);
    }

    /// <summary>Icon/BigIcon 后缀：本力量带图标 spec 且解析成功时替换返回纹理。</summary>
    private static void IconPostfix(PowerModel __instance, ref Texture2D __result)
    {
        if (__instance is not SfDelayedPower sp || !Payloads.TryGetValue(sp, out var p) || p == null)
        {
            return;
        }
        if (!p.IconTried)
        {
            p.IconTried = true;
            p.IconTex = ResolveIcon(p);
            if (p.IconTex == null && p.Icon.Length > 0)
            {
                MegaCrit.Sts2.Core.Logging.Log.Info(
                    $"SPIREFORGE: delayed power icon '{p.Icon}' not resolved, using blank");
            }
        }
        if (p.IconTex != null)
        {
            __result = p.IconTex;
        }
    }

    /// <summary>图标解析（懒执行一次）：①含 / = 包内图片路径（SfPngLoader 认领
    /// res://&lt;pack&gt;/…）；②否则按力量名借原版力量的图集图标。失败返回 null（空白）。</summary>
    private static Texture2D? ResolveIcon(Payload p)
    {
        var spec = p.Icon.Trim();
        if (spec.Length == 0)
        {
            return null;
        }
        try
        {
            if (spec.Contains('/'))
            {
                if (string.IsNullOrEmpty(p.Pack))
                {
                    return null;
                }
                return ResourceLoader.Load<Texture2D>("res://" + p.Pack + "/" + spec.TrimStart('/'),
                    null, ResourceLoader.CacheMode.Reuse);
            }
            var t = SfPowerResolver.Find(spec);
            var pm = t != null ? ModelDb.DebugPower(t) : null;
            return pm == null || string.IsNullOrEmpty(pm.PackedIconPath)
                ? null
                : ResourceLoader.Load<Texture2D>(pm.PackedIconPath, null, ResourceLoader.CacheMode.Reuse);
        }
        catch (System.Exception e)
        {
            MegaCrit.Sts2.Core.Logging.Log.Info(
                $"SPIREFORGE: delayed power icon '{spec}' load failed: {e.Message}");
            return null;
        }
    }
}

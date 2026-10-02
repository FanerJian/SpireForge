using System.Collections.Generic;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.ValueProps;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// 效果解释器（静态引擎）。SfCardBase 与原版卡覆盖（SfVanillaOverride 的 Harmony 前缀）
/// 共用同一套执行逻辑：同一条 JSON 效果清单在"新建卡"与"改原版卡"上行为一致。
/// 约定：运行期问题记 SfLog 并跳过该效果，不抛异常（战斗中抛异常会中断整场结算）。
/// </summary>
public static class SfEffectEngine
{
    /// <summary>按清单顺序执行效果。ctx 为 null 的上下文（on_enter_combat）禁用 damage/draw。</summary>
    public static async Task RunAsync(
        CardModel card, List<SfEffect> effects, PlayerChoiceContext? ctx, CardPlay? play, string trigger)
    {
        foreach (var e in effects)
        {
            if (ctx == null && e.Kind is SfEffectKind.Damage or SfEffectKind.Draw)
            {
                SfLog.Error("card " + card.Id + ": effect " + e.KindName +
                            " needs a choice context (on_enter_combat unsupported)");
                continue;
            }
            await RunOne(card, e, ctx, play, trigger);
        }
    }

    private static async Task RunOne(
        CardModel card, SfEffect e, PlayerChoiceContext? ctx, CardPlay? play, string trigger)
    {
        switch (e.Kind)
        {
            case SfEffectKind.Damage:
            {
                if (play != null)
                {
                    if (play.Target == null)
                    {
                        SfLog.Error("card " + card.Id + " requires a target, damage skipped");
                        break;
                    }
                    if (card.DynamicVars?.Damage != null)
                    {
                        // 走卡牌自带的 Damage 变量：保留力量/易伤等修正链（原版语义）
                        await CreatureCmd.Damage(ctx!, play.Target, card.DynamicVars.Damage, card, play);
                    }
                    else
                    {
                        // 被覆盖的原版卡可能没有 Damage 变量：按字面数值直接结算
                        await CreatureCmd.Damage(ctx!, play.Target, e.Amount, ParseProps(e.Props), card, play);
                    }
                }
                else
                {
                    await CreatureCmd.Damage(ctx!, ResolveTargets(card, e), e.Amount, ParseProps(e.Props),
                        card.Owner.Creature);
                }
                break;
            }
            case SfEffectKind.Block:
                if (play != null && card.DynamicVars?.Block != null)
                {
                    await CreatureCmd.GainBlock(card.Owner.Creature, card.DynamicVars.Block, play);
                }
                else
                {
                    await CreatureCmd.GainBlock(card.Owner.Creature, e.Amount, ParseProps(e.Props), play);
                }
                break;
            case SfEffectKind.Draw:
                await CardPileCmd.Draw(ctx!, e.Amount, card.Owner);
                break;
            case SfEffectKind.Energy:
                await PlayerCmd.GainEnergy(e.Amount, card.Owner);
                break;
            case SfEffectKind.Heal:
                await CreatureCmd.Heal(card.Owner.Creature, e.Amount);
                break;
            case SfEffectKind.Custom:
            {
                Creature? target = play?.Target;
                if (target == null && play == null)
                {
                    var picks = ResolveTargets(card, e);
                    target = picks.Count > 0 ? picks[0] : null;
                }
                var invoked = await SfEffects.TryInvoke(new SfEffectContext
                {
                    Card = card,
                    Effect = e,
                    Choice = ctx,
                    Play = play,
                    Trigger = trigger,
                    Target = target,
                });
                if (!invoked)
                {
                    SfLog.Error("card " + card.Id + ": unregistered custom effect " + e.KindName +
                                " (handler mod missing)");
                }
                break;
            }
        }
    }

    /// <summary>钩子上下文（无 cardPlay）的取敌：
    /// self / all_enemies / random_enemy（默认，与 Tingsha 同款 CombatTargets RNG）。</summary>
    private static IReadOnlyList<Creature> ResolveTargets(CardModel card, SfEffect e)
    {
        var combat = card.Owner.Creature.CombatState;
        if (combat == null)
        {
            SfLog.Error("card " + card.Id + " has no combat state, effect skipped");
            return [];
        }
        switch ((e.Target ?? "").Trim().ToLowerInvariant())
        {
            case "self":
                return [card.Owner.Creature];
            case "all_enemies":
                return combat.HittableEnemies;
            case "random_enemy":
            case "":
                return PickRandomEnemy(card, combat);
            default:
                SfLog.Warn("card " + card.Id + ": unknown effect target " + e.Target + ", using random_enemy");
                return PickRandomEnemy(card, combat);
        }
    }

    private static IReadOnlyList<Creature> PickRandomEnemy(CardModel card, MegaCrit.Sts2.Core.Combat.ICombatState combat)
    {
        var picked = card.Owner.RunState?.Rng.CombatTargets.NextItem(combat.HittableEnemies);
        return picked != null ? [picked] : [];
    }

    /// <summary>ValueProp 是位标志（Unblockable=2, Unpowered=4, Move=8, SkipHurtAnim=0x10）。
    /// 默认 Move（卡牌伤害/格挡受力量等修正，原版约定）。</summary>
    public static ValueProp ParseProps(List<string> names)
    {
        if (names.Count == 0)
        {
            return ValueProp.Move;
        }
        ValueProp p = 0;
        foreach (var n in names)
        {
            if (System.Enum.TryParse<ValueProp>(n, out var v))
            {
                p |= v;
            }
        }
        return p;
    }
}

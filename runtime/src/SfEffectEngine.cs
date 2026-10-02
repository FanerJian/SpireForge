using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.Powers;
using MegaCrit.Sts2.Core.ValueProps;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// 效果解释器（静态引擎）。SfCardBase 与原版卡覆盖（SfVanillaOverride 的 Harmony 前缀）
/// 共用同一套执行逻辑：同一条 JSON 效果清单在"新建卡"与"改原版卡"上行为一致。
/// 约定：单个效果失败只记 SfLog 并跳过，不中断整场结算（RunAsync 逐条 try/catch）。
/// </summary>
public static class SfEffectEngine
{
    /// <summary>需要 PlayerChoiceContext 的种类（on_enter_combat 上下文为 null，不可用）</summary>
    private static readonly SfEffectKind[] NeedsChoice =
    [
        SfEffectKind.Damage, SfEffectKind.Draw, SfEffectKind.LoseHp,
        SfEffectKind.Power, SfEffectKind.Discard, SfEffectKind.Exhaust,
    ];

    /// <summary>按清单顺序执行效果。ctx 为 null 的上下文（on_enter_combat）禁用需要选择的目标类效果。</summary>
    public static async Task RunAsync(
        CardModel card, List<SfEffect> effects, PlayerChoiceContext? ctx, CardPlay? play, string trigger)
    {
        foreach (var e in effects)
        {
            if (ctx == null && NeedsChoice.Contains(e.Kind))
            {
                SfLog.Error("card " + card.Id + ": effect " + e.KindName +
                            " needs a choice context (on_enter_combat unsupported)");
                continue;
            }
            try
            {
                await RunOne(card, e, ctx, play, trigger);
            }
            catch (System.Exception ex)
            {
                SfLog.Error("card " + card.Id + ": effect " + e.KindName + " failed on " + trigger + ": " + ex.Message);
            }
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

            // ---- 以下为 2026-10 扩充种类 ----

            case SfEffectKind.Discard:
            {
                // 随机弃 N 张手牌（ CombatCardSelection 流，与游戏选牌 RNG 同源）
                var hand = card.Owner.PlayerCombatState?.Hand;
                if (hand == null)
                {
                    SfLog.Error("card " + card.Id + ": no combat hand, discard skipped");
                    break;
                }
                foreach (var c in PickRandomCards(hand.Cards, (int)e.Amount, card))
                {
                    await CardCmd.Discard(ctx!, c);
                }
                break;
            }
            case SfEffectKind.Exhaust:
            {
                var hand = card.Owner.PlayerCombatState?.Hand;
                if (hand == null)
                {
                    SfLog.Error("card " + card.Id + ": no combat hand, exhaust skipped");
                    break;
                }
                foreach (var c in PickRandomCards(hand.Cards, (int)e.Amount, card))
                {
                    await CardCmd.Exhaust(ctx!, c);
                }
                break;
            }
            case SfEffectKind.Gold:
                if (e.Amount >= 0)
                {
                    await PlayerCmd.GainGold(e.Amount, card.Owner);
                }
                else
                {
                    await PlayerCmd.LoseGold(-e.Amount, card.Owner);
                }
                break;
            case SfEffectKind.LoseHp:
                // 失去生命：无来源、不可格挡、不受力量修正（原版 HP loss 语义）
                await CreatureCmd.Damage(ctx!, card.Owner.Creature, e.Amount,
                    ValueProp.Unblockable | ValueProp.Unpowered, null, null, play);
                break;
            case SfEffectKind.MaxHp:
                if (e.Amount <= 0)
                {
                    SfLog.Warn("card " + card.Id + ": max_hp amount must be positive, skipped");
                    break;
                }
                await CreatureCmd.GainMaxHp(card.Owner.Creature, e.Amount);
                break;
            case SfEffectKind.Power:
            {
                // 施加增益/减益：params.power = 力量名（Vulnerable/Poison/Strength/任意 PowerModel 子类名）
                var powerName = e.StringParam("power");
                if (string.IsNullOrWhiteSpace(powerName))
                {
                    SfLog.Error("card " + card.Id + ": power effect missing params.power");
                    break;
                }
                var powerType = SfPowerResolver.Find(powerName);
                if (powerType == null)
                {
                    SfLog.Error("card " + card.Id + ": unknown power '" + powerName + "'");
                    break;
                }
                foreach (var target in ResolveTargetList(card, e, play))
                {
                    await SfPowerResolver.Apply(ctx!, powerType, target, e.Amount, card.Owner.Creature, card);
                }
                break;
            }
            case SfEffectKind.Spawn:
            {
                // 生成卡牌：params.card_entry = 目标卡 Entry（自定义或原版均可），params.pile = draw/hand/discard
                var entry = e.StringParam("card_entry");
                if (string.IsNullOrWhiteSpace(entry))
                {
                    SfLog.Error("card " + card.Id + ": spawn effect missing params.card_entry");
                    break;
                }
                var template = ModelDb.AllCards.FirstOrDefault(c =>
                    string.Equals(c.Id.Entry, entry.Trim(), System.StringComparison.OrdinalIgnoreCase));
                if (template == null)
                {
                    SfLog.Error("card " + card.Id + ": spawn source card not found: " + entry);
                    break;
                }
                var pileType = e.StringParam("pile").Trim().ToLowerInvariant() switch
                {
                    "hand" => PileType.Hand,
                    "discard" => PileType.Discard,
                    _ => PileType.Draw,
                };
                var count = System.Math.Max(1, (int)e.Amount);
                for (var i = 0; i < count; i++)
                {
                    var clone = template.ToMutable();
                    await CardPileCmd.AddGeneratedCardToCombat(clone, pileType, card.Owner);
                }
                break;
            }

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

    /// <summary>从手牌里随机挑 n 张（CombatCardSelection RNG 流）</summary>
    private static List<CardModel> PickRandomCards(IReadOnlyList<CardModel> hand, int n, CardModel card)
    {
        var rng = card.Owner.RunState?.Rng.CombatCardSelection;
        var pool = new List<CardModel>(hand);
        var picked = new List<CardModel>();
        while (picked.Count < n && pool.Count > 0)
        {
            var c = rng != null ? rng.NextItem(pool) : pool[0];
            if (c != null)
            {
                picked.Add(c);
                pool.Remove(c);
            }
            else
            {
                break;
            }
        }
        return picked;
    }

    /// <summary>power 效果的目标集合：
    /// 打出时 target=self 或钩子上下文按 target 字段解析；否则用玩家指定目标。</summary>
    private static IReadOnlyList<Creature> ResolveTargetList(CardModel card, SfEffect e, CardPlay? play)
    {
        var self = string.Equals((e.Target ?? "").Trim(), "self", System.StringComparison.OrdinalIgnoreCase);
        if (play != null && play.Target != null && !self)
        {
            return [play.Target];
        }
        return ResolveTargets(card, e);
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

/// <summary>
/// 力量名 → PowerModel 子类 解析（power 效果用）。
/// 扫描全部已加载程序集（覆盖原版力量与第三方 mod 注册的 PowerModel 子类），
/// 名字匹配规则：完整类名（VulnerablePower）或去掉 Power 后缀（Vulnerable），不区分大小写。
/// </summary>
internal static class SfPowerResolver
{
    private static readonly Dictionary<string, System.Type> Cache =
        new(System.StringComparer.OrdinalIgnoreCase);
    private static bool _scanned;

    public static System.Type? Find(string name)
    {
        EnsureScan();
        return Cache.TryGetValue(name.Trim(), out var t) ? t : null;
    }

    private static void EnsureScan()
    {
        if (_scanned)
        {
            return;
        }
        _scanned = true;
        foreach (var asm in System.AppDomain.CurrentDomain.GetAssemblies())
        {
            System.Type[] types;
            try
            {
                types = asm.GetTypes();
            }
            catch (System.Exception)
            {
                continue; // 动态/受限程序集跳过
            }
            foreach (var t in types)
            {
                if (t.IsAbstract || !typeof(PowerModel).IsAssignableFrom(t))
                {
                    continue;
                }
                var n = t.Name;
                Cache[n] = t;
                if (n.Length > 5 && n.EndsWith("Power", System.StringComparison.Ordinal))
                {
                    Cache[n[..^5]] = t;
                }
            }
        }
    }

    /// <summary>调 PowerCmd.Apply&lt;T&gt;（单目标泛型重载，6 参）</summary>
    public static async Task Apply(
        PlayerChoiceContext ctx, System.Type powerType, Creature target,
        decimal amount, Creature applier, CardModel cardSource)
    {
        var open = typeof(PowerCmd)
            .GetMethods(BindingFlags.Public | BindingFlags.Static)
            .First(m => m.Name == "Apply" && m.IsGenericMethodDefinition
                        && m.GetParameters().Length == 6
                        && m.GetParameters()[1].ParameterType == typeof(Creature));
        var closed = open.MakeGenericMethod(powerType);
        await (Task)(closed.Invoke(null, [ctx, target, amount, applier, cardSource, false])
                     ?? Task.CompletedTask);
    }
}

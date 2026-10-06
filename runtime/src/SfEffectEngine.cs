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

    /// <summary>按清单顺序执行效果。ctx 为 null 的上下文（on_enter_combat）禁用需要选择的目标类效果。
    /// useVarBinding=false 时效果一律取字面数值（delayed 内嵌清单：变量属于打出效果，内嵌不该借用）。</summary>
    public static async Task RunAsync(
        CardModel card, List<SfEffect> effects, PlayerChoiceContext? ctx, CardPlay? play, string trigger,
        bool useVarBinding = true)
    {
        for (var i = 0; i < effects.Count; i++)
        {
            var e = effects[i];
            if (ctx == null && NeedsChoice.Contains(e.Kind))
            {
                SfLog.Error("card " + card.Id + ": effect " + e.KindName +
                            " needs a choice context (on_enter_combat unsupported)");
                continue;
            }
            try
            {
                await RunOne(card, e, ctx, play, trigger,
                    useVarBinding ? SfVarNaming.Name(effects, i) : null);
            }
            catch (System.Exception ex)
            {
                SfLog.Error("card " + card.Id + ": effect " + e.KindName + " failed on " + trigger + ": " + ex.Message);
            }
        }
    }

    /// <summary>效果的实际数值：绑定的 DynamicVar 存在（含升级后的值）则取变量，
    /// 否则回落字面值（钩子效果、原版覆盖卡没有对应变量的种类）。
    /// 查找用 TryGetValue——DynamicVarSet 的索引器对缺失键直接抛异常。</summary>
    private static decimal Amount(CardModel card, SfEffect e, string? varName)
    {
        if (varName != null && card.DynamicVars != null
            && card.DynamicVars.TryGetValue(varName, out var v))
        {
            return v.BaseValue;
        }
        return e.Amount;
    }

    private static async Task RunOne(
        CardModel card, SfEffect e, PlayerChoiceContext? ctx, CardPlay? play, string trigger, string? varName)
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
                    // 打出：走原版 AttackCommand 编排（攻击者前摇动画 + 打击特效/音效 + 多段），
                    // 与原版攻击卡（Bash 等）同款；未指定特效时也有标准的出手/受击演出。
                    await SfAttacks.RunCardAttack(card, [play.Target], Amount(card, e, varName), e, ctx, play,
                        play.Target);
                }
                else
                {
                    await SfAttacks.RunTargetsAttack(card, ResolveTargets(card, e), Amount(card, e, varName), e, ctx);
                }
                break;
            }
            case SfEffectKind.Block:
            {
                if (play != null && varName != null && card.DynamicVars != null
                    && card.DynamicVars.TryGetValue(varName, out var bv) && bv is BlockVar blockVar)
                {
                    await CreatureCmd.GainBlock(card.Owner.Creature, blockVar, play);
                }
                else
                {
                    await CreatureCmd.GainBlock(card.Owner.Creature, Amount(card, e, varName), ParseProps(e.Props), play);
                }
                break;
            }
            case SfEffectKind.Draw:
                await CardPileCmd.Draw(ctx!, (int)Amount(card, e, varName), card.Owner);
                break;
            case SfEffectKind.Energy:
                await PlayerCmd.GainEnergy(Amount(card, e, varName), card.Owner);
                break;
            case SfEffectKind.Heal:
                await CreatureCmd.Heal(card.Owner.Creature, Amount(card, e, varName));
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
                foreach (var c in PickRandomCards(hand.Cards, (int)Amount(card, e, varName), card))
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
                foreach (var c in PickRandomCards(hand.Cards, (int)Amount(card, e, varName), card))
                {
                    await CardCmd.Exhaust(ctx!, c);
                }
                break;
            }
            case SfEffectKind.Gold:
            {
                var gold = Amount(card, e, varName);
                if (gold >= 0)
                {
                    await PlayerCmd.GainGold(gold, card.Owner);
                }
                else
                {
                    await PlayerCmd.LoseGold(-gold, card.Owner);
                }
                break;
            }
            case SfEffectKind.LoseHp:
                // 失去生命：无来源、不可格挡、不受力量修正（原版 HP loss 语义）
                await CreatureCmd.Damage(ctx!, card.Owner.Creature, Amount(card, e, varName),
                    ValueProp.Unblockable | ValueProp.Unpowered, null, null, play);
                break;
            case SfEffectKind.MaxHp:
            {
                var gain = Amount(card, e, varName);
                if (gain <= 0)
                {
                    SfLog.Warn("card " + card.Id + ": max_hp amount must be positive, skipped");
                    break;
                }
                await CreatureCmd.GainMaxHp(card.Owner.Creature, gain);
                break;
            }
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
                    await SfPowerResolver.Apply(ctx!, powerType, target, Amount(card, e, varName), card.Owner.Creature, card);
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
                var combat = card.Owner.Creature.CombatState;
                if (combat == null)
                {
                    SfLog.Error("card " + card.Id + ": spawn has no combat state, skipped");
                    break;
                }
                var count = System.Math.Max(1, (int)Amount(card, e, varName));
                for (var i = 0; i < count; i++)
                {
                    // 必须经 CombatState.CreateCard 注册（= CreateCard：ToMutable+登记 Owner+AfterCreated）。
                    // 裸 ToMutable 克隆没有 Owner，AddGeneratedCardsToCombat 里 list[0].Owner.Creature
                    // 直接 NRE（游戏内实测）；ForgeCmd/DualWield/SfGrant 全是同款正规配方。
                    var clone = combat.CreateCard(template, card.Owner);
                    await CardPileCmd.AddGeneratedCardToCombat(clone, pileType, card.Owner);
                }
                break;
            }

            case SfEffectKind.Summon:
            {
                // 召唤敌人：params.monster = 怪物类名或 Entry（DampCultist / DAMP_CULTIST），
                // params.hp = 指定生命（缺省用怪物原生 HP 区间）；amount = 数量（默认 1）。
                var combat = card.Owner.Creature.CombatState
                    ?? MegaCrit.Sts2.Core.Combat.CombatManager.Instance.DebugOnlyGetState();
                if (combat == null)
                {
                    SfLog.Error("card " + card.Id + ": summon has no combat state, skipped");
                    break;
                }
                var monsterName = e.StringParam("monster");
                var template = SfMonsterResolver.Find(monsterName);
                if (template == null)
                {
                    SfLog.Error("card " + card.Id + ": unknown summon monster '" + monsterName + "'");
                    break;
                }
                var hp = e.DecimalParam("hp");
                var count = System.Math.Max(1, (int)Amount(card, e, varName));
                for (var i = 0; i < count; i++)
                {
                    var model = template.ToMutable();
                    // 落位：当前遭遇的站位里随机挑空位（与 Fabricator/LivingFog 召唤同源），
                    // 没有空位时随机复用既有站位，连站位表都没有时才落回默认位置
                    var slot = PickSummonSlot(combat, card);
                    var creature = slot != null
                        ? await CreatureCmd.Add(model, combat, MegaCrit.Sts2.Core.Combat.CombatSide.Enemy, slot)
                        : await CreatureCmd.Add(model, combat);
                    if (hp is > 0)
                    {
                        await CreatureCmd.SetMaxAndCurrentHp(creature, hp.Value);
                    }
                }
                break;
            }

            case SfEffectKind.Delayed:
            {
                // 延迟效果：下 N 回合的每回合开始/结束时执行内嵌效果清单（SfDelayedPower 承载）。
                // turns 缺省回落 amount（编辑器把持续回合写进 amount 也认）
                var turns = (int)(e.DecimalParam("turns") ?? e.Amount);
                var inner = e.Effects;
                if (turns < 1 || inner == null || inner.Count == 0)
                {
                    SfLog.Error("card " + card.Id + ": delayed effect needs turns>=1 and a non-empty effects list");
                    break;
                }
                var combat = card.Owner.Creature.CombatState;
                if (combat == null)
                {
                    SfLog.Error("card " + card.Id + ": delayed has no combat state, skipped");
                    break;
                }
                await SfDelayedPower.Schedule(combat, card, ctx, inner, turns, e.Timing, e.EveryTurn);
                break;
            }

            case SfEffectKind.Vfx:
            {
                // 播放视觉特效（纯演出，不影响数值）：params.vfx / 顶层 vfx = 特效 spec，
                // target：random_enemy（默认）/ all_enemies（阵营中心一次）/ self / screen
                var spec = e.StringParam("vfx");
                if (string.IsNullOrWhiteSpace(spec))
                {
                    SfLog.Error("card " + card.Id + ": vfx effect missing params.vfx");
                    break;
                }
                switch ((e.Target ?? "").Trim().ToLowerInvariant())
                {
                    case "screen":
                        SfVfx.PlayFullScreen(spec, card.Owner?.Creature);
                        break;
                    case "side_player":
                        if (RequireCombat(card) is { } pc) SfVfx.PlayOnSide(MegaCrit.Sts2.Core.Combat.CombatSide.Player, spec, pc);
                        break;
                    case "side_enemy":
                        if (RequireCombat(card) is { } ec) SfVfx.PlayOnSide(MegaCrit.Sts2.Core.Combat.CombatSide.Enemy, spec, ec);
                        break;
                    default:
                        foreach (var t in ResolveTargetList(card, e, play))
                        {
                            SfVfx.PlayOnCreature(t, spec);
                        }
                        break;
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
                    var name = !string.IsNullOrWhiteSpace(e.Handler) ? e.Handler : e.KindName;
                    SfLog.Error("card " + card.Id + ": unregistered custom effect " + name +
                                " (handler mod missing)");
                }
                break;
            }
        }
    }

    /// <summary>召唤落位：当前遭遇的站位表（Encounter.Slots，场景 Marker2D 名单）里
    /// 随机挑一个未被占用的；全部占用时随机复用既有站位（视觉重叠可接受）；
    /// 没有站位表时返回 null（游戏默认位置）。站位选择失败不阻断召唤。</summary>
    private static string? PickSummonSlot(MegaCrit.Sts2.Core.Combat.ICombatState combat, CardModel card)
    {
        try
        {
            var slots = combat.Encounter?.Slots;
            if (slots == null || slots.Count == 0)
            {
                return null;
            }
            var free = new List<string>();
            foreach (var s in slots)
            {
                if (combat.Enemies.All(c => !string.Equals(c.SlotName, s, System.StringComparison.Ordinal)))
                {
                    free.Add(s);
                }
            }
            var pool = free.Count > 0 ? free : slots.ToList();
            var rng = card.Owner.RunState?.Rng.CombatTargets;
            var pick = rng != null ? rng.NextItem(pool) : pool[0];
            return string.IsNullOrEmpty(pick) ? null : pick;
        }
        catch (System.Exception ex)
        {
            SfLog.Warn("card " + card.Id + ": pick summon slot failed, using default position: " + ex.Message);
            return null;
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

    /// <summary>钩子/特效播放用的战斗状态（缺失记日志并返回 null，调用方自行跳过）。</summary>
    private static MegaCrit.Sts2.Core.Combat.ICombatState? RequireCombat(CardModel card)
    {
        var combat = card.Owner?.Creature?.CombatState;
        if (combat == null)
        {
            SfLog.Warn("card " + card.Id + ": no combat state for vfx, skipped");
        }
        return combat;
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
/// 打出效果 → DynamicVar 名的确定性命名（SfCardBase.CanonicalVars 建变量与
/// SfEffectEngine 取值必须使用同一规则）。同种类第 n 条（n≥2）加序号后缀：
/// DynamicVarSet 对重复键直接抛 ArgumentException（如两张 damage 都叫 "Damage"）。
/// 变量基名与原版 loc 占位符约定一致（抽牌 = Cards、失去生命 = LoseHp…）。
/// 钩子效果与 custom 不建变量（Name 返回 null，引擎回落字面值）。
/// </summary>
internal static class SfVarNaming
{
    /// <summary>种类 → 变量基名；返回空串 = 该种类无数值变量。</summary>
    public static string BaseName(SfEffectKind k) => k switch
    {
        SfEffectKind.Damage => "Damage",
        SfEffectKind.Block => "Block",
        SfEffectKind.Draw => "Cards",
        SfEffectKind.Energy => "Energy",
        SfEffectKind.Heal => "Heal",
        SfEffectKind.LoseHp => "LoseHp",
        SfEffectKind.Gold => "Gold",
        SfEffectKind.MaxHp => "MaxHp",
        SfEffectKind.Discard => "Discard",
        SfEffectKind.Exhaust => "Exhaust",
        SfEffectKind.Spawn => "Spawn",
        SfEffectKind.Summon => "Summon",
        _ => "",
    };

    /// <summary>效果清单中第 index 条的变量名；无数值变量（custom 等）返回 null。
    /// 同种类多条：第一条用基名，其后 Damage2/Damage3…（编辑器描述生成用同名规则）。</summary>
    public static string? Name(IReadOnlyList<SfEffect> effects, int index)
    {
        var baseName = BaseName(effects[index].Kind);
        if (baseName.Length == 0)
        {
            return null;
        }
        var seen = 0;
        for (var i = 0; i <= index; i++)
        {
            if (effects[i].Kind == effects[index].Kind)
            {
                seen++;
            }
        }
        return seen == 1 ? baseName : baseName + seen;
    }
}

/// <summary>
/// 怪物名 → MonsterModel 解析（summon 效果用）。遍历 ModelDb.Monsters（全部已注册怪物），
/// 同时匹配类名（DampCultist）与 Id.Entry（DAMP_CULTIST），不区分大小写。
/// </summary>
internal static class SfMonsterResolver
{
    public static MonsterModel? Find(string name)
    {
        var n = (name ?? "").Trim();
        if (n.Length == 0)
        {
            return null;
        }
        foreach (var m in ModelDb.Monsters)
        {
            if (string.Equals(m.GetType().Name, n, System.StringComparison.OrdinalIgnoreCase)
                || string.Equals(m.Id.Entry, n, System.StringComparison.OrdinalIgnoreCase))
            {
                return m;
            }
        }
        return null;
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

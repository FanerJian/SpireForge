using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;

namespace SpireForge.Runtime;

/// <summary>
/// 数据驱动卡牌的解释器基类。
/// 每张 SpireForge 卡牌是本类的一个空壳子类（Reflection.Emit 生成，或编译进本程序集），
/// 构造器以常量传入 cost/type/rarity/target（与原版卡一致）；
/// 全部行为按"类型名 Slugify 后的 Entry"从 PackLoader.Defs 查定义。
/// 打出效果与生命周期钩子共用同一解释器；kind 不属于内建五种时转交
/// SpireForge.Api.SfEffects 注册表（第三方 mod 的扩展点）。
/// </summary>
public abstract class SfCardBase : CardModel
{
    protected SfCardBase(int cost, CardType type, CardRarity rarity, TargetType target)
        : base(cost, type, rarity, target)
    {
    }

    protected SfCardBase(SfCardDef def)
        : base(def.CostsX ? 1 : def.Cost, def.Type, def.RarityEnum, def.TargetEnum)
    {
    }

    private SfCardDef Def()
    {
        string entry = IdHelper.EntryOfTypeName(GetType().Name);
        if (PackLoader.Defs.TryGetValue(entry, out var def))
        {
            return def;
        }
        // 兼容 spike 阶段的编译期注册表
        return SfCardBase.SpikeDefs.TryGetValue(entry, out var spikeDef)
            ? spikeDef.ToRuntimeDef()
            : throw new System.InvalidOperationException(
                $"SpireForge: no card definition registered for entry '{entry}' (type '{GetType().Name}')");

    }

    /// <summary>spike 编译卡注册表（正式内容走 PackLoader.Defs）。</summary>
    public static readonly Dictionary<string, SpikeSfCardDef> SpikeDefs = new();

    public override string PortraitPath
    {
        get
        {
            var def = TryDef();
            if (def == null || string.IsNullOrEmpty(def.Portrait))
            {
                return MissingPortraitPath;
            }
            return $"res://{PackLoader.PackOf[IdHelper.EntryOfTypeName(GetType().Name)]}/{def.Portrait}";
        }
    }

    private SfCardDef? TryDef()
    {
        string entry = IdHelper.EntryOfTypeName(GetType().Name);
        if (PackLoader.Defs.TryGetValue(entry, out var d)) return d;
        return SpikeDefs.TryGetValue(entry, out var s) ? s.ToRuntimeDef() : null;
    }

    public override bool GainsBlock => TryDef()?.HasBlock ?? false;

    public override int MaxUpgradeLevel => TryDef()?.MaxUpgradeLevel ?? 1;

    public override IEnumerable<CardKeyword> CanonicalKeywords
    {
        get
        {
            var def = TryDef();
            if (def == null)
            {
                return Enumerable.Empty<CardKeyword>();
            }
            var kws = def.KeywordEnums;
            // 负费用 = 不可打出（原版约定：Burn 等是 -1 费 + Unplayable 关键字，
            // 只有费用游戏仍允许打出——这里按编辑器语义自动补关键字）
            if (def.Cost < 0 && !kws.Contains(CardKeyword.Unplayable))
            {
                return kws.Concat([CardKeyword.Unplayable]);
            }
            return kws;
        }
    }

    public override CardMultiplayerConstraint MultiplayerConstraint =>
        (TryDef()?.Multiplayer) switch
        {
            "multiplayer_only" => CardMultiplayerConstraint.MultiplayerOnly,
            "singleplayer_only" => CardMultiplayerConstraint.SingleplayerOnly,
            _ => CardMultiplayerConstraint.None,
        };

    /// <summary>每个打出效果一个 DynamicVar（命名见 SfVarNaming，供描述占位符引用与升级）。
    /// damage/block/draw/energy/heal 用原版专用变量类型（保留力量/附魔修正链），
    /// 其余数值种类用 IntVar 承载数值（引擎语义不变，只让数值可升级、描述可占位）。
    /// 钩子与 custom 效果使用字面数值，不参与变量绑定。</summary>
    protected override IEnumerable<DynamicVar> CanonicalVars
    {
        get
        {
            var def = Def();
            var effects = def.Effects;
            for (var i = 0; i < effects.Count; i++)
            {
                var e = effects[i];
                var name = SfVarNaming.Name(effects, i);
                if (name == null)
                {
                    continue;
                }
                var props = SfEffectEngine.ParseProps(e.Props);
                switch (e.Kind)
                {
                    case SfEffectKind.Damage:
                        yield return new DamageVar(name, e.Amount, props);
                        break;
                    case SfEffectKind.Block:
                        yield return new BlockVar(name, e.Amount, props);
                        break;
                    case SfEffectKind.Draw:
                        yield return new CardsVar(name, (int)e.Amount);
                        break;
                    case SfEffectKind.Energy:
                        yield return new EnergyVar(name, (int)e.Amount);
                        break;
                    case SfEffectKind.Heal:
                        yield return new HealVar(name, e.Amount);
                        break;
                    default:
                        // lose_hp/gold/max_hp/discard/exhaust/spawn/summon：通用数值变量
                        yield return new IntVar(name, e.Amount);
                        break;
                }
            }
        }
    }

    protected override async Task OnPlay(PlayerChoiceContext choiceContext, CardPlay cardPlay)
    {
        await SfEffectEngine.RunAsync(this, Def().Effects, choiceContext, cardPlay, "play");
    }

    // ---- 生命周期钩子（自作用：card == this 时才执行；语义见 SCHEMA.md）----

    public override bool HasTurnEndInHandEffect => TryDef()?.OnTurnEndInHand is { Count: > 0 };

    public override async Task AfterCardDrawn(PlayerChoiceContext choiceContext, CardModel card, bool fromHandDraw)
    {
        if (card != this)
        {
            return;
        }
        await RunHook("on_draw", TryDef()?.OnDraw, choiceContext);
    }

    public override async Task AfterCardDiscarded(PlayerChoiceContext choiceContext, CardModel card)
    {
        if (card != this)
        {
            return;
        }
        await RunHook("on_discard", TryDef()?.OnDiscard, choiceContext);
    }

    public override async Task AfterCardExhausted(PlayerChoiceContext choiceContext, CardModel card, bool causedByEthereal)
    {
        if (card != this)
        {
            return;
        }
        await RunHook("on_exhaust", TryDef()?.OnExhaust, choiceContext);
    }

    public override async Task AfterCardEnteredCombat(CardModel card)
    {
        if (card != this)
        {
            return;
        }
        // 游戏的 AfterCardEnteredCombat 分发不携带 PlayerChoiceContext，
        // 因此仅支持无需上下文的效果（block/heal/energy/custom）
        await RunHook("on_enter_combat", TryDef()?.OnEnterCombat, null);
    }

    protected override async Task OnTurnEndInHand(PlayerChoiceContext choiceContext)
    {
        await RunHook("on_turn_end_in_hand", TryDef()?.OnTurnEndInHand, choiceContext);
    }

    private async Task RunHook(string trigger, List<SfEffect>? effects, PlayerChoiceContext? ctx)
    {
        if (effects == null || effects.Count == 0)
        {
            return;
        }
        Log.Info($"SPIREFORGE: hook {trigger} -> {Id}");
        await SfEffectEngine.RunAsync(this, effects, ctx, null, trigger);
    }

    // ---- 效果解释器：见 SfEffectEngine（与原版卡覆盖共用） ----

    protected override void OnUpgrade()
    {
        var def = Def();
        var u = def.Upgrades;
        var effects = def.Effects;
        var legacyApplied = new HashSet<SfEffectKind>();
        for (var i = 0; i < effects.Count; i++)
        {
            var e = effects[i];
            var delta = e.UpgradeAmount;
            if (delta == 0 && legacyApplied.Add(e.Kind))
            {
                // 兼容旧五通道（2026-10 前的卡包）：效果未单独写 upgrade_amount 时，
                // 该种类第一条效果沿用 upgrades.* 的增量；写了 per-effect 则以它为准
                delta = e.Kind switch
                {
                    SfEffectKind.Damage => u.Damage,
                    SfEffectKind.Block => u.Block,
                    SfEffectKind.Draw => u.Draw,
                    SfEffectKind.Energy => u.Energy,
                    SfEffectKind.Heal => u.Heal,
                    _ => 0,
                };
            }
            if (delta == 0)
            {
                continue;
            }
            var name = SfVarNaming.Name(effects, i);
            if (name != null && DynamicVars.TryGetValue(name, out var v))
            {
                v.UpgradeValueBy(delta);
            }
        }
    }
}

using MegaCrit.Sts2.Core.Entities.Cards;

namespace SpireForge.Runtime;

/// <summary>spike 编译期测试卡的定义载体（正式内容走 PackLoader 的 JSON）。</summary>
public sealed class SpikeSfCardDef
{
    public int Cost { get; init; }
    public CardType Type { get; init; }
    public CardRarity Rarity { get; init; }
    public TargetType Target { get; init; }
    public Type Pool { get; init; } = typeof(MegaCrit.Sts2.Core.Models.CardPools.ColorlessCardPool);
    public decimal Damage { get; init; }
    public decimal Block { get; init; }
    public int Draw { get; init; }
    public decimal DamageUpgrade { get; init; }
    public decimal BlockUpgrade { get; init; }
    public int MaxUpgrade { get; init; } = 1;
    public CardKeyword[] Keywords { get; init; } = [];
    public List<SfEffect> Effects { get; init; } = [];
    public List<SfEffect> OnDraw { get; init; } = [];
    public List<SfEffect> OnDiscard { get; init; } = [];
    public List<SfEffect> OnExhaust { get; init; } = [];
    public List<SfEffect> OnEnterCombat { get; init; } = [];
    public List<SfEffect> OnTurnEndInHand { get; init; } = [];

    public SfCardDef ToRuntimeDef() => new()
    {
        Id = "spike",
        Cost = Cost,
        CardType = Type.ToString(),
        Rarity = Rarity.ToString(),
        Target = Target.ToString(),
        Keywords = Keywords.Select(k => k.ToString()).ToList(),
        MaxUpgradeLevel = MaxUpgrade,
        Effects = Effects.Count > 0 ? Effects : BuildEffects(Damage, Block, Draw),
        Upgrades = new SfUpgrades { Damage = DamageUpgrade, Block = BlockUpgrade },
        OnDraw = OnDraw,
        OnDiscard = OnDiscard,
        OnExhaust = OnExhaust,
        OnEnterCombat = OnEnterCombat,
        OnTurnEndInHand = OnTurnEndInHand,
    };

    private static List<SfEffect> BuildEffects(decimal damage, decimal block, int draw)
    {
        var list = new List<SfEffect>();
        if (damage != 0)
        {
            list.Add(new SfEffect(SfEffectKind.Damage, damage) { Props = ["Move"] });
        }
        if (block != 0)
        {
            list.Add(new SfEffect(SfEffectKind.Block, block) { Props = ["Move"] });
        }
        if (draw != 0)
        {
            list.Add(new SfEffect(SfEffectKind.Draw, draw));
        }
        return list;
    }
}

/// <summary>编译期注册的 spike 测试卡（验证 mod DLL 内类型自动发现路径）。</summary>
public sealed class SfSpikeStrike : SfCardBase
{
    public SfSpikeStrike() : base(1, CardType.Attack, CardRarity.Common, TargetType.AnyEnemy) { }
}

public sealed class SfSpikeWard : SfCardBase
{
    public SfSpikeWard() : base(1, CardType.Skill, CardRarity.Common, TargetType.Self) { }
}

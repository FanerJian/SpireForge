using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using StsCards = MegaCrit.Sts2.Core.Entities.Cards;

namespace SpireForge.Runtime;

/// <summary>效果种类（对应编辑器 schema/effects 的 kind 字段）。
/// Custom：kind 不属于内建种类时的一切效果，执行时转交 SpireForge.Api.SfEffects 注册表。</summary>
public enum SfEffectKind
{
    Damage,
    Block,
    Draw,
    Energy,
    Heal,
    Discard,
    Exhaust,
    Gold,
    LoseHp,
    MaxHp,
    Power,
    Spawn,
    Summon,
    Orb,
    OrbSlot,
    Delayed,
    Vfx,
    Custom,
}

/// <summary>单条效果：种类 + 数值 + 修饰。</summary>
public sealed class SfEffect
{
    public SfEffect()
    {
    }

    /// <summary>内建种类便捷构造（spike 卡用）。</summary>
    public SfEffect(SfEffectKind kind, decimal amount)
    {
        KindName = kind.ToString().ToLowerInvariant();
        Amount = amount;
    }

    /// <summary>种类名（小写 snake）：damage/block/draw/energy/heal，或任意自定义名。</summary>
    [JsonPropertyName("kind")]
    public string KindName { get; set; } = "damage";

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    /// <summary>ValueProp 枚举名列表，如 ["Move"]；可组合。</summary>
    [JsonPropertyName("props")]
    public List<string> Props { get; set; } = [];

    /// <summary>升级增量：升级时对本效果绑定的变量 UpgradeValueBy 此值（每次升级叠加）。
    /// 0/缺省 = 未单独设置——damage/block/draw/energy/heal 回落 upgrades.* 旧通道，其余种类无升级。
    /// 打出效果全部绑定 DynamicVar（见 SfVarNaming），因此所有内建种类的数值都可升级；
    /// 钩子效果与 custom 不建变量，本字段不生效。</summary>
    [JsonPropertyName("upgrade_amount")]
    public decimal UpgradeAmount { get; set; }

    /// <summary>custom 效果的处理器名（由其他 mod 通过 SpireForge.Api.SfEffects.Register 注册）。</summary>
    [JsonPropertyName("handler")]
    public string Handler { get; set; } = "";

    /// <summary>钩子上下文的取敌方式：self / random_enemy / all_enemies。
    /// damage 与 custom 在无 cardPlay 时使用，默认 random_enemy（与 Tingsha 同款 RNG）。</summary>
    [JsonPropertyName("target")]
    public string Target { get; set; } = "";

    /// <summary>施加增益/减益：PowerModel 名（编辑器写顶层字段；params.power 亦可）。</summary>
    [JsonPropertyName("power")]
    public string Power { get; set; } = "";

    /// <summary>生成卡牌：卡牌 Entry（编辑器顶层字段；params.card_entry 亦可）。</summary>
    [JsonPropertyName("card_entry")]
    public string CardEntry { get; set; } = "";

    /// <summary>生成卡牌：目标牌堆 draw/hand/discard（编辑器顶层字段；params.pile 亦可）。</summary>
    [JsonPropertyName("pile")]
    public string Pile { get; set; } = "";

    /// <summary>召唤敌人：怪物类名/Entry（编辑器顶层字段；params.monster 亦可）。</summary>
    [JsonPropertyName("monster")]
    public string Monster { get; set; } = "";

    /// <summary>召唤敌人：自定义生命（编辑器顶层字段；params.hp 亦可）。</summary>
    [JsonPropertyName("hp")]
    public decimal? Hp { get; set; }

    /// <summary>生成充能球：lightning/frost/dark/plasma/glass（类名或通名均可），
    /// 缺省/未知 = 随机（编辑器顶层字段；params.orb 亦可）。</summary>
    [JsonPropertyName("orb")]
    public string Orb { get; set; } = "";

    /// <summary>打击特效（damage）：VfxCmd 特效名（attack_blunt 等）、vfx/… 内路径或 res://…
    /// 完整路径；缺省 = 游戏默认受击表现（编辑器顶层字段；params.vfx 亦可）。</summary>
    [JsonPropertyName("vfx")]
    public string Vfx { get; set; } = "";

    /// <summary>打击音效（damage）："event:/sfx/…" 走 FMOD，其余按音频文件名（如 blunt_attack.mp3）
    /// 临时播放（编辑器顶层字段；params.sfx 亦可）。</summary>
    [JsonPropertyName("sfx")]
    public string Sfx { get; set; } = "";

    /// <summary>播放来源（vfx 效果）：target（缺省，按 target 字段定位）/
    /// self（卡牌使用者）/ 怪物类名或 Entry（场上该怪活体）。（params.source 亦可）</summary>
    [JsonPropertyName("source")]
    public string Source { get; set; } = "";

    /// <summary>延迟效果（delayed）：触发哪一方的回合时机 player（缺省，我方）/
    /// enemy（敌方）/ both（双方）。缺省与我方触发的历史行为一致。</summary>
    [JsonPropertyName("side")]
    public string Side { get; set; } = "";

    /// <summary>攻击者侧特效（damage，如出手投掷物）（编辑器顶层字段；params.attacker_vfx 亦可）。</summary>
    [JsonPropertyName("attacker_vfx")]
    public string AttackerVfx { get; set; } = "";

    /// <summary>多段打击（damage）：总伤害 = 数值 × 段数，每段各带打击特效（params.hit_count 亦可）。</summary>
    [JsonPropertyName("hit_count")]
    public decimal? HitCount { get; set; }

    /// <summary>延迟效果（delayed）：持续回合数（>=1）。</summary>
    [JsonPropertyName("turns")]
    public decimal? Turns { get; set; }

    /// <summary>延迟效果（delayed）：触发时机 turn_end（默认）/ turn_start。</summary>
    [JsonPropertyName("timing")]
    public string Timing { get; set; } = "";

    /// <summary>延迟效果（delayed）：true（缺省）= 每回合触发内嵌清单；false = 等 turns 回合后仅在最后一次时机触发一次。</summary>
    [JsonPropertyName("every_turn")]
    public bool EveryTurn { get; set; } = true;

    /// <summary>延迟效果（delayed）：逐回合执行的内嵌效果清单（语法与打出效果一致，
    /// 目标语义同钩子——self/random_enemy/all_enemies；可再嵌套 delayed）。</summary>
    [JsonPropertyName("effects")]
    public List<SfEffect>? Effects { get; set; }

    /// <summary>custom 效果的透传参数（任意 JSON 对象，处理器自解释）。</summary>
    [JsonPropertyName("params")]
    public Dictionary<string, System.Text.Json.JsonElement>? Params { get; set; }

    /// <summary>解析后的种类（内建种类之外的 kind 一律视为 Custom）。
    /// 只读计算属性：必须 Ignore，否则与 KindName 的 "kind" 序列化名冲突。</summary>
    [JsonIgnore]
    public SfEffectKind Kind => (KindName ?? "").Trim().ToLowerInvariant() switch
    {
        "damage" => SfEffectKind.Damage,
        "block" => SfEffectKind.Block,
        "draw" => SfEffectKind.Draw,
        "energy" => SfEffectKind.Energy,
        "heal" => SfEffectKind.Heal,
        "discard" => SfEffectKind.Discard,
        "exhaust" => SfEffectKind.Exhaust,
        "gold" => SfEffectKind.Gold,
        "lose_hp" => SfEffectKind.LoseHp,
        "max_hp" => SfEffectKind.MaxHp,
        "power" => SfEffectKind.Power,
        "spawn" => SfEffectKind.Spawn,
        "summon" => SfEffectKind.Summon,
        "orb" => SfEffectKind.Orb,
        "orb_slot" => SfEffectKind.OrbSlot,
        "delayed" => SfEffectKind.Delayed,
        "vfx" => SfEffectKind.Vfx,
        _ => SfEffectKind.Custom,
    };

    /// <summary>效果参数里的字符串值：优先 params.*，回落到编辑器的顶层字段
    /// （power/card_entry/pile/monster——System.Text.Json 默认会丢掉未声明属性，
    /// 所以顶层字段必须显式声明，否则编辑器卡牌的效果在游戏里静默失效）。</summary>
    public string StringParam(string key)
    {
        if (Params != null && Params.TryGetValue(key, out var v) && v.ValueKind == System.Text.Json.JsonValueKind.String)
        {
            return v.GetString() ?? "";
        }
        return key switch
        {
        "power" => Power,
        "card_entry" => CardEntry,
        "pile" => Pile,
        "monster" => Monster,
        "orb" => Orb,
        "vfx" => Vfx,
            "sfx" => Sfx,
            "attacker_vfx" => AttackerVfx,
            "source" => Source,
            _ => "",
        };
    }

    /// <summary>效果参数里的数值（params.hp 等；hp 回落顶层字段）；缺失或非数字返回 null。</summary>
    public decimal? DecimalParam(string key)
    {
        if (Params != null && Params.TryGetValue(key, out var v))
        {
            if (v.ValueKind == System.Text.Json.JsonValueKind.Number && v.TryGetDecimal(out var d))
            {
                return d;
            }
            if (v.ValueKind == System.Text.Json.JsonValueKind.String
                && decimal.TryParse(v.GetString(), out var d2))
            {
                return d2;
            }
        }
        return key switch
        {
            "hp" => Hp,
            "turns" => Turns,
            "hit_count" => HitCount,
            _ => null,
        };
    }
}

/// <summary>由卡包 JSON 反序列化的卡牌定义（与编辑器 schema/card.json 一一对应）。</summary>
public sealed class SfCardDef
{
    // ---- JSON 反序列化字段（camelCase 由 PackLoader 的 naming policy 处理）----

    [JsonPropertyName("format_version")]
    public int FormatVersion { get; set; } = 1;

    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("card_type")]
    public string CardType { get; set; } = "Attack";

    [JsonPropertyName("rarity")]
    public string Rarity { get; set; } = "Common";

    [JsonPropertyName("target")]
    public string Target { get; set; } = "AnyEnemy";

    [JsonPropertyName("cost")]
    public int Cost { get; set; } = 1;

    [JsonPropertyName("costs_x")]
    public bool CostsX { get; set; }

    [JsonPropertyName("keywords")]
    public List<string> Keywords { get; set; } = [];

    [JsonPropertyName("pool")]
    public string Pool { get; set; } = "colorless";

    /// <summary>额外卡池：非空时本卡注册进这里列出的所有角色卡池（含 pool 主池语义外的池），
    /// 用于"一张卡进多个角色"的多池卡；为空时行为与单池一致。</summary>
    [JsonPropertyName("pools")]
    public List<string> Pools { get; set; } = [];

    /// <summary>本卡应注册进的全部卡池名（pools 优先，回退 pool）</summary>
    public List<string> PoolList =>
        Pools is { Count: > 0 } ? Pools : [Pool];

    [JsonPropertyName("show_in_library")]
    public bool ShowInLibrary { get; set; } = true;

    [JsonPropertyName("multiplayer")]
    public string Multiplayer { get; set; } = "none";

    [JsonPropertyName("max_upgrade_level")]
    public int MaxUpgradeLevel { get; set; } = 1;

    [JsonPropertyName("portrait")]
    public string Portrait { get; set; } = "";

    [JsonPropertyName("effects")]
    public List<SfEffect> Effects { get; set; } = [];

    /// <summary>原版卡覆盖：非空时本定义不新建卡牌，而是改写 ModelDb 中 Entry=此值 的原版卡
    /// （费用/类型/稀有度/目标/数值；effects 非空时整体替换 OnPlay）。见 SfVanillaOverride。</summary>
    [JsonPropertyName("vanilla_id")]
    public string? VanillaId { get; set; }

    /// <summary>原版卡数值覆盖：键 = DynamicVar.Name（如 Damage/Block/Vulnerable），值 = 覆盖后的 BaseValue。</summary>
    [JsonPropertyName("stats")]
    public Dictionary<string, decimal>? Stats { get; set; }

    /// <summary>原版卡升级增量：键 = DynamicVar.Name，值 = 升级时的增量（OnUpgrade 被整体替换）。</summary>
    [JsonPropertyName("upgrade_stats")]
    public Dictionary<string, decimal>? UpgradeStats { get; set; }

    [JsonPropertyName("upgrades")]
    public SfUpgrades Upgrades { get; set; } = new();

    // ---- 生命周期钩子（效果清单，自作用触发；语义见 SCHEMA.md）----

    /// <summary>此牌被抽到时（含开局起手抽牌）。</summary>
    [JsonPropertyName("on_draw")]
    public List<SfEffect> OnDraw { get; set; } = [];

    /// <summary>此牌被弃置时。</summary>
    [JsonPropertyName("on_discard")]
    public List<SfEffect> OnDiscard { get; set; } = [];

    /// <summary>此牌被消耗时（含 Ethereal 消耗）。</summary>
    [JsonPropertyName("on_exhaust")]
    public List<SfEffect> OnExhaust { get; set; } = [];

    /// <summary>战斗开始此牌进入战斗时（在抽牌堆中也会触发；战斗中生成的副本进入战斗堆时同样触发）。
    /// 引擎自动补 BlockingPlayerChoiceContext，全部内建种类均可用（开局手牌为空，随机弃牌/消耗无牌可选）。</summary>
    [JsonPropertyName("on_enter_combat")]
    public List<SfEffect> OnEnterCombat { get; set; } = [];

    /// <summary>回合结束时此牌在手中时（配合 Retain 关键词使用）。</summary>
    [JsonPropertyName("on_turn_end_in_hand")]
    public List<SfEffect> OnTurnEndInHand { get; set; } = [];

    // ---- 解析后的游戏枚举（运行时使用）----

    public StsCards.CardType Type => System.Enum.TryParse<StsCards.CardType>(CardType, out var v) ? v : StsCards.CardType.Skill;
    public StsCards.CardRarity RarityEnum => System.Enum.TryParse<StsCards.CardRarity>(Rarity, out var v) ? v : StsCards.CardRarity.Common;
    public StsCards.TargetType TargetEnum => System.Enum.TryParse<StsCards.TargetType>(Target, out var v) ? v : StsCards.TargetType.AnyEnemy;

    /// <summary>keywords 中可解析为 CardKeyword 的部分</summary>
    public List<StsCards.CardKeyword> KeywordEnums =>
        Keywords.Select(k => System.Enum.TryParse<StsCards.CardKeyword>(k, ignoreCase: true, out var v) ? (StsCards.CardKeyword?)v : null)
            .Where(v => v != null).Select(v => v!.Value).ToList();

    /// <summary>本卡是否包含格挡效果（GainsBlock 用）</summary>
    public bool HasBlock => Effects.Any(e => e.Kind == SfEffectKind.Block);

    /// <summary>本卡是否包含伤害效果（HasEnergyCostX / 提示用）</summary>
    public bool HasDamage => Effects.Any(e => e.Kind == SfEffectKind.Damage);

    /// <summary>本卡是否使用自定义效果</summary>
    public bool HasCustom => Effects.Any(e => e.Kind == SfEffectKind.Custom)
        || HookLists.Any(h => h.Any(e => e.Kind == SfEffectKind.Custom));

    private List<List<SfEffect>> HookLists =>
    [
        OnDraw, OnDiscard, OnExhaust, OnEnterCombat, OnTurnEndInHand,
    ];

    /// <summary>调试用完整标识</summary>
    public override string ToString() => $"{Id}({Type})";
}

public sealed class SfUpgrades
{
    [JsonPropertyName("damage")]
    public decimal Damage { get; set; }

    [JsonPropertyName("block")]
    public decimal Block { get; set; }

    [JsonPropertyName("draw")]
    public int Draw { get; set; }

    [JsonPropertyName("energy")]
    public decimal Energy { get; set; }

    [JsonPropertyName("heal")]
    public decimal Heal { get; set; }

    [JsonPropertyName("keywords")]
    public List<string> Keywords { get; set; } = [];
}

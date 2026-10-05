//! 卡牌数据模型 —— schema/card.schema.json 的 Rust 权威定义。
//! TS 侧在 editor/src/lib/types.ts 保持镜像，字段改名需双侧同步。

use serde::{Deserialize, Serialize};

pub const FORMAT_VERSION: u32 = 1;

/// 卡牌类型：字符串与游戏 CardType 枚举名一致
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CardType {
    Attack,
    Skill,
    Power,
    Status,
    Curse,
    Quest,
}

/// 稀有度：与游戏 CardRarity 枚举名一致
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CardRarity {
    Basic,
    Common,
    Uncommon,
    Rare,
    Ancient,
    Event,
    Token,
    Status,
    Curse,
    Quest,
}

/// 目标类型：与游戏 TargetType 枚举名一致
/// （Self 在 Rust 中是关键字，变体命名为 Self_，但序列化仍用游戏名 "Self"）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TargetType {
    None,
    #[serde(rename = "Self")]
    Self_,
    AnyEnemy,
    AllEnemies,
    RandomEnemy,
    AnyPlayer,
    AnyAlly,
    AllAllies,
    TargetedNoCreature,
    Osty,
}

/// 多人限制
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MultiplayerConstraint {
    None,
    MultiplayerOnly,
    SingleplayerOnly,
}

/// 多语言文本（语言代码与游戏目录名一致：eng / zhs / zht / deu / esp / fra / ita / jpn / kor / pol / ptb / rus / tha / tur）
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LocText {
    #[serde(default)]
    pub eng: String,
    #[serde(default)]
    pub zhs: String,
}

/// 官方 SpireForge Runtime 的创意工坊 id（编辑器自带并自动安装的前置 mod）。
/// 卡包必须依赖 Runtime 才能加载，新项目默认写入此依赖；第三方 Runtime 分叉
/// 可在发布面板改写。
pub const OFFICIAL_RUNTIME_WORKSHOP_ID: u64 = 3812654552;

/// 效果定义 —— 与 Runtime 的 SfEffect/SfEffectKind 一一对应；
/// kind 不属于内建五种时由 Runtime 转交 SpireForge.Api.SfEffects 注册表
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EffectDef {
    /// 造成伤害（DamageVar；upgrade 配合 upgrades.damage）
    Damage {
        #[serde(default = "default_amount")]
        amount: f64,
        /// ValueProp 位标志名列表，如 ["Move"] / ["Unpowered"]
        #[serde(default)]
        props: Vec<String>,
        /// 钩子上下文取敌：self / random_enemy / all_enemies（默认 random_enemy）
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target: Option<String>,
        /// 升级增量（升级时对绑定变量 UpgradeValueBy）；缺省/0 = 回落 upgrades.* 旧通道
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 获得格挡（BlockVar）
    Block {
        #[serde(default = "default_amount")]
        amount: f64,
        #[serde(default)]
        props: Vec<String>,
        /// 升级增量；缺省/0 = 回落 upgrades.block 旧通道
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 抽牌（CardsVar）
    Draw {
        #[serde(default = "default_amount_int")]
        amount: i64,
        /// 升级增量；缺省/0 = 回落 upgrades.draw 旧通道
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 获得能量
    Energy {
        #[serde(default = "default_amount")]
        amount: f64,
        /// 升级增量；缺省/0 = 回落 upgrades.energy 旧通道
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 回复生命（HealVar）
    Heal {
        #[serde(default = "default_amount")]
        amount: f64,
        /// 升级增量；缺省/0 = 回落 upgrades.heal 旧通道
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 自定义效果：handler 必须由某个已加载 mod 通过
    /// SpireForge.Api.SfEffects.Register(kind, handler) 注册
    Custom {
        /// 处理器名（注册表键，大小写不敏感）
        handler: String,
        /// 可选数值（透传给处理器，语义由处理器定义）
        #[serde(default, skip_serializing_if = "Option::is_none")]
        amount: Option<f64>,
        /// 钩子上下文取敌（默认 random_enemy）
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target: Option<String>,
        /// 透传参数（处理器自解释）
        #[serde(default, skip_serializing_if = "Option::is_none")]
        params: Option<serde_json::Map<String, serde_json::Value>>,
    },
    /// 随机弃 N 张手牌（需要玩家选择上下文）
    Discard {
        #[serde(default = "default_amount")]
        amount: f64,
        /// 升级增量
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 随机消耗 N 张手牌（需要玩家选择上下文）
    Exhaust {
        #[serde(default = "default_amount")]
        amount: f64,
        /// 升级增量
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 获得金币（负数 = 失去）
    Gold {
        #[serde(default = "default_amount")]
        amount: f64,
        /// 升级增量
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 失去生命（无来源、不可格挡、不受力量修正；需要玩家选择上下文）
    LoseHp {
        #[serde(default = "default_amount")]
        amount: f64,
        /// 升级增量
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 上限增加（正数）
    MaxHp {
        #[serde(default = "default_amount")]
        amount: f64,
        /// 升级增量
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 施加增益/减益：power = 效果名（Vulnerable/Poison/Strength/任意 PowerModel 子类名）；
    /// target: self = 给自己上（Strength/Focus 等增益），缺省 = 打出目标/钩子取敌
    Power {
        #[serde(default = "default_amount")]
        amount: f64,
        #[serde(default)]
        power: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target: Option<String>,
        /// 升级增量
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 生成卡牌：card_entry = 目标卡 Entry（自定义或原版），pile = draw/hand/discard
    Spawn {
        #[serde(default = "default_amount_int")]
        amount: i64,
        #[serde(default)]
        card_entry: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pile: Option<String>,
        /// 升级增量（= 每次升级多生成的张数）
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
    /// 召唤敌人：monster = 怪物类名/Entry（DampCultist），hp = 指定生命（缺省用原生区间）
    Summon {
        #[serde(default = "default_amount_int")]
        amount: i64,
        #[serde(default)]
        monster: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        hp: Option<f64>,
        /// 升级增量（= 每次升级多召唤的只数）
        #[serde(default, skip_serializing_if = "is_zero_f64")]
        upgrade_amount: f64,
    },
}

fn default_amount() -> f64 {
    6.0
}
fn default_amount_int() -> i64 {
    1
}
/// upgrade_amount 省略序列化：0 = 未单独设置（damage/block/draw/energy/heal 回落 upgrades.*）
fn is_zero_f64(v: &f64) -> bool {
    *v == 0.0
}

/// 升级增量
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct UpgradeDef {
    pub damage: f64,
    pub block: f64,
    pub draw: i64,
    pub energy: f64,
    pub heal: f64,
    /// 升级后追加的关键词
    pub keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct CardDef {
    pub format_version: u32,
    /// 用户侧卡牌 id（蛇形），如 my_strike；Entry = SNAKE(pack_id + "_" + id)
    pub id: String,
    pub card_type: CardType,
    pub rarity: CardRarity,
    pub target: TargetType,
    /// 能量费用；-1 = 不可打出（诅咒/状态约定）
    pub cost: i64,
    /// X 费卡
    pub costs_x: bool,
    pub keywords: Vec<String>,
    /// colorless | curse | status | ironclad | silent | regent | necrobinder | defect
    pub pool: String,
    /// 额外卡池：非空时本卡注册进全部列出池（多池卡）；为空时只有 pool
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub pools: Vec<String>,
    pub show_in_library: bool,
    pub multiplayer: MultiplayerConstraint,
    pub max_upgrade_level: i64,
    /// 相对项目根的立绘路径，如 assets/cards/my_strike.png；空 = 无自定义立绘
    #[serde(default)]
    pub portrait: String,
    /// 未裁剪原图路径（assets/cards/<id>_original.*）；「重新裁剪」用；打包进 PCK 时剔除
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub portrait_original: Option<String>,
    pub name: LocText,
    pub description: LocText,
    pub flavor: LocText,
    pub effects: Vec<EffectDef>,
    pub upgrades: UpgradeDef,
    // ---- 生命周期钩子（自作用触发；空列表不序列化，保持卡牌 JSON 简洁）----
    /// 此牌被抽到时
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub on_draw: Vec<EffectDef>,
    /// 此牌被弃置时
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub on_discard: Vec<EffectDef>,
    /// 此牌被消耗时
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub on_exhaust: Vec<EffectDef>,
    /// 战斗开始时（仅支持 block/heal/energy/custom）
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub on_enter_combat: Vec<EffectDef>,
    /// 回合结束此牌在手中时（配合 Retain）
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub on_turn_end_in_hand: Vec<EffectDef>,
    /// 原版卡覆盖：非空时本卡不新建卡牌，而是改写游戏原版 Entry=此值 的卡牌
    /// （费用/类型/稀有度/目标/文案；effects 非空时整体替换其打出行为）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vanilla_id: Option<String>,
    /// 原版数值覆盖：键 = 原版 DynamicVar 名（如 Damage/Block/Vulnerable），值 = 覆盖后的数值
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stats: Option<std::collections::BTreeMap<String, f64>>,
    /// 原版升级增量：键 = 变量名，值 = 升级增量（原版 OnUpgrade 被整体替换）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upgrade_stats: Option<std::collections::BTreeMap<String, f64>>,
}

impl Default for CardDef {
    fn default() -> Self {
        Self {
            format_version: FORMAT_VERSION,
            id: String::new(),
            card_type: CardType::Attack,
            rarity: CardRarity::Common,
            target: TargetType::AnyEnemy,
            cost: 1,
            costs_x: false,
            keywords: vec![],
            pool: "colorless".into(),
            pools: vec![],
            show_in_library: true,
            multiplayer: MultiplayerConstraint::None,
            max_upgrade_level: 1,
            portrait: String::new(),
            portrait_original: None,
            name: LocText::default(),
            description: LocText::default(),
            flavor: LocText::default(),
            effects: vec![],
            upgrades: UpgradeDef::default(),
            on_draw: vec![],
            on_discard: vec![],
            on_exhaust: vec![],
            on_enter_combat: vec![],
            on_turn_end_in_hand: vec![],
            vanilla_id: None,
            stats: None,
            upgrade_stats: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProjectMeta {
    pub format_version: u32,
    /// mod id（工坊/目录名基础），如 Darkpack
    pub pack_id: String,
    pub name: String,
    pub author: String,
    pub description: String,
    /// 卡牌 id 列表（磁盘顺序）
    pub cards: Vec<String>,
    /// 本卡包自己的工坊 id（首次上传后由 mod_id.txt 回写；生成工作区时恢复）
    pub workshop_id: Option<u64>,
    /// 上次安装/发布使用的版本号（发布面板默认值，避免更新时忘改版本）
    pub last_version: Option<String>,
    /// SpireForge Runtime 的工坊 id：写入 workshop.json 的 dependencies，
    /// 玩家订阅卡包时 Steam 自动带上 Runtime 前置
    pub runtime_workshop_id: Option<u64>,
    /// 项目使用的第三方角色卡池声明；旧项目缺字段时兼容为空。
    #[serde(default)]
    pub custom_pools: Vec<crate::custom_pools::CustomPoolDef>,
}

impl Default for ProjectMeta {
    fn default() -> Self {
        Self {
            format_version: FORMAT_VERSION,
            pack_id: String::new(),
            name: String::new(),
            author: String::new(),
            description: String::new(),
            cards: vec![],
            workshop_id: None,
            last_version: None,
            runtime_workshop_id: None,
            custom_pools: vec![],
        }
    }
}

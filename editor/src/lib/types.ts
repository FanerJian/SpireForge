// 卡包数据 schema（与 src-tauri/src/model.rs 保持镜像；字段改动需双侧同步）。
// 领域逻辑分属各自模块：Entry 派生 → entry.ts，效果常量/默认值 → effects.ts，
// 描述合成 → description.ts，新建模板 → templates.ts。

export type CardType = 'Attack' | 'Skill' | 'Power' | 'Status' | 'Curse' | 'Quest';
export type CardRarity =
  | 'Basic' | 'Common' | 'Uncommon' | 'Rare' | 'Ancient'
  | 'Event' | 'Token' | 'Status' | 'Curse' | 'Quest';
export type TargetType =
  | 'None' | 'Self' | 'AnyEnemy' | 'AllEnemies' | 'RandomEnemy'
  | 'AnyPlayer' | 'AnyAlly' | 'AllAllies' | 'TargetedNoCreature' | 'Osty';
export type MultiplayerConstraint = 'none' | 'multiplayer_only' | 'singleplayer_only';
export type Pool = string;

export interface CustomPoolDef {
  key: string;
  label: string;
  mod_id: string;
  type_name: string;
  workshop_id?: string | null;
}

export interface LocText {
  eng: string;
  zhs: string;
}

/** 官方 SpireForge Runtime 的创意工坊 id（与 Rust OFFICIAL_RUNTIME_WORKSHOP_ID 一致）。
 *  卡包必须依赖 Runtime 才能加载：新建项目自动写入此依赖，发布面板可改写。 */
export const OFFICIAL_RUNTIME_WORKSHOP_ID = 3812654552;

export type EffectDef =
  | {
      kind: 'damage';
      amount: number;
      props: string[];
      target?: string;
      /** 打击特效（VfxCmd 友好名 / vfx内路径 / res://mod场景；空 = 游戏默认受击表现） */
      vfx?: string;
      /** 打击音效："event:/sfx/…"（FMOD）或音频文件名（blunt_attack.mp3） */
      sfx?: string;
      /** 攻击者侧特效（出手演出，如投掷物） */
      attacker_vfx?: string;
      /** 多段打击：总伤害 = 数值 × 段数 */
      hit_count?: number;
      upgrade_amount?: number;
    }
  | { kind: 'block'; amount: number; props: string[]; upgrade_amount?: number }
  | { kind: 'draw'; amount: number; upgrade_amount?: number }
  | { kind: 'energy'; amount: number; upgrade_amount?: number }
  | { kind: 'heal'; amount: number; upgrade_amount?: number }
  | { kind: 'discard'; amount: number; upgrade_amount?: number }
  | { kind: 'exhaust'; amount: number; upgrade_amount?: number }
  | { kind: 'gold'; amount: number; upgrade_amount?: number }
  | { kind: 'lose_hp'; amount: number; upgrade_amount?: number }
  | { kind: 'max_hp'; amount: number; upgrade_amount?: number }
  | { kind: 'power'; amount: number; power: string; target?: string; upgrade_amount?: number }
  | { kind: 'spawn'; amount: number; card_entry: string; pile?: string; upgrade_amount?: number }
  | { kind: 'summon'; amount: number; monster: string; hp?: number; upgrade_amount?: number }
  | {
      /** 生成充能球（故障机器人）：lightning/frost/dark/plasma/glass，缺省 = 随机 */
      kind: 'orb';
      amount: number;
      orb?: string;
      upgrade_amount?: number;
    }
  | { kind: 'orb_slot'; amount: number; upgrade_amount?: number }
  | {
      kind: 'delayed';
      turns: number;
      timing?: 'turn_start' | 'turn_end';
      /** 触发哪一方：player（缺省，我方回合时机）/ enemy（敌方）/ both（双方） */
      side?: 'player' | 'enemy' | 'both';
      every_turn?: boolean;
      /** 承载力量图标：游戏内力量名（如 Vulnerable）或包内路径 images/powers/*.png */
      icon?: string;
      effects?: EffectDef[];
    }
  | {
      kind: 'vfx';
      vfx: string;
      target?: string;
      /** 同步音效："event:/sfx/…"（FMOD）或音频文件名 */
      sfx?: string;
      /** 播放来源：target（缺省，按 target 定位）/ self（卡牌使用者）/ 怪物类名或 Entry */
      source?: string;
    }
  | { kind: 'custom'; handler: string; amount?: number; target?: string; params?: Record<string, unknown> };

/** 生命周期钩子字段名（与 CardDef 上的可选 EffectDef[] 字段一致） */
export type HookField = 'on_draw' | 'on_discard' | 'on_exhaust' | 'on_enter_combat' | 'on_turn_end_in_hand';

export const HOOK_FIELDS: HookField[] = ['on_draw', 'on_discard', 'on_exhaust', 'on_enter_combat', 'on_turn_end_in_hand'];

export interface UpgradeDef {
  damage: number;
  block: number;
  draw: number;
  energy: number;
  heal: number;
  keywords: string[];
}

export interface CardDef {
  format_version: number;
  id: string;
  card_type: CardType;
  rarity: CardRarity;
  target: TargetType;
  cost: number;
  costs_x: boolean;
  keywords: string[];
  pool: Pool;
  /** 额外卡池：非空时本卡注册进全部列出池（多池卡） */
  pools?: string[];
  show_in_library: boolean;
  multiplayer: MultiplayerConstraint;
  max_upgrade_level: number;
  portrait: string;
  name: LocText;
  description: LocText;
  flavor: LocText;
  effects: EffectDef[];
  upgrades: UpgradeDef;
  /** 生命周期钩子（空 = 不序列化） */
  on_draw?: EffectDef[];
  on_discard?: EffectDef[];
  on_exhaust?: EffectDef[];
  on_enter_combat?: EffectDef[];
  on_turn_end_in_hand?: EffectDef[];
  /** 原版卡覆盖：非空 = 本卡改写游戏原版 Entry=此值 的卡牌（不新建） */
  vanilla_id?: string | null;
  /** 未裁剪原图路径（assets/cards/<id>_original.*）；「重新裁剪」用它重开裁剪框，打包时剔除 */
  portrait_original?: string | null;
  /** 原版数值覆盖：键 = 原版变量名（Damage/Block/Vulnerable…），值 = 覆盖后数值 */
  stats?: Record<string, number> | null;
  /** 原版升级增量：键 = 变量名，值 = 升级增量 */
  upgrade_stats?: Record<string, number> | null;
}

export interface ProjectMeta {
  format_version: number;
  pack_id: string;
  name: string;
  author: string;
  description: string;
  cards: string[];
  /** 本卡包自己的工坊 id（首次上传后由 mod_id.txt 回写） */
  workshop_id: number | null;
  /** 上次安装/发布使用的版本号（发布面板默认值） */
  last_version?: string | null;
  /** SpireForge Runtime 的工坊 id：写入 workshop.json dependencies，订阅时自动带前置 */
  runtime_workshop_id?: number | null;
  /** 第三方角色卡池；旧项目省略时按空列表处理。 */
  custom_pools?: CustomPoolDef[];
}

export interface EditorSettings {
  game_dir: string;
  runtime_version: string | null;
  uploader_path: string | null;
}

/** 原版卡牌目录条目（schema/vanilla-catalog.json，v0.111.0 数据，spire-codex 提取） */
export interface VanillaEntry {
  entry: string;
  name: string;
  name_en: string;
  desc: string;
  desc_en: string;
  cost: number | null;
  x_cost: boolean;
  type: string;
  rarity: string;
  target: string;
  color: string;
  vars: Record<string, number>;
  upgrade: Record<string, string>;
  keywords: string[];
}

export interface VanillaCatalog {
  game_version: string;
  count: number;
  cards: VanillaEntry[];
}

/** 游戏内容目录条目：Runtime 从游戏内导出的力量（含 mod 角色 buff） */
export interface RuntimePower {
  /** SfPowerResolver 解析名（类名去 Power 后缀） */
  name: string;
  entry: string;
  class_name: string;
  /** 游戏当前语言的标题/描述（缺失为空串，显示回落规范名） */
  title: string;
  description: string;
  /** buff / debuff / none */
  type: string;
  /** 来源程序集（mod DLL 名 / 原版程序集） */
  source: string;
}

/** Runtime 导出的怪物条目（name = 类名，召唤效果 params.monster 值） */
export interface RuntimeMonster {
  name: string;
  entry: string;
  title: string;
  hp: string;
  source: string;
}

/** Runtime 导出的卡牌条目（entry 规范值，spawn 效果 card_entry 值） */
export interface RuntimeCard {
  entry: string;
  title: string;
  type: string;
  rarity: string;
  source: string;
}

/** 自定义效果处理器条目（SfEffects 注册表快照：内置 + 各 mod 注册的） */
export interface RuntimeCustomEffect {
  name: string;
  source: string;
  desc_zh: string;
  desc_en: string;
}

/** 视觉特效条目（游戏内置 VfxCmd 与各 Vfx 节点类 + mod 目录下的松散场景） */
export interface RuntimeVfx {
  name: string;
  path: string;
  source: string;
}

/** 游戏内容目录（mods/SpireForgeRuntime/spireforge-catalog.json；读取失败时为 null） */
export interface RuntimeCatalog {
  language: string;
  generated_at_utc: string;
  powers: RuntimePower[];
  monsters: RuntimeMonster[];
  cards: RuntimeCard[];
  /** Runtime < 0.1.7 没有此段（旧目录文件读取后为 undefined） */
  custom_effects?: RuntimeCustomEffect[];
  /** Runtime < 0.1.8 没有此段（旧目录文件读取后为 undefined） */
  vfx?: RuntimeVfx[];
}

export function newCard(id: string): CardDef {
  return {
    format_version: 1,
    id,
    card_type: 'Attack',
    rarity: 'Common',
    target: 'AnyEnemy',
    cost: 1,
    costs_x: false,
    keywords: [],
    pool: 'colorless',
    show_in_library: true,
    multiplayer: 'none',
    max_upgrade_level: 1,
    portrait: '',
    name: { zhs: '', eng: '' },
    description: { zhs: '', eng: '' },
    flavor: { zhs: '', eng: '' },
    effects: [],
    upgrades: { damage: 0, block: 0, draw: 0, energy: 0, heal: 0, keywords: [] },
  };
}

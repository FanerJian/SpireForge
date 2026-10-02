// 与 src-tauri/src/model.rs 保持镜像；字段改动需双侧同步

export type CardType = 'Attack' | 'Skill' | 'Power' | 'Status' | 'Curse' | 'Quest';
export type CardRarity =
  | 'Basic' | 'Common' | 'Uncommon' | 'Rare' | 'Ancient'
  | 'Event' | 'Token' | 'Status' | 'Curse' | 'Quest';
export type TargetType =
  | 'None' | 'Self' | 'AnyEnemy' | 'AllEnemies' | 'RandomEnemy'
  | 'AnyPlayer' | 'AnyAlly' | 'AllAllies' | 'TargetedNoCreature' | 'Osty';
export type MultiplayerConstraint = 'none' | 'multiplayer_only' | 'singleplayer_only';
export type Pool = 'colorless' | 'curse' | 'status' | 'ironclad' | 'silent' | 'regent' | 'necrobinder' | 'defect';

export interface LocText {
  eng: string;
  zhs: string;
}

export type EffectDef =
  | { kind: 'damage'; amount: number; props: string[]; target?: string }
  | { kind: 'block'; amount: number; props: string[] }
  | { kind: 'draw'; amount: number }
  | { kind: 'energy'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'discard'; amount: number }
  | { kind: 'exhaust'; amount: number }
  | { kind: 'gold'; amount: number }
  | { kind: 'lose_hp'; amount: number }
  | { kind: 'max_hp'; amount: number }
  | { kind: 'power'; amount: number; power: string; target?: string }
  | { kind: 'spawn'; amount: number; card_entry: string; pile?: string }
  | { kind: 'custom'; handler: string; amount?: number; target?: string; params?: Record<string, unknown> };

/** 生命周期钩子字段名（与 CardDef 上的可选 EffectDef[] 字段一致） */
export type HookField = 'on_draw' | 'on_discard' | 'on_exhaust' | 'on_enter_combat' | 'on_turn_end_in_hand';

export const HOOK_FIELDS: HookField[] = ['on_draw', 'on_discard', 'on_exhaust', 'on_enter_combat', 'on_turn_end_in_hand'];

export const HOOK_LABEL: Record<HookField, string> = {
  on_draw: '抽到时',
  on_discard: '被弃时',
  on_exhaust: '被消耗时',
  on_enter_combat: '战斗开始时',
  on_turn_end_in_hand: '回合末在手',
};

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
}

export interface EditorSettings {
  game_dir: string;
  runtime_version: string | null;
  uploader_path: string | null;
}

/** 对原版行为有减益效果的力量（默认施加给敌人；其余力量默认给自己） */
const ENEMY_POWERS = ['Vulnerable', 'Weak', 'Frail', 'Poison', 'Doom'];

/** 从原版目录 vars 推导效果清单（「预填原版效果」用）：
 *  Damage/Block/Cards/Energy → 内建效果；XxxPower → 施加增益/减益。
 *  计算型变量（CalculationBase 等）无法静态映射，跳过。 */
export function effectsFromVanillaVars(vars: Record<string, number>): EffectDef[] {
  const out: EffectDef[] = [];
  if (typeof vars.Damage === 'number') out.push({ kind: 'damage', amount: vars.Damage, props: ['Move'] });
  if (typeof vars.Block === 'number') out.push({ kind: 'block', amount: vars.Block, props: ['Move'] });
  if (typeof vars.Cards === 'number') out.push({ kind: 'draw', amount: vars.Cards });
  if (typeof vars.Energy === 'number') out.push({ kind: 'energy', amount: vars.Energy });
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v !== 'number' || !k.endsWith('Power') || k === 'Power') continue;
    const name = k.slice(0, -5); // 去掉 Power 后缀 → SfPowerResolver 可解析名
    out.push({ kind: 'power', amount: v, power: name, target: ENEMY_POWERS.includes(name) ? undefined : 'self' });
  }
  return out;
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
}export const CARD_TYPE_LABEL: Record<CardType, string> = {
  Attack: '攻击', Skill: '技能', Power: '能力', Status: '状态', Curse: '诅咒', Quest: '任务',
};

export const RARITY_LABEL: Record<CardRarity, string> = {
  Basic: '基础', Common: '普通', Uncommon: '罕见', Rare: '稀有', Ancient: '远古',
  Event: '事件', Token: '代币', Status: '状态', Curse: '诅咒', Quest: '任务',
};

export const TARGET_LABEL: Record<TargetType, string> = {
  None: '无', Self: '自身', AnyEnemy: '单一敌人', AllEnemies: '全体敌人', RandomEnemy: '随机敌人',
  AnyPlayer: '任一玩家', AnyAlly: '单一友方', AllAllies: '全体友方',
  TargetedNoCreature: '无目标指向', Osty: '奥丝缇',
};

export const POOL_LABEL: Record<Pool, string> = {
  colorless: '无色', curse: '诅咒池', status: '状态池',
  ironclad: '铁甲战士', silent: '沉默猎手', regent: '摄政王', necrobinder: '缚灵师', defect: '机器人',
};

/** id 派生规则（与游戏 StringHelper.Slugify 一致）。
 *  游戏实现：CamelCase 正则 `([A-Za-z0-9]|\G(?!^))([A-Z])` → "$1_$2"，
 *  再大写、空白→下划线、剔除 [^A-Z0-9_]。
 *  JS 无 \G，用等价收敛循环（反复替换重叠大写对直至稳定）。 */
export function slugify(txt: string): string {
  let s = txt.trim();
  for (;;) {
    const next = s.replace(/([A-Za-z0-9])([A-Z])/g, '$1_$2');
    if (next === s) break;
    s = next;
  }
  const upper = s.toUpperCase();
  const spaced = upper.replace(/\s+/g, '_');
  return spaced.replace(/[^A-Z0-9_]/g, '');
}

export function pascal(s: string): string {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

/** 卡牌完整 Entry：SNAKE(Pascal(packId) + Pascal(cardId)) */
export function cardEntry(packId: string, cardId: string): string {
  return slugify(pascal(packId) + pascal(cardId));
}

/** 兼容旧名 */
export const pascalToSnake = slugify;

/** 语言代码 → 展示名 */
export const LANG_LABEL: Record<string, string> = {
  zhs: '简体中文', eng: 'English',
};

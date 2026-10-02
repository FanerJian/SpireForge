// 与 src-tauri/src/model.rs 保持镜像；字段改动需双侧同步
import type { L } from './i18n';

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
}

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

/** 常用力量中文名（描述生成用；未收录的显示原名） */
export const POWER_ZH: Record<string, string> = {
  Vulnerable: '易伤', Weak: '虚弱', Frail: '脆弱', Poison: '中毒', Doom: '末日',
  Strength: '力量', Dexterity: '敏捷', Focus: '集中', Artifact: '人工制品',
  Intangible: '无形', Thorns: '荆棘', Barricade: '壁垒', Regenerate: '再生',
};

const PILE_ZH: Record<string, string> = { draw: '抽牌堆', hand: '手牌', discard: '弃牌堆' };

/** 按打出效果生成中/英描述（钩子与 custom 走字面文本）；无打出效果时返回 null */
export function composeDescription(card: CardDef): { zhs: string; eng: string } | null {
  const z: string[] = [];
  const e: string[] = [];
  for (const fx of card.effects) {
    switch (fx.kind) {
      case 'damage': z.push('造成 {Damage} 点伤害。'); e.push('Deal {Damage} damage.'); break;
      case 'block': z.push('获得 {Block} 点格挡。'); e.push('Gain {Block} Block.'); break;
      case 'draw': z.push('抽 {Cards} 张牌。'); e.push('Draw {Cards} card(s).'); break;
      case 'energy': z.push('获得 {Energy} 点能量。'); e.push('Gain {Energy} Energy.'); break;
      case 'heal': z.push('回复 {Heal} 点生命。'); e.push('Heal {Heal} HP.'); break;
      case 'gold':
        z.push(fx.amount >= 0 ? `获得 ${fx.amount} 金币。` : `失去 ${-fx.amount} 金币。`);
        e.push(`Gain ${fx.amount} gold.`);
        break;
      case 'discard': z.push(`随机弃置 ${fx.amount} 张手牌。`); e.push(`Discard ${fx.amount} random card(s).`); break;
      case 'exhaust': z.push(`随机消耗 ${fx.amount} 张手牌。`); e.push(`Exhaust ${fx.amount} random card(s).`); break;
      case 'lose_hp': z.push(`失去 ${fx.amount} 点生命。`); e.push(`Lose ${fx.amount} HP.`); break;
      case 'max_hp': z.push(`生命上限 +${fx.amount}。`); e.push(`Gain ${fx.amount} Max HP.`); break;
      case 'power': {
        const zh = POWER_ZH[fx.power] ?? fx.power;
        z.push(`施加 ${fx.amount} 层${zh}。`);
        e.push(`Apply ${fx.amount} ${fx.power}.`);
        break;
      }
      case 'spawn': {
        const pile = PILE_ZH[fx.pile ?? 'draw'] ?? '抽牌堆';
        z.push(`将 ${Math.max(1, fx.amount)} 张「${fx.card_entry || '?'}」置入${pile}。`);
        e.push(`Put ${Math.max(1, fx.amount)} ${fx.card_entry || '?'} into your ${fx.pile ?? 'draw'} pile.`);
        break;
      }
      case 'custom': z.push(`【${fx.handler || '自定义效果'}】`); e.push(`[custom:${fx.handler || '?'}]`); break;
    }
  }
  if (z.length === 0) return null;
  return { zhs: z.join('\n'), eng: e.join('\n') };
}

/** 新建卡牌模板：两三下点击得到一张能进游戏的卡，再改数值即可 */
export interface CardTemplate {
  id: string;
  label: L;
  desc: L;
  make: (id: string, seq: number) => CardDef;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'blank', label: { zh: '空白卡', en: 'Blank card' }, desc: { zh: '全部自己填', en: 'Fill in everything yourself' },
    make: (id) => newCard(id),
  },
  {
    id: 'strike', label: { zh: '打击式攻击', en: 'Strike-style attack' }, desc: { zh: '1 费 · 造成伤害 · 升级 +3', en: '1 cost · damage · upgrade +3' },
    make: (id, seq) => ({
      ...newCard(id),
      name: { zhs: `打击 ${seq}`, eng: `Strike ${seq}` },
      card_type: 'Attack',
      effects: [{ kind: 'damage', amount: 6, props: ['Move'] }],
      upgrades: { damage: 3, block: 0, draw: 0, energy: 0, heal: 0, keywords: [] },
      description: { zhs: '造成 {Damage} 点伤害。', eng: 'Deal {Damage} damage.' },
    }),
  },
  {
    id: 'defend', label: { zh: '防御式技能', en: 'Defend-style skill' }, desc: { zh: '1 费 · 获得格挡 · 升级 +3', en: '1 cost · block · upgrade +3' },
    make: (id, seq) => ({
      ...newCard(id),
      name: { zhs: `防御 ${seq}`, eng: `Defend ${seq}` },
      card_type: 'Skill',
      target: 'Self',
      effects: [{ kind: 'block', amount: 5, props: ['Move'] }],
      upgrades: { damage: 0, block: 3, draw: 0, energy: 0, heal: 0, keywords: [] },
      description: { zhs: '获得 {Block} 点格挡。', eng: 'Gain {Block} Block.' },
    }),
  },
  {
    id: 'draw', label: { zh: '过牌技能', en: 'Draw skill' }, desc: { zh: '0 费 · 抽牌 · 升级多抽 1', en: '0 cost · draw · upgrade draws 1 more' },
    make: (id, seq) => ({
      ...newCard(id),
      name: { zhs: `洞察 ${seq}`, eng: `Insight ${seq}` },
      card_type: 'Skill',
      target: 'None',
      cost: 0,
      effects: [{ kind: 'draw', amount: 1 }],
      upgrades: { damage: 0, block: 0, draw: 1, energy: 0, heal: 0, keywords: [] },
      description: { zhs: '抽 {Cards} 张牌。', eng: 'Draw {Cards} card(s).' },
    }),
  },
  {
    id: 'hybrid', label: { zh: '攻防一体', en: 'Attack + block' }, desc: { zh: '1 费 · 伤害 + 格挡', en: '1 cost · damage + block' },
    make: (id, seq) => ({
      ...newCard(id),
      name: { zhs: `攻防 ${seq}`, eng: `Parry ${seq}` },
      card_type: 'Skill',
      effects: [
        { kind: 'damage', amount: 4, props: ['Move'] },
        { kind: 'block', amount: 4, props: ['Move'] },
      ],
      upgrades: { damage: 2, block: 3, draw: 0, energy: 0, heal: 0, keywords: [] },
      description: { zhs: '造成 {Damage} 点伤害。\n获得 {Block} 点格挡。', eng: 'Deal {Damage} damage.\nGain {Block} Block.' },
    }),
  },
  {
    id: 'power', label: { zh: '增益能力', en: 'Buff power' }, desc: { zh: '1 费 · 战斗内获得增益', en: '1 cost · in-combat buff' },
    make: (id, seq) => ({
      ...newCard(id),
      name: { zhs: `强化 ${seq}`, eng: `Blessing ${seq}` },
      card_type: 'Power',
      target: 'Self',
      effects: [{ kind: 'power', amount: 2, power: 'Strength', target: 'self' }],
      description: { zhs: '获得 2 层力量。', eng: 'Gain 2 Strength.' },
    }),
  },
  {
    id: 'curse', label: { zh: '诅咒牌', en: 'Curse card' }, desc: { zh: '不可打出 · 不进升级', en: 'unplayable · not upgradeable' },
    make: (id, seq) => ({
      ...newCard(id),
      name: { zhs: `诅咒 ${seq}`, eng: `Curse ${seq}` },
      card_type: 'Curse',
      rarity: 'Curse',
      target: 'None',
      cost: -1,
      pool: 'curse',
      keywords: ['Unplayable'],
      max_upgrade_level: 0,
      description: { zhs: '不可打出。', eng: 'Unplayable.' },
    }),
  },
];

export function makeCardFromTemplate(tplId: string, id: string, seq: number): CardDef | null {
  const tpl = CARD_TEMPLATES.find((t) => t.id === tplId);
  return tpl ? tpl.make(id, seq) : null;
}

// 与 src-tauri/src/model.rs 保持镜像；字段改动需双侧同步
import type { L } from './i18n';
import { POWER_DEBUFFS } from './powers';
import { MONSTER_ZH } from './monsters';

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
  | { kind: 'damage'; amount: number; props: string[]; target?: string; upgrade_amount?: number }
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
    out.push({ kind: 'power', amount: v, power: name, target: POWER_DEBUFFS.includes(name) ? undefined : 'self' });
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

/** 游戏内容目录（mods/SpireForgeRuntime/spireforge-catalog.json；读取失败时为 null） */
export interface RuntimeCatalog {
  language: string;
  generated_at_utc: string;
  powers: RuntimePower[];
  monsters: RuntimeMonster[];
  cards: RuntimeCard[];
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

/** 「添加至卡组」登记用的 Entry。覆盖卡（vanilla_id）在 Runtime 是就地修补原版模板，
 *  ModelDb 里只有原版 Entry——按包内派生 Entry 登记会查无此卡，必须用原版 Entry。
 *  规范化与 Rust 端 publish.rs 一致：大写 + 只留字母数字下划线。 */
export function grantEntry(card: { id: string; vanilla_id?: string | null }, packId: string): string {
  const v = card.vanilla_id?.trim();
  if (v) return v.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  return cardEntry(packId, card.id);
}

/** 兼容旧名 */
export const pascalToSnake = slugify;

/** 常用力量中文名 → 完整官方译名表移至 powers.ts（工具脚本生成，265 项全量） */
import { POWER_ZH } from './powers';
export { POWER_ZH };

const PILE_ZH: Record<string, string> = { draw: '抽牌堆', hand: '手牌', discard: '弃牌堆' };

/** 参与升级数值编辑的打出效果种类（custom 的数值语义由处理器定义，不参与） */
export const AMOUNT_KINDS: EffectDef['kind'][] = [
  'damage', 'block', 'draw', 'energy', 'heal', 'discard', 'exhaust',
  'gold', 'lose_hp', 'max_hp', 'power', 'spawn', 'summon',
];

/** 打出效果 → 描述占位符变量基名（与 Runtime SfVarNaming.BaseName 一致；
 *  gold/spawn/summon 的描述带措辞不走占位符，但仍建变量可升级） */
const VAR_BASE: Partial<Record<EffectDef['kind'], string>> = {
  damage: 'Damage', block: 'Block', draw: 'Cards', energy: 'Energy', heal: 'Heal',
  lose_hp: 'LoseHp', max_hp: 'MaxHp', discard: 'Discard', exhaust: 'Exhaust',
};

/** 效果清单第 i 条的变量名：同种类第 n 条加序号后缀（Damage/Damage2…）。
 *  必须与 Runtime SfVarNaming.Name 同规则——占位符才能解析到对应变量。 */
function effectVarName(list: EffectDef[], i: number): string | null {
  const base = VAR_BASE[list[i].kind];
  if (!base) return null;
  let seen = 0;
  for (let j = 0; j <= i; j++) if (list[j].kind === list[i].kind) seen++;
  return seen === 1 ? base : base + seen;
}

/** 单条效果的描述句。varName 非空时数值走 {占位符}（游戏内升级后自动更新），
 *  否则字面值（钩子效果、gold/spawn/summon 等带措辞的句子——改数值需手改描述）。 */
function effectSentence(fx: EffectDef, varName: string | null): { zhs: string; eng: string } {
  const num = (v: string | null, literal: number) => (v ? `{${v}}` : `${literal}`);
  switch (fx.kind) {
    case 'damage': {
      const n = num(varName, fx.amount);
      return { zhs: `造成 ${n} 点伤害。`, eng: `Deal ${n} damage.` };
    }
    case 'block': {
      const n = num(varName, fx.amount);
      return { zhs: `获得 ${n} 点格挡。`, eng: `Gain ${n} Block.` };
    }
    case 'draw': {
      const n = num(varName, fx.amount);
      return { zhs: `抽 ${n} 张牌。`, eng: `Draw ${n} card(s).` };
    }
    case 'energy': {
      const n = num(varName, fx.amount);
      return { zhs: `获得 ${n} 点能量。`, eng: `Gain ${n} Energy.` };
    }
    case 'heal': {
      const n = num(varName, fx.amount);
      return { zhs: `回复 ${n} 点生命。`, eng: `Heal ${n} HP.` };
    }
    case 'discard': {
      const n = num(varName, fx.amount);
      return { zhs: `随机弃置 ${n} 张手牌。`, eng: `Discard ${n} random card(s).` };
    }
    case 'exhaust': {
      const n = num(varName, fx.amount);
      return { zhs: `随机消耗 ${n} 张手牌。`, eng: `Exhaust ${n} random card(s).` };
    }
    case 'lose_hp': {
      const n = num(varName, fx.amount);
      return { zhs: `失去 ${n} 点生命。`, eng: `Lose ${n} HP.` };
    }
    case 'max_hp': {
      const n = num(varName, fx.amount);
      return { zhs: `生命上限 +${n}。`, eng: `Gain ${n} Max HP.` };
    }
    case 'gold': {
      // 带得失措辞，用字面值（变量仍存在，升级后需手改描述）
      const a = fx.amount;
      return a >= 0
        ? { zhs: `获得 ${a} 金币。`, eng: `Gain ${a} gold.` }
        : { zhs: `失去 ${-a} 金币。`, eng: `Lose ${-a} gold.` };
    }
    case 'power': {
      const zh = POWER_ZH[fx.power] ?? fx.power;
      // 目标措辞随 fx.target 分流（官方句式：全体=「给予所有敌人N层X」/Apply N X to ALL enemies，
      // 自身=「获得N层X」/Gain N X，打出指定目标=「给予N层X」）
      if (fx.target === 'all_enemies') {
        return { zhs: `给予所有敌人 ${fx.amount} 层${zh}。`, eng: `Apply ${fx.amount} ${fx.power} to ALL enemies.` };
      }
      if (fx.target === 'self') {
        return { zhs: `获得 ${fx.amount} 层${zh}。`, eng: `Gain ${fx.amount} ${fx.power}.` };
      }
      return { zhs: `给予 ${fx.amount} 层${zh}。`, eng: `Apply ${fx.amount} ${fx.power}.` };
    }
    case 'spawn': {
      const pile = PILE_ZH[fx.pile ?? 'draw'] ?? '抽牌堆';
      return {
        zhs: `将 ${Math.max(1, fx.amount)} 张「${fx.card_entry || '?'}」置入${pile}。`,
        eng: `Put ${Math.max(1, fx.amount)} ${fx.card_entry || '?'} into your ${fx.pile ?? 'draw'} pile.`,
      };
    }
    case 'summon': {
      const zh = MONSTER_ZH[fx.monster] ?? fx.monster;
      const n = Math.max(1, fx.amount);
      const hp = fx.hp && fx.hp > 0 ? (n > 1 ? `（每只 ${fx.hp} 点生命）` : `（${fx.hp} 点生命）`) : '';
      return {
        zhs: n > 1 ? `召唤 ${n} 只「${zh}」${hp}。` : `召唤「${zh}」${hp}。`,
        eng: n > 1
          ? `Summon ${n} ${fx.monster}s${fx.hp && fx.hp > 0 ? ` with ${fx.hp} HP each` : ''}.`
          : `Summon a ${fx.monster}${fx.hp && fx.hp > 0 ? ` with ${fx.hp} HP` : ''}.`,
      };
    }
    case 'custom':
      return { zhs: `【${fx.handler || '自定义效果'}】`, eng: `[custom:${fx.handler || '?'}]` };
  }
}

/** 效果清单 → 多行描述；useVars=true（打出效果）时数值型种类用变量占位符 */
function composeListDescription(list: EffectDef[], useVars: boolean): { zhs: string; eng: string } | null {
  const z: string[] = [];
  const e: string[] = [];
  list.forEach((fx, i) => {
    const s = effectSentence(fx, useVars ? effectVarName(list, i) : null);
    z.push(s.zhs);
    e.push(s.eng);
  });
  if (z.length === 0) return null;
  return { zhs: z.join('\n'), eng: e.join('\n') };
}

/** 按打出效果生成中/英描述（占位符自动对应数值变量）；无打出效果时返回 null */
export function composeDescription(card: CardDef): { zhs: string; eng: string } | null {
  return composeListDescription(card.effects, true);
}

/** 钩子触发的描述前缀（官方风格短语，en 尾带空格） */
const TRIGGER_PREFIX: Record<HookField, { zhs: string; eng: string }> = {
  on_draw: { zhs: '抽到时，', eng: 'When drawn, ' },
  on_discard: { zhs: '被弃置时，', eng: 'When discarded, ' },
  on_exhaust: { zhs: '被消耗时，', eng: 'When exhausted, ' },
  on_enter_combat: { zhs: '战斗开始时，', eng: 'At combat start, ' },
  on_turn_end_in_hand: { zhs: '回合结束时若在手中，', eng: 'At turn end while in hand, ' },
};

/** 钩子效果 → 描述句（字面数值 + 每行带触发时机前缀）；清单为空返回 null。
 *  供钩子页签的「按效果生成描述」追加到卡面文本。 */
export function composeHookDescription(trigger: HookField, list: EffectDef[]): { zhs: string; eng: string } | null {
  if (list.length === 0) return null;
  const body = composeListDescription(list, false);
  if (!body) return null;
  const p = TRIGGER_PREFIX[trigger];
  return {
    zhs: body.zhs.split('\n').map((l) => p.zhs + l).join('\n'),
    eng: body.eng.split('\n').map((l) => p.eng + l).join('\n'),
  };
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

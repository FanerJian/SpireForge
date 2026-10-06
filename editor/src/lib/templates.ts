// 新建卡牌模板：从预设结构创建卡牌，再调整数值即可。
import type { L } from './i18n';
import { newCard, type CardDef } from './types';

export interface CardTemplate {
  id: string;
  label: L;
  desc: L;
  make: (id: string, seq: number) => CardDef;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'blank', label: { zh: '空白卡', en: 'Blank card' }, desc: { zh: '自行填写全部字段', en: 'Fill in every field yourself' },
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

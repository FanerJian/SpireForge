// 效果领域的单一事实源：默认值工厂 + 种类分组常量。
// 新增一种效果时改这里 + i18n EFFECT_META + types.ts EffectDef
//（Rust EffectDef / C# 引擎另需同步，见 docs/SCHEMA）。
import type { EffectDef, UpgradeDef } from './types';
import { POWER_DEBUFFS } from './powers';

/** 需要玩家选择上下文的效果种类（on_enter_combat 钩子不可用） */
export const NEEDS_CHOICE: EffectDef['kind'][] = ['damage', 'draw', 'lose_hp', 'power', 'discard', 'exhaust'];

/** 效果目录分组：常用 / 进阶与扩展（效果页签底部按钮顺序） */
export const CORE_KINDS: EffectDef['kind'][] = ['damage', 'block', 'draw', 'energy', 'heal'];
export const EXTRA_KINDS: EffectDef['kind'][] = [
  'power', 'discard', 'exhaust', 'gold', 'lose_hp', 'max_hp', 'spawn', 'summon', 'delayed', 'custom',
];

/** 延迟效果内嵌清单允许的种类（不带目标指定的核心种类 + 钩子取敌的伤害/失去生命/施加） */
export const DELAYED_INNER_KINDS: EffectDef['kind'][] = [
  'damage', 'block', 'draw', 'energy', 'heal', 'gold', 'lose_hp', 'power',
];

/** 参与升级数值编辑的打出效果种类（custom/delayed 的数值语义由内嵌效果或处理器定义，不参与） */
export const AMOUNT_KINDS: EffectDef['kind'][] = [
  'damage', 'block', 'draw', 'energy', 'heal', 'discard', 'exhaust',
  'gold', 'lose_hp', 'max_hp', 'power', 'spawn', 'summon',
];

/** 参与升级变量的旧五通道（effect.upgrade_amount 未设时回落；见 SfCardBase.OnUpgrade） */
export const LEGACY_UPGRADE: Partial<Record<EffectDef['kind'], keyof Omit<UpgradeDef, 'keywords'>>> = {
  damage: 'damage', block: 'block', draw: 'draw', energy: 'energy', heal: 'heal',
};

/** 新效果默认值（唯一出处——效果页签与延迟内嵌清单共用，新增种类只改这里） */
export function defaultEffect(kind: EffectDef['kind']): EffectDef | null {
  switch (kind) {
    case 'damage': return { kind: 'damage', amount: 6, props: ['Move'] };
    case 'block': return { kind: 'block', amount: 5, props: ['Move'] };
    case 'draw': return { kind: 'draw', amount: 1 };
    case 'energy': return { kind: 'energy', amount: 1 };
    case 'heal': return { kind: 'heal', amount: 3 };
    case 'discard': return { kind: 'discard', amount: 1 };
    case 'exhaust': return { kind: 'exhaust', amount: 1 };
    case 'gold': return { kind: 'gold', amount: 10 };
    case 'lose_hp': return { kind: 'lose_hp', amount: 3 };
    case 'max_hp': return { kind: 'max_hp', amount: 3 };
    case 'power': return { kind: 'power', amount: 2, power: 'Vulnerable' };
    case 'spawn': return { kind: 'spawn', amount: 1, card_entry: '' };
    case 'summon': return { kind: 'summon', amount: 1, monster: 'DampCultist', hp: 13 };
    case 'delayed': return { kind: 'delayed', turns: 2, timing: 'turn_end', effects: [{ kind: 'block', amount: 4, props: ['Move'] }] };
    case 'custom': return { kind: 'custom', handler: '' };
    default: return null;
  }
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

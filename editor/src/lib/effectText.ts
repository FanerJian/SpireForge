// Shared effect sentences for card text and rule summaries. No rule-model dependency.
import type { EffectDef, HookField, TargetType, LocText } from './types';
import { POWER_ZH } from './powers';
import { MONSTER_ZH } from './monsters';
const PILE_ZH: Record<string, string> = { draw: '抽牌堆', hand: '手牌', discard: '弃牌堆' };

/** 充能球官方中英名（zhs orbs.json：黑暗/冰霜/玻璃/闪电/等离子） */
const ORB_ZH: Record<string, string> = {
  lightning: '闪电', frost: '冰霜', dark: '黑暗', plasma: '等离子', glass: '玻璃',
};
const ORB_EN: Record<string, string> = {
  lightning: 'Lightning', frost: 'Frost', dark: 'Dark', plasma: 'Plasma', glass: 'Glass',
};

const VAR_BASE: Partial<Record<EffectDef['kind'], string>> = {
  damage: 'Damage', block: 'Block', draw: 'Cards', energy: 'Energy', heal: 'Heal',
  lose_hp: 'LoseHp', max_hp: 'MaxHp', discard: 'Discard', exhaust: 'Exhaust',
  gold: 'Gold', power: 'Power', spawn: 'Spawn', summon: 'Summon', orb: 'Orbs', orb_slot: 'OrbSlots',
};

/** 效果清单第 i 条的变量名：同种类第 n 条加序号后缀（Damage/Damage2…）。
 *  必须与 Runtime SfVarNaming.Name 同规则——占位符才能解析到对应变量。 */
export function effectVarName(list: EffectDef[], i: number): string | null {
  const base = VAR_BASE[list[i].kind];
  if (!base) return null;
  let seen = 0;
  for (let j = 0; j <= i; j++) if (list[j].kind === list[i].kind) seen++;
  return seen === 1 ? base : base + seen;
}

export type DescriptionContext = { trigger: 'play' | HookField | 'delayed'; target?: TargetType; delayedVars?: boolean; templateVars?: boolean; inheritedTarget?: string; ruleAction?: boolean; custom?: (effect: Extract<EffectDef, { kind: "custom" }>, context: DescriptionContext) => LocText | null };

export function delayedHookPrefix(trigger: HookField): string {
  return 'Delayed' + trigger.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

// 与 Runtime 的目标解析一致：钩子默认随机敌人；打出时先读效果覆盖，再读卡牌目标。
function resolvedTarget(fx: EffectDef, context: DescriptionContext): string {
  const explicit = 'target' in fx ? fx.target?.trim().toLowerCase() : undefined;
  if (explicit && explicit !== 'target') return explicit;
  if (context.inheritedTarget) return context.inheritedTarget;
  if (context.trigger !== 'play') return 'random_enemy';
  if (context.target === 'Self') return 'self';
  if (context.target === 'AllEnemies') return 'all_enemies';
  if (context.target === 'RandomEnemy') return 'random_enemy';
  // 无目标伤害保留 Runtime 的历史全体行为；能力效果在无目标时随机取敌。
  if (context.target === 'None' || context.target === 'TargetedNoCreature') {
    return fx.kind === 'damage' ? 'all_enemies' : 'random_enemy';
  }
  return 'selected';
}

export function effectSentence(fx: EffectDef, varName: string | null, xCost: boolean, context: DescriptionContext, path: string): { zhs: string; eng: string } {
  const num = (v: string | null, literal: number) => (v ? `{${v}}` : `${literal}`);
  const xzh = xCost ? 'X次' : '';
  const xen = xCost ? ' X times' : '';
  switch (fx.kind) {
    case 'damage': {
      // 对象 + 段数：官方句式（闪电霹雳「对所有敌人造成N点伤害」/ 双重打击「造成N点伤害两次」/ 串刺「N点伤害X次」）
      const n = num(varName, fx.amount);
      const hits = Math.max(1, Math.trunc(fx.hit_count ?? 1));
      const zhHits = hits === 2 ? '两次'
        : hits === 3 ? '三次'
        : hits === 4 ? '四次'
        : hits === 5 ? '五次'
        : hits === 6 ? '六次'
        : hits === 7 ? '七次'
        : hits === 8 ? '八次'
        : hits === 9 ? '九次'
        : hits === 10 ? '十次'
        : hits > 1 ? `${hits} 次` : xCost ? 'X次' : '';
      const enHits = hits === 2 ? ' twice' : hits > 1 ? ` ${hits} times` : xCost ? ' X times' : '';
      const zhRepeat = xCost && hits > 1 ? '（重复 X 次）' : '';
      const enRepeat = xCost && hits > 1 ? ' (repeat X times)' : '';
      const target = resolvedTarget(fx, context);
      const zhTarget = target === 'all_enemies' ? '对所有敌人' : target === 'random_enemy' ? '对随机敌人' : target === 'self' ? '对自身' : context.ruleAction ? '对当前目标' : '';
      const zhAll = `${zhTarget}造成 ${n} 点伤害`;
      const enAll = target === 'all_enemies' ? ' to ALL enemies' : target === 'random_enemy' ? ' to a random enemy' : target === 'self' ? ' to yourself' : context.ruleAction ? ' to the current target(s)' : '';
      return { zhs: `${zhAll}${zhHits}${zhRepeat}。`, eng: `Deal ${n} damage${enAll}${enHits}${enRepeat}.` };
    }
    case 'block': {
      const n = num(varName, fx.amount);
      return { zhs: `获得 ${n} 点格挡${xzh}。`, eng: `Gain ${n} Block${xen}.` };
    }
    case 'draw': {
      const n = num(varName, fx.amount);
      return { zhs: `抽 ${n} 张牌${xzh}。`, eng: `Draw ${n} card(s)${xen}.` };
    }
    case 'energy': {
      const n = num(varName, fx.amount);
      return { zhs: `获得 ${n} 点能量${xzh}。`, eng: `Gain ${n} Energy${xen}.` };
    }
    case 'heal': {
      const n = num(varName, fx.amount);
      return { zhs: `回复 ${n} 点生命${xzh}。`, eng: `Heal ${n} HP${xen}.` };
    }
    case 'discard': {
      const n = num(varName, fx.amount);
      return { zhs: `随机弃置 ${n} 张手牌${xzh}。`, eng: `Discard ${n} random card(s)${xen}.` };
    }
    case 'exhaust': {
      const n = num(varName, fx.amount);
      return { zhs: `随机消耗 ${n} 张手牌${xzh}。`, eng: `Exhaust ${n} random card(s)${xen}.` };
    }
    case 'lose_hp': {
      const n = num(varName, fx.amount);
      return { zhs: `失去 ${n} 点生命${xzh}。`, eng: `Lose ${n} HP${xen}.` };
    }
    case 'max_hp': {
      const n = num(varName, fx.amount);
      return { zhs: `生命上限 +${n}${xzh}。`, eng: `Gain ${n} Max HP${xen}.` };
    }
    case 'gold': {
      // 获得金币走官方同款占位符（升级自动更新）；失去金币（负数）变量会渲染「-5」，保留字面
      if (fx.amount >= 0) {
        const n = num(varName, fx.amount);
        return { zhs: `获得 ${n} 金币${xzh}。`, eng: `Gain ${n} gold${xen}.` };
      }
      return { zhs: `失去 ${-fx.amount} 金币${xzh}。`, eng: `Lose ${-fx.amount} gold${xen}.` };
    }
    case 'power': {
      const baseName = Object.prototype.hasOwnProperty.call(POWER_ZH, fx.power) ? POWER_ZH[fx.power] : fx.power;
      const zh = context.ruleAction ? `「${baseName}」` : baseName;
      const enPower = context.ruleAction ? `「${fx.power}」` : fx.power;
      const n = num(varName, fx.amount);
      const target = resolvedTarget(fx, context);
      // 目标措辞随 fx.target 分流（官方句式：全体=「给予所有敌人N层X」/Apply N X to ALL enemies，
      // 自身=「获得N层X」/Gain N X，打出指定目标=「给予N层X」）
      if (target === 'all_enemies') {
        return { zhs: `给予所有敌人 ${n} 层${zh}${xzh}。`, eng: `Apply ${n} ${enPower} to ALL enemies${xen}.` };
      }
      if (target === 'self') {
        return { zhs: `获得 ${n} 层${zh}${xzh}。`, eng: `Gain ${n} ${enPower}${xen}.` };
      }
      const zhTarget = target === 'random_enemy' ? '随机敌人' : '';
      const enTarget = target === 'random_enemy' ? ' to a random enemy' : '';
      return { zhs: `给予${zhTarget} ${n} 层${zh}${xzh}。`, eng: `Apply ${n} ${enPower}${enTarget}${xen}.` };
    }
    case 'spawn': {
      const pile = PILE_ZH[fx.pile ?? 'draw'] ?? '抽牌堆';
      const n = num(varName, Math.max(1, fx.amount));
      return {
        zhs: `将 ${n} 张「${fx.card_entry || '?'}」置入${pile}${xzh}。`,
        eng: `Put ${n} ${fx.card_entry || '?'} into your ${fx.pile ?? 'draw'} pile${xen}.`,
      };
    }
    case 'summon': {
      const zh = Object.prototype.hasOwnProperty.call(MONSTER_ZH, fx.monster) ? MONSTER_ZH[fx.monster] : fx.monster;
      // 奥斯提是玩家宠物（Runtime 走 OstyCmd.Summon，Bodyguard 同款）：数量即生命
      if ((fx.monster || '').toLowerCase() === 'osty') {
        if (fx.hp && fx.hp > 0) {
          return { zhs: `召唤奥斯提，具有 ${fx.hp} 点生命${xzh}。`, eng: `Summon Osty with ${fx.hp} HP${xen}.` };
        }
        const o = num(varName, Math.max(1, fx.amount));
        return { zhs: `召唤奥斯提，具有 ${o} 点生命${xzh}。`, eng: `Summon Osty with ${o} HP${xen}.` };
      }
      const n = num(varName, Math.max(1, fx.amount));
      const hp = fx.hp && fx.hp > 0 ? (fx.amount > 1 ? `（每只 ${fx.hp} 点生命）` : `（${fx.hp} 点生命）`) : '';
      return {
        zhs: `召唤 ${n} 只「${zh}」${hp}${xzh}。`,
        eng: `Summon ${n} ${fx.monster}${fx.hp && fx.hp > 0 ? ` with ${fx.hp} HP each` : ''}${xen}.`,
      };
    }
    case 'orb': {
      // 官方句式（冰川：生成2个冰霜充能球；化废为宝：随机生成一个充能球）
      const n = num(varName, Math.max(1, fx.amount));
      const key = (fx.orb ?? 'random').toLowerCase();
      if (ORB_ZH[key]) {
        return {
          zhs: `生成 ${n} 个${ORB_ZH[key]}充能球${xzh}。`,
          eng: `Channel ${n} ${ORB_EN[key]} orb(s)${xen}.`,
        };
      }
      return { zhs: `随机生成 ${n} 个充能球${xzh}。`, eng: `Channel ${n} random orb(s)${xen}.` };
    }
    case 'orb_slot': {
      // 官方句式（扩容：获得2个充能球栏位）；负数移除
      const a = fx.amount;
      if (a >= 0) {
        const n = num(varName, a);
        return { zhs: `获得 ${n} 个充能球栏位${xzh}。`, eng: `Gain ${n} orb slot(s)${xen}.` };
      }
      return { zhs: `失去 ${-a} 个充能球栏位${xzh}。`, eng: `Lose ${-a} orb slot(s)${xen}.` };
    }
    case 'vfx':
      // 纯视觉演出：不入卡面文本（官方卡面也不描述打击特效）
      return { zhs: '', eng: '' };
    case 'custom':
      {
        const text = context.custom?.(fx, { ...context, inheritedTarget: resolvedTarget(fx, context) })
          ?? { zhs: `【${fx.handler || '自定义效果'}】`, eng: `[custom:${fx.handler || '?'}]` };
        return xCost && text.zhs ? { zhs: `重复 X 次：\n${text.zhs}`, eng: `Repeat X times:\n${text.eng}` } : text;
      }
    case 'delayed': {
      const n = context.templateVars || (context.delayedVars && fx.upgrade_turns)
        ? `{${path}Turns}` : String(Math.max(1, Math.round(fx.turns)));
      const timingZh = fx.timing === 'turn_start' ? '开始' : '结束';
      const timingEn = fx.timing === 'turn_start' ? 'start' : 'end';
      const side = fx.side ?? 'player';
      const sideZh = side === 'enemy' ? '敌方' : side === 'both' ? '双方' : '我方';
      const sideEn = side === 'enemy' ? 'enemy turns' : side === 'both' ? "either side's turns" : 'your turns';
      const upcomingEn = side === 'enemy' ? `the next ${n} enemy turns` : side === 'both' ? `the next ${n} turns from either side` : `your next ${n} turns`;
      const zhWhen = fx.every_turn === false
        ? `第 ${n} 次${sideZh}回合${timingZh}时`
        : `接下来 ${n} 次${sideZh}回合${timingZh}时`;
      const enWhen = fx.every_turn === false
        ? `After ${n} matching turn(s), at the ${timingEn} of the final turn (${sideEn})`
        : `At the ${timingEn} of each of ${upcomingEn}`;
      const body = composeListDescription(fx.effects ?? [], false, false,
        { trigger: 'delayed', delayedVars: context.delayedVars, templateVars: context.templateVars, custom: context.custom }, path + 'Effect');
      if (!body) return { zhs: '', eng: '' };
      const zhOrigin = context.trigger === 'play' ? '打出后，' : '';
      const enOrigin = context.trigger === 'play' ? 'After playing this, ' : '';
      const zhRepeat = xCost ? '（重复施加 X 次）' : '';
      const enRepeat = xCost ? ' (schedule X times)' : '';
      return { zhs: `${zhOrigin}${zhWhen}${zhRepeat}：\n${body.zhs}`, eng: `${enOrigin}${enWhen}${enRepeat}:\n${body.eng}` };
    }
    default:
      return { zhs: `【未知效果：${(fx as { kind: string }).kind}】`, eng: `[Unknown effect: ${(fx as { kind: string }).kind}]` };
  }
}

/** 效果清单 → 多行描述；useVars=true（打出效果）时数值型种类用变量占位符，
 *  xCost=true（X 费卡）按官方惯例给数值句带「X次」 */
export function composeListDescription(list: EffectDef[], useVars: boolean, xCost: boolean, context: DescriptionContext, prefix = 'DelayedPlay'): { zhs: string; eng: string } | null {
  const z: string[] = [];
  const e: string[] = [];
  list.forEach((fx, i) => {
    const path = prefix + (i + 1);
    const nestedVar = context.trigger === 'delayed' && 'amount' in fx
      && (context.templateVars || (context.delayedVars && 'upgrade_amount' in fx && fx.upgrade_amount));
    const s = effectSentence(fx, nestedVar ? path + 'Amount' : useVars ? effectVarName(list, i) : null, xCost, context, path);
    if (s.zhs || s.eng) {
      z.push(s.zhs);
      e.push(s.eng);
    }
  });
  if (z.length === 0) return null;
  return { zhs: z.join('\n'), eng: e.join('\n') };
}

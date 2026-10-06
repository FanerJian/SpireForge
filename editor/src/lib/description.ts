// 卡面描述合成引擎：效果清单 → 中/英描述（含升级占位符变量名推导）。
// 占位符命名必须与 Runtime SfVarNaming 同规则，否则游戏内升级后描述不更新。
import type { CardDef, EffectDef, HookField } from './types';
import { LEGACY_UPGRADE } from './effects';
import { POWER_ZH } from './powers';
import { MONSTER_ZH } from './monsters';

const PILE_ZH: Record<string, string> = { draw: '抽牌堆', hand: '手牌', discard: '弃牌堆' };

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

/** 卡面预览的占位符变量表（CardPreview 用）：变量名 → 显示值。
 *  勾选升级预览时显示「N+M」（M = per-effect upgrade_amount，未单独设置时回落旧五通道）。
 *  之前只读 upgrades.* 旧通道——全种类升级改造后 per-effect 增量在预览里不生效（已修）。 */
export function previewEffectVars(card: CardDef, upgraded: boolean): Record<string, string> {
  const vars: Record<string, string> = {};
  card.effects.forEach((e, i) => {
    const name = effectVarName(card.effects, i);
    if (!name) return;
    const own = (e as { upgrade_amount?: number }).upgrade_amount;
    const lk = LEGACY_UPGRADE[e.kind];
    // card.upgrades 缺字段时兜底（外部导入的 JSON 可能不带 upgrades）
    const up = own ?? (lk ? (card.upgrades?.[lk] ?? 0) : 0);
    const shown = String((e as { amount?: number }).amount ?? 0);
    vars[name] = upgraded && up ? `${shown}+${up}` : shown;
  });
  return vars;
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
    case 'vfx':
      // 纯视觉演出：不入卡面文本（官方卡面也不描述打击特效）
      return { zhs: '', eng: '' };
    case 'custom':
      return { zhs: `【${fx.handler || '自定义效果'}】`, eng: `[custom:${fx.handler || '?'}]` };
    case 'delayed': {
      // 内嵌效果走字面数值（变量属于打出效果，延迟执行不借用）；
      // effects 可缺失（删空内嵌后 Rust 端不落该字段，老卡包 JSON 里就是没有）
      const n = Math.max(1, Math.round(fx.turns));
      const timingZh = fx.timing === 'turn_start' ? '开始' : '结束';
      const timingEn = fx.timing === 'turn_start' ? 'start' : 'end';
      const side = fx.side ?? 'player';
      // 我方=历史文案；敌方/双方带出回合归属（once 模式按"轮"计数）
      const zhWhen = side === 'enemy'
        ? (fx.every_turn === false ? `打出后，${n} 回合后的敌方回合${timingZh}时` : `打出后，接下来 ${n} 次敌方回合${timingZh}时`)
        : side === 'both'
          ? (fx.every_turn === false ? `打出后，${n} 回合后的我方与敌方回合${timingZh}时` : `打出后，接下来 ${n} 个回合的每回合我方与敌方${timingZh}时`)
          : (fx.every_turn === false ? `打出后，${n} 回合后的回合${timingZh}时` : `打出后，接下来 ${n} 个回合的每回合${timingZh}时`);
      const enWhen = side === 'enemy'
        ? (fx.every_turn === false ? `After you play this, ${n} round(s) from now, at the ${timingEn} of the enemy turn` : `After you play this, at the ${timingEn} of each of the next ${n} enemy turn(s)`)
        : side === 'both'
          ? (fx.every_turn === false ? `After you play this, ${n} round(s) from now, at the ${timingEn} of both sides' turns` : `After you play this, at the ${timingEn} of each of the next ${n} rounds (both sides)`)
          : (fx.every_turn === false ? `After you play this, ${n} turn(s) from now, at the ${timingEn} of that turn` : `After you play this, at the ${timingEn} of each of the next ${n} turn(s)`);
      const inner = (fx.effects ?? []).map((f) => effectSentence(f, null));
      const zhBody = inner.map((s) => s.zhs).join('\n');
      const enBody = inner.map((s) => s.eng).join('\n');
      if (inner.length) {
        return { zhs: `${zhWhen}：\n${zhBody}`, eng: `${enWhen}:\n${enBody}` };
      }
      return {
        zhs: `${zhWhen}触发延迟效果。`,
        eng: `${enWhen}, trigger the delayed effect.`,
      };
    }
  }
}

/** 效果清单 → 多行描述；useVars=true（打出效果）时数值型种类用变量占位符 */
function composeListDescription(list: EffectDef[], useVars: boolean): { zhs: string; eng: string } | null {
  const z: string[] = [];
  const e: string[] = [];
  list.forEach((fx, i) => {
    const s = effectSentence(fx, useVars ? effectVarName(list, i) : null);
    if (s.zhs || s.eng) {
      z.push(s.zhs);
      e.push(s.eng);
    }
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

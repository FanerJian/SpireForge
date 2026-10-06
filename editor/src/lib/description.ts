// 卡面描述合成引擎：效果清单 → 中/英描述（含升级占位符变量名推导）。
// 占位符命名必须与 Runtime SfVarNaming 同规则，否则游戏内升级后描述不更新。
import type { CardDef, EffectDef, HookField } from './types';
import { LEGACY_UPGRADE } from './effects';
import { POWER_ZH } from './powers';
import { MONSTER_ZH } from './monsters';

const PILE_ZH: Record<string, string> = { draw: '抽牌堆', hand: '手牌', discard: '弃牌堆' };

/** 打出效果 → 描述占位符变量基名（与 Runtime SfVarNaming.BaseName 一致）。
 *  全部数值种类都走占位符——升级后描述（含卡面预览）自动更新。
 *  金币官方同款（贪婪之手：获得{Gold}金币）；失去金币（负数）保留字面，占位符会渲染「-5」。 */
const VAR_BASE: Partial<Record<EffectDef['kind'], string>> = {
  damage: 'Damage', block: 'Block', draw: 'Cards', energy: 'Energy', heal: 'Heal',
  lose_hp: 'LoseHp', max_hp: 'MaxHp', discard: 'Discard', exhaust: 'Exhaust',
  gold: 'Gold', spawn: 'Spawn', summon: 'Summon',
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
 *  否则字面值（钩子效果、失去金币等少数句子）。
 *  xCost=true（X 费卡）按官方惯例给句子带「X次」（串刺/旋风斩/挽歌同款）。 */
function effectSentence(fx: EffectDef, varName: string | null, xCost: boolean): { zhs: string; eng: string } {
  const num = (v: string | null, literal: number) => (v ? `{${v}}` : `${literal}`);
  const xzh = xCost ? 'X次' : '';
  const xen = xCost ? ' X times' : '';
  switch (fx.kind) {
    case 'damage': {
      // 对象 + 段数：官方句式（闪电霹雳「对所有敌人造成N点伤害」/ 双重打击「造成N点伤害两次」/ 串刺「N点伤害X次」）
      const n = num(varName, fx.amount);
      const hits = Math.max(1, Math.round(fx.hit_count ?? 1));
      const zhHits = xCost ? 'X次'
        : hits === 2 ? '两次'
        : hits === 3 ? '三次'
        : hits === 4 ? '四次'
        : hits === 5 ? '五次'
        : hits === 6 ? '六次'
        : hits === 7 ? '七次'
        : hits === 8 ? '八次'
        : hits === 9 ? '九次'
        : hits === 10 ? '十次'
        : hits > 1 ? `${hits} 次` : '';
      const enHits = xCost ? ' X times' : hits === 2 ? ' twice' : hits > 1 ? ` ${hits} times` : '';
      const zhAll = fx.target === 'all_enemies' ? `对所有敌人造成 ${n} 点伤害` : `造成 ${n} 点伤害`;
      const enAll = fx.target === 'all_enemies' ? ' to ALL enemies' : '';
      return { zhs: `${zhAll}${zhHits}。`, eng: `Deal ${n} damage${enAll}${enHits}.` };
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
      const zh = POWER_ZH[fx.power] ?? fx.power;
      // 目标措辞随 fx.target 分流（官方句式：全体=「给予所有敌人N层X」/Apply N X to ALL enemies，
      // 自身=「获得N层X」/Gain N X，打出指定目标=「给予N层X」）
      if (fx.target === 'all_enemies') {
        return { zhs: `给予所有敌人 ${fx.amount} 层${zh}${xzh}。`, eng: `Apply ${fx.amount} ${fx.power} to ALL enemies${xen}.` };
      }
      if (fx.target === 'self') {
        return { zhs: `获得 ${fx.amount} 层${zh}${xzh}。`, eng: `Gain ${fx.amount} ${fx.power}${xen}.` };
      }
      return { zhs: `给予 ${fx.amount} 层${zh}${xzh}。`, eng: `Apply ${fx.amount} ${fx.power}${xen}.` };
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
      const zh = MONSTER_ZH[fx.monster] ?? fx.monster;
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
      const inner = (fx.effects ?? []).map((f) => effectSentence(f, null, false));
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

/** 效果清单 → 多行描述；useVars=true（打出效果）时数值型种类用变量占位符，
 *  xCost=true（X 费卡）按官方惯例给数值句带「X次」 */
function composeListDescription(list: EffectDef[], useVars: boolean, xCost: boolean): { zhs: string; eng: string } | null {
  const z: string[] = [];
  const e: string[] = [];
  list.forEach((fx, i) => {
    const s = effectSentence(fx, useVars ? effectVarName(list, i) : null, xCost);
    if (s.zhs || s.eng) {
      z.push(s.zhs);
      e.push(s.eng);
    }
  });
  if (z.length === 0) return null;
  return { zhs: z.join('\n'), eng: e.join('\n') };
}

/** 按打出效果生成中/英描述（占位符自动对应数值变量）；无打出效果时返回 null。
 *  X 费卡句子带「X次」；原版覆盖卡的数值是字面语义（Runtime 不绑原版同名变量），
 *  描述也用字面数值，避免游戏内 {Damage} 显示原版旧值。 */
export function composeDescription(card: CardDef): { zhs: string; eng: string } | null {
  return composeListDescription(card.effects, !card.vanilla_id, !!card.costs_x);
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
  const body = composeListDescription(list, false, false);
  if (!body) return null;
  const p = TRIGGER_PREFIX[trigger];
  return {
    zhs: body.zhs.split('\n').map((l) => p.zhs + l).join('\n'),
    eng: body.eng.split('\n').map((l) => p.eng + l).join('\n'),
  };
}

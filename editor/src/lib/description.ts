// 卡面描述合成引擎：效果清单 → 中/英描述（含升级占位符变量名推导）。
// 占位符命名必须与 Runtime SfVarNaming 同规则，否则游戏内升级后描述不更新。
import { HOOK_FIELDS, type CardDef, type EffectDef, type HookField, type LocText } from './types';
import { LEGACY_UPGRADE } from './effects';
import { effectVarName, delayedHookPrefix, effectSentence, composeListDescription, type DescriptionContext } from './effectText';
export { effectVarName } from './effectText';
import { bindProgramStatuses, describeRules, ruleProgram, type RuleStatus } from './rules';

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
    vars[name] = upgraded && up ? `${shown}${up > 0 ? '+' : ''}${up}` : shown;
  });
  const addDelayed = (list: EffectDef[], prefix: string, nested = false) => list.forEach((e, i) => {
    const path = prefix + (i + 1);
    if (e.kind === 'delayed') {
      const turns = Math.max(1, e.turns + (upgraded ? e.upgrade_turns ?? 0 : 0));
      vars[path + 'Turns'] = String(turns);
      addDelayed(e.effects ?? [], path + 'Effect', true);
    } else if (nested && 'amount' in e) {
      const delta = upgraded && 'upgrade_amount' in e ? e.upgrade_amount ?? 0 : 0;
      vars[path + 'Amount'] = String((e.amount ?? 0) + delta);
    }
  });
  addDelayed(card.effects, 'DelayedPlay');
  HOOK_FIELDS.forEach(h => addDelayed(card[h] ?? [], delayedHookPrefix(h)));
  return vars;
}

/** 单条效果的描述句。varName 非空时数值走 {占位符}（游戏内升级后自动更新），
 *  否则字面值（钩子效果、失去金币等少数句子）。
 *  xCost=true（X 费卡）按官方惯例给句子带「X次」（串刺/旋风斩/挽歌同款）。 */
function ruleDescription(effect: Extract<EffectDef, { kind: 'custom' }>, context: DescriptionContext): LocText | null {
  if (effect.handler !== 'sf_rules') return null;
  const program = ruleProgram(effect.params);
  return program ? { zhs: describeRules(program.nodes, false, program.statuses, 0, context), eng: describeRules(program.nodes, true, program.statuses, 0, context) } : null;
}

/** 按打出效果生成中/英描述（占位符自动对应数值变量）；无打出效果时返回 null。
 *  X 费卡句子带「X次」；原版覆盖卡的数值是字面语义（Runtime 不绑原版同名变量），
 *  描述也用字面数值，避免游戏内 {Damage} 显示原版旧值。 */
export function composeDescription(card: CardDef): { zhs: string; eng: string } | null {
  return composeListDescription(card.effects, !card.vanilla_id, !!card.costs_x, { trigger: 'play', target: card.target, delayedVars: true, custom: ruleDescription });
}

/** 钩子触发的描述前缀（官方风格短语，en 尾带空格） */
const TRIGGER_PREFIX: Record<HookField, { zhs: string; eng: string }> = {
  on_draw: { zhs: '抽到时，', eng: 'When drawn, ' },
  on_discard: { zhs: '被弃置时，', eng: 'When discarded, ' },
  on_exhaust: { zhs: '被消耗时，', eng: 'When exhausted, ' },
  on_enter_combat: { zhs: '战斗开始时，', eng: 'At combat start, ' },
  on_turn_end_in_hand: { zhs: '回合结束时若在手中，', eng: 'At turn end while in hand, ' },
};

/** 每个时机只加一次前缀；延迟内层不重复外层前缀。 */
export function composeHookDescription(trigger: HookField, list: EffectDef[], delayedVars = false): { zhs: string; eng: string } | null {
  if (list.length === 0) return null;
  const body = composeListDescription(list, false, false, { trigger, delayedVars, custom: ruleDescription }, delayedHookPrefix(trigger));
  if (!body) return null;
  const p = TRIGGER_PREFIX[trigger];
  return {
    zhs: p.zhs + body.zhs,
    eng: p.eng + body.eng.charAt(0).toLowerCase() + body.eng.slice(1),
  };
}

/** 全卡描述统一入口，与当前查看的触发页签无关。 */
export function composeCardDescription(card: CardDef, sharedStatuses: RuleStatus[] = []): { zhs: string; eng: string } | null {
  if (sharedStatuses.length) {
    card = JSON.parse(JSON.stringify(card, (_key, value: unknown) => {
      if (value && typeof value === 'object') {
        const effect = value as Extract<EffectDef, { kind: 'custom' }>;
        if (effect.kind === 'custom' && effect.handler === 'sf_rules') {
          const program = ruleProgram(effect.params);
          if (program) return { ...effect, params: bindProgramStatuses(program, sharedStatuses) };
        }
      }
      return value;
    })) as CardDef;
  }
  const sections = [composeDescription(card), ...HOOK_FIELDS.map((trigger) => composeHookDescription(trigger, card[trigger] ?? [], true))]
    .filter((s): s is { zhs: string; eng: string } => s !== null);
  if (!sections.length) return null;
  return { zhs: sections.map((s) => s.zhs).join('\n'), eng: sections.map((s) => s.eng).join('\n') };
}

/** Buff 使用独立模板：剩余次数由游戏提供，内嵌数值在施加时替换为升级后的实际值。 */
export function composeDelayedBuffText(effect: Extract<EffectDef, { kind: 'delayed' }>): { name: LocText; description: LocText } {
  const text = effectSentence(effect, null, false, { trigger: 'delayed', templateVars: true, custom: ruleDescription }, 'Buff');
  const convert = (s: string) => s.split('{BuffTurns}').join('{Amount}').split('BuffEffect').join('Effect');
  return {
    name: { zhs: '延迟效果', eng: 'Delayed effect' },
    description: { zhs: convert(text.zhs), eng: convert(text.eng) },
  };
}

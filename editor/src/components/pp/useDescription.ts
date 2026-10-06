// 描述生成动作：「按效果生成描述」（打出效果 + 全部触发时机）与钩子版（追加触发时机句子）。
// EffectsTab 与 LocTab 共用。
import { useStore } from '../../lib/store';
import { useT } from '../../lib/i18n';
import { composeDescription, composeHookDescription } from '../../lib/description';
import type { CardDef, EffectDef, HookField } from '../../lib/types';

/** 钩子字段的生成顺序（与卡面描述的阅读顺序一致） */
const HOOK_ORDER: HookField[] = ['on_draw', 'on_discard', 'on_exhaust', 'on_enter_combat', 'on_turn_end_in_hand'];

/** 「按效果生成描述」：composeDescription 的 UI 包装（有内容先确认）。
 *  除打出效果外，还把每个非空钩子的句子（带触发时机前缀）一并生成——
 *  此前只生成打出效果，钩子句子要逐个页签手动追加（已修）。 */
export function useGenDescription() {
  const { updateCard, showToast } = useStore();
  const t = useT();
  return (card: CardDef) => {
    const play = composeDescription(card);
    const hooks = HOOK_ORDER
      .map((trigger) => composeHookDescription(trigger, (card[trigger] as EffectDef[] | undefined) ?? []))
      .filter((s): s is { zhs: string; eng: string } => s !== null);
    const zhs = [play?.zhs, ...hooks.map((h) => h.zhs)].filter(Boolean).join('\n');
    const eng = [play?.eng, ...hooks.map((h) => h.eng)].filter(Boolean).join('\n');
    if (!zhs && !eng) {
      showToast(t('pp.genDescEmpty'));
      return;
    }
    if (card.description.zhs.trim() || card.description.eng.trim()) {
      if (!confirm(t('pp.genDescOverwrite'))) return;
    }
    updateCard({ description: { zhs, eng } });
    showToast(t('pp.genDescDone'));
  };
}

/** 钩子页签的「按效果生成描述」：把当前钩子效果的句子（带触发时机前缀）追加到卡面描述 */
export function useAppendHookDescription() {
  const { updateCard, showToast } = useStore();
  const t = useT();
  return (card: CardDef, trigger: HookField, list: EffectDef[]) => {
    const composed = composeHookDescription(trigger, list);
    if (!composed) {
      showToast(t('pp.genDescHookEmpty'));
      return;
    }
    const cur = card.description;
    updateCard({
      description: {
        zhs: cur.zhs.trim() ? `${cur.zhs.replace(/\s+$/, '')}\n${composed.zhs}` : composed.zhs,
        eng: cur.eng.trim() ? `${cur.eng.replace(/\s+$/, '')}\n${composed.eng}` : composed.eng,
      },
    });
    showToast(t('pp.genDescAppended'));
  };
}

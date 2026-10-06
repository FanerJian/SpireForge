// 描述生成动作：「按效果生成描述」（打出效果）与钩子版（追加触发时机句子）。
// EffectsTab 与 LocTab 共用。
import { useStore } from '../../lib/store';
import { useT } from '../../lib/i18n';
import { composeDescription, composeHookDescription } from '../../lib/description';
import type { CardDef, EffectDef, HookField } from '../../lib/types';

/** 「按效果生成描述」：composeDescription 的 UI 包装（有内容先确认） */
export function useGenDescription() {
  const { updateCard, showToast } = useStore();
  const t = useT();
  return (card: CardDef) => {
    const composed = composeDescription(card);
    if (!composed) {
      showToast(t('pp.genDescEmpty'));
      return;
    }
    if (card.description.zhs.trim() || card.description.eng.trim()) {
      if (!confirm(t('pp.genDescOverwrite'))) return;
    }
    updateCard({ description: composed });
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

// 描述生成动作：全部触发时机统一生成，重复生成相同内容时不新增修改。
// EffectsTab 与 LocTab 共用。
import { useStore } from '../../lib/store';
import { useT } from '../../lib/i18n';
import { composeCardDescription } from '../../lib/description';
import type { CardDef } from '../../lib/types';
import { confirmAction } from '../../lib/confirmation';

/** 全部时机统一生成；相同内容直接返回，替换手写内容前确认。 */
export function useGenDescription() {
  const { updateCard, showToast } = useStore();
  const t = useT();
  return async (card: CardDef) => {
    const description = composeCardDescription(card);
    if (!description) {
      showToast(t('pp.genDescEmpty'));
      return;
    }
    if (card.description.zhs === description.zhs && card.description.eng === description.eng) {
      showToast(t('pp.genDescUnchanged'));
      return;
    }
    if (card.description.zhs.trim() || card.description.eng.trim()) {
      if (!await confirmAction(t('pp.genDescOverwrite'))) return;
    }
    updateCard({ description });
    showToast(t('pp.genDescDone'));
  };
}

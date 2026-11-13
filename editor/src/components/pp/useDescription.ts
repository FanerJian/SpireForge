// 描述生成动作：全部触发时机统一生成，重复生成相同内容时不新增修改。
// EffectsTab 与 LocTab 共用。
import { useStore } from '../../lib/store';
import { useLang, useT } from '../../lib/i18n';
import { composeCardDescription } from '../../lib/description';
import type { CardDef } from '../../lib/types';
import { confirmAction } from '../../lib/confirmation';

/** 全部时机统一生成；相同内容直接返回，替换手写内容前确认。 */
export function useGenDescription() {
  const { showToast } = useStore();
  const t = useT();
  const en = useLang() === 'en';
  const targetChanged = en ? 'Card or pack changed. Generate the description again.' : '卡牌或卡包已变化，请重新生成描述。';
  return async (card: CardDef) => {
    const source = useStore.getState();
    const projectRoot = source.projectRoot;
    const cardId = card.id;
    const statuses = source.meta?.rule_statuses;
    if (!projectRoot || source.selectedId !== cardId || source.cards.find(item => item.id === cardId) !== card) {
      showToast(targetChanged);
      return;
    }
    const description = composeCardDescription(card, statuses ?? []);
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
    // 确认期间可能切卡、重开项目或继续编辑，只将结果应用到原始快照。
    const current = useStore.getState();
    if (current.projectRoot !== projectRoot || current.selectedId !== cardId
      || current.cards.find(item => item.id === cardId) !== card || current.meta?.rule_statuses !== statuses) {
      current.showToast(targetChanged);
      return;
    }
    current.updateCard({ description });
    current.showToast(t('pp.genDescDone'));
  };
}

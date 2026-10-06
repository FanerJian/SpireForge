// 属性面板壳：页签分发（基础/效果/立绘/文案）+ 基础页签（覆盖/身份/卡池/类型/费用/关键词）
// + 复制/删除操作条。各页签实现在 components/pp/ 下。
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import CustomPoolSection from './CustomPoolSection';
import { Field, NumInput, Segmented, inputCls, selectCls } from './ui';
import {
  KEYWORD_CHIPS, POOL_LABEL, RARITY_LABEL,
  TARGET_LABEL, TYPE_LABEL,
  pick, useLang, useT,
} from '../lib/i18n';
import type { CardDef, CardType, Pool, TargetType } from '../lib/types';
import EffectsTab from './pp/EffectsTab';
import LookTab from './pp/LookTab';
import LocTab from './pp/LocTab';
import VanillaSection from './pp/VanillaSection';
import { confirmAction } from '../lib/confirmation';

/** 卡牌 id 编辑：失去焦点/回车才提交改名（走后端事务：meta 原位替换 + 立绘跟随）。
 *  改名会改变游戏内 Entry——已发布/安装过的卡会破坏玩家存档引用，必须确认。 */
function IdField({ card }: { card: CardDef }) {
  const { renameCard, showToast } = useStore();
  const t = useT();
  const [draft, setDraft] = useState(card.id);
  useEffect(() => setDraft(card.id), [card.id]);

  const commit = async () => {
    const v = draft.trim();
    if (v === card.id) return;
    if (!v) {
      setDraft(card.id);
      return;
    }
    const ok = await confirmAction(t('pp.idRenameConfirm', { a: card.id, b: v }));
    if (!ok) {
      setDraft(card.id);
      return;
    }
    try {
      await renameCard(card.id, v);
      showToast(t('pp.renamed'));
    } catch (e) {
      setDraft(card.id);
      showToast(t('pp.renameFailed', { e: String(e) }));
    }
  };

  return (
    <input
      className={inputCls}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^a-z0-9_]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** 基础页签：原版覆盖 / id / 卡池 / 类型 / 稀有度 / 目标 / 费用 / 关键词 / 显示开关 */
function BasicTab({ card }: { card: CardDef }) {
  const { updateCard } = useStore();
  const t = useT();
  const lang = useLang();

  /** 卡池多选切换：pools 存全量，pool 保持主池（首个）——运行时按 pools 注册进全部池 */
  const togglePool = (p: Pool) => {
    const cur = card.pools?.length ? card.pools : [card.pool];
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    if (next.length === 0) return; // 至少保留一个卡池
    updateCard({
      pools: next,
      pool: (next.includes(card.pool) ? card.pool : next[0]) as Pool,
    });
  };

  return (
    <div className="space-y-3">
      <VanillaSection card={card} />

      <Field label={t('pp.idLabel')} field="id">
        <IdField card={card} />
      </Field>

      <div className="block min-w-0" data-field="pools">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-400">{t('pp.poolLabel')}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {(Object.entries(POOL_LABEL)).map(([v, l]) => {
            const cur = card.pools?.length ? card.pools : [card.pool];
            const on = cur.includes(v as Pool);
            return (
              <button
                key={v}
                onClick={() => togglePool(v as Pool)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  on
                    ? 'bg-amber-500/90 text-black'
                    : 'border border-white/10 bg-black/30 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                {pick(l, lang)}
              </button>
            );
          })}
        </div>
        <CustomPoolSection card={card} onToggle={togglePool} />
      </div>

      <Field label={t('pp.typeLabel')}>
        <Segmented
          value={card.card_type}
          options={(Object.keys(TYPE_LABEL) as CardType[]).map((v) => ({ v, label: pick(TYPE_LABEL[v], lang) }))}
          onChange={(v) => {
            const patch: Partial<CardDef> = { card_type: v };
            if (v === 'Curse' || v === 'Status') {
              patch.cost = -1;
              patch.target = 'None';
              patch.pool = v === 'Curse' ? 'curse' : 'status';
              if (!card.keywords.includes('Unplayable')) patch.keywords = [...card.keywords, 'Unplayable'];
            }
            updateCard(patch);
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('pp.rarityLabel')}>
          <select className={selectCls} value={card.rarity}
            onChange={(e) => updateCard({ rarity: e.target.value as CardDef['rarity'] })}>
            {(Object.keys(RARITY_LABEL) as CardDef['rarity'][]).map((v) => (
              <option key={v} value={v}>{pick(RARITY_LABEL[v], lang)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('pp.targetLabel')}>
          <select className={selectCls} value={card.target}
            onChange={(e) => updateCard({ target: e.target.value as TargetType })}>
            {(Object.keys(TARGET_LABEL) as TargetType[]).filter((v) => v !== 'TargetedNoCreature' || card.target === v).map((v) => (
              <option key={v} value={v}>{pick(TARGET_LABEL[v], lang)}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        {t(card.target === 'TargetedNoCreature' ? 'pp.targetLegacyHint' : 'pp.targetHint')}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('pp.costLabel')} field="cost">
          <NumInput
            value={card.cost}
            onCommit={(n) => {
              if (n == null) return;
              // 负费用 = 不可打出：自动补 Unplayable 关键字（原版语义：Burn 是 -1 费+关键字，
              // 只写费用游戏照样能打出——这里保证编辑器语义在游戏内成立）
              const patch: Partial<CardDef> = { cost: n };
              if (n < 0 && !card.keywords.includes('Unplayable')) {
                patch.keywords = [...card.keywords, 'Unplayable'];
              }
              updateCard(patch);
            }}
          />
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-400">
            <input type="checkbox" checked={card.costs_x}
              onChange={(e) => updateCard({ costs_x: e.target.checked })} />
            {t('pp.xCost')}
          </label>
        </div>
      </div>

      <Field label={t('pp.keywordLabel')}>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {KEYWORD_CHIPS.map(({ k, label }) => {
            const on = card.keywords.includes(k);
            return (
              <button
                key={k}
                onClick={() =>
                  updateCard({
                    keywords: on
                      ? card.keywords.filter((x) => x !== k)
                      : [...card.keywords, k],
                  })
                }
                className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] transition ${
                  on
                    ? 'bg-amber-500/90 text-black'
                    : 'border border-white/10 bg-black/30 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                {pick(label, lang)}
              </button>
            );
          })}
        </div>
        <input className={inputCls} value={card.keywords.join(', ')}
          onChange={(e) => updateCard({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </Field>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <label className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-400">
          <input type="checkbox" checked={card.show_in_library}
            onChange={(e) => updateCard({ show_in_library: e.target.checked })} />
          {t('pp.showLib')}
        </label>
      </div>
    </div>
  );
}

export default function PropertyPanel() {
  const { cards, selectedId, removeCard, duplicateCard, dirtyIds, showToast, historyBusy, propertyTab: tab, setPropertyTab: setTab, fieldFocus } = useStore();
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const card = cards.find((c) => c.id === selectedId);
  const dirty = dirtyIds.length > 0;

  useEffect(() => {
    if (!fieldFocus || fieldFocus.cardId !== card?.id) return;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const parts = fieldFocus.field.split('.');
      let element: HTMLElement | null = null;
      while (parts.length && !element) {
        element = panel.querySelector(`[data-field="${CSS.escape(parts.join('.'))}"]`);
        if (!element) parts.pop();
      }
      if (!element) return;
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const field = fieldFocus.field.split('.').pop()!;
      const exact = element.querySelector<HTMLElement>(`[data-effect-field="${CSS.escape(field)}"]`);
      const scope = exact ?? element;
      const control = scope.matches('input,textarea,select,button') ? scope : scope.querySelector<HTMLElement>('input,textarea,select,button');
      control?.focus({ preventScroll: true });
      element.classList.add('ring-2', 'ring-amber-400/70', 'rounded-md');
      setTimeout(() => element?.classList.remove('ring-2', 'ring-amber-400/70'), 2400);
    });
    return () => cancelAnimationFrame(frame);
  }, [fieldFocus, card?.id, tab]);

  if (!card) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-600">
        {t('pp.pickFromLeft')}
      </div>
    );
  }

  return (
    <fieldset disabled={historyBusy} className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-white/10 px-3 py-2">
        {([['basic', t('pp.tabBasic')], ['effects', t('pp.tabEffects')], ['look', t('pp.tabLook')], ['loc', t('pp.tabLoc')]] as [typeof tab, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
              tab === k ? 'bg-white/10 text-amber-300' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {l}
          </button>
        ))}
        {dirty && (
          <span className="whitespace-nowrap rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-300">
            ● {t('pp.dirtyBadge', { n: dirtyIds.length })}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={async () => {
            try {
              await duplicateCard(card.id);
              showToast(t('pp.copied'));
            } catch (e) { showToast(String(e)); }
          }}
          className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
        >
          {t('pp.copy')}
        </button>
        <button
          onClick={async () => {
            const label = card.name.zhs || card.name.eng || card.id;
            if (!await confirmAction(t('pp.deleteConfirm', { name: label }))) return;
            try { await removeCard(card.id); showToast(t('pp.deleted')); }
            catch (e) { showToast(t('pp.deleteFailed', { e: String(e) })); }
          }}
          className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-rose-400/70 transition hover:bg-rose-500/15 hover:text-rose-300"
        >
          {t('pp.delete')}
        </button>
      </div>

      <div ref={panelRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'basic' && <BasicTab card={card} />}
        {tab === 'effects' && <EffectsTab key={`${card.id}:${fieldFocus?.sequence ?? 0}`} card={card} />}
        {tab === 'look' && <LookTab card={card} />}
        {tab === 'loc' && <LocTab key={`${card.id}:${fieldFocus?.sequence ?? 0}`} card={card} />}
      </div>
    </fieldset>
  );
}

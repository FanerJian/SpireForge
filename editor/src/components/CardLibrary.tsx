import { lazy, memo, Suspense, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { runProjectMutation, useStore } from '../lib/store';
import { api, pickJsonRaw, pickPckFile } from '../lib/tauri';
import type { CardDef, CardType } from '../lib/types';
import { CARD_TEMPLATES } from '../lib/templates';
import { Disclosure, inputCls, selectCls } from './ui';
import { pick, RARITY_LABEL, TYPE_LABEL, useLang, useT } from '../lib/i18n';
const VanillaImportModal = lazy(() => import('./VanillaImportModal'));
const ModContentModal = lazy(() => import('./ModContentModal'));
import { createThumbnailCache, thumbnailKey } from '../lib/thumbnails';

const TYPE_DOT: Record<string, string> = {
  Attack: 'bg-red-500', Skill: 'bg-emerald-500', Power: 'bg-sky-500',
  Status: 'bg-slate-400', Curse: 'bg-purple-500', Quest: 'bg-amber-500',
};

// 立绘缩略图：downscale 到 96px 的 dataURL 模块级缓存（避免高清原图常驻内存）
const thumbCache = createThumbnailCache(async (projectRoot, rel) => {
  const bytes = await api.readPortrait(rel, projectRoot);
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
  const scale = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const url = canvas.toDataURL('image/webp', 0.75);
  return url;
});

function CardThumb({ portrait }: { portrait: string }) {
  const { projectRoot, portraitRevision } = useStore(useShallow(s => ({ projectRoot: s.projectRoot, portraitRevision: s.portraitRevision })));
  const key = thumbnailKey(projectRoot ?? '', portrait, portraitRevision);
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!portrait || !projectRoot) return;
    let cancelled = false;
    thumbCache.load(projectRoot, portrait, portraitRevision).then((url) => {
      if (!cancelled) setImage({ key, url });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [key, portrait, projectRoot, portraitRevision]);
  if (image?.key !== key) return <div className="h-9 w-12 shrink-0 rounded bg-white/5" />;
  return <img src={image.url} alt="" draggable={false} className="h-9 w-12 shrink-0 rounded object-cover" />;
}

const CardTile = memo(function CardTile({ card, active, onSelect }: { card: CardDef; active: boolean; onSelect: (id: string) => void }) {
  const t = useT();
  const lang = useLang();
  return (
    <button
      data-card-id={card.id}
      onClick={() => onSelect(card.id)}
      className={`group flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-all ${
        active
          ? 'border-amber-400/70 bg-amber-400/10 '
          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
      }`}
    >
      {card.portrait ? <CardThumb portrait={card.portrait} /> : <div className="h-9 w-12 shrink-0 rounded bg-white/5" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[card.card_type] ?? 'bg-slate-500'}`} />
          <span className="truncate text-sm font-medium text-slate-200">
            {card.name.zhs || card.name.eng || card.id}
          </span>
          {card.vanilla_id && (
            <span className="shrink-0 rounded bg-sky-500/15 px-1 text-[10px] font-medium text-sky-300">{t('lib.vanillaTag')}</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="truncate">
            {pick(TYPE_LABEL[card.card_type] ?? TYPE_LABEL.Skill, lang)} · {pick(RARITY_LABEL[card.rarity] ?? RARITY_LABEL.Common, lang)}
          </span>
          <span className="shrink-0 whitespace-nowrap font-mono">
            {card.costs_x ? 'X' : card.cost < 0 ? '—' : card.cost}{lang === 'zh' ? '费' : '⚡'}
          </span>
        </div>
      </div>
    </button>
  );
});

const TYPE_FILTERS: (CardType | 'all')[] = ['all', ...Object.keys(TYPE_LABEL) as CardType[]];

export default function CardLibrary() {
  const { cards, selectedId, select, createCard, showToast, fieldFocus } = useStore(useShallow(s => ({
    cards: s.cards, selectedId: s.selectedId, select: s.select, createCard: s.createCard,
    showToast: s.showToast, fieldFocus: s.fieldFocus,
  })));
  const t = useT();
  const lang = useLang();
  const [showVanilla, setShowVanilla] = useState(false);
  const [showModContent, setShowModContent] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CardType | 'all'>('all');
  useEffect(() => {
    if (fieldFocus) { setQuery(''); setTypeFilter('all'); }
  }, [fieldFocus]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (typeFilter !== 'all' && c.card_type !== typeFilter) return false;
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q)
        || (c.name.zhs ?? '').toLowerCase().includes(q)
        || (c.name.eng ?? '').toLowerCase().includes(q)
      );
    });
  }, [cards, query, typeFilter]);

  const doImport = async () => {
    const raw = await pickJsonRaw();
    if (!raw) return;
    try {
      const reports = await runProjectMutation(() => api.importCardsAny(raw));
      if (reports[0]) select(reports[0].card.id);
      const names = reports.map((r) => r.card.name.zhs || r.card.id).join('、');
      const foreign = reports.filter((r) => !r.native);
      let msg = t('lib.imported', { n: reports.length, names });
      if (foreign.length > 0) {
        msg += t('lib.importForeign', { n: foreign.length }) + foreign.flatMap((r) => r.notes).join('\n');
        setTimeout(() => alert(`${t('lib.importNote')}\n\n${foreign.flatMap((r) => r.notes).join('\n')}`), 100);
      }
      showToast(msg);
    } catch (e) {
      alert(t('lib.importFailed', { e: String(e) }));
    }
  };

  const doImportPck = async () => {
    const path = await pickPckFile();
    if (!path) return;
    try {
      const result = await runProjectMutation(() => api.importPackPck(path));
      if (result.imported[0]) select(result.imported[0].card.id);
      let msg = t('lib.pckImported', { n: result.imported.length });
      if (result.errors.length > 0) {
        msg += t('lib.pckErrors', { n: result.errors.length });
        setTimeout(() => alert(`${t('lib.pckErrorTitle')}\n\n${result.errors.join('\n')}`), 100);
      }
      showToast(msg);
    } catch (e) {
      alert(t('lib.importFailed', { e: String(e) }));
    }
  };

  const newFromTpl = (tplId: string) => {
    setShowTpl(false);
    void createCard(tplId === 'blank' ? undefined : tplId).catch((e) => showToast(String(e)));
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="space-y-3 border-b border-white/10 p-3">
        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{t('lib.title')}</span><span className="sf-muted">{t('lib.count', { n: cards.length })}</span></div>
        <button onClick={() => setShowTpl(v => !v)} className="sf-button sf-button-primary w-full">{t('lib.newCard')}</button>
        <input aria-label={t('lib.search')} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('lib.search')} className={inputCls} />
        <select aria-label={lang === 'en' ? 'Card type filter' : '筛选卡牌类型'} className={selectCls} value={typeFilter} onChange={e => setTypeFilter(e.target.value as CardType | 'all')}>{TYPE_FILTERS.map(tp => <option key={tp} value={tp}>{tp === 'all' ? lang === 'en' ? 'All types' : '全部类型' : pick(TYPE_LABEL[tp], lang)}</option>)}</select>
        <Disclosure title={lang === 'en' ? 'Import and sources' : '导入与素材'} storageKey="library.import">
          <button onClick={() => setShowVanilla(true)} className="sf-button w-full">{lang === 'en' ? 'Bundled card catalog' : '内置原版目录'}</button>
          <button onClick={doImportPck} className="sf-button w-full">{lang === 'en' ? 'Import card pack' : '导入卡包'}</button>
          <button onClick={doImport} className="sf-button w-full">{lang === 'en' ? 'Import card JSON' : '导入卡牌 JSON'}</button>
          <button onClick={() => setShowModContent(true)} className="sf-button w-full">{lang === 'en' ? 'Current game content' : '当前游戏内容'}</button>
        </Disclosure>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {cards.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-white/10 p-4 text-center">
            <div className="mb-3 text-xs text-slate-500">
              {t('lib.emptyLine1')}
              <br />
              {t('lib.emptyLine2')}
            </div>
            <div className="space-y-1.5">
              {CARD_TEMPLATES.filter((tpl) => tpl.id !== 'blank').map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => newFromTpl(tpl.id)}
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:border-amber-400/50"
                >
                  <div className="text-xs font-semibold text-slate-200">{pick(tpl.label, lang)}</div>
                  <div className="text-[10px] text-slate-500">{pick(tpl.desc, lang)}</div>
                </button>
              ))}
              <button
                onClick={() => setShowVanilla(true)}
                className="block w-full rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-left transition hover:bg-sky-500/20"
              >
                <div className="text-xs font-semibold text-sky-200">{t('lib.vanillaCta')}</div>
                <div className="text-[10px] text-slate-500">{t('lib.vanillaCtaSub')}</div>
              </button>
            </div>
          </div>
        )}
        {cards.length > 0 && filtered.length === 0 && (
          <div className="mt-8 text-center text-xs text-slate-600">{t('lib.noMatch')}</div>
        )}
        {filtered.map((c) => (
          <CardTile key={c.id} card={c} active={c.id === selectedId} onSelect={select} />
        ))}
      </div>

      {showTpl && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowTpl(false)} />
          <div className="absolute left-3 top-[96px] z-40 w-64 rounded-xl border border-white/10 bg-[var(--lk-color-surface)] p-1.5 shadow-2xl">
            <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              {t('lib.tplTitle')}
            </div>
            {CARD_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => newFromTpl(tpl.id)}
                className="block w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.06]"
              >
                <div className="text-xs font-semibold text-slate-200">{pick(tpl.label, lang)}</div>
                <div className="text-[10px] text-slate-500">{pick(tpl.desc, lang)}</div>
              </button>
            ))}
          </div>
        </>
      )}
      <Suspense fallback={null}>
        {showVanilla && <VanillaImportModal onClose={() => setShowVanilla(false)} />}
        {showModContent && <ModContentModal onClose={() => setShowModContent(false)} />}
      </Suspense>
    </div>
  );
}

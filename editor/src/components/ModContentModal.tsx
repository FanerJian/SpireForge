import { useMemo, useState } from 'react';
import { api } from '../lib/tauri';
import { useStore } from '../lib/store';
import { refreshRuntimeCatalog, useRuntimeCatalogState } from '../lib/runtimeCatalog';
import { cardFromRuntime } from '../lib/modContent';
import { pick, RARITY_LABEL, TYPE_LABEL, useLang } from '../lib/i18n';
import type { ContentIdentity, EffectDef, RuntimeCard } from '../lib/types';

type Item = ContentIdentity & { kind: string; name: string; title: string; entry?: string; source: string; description?: string; card?: RuntimeCard; powerType?: string; hp?: string };
export default function ModContentModal({ onClose }: { onClose: () => void }) {
  const { catalog, error, loading } = useRuntimeCatalogState();
  const lang = useLang();
  const text = (zh: string, en: string) => lang === 'en' ? en : zh;
  const store = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('cards');
  const [mod, setMod] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'override' | 'copy'>('override');
  const items = useMemo<Item[]>(() => !catalog ? [] : [
    ...catalog.cards.map(c => ({ ...c, kind: 'cards', name: c.entry, title: c.title, card: c })),
    ...catalog.powers.map(p => ({ ...p, kind: 'powers', powerType: p.type })),
    ...catalog.monsters.map(m => ({ ...m, kind: 'monsters' })),
    ...(catalog.custom_effects ?? []).map(e => ({ ...e, key: e.name, kind: 'effects', title: e.title || e.name, description: e.desc_zh || e.desc_en })),
    ...(catalog.models ?? []).map(m => ({ ...m, kind: 'other' })),
  ], [catalog]);
  const filtered = items.filter(i => i.kind === category && (mod === 'all' ? i.mod_id !== 'sts2' && i.source !== 'sts2' : (i.mod_id || i.source) === mod)
    && [i.title, i.name, i.entry, i.mod_name, i.mod_id, i.source].join(' ').toLowerCase().includes(query.toLowerCase()));
  const chosen = filtered.find(i => (i.key || `${i.source}:${i.name}`) === selected) ?? null;
  const currentCard = store.cards.find(c => c.id === store.selectedId);
  const refresh = async () => {
    setBusy(true); setNotice('');
    try {
      const result = await api.ensureRuntime();
      if (result.action !== 'current') setNotice(text('请关闭并重启游戏，进入主菜单后再次读取。', 'Restart the game and reach the main menu, then read again.'));
      await refreshRuntimeCatalog();
    } catch (e) { setNotice(String(e)); }
    finally { setBusy(false); }
  };
  const importCard = async () => {
    if (!chosen?.card || !catalog || !store.projectRoot) return;
    setBusy(true);
    try {
      await store.persistAll();
      const card = cardFromRuntime(chosen.card, new Set(store.cards.map(c => c.id)), catalog.language, mode);
      if (mode === 'copy' && card.pool.startsWith('mod:') && !store.meta?.custom_pools?.some(p => p.key === card.pool)) {
        const pools = await api.readGamePools();
        const pool = pools.find(p => p.key === card.pool);
        if (!pool) throw new Error(text('无法读取来源卡池。请重启游戏并刷新。', 'Source pool is unavailable. Restart the game and refresh.'));
        await store.updateMeta({ custom_pools: [...(store.meta?.custom_pools ?? []), pool] });
      }
      await api.saveCard(card);
      await store.openProject(store.projectRoot);
      store.select(card.id);
      store.showToast(text('已导入卡牌', 'Card imported'));
      onClose();
    } catch (e) { setNotice(String(e)); } finally { setBusy(false); }
  };
  const addEffect = () => {
    if (!chosen || !currentCard) return;
    const reference = chosen.key || chosen.entry || chosen.name;
    const fx: EffectDef | null = chosen.kind === 'cards' ? { kind: 'spawn', card_entry: reference, amount: 1, pile: 'hand' }
      : chosen.kind === 'powers' ? { kind: 'power', power: reference, amount: 1, target: chosen.powerType === 'debuff' ? 'random_enemy' : 'self' }
      : chosen.kind === 'monsters' ? { kind: 'summon', monster: reference, amount: 1 }
      : chosen.kind === 'effects' ? { kind: 'custom', handler: reference } : null;
    if (!fx) return;
    store.updateCard({ effects: [...currentCard.effects, fx], format_version: 2 });
    store.setPropertyTab('effects');
    onClose();
  };
  const categories = [['cards', text('卡牌', 'Cards')], ['powers', text('状态', 'Powers')], ['monsters', text('怪物', 'Monsters')], ['effects', text('特殊效果', 'Effects')], ['other', text('其他内容', 'Other')]];
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
    <div className="flex h-[min(760px,88vh)] w-[min(1000px,94vw)] flex-col rounded-2xl border border-white/10 bg-[#14141c] p-5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-100">{text('Mod 内容', 'Mod content')}</h2>
        <div className="flex gap-2"><button disabled={busy || loading} onClick={() => void refresh()} className="rounded border border-white/10 px-3 py-1.5 text-xs text-slate-300">{text('刷新', 'Refresh')}</button><button onClick={onClose} className="px-2 text-slate-400">×</button></div></div>
      <p className="mt-1 text-xs text-slate-500">{catalog ? `${text('游戏快照', 'Game snapshot')} · ${catalog.generated_at_utc ? new Date(catalog.generated_at_utc).toLocaleString() : '—'} · Runtime ${catalog.runtime_version || '—'}` : text('启动游戏并进入主菜单后读取内容。', 'Start the game and reach the main menu to read content.')}</p>
      {(error || notice) && <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-200">{notice || error}{catalog && error ? text(' 当前仍显示上一次成功读取的快照。', ' Showing the last successful snapshot.') : ''}</div>}
      {!!catalog?.issues?.length && <div className="mt-2 text-xs text-amber-300">{text('部分内容读取失败', 'Some content could not be read')} ({catalog.issues.length})<details className="mt-1"><summary>{text('查看详情', 'Details')}</summary><pre className="max-h-28 overflow-auto whitespace-pre-wrap">{catalog.issues.join('\n')}</pre></details></div>}
      <div className="my-3 flex flex-wrap gap-2">{categories.map(([id, label]) => <button key={id} onClick={() => { setCategory(id); setSelected(null); }} className={`rounded px-3 py-1.5 text-xs ${id === category ? 'bg-amber-500/20 text-amber-200' : 'bg-white/5 text-slate-400'}`}>{label}</button>)}</div>
      <div className="mb-3 flex gap-2"><input value={query} onChange={e => setQuery(e.target.value)} placeholder={text('搜索名称或来源', 'Search name or source')} className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200" />
        <select value={mod} onChange={e => { setMod(e.target.value); setSelected(null); }} className="max-w-56 rounded border border-white/10 bg-[#14141c] px-2 text-xs text-slate-300"><option value="all">{text('所有 Mod', 'All mods')}</option><option value="sts2">{text('原版', 'Base game')}</option>{catalog?.mods?.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}</select></div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(240px,1fr)_minmax(300px,1fr)] gap-4">
        <div className="overflow-y-auto space-y-1">{filtered.map(i => { const key = i.key || `${i.source}:${i.name}`; return <button key={key} onClick={() => setSelected(key)} className={`w-full rounded border p-2.5 text-left ${selected === key ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/5 bg-white/[0.02]'}`}><div className="text-sm text-slate-200">{i.title || i.name}</div><div className="mt-1 text-[11px] text-slate-500">{i.mod_name || i.mod_id || i.source}</div></button>; })}{!filtered.length && <p className="p-6 text-center text-xs text-slate-500">{loading ? text('正在读取', 'Reading') : text('没有匹配内容', 'No matching content')}</p>}</div>
        <div className="overflow-y-auto rounded-lg border border-white/10 p-4">{chosen ? <><h3 className="text-base text-slate-100">{chosen.title || chosen.name}</h3><p className="mt-1 text-xs text-slate-500">{chosen.mod_name || chosen.mod_id || chosen.source}</p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{chosen.description?.replace(/\[\/?[^\]]+\]/g, '') || (chosen.hp ? `HP ${chosen.hp}` : '')}</p>
          {chosen.card && <><div className="mt-4 text-xs text-slate-400">{chosen.card.costs_x ? 'X' : chosen.card.cost ?? '?'} {text('费', 'energy')} · {TYPE_LABEL[chosen.card.type] ? pick(TYPE_LABEL[chosen.card.type], lang) : chosen.card.type} · {RARITY_LABEL[chosen.card.rarity] ? pick(RARITY_LABEL[chosen.card.rarity], lang) : chosen.card.rarity}</div><details className="mt-2 text-xs text-slate-500"><summary>{text('数值字段', 'Variables')}</summary><div className="mt-2 flex flex-wrap gap-2">{Object.entries(chosen.card.vars ?? {}).map(([k,v]) => <span key={k}>{k} {v}</span>)}</div></details>
            <select value={mode} onChange={e => setMode(e.target.value as 'override' | 'copy')} className="mt-5 w-full rounded border border-white/10 bg-[#14141c] p-2 text-xs text-slate-300"><option value="override">{text('修改原卡 · 保留原行为', 'Override · keep original behavior')}</option><option value="copy">{text('复制基础数据 · 重新配置效果', 'Copy data · configure new effects')}</option></select>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{mode === 'override' ? text('修改保存在当前卡包中，原 Mod 提供原有行为。', 'Changes are stored in this pack; the source mod provides its original behavior.') : text('复制费用、类型和关键词。原始代码行为不会导入，需要重新配置效果与描述。', 'Copies cost, type and keywords. Configure effects and description for the new card.')}</p>
            <button disabled={busy || !chosen.card.capabilities?.includes('override_fields') || !chosen.key} onClick={() => void importCard()} className="mt-3 w-full rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-30">{text('导入卡牌', 'Import card')}</button></>}
          {chosen.kind !== 'other' && <button disabled={!currentCard || busy || (catalog?.format_version === 2 && (!chosen.key || chosen.capabilities?.includes("inspect")))} onClick={addEffect} className="mt-3 w-full rounded border border-white/15 px-3 py-2 text-xs text-slate-200 disabled:opacity-30">{text('用于当前卡牌', 'Use in selected card')}</button>}
          {chosen.kind === 'other' && <p className="mt-4 text-xs text-slate-500">{text('当前支持查看。行为编辑需要对应内容适配。', 'Inspection is supported. Editing behavior requires a content adapter.')}</p>}
          <details className="mt-5 text-[11px] text-slate-500"><summary>{text('标识与来源', 'Identity and source')}</summary><pre className="mt-2 whitespace-pre-wrap break-all">{chosen.entry}\n{chosen.key}\n{chosen.mod_version}</pre></details>
        </> : <p className="text-sm text-slate-500">{text('选择内容查看详情。', 'Select an item to view details.')}</p>}</div>
      </div>
    </div>
  </div>;
}

import { useMemo, useState } from 'react';
import { api, pickPoolCatalogRaw } from '../lib/tauri';
import type { CardDef, CustomPoolDef } from '../lib/types';
import { useStore } from '../lib/store';
import { useLang } from '../lib/i18n';
import { Disclosure } from './ui';

export default function CustomPoolSection({ card, onToggle }: { card: CardDef; onToggle: (key: string) => void }) {
  const { meta, cards, settings, updateMeta, showToast } = useStore();
  const lang = useLang();
  const zh = lang === 'zh';
  const defs = meta?.custom_pools ?? [];
  const selected = card.pools?.length ? card.pools : [card.pool];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<CustomPoolDef[] | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [modId, setModId] = useState('');
  const [typeName, setTypeName] = useState('');
  const [workshopId, setWorkshopId] = useState('');
  const all = useMemo(() => {
    const byKey = new Map(defs.map((p) => [p.key, p]));
    for (const key of selected) if (key.startsWith('mod:') && !byKey.has(key)) {
      byKey.set(key, { key, label: `${key}（${zh ? '尚未配置' : 'unconfigured'}）`, mod_id: '', type_name: '' });
    }
    return [...byKey.values()];
  }, [defs, selected.join('|'), zh]);

  const merge = async (incoming: CustomPoolDef[]) => {
    if (!meta) throw new Error(zh ? '请先打开一个项目。' : 'Open a project first.');
    const next = new Map((meta.custom_pools ?? []).map((p) => [p.key, p]));
    for (const pool of incoming) next.set(pool.key, pool);
    await updateMeta({ custom_pools: [...next.values()] });
  };
  const review = async (raw: string) => {
    const parsed = await api.importCustomPools(raw);
    if (!parsed.length) throw new Error(zh ? '配置中没有可导入的卡池。' : 'The catalog contains no pools.');
    setPreview(parsed); setChecked(parsed.map((p) => p.key)); setNote('');
  };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setNote('');
    try { await fn(); } catch (e) { setNote(String(e).replace(/^Error: /, '')); }
    finally { setBusy(false); }
  };
  const saveSelected = async () => {
    const rows = preview?.filter((p) => checked.includes(p.key)) ?? [];
    if (!rows.length) { setNote(zh ? '请至少勾选一个卡池。' : 'Select at least one pool.'); return; }
    await run(async () => { await merge(rows); setPreview(null); showToast(zh ? `已导入 ${rows.length} 个角色卡池` : `Imported ${rows.length} pools`); });
  };
  const addManual = async () => {
    const cleanMod = modId.trim(); const cleanType = typeName.trim();
    const pool = { key: `mod:${cleanMod}:${cleanType}`, label: label.trim(), mod_id: cleanMod, type_name: cleanType, workshop_id: workshopId.trim() || null };
    await run(async () => { const valid = await api.importCustomPools(JSON.stringify({ format_version: 1, pools: [pool] })); await merge(valid); setLabel(''); setModId(''); setTypeName(''); setWorkshopId(''); setPreview(null); showToast(zh ? '角色卡池已添加' : 'Character pool added'); });
  };

  return <Disclosure title={zh ? '角色卡池' : 'Character pools'} storageKey="basic.custom-pools">
    {all.length > 0 && <div className="flex flex-wrap gap-1">{all.map((p) => <button key={p.key} onClick={() => onToggle(p.key)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium ${selected.includes(p.key) ? 'bg-amber-500/90 text-black' : 'border border-white/10 bg-black/30 text-slate-400 hover:bg-white/10'}`}>
      {p.label}
    </button>)}</div>}
    <div className="flex flex-wrap gap-1">
      <button disabled={busy} onClick={() => run(async () => {
        if (!settings.game_dir) throw new Error(zh ? '请先配置游戏目录。' : 'Select the game folder in Settings first.');
        const runtime = await api.ensureRuntime();
        if (runtime.action === 'locked') { setNote(zh ? 'SpireForgeRuntime 正被游戏占用，请关闭游戏后重试。' : 'SpireForgeRuntime is locked by the game. Close the game and try again.'); return; }
        if (runtime.action === 'installed' || runtime.action === 'updated') { setNote(zh ? 'SpireForgeRuntime 已安装或更新，请重启游戏并进入主菜单后重新读取。' : 'SpireForgeRuntime was installed or updated. Restart the game and reach the main menu, then read again.'); return; }
        await review(JSON.stringify({ format_version: 1, pools: await api.readGamePools() }));
      })} className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-50">{zh ? '从游戏读取' : 'Read from game'}</button>
      <button disabled={busy} onClick={() => run(async () => { const raw = await pickPoolCatalogRaw(); if (raw !== null) await review(raw); })} className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-50">{zh ? '导入配置' : 'Import'}</button>
      <button disabled={busy} onClick={() => setPreview(preview === null ? [] : null)} className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-50">{zh ? '手动添加' : 'Add manually'}</button>
    </div>
    <Disclosure title={zh ? '说明' : 'Help'} storageKey="basic.custom-pools-help"><p className="text-[10px] text-slate-500">{zh ? '仅导入卡池；专属效果需另行适配。' : 'Imports pools only; custom effects need separate support.'}</p></Disclosure>
    {note && <p role="alert" className="whitespace-pre-wrap text-xs text-rose-300">{note}</p>}
    {preview !== null && <div className="space-y-2 rounded border border-white/10 bg-black/20 p-2">
      {preview.length === 0 ? <div className="grid grid-cols-2 gap-1">
        <input aria-label={zh ? '显示名称' : 'Display name'} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={zh ? '显示名称' : 'Display name'} className="rounded bg-black/30 px-2 py-1 text-xs" />
        <input aria-label="Mod ID" value={modId} onChange={(e) => setModId(e.target.value)} placeholder="Mod ID" className="rounded bg-black/30 px-2 py-1 text-xs" />
        <input aria-label={zh ? '完整卡池类名' : 'Full pool class name'} value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder={zh ? '完整卡池类名' : 'Full pool class name'} className="rounded bg-black/30 px-2 py-1 text-xs" />
        <input aria-label={zh ? '工坊 ID（可选）' : 'Workshop ID (optional)'} value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} placeholder={zh ? '工坊 ID（可选）' : 'Workshop ID (optional)'} className="rounded bg-black/30 px-2 py-1 text-xs" />
        <button disabled={busy} onClick={addManual} className="col-span-2 rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-black disabled:opacity-50">{zh ? '验证并添加' : 'Validate and add'}</button>
      </div> : <>
        <div className="max-h-40 space-y-1 overflow-y-auto">{preview.map((p) => <label key={p.key} className="flex items-start gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={checked.includes(p.key)} onChange={(e) => setChecked(e.target.checked ? [...checked, p.key] : checked.filter((x) => x !== p.key))} />
          <span>{p.label} <span className="text-slate-500">— {p.mod_id} · {p.type_name}</span></span>
        </label>)}</div>
        <div className="flex gap-2"><button disabled={busy} onClick={saveSelected} className="rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-black disabled:opacity-50">{zh ? '确认合并所选' : 'Merge selected'}</button><button onClick={() => setPreview(null)} className="rounded border border-white/10 px-2 py-1 text-xs">{zh ? '取消' : 'Cancel'}</button></div>
      </>}
    </div>}
    {defs.length > 0 && <div className="space-y-1">{defs.map((p) => {
      const used = cards.some((c) => c.pool === p.key || c.pools?.includes(p.key));
      return <div key={p.key} className="flex items-center justify-between text-[10px] text-slate-500"><span className="truncate">{p.label} · {p.mod_id}</span><button disabled={used || busy} onClick={() => run(async () => { await updateMeta({ custom_pools: defs.filter((x) => x.key !== p.key) }); })} className="px-1 text-rose-300 disabled:opacity-30">{zh ? '删除' : 'Remove'}</button></div>;
    })}</div>}
  </Disclosure>;
}

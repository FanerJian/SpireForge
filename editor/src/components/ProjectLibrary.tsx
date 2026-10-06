import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, RefreshCw, Search } from 'lucide-react';
import { api, type ProjectLibrary as Library } from '../lib/tauri';
import { useLang, useT } from '../lib/i18n';

export default function ProjectLibrary({ busy, onOpen, onRecover }: {
  busy: boolean;
  onOpen: (path: string) => Promise<void>;
  onRecover: (path: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLibrary(await api.listProjects(localStorage.getItem('spireforge.lastProject')));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library?.projects.filter((p) =>
      !q || [p.name, p.pack_id, p.author, p.path].some((v) => v.toLowerCase().includes(q)),
    ) ?? [];
  }, [library, query]);
  const date = (stamp: number) => new Date(stamp * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  return (
    <section className="flex min-h-[360px] min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl" aria-label={t('projects.title')}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100">{t('projects.title')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{t('projects.subtitle')}</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading || busy || opening !== null}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{t('projects.refresh')}
        </button>
      </div>
      <label className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 focus-within:border-amber-400/60">
        <Search size={16} className="shrink-0 text-slate-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('projects.search')}
          placeholder={t('projects.search')} className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none" />
      </label>
      <div role="status" className="text-xs leading-relaxed">
        {error && <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-rose-200">{t('projects.failed', { e: error })}</p>}
        {library?.warnings.map((warning, i) => <p key={i} className="mt-3 rounded-lg bg-amber-500/10 p-3 text-amber-200">{warning}</p>)}
      </div>
      <div className="mt-4 max-h-[440px] flex-1 space-y-2 overflow-y-auto pr-1" aria-busy={loading}>
        {loading ? <p className="py-12 text-center text-sm text-slate-400">{t('projects.loading')}</p>
          : filtered.length === 0 ? <div className="px-4 py-12 text-center text-sm leading-relaxed text-slate-400">
            {query.trim() ? t('projects.noMatch') : error ? t('projects.retry') : t('projects.empty')}
          </div>
          : filtered.map((p) => (
            <div key={p.path}>
            <button disabled={busy || opening !== null || !!p.error}
              onClick={async () => {
                setOpening(p.path);
                try { await onOpen(p.path); } finally { setOpening(null); }
              }}
              title={p.error ? `${p.path}\n${p.error}` : p.path}
              className="group flex w-full items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-amber-400/40 hover:bg-amber-400/5 focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-default disabled:hover:bg-black/20">
              <FolderOpen size={22} className={`mt-0.5 shrink-0 ${p.error ? 'text-rose-400' : 'text-amber-300/80'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="break-words text-sm font-semibold text-slate-100">{p.name}</span>
                  {p.last_opened_at !== null && <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[10px] text-sky-200">{t('projects.recent')}</span>}
                </div>
                <p className="mt-1 break-words text-xs text-slate-400">
                  {p.error ? t('projects.unavailable') : `${p.pack_id} · ${t('projects.cards', { n: p.card_count })}${p.author ? ` · ${p.author}` : ''}`}
                </p>
                <p className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-slate-500">{p.path}</p>
                {p.error ? <p className="mt-2 break-words text-xs text-rose-300">{p.error}</p>
                  : (p.last_opened_at ?? p.modified_at) !== null && <p className="mt-2 text-[10px] text-slate-500">
                    {t(p.last_opened_at !== null ? 'projects.lastOpened' : 'projects.modified', { date: date((p.last_opened_at ?? p.modified_at)!) })}
                  </p>}
              </div>
              {!p.error && <span className="mt-0.5 shrink-0 text-xs font-medium text-amber-200">{t(opening === p.path ? 'projects.opening' : 'projects.open')}</span>}
            </button>
            {p.error && <button onClick={() => onRecover(p.path)} disabled={busy || opening !== null}
              className="mt-1 rounded-md border border-amber-400/30 px-3 py-1.5 text-xs text-amber-200 disabled:opacity-40">{t('recovery.title')}</button>}
            </div>
          ))}
      </div>
      {library?.root && <p className="mt-4 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-slate-500">
        {t('projects.root')}<span className="mt-1 block break-all font-mono text-[10px]">{library.root}</span>
      </p>}
    </section>
  );
}

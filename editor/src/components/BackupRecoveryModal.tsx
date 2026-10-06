import { useEffect, useState } from 'react';
import { api, type BackupEntry } from '../lib/tauri';
import { useStore } from '../lib/store';
import { useLang, useT } from '../lib/i18n';
import { confirmAction } from '../lib/confirmation';

export default function BackupRecoveryModal({ onClose, projectPath }: { onClose: () => void; projectPath?: string }) {
  const { restoreBackup, showToast, dirtyIds, historyBusy } = useStore();
  const t = useT();
  const lang = useLang();
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    api.listBackups(projectPath).then((rows) => { if (!cancelled) setEntries(rows); })
      .catch((e: unknown) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectPath]);
  const restore = async (entry: BackupEntry) => {
    if (!await confirmAction(t('recovery.confirm', { name: entry.name }))) return;
    setError('');
    try {
      await restoreBackup(entry.key, entry.card_id, projectPath);
      showToast(t('recovery.done'));
      onClose();
    } catch (e) { setError(String(e)); }
  };
  return <div data-editor-modal role="dialog" aria-modal="true" aria-label={t('recovery.title')}
    className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (!historyBusy) onClose(); }}>
    <div className="max-h-[80vh] w-[640px] overflow-y-auto rounded-2xl border border-white/10 bg-[#14141c] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{t('recovery.title')}</h2>
        <button disabled={historyBusy} onClick={onClose} className="rounded px-2 py-1 text-slate-400">✕</button></div>
      <p className="mb-4 text-xs leading-relaxed text-slate-400">{t('recovery.note')}</p>
      {dirtyIds.length > 0 && <p role="alert" className="mb-3 text-xs text-amber-300">{t('recovery.saveFirst')}</p>}
      {loading ? <p className="text-sm text-slate-400">{t('projects.loading')}</p> : entries.length === 0 ? <p className="text-sm text-slate-400">{t('recovery.empty')}</p> :
        <div className="space-y-2">{entries.map((entry) => <div key={entry.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3"><div className="min-w-0">
            <div className="text-sm text-slate-200">{entry.name} <span className="text-xs text-slate-500">· {t(`recovery.${entry.kind}`)}</span></div>
            <div className="mt-1 break-all font-mono text-[11px] text-slate-500">{entry.key}</div>
            {entry.modified_at != null && <div className="mt-1 text-[11px] text-slate-500">{new Date(entry.modified_at * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</div>}
          </div><button onClick={() => void restore(entry)} disabled={historyBusy || !!entry.error || dirtyIds.length > 0}
            className="shrink-0 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-30">{t('recovery.restore')}</button></div>
          {entry.error && <p className="mt-2 whitespace-pre-wrap text-xs text-rose-300">{entry.error}</p>}
        </div>)}</div>}
      {error && <p role="alert" className="mt-3 whitespace-pre-wrap text-xs text-rose-300">{error}</p>}
    </div>
  </div>;
}

// 自动更新弹窗：展示新版本与更新说明 → 应用内下载（进度条）→ SHA256 校验由后端做
// → 原地换 exe + 自动重启（失败则提示手动重开）。跳过版本只对静默检查生效。
import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useT } from '../lib/i18n';
import { api } from '../lib/tauri';
import { dismissUpdate, type DlProgress, type UpdateCheck } from '../lib/update';

type Phase = 'idle' | 'download' | 'apply' | 'done' | 'error';

export default function UpdateModal({ info }: { info: UpdateCheck }) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<DlProgress | null>(null);
  const [error, setError] = useState('');
  const [restarted, setRestarted] = useState(true);
  const busy = phase === 'download' || phase === 'apply';

  useEffect(() => {
    const un = listen<DlProgress>('update-progress', (e) => setProgress(e.payload));
    return () => {
      void un.then((f) => f());
    };
  }, []);

  const doUpdate = async () => {
    setError('');
    setPhase('download');
    setProgress({ received: 0, total: info.size });
    try {
      const path = await api.downloadUpdate(info);
      setPhase('apply');
      const ok = await api.applyUpdate(path);
      setRestarted(ok);
      setPhase('done');
    } catch (e) {
      setError(String(e));
      setPhase('error');
    }
  };

  // 下载中不关弹窗（后端仍在落盘）；done 阶段进程即将退出也无需关闭
  const close = () => {
    if (busy) return;
    dismissUpdate(false);
  };

  const pct = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.received / progress.total) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6">
      <div className="w-[30rem] max-w-full rounded-2xl border border-white/10 bg-[#141a24] p-5 shadow-2xl shadow-black/70">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-amber-300">{t('upd.title')}</h2>
          <span className="font-mono text-xs text-slate-500">
            {info.current} → {info.latest}
          </span>
        </div>
        {info.pub_date && (
          <div className="mt-0.5 text-[11px] text-slate-600">{info.pub_date}</div>
        )}

        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 font-sans text-xs leading-relaxed text-slate-300">
{info.notes_zhs || info.notes_eng || t('upd.noNotes')}
        </pre>

        {phase === 'download' && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sky-400/80 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {t('upd.downloading', { p: pct })} · {mb(progress?.received ?? 0)} / {mb(progress?.total ?? info.size)}
            </div>
          </div>
        )}
        {phase === 'apply' && <div className="mt-3 text-xs text-sky-300">{t('upd.applying')}</div>}
        {phase === 'done' && (
          <div className="mt-3 text-xs text-emerald-300">
            {restarted ? t('upd.doneRestart') : t('upd.doneManual')}
          </div>
        )}
        {phase === 'error' && (
          <div className="mt-3 break-all rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] leading-relaxed text-rose-300">
            {t('upd.failed', { e: error })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => dismissUpdate(true)}
            disabled={busy}
            className="whitespace-nowrap text-[11px] text-slate-500 underline hover:text-slate-300 disabled:opacity-40"
          >
            {t('upd.skip')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void api.openReleasePage();
                close();
              }}
              disabled={busy}
              className="whitespace-nowrap rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-white/25 hover:text-slate-200 disabled:opacity-40"
            >
              {t('upd.releasePage')}
            </button>
            {phase === 'idle' || phase === 'error' ? (
              <button
                onClick={() => void doUpdate()}
                className="whitespace-nowrap rounded-md bg-amber-500/90 px-4 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400"
              >
                {phase === 'error' ? t('upd.retry') : t('upd.btn')}
              </button>
            ) : (
              <button
                onClick={close}
                disabled={busy}
                className="whitespace-nowrap rounded-md border border-white/10 px-4 py-1.5 text-xs text-slate-400 transition hover:text-slate-200 disabled:opacity-40"
              >
                {t('upd.close')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function mb(n: number): string {
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

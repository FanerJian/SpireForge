import { useEffect, useState } from 'react';
import CardLibrary from './components/CardLibrary';
import CardPreview from './components/CardPreview';
import PropertyPanel from './components/PropertyPanel';
import PublishPanel from './components/PublishPanel';
import ProjectSettingsModal from './components/ProjectSettingsModal';
import UpdateModal from './components/UpdateModal';
import Welcome from './components/Welcome';
import { api, pickSaveJsonFile } from './lib/tauri';
import { useStore } from './lib/store';
import { setLang, useLang, useT } from './lib/i18n';
import { grantEntry } from './lib/entry';
import { bytesToDataUrl, extOf } from './lib/img';
import { useAutoUpdateCheck, useUpdateInfo } from './lib/update';

function Toast({ msg }: { msg: string }) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-400/30 bg-[#1a1a24]/95 px-4 py-2 text-sm text-amber-200 shadow-xl">
      {msg}
    </div>
  );
}

function Toolbar({ onPublish, onSettings }: { onPublish: () => void; onSettings: () => void }) {
  const { meta, dirtyIds, persistAll, closeProject, showToast, undoStack, redoStack, undo, redo } = useStore();
  const t = useT();
  const lang = useLang();
  const dirty = dirtyIds.length > 0;
  return (
    <div className="flex h-12 items-center gap-2 border-b border-white/10 bg-black/30 px-4">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-black tracking-wide text-amber-300">SpireForge</span>
        <span className="text-xs text-slate-600">{meta?.name}</span>
      </div>
      <div className="flex-1" />
      <button
        onClick={undo}
        disabled={undoStack.length === 0}
        className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        {t('app.undo')}
      </button>
      <button
        onClick={redo}
        disabled={redoStack.length === 0}
        className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        {t('app.redo')}
      </button>
      <button
        onClick={async () => { await persistAll(); showToast(t('app.saved')); }}
        disabled={!dirty}
        className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition ${
          dirty ? 'bg-white/10 text-amber-300 hover:bg-white/15' : 'bg-white/5 text-slate-600'
        }`}
      >
        {dirty ? t('app.saveDirty', { n: dirtyIds.length }) : t('app.saved')}
      </button>
      <button
        onClick={onPublish}
        className="whitespace-nowrap rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400"
      >
        {t('app.publish')}
      </button>
      <button
        onClick={onSettings}
        className="whitespace-nowrap rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-500 transition hover:border-white/25 hover:text-slate-300"
      >
        {t('app.settings')}
      </button>
      <button
        onClick={() => { void closeProject(); }}
        className="whitespace-nowrap rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-500 transition hover:border-white/25 hover:text-slate-300"
      >
        {t('app.switchProject')}
      </button>
      <button
        onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        className="w-12 whitespace-nowrap rounded-md border border-white/10 px-1 py-1.5 text-center text-xs font-semibold text-sky-300/80 transition hover:border-sky-400/40 hover:text-sky-200"
      >
        {t('app.toEnglish')}
      </button>
    </div>
  );
}

function PreviewPane() {
  const { cards, meta, projectRoot, persistAll, showToast } = useStore();
  const selectedId = useStore((s) => s.selectedId);
  const t = useT();
  const [upgraded, setUpgraded] = useState(false);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const card = cards.find((c) => c.id === selectedId);

  useEffect(() => {
    setUpgraded(false);
    setPortraitUrl(null);
    if (!card || !card.portrait || !projectRoot) return;
    let cancelled = false;
    api
      .readPortrait(card.portrait)
      .then((bytes) => {
        if (cancelled) return;
        setPortraitUrl(bytesToDataUrl(new Uint8Array(bytes), extOf(card.portrait)));
      })
      .catch(() => { if (!cancelled) setPortraitUrl(null); });
    return () => { cancelled = true; };
  }, [card, projectRoot]);

  const doExport = async () => {
    if (!card) return;
    const path = await pickSaveJsonFile(`${card.id}.json`);
    if (!path) return;
    try {
      // 导出走磁盘读取：先落盘未保存修改，否则导出的是旧数据
      await persistAll();
      const raw = await api.exportCardJson(card.id);
      await api.writeFile(path, raw);
      showToast(t('pv.exported'));
    } catch (e) {
      showToast(t('pv.exportFailed', { e: String(e) }));
    }
  };

  const doGrant = async () => {
    if (!card || !meta) return;
    try {
      const r = await api.queueCardGrant([grantEntry(card, meta.pack_id)]);
      showToast(t('pv.grantQueued', { total: r.total, added: r.added }));
    } catch (e) {
      const msg = String(e);
      const ni = msg.indexOf('CARD_NOT_INSTALLED:');
      showToast(
        msg.includes('GAME_NOT_RUNNING') ? t('pv.grantNoGame')
        : ni >= 0 ? t('pv.grantNotInstalled', { v: msg.slice(ni + 'CARD_NOT_INSTALLED:'.length) })
        : t('pv.grantFailed', { e: msg }),
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-5 overflow-auto bg-[radial-gradient(ellipse_at_center,#1a1a26_0%,#0c0c12_70%)] p-6">
      {card && meta ? (
        <>
          <CardPreview card={card} packId={meta.pack_id} portraitUrl={portraitUrl} upgraded={upgraded} />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <label className="flex items-center gap-1.5 whitespace-nowrap">
              <input type="checkbox" checked={upgraded} onChange={(e) => setUpgraded(e.target.checked)} />
              {t('pv.upgraded')}
            </label>
            <button onClick={doGrant}
              className="whitespace-nowrap rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-200 hover:border-emerald-400/60">
              {t('pv.grant')}
            </button>
            <button onClick={doExport} className="whitespace-nowrap rounded border border-white/10 px-2 py-0.5 hover:border-amber-400/50 hover:text-amber-300">
              {t('pv.export')}
            </button>
            <span className="whitespace-nowrap font-mono text-[11px] text-slate-600">
              {t('pv.entry')}: {grantEntry(card, meta.pack_id)}
            </span>
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-600">{t('pv.empty')}</div>
      )}
    </div>
  );
}

export default function App() {
  const { projectRoot, meta, toast, openProject } = useStore();
  const [publishing, setPublishing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const updateInfo = useUpdateInfo();
  useAutoUpdateCheck();

  useEffect(() => {
    const saved = localStorage.getItem('spireforge.lastProject');
    if (saved && !projectRoot) {
      openProject(saved).catch(() => localStorage.removeItem('spireforge.lastProject'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (projectRoot) localStorage.setItem('spireforge.lastProject', projectRoot);
  }, [projectRoot]);

  // 关窗前有未落盘修改时拦截确认（自动保存去抖窗口内的最后一次兜底）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useStore.getState().dirtyIds.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // 撤销/重做快捷键：输入框/文本域内让位给原生文字撤销
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const el = e.target as HTMLElement | null;
      const inText = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      if (inText) return;
      e.preventDefault();
      const s = useStore.getState();
      if (key === 'z' && !e.shiftKey) s.undo();
      else s.redo(); // Ctrl+Y 或 Ctrl+Shift+Z
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!projectRoot || !meta) {
    return (
      <div className="h-screen text-slate-200">
        <Welcome />
        {updateInfo && <UpdateModal info={updateInfo} />}
        {toast && <Toast msg={toast} />}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0c0c12] text-slate-200">
      <Toolbar onPublish={() => setPublishing(true)} onSettings={() => setSettingsOpen(true)} />
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_400px] overflow-hidden">
        <div className="min-h-0 border-r border-white/10 bg-black/20">
          <CardLibrary />
        </div>
        <div className="min-h-0">
          <PreviewPane />
        </div>
        <div className="min-h-0 border-l border-white/10 bg-black/20">
          <PropertyPanel />
        </div>
      </div>
      {publishing && <PublishPanel onClose={() => setPublishing(false)} />}
      {settingsOpen && <ProjectSettingsModal onClose={() => setSettingsOpen(false)} />}
      {updateInfo && <UpdateModal info={updateInfo} />}
      {toast && <Toast msg={toast} />}
    </div>
  );
}

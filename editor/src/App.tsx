import { lazy, Suspense, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Welcome from './components/Welcome';
import ConfirmationDialog from './components/ConfirmationDialog';
import { api, pickSaveJsonFile } from './lib/tauri';
import { useStore } from './lib/store';
import { setLang, useLang, useT } from './lib/i18n';
import { grantEntry } from './lib/entry';
import { usePortrait } from './lib/usePortrait';
import { useAutoUpdateCheck, useUpdateInfo } from './lib/update';
import { Disclosure } from './components/ui';
import { KitButton } from './components/KitButton';

const CardLibrary = lazy(() => import('./components/CardLibrary'));
const CardPreview = lazy(() => import('./components/CardPreview'));
const CardDescription = lazy(() => import('./components/CardPreview').then(module => ({ default: module.CardDescription })));
const PropertyPanel = lazy(() => import('./components/PropertyPanel'));
const PublishPanel = lazy(() => import('./components/PublishPanel'));
const ProjectSettingsModal = lazy(() => import('./components/ProjectSettingsModal'));
const UpdateModal = lazy(() => import('./components/UpdateModal'));
const BackupRecoveryModal = lazy(() => import('./components/BackupRecoveryModal'));

function Toast({ msg }: { msg: string }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-400/30 bg-[var(--lk-color-surface)]/95 px-4 py-2 text-sm text-amber-200 shadow-xl">
      {msg}
    </div>
  );
}

function Toolbar({ onPublish, onSettings, onRecovery }: { onPublish: () => void; onSettings: () => void; onRecovery: () => void }) {
  const { meta, dirtyIds, persistAll, closeProject, showToast, undoStack, redoStack, undo, redo, historyBusy } = useStore(useShallow(s => ({
    meta: s.meta, dirtyIds: s.dirtyIds, persistAll: s.persistAll, closeProject: s.closeProject,
    showToast: s.showToast, undoStack: s.undoStack, redoStack: s.redoStack,
    undo: s.undo, redo: s.redo, historyBusy: s.historyBusy,
  })));
  const t = useT();
  const lang = useLang();
  const dirty = dirtyIds.length > 0;
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  return (
    <div className="sf-toolbar">
      <div className="flex items-baseline gap-2">
        <span className="sf-brand">SpireForge</span>
        <span className="sf-project-name max-w-52 truncate border-l border-white/15 pl-3 text-xs text-slate-400">{meta?.name}</span>
      </div>
      <div className="flex-1" />
      <button
        onClick={() => void undo()}
        disabled={historyBusy || undoStack.length === 0}
        className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        {t('app.undo')}
      </button>
      <button
        onClick={() => void redo()}
        disabled={historyBusy || redoStack.length === 0}
        className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        {t('app.redo')}
      </button>
      <button
        onClick={async () => {
          setSaving(true);
          try { await persistAll(); showToast(t('app.saved')); }
          catch { /* persistAll 保留修改并显示失败提示 */ }
          finally { setSaving(false); }
        }}
        disabled={!dirty || saving || switching}
        className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition ${
          dirty ? 'bg-white/10 text-amber-300 hover:bg-white/15' : 'bg-white/5 text-slate-600'
        }`}
      >
        {dirty ? t('app.saveDirty', { n: dirtyIds.length }) : t('app.saved')}
      </button>
      <KitButton onClick={onPublish} variant="primary">{t('app.publish')}</KitButton>
      <button
        onClick={onSettings}
        className="whitespace-nowrap rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-500 transition hover:border-white/25 hover:text-slate-300"
      >
        {t('app.settings')}
      </button>
      <button onClick={async () => { try { await persistAll(); onRecovery(); } catch { /* 保存失败时留在编辑器 */ } }} disabled={historyBusy}
        className="whitespace-nowrap rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:border-white/25 disabled:opacity-30">
        {t('recovery.title')}
      </button>
      <button
        onClick={async () => {
          setSwitching(true);
          try { await closeProject(); }
          catch { /* 保存失败时留在当前项目 */ }
          finally { setSwitching(false); }
        }}
        disabled={switching || saving || historyBusy}
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
  const { card, meta, projectRoot, portraitRevision, persistAll, showToast } = useStore(useShallow(s => ({
    card: s.cards.find(c => c.id === s.selectedId), meta: s.meta, projectRoot: s.projectRoot,
    portraitRevision: s.portraitRevision, persistAll: s.persistAll, showToast: s.showToast,
  })));
  const t = useT();
  const [upgraded, setUpgraded] = useState(false);
  const portraitUrl = usePortrait(projectRoot, card?.portrait, portraitRevision);

  useEffect(() => {
    setUpgraded(false);
  }, [card?.id, projectRoot]);

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
    <div className="sf-preview-pane">
      {card && meta ? (
        <>
          <div className="flex items-center justify-between"><span className="sf-section-label">{t('pv.title')}</span><label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={upgraded} onChange={e => setUpgraded(e.target.checked)} />{t('pv.upgraded')}</label></div>
          <div className="sf-preview-card"><div data-card-preview><CardPreview card={card} packId={meta.pack_id} portraitUrl={portraitUrl} upgraded={upgraded} /></div></div>
          <div className="sf-preview-description sf-readable"><CardDescription card={card} upgraded={upgraded} /></div>
          <Disclosure title={t('ui.previewTools')} storageKey="preview.actions" className="w-full max-w-[360px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
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
          </Disclosure>
        </>
      ) : (
        <div className="text-sm text-slate-600">{t('pv.empty')}</div>
      )}
    </div>
  );
}

export default function App() {
  const { projectRoot, meta, toast, refreshSettings } = useStore(useShallow(s => ({
    projectRoot: s.projectRoot, meta: s.meta, toast: s.toast, refreshSettings: s.refreshSettings,
  })));
  const [publishing, setPublishing] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const t = useT();
  const updateInfo = useUpdateInfo();
  const lang = useLang();
  useAutoUpdateCheck();

  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }, [lang]);

  useEffect(() => {
    // 启动进入卡包列表，让用户选择；旧版 lastProject 由列表兼容发现。
    void refreshSettings().catch(() => {}).finally(() => setSettingsReady(true));
  }, [refreshSettings]);

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
      if (document.querySelector('[data-editor-modal]')) return;
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

  if (!settingsReady) {
    return <div className="flex h-screen items-center justify-center bg-[var(--lk-color-bg)] text-sm text-slate-400">{t('projects.loading')}</div>;
  }

  if (!projectRoot || !meta) {
    return (
      <div className="h-screen text-slate-200">
        <Welcome />
        <Suspense fallback={null}>{updateInfo && <UpdateModal info={updateInfo} />}</Suspense>
        {toast && <Toast msg={toast} />}
        <ConfirmationDialog />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--lk-color-bg)] text-slate-200">
      <Toolbar onPublish={() => setPublishing(true)} onSettings={() => setSettingsOpen(true)} onRecovery={() => setRecovering(true)} />
      <Suspense fallback={<div role="status" className="flex flex-1 items-center justify-center text-sm text-slate-400">{t('projects.loading')}</div>}>
      <div className="sf-workspace">
        <div className="sf-library">
          <CardLibrary />
        </div>
        <main className="sf-editor">
          <PropertyPanel />
        </main>
        <aside className="sf-preview"><PreviewPane /></aside>
      </div>
      </Suspense>
      <Suspense fallback={null}>
      {publishing && <PublishPanel onClose={() => setPublishing(false)} />}
      {recovering && <BackupRecoveryModal onClose={() => setRecovering(false)} />}
      {settingsOpen && <ProjectSettingsModal onClose={() => setSettingsOpen(false)} />}
      {updateInfo && <UpdateModal info={updateInfo} />}
      </Suspense>
      {toast && <Toast msg={toast} />}
      <ConfirmationDialog />
    </div>
  );
}

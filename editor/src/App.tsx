import { useEffect, useState } from 'react';
import CardLibrary from './components/CardLibrary';
import CardPreview from './components/CardPreview';
import PropertyPanel from './components/PropertyPanel';
import PublishPanel from './components/PublishPanel';
import ProjectSettingsModal from './components/ProjectSettingsModal';
import Welcome from './components/Welcome';
import { api, pickSaveJsonFile } from './lib/tauri';
import { useStore } from './lib/store';
import { cardEntry } from './lib/types';

function Toast({ msg }: { msg: string }) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-400/30 bg-[#1a1a24]/95 px-4 py-2 text-sm text-amber-200 shadow-xl">
      {msg}
    </div>
  );
}

function Toolbar({ onPublish, onSettings }: { onPublish: () => void; onSettings: () => void }) {
  const { meta, dirtyIds, persistAll, closeProject, showToast, undoStack, redoStack, undo, redo } = useStore();
  const dirty = dirtyIds.length > 0;
  return (
    <div className="flex h-12 items-center gap-3 border-b border-white/10 bg-black/30 px-4">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-black tracking-wide text-amber-300">SpireForge</span>
        <span className="text-xs text-slate-600">{meta?.name}</span>
      </div>
      <div className="flex-1" />
      <button
        onClick={undo}
        disabled={undoStack.length === 0}
        title="撤销最近一次卡牌修改（Ctrl+Z；输入框内 Ctrl+Z 仍是文字撤销）"
        className="rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        ↶ 撤销
      </button>
      <button
        onClick={redo}
        disabled={redoStack.length === 0}
        title="重做被撤销的修改（Ctrl+Y）"
        className="rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        ↷ 重做
      </button>
      <button
        onClick={async () => { await persistAll(); showToast('已保存'); }}
        disabled={!dirty}
        className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
          dirty ? 'bg-white/10 text-amber-300 hover:bg-white/15' : 'bg-white/5 text-slate-600'
        }`}
      >
        {dirty ? `保存 ●（${dirtyIds.length}）` : '已保存'}
      </button>
      <button
        onClick={onPublish}
        className="rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400"
      >
        发布 / 安装
      </button>
      <button
        onClick={onSettings}
        title="项目名称 / 作者 / 简介（简介会发布到工坊）"
        className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-500 transition hover:border-white/25 hover:text-slate-300"
      >
        项目设置
      </button>
      <button
        onClick={() => { void closeProject(); }}
        title="关闭当前项目，回到欢迎页（未保存修改会先落盘）"
        className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-500 transition hover:border-white/25 hover:text-slate-300"
      >
        切换项目
      </button>
    </div>
  );
}

function PreviewPane() {
  const { cards, meta, projectRoot, persistAll, showToast } = useStore();
  const selectedId = useStore((s) => s.selectedId);
  const [upgraded, setUpgraded] = useState(false);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const card = cards.find((c) => c.id === selectedId);

  useEffect(() => {
    setUpgraded(false);
    setPortraitUrl(null);
    if (!card || !card.portrait || !projectRoot) return;
    let url: string | null = null;
    let cancelled = false;
    api
      .readPortrait(card.portrait)
      .then((bytes) => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
        setPortraitUrl(url);
      })
      .catch(() => { if (!cancelled) setPortraitUrl(null); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
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
      showToast('已导出卡牌 JSON');
    } catch (e) {
      showToast('导出失败：' + String(e));
    }
  };

  const doGrant = async () => {
    if (!card || !meta) return;
    try {
      const msg = await api.queueCardGrant([cardEntry(meta.pack_id, card.id)]);
      showToast(`${msg}；下一场战斗开始时加入抽牌堆（游戏未启动则启动后生效）`);
    } catch (e) {
      showToast('登记失败：' + String(e));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-5 overflow-auto bg-[radial-gradient(ellipse_at_center,#1a1a26_0%,#0c0c12_70%)] p-6">
      {card && meta ? (
        <>
          <CardPreview card={card} packId={meta.pack_id} portraitUrl={portraitUrl} upgraded={upgraded} />
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={upgraded} onChange={(e) => setUpgraded(e.target.checked)} />
              预览升级数值
            </label>
            <span className="font-mono">{cardEntry(meta.pack_id, card.id)}</span>
            <button onClick={doGrant} title="把这张卡登记进 Runtime 拿卡清单，下一场战斗开始时自动加入抽牌堆（调试/测试用）"
              className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-200 hover:border-emerald-400/60">
              在游戏中获得
            </button>
            <button onClick={doExport} className="rounded border border-white/10 px-2 py-0.5 hover:border-amber-400/50 hover:text-amber-300">
              导出 JSON
            </button>
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-600">选择或创建一张卡牌开始编辑</div>
      )}
    </div>
  );
}

export default function App() {
  const { projectRoot, meta, toast, openProject } = useStore();
  const [publishing, setPublishing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      {toast && <Toast msg={toast} />}
    </div>
  );
}

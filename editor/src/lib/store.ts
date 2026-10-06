import { create } from 'zustand';
import { api, type PropertyTab, type ValidationIssue } from './tauri';
import { tr } from './i18n';
import { makeCardFromTemplate } from './templates';
import { newCard, type CardDef, type EditorSettings, type ProjectMeta } from './types';

// 自动保存去抖：停止编辑 800ms 后落盘；切卡/关窗/发布另有兜底
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveTask: Promise<void> | null = null;

/** 撤销栈条目：修改前的整卡快照。同一张卡 800ms 内的连续编辑合并为一步。 */
interface HistorySnapshot {
  cardId: string;
  before: CardDef;
  at: number;
}
type UndoEntry = HistorySnapshot & ({ kind: 'edit' } | { kind: 'presence'; present: boolean; index: number });

const UNDO_LIMIT = 100;

interface EditorStore {
  projectRoot: string | null;
  meta: ProjectMeta | null;
  cards: CardDef[];
  selectedId: string | null;
  propertyTab: PropertyTab;
  fieldFocus: { cardId: string; field: string; sequence: number } | null;
  portraitRevision: number;
  historyBusy: boolean;
  settings: EditorSettings;
  /** 未落盘的卡牌 id（多卡可同时处于未保存状态） */
  dirtyIds: string[];
  /** 撤销/重做栈（会话级；按卡记录修改前快照） */
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  toast: string | null;

  showToast: (msg: string) => void;
  refreshSettings: () => Promise<void>;
  newProject: (packId: string, name: string, author: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  select: (id: string | null) => void;
  updateCard: (patch: Partial<CardDef>) => void;
  /** 撤销最近一次卡牌修改（Ctrl+Z）；输入框内由原生文字撤销接管 */
  undo: () => Promise<void>;
  /** 重做被撤销的修改（Ctrl+Y / Ctrl+Shift+Z） */
  redo: () => Promise<void>;
  setPropertyTab: (tab: PropertyTab) => void;
  locateIssue: (issue: ValidationIssue) => void;
  restoreBackup: (key: string, cardId: string | null, projectPath?: string) => Promise<void>;
  /** 保存全部未落盘的修改（切卡前/发布前/手动保存统一入口） */
  persistAll: () => Promise<void>;
  createCard: (tplId?: string) => Promise<void>;
  /** 以现有卡为底复制一张（新 id，名称加「副本」） */
  duplicateCard: (sourceId: string) => Promise<void>;
  removeCard: (id: string) => Promise<void>;
  renameCard: (oldId: string, newId: string) => Promise<void>;
  updateMeta: (patch: Partial<ProjectMeta>) => Promise<void>;
  /** 从磁盘刷新 meta（发布流程回写 workshop_id 后同步 UI） */
  reloadMeta: () => Promise<void>;
  /** 关闭当前项目回到欢迎页（有未保存修改时先落盘） */
  closeProject: () => Promise<void>;
}

export const useStore = create<EditorStore>((set, get) => ({
  projectRoot: null,
  meta: null,
  cards: [],
  selectedId: null,
  propertyTab: 'basic',
  fieldFocus: null,
  portraitRevision: 0,
  historyBusy: false,
  settings: { game_dir: '', runtime_version: null, uploader_path: null },
  dirtyIds: [],
  undoStack: [],
  redoStack: [],
  toast: null,

  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 2600);
  },

  refreshSettings: async () => {
    const settings = await api.getSettings();
    set({ settings });
  },

  newProject: async (packId, name, author) => {
    if (get().historyBusy) throw new Error(tr('st.operationBusy'));
    await get().persistAll();
    const path = await api.newProject(packId, name, author);
    const [meta, cards] = await api.openProject(path);
    set({ projectRoot: path, meta, cards, selectedId: null, dirtyIds: [], undoStack: [], redoStack: [], fieldFocus: null, portraitRevision: get().portraitRevision + 1 });
    await get().refreshSettings().catch(() => {});
  },

  openProject: async (path) => {
    if (get().historyBusy) throw new Error(tr('st.operationBusy'));
    await get().persistAll();
    const [meta, cards] = await api.openProject(path);
    set({ projectRoot: path, meta, cards, selectedId: null, dirtyIds: [], undoStack: [], redoStack: [], fieldFocus: null, portraitRevision: get().portraitRevision + 1 });
    await get().refreshSettings().catch(() => {});
  },

  select: (id) => {
    // 切卡前把未保存修改落盘（异步兜底，不阻塞选中）
    if (get().dirtyIds.length > 0) void get().persistAll().catch(() => {});
    set({ selectedId: id, fieldFocus: null });
  },

  setPropertyTab: (propertyTab) => set({ propertyTab, fieldFocus: null }),
  locateIssue: (issue) => {
    if (!get().cards.some((c) => c.id === issue.card_id)) return;
    get().select(issue.card_id);
    set({ propertyTab: issue.tab, fieldFocus: { cardId: issue.card_id, field: issue.field, sequence: Date.now() } });
  },

  updateCard: (patch) => {
    if (get().historyBusy) return;
    // 标识只能通过后端改名事务修改。
    const { id: _id, ...safePatch } = patch;
    const { cards, selectedId, dirtyIds, undoStack } = get();
    if (!selectedId) return;
    const cur = cards.find((c) => c.id === selectedId);
    if (!cur) return;
    // 撤销快照：同一张卡 800ms 内的连续编辑合并为一步（滑动窗口）
    const now = Date.now();
    const top = undoStack[undoStack.length - 1];
    const merged = undoStack.slice(0, -1);
    const nextStack =
      top && top.kind === 'edit' && top.cardId === selectedId && get().redoStack.length === 0 && now - top.at < 800
        ? [...merged, { ...top, at: now }]
        : [...undoStack, { kind: 'edit' as const, cardId: selectedId, before: JSON.parse(JSON.stringify(cur)) as CardDef, at: now }];
    set({
      cards: cards.map((c) => (c.id === selectedId ? { ...c, ...safePatch } : c)),
      portraitRevision: Object.prototype.hasOwnProperty.call(safePatch, 'portrait') ? get().portraitRevision + 1 : get().portraitRevision,
      dirtyIds: dirtyIds.includes(selectedId) ? dirtyIds : [...dirtyIds, selectedId],
      undoStack: nextStack.slice(-UNDO_LIMIT),
      redoStack: [], // 有新修改后重做分支作废
    });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void get().persistAll().catch(() => {});
    }, 800);
  },

  undo: () => applyHistory('undo'),
  redo: () => applyHistory('redo'),

  persistAll: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    // 多个保存入口串行执行，避免较旧快照覆盖较新快照。
    if (saveTask) {
      await saveTask;
      return get().persistAll();
    }
    const { cards, dirtyIds, projectRoot } = get();
    if (dirtyIds.length === 0) return;
    const task = (async () => {
      const failed: string[] = [];
      for (const id of dirtyIds) {
        const card = cards.find((c) => c.id === id);
        if (!card) {
          set((s) => s.projectRoot === projectRoot && !s.cards.some((c) => c.id === id)
            ? { dirtyIds: s.dirtyIds.filter((d) => d !== id) } : {});
          continue;
        }
        try {
          await api.saveCard(card);
          // 保存期间继续编辑的卡仍保留 dirty；只确认已写入的这一份快照。
          set((s) => s.projectRoot === projectRoot && s.cards.find((c) => c.id === id) === card
            ? { dirtyIds: s.dirtyIds.filter((d) => d !== id) } : {});
        } catch {
          failed.push(id);
        }
      }
      if (failed.length > 0) {
        const message = tr('st.partialSaveFail');
        get().showToast(message);
        throw new Error(message);
      }
    })();
    saveTask = task;
    try { await task; }
    finally { if (saveTask === task) saveTask = null; }
    // 把保存途中输入的内容也落盘，切项目/发布只有完全保存后才继续。
    if (get().dirtyIds.length > 0) return get().persistAll();
  },

  createCard: (tplId) => runExclusive(async () => {
    await get().persistAll();
    const { meta, cards } = get();
    if (!meta) return;
    let n = cards.length + 1;
    let id = `card_${n}`;
    while (cards.some((c) => c.id === id)) {
      n += 1;
      id = `card_${n}`;
    }
    const card = tplId
      ? makeCardFromTemplate(tplId, id, n)
      : { ...newCard(id), name: { zhs: `新卡牌 ${n}`, eng: `New Card ${n}` } };
    if (!card) return;
    await api.saveCard(card);
    const updatedMeta = { ...meta, cards: [...meta.cards, id] };
    await api.updateProjectMeta(updatedMeta);
    set({ meta: updatedMeta, cards: [...cards, card], selectedId: id, dirtyIds: [], redoStack: [] });
  }),

  duplicateCard: (sourceId) => runExclusive(async () => {
    await get().persistAll();
    const { meta, cards } = get();
    if (!meta) return;
    const src = cards.find((c) => c.id === sourceId);
    if (!src) return;
    let n = cards.length + 1;
    let id = `${sourceId}_copy`;
    while (cards.some((c) => c.id === id)) {
      id = `${sourceId}_copy_${n}`;
      n += 1;
    }
    // CardDef 是纯 JSON 数据，深拷贝用 JSON 往返最稳妥
    const card: CardDef = {
      ...JSON.parse(JSON.stringify(src)) as CardDef,
      id,
      name: { zhs: (src.name.zhs || src.id) + ' 副本', eng: (src.name.eng || src.id) + ' Copy' },
    };
    await api.saveCard(card);
    const updatedMeta = { ...meta, cards: [...meta.cards, id] };
    await api.updateProjectMeta(updatedMeta);
    set({ meta: updatedMeta, cards: [...cards, card], selectedId: id, dirtyIds: [], redoStack: [] });
  }),

  removeCard: async (id) => {
    if (get().historyBusy) throw new Error(tr('st.operationBusy'));
    set({ historyBusy: true });
    try {
      await get().persistAll();
      const { meta, cards, undoStack } = get();
      const index = cards.findIndex((c) => c.id === id);
      if (!meta || index < 0) return;
      const before = JSON.parse(JSON.stringify(cards[index])) as CardDef;
      await api.deleteCard(id); // 后端已更新索引，前端不再重复写入。
      set({
        meta: { ...meta, cards: meta.cards.filter((c) => c !== id) },
        cards: cards.filter((c) => c.id !== id),
        selectedId: get().selectedId === id ? null : get().selectedId,
        undoStack: [...undoStack, { kind: 'presence' as const, cardId: id, before, index, present: true, at: 0 }].slice(-UNDO_LIMIT),
        redoStack: [], fieldFocus: null,
      });
    } finally { set({ historyBusy: false }); }
  },

  renameCard: async (oldId, newId) => {
    if (get().historyBusy) throw new Error(tr('st.operationBusy'));
    if (oldId === newId) return;
    set({ historyBusy: true });
    try {
      await get().persistAll();
      const { meta, cards, undoStack, redoStack } = get();
      const previous = cards.find((c) => c.id === oldId);
      if (!meta || !previous) return;
      const renamed = await api.renameCard(oldId, newId);
      const remap = (stack: UndoEntry[]): UndoEntry[] => stack.map((u) => u.cardId === oldId ? {
        ...u, cardId: newId, at: 0,
        before: {
          ...u.before, id: newId,
          portrait: u.before.portrait === previous.portrait ? renamed.portrait : u.before.portrait,
          portrait_original: u.before.portrait_original === previous.portrait_original ? renamed.portrait_original : u.before.portrait_original,
        },
      } : u);
      set({
        meta: { ...meta, cards: meta.cards.map((c) => c === oldId ? newId : c) },
        cards: cards.map((c) => c.id === oldId ? renamed : c),
        selectedId: get().selectedId === oldId ? newId : get().selectedId,
        undoStack: remap(undoStack), redoStack: remap(redoStack),
        portraitRevision: get().portraitRevision + 1, fieldFocus: null,
      });
    } finally { set({ historyBusy: false }); }
  },

  restoreBackup: async (key, cardId, projectPath) => {
    if (get().historyBusy) throw new Error(tr('st.operationBusy'));
    set({ historyBusy: true });
    try {
      // 不先自动保存，避免把用户刚选中的 .bak 轮换掉。
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      if (saveTask) await saveTask;
      if (get().dirtyIds.length) throw new Error(tr('recovery.saveFirst'));
      const [meta, cards] = await api.restoreBackup(key, projectPath);
      set({ projectRoot: projectPath ?? get().projectRoot, meta, cards, selectedId: cardId && cards.some((c) => c.id === cardId) ? cardId : null,
        dirtyIds: [], undoStack: [], redoStack: [], fieldFocus: null, portraitRevision: get().portraitRevision + 1 });
    } finally { set({ historyBusy: false }); }
  },

  updateMeta: (patch) => runExclusive(async () => {
    const { meta } = get();
    if (!meta) return;
    const updated = { ...meta, ...patch };
    await api.updateProjectMeta(updated);
    set({ meta: updated });
  }),

  reloadMeta: async () => {
    if (!get().projectRoot) return;
    const meta = await api.getProjectMeta();
    set({ meta });
  },

  closeProject: async () => {
    if (get().historyBusy) throw new Error(tr('st.operationBusy'));
    await get().persistAll();
    set({
      projectRoot: null, meta: null, cards: [], selectedId: null, dirtyIds: [],
      undoStack: [], redoStack: [],
    });
  },
}));

async function runExclusive(operation: () => Promise<void>): Promise<void> {
  if (useStore.getState().historyBusy) throw new Error(tr('st.operationBusy'));
  useStore.setState({ historyBusy: true });
  try { await operation(); }
  finally { useStore.setState({ historyBusy: false }); }
}

/** 文件删除需要等待后端事务；并发点击只应用一次，失败保留历史条目。 */
async function applyHistory(direction: 'undo' | 'redo'): Promise<void> {
  const s = useStore.getState();
  if (s.historyBusy || !(direction === 'undo' ? s.undoStack : s.redoStack).length) return;
  useStore.setState({ historyBusy: true });
  try {
    await s.persistAll();
    const state = useStore.getState();
    const source = direction === 'undo' ? state.undoStack : state.redoStack;
    const target = direction === 'undo' ? state.redoStack : state.undoStack;
    const top = source[source.length - 1];
    if (!top || !state.meta) return;
    let inverse: UndoEntry;
    if (top.kind === 'edit') {
      const current = state.cards.find((c) => c.id === top.cardId);
      if (!current) throw new Error(tr('st.historyCardMissing'));
      inverse = { ...top, before: JSON.parse(JSON.stringify(current)) as CardDef, at: 0 };
      useStore.setState({ cards: state.cards.map((c) => c.id === top.cardId ? { ...top.before, id: top.cardId } : c),
        selectedId: top.cardId, dirtyIds: [...new Set([...state.dirtyIds, top.cardId])], portraitRevision: state.portraitRevision + 1 });
    } else {
      const meta = state.meta;
      if (top.present) {
        await api.restoreDeletedCard(top.before, top.index);
        const cards = [...state.cards]; cards.splice(Math.min(top.index, cards.length), 0, top.before);
        const ids = [...meta.cards]; ids.splice(Math.min(top.index, ids.length), 0, top.cardId);
        useStore.setState({ cards, meta: { ...meta, cards: ids }, selectedId: top.cardId, portraitRevision: state.portraitRevision + 1 });
      } else {
        await api.deleteCard(top.cardId);
        useStore.setState({ cards: state.cards.filter((c) => c.id !== top.cardId),
          meta: { ...meta, cards: meta.cards.filter((id) => id !== top.cardId) },
          selectedId: state.selectedId === top.cardId ? null : state.selectedId });
      }
      inverse = { ...top, present: !top.present, at: 0 };
    }
    useStore.setState(direction === 'undo'
      ? { undoStack: source.slice(0, -1), redoStack: [...target, inverse].slice(-UNDO_LIMIT), fieldFocus: null }
      : { redoStack: source.slice(0, -1), undoStack: [...target, inverse].slice(-UNDO_LIMIT), fieldFocus: null });
    await useStore.getState().persistAll();
  } catch (e) { useStore.getState().showToast(tr('st.historyFailed', { e: String(e) })); }
  finally { useStore.setState({ historyBusy: false }); }
}

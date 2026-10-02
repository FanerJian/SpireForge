import { create } from 'zustand';
import { api } from './tauri';
import { makeCardFromTemplate, newCard, type CardDef, type EditorSettings, type ProjectMeta } from './types';

// 自动保存去抖：停止编辑 800ms 后落盘；切卡/关窗/发布另有兜底
let saveTimer: ReturnType<typeof setTimeout> | null = null;

interface EditorStore {
  projectRoot: string | null;
  meta: ProjectMeta | null;
  cards: CardDef[];
  selectedId: string | null;
  settings: EditorSettings;
  /** 未落盘的卡牌 id（多卡可同时处于未保存状态） */
  dirtyIds: string[];
  toast: string | null;

  showToast: (msg: string) => void;
  refreshSettings: () => Promise<void>;
  newProject: (path: string, packId: string, name: string, author: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  select: (id: string | null) => void;
  updateCard: (patch: Partial<CardDef>) => void;
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
  settings: { game_dir: '', runtime_version: null, uploader_path: null },
  dirtyIds: [],
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

  newProject: async (path, packId, name, author) => {
    await api.newProject(path, packId, name, author);
    const [meta, cards] = await api.openProject(path);
    set({ projectRoot: path, meta, cards, selectedId: null, dirtyIds: [] });
    await get().refreshSettings();
  },

  openProject: async (path) => {
    const [meta, cards] = await api.openProject(path);
    set({ projectRoot: path, meta, cards, selectedId: null, dirtyIds: [] });
    await get().refreshSettings();
  },

  select: (id) => {
    // 切卡前把未保存修改落盘（异步兜底，不阻塞选中）
    if (get().dirtyIds.length > 0) void get().persistAll();
    set({ selectedId: id });
  },

  updateCard: (patch) => {
    const { cards, selectedId, dirtyIds } = get();
    if (!selectedId) return;
    set({
      cards: cards.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)),
      dirtyIds: dirtyIds.includes(selectedId) ? dirtyIds : [...dirtyIds, selectedId],
    });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void get().persistAll();
    }, 800);
  },

  persistAll: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const { cards, dirtyIds } = get();
    if (dirtyIds.length === 0) return;
    const failed: string[] = [];
    for (const id of dirtyIds) {
      const card = cards.find((c) => c.id === id);
      if (!card) continue; // 卡已被删除，放弃该条
      try {
        await api.saveCard(card);
      } catch {
        failed.push(id);
      }
    }
    set({ dirtyIds: failed });
    if (failed.length > 0) get().showToast('部分修改保存失败，请重试');
  },

  createCard: async (tplId) => {
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
    set({ meta: updatedMeta, cards: [...cards, card], selectedId: id, dirtyIds: [] });
  },

  duplicateCard: async (sourceId) => {
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
    set({ meta: updatedMeta, cards: [...cards, card], selectedId: id, dirtyIds: [] });
  },

  removeCard: async (id) => {
    const { meta, cards, dirtyIds } = get();
    if (!meta) return;
    await api.deleteCard(id);
    const updatedMeta = { ...meta, cards: meta.cards.filter((c) => c !== id) };
    await api.updateProjectMeta(updatedMeta);
    set({
      meta: updatedMeta,
      cards: cards.filter((c) => c.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
      dirtyIds: dirtyIds.filter((d) => d !== id),
    });
  },

  renameCard: async (oldId, newId) => {
    const { meta, cards, selectedId, dirtyIds } = get();
    if (!meta || oldId === newId) return;
    await api.renameCard(oldId, newId);
    const updatedMeta = { ...meta, cards: meta.cards.map((c) => (c === oldId ? newId : c)) };
    set({
      meta: updatedMeta,
      cards: cards.map((c) => (c.id === oldId ? { ...c, id: newId } : c)),
      selectedId: selectedId === oldId ? newId : selectedId,
      dirtyIds: dirtyIds.map((d) => (d === oldId ? newId : d)),
    });
  },

  updateMeta: async (patch) => {
    const { meta } = get();
    if (!meta) return;
    const updated = { ...meta, ...patch };
    await api.updateProjectMeta(updated);
    set({ meta: updated });
  },

  reloadMeta: async () => {
    if (!get().projectRoot) return;
    const meta = await api.getProjectMeta();
    set({ meta });
  },

  closeProject: async () => {
    await get().persistAll();
    localStorage.removeItem('spireforge.lastProject');
    set({ projectRoot: null, meta: null, cards: [], selectedId: null, dirtyIds: [] });
  },
}));

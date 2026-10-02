import { create } from 'zustand';
import { api } from './tauri';
import { newCard, type CardDef, type EditorSettings, type ProjectMeta } from './types';

interface EditorStore {
  projectRoot: string | null;
  meta: ProjectMeta | null;
  cards: CardDef[];
  selectedId: string | null;
  settings: EditorSettings;
  dirty: boolean;
  toast: string | null;

  showToast: (msg: string) => void;
  refreshSettings: () => Promise<void>;
  newProject: (path: string, packId: string, name: string, author: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  select: (id: string | null) => void;
  updateCard: (patch: Partial<CardDef>) => void;
  persistCard: () => Promise<void>;
  createCard: () => Promise<void>;
  removeCard: (id: string) => Promise<void>;
  updateMeta: (patch: Partial<ProjectMeta>) => Promise<void>;
}

export const useStore = create<EditorStore>((set, get) => ({
  projectRoot: null,
  meta: null,
  cards: [],
  selectedId: null,
  settings: { game_dir: '', runtime_version: null, uploader_path: null },
  dirty: false,
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
    set({ projectRoot: path, meta, cards, selectedId: null });
    await get().refreshSettings();
  },

  openProject: async (path) => {
    const [meta, cards] = await api.openProject(path);
    set({ projectRoot: path, meta, cards, selectedId: null });
    await get().refreshSettings();
  },

  select: (id) => set({ selectedId: id }),

  updateCard: (patch) => {
    const { cards, selectedId } = get();
    if (!selectedId) return;
    set({
      cards: cards.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)),
      dirty: true,
    });
  },

  persistCard: async () => {
    const { cards, selectedId } = get();
    const card = cards.find((c) => c.id === selectedId);
    if (!card) return;
    await api.saveCard(card);
    set({ dirty: false });
  },

  createCard: async () => {
    const { meta, cards } = get();
    if (!meta) return;
    let n = cards.length + 1;
    let id = `card_${n}`;
    while (cards.some((c) => c.id === id)) {
      n += 1;
      id = `card_${n}`;
    }
    const card = { ...newCard(id), name: { zhs: `新卡牌 ${n}`, eng: `New Card ${n}` } };
    await api.saveCard(card);
    const updatedMeta = { ...meta, cards: [...meta.cards, id] };
    await api.updateProjectMeta(updatedMeta);
    set({ meta: updatedMeta, cards: [...cards, card], selectedId: id });
  },

  removeCard: async (id) => {
    const { meta, cards } = get();
    if (!meta) return;
    await api.deleteCard(id);
    const updatedMeta = { ...meta, cards: meta.cards.filter((c) => c !== id) };
    await api.updateProjectMeta(updatedMeta);
    set({
      meta: updatedMeta,
      cards: cards.filter((c) => c.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
  },

  updateMeta: async (patch) => {
    const { meta } = get();
    if (!meta) return;
    const updated = { ...meta, ...patch };
    await api.updateProjectMeta(updated);
    set({ meta: updated });
  },
}));

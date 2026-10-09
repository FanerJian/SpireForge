import { useEffect, useSyncExternalStore } from 'react';
import { api } from './tauri';
import type { RuntimeCatalog } from './types';

type CatalogState = { catalog: RuntimeCatalog | null; loading: boolean; error: string | null };
let state: CatalogState = { catalog: null, loading: false, error: null };
let directory = '';
let generation = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = (next: CatalogState) => { state = next; for (const listener of listeners) listener(); };
export function invalidateRuntimeCatalog() {
  generation++; inFlight = null; directory = '';
  emit({ catalog: null, loading: false, error: null });
}
export function refreshRuntimeCatalog(): Promise<void> {
  if (inFlight) return inFlight;
  const request = generation;
  emit({ ...state, loading: true });
  const task = (async () => {
    try {
      const settings = await api.getSettings();
      if (request !== generation) return;
      if (settings.game_dir !== directory) {
        directory = settings.game_dir;
        emit({ catalog: null, loading: true, error: null });
      }
      const catalog = await api.readGameCatalog();
      if (request === generation) emit({ catalog, loading: false, error: null });
    } catch (error) {
      if (request === generation) emit({ ...state, loading: false, error: String(error) });
    }
  })();
  inFlight = task;
  void task.finally(() => { if (inFlight === task) inFlight = null; });
  return task;
}
window.addEventListener('focus', () => { if (listeners.size) void refreshRuntimeCatalog(); });
window.addEventListener('spireforge:catalog-reset', () => { invalidateRuntimeCatalog(); if (listeners.size) void refreshRuntimeCatalog(); });
export function useRuntimeCatalogState(): CatalogState {
  const snapshot = useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state);
  useEffect(() => { if (!state.catalog && !state.loading) void refreshRuntimeCatalog(); }, []);
  return snapshot;
}

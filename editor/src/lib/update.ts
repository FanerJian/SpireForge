// 自动更新的前端壳：启动静默检查（24h 节流 + 跳过版本记忆）+ 手动检查共享状态。
// 下载/校验/换文件都在 Rust 侧（lib/update 命令），这里只编排 UI 状态。
import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import { api } from './tauri';

export interface UpdateCheck {
  current: string;
  latest: string;
  pub_date: string;
  notes_zhs: string;
  notes_eng: string;
  sha256: string;
  size: number;
  urls: string[];
}

export interface DlProgress {
  received: number;
  total: number;
}

const LAST_CHECK_KEY = 'spireforge.update.lastCheck';
const SKIP_KEY = 'spireforge.update.skip';
const DAY_MS = 24 * 60 * 60 * 1000;

// ---- 共享状态（模块级极简 store：App 根弹窗与设置页按钮共用）----

type Listener = () => void;
const subs = new Set<Listener>();
let info: UpdateCheck | null = null;

function emit() {
  subs.forEach((f) => f());
}

export const updateStore = {
  get: () => info,
  subscribe: (f: Listener) => {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};

/** useSyncExternalStore 用的小钩子 */
export function useUpdateInfo(): UpdateCheck | null {
  return useSyncExternalStore(updateStore.subscribe, updateStore.get);
}

export function dismissUpdate(skip: boolean) {
  if (skip && info) {
    localStorage.setItem(SKIP_KEY, info.latest);
  }
  info = null;
  emit();
}

export function showUpdate(c: UpdateCheck) {
  info = c;
  emit();
}

/** 检查一次更新；found=弹窗已弹出。force=false 时尊重「跳过此版本」；
 *  抛错 = 全部清单源不可达。 */
export async function checkUpdateNow(force = false): Promise<UpdateCheck | null> {
  const r = await api.checkUpdate();
  if (r && (force || localStorage.getItem(SKIP_KEY) !== r.latest)) {
    showUpdate(r);
    return r;
  }
  return null;
}

/** 应用启动的静默检查：24h 一次；离线/源不可达完全静默 */
export function useAutoUpdateCheck() {
  useEffect(() => {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0);
    if (Date.now() - last < DAY_MS) return;
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    checkUpdateNow().catch(() => {});
  }, []);
}

// 应用内确认状态：只允许一个待确认操作；重复请求取消，避免同一操作并发执行。
export interface ConfirmationRequest { message: string }
let request: ConfirmationRequest | null = null;
let resolveRequest: ((approved: boolean) => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const confirmationStore = {
  get: () => request,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

export function confirmAction(message: string): Promise<boolean> {
  if (request) return Promise.resolve(false);
  return new Promise((resolve) => {
    request = { message };
    resolveRequest = resolve;
    emit();
  });
}

export function finishConfirmation(approved: boolean): void {
  const resolve = resolveRequest;
  request = null;
  resolveRequest = null;
  emit();
  resolve?.(approved === true);
}

// Public API types. Copied to dist/ by the build and installed next to loomkit.esm.js.
export interface KitHandle {
  el: HTMLElement;
  readonly value: unknown;
  update(patch: Record<string, unknown>): void;
  destroy(): void;
}

export interface KitOptions {
  data?: Record<string, unknown>;
  theme?: string;
  style?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on?: Record<string, (detail: any, event: Event) => void>;
  slots?: Record<string, HTMLElement>;
  slot?: string;
}

export interface KitCatalog {
  version: string;
  contractVersion: number;
  themes: string[];
  styles: string[];
  components: Record<string, unknown>;
}

export const VERSION: string;
export function create(name: string, options?: KitOptions): KitHandle;
export function mount(target: HTMLElement | string, name: string, options?: KitOptions): KitHandle;
export function applyTheme(element: HTMLElement, name: string, options?: { style?: string }): void;
export function applyStyle(element: HTMLElement, name: string): void;
export function registerTheme(name: string, tokens: Record<string, string>): void;
export function toast(message: string, options?: { tone?: 'neutral' | 'ok'; duration?: number }): void;
export function catalog(): KitCatalog;

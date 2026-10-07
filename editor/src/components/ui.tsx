// 全局共享的表单 UI 原语：输入框样式常量 + Field/NumInput/Segmented。
// 各面板统一从这里引用，避免同一份 className/组件在每个组件里各抄一份后渐行渐远。
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export const inputCls =
  'w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-slate-200 outline-none transition focus:border-amber-400/60 focus:bg-black/60';

export const selectCls = inputCls + ' appearance-none';

/** 折叠只影响呈现；保留子组件、输入草稿和数据，展开状态不计入卡牌修改。 */
export function Disclosure({ title, children, defaultOpen = false, storageKey, actions, hint, className = '', field, effectField }: {
  title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; storageKey?: string;
  actions?: React.ReactNode; hint?: string; className?: string; field?: string; effectField?: string;
}) {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen;
    try { const value = localStorage.getItem('spireforge.ui.fold.' + storageKey); return value == null ? defaultOpen : value === 'open'; }
    catch { return defaultOpen; }
  });
  return (
    <details data-disclosure data-field={field} data-effect-field={effectField} open={open}
      className={'min-w-0 rounded-md border border-white/10 ' + className}
      onToggle={event => {
        const next = event.currentTarget.open;
        setOpen(next);
        if (storageKey) { try { localStorage.setItem('spireforge.ui.fold.' + storageKey, next ? 'open' : 'closed'); } catch { /* 本次仍可折叠。 */ } }
      }}>
      <summary title={hint} className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden="true" size={13} className={'shrink-0 text-slate-500 transition-transform ' + (open ? 'rotate-90' : '')} />
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {actions && <span className="flex shrink-0 items-center gap-1" onClick={event => event.stopPropagation()}>{actions}</span>}
      </summary>
      <div className="space-y-3 border-t border-white/5 px-3 py-3">{children}</div>
    </details>
  );
}

/** 原生 details 的切换事件同步组件状态；校验定位和批量展开共用这条路径。 */
export function revealDisclosureAncestors(element: HTMLElement): void {
  let parent = element.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
  if (element instanceof HTMLDetailsElement) element.open = true;
}

export function setDisclosuresOpen(root: HTMLElement | null, open: boolean): void {
  root?.querySelectorAll<HTMLDetailsElement>('details[data-disclosure]').forEach(element => { element.open = open; });
}

export function Field({ label, children, hint, field }: { label: string; children: React.ReactNode; hint?: string; field?: string }) {
  return (
    <label data-field={field} className="block min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-400">{label}</span>
        {hint && <span className="truncate text-right text-[10px] text-slate-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

/** 数值输入：编辑期间是草稿态，允许清空/随意改写，输入合法数字即时提交；
 *  空值失焦回落已提交值（allowEmpty 时提交 undefined）。之前"清空不提交"导致
 *  占位数字删不掉，全选重输是唯一改法，不好用（用户反馈）。 */
export function NumInput({ value, onCommit, allowEmpty, width, className }: {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  allowEmpty?: boolean;
  width?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const committed = value == null ? '' : String(value);
  return (
    <input
      type="number"
      className={(className ?? inputCls) + ' ' + (width ?? 'w-24')}
      value={draft ?? committed}
      onChange={(ev) => {
        const s = ev.target.value;
        setDraft(s);
        if (s.trim() === '') {
          if (allowEmpty) onCommit(undefined);
          return;
        }
        const n = Number(s);
        if (!Number.isNaN(n)) onCommit(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o.v ? 'bg-amber-500/90 text-black' : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

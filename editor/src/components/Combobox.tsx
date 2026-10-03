import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';

export interface ComboItem {
  /** 保存到卡牌 JSON 的规范值（效果 PowerModel 解析名/怪物类名/卡牌 Entry） */
  value: string;
  /** 主显示名（随界面语言给出：中文界面=中文名，英文界面=英文名） */
  primary: string;
  /** 次要说明行（官方描述 / Entry 等，随界面语言给出） */
  secondary?: string;
  /** 图标 URL（可空） */
  icon?: string;
  /** 右侧小徽章（如 Normal / Elite / Boss / 攻击） */
  badge?: string;
  /** 徽章着色提示（红色系=敌人向，绿色系=增益向） */
  badgeTone?: 'danger' | 'safe' | 'neutral';
  /** 搜索关键词（主/次显示名之外额外可匹配的文本，如另一语言的名字） */
  keywords?: string;
}

interface Props {
  /** 当前保存值（规范值，不是显示名） */
  value: string;
  items: ComboItem[];
  onChange: (v: string) => void;
  /** 无匹配值时的显示回落（如自定义输入的原始名） */
  fallbackDisplay?: string;
  searchPlaceholder: string;
  /** 无匹配时提供「使用原始值」行动行；省略 = 不提供 */
  allowRaw?: boolean;
  rawLabel?: (raw: string) => string;
  widthClass?: string;
}

/** 可搜索下拉（替代原生 datalist）：界面语言只显示对应语言的名称，
 *  列表带官方描述与图标，顶部搜索框中英文均可检索。 */
export function Combobox({ value, items, onChange, fallbackDisplay, searchPlaceholder, allowRaw, rawLabel, widthClass = 'w-40' }: Props) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const byValue = useMemo(() => new Map(items.map((i) => [i.value, i])), [items]);
  const current = byValue.get(value);
  // 关闭态输入框里显示什么：有目录项 → 本地化名；否则回落（自定义原始值）
  const display = current ? current.primary : (fallbackDisplay ?? value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.primary.toLowerCase().includes(q)
      || i.value.toLowerCase().includes(q)
      || (i.secondary ?? '').toLowerCase().includes(q)
      || (i.keywords ?? '').toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // 等弹层渲染完再聚焦搜索框
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, filtered]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = filtered[active]; if (it) pick(it.value); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const exact = filtered.some((i) => i.value.toLowerCase() === query.trim().toLowerCase());
  const badgeCls = (tone: ComboItem['badgeTone']) =>
    tone === 'danger' ? 'bg-rose-500/15 text-rose-300/90'
    : tone === 'safe' ? 'bg-emerald-500/15 text-emerald-300/90'
    : 'bg-white/10 text-slate-400';

  return (
    <div ref={rootRef} className={`relative ${widthClass}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-left text-sm text-slate-200 hover:border-white/20"
        onClick={() => setOpen((o) => !o)}
        title={current?.secondary ?? display}
      >
        {current?.icon && <img src={`/catalog/powers/${current.icon}`} alt="" className="h-5 w-5 shrink-0 object-contain" />}
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <span className="shrink-0 text-[10px] text-slate-500">▼</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-[min(22rem,80vw)] rounded-xl border border-white/10 bg-[#141a24] shadow-2xl shadow-black/60">
          <div className="border-b border-white/10 p-2">
            <input
              ref={searchRef}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-400/40"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKey}
            />
          </div>
          <div ref={listRef} className="max-h-72 overflow-y-auto p-1">
            {filtered.map((it, idx) => (
              <button
                key={it.value}
                type="button"
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${idx === active ? 'bg-sky-500/15' : 'hover:bg-white/5'}`}
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(it.value)}
              >
                {it.icon && <img src={`/catalog/powers/${it.icon}`} alt="" className="mt-0.5 h-7 w-7 shrink-0 object-contain" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-200">{it.primary}</span>
                  {it.secondary && <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-slate-500">{it.secondary}</span>}
                </span>
                {it.badge && (
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] ${badgeCls(it.badgeTone)}`}>{it.badge}</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && allowRaw && query.trim() !== '' && !exact && (
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-2 py-2 text-left text-sm text-sky-300/90 hover:bg-white/5"
                onClick={() => pick(query.trim())}
              >
                {rawLabel ? rawLabel(query.trim()) : `"${query.trim()}"`}
              </button>
            )}
            {filtered.length === 0 && (!allowRaw || query.trim() === '') && (
              <div className="px-2 py-3 text-center text-xs text-slate-600">{lang === 'en' ? 'No match' : '无匹配'}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

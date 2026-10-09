import type { EffectParameter, EffectDef } from '../../lib/types';
type CustomDef = Extract<EffectDef, { kind: 'custom' }>;

export default function EffectParameterFields({ parameters, value, patch }: {
  parameters: EffectParameter[]; value: CustomDef; patch: (next: Partial<EffectDef>) => void;
}) {
  const set = (name: string, next: unknown) => patch({ params: { ...value.params, [name]: next } } as Partial<EffectDef>);
  const cls = 'min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200';
  return <div className="space-y-2">{parameters.map(p => {
    const current = value.params?.[p.name] ?? p.default;
    return <label key={p.name} className="flex items-center gap-2 text-xs text-slate-400">
      <span className="w-24 shrink-0">{p.title || p.name}{p.required ? ' *' : ''}</span>
      {p.type === 'enum' ? <select className={cls} value={String(current ?? '')} onChange={e => set(p.name, e.target.value)}><option value="">—</option>{p.options?.map(o => <option key={o} value={o}>{o}</option>)}</select>
        : p.type === 'boolean' ? <input type="checkbox" checked={current === true} onChange={e => set(p.name, e.target.checked)} />
        : <input className={cls} type={p.type === 'number' ? 'number' : 'text'} min={p.min ?? undefined} max={p.max ?? undefined} step="any" value={current == null ? '' : String(current)} onChange={e => set(p.name, p.type === 'number' ? Number(e.target.value) : e.target.value)} />}
    </label>;
  })}</div>;
}

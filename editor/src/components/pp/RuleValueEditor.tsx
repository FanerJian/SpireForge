import { Disclosure, NumInput, inputCls, selectCls } from '../ui';
import { useLang } from '../../lib/i18n';
import { VALUE_SOURCES, type RuleValue, type ValueSource } from '../../lib/rules';
import { RuleReferenceSelect, useRuleReferences, useRuleText } from './RuleReferences';

export function RuleSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400"><span>{label}</span><select className={selectCls} value={value} onChange={e => onChange(e.target.value as T)}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
}
export function RuleText({ label, value, onChange, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400"><span>{label}</span><input className={inputCls} value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} /></label>;
}
export function RuleNumber({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400"><span>{label}</span><NumInput value={value} onCommit={n => { if (n != null && Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))); }} /></label>;
}
export default function RuleValueEditor({ label, value, onChange }: { label: string; value: RuleValue; onChange: (value: RuleValue) => void }) {
  const en = useLang() === 'en';
  const refs = useRuleReferences(), text = useRuleText();
  const dynamic = typeof value === 'object';
  const update = (patch: Partial<Exclude<RuleValue, number>>) => { if (dynamic) onChange({ ...value, ...patch }); };
  return <div className="sf-value">
    <div className="grid grid-cols-2 gap-2">
      <RuleSelect label={label} value={dynamic ? value.source : 'constant'} options={[
        ['constant', en ? 'Constant' : '固定数值'], ...Object.entries(VALUE_SOURCES).map(([id, names]) => [id, names[en ? 1 : 0]] as [string, string]),
      ]} onChange={source => onChange(source === 'constant' ? 1 : { source: source as ValueSource, ...(source === 'counter' ? { key: refs.counters[0] ?? 'combo', scope: 'turn' as const } : source.endsWith('stacks') ? { key: source === 'power_stacks' ? 'Vulnerable' : refs.statuses[0]?.id ?? '', subject: 'target' as const } : {}) })} />
      {!dynamic && <RuleNumber label={en ? 'Value' : '数值'} value={value} onChange={onChange} />}
      {dynamic && (value.source === 'counter' || value.source.endsWith('stacks')) && <div className="min-w-0 space-y-1"><span className="text-xs text-slate-400">{value.source === 'counter' ? en ? 'Counter' : '计数器' : en ? 'Status' : '状态'}</span><RuleReferenceSelect kind={value.source === 'counter' ? 'counter' : value.source === 'status_stacks' ? 'status' : 'power'} value={value.key ?? ''} onChange={key => update({ key })} /></div>}
    </div>
    {dynamic && <>
      {value.source === 'counter' && <RuleSelect label={en ? 'Lifetime' : '计数范围'} value={value.scope ?? 'combat'} options={[["turn", en ? 'This turn' : '本回合'], ["combat", en ? 'This combat' : '本场战斗']]} onChange={scope => update({ scope })} />}
      {value.source.endsWith('stacks') && <RuleSelect label={en ? 'Subject' : '读取对象'} value={value.subject ?? 'self'} options={[["self", en ? 'Self' : '自身'], ["target", en ? 'Target total' : '当前目标合计']]} onChange={subject => update({ subject })} />}
      <p className="sf-muted sf-readable">{text.value(value)}</p>
      <Disclosure title={en ? 'Calculation' : '数值计算'}>
        <div className="grid grid-cols-2 gap-2"><RuleNumber label={en ? 'Multiplier' : '乘数'} value={value.factor ?? 1} onChange={factor => update({ factor })} /><RuleNumber label={en ? 'Offset' : '加减值'} value={value.offset ?? 0} onChange={offset => update({ offset })} /></div>
        <RuleSelect label={en ? 'Rounding' : '取整方式'} value={value.rounding ?? 'floor'} options={[["floor", en ? 'Round down' : '向下取整'], ["ceil", en ? 'Round up' : '向上取整'], ["round", en ? 'Round nearest' : '四舍五入']]} onChange={rounding => update({ rounding })} />
        {(['min', 'max'] as const).map(bound => <div key={bound} className="flex items-end gap-2"><label className="flex items-center gap-1 py-2 text-xs text-slate-400"><input type="checkbox" checked={value[bound] != null} onChange={e => { const next = { ...value }; if (e.target.checked) next[bound] = bound === 'min' ? 0 : 100; else delete next[bound]; onChange(next); }} />{bound === 'min' ? en ? 'Minimum' : '下限' : en ? 'Maximum' : '上限'}</label>{value[bound] != null && <RuleNumber label="" value={value[bound]!} onChange={n => update({ [bound]: n })} />}</div>)}
      </Disclosure>
    </>}
  </div>;
}

import { createContext, useContext, useMemo } from 'react';
import { useLang } from '../../lib/i18n';
import { collectRuleCounters } from '../../lib/ruleAuthoring';
import { describeRules, valueText, type RuleNode, type RuleStatus, type RuleValue } from '../../lib/rules';
import { Combobox, type ComboItem } from '../Combobox';
import { buildPowerCombo, modPowers, useRuntimeCatalog } from './catalogs';

interface References { statuses: RuleStatus[]; counters: string[]; powers: ComboItem[]; openStatuses?: () => void }
const Context = createContext<References>({ statuses: [], counters: [], powers: [] });
export const useRuleReferences = () => useContext(Context);

export function RuleReferences({ nodes, statuses, children, openStatuses }: { nodes: RuleNode[]; statuses: RuleStatus[]; children: React.ReactNode; openStatuses?: () => void }) {
  const lang = useLang(), runtime = useRuntimeCatalog();
  const value = useMemo(() => ({ statuses, counters: collectRuleCounters(nodes, statuses), powers: buildPowerCombo(lang, modPowers(runtime)), openStatuses }), [nodes, statuses, lang, runtime, openStatuses]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function referenceText(text: string, en: boolean, references: References): string {
  const names = new Map([...references.powers.map(p => [p.value, p.primary] as const), ...references.statuses.map(s => [s.id, s.name[en ? 'eng' : 'zhs'] || s.name.zhs || s.name.eng || s.id] as const)]);
  return text.replace(/「([^」]+)」/g, (whole, id: string) => names.has(id) ? `「${names.get(id)}」` : whole)
    .replace(/目标合计(?:游戏状态层数|自定义状态层数)「([^」]+)」/g, '目标「$1」总层数')
    .replace(/(?:游戏状态层数|自定义状态层数)「([^」]+)」/g, '自身「$1」层数')
    .replace(/自定义计数器「([^」]+)」/g, '「$1」计数');
}
export function useRuleText() {
  const en = useLang() === 'en', refs = useRuleReferences();
  return {
    value: (value: RuleValue) => referenceText(valueText(value, en), en, refs),
    nodes: (nodes: RuleNode[]) => referenceText(describeRules(nodes, en, refs.statuses), en, refs),
    node: (node: RuleNode) => referenceText(describeRules([{ ...node, enabled: true }], en, refs.statuses).split('\n')[0].replace(/[：:]$/, ''), en, refs),
  };
}

export function RuleReferenceSelect({ kind, value, onChange }: { kind: 'status' | 'power' | 'counter'; value: string; onChange: (value: string) => void }) {
  const refs = useRuleReferences(), en = useLang() === 'en';
  const items: ComboItem[] = kind === 'power' ? refs.powers : kind === 'counter' ? refs.counters.map(key => ({ value: key, primary: key })) : refs.statuses.map(status => ({ value: status.id, primary: status.name[en ? 'eng' : 'zhs'] || status.name.zhs || status.name.eng || status.id, secondary: status.description[en ? 'eng' : 'zhs'], keywords: `${status.id} ${status.name.zhs} ${status.name.eng}` }));
  return <div className="space-y-1.5"><Combobox widthClass="w-full" value={value} items={items} onChange={onChange} fallbackDisplay={value || (en ? 'Select' : '请选择')} allowRaw={kind !== 'status'} searchPlaceholder={kind === 'status' ? en ? 'Find custom status' : '搜索自定义状态' : kind === 'power' ? en ? 'Find game power' : '搜索游戏状态' : en ? 'Find or create counter' : '搜索或新建计数器'} rawLabel={raw => `${en ? 'Use' : '使用'}「${raw}」`} />
    {kind === 'status' && refs.openStatuses && <button className="sf-link" type="button" onClick={refs.openStatuses}>{en ? 'Manage statuses' : '管理状态'}</button>}
  </div>;
}

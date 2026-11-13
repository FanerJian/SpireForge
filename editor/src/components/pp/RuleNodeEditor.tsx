import { useMemo, useRef, useState } from 'react';
import { Disclosure, selectCls } from '../ui';
import { useLang, EFFECT_META, pick, TYPE_LABEL } from '../../lib/i18n';
import { defaultEffect, CORE_KINDS, EXTRA_KINDS } from '../../lib/effects';
import { cloneNode, defaultNode, moveNode, NODE_LABELS, PILE_LABELS, RULE_LIMITS, type CardOperation, type RuleNode, type RuleStatus } from '../../lib/rules';
import type { EffectDef } from '../../lib/types';
import { useStore } from '../../lib/store';
import { Combobox } from '../Combobox';
import { buildPowerCombo, buildMonsterCombo, buildSpawnCombo, modPowers, modMonsters, useRuntimeCatalog, useVanillaCatalog } from './catalogs';
import RuleValueEditor, { RuleNumber, RuleSelect } from './RuleValueEditor';
import { editorIdentity, retainEditorIdentity } from '../../lib/editorIdentity';
import { RuleReferenceSelect, useRuleText } from './RuleReferences';

const smallButton = 'sf-button';
const ACTIONS = [...CORE_KINDS, ...EXTRA_KINDS].filter(k => !['custom', 'delayed', 'vfx'].includes(k));
export default function RuleNodeEditor({ nodes, onChange, statuses, path = 'rules', depth = 0 }: { nodes: RuleNode[]; onChange: (nodes: RuleNode[]) => void; statuses: RuleStatus[]; path?: string; depth?: number }) {
  const lang = useLang(), en = lang === 'en';
  const text = useRuleText();
  const [adding, setAdding] = useState<RuleNode['type']>('action');
  const listRef = useRef<HTMLDivElement>(null);
  const set = (i: number, node: RuleNode) => onChange(nodes.map((n, index) => index === i ? retainEditorIdentity(n, node) : n));
  if (depth >= RULE_LIMITS.depth) return <p role="alert" className="text-xs text-amber-300">{en ? 'Nesting limit reached.' : '已达到嵌套上限。'}</p>;
  return <div ref={listRef} className="space-y-2" data-rule-list={path}>
    {nodes.map((node, i) => <Disclosure key={editorIdentity(node)} className="sf-rule-node" defaultOpen={depth === 0 && nodes.length <= 3} title={<span className={node.enabled === false ? 'opacity-50' : ''}><span className="mr-2 font-mono text-[11px] text-slate-500">{String(i + 1).padStart(2, '0')}</span>{text.node(node)}</span>} hint={text.node(node)}
      field={`${path}.${i}`} actions={<span className="sf-rule-actions flex items-center gap-0.5">
        <input type="checkbox" aria-label={en ? 'Enable rule' : '启用规则'} checked={node.enabled !== false} onChange={e => set(i, { ...node, enabled: e.target.checked })} onClick={e => e.stopPropagation()} />
        <button type="button" className={smallButton} aria-label={en ? 'Move up' : '上移规则'} disabled={i === 0} onClick={event => { event.preventDefault(); onChange(moveNode(nodes, i, -1)); }}>↑</button>
        <button type="button" className={smallButton} aria-label={en ? 'Move down' : '下移规则'} disabled={i === nodes.length - 1} onClick={event => { event.preventDefault(); onChange(moveNode(nodes, i, 1)); }}>↓</button>
        <button type="button" className={smallButton} aria-label={en ? 'Duplicate rule' : '复制规则'} onClick={event => { event.preventDefault(); onChange([...nodes.slice(0, i + 1), cloneNode(node), ...nodes.slice(i + 1)]); }}>＋</button>
        <button type="button" className={smallButton} aria-label={en ? 'Delete rule' : '删除规则'} onClick={event => { event.preventDefault(); onChange(nodes.filter((_, index) => index !== i)); }}>×</button>
      </span>}>
      <div className={node.enabled === false ? 'space-y-2 opacity-50' : 'space-y-2'}>
        {node.type === 'action' && <ActionNode node={node} onChange={n => set(i, n)} />}
        {node.type === 'if' && <>
          <RuleSelect label={en ? 'Match' : '条件关系'} value={node.match} options={[["all", en ? 'All conditions' : '全部满足'], ["any", en ? 'Any condition' : '任一满足']]} onChange={match => set(i, { ...node, match })} />
          {node.conditions.map((condition, c) => { const patch = (p: Partial<typeof condition>) => set(i, { ...node, conditions: node.conditions.map((v, j) => j === c ? { ...v, ...p } : v) }); return <div key={c} className="sf-condition rounded border border-white/10 p-3">
            <RuleValueEditor label={en ? 'Left value' : '比较数值'} value={condition.left} onChange={left => patch({ left })} />
            <RuleSelect label={en ? 'Comparison' : '比较方式'} value={condition.op} options={[["eq", '='], ["ne", '≠'], ["gt", '>'], ["gte", '≥'], ["lt", '<'], ["lte", '≤']]} onChange={op => patch({ op })} />
            <RuleValueEditor label={en ? 'Right value' : '比较基准'} value={condition.right} onChange={right => patch({ right })} />
            <button className="sf-link justify-self-start" onClick={() => set(i, { ...node, conditions: node.conditions.filter((_, j) => j !== c) })}>{en ? 'Remove condition' : '删除条件'}</button>
          </div>; })}
          <button className={smallButton} onClick={() => set(i, { ...node, conditions: [...node.conditions, { left: { source: 'self_hp' }, op: 'lt', right: 30 }] })}>{en ? 'Add condition' : '添加条件'}</button>
          <Disclosure title={en ? 'Then' : '满足时'} defaultOpen><RuleNodeEditor nodes={node.then} onChange={then => set(i, { ...node, then })} statuses={statuses} path={`${path}.${i}.then`} depth={depth + 1} /></Disclosure>
          <Disclosure title={en ? 'Otherwise' : '否则'}><RuleNodeEditor nodes={node.else} onChange={otherwise => set(i, { ...node, else: otherwise })} statuses={statuses} path={`${path}.${i}.else`} depth={depth + 1} /></Disclosure>
        </>}
        {(node.type === 'repeat' || node.type === 'random') && <>
          <RuleValueEditor label={node.type === 'repeat' ? en ? 'Repeats' : '重复次数' : en ? 'Selections' : '抽取数量'} value={node.count} onChange={count => set(i, { ...node, count })} />
          <RuleNodeEditor nodes={node.nodes} onChange={children => set(i, { ...node, nodes: children })} statuses={statuses} path={`${path}.${i}.nodes`} depth={depth + 1} />
        </>}
        {node.type === 'counter' && <>
          <div className="space-y-1"><span className="text-xs text-slate-400">{en ? 'Counter' : '计数器'}</span><RuleReferenceSelect kind="counter" value={node.key} onChange={key => set(i, { ...node, key })} /></div>
          <div className="grid grid-cols-2 gap-2"><RuleSelect label={en ? 'Lifetime' : '计数范围'} value={node.scope} options={[["turn", en ? 'Turn' : '本回合'], ["combat", en ? 'Combat' : '本场战斗']]} onChange={scope => set(i, { ...node, scope })} /><RuleSelect label={en ? 'Operation' : '操作'} value={node.operation} options={[["add", en ? 'Add' : '增加'], ["set", en ? 'Set' : '设为']]} onChange={operation => set(i, { ...node, operation })} /></div>
          <RuleValueEditor label={en ? 'Amount' : '数值'} value={node.value} onChange={value => set(i, { ...node, value })} />
        </>}
        {node.type === 'status' && <>
          <div className="space-y-1"><span className="text-xs text-slate-400">{en ? 'Custom status' : '自定义状态'}</span><RuleReferenceSelect kind="status" value={node.id} onChange={id => set(i, { ...node, id })} /></div>
          <div className="grid grid-cols-2 gap-2"><RuleSelect label={en ? 'Operation' : '操作'} value={node.operation} options={[["apply", en ? 'Apply' : '施加'], ["remove", en ? 'Consume' : '消耗']]} onChange={operation => set(i, { ...node, operation })} /><RuleSelect label={en ? 'Target' : '目标'} value={node.target} options={[["self", en ? 'Self' : '自身'], ["target", en ? 'Current target' : '当前目标'], ["all_enemies", en ? 'All enemies' : '全体敌人']]} onChange={target => set(i, { ...node, target })} /></div>
          <RuleValueEditor label={en ? 'Stacks' : '层数'} value={node.stacks} onChange={stacks => set(i, { ...node, stacks })} />
        </>}
        {node.type === 'select' && <SelectNode node={node} onChange={n => set(i, n)} />}
      </div>
    </Disclosure>)}
    <div className="flex gap-2"><select aria-label={en ? 'Rule type' : '规则类型'} className={selectCls} value={adding} onChange={e => setAdding(e.target.value as RuleNode['type'])}>{Object.entries(NODE_LABELS).filter(([type]) => depth + 1 < RULE_LIMITS.depth || !['if', 'repeat', 'random'].includes(type)).map(([type, text]) => <option key={type} value={type}>{text[en ? 1 : 0]}</option>)}</select><button className={smallButton + ' shrink-0'} onClick={() => { const node = defaultNode(adding); if (node.type === 'status') node.id = statuses[0]?.id ?? ''; onChange([...nodes, node]); requestAnimationFrame(() => { const row = listRef.current?.querySelector<HTMLDetailsElement>(`:scope > details[data-field="${CSS.escape(`${path}.${nodes.length}`)}"]`); if (row) { row.open = true; row.scrollIntoView({ block: 'nearest' }); row.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true }); } }); }}>{en ? 'Add rule' : '添加规则'}</button></div>
  </div>;
}

function ActionNode({ node, onChange }: { node: Extract<RuleNode, { type: 'action' }>; onChange: (next: Extract<RuleNode, { type: 'action' }>) => void }) {
  const lang = useLang(), en = lang === 'en';
  const runtime = useRuntimeCatalog(), vanilla = useVanillaCatalog();
  const cards = useStore(s => s.cards), meta = useStore(s => s.meta);
  const powerItems = useMemo(() => buildPowerCombo(lang, modPowers(runtime)), [lang, runtime]);
  const monsterItems = useMemo(() => buildMonsterCombo(lang, modMonsters(runtime)), [lang, runtime]);
  const cardItems = useMemo(() => buildSpawnCombo({ cards, excludeId: '', packId: meta?.pack_id ?? '', vanilla, runtime, lang }), [cards, meta?.pack_id, vanilla, runtime, lang]);
  const effect = node.effect;
  const patch = (p: Partial<EffectDef>) => onChange({ ...node, effect: { ...effect, ...p } as EffectDef });
  return <>
    <RuleSelect label={en ? 'Effect' : '效果种类'} value={effect.kind} options={[...new Set([...ACTIONS, effect.kind])].map(kind => [kind, pick(EFFECT_META[kind]?.label ?? { zh: kind, en: kind }, lang)])} onChange={kind => { const next = defaultEffect(kind); if (next) onChange({ ...node, effect: next }); }} />
    {'amount' in effect && <RuleValueEditor label={en ? 'Amount' : '效果数值'} value={node.amount ?? effect.amount ?? 1} onChange={amount => onChange({ ...node, amount })} />}
    {['damage', 'power'].includes(effect.kind) && <RuleSelect label={en ? 'Target' : '目标'} value={('target' in effect ? effect.target : undefined) ?? 'target'} options={[["target", en ? 'Current target' : '当前目标'], ["self", en ? 'Self' : '自身'], ["random_enemy", en ? 'Random enemy' : '随机敌人'], ["all_enemies", en ? 'All enemies' : '全体敌人']]} onChange={target => patch({ target } as Partial<EffectDef>)} />}
    {effect.kind === 'damage' && <Disclosure title={en ? `Attack settings · ${effect.hit_count ?? 1} hit(s)` : `攻击设置 · ${effect.hit_count ?? 1} 次`}><RuleNumber label={en ? 'Hits' : '攻击次数'} value={effect.hit_count ?? 1} min={1} max={100} onChange={hit_count => patch({ hit_count })} /></Disclosure>}
    {effect.kind === 'power' && <Combobox value={effect.power} items={powerItems} onChange={power => patch({ power })} searchPlaceholder={en ? 'Find power' : '搜索状态'} allowRaw />}
    {effect.kind === 'spawn' && <><Combobox value={effect.card_entry} items={cardItems} onChange={card_entry => patch({ card_entry })} searchPlaceholder={en ? 'Find card' : '搜索卡牌'} allowRaw /><RuleSelect label={en ? 'Destination' : '生成位置'} value={effect.pile ?? 'hand'} options={(['hand', 'draw', 'discard'] as const).map(pile => [pile, PILE_LABELS[pile][en ? 1 : 0]])} onChange={pile => patch({ pile })} /></>}
    {effect.kind === 'summon' && <><Combobox value={effect.monster} items={monsterItems} onChange={monster => patch({ monster })} searchPlaceholder={en ? 'Find monster' : '搜索敌人'} allowRaw /><RuleNumber label={en ? 'HP' : '生命'} value={effect.hp ?? 13} min={1} onChange={hp => patch({ hp })} /></>}
    {effect.kind === 'orb' && <RuleSelect label={en ? 'Orb' : '充能球'} value={effect.orb ?? 'random'} options={['random', 'lightning', 'frost', 'dark', 'plasma', 'glass'].map(orb => [orb, orb])} onChange={orb => patch({ orb })} />}
  </>;
}

function SelectNode({ node, onChange }: { node: Extract<RuleNode, { type: 'select' }>; onChange: (next: Extract<RuleNode, { type: 'select' }>) => void }) {
  const lang = useLang(), en = lang === 'en';
  const update = (index: number, op: CardOperation) => onChange({ ...node, operations: node.operations.map((old, i) => i === index ? op : old) });
  return <>
    <div className="grid grid-cols-2 gap-2"><RuleSelect label={en ? 'Source' : '来源牌堆'} value={node.from} options={Object.entries(PILE_LABELS).map(([id, labels]) => [id as typeof node.from, labels[en ? 1 : 0]])} onChange={from => onChange({ ...node, from })} /><RuleSelect label={en ? 'Selection' : '选择方式'} value={node.mode} options={[["choose", en ? 'Player choice' : '玩家选择'], ["random", en ? 'Random' : '随机选择'], ["all", en ? 'All matches' : '全部匹配']]} onChange={mode => onChange({ ...node, mode })} /></div>
    <RuleSelect label={en ? 'Card filter' : '卡牌类型'} value={node.card_type ?? ''} options={[["", en ? 'All types' : '全部类型'], ...Object.entries(TYPE_LABEL).map(([id, label]) => [id, pick(label, lang)] as [string, string])]} onChange={card_type => { const next = { ...node }; if (card_type) next.card_type = card_type; else delete next.card_type; onChange(next); }} />
    {node.mode !== 'all' && <RuleValueEditor label={en ? 'Count' : '选择数量'} value={node.count} onChange={count => onChange({ ...node, count })} />}
    {node.operations.map((op, i) => <div key={i} className="space-y-2 rounded border border-white/10 p-2">
      <RuleSelect label={`${en ? 'Operation' : '操作'} ${i + 1}`} value={op.type} options={[["move", en ? 'Move' : '移动'], ["copy", en ? 'Copy' : '复制'], ["exhaust", en ? 'Exhaust' : '消耗'], ["upgrade", en ? 'Upgrade' : '升级'], ["cost", en ? 'Adjust cost' : '调整费用']]} onChange={type => update(i, type === 'move' || type === 'copy' ? { type, pile: 'hand' } : type === 'cost' ? { type, amount: -1, duration: 'turn' } : { type })} />
      {(op.type === 'move' || op.type === 'copy') && <RuleSelect label={en ? 'Destination' : '目标牌堆'} value={op.pile} options={(['hand', 'draw', 'discard'] as const).map(pile => [pile, PILE_LABELS[pile][en ? 1 : 0]])} onChange={pile => update(i, { ...op, pile })} />}
      {op.type === 'cost' && <><RuleValueEditor label={en ? 'Cost adjustment' : '费用增减'} value={op.amount} onChange={amount => update(i, { ...op, amount })} /><RuleSelect label={en ? 'Duration' : '持续范围'} value={op.duration} options={[["turn", en ? 'This turn' : '本回合'], ["combat", en ? 'This combat' : '本场战斗']]} onChange={duration => update(i, { ...op, duration })} /></>}
      <button className={smallButton} onClick={() => onChange({ ...node, operations: node.operations.filter((_, j) => j !== i) })}>{en ? 'Remove operation' : '删除操作'}</button>
    </div>)}
    <button className={smallButton} onClick={() => onChange({ ...node, operations: [...node.operations, { type: 'move', pile: 'hand' }] })}>{en ? 'Add operation' : '添加操作'}</button>
  </>;
}

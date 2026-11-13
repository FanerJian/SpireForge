import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import { useLang } from '../../lib/i18n';
import type { EffectDef } from '../../lib/types';
import { bindProgramStatuses, countNodes, describeRules, emptyProgram, mergeStatuses, ruleProgram, RULE_LIMITS, RULE_TEMPLATES, type RuleProgram } from '../../lib/rules';
import { flattenRuleOutline } from '../../lib/ruleAuthoring';
import { Disclosure, inputCls, revealDisclosureAncestors } from '../ui';
import RuleNodeEditor from './RuleNodeEditor';
import RuleStatusEditor from './RuleStatusEditor';
import { RuleReferences, useRuleText, useRuleReferences, referenceText } from './RuleReferences';
import { confirmAction } from '../../lib/confirmation';

export default function RulesEditor({ effect, onChange, scope }: { effect: Extract<EffectDef, { kind: 'custom' }>; onChange: (patch: Partial<EffectDef>) => void; scope?: string }) {
  const en = useLang() === 'en';
  const meta = useStore(s => s.meta);
  const program = ruleProgram(effect.params);
  if (!program) return <div className="space-y-2"><p role="alert" className="sf-muted">{en ? 'Open a supported rule format to edit.' : '请使用当前规则格式编辑。'}</p><button className="sf-button" onClick={async () => { if (await confirmAction(en ? 'Create an empty rule program?' : '创建空白规则？')) onChange({ params: emptyProgram() as unknown as Record<string, unknown> }); }}>{en ? 'Create blank rules' : '创建空白规则'}</button></div>;
  const statuses = mergeStatuses(program.statuses, meta?.rule_statuses ?? []);
  return <RuleWorkspace program={program} statuses={statuses} path={`${scope ?? 'rules'}.params.nodes`} onChange={next => onChange({ params: { ...effect.params, ...bindProgramStatuses(next, meta?.rule_statuses ?? []) } })} />;
}

function RuleWorkspace({ program, statuses, path, onChange }: { program: RuleProgram; statuses: RuleProgram['statuses']; path: string; onChange: (program: RuleProgram) => void }) {
  const [section, setSection] = useState<'rules' | 'statuses' | 'templates'>('rules');
  return <RuleReferences nodes={program.nodes} statuses={statuses} openStatuses={() => setSection('statuses')}><WorkspaceContent program={program} statuses={statuses} path={path} onChange={onChange} section={section} setSection={setSection} /></RuleReferences>;
}

function WorkspaceContent({ program, statuses, path, onChange, section, setSection }: {
  program: RuleProgram; statuses: RuleProgram['statuses']; path: string; onChange: (program: RuleProgram) => void;
  section: 'rules' | 'statuses' | 'templates'; setSection: (section: 'rules' | 'statuses' | 'templates') => void;
}) {
  const en = useLang() === 'en', text = useRuleText();
  const references = useRuleReferences();
  const templateText = (source: RuleProgram) => referenceText(describeRules(source.nodes, en, mergeStatuses(source.statuses, statuses)), en, { ...references, statuses: mergeStatuses(source.statuses, statuses) });
  const meta = useStore(s => s.meta), updateMeta = useStore(s => s.updateMeta), toast = useStore(s => s.showToast);
  const [template, setTemplate] = useState(RULE_TEMPLATES[0].id), [templateName, setTemplateName] = useState('');
  const [expanded, setExpanded] = useState(false);
  const workspace = useRef<HTMLDivElement>(null), ruleContent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement as HTMLElement | null;
    workspace.current?.querySelector('button')?.focus();
    const close = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if ((event.ctrlKey || event.metaKey) && !target?.closest('input,textarea,[contenteditable="true"]') && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault(); event.stopPropagation();
        const state = useStore.getState();
        if (event.key.toLowerCase() === 'z' && !event.shiftKey) void state.undo(); else void state.redo();
      }
      if (event.key === 'Escape' && !useStore.getState().historyBusy) { event.stopPropagation(); setExpanded(false); }
      if (event.key === 'Tab') {
        const controls = [...(workspace.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary') ?? [])].filter(control => control.getClientRects().length && !control.closest('[hidden]'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !workspace.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !workspace.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('keydown', close); previous?.focus(); };
  }, [expanded]);
  const templates = [...RULE_TEMPLATES.map(t => ({ id: t.id, name: t.label[en ? 1 : 0], program: t.program })), ...(meta?.rule_templates ?? []).map(t => ({ ...t, id: `saved:${t.id}` }))];
  const selected = templates.find(t => t.id === template) ?? templates[0];
  const insert = () => {
    if (!selected) return;
    const copy = JSON.parse(JSON.stringify(selected.program)) as RuleProgram;
    onChange({ ...program, nodes: [...program.nodes, ...copy.nodes], statuses: mergeStatuses(copy.statuses, program.statuses) });
    setSection('rules');
    toast(en ? 'Template added' : '已添加模板');
  };
  const saveTemplate = async () => {
    if (!templateName.trim() || !meta) return;
    try {
      await updateMeta({ format_version: 3, rule_templates: [...(useStore.getState().meta?.rule_templates ?? []), { id: crypto.randomUUID(), name: templateName.trim(), program: bindProgramStatuses(program, meta.rule_statuses ?? []) }] });
      setTemplateName(''); toast(en ? 'Template saved' : '模板已保存');
    } catch (error) { toast(String(error)); }
  };
  const executable = bindProgramStatuses(program, meta?.rule_statuses ?? []);
  const count = countNodes(executable.nodes) + executable.statuses.reduce((sum, status) => sum + countNodes(status.nodes), 0);
  const outline = flattenRuleOutline(program.nodes);
  const jump = (nodePath: string) => {
    const element = ruleContent.current?.querySelector<HTMLElement>(`[data-field="${CSS.escape(`${path}.${nodePath}`)}"]`);
    if (!element) return;
    revealDisclosureAncestors(element);
    requestAnimationFrame(() => { element.scrollIntoView({ block: 'center', behavior: 'smooth' }); element.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true }); });
  };
  const conflicts = selected?.program.statuses.filter(s => statuses.some(current => current.id === s.id && JSON.stringify(current) !== JSON.stringify(s))) ?? [];
  return <>{expanded && <div className="fixed inset-0 z-40 bg-black/60" aria-hidden="true" />}<div ref={workspace} className="sf-rule-workspace" data-expanded={expanded} data-rules-editor data-editor-modal={expanded ? true : undefined} role={expanded ? 'dialog' : undefined} aria-modal={expanded ? true : undefined} aria-label={en ? 'Rule workspace' : '规则工作台'}>
    <div className="flex items-center justify-between gap-3"><div><span className="text-sm font-medium">{en ? 'Rule workspace' : '规则工作台'}</span><span className="ml-3 text-xs text-slate-500">{en ? `${program.nodes.length} steps` : `${program.nodes.length} 个步骤`}</span></div><button className="sf-button" onClick={() => setExpanded(!expanded)}>{expanded ? en ? 'Exit focus' : '退出专注' : en ? 'Focus mode' : '专注编辑'}</button></div>
    <div className="sf-rule-tabs" role="tablist" aria-label={en ? 'Rule sections' : '规则分区'}>{([['rules', en ? 'Rules' : '规则'], ['statuses', en ? 'Custom statuses' : '自定义状态'], ['templates', en ? 'Templates' : '模板']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)}>{label}{id === 'statuses' && statuses.length > 0 ? ` · ${statuses.length}` : ''}</button>)}</div>
    <div className="sf-rule-body">
      <div hidden={section !== 'rules'}>
        <div className="sf-rule-layout">
          <nav className="sf-rule-outline" aria-label={en ? 'Rule outline' : '规则结构'}><p className="sf-section-label mb-3">{en ? 'EXECUTION ORDER' : '执行顺序'}</p>{outline.map(item => <button key={item.path} className="sf-outline-item" style={{ paddingLeft: 6 + item.depth * 12, opacity: item.node.enabled === false ? .5 : 1 }} onClick={() => jump(item.path)}><span className="mr-2 text-[10px] text-slate-500">{item.branch === 'then' ? en ? 'IF' : '满足' : item.branch === 'else' ? en ? 'ELSE' : '否则' : item.path.split('.').pop() ? Number(item.path.split('.').pop()) + 1 : ''}</span>{text.node(item.node)}</button>)}{outline.length === 0 && <p className="sf-muted">{en ? 'Add a rule to begin.' : '添加规则后显示结构。'}</p>}</nav>
          <div ref={ruleContent} className="min-w-0 space-y-3">
            {program.nodes.length === 0 && <div className="sf-empty space-y-3"><p className="text-sm">{en ? 'Start with a rule template' : '从模板开始设计'}</p><p className="sf-muted">{en ? 'Build conditions, combos, and status effects step by step.' : '选择现成组合，再调整条件、数值与状态。'}</p><button className="sf-button sf-button-primary" onClick={() => setSection('templates')}>{en ? 'Browse templates' : '选择模板'}</button></div>}
            <RuleNodeEditor nodes={program.nodes} onChange={nodes => onChange({ ...program, nodes })} statuses={statuses} path={path} />
            {program.nodes.length > 0 && <Disclosure title={en ? 'Execution summary' : '执行概要'} defaultOpen><p className="sf-rule-summary sf-readable">{text.nodes(program.nodes) || (en ? 'All rules are paused.' : '全部规则已暂停。')}</p></Disclosure>}
            {count > RULE_LIMITS.nodes * .8 && <p role="status" className="sf-muted">{en ? 'Rule capacity' : '规则容量'} {count} / {RULE_LIMITS.nodes}</p>}
          </div>
        </div>
      </div>
      <div hidden={section !== 'statuses'}><RuleStatusEditor statuses={statuses} onUse={status => { onChange({ ...program, statuses: mergeStatuses(program.statuses, [status]), nodes: [...program.nodes, { type: 'status', id: status.id, operation: 'apply', target: 'target', stacks: 1 }] }); setSection('rules'); }} /></div>
      <div hidden={section !== 'templates'} className="space-y-4">
        <p className="sf-muted">{en ? 'Preview a template, then append it to the current rules.' : '选择模板查看效果，添加后可继续调整。'}</p>
        <div className="sf-template-grid">{templates.map(t => <button key={t.id} className="sf-template-card" aria-pressed={t.id === selected?.id} onClick={() => setTemplate(t.id)}><strong>{t.name}</strong><span>{templateText(t.program).split('\n')[0]}</span></button>)}</div>
        {selected && <><p className="sf-rule-summary sf-readable">{templateText(selected.program)}</p>{conflicts.length > 0 && <p className="sf-muted">{en ? 'Uses the current definitions for: ' : '沿用当前状态定义：'}{conflicts.map(s => statuses.find(current => current.id === s.id)?.name[en ? 'eng' : 'zhs'] || s.id).join('、')}</p>}<button className="sf-button sf-button-primary" onClick={insert}>{en ? 'Add template' : '添加此模板'}</button></>}
        <Disclosure title={en ? 'Save as template' : '保存为模板'}><div className="flex gap-2"><input aria-label={en ? 'Template name' : '模板名称'} className={inputCls} value={templateName} placeholder={en ? 'Template name' : '模板名称'} onChange={e => setTemplateName(e.target.value)} /><button disabled={!templateName.trim() || program.nodes.length === 0} onClick={() => void saveTemplate()} className="sf-button">{en ? 'Save template' : '保存模板'}</button></div></Disclosure>
      </div>
    </div>
  </div></>;
}

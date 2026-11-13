import { useMemo, useState, useSyncExternalStore } from 'react';
import { useStore } from '../../lib/store';
import { useLang } from '../../lib/i18n';
import { defaultStatus, mergeStatuses, type RuleStatus } from '../../lib/rules';
import { nextStatusId } from '../../lib/ruleAuthoring';
import { statusDraftSession } from '../../lib/statusDraftSession';
import { Disclosure, inputCls } from '../ui';
import { Combobox } from '../Combobox';
import { buildPowerCombo, modPowers, useRuntimeCatalog } from './catalogs';
import RuleNodeEditor from './RuleNodeEditor';
import { RuleNumber, RuleSelect, RuleText } from './RuleValueEditor';
import { RuleReferences } from './RuleReferences';
import { confirmAction } from '../../lib/confirmation';

export default function RuleStatusEditor({ statuses, onUse }: { statuses: RuleStatus[]; onUse: (status: RuleStatus) => void }) {
  const lang = useLang(), en = lang === 'en', locale = en ? 'eng' : 'zhs';
  const meta = useStore(s => s.meta), projectRoot = useStore(s => s.projectRoot), updateMeta = useStore(s => s.updateMeta), toast = useStore(s => s.showToast);
  const session = useMemo(() => statusDraftSession(projectRoot ?? ''), [projectRoot]);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const activeId = snapshot.activeId, entry = activeId ? snapshot.drafts[activeId] : undefined, draft = entry?.status;
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const runtime = useRuntimeCatalog();
  const icons = useMemo(() => buildPowerCombo(lang, modPowers(runtime)), [lang, runtime]);
  const available = mergeStatuses(statuses, Object.values(snapshot.drafts).map(d => d.status));
  const patch = (value: Partial<RuleStatus>) => { if (activeId) session.patch(activeId, value); };
  const add = () => { setError(''); session.open(defaultStatus(nextStatusId(available)), true); };
  const save = async (use = false) => {
    if (!draft || !meta || !activeId || busy) return;
    if (!draft.name[locale].trim()) { setError(en ? 'Enter a status name.' : '请填写状态名称。'); return; }
    if (entry?.creating && statuses.some(s => s.id === draft.id)) { setError(en ? 'This status ID is already in use. Create a new draft.' : '该状态标识已被使用，请新建草稿。'); return; }
    const selectedId = useStore.getState().selectedId;
    setBusy(true); setError('');
    try {
      const merged = mergeStatuses(statuses, useStore.getState().meta?.rule_statuses ?? []);
      await updateMeta({ format_version: 3, rule_statuses: mergeStatuses(merged, [draft]) });
      session.finishSave(activeId, draft);
      if (use && useStore.getState().projectRoot === projectRoot && useStore.getState().selectedId === selectedId) onUse(draft);
      toast(en ? 'Status saved' : '状态已保存');
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  return <fieldset disabled={busy} className="space-y-4">
    <div className="flex items-center justify-between gap-4"><p className="sf-muted">{en ? 'Statuses are shared across cards in this pack.' : '状态供当前卡包的所有卡牌共同引用。'}</p><button onClick={add} className="sf-button">{en ? 'New status' : '新建状态'}</button></div>
    <div className="sf-status-layout">
      <div className="sf-status-list">{available.map(status => <button key={status.id} aria-pressed={activeId === status.id} className="sf-button justify-start" onClick={() => { session.open(status); setError(''); }}><span>{status.name[locale] || status.name.zhs || status.name.eng || status.id}</span>{snapshot.drafts[status.id] && <span className="text-[10px] text-amber-300">{en ? 'Draft' : '草稿'}</span>}</button>)}</div>
      <div className="min-w-0">
        {error && <p role="alert" className="mb-3 text-xs text-amber-300">{error}</p>}
        {!draft && <div className="sf-empty space-y-2"><p className="text-sm">{en ? 'Design a shared status' : '设计共享状态'}</p><p className="sf-muted">{en ? 'Set its name, trigger, and rules. Then apply it from any card.' : '设置名称、触发时机和效果，再将状态添加到卡牌规则。'}</p>{available.length === 0 && <button className="sf-button sf-button-primary" onClick={add}>{en ? 'Create status' : '创建状态'}</button>}</div>}
        {draft && <div className="space-y-4" key={activeId}>
          <RuleText label={en ? 'Status name' : '状态名称'} value={draft.name[locale]} onChange={name => patch({ name: { ...draft.name, [locale]: name } })} />
          <label className="block space-y-1 text-xs text-slate-400"><span>{en ? 'Description · {Amount} shows stacks' : '状态描述 · {Amount} 显示层数'}</span><textarea className={inputCls + ' min-h-16'} value={draft.description[locale]} onChange={e => patch({ description: { ...draft.description, [locale]: e.target.value } })} /></label>
          <div className="grid grid-cols-2 gap-3"><RuleSelect label={en ? 'Trigger' : '触发时机'} value={draft.trigger} options={[["turn_start", en ? 'Owner turn start' : '拥有者回合开始'], ["turn_end", en ? 'Owner turn end' : '拥有者回合结束'], ["after_play", en ? 'Owner plays a card' : '拥有者打出卡牌后'], ["after_attack", en ? 'Owner completes an attack' : '拥有者攻击完成后']]} onChange={trigger => patch({ trigger })} /><RuleSelect label={en ? 'Stacking' : '叠层方式'} value={draft.stacking} options={[["add", en ? 'Add stacks' : '累加层数'], ["replace", en ? 'Replace stacks' : '替换层数'], ["max", en ? 'Keep larger value' : '取较大值']]} onChange={stacking => patch({ stacking })} /></div>
          <div className="space-y-2"><p className="sf-section-label">{en ? 'TRIGGERED RULES' : '触发后执行'}</p><RuleReferences nodes={draft.nodes} statuses={mergeStatuses(statuses, [draft])}><RuleNodeEditor nodes={draft.nodes} onChange={nodes => patch({ nodes })} statuses={mergeStatuses(statuses, [draft])} path={`rule_statuses.${draft.id}.nodes`} /></RuleReferences></div>
          <Disclosure title={en ? 'Limits and decay' : '层数与触发限制'}>
            <div className="grid grid-cols-2 gap-3"><RuleNumber label={en ? 'Maximum stacks' : '层数上限'} value={draft.max_stacks} min={1} onChange={max_stacks => patch({ max_stacks })} /><RuleNumber label={en ? 'Decay at owner turn end' : '拥有者回合末衰减'} value={draft.decay} min={0} onChange={decay => patch({ decay })} /></div>
            <RuleNumber label={en ? 'Maximum triggers per turn' : '每回合触发上限'} value={draft.max_triggers_per_turn} min={1} max={100} onChange={max_triggers_per_turn => patch({ max_triggers_per_turn })} />
          </Disclosure>
          <Disclosure title={en ? 'Icon and translations' : '图标与翻译'}>
            <div className="space-y-1"><span className="text-xs text-slate-400">{en ? 'Status icon' : '状态图标'}</span><Combobox widthClass="w-full" value={draft.icon} items={icons} searchPlaceholder={en ? 'Find an icon' : '搜索图标'} allowRaw onChange={icon => patch({ icon })} /></div>
            <RuleText label={en ? 'Chinese name' : '英文名称'} value={draft.name[en ? 'zhs' : 'eng']} onChange={name => patch({ name: { ...draft.name, [en ? 'zhs' : 'eng']: name } })} />
            <label className="block space-y-1 text-xs text-slate-400"><span>{en ? 'Chinese description' : '英文描述'}</span><textarea className={inputCls} value={draft.description[en ? 'zhs' : 'eng']} onChange={e => patch({ description: { ...draft.description, [en ? 'zhs' : 'eng']: e.target.value } })} /></label>
            <RuleText label={en ? 'Generated ID' : '自动生成的标识'} value={draft.id} readOnly onChange={() => {}} />
          </Disclosure>
          <div className="flex flex-wrap gap-2"><button onClick={() => void save(true)} className="sf-button sf-button-primary">{en ? 'Save and use' : '保存并引用'}</button><button onClick={() => void save()} className="sf-button">{en ? 'Save status' : '保存状态'}</button><button onClick={() => session.activate(null)} className="sf-button">{en ? 'Keep draft' : '保留草稿'}</button><button className="sf-link ml-auto" onClick={async () => { if (activeId && await confirmAction(en ? 'Discard this status draft?' : '放弃此状态草稿？')) session.discard(activeId); }}>{en ? 'Discard draft' : '放弃草稿'}</button></div>
          <p className="sf-muted">{en ? 'Drafts remain available while the editor is open. Save to apply changes to the pack.' : '本次使用期间可随时返回草稿。保存后应用到卡包。'}</p>
        </div>}
      </div>
    </div>
  </fieldset>;
}

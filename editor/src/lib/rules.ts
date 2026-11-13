import type { EffectDef, LocText } from './types';
import { defaultEffect } from './effects';
import { POWER_ZH } from './powers';

export const RULES_VERSION = 1;
export const RULE_LIMITS = { depth: 8, nodes: 256, repeat: 100, steps: 512 } as const;
export const VALUE_SOURCES = {
  self_hp: ['当前生命', 'Current HP'], self_max_hp: ['生命上限', 'Max HP'],
  self_missing_hp: ['已损失生命', 'Missing HP'], self_block: ['当前格挡', 'Block'],
  hand_count: ['手牌张数', 'Hand size'], draw_count: ['抽牌堆张数', 'Draw pile size'],
  discard_count: ['弃牌堆张数', 'Discard pile size'], exhaust_count: ['消耗牌堆张数', 'Exhaust pile size'],
  enemy_count: ['敌人数量', 'Enemy count'], x: ['本次 X 值', 'Energy X'], upgrade: ['升级次数', 'Upgrade level'],
  counter: ['自定义计数器', 'Counter'], status_stacks: ['自定义状态层数', 'Custom status stacks'],
  power_stacks: ['游戏状态层数', 'Game power stacks'],
} as const;
export type ValueSource = keyof typeof VALUE_SOURCES;
export type RuleValue = number | { source: ValueSource; key?: string; scope?: 'turn' | 'combat'; subject?: 'self' | 'target'; factor?: number; offset?: number; min?: number; max?: number; rounding?: 'floor' | 'ceil' | 'round' };
export interface RuleCondition { left: RuleValue; op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; right: RuleValue }
export type CardOperation = { type: 'move' | 'copy'; pile: 'hand' | 'draw' | 'discard' } | { type: 'exhaust' | 'upgrade' } | { type: 'cost'; amount: RuleValue; duration: 'turn' | 'combat' };
export type RuleNode = { enabled?: boolean } & (
  { type: 'action'; effect: EffectDef; amount?: RuleValue } |
  { type: 'if'; match: 'all' | 'any'; conditions: RuleCondition[]; then: RuleNode[]; else: RuleNode[] } |
  { type: 'repeat' | 'random'; count: RuleValue; nodes: RuleNode[] } |
  { type: 'counter'; key: string; scope: 'turn' | 'combat'; operation: 'set' | 'add'; value: RuleValue } |
  { type: 'status'; id: string; operation: 'apply' | 'remove'; target: 'self' | 'target' | 'all_enemies'; stacks: RuleValue } |
  { type: 'select'; from: 'hand' | 'draw' | 'discard' | 'exhaust'; mode: 'choose' | 'random' | 'all'; card_type?: string; count: RuleValue; operations: CardOperation[] }
);
export interface RuleStatus {
  id: string; name: LocText; description: LocText; icon: string;
  stacking: 'add' | 'replace' | 'max'; max_stacks: number; decay: number;
  trigger: 'turn_start' | 'turn_end' | 'after_play' | 'after_attack'; max_triggers_per_turn: number; nodes: RuleNode[];
}
export interface RuleProgram { rules_version: 1; nodes: RuleNode[]; statuses: RuleStatus[] }
export const NODE_LABELS: Record<RuleNode['type'], readonly [string, string]> = {
  action: ['执行效果', 'Effect'], if: ['条件分支', 'Condition'], repeat: ['重复执行', 'Repeat'],
  random: ['随机选取', 'Random'], counter: ['修改计数器', 'Counter'], status: ['施加 / 消耗状态', 'Status'], select: ['选牌与操作', 'Select cards'],
};
export const PILE_LABELS = { hand: ['手牌', 'Hand'], draw: ['抽牌堆', 'Draw pile'], discard: ['弃牌堆', 'Discard pile'], exhaust: ['消耗牌堆', 'Exhaust pile'] } as const;
export function ruleProgram(params?: Record<string, unknown>): RuleProgram | null {
  return params?.rules_version === 1 && Array.isArray(params.nodes) && Array.isArray(params.statuses)
    ? params as unknown as RuleProgram : null;
}
export function emptyProgram(): RuleProgram { return { rules_version: 1, nodes: [], statuses: [] }; }
export function rulesEffect(program = emptyProgram()): EffectDef { return { kind: 'custom', handler: 'sf_rules', params: program as unknown as Record<string, unknown> }; }
export function defaultNode(type: RuleNode['type']): RuleNode {
  switch (type) {
    case 'action': return { type, effect: defaultEffect('damage')! };
    case 'if': return { type, match: 'all', conditions: [{ left: { source: 'self_hp' }, op: 'lt', right: 30 }], then: [], else: [] };
    case 'repeat': case 'random': return { type, count: type === 'repeat' ? 2 : 1, nodes: [] };
    case 'counter': return { type, key: 'combo', scope: 'turn', operation: 'add', value: 1 };
    case 'status': return { type, id: 'spark', operation: 'apply', target: 'target', stacks: 1 };
    case 'select': return { type, from: 'discard', mode: 'choose', count: 1, operations: [{ type: 'move', pile: 'hand' }] };
  }
}
export function defaultStatus(id: string): RuleStatus {
  return { id, name: { zhs: '新状态', eng: 'New status' }, description: { zhs: '层数：{Amount}', eng: 'Stacks: {Amount}' }, icon: 'Strength', stacking: 'add', max_stacks: 99, decay: 1, trigger: 'turn_end', max_triggers_per_turn: 1, nodes: [] };
}
export function mergeStatuses(snapshot: RuleStatus[], shared: RuleStatus[]): RuleStatus[] {
  return [...new Map([...snapshot, ...shared].map(status => [status.id, status])).values()];
}
/** 只带入程序实际使用的共享状态；独立导入的定义保留在可移植快照中。 */
export function bindProgramStatuses(program: RuleProgram, shared: RuleStatus[]): RuleProgram {
  const catalog = mergeStatuses(program.statuses, shared);
  const sharedIds = new Set(shared.map(status => status.id));
  const needed = new Set(program.statuses.filter(status => !sharedIds.has(status.id)).map(status => status.id));
  const references = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(references); return; }
    const item = value as Record<string, unknown>;
    if (item.type === 'status' && typeof item.id === 'string') needed.add(item.id);
    if (item.source === 'status_stacks' && typeof item.key === 'string') needed.add(item.key);
    Object.values(item).forEach(references);
  };
  references(program.nodes);
  const visited = new Set<string>();
  for (const id of needed) {
    if (visited.has(id)) continue;
    visited.add(id);
    const status = catalog.find(entry => entry.id === id);
    if (status) references(status.nodes);
  }
  return { ...program, statuses: catalog.filter(status => needed.has(status.id)) };
}
export function moveNode(nodes: RuleNode[], index: number, offset: number): RuleNode[] {
  const target = index + offset;
  if (index < 0 || index >= nodes.length || target < 0 || target >= nodes.length) return nodes;
  const next = [...nodes]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
export function cloneNode(node: RuleNode): RuleNode { return JSON.parse(JSON.stringify(node)) as RuleNode; }
export function countNodes(nodes: RuleNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + (node.type === 'if' ? countNodes(node.then) + countNodes(node.else) : node.type === 'repeat' || node.type === 'random' ? countNodes(node.nodes) : 0), 0);
}
export function valueText(value: RuleValue, en = false, statuses: RuleStatus[] = []): string {
  if (typeof value === 'number') return String(value);
  const base = VALUE_SOURCES[value.source]?.[en ? 1 : 0] ?? value.source;
  let key = value.key;
  if (value.source === 'status_stacks') {
    const status = statuses.find(status => status.id === key);
    key = status?.name[en ? 'eng' : 'zhs'] || status?.name[en ? 'zhs' : 'eng'] || key;
  } else if (value.source === 'power_stacks' && !en && key && Object.prototype.hasOwnProperty.call(POWER_ZH, key)) {
    key = POWER_ZH[key];
  }
  let result = `${value.subject === 'target' ? en ? 'target total ' : '目标合计' : ''}${base}${key ? `「${key}」` : ''}`;
  if (value.source === 'counter') result += value.scope === 'turn' ? en ? ' (turn)' : '（本回合）' : en ? ' (combat)' : '（本场战斗）';
  if (value.factor != null && value.factor !== 1) result += ` × ${value.factor}`;
  if (value.offset) result += value.offset < 0 ? ` − ${-value.offset}` : ` + ${value.offset}`;
  if (value.min != null) result += en ? `, minimum ${value.min}` : `，至少 ${value.min}`;
  if (value.max != null) result += en ? `, maximum ${value.max}` : `，至多 ${value.max}`;
  return result;
}
const OPS = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' };
const ACTION_LABELS: Record<string, [string, string]> = { damage: ['造成伤害', 'Deal damage'], block: ['获得格挡', 'Gain Block'], draw: ['抽牌', 'Draw'], energy: ['获得能量', 'Gain energy'], heal: ['回复生命', 'Heal'], power: ['施加状态', 'Apply power'], discard: ['弃牌', 'Discard'], exhaust: ['消耗牌', 'Exhaust'], gold: ['获得金币', 'Gain gold'], lose_hp: ['失去生命', 'Lose HP'], max_hp: ['提高生命上限', 'Gain max HP'], spawn: ['生成卡牌', 'Create card'], summon: ['召唤敌人', 'Summon'], orb: ['生成充能球', 'Channel orb'], orb_slot: ['调整充能球栏位', 'Change orb slots'], vfx: ['播放特效', 'Play VFX'], delayed: ['延迟效果', 'Delayed effect'], custom: ['扩展效果', 'Custom effect'] };
export function describeRules(nodes: RuleNode[], en = false, statuses: RuleStatus[] = [], depth = 0): string {
  if (depth > RULE_LIMITS.depth) return en ? 'Nesting limit reached.' : '已达到嵌套上限。';
  const nested = (items: RuleNode[]) => describeRules(items, en, statuses, depth + 1).split('\n').map(line => `  ${line}`).join('\n');
  return nodes.filter(n => n.enabled !== false).map(node => {
    switch (node.type) {
      case 'action': {
        const effect = node.effect as EffectDef & { amount?: number; power?: string; card_entry?: string; monster?: string; target?: string };
        const amount = node.amount ?? effect.amount;
        const target = effect.target === 'self' ? en ? ' to self' : '（自身）' : effect.target === 'all_enemies' ? en ? ' to all enemies' : '（全体敌人）' : '';
        const reference = effect.power || effect.card_entry || effect.monster;
        const name = effect.power && !en && Object.prototype.hasOwnProperty.call(POWER_ZH, effect.power) ? POWER_ZH[effect.power] : reference;
        return `${ACTION_LABELS[effect.kind]?.[en ? 1 : 0] ?? effect.kind}${amount != null ? ` ${valueText(amount, en, statuses)}` : ''}${name ? `「${name}」` : ''}${target}`;
      }
      case 'if': return `${en ? 'If ' : '如果'}${node.conditions.map(c => `${valueText(c.left, en, statuses)} ${OPS[c.op]} ${valueText(c.right, en, statuses)}`).join(node.match === 'any' ? en ? ' or ' : ' 或 ' : en ? ' and ' : ' 且 ')}：\n${nested(node.then)}${node.else.length ? `\n${en ? 'Otherwise' : '否则'}：\n${nested(node.else)}` : ''}`;
      case 'repeat': case 'random': return `${NODE_LABELS[node.type][en ? 1 : 0]} ${valueText(node.count, en, statuses)}${en ? ':' : node.type === 'repeat' ? ' 次：' : ' 项：'}\n${nested(node.nodes)}`;
      case 'counter': return `${en ? 'Counter' : '计数器'}「${node.key}」${node.operation === 'set' ? ' = ' : ' + '}${valueText(node.value, en, statuses)}`;
      case 'status': { const status = statuses.find(s => s.id === node.id); return `${node.operation === 'apply' ? en ? 'Apply' : '施加' : en ? 'Consume' : '消耗'} ${valueText(node.stacks, en, statuses)} ${en ? 'stacks of' : '层'}「${status?.name[en ? 'eng' : 'zhs'] || node.id}」`; }
      case 'select': return `${en ? 'Select' : '从'} ${PILE_LABELS[node.from][en ? 1 : 0]} ${node.mode === 'all' ? en ? 'all' : '全部' : valueText(node.count, en, statuses)} ${node.card_type || ''}${en ? ' cards' : '张牌'}：${node.operations.map(op => op.type === 'move' || op.type === 'copy' ? `${op.type === 'move' ? en ? 'move to' : '移至' : en ? 'copy to' : '复制至'}${PILE_LABELS[op.pile][en ? 1 : 0]}` : op.type === 'cost' ? `${en ? 'cost adjustment' : '费用调整'} ${valueText(op.amount, en, statuses)}${op.duration === 'turn' ? en ? ' this turn' : '（本回合）' : en ? ' this combat' : '（本场战斗）'}` : op.type === 'upgrade' ? en ? 'upgrade' : '升级' : en ? 'exhaust' : '消耗').join('，')}`;
    }
  }).join('\n');
}
export const RULE_TEMPLATES: { id: string; label: readonly [string, string]; program: RuleProgram }[] = [
  { id: 'branch', label: ['易伤追击', 'Vulnerable follow-up'], program: { ...emptyProgram(), nodes: [{ type: 'action', effect: { kind: 'damage', amount: 8, props: ['Move'] } }, { type: 'if', match: 'all', conditions: [{ left: { source: 'power_stacks', subject: 'target', key: 'Vulnerable' }, op: 'gt', right: 0 }], then: [{ type: 'action', effect: { kind: 'damage', amount: 4, props: ['Move'] } }, { type: 'action', effect: { kind: 'draw', amount: 1 } }], else: [{ type: 'action', effect: { kind: 'power', amount: 2, power: 'Vulnerable' } }] }] } },
  { id: 'block', label: ['格挡转伤害', 'Block as damage'], program: { ...emptyProgram(), nodes: [{ type: 'action', effect: { kind: 'damage', amount: 0, props: ['Move'] }, amount: { source: 'self_block' } }] } },
  { id: 'combo', label: ['三次连击', 'Every third play'], program: { ...emptyProgram(), nodes: [{ type: 'counter', key: 'combo', scope: 'turn', operation: 'add', value: 1 }, { type: 'if', match: 'all', conditions: [{ left: { source: 'counter', key: 'combo', scope: 'turn' }, op: 'gte', right: 3 }], then: [{ type: 'action', effect: { kind: 'draw', amount: 1 } }, { type: 'counter', key: 'combo', scope: 'turn', operation: 'set', value: 0 }], else: [] }] } },
  { id: 'retrieve', label: ['回收攻击牌', 'Retrieve an attack'], program: { ...emptyProgram(), nodes: [{ type: 'select', from: 'discard', mode: 'choose', card_type: 'Attack', count: 1, operations: [{ type: 'move', pile: 'hand' }, { type: 'cost', amount: -1, duration: 'turn' }] }] } },
  { id: 'spark', label: ['星火状态', 'Spark status'], program: { rules_version: 1, statuses: [{ ...defaultStatus('spark'), name: { zhs: '星火', eng: 'Spark' }, icon: 'Poison', nodes: [{ type: 'action', effect: { kind: 'damage', amount: 0, props: ['Unpowered'] }, amount: { source: 'status_stacks', key: 'spark', subject: 'target' } }] }], nodes: [{ type: 'status', id: 'spark', target: 'target', operation: 'apply', stacks: 3 }] } },
];

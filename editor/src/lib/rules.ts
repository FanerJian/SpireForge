import type { EffectDef, LocText } from './types';
import { defaultEffect } from './effects';
import { effectSentence, type DescriptionContext } from './effectText';
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
  const status = value.source === 'status_stacks' ? statuses.find(s => s.id === value.key) : undefined;
  const key = status?.name[en ? 'eng' : 'zhs'] || status?.name[en ? 'zhs' : 'eng']
    || (value.source === 'power_stacks' && !en && value.key && Object.prototype.hasOwnProperty.call(POWER_ZH, value.key) ? POWER_ZH[value.key] : value.key);
  const stacks = value.source === 'status_stacks' || value.source === 'power_stacks';
  let result = stacks
    ? en ? `${value.subject === 'target' ? 'total target' : 'your'} 「${key ?? '?'}」 stacks` : `${value.subject === 'target' ? '目标合计' : '自身'}「${key ?? '?'}」层数`
    : value.source === 'counter' ? `${en ? 'Counter' : '计数器'}「${key ?? '?'}」`
    : `${value.source.startsWith('self_') ? en ? 'your ' : '自身' : ''}${base}`;
  if (value.source === 'counter') result += value.scope === 'turn' ? en ? ' (turn)' : '（本回合）' : en ? ' (combat)' : '（本场战斗）';
  if (value.factor != null && value.factor !== 1) result += ` × ${value.factor}`;
  if (value.offset) result += value.offset < 0 ? ` − ${-value.offset}` : ` + ${value.offset}`;
  if (value.rounding || !Number.isInteger(value.factor ?? 1) || !Number.isInteger(value.offset ?? 0)) {
    const rounding = value.rounding ?? 'floor';
    result = `${en ? { floor: 'floor', ceil: 'ceil', round: 'round (ties away from zero)' }[rounding] : { floor: '向下取整', ceil: '向上取整', round: '四舍五入（中点远离零）' }[rounding]}（${result}）`;
  }
  if (value.min != null) result += en ? `, minimum ${value.min}` : `，至少 ${value.min}`;
  if (value.max != null) result += en ? `, maximum ${value.max}` : `，至多 ${value.max}`;
  return result;
}
const OPS = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' };
const CARD_NAMES: Record<string, readonly [string, string]> = { Attack: ['攻击牌', 'Attack cards'], Skill: ['技能牌', 'Skill cards'], Power: ['能力牌', 'Power cards'], Status: ['状态牌', 'Status cards'], Curse: ['诅咒牌', 'Curse cards'], Quest: ['任务牌', 'Quest cards'] };

/** Shared sentences preserve effect parameters; rule expressions replace only the amount slot. */
function actionText(node: Extract<RuleNode, { type: 'action' }>, en: boolean, statuses: RuleStatus[], context: DescriptionContext): string {
  const dynamic = node.amount != null && typeof node.amount !== 'number';
  const effect = typeof node.amount === 'number' && 'amount' in node.effect ? { ...node.effect, amount: node.amount } : node.effect;
  const sentence = effectSentence(effect, dynamic ? 'RuleAmount' : null, false, { ...context, ruleAction: true }, 'Rule');
  let text = sentence[en ? 'eng' : 'zhs'];
  if (dynamic) {
    const amount = valueText(node.amount!, en, statuses);
    if (effect.kind === 'damage') text = en
      ? text.replace('Deal {RuleAmount} damage', `Deal damage equal to ${amount}`)
      : text.replace('造成 {RuleAmount} 点伤害', `造成等同于${amount}的伤害`);
    text = text.split('{RuleAmount}').join(en ? `(${amount})` : `（${amount}）`);
  }
  return text;
}

export function describeRules(nodes: RuleNode[], en = false, statuses: RuleStatus[] = [], depth = 0, context: DescriptionContext = { trigger: 'play' }): string {
  if (depth > RULE_LIMITS.depth) return en ? 'Nesting limit reached.' : '已达到嵌套上限。';
  const value = (v: RuleValue) => valueText(v, en, statuses);
  const nested = (items: RuleNode[]) => describeRules(items, en, statuses, depth + 1, context).split('\n').filter(Boolean).map(line => `  ${line}`).join('\n');
  const count = (v: RuleValue) => typeof v === 'number' ? String(Math.max(0, Math.min(RULE_LIMITS.repeat, Math.floor(v)))) : `${value(v)}${en ? ' (floor, 0–100)' : '（向下取整，0–100）'}`;
  return nodes.filter(n => n.enabled !== false).map(node => {
    switch (node.type) {
      case 'action': return actionText(node, en, statuses, context);
      case 'if': return `${en ? 'If ' : '如果'}${node.conditions.map(c => `${value(c.left)} ${OPS[c.op]} ${value(c.right)}`).join(node.match === 'any' ? en ? ' or ' : ' 或 ' : en ? ' and ' : ' 且 ')}${en ? ':' : '：'}\n${nested(node.then)}${node.else.some(n => n.enabled !== false) ? `\n${en ? 'Otherwise:' : '否则：'}\n${nested(node.else)}` : ''}`;
      case 'repeat': return `${en ? `Repeat ${count(node.count)} times:` : `重复执行 ${count(node.count)} 次：`}\n${nested(node.nodes)}`;
      case 'random': return `${en ? `Randomly execute up to ${count(node.count)} of the following (each at most once):` : `随机执行以下至多 ${count(node.count)} 项（各项最多一次）：`}\n${nested(node.nodes)}`;
      case 'counter': {
        const scope = node.scope === 'turn' ? en ? 'this turn' : '本回合' : en ? 'this combat' : '本场战斗';
        return en ? `${node.operation === 'set' ? 'Set' : 'Increase'} counter 「${node.key}」 (${scope}) ${node.operation === 'set' ? 'to' : 'by'} ${value(node.value)}.`
          : node.operation === 'set' ? `将${scope}计数器「${node.key}」设为 ${value(node.value)}。`
          : `${scope}计数器「${node.key}」${typeof node.value === 'number' && node.value < 0 ? `减少 ${-node.value}` : `增加 ${value(node.value)}`}。`;
      }
      case 'status': {
        const status = statuses.find(s => s.id === node.id);
        const name = status?.name[en ? 'eng' : 'zhs'] || status?.name[en ? 'zhs' : 'eng'] || node.id;
        const target = node.target === 'self' ? en ? 'yourself' : '自身' : node.target === 'all_enemies' ? en ? 'ALL enemies' : '所有敌人' : en ? 'the current target(s)' : '当前目标';
        return en ? `${node.operation === 'apply' ? 'Apply' : 'Remove'} ${value(node.stacks)} stacks of 「${name}」 ${node.operation === 'apply' ? 'to' : 'from'} ${target}.`
          : node.operation === 'apply' ? `给予${target} ${value(node.stacks)} 层「${name}」。` : `移除${target} ${value(node.stacks)} 层「${name}」。`;
      }
      case 'select': {
        const pile = PILE_LABELS[node.from][en ? 1 : 0];
        const cards = node.card_type ? CARD_NAMES[node.card_type]?.[en ? 1 : 0] ?? node.card_type : en ? 'cards' : '牌';
        const selection = en ? `${node.mode === 'random' ? 'Randomly select' : 'Select'} ${node.mode === 'all' ? 'all' : value(node.count)} ${cards} from your ${pile.toLowerCase()}`
          : `从${pile}${node.mode === 'random' ? '随机选择' : '选择'}${node.mode === 'all' ? '全部' : ` ${value(node.count)} 张`}${cards}`;
        const operations = node.operations.map((op, i) => {
          const original = node.operations.slice(0, i).some(previous => previous.type === 'copy');
          const selected = en ? original ? 'the selected originals' : 'the selected cards' : original ? '所选原牌' : '所选牌';
          if (op.type === 'move' || op.type === 'copy') {
            const to = PILE_LABELS[op.pile][en ? 1 : 0];
            return op.type === 'copy' ? en ? `add a copy of each selected card to your ${to.toLowerCase()}` : `将${selected}的副本加入${to}`
              : en ? `move ${selected} to your ${to.toLowerCase()}` : `将${selected}移至${to}`;
          }
          if (op.type === 'cost') {
            const duration = op.duration === 'turn' ? en ? 'this turn' : '本回合' : en ? 'this combat' : '本场战斗';
            return en ? `adjust the cost of ${selected} by ${value(op.amount)} ${duration}`
              :  `使${selected}的费用在${duration}内${typeof op.amount === 'number' ? op.amount < 0 ? `减少 ${-op.amount}` : `增加 ${op.amount}` : `增减 ${value(op.amount)}`}`;
          }
          return en ? `${op.type === 'upgrade' ? 'upgrade' : 'exhaust'} ${selected}` : `${op.type === 'upgrade' ? '升级' : '消耗'}${selected}`;
        });
        return `${selection}${en ? ': ' : '：'}${operations.join(en ? '; then ' : '，再')}${en ? '.' : '。'}`;
      }
    }
  }).filter(Boolean).join('\n');
}

export const RULE_TEMPLATES: { id: string; label: readonly [string, string]; program: RuleProgram }[] = [
  { id: 'branch', label: ['易伤追击', 'Vulnerable follow-up'], program: { ...emptyProgram(), nodes: [{ type: 'action', effect: { kind: 'damage', amount: 8, props: ['Move'] } }, { type: 'if', match: 'all', conditions: [{ left: { source: 'power_stacks', subject: 'target', key: 'Vulnerable' }, op: 'gt', right: 0 }], then: [{ type: 'action', effect: { kind: 'damage', amount: 4, props: ['Move'] } }, { type: 'action', effect: { kind: 'draw', amount: 1 } }], else: [{ type: 'action', effect: { kind: 'power', amount: 2, power: 'Vulnerable' } }] }] } },
  { id: 'block', label: ['格挡转伤害', 'Block as damage'], program: { ...emptyProgram(), nodes: [{ type: 'action', effect: { kind: 'damage', amount: 0, props: ['Move'] }, amount: { source: 'self_block' } }] } },
  { id: 'combo', label: ['三次连击', 'Every third play'], program: { ...emptyProgram(), nodes: [{ type: 'counter', key: 'combo', scope: 'turn', operation: 'add', value: 1 }, { type: 'if', match: 'all', conditions: [{ left: { source: 'counter', key: 'combo', scope: 'turn' }, op: 'gte', right: 3 }], then: [{ type: 'action', effect: { kind: 'draw', amount: 1 } }, { type: 'counter', key: 'combo', scope: 'turn', operation: 'set', value: 0 }], else: [] }] } },
  { id: 'retrieve', label: ['回收攻击牌', 'Retrieve an attack'], program: { ...emptyProgram(), nodes: [{ type: 'select', from: 'discard', mode: 'choose', card_type: 'Attack', count: 1, operations: [{ type: 'move', pile: 'hand' }, { type: 'cost', amount: -1, duration: 'turn' }] }] } },
  { id: 'spark', label: ['星火状态', 'Spark status'], program: { rules_version: 1, statuses: [{ ...defaultStatus('spark'), name: { zhs: '星火', eng: 'Spark' }, icon: 'Poison', nodes: [{ type: 'action', effect: { kind: 'damage', amount: 0, props: ['Unpowered'] }, amount: { source: 'status_stacks', key: 'spark', subject: 'target' } }] }], nodes: [{ type: 'status', id: 'spark', target: 'target', operation: 'apply', stacks: 3 }] } },
];

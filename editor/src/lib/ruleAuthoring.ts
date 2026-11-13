import type { RuleNode, RuleStatus, RuleValue } from './rules';

type RuleBranch = 'then' | 'else' | 'nodes';

export interface RuleOutlineEntry {
  path: string;
  depth: number;
  node: RuleNode;
  branch: RuleBranch | null;
}

/** Keep disabled nodes visible and traverse only executable child branches. */
export function flattenRuleOutline(nodes: RuleNode[]): RuleOutlineEntry[] {
  const outline: RuleOutlineEntry[] = [];
  const visit = (items: RuleNode[], prefix: string, depth: number, branch: RuleBranch | null): void => {
    items.forEach((node, index) => {
      const path = prefix ? `${prefix}.${index}` : String(index);
      outline.push({ path, depth, node, branch });
      if (node.type === 'if') {
        visit(node.then, `${path}.then`, depth + 1, 'then');
        visit(node.else, `${path}.else`, depth + 1, 'else');
      } else if (node.type === 'repeat' || node.type === 'random') {
        visit(node.nodes, `${path}.nodes`, depth + 1, 'nodes');
      }
    });
  };
  visit(nodes, '', 0, null);
  return outline;
}

/** Include counters that are read by expressions as well as counters being written. */
export function collectRuleCounters(nodes: RuleNode[], statuses: RuleStatus[]): string[] {
  const counters = new Set<string>();
  const addKey = (key: string | undefined): void => {
    const trimmed = key?.trim();
    if (trimmed) counters.add(trimmed);
  };
  const addValue = (value: RuleValue | undefined): void => {
    if (value && typeof value === 'object' && value.source === 'counter') addKey(value.key);
  };
  for (const group of [nodes, ...statuses.map(status => status.nodes)]) {
    for (const { node } of flattenRuleOutline(group)) {
      switch (node.type) {
        case 'action':
          addValue(node.amount);
          break;
        case 'if':
          node.conditions.forEach(condition => {
            addValue(condition.left);
            addValue(condition.right);
          });
          break;
        case 'repeat':
        case 'random':
          addValue(node.count);
          break;
        case 'counter':
          addKey(node.key);
          addValue(node.value);
          break;
        case 'status':
          addValue(node.stacks);
          break;
        case 'select':
          addValue(node.count);
          node.operations.forEach(operation => {
            if (operation.type === 'cost') addValue(operation.amount);
          });
          break;
      }
    }
  }
  return [...counters];
}

export function nextStatusId(statuses: RuleStatus[]): string {
  const ids = new Set(statuses.map(status => status.id));
  let index = 1;
  while (ids.has(`status_${index}`)) index++;
  return `status_${index}`;
}

/** Resolve canonical outline paths through own array entries and supported branches. */
export function resolveRulePath(nodes: RuleNode[], path: string): RuleNode | null {
  if (typeof path !== 'string' || !path) return null;
  const parts = path.split('.');
  if (parts.length % 2 === 0) return null;
  let items = nodes;
  for (let offset = 0; offset < parts.length; offset += 2) {
    const index = Number(parts[offset]);
    if (!Number.isSafeInteger(index) || index < 0 || String(index) !== parts[offset]
      || !Array.isArray(items) || !Object.prototype.hasOwnProperty.call(items, index)) return null;
    const node = items[index];
    if (!node || typeof node !== 'object') return null;
    if (offset === parts.length - 1) return node;
    const branch = parts[offset + 1];
    if (!Object.prototype.hasOwnProperty.call(node, branch)) return null;
    if (node.type === 'if' && (branch === 'then' || branch === 'else')) {
      items = node[branch];
    } else if ((node.type === 'repeat' || node.type === 'random') && branch === 'nodes') {
      items = node.nodes;
    } else {
      return null;
    }
  }
  return null;
}

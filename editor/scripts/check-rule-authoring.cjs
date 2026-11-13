const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = path.resolve(__dirname, '../src/lib/ruleAuthoring.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const authoringModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => {
  throw new Error(`Unexpected runtime dependency ${name}`);
}, authoringModule, authoringModule.exports);
const { flattenRuleOutline, collectRuleCounters, nextStatusId, resolveRulePath } = authoringModule.exports;

const checks = [];
function check(name, test) {
  test();
  checks.push(name);
}

function action(amount = 1) {
  return { type: 'action', effect: { kind: 'damage', amount: 1 }, amount };
}
function counter(key) {
  return { source: 'counter', key };
}
function status(id, nodes = []) {
  return { id, nodes };
}
function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') deepFreeze(child);
  }
  return value;
}

const nodes = deepFreeze([
  action(),
  {
    type: 'if', enabled: false, match: 'all', conditions: [],
    then: [{ type: 'repeat', count: 2, nodes: [
      { type: 'random', count: 1, nodes: [action(), action()] },
    ] }],
    else: [{ type: 'if', match: 'any', conditions: [], then: [action()], else: [action()] }],
  },
  action(),
]);

check('outline visits real branches in stable depth-first order and keeps disabled nodes', () => {
  const outline = flattenRuleOutline(nodes);
  assert.deepEqual(outline.map(({ path, depth, branch }) => ({ path, depth, branch })), [
    { path: '0', depth: 0, branch: null },
    { path: '1', depth: 0, branch: null },
    { path: '1.then.0', depth: 1, branch: 'then' },
    { path: '1.then.0.nodes.0', depth: 2, branch: 'nodes' },
    { path: '1.then.0.nodes.0.nodes.0', depth: 3, branch: 'nodes' },
    { path: '1.then.0.nodes.0.nodes.1', depth: 3, branch: 'nodes' },
    { path: '1.else.0', depth: 1, branch: 'else' },
    { path: '1.else.0.then.0', depth: 2, branch: 'then' },
    { path: '1.else.0.else.0', depth: 2, branch: 'else' },
    { path: '2', depth: 0, branch: null },
  ]);
  assert.equal(outline[1].node, nodes[1]);
  assert.equal(outline[1].node.enabled, false);
  for (const entry of outline) assert.equal(resolveRulePath(nodes, entry.path), entry.node);
  assert.deepEqual(flattenRuleOutline([]), []);
});

check('action payloads remain opaque to structural traversal', () => {
  const opaque = { type: 'action', effect: { kind: 'custom', handler: 'third_party', params: {
    nodes: [action()], then: [action()], else: [action()],
  } } };
  assert.deepEqual(flattenRuleOutline([opaque]).map(entry => entry.path), ['0']);
  assert.equal(resolveRulePath([opaque], '0.nodes.0'), null);
});

check('all numeric expression fields and status branches contribute trimmed unique counters', () => {
  const references = deepFreeze([
    { type: 'counter', key: ' combo ', scope: 'turn', operation: 'add', value: counter(' increment ') },
    { type: 'if', match: 'all', conditions: [
      { left: counter('condition_left'), op: 'gt', right: counter('condition_right') },
    ], then: [action(counter(' damage '))], else: [
      { type: 'repeat', count: counter('repeat_count'), nodes: [
        { type: 'random', count: counter('random_count'), nodes: [
          { type: 'status', id: 'spark', operation: 'apply', target: 'self', stacks: counter('stacks') },
        ] },
      ] },
    ] },
    { type: 'select', from: 'hand', mode: 'choose', count: counter('selection'), operations: [
      { type: 'cost', amount: counter('cost'), duration: 'turn' },
      { type: 'move', pile: 'discard' },
    ] },
    { type: 'counter', key: ' ', scope: 'combat', operation: 'set', value: counter('') },
    action({ source: 'status_stacks', key: 'ignored_status' }),
    action({ source: 'power_stacks', key: 'ignored_power' }),
    action(counter()),
    action(counter('combo')),
  ]);
  const statuses = deepFreeze([status('spark', [
    { type: 'if', match: 'all', conditions: [], then: [], else: [
      { type: 'counter', enabled: false, key: ' status_written ', scope: 'turn', operation: 'add', value: counter('status_read') },
      action(counter('damage')),
    ] },
  ])]);
  const before = JSON.stringify({ references, statuses });
  assert.deepEqual(collectRuleCounters(references, statuses), [
    'combo', 'increment', 'condition_left', 'condition_right', 'damage', 'repeat_count',
    'random_count', 'stacks', 'selection', 'cost', 'status_written', 'status_read',
  ]);
  assert.equal(JSON.stringify({ references, statuses }), before);
  assert.deepEqual(collectRuleCounters([], []), []);
});

check('status identifiers fill the earliest gap without changing existing definitions', () => {
  assert.equal(nextStatusId([]), 'status_1');
  const statuses = deepFreeze([status('status_3'), status('custom'), status('status_1'), status('status_1')]);
  assert.equal(nextStatusId(statuses), 'status_2');
  assert.equal(nextStatusId([...statuses, status('status_2')]), 'status_4');
  assert.equal(nextStatusId([status('status_01'), status('status_0')]), 'status_1');
});

check('empty, malformed, out-of-range and prototype paths resolve to null', () => {
  const invalid = [
    '', null, undefined, 0, {}, [], '.', '.0', '0.', '0..then.0',
    '-1', '+0', '00', '01', '1.0', '1e0', '0x0', 'Infinity', 'NaN',
    ' 0', '0 ', '0\n', '9007199254740992', '99',
    '__proto__', 'constructor', 'length', '1.__proto__.0', '1.constructor.0',
    '1.then', '1.then.-1', '1.then.00', '1.then.99', '1.then.0.nodes',
    '1.nodes.0', '0.then.0', '1.then.0.then.0', '1.then.0.nodes.0.else.0',
    '1.then.0.nodes.0.nodes.0.effect.0',
  ];
  for (const value of invalid) assert.equal(resolveRulePath(nodes, value), null, String(value));
  assert.equal(resolveRulePath([], '0'), null);
  assert.equal(resolveRulePath([null], '0'), null);
  assert.equal(resolveRulePath([{ type: 'repeat', nodes: null }], '0.nodes.0'), null);
  const inheritedBranch = Object.assign(Object.create({ then: [action()] }), { type: 'if', else: [] });
  assert.equal(resolveRulePath([inheritedBranch], '0.then.0'), null);
  const sparse = new Array(1);
  Object.setPrototypeOf(sparse, Object.assign(Object.create(Array.prototype), { 0: action() }));
  assert.equal(resolveRulePath(sparse, '0'), null);
});

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

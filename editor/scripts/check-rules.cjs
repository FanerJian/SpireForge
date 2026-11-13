const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const cache = new Map();
function load(file) {
  const full = path.resolve(__dirname, '../src', file);
  if (cache.has(full)) return cache.get(full);
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(name.startsWith('.'), `Unexpected dependency ${name}`);
    return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(full), `${name}.ts`)));
  }, module, module.exports);
  cache.set(full, module.exports); return module.exports;
}
const rules = load('lib/rules.ts');
const { composeCardDescription } = load('lib/description.ts');
const { newCard } = load('lib/types.ts');
const fixturePath = path.join(root, 'schema/rules-v1.examples.json');
const samples = rules.RULE_TEMPLATES.map(template => ({ id: template.id, program: template.program }));
if (process.argv.includes('--write-fixtures')) fs.writeFileSync(fixturePath, JSON.stringify(samples, null, 2) + '\n');
const checks = [];
function check(name, test) { test(); checks.push(name); }
check('editor templates retain the shared cross-language program fixtures', () => {
  assert.deepEqual(samples, JSON.parse(fs.readFileSync(fixturePath, 'utf8')));
  for (const sample of samples) assert.deepEqual(rules.ruleProgram(JSON.parse(JSON.stringify(sample.program))), sample.program);
});
check('branch, dynamic amounts, selection operations and status names reach card descriptions', () => {
  for (const sample of samples) {
    const card = newCard(sample.id); card.effects = [rules.rulesEffect(sample.program)];
    const text = composeCardDescription(card);
    assert.ok(text.zhs.length && text.eng.length);
    assert.ok(!text.zhs.includes('sf_rules'));
  }
  assert.match(composeCardDescription({ ...newCard('branch'), effects: [rules.rulesEffect(samples[0].program)] }).zhs, /否则/);
  assert.match(rules.describeRules(samples.find(s => s.id === 'block').program.nodes), /当前格挡/);
  assert.match(rules.describeRules(samples.find(s => s.id === 'retrieve').program.nodes), /本回合/);
  const spark = samples.find(s => s.id === 'spark').program;
  assert.match(rules.describeRules(spark.nodes, false, spark.statuses), /星火/);
});
check('disabled nested rules preserve data while disappearing from descriptions', () => {
  const node = rules.defaultNode('repeat'); node.nodes.push({ ...rules.defaultNode('action'), enabled: false });
  assert.equal(rules.countNodes([node]), 2);
  assert.ok(!rules.describeRules([node]).includes('造成伤害'));
  assert.equal(node.nodes.length, 1);
});
check('copy and reorder isolate nested edits and retain source order', () => {
  const original = structuredClone(samples[0].program.nodes);
  const duplicate = rules.cloneNode(original[1]); duplicate.then[0].effect.amount = 999;
  assert.equal(original[1].then[0].effect.amount, 4);
  const moved = rules.moveNode(original, 0, 1);
  assert.equal(moved[0].type, 'if'); assert.equal(original[0].type, 'action');
  assert.equal(rules.moveNode(original, 0, -1), original);
});
check('shared status overrides portable snapshot and retains imported definitions', () => {
  const snapshot = [rules.defaultStatus('one'), rules.defaultStatus('imported')];
  const shared = [{ ...rules.defaultStatus('one'), max_stacks: 25 }, rules.defaultStatus('other')];
  const merged = rules.mergeStatuses(snapshot, shared);
  assert.equal(merged.find(s => s.id === 'one').max_stacks, 25);
  assert.deepEqual(merged.map(s => s.id), ['one', 'imported', 'other']);
  assert.equal(snapshot[0].max_stacks, 99);
});
check('expression labels include subject, lifetime, factors and bounds', () => {
  assert.match(rules.valueText({ source: 'status_stacks', subject: 'target', key: 'spark', factor: 2, offset: -1, min: 0, max: 20 }), /目标.*spark.*× 2.*− 1.*0.*20/);
  assert.match(rules.valueText({ source: 'counter', key: 'combo', scope: 'turn' }, true), /turn/);
});
check('dynamic custom status names reach every numeric rule field and generated card descriptions', () => {
  const value = { source: 'status_stacks', key: 'status_1', subject: 'target' };
  const statuses = [{ ...rules.defaultStatus('status_1'), name: { zhs: '星火', eng: 'Spark' } }];
  const nodes = [
    { type: 'if', match: 'all', conditions: [{ left: value, op: 'gte', right: value }], then: [
      { type: 'action', effect: { kind: 'damage', amount: 0 }, amount: value },
    ], else: [{ type: 'counter', key: 'combo', scope: 'turn', operation: 'add', value }] },
    { type: 'repeat', count: value, nodes: [] },
    { type: 'random', count: value, nodes: [] },
    { type: 'status', id: 'status_1', operation: 'apply', target: 'self', stacks: value },
    { type: 'select', from: 'hand', mode: 'choose', count: value, operations: [
      { type: 'cost', amount: value, duration: 'turn' },
    ] },
  ];
  const before = JSON.stringify({ nodes, statuses });
  for (const en of [false, true]) {
    const text = rules.describeRules(nodes, en, statuses);
    assert.ok(!text.includes('status_1'), text);
    assert.match(text, en ? /Spark/ : /星火/);
  }
  const card = { ...newCard('dynamic_status'), effects: [rules.rulesEffect({ ...rules.emptyProgram(), nodes })] };
  const description = composeCardDescription(card, statuses);
  assert.ok(!description.zhs.includes('status_1'));
  assert.ok(!description.eng.includes('status_1'));
  assert.equal(JSON.stringify({ nodes, statuses }), before);
});
check('custom status value names fall back across languages and retain legacy ID formatting', () => {
  const value = { source: 'status_stacks', key: 'status_1' };
  const status = rules.defaultStatus('status_1');
  assert.match(rules.valueText(value, false, [{ ...status, name: { zhs: '', eng: 'Spark' } }]), /「Spark」/);
  assert.match(rules.valueText(value, true, [{ ...status, name: { zhs: '星火', eng: '' } }]), /「星火」/);
  assert.match(rules.valueText(value, true, [{ ...status, name: { zhs: '', eng: '' } }]), /「status_1」/);
  assert.match(rules.valueText(value, false, []), /「status_1」/);
  assert.match(rules.valueText(value, true), /「status_1」/);
  for (const source of ['counter', 'power_stacks']) {
    const reference = { source, key: 'status_1' };
    assert.equal(rules.valueText(reference, false, [status]), rules.valueText(reference, false));
  }
  assert.equal(rules.valueText(3, false, [status]), '3');
});
check('built-in power stacks and power actions share Chinese names with the card description engine', () => {
  const value = { source: 'power_stacks', key: 'Vulnerable', subject: 'target' };
  assert.match(rules.valueText(value), /「易伤」/);
  assert.match(rules.valueText(value, true), /「Vulnerable」/);
  const nodes = [
    { type: 'if', match: 'all', conditions: [{ left: value, op: 'gt', right: 0 }], then: [], else: [] },
    { type: 'action', effect: { kind: 'power', power: 'Vulnerable', amount: 2 } },
  ];
  const card = { ...newCard('vulnerable_rules'), effects: [rules.rulesEffect({ ...rules.emptyProgram(), nodes })] };
  const description = composeCardDescription(card);
  assert.equal((description.zhs.match(/「易伤」/g) ?? []).length, 2);
  assert.ok(!description.zhs.includes('Vulnerable'));
  assert.equal((description.eng.match(/「Vulnerable」/g) ?? []).length, 2);
  assert.match(rules.valueText({ source: 'counter', key: 'Vulnerable' }), /「Vulnerable」/);
  for (const key of ['ExampleModPower', 'constructor']) {
    assert.ok(rules.valueText({ source: 'power_stacks', key }).includes(`「${key}」`));
    assert.ok(rules.describeRules([{ type: 'action', effect: { kind: 'power', power: key, amount: 1 } }]).includes(`「${key}」`));
  }
});
check('unrelated shared states stay outside a card budget, with transitive imports retained', () => {
  const large = id => ({ ...rules.defaultStatus(id), nodes: Array.from({ length: 150 }, () => rules.defaultNode('action')) });
  const shared = [large('unused_one'), large('unused_two'), { ...rules.defaultStatus('used'), nodes: [{ type: 'status', id: 'dependency', operation: 'apply', target: 'self', stacks: 1 }] }, rules.defaultStatus('dependency')];
  const simple = { ...rules.emptyProgram(), nodes: [rules.defaultNode('action')] };
  assert.deepEqual(rules.bindProgramStatuses(simple, shared).statuses, []);
  const program = { ...simple, nodes: [{ type: 'status', id: 'used', operation: 'apply', target: 'self', stacks: 1 }], statuses: [rules.defaultStatus('imported')] };
  const bound = rules.bindProgramStatuses(program, shared);
  assert.deepEqual(new Set(bound.statuses.map(s => s.id)), new Set(['imported', 'used', 'dependency']));
  assert.deepEqual(rules.bindProgramStatuses(bound, shared), bound);
});
check('unknown program versions stay outside the visual editing parser', () => {
  assert.equal(rules.ruleProgram({ rules_version: 2, nodes: [], statuses: [] }), null);
  assert.equal(rules.ruleProgram({ rules_version: 1, nodes: {} }), null);
});
check('description generation uses the latest shared name without mutating portable snapshots', () => {
  const sample = structuredClone(samples.find(s => s.id === 'spark').program);
  const card = { ...newCard('renamed'), effects: [rules.rulesEffect(sample)] };
  const shared = [{ ...sample.statuses[0], name: { zhs: '烈焰', eng: 'Flame' } }];
  assert.match(composeCardDescription(card, shared).zhs, /烈焰/);
  assert.equal(sample.statuses[0].name.zhs, '星火');
});
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

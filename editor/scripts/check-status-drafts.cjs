const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = path.resolve(__dirname, '../src/lib/statusDraftSession.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const draftModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => {
  throw new Error(`Unexpected runtime dependency ${name}`);
}, draftModule, draftModule.exports);
const { statusDraftSession } = draftModule.exports;
const checks = [];
function check(name, test) {
  test();
  checks.push(name);
}
function status(id) {
  return {
    id, name: { zhs: id, eng: id }, description: { zhs: '状态', eng: 'Status' }, icon: 'Strength',
    stacking: 'add', max_stacks: 99, decay: 1, trigger: 'turn_end', max_triggers_per_turn: 1,
    nodes: [{ type: 'repeat', count: 2, nodes: [{ type: 'action', effect: { kind: 'damage', amount: 3 } }] }],
  };
}

check('draft switching and remounts restore edits while retaining immutable snapshots and node identities', () => {
  const session = statusDraftSession('D:/packs/switching');
  const input = status('a');
  session.open(input, true);
  const before = session.getSnapshot();
  const draft = before.drafts.a.status;
  assert.notEqual(draft, input);
  assert.notEqual(draft.nodes[0], input.nodes[0]);
  input.nodes[0].nodes[0].effect.amount = 99;
  assert.equal(draft.nodes[0].nodes[0].effect.amount, 3);
  session.patch('a', { name: { zhs: '已编辑', eng: 'Edited' } });
  const edited = session.getSnapshot().drafts.a.status;
  assert.equal(before.drafts.a.status.name.zhs, 'a');
  assert.notEqual(edited, draft);
  assert.equal(edited.nodes, draft.nodes);
  assert.equal(edited.nodes[0], draft.nodes[0]);
  session.open(status('b'));
  session.open(status('a'));
  assert.equal(session.getSnapshot().activeId, 'a');
  assert.equal(session.getSnapshot().drafts.a.status, edited);
  assert.equal(session.getSnapshot().drafts.a.creating, true);
  session.activate(null);
  const remounted = statusDraftSession('D:/packs/switching');
  assert.equal(remounted, session);
  assert.equal(remounted.getSnapshot(), session.getSnapshot());
  remounted.activate('a');
  assert.equal(remounted.getSnapshot().drafts.a.status, edited);
  assert.equal(Object.keys(remounted.getSnapshot().drafts).length, 2);
});

check('each project keeps independent drafts and stable session methods', () => {
  const first = statusDraftSession('D:/packs/first');
  const second = statusDraftSession('D:/packs/second');
  const input = status('shared');
  first.open(input);
  second.open(input);
  first.patch('shared', { decay: 7 });
  assert.equal(first.getSnapshot().drafts.shared.status.decay, 7);
  assert.equal(second.getSnapshot().drafts.shared.status.decay, 1);
  assert.notEqual(first.getSnapshot().drafts.shared.status, second.getSnapshot().drafts.shared.status);
  assert.equal(statusDraftSession('D:/packs/first').getSnapshot, first.getSnapshot);
  assert.equal(statusDraftSession('D:/packs/first').subscribe, first.subscribe);
});

check('save completion removes its exact submitted draft and preserves newer edits or another active draft', () => {
  const session = statusDraftSession('D:/packs/saving');
  session.open(status('a'));
  const first = session.getSnapshot().drafts.a.status;
  session.finishSave('a', first);
  assert.equal(session.getSnapshot().activeId, null);
  assert.deepEqual(session.getSnapshot().drafts, {});

  session.open(status('a'));
  const pending = session.getSnapshot().drafts.a.status;
  session.patch('a', { decay: 4 });
  const edited = session.getSnapshot().drafts.a.status;
  session.finishSave('a', pending);
  assert.equal(session.getSnapshot().drafts.a.status, edited);
  assert.equal(session.getSnapshot().activeId, 'a');
  session.open(status('b'));
  session.finishSave('a', pending);
  assert.equal(session.getSnapshot().drafts.a.status, edited);
  assert.equal(session.getSnapshot().activeId, 'b');
  session.finishSave('a', edited);
  assert.equal(session.getSnapshot().activeId, 'b');
  assert.deepEqual(Object.keys(session.getSnapshot().drafts), ['b']);
  session.finishSave('b', structuredClone(session.getSnapshot().drafts.b.status));
  assert.equal(session.getSnapshot().activeId, 'b');
});

check('subscriptions expose stable snapshots between changes and stop cleanly after unsubscribe', () => {
  const session = statusDraftSession('D:/packs/subscriptions');
  const snapshots = [];
  const initial = session.getSnapshot();
  const unsubscribe = session.subscribe(() => snapshots.push(session.getSnapshot()));
  assert.equal(session.getSnapshot(), initial);
  session.activate(null);
  session.patch('missing', { decay: 3 });
  session.activate('missing');
  session.discard('missing');
  session.finishSave('missing', status('missing'));
  assert.equal(session.getSnapshot(), initial);
  assert.equal(snapshots.length, 0);
  session.open(status('a'));
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0], session.getSnapshot());
  assert.ok(Object.isFrozen(snapshots[0]));
  assert.ok(Object.isFrozen(snapshots[0].drafts));
  assert.ok(Object.isFrozen(snapshots[0].drafts.a));
  session.open(status('a'));
  assert.equal(snapshots.length, 1);
  session.patch('a', { decay: 5 });
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].drafts.a.status.decay, 1);
  assert.equal(snapshots[1].drafts.a.status.decay, 5);
  unsubscribe();
  unsubscribe();
  session.activate(null);
  assert.equal(snapshots.length, 2);
});

check('discard targets one draft and draft keys stay stable during status ID edits', () => {
  const session = statusDraftSession('D:/packs/discard');
  session.open(status('a'), true);
  session.patch('a', { id: 'renamed' });
  const renamed = session.getSnapshot().drafts.a.status;
  session.open(status('b'));
  session.discard('a');
  assert.equal(session.getSnapshot().activeId, 'b');
  assert.deepEqual(Object.keys(session.getSnapshot().drafts), ['b']);
  session.open(status('a'));
  assert.notEqual(session.getSnapshot().drafts.a.status, renamed);
  session.discard('a');
  assert.equal(session.getSnapshot().activeId, null);
  assert.deepEqual(Object.keys(session.getSnapshot().drafts), ['b']);
  session.open(status('constructor'));
  assert.equal(session.getSnapshot().drafts.constructor.status.id, 'constructor');
  session.discard('constructor');
  session.discard('b');
  assert.deepEqual(session.getSnapshot(), { drafts: {}, activeId: null });
});

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));

// Runs the real description engine and action against controlled UI boundaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(file, overrides = {}) {
  const absolute = path.resolve(__dirname, '../src', file);
  if (!Object.keys(overrides).length && cache.has(absolute)) return cache.get(absolute);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)((name) => {
    if (overrides[name]) return overrides[name];
    assert.ok(name.startsWith('.'), `Unexpected dependency: ${name}`);
    return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(absolute), name + '.ts')));
  }, module, module.exports);
  cache.set(absolute, module.exports);
  return module.exports;
}
const { newCard } = load('lib/types.ts');
const { composeDescription, composeHookDescription, composeCardDescription, composeDelayedBuffText, effectVarName, previewEffectVars } = load('lib/description.ts');
const checks = [];
function check(name, fn) { fn(); checks.push(name); }
const damage = (amount = 6, target) => ({ kind: 'damage', amount, props: ['Move'], ...(target ? { target } : {}) });
const delayed = (options = {}) => ({ kind: 'delayed', turns: 2, timing: 'turn_end', side: 'player', effects: [{ kind: 'block', amount: 4, props: ['Move'] }], ...options });
check('combat-start delayed text has one trigger prefix and no play prefix', () => {
  const c = { ...newCard('hope'), on_enter_combat: [delayed()] };
  const text = composeCardDescription(c);
  assert.equal(text.zhs, '战斗开始时，接下来 2 次我方回合结束时：\n获得 4 点格挡。');
  assert.equal(text.eng, 'At combat start, at the end of each of your next 2 turns:\nGain 4 Block.');
  assert.equal((text.zhs.match(/战斗开始时/g) ?? []).length, 1);
  assert.ok(!text.zhs.includes('打出后'));
});
check('all hook / timing / side / mode combinations preserve nested structure', () => {
  for (const trigger of ['on_draw', 'on_discard', 'on_exhaust', 'on_enter_combat', 'on_turn_end_in_hand']) {
    for (const timing of ['turn_start', 'turn_end']) for (const side of ['player', 'enemy', 'both']) for (const every_turn of [true, false]) {
      const text = composeHookDescription(trigger, [delayed({ timing, side, every_turn, effects: [damage(), { kind: 'draw', amount: 1 }] })]);
      assert.ok(!text.zhs.includes('打出后'));
      assert.equal(text.zhs.split('\n').length, 3);
      assert.ok(text.zhs.includes('对随机敌人造成 6 点伤害'));
      assert.ok(text.zhs.includes(every_turn ? '接下来 2 次' : '第 2 次'));
      assert.ok(text.zhs.includes(timing === 'turn_start' ? '开始时' : '结束时'));
      assert.ok(text.zhs.includes({ player: '我方', enemy: '敌方', both: '双方' }[side]));
    }
  }
});
check('one prefix for multiple effects in a hook', () => {
  assert.equal(composeHookDescription('on_draw', [damage(), damage(3)]).zhs,
    '抽到时，对随机敌人造成 6 点伤害。\n对随机敌人造成 3 点伤害。');
});
check('play targets and explicit overrides agree with runtime policy', () => {
  const cases = [['AllEnemies', undefined, '对所有敌人'], ['RandomEnemy', undefined, '对随机敌人'], ['Self', undefined, '对自身'], ['AnyEnemy', 'all_enemies', '对所有敌人'], ['Self', 'random_enemy', '对随机敌人'], ['None', undefined, '对所有敌人']];
  for (const [target, override, prefix] of cases) assert.ok(composeDescription({ ...newCard('a'), target, effects: [damage(6, override)] }).zhs.startsWith(prefix));
});
check('power target defaults and independent Power variables', () => {
  const c = { ...newCard('a'), target: 'Self', effects: [{ kind: 'power', amount: 2, power: 'Strength', upgrade_amount: 1 }, { kind: 'power', amount: 3, power: 'Vulnerable', target: 'random_enemy' }] };
  const text = composeDescription(c);
  assert.equal(text.zhs, '获得 {Power} 层力量。\n给予随机敌人 {Power2} 层易伤。');
  assert.equal(previewEffectVars(c, true).Power, '2+1');
  assert.ok(composeHookDescription('on_exhaust', c.effects).zhs.includes('随机敌人 2'));
});
check('variable names match the C# naming contract, including duplicate kinds', () => {
  const runtime = fs.readFileSync(path.resolve(__dirname, '../../runtime/src/SfEffectEngine.cs'), 'utf8');
  const names = [...runtime.matchAll(/SfEffectKind\.(\w+) => "(\w+)"/g)];
  assert.equal(names.length, 15);
  for (const [, runtimeKind, expected] of names) {
    const kind = runtimeKind.replace(/[A-Z]/g, (s, i) => (i ? '_' : '') + s.toLowerCase());
    const list = [{ kind }, { kind }];
    assert.equal(effectVarName(list, 0), expected);
    assert.equal(effectVarName(list, 1), expected + '2');
  }
});
check('empty or visual-only delayed effects produce no dangling text', () => {
  assert.equal(composeDescription({ ...newCard('a'), effects: [delayed({ effects: [] })] }), null);
  assert.equal(composeHookDescription('on_draw', [delayed({ effects: [{ kind: 'vfx', vfx: 'attack_slash' }] })]), null);
});
check('old data with missing nested list does not crash', () => {
  assert.equal(composeDescription({ ...newCard('a'), effects: [delayed({ effects: undefined })] }), null);
});
check('unknown imported effect remains visible without crashing generation', () => {
  assert.ok(composeDescription({ ...newCard('a'), effects: [{ kind: 'future_effect' }] }).zhs.includes('未知效果'));
});
check('vanilla overrides keep literal values', () => {
  const text = composeDescription({ ...newCard('a'), vanilla_id: 'BASH', effects: [damage(15), { kind: 'power', amount: 3, power: 'Vulnerable' }] });
  assert.ok(!text.zhs.includes('{'));
  assert.ok(text.zhs.includes('15'));
});
check('negative upgrade delta has a readable sign', () => {
  assert.equal(previewEffectVars({ ...newCard('a'), effects: [{ ...damage(), upgrade_amount: -2 }] }, true).Damage, '6-2');
});
check('X cost repetition retains hit-count and delayed scheduling semantics', () => {
  const text = composeDescription({ ...newCard('a'), costs_x: true, effects: [{ ...damage(), hit_count: 2 }, delayed()] });
  assert.ok(text.zhs.includes('重复施加 X 次'));
  assert.ok(text.zhs.includes('两次（重复 X 次）'));
});
check('delayed upgrades use distinct variables in card description and upgrade preview', () => {
  const c = { ...newCard('upgrade_delay'), effects: [damage(), delayed({ upgrade_turns: 1, effects: [
    { kind: 'block', amount: 4, props: ['Move'], upgrade_amount: 3 },
    { kind: 'block', amount: 8, props: ['Move'], upgrade_amount: -2 },
  ] })] };
  const text = composeCardDescription(c).zhs;
  assert.ok(text.includes('{DelayedPlay2Turns}'));
  assert.ok(text.includes('{DelayedPlay2Effect1Amount}') && text.includes('{DelayedPlay2Effect2Amount}'));
  const preview = previewEffectVars(c, true);
  assert.equal(preview.DelayedPlay2Turns, '3');
  assert.equal(preview.DelayedPlay2Effect1Amount, '7');
  assert.equal(preview.DelayedPlay2Effect2Amount, '6');
  const hook = { ...c, on_draw: [delayed({ upgrade_turns: -5, effects: [{ kind: 'draw', amount: 1, upgrade_amount: 1 }] })] };
  assert.ok(composeCardDescription(hook).zhs.includes('{DelayedOnDraw1Effect1Amount}'));
  assert.equal(previewEffectVars(hook, true).DelayedOnDraw1Turns, '1');
  assert.ok(composeCardDescription({ ...c, vanilla_id: 'BASH' }).zhs.includes('{DelayedPlay2Effect1Amount}'));
});
check('buff generation uses live remaining count and resolved value placeholders', () => {
  const text = composeDelayedBuffText(delayed({ every_turn: false, side: 'enemy', effects: [
    { kind: 'block', amount: 4, props: ['Move'], upgrade_amount: 3 },
    delayed({ effects: [{ kind: 'draw', amount: 1, upgrade_amount: 1 }] }),
  ] }));
  assert.equal(text.name.zhs, '延迟效果');
  assert.ok(text.description.zhs.includes('第 {Amount} 次敌方回合结束时'));
  assert.ok(text.description.zhs.includes('{Effect1Amount}') && text.description.zhs.includes('{Effect2Turns}'));
  assert.ok(text.description.eng.includes('{Effect2Effect1Amount}'));
  assert.ok(!text.description.zhs.includes('打出后'));
});
async function checkActions() {
  const projects = new Map();
  const { useStore: store } = load('lib/store.ts', {
    zustand: { create: require('zustand').create },
    './tauri': { api: {
      saveCard: async () => {}, deleteCard: async () => {}, updateProjectMeta: async () => {},
      openProject: async (root) => structuredClone(projects.get(root)),
      getSettings: async () => ({ game_dir: '', runtime_version: null, uploader_path: null }),
    } },
    './i18n': { tr: (key) => key },
    './templates': {},
    './types': { newCard },
  });
  let writes = 0;
  const messages = [];
  const updateCard = store.getState().updateCard;
  store.setState({
    updateCard: (patch) => { writes++; updateCard(patch); },
    showToast: (message) => messages.push(message),
  });
  const currentCard = () => store.getState().cards.find(card => card.id === store.getState().selectedId);
  const manualCard = (id) => ({ ...newCard(id), effects: [damage()], description: { zhs: `手写 ${id}`, eng: `Custom ${id}` } });
  function prepare(cards = [manualCard('a')], root = 'D:/packs/current') {
    assert.equal(confirmation.confirmationStore.get(), null);
    const meta = { cards: cards.map(card => card.id), rule_statuses: [] };
    projects.set(root, [meta, cards]);
    store.setState({ projectRoot: root, meta, cards, selectedId: cards[0].id,
      dirtyIds: [], undoStack: [], redoStack: [], historyBusy: false });
    return currentCard();
  }
  const confirmation = load('lib/confirmation.ts');
  const { useGenDescription } = load('components/pp/useDescription.ts', {
    '../../lib/store': { useStore: Object.assign(() => store.getState(), { getState: store.getState }) },
    '../../lib/i18n': { useT: () => (key) => key, useLang: () => 'zh' },
    '../../lib/confirmation': confirmation,
  });
  const generate = useGenDescription();
  prepare([{ ...newCard('a'), effects: [damage()], on_draw: [{ kind: 'draw', amount: 1 }] }]);
  await generate(currentCard()); await generate(currentCard());
  assert.equal(writes, 1); assert.equal(confirmation.confirmationStore.get(), null);
  store.setState({ cards: [{ ...currentCard(), description: { zhs: '手写描述', eng: 'Custom text' } }] });
  const cancelled = generate(currentCard());
  assert.equal(writes, 1); assert.ok(confirmation.confirmationStore.get());
  confirmation.finishConfirmation(false); await cancelled;
  assert.equal(currentCard().description.zhs, '手写描述'); assert.equal(writes, 1);
  const approved = generate(currentCard());
  assert.equal(writes, 1); // A pending Promise must never approve an action.
  confirmation.finishConfirmation(true); await approved;
  assert.equal(writes, 2);
  assert.equal((currentCard().description.zhs.match(/抽到时/g) ?? []).length, 1);
  await store.getState().persistAll();
  checks.push('generation waits for confirmation, preserves manual text on cancel, and is idempotent');

  const first = confirmation.confirmAction('first');
  assert.equal(await confirmation.confirmAction('second'), false);
  assert.equal(confirmation.confirmationStore.get().message, 'first');
  confirmation.finishConfirmation(true); assert.equal(await first, true);
  confirmation.finishConfirmation(false); // Safe with no pending request.
  checks.push('concurrent confirmation requests cannot authorize duplicate actions');

  {
    const source = prepare([manualCard('a'), manualCard('b')]);
    const pending = generate(source);
    assert.ok(confirmation.confirmationStore.get());
    store.getState().select('b');
    const before = store.getState();
    const count = writes;
    confirmation.finishConfirmation(true); await pending;
    assert.equal(writes, count);
    assert.equal(store.getState().cards, before.cards);
    assert.equal(store.getState().undoStack, before.undoStack);
    assert.equal(store.getState().dirtyIds, before.dirtyIds);
    assert.equal(currentCard().id, 'b');
    assert.match(messages.at(-1), /重新生成描述/);
    checks.push('approval after changing selection preserves both cards and their editing history');
  }
  {
    const source = prepare();
    projects.set('D:/packs/other', [{ cards: ['a'], rule_statuses: [] }, [manualCard('a')]]);
    const pending = generate(source);
    await store.getState().openProject('D:/packs/other');
    store.getState().select('a');
    const before = store.getState();
    const count = writes;
    confirmation.finishConfirmation(true); await pending;
    assert.equal(writes, count);
    assert.equal(store.getState().projectRoot, 'D:/packs/other');
    assert.equal(store.getState().cards, before.cards);
    assert.equal(currentCard().description.zhs, '手写 a');
    checks.push('approval remains bound to its original project even when card IDs match');
  }
  {
    const source = prepare();
    const pending = generate(source);
    await store.getState().openProject('D:/packs/current');
    store.getState().select('a');
    assert.notEqual(currentCard(), source);
    const before = store.getState().cards;
    const count = writes;
    confirmation.finishConfirmation(true); await pending;
    assert.equal(writes, count);
    assert.equal(store.getState().cards, before);
    checks.push('same-path project reopens retain their fresh card snapshots after old approvals');
  }
  for (const patch of [
    { description: { zhs: '最新手写内容', eng: 'Latest text' } },
    { effects: [damage(99)] },
  ]) {
    const source = prepare();
    const pending = generate(source);
    store.getState().updateCard(patch);
    const before = store.getState();
    const count = writes;
    confirmation.finishConfirmation(true); await pending;
    assert.equal(writes, count);
    assert.equal(store.getState().cards, before.cards);
    assert.equal(store.getState().undoStack, before.undoStack);
    assert.equal(currentCard().description.zhs, patch.description?.zhs ?? source.description.zhs);
    await store.getState().persistAll();
  }
  checks.push('edits to descriptions and effect inputs during confirmation preserve the newest card snapshot');
  {
    const source = prepare();
    const pending = generate(source);
    await store.getState().removeCard(source.id);
    const before = store.getState();
    const count = writes;
    confirmation.finishConfirmation(true); await pending;
    assert.equal(writes, count);
    assert.equal(store.getState().cards, before.cards);
    assert.equal(store.getState().selectedId, null);
    checks.push('deleting the original card safely finishes its pending description approval');
  }
  {
    const source = prepare();
    const pending = generate(source);
    await store.getState().updateMeta({ rule_statuses: [{ id: 'renamed' }] });
    const count = writes;
    confirmation.finishConfirmation(true); await pending;
    assert.equal(writes, count);
    assert.equal(currentCard(), source);
    checks.push('shared status definition changes invalidate the generated description snapshot');
  }
  {
    const source = prepare();
    store.getState().updateCard({ effects: [damage(8)] });
    const count = writes;
    await generate(source);
    assert.equal(writes, count);
    assert.equal(confirmation.confirmationStore.get(), null);
    await store.getState().persistAll();
    checks.push('stale card callbacks finish before opening an overwrite confirmation');
  }
  {
    const source = prepare([manualCard('a'), manualCard('b')]);
    const pending = generate(source);
    store.getState().select('b');
    store.getState().updateCard({ effects: [damage(8)] });
    await store.getState().persistAll();
    store.getState().select('a');
    const count = writes;
    confirmation.finishConfirmation(true); await pending;
    assert.equal(writes, count + 1);
    assert.equal(currentCard().description.zhs, composeCardDescription(source).zhs);
    assert.equal(store.getState().cards.find(card => card.id === 'b').effects[0].amount, 8);
    await store.getState().persistAll();
    checks.push('unrelated card edits allow approval after returning to the unchanged original card');
  }
  console.log(JSON.stringify({ result: 'PASS', groups: checks.length, checks }, null, 2));
}
checkActions().catch((error) => { console.error(error); process.exitCode = 1; });

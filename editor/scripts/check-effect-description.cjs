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
  let c = { ...newCard('a'), effects: [damage()], on_draw: [{ kind: 'draw', amount: 1 }] };
  let writes = 0;
  const messages = [];
  const confirmation = load('lib/confirmation.ts');
  const { useGenDescription } = load('components/pp/useDescription.ts', {
    '../../lib/store': { useStore: () => ({ updateCard: (p) => { c = { ...c, ...p }; writes++; }, showToast: (m) => messages.push(m) }) },
    '../../lib/i18n': { useT: () => (key) => key },
    '../../lib/confirmation': confirmation,
  });
    const generate = useGenDescription();
    await generate(c); await generate(c);
    assert.equal(writes, 1); assert.equal(confirmation.confirmationStore.get(), null);
    c = { ...c, description: { zhs: '手写描述', eng: 'Custom text' } };
    const cancelled = generate(c);
    assert.equal(writes, 1); assert.ok(confirmation.confirmationStore.get());
    confirmation.finishConfirmation(false); await cancelled;
    assert.equal(c.description.zhs, '手写描述'); assert.equal(writes, 1);
    const approved = generate(c);
    assert.equal(writes, 1); // A pending Promise must never approve an action.
    confirmation.finishConfirmation(true); await approved;
    assert.equal(writes, 2);
    assert.equal((c.description.zhs.match(/抽到时/g) ?? []).length, 1);
    checks.push('generation waits for confirmation, preserves manual text on cancel, and is idempotent');
    const first = confirmation.confirmAction('first');
    assert.equal(await confirmation.confirmAction('second'), false);
    assert.equal(confirmation.confirmationStore.get().message, 'first');
    confirmation.finishConfirmation(true); assert.equal(await first, true);
    confirmation.finishConfirmation(false); // Safe with no pending request.
    checks.push('concurrent confirmation requests cannot authorize duplicate actions');
    console.log(JSON.stringify({ result: 'PASS', groups: checks.length, checks }, null, 2));
}
checkActions().catch((error) => { console.error(error); process.exitCode = 1; });

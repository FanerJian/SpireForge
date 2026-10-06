// Run with node scripts/check-save-flow.cjs. Exercises the real store with a controlled disk boundary.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { create } = require('zustand');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/store.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const card = (id, value = 1) => ({ id, value, name: { zhs: id, eng: id } });
const pause = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

function store(api, cards = [card('a')]) {
  const module = { exports: {} };
  const modules = {
    zustand: { create }, './tauri': { api }, './i18n': { tr: () => 'SAVE_FAILED' },
    './templates': {}, './types': { newCard: card },
  };
  new Function('require', 'module', 'exports', compiled)((name) => {
    assert.ok(modules[name], `Unexpected dependency: ${name}`);
    return modules[name];
  }, module, module.exports);
  const useStore = module.exports.useStore;
  useStore.setState({ projectRoot: 'D:/packs/current', meta: { cards: cards.map((c) => c.id) }, cards, selectedId: cards[0].id, dirtyIds: cards.map((c) => c.id) });
  return useStore;
}

async function run() {
  const checks = [];
  {
    const s = store({ saveCard: async () => { throw new Error('disk full'); } });
    await assert.rejects(s.getState().closeProject(), /SAVE_FAILED/);
    assert.equal(s.getState().projectRoot, 'D:/packs/current');
    assert.deepEqual(s.getState().dirtyIds, ['a']);
    assert.equal(s.getState().cards.length, 1);
    checks.push('failed save preserves edits and blocks switching');
  }
  {
    const s = store({ saveCard: async (c) => { if (c.id === 'b') throw new Error('permission denied'); } }, [card('a'), card('b')]);
    await assert.rejects(s.getState().persistAll(), /SAVE_FAILED/);
    assert.deepEqual(s.getState().dirtyIds, ['b']);
    checks.push('partial save only confirms successful snapshots');
  }
  {
    const first = deferred();
    const second = deferred();
    const writes = [];
    let active = 0;
    let peak = 0;
    const s = store({ saveCard: async (c) => {
      peak = Math.max(peak, ++active);
      writes.push(c.value);
      await (writes.length === 1 ? first.promise : second.promise);
      active--;
    } });
    const p1 = s.getState().persistAll();
    s.getState().updateCard({ value: 2 });
    const p2 = s.getState().persistAll();
    first.resolve();
    await pause();
    assert.deepEqual(writes, [1, 2]);
    assert.deepEqual(s.getState().dirtyIds, ['a']);
    second.resolve();
    await Promise.all([p1, p2]);
    assert.equal(peak, 1);
    assert.deepEqual(s.getState().dirtyIds, []);
    assert.equal(s.getState().cards[0].value, 2);
    checks.push('overlapping requests serialize and retain edits entered during saving');
  }
  {
    let opened = 0;
    let created = 0;
    const s = store({ saveCard: async () => { throw new Error('disk full'); }, openProject: async () => { opened++; }, newProject: async () => { created++; } });
    await assert.rejects(s.getState().openProject('D:/packs/other'), /SAVE_FAILED/);
    await assert.rejects(s.getState().newProject('OtherPack', 'Other', ''), /SAVE_FAILED/);
    assert.equal(opened + created, 0);
    assert.equal(s.getState().projectRoot, 'D:/packs/current');
    checks.push('failed save prevents opening or creating another project');
  }
  {
    const writes = [];
    const s = store({ saveCard: async (c) => { writes.push(c.id); } });
    await s.getState().closeProject();
    assert.deepEqual(writes, ['a']);
    assert.equal(s.getState().projectRoot, null);
    assert.deepEqual(s.getState().cards, []);
    checks.push('successful switching saves before clearing the session');
  }
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
}
run().catch((e) => { console.error(e); process.exitCode = 1; });

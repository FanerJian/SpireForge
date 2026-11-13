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
  return { s: useStore, mutate: module.exports.runProjectMutation };
}

async function run() {
  const checks = [];
  {
    const { s } = store({ saveCard: async () => { throw new Error('disk full'); } });
    await assert.rejects(s.getState().closeProject(), /SAVE_FAILED/);
    assert.equal(s.getState().projectRoot, 'D:/packs/current');
    assert.deepEqual(s.getState().dirtyIds, ['a']);
    assert.equal(s.getState().cards.length, 1);
    checks.push('failed save preserves edits and blocks switching');
  }
  {
    const { s } = store({ saveCard: async (c) => { if (c.id === 'b') throw new Error('permission denied'); } }, [card('a'), card('b')]);
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
    const { s } = store({ saveCard: async (c) => {
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
    const { s } = store({ saveCard: async () => { throw new Error('disk full'); }, openProject: async () => { opened++; }, newProject: async () => { created++; } });
    await assert.rejects(s.getState().openProject('D:/packs/other'), /SAVE_FAILED/);
    await assert.rejects(s.getState().newProject('OtherPack', 'Other', ''), /SAVE_FAILED/);
    assert.equal(opened + created, 0);
    assert.equal(s.getState().projectRoot, 'D:/packs/current');
    checks.push('failed save prevents opening or creating another project');
  }
  {
    const writes = [];
    const { s } = store({ saveCard: async (c) => { writes.push(c.id); } });
    await s.getState().closeProject();
    assert.deepEqual(writes, ['a']);
    assert.equal(s.getState().projectRoot, null);
    assert.deepEqual(s.getState().cards, []);
    checks.push('successful switching saves before clearing the session');
  }
  {
    const saving = deferred();
    const opening = deferred();
    let opens = 0;
    const { s } = store({
      saveCard: async () => saving.promise,
      openProject: async () => { opens++; return opening.promise; },
    });
    const pending = s.getState().openProject('D:/packs/next');
    assert.equal(s.getState().historyBusy, true);
    s.getState().updateCard({ value: 99 });
    assert.equal(s.getState().cards[0].value, 1);
    assert.equal(opens, 0);
    saving.resolve(); await pause();
    assert.equal(opens, 1);
    await assert.rejects(s.getState().openProject('D:/packs/racing'));
    await assert.rejects(s.getState().newProject('racing', '', ''));
    await assert.rejects(s.getState().closeProject());
    await assert.rejects(s.getState().removeCard('a'));
    s.getState().updateCard({ value: 99 });
    assert.equal(s.getState().cards[0].value, 1);
    opening.resolve([{ cards: ['next'] }, [card('next')]]);
    await pending;
    assert.equal(s.getState().projectRoot, 'D:/packs/next');
    assert.deepEqual(s.getState().cards.map(c => c.id), ['next']);
    assert.equal(s.getState().historyBusy, false);
    checks.push('project opening owns the save and load boundary, blocking edits and overlapping transactions');
  }
  {
    const creating = deferred();
    const { s } = store({
      saveCard: async () => {},
      newProject: async () => creating.promise,
      openProject: async () => [{ cards: [] }, []],
    });
    const pending = s.getState().newProject('Next', 'Next', '');
    await pause();
    await assert.rejects(s.getState().closeProject());
    assert.equal(s.getState().historyBusy, true);
    creating.resolve('D:/packs/created'); await pending;
    assert.equal(s.getState().projectRoot, 'D:/packs/created');
    assert.equal(s.getState().historyBusy, false);
    checks.push('project creation holds the same lock until its new snapshot is loaded');
  }
  {
    const { s } = store({ saveCard: async () => {}, openProject: async () => { throw new Error('missing project'); } });
    await assert.rejects(s.getState().openProject('D:/packs/missing'), /missing project/);
    assert.equal(s.getState().projectRoot, 'D:/packs/current');
    assert.equal(s.getState().historyBusy, false);
    assert.deepEqual(s.getState().dirtyIds, []);
    checks.push('failed opening releases the project lock and retains the saved current session');
  }
  {
    for (const root of ['D:/packs/next', 'D:/packs/current']) {
      const reading = deferred();
      const freshMeta = { cards: ['a'], name: 'fresh session' };
      const { s } = store({
        saveCard: async () => {}, getProjectMeta: async () => reading.promise,
        openProject: async () => [freshMeta, [card('a')]],
      });
      const pending = s.getState().reloadMeta();
      await s.getState().openProject(root);
      reading.resolve({ cards: ['a'], name: 'old session' }); await pending;
      assert.equal(s.getState().meta, freshMeta);
    }
    checks.push('late metadata reads are discarded across project switches and same-path reopens');
  }
  {
    const reading = deferred();
    const { s } = store({
      saveCard: async () => {},
      getProjectMeta: async () => reading.promise, updateProjectMeta: async () => {},
    });
    const pending = s.getState().reloadMeta();
    await s.getState().updateMeta({ name: 'new name' });
    reading.resolve({ cards: ['a'], name: 'old name' }); await pending;
    assert.equal(s.getState().meta.name, 'new name');
    await s.getState().persistAll();
    checks.push('late metadata refresh preserves newer completed metadata changes');
  }
  {
    const writing = deferred();
    const disk = [card('a')];
    const events = [];
    const { s, mutate } = store({
      saveCard: async (c) => { events.push('save'); disk[0] = structuredClone(c); },
      openProject: async (root) => {
        events.push('reload'); assert.equal(root, 'D:/packs/current');
        return [{ cards: disk.map(c => c.id) }, structuredClone(disk)];
      },
    });
    s.getState().updateCard({ value: 5 });
    const pending = mutate(async () => {
      events.push('import'); assert.equal(disk[0].value, 5);
      await writing.promise;
      disk.push(card('imported'));
      return 'import result';
    });
    await pause();
    await assert.rejects(s.getState().closeProject());
    s.getState().updateCard({ value: 99 });
    assert.equal(s.getState().cards[0].value, 5);
    writing.resolve(); assert.equal(await pending, 'import result');
    assert.deepEqual(events, ['save', 'import', 'reload']);
    assert.deepEqual(s.getState().cards.map(c => c.id), ['a', 'imported']);
    assert.equal(s.getState().selectedId, 'a');
    assert.equal(s.getState().portraitRevision, 1);
    assert.deepEqual(s.getState().undoStack, []);
    assert.deepEqual(s.getState().dirtyIds, []);
    assert.equal(s.getState().historyBusy, false);
    checks.push('project mutations save first, isolate the disk transaction and refresh while preserving selection');
  }
  {
    const disk = [card('a')];
    const { s, mutate } = store({
      saveCard: async () => {},
      openProject: async () => [{ cards: disk.map(c => c.id) }, structuredClone(disk)],
    });
    await assert.rejects(mutate(async () => {
      disk.push(card('partial'));
      throw new Error('second import failed');
    }), /second import failed/);
    assert.deepEqual(s.getState().cards.map(c => c.id), ['a', 'partial']);
    assert.equal(s.getState().historyBusy, false);
    checks.push('partial import failure reloads completed disk writes and retains the original error');
  }
  {
    const disk = [card('a')];
    const { s, mutate } = store({
      saveCard: async (c) => { disk[0] = structuredClone(c); },
      // 重新排列字段，模拟后端序列化后的 JSON 字段顺序。
      openProject: async () => [{ cards: ['a'] }, disk.map(c => ({ name: c.name, value: c.value, id: c.id }))],
    });
    s.getState().updateCard({ value: 5 });
    const history = s.getState().undoStack;
    const before = s.getState().cards;
    await assert.rejects(mutate(async () => { throw new Error('invalid import'); }), /invalid import/);
    assert.equal(s.getState().undoStack, history);
    assert.equal(s.getState().cards, before);
    assert.equal(s.getState().portraitRevision, 0);
    assert.equal(s.getState().historyBusy, false);
    checks.push('import failure with unchanged disk content preserves editing history and images');
  }
  {
    const { s, mutate } = store({
      saveCard: async () => {}, openProject: async () => { throw new Error('reload failed'); },
    });
    await assert.rejects(mutate(async () => { throw new Error('import failed'); }), /import failed/);
    assert.equal(s.getState().historyBusy, false);
    checks.push('failed recovery reload preserves the import error and releases the lock');
  }
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
}
run().catch((e) => { console.error(e); process.exitCode = 1; });

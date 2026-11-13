// Controlled disk boundary; tests the real Zustand store, cache, and publication snapshot code.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { create } = require('zustand');
const clone = (v) => structuredClone(v);
const card = (id, cost = 1) => ({ id, cost, name: { zhs: id, eng: id }, portrait: `assets/cards/${id}.png`, portrait_original: `assets/cards/${id}_original.png` });
function load(file, modules = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((name) => {
    assert.ok(modules[name], `Unexpected dependency: ${name}`); return modules[name];
  }, module, module.exports);
  return module.exports;
}
function session(cards = [card('a'), card('b')], overrides = {}) {
  const disk = new Map(cards.map((c) => [c.id, clone(c)]));
  const meta = { cards: cards.map((c) => c.id), pack_id: 'TestPack', last_version: '1' };
  const writes = [];
  const api = {
    saveCard: async (c) => { writes.push(clone(c)); disk.set(c.id, clone(c)); },
    deleteCard: async (id) => { disk.delete(id); meta.cards = meta.cards.filter((c) => c !== id); },
    restoreDeletedCard: async (c, index) => {
      if (meta.cards.includes(c.id)) throw new Error('id occupied');
      disk.set(c.id, clone(c)); meta.cards.splice(index, 0, c.id);
    },
    renameCard: async (oldId, newId) => {
      const c = { ...disk.get(oldId), id: newId, portrait: `assets/cards/${newId}.png`, portrait_original: `assets/cards/${newId}_original.png` };
      disk.delete(oldId); disk.set(newId, c); meta.cards = meta.cards.map((id) => id === oldId ? newId : id);
      return clone(c);
    },
    ...overrides,
  };
  const { useStore, saveCardPortrait } = load('store.ts', { zustand: { create }, './tauri': { api }, './i18n': { tr: (key, vars) => key + JSON.stringify(vars ?? {}) }, './templates': {}, './types': { newCard: card } });
  useStore.setState({ projectRoot: 'D:/test/current', meta: clone(meta), cards: clone(cards), selectedId: cards[0].id });
  return { s: useStore, disk, writes, savePortrait: saveCardPortrait };
}
async function run() {
  const checks = [];
  {
    const { s, disk } = session();
    s.getState().updateCard({ cost: 7 });
    await s.getState().renameCard('a', 'renamed');
    assert.equal(s.getState().undoStack[0].before.id, 'renamed');
    assert.equal(s.getState().undoStack[0].before.portrait, 'assets/cards/renamed.png');
    await s.getState().undo();
    assert.equal(s.getState().selectedId, 'renamed'); assert.equal(s.getState().cards[0].id, 'renamed');
    assert.equal(s.getState().cards[0].cost, 1); assert.equal(disk.get('renamed').cost, 1); assert.ok(!disk.has('a'));
    await s.getState().redo(); assert.equal(s.getState().cards[0].cost, 7);
    checks.push('rename preserves identity, portrait paths, selection and disk state through undo/redo');
  }
  {
    const { s, disk } = session();
    s.getState().updateCard({ cost: 7 }); await s.getState().undo();
    await s.getState().renameCard('a', 'renamed'); await s.getState().redo();
    assert.equal(disk.get('renamed').cost, 7); assert.equal(s.getState().selectedId, 'renamed');
    checks.push('rename remaps the redo branch as well as undo snapshots');
  }
  {
    const { s, disk, writes } = session();
    s.getState().updateCard({ cost: 9 }); await s.getState().removeCard('a');
    assert.equal(writes[0].cost, 9); assert.ok(!disk.has('a'));
    await s.getState().undo(); assert.deepEqual(s.getState().meta.cards, ['a', 'b']);
    assert.equal(s.getState().selectedId, 'a'); assert.equal(disk.get('a').cost, 9);
    await s.getState().undo(); assert.equal(disk.get('a').cost, 1);
    await s.getState().redo(); assert.equal(disk.get('a').cost, 9);
    await s.getState().redo(); assert.ok(!disk.has('a'));
    await s.getState().undo(); assert.equal(disk.get('a').cost, 9);
    checks.push('delete saves the latest edit and restores card order and earlier editing history');
  }
  {
    const { s } = session(undefined, { deleteCard: async () => { throw new Error('permission denied'); } });
    s.getState().updateCard({ cost: 2 }); await s.getState().persistAll();
    const stack = s.getState().undoStack;
    await assert.rejects(s.getState().removeCard('a'), /permission denied/);
    assert.equal(s.getState().undoStack, stack); assert.equal(s.getState().cards.length, 2); assert.equal(s.getState().historyBusy, false);
    checks.push('failed deletion retains the card and history');
  }
  {
    const { s } = session(undefined, { restoreDeletedCard: async () => { throw new Error('disk full'); } });
    await s.getState().removeCard('a'); const stack = s.getState().undoStack;
    await s.getState().undo(); assert.equal(s.getState().undoStack, stack);
    assert.deepEqual(s.getState().meta.cards, ['b']); assert.equal(s.getState().historyBusy, false);
    assert.match(s.getState().toast, /disk full/);
    checks.push('failed undo retains the deletion entry for retry');
  }
  {
    let release; const waiting = new Promise((r) => { release = r; }); let calls = 0;
    const { s } = session(undefined, { restoreDeletedCard: async () => { calls++; await waiting; } });
    await s.getState().removeCard('a');
    const first = s.getState().undo(); const second = s.getState().undo();
    await new Promise((r) => setImmediate(r));
    s.getState().updateCard({ cost: 55 });
    release(); await Promise.all([first, second]);
    assert.equal(calls, 1); assert.equal(s.getState().cards[0].cost, 1);
    checks.push('overlapping undo clicks apply the disk transaction once');
  }
  {
    const { s } = session();
    s.getState().locateIssue({ message: '', card_id: 'b', tab: 'effects', field: 'on_draw.2.handler' });
    assert.equal(s.getState().selectedId, 'b'); assert.equal(s.getState().propertyTab, 'effects');
    assert.equal(s.getState().fieldFocus.field, 'on_draw.2.handler');
    checks.push('validation navigation retains explicit card, tab and hook field');
  }
  {
    let release; const waiting = new Promise((r) => { release = r; });
    const { s } = session(undefined, { saveCard: async () => waiting, updateProjectMeta: async () => {} });
    const copy = s.getState().duplicateCard('a');
    await new Promise((r) => setImmediate(r));
    await assert.rejects(s.getState().removeCard('a'), /st.operationBusy/);
    release(); await copy;
    assert.equal(s.getState().cards.length, 3); assert.equal(s.getState().historyBusy, false);
    checks.push('card creation cannot race with deletion or history transactions');
  }
  {
    const { workshopSnapshot } = load('workshopSnapshot.ts');
    const meta = { cards: ['a'], last_version: '1' }; const cards = [card('a')];
    const sig = (m = meta, c = cards, v = '1', visibility = 'private', note = '', dep = 1) => workshopSnapshot('D:/test', m, c, v, visibility, note, dep);
    const before = sig(); assert.equal(before, sig({ ...meta, last_version: '2' }));
    for (const next of [sig(meta, cards, '2'), sig(meta, cards, '1', 'public'), sig(meta, cards, '1', 'private', 'updated'), sig(meta, cards, '1', 'private', '', 2), sig(meta, [card('a', 5)])]) assert.notEqual(next, before);
    checks.push('publication snapshot invalidates content, version, visibility, notes and dependencies');
  }
  {
    let release; const waiting = new Promise(resolve => { release = resolve; });
    const imageCalls = [];
    const { s, disk, writes, savePortrait } = session(undefined, {
      savePortrait: async (id, ext) => {
        imageCalls.push([id, ext]);
        if (imageCalls.length === 1) await waiting;
        return `assets/cards/${id}.${ext}`;
      },
    });
    s.getState().select('b'); s.getState().updateCard({ cost: 7 });
    const history = s.getState().undoStack;
    s.getState().select('a');
    const pending = savePortrait('D:/test/current', 'a', new Uint8Array([1]), { ext: 'jpg', bytes: new Uint8Array([2]) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes[0].id, 'b'); assert.equal(writes[0].cost, 7);
    assert.equal(s.getState().selectedId, 'a');
    s.getState().select('b'); s.getState().updateCard({ cost: 99 });
    await assert.rejects(s.getState().openProject('D:/test/next'), /st.operationBusy/);
    await assert.rejects(s.getState().closeProject(), /st.operationBusy/);
    release(); await pending;
    assert.deepEqual(imageCalls, [['a', 'png'], ['a_original', 'jpg']]);
    assert.equal(disk.get('a').portrait_original, 'assets/cards/a_original.jpg');
    assert.equal(s.getState().cards[0].portrait_original, 'assets/cards/a_original.jpg');
    assert.equal(s.getState().selectedId, 'b'); assert.equal(disk.get('b').cost, 7);
    assert.equal(s.getState().undoStack[0], history[0]);
    assert.equal(s.getState().undoStack[1].cardId, 'a');
    assert.equal(s.getState().historyBusy, false); assert.equal(s.getState().portraitRevision, 1);
    assert.deepEqual(s.getState().dirtyIds, []);
    checks.push('portrait saves drain previous edits, fix the target card across selection changes and block project switches');
  }
  {
    const original = { ...card('a'), format_version: 2, source_ref: 'mod:card', override_fields: ['cost'] };
    const { s, disk, savePortrait } = session([original], { savePortrait: async (id, ext) => `assets/cards/${id}.${ext}` });
    await savePortrait('D:/test/current', 'a', new Uint8Array([1]), { ext: 'webp', bytes: new Uint8Array([2]) });
    assert.deepEqual(disk.get('a').override_fields, ['cost', 'portrait', 'portrait_original']);
    assert.equal(disk.get('a').portrait_original, 'assets/cards/a_original.webp');
    await s.getState().undo(); assert.deepEqual(disk.get('a'), original);
    await s.getState().redo(); assert.equal(disk.get('a').portrait_original, 'assets/cards/a_original.webp');
    await savePortrait('D:/test/current', 'a', new Uint8Array([3]));
    assert.equal(disk.get('a').portrait_original, 'assets/cards/a_original.webp');
    assert.deepEqual(disk.get('a').override_fields, ['cost', 'portrait', 'portrait_original']);
    checks.push('source portrait overrides preserve earlier fields and card snapshots round-trip through undo and redo');
  }
  {
    for (const failAt of ['image', 'original', 'card']) {
      let calls = 0;
      const overrides = { savePortrait: async (id, ext) => {
        calls++;
        if (failAt === 'image' || failAt === 'original' && calls === 2) throw new Error('image write failed');
        return `assets/cards/${id}.${ext}`;
      } };
      if (failAt === 'card') overrides.saveCard = async () => { throw new Error('card write failed'); };
      const { s, savePortrait } = session(undefined, overrides);
      const previous = s.getState().cards; const history = s.getState().undoStack;
      await assert.rejects(savePortrait('D:/test/current', 'a', new Uint8Array([1]), { ext: 'jpg', bytes: new Uint8Array([2]) }), /write failed/);
      assert.equal(s.getState().cards, previous); assert.equal(s.getState().undoStack, history);
      assert.equal(s.getState().portraitRevision, 1); assert.equal(s.getState().historyBusy, false);
    }
    checks.push('portrait write failures retain card state and history, refresh overwritten image caches and release the lock');
  }
  {
    let calls = 0;
    const { s, savePortrait } = session(undefined, { savePortrait: async () => { calls++; return ''; } });
    await assert.rejects(savePortrait('D:/test/previous', 'a', new Uint8Array([1])), /st.portraitTargetChanged/);
    await assert.rejects(savePortrait('D:/test/current', 'deleted', new Uint8Array([1])), /st.portraitTargetChanged/);
    assert.equal(calls, 0); assert.equal(s.getState().historyBusy, false); assert.equal(s.getState().portraitRevision, 0);
    checks.push('stale portrait targets are rejected before image writes');
  }
  {
    let calls = 0;
    const { s, savePortrait } = session(undefined, {
      saveCard: async () => { throw new Error('disk full'); },
      savePortrait: async () => { calls++; return ''; },
    });
    s.getState().updateCard({ cost: 7 });
    await assert.rejects(savePortrait('D:/test/current', 'a', new Uint8Array([1])), /st.partialSaveFail/);
    assert.equal(calls, 0); assert.equal(s.getState().historyBusy, false); assert.equal(s.getState().portraitRevision, 0);
    assert.deepEqual(s.getState().dirtyIds, ['a']);
    checks.push('failed pre-save preserves dirty edits before any portrait write');
  }
  {
    const { createThumbnailCache } = load('thumbnails.ts'); const calls = [];
    const cache = createThumbnailCache(async (root, rel) => { calls.push([root, rel]); return root; });
    assert.equal(await cache.load('D:/pack-a', 'assets/cards/a.png', 1), 'D:/pack-a');
    assert.equal(await cache.load('D:/pack-b', 'assets/cards/a.png', 1), 'D:/pack-b');
    await cache.load('D:/pack-a', 'assets/cards/a.png', 1); assert.equal(calls.length, 2);
    await cache.load('D:/pack-a', 'assets/cards/a.png', 2); assert.equal(calls.length, 3);
    checks.push('thumbnail cache isolates same-named images across projects and refreshes overwritten files');
  }
  {
    const { createThumbnailCache } = load('thumbnails.ts'); const calls = [];
    const cache = createThumbnailCache(async (_root, rel) => { calls.push(rel); return rel; }, 2);
    await cache.load('D:/pack', 'a.png', 1);
    await cache.load('D:/pack', 'b.png', 1);
    await cache.load('D:/pack', 'a.png', 1);
    await cache.load('D:/pack', 'c.png', 1);
    await cache.load('D:/pack', 'a.png', 1);
    assert.deepEqual(calls, ['a.png', 'b.png', 'c.png']);
    await cache.load('D:/pack', 'b.png', 1);
    assert.deepEqual(calls, ['a.png', 'b.png', 'c.png', 'b.png']);
    checks.push('thumbnail eviction retains recently accessed entries');
  }
  {
    const { createThumbnailCache } = load('thumbnails.ts');
    let rejectOld; let calls = 0;
    const old = new Promise((_resolve, reject) => { rejectOld = reject; });
    const cache = createThumbnailCache(async () => ++calls === 1 ? old : `image-${calls}`, 1);
    const first = cache.load('D:/pack', 'a.png', 1);
    const rejected = assert.rejects(first, /old failure/);
    await cache.load('D:/pack', 'b.png', 1);
    const replacement = cache.load('D:/pack', 'a.png', 1);
    rejectOld(new Error('old failure')); await rejected;
    assert.equal(await replacement, 'image-3');
    assert.equal(cache.load('D:/pack', 'a.png', 1), replacement);
    assert.equal(calls, 3);
    checks.push('evicted thumbnail request failure preserves a newer request with the same key');
  }
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
}
run().catch((e) => { console.error(e); process.exitCode = 1; });

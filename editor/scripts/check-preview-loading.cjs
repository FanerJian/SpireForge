// Run the real portrait hook with controlled React state/effect and disk boundaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const pause = () => new Promise(resolve => setImmediate(resolve));

function load(file, modules = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(modules[name], `Unexpected dependency: ${name}`);
    return modules[name];
  }, module, module.exports);
  return module.exports;
}

function session() {
  const slots = [];
  const requests = [];
  let cursor = 0;
  let effects = [];
  let arguments_ = [];
  let output;
  let mounted = true;
  let writesAfterUnmount = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, value => {
        if (!mounted) { writesAfterUnmount++; return; }
        slots[index].value = value;
        render(...arguments_);
      }];
    },
    useEffect(setup, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: setup() };
        });
      }
    },
  };
  const api = {
    readPortrait(rel, root) {
      const request = { rel, root };
      const promise = new Promise((resolve, reject) => { request.resolve = resolve; request.reject = reject; });
      requests.push(request);
      return promise;
    },
  };
  const { usePortrait } = load('usePortrait.ts', {
    react, './tauri': { api }, './img': load('img.ts'), './thumbnails': load('thumbnails.ts'),
  });
  function render(...args) {
    arguments_ = args;
    cursor = 0;
    output = usePortrait(...args);
    return output;
  }
  return {
    render, requests,
    commit() { const pending = effects; effects = []; pending.forEach(effect => effect()); },
    current: () => output,
    writesAfterUnmount: () => writesAfterUnmount,
    unmount() { mounted = false; slots.forEach(slot => slot.cleanup?.()); },
  };
}

async function run() {
  const checks = [];
  {
    const hook = session();
    assert.equal(hook.render('D:/pack-a', 'cards/a.png', 1), null); hook.commit();
    hook.requests[0].resolve([1]); await pause();
    assert.equal(hook.current(), 'data:image/png;base64,AQ==');
    for (let i = 0; i < 5; i++) {
      assert.equal(hook.render('D:/pack-a', 'cards/a.png', 1), 'data:image/png;base64,AQ=='); hook.commit();
    }
    assert.equal(hook.requests.length, 1);
    hook.unmount();
    checks.push('repeated renders of the same portrait retain the image and issue one disk read');
  }
  {
    const hook = session();
    hook.render('D:/pack-a', 'cards/a.png', 1); hook.commit();
    hook.requests[0].resolve([1]); await pause();
    assert.equal(hook.render('D:/pack-a', 'cards/a.png', 2), null);
    hook.commit(); assert.equal(hook.requests.length, 2);
    hook.requests[1].resolve([2]); await pause();
    assert.equal(hook.current(), 'data:image/png;base64,Ag==');
    hook.unmount();
    checks.push('portrait revision hides the previous image immediately and reads overwritten data');
  }
  {
    const hook = session();
    hook.render('D:/pack-a', 'cards/shared.png', 1); hook.commit();
    assert.equal(hook.render('D:/pack-b', 'cards/shared.png', 1), null); hook.commit();
    assert.deepEqual(hook.requests.map(({ root, rel }) => [root, rel]), [
      ['D:/pack-a', 'cards/shared.png'], ['D:/pack-b', 'cards/shared.png'],
    ]);
    hook.requests[1].resolve([2]); await pause();
    hook.requests[0].resolve([1]); await pause();
    assert.equal(hook.current(), 'data:image/png;base64,Ag==');
    hook.unmount();
    checks.push('same-named portraits bind each request to its project and ignore late previous-project responses');
  }
  {
    const hook = session();
    hook.render('D:/pack-a', 'cards/a.png', 1); hook.commit();
    hook.requests[0].resolve([1]); await pause();
    assert.equal(hook.render('D:/pack-b', 'cards/a.png', 1), null);
    hook.commit();
    hook.requests[1].reject(new Error('missing portrait')); await pause();
    assert.equal(hook.current(), null);
    hook.unmount();
    checks.push('switching projects hides loaded images before effects run and keeps missing portraits empty');
  }
  {
    const hook = session();
    hook.render('D:/pack-a', 'cards/a.png', 1); hook.commit();
    hook.render('D:/pack-a', 'cards/b.webp', 1); hook.commit();
    hook.requests[1].resolve([3]); await pause();
    hook.requests[0].reject(new Error('late read failure')); await pause();
    assert.equal(hook.current(), 'data:image/webp;base64,Aw==');
    assert.equal(hook.render('D:/pack-a', '', 1), null); hook.commit();
    assert.equal(hook.render(null, 'cards/b.webp', 1), null); hook.commit();
    assert.equal(hook.requests.length, 2);
    hook.unmount();
    checks.push('late failures preserve the current image and empty paths or closed projects skip reads');
  }
  {
    const hook = session();
    hook.render('D:/pack-a', 'cards/a.jpg', 1); hook.commit();
    hook.unmount(); hook.requests[0].resolve([4]); await pause();
    assert.equal(hook.current(), null);
    assert.equal(hook.writesAfterUnmount(), 0);
    checks.push('unmount cleanup discards pending image data');
  }
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
}

run().catch(error => { console.error(error); process.exitCode = 1; });

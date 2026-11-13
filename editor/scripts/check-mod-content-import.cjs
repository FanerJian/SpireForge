const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(dependencies[name], `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

const types = load('types.ts');
const { cardFromRuntime } = load('modContent.ts', { './types': types });
const pool = 'mod:sts2:MegaCrit.Sts2.Core.Models.CardPools.FoolCardPool';
const source = {
  key: 'game:MegaCrit.Sts2.Core.Models.Cards.FoolCard',
  mod_id: 'sts2', entry: 'FOOL_CARD', title: '愚者卡牌', description: '原版说明',
  pool, cost: 1, type: 'Skill', rarity: 'Common', target: 'Self', source: 'sts2',
  keywords: ['Exhaust'], vars: { Block: 5 }, capabilities: ['override_fields'],
};

const copy = cardFromRuntime(source, new Set(['fool_card']), 'zhs', 'copy');
assert.equal(copy.id, 'fool_card_2');
assert.equal(copy.pool, pool);
assert.equal(copy.vanilla_id, undefined);
assert.equal(copy.source_ref, undefined);
assert.equal(copy.content_dependencies, undefined);
assert.deepEqual(copy.effects, []);
assert.equal(copy.description.zhs, '');
assert.deepEqual(copy.keywords, ['Exhaust']);

const override = cardFromRuntime(source, new Set(), 'zhs', 'override');
assert.equal(override.pool, pool);
assert.equal(override.vanilla_id, 'FOOL_CARD');
assert.equal(override.source_ref, source.key);
assert.deepEqual(override.override_fields, []);
assert.deepEqual(override.stats, { Block: 5 });
assert.notEqual(override.stats, source.vars);
assert.equal(override.content_dependencies, undefined);

const thirdParty = cardFromRuntime({
  ...source, key: 'mod:HeroMod:HeroMod.Card', mod_id: 'HeroMod',
  mod_version: '1.2.3', workshop_id: '1234567890123456789', pool: 'mod:HeroMod:HeroMod.Pool',
}, new Set(), 'eng', 'copy');
assert.deepEqual(thirdParty.content_dependencies, [{
  mod_id: 'HeroMod', version: '1.2.3', workshop_id: '1234567890123456789',
}]);
assert.equal(thirdParty.name.eng, source.title);
assert.throws(() => cardFromRuntime({ ...source, capabilities: ['inspect'] }, new Set(), 'zhs', 'copy'));
console.log('PASS runtime card import preserves base-game extension pools, override identity and mod dependencies');

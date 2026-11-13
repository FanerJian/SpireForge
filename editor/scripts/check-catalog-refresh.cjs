// Exercise production catalog builders with a new base-game snapshot and colliding Mod names.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(key => {
    assert.ok(key in dependencies, `Unexpected dependency ${key}`); return dependencies[key];
  }, module, module.exports);
  return module.exports;
}
const powers = load('lib/powers.ts');
const monsters = load('lib/monsters.ts');
const catalog = load('components/pp/catalogs.ts', {
  react: {}, '../../lib/runtimeCatalog': {}, '../../lib/tauri': {},
  '../../lib/powers': powers, '../../lib/monsters': monsters, '../../lib/vfxOrigin': {},
  '../../lib/entry': { cardEntry: (_, id) => id.toUpperCase() },
  '../../lib/i18n': { TYPE_LABEL: {}, pick: (text, lang) => text[lang] },
});
const powerName = powers.POWERS[0].name;
const monsterName = monsters.MONSTERS[0].name;
const runtime = { powers: [
  { name: powerName, title: '新版状态', description: '新版规则', mod_id: 'sts2', key: 'game:power:test' },
  { name: powerName, title: '同名模组状态', mod_id: 'Example', key: 'mod:Example:Power' },
  { name: 'NewPower', title: '新增状态', mod_id: 'sts2', key: 'game:power:new' },
  { name: 'BrokenPower', capabilities: ['inspect'] },
], monsters: [{ name: monsterName, title: '新版敌人', hp: '999', mod_id: 'sts2', key: 'game:monster:test' }], cards: [
  { entry: 'EXISTING', title: '新版卡牌', type: 'Power', mod_id: 'sts2', key: 'game:card:existing' },
  { entry: 'NEW_CARD', title: '新角色卡牌', type: 'Attack', mod_id: 'sts2', key: 'game:card:new_card' },
  { entry: 'EXISTING', title: '同名模组卡牌', type: 'Skill', mod_id: 'Example', key: 'mod:Example:Card' },
] };
const powerItems = catalog.buildPowerCombo('zh', catalog.modPowers(runtime));
assert.equal(powerItems.find(p => p.value === powerName).primary, '新版状态');
assert.match(powerItems.find(p => p.value === powerName).secondary, /新版规则/);
assert.equal(powerItems.find(p => p.value === 'mod:Example:Power').primary, '同名模组状态');
assert.equal(powerItems.find(p => p.value === 'game:power:new').badge, '原版');
assert.equal(powerItems.some(p => p.value === 'BrokenPower'), false);
const monsterItems = catalog.buildMonsterCombo('zh', catalog.modMonsters(runtime));
assert.match(monsterItems.find(m => m.value === monsterName).secondary, /999/);
const args = { cards: [], excludeId: '', packId: '', lang: 'zh', runtime, vanilla: [
  { entry: 'EXISTING', name: '旧版卡牌', type: 'Skill' }, { entry: 'OFFLINE', name: '离线回落卡', type: 'Skill' },
] };
const cardItems = catalog.buildSpawnCombo(args);
assert.equal(cardItems.some(c => c.primary === '旧版卡牌'), false);
for (const value of ['game:card:existing', 'game:card:new_card', 'mod:Example:Card', 'OFFLINE']) assert.ok(cardItems.some(c => c.value === value), value);
assert.equal(catalog.buildSpawnCombo({ ...args, runtime: null }).find(c => c.value === 'EXISTING').primary, '旧版卡牌');
console.log('PASS: current game metadata, stable power/monster references, Mod name isolation, new content, offline fallback');

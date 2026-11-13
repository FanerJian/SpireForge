// Create a separate editable example project from the cross-language rule fixtures.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../editor/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const destination = path.resolve(process.argv[2] || path.join(root, 'work/rule-examples'));
if (fs.existsSync(path.join(destination, 'project.json'))) throw Error('Choose a new example directory.');
const cache = new Map();
function load(file) {
  const absolute = path.resolve(root, 'editor/src', file);
  if (cache.has(absolute)) return cache.get(absolute);
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    if (!name.startsWith('.')) throw Error(`Unexpected dependency ${name}`);
    return load(path.relative(path.join(root, 'editor/src'), path.resolve(path.dirname(absolute), `${name}.ts`)));
  }, module, module.exports);
  cache.set(absolute, module.exports); return module.exports;
}
const { newCard, OFFICIAL_RUNTIME_WORKSHOP_ID } = load('lib/types.ts');
const { RULE_TEMPLATES, rulesEffect } = load('lib/rules.ts');
const { composeCardDescription } = load('lib/description.ts');
const cards = RULE_TEMPLATES.map(template => {
  const card = newCard(`rules_${template.id}`);
  card.name = { zhs: template.label[0], eng: template.label[1] };
  card.effects = [rulesEffect(structuredClone(template.program))];
  card.description = composeCardDescription(card);
  card.pool = 'colorless';
  card.max_upgrade_level = 0;
  if (['combo', 'retrieve'].includes(template.id)) { card.card_type = 'Skill'; card.target = 'None'; }
  return card;
});
const statuses = [...new Map(RULE_TEMPLATES.flatMap(t => t.program.statuses).map(s => [s.id, s])).values()];
const project = { format_version: 3, pack_id: 'RuleExamples', name: '规则能力示例', author: 'SpireForge', description: '组合、动态数值、计数器、共享状态及选牌示例。', cards: cards.map(c => c.id), workshop_id: null, runtime_workshop_id: OFFICIAL_RUNTIME_WORKSHOP_ID, rule_statuses: statuses, rule_templates: RULE_TEMPLATES.map(t => ({ id: t.id, name: t.label[0], program: t.program })) };
fs.mkdirSync(path.join(destination, 'cards'), { recursive: true });
fs.writeFileSync(path.join(destination, 'project.json'), JSON.stringify(project, null, 2) + '\n');
for (const card of cards) fs.writeFileSync(path.join(destination, 'cards', `${card.id}.json`), JSON.stringify(card, null, 2) + '\n');
fs.writeFileSync(path.join(destination, '使用说明.txt'), '使用 SpireForge 0.3.0 打开此目录。\n选择卡牌 → 效果 → 可视化规则 → 展开编辑。\n五张卡覆盖条件分支、格挡动态伤害、回合计数器、回收选牌与共享星火状态。\n规则运行需要 Runtime 0.2.0。示例卡升级上限为0，便于单独观察规则。\n计数器示例按执行规则次数计数；星火在拥有者回合末按当前层数造成伤害，然后衰减1层。\n');
console.log(JSON.stringify({ destination, cards: cards.length, statuses: statuses.length }, null, 2));

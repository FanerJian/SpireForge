// 从 spire-codex 社区数据提取原版卡牌目录 → schema/vanilla-catalog.json
// 数据源：tools/spire-codex/data/{zhs,eng}/cards.json（577 张，v0.111.0 时代数据）
// 用法：node tools/extract-vanilla-catalog.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const zhs = JSON.parse(fs.readFileSync(path.join(root, 'tools/spire-codex/data/zhs/cards.json'), 'utf8'));
const eng = JSON.parse(fs.readFileSync(path.join(root, 'tools/spire-codex/data/eng/cards.json'), 'utf8'));

const engById = new Map(eng.map((c) => [c.id, c]));
const cards = [];
for (const c of zhs) {
  if (!c?.id) continue;
  const e = engById.get(c.id) ?? {};
  cards.push({
    entry: c.id,
    name: c.name ?? '',
    name_en: e.name ?? '',
    desc: c.description_raw || c.description || '',
    desc_en: e.description_raw || e.description || '',
    cost: c.cost ?? null,
    x_cost: !!c.is_x_cost,
    type: c.type_key ?? 'Skill',
    rarity: c.rarity_key ?? 'Common',
    target: c.target ?? 'None',
    color: c.color ?? 'colorless',
    vars: c.vars && typeof c.vars === 'object' ? c.vars : {},
    upgrade: c.upgrade && typeof c.upgrade === 'object' ? c.upgrade : {},
    keywords: Array.isArray(c.keywords) ? c.keywords : [],
  });
}
cards.sort((a, b) => (a.color + a.entry).localeCompare(b.color + b.entry));

const out = { game_version: '0.111.0', source: 'spire-codex', count: cards.length, cards };
const dest = path.join(root, 'schema/vanilla-catalog.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`written ${dest}: ${cards.length} cards`);
console.log('types:', [...new Set(cards.map((c) => c.type))].join(','));
console.log('rarities:', [...new Set(cards.map((c) => c.rarity))].join(','));
console.log('targets:', [...new Set(cards.map((c) => c.target))].join(','));

#!/usr/bin/env node
/** 从反编译源码 + spire-codex zhs 数据生成编辑器的怪物目录（召唤敌人效果用）。
 *  用法：node tools/extract-monster-catalog.mjs
 *  输入：tools/sts2-decompiled/MegaCrit.Sts2.Core.Models.Monsters/*.cs（全部具体 MonsterModel 子类）
 *        tools/spire-codex/data/zhs/monsters.json（官方中文名/HP/分类）
 *  输出：editor/src/lib/monsters.ts（MONSTERS / MONSTER_ZH，拼音排序） */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const monstersDir = join(root, 'tools', 'sts2-decompiled', 'MegaCrit.Sts2.Core.Models.Monsters');
const zhsPath = join(root, 'tools', 'spire-codex', 'data', 'zhs', 'monsters.json');
const outPath = join(root, 'editor', 'src', 'lib', 'monsters.ts');

// 1) 具体怪物类（跳过 abstract；收集文件内全部 class 声明）
const classNames = new Set();
for (const f of readdirSync(monstersDir)) {
  if (!f.endsWith('.cs')) continue;
  const src = readFileSync(join(monstersDir, f), 'utf8');
  if (/abstract class/.test(src)) continue;
  for (const m of src.matchAll(/class\s+(\w+)/g)) {
    classNames.add(m[1]);
  }
}

/** UPPER_SNAKE → PascalCase（zhs 图鉴 id → 类名） */
function toPascal(snake) {
  return snake.toLowerCase().split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

// 2) 以 zhs 官方图鉴为准（真实怪物；反编译目录里的测试 Dummy 等不进目录）
const zhs = JSON.parse(readFileSync(zhsPath, 'utf8'));

const entries = [];
const missed = [];
for (const p of zhs) {
  const cls = toPascal(p.id);
  if (!classNames.has(cls)) {
    missed.push(`${p.id} -> ${cls}`);
    continue;
  }
  entries.push({
    name: cls,
    zh: p.name || cls,
    type: p.type || '',
    hp: [p.min_hp, p.max_hp].every((n) => typeof n === 'number')
      ? String(p.min_hp === p.max_hp ? p.min_hp : `${p.min_hp}-${p.max_hp}`)
      : '',
  });
}

// 4) 拼音排序
const coll = new Intl.Collator('zh-Hans-CN');
entries.sort((a, b) => coll.compare(a.zh, b.zh) || a.name.localeCompare(b.name));

const monsterZh = Object.fromEntries(entries.map((e) => [e.name, e.zh]));

const ts = `/** 游戏怪物目录（${entries.length} 项）——由 tools/extract-monster-catalog.mjs 生成，勿手改。
 *  数据源：反编译 v0.111.0 全部具体 MonsterModel 子类 + spire-codex zhs 官方译名。
 *  name = 类名（Runtime SfMonsterResolver 同时匹配类名与 Id.Entry）；zh 官方中文名。 */
export interface MonsterEntry {
  /** 类名（如 DampCultist），召唤效果的 params.monster 值 */
  name: string;
  /** 官方中文名（如 潮湿邪教徒） */
  zh: string;
  /** 分类：Normal / Elite / Boss / …（可能为空） */
  type: string;
  /** 原生生命区间文本（如 "51-53"，可能为空） */
  hp: string;
}

export const MONSTERS: MonsterEntry[] = ${JSON.stringify(entries, null, 2)};

/** 类名 → 官方中文名 */
export const MONSTER_ZH: Record<string, string> = ${JSON.stringify(monsterZh, null, 2)};
`;

writeFileSync(outPath, ts);
console.log(`monsters: ${entries.length} entries -> ${outPath}`);
if (missed.length) {
  console.log(`zhs ids with no matching class (${missed.length}):`);
  for (const m of missed) console.log('  ' + m);
}

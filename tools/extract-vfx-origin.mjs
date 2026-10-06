#!/usr/bin/env node
/** 从反编译源码提取游戏内置特效/音效的使用者（源自哪张卡/怪物/力量/遗物）。
 *  用法：node tools/extract-vfx-origin.mjs
 *  输入：tools/sts2-decompiled/**.cs（字符串字面量 "vfx/…"、"event:/…"、"xx.mp3/wav/ogg"，
 *        只统计 Cards/Monsters/Powers/Relics 四个目录——命令层的通用演出（VfxCmd 常量表、
 *        CreatureCmd 的格挡/治疗特效等）不算"使用者"）
 *        + schema/vanilla-catalog.json（卡牌中文名）+ spire-codex data/zhs|eng 的
 *          monsters/powers/relics.json（怪物/力量/遗物官方名）
 *  输出：editor/src/lib/vfxOrigin.ts（VFX_USERS / SFX_USERS；特效/音效下拉的使用者行与搜索词）
 *  游戏更新后重跑本脚本即可。 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const decompRoot = join(root, 'tools', 'sts2-decompiled');
const outPath = join(root, 'editor', 'src', 'lib', 'vfxOrigin.ts');

/** 游戏 StringHelper.Slugify：驼峰边界拆分 → 大写 → 非字母数字并成 _（AshenStrike→ASHEN_STRIKE） */
function slugify(name) {
  let s = '';
  for (let i = 0; i < name.length; i++) {
    const prev = name[i - 1];
    const cur = name[i];
    const boundary = i > 0 && /[a-z0-9]/.test(prev) && /[A-Z]/.test(cur);
    s += boundary ? `_${cur}` : cur;
  }
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** UPPER_SNAKE → PascalCase（codex 图鉴 id → 类名） */
function toPascal(snake) {
  return snake.toLowerCase().split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

// ---- 1) 扫描四类目录的字符串字面量 ----
const KINDS = [
  ['card', 'MegaCrit.Sts2.Core.Models.Cards'],
  ['monster', 'MegaCrit.Sts2.Core.Models.Monsters'],
  ['power', 'MegaCrit.Sts2.Core.Models.Powers'],
  ['relic', 'MegaCrit.Sts2.Core.Models.Relics'],
];
const RX = /"([^"\\\n]+)"/g;
const isVfxPath = (s) => s.startsWith('vfx/');
const isSfxEvent = (s) => s.startsWith('event:/');
const isSfxFile = (s) => /\.(mp3|wav|ogg)$/.test(s);

/** usage[kind][literal] = Set<class> */
const usage = { card: new Map(), monster: new Map(), power: new Map(), relic: new Map() };
let filesScanned = 0;
for (const [kind, dirName] of KINDS) {
  const dir = join(decompRoot, dirName);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.cs')) continue;
    const src = readFileSync(join(dir, f), 'utf8');
    filesScanned++;
    const cls = f.slice(0, -3);
    for (const m of src.matchAll(RX)) {
      let s = m[1];
      if (s.startsWith('res://scenes/')) s = s.slice('res://scenes/'.length);
      if (s.endsWith('.tscn')) s = s.slice(0, -5);
      if (!isVfxPath(s) && !isSfxEvent(s) && !isSfxFile(s)) continue;
      let bucket = usage[kind].get(s);
      if (!bucket) usage[kind].set(s, (bucket = new Set()));
      bucket.add(cls);
    }
  }
}

// ---- 2) 类名 → 官方中/英文名 ----
const vanilla = JSON.parse(readFileSync(join(root, 'schema', 'vanilla-catalog.json'), 'utf8'));
const vanillaByEntry = new Map(vanilla.cards.map((c) => [c.entry, c]));
const codexNames = (file) => {
  const zhsP = join(root, 'tools', 'spire-codex', 'data', 'zhs', file);
  const engP = join(root, 'tools', 'spire-codex', 'data', 'eng', file);
  const zhs = existsSync(zhsP) ? JSON.parse(readFileSync(zhsP, 'utf8')) : [];
  const eng = existsSync(engP) ? JSON.parse(readFileSync(engP, 'utf8')) : [];
  return { byPascal: new Map(zhs.map((p) => [toPascal(p.id), p.name])), engById: new Map(eng.map((p) => [p.id, p.name])) };
};
const monsters = codexNames('monsters.json');
const relics = codexNames('relics.json');
const powersZhs = JSON.parse(readFileSync(join(root, 'tools', 'spire-codex', 'data', 'zhs', 'powers.json'), 'utf8'));
const powersEng = existsSync(join(root, 'tools', 'spire-codex', 'data', 'eng', 'powers.json'))
  ? JSON.parse(readFileSync(join(root, 'tools', 'spire-codex', 'data', 'eng', 'powers.json'), 'utf8')) : [];
const powerZhsByPascal = new Map(powersZhs.map((p) => [toPascal(p.id), p.name]));
const powerEngById = new Map(powersEng.map((p) => [p.id, p.name]));

function displayNames(kind, cls) {
  if (kind === 'card') {
    const v = vanillaByEntry.get(slugify(cls));
    return { zh: v?.name || cls, en: v?.name_en || v?.name || cls };
  }
  if (kind === 'monster') {
    const id = slugify(cls);
    return { zh: monsters.byPascal.get(cls) || cls, en: monsters.engById.get(id) || cls };
  }
  if (kind === 'power') {
    const base = cls.endsWith('Power') ? cls.slice(0, -5) : cls;
    return { zh: powerZhsByPascal.get(cls) || powerZhsByPascal.get(base) || cls, en: powerEngById.get(slugify(base)) || base };
  }
  const id = slugify(cls);
  return { zh: relics.byPascal.get(cls) || cls, en: relics.engById.get(id) || cls };
}

// ---- 3) 汇总：literal → 使用者清单（卡/怪/力/遗 统一，按种类+类名排序去重）----
const kindOrder = { card: 0, monster: 1, power: 2, relic: 3 };
function collect(filter) {
  const out = new Map();
  for (const [kind, buckets] of Object.entries(usage)) {
    for (const [literal, classes] of buckets) {
      if (!filter(literal)) continue;
      let users = out.get(literal);
      if (!users) out.set(literal, (users = []));
      for (const cls of classes) {
        const { zh, en } = displayNames(kind, cls);
        users.push({ kind, cls, zh, en });
      }
    }
  }
  for (const users of out.values()) {
    const seen = new Set();
    users.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.cls.localeCompare(b.cls));
    const dedup = users.filter((u) => {
      const k = `${u.kind}:${u.cls}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    users.length = 0;
    users.push(...dedup);
  }
  return out;
}
const vfxUsers = collect(isVfxPath);
const sfxUsers = collect((s) => isSfxEvent(s) || isSfxFile(s));

// ---- 4) 生成 TS ----
function renderTable(name, map) {
  const keys = [...map.keys()].sort();
  if (keys.length === 0) return `export const ${name}: Record<string, OriginUser[]> = {};\n`;
  const body = keys.map((k) => {
    const users = map.get(k).map((u) => `{ kind: '${u.kind}', cls: '${u.cls}', zh: ${JSON.stringify(u.zh)}, en: ${JSON.stringify(u.en)} }`);
    return `  '${k}': [${users.join(', ')}],`;
  });
  return `export const ${name}: Record<string, OriginUser[]> = {\n${body.join('\n')}\n};\n`;
}

const header = `// 本文件由 tools/extract-vfx-origin.mjs 自动生成（扫描 v0.111.0 反编译源码），勿手改。
// 每个游戏内置特效（vfx/… 内路径）/音效（event:/… 或音频文件）的原版使用者：
// 哪张卡、哪只怪物、哪个力量/遗物在用它。特效/音效下拉的使用者行与搜索词数据源。
// 游戏更新后重跑 node tools/extract-vfx-origin.mjs 再生成。
export type OriginKind = 'card' | 'monster' | 'power' | 'relic';
export interface OriginUser { kind: OriginKind; cls: string; zh: string; en: string }
`;

const ts = header + renderTable('VFX_USERS', vfxUsers) + '\n' + renderTable('SFX_USERS', sfxUsers);
writeFileSync(outPath, ts, 'utf8');
console.log(`scanned ${filesScanned} files; vfx paths with users: ${vfxUsers.size}, sfx with users: ${sfxUsers.size}`);
console.log(`written ${outPath}`);

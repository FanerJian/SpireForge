#!/usr/bin/env node
/** 从反编译源码 + spire-codex zhs/eng 数据生成编辑器的完整力量目录。
 *  用法：node tools/extract-power-catalog.mjs
 *  输入：tools/sts2-decompiled/MegaCrit.Sts2.Core.Models.Powers/*.cs（全部具体 PowerModel 子类）
 *        tools/spire-codex/data/zhs/powers.json + data/eng/powers.json（官方名/描述/分类）
 *        tools/spire-codex/backend/static/images/powers/*.png（图标 → 复制到 editor/public/catalog/powers/）
 *  输出：editor/src/lib/powers.ts（POWERS / POWER_ZH / POWER_DEBUFFS，拼音排序） */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const powersDir = join(root, 'tools', 'sts2-decompiled', 'MegaCrit.Sts2.Core.Models.Powers');
const zhsPath = join(root, 'tools', 'spire-codex', 'data', 'zhs', 'powers.json');
const engPath = join(root, 'tools', 'spire-codex', 'data', 'eng', 'powers.json');
const iconDir = join(root, 'tools', 'spire-codex', 'backend', 'static', 'images', 'powers');
const outPublic = join(root, 'editor', 'public', 'catalog', 'powers');
const outPath = join(root, 'editor', 'src', 'lib', 'powers.ts');

// 1) 具体力量类（跳过 abstract）
const classes = [];
for (const f of readdirSync(powersDir)) {
  if (!f.endsWith('.cs') || f === 'PowerModel.cs') continue;
  const src = readFileSync(join(powersDir, f), 'utf8');
  const m = src.match(/class\s+(\w+)/);
  if (!m) continue;
  const [, cls] = m;
  if (/abstract\s+class/.test(src.slice(Math.max(0, src.indexOf(`class ${cls}`) - 200)), src.indexOf(`class ${cls}`) + 40)) continue;
  if (/abstract class/.test(src)) continue;
  classes.push(cls);
}

/** PascalCase → UPPER_SNAKE（与游戏 PowerId 惯例一致） */
function toSnake(pascal) {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

// 2) zhs/eng 官方译名
const zhs = JSON.parse(readFileSync(zhsPath, 'utf8'));
const eng = JSON.parse(readFileSync(engPath, 'utf8'));
const zhsById = new Map(zhs.map((p) => [p.id, p]));
const engById = new Map(eng.map((p) => [p.id, p]));

// 图标目录清单（vulnerable_power.png）
mkdirSync(outPublic, { recursive: true });
const iconFiles = new Set(readdirSync(iconDir).filter((f) => f.endsWith('.png')));

// 3) 合并：解析名 = 类名去掉 Power 后缀（SfPowerResolver 两种形式都认，用短名）
const entries = [];
const missed = [];
let iconsCopied = 0;
for (const cls of [...new Set(classes)].sort()) {
  const short = cls.endsWith('Power') ? cls.slice(0, -5) : cls;
  const snake = toSnake(short).toLowerCase();
  const zhHit = zhsById.get(toSnake(short));
  const enHit = engById.get(toSnake(short));
  const icon = iconFiles.has(`${snake}_power.png`) ? `${snake}_power.png` : '';
  if (icon) {
    copyFileSync(join(iconDir, icon), join(outPublic, icon));
    iconsCopied++;
  }
  if (zhHit || enHit) {
    entries.push({
      name: short,
      en: enHit?.name || short,
      zh: zhHit?.name || short,
      desc: zhHit?.description || '',
      desc_en: enHit?.description || '',
      debuff: (zhHit ?? enHit)?.type === 'Debuff',
      icon,
    });
  } else {
    missed.push(`${cls} (${toSnake(short)})`);
    entries.push({ name: short, en: short, zh: short, desc: '', desc_en: '', debuff: false, icon });
  }
}

// 4) 拼音排序（zh-Hans-CN collation；Node 全量 ICU 下按拼音）
const coll = new Intl.Collator('zh-Hans-CN');
entries.sort((a, b) => coll.compare(a.zh, b.zh) || a.name.localeCompare(b.name));

const powerZh = Object.fromEntries(entries.map((e) => [e.name, e.zh]));
const debuffs = entries.filter((e) => e.debuff).map((e) => e.name);

const ts = `/** 游戏力量目录（${entries.length} 项）——由 tools/extract-power-catalog.mjs 生成，勿手改。
 *  数据源：反编译 v0.111.0 全部具体 PowerModel 子类 + spire-codex zhs/eng 官方数据与图标。
 *  name = SfPowerResolver 可解析名（类名去 Power 后缀）；icon 为 /catalog/powers/ 下的文件名（可空）。 */
export interface PowerEntry {
  /** SfPowerResolver 解析名（如 Vulnerable） */
  name: string;
  /** 官方英文名 */
  en: string;
  /** 官方中文名（如 易伤） */
  zh: string;
  /** 官方中文描述 */
  desc: string;
  /** 官方英文描述 */
  desc_en: string;
  /** 是否减益（默认施加给敌人） */
  debuff: boolean;
  /** 图标文件名（/catalog/powers/<icon>；空 = 无图标） */
  icon: string;
}

export const POWERS: PowerEntry[] = ${JSON.stringify(entries, null, 2)};

/** 解析名 → 官方中文名 */
export const POWER_ZH: Record<string, string> = ${JSON.stringify(powerZh, null, 2)};

/** 全部减益类力量（预填原版效果时默认施加给敌人） */
export const POWER_DEBUFFS: string[] = ${JSON.stringify(debuffs, null, 2)};
`;

writeFileSync(outPath, ts);
console.log(`powers: ${entries.length} entries (${debuffs.length} debuffs, ${iconsCopied} icons) -> ${outPath}`);
if (missed.length) {
  console.log(`no zhs match (${missed.length}):`);
  for (const m of missed) console.log('  ' + m);
}

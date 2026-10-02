#!/usr/bin/env node
/**
 * 从 tools/sts2-decompiled/ 提取 Cmd 命令类的公开静态方法签名，
 * 生成 schema/effects-catalog.json —— 效果目录与编辑器 UI 的数据源。
 *
 * 用法: node extract-cmds.mjs <decompiled-root> <out.json>
 * 游戏更新后重跑: git clone spire-codex（或重新反编译）→ 本脚本 → 比对差异。
 */
import fs from 'node:fs';
import path from 'node:path';

const [root, out] = process.argv.slice(2);
if (!root || !out) {
  console.error('用法: node extract-cmds.mjs <decompiled-root> <out.json>');
  process.exit(2);
}

const cmdDir = path.join(root, 'MegaCrit.Sts2.Core.Commands');
if (!fs.existsSync(cmdDir)) {
  console.error(`未找到 ${cmdDir}，请先反编译 sts2.dll`);
  process.exit(1);
}

// 方法签名解析：public static (async) Task<...> Name(params)
const SIG = /public\s+static\s+(?:async\s+)(?:Task(?:<([\w<>, .?[\]]+)?>)?)\s+(\w+)\s*\(([^)]*)\)/g;

function parseParams(raw) {
  if (!raw.trim()) return [];
  return raw.split(',').map((p) => {
    p = p.trim();
    // 去掉默认值
    const eq = p.indexOf('=');
    if (eq !== -1) p = p.slice(0, eq).trim();
    // 可空标注
    let name = p.split(/\s+/).pop();
    let type = p.slice(0, p.length - name.length).trim();
    const optional = /\w\s*=\s*\S/.test(raw) && p !== raw.split(',').map((x) => x.trim()).find((x) => true);
    return { type, name, optional: /=$/.test(p) || eq !== -1 };
  });
}

const catalog = {};
for (const file of fs.readdirSync(cmdDir)) {
  if (!file.endsWith('.cs')) continue;
  const cls = file.replace('.cs', '');
  const text = fs.readFileSync(path.join(cmdDir, file), 'utf8');
  const methods = [];
  let m;
  for (const line of text.split('\n')) {
    SIG.lastIndex = 0;
    if ((m = SIG.exec(line))) {
      methods.push({
        name: m[2],
        returns: m[1] || 'Task',
        params: parseParams(m[3]),
      });
    }
  }
  if (methods.length) catalog[cls] = methods;
}

// 与编辑器相关的核心命令（效果目录初版）
const CORE = {
  DamageCmd: ['Attack'],
  CreatureCmd: ['Damage', 'GainBlock', 'Heal', 'Kill', 'LoseBlock', 'GainMaxHp', 'LoseMaxHp', 'SetCurrentHp', 'Stun'],
  CardPileCmd: ['Draw', 'Add', 'Move', 'ExhaustCard'],
  PlayerCmd: ['GainEnergy', 'SetEnergy', 'LoseEnergy', 'GainGold', 'LoseGold', 'GainMaxEnergy'],
  PowerCmd: ['Apply'],
};

const result = {
  extractedFrom: 'sts2.dll (decompiled)',
  generatedAt: new Date().toISOString(),
  coreCommands: {},
  allCommands: catalog,
};

for (const [cls, names] of Object.entries(CORE)) {
  result.coreCommands[cls] = (catalog[cls] || []).filter((x) => names.includes(x.name));
}

fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`提取完成: ${Object.keys(catalog).length} 个命令类 → ${out}`);
for (const [cls, ms] of Object.entries(result.coreCommands)) {
  console.log(`  ${cls}: ${ms.map((x) => x.name).join(', ') || '(未匹配)'}`);
}

// 生成自动更新清单 update/latest.json（提交进仓库，随发版推送）。
// 用法（仓库根目录）：
//   node tools/write-update-manifest.mjs editor/src-tauri/target/release/editor.exe 0.2.0 "中文说明" "English notes"
// exe 下载地址按惯例指向 GitHub Release 的裸 exe 资产（SpireForge-editor-v<版本>.exe），
// 另附两个社区加速镜像前缀（国内直连）；应用内下载失败会自动换源。
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [exe, version, zhs = '', eng = ''] = process.argv.slice(2);
if (!exe || !version) {
  console.error('用法: node tools/write-update-manifest.mjs <editor.exe> <版本> [中文说明] [英文说明]');
  process.exit(1);
}
const V = version.replace(/^v/, '');
const size = statSync(exe).size;
const hash = createHash('sha256');
await new Promise((ok, bad) => {
  const s = createReadStream(exe);
  s.on('data', (d) => hash.update(d));
  s.on('end', ok);
  s.on('error', bad);
});
const sha256 = hash.digest('hex');

const asset = `SpireForge-editor-v${V}.exe`;
const gh = `https://github.com/FanerJian/SpireForge/releases/download/v${V}/${asset}`;
const manifest = {
  version: V,
  notes: { zhs, eng },
  pub_date: new Date().toISOString(),
  exe: {
    sha256,
    size,
    urls: [gh, `https://ghfast.top/${gh}`, `https://gh-proxy.com/${gh}`],
  },
};
mkdirSync('update', { recursive: true });
const out = path.join('update', 'latest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`written ${out}  version=${V}  sha256=${sha256.slice(0, 12)}…  size=${size}`);
console.log('发布步骤：GitHub Release v' + V + ' 上传 ' + asset + '（和常规 zip/SHA256SUMS）→ 提交并推送本清单');

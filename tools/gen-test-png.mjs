#!/usr/bin/env node
// 生成纯色测试 PNG（250×190，官方卡面基准尺寸）
// 用法: node gen-test-png.mjs <out.png> [w] [h]
import zlib from 'node:zlib';
import fs from 'node:fs';

const [out, wStr, hStr] = process.argv.slice(2);
const W = Number(wStr) || 250;
const H = Number(hStr) || 190;
if (!out) { console.error('用法: node gen-test-png.mjs <out.png> [w] [h]'); process.exit(2); }

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // color type: RGB
// IDAT：逐行 filter byte 0 + RGB
const row = Buffer.alloc(1 + W * 3);
for (let x = 0; x < W; x++) {
  // 简单渐变（红→蓝），便于肉眼确认
  row[1 + x * 3] = Math.round(200 - (150 * x) / W);
  row[2 + x * 3] = 60;
  row[3 + x * 3] = Math.round((150 * x) / W);
}
const raw = Buffer.concat(Array(H).fill(row));
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(out, png);
console.log(`${out}: ${W}x${H} PNG, ${png.length} bytes`);

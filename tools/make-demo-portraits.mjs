// 示例卡包占位立绘生成器：250×190 纯 Node PNG（无依赖）。
// 用法：node tools/make-demo-portraits.mjs
// 产物：editor/src-tauri/assets/demo/{strike,defend,strength,kaka,echo}.png
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 250, H = 190;

// ---- 最小 PNG 编码（RGB，color type 2）----
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(pixels) {
  // 每行前置 filter 字节 0
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    pixels.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

/** 占位图：底色 + 内边框 + 斜向条纹（一眼能看出是占位图，进了游戏也不难看） */
function placeholder(baseHex, accentHex) {
  const [br, bg, bb] = hex(baseHex);
  const [ar, ag, ab] = hex(accentHex);
  const px = Buffer.alloc(W * H * 3);
  const border = 8;
  const set = (x, y, r, g, b) => {
    const i = (y * W + x) * 3;
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inBorder = x < border || y < border || x >= W - border || y >= H - border;
      const stripe = ((x + y) % 44) < 10;
      if (inBorder) set(x, y, ar, ag, ab);
      else if (stripe) set(x, y, (br + ar) >> 1, (bg + ag) >> 1, (bb + ab) >> 1);
      else set(x, y, br, bg, bb);
    }
  }
  return encodePng(px);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'editor', 'src-tauri', 'assets', 'demo');
mkdirSync(outDir, { recursive: true });

const cards = [
  ['strike', '#7a2f2f', '#a84a4a'],
  ['defend', '#2f5a7a', '#4a7fa8'],
  ['strength', '#6a3f8a', '#8f5fb5'],
  ['kaka', '#8a6a2f', '#b58f4a'],
  ['echo', '#2f7a6a', '#4aa891'],
];

for (const [name, base, accent] of cards) {
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, placeholder(base, accent));
  console.log('wrote', file);
}

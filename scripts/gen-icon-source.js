#!/usr/bin/env node
/**
 * gen-icon-source.js — emit a 1024x1024 PNG to client/src-tauri/icons/icon.png
 * with no external dependencies (uses Node's built-in zlib).
 *
 * This is a placeholder brand icon (Botion blue with a lighter "B" glyph block).
 * Swap in a real logo any time; then regenerate the platform icon set with:
 *   cd client && npx tauri icon src-tauri/icons/icon.png
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const SIZE = 1024;
// Resolve relative to this script (scripts/), not the caller's cwd.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'client/src-tauri/icons/icon.png');
const LOGO_SVG = resolve(ROOT, 'public/logo.svg');

// Preferred path: rasterize the official public/logo.svg (white glyph on the
// brand-blue rounded square) using sharp, if it's available. Falls back to the
// pure-Node drawn icon below when sharp isn't installed.
async function tryRasterizeSvg() {
  if (!existsSync(LOGO_SVG)) return false;
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    return false; // sharp not installed — use fallback
  }
  const svg = readFileSync(LOGO_SVG, 'utf-8')
    // Force the glyph to white so it reads on the blue background.
    .replace(/fill="currentColor"/g, 'fill="#ffffff"');
  const pad = Math.round(SIZE * 0.18);
  const glyph = await sharp(Buffer.from(svg))
    .resize(SIZE - pad * 2, SIZE - pad * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const bg = {
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 37, g: 99, b: 235, alpha: 1 } },
  };
  const png = await sharp(bg)
    .composite([{ input: glyph, gravity: 'centre' }])
    .png()
    .toBuffer();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, png);
  console.log(`wrote ${OUT} from public/logo.svg (${png.length} bytes, ${SIZE}x${SIZE})`);
  return true;
}

// Try the real logo first; only fall back to the drawn glyph if sharp is absent.
if (await tryRasterizeSvg()) {
  process.exit(0);
}

// Botion accent (blue) background, near-white glyph.
const BG = [37, 99, 235];       // #2563eb
const FG = [239, 246, 255];     // #eff6ff

// Draw a chunky "B" using rectangles on a grid (kept simple + recognizable).
function pixel(x, y) {
  // Normalize to a 12x12 design grid.
  const gx = Math.floor((x / SIZE) * 12);
  const gy = Math.floor((y / SIZE) * 12);
  // "B" glyph cells on a 12x12 grid (cols 3..8, rows 2..9).
  const inStem = gx === 3 && gy >= 2 && gy <= 9;
  const inTopBar = gy === 2 && gx >= 3 && gx <= 7;
  const inMidBar = gy === 5 && gx >= 3 && gx <= 7;
  const inBotBar = gy === 9 && gx >= 3 && gx <= 7;
  const inTopBowl = gx === 8 && gy >= 2 && gy <= 5;
  const inBotBowl = gx === 8 && gy >= 5 && gy <= 9;
  const isGlyph = inStem || inTopBar || inMidBar || inBotBar || inTopBowl || inBotBowl;
  return isGlyph ? FG : BG;
}

// Build raw RGBA scanlines with PNG filter byte (0) per row.
const rowBytes = SIZE * 4;
const raw = Buffer.alloc((rowBytes + 1) * SIZE);
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = pixel(x, y);
    raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = 255;
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// CRC32 (PNG spec).
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
ihdr[10] = 0;  // compression
ihdr[11] = 0;  // filter
ihdr[12] = 0;  // interlace

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${png.length} bytes, ${SIZE}x${SIZE})`);

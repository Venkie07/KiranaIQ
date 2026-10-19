import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function writePng(path, width, height, getPixel) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const pixel = getPixel(x, y);
      data[idx] = (pixel >> 16) & 0xff;
      data[idx + 1] = (pixel >> 8) & 0xff;
      data[idx + 2] = pixel & 0xff;
      data[idx + 3] = (pixel >> 24) & 0xff;
    }
  }
  const lines = [];
  for (let y = 0; y < height; y++) {
    const line = data.subarray(y * width * 4, (y + 1) * width * 4);
    const withFilter = new Uint8Array(line.length + 1);
    withFilter[0] = 0;
    withFilter.set(line, 1);
    lines.push(withFilter);
  }
  const compressed = deflateSync(Buffer.concat(lines));

  const chunks = [
    createChunk('IHDR', packIHDR(width, height)),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ];
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  writeFileSync(path, Buffer.concat([header, ...chunks]));
}

function packIHDR(w, h) {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(w, 0);
  buf.writeUInt32BE(h, 4);
  buf[8] = 8;
  buf[9] = 6;
  buf[10] = 0;
  buf[11] = 0;
  buf[12] = 0;
  return buf;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const PURPLE = 0xff6d28d9;
const WHITE = 0xffffffff;
const TRANSPARENT = 0x00000000;

function roundedRectMask(x, y, w, h, r) {
  const dx = Math.max(r - x, 0, x - (w - r));
  const dy = Math.max(r - y, 0, y - (h - r));
  return dx * dx + dy * dy <= r * r;
}

function drawBag(gx, gy, size) {
  const bw = size * 0.4;
  const bh = size * 0.34;
  const bx = gx - bw / 2;
  const by = gy - bh / 2;
  return function(x, y) {
    if (x < bx || x > bx + bw || y < by || y > by + bh) return TRANSPARENT;
    const rr = size * 0.04;
    if (roundedRectMask(x - bx, y - by, bw, bh, rr)) return WHITE;
    if (roundedRectMask(x - bx, y - by, bw, bh, rr - 1)) return WHITE;
    return TRANSPARENT;
  };
}

function drawHandle(gx, gy, size) {
  const hx = gx;
  const hy = gy - size * 0.3;
  const R = size * 0.16;
  const r = size * 0.11;
  return function(x, y) {
    const dx = x - hx;
    const dy = y - hy;
    const d2 = dx * dx + dy * dy;
    if (d2 <= R * R && d2 >= r * r && dy <= 0) return WHITE;
    return TRANSPARENT;
  };
}

function makeIcon(size, maskable) {
  const margin = maskable ? size * 0.15 : 0;
  const innerSize = size - margin * 2;
  const centerX = margin + innerSize / 2;
  const centerY = margin + innerSize / 2;
  const r = Math.round(innerSize * 0.18);

  const bag = drawBag(centerX, centerY, innerSize);
  const handle = drawHandle(centerX, centerY, innerSize);

  return function(x, y) {
    if (x < margin || x >= size - margin || y < margin || y >= size - margin) return TRANSPARENT;
    const relX = x - margin;
    const relY = y - margin;
    const corner = roundedRectMask(relX, relY, innerSize, innerSize, r);
    if (!corner) return TRANSPARENT;
    const b = bag(x, y);
    if (b !== TRANSPARENT) return b;
    const h = handle(x, y);
    if (h !== TRANSPARENT) return h;
    return PURPLE;
  };
}

function faviconSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="2" y="2" width="28" height="28" rx="6" fill="#6D28D9"/>
  <path d="M10 14h12v10c0 1.1-.9 2-2 2H12c-1.1 0-2-.9-2-2V14z" fill="white"/>
  <path d="M16 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" fill="white" fill-opacity="0.2"/>
</svg>`;
}

const outDir = join(process.cwd(), 'public', 'icons');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

[192, 512].forEach(function(s) {
  const fn = makeIcon(s, false);
  writePng(join(outDir, 'icon-' + s + '.png'), s, s, fn);
  console.log('Generated icon-' + s + '.png');
});

[192, 512].forEach(function(s) {
  const fn = makeIcon(s, true);
  writePng(join(outDir, 'maskable-' + s + '.png'), s, s, fn);
  console.log('Generated maskable-' + s + '.png');
});

writeFileSync(join(process.cwd(), 'public', 'favicon.svg'), faviconSvg());
console.log('Generated favicon.svg');

const appleIcon = makeIcon(180, false);
writePng(join(process.cwd(), 'public', 'apple-touch-icon.png'), 180, 180, appleIcon);
console.log('Generated apple-touch-icon.png');

console.log('All icons generated.');
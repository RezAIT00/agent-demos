const zlib = require('zlib');
const fs = require('fs');
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, cr]);
}
function writePNG(path, w, h, rgb) {
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
// draw wedge result into an rgb tile
function drawCrystal(res, W, rgb, stride, ox, oy, size, uptoStep, viewR) {
  const R = res.R, key = W.key;
  const S3 = Math.sqrt(3);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = (px + 0.5 - size / 2) / (size / 2) * viewR;
    const y = (py + 0.5 - size / 2) / (size / 2) * viewR;
    let r = y * 2 / S3, q = x - r / 2, s = -q - r;
    let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs; else rs = -rq - rr;
    const u = Math.abs(rq), v = Math.abs(rr), w = Math.abs(rs);
    const hi = Math.max(u, v, w), lo = Math.min(u, v, w), mid = u + v + w - hi - lo;
    let col = [8, 12, 22];
    if (hi <= R) {
      const k = key[mid * (R + 2) + lo];
      const at = res.attachStep[k];
      if (at >= 0 && at <= uptoStep) {
        const m = Math.min(1, Math.max(0, res.attachMass[k] / 2.2));
        const g = 40 + 215 * m;
        col = [g * 0.82, g * 0.92, g];
      }
    }
    const o = ((oy + py) * stride + ox + px) * 3;
    rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2];
  }
}
module.exports = { writePNG, drawCrystal };

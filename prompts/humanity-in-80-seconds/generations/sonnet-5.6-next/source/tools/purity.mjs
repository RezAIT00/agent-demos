// PURITY: renderAt(t) must depend on t alone. Two separate browser sessions render
// the same frames in different orders (one forwards, one shuffled with unrelated
// frames in between) and every pair of frames must be pixel-identical.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, ROOT } from './cdp.mjs';

const FRAMES = [];
for (let k = 5; k < 1920; k += 47) FRAMES.push(k);
FRAMES.push(0, 1560, 1569, 1919);
const session = async (order, noise, tag) => {
  const b = await launch({ tag });
  const out = new Map();
  try {
    await b.open(path.join(ROOT, 'index.html'), '?capture=1');
    for (const k of order) {
      if (noise) await b.evaluate(`renderAt(${((k * 7919 + 13) % 1920)}/24); 1`);
      const url = await b.evaluate(`renderAt(${k}/24); document.getElementById('film').toDataURL('image/png')`);
      out.set(k, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    }
  } finally { await b.close(); }
  return out;
};
const rgb = (png) => spawnSync('ffmpeg', ['-v', 'error', '-f', 'png_pipe', '-i', '-', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { input: png, maxBuffer: 1 << 26 }).stdout;

const forward = [...FRAMES].sort((a, b) => a - b);
const shuffled = [...FRAMES].sort((a, b) => ((a * 2654435761) % 1009) - ((b * 2654435761) % 1009));
const A = await session(forward, false, 'pureA');
const B = await session(shuffled, true, 'pureB');

let exact = 0;
const diffs = [];
for (const k of forward) {
  if (A.get(k).equals(B.get(k))) { exact++; continue; }
  const a = rgb(A.get(k)), b = rgb(B.get(k));
  let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
  for (let i = 0; i < a.length; i += 3) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (!d) continue;
    n++; max = Math.max(max, d);
    const px = (i / 3) % 1920, py = Math.floor(i / 3 / 1920);
    x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
  }
  if (n === 0) exact++; else diffs.push({ k, n, max, box: `${x0},${y0}-${x1},${y1}` });
}
const text = 'PURITY CHECK - renderAt(t) depends only on t\n' +
  `${FRAMES.length} frames, two separate browser sessions; session A in order, session B shuffled with an unrelated frame before each one.\n` +
  `pixel-identical: ${exact}/${FRAMES.length}\n` +
  diffs.map((d) => `  frame ${d.k} (t=${(d.k / 24).toFixed(3)}): ${d.n} pixels differ, max ${d.max}/255, box ${d.box}\n`).join('') +
  `OVERALL: ${diffs.length ? 'FAIL' : 'PASS'}\n`;
fs.writeFileSync(path.join(ROOT, 'purity.txt'), text);
console.log(text);
if (diffs.length) process.exitCode = 1;

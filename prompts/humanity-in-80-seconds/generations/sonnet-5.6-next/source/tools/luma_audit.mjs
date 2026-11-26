// LUMA AND FLASH AUDIT of the finished MP4.
//  * brightness pops: sudden frame-to-frame jumps in mean luma, and one-frame blips
//  * flashes (WCAG 2.x general and red flash), measured on the whole frame and on
//    each of 48 tiles - stricter than the WCAG area rule, which needs a quarter of
//    a 10-degree field to flash together
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';

const video = path.resolve(ROOT, process.argv[2] || 'humanity_2100.mp4');
const W = 192, H = 108, GX = 8, GY = 6, N = W * H * 3;
const lin = new Float64Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });

const luma = [], tiles = [], reds = [];
const ff = spawn('ffmpeg', ['-v', 'error', '-i', video, '-vf', `scale=${W}:${H}:flags=area:in_color_matrix=bt709:in_range=tv:out_range=full,format=rgb24`, '-f', 'rawvideo', '-']);
let buf = Buffer.alloc(0);
for await (const chunk of ff.stdout) {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= N) {
    const f = buf.subarray(0, N);
    let y = 0;
    const t = new Float64Array(GX * GY + 1), red = new Float64Array(GX * GY + 1), red8 = new Float64Array(GX * GY + 1);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const p = (j * W + i) * 3, r = f[p], g = f[p + 1], b = f[p + 2];
      y += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const R = lin[r], G = lin[g], B = lin[b];
      const rel = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      const k = Math.floor(j * GY / H) * GX + Math.floor(i * GX / W);
      t[k] += rel; t[GX * GY] += rel;
      const saturated = R / (R + G + B + 1e-9) >= 0.8 ? 1 : 0;
      const val = Math.max(0, (R - G - B) * 320);
      red[k] += val * saturated; red8[k] += saturated; red[GX * GY] += val * saturated; red8[GX * GY] += saturated;
    }
    const per = (W / GX) * (H / GY);
    for (let k = 0; k <= GX * GY; k++) { const n = k === GX * GY ? W * H : per; t[k] /= n; red[k] /= n; red8[k] /= n; }
    luma.push(y / (W * H)); tiles.push(t); reds.push({ v: red, s: red8 });
    buf = buf.subarray(N);
  }
}
const F = luma.length;

// transitions: swings of at least `delta` from the last turning point
function flashes(series, delta, darkLimit) {
  const marks = [];
  let lo = series[0], hi = series[0], dir = 0;
  for (let i = 1; i < series.length; i++) {
    const v = series[i];
    if (dir <= 0) {                 // looking for a rise
      if (v < lo) lo = v;
      if (v - lo >= delta && lo < darkLimit) { marks.push({ i, d: 1 }); dir = 1; hi = v; continue; }
    }
    if (dir >= 0) {                 // looking for a fall
      if (v > hi) hi = v;
      if (hi - v >= delta && v < darkLimit) { marks.push({ i, d: -1 }); dir = -1; lo = v; }
    }
  }
  let most = 0, at = 0;
  for (let s = 0; s < series.length; s++) {
    const n = marks.filter((m) => m.i >= s && m.i < s + 24).length;
    const f = Math.floor(n / 2);              // a flash is a pair of opposing changes
    if (f > most) { most = f; at = s; }
  }
  return { most, at: at / 24, transitions: marks.length };
}
let gen = { most: 0, at: 0 }, genTile = -1;
for (let k = 0; k <= GX * GY; k++) {
  const r = flashes(tiles.map((t) => t[k]), 0.10, 0.80);
  if (r.most > gen.most) { gen = r; genTile = k; }
}
const whole = flashes(tiles.map((t) => t[GX * GY]), 0.10, 0.80);
let redMost = 0;
for (let k = 0; k <= GX * GY; k++) {
  // tile mean of (R-G-B)x320 over saturated-red pixels: it already scales with area
  const series = reds.map((r) => r.v[k]);
  redMost = Math.max(redMost, flashes(series, 20, 1e9).most);
}

const deltas = luma.map((v, i) => (i ? v - luma[i - 1] : 0));
const maxStep = deltas.reduce((m, d, i) => (Math.abs(d) > Math.abs(m.d) ? { d, i } : m), { d: 0, i: 0 });
// places where the brightness is meant to move fast
const INTENDED = [
  [26.2, 27.9, 'the first dawn rising from the horizon'],
  [44.7, 45.4, 'carried through the dark'], [46.75, 47.35, 'carried through the dark'], [48.65, 49.4, 'carried through the dark'], [51.6, 52.5, 'carried through the dark'],
  [59.6, 59.99, 'the 1945 light swelling (no flash: it rises over a third of a second)'], [59.95, 60.84, 'carried through the dark, from 1945 to a living room (transition runs 60.01-60.83)'],
  [61.0, 61.4, 'push into the television'], [61.7, 62.35, 'carried through the dark, from the Moon to a village'],
  [62.7, 63.5, 'pull back from the evening village to the night planet'],
  [56.15, 56.76, 'the lamp-lit scene burning away into the war (transition runs 56.15-56.75)'],
  [65.0, 65.95, 'the 2026 line crossing the frame'], [65.4, 66.3, 'travelling from the night room out into morning'],
];
const why = (t) => { const hit = INTENDED.find(([a, b]) => t >= a && t <= b); return hit ? hit[2] : null; };
const big = deltas.map((d, i) => ({ d, i, t: i / 24 })).filter((x) => Math.abs(x.d) > 5);
const unexplained = big.filter((x) => !why(x.t));
// a pop: one frame that jumps out and straight back
const blips = [];
for (let i = 1; i < F - 1; i++) {
  const a = luma[i] - luma[i - 1], b = luma[i] - luma[i + 1];
  if (a * b > 0 && Math.min(Math.abs(a), Math.abs(b)) > 2.0) blips.push({ i, a, b });
}

const lines = [];
const verdict = [];
const check = (name, ok, detail) => { verdict.push(ok); lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  [${detail}]`); };
check('1,920 frames measured', F === 1920, `${F}`);
check('no one-frame brightness pops (out and back by > 2 of 255)', blips.length === 0, blips.length ? blips.slice(0, 6).map((x) => `frame ${x.i}: ${x.a.toFixed(1)}`).join(', ') : 'none');
check('no unexplained jump in mean luma (> 5 of 255 between frames)', unexplained.length === 0, unexplained.length ? unexplained.slice(0, 8).map((x) => `t=${x.t.toFixed(3)} d=${x.d.toFixed(1)}`).join(', ') : `largest step anywhere ${maxStep.d.toFixed(2)} at t=${(maxStep.i / 24).toFixed(3)} s`);
check('no single-frame step anywhere above 20 of 255, intended or not', Math.abs(maxStep.d) <= 20, `largest ${maxStep.d.toFixed(2)} at t=${(maxStep.i / 24).toFixed(3)} s`);
check('general flashes: at most 3 in any one second (whole frame)', whole.most <= 3, `worst ${whole.most}`);
check('general flashes: at most 3 in any one second (worst of 48 tiles)', gen.most <= 3, `worst ${gen.most}${genTile >= 0 ? ` in tile ${genTile} near t=${gen.at.toFixed(2)} s` : ''}`);
check('saturated-red flashes: at most 3 in any one second', redMost <= 3, `worst ${redMost}`);

let txt = `LUMA AND FLASH AUDIT - ${path.basename(video)}\n${'='.repeat(70)}\n`;
txt += `mean luma over the film: min ${Math.min(...luma).toFixed(1)}, max ${Math.max(...luma).toFixed(1)} (0-255)\n\n`;
txt += lines.join('\n') + `\n\nOVERALL: ${verdict.every(Boolean) ? 'PASS' : 'FAIL'}\n`;
txt += `\nframe-to-frame steps above 5/255, with their cause (${big.length}):\n`;
txt += big.map((x) => `  t=${x.t.toFixed(3)}  step ${x.d >= 0 ? '+' : ''}${x.d.toFixed(2)}  ${why(x.t) || 'UNEXPLAINED'}`).join('\n') || '  none';
txt += '\n\nmean luma per second (first frame of each):\n';
for (let s = 0; s < 80; s += 10) txt += `  ${String(s).padStart(2)}s: ` + Array.from({ length: 10 }, (_, k) => luma[(s + k) * 24].toFixed(0).padStart(4)).join('') + '\n';
fs.writeFileSync(path.join(ROOT, 'luma_audit.txt'), txt);
console.log(txt.split('\nframe-to-frame')[0]);
if (!verdict.every(Boolean)) process.exitCode = 1;

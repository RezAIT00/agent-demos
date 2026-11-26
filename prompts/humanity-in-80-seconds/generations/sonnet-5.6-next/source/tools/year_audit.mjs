// YEAR AUDIT: checks the time rule on all 1,920 frames and writes year_audit.txt.
//
// It does not trust the film's own helpers:
//   * the expected schedule is parsed out of the rate table printed in TREATMENT.md;
//   * the expected on-screen strings come from a formatter written here from the
//     documented rounding rules;
//   * the counter pixels the page draws are compared with a reference drawn from
//     those expected strings;
//   * every frame of the finished MP4 is then matched against the same reference,
//     and the same test is shown to reject deliberately wrong numbers.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, ROOT } from './cdp.mjs';

const FPS = 24, FRAMES = 1920, SLOTS = 80;
const CROP = { x: 72, y: 50, w: 712, h: 164 };      // year line + rate line
const video = path.resolve(ROOT, process.argv[2] || 'humanity_2100.mp4');

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : '')); };

// ---- 1. the schedule as written in TREATMENT.md ----------------------------
const doc = fs.readFileSync(path.join(ROOT, 'TREATMENT.md'), 'utf8');
const table = doc.split('<!-- TABLE:START -->')[1].split('<!-- TABLE:END -->')[0];
const spec = [];
for (const line of table.split('\n')) {
  const m = /^\| (\d+) \| \[\d+, \d+\) \| ([\d,]+) \| .*?\((-?\d+)\) \| .*?\((-?\d+)\) \|/.exec(line);
  if (m) spec.push({ slot: +m[1], rate: Number(m[2].replace(/,/g, '')), start: +m[3], end: +m[4] });
}
check('TREATMENT.md table has 80 slots, numbered 0..79', spec.length === SLOTS && spec.every((s, i) => s.slot === i));
check('every rate is a whole number of years per second, at least 1', spec.every((s) => Number.isInteger(s.rate) && s.rate >= 1));
const bounds = [spec[0].start];
for (const s of spec) bounds.push(bounds[bounds.length - 1] + s.rate);
const sum = spec.reduce((a, s) => a + s.rate, 0);
const START_BCE = 300000, END_CE = 2100;
const span = (START_BCE - 1) + 1 + (END_CE - 1);   // to 1 BCE, across to 1 CE (no year 0), to 2100 CE
check('rates add up to the span, with no year 0', sum === span, `sum ${sum} = ${START_BCE - 1} + 1 + ${END_CE - 1} = ${span}`);
check('table start/end columns chain exactly', spec.every((s, i) => s.start === bounds[i] && s.end === bounds[i + 1]));
check('counter starts at 300,000 BCE (astronomical -299999) and ends at 2100', bounds[0] === 1 - START_BCE && bounds[SLOTS] === END_CE);
check('rate never rises (the documented curve)', spec.every((s, i) => i === 0 || s.rate <= spec[i - 1].rate));

// ---- 2. an independent formatter -------------------------------------------
const commas = (n) => { let s = String(n), out = ''; while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); } return s + out; };
function expectYear(counter) {
  const y = Math.floor(counter + 0.5000001);
  if (y > 0) return `${y} CE`;
  const n = 1 - y;
  return n >= 10000 ? `c. ${commas(Math.round(n / 100) * 100)} BCE` : `c. ${n} BCE`;
}
const expectRate = (r) => `1 second = ${r >= 1000 ? commas(r) : r} year${r === 1 ? '' : 's'}`;
const expCounter = (k) => { const slot = Math.floor(k / FPS); return bounds[slot] + spec[slot].rate * (k - slot * FPS) / FPS; };

// ---- 3. the page itself ------------------------------------------------------
const browser = await launch({ tag: 'audit' });
const rows = [];
const masks = [];
const decoys = [];
try {
  await browser.open(path.join(ROOT, 'index.html'), '?capture=1');
  await browser.evaluate(`window.__setupAudit = function(){
    const C = ${JSON.stringify(CROP)};
    const mk = (w,h,cpu) => { const c = document.createElement('canvas'); c.width=w; c.height=h; return c.getContext('2d', cpu ? {willReadFrequently:true} : undefined); };
    // the reference uses the same CPU rasteriser as the film's own layers
    const refFull = mk(1920,1080,true), actCrop = mk(C.w,C.h,true), refCrop = mk(C.w,C.h,true);
    const bits = (img) => {                       // pixels fully covered by bright ink
      const d = img.data, out = new Uint8Array(Math.ceil(C.w*C.h/8));
      for (let i=0;i<C.w*C.h;i++) if (d[i*4+3] >= 250 && Math.max(d[i*4],d[i*4+1],d[i*4+2]) > 150) out[i>>3] |= 1 << (i&7);
      let s=''; for (let i=0;i<out.length;i+=0x8000) s += String.fromCharCode.apply(null, out.subarray(i,i+0x8000));
      return btoa(s);
    };
    const reference = (t, ys, rs) => {
      refFull.setTransform(1,0,0,1,0,0); refFull.clearRect(0,0,1920,1080);
      HUD.counter(refFull, t, ys, rs);
      refCrop.clearRect(0,0,C.w,C.h); refCrop.drawImage(refFull.canvas, C.x, C.y, C.w, C.h, 0, 0, C.w, C.h);
      return refCrop.getImageData(0,0,C.w,C.h);
    };
    window.__frame = (k, expYear, expRate, decoyYear, decoyRate) => {
      const t = k / 24;
      const drawn = renderAt(t);
      actCrop.clearRect(0,0,C.w,C.h); actCrop.drawImage(GFX.layers.hud.canvas, C.x, C.y, C.w, C.h, 0, 0, C.w, C.h);
      const a = actCrop.getImageData(0,0,C.w,C.h).data;
      const ref = reference(t, expYear, expRate), r = ref.data;
      let ink = 0, wrong = 0;
      for (let i=0;i<C.w*C.h;i++) {
        if (r[i*4+3] < 252 || Math.max(r[i*4],r[i*4+1],r[i*4+2]) < 150) continue;
        ink++;
        if (Math.abs(a[i*4]-r[i*4]) > 6 || Math.abs(a[i*4+1]-r[i*4+1]) > 6 || Math.abs(a[i*4+2]-r[i*4+2]) > 6) wrong++;
      }
      const res = { year: drawn.year, rate: drawn.rate, yearAt: yearAt(t), rateAt: rateAt(t), ink, wrong, mask: bits(ref) };
      if (decoyYear) res.decoy = bits(reference(t, decoyYear, decoyRate));
      return res;
    };
    return 1;
  }; __setupAudit()`);

  for (let k = 0; k < FRAMES; k++) {
    const c = expCounter(k), slot = Math.floor(k / FPS);
    const ey = expectYear(c), er = expectRate(spec[slot].rate);
    let dy = null, dr = null;
    if (k % 40 === 7 || k === FRAMES - 1) {         // negative control: one wrong digit
      dr = er;
      dy = ey.replace(/(\d)(?=[^\d]*$)/, (d) => String((Number(d) + 8) % 10));
      if (/,\d00 BCE$/.test(ey)) dy = ey.replace(/,(\d)00 BCE$/, (_, d) => `,${(Number(d) + 8) % 10}00 BCE`);
    }
    const r = await browser.evaluate(`__frame(${k}, ${JSON.stringify(ey)}, ${JSON.stringify(er)}, ${JSON.stringify(dy)}, ${JSON.stringify(dr)})`);
    masks.push(Buffer.from(r.mask, 'base64'));
    if (r.decoy) decoys[k] = { mask: Buffer.from(r.decoy, 'base64'), text: dy };
    rows.push({ k, t: k / FPS, slot, ey, er, ...r, mask: undefined, decoy: undefined });
    if (k % 240 === 0) console.log(`  page frame ${k}`);
  }

  // dense samples of the two functions, independent of frame times
  const dense = await browser.evaluate(`(() => { const out = []; for (let n=0;n<80;n++) for (const f of [0, 1e-6, 0.25, 0.5, 0.75, 0.999999]) out.push([n, f, yearAt(n+f), rateAt(n+f)]); const b=[]; for (let n=0;n<=80;n++) b.push(yearAt(n)); return {out, b, d: window.DURATION}; })()`);
  check('window.DURATION is 80', dense.d === 80);
  check('yearAt(n) is exact at all 81 slot boundaries', dense.b.every((v, n) => v === bounds[n]), 'strict equality with the table');
  check('rateAt is the table rate throughout every slot (6 samples per slot)', dense.out.every(([n, , , r]) => r === spec[n].rate && Number.isInteger(r) && r >= 1));
  check('yearAt is linear inside every slot', dense.out.every(([n, f, y]) => Math.abs(y - (bounds[n] + spec[n].rate * f)) < 1e-6));
} finally { await browser.close(); }

check('1,920 frames audited', rows.length === FRAMES);
check('counter never goes backwards (strictly rises every frame)', rows.every((r, i) => i === 0 || r.yearAt > rows[i - 1].yearAt));
check('yearAt matches the table on every frame', rows.every((r) => Math.abs(r.yearAt - expCounter(r.k)) < 1e-6));
check('rateAt is whole, >= 1 and constant across all 24 frames of each slot', rows.every((r) => r.rateAt === spec[r.slot].rate && Number.isInteger(r.rateAt) && r.rateAt >= 1));
const badY = rows.filter((r) => r.year !== r.ey || r.year !== expectYear(r.yearAt));
const badR = rows.filter((r) => r.rate !== r.er || r.rate !== expectRate(r.rateAt));
check('year string drawn on screen matches yearAt(t) on every frame', badY.length === 0, badY.length ? `first bad frame ${badY[0].k}` : '');
check('rate string drawn on screen matches rateAt(t) on every frame', badR.length === 0, badR.length ? `first bad frame ${badR[0].k}` : '');
const worstPx = Math.max(...rows.map((r) => r.wrong / Math.max(1, r.ink)));
check('counter pixels on the HUD layer equal a reference of the expected strings', rows.every((r) => r.ink > 1500 && r.wrong / r.ink < 0.001), `ink px per frame >= ${Math.min(...rows.map((r) => r.ink))}, worst mismatch ${(worstPx * 100).toFixed(3)}%`);
check('first frame reads "c. 300,000 BCE"', rows[0].year === 'c. 300,000 BCE', rows[0].year);
check('final frame (1919) reads "2100 CE"', rows[FRAMES - 1].year === '2100 CE', rows[FRAMES - 1].year);
check('counter reaches 2026 exactly at t = 65.000 s', bounds[65] === 2026);

// ---- 4. the finished video ----------------------------------------------------
const mp4 = [];
const decoyScores = [];
if (fs.existsSync(video)) {
  const { w, h } = CROP, N = w * h;
  const bit = (m, i) => (m[i >> 3] >> (i & 7)) & 1;
  // correlation between "should be ink" and brightness, over ink and its dark surround
  const score = (mask, gray) => {
    const near = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!bit(mask, y * w + x)) continue;
      for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) near[yy * w + xx] = 1;
      }
    }
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, inkSum = 0, ink = 0, offSum = 0, off = 0;
    for (let i = 0; i < N; i++) {
      const m = bit(mask, i);
      if (!m && !near[i]) continue;
      const v = gray[i];
      n++; sx += m; sy += v; sxx += m; syy += v * v; sxy += m * v;
      if (m) { ink++; inkSum += v; } else { off++; offSum += v; }
    }
    const corr = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy) || 1);
    return { corr, contrast: inkSum / ink - offSum / off };
  };
  const ff = spawn('ffmpeg', ['-v', 'error', '-i', video, '-vf', `crop=${w}:${h}:${CROP.x}:${CROP.y},format=gray`, '-f', 'rawvideo', '-']);
  let buf = Buffer.alloc(0), k = 0;
  for await (const chunk of ff.stdout) {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= N) {
      const gray = buf.subarray(0, N);
      if (k < FRAMES) {
        mp4.push(score(masks[k], gray));
        if (decoys[k]) decoyScores.push({ k, right: mp4[k].corr, wrong: score(decoys[k].mask, gray).corr, text: decoys[k].text });
      }
      buf = buf.subarray(N);
      k++;
    }
  }
  const minCorr = Math.min(...mp4.map((s) => s.corr)), minCon = Math.min(...mp4.map((s) => s.contrast));
  check('MP4 decodes to exactly 1,920 frames', k === FRAMES, `${k} frames`);
  check('MP4: the expected counter text is on screen in every frame', mp4.length === FRAMES && minCorr > 0.62 && minCon > 55, `lowest correlation ${minCorr.toFixed(3)}, lowest ink/surround contrast ${minCon.toFixed(0)} of 255`);
  const beaten = decoyScores.filter((d) => d.right > d.wrong + 0.002).length;
  check('negative control: a one-digit-wrong year always scores lower than the right one', beaten === decoyScores.length, `${beaten}/${decoyScores.length} frames; smallest margin ${Math.min(...decoyScores.map((d) => d.right - d.wrong)).toFixed(4)}`);
} else check('MP4 present for on-screen check', false, video);

// ---- 5. report ------------------------------------------------------------------
const pass = results.every((r) => r.ok);
let txt = `YEAR AUDIT - The Same Fire\n${'='.repeat(78)}\n`;
txt += `video: ${path.basename(video)}\n`;
txt += 'counter convention: astronomical years (1 CE = 1, 1 BCE = 0, N BCE = 1 - N)\n';
txt += 'display rule: y = floor(counter + 0.5); y <= 0 shown "c. N BCE" with N = 1 - y,\n';
txt += '              N >= 10,000 rounded to the nearest 100; y >= 1 shown "y CE"\n\n';
txt += results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`).join('\n');
txt += `\n\nOVERALL: ${pass ? 'PASS' : 'FAIL'} (${results.filter((r) => r.ok).length}/${results.length} checks)\n\n`;
txt += 'ALL FRAMES\n frame |   t (s)  | slot |  rate |  yearAt(t) (astronomical) | drawn year        | drawn rate                 | HUD px bad | MP4 corr | ok\n';
for (const r of rows) {
  const ok = r.year === r.ey && r.rate === r.er && r.wrong / r.ink < 0.001;
  txt += `${String(r.k).padStart(6)} | ${r.t.toFixed(4).padStart(8)} | ${String(r.slot).padStart(4)} | ${String(r.rateAt).padStart(5)} | ${r.yearAt.toFixed(4).padStart(25)} | ${r.year.padEnd(17)} | ${r.rate.padEnd(26)} | ${String(r.wrong).padStart(10)} | ${mp4[r.k] ? mp4[r.k].corr.toFixed(3).padStart(8) : '     n/a'} | ${ok ? 'ok' : 'BAD'}\n`;
}
fs.writeFileSync(path.join(ROOT, 'year_audit.txt'), txt);
console.log(`\nOVERALL: ${pass ? 'PASS' : 'FAIL'}  ->  year_audit.txt`);
if (!pass) process.exitCode = 1;

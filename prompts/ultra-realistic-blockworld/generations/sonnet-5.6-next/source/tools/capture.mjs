// Deterministic offline capture of the cinematic through window.renderAt(t).
//   node tools/capture.mjs --stills 1,3.5,8 --dir tools/film [--ss 2 --spp 8]
//   node tools/capture.mjs --from 0 --to 1800 --out blockworld.mp4 [--ss 2 --spp 8]
//   node tools/capture.mjs --verify 8.0          (renders the same frame twice and compares)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { serve, EDGE, GPU_ARGS, ROOT } from './serve.mjs';
import { writePNG } from './png.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ss = +opt('ss', 2), spp = +opt('spp', 8), W = 1920, H = 1080, BYTES = W * H * 4;

let sink = null;
const { server, port } = await serve((req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/frame')) return false;
  const parts = [];
  req.on('data', (d) => parts.push(d));
  req.on('end', async () => {
    const buf = Buffer.concat(parts);
    if (buf.length !== BYTES) { res.writeHead(400); res.end('bad size ' + buf.length); return; }
    await sink(buf);
    res.writeHead(200); res.end('ok');
  });
  return true;
});

const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: [...GPU_ARGS, '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || /WebGL|context lost/i.test(m.text())) errors.push(m.text().slice(0, 600)); });
page.on('pageerror', (e) => errors.push(e.message));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/blockworld.html?demo=1&capture=1&ss=${ss}&spp=${spp}`);
await page.waitForFunction(() => window.__demoReady === true || window.__fatal, null, { timeout: 240000 });
const info = await page.evaluate(() => ({ gpu: window.__ashlar.gpuName, preset: window.__ashlar.Q.name, internal: [window.__ashlar.Pipeline.W, window.__ashlar.Pipeline.H] }));
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(1), 's', JSON.stringify(info));
if (/swiftshader|llvmpipe|basic render/i.test(info.gpu)) throw new Error('software renderer: ' + info.gpu);

const render = (t) => page.evaluate(async ([t, url]) => {
  const t0 = performance.now();
  const r = await window.renderAt(t);
  const t1 = performance.now();
  const px = window.__demo.pixels();
  const res = await fetch(url, { method: 'POST', body: px });
  if (!res.ok) throw new Error(await res.text());
  return { shot: r.shot, render: t1 - t0, send: performance.now() - t1 };
}, [t, '/frame']);

const flipToRGBA = (buf) => { const out = Buffer.alloc(BYTES); for (let y = 0; y < H; y++) buf.copy(out, y * W * 4, (H - 1 - y) * W * 4, (H - y) * W * 4); for (let i = 3; i < BYTES; i += 4) out[i] = 255; return out; };

if (opt('verify')) {
  const t = +opt('verify');
  const hashes = [];
  sink = async (buf) => { hashes.push(crypto.createHash('sha256').update(buf).digest('hex')); fs.writeFileSync(path.join(ROOT, 'tools', `verify_${hashes.length}.raw`), buf); };
  await render(t); await render(Math.min(29.9, t + 2.3)); await render(t);
  const a = fs.readFileSync(path.join(ROOT, 'tools', 'verify_1.raw')), b = fs.readFileSync(path.join(ROOT, 'tools', 'verify_3.raw'));
  let diff = 0, max = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) diff++; if (d > max) max = d; }
  console.log('re-render identical:', hashes[0] === hashes[2], '| differing bytes', diff, '| max delta', max);
  for (const i of [1, 2, 3]) fs.unlinkSync(path.join(ROOT, 'tools', `verify_${i}.raw`));
} else if (opt('stills')) {
  const dir = path.resolve(ROOT, opt('dir', 'tools/film'));
  fs.mkdirSync(dir, { recursive: true });
  for (const s of opt('stills').split(',')) {
    const t = +s;
    let name = path.join(dir, `f_${t.toFixed(2).padStart(5, '0')}.png`);
    sink = async (buf) => writePNG(name, W, H, flipToRGBA(buf));
    const r = await render(t);
    console.log('t', t, 'shot', r.shot + 1, 'render', (r.render / 1000).toFixed(2), 's ->', path.basename(name));
  }
} else {
  const from = +opt('from', 0), to = +opt('to', 1800), out = path.resolve(ROOT, opt('out', 'blockworld.mp4'));
  const stillFrames = new Set((opt('png', '') || '').split(',').filter(Boolean).map((v) => Math.round(+v * 60)));
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '60', '-i', '-',
    '-vf', 'vflip,scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', opt('crf', '17'), '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  let frame = from;
  sink = (buf) => new Promise((res) => {
    if (stillFrames.has(frame)) { fs.mkdirSync(path.join(ROOT, 'stills'), { recursive: true }); writePNG(path.join(ROOT, 'stills', `film_${(frame / 60).toFixed(2).padStart(5, '0')}s.png`), W, H, flipToRGBA(buf)); }
    if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res);
  });
  const start = Date.now();
  for (; frame < to; frame++) {
    const r = await render(frame / 60);
    if (frame % 60 === 0 || frame === to - 1) {
      const n = frame - from + 1, el = (Date.now() - start) / 1000;
      console.log(`frame ${frame} shot ${r.shot + 1} | ${(el / n).toFixed(3)} s/frame | elapsed ${el.toFixed(0)} s | eta ${((el / n) * (to - frame - 1)).toFixed(0)} s`);
    }
  }
  ff.stdin.end();
  await done;
  console.log('wrote', path.relative(ROOT, out), (fs.statSync(out).size / 1e6).toFixed(1), 'MB in', ((Date.now() - start) / 1000).toFixed(0), 's');
}
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].slice(0, 12).join('\n'));
await browser.close(); server.close();

// Frame-exact capture: headless Edge -> raw RGBA -> ffmpeg.
// Plumbing adapted from an earlier project's capture script (visuals are this film's own).
//   node tools/cap.mjs --times 1.2,3 --out out/s            stills (PNG)
//   node tools/cap.mjs --times 1.2,3 --out out/s --tw 960   scaled stills
//   node tools/cap.mjs --from 0 --to 87.5 --out out/video.mp4
//   node tools/cap.mjs --every 2 --tile 5x9 --tw 384 --out contact_sheet.png
//   node tools/cap.mjs --eval "JSON.stringify(TIMELINE())"
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const A = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = n; i++; } }
}
const W = 1920, H = 1080, fps = 24;
const port = 8700 + Math.floor(Math.random() * 800), dport = port + 1000;
build();
let waiter = null;
const srv = http.createServer((q, r) => {
  if (q.method === 'POST') { const ch = []; q.on('data', d => ch.push(d)); q.on('end', () => { r.end('ok'); waiter && waiter(Buffer.concat(ch)); }); return; }
  r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(root, 'index.html')));
}).listen(port, '127.0.0.1');
const prof = path.join(root, 'out', '.edgeprof' + port);
fs.mkdirSync(prof, { recursive: true });
const br = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=' + dport, '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-component-update', '--disable-domain-reliability',
  '--disable-gpu-watchdog', '--force-high-performance-gpu', ...(A.gpu2d ? [] : ['--disable-accelerated-2d-canvas']), '--use-angle=d3d11', '--ignore-gpu-blocklist', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
async function connect() {
  for (let i = 0; i < 100; i++) {
    try {
      const l = await (await fetch('http://127.0.0.1:' + dport + '/json')).json();
      const p = l.find(x => x.type === 'page');
      if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; }); return; }
    } catch { /* browser still starting */ }
    await sleep(150);
  }
  throw new Error('no browser');
}
const send = (m, p = {}) => new Promise((a, b) => { const i = ++id; pend.set(i, [a, b]); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
async function ev(x) {
  const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function cleanup(code) {
  try { send('Browser.close'); } catch { /* already closed */ }
  await sleep(600);
  try { br.kill(); } catch { /* only the browser this script started */ }
  srv.close(); await sleep(700);
  try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* profile still locked */ }
  process.exit(code);
}
try {
  await connect();
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { const [a, b] = pend.get(d.id); pend.delete(d.id); d.error ? b(new Error(JSON.stringify(d.error))) : a(d.result); }
    else if (d.method === 'Runtime.consoleAPICalled') console.log('[page]', d.params.args.map(x => x.value ?? x.description).join(' ').slice(0, 4000));
    else if (d.method === 'Runtime.exceptionThrown') console.log('[EXC]', d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  };
  await send('Runtime.enable'); await send('Page.enable');
  const load = async () => {
    await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/?capture=1' });
    for (let i = 0; i < 600; i++) {
      await sleep(100);
      try { const s = await ev('window.READY===true?"r":(window.FAILED||"")'); if (s === 'r') return; if (s) throw new Error('FAILED ' + s); }
      catch (e) { if (String(e.message).startsWith('FAILED')) throw e; }
    }
    throw new Error('page not ready');
  };
  await load();
  if (!A.quiet) console.log('GPU:', await ev('gpuName()'));
  const grab1 = async t => {
    const p = new Promise(r => { waiter = r; });
    await ev(`(async()=>{renderAt(${t});const b=readFrame();await fetch("/f",{method:"POST",body:b});})()`);
    return p;
  };
  const grab = async t => {
    for (let k = 0; ; k++) {
      try { return await grab1(t); }
      catch (e) { console.log('retry frame', t, e.message.slice(0, 900)); if (k >= 2) throw e; await sleep(1200); await load(); }
    }
  };
  if (A.eval) console.log(await ev(A.eval));
  const ff = args => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', String(fps), '-i', '-', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = f => new Promise(r => f.on('close', r));
  const feed = async (f, b) => { if (!f.stdin.write(b)) await new Promise(r => f.stdin.once('drain', r)); };
  const T0 = Date.now(); let cnt = 0;
  if (A.probe) {
    // render each time twice with different histories and describe the difference
    for (const ts of String(A.probe).split(',')) {
      const t = +ts;
      await grab(Math.max(0, t - 1 / 24)); const a = Buffer.from(await grab(t));
      const a2 = Buffer.from(await grab(t));
      await grab((t + 41.7) % 87); const b = Buffer.from(await grab(t));
      const cmp = (x, y) => { let n = 0, mx = 0, big = 0, x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0; for (let i = 0; i < x.length; i += 4) { const d = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])); if (d) { n++; if (d > mx) mx = d; if (d > 8) { big++; const px = (i / 4) % W, py = H - 1 - Math.floor(i / 4 / W); if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; } } } return `${n} px differ, max ${mx}, ${big} px over 8` + (big ? ` box ${x0},${y0}-${x1},${y1}` : ''); };
      console.log(t.toFixed(3), '| repeat:', cmp(a, a2), '| other history:', cmp(a, b));
      if (A.dump) for (const [nm, buf] of [['a', a], ['b', b]]) { const f = ff(['-frames:v', '1', '-vf', 'vflip', `out/probe_${nm}.png`]); f.stdin.end(buf); await done(f); }
      cnt++;
    }
  } else if (A.thumb) {
    const p = new Promise(r => { waiter = r; });
    await ev('(async()=>{renderThumb();const b=readFrame();await fetch("/f",{method:"POST",body:b});})()');
    const b = await p; const f = ff(['-frames:v', '1', '-vf', 'vflip', A.thumb]); f.stdin.end(b); await done(f); cnt++;
  } else if (A.strip) {
    // frames for the listed times (or from:to:step) tiled into one image
    let times = [];
    if (String(A.strip).includes(':')) { const [a, b, s] = String(A.strip).split(':').map(Number); for (let t = a; t <= b + 1e-6; t += s) times.push(Math.round(t * fps) / fps); }
    else times = String(A.strip).split(',').map(Number);
    const cols = +(A.cols || 4), rows = Math.ceil(times.length / cols);
    const f = ff(['-vf', `vflip,scale=${A.tw || 480}:-1:flags=lanczos,tile=${cols}x${rows}:padding=4:margin=4:color=0x808090`, '-frames:v', '1', A.out]);
    for (const t of times) { await feed(f, await grab(t)); cnt++; }
    f.stdin.end(); await done(f);
  } else if (A.times) {
    for (const ts of String(A.times).split(',')) {
      const t = +ts, b = await grab(t);
      const vf = 'vflip' + (A.tw ? ',scale=' + A.tw + ':-1:flags=lanczos' : '') + (A.crop ? ',crop=' + A.crop : '');
      const f = ff(['-frames:v', '1', '-vf', vf, (A.out || 'out/s') + '_' + t.toFixed(2) + '.png']);
      f.stdin.end(b); await done(f); cnt++;
    }
  } else if (A.every) {
    const dur = await ev('DURATION'), times = [];
    for (let t = +(A.offset ?? 1); t < dur; t += +A.every) times.push(t);
    const cols = +(A.tile || '5x9').split('x')[0], rows = Math.ceil(times.length / cols);
    const f = ff(['-vf', `vflip,scale=${A.tw || 384}:-1:flags=lanczos,tile=${cols}x${rows}:padding=6:margin=6:color=0x05060f`, '-frames:v', '1', A.out]);
    for (const t of times) { await feed(f, await grab(t)); cnt++; }
    f.stdin.end(); await done(f);
  } else if (A.to !== undefined) {
    const from = +(A.from || 0), to = +A.to, first = Math.round(from * fps), n = Math.round((to - from) * fps);
    const f = ff(['-vf', 'vflip,scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p',
      '-c:v', 'libx264', '-preset', A.preset || 'slow', '-crf', A.crf || '16',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', A.out]);
    const hashes = [];
    for (let i = 0; i < n; i++) {
      const b = await grab((first + i) / fps);
      if (A.hashes) hashes.push(crypto.createHash('sha1').update(b).digest('hex'));
      await feed(f, b); cnt++;
      if (i % 96 === 95) console.log(`frame ${i + 1}/${n}  ${((Date.now() - T0) / cnt / 1000).toFixed(3)} s/frame`);
    }
    f.stdin.end(); await done(f);
    if (A.hashes) fs.writeFileSync(A.hashes, JSON.stringify({ first, hashes }));
  } else if (A.verify) {
    // determinism: re-render frames in a scrambled order and compare with the film pass
    const ref = JSON.parse(fs.readFileSync(A.verify, 'utf8'));
    const idx = [];
    for (let i = 7; i < ref.hashes.length; i += +(A.step || 53)) idx.push(i);
    idx.sort((a, b) => ((a * 7919) % 1009) - ((b * 7919) % 1009));
    let same = 0; const bad = [];
    for (const i of idx) {
      const b = await grab((ref.first + i) / fps);
      if (crypto.createHash('sha1').update(b).digest('hex') === ref.hashes[i]) same++; else bad.push(i);
      cnt++;
    }
    console.log(`determinism: ${same}/${idx.length} frames bit-identical when re-rendered out of order`, bad.length ? 'differ: ' + bad.join(',') : '');
  }
  if (cnt) console.log('done', cnt, 'frames', ((Date.now() - T0) / cnt / 1000).toFixed(3), 's/frame');
  const errs = await ev('window.ERRS.slice(0,6).join("\\n")');
  if (errs) console.log('PAGE ERRORS:\n' + errs);
  await cleanup(0);
} catch (e) { console.log('ERR', e.message.slice(0, 3000)); await cleanup(1); }

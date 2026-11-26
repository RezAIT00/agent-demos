// Frame-exact capture: headless Edge (WebGL2) -> raw RGBA -> ffmpeg.
// Plumbing adapted from an earlier project's capture script.
//   node tools/cap.mjs --times 1.2,3 --out tmp/s              stills (tmp/s_1.200.png)
//   node tools/cap.mjs --times 1.2,3 --tw 640 --tile 4x2 --out tmp/grid.png   labelled grid
//   node tools/cap.mjs --from 0 --to 72 --fps 24 --out tmp/video.mp4
//   node tools/cap.mjs --png "renderCharacterSheet()" --out character_sheet.png
//   node tools/cap.mjs --eval "verifyRig()"
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url'; import { build } from './build.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); process.chdir(root);
const A = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = n; i++; } } }
const W = 1920, H = 1080, fps = +(A.fps || 24);
build();
fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
let waiter = null;
const srv = http.createServer((q, r) => {
  if (q.method === 'POST') { const ch = []; q.on('data', d => ch.push(d)); q.on('end', () => { r.end('ok'); waiter && waiter(Buffer.concat(ch)); }); return; }
  r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(root, 'index.html')));
});
// OS-assigned ports only: several sessions may be capturing on this machine at once
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const prof = path.join(root, 'tmp', 'edgeprof-' + process.pid + '-' + port); fs.mkdirSync(prof, { recursive: true });
const br = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-gpu-watchdog', '--force-high-performance-gpu', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
// the debug port is read from this run's own profile folder, so we can only ever attach to the browser we started
async function connect() { for (let i = 0; i < 400; i++) { try { const dport = +fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0]; const l = await (await fetch('http://127.0.0.1:' + dport + '/json')).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; }); return; } } catch (e) { } await sleep(150); } throw new Error('no browser'); }
const send = (m, p = {}) => new Promise((a, b) => { const i = ++id; pend.set(i, [a, b]); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
async function cleanup(code) { if (ws) { try { send('Browser.close').catch(() => { }); } catch (e) { } } await sleep(600); try { br.kill(); } catch (e) { } srv.close(); await sleep(800); try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch (e) { } process.exit(code); }
try {
  await connect();
  ws.onmessage = m => {
    const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const [a, b] = pend.get(d.id); pend.delete(d.id); d.error ? b(new Error(JSON.stringify(d.error))) : a(d.result); }
    else if (d.method === 'Runtime.consoleAPICalled') { console.log('[page]', d.params.args.map(x => x.value ?? x.description).join(' ').slice(0, 5000)); }
    else if (d.method === 'Runtime.exceptionThrown') { console.log('[EXC]', (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 3000)); }
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:' + port + (A.preview ? '/' : '/?capture=1') });
  let ok = false; for (let i = 0; i < 600; i++) { await sleep(100); try { const s = await ev('window.READY===true?"r":(window.FAILED||"")'); if (s === 'r') { ok = true; break; } if (s) { console.log('FAILED', s.slice(0, 8000)); break; } } catch (e) { } }
  if (!ok) throw new Error('page not ready');
  if (A.gpu) console.log(await ev('(()=>{const g=document.getElementById("c").getContext("webgl2");const e=g.getExtension("WEBGL_debug_renderer_info");return g.getParameter(e.UNMASKED_RENDERER_WEBGL)})()'));
  const grab = async t => { const p = new Promise(r => waiter = r); await ev('(async()=>{renderAt(' + t + ');const b=await readFrame();await fetch("/f",{method:"POST",body:b});})()'); return p; };
  if (A.eval) console.log(JSON.stringify(await ev(A.eval), null, A.pretty ? 1 : 0));
  if (A.evalfile) { fs.writeFileSync(A.out, JSON.stringify(await ev(A.evalfile))); console.log('wrote', A.out); }
  if (A.png) { const url = await ev(A.png); fs.writeFileSync(A.out, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', A.out); }
  const ff = args => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', String(fps), '-i', '-', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = f => new Promise(r => f.on('close', r));
  const T0 = Date.now(); let cnt = 0;
  if (A.times) {
    const times = String(A.times).split(',').map(Number);
    if (A.tile) {
      const f = ff(['-vf', 'vflip,scale=' + (A.tw || 480) + ':-1:flags=lanczos,tile=' + A.tile + ':padding=4:color=white', '-frames:v', '1', A.out]);
      for (const t of times) { const b = await grab(t); if (!f.stdin.write(b)) await new Promise(r => f.stdin.once('drain', r)); cnt++; }
      f.stdin.end(); await done(f);
    } else for (const t of times) { const b = await grab(t); const f = ff(['-frames:v', '1', '-vf', 'vflip' + (A.tw ? ',scale=' + A.tw + ':-1:flags=lanczos' : ''), (A.out || 'tmp/s') + '_' + t.toFixed(3) + '.png']); f.stdin.end(b); await done(f); cnt++; }
  } else if (A.to) {
    const from = +(A.from || 0), to = +A.to; const n = Math.round((to - from) * fps); const first = Math.round(from * fps);
    const f = ff(['-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p', '-c:v', 'libx264', '-preset', A.preset || 'slow', '-crf', A.crf || '16', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', A.out]);
    for (let i = 0; i < n; i++) { const b = await grab((first + i) / fps); if (!f.stdin.write(b)) await new Promise(r => f.stdin.once('drain', r)); cnt++; if (i % 120 === 119) console.log('frame ' + (i + 1) + '/' + n + '  ' + ((Date.now() - T0) / cnt / 1000).toFixed(3) + ' s/frame'); }
    f.stdin.end(); await done(f);
  }
  if (cnt) console.log('done', cnt, 'frames', ((Date.now() - T0) / Math.max(cnt, 1) / 1000).toFixed(3), 's/frame');
  const errs = await ev('window.ERRS?window.ERRS.slice(0,6).join("\\n---\\n"):""'); if (errs) console.log('PAGE ERRORS:\n' + errs);
  await cleanup(0);
} catch (e) { console.log('ERR', e.message.slice(0, 6000)); await cleanup(1); }

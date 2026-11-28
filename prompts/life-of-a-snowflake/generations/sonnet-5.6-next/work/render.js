// Frame-by-frame capture of snowflake.html -> snowflake.mp4
//   node render.js [--out ../snowflake.mp4] [--res 2160] [--frames 600]
// Each frame is posed with window.renderAt(i/30), read back as raw RGBA at 2x,
// posted to a local server and piped into ffmpeg (Lanczos downscale, H.264).
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { startServer, openFilm, ROOT } = require('./serve.js');

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : dflt; };
const RES = +arg('res', 2160), FRAMES = +arg('frames', 600), FPS = 30;
const OUT = path.resolve(__dirname, arg('out', path.join(ROOT, 'snowflake.mp4')));

(async () => {
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'warning',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${RES}x${RES}`, '-r', String(FPS), '-i', '-',
    '-vf', 'vflip,scale=1080:1080:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-x264-params', 'aq-mode=3:deblock=-1,-1',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(FPS), '-an', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((resolve, reject) => ff.on('close', (code) => code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code))));

  const hashes = [];
  let expected = 0;
  const { server, port } = await startServer(async (i, buf) => {
    if (i !== expected) throw new Error(`frame ${i} arrived, expected ${expected}`);
    if (buf.length !== RES * RES * 4) throw new Error('short frame ' + buf.length);
    expected++;
    hashes.push(crypto.createHash('sha1').update(buf).digest('hex'));
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  });
  const t0 = Date.now();
  const { browser, page, errors } = await openFilm(port, `?render=1&res=${RES}`, false);
  try {
    await page.waitForFunction('window.__ready === true || window.__error', null, { timeout: 180000 });
    const err = await page.evaluate('window.__error || null');
    if (err) throw new Error(err);
    const info = await page.evaluate('window.filmInfo');
    console.log('ready', JSON.stringify(info));
    if (/swiftshader|software|basic render/i.test(info.gpu)) throw new Error('not on the real GPU: ' + info.gpu);
    const t1 = Date.now();
    for (let i = 0; i < FRAMES; i++) {
      await page.evaluate(async ([i, t]) => {
        window.renderAt(t);
        const r = await fetch('/frame?i=' + i, { method: 'POST', body: window.grabFrame() });
        if (!r.ok) throw new Error(await r.text());
      }, [i, i / FPS]);
      if (i % 60 === 59) console.log(`frame ${i + 1}/${FRAMES}  ${((Date.now() - t1) / (i + 1)).toFixed(0)} ms/frame`);
    }
    // spot check: re-render a few frames out of order and compare pixel hashes
    let mismatches = 0;
    const checks = [450, 37, 551, 250, 3, 599, 540];
    for (let k = 0; k < 25; k++) checks.push((k * 233 + 11) % 600);   // a shuffled sweep of the whole film
    for (let k = checks.length - 1; k >= 0; k--) if (checks[k] >= FRAMES) checks.splice(k, 1);
    for (const i of checks) {
      const h = await page.evaluate(async (t) => {
        window.renderAt(t);
        const d = await crypto.subtle.digest('SHA-1', window.grabFrame());
        return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }, i / FPS);
      if (h !== hashes[i]) { mismatches++; console.log('re-render differs at frame', i); }
    }
    console.log(`determinism: ${checks.length} frames re-rendered out of order, ${mismatches} mismatches`);
    const unique = new Set(hashes).size;
    console.log(`unique frames: ${unique}/${hashes.length}`);
    const real = errors.filter((e) => !/404|toNonIndexed/.test(e));
    console.log('page errors/warnings:', real.length ? real.slice(0, 5) : 'none');
    fs.writeFileSync(path.join(__dirname, 'render_report.json'), JSON.stringify({ info, frames: FRAMES, res: RES, seconds: (Date.now() - t0) / 1000, mismatches, unique }, null, 2));
  } finally {
    ff.stdin.end();
    await browser.close();
    server.close();
  }
  await ffDone;
  console.log('wrote', OUT, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
})().catch((e) => { console.error(e.message || e); process.exit(1); });

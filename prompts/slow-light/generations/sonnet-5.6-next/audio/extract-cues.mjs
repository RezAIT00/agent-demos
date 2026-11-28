// Pull every cue from the film's own code, running in the same renderer that made the video.
//   node audio/extract-cues.mjs        ->  audio/cues.json
// slow-light.html is not modified: a temporary copy gets one read-only export line appended.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const audioDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(audioDir, '..');
const { chromium } = createRequire(path.join(root, 'tools', 'package.json'))('playwright-core');

let html = fs.readFileSync(path.join(root, 'slow-light.html'), 'utf8');
const inject = (find, repl) => { if (!html.includes(find)) throw new Error('probe anchor missing: ' + find); html = html.replace(find, repl); };
inject('return { group: mesh, update };', 'return { group: mesh, update, list: moths, geometry: painted };');
inject('  window.ready = true;', `  window.__film = { C_LIGHT, DURATION, cameraAt, LAMPS, MIRROR, DRIPS, fallTime, groundBase, HERO, CAFE, W_NEARL, W_FARL, W_NEARR, W_FARR, ENDW, neonLocal, moths, shared, gMain, gRG, gRM, renderer, RES, REFL };
  window.ready = true;`);
const work = path.join(audioDir, '_work'); fs.mkdirSync(work, { recursive: true });
const probe = path.join(work, 'film-probe.html'); fs.writeFileSync(probe, html);

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 500)));
  await page.goto(pathToFileURL(probe).href + '?render=1&samples=2');
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const gpu = await page.evaluate(() => window.gpuInfo);
  if (/swiftshader|software/i.test(gpu)) throw new Error('software WebGL: ' + gpu);
  console.log(gpu);

  // ── geometry, timing, camera, actors ──
  const base = await page.evaluate(() => {
    const F = window.__film;
    const a = v => v.toArray().map(x => +x.toFixed(5));
    const camera = [];
    for (let i = -300; i <= 2100; i++) { const t = i / 100; const c = F.cameraAt(t); camera.push([t, ...a(c.pos), ...a(c.tgt)]); }
    const lamps = F.LAMPS.map(l => ({ name: l.name, pos: a(l.pos), on: l.on, off: l.off }));
    const ub = F.HERO.ub;
    const points = {
      switch: a(F.HERO.p(ub - 0.862, 6.552, 0.092)),          // the fingertip target used by the figure
      bulb: a(F.LAMPS[0].pos), lantern: a(F.LAMPS[1].pos), neonSign: a(F.neonLocal(0, 0)),
      mirror: a(F.MIRROR.c), mirrorNormal: a(F.MIRROR.n),
      heroDownpipe: a(F.HERO.p(0.1, 0.25, 0.2)), cafeDownpipe: a(F.W_FARR.p(5.98, 0.25, 0.2)),
    };
    const walls = [['hero', F.HERO, 9.6], ['nearLeft', F.W_NEARL, 10.4], ['farLeft', F.W_FARL, 8.4], ['nearRight', F.W_NEARR, 9.1], ['cafe', F.CAFE, 8.8], ['farRight', F.W_FARR, 9.8], ['end', F.ENDW, 6.5]]
      .map(([name, f, h]) => ({ name, o: a(f.o), U: a(f.U), N: a(f.N), len: +f.len.toFixed(4), h }));
    // drips: the same schedule that draws the drops and starts the ripples
    const drips = F.DRIPS.map(([x, y, z, period, phase]) => ({ x, y, z, period, phase, fall: F.fallTime(y), water: F.groundBase(x, z) + 0.0045 < 0 }));
    // moths: sample the film's own animation at known emission times
    const moths = F.moths.list.map(m => ({ lamp: m.lamp, flapHz: m.f, track: [] }));
    const P = F.moths.geometry.attributes.position;
    for (let i = 0; i <= 1000; i++) {
      const e = i / 50;
      for (const lamp of [0, 1]) {
        const cam = F.cameraAt(e).pos;
        F.moths.update(e + F.LAMPS[lamp].pos.distanceTo(cam) / F.C_LIGHT, cam);   // so that its pose time is e
        F.moths.list.forEach((m, j) => {
          if (m.lamp !== lamp) return;
          let x = 0, y = 0, z = 0; for (const k of [j * 12, j * 12 + 3, j * 12 + 6, j * 12 + 9]) { x += P.getX(k); y += P.getY(k); z += P.getZ(k); }
          moths[j].track.push([+(x / 4).toFixed(3), +(y / 4).toFixed(3), +(z / 4).toFixed(3)]);
        });
      }
    }
    return { cLight: F.C_LIGHT, duration: F.DURATION, camera, lamps, points, walls, drips, moths, mothTrackHz: 50 };
  });

  // the neon stutter is defined in the shader: read its numbers from there
  const stutterSrc = html.slice(html.indexOf('float neonStutter(float a){'), html.indexOf('vec2 lampProfile'));
  const edge = +stutterSrc.match(/float e=([0-9.]+);/)[1];
  const gaps = [...stutterSrc.matchAll(/s01\(\(a-([0-9.]+)\)\/e\)\*\(1\.-s01\(\(a-([0-9.]+)\)\/e\)\)/g)].map(m => [+m[1], +m[2]]);
  const depth = +stutterSrc.match(/return 1\.0 - ([0-9.]+)\*\(g1\+g2\+g3\)/)[1];
  base.neonStutter = { edge, depth, gaps };
  base.ramps = { rise: +html.match(/#define RISE ([0-9.]+)/)[1], fall: +html.match(/#define FALL ([0-9.]+)/)[1], flareTf: +html.match(/#define FLARE_TF ([0-9.]+)/)[1] };

  // ── how much of each lamp's light is on screen, frame by frame ──
  // (that lamp alone) minus (no lamp ever lit), measured on the rendered picture
  const curves = { bulb: { lum: [], area: [] }, lantern: { lum: [], area: [] }, neon: { lum: [], area: [] } };
  const t0 = Date.now();
  for (let start = 0; start < 600; start += 60) {
    const chunk = await page.evaluate(([from, to]) => {
      const F = window.__film;
      const c = document.createElement('canvas'); c.width = c.height = 270; const g = c.getContext('2d', { willReadFrequently: true });
      const src = document.getElementById('c');
      const lin = new Float32Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; lin[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
      const grab = (t, only) => {
        F.shared.uLampTiming.value.forEach((q, i) => { q.x = i === only ? F.LAMPS[i].on : 1000; });
        window.renderAt(t); g.drawImage(src, 0, 0, 270, 270);
        const d = g.getImageData(0, 0, 270, 270).data; const L = new Float32Array(270 * 270), S = new Float32Array(270 * 270);
        for (let k = 0; k < L.length; k++) { const r = d[k * 4], gg = d[k * 4 + 1], b = d[k * 4 + 2]; L[k] = 0.2126 * lin[r] + 0.7152 * lin[gg] + 0.0722 * lin[b]; S[k] = 0.2126 * r + 0.7152 * gg + 0.0722 * b; }
        return { L, S };
      };
      const out = [];
      for (let f = from; f < to; f++) {
        const t = f / 30; const none = grab(t, -1); const row = [];
        for (let lamp = 0; lamp < 3; lamp++) {
          const a = grab(t, lamp); let s = 0, n = 0;
          for (let k = 0; k < a.L.length; k++) { s += a.L[k] - none.L[k]; if (a.S[k] - none.S[k] > 3.0) n++; }
          row.push(s / a.L.length, n / a.L.length);
        }
        out.push(row);
      }
      F.shared.uLampTiming.value.forEach((q, i) => { q.x = F.LAMPS[i].on; });
      return out;
    }, [start, start + 60]);
    for (const r of chunk) ['bulb', 'lantern', 'neon'].forEach((n, i) => { curves[n].lum.push(+Math.max(0, r[i * 2]).toFixed(6)); curves[n].area.push(+r[i * 2 + 1].toFixed(5)); });
    console.log(`light curves ${start + 60}/600  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  // ── the lit region itself: the share of visible surface inside each lamp's ellipsoid ──
  // From the film's own world-position buffers (street, puddle views, mirror view), so reflections count
  // with their full bounce path. Also records where on screen each front is, for panning.
  const small = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  await small.goto(pathToFileURL(probe).href + '?render=1&samples=1&ss=0.25');
  await small.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const region = { bulb: { frac: [], litX: [], litSpread: [], frontX: [], darkX: [] }, lantern: { frac: [], litX: [], litSpread: [], frontX: [], darkX: [] }, neon: { frac: [], litX: [], litSpread: [], frontX: [], darkX: [] } };
  const t1 = Date.now();
  for (let start = 0; start < 600; start += 60) {
    const chunk = await small.evaluate(([from, to]) => {
      const F = window.__film, N = F.RES, R = F.REFL;
      const main = new Float32Array(N * N * 4), mir = new Float32Array(N * N * 4), gnd = new Float32Array(R * R * 4);
      const n = F.MIRROR.n.toArray(), mc = F.MIRROR.c.toArray();
      const out = [];
      for (let f = from; f < to; f++) {
        const t = f / 30; window.renderAt(t);
        F.renderer.readRenderTargetPixels(F.gMain, 0, 0, N, N, main, undefined, 0);
        F.renderer.readRenderTargetPixels(F.gRM, 0, 0, N, N, mir, undefined, 0);
        F.renderer.readRenderTargetPixels(F.gRG, 0, 0, R, R, gnd, undefined, 0);
        const C = F.cameraAt(t).pos.toArray();
        const Cg = [C[0], -C[1], C[2]];
        const k = 2 * ((C[0] - mc[0]) * n[0] + (C[1] - mc[1]) * n[1] + (C[2] - mc[2]) * n[2]);
        const Cm = [C[0] - k * n[0], C[1] - k * n[1], C[2] - k * n[2]];
        const acc = F.LAMPS.map(() => ({ lit: 0, x: 0, x2: 0, fx: 0, fn: 0, dx: 0, dn: 0 }));
        let total = 0;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const o = (j * N + i) * 4; const w = main[o + 3]; if (w < 0.5) continue;       // sky
          const m = Math.round(w % 100) - 1;
          let P, E = C;
          if (m === 8) { const gi = ((Math.floor((j + 0.5) * R / N)) * R + Math.floor((i + 0.5) * R / N)) * 4; if (gnd[gi + 3] < 0.5) continue; P = [gnd[gi], gnd[gi + 1], gnd[gi + 2]]; E = Cg; }
          else if (m === 9) { if (mir[o + 3] < 0.5) continue; P = [mir[o], mir[o + 1], mir[o + 2]]; E = Cm; }
          else P = [main[o], main[o + 1], main[o + 2]];
          total++;
          const dPE = Math.hypot(P[0] - E[0], P[1] - E[1], P[2] - E[2]);
          const sx = (i + 0.5) / N * 2 - 1;
          F.LAMPS.forEach((L, li) => {
            const path = Math.hypot(P[0] - L.pos.x, P[1] - L.pos.y, P[2] - L.pos.z) + dPE;
            const front = F.C_LIGHT * (t - L.on), dark = F.C_LIGHT * (t - L.off);
            const a = acc[li];
            if (path <= front && path > dark) { a.lit++; a.x += sx; a.x2 += sx * sx; }
            if (Math.abs(path - front) < 0.8) { a.fx += sx; a.fn++; }
            if (Math.abs(path - dark) < 0.8) { a.dx += sx; a.dn++; }
          });
        }
        out.push(acc.map(a => [a.lit / total, a.lit ? a.x / a.lit : 0, a.lit ? Math.sqrt(Math.max(0, a.x2 / a.lit - (a.x / a.lit) ** 2)) : 0, a.fn ? a.fx / a.fn : 0, a.dn ? a.dx / a.dn : 0]));
      }
      return out;
    }, [start, start + 60]);
    for (const r of chunk) ['bulb', 'lantern', 'neon'].forEach((name, li) => ['frac', 'litX', 'litSpread', 'frontX', 'darkX'].forEach((key, q) => region[name][key].push(+r[li][q].toFixed(5))));
    console.log(`lit region ${start + 60}/600  ${((Date.now() - t1) / 1000).toFixed(0)} s`);
  }
  base.region = region;
  base.curves = curves;
  fs.writeFileSync(path.join(audioDir, 'cues.json'), JSON.stringify(base));
  console.log('wrote audio/cues.json');
  console.log('drips:', base.drips.length, 'on water:', base.drips.filter(d => d.water).length, '| moths:', base.moths.length, '| stutter gaps:', JSON.stringify(base.neonStutter.gaps));
} finally {
  await browser.close();
  fs.rmSync(probe, { force: true });
}

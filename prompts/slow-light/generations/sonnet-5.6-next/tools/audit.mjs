// Physics audit: measure, from rendered pixels, when each light path switches on and off,
// and compare with t = t_switch + pathLength / 5.  Also checks that frames are reproducible.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openPage } from './browser.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { browser, page, info } = await openPage('samples=4');
const result = await page.evaluate(() => {
  const S = window.slow, C = 5;
  const L = S.LAMPS.map(l => l.pos.toArray());
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const cam = t => S.cameraAt(t).pos.toArray();
  const n = S.MIRROR.n.toArray(), mc = S.MIRROR.c.toArray();
  const mirrorPt = p => { const k = 2 * ((p[0] - mc[0]) * n[0] + (p[1] - mc[1]) * n[1] + (p[2] - mc[2]) * n[2]); return [p[0] - k * n[0], p[1] - k * n[1], p[2] - k * n[2]]; };
  const rows = [];
  // `image` is the point to look at on screen; `pathAt(camPos)` is the full distance the light travels
  function run(name, lamp, image, pathAt, edges = ['on', 'off']) {
    const l = S.LAMPS[lamp];
    for (const edge of edges) {
      const t0 = edge === 'on' ? l.on : l.off;
      let pred = t0 + 5; for (let i = 0; i < 12; i++) pred = t0 + pathAt(cam(pred)) / C;
      const val = t => { const p = S.projectPoint(image[0], image[1], image[2], t); return S.audit(p[0], p[1], t, lamp).value; };
      const ref = val(edge === 'on' ? pred + 0.02 : pred - 0.06);
      const quiet = val(edge === 'on' ? pred - 0.06 : pred + 0.09);
      const thr = edge === 'on' ? 0.08 * ref : 0.5 * ref;
      let a = pred - 0.35, b = pred + (edge === 'on' ? 0.02 : 0.30);
      for (let i = 0; i < 11; i++) { const m = (a + b) / 2; const v = val(m); const switched = edge === 'on' ? v > thr : v < thr; if (switched) b = m; else a = m; }
      // where inside the 16-22 ms switching ramp the threshold sits
      const model = pred + (edge === 'on' ? 0.0023 : 0.011);
      rows.push({ path_name: name, lamp: l.name, edge, path_m: +pathAt(cam(pred)).toFixed(3), predicted_s: +model.toFixed(3), measured_s: +((a + b) / 2).toFixed(3), error_ms: +(((a + b) / 2 - model) * 1000).toFixed(1), dark_side_value: +quiet.toFixed(4), lit_side_value: +ref.toFixed(4) });
    }
  }
  const direct = (name, lamp, P) => run(name, lamp, P, c => dist(L[lamp], P) + dist(P, c));
  // a surface near pixel (x, y) that is really lit by that lamp (not in shadow, not an edge)
  const surfaceAt = (x, y, lamp = 0) => {
    for (let r = 0; r <= 48; r += 6) for (let k = 0; k < (r ? 12 : 1); k++) {
      const px = x + Math.round(r * Math.cos(k * 0.5236)), py = y + Math.round(r * Math.sin(k * 0.5236));
      const P = S.probe(px, py, 8.0).slice(0, 3);
      const t = lamp === 0 ? 9.0 : 11.0;
      const p = S.projectPoint(P[0], P[1], P[2], t); const a = S.audit(p[0], p[1], t, lamp);
      const m = a.main[3] % 100 - 1;
      if (a.value > 0.012 && Math.abs(m - 8) > 0.5 && a.center[3] > 0.6 * a.value && a.center[21] < 1.6 * a.value) return P;
    }
    return S.probe(x, y, 8.0).slice(0, 3);
  };
  run('bulb itself', 0, L[0], c => dist(L[0], c));
  direct('foreground cobble', 0, surfaceAt(300, 1000));
  direct('mid-lane cobble', 0, surfaceAt(640, 850));
  direct('cafe upper facade', 0, surfaceAt(905, 300));
  direct('cafe tablecloth', 0, surfaceAt(766, 785));
  direct('sheet on washing line', 0, surfaceAt(616, 440));
  // walk world points across the end wall (z = -19) until one is both visible and lit
  {
    let P = null, best = 0;
    for (let y = 0.7; y <= 6.2; y += 0.22) for (let x = -1.85; x <= 2.1; x += 0.2) {
      const p = S.projectPoint(x, y, -19.0, 9.0); if (p[0] < 5 || p[0] > 1074 || p[1] < 5 || p[1] > 1074) continue;
      const a = S.audit(p[0], p[1], 9.0, 0);
      if (Math.hypot(a.main[0] - x, a.main[1] - y, a.main[2] + 19.0) > 0.16) continue;
      const flat = a.center[3] > 0.7 * a.value && a.center[21] < 1.4 * a.value;
      if (flat && a.value > best) { best = a.value; P = a.main.slice(0, 3); }
    }
    if (P && best > 0.0008) direct('end wall of the lane', 0, P);
  }
  direct('far wall, street lamp', 1, surfaceAt(425, 600, 1));
  // the bulb seen in the cafe mirror: its image is the mirrored lamp, the path is lamp -> mirror -> camera
  { const V = mirrorPt(L[0]); run('BULB IN CAFE MIRROR', 0, V, c => dist(V, c)); }
  // A bulb-lit surface seen in a puddle: find a water pixel whose reflection is lit, then time that exact bounce path.
  // The reflection point slides across the water as the camera cranes, so each edge gets its own probe,
  // chosen near the moment it is timed.
  for (const [edge, lookAt] of [['on', 9.0], ['off', 14.6]]) {
    let found = 0;
    for (let y = 786; y <= 1068 && !found; y += 8) for (let x = 330; x <= 840 && !found; x += 12) {
      const a = S.audit(x, y, lookAt, 0);
      if (Math.abs(a.main[3] % 100 - 9) > 0.1 || a.reflGround[3] < 0.5 || a.value < 0.004 || a.center[4] < 0.6 * a.value || a.center[20] > 1.6 * a.value) continue;
      const Q = a.reflGround.slice(0, 3);          // the real surface seen in the water
      const V = [Q[0], -Q[1], Q[2]];               // its mirror image below y = 0
      const pathAt = cm => dist(L[0], Q) + dist(Q, [cm[0], -cm[1], cm[2]]);
      let tp = 5; for (let i = 0; i < 12; i++) tp = (edge === 'on' ? 0 : S.LAMPS[0].off) + pathAt(cam(tp)) / C;
      const probeT = edge === 'on' ? tp + 0.02 : tp - 0.06;
      const p = S.projectPoint(V[0], V[1], V[2], probeT); if (p[1] > 1074) continue;
      const c = S.audit(p[0], p[1], probeT, 0);
      if (Math.abs(c.main[3] % 100 - 9) > 0.1 || c.value < 0.003 || Math.hypot(c.reflGround[0] - Q[0], c.reflGround[1] - Q[1], c.reflGround[2] - Q[2]) > 0.3) continue;
      if (edge === 'on') { const q = S.projectPoint(V[0], V[1], V[2], tp - 0.08); if (S.audit(q[0], q[1], tp - 0.08, 0).value > 0.05 * c.value) continue; }
      found = 1;
      run('PUDDLE reflection (' + edge + ' probe)', 0, V, pathAt, [edge]);
    }
  }
  // determinism: the same frame, rendered again after jumping around the timeline
  const grab = t => { window.renderAt(t); return S.frameData(); };
  const first = [3.5, 11.2, 15.3].map(grab); grab(19.0); grab(0.4);
  const again = [15.3, 11.2, 3.5].map(grab).reverse();
  return { rows, first, again };
});
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
console.table(result.rows);
const det = result.first.map((f, i) => ({ t: [3.5, 11.2, 15.3][i], first: hash(f), rerender: hash(result.again[i]), identical: f === result.again[i] }));
console.table(det);
fs.writeFileSync(path.join(root, 'tools', 'audit-result.json'), JSON.stringify({ gpu: info.gpu, rows: result.rows, determinism: det }, null, 2));
await browser.close();

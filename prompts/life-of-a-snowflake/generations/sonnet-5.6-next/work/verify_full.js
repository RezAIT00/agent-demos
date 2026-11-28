// Independent check: grow the same weather script on a FULL hexagonal lattice
// (no symmetry folding at all) and compare every cell with its 12 images and
// with the folded-wedge result used by the film.
const { makeWedge, growCrystal } = require('./sim.js');
const { HERO_TIMELINE, HERO_STEPS, timelineEnv } = require('./src/weather.js');
const R = +(process.argv[2] || 440);
const STEPS = +(process.argv[3] || HERO_STEPS);

const W = 2 * R + 3, off = R + 1;
const inside = new Uint8Array(W * W), ring = new Int32Array(W * W).fill(1e9);
const list = [];
for (let r = -R; r <= R; r++) for (let q = -R; q <= R; q++) {
  const h = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
  if (h <= R) { const k = (r + off) * W + (q + off); inside[k] = 1; ring[k] = h; list.push(k); }
}
list.sort((a, b) => ring[a] - ring[b] || a - b);
const order = Int32Array.from(list);
const upto = new Int32Array(R + 1);
for (let n = 0; n < order.length; n++) upto[ring[order[n]]] = n + 1;
const NB = [1, -1, W, -W, -W + 1, W - 1];
const a = new Uint8Array(W * W), b = new Float64Array(W * W), c = new Float64Array(W * W);
let d = new Float64Array(W * W), dn = new Float64Array(W * W);
const att = new Int32Array(W * W).fill(-1);
const nAtt = new Uint8Array(W * W), inB = new Uint8Array(W * W);
const boundary = new Int32Array(W * W); let nBoundary = 0;
const fresh = new Int32Array(W * W);
const env = timelineEnv(HERO_TIMELINE, STEPS);
let e = env(0), rhoPrev = e.rho;
d.fill(e.rho); dn.fill(e.rho);
const centre = off * W + off;
function touch(k) {
  for (const o of NB) {
    const m = k + o;
    if (!inside[m] || a[m]) continue;
    let cnt = 0; for (const p of NB) cnt += a[m + p];
    nAtt[m] = cnt;
    if (!inB[m] && cnt) { inB[m] = 1; boundary[nBoundary++] = m; }
  }
}
a[centre] = 1; att[centre] = 0; c[centre] = 1; d[centre] = 0; touch(centre);
let radius = 0;
const t0 = Date.now();
for (let step = 1; step < 200000; step++) {
  e = env(step); if (e.done) break;
  const act = Math.min(R, radius + 70), nA = upto[act];
  if (e.rho !== rhoPrev) { const s = e.rho / rhoPrev; for (let n = 0; n < nA; n++) d[order[n]] *= s; rhoPrev = e.rho; }
  const rho = e.rho;
  const outer = act < R ? upto[act + 1] : nA;
  for (let n = nA; n < outer; n++) { d[order[n]] = rho; dn[order[n]] = rho; }
  if (act === R) for (let n = upto[R - 1]; n < order.length; n++) for (const o of NB) { const m = order[n] + o; if (!inside[m]) { d[m] = rho; dn[m] = rho; } }
  for (let n = 0; n < nA; n++) {
    const k = order[n]; if (a[k]) continue;
    const dk = d[k];
    // plain fixed-order sum over the six lattice neighbours (reflecting at ice)
    let v0 = a[k + 1] ? dk : d[k + 1], v1 = a[k - 1] ? dk : d[k - 1];
    let v2 = a[k + W] ? dk : d[k + W], v3 = a[k - W] ? dk : d[k - W];
    let v4 = a[k - W + 1] ? dk : d[k - W + 1], v5 = a[k + W - 1] ? dk : d[k + W - 1];
    dn[k] = (dk + v0 + v1 + v2 + v3 + v4 + v5) * 0.14285714285714285;
  }
  const tmp = d; d = dn; dn = tmp;
  for (let q = 0; q < nBoundary; q++) { const k = boundary[q]; b[k] += (1 - e.kappa) * d[k]; c[k] += e.kappa * d[k]; d[k] = 0; }
  let nF = 0;
  for (let q = 0; q < nBoundary; q++) {
    const k = boundary[q], n = nAtt[k]; let yes = false;
    if (n <= 2) yes = b[k] >= e.beta;
    else if (n === 3) { if (b[k] >= 1) yes = true; else if (b[k] >= e.alpha) { let s = d[k]; for (const o of NB) if (!a[k + o]) s += d[k + o]; yes = s < e.theta; } }
    else yes = true;
    if (yes) fresh[nF++] = k;
  }
  if (nF) {
    for (let q = 0; q < nF; q++) { const k = fresh[q]; a[k] = 1; att[k] = step; c[k] += b[k]; b[k] = 0; d[k] = 0; dn[k] = 0; if (ring[k] > radius) radius = ring[k]; }
    let w = 0; for (let q = 0; q < nBoundary; q++) { const k = boundary[q]; if (a[k]) { inB[k] = 0; continue; } boundary[w++] = k; } nBoundary = w;
    for (let q = 0; q < nF; q++) touch(fresh[q]);
  }
  for (let q = 0; q < nBoundary; q++) { const k = boundary[q]; d[k] += e.mu * b[k] + e.gamma * c[k]; b[k] *= 1 - e.mu; c[k] *= 1 - e.gamma; }
  if (step % 10000 === 0) console.log('step', step, 'radius', radius, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  if (radius >= R - 4) break;
}
// compare the six rotations and mirror images
let total = 0, symMismatch = 0;
for (const k of order) {
  if (att[k] < 0) continue;
  total++;
  let q = (k % W) - off, r = ((k / W) | 0) - off;
  for (let m = 0; m < 6; m++) {
    const nq = -r, nr = q + r; q = nq; r = nr;           // rotate 60 degrees
    if ((att[(r + off) * W + q + off] >= 0) === false) { symMismatch++; break; }
  }
}
const wedge = growCrystal(R, timelineEnv(HERO_TIMELINE, STEPS), { maxSteps: 200000, margin: 70 });
const Wd = makeWedge(R);
let diff = 0;
for (const k of order) {
  const q = (k % W) - off, r = ((k / W) | 0) - off;
  const u = Math.abs(q), v = Math.abs(r), s = Math.abs(q + r);
  const hi = Math.max(u, v, s), lo = Math.min(u, v, s), mid = u + v + s - hi - lo;
  const wk = Wd.key[mid * (R + 2) + lo];
  if ((att[k] >= 0) !== (wedge.attachStep[wk] >= 0)) diff++;
}
console.log(JSON.stringify({ iceCells: total, cellsWithoutAllRotations: symMismatch, cellsDifferingFromWedgeRun: diff, radius, seconds: (Date.now() - t0) / 1000 }));

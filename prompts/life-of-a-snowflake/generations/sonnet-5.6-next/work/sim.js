// Gravner–Griffeath mesoscopic snow-crystal model (2D lattice map, 2.5D output)
// on a triangular/hexagonal lattice, driven by a time-varying environment.
//
// The lattice is simulated on one 30-degree fundamental wedge of the D6 symmetry
// group (every arm sees the same air, so every arm has the same history).
// Cell (i,j), 0<=j<=i, i+j<=R, stands for the cube coordinate (i, j, -(i+j))
// and its 11 mirror images.  j=0 is a main-arm axis, j=i is the bisector.
//
// State per site: a (attached), b (quasi-liquid boundary mass), c (ice mass),
// d (vapour).  One step = diffusion -> freezing -> attachment -> melting.

function makeWedge(R) {
  const key = new Int32Array((R + 2) * (R + 2)).fill(-1);
  const cells = [];
  // ordered by hex distance so an "active radius" is a simple prefix
  for (let dist = 0; dist <= R; dist++) {
    for (let j = 0; j <= dist >> 1; j++) {
      const i = dist - j;
      key[i * (R + 2) + j] = cells.length >> 1;
      cells.push(i, j);
    }
  }
  const N = cells.length >> 1;
  const I = new Int16Array(N), J = new Int16Array(N);
  for (let k = 0; k < N; k++) { I[k] = cells[2 * k]; J[k] = cells[2 * k + 1]; }
  const countUpTo = new Int32Array(R + 1);
  for (let k = 0; k < N; k++) countUpTo[I[k] + J[k]] = k + 1;
  const DIRS = [[1, -1, 0], [-1, 1, 0], [1, 0, -1], [-1, 0, 1], [0, 1, -1], [0, -1, 1]];
  const nb = new Int32Array(N * 6);
  for (let k = 0; k < N; k++) {
    const x = I[k], y = J[k], z = -(x + y);
    for (let n = 0; n < 6; n++) {
      const u = Math.abs(x + DIRS[n][0]), v = Math.abs(y + DIRS[n][1]), w = Math.abs(z + DIRS[n][2]);
      const hi = Math.max(u, v, w), lo = Math.min(u, v, w), mid = u + v + w - hi - lo;
      nb[k * 6 + n] = hi > R ? N : key[mid * (R + 2) + lo]; // N = reservoir cell
    }
  }
  return { R, N, I, J, nb, countUpTo, key };
}

// env(step, radius) -> {rho, beta, alpha, theta, kappa, mu, gamma, done}
function growCrystal(R, env, opts) {
  opts = opts || {};
  const W = makeWedge(R);
  const { N, I, J, nb, countUpTo } = W;
  const M = N + 1;
  const a = new Uint8Array(M);
  const b = new Float64Array(M), c = new Float64Array(M);
  let d = new Float64Array(M), dn = new Float64Array(M);
  const nAtt = new Uint8Array(M);       // attached neighbours
  const inB = new Uint8Array(M);        // in boundary list
  const attachStep = new Float32Array(N).fill(-1);
  const attachMass = new Float32Array(N);
  const attachN = new Uint8Array(N);
  let boundary = new Int32Array(M);
  let nBoundary = 0;
  const fresh = new Int32Array(M);

  let e = env(0, 0);
  let rhoPrev = e.rho;
  d.fill(e.rho);
  dn.fill(e.rho);

  function attach(k, step) {
    a[k] = 1;
    attachStep[k] = step;
    attachMass[k] = c[k] + b[k];
    attachN[k] = nAtt[k];
    c[k] += b[k];
    b[k] = 0; d[k] = 0; dn[k] = 0;
  }
  function touchNeighbours(k) {
    for (let n = 0; n < 6; n++) {
      const m = nb[k * 6 + n];
      if (m === N) continue;
      // neighbour count must be taken from m's own point of view (wedge folding
      // can map several directions to one cell), so recount.
      if (a[m]) continue;
      let cnt = 0;
      for (let q = 0; q < 6; q++) cnt += a[nb[m * 6 + q]];
      nAtt[m] = cnt;
      if (!inB[m] && cnt > 0) { inB[m] = 1; boundary[nBoundary++] = m; }
    }
  }

  a[0] = 1; attachStep[0] = 0; attachMass[0] = 1; c[0] = 1; d[0] = 0;
  touchNeighbours(0);

  let radius = 0;
  const radiusLog = [];    // sampled every 20 steps
  const margin = opts.margin || 70;
  const maxSteps = opts.maxSteps || 200000;
  let step = 1;
  for (; step < maxSteps; step++) {
    e = env(step, radius);
    if (e.done) break;
    const activeR = Math.min(R, radius + margin);
    const nA = countUpTo[activeR];

    // The crystal falls into new air: the vapour field follows the ambient value,
    // and beyond the ventilated boundary layer it equals the ambient value.
    if (e.rho !== rhoPrev) {
      const s = e.rho / rhoPrev;
      for (let k = 0; k < nA; k++) d[k] *= s;
      rhoPrev = e.rho;
    }
    const rho = e.rho;
    d[N] = rho; dn[N] = rho;
    const outerLimit = activeR < R ? countUpTo[Math.min(R, activeR + 1)] : nA;
    for (let k = nA; k < outerLimit; k++) { d[k] = rho; dn[k] = rho; }

    // i. diffusion with reflecting condition on the crystal
    for (let k = 0, o = 0; k < nA; k++, o += 6) {
      if (a[k]) continue;
      const dk = d[k];
      let m = nb[o]; let s = dk + (a[m] ? dk : d[m]);
      m = nb[o + 1]; s += a[m] ? dk : d[m];
      m = nb[o + 2]; s += a[m] ? dk : d[m];
      m = nb[o + 3]; s += a[m] ? dk : d[m];
      m = nb[o + 4]; s += a[m] ? dk : d[m];
      m = nb[o + 5]; s += a[m] ? dk : d[m];
      dn[k] = s * 0.14285714285714285;
    }
    const tmp = d; d = dn; dn = tmp;

    // ii. freezing
    const kappa = e.kappa;
    for (let q = 0; q < nBoundary; q++) {
      const k = boundary[q];
      b[k] += (1 - kappa) * d[k];
      c[k] += kappa * d[k];
      d[k] = 0;
    }
    // iii. attachment (decided simultaneously)
    let nFresh = 0;
    for (let q = 0; q < nBoundary; q++) {
      const k = boundary[q];
      const n = nAtt[k];
      let yes = false;
      if (n <= 2) yes = b[k] >= e.beta;
      else if (n === 3) {
        if (b[k] >= 1) yes = true;
        else if (b[k] >= e.alpha) {
          let s = d[k];
          for (let t = 0; t < 6; t++) { const m = nb[k * 6 + t]; if (!a[m]) s += d[m]; }
          yes = s < e.theta;
        }
      } else yes = true;
      if (yes) fresh[nFresh++] = k;
    }
    if (nFresh) {
      for (let q = 0; q < nFresh; q++) {
        const k = fresh[q];
        attach(k, step);
        const dist = I[k] + J[k];
        if (dist > radius) radius = dist;
      }
      let w = 0;
      for (let q = 0; q < nBoundary; q++) {
        const k = boundary[q];
        if (a[k]) { inB[k] = 0; continue; }
        boundary[w++] = k;
      }
      nBoundary = w;
      for (let q = 0; q < nFresh; q++) touchNeighbours(fresh[q]);
    }
    // iv. melting
    const mu = e.mu, gam = e.gamma;
    for (let q = 0; q < nBoundary; q++) {
      const k = boundary[q];
      d[k] += mu * b[k] + gam * c[k];
      b[k] *= 1 - mu;
      c[k] *= 1 - gam;
    }
    if (step % 20 === 0) radiusLog.push(radius);
    if (radius >= R - 4) break;
    if (opts.onProgress && step % 500 === 0) opts.onProgress(step, radius);
  }
  return {
    R, N, I, J, attachStep, attachMass, attachN, radius, steps: step,
    radiusLog: Float32Array.from(radiusLog),
  };
}

if (typeof module !== 'undefined') module.exports = { makeWedge, growCrystal };

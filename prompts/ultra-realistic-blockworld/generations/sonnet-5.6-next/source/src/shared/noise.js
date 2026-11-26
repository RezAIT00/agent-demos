// ---------------------------------------------------------------- noise & hashing
function ihash(x, y = 0, z = 0, s = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1) ^ Math.imul(s | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}
function rand01(x, y = 0, z = 0, s = 0) { return ihash(x, y, z, s) / 4294967296; }
function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => t * t * (3 - 2 * t);
function sstep(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

const GRAD3 = new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]);
class Simplex {
  constructor(seed) {
    const r = mulberry32(ihash(seed, 77, 13));
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.perm = new Uint8Array(512);
    this.pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.pm12[i] = this.perm[i] % 12; }
  }
  n2(xin, yin) {
    const perm = this.perm, pm = this.pm12;
    const F2 = 0.3660254037844386, G2 = 0.21132486540518713;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - i + t, y0 = yin - j + t;
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0;
    if (tt > 0) { g = pm[ii + perm[jj]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x0 + GRAD3[g + 1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1;
    if (tt > 0) { g = pm[ii + i1 + perm[jj + j1]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x1 + GRAD3[g + 1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2;
    if (tt > 0) { g = pm[ii + 1 + perm[jj + 1]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x2 + GRAD3[g + 1] * y2); }
    return 70 * n;
  }
  n3(xin, yin, zin) {
    const perm = this.perm, pm = this.pm12;
    const s = (xin + yin + zin) / 3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) / 6;
    const x0 = xin - i + t, y0 = yin - j + t, z0 = zin - k + t;
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + 1 / 6, y1 = y0 - j1 + 1 / 6, z1 = z0 - k1 + 1 / 6;
    const x2 = x0 - i2 + 1 / 3, y2 = y0 - j2 + 1 / 3, z2 = z0 - k2 + 1 / 3;
    const x3 = x0 - 0.5, y3 = y0 - 0.5, z3 = z0 - 0.5;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, tt, g;
    tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (tt > 0) { g = pm[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x0 + GRAD3[g + 1] * y0 + GRAD3[g + 2] * z0); }
    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (tt > 0) { g = pm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x1 + GRAD3[g + 1] * y1 + GRAD3[g + 2] * z1); }
    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (tt > 0) { g = pm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x2 + GRAD3[g + 1] * y2 + GRAD3[g + 2] * z2); }
    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (tt > 0) { g = pm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x3 + GRAD3[g + 1] * y3 + GRAD3[g + 2] * z3); }
    return 32 * n;
  }
  fbm2(x, y, oct, gain = 0.5, lac = 2.03) {
    let a = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += a * this.n2(x, y); norm += a; a *= gain;
      const nx = x * lac + 17.13; y = y * lac - 9.71; x = nx;
    }
    return sum / norm;
  }
}

// value noise with analytic derivative: used for the derivative-damped ("eroded") ridge fractal
const _vd = [0, 0, 0];
function valueNoiseD(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1), duy = 30 * fy * fy * (fy * (fy - 2) + 1);
  const a = rand01(ix, iy, 0, seed), b = rand01(ix + 1, iy, 0, seed), c = rand01(ix, iy + 1, 0, seed), d = rand01(ix + 1, iy + 1, 0, seed);
  const k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  _vd[0] = -1 + 2 * (a + k1 * ux + k2 * uy + k4 * ux * uy);
  _vd[1] = 2 * dux * (k1 + k4 * uy);
  _vd[2] = 2 * duy * (k2 + k4 * ux);
  return _vd;
}
// ridged fractal where steep areas receive less high-frequency detail -> eroded gullies and sharp crests
function erodedRidge(x, y, oct, seed) {
  let sum = 0, amp = 1, dx = 0, dy = 0, norm = 0, prev = 1;
  for (let i = 0; i < oct; i++) {
    const v = valueNoiseD(x, y, seed + i * 31);
    let r = 1 - Math.abs(v[0]);
    r *= r;
    const sgn = v[0] > 0 ? -1 : 1;
    dx += v[1] * sgn * amp; dy += v[2] * sgn * amp;
    const damp = 1 / (1 + 0.22 * (dx * dx + dy * dy));
    sum += amp * r * damp * (0.45 + 0.55 * prev);
    norm += amp;
    prev = r;
    amp *= 0.5;
    const nx = 1.6 * x - 1.2 * y; y = 1.2 * x + 1.6 * y; x = nx;
  }
  return sum / norm;
}

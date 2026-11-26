const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease5 = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * k * (k * (k * 6 - 15) + 10); };
const outExp = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k >= 1 ? 1 : 1 - Math.pow(2, -9 * k); };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// monotone-ish cubic keys: [[t,v],...]  (Catmull-Rom tangents, limited)
function keys(K) {
  const n = K.length, m = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) { m[i] = 0; continue; }
    const d0 = (K[i][1] - K[i - 1][1]) / (K[i][0] - K[i - 1][0]), d1 = (K[i + 1][1] - K[i][1]) / (K[i + 1][0] - K[i][0]);
    if (d0 * d1 <= 0) m[i] = 0; else { const h0 = K[i][0] - K[i - 1][0], h1 = K[i + 1][0] - K[i][0], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; m[i] = (w1 + w2) / (w1 / d0 + w2 / d1); }
  }
  return t => {
    if (t <= K[0][0]) return K[0][1]; if (t >= K[n - 1][0]) return K[n - 1][1];
    let i = 0; while (t > K[i + 1][0]) i++;
    const h = K[i + 1][0] - K[i][0], k = (t - K[i][0]) / h, k2 = k * k, k3 = k2 * k;
    return (2 * k3 - 3 * k2 + 1) * K[i][1] + (k3 - 2 * k2 + k) * h * m[i] + (-2 * k3 + 3 * k2) * K[i + 1][1] + (k3 - k2) * h * m[i + 1];
  };
}
const v3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm: a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
// column-major 4x4
function mmul(a, b) { const o = new Float64Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function viewM(p, R, U, F) { return new Float64Array([R[0], U[0], -F[0], 0, R[1], U[1], -F[1], 0, R[2], U[2], -F[2], 0, -v3.dot(R, p), -v3.dot(U, p), v3.dot(F, p), 1]); }
// reversed-z infinite perspective, hfov in radians, jitter in ndc
function perspM(hfov, asp, n, jx, jy) { const f = 1 / Math.tan(hfov / 2), g = f * asp; return new Float64Array([f, 0, 0, 0, 0, g, 0, 0, jx, jy, 0, -1, 0, 0, n, 0]); }
function orthoM(hw, hh, n, f) { return new Float64Array([1 / hw, 0, 0, 0, 0, 1 / hh, 0, 0, 0, 0, -1 / (f - n), 0, 0, 0, -n / (f - n), 1]); }
function minv(m) {
  const a = Array.from(m), inv = new Float64Array(16);
  const A = []; for (let r = 0; r < 4; r++) { A.push([a[r], a[4 + r], a[8 + r], a[12 + r], r === 0 ? 1 : 0, r === 1 ? 1 : 0, r === 2 ? 1 : 0, r === 3 ? 1 : 0]); }
  for (let c = 0; c < 4; c++) { let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;[A[c], A[p]] = [A[p], A[c]]; const d = A[c][c]; for (let k = 0; k < 8; k++) A[c][k] /= d; for (let r = 0; r < 4; r++) if (r !== c) { const q = A[r][c]; for (let k = 0; k < 8; k++) A[r][k] -= q * A[c][k]; } }
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) inv[c * 4 + r] = A[r][4 + c]; return inv;
}

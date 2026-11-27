// mesh.js — CPU mesh builder for characters. Vertex: pos3 nrm3 info4(mat, outline, shadeBias, flags) uv2
const CHAR_STRIDE = 12;
class MeshBuilder {
  constructor() { this.b = new FBuf(1 << 18); }
  reset() { this.b.reset(); }
  v(p, n, mat, ol, bias, u, vv) {
    const b = this.b; b.need(CHAR_STRIDE); const a = b.a; let i = b.n;
    a[i++] = p[0]; a[i++] = p[1]; a[i++] = p[2];
    a[i++] = n[0]; a[i++] = n[1]; a[i++] = n[2];
    a[i++] = mat; a[i++] = ol; a[i++] = bias; a[i++] = 0;
    a[i++] = u; a[i++] = vv;
    b.n = i;
  }
  tri(p0, p1, p2, n, mat, ol = 0, bias = 0, uv = null) {
    this.v(p0, n, mat, ol, bias, uv ? uv[0] : 0, uv ? uv[1] : 0);
    this.v(p1, n, mat, ol, bias, uv ? uv[2] : 0, uv ? uv[3] : 0);
    this.v(p2, n, mat, ol, bias, uv ? uv[4] : 0, uv ? uv[5] : 0);
  }
  // rings: [{c, U, V, mat?, ol?, bias?, t?}] where U,V are radius vectors. e = superellipse exponent
  loft(rings, M, opt = {}) {
    const e = opt.e || 1, N = rings.length;
    const cs = [], sn = [];
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * TAU + (opt.phase || 0);
      const c = Math.cos(a), s = Math.sin(a);
      cs.push(Math.sign(c) * Math.pow(Math.abs(c), e));
      sn.push(Math.sign(s) * Math.pow(Math.abs(s), e));
    }
    const P = new Array(N);
    for (let i = 0; i < N; i++) {
      const r = rings[i], row = new Array(M + 1);
      for (let j = 0; j <= M; j++) {
        let kv = 1;
        if (r.vf && sn[j] > 0) kv = r.vf; // separate front radius
        row[j] = [r.c[0] + r.U[0] * cs[j] + r.V[0] * sn[j] * kv,
          r.c[1] + r.U[1] * cs[j] + r.V[1] * sn[j] * kv,
          r.c[2] + r.U[2] * cs[j] + r.V[2] * sn[j] * kv];
      }
      P[i] = row;
    }
    const Nm = new Array(N);
    for (let i = 0; i < N; i++) {
      Nm[i] = new Array(M + 1);
      for (let j = 0; j <= M; j++) {
        const jm = j === 0 ? M - 1 : j - 1, jp = j === M ? 1 : j + 1;
        const du = V.sub(P[i][jp], P[i][jm]);
        const dv = V.sub(P[Math.min(N - 1, i + 1)][j], P[Math.max(0, i - 1)][j]);
        let n = V.cross(du, dv);
        const radial = V.sub(P[i][j], rings[i].c);
        const l = V.len(n);
        if (l < 1e-9) n = V.norm(radial);
        else { n = V.mul(n, 1 / l); if (V.dot(n, radial) < 0) n = V.neg(n); }
        Nm[i][j] = n;
      }
    }
    const matF = opt.matF, olF = opt.olF, biasF = opt.biasF;
    for (let i = 0; i < N - 1; i++) {
      const r0 = rings[i], r1 = rings[i + 1];
      const t0 = r0.t !== undefined ? r0.t : i / (N - 1), t1 = r1.t !== undefined ? r1.t : (i + 1) / (N - 1);
      for (let j = 0; j < M; j++) {
        const uj = j / M, uj1 = (j + 1) / M;
        const um = (uj + uj1) / 2, tm = (t0 + t1) / 2;
        const mat = matF ? matF(um, tm) : (r0.mat !== undefined ? r0.mat : opt.mat);
        const ol0 = (r0.ol !== undefined ? r0.ol : (opt.ol !== undefined ? opt.ol : 1));
        const ol1 = (r1.ol !== undefined ? r1.ol : (opt.ol !== undefined ? opt.ol : 1));
        const bs = (biasF ? biasF(um, tm) : 0) + (r0.bias || 0) + (opt.bias || 0);
        const uo = (opt.uOff || 0);
        this.v(P[i][j], Nm[i][j], mat, ol0, bs, uj + uo, t0);
        this.v(P[i + 1][j], Nm[i + 1][j], mat, ol1, bs, uj + uo, t1);
        this.v(P[i + 1][j + 1], Nm[i + 1][j + 1], mat, ol1, bs, uj1 + uo, t1);
        this.v(P[i][j], Nm[i][j], mat, ol0, bs, uj + uo, t0);
        this.v(P[i + 1][j + 1], Nm[i + 1][j + 1], mat, ol1, bs, uj1 + uo, t1);
        this.v(P[i][j + 1], Nm[i][j + 1], mat, ol0, bs, uj1 + uo, t0);
      }
    }
    if (opt.cap !== false) {
      for (const [idx, nb] of [[0, 1], [N - 1, N - 2]]) {
        const r = rings[idx];
        if (V.len(r.U) < 0.004 && V.len(r.V) < 0.004) continue;
        const axis = V.norm(V.sub(r.c, rings[nb].c));
        const mat = matF ? matF(0.5, r.t !== undefined ? r.t : idx / (N - 1)) : (r.mat !== undefined ? r.mat : opt.mat);
        const ol = r.ol !== undefined ? r.ol : (opt.ol !== undefined ? opt.ol : 1);
        const tv = r.t !== undefined ? r.t : idx / (N - 1);
        for (let j = 0; j < M; j++) {
          this.v(r.c, axis, mat, ol, opt.bias || 0, 0.5, tv);
          this.v(P[idx][j], axis, mat, ol, opt.bias || 0, j / M, tv);
          this.v(P[idx][j + 1], axis, mat, ol, opt.bias || 0, (j + 1) / M, tv);
        }
      }
    }
  }
  // swept tube along pts with radius(t)->[a,b]; side0 gives the initial U direction
  tube(pts, radius, M, side0, opt = {}) {
    const N = pts.length, rings = new Array(N);
    let U = V.norm(side0);
    const lens = [0];
    for (let i = 1; i < N; i++) lens.push(lens[i - 1] + V.dist(pts[i], pts[i - 1]));
    const L = lens[N - 1] || 1;
    for (let i = 0; i < N; i++) {
      const T = V.norm(V.sub(pts[Math.min(N - 1, i + 1)], pts[Math.max(0, i - 1)]));
      U = V.sub(U, V.mul(T, V.dot(U, T)));
      if (V.len(U) < 1e-4) U = V.cross(T, [0.3, 0.9, 0.1]);
      U = V.norm(U);
      let W = V.cross(T, U);
      const t = lens[i] / L;
      const r = radius(t);
      const a = Array.isArray(r) ? r[0] : r, b = Array.isArray(r) ? r[1] : r;
      let Ur = U;
      if (opt.twist) {
        const an = opt.twist(t), c = Math.cos(an), sn = Math.sin(an);
        Ur = V.add(V.mul(U, c), V.mul(W, sn));
        W = V.cross(T, Ur);
      }
      rings[i] = { c: pts[i], U: V.mul(Ur, a), V: V.mul(W, b), t };
      if (opt.olT) rings[i].ol = opt.olT(t);
      if (opt.vT) rings[i].t = opt.vT(t);
    }
    this.loft(rings, M, opt);
  }
  // ellipsoid with basis R (matrix, columns = axes) and radii
  ellipsoid(c, R, rad, mat, opt = {}) {
    const X = M3.col(R, 0), Y = M3.col(R, 1), Z = M3.col(R, 2);
    const N = opt.rings || 8, rings = [];
    for (let i = 0; i <= N; i++) {
      const ph = -Math.PI / 2 + (i / N) * Math.PI;
      const cr = Math.cos(ph), sy = Math.sin(ph);
      const k = Math.pow(Math.max(cr, 0), opt.e || 1);
      rings.push({ c: V.mad(c, Y, sy * rad[1]), U: V.mul(X, rad[0] * k + 0.0005), V: V.mul(Z, rad[2] * k + 0.0005), t: i / N });
    }
    this.loft(rings, opt.M || 12, Object.assign({ mat, cap: false }, opt, { e: opt.e || 1 }));
  }
  // flat polygon (convex or star-shaped about centroid)
  poly(pts, n, mat) {
    let c = [0, 0, 0];
    for (const p of pts) c = V.add(c, p);
    c = V.mul(c, 1 / pts.length);
    for (let i = 0; i < pts.length; i++) this.tri(c, pts[i], pts[(i + 1) % pts.length], n, mat, 0, 0);
  }
  // make every triangle wind so its geometric normal agrees with its vertex normals
  orient() {
    const a = this.b.a, S = CHAR_STRIDE;
    for (let i = 0; i < this.b.n; i += S * 3) {
      const j = i + S, k = i + S * 2;
      const ux = a[j] - a[i], uy = a[j + 1] - a[i + 1], uz = a[j + 2] - a[i + 2];
      const vx = a[k] - a[i], vy = a[k + 1] - a[i + 1], vz = a[k + 2] - a[i + 2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      const nx = a[i + 3] + a[j + 3] + a[k + 3], ny = a[i + 4] + a[j + 4] + a[k + 4], nz = a[i + 5] + a[j + 5] + a[k + 5];
      if (gx * nx + gy * ny + gz * nz < 0) {
        for (let q = 0; q < S; q++) { const t = a[j + q]; a[j + q] = a[k + q]; a[k + q] = t; }
      }
    }
  }
  squash(start, centre, axis, along, across) {
    const a = this.b.a, ax = V.norm(axis);
    for (let i = start; i < this.b.n; i += CHAR_STRIDE) {
      const d = [a[i] - centre[0], a[i + 1] - centre[1], a[i + 2] - centre[2]];
      const k = V.dot(d, ax);
      a[i] = centre[0] + (d[0] - ax[0] * k) * across + ax[0] * k * along;
      a[i + 1] = centre[1] + (d[1] - ax[1] * k) * across + ax[1] * k * along;
      a[i + 2] = centre[2] + (d[2] - ax[2] * k) * across + ax[2] * k * along;
    }
  }
}

// piecewise-linear profile [[t,v],...] with smooth interpolation
function prof(table, t) {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (t <= table[i][0]) {
      const [a, va] = table[i - 1], [b, vb] = table[i];
      let u = (t - a) / (b - a);
      u = u * u * (3 - 2 * u) * 0.5 + u * 0.5;
      return va + (vb - va) * u;
    }
  }
  return table[table.length - 1][1];
}

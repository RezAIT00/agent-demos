// ---------- dynamic mesh builder ----------
// vertex: pos3 nrm3 uv2 mat part lineWeight ao  = 12 floats
const VSTR = 12;
class Mesh {
  constructor(maxV = 420000, maxI = 2400000) {
    this.v = new Float32Array(maxV * VSTR); this.i = new Uint32Array(maxI); this.nv = 0; this.ni = 0; this.M = M4.id(); this.NM = [1, 0, 0, 0, 1, 0, 0, 0, 1]; this.stack = [];
  }
  reset() { this.nv = 0; this.ni = 0; this.M = M4.id(); this.NM = [1, 0, 0, 0, 1, 0, 0, 0, 1]; this.stack.length = 0; return this; }
  push(m) { this.stack.push([this.M, this.NM]); this.M = M4.mul(this.M, m); this._nm(); }
  pop() { [this.M, this.NM] = this.stack.pop(); }
  _nm() { // inverse transpose of upper 3x3
    const m = this.M; const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], k = m[10];
    const A = e * k - f * h, B = -(d * k - f * g), C = d * h - e * g, D = -(b * k - c * h), E = a * k - c * g, F = -(a * h - b * g), G = b * f - c * e, H = -(a * f - c * d), K = a * e - b * d;
    const s = Math.sign(a * A + b * B + c * C) || 1;
    this.NM = [A * s, D * s, G * s, B * s, E * s, H * s, C * s, F * s, K * s]; // columns
  }
  vert(p, n, u, v, mat, part, lw, ao) {
    const M = this.M, N = this.NM, a = this.v, o = this.nv * VSTR;
    a[o] = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12];
    a[o + 1] = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13];
    a[o + 2] = M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14];
    let nx = N[0] * n[0] + N[3] * n[1] + N[6] * n[2], ny = N[1] * n[0] + N[4] * n[1] + N[7] * n[2], nz = N[2] * n[0] + N[5] * n[1] + N[8] * n[2];
    const l = Math.hypot(nx, ny, nz) || 1;
    a[o + 3] = nx / l; a[o + 4] = ny / l; a[o + 5] = nz / l;
    a[o + 6] = u; a[o + 7] = v; a[o + 8] = mat; a[o + 9] = part; a[o + 10] = lw; a[o + 11] = ao;
    return this.nv++;
  }
  tri(a, b, c) { const I = this.i; I[this.ni++] = a; I[this.ni++] = b; I[this.ni++] = c; }

  // parametric surface. fn(u,v) -> [x,y,z]. o: {mat, part, lw, ao, uv, wrapV, flip, poleN}
  grid(nu, nv, fn, o) {
    const cols = nv + 1, P = new Array((nu + 1) * cols);
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) P[i * cols + j] = fn(i / nu, j / nv);
    const base = this.nv, matf = typeof o.mat === 'function', lwf = typeof o.lw === 'function', aof = typeof o.ao === 'function';
    const at = (i, j) => P[clamp(i, 0, nu) * cols + clamp(j, 0, nv)];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      for (let j = 0; j <= nv; j++) {
        const v = j / nv; const p = P[i * cols + j];
        let jm = j - 1, jp = j + 1;
        if (o.wrapV) { if (jm < 0) jm = nv - 1; if (jp > nv) jp = 1; }
        const du = sub(at(i + 1, j), at(i - 1, j)), dv = sub(at(i, jp), at(i, jm));
        let n = cross(dv, du);
        let l = vlen(n);
        if (l < 1e-10) { // degenerate: borrow from neighbouring ring
          const i2 = i === 0 ? 1 : i - 1;
          const du2 = sub(at(i2 + 1, j), at(i2 - 1, j)), dv2 = sub(at(i2, jp), at(i2, jm));
          n = cross(dv2, du2); l = vlen(n);
          if (l < 1e-10) n = [0, 1, 0];
        }
        if (o.poleN && (i === 0 || i === nu)) n = i === 0 ? mul(o.poleN[0], 1) : o.poleN[1];
        if (o.flip) n = [-n[0], -n[1], -n[2]];
        const uv = o.uv ? o.uv(u, v) : [u, v];
        this.vert(p, n, uv[0], uv[1], matf ? o.mat(u, v) : o.mat, o.part, lwf ? o.lw(u, v) : (o.lw === undefined ? 1 : o.lw), aof ? o.ao(u, v, p) : (o.ao || 0));
      }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = base + i * cols + j, b = a + cols, c = b + 1, d = a + 1;
      this.tri(a, b, c); this.tri(a, c, d);
    }
  }

  // loft along spine. spine(u)->point ; rad(u)->[rUp, rSide]; o.up = up hint ; v angle: 0 = top
  loft(spine, rad, o) {
    const nu = o.nu || 24, nv = o.nv || 18;
    const C = [], U = [], S = [], T = [];
    for (let i = 0; i <= nu; i++) C.push(spine(i / nu));
    let up = norm(o.up || [0, 1, 0]);
    for (let i = 0; i <= nu; i++) {
      let t = norm(sub(C[Math.min(nu, i + 1)], C[Math.max(0, i - 1)]));
      let u = sub(up, mul(t, dot(up, t)));
      if (vlen(u) < 1e-5) u = sub([1, 0, 0], mul(t, t[0]));
      u = norm(u); up = u;
      T.push(t); U.push(u); S.push(norm(cross(t, u)));
    }
    const ends = [mul(T[0], -1), T[nu]];
    this.grid(nu, nv, (u, v) => {
      const i = Math.round(u * nu); let a = v * TAU; const r = rad(u);
      const m = o.shape ? o.shape(u, a) : 1;
      const cu = Math.cos(a), su = Math.sin(a);
      let cc = cu, ss = su;
      if (o.square) { const e = o.square; cc = Math.sign(cu) * Math.pow(Math.abs(cu), e); ss = Math.sign(su) * Math.pow(Math.abs(su), e); }
      return [C[i][0] + (U[i][0] * cc * r[0] + S[i][0] * ss * r[1]) * m, C[i][1] + (U[i][1] * cc * r[0] + S[i][1] * ss * r[1]) * m, C[i][2] + (U[i][2] * cc * r[0] + S[i][2] * ss * r[1]) * m];
    }, {
      mat: o.mat, part: o.part, lw: o.lw, ao: o.ao, wrapV: !o.shapeSeam, poleN: o.cap === false ? null : (o.pole ? ends : null),
      uv: o.uv || ((u, v) => [u, v <= 0.5 ? v * 2 : (v - 1) * 2])
    });
    // caps
    if (o.caps) for (const end of [0, nu]) {
      const r = rad(end / nu); if (r[0] < 1e-4) continue;
      const nrm = end === 0 ? mul(T[0], -1) : T[nu];
      const c0 = this.vert(C[end], nrm, 0, 0, typeof o.mat === 'function' ? o.mat(end / nu, 0) : o.mat, o.part, typeof o.lw === 'number' ? o.lw : 1, 0);
      let prev = -1;
      for (let j = 0; j <= nv; j++) {
        const a = j / nv * TAU;
        const p = [C[end][0] + U[end][0] * Math.cos(a) * r[0] + S[end][0] * Math.sin(a) * r[1], C[end][1] + U[end][1] * Math.cos(a) * r[0] + S[end][1] * Math.sin(a) * r[1], C[end][2] + U[end][2] * Math.cos(a) * r[0] + S[end][2] * Math.sin(a) * r[1]];
        const k = this.vert(p, nrm, 0, 0, typeof o.mat === 'function' ? o.mat(end / nu, j / nv) : o.mat, o.part, typeof o.lw === 'number' ? o.lw : 1, 0);
        if (prev >= 0) this.tri(c0, prev, k); prev = k;
      }
    }
  }
  // round tube through control points
  tube(pts, r0, r1, o) {
    const n = o.nu || Math.max(4, (pts.length - 1) * 8);
    this.loft(pts.length === 2 ? (u => vlerp(pts[0], pts[1], u)) : (u => catmull(pts, u)), u => { const r = lerp(r0, r1, u); return [r * (o.squash || 1), r * (o.wide || 1)]; },
      Object.assign({ nu: pts.length === 2 ? (o.nu || 2) : n, nv: o.nv || 10, caps: o.caps !== false }, o));
  }
  // rounded-end tapered capsule between two points
  capsule(a, b, r0, r1, o) {
    const d = norm(sub(b, a)), L = dist(a, b);
    const tot = L + r0 + r1;
    this.loft(u => mad(a, d, -r0 + u * tot), u => {
      const s = -r0 + u * tot;
      if (s < 0) { const r = Math.sqrt(Math.max(0, r0 * r0 - s * s)); return [r, r]; }
      if (s > L) { const q = s - L; const r = Math.sqrt(Math.max(0, r1 * r1 - q * q)); return [r, r]; }
      const r = lerp(r0, r1, s / L); return [r, r];
    }, Object.assign({ nu: o.nu || 16, nv: o.nv || 12, up: Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0] }, o));
  }
  ellipsoid(c, ax, ay, az, o) { // axes are full vectors (direction*radius)
    this.grid(o.nu || 16, o.nv || 22, (u, v) => {
      const th = u * PI, ph = v * TAU, st = Math.sin(th), ct = -Math.cos(th);
      return [c[0] + ax[0] * ct + ay[0] * st * Math.cos(ph) + az[0] * st * Math.sin(ph), c[1] + ax[1] * ct + ay[1] * st * Math.cos(ph) + az[1] * st * Math.sin(ph), c[2] + ax[2] * ct + ay[2] * st * Math.cos(ph) + az[2] * st * Math.sin(ph)];
    }, Object.assign({ wrapV: true, poleN: [mul(norm(ax), -1), norm(ax)] }, o));
  }
  sphere(c, r, o) { this.ellipsoid(c, [r, 0, 0], [0, r, 0], [0, 0, r], Object.assign({ nu: 10, nv: 14 }, o)); }
  // pointed feather blade: from base along dir, width vector wdir
  blade(base, dir, wdir, len, width, o) {
    const nu = o.nu || 10, nv = o.nv || 4;
    const d = norm(dir); let w = sub(wdir, mul(d, dot(wdir, d))); w = norm(w);
    const n = norm(cross(w, d));
    const bend = o.bend || 0, cup = o.cup === undefined ? 0.18 : o.cup, shp = o.shape || 'feather';
    const lw = o.lw === undefined ? 1 : o.lw;
    this.grid(nu, nv, (u, v) => {
      const s = v * 2 - 1;
      let wd;
      if (shp === 'spike') wd = Math.pow(1 - u, 0.8) * (0.55 + 0.45 * Math.sin(Math.min(1, u * 3) * PI / 2));
      else if (shp === 'petal') wd = Math.sin(PI * (0.08 + 0.92 * u)) * 1.0;
      else wd = u < 0.72 ? (0.55 + 0.45 * Math.sin(u / 0.72 * PI / 2)) : Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.72) / 0.28, 2))) * (1 - (u - 0.72) * 0.55);
      const hw = width * 0.5 * wd + 0.0004;
      const bz = bend * u * u * len;
      return [base[0] + d[0] * len * u + w[0] * s * hw + n[0] * (bz + cup * hw * s * s),
        base[1] + d[1] * len * u + w[1] * s * hw + n[1] * (bz + cup * hw * s * s),
        base[2] + d[2] * len * u + w[2] * s * hw + n[2] * (bz + cup * hw * s * s)];
    }, { mat: o.mat, part: o.part, lw: typeof lw === 'function' ? lw : ((u) => lw * (1 - 0.75 * u * u)), ao: o.ao || 0, uv: (u, v) => [u, v * 2 - 1] });
  }
  torus(c, ex, ey, ez, R, ru, rn, o) { // ring in (ex,ey) plane; ru radial radius, rn axial radius
    this.grid(o.nu || 96, o.nv || 12, (u, v) => {
      const a = u * TAU, b = v * TAU; const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const rr = R + ru * cb;
      return [c[0] + ex[0] * ca * rr + ey[0] * sa * rr + ez[0] * rn * sb, c[1] + ex[1] * ca * rr + ey[1] * sa * rr + ez[1] * rn * sb, c[2] + ex[2] * ca * rr + ey[2] * sa * rr + ez[2] * rn * sb];
    }, Object.assign({ wrapV: true, flip: true, uv: (u, v) => [u, v <= 0.5 ? v * 2 : (v - 1) * 2] }, o));
  }
  // flat ring with arbitrary radial outline, in plane (ex,ey), thickness along ez
  ringPlate(c, ex, ey, ez, rOut, rIn, th, n, o) {
    const P = (a, r, z) => [c[0] + ex[0] * Math.cos(a) * r + ey[0] * Math.sin(a) * r + ez[0] * z, c[1] + ex[1] * Math.cos(a) * r + ey[1] * Math.sin(a) * r + ez[1] * z, c[2] + ex[2] * Math.cos(a) * r + ey[2] * Math.sin(a) * r + ez[2] * z];
    for (const side of [-1, 1]) {
      const nrm = mul(ez, side); let pa = -1, pb = -1;
      for (let i = 0; i <= n; i++) {
        const a = i / n * TAU, ro = typeof rOut === 'function' ? rOut(a, i) : rOut, ri = typeof rIn === 'function' ? rIn(a, i) : rIn;
        const A = this.vert(P(a, ro, side * th / 2), nrm, i / n, 1, o.mat, o.part, o.lw === undefined ? 1 : o.lw, o.ao || 0);
        const B = this.vert(P(a, ri, side * th / 2), nrm, i / n, 0, o.mat, o.part, o.lw === undefined ? 1 : o.lw, o.ao || 0);
        if (pa >= 0) { this.tri(pa, A, B); this.tri(pa, B, pb); } pa = A; pb = B;
      }
    }
    for (const rf of [rOut, rIn]) {
      let pa = -1, pb = -1;
      for (let i = 0; i <= n; i++) {
        const a = i / n * TAU, r = typeof rf === 'function' ? rf(a, i) : rf;
        const nrm = comb([ex, Math.cos(a)], [ey, Math.sin(a)]);
        const nn = rf === rIn ? mul(nrm, -1) : nrm;
        const A = this.vert(P(a, r, -th / 2), nn, i / n, 0.5, o.mat, o.part, o.lw === undefined ? 1 : o.lw, o.ao || 0);
        const B = this.vert(P(a, r, th / 2), nn, i / n, 0.5, o.mat, o.part, o.lw === undefined ? 1 : o.lw, o.ao || 0);
        if (pa >= 0) { this.tri(pa, A, B); this.tri(pa, B, pb); } pa = A; pb = B;
      }
    }
  }
  box(c, ax, ay, az, o) { // half-extent vectors
    const faces = [[ax, ay, az], [mul(ax, -1), az, ay], [ay, az, ax], [mul(ay, -1), ax, az], [az, ax, ay], [mul(az, -1), ay, ax]];
    for (const [n, a, b] of faces) {
      const nn = norm(n);
      const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => this.vert(comb([c, 1], [n, 1], [a, s], [b, t]), nn, (s + 1) / 2, (t + 1) / 2, o.mat, o.part, o.lw === undefined ? 1 : o.lw, o.ao || 0));
      this.tri(q[0], q[1], q[2]); this.tri(q[0], q[2], q[3]);
    }
  }
  // ribbon between two polylines
  ribbon(L, R, o) {
    const n = L.length - 1;
    this.grid(n, 2, (u, v) => { const i = Math.round(u * n); const m = vlerp(L[i], R[i], v); if (v > 0.25 && v < 0.75 && o.fold) return mad(m, o.fold(u), 1); return m; },
      { mat: o.mat, part: o.part, lw: o.lw, ao: o.ao, uv: (u, v) => [u, v * 2 - 1] });
  }
  // triangle fan patch (flat), pts in order
  fan(center, pts, nrm, o) {
    const c = this.vert(center, nrm, 0.5, 0.5, o.mat, o.part, o.lw === undefined ? 1 : o.lw, o.ao || 0);
    let prev = -1;
    pts.forEach((p, i) => { const k = this.vert(p, nrm, i / pts.length, 0, o.mat, o.part, o.lw === undefined ? 1 : o.lw, o.ao || 0); if (prev >= 0) this.tri(c, prev, k); prev = k; });
  }
}

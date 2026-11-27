// fxcore.js — batched FX primitives shared by the film and the character sheet
class RibbonBatch {
  constructor() { this.a = new Float32Array(1 << 17); this.n = 0; }
  reset() { this.n = 0; }
  need(k) { if (this.n + k > this.a.length) { const b = new Float32Array(Math.max(this.a.length * 2, this.n + k)); b.set(this.a); this.a = b; } }
  vert(p, u, v, style, seed, col) {
    const a = this.a; let i = this.n;
    a[i++] = p[0]; a[i++] = p[1]; a[i++] = p[2]; a[i++] = u; a[i++] = v; a[i++] = style; a[i++] = seed;
    a[i++] = col[0]; a[i++] = col[1]; a[i++] = col[2]; a[i++] = col[3]; this.n = i;
  }
  // pts from tail to head, ws = half widths; facing: view direction (ribbon turns to face it) or null with fixed normal
  add(pts, ws, style, seed, col, view) {
    const N = pts.length; if (N < 2) return;
    this.need((N - 1) * 6 * 11);
    const sides = [];
    for (let i = 0; i < N; i++) {
      const t = V.sub(pts[Math.min(N - 1, i + 1)], pts[Math.max(0, i - 1)]);
      let s = V.cross(t, view); if (V.len(s) < 1e-6) s = [0, 1, 0];
      s = V.norm(s);
      if (i > 0 && V.dot(s, V.norm(sides[i - 1])) < 0) s = V.neg(s);
      sides.push(V.mul(s, Array.isArray(ws) ? ws[i] : ws));
    }
    for (let i = 0; i < N - 1; i++) {
      const u0 = i / (N - 1), u1 = (i + 1) / (N - 1);
      const a = V.add(pts[i], sides[i]), b = V.sub(pts[i], sides[i]), c = V.add(pts[i + 1], sides[i + 1]), d = V.sub(pts[i + 1], sides[i + 1]);
      this.vert(a, u0, 1, style, seed, col); this.vert(b, u0, -1, style, seed, col); this.vert(c, u1, 1, style, seed, col);
      this.vert(c, u1, 1, style, seed, col); this.vert(b, u0, -1, style, seed, col); this.vert(d, u1, -1, style, seed, col);
    }
  }
}
// instanced streaks / droplets: head(3) width, tail(3) kind, colour(4)
class DropBatch {
  constructor() { this.a = new Float32Array(12 * 2048); this.n = 0; }
  reset() { this.n = 0; }
  add(head, tail, w, kind, col) {
    if ((this.n + 1) * 12 > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; }
    this.a.set([head[0], head[1], head[2], w, tail[0], tail[1], tail[2], kind, col[0], col[1], col[2], col[3] !== undefined ? col[3] : 1], this.n * 12);
    this.n++;
  }
}
// instanced smoke puffs: pos(3) radius, seed tint opacity erosion
class PuffBatch {
  constructor() { this.a = new Float32Array(8 * 4096); this.n = 0; }
  reset() { this.n = 0; }
  add(p, r, seed, tint, op, erode) {
    if ((this.n + 1) * 8 > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; }
    this.a.set([p[0], p[1], p[2], r, seed, tint, op, erode], this.n * 8);
    this.n++;
  }
}

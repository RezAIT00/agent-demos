// ───────────────────────────── geometry toolkit ─────────────────────────────
const M = { PLASTER: 0, BRICK: 1, STONE: 2, WOOD: 3, IRON: 4, GLASS: 5, COBBLE: 6, GRIT: 7, WATER: 8, MIRROR: 9, CLOTH: 10, LEAF: 11, PETAL: 12, MATTE: 13, ROOF: 14, BOTTLE: 15, BRASS: 16, EMIT: 17, INNER: 18, BOARD: 19, FUR: 20 };

class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.mat = []; }
  add(geo, matrix, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const c = o.color || [0.5, 0.5, 0.5];
    const mid = (o.mat ?? M.MATTE) + (o.interior ? 100 : 0);
    const flip = matrix && matrix.determinant() < 0;
    for (let i = 0; i < p.length; i += 3) {
      this.pos.push(p[i], p[i + 1], p[i + 2]); this.nor.push(n[i], n[i + 1], n[i + 2]);
      this.col.push(c[0], c[1], c[2]); this.mat.push(mid, o.rough ?? 0.7, o.lamp ?? 0, o.glow ?? 0);
    }
    g.dispose();
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 4));
    return g;
  }
}

const mtx = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V3(sx, sy, sz));

// A frame lets us build in local coordinates (u along a wall, v up, d out of the wall)
class Frame {
  constructor(origin, U) {
    this.o = origin.clone(); this.U = U.clone().normalize(); this.Y = V3(0, 1, 0);
    this.N = new THREE.Vector3().crossVectors(this.U, this.Y).normalize();
    this.m = new THREE.Matrix4().makeBasis(this.U, this.Y, this.N).setPosition(this.o);
  }
  static wall(ax, az, bx, bz) { const U = V3(bx - ax, 0, bz - az); const f = new Frame(V3(ax, 0, az), U); f.len = U.length(); return f; }
  p(u, v, d = 0) { return this.o.clone().addScaledVector(this.U, u).addScaledVector(this.Y, v).addScaledVector(this.N, d); }
  at(u, v, d, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return this.m.clone().multiply(mtx(u, v, d, rx, ry, rz, sx, sy, sz)); }
}

const BOXC = new Map();
function boxGeo(w, h, d) { const k = w + ',' + h + ',' + d; if (!BOXC.has(k)) BOXC.set(k, new THREE.BoxGeometry(w, h, d)); return BOXC.get(k); }
function box(B, F, u0, u1, v0, v1, d0, d1, o) { // axis box in a wall frame
  B.add(boxGeo(u1 - u0, v1 - v0, d1 - d0), F.at((u0 + u1) / 2, (v0 + v1) / 2, (d0 + d1) / 2), o);
}
function wbox(B, x, y, z, w, h, d, o, ry = 0, rx = 0, rz = 0) { B.add(boxGeo(w, h, d), mtx(x, y, z, rx, ry, rz), o); }

// cylinder between two points
function rod(B, a, b, r, o, seg = 7, r2 = null) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); if (len < 1e-4) return;
  const g = new THREE.CylinderGeometry(r2 ?? r, r, len, seg, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize());
  B.add(g, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V3(1, 1, 1)), o); g.dispose();
}
function tube(B, pts, r, o, segs = 24, rad = 6, closed = false) {
  const c = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.5);
  const g = new THREE.TubeGeometry(c, segs, r, rad, closed); B.add(g, null, o); g.dispose();
}
function sphere(B, p, r, o, sx = 1, sy = 1, sz = 1, seg = 14) { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.75 | 0)); B.add(g, mtx(p.x, p.y, p.z, 0, 0, 0, sx, sy, sz), o); g.dispose(); }
function lathe(B, pts, matrix, o, seg = 14) { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); B.add(g, matrix, o); g.dispose(); }

// slab of masonry with real openings: front face at d = 0, thickness going inwards, reveals for free
function wallSlab(B, F, len, h, holes, thick, o, v0 = 0) {
  const s = new THREE.Shape(); s.moveTo(0, v0); s.lineTo(len, v0); s.lineTo(len, h); s.lineTo(0, h); s.closePath();
  for (const H of holes) {
    const p = new THREE.Path();
    if (H.arch) {
      const r = (H.u1 - H.u0) / 2, spring = H.v1 - r;
      p.moveTo(H.u0, H.v0); p.lineTo(H.u0, spring); p.absarc(H.u0 + r, spring, r, Math.PI, 0, true); p.lineTo(H.u1, H.v0); p.closePath();
    } else { p.moveTo(H.u0, H.v0); p.lineTo(H.u0, H.v1); p.lineTo(H.u1, H.v1); p.lineTo(H.u1, H.v0); p.closePath(); }
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 18 });
  B.add(g, F.m.clone().multiply(mtx(0, 0, -thick)), o); g.dispose();
}

// naive surface nets: organic meshes (cat, figure) from signed distance functions
function sdfMesh(sdf, min, max, cell) {
  const nx = Math.ceil((max.x - min.x) / cell) + 1, ny = Math.ceil((max.y - min.y) / cell) + 1, nz = Math.ceil((max.z - min.z) / cell) + 1;
  const val = new Float32Array(nx * ny * nz); const I = (i, j, k) => i + nx * (j + ny * k);
  const p = V3();
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { p.set(min.x + i * cell, min.y + j * cell, min.z + k * cell); val[I(i, j, k)] = sdf(p); }
  const vid = new Int32Array(nx * ny * nz).fill(-1); const verts = [], norms = [], idx = [];
  const corners = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const e = cell * 0.5;
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = corners.map(o => val[I(i + o[0], j + o[1], k + o[2])]);
    let neg = 0; for (const v of c) if (v < 0) neg++; if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) if ((c[a] < 0) !== (c[b] < 0)) { const t = c[a] / (c[a] - c[b]); sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t; sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t; sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t; n++; }
    const q = V3(min.x + (i + sx / n) * cell, min.y + (j + sy / n) * cell, min.z + (k + sz / n) * cell);
    vid[I(i, j, k)] = verts.length / 3; verts.push(q.x, q.y, q.z);
    const gx = sdf(V3(q.x + e, q.y, q.z)) - sdf(V3(q.x - e, q.y, q.z)), gy = sdf(V3(q.x, q.y + e, q.z)) - sdf(V3(q.x, q.y - e, q.z)), gz = sdf(V3(q.x, q.y, q.z + e)) - sdf(V3(q.x, q.y, q.z - e));
    const gn = V3(gx, gy, gz).normalize(); norms.push(gn.x, gn.y, gn.z);
  }
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v = val[I(i, j, k)] < 0;
    if (i < nx - 1 && v !== (val[I(i + 1, j, k)] < 0)) quad(vid[I(i, j - 1, k - 1)], vid[I(i, j, k - 1)], vid[I(i, j - 1, k)], vid[I(i, j, k)], !v);
    if (j < ny - 1 && v !== (val[I(i, j + 1, k)] < 0)) quad(vid[I(i - 1, j, k - 1)], vid[I(i - 1, j, k)], vid[I(i, j, k - 1)], vid[I(i, j, k)], !v);
    if (k < nz - 1 && v !== (val[I(i, j, k + 1)] < 0)) quad(vid[I(i - 1, j - 1, k)], vid[I(i, j - 1, k)], vid[I(i - 1, j, k)], vid[I(i, j, k)], !v);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setIndex(idx);
  return g;
}
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };
function sdCapsule(p, a, b, r1, r2 = r1) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z; const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const t = clamp((apx * abx + apy * aby + apz * abz) / (abx * abx + aby * aby + abz * abz), 0, 1);
  return Math.hypot(apx - abx * t, apy - aby * t, apz - abz * t) - lerp(r1, r2, t);
}
function sdEllipsoid(p, c, r) { const x = (p.x - c.x) / r.x, y = (p.y - c.y) / r.y, z = (p.z - c.z) / r.z; const k0 = Math.hypot(x, y, z); const k1 = Math.hypot(x / r.x, y / r.y, z / r.z); return k1 > 0 ? k0 * (k0 - 1) / k1 : -Math.min(r.x, r.y, r.z); }

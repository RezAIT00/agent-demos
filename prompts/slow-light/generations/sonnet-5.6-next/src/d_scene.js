// ───────────────────────────── the street ─────────────────────────────
// plan view: camera near the origin looking down -z. Left walls face +x, right walls face -x.
const HERO = (() => { // facade with the lamp window, angled 30 deg toward the camera; the bulb hangs 14 cm proud of it
  const U = V3(0.5, 0, -0.8660254).normalize(); const N = new THREE.Vector3().crossVectors(U, V3(0, 1, 0));
  const behind = V3(-3.0, 0, -8.0).addScaledVector(N, -0.14);
  const A = behind.clone().addScaledVector(U, -2.3); const f = new Frame(A, U); f.len = 4.7; f.ub = 2.3; return f;
})();
const HERO_END = HERO.p(HERO.len, 0, 0);
const W_NEARL = Frame.wall(-3.75, 3.5, HERO.o.x, HERO.o.z);
const W_FARL = Frame.wall(HERO_END.x, HERO_END.z, -2.02, -19.0);
const W_NEARR = Frame.wall(4.6, -8.6, 5.0, 3.5);
const CAFE = Frame.wall(2.4, -12.6, 4.6, -8.6);
const W_FARR = Frame.wall(2.22, -19.0, 2.4, -12.6);
const ENDW = Frame.wall(-2.02, -19.0, 2.22, -19.0);

const CAFE_WIN = { u0: 1.0, u1: 4.22, v0: 0.55, v1: 3.25 };
// The mirror is aimed by the law of reflection so that, from the camera around t = 4.5 s, it shows the bare bulb:
// its normal bisects (mirror -> camera) and (mirror -> bulb). Everything it shows then follows from that one pose.
const MIRROR_AIM = CAFE.p(2.32, 1.50, -1.70);
const MIRROR = (() => {
  const toCam = cameraAt(4.45).pos.clone().sub(MIRROR_AIM).normalize();
  const toLamp = LAMPS[0].pos.clone().sub(MIRROR_AIM).normalize();
  const n = toCam.add(toLamp).normalize();
  const right = CAFE.U.clone().addScaledVector(n, -CAFE.U.dot(n)).normalize();
  const up = new THREE.Vector3().crossVectors(n, right).normalize(); if (up.y < 0) up.negate();
  const c = MIRROR_AIM.clone().addScaledVector(up, 0.30).addScaledVector(right, 0.02);
  return { n, c, right, up, hw: 1.13, hh: 0.70 };
})();
const SHOP = { u0: 1.86, u1: 4.02, v0: 0.50, v1: 2.72 };

const PROXIES = [];   // rectangles used to place the one-bounce virtual lights
function proxy(F, u0, u1, v0, v1, d, albedo, flipN = false) {
  PROXIES.push({ o: F.p(u0, v0, d), a: F.U.clone().multiplyScalar(u1 - u0), b: V3(0, v1 - v0, 0), n: F.N.clone().multiplyScalar(flipN ? -1 : 1), albedo });
}

const COL = {
  heroPl: [0.50, 0.34, 0.20], ochre: [0.47, 0.30, 0.14], rose: [0.46, 0.25, 0.19], cream: [0.55, 0.47, 0.34], sage: [0.30, 0.33, 0.25], grey: [0.36, 0.34, 0.31], terracotta: [0.40, 0.17, 0.09],
  stone: [0.36, 0.33, 0.27], darkStone: [0.20, 0.19, 0.17], iron: [0.035, 0.036, 0.040],
  shTeal: [0.045, 0.135, 0.135], shGreen: [0.060, 0.115, 0.055], shRed: [0.21, 0.045, 0.030], shBlue: [0.055, 0.085, 0.17], wood: [0.12, 0.062, 0.028], frame: [0.30, 0.27, 0.21],
};

// ── foliage ──
const LEAF_GEO = (() => {
  const s = new THREE.Shape(); s.moveTo(0, -0.5); s.bezierCurveTo(0.55, -0.35, 0.5, 0.15, 0.0, 0.55); s.bezierCurveTo(-0.5, 0.15, -0.55, -0.35, 0, -0.5);
  const g = new THREE.ShapeGeometry(s, 3); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.28);
  g.computeVertexNormals(); return g;
})();
function leaf(B, pos, size, normalHint, col, mat = M.LEAF) {
  const n = normalHint.clone().add(V3(rand(-0.7, 0.7), rand(-0.3, 0.8), rand(-0.7, 0.7))).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), n).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), rand(0, 6.28)));
  B.add(LEAF_GEO, new THREE.Matrix4().compose(pos, q, V3(size, size, size)), { mat, color: col });
}
function leafCluster(B, c, rx, ry, rz, count, size, nh, base) {
  for (let i = 0; i < count; i++) {
    const p = V3(c.x + rand(-rx, rx) * Math.sqrt(RNG()), c.y + rand(-ry, ry), c.z + rand(-rz, rz) * Math.sqrt(RNG()));
    const k = rand(0.6, 1.35);
    leaf(B, p, size * rand(0.7, 1.3), nh, [base[0] * k, base[1] * k * rand(0.85, 1.15), base[2] * k]);
  }
}
function ivy(B, F, u, v, count, spread, up) {
  for (let s = 0; s < count; s++) {
    let cu = u + rand(-spread, spread) * 0.4, cv = v;
    const pts = [F.p(cu, cv, 0.015)];
    const steps = 18 + (RNG() * 16 | 0);
    let du = rand(-0.06, 0.06);
    for (let i = 0; i < steps; i++) {
      du = clamp(du + rand(-0.05, 0.05), -0.12, 0.12); cu += du; cv += up * rand(0.05, 0.17);
      if (cu < 0.03 || cu > F.len - 0.03) du *= -1;
      cu = clamp(cu, 0.03, F.len - 0.03);
      pts.push(F.p(cu, cv, 0.018));
      const dense = 1 - i / steps;
      const n = 3 + (RNG() * 9 * (0.35 + dense) | 0);
      for (let k = 0; k < n; k++) { const c = pick([[0.040, 0.105, 0.028], [0.060, 0.135, 0.030], [0.028, 0.075, 0.025], [0.09, 0.13, 0.03]]); leaf(B, F.p(cu + rand(-0.16, 0.16) * (0.4 + dense), cv + rand(-0.1, 0.1), rand(0.025, 0.11)), rand(0.055, 0.105), F.N, c); }
    }
    if (pts.length > 3) tube(B, pts, 0.007, { mat: M.WOOD, color: [0.05, 0.035, 0.02] }, pts.length * 2, 4);
  }
}
function flowerBox(B, F, u0, u1, v, flowers) {
  box(B, F, u0, u1, v - 0.16, v, 0.03, 0.24, { mat: M.WOOD, color: pick([[0.14, 0.07, 0.03], COL.shGreen, [0.22, 0.09, 0.05]]) });
  const n = Math.max(2, Math.round((u1 - u0) / 0.2));
  for (let i = 0; i < n; i++) {
    const cu = lerp(u0 + 0.09, u1 - 0.09, i / (n - 1));
    const c = F.p(cu, v + 0.07, 0.15);
    leafCluster(B, c, 0.14, 0.10, 0.12, 55, 0.062, F.N, [0.05, 0.13, 0.03]);
    for (let k = 0; k < 9; k++) {
      const fp = F.p(cu + rand(-0.11, 0.11), v + rand(0.06, 0.2), rand(0.1, 0.27));
      for (let j = 0; j < 6; j++) leaf(B, fp.clone().add(V3(rand(-0.025, 0.025), rand(-0.02, 0.02), rand(-0.025, 0.025))), 0.034, F.N, flowers, M.PETAL);
    }
    if (RNG() < 0.5) { // trailing stem
      let q = F.p(cu, v - 0.04, 0.26); for (let k = 0; k < 8; k++) { q = q.clone().add(V3(rand(-0.02, 0.02), -0.045, rand(-0.01, 0.01))); leaf(B, q, 0.05, F.N, [0.05, 0.12, 0.03]); }
    }
  }
}

// ── windows, shutters, balconies ──
function shutterLeaf(B, F, u0, u1, v0, v1, d, col, swing = 0, hingeLeft = true) {
  const w = u1 - u0;
  const hu = hingeLeft ? u0 : u1;
  const G = F.m.clone().multiply(mtx(hu, 0, d, 0, hingeLeft ? -swing : swing, 0));
  const s = hingeLeft ? 1 : -1;
  const part = (a, b, c0, c1, th, o) => B.add(boxGeo(Math.abs(b - a), c1 - c0, th), G.clone().multiply(mtx(s * (a + b) / 2, (c0 + c1) / 2, 0)), o);
  const o = { mat: M.WOOD, color: col };
  part(0, 0.055, v0, v1, 0.045, o); part(w - 0.055, w, v0, v1, 0.045, o);
  part(0.055, w - 0.055, v0, v0 + 0.07, 0.045, o); part(0.055, w - 0.055, v1 - 0.07, v1, 0.045, o); part(0.055, w - 0.055, (v0 + v1) / 2 - 0.03, (v0 + v1) / 2 + 0.03, 0.045, o);
  for (let y = v0 + 0.1; y < v1 - 0.09; y += 0.058) B.add(boxGeo(w - 0.1, 0.048, 0.01), G.clone().multiply(mtx(s * w / 2, y, 0, 0.6, 0, 0)), o);
  for (const y of [v0 + 0.2, v1 - 0.2]) part(0.0, w * 0.55, y, y + 0.025, 0.056, { mat: M.IRON, color: COL.iron });
}
function surround(B, F, u0, u1, v0, v1, o = { mat: M.STONE, color: COL.stone }) {
  box(B, F, u0 - 0.09, u0, v0, v1, -0.01, 0.045, o);
  box(B, F, u1, u1 + 0.09, v0, v1, -0.01, 0.045, o);
  box(B, F, u0 - 0.13, u1 + 0.13, v1, v1 + 0.15, -0.01, 0.065, o);
  box(B, F, u0 - 0.15, u1 + 0.15, v1 + 0.15, v1 + 0.19, -0.01, 0.10, o);
  box(B, F, u0 - 0.14, u1 + 0.14, v0 - 0.10, v0, -0.01, 0.13, o);
}
function windowFill(B, F, u0, u1, v0, v1, d = -0.17) {
  box(B, F, u0, u1, v0, v1, d - 0.03, d, { mat: M.GLASS, color: [0.01, 0.012, 0.015] });
  const o = { mat: M.WOOD, color: COL.frame };
  const um = (u0 + u1) / 2;
  box(B, F, u0, u0 + 0.05, v0, v1, d, d + 0.035, o); box(B, F, u1 - 0.05, u1, v0, v1, d, d + 0.035, o);
  box(B, F, u0, u1, v0, v0 + 0.06, d, d + 0.035, o); box(B, F, u0, u1, v1 - 0.05, v1, d, d + 0.035, o);
  box(B, F, um - 0.032, um + 0.032, v0, v1, d, d + 0.045, o);
  for (const t of [0.36, 0.70]) box(B, F, u0, u1, lerp(v0, v1, t) - 0.013, lerp(v0, v1, t) + 0.013, d, d + 0.03, o);
}
// opts: sh: 'open' | 'closed' | 'half' | null,  box: flower colour,  arch
function stdWindow(B, F, w) {
  const { u0, u1, v0, v1 } = w;
  surround(B, F, u0, u1, v0, v1);
  windowFill(B, F, u0, u1, v0, v1);
  const um = (u0 + u1) / 2, hw = (u1 - u0) / 2;
  const sc = w.sc || COL.shTeal;
  if (w.sh === 'closed') { shutterLeaf(B, F, u0 + 0.005, um - 0.004, v0 + 0.01, v1 - 0.01, -0.025, sc, 0, true); shutterLeaf(B, F, um + 0.004, u1 - 0.005, v0 + 0.01, v1 - 0.01, -0.025, sc, 0, false); }
  else if (w.sh === 'open') { shutterLeaf(B, F, u0 - hw - 0.1, u0 - 0.1, v0, v1, 0.07, sc, 0.03, true); shutterLeaf(B, F, u1 + 0.1, u1 + 0.1 + hw, v0, v1, 0.07, sc, -0.0, false); }
  else if (w.sh === 'half') { shutterLeaf(B, F, u0 + 0.0, um - 0.004, v0 + 0.01, v1 - 0.01, 0.03, sc, 1.0, true); shutterLeaf(B, F, u1 + 0.1, u1 + 0.1 + hw, v0, v1, 0.07, sc, 0, false); }
  if (w.box) flowerBox(B, F, u0 - 0.04, u1 + 0.04, v0 - 0.1, w.box);
}
function ironRailing(B, F, u0, u1, v0, v1, d, step = 0.115, scroll = true) {
  const o = { mat: M.IRON, color: COL.iron };
  rod(B, F.p(u0, v1, d), F.p(u1, v1, d), 0.022, o, 8);
  rod(B, F.p(u0, v1 - 0.09, d), F.p(u1, v1 - 0.09, d), 0.009, o, 6);
  rod(B, F.p(u0, v0 + 0.05, d), F.p(u1, v0 + 0.05, d), 0.012, o, 6);
  const n = Math.max(2, Math.round((u1 - u0) / step));
  for (let i = 0; i <= n; i++) {
    const u = lerp(u0, u1, i / n);
    rod(B, F.p(u, v0, d), F.p(u, v1, d), (i === 0 || i === n) ? 0.017 : 0.0085, o, 6);
    sphere(B, F.p(u, v0 + (v1 - v0) * 0.5, d), 0.016, o, 1, 1.4, 1, 7);
    if (scroll && i < n) {
      const cu = lerp(u0, u1, (i + 0.5) / n);
      const ring = (cv, r) => { const g = new THREE.TorusGeometry(r, 0.0055, 5, 14, Math.PI * 1.65); B.add(g, F.at(cu, cv, d, 0, 0, (i % 2 ? 0.6 : 3.7)), o); g.dispose(); };
      ring(v0 + 0.15, 0.036); ring(v1 - 0.17, 0.028);
    }
  }
}
function balcony(B, F, u0, u1, v, depth = 0.55) {
  box(B, F, u0 - 0.06, u1 + 0.06, v - 0.09, v, 0, depth, { mat: M.STONE, color: COL.stone });
  box(B, F, u0 - 0.03, u1 + 0.03, v - 0.14, v - 0.09, 0, depth - 0.05, { mat: M.STONE, color: COL.darkStone });
  for (const u of [u0 + 0.12, u1 - 0.12]) {
    tube(B, [F.p(u, v - 0.6, 0.01), F.p(u, v - 0.5, 0.17), F.p(u, v - 0.26, 0.2), F.p(u, v - 0.13, depth - 0.1)], 0.016, { mat: M.IRON, color: COL.iron }, 16, 6);
    rod(B, F.p(u, v - 0.6, 0.015), F.p(u, v - 0.13, 0.015), 0.014, { mat: M.IRON, color: COL.iron });
  }
  ironRailing(B, F, u0, u1, v, v + 0.92, depth - 0.04);
  for (const u of [u0, u1]) { for (let d = 0.1; d < depth - 0.05; d += 0.12) rod(B, F.p(u, v, d), F.p(u, v + 0.92, d), 0.008, { mat: M.IRON, color: COL.iron }); rod(B, F.p(u, v + 0.92, 0), F.p(u, v + 0.92, depth - 0.04), 0.02, { mat: M.IRON, color: COL.iron }); }
}
function door(B, F, u0, u1, v1, col = COL.wood, arch = false) {
  const o = { mat: M.WOOD, color: col };
  box(B, F, u0, u1, 0, v1, -0.22, -0.18, o);
  const um = (u0 + u1) / 2;
  for (const [a, b] of [[u0 + 0.07, um - 0.04], [um + 0.04, u1 - 0.07]]) for (const [c, d] of [[0.2, 0.75], [0.86, 1.5], [1.62, v1 - 0.22]]) { box(B, F, a, b, c, d, -0.18, -0.158, o); box(B, F, a + 0.05, b - 0.05, c + 0.05, d - 0.05, -0.158, -0.14, o); }
  box(B, F, um - 0.012, um + 0.012, 0.05, v1 - 0.05, -0.18, -0.15, o);
  sphere(B, F.p(um + 0.09, 1.08, -0.11), 0.035, { mat: M.BRASS, color: [0.55, 0.38, 0.12] });
  if (!arch) surround(B, F, u0, u1, 0.1, v1);
  box(B, F, u0 - 0.15, u1 + 0.15, 0, 0.12, -0.2, 0.22, { mat: M.STONE, color: COL.darkStone });
}
function plinth(B, F, ranges, h = 0.5) { for (const [a, b] of ranges) box(B, F, a, b, 0, h + rand(-0.03, 0.03), -0.02, 0.055, { mat: M.STONE, color: COL.darkStone }); }
function quoins(B, F, u, h, dir = 1) {
  for (let v = 0.5, i = 0; v < h - 0.4; v += 0.31, i++) {
    const w = i % 2 ? 0.28 : 0.46;
    box(B, F, dir > 0 ? u : u - w, dir > 0 ? u + w : u, v, v + 0.29, -0.01, 0.03 + rand(0, 0.008), { mat: M.STONE, color: COL.stone.map(c => c * rand(0.8, 1.1)) });
  }
}
function eaves(B, F, len, h) {
  box(B, F, -0.05, len + 0.05, h - 0.12, h, 0, 0.12, { mat: M.STONE, color: COL.darkStone });
  for (let u = 0.15; u < len; u += 0.42) box(B, F, u, u + 0.09, h, h + 0.09, -0.05, 0.30, { mat: M.WOOD, color: [0.07, 0.045, 0.028] });
  // tiled roof: pitched slab plus rows of curved tiles
  B.add(boxGeo(len + 0.1, 0.04, 1.6), F.at(len / 2, h + 0.55, -0.36, 0.55, 0, 0), { mat: M.ROOF, color: [0.17, 0.065, 0.035] });
  const g = new THREE.CylinderGeometry(0.075, 0.085, 0.42, 8, 1, true, -Math.PI / 2, Math.PI);
  for (let u = 0.08; u < len; u += 0.17) for (let r = 0; r < 4; r++) {
    const d = 0.36 - r * 0.32, v = h + 0.115 + r * 0.196;
    B.add(g, F.at(u + rand(-0.008, 0.008), v + rand(-0.006, 0.006), d - 0.12, -Math.PI / 2 + 0.55, 0, 0), { mat: M.ROOF, color: pick([[0.22, 0.085, 0.042], [0.17, 0.07, 0.04], [0.26, 0.12, 0.06], [0.13, 0.07, 0.05]]) });
  }
  g.dispose();
  // half-round gutter
  const gg = new THREE.CylinderGeometry(0.075, 0.075, len + 0.1, 10, 1, true, 0, Math.PI);
  B.add(gg, F.at(len / 2, h + 0.045, 0.40, 0, 0, Math.PI / 2).multiply(mtx(0, 0, 0, 0, -Math.PI / 2, 0)), { mat: M.IRON, color: [0.09, 0.11, 0.10] }); gg.dispose();
  rod(B, F.p(-0.05, h + 0.045, 0.475), F.p(len + 0.05, h + 0.045, 0.475), 0.012, { mat: M.IRON, color: [0.09, 0.11, 0.10] });
}
function downpipe(B, F, u, h) {
  const o = { mat: M.IRON, color: [0.075, 0.095, 0.088] };
  tube(B, [F.p(u, h + 0.03, 0.4), F.p(u, h - 0.2, 0.3), F.p(u, h - 0.45, 0.085), F.p(u, h - 0.7, 0.085)], 0.045, o, 16, 8);
  rod(B, F.p(u, h - 0.7, 0.085), F.p(u, 0.35, 0.085), 0.045, o, 10);
  tube(B, [F.p(u, 0.36, 0.085), F.p(u, 0.18, 0.1), F.p(u, 0.12, 0.22)], 0.045, o, 8, 8);
  for (let v = 0.9; v < h - 0.7; v += 1.35) box(B, F, u - 0.065, u + 0.065, v, v + 0.035, 0, 0.14, o);
}
function chimney(B, x, y, z, ry = 0) {
  wbox(B, x, y + 0.5, z, 0.5, 1.0, 0.38, { mat: M.BRICK, color: [0.24, 0.095, 0.05] }, ry);
  wbox(B, x, y + 1.04, z, 0.58, 0.08, 0.46, { mat: M.STONE, color: COL.darkStone }, ry);
  for (const dx of [-0.12, 0.12]) rod(B, V3(x + dx, y + 1.05, z), V3(x + dx, y + 1.38, z), 0.07, { mat: M.ROOF, color: [0.2, 0.08, 0.04] }, 8, 0.055);
}
function facade(B, F, len, h, color, windows, doors = [], opts = {}) {
  const holes = [];
  for (const w of windows) holes.push({ u0: w.u0, u1: w.u1, v0: w.v0, v1: w.v1 });
  for (const d of doors) holes.push({ u0: d[0], u1: d[1], v0: 0.001, v1: d[2] });
  for (const e of (opts.extraHoles || [])) holes.push(e);
  wallSlab(B, F, len, h, holes, 0.3, { mat: opts.mat ?? M.PLASTER, color });
  for (const w of windows) stdWindow(B, F, w);
  for (const d of doors) door(B, F, d[0], d[1], d[2], d[3] || COL.wood);
  if (opts.eaves !== false) eaves(B, F, len, h);
}

function bottle(B, p, kind, col, s = 1) {
  const P = [
    [[0.001, 0], [0.05, 0], [0.055, 0.02], [0.055, 0.19], [0.045, 0.23], [0.016, 0.27], [0.015, 0.34], [0.02, 0.345], [0.001, 0.35]],
    [[0.001, 0], [0.085, 0], [0.10, 0.05], [0.085, 0.13], [0.028, 0.19], [0.022, 0.27], [0.032, 0.285], [0.001, 0.29]],
    [[0.001, 0], [0.043, 0], [0.046, 0.015], [0.046, 0.25], [0.02, 0.29], [0.017, 0.37], [0.001, 0.38]],
    [[0.001, 0], [0.062, 0], [0.065, 0.16], [0.038, 0.19], [0.036, 0.22], [0.05, 0.235], [0.001, 0.25]],
  ][kind];
  lathe(B, P, mtx(p.x, p.y, p.z, 0, 0, 0, s, s, s), { mat: M.BOTTLE, color: col }, 12);
  rod(B, V3(p.x, p.y + P[P.length - 1][1] * s - 0.004, p.z), V3(p.x, p.y + P[P.length - 1][1] * s + 0.025 * s, p.z), 0.017 * s, { mat: M.MATTE, color: [0.3, 0.2, 0.1] }, 7);
  if (kind !== 1) rod(B, V3(p.x, p.y + 0.06 * s, p.z), V3(p.x, p.y + 0.13 * s, p.z), (P[3][0] + 0.002) * s, { mat: M.MATTE, color: pick([[0.55, 0.48, 0.32], [0.4, 0.1, 0.06], [0.6, 0.58, 0.5]]) }, 12);
}
const BOTTLE_COLS = [[0.10, 0.52, 0.18], [0.75, 0.32, 0.05], [0.12, 0.30, 0.70], [0.65, 0.07, 0.07], [0.62, 0.75, 0.70], [0.30, 0.55, 0.45], [0.70, 0.55, 0.12]];

function tableAndChairs(B, x, z, cloth, chairAngles) {
  const iron = { mat: M.IRON, color: [0.05, 0.075, 0.062] };
  const y0 = 0.035;
  rod(B, V3(x, y0 + 0.07, z), V3(x, 0.74, z), 0.028, iron, 9);
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.4; tube(B, [V3(x, 0.22, z), V3(x + Math.cos(a) * 0.14, 0.10, z + Math.sin(a) * 0.14), V3(x + Math.cos(a) * 0.30, y0 + 0.012, z + Math.sin(a) * 0.30)], 0.016, iron, 10, 6); }
  lathe(B, [[0.001, 0.74], [0.34, 0.74], [0.345, 0.755], [0.34, 0.77], [0.001, 0.77]], mtx(x, 0, z), { mat: cloth ? M.CLOTH : M.STONE, color: cloth ? [0.72, 0.70, 0.62] : [0.42, 0.4, 0.36] }, 40);
  if (cloth) {
    const g = new THREE.CylinderGeometry(0.343, 0.39, 0.30, 72, 5, true); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i); const a = Math.atan2(pz, px); const w = (0.15 - py) / 0.30; const k = 1 + w * 0.13 * Math.sin(a * 11) + w * 0.04 * Math.sin(a * 23 + 1.0); p.setXYZ(i, px * k, py - w * 0.025 * Math.cos(a * 11), pz * k); }
    g.computeVertexNormals(); B.add(g, mtx(x, 0.62, z), { mat: M.CLOTH, color: [0.68, 0.66, 0.58] }); g.dispose();
  }
  // cup, saucer, carafe and two glasses
  lathe(B, [[0.001, 0], [0.065, 0.004], [0.075, 0.014], [0.001, 0.012]], mtx(x + 0.13, 0.772, z + 0.06), { mat: M.STONE, color: [0.7, 0.7, 0.68] }, 18);
  lathe(B, [[0.001, 0.012], [0.025, 0.015], [0.037, 0.07], [0.033, 0.07], [0.022, 0.025], [0.001, 0.022]], mtx(x + 0.13, 0.772, z + 0.06), { mat: M.STONE, color: [0.75, 0.74, 0.70] }, 18);
  bottle(B, V3(x - 0.07, 0.772, z - 0.04), 0, [0.10, 0.40, 0.14], 0.92);
  for (const [dx, dz] of [[0.04, -0.15], [-0.17, 0.09]]) { lathe(B, [[0.001, 0], [0.035, 0.002], [0.006, 0.01], [0.005, 0.07], [0.035, 0.10], [0.04, 0.155], [0.037, 0.155], [0.031, 0.105], [0.001, 0.078]], mtx(x + dx, 0.772, z + dz), { mat: M.BOTTLE, color: [0.7, 0.75, 0.72] }, 14); }
  for (const a of chairAngles) chair(B, x + Math.cos(a) * 0.62, z + Math.sin(a) * 0.62, a + Math.PI);
}
function chair(B, x, z, face) {
  const o = { mat: M.IRON, color: [0.075, 0.05, 0.032] };
  const G = mtx(x, 0.035, z, 0, -face + Math.PI / 2, 0);   // chair faces local +z
  const P = (a, b, c) => V3(a, b, c).applyMatrix4(G);
  lathe(B, [[0.001, 0.44], [0.2, 0.44], [0.205, 0.452], [0.19, 0.468], [0.001, 0.462]], G, { mat: M.WOOD, color: [0.16, 0.075, 0.03] }, 24);
  const ring = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; ring.push(P(Math.cos(a) * 0.17, 0.2, Math.sin(a) * 0.17)); }
  tube(B, ring, 0.008, o, 32, 5, true);
  for (const [sx, sz] of [[1, 1], [-1, 1]]) tube(B, [P(sx * 0.14, 0.45, sz * 0.12), P(sx * 0.16, 0.25, sz * 0.14), P(sx * 0.19, 0.01, sz * 0.18)], 0.015, o, 10, 6);
  for (const sx of [1, -1]) tube(B, [P(sx * 0.19, 0.01, -0.21), P(sx * 0.14, 0.25, -0.16), P(sx * 0.14, 0.46, -0.14), P(sx * 0.16, 0.7, -0.19), P(sx * 0.12, 0.88, -0.21), P(0, 0.93, -0.215)], 0.0155, o, 20, 6);
  tube(B, [P(0.09, 0.46, -0.15), P(0.095, 0.7, -0.2), P(0, 0.82, -0.215), P(-0.095, 0.7, -0.2), P(-0.09, 0.46, -0.15)], 0.011, o, 20, 5);
}

function bicycle(B, center, dir, lean) { // dir: unit vector along the bike, lean toward the wall
  const Fb = new Frame(V3(center.x, 0, center.z), dir);
  const G = Fb.m.clone().multiply(mtx(0, 0.035, 0, -lean, 0, 0));
  const P = (u, v, d = 0) => V3(u, v, d).applyMatrix4(G);
  const iron = { mat: M.IRON, color: [0.018, 0.075, 0.085] }, chrome = { mat: M.BRASS, color: [0.42, 0.42, 0.40] }, rubber = { mat: M.MATTE, color: [0.018, 0.017, 0.016], rough: 0.5 }, leather = { mat: M.MATTE, color: [0.13, 0.055, 0.022], rough: 0.4 };
  const R = 0.335;
  for (const cu of [-0.54, 0.54]) {
    const t = new THREE.TorusGeometry(R, 0.022, 10, 64); B.add(t, G.clone().multiply(mtx(cu, R + 0.01, 0)), rubber); t.dispose();
    const t2 = new THREE.TorusGeometry(R - 0.028, 0.009, 8, 64); B.add(t2, G.clone().multiply(mtx(cu, R + 0.01, 0)), chrome); t2.dispose();
    for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; rod(B, P(cu, R + 0.01, (i % 2 ? 0.025 : -0.025)), P(cu + Math.cos(a + 0.35) * (R - 0.03), R + 0.01 + Math.sin(a + 0.35) * (R - 0.03)), 0.0028, chrome, 4); }
    rod(B, P(cu, R + 0.01, -0.045), P(cu, R + 0.01, 0.045), 0.022, chrome, 8);
    const f = new THREE.TorusGeometry(R + 0.045, 0.014, 6, 40, Math.PI * (cu < 0 ? 0.95 : 0.7)); B.add(f, G.clone().multiply(mtx(cu, R + 0.01, 0, 0, 0, cu < 0 ? 0.25 : 0.55)), iron); f.dispose();
  }
  const rear = P(-0.54, 0.345), front = P(0.54, 0.345), bb = P(-0.08, 0.30), seatT = P(-0.19, 0.80), headT = P(0.36, 0.82), headB = P(0.40, 0.64);
  for (const [a, b] of [[rear, bb], [bb, seatT], [rear, seatT], [bb, headB], [headT, headB]]) rod(B, a, b, 0.017, iron, 8);
  tube(B, [seatT.clone(), P(0.05, 0.66), headB.clone().lerp(headT, 0.35)], 0.016, iron, 16, 8);
  rod(B, headB, front, 0.015, iron, 8); rod(B, headT, P(0.33, 0.98), 0.013, chrome, 8);
  tube(B, [P(0.22, 0.99, -0.27), P(0.31, 0.985, -0.18), P(0.35, 0.98, 0), P(0.31, 0.985, 0.18), P(0.22, 0.99, 0.27)], 0.012, chrome, 24, 8);
  for (const d of [-0.27, 0.27]) rod(B, P(0.22, 0.99, d), P(0.13, 0.97, d), 0.019, leather, 8);
  rod(B, seatT, P(-0.21, 0.89), 0.012, chrome); sphere(B, P(-0.22, 0.91), 0.07, leather, 1.8, 0.45, 0.8);
  const cr = new THREE.TorusGeometry(0.085, 0.008, 6, 28); B.add(cr, G.clone().multiply(mtx(-0.08, 0.30, 0.05)), chrome); cr.dispose();
  rod(B, P(-0.08, 0.30, 0.06), P(0.04, 0.22, 0.07), 0.01, chrome); wbox(B, ...P(0.04, 0.22, 0.11).toArray(), 0.09, 0.025, 0.06, rubber);
  rod(B, P(-0.54, 0.43), P(-0.08, 0.30), 0.004, rubber, 4);
  // wicker basket with a baguette
  for (let i = 0; i < 6; i++) { const v = 0.74 + i * 0.034, s = 0.82 + i * 0.036; const pts = [[-1, -1], [0, -1.1], [1, -1], [1.1, 0], [1, 1], [0, 1.1], [-1, 1], [-1.1, 0]].map(([a, b]) => P(0.55 + a * 0.13 * s, v, b * 0.14 * s)); tube(B, pts, 0.011, { mat: M.WOOD, color: [0.28, 0.16, 0.06] }, 32, 5, true); }
  for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; rod(B, P(0.55 + Math.cos(a) * 0.10, 0.73, Math.sin(a) * 0.11), P(0.55 + Math.cos(a) * 0.135, 0.91, Math.sin(a) * 0.145), 0.006, { mat: M.WOOD, color: [0.22, 0.12, 0.05] }, 4); }
  rod(B, P(0.50, 0.80, -0.03), P(0.66, 1.14, 0.06), 0.034, { mat: M.MATTE, color: [0.42, 0.24, 0.08] }, 8, 0.022);
  leafCluster(B, P(0.55, 0.93, 0), 0.09, 0.05, 0.09, 45, 0.055, V3(0, 1, 0), [0.07, 0.14, 0.04]);
}

// ── ground ──
const PUDDLES = [ // x, z, rx, rz, rotation
  [-0.55, -6.9, 1.05, 0.85, 0.2], [0.95, -9.1, 0.75, 1.15, -0.3], [-1.25, -10.9, 0.65, 0.9, 0.4], [1.35, -5.6, 0.55, 0.6, 0.0],
  [0.05, -13.3, 0.9, 1.35, 0.1], [-0.9, -16.2, 0.85, 1.1, -0.2], [0.85, -17.3, 0.95, 0.75, 0.3], [-2.4, -6.7, 0.6, 0.55, 0.0], [0.6, -3.2, 1.1, 0.8, 0.0], [-0.2, -11.7, 0.45, 0.5, 0],
];
function vn2(x, z) {
  const h = (i, j) => { let n = Math.imul(i, 374761393) + Math.imul(j, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h(i, j), h(i + 1, j), sx), lerp(h(i, j + 1), h(i + 1, j + 1), sx), sz);
}
function groundBase(x, z) {
  let base = 0.004 + (vn2(x * 0.9, z * 0.9) - 0.5) * 0.010;
  const wob = (vn2(x * 3.1 + 7, z * 3.1) - 0.5) * 0.55 + (vn2(x * 8.0, z * 8.0 + 3) - 0.5) * 0.22;
  let dip = 0, bank = 0;
  for (const [px, pz, rx, rz, a] of PUDDLES) {
    const dx = x - px, dz = z - pz, c = Math.cos(a), s = Math.sin(a);
    const r = Math.hypot((dx * c + dz * s) / rx, (-dx * s + dz * c) / rz) + wob;
    dip = Math.max(dip, 1 - sstep(0.34, 0.98, r));
    bank = Math.max(bank, 1 - sstep(0.72, 1.52, r));      // a broad shallow bank: water creeps into the joints first
  }
  base -= dip * 0.027 + bank * 0.0145;
  // a shallow gutter runs down the middle of the lane
  const gx = 0.15 + Math.sin(z * 0.21) * 0.15;
  base -= 0.010 * Math.exp(-((x - gx) ** 2) / 0.03);
  return base;
}
function settGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1, 8, 3, 8); const p = g.attributes.position;
  const v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ax = Math.abs(v.x) * 2, az = Math.abs(v.z) * 2;
    // pillow-topped sett with rounded corners
    const edge = Math.pow(Math.pow(ax, 6) + Math.pow(az, 6), 1 / 6);
    if (edge > 1) { v.x /= edge; v.z /= edge; }
    if (v.y > 0) { const e = Math.min(1, edge); v.y = 0.5 - 0.46 * Math.pow(e, 5) - 0.07 * e * e; if (p.getY(i) < 0.49) v.y = Math.min(v.y, p.getY(i)); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const merged = mergeVertices(g); merged.computeVertexNormals(); return merged;
}
function buildCobbles(mat) {
  const geo = settGeometry();
  const items = [];
  let z = 3.0;
  while (z > -25.0) {
    const depth = rand(0.115, 0.15);
    let x = -4.75 + rand(0, 0.15);
    while (x < 5.0) {
      const w = rand(0.13, 0.215);
      const cx = x + w / 2, cz = z - depth / 2 + Math.sin(cx * 1.15) * 0.07;
      items.push([cx + rand(-0.006, 0.006), cz + rand(-0.007, 0.007), w - 0.016, depth - 0.016]);
      x += w;
    }
    z -= depth;
  }
  const n = items.length;
  const col = new Float32Array(n * 3), am = new Float32Array(geo.attributes.position.count * 4), ac = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < geo.attributes.position.count; i++) { am.set([M.COBBLE, 0.25, 0, 0], i * 4); ac.set([1, 1, 1], i * 3); }
  geo.setAttribute('aMat', new THREE.BufferAttribute(am, 4)); geo.setAttribute('aColor', new THREE.BufferAttribute(ac, 3));
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const cols = [[0.20, 0.19, 0.175], [0.16, 0.165, 0.175], [0.23, 0.195, 0.16], [0.125, 0.125, 0.13], [0.19, 0.15, 0.13], [0.24, 0.23, 0.21]];
  const c = new THREE.Color();
  items.forEach(([x, zz, w, d], i) => {
    const base = groundBase(x, zz);
    const top = base + 0.016 + rand(-0.004, 0.006);
    const hgt = 0.06;
    mesh.setMatrixAt(i, mtx(x, top - hgt / 2, zz, rand(-0.045, 0.045), rand(-0.05, 0.05), rand(-0.045, 0.045), w, hgt, d));
    const k = rand(0.78, 1.22); const cc = pick(cols);
    mesh.setColorAt(i, c.setRGB(cc[0] * k, cc[1] * k, cc[2] * k, THREE.LinearSRGBColorSpace));
  });
  mesh.frustumCulled = false;
  return mesh;
}
function gridPlane(x0, x1, z0, z1, step, yfn, mat, color, cfn = null) {
  const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, yfn(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const b = new Builder(); b.add(g, null, { mat, color, rough: 0.4 }); const out = b.geometry();
  if (cfn) { const q = out.attributes.position, c = out.attributes.aColor; for (let i = 0; i < q.count; i++) c.setXYZ(i, cfn(q.getX(i), q.getZ(i)), 0, 0); }
  return out;
}

// ── the whole static set ──
function buildStreet() {
  const B = new Builder();
  const Y = V3(0, 1, 0);

  // ── hero facade ──
  {
    const F = HERO, ub = F.ub;
    const heroWin = { u0: ub - 0.82, u1: ub + 0.50, v0: 5.78, v1: 7.62 };
    const wins = [
      { u0: 0.28, u1: 1.06, v0: 3.2, v1: 4.62, sh: 'closed', sc: COL.shTeal },
      { u0: 3.42, u1: 4.2, v0: 3.2, v1: 4.62, sh: 'half', sc: COL.shTeal, box: [0.62, 0.035, 0.02] },
      { u0: 3.66, u1: 4.34, v0: 5.95, v1: 7.45, sh: 'closed', sc: COL.shTeal },
      { u0: 0.2, u1: 0.74, v0: 0.95, v1: 2.2, sh: 'closed', sc: COL.wood },
      { u0: 0.9, u1: 1.6, v0: 8.25, v1: 9.15, sh: null }, { u0: 2.9, u1: 3.6, v0: 8.25, v1: 9.15, sh: 'closed' },
    ];
    facade(B, F, F.len, 9.65, COL.heroPl, wins, [[3.36, 4.34, 2.42, [0.045, 0.095, 0.085]]], { extraHoles: [heroWin] });
    plinth(B, F, [[0, 3.2], [4.5, F.len]], 0.52);
    quoins(B, F, F.len, 9.5, -1);
    downpipe(B, F, 0.1, 9.65);
    box(B, F, 0, F.len, 2.78, 2.9, -0.01, 0.07, { mat: M.STONE, color: COL.stone });
    // the open lamp window
    surround(B, F, heroWin.u0, heroWin.u1, heroWin.v0, heroWin.v1);
    shutterLeaf(B, F, heroWin.u0 - 0.74, heroWin.u0 - 0.20, heroWin.v0, heroWin.v1, 0.07, COL.shTeal, 0.04, true);
    shutterLeaf(B, F, heroWin.u1 + 0.11, heroWin.u1 + 0.75, heroWin.v0, heroWin.v1, 0.07, COL.shTeal, 0, false);
    ironRailing(B, F, heroWin.u0 - 0.02, heroWin.u1 + 0.02, heroWin.v0, heroWin.v0 + 0.52, 0.085, 0.13, true);
    // casements folded into the room
    for (const [hu, dirn] of [[heroWin.u0, 1], [heroWin.u1, -1]]) {
      const G = F.m.clone().multiply(mtx(hu, 0, -0.24, 0, dirn * 1.42, 0));
      const part = (a, b2, c0, c1) => B.add(boxGeo(b2 - a, c1 - c0, 0.035), G.clone().multiply(mtx(dirn * (a + b2) / 2, (c0 + c1) / 2, 0)), { mat: M.WOOD, color: [0.14, 0.12, 0.09], interior: true });
      part(0, 0.05, 5.8, 7.58); part(0.56, 0.61, 5.8, 7.58); for (const v of [5.8, 6.42, 7.02, 7.53]) part(0.05, 0.56, v, v + 0.045);
    }
    // the room
    const wallC = [0.17, 0.105, 0.058];
    const ru0 = ub - 1.5, ru1 = ub + 1.25, rv0 = 5.12, rv1 = 8.05, back = -2.1;
    const io = { mat: M.INNER, color: wallC, interior: true };
    box(B, F, ru0, ru1, rv0, rv1, back - 0.08, back, io);
    box(B, F, ru0 - 0.08, ru0, rv0, rv1, back, -0.3, io); box(B, F, ru1, ru1 + 0.08, rv0, rv1, back, -0.3, io);
    box(B, F, ru0, ru1, rv0 - 0.08, rv0, back, -0.3, { mat: M.BOARD, color: [0.2, 0.11, 0.05], interior: true });
    box(B, F, ru0, ru1, rv1, rv1 + 0.08, back, -0.3, { mat: M.INNER, color: [0.17, 0.14, 0.10], interior: true });
    // furnishings: picture, shelf with books, coat on a peg, wardrobe edge
    box(B, F, ub - 1.0, ub - 0.38, 6.55, 7.28, back, back + 0.04, { mat: M.BRASS, color: [0.34, 0.22, 0.07], interior: true });
    box(B, F, ub - 0.95, ub - 0.43, 6.60, 7.23, back + 0.04, back + 0.05, { mat: M.INNER, color: [0.07, 0.11, 0.13], interior: true });
    box(B, F, ub - 0.05, ub + 0.9, 6.72, 6.76, back, back + 0.22, { mat: M.WOOD, color: COL.wood, interior: true });
    for (let u = ub; u < ub + 0.82;) { const w = rand(0.03, 0.07), hh = rand(0.17, 0.28); box(B, F, u, u + w - 0.006, 6.76, 6.76 + hh, back + 0.03, back + 0.17, { mat: M.MATTE, color: pick([[0.35, 0.06, 0.04], [0.05, 0.13, 0.2], [0.42, 0.3, 0.1], [0.07, 0.15, 0.07]]), interior: true }); u += w; }
    box(B, F, ru1 - 0.5, ru1, rv0, 7.35, back, back + 0.5, { mat: M.WOOD, color: [0.09, 0.043, 0.02], interior: true });
    sphere(B, F.p(ub - 0.15, 7.28, back + 0.07), 0.11, { mat: M.BRASS, color: [0.5, 0.4, 0.2], interior: true }, 1, 1, 0.3);
    // switch plate on the surround, left of the opening
    box(B, F, ub - 0.905, ub - 0.835, 6.47, 6.58, 0.04, 0.062, { mat: M.STONE, color: [0.55, 0.50, 0.38] });
    // bracket and flex for the bare bulb
    const bl = LAMPS[0].pos;
    const top = F.p(ub, 7.66, 0.04);
    tube(B, [top, F.p(ub, 7.60, 0.11), F.p(ub, 7.50, 0.14)], 0.008, { mat: M.IRON, color: COL.iron }, 10, 6);
    rod(B, F.p(ub, 7.50, 0.14), V3(bl.x, bl.y + 0.1, bl.z), 0.0045, { mat: M.MATTE, color: [0.02, 0.015, 0.012] }, 5);
    // wet laundry peg-pulley on the wall
    ivy(B, F, 0.35, 0.15, 3, 0.25, 1);
    flowerBox(B, F, 0.22, 1.12, 3.08, [0.60, 0.08, 0.12]);
    proxy(F, 0, F.len, 0, 5.7, 0.0, [0.42, 0.30, 0.18]);
    // room proxies
    proxy(F, ru0, ru1, rv0, rv1, back + 0.01, wallC);
    PROXIES.push({ o: F.p(ru0, rv0 + 0.01, back), a: F.U.clone().multiplyScalar(ru1 - ru0), b: F.N.clone().multiplyScalar(-back - 0.3), n: Y.clone(), albedo: [0.2, 0.12, 0.06] });
  }

  // ── near left ──
  {
    const F = W_NEARL;
    const wins = []; for (const v of [1.0, 3.35, 6.0]) for (let u = 1.0; u < F.len - 1.4; u += 2.15) wins.push({ u0: u, u1: u + 0.85, v0: v, v1: v + 1.45, sh: pick(['closed', 'open', 'closed']), sc: COL.shRed });
    facade(B, F, F.len, 10.4, COL.rose, wins);
    plinth(B, F, [[0, F.len]]); downpipe(B, F, F.len - 0.16, 10.4); quoins(B, F, F.len, 10.2, -1);
    ivy(B, F, F.len - 0.8, 0.1, 5, 0.4, 1);
  }

  // ── far left ──
  {
    const F = W_FARL;
    const wins = [
      { u0: 0.55, u1: 1.4, v0: 0.95, v1: 2.35, sh: 'closed', sc: COL.shRed }, { u0: 5.7, u1: 6.55, v0: 0.95, v1: 2.35, sh: null, box: [0.7, 0.45, 0.05] },
      { u0: 0.7, u1: 1.55, v0: 3.45, v1: 4.9, sh: 'open', sc: COL.shRed }, { u0: 3.45, u1: 4.3, v0: 4.1, v1: 5.45, sh: 'closed', sc: COL.shRed }, { u0: 6.3, u1: 7.15, v0: 3.45, v1: 4.9, sh: 'open', sc: COL.shRed, box: [0.65, 0.05, 0.03] },
      { u0: 1.5, u1: 2.3, v0: 6.15, v1: 7.45, sh: 'closed', sc: COL.shRed }, { u0: 4.6, u1: 5.4, v0: 6.15, v1: 7.45, sh: 'half', sc: COL.shRed }, { u0: 7.4, u1: 8.2, v0: 6.15, v1: 7.45, sh: null },
    ];
    facade(B, F, F.len, 8.45, COL.ochre, wins, [[2.55, 3.5, 2.5]]);
    plinth(B, F, [[0, 2.4], [3.65, F.len]]); downpipe(B, F, 5.15, 8.45);
    ivy(B, F, 7.9, 0.1, 9, 0.7, 1);
    proxy(F, 0, F.len, 0, 8.0, 0, COL.ochre);
    // small step-back between the hero facade and this wall
  }

  // ── near right (mostly beyond the frame; its balcony and pipe catch the light) ──
  {
    const F = W_NEARR;
    const wins = [
      { u0: 0.5, u1: 1.35, v0: 0.95, v1: 2.4, sh: 'closed', sc: COL.shGreen }, { u0: 2.6, u1: 3.45, v0: 0.95, v1: 2.4, sh: 'open', sc: COL.shGreen },
      { u0: 0.55, u1: 1.4, v0: 3.55, v1: 5.2, sh: 'open', sc: COL.shGreen }, { u0: 3.0, u1: 3.85, v0: 3.55, v1: 5.2, sh: 'closed', sc: COL.shGreen },
      { u0: 0.55, u1: 1.4, v0: 6.15, v1: 7.6, sh: 'closed', sc: COL.shGreen }, { u0: 3.0, u1: 3.85, v0: 6.15, v1: 7.6, sh: 'open', sc: COL.shGreen, box: [0.65, 0.06, 0.03] },
    ];
    facade(B, F, F.len, 9.1, COL.cream, wins, [[5.2, 6.2, 2.45]]);
    plinth(B, F, [[0, 5.05], [6.35, F.len]]); downpipe(B, F, 0.16, 9.1); balcony(B, F, 0.35, 1.6, 3.4);
    ivy(B, F, 0.9, 0.1, 6, 0.55, 1);
    proxy(F, 0, 6, 0, 9, 0, COL.cream);
  }

  // ── café building ──
  {
    const F = CAFE, w = CAFE_WIN;
    const wins = [];
    for (const [v0, v1, sh] of [[3.95, 5.45, 'open'], [6.25, 7.65, 'closed']]) for (const u of [1.05, 2.5, 3.72]) wins.push({ u0: u - 0.4 + (sh === 'open' ? 0 : 0.05), u1: u + 0.34 + (sh === 'open' ? 0 : 0.05), v0, v1, sh: (u === 2.5 && v0 < 5) ? 'half' : sh, sc: COL.shBlue, box: (v0 < 5 && u > 3) ? [0.68, 0.08, 0.03] : null });
    facade(B, F, F.len, 8.85, COL.sage, wins, [], { extraHoles: [{ u0: w.u0, u1: w.u1, v0: w.v0, v1: w.v1 }, { u0: 0.12, u1: 0.82, v0: 0.001, v1: 2.5 }] });
    quoins(B, F, 0.0, 8.6, 1); quoins(B, F, F.len, 8.6, -1);
    // timber shopfront
    const green = { mat: M.WOOD, color: [0.075, 0.04, 0.022] };
    box(B, F, 0.02, F.len - 0.1, 3.25, 3.45, -0.02, 0.09, green); box(B, F, 0.02, F.len - 0.1, 3.45, 3.50, -0.02, 0.15, green);
    box(B, F, w.u0 - 0.1, w.u0, 0, 3.27, -0.04, 0.07, green); box(B, F, w.u1, w.u1 + 0.1, 0, 3.27, -0.04, 0.07, green); box(B, F, 0.02, 0.12, 0, 3.27, -0.04, 0.07, green);
    box(B, F, w.u0, w.u1, 0, w.v0, -0.02, 0.05, green); box(B, F, w.u0 - 0.04, w.u1 + 0.04, w.v0 - 0.05, w.v0, -0.12, 0.11, { mat: M.STONE, color: COL.stone });
    for (let u = w.u0 + 0.08; u < w.u1 - 0.3; u += 0.54) box(B, F, u, u + 0.42, 0.1, 0.42, 0.05, 0.065, green);
    for (const u of [w.u0 + 0.03, 1.68, 3.12, w.u1 - 0.03]) box(B, F, u - 0.022, u + 0.022, w.v0, w.v1, -0.11, -0.06, green);
    for (const [a, b2] of [[w.u0, 1.68], [3.12, w.u1]]) box(B, F, a, b2, 2.76, 2.795, -0.11, -0.06, green); // transom over the side lights only
    // door, ajar and half glazed
    const dg = F.m.clone().multiply(mtx(0.12, 0, -0.14, 0, 0.5, 0));
    const dp = (a, b2, c0, c1, o) => B.add(boxGeo(b2 - a, c1 - c0, 0.05), dg.clone().multiply(mtx((a + b2) / 2, (c0 + c1) / 2, 0)), o);
    dp(0, 0.7, 0.02, 0.95, green); dp(0, 0.09, 0.95, 2.45, green); dp(0.61, 0.7, 0.95, 2.45, green); dp(0.09, 0.61, 2.3, 2.45, green); dp(0.09, 0.61, 1.62, 1.68, green);
    // interior
    const io = (color) => ({ mat: M.INNER, color, interior: true });
    const u0 = 0.1, u1 = 4.45, dBack = -2.62;
    box(B, F, u0, u1, 0, 3.42, dBack - 0.08, dBack, io([0.52, 0.22, 0.12]));
    box(B, F, u0 - 0.08, u0, 0, 3.42, dBack, -0.3, io([0.66, 0.50, 0.27])); box(B, F, u1, u1 + 0.08, 0, 3.42, dBack, -0.3, io([0.66, 0.50, 0.27]));
    box(B, F, u0, u1, 3.42, 3.50, dBack, -0.3, io([0.4, 0.34, 0.24]));
    box(B, F, u0, u1, -0.03, 0.045, dBack, -0.02, { mat: M.BOARD, color: [0.2, 0.1, 0.045], interior: true });
    box(B, F, u0, u1, 0.05, 1.0, dBack, dBack + 0.03, { mat: M.WOOD, color: [0.12, 0.055, 0.025], interior: true });
    // the big mirror behind the bar, gilt frame, tilted a few degrees forward
    {
      const mm = new THREE.Matrix4().makeBasis(MIRROR.right, MIRROR.up, MIRROR.n).setPosition(MIRROR.c);
      const quad = new THREE.PlaneGeometry(MIRROR.hw * 2, MIRROR.hh * 2); B.add(quad, mm, { mat: M.MIRROR, color: [0.9, 0.9, 0.87], interior: true });
      const gold = { mat: M.WOOD, color: [0.17, 0.098, 0.030], interior: true };
      const part = (cx, cy, wx, hy, dz = 0.02) => B.add(boxGeo(wx, hy, 0.05), mm.clone().multiply(mtx(cx, cy, dz)), gold);
      part(0, MIRROR.hh + 0.04, MIRROR.hw * 2 + 0.16, 0.08); part(0, -MIRROR.hh - 0.04, MIRROR.hw * 2 + 0.16, 0.08); part(-MIRROR.hw - 0.04, 0, 0.08, MIRROR.hh * 2); part(MIRROR.hw + 0.04, 0, 0.08, MIRROR.hh * 2);
      for (let i = 0; i <= 24; i++) for (const sy of [-1, 1]) sphere(B, V3(lerp(-MIRROR.hw, MIRROR.hw, i / 24), sy * (MIRROR.hh + 0.04), 0.045).applyMatrix4(mm), 0.017, { mat: M.BRASS, color: [0.24, 0.15, 0.05], interior: true }, 1, 1, 0.7, 7);
      // two chains from the ceiling hold it at its lean
      for (const sx of [-0.86, 0.86]) { const p = V3(sx * MIRROR.hw, MIRROR.hh + 0.07, 0.0).applyMatrix4(mm); rod(B, p, V3(p.x + CAFE.N.x * 0.12, 3.42, p.z + CAFE.N.z * 0.12), 0.007, { mat: M.BRASS, color: [0.3, 0.2, 0.07], interior: true }, 5); }
    }
    // bar counter
    box(B, F, 1.35, 3.55, 0.04, 0.80, -1.10, -0.80, { mat: M.WOOD, color: [0.16, 0.065, 0.028], interior: true });
    for (let u = 1.42; u < 3.4; u += 0.42) box(B, F, u, u + 0.34, 0.14, 0.70, -0.80, -0.785, { mat: M.WOOD, color: [0.20, 0.085, 0.035], interior: true });
    box(B, F, 1.3, 3.6, 0.80, 0.855, -1.14, -0.74, { mat: M.BRASS, color: [0.5, 0.34, 0.14], interior: true });
    rod(B, F.p(1.35, 0.2, -0.71), F.p(3.55, 0.2, -0.71), 0.022, { mat: M.BRASS, color: [0.6, 0.42, 0.15], interior: true });
    for (let u = 1.45; u < 3.5; u += rand(0.14, 0.32)) bottle(B, F.p(u, 0.855, rand(-1.07, -0.9)), RNG() * 3 | 0, pick(BOTTLE_COLS), rand(0.72, 0.9));
    // side shelves with bottles
    for (const [a, b2] of [[0.16, 0.98], [3.72, 4.42]]) for (const v of [1.25, 1.75, 2.25]) { box(B, F, a, b2, v - 0.03, v, dBack + 0.03, dBack + 0.24, { mat: M.WOOD, color: COL.wood, interior: true }); for (let u = a + 0.08; u < b2 - 0.06; u += 0.14) bottle(B, F.p(u, v, dBack + 0.14), RNG() * 4 | 0, pick(BOTTLE_COLS), rand(0.8, 1.0)); }
    // stools, an inside table and a dark pendant lamp (switched off)
    for (const u of [1.7, 2.45, 3.2]) { const p = F.p(u, 0, -0.55); rod(B, V3(p.x, 0.05, p.z), V3(p.x, 0.62, p.z), 0.025, { mat: M.BRASS, color: [0.5, 0.36, 0.14], interior: true }); sphere(B, V3(p.x, 0.65, p.z), 0.14, { mat: M.MATTE, color: [0.22, 0.035, 0.025], interior: true }, 1, 0.33, 1); }
    { const p = F.p(3.75, 2.55, -0.7); rod(B, F.p(3.75, 3.42, -0.7), p, 0.006, { mat: M.IRON, color: COL.iron, interior: true }); lathe(B, [[0.02, 0.12], [0.07, 0.1], [0.19, 0], [0.18, 0], [0.06, 0.08], [0.01, 0.1]], mtx(p.x, p.y - 0.1, p.z), { mat: M.BRASS, color: [0.28, 0.2, 0.08], interior: true }, 24); }
    ivy(B, F, 4.45, 3.2, 4, 0.2, 1);
    proxy(F, 0, w.u0, 0, 8.5, 0, COL.sage); proxy(F, w.u0, F.len, 2.9, 8.5, 0, COL.sage);
    proxy(F, w.u0, w.u1, 0.3, 3.1, -1.6, [0.2, 0.09, 0.04]);
  }
  // outdoor tables
  {
    const t1 = CAFE.p(1.55, 0, 0.82), t2 = CAFE.p(3.42, 0, 0.92);
    const au = Math.atan2(CAFE.U.z, CAFE.U.x);
    tableAndChairs(B, t1.x, t1.z, true, [au + Math.PI * 0.98, au - 0.15]);
    tableAndChairs(B, t2.x, t2.z, true, [au + Math.PI * 1.05, au + 0.1]);
  }

  // ── far right ──
  {
    const F = W_FARR;
    const wins = [
      { u0: 0.6, u1: 1.45, v0: 0.95, v1: 2.4, sh: 'closed', sc: COL.shGreen }, { u0: 4.75, u1: 5.6, v0: 0.95, v1: 2.4, sh: 'half', sc: COL.shGreen, box: [0.7, 0.5, 0.08] },
      { u0: 1.0, u1: 1.85, v0: 3.5, v1: 5.25, sh: 'open', sc: COL.shGreen }, { u0: 4.1, u1: 4.95, v0: 3.5, v1: 5.25, sh: 'half', sc: COL.shGreen },
      { u0: 1.0, u1: 1.85, v0: 6.15, v1: 7.75, sh: 'closed', sc: COL.shGreen }, { u0: 4.1, u1: 4.95, v0: 6.15, v1: 7.75, sh: 'open', sc: COL.shGreen },
      { u0: 2.6, u1: 3.25, v0: 8.35, v1: 9.2, sh: null },
    ];
    facade(B, F, F.len, 9.8, COL.cream, wins, [[2.55, 3.5, 2.5, [0.09, 0.04, 0.025]]]);
    plinth(B, F, [[0, 2.4], [3.65, F.len]]); downpipe(B, F, 5.98, 9.8);
    balcony(B, F, 0.62, 2.25, 3.38); balcony(B, F, 3.72, 5.35, 3.38); balcony(B, F, 0.62, 2.25, 6.03, 0.5);
    flowerBox(B, F, 3.95, 5.1, 6.05, [0.62, 0.03, 0.02]);
    ivy(B, F, 0.25, 0.1, 6, 0.4, 1);
    proxy(F, 0, F.len, 0, 9.4, 0, COL.cream);
  }

  // ── end of the lane ──
  {
    const F = ENDW, w = SHOP;
    const arch = { u0: 0.18, u1: 1.52, v0: 0.001, v1: 2.98, arch: true };
    const wins = [
      { u0: 0.12, u1: 0.9, v0: 4.45, v1: 5.75, sh: null },
      { u0: 1.72, u1: 2.47, v0: 3.9, v1: 5.3, sh: 'open', sc: COL.shBlue, box: [0.66, 0.05, 0.03] },
      { u0: 3.1, u1: 3.78, v0: 3.9, v1: 5.3, sh: 'closed', sc: COL.shBlue },
    ];
    facade(B, F, F.len, 6.5, COL.terracotta, wins, [], { extraHoles: [arch, { u0: w.u0, u1: w.u1, v0: w.v0, v1: w.v1 }] });
    plinth(B, F, [[1.62, F.len]], 0.42); plinth(B, F, [[0, 0.16]], 0.42);
    // voussoirs round the arch and its jambs
    const r = (arch.u1 - arch.u0) / 2, cu = arch.u0 + r, spring = arch.v1 - r;
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI; B.add(boxGeo(0.24, 0.21, 0.11), F.at(cu - Math.cos(a) * (r + 0.09), spring + Math.sin(a) * (r + 0.09), 0.015, 0, 0, Math.PI - a), { mat: M.STONE, color: COL.stone.map(c => c * rand(0.8, 1.12)) }); }
    for (let v = 0, i = 0; v < spring - 0.1; v += 0.3, i++) for (const s of [-1, 1]) box(B, F, cu + s * r + (s < 0 ? -(i % 2 ? 0.17 : 0.26) : 0), cu + s * r + (s > 0 ? (i % 2 ? 0.17 : 0.26) : 0), v, v + 0.28, -0.02, 0.05, { mat: M.STONE, color: COL.stone.map(c => c * rand(0.8, 1.1)) });
    // the passage beyond
    const brick = { mat: M.BRICK, color: [0.30, 0.13, 0.07] };
    wbox(B, ENDW.o.x + arch.u0 - 0.15, 1.7, -20.8, 0.3, 3.4, 3.0, brick); wbox(B, ENDW.o.x + arch.u1 + 0.15, 1.7, -20.8, 0.3, 3.4, 3.0, brick);
    wbox(B, ENDW.o.x + cu, 3.2, -20.7, 1.7, 0.25, 2.8, brick);
    wbox(B, ENDW.o.x + cu + 0.2, 2.6, -23.0, 3.4, 5.2, 0.3, { mat: M.PLASTER, color: COL.grey });
    { const FP = new Frame(V3(ENDW.o.x + cu - 0.3, 0, -22.83), V3(1, 0, 0)); windowFill(B, FP, 0.1, 0.75, 1.1, 2.2, 0.03); surround(B, FP, 0.1, 0.75, 1.1, 2.2); leafCluster(B, FP.p(1.0, 0.35, 0.3), 0.3, 0.35, 0.25, 160, 0.09, V3(0, 0, 1), [0.045, 0.11, 0.03]); }
    // the shop window full of bottles
    const wood = { mat: M.WOOD, color: [0.032, 0.085, 0.070] };
    box(B, F, w.u0 - 0.14, w.u0, 0, w.v1 + 0.05, -0.02, 0.09, wood); box(B, F, w.u1, w.u1 + 0.14, 0, w.v1 + 0.05, -0.02, 0.09, wood);
    box(B, F, w.u0 - 0.16, w.u1 + 0.16, w.v1, w.v1 + 0.30, -0.02, 0.12, wood); box(B, F, w.u0 - 0.2, w.u1 + 0.2, w.v1 + 0.30, w.v1 + 0.37, -0.02, 0.2, wood);
    box(B, F, w.u0, w.u1, 0, w.v0, -0.02, 0.07, wood); box(B, F, w.u0 - 0.05, w.u1 + 0.05, w.v0 - 0.05, w.v0, -0.05, 0.14, { mat: M.STONE, color: COL.stone });
    for (const u of [w.u0 + 0.02, (w.u0 + w.u1) / 2, w.u1 - 0.02]) box(B, F, u - 0.02, u + 0.02, w.v0, w.v1, -0.05, -0.01, wood);
    const back = -0.55;
    box(B, F, w.u0 - 0.05, w.u1 + 0.05, w.v0 - 0.1, w.v1 + 0.1, back - 0.06, back, { mat: M.WOOD, color: [0.17, 0.095, 0.045], interior: true });
    box(B, F, w.u0 - 0.05, w.u0, w.v0, w.v1, back, -0.3, { mat: M.WOOD, color: COL.wood, interior: true }); box(B, F, w.u1, w.u1 + 0.05, w.v0, w.v1, back, -0.3, { mat: M.WOOD, color: COL.wood, interior: true });
    box(B, F, w.u0, w.u1, w.v0 - 0.06, w.v0, back, -0.04, { mat: M.WOOD, color: [0.2, 0.11, 0.05], interior: true });
    for (let k = 0; k < 4; k++) {
      const v = w.v0 + 0.005 + k * 0.54;
      if (k) box(B, F, w.u0, w.u1, v - 0.035, v - 0.005, back, -0.12, { mat: M.WOOD, color: [0.18, 0.1, 0.045], interior: true });
      for (let u = w.u0 + 0.1; u < w.u1 - 0.07; u += rand(0.115, 0.17)) bottle(B, F.p(u, v, rand(-0.27, -0.14)), RNG() * 4 | 0, pick(BOTTLE_COLS), rand(0.95, 1.28));
      for (let u = w.u0 + 0.16; u < w.u1 - 0.1; u += rand(0.17, 0.26)) bottle(B, F.p(u, v, rand(-0.47, -0.38)), RNG() * 4 | 0, pick(BOTTLE_COLS), rand(1.0, 1.25));
    }
    ivy(B, F, 4.17, 0.1, 4, 0.12, 1); downpipe(B, F, 1.65, 6.5);
    proxy(F, 0, F.len, 0, 6.2, 0, COL.terracotta);
  }

  // ── low garden wall in the right foreground (the cat's seat) ──
  {
    const F = Frame.wall(3.12, -7.65, 3.30, -5.15);
    box(B, F, 0, F.len, 0, 0.86, -0.32, 0, { mat: M.BRICK, color: [0.33, 0.14, 0.075] });
    for (let u = 0; u < F.len - 0.05; u += 0.52) box(B, F, u + 0.004, Math.min(F.len, u + 0.51), 0.86, 0.96, -0.37, 0.05, { mat: M.STONE, color: COL.stone.map(c => c * rand(0.85, 1.1)) });
    ivy(B, F, 2.2, 0.03, 4, 0.25, 0.2);
    // terracotta pots with plants at its foot
    for (const [u, d, s] of [[0.25, 0.28, 1.0], [0.68, 0.22, 0.72], [2.3, 0.25, 0.8]]) {
      const p = F.p(u, 0.03, d);
      lathe(B, [[0.001, 0], [0.11, 0], [0.15, 0.25], [0.175, 0.255], [0.175, 0.29], [0.14, 0.29], [0.13, 0.25], [0.001, 0.25]], mtx(p.x, p.y, p.z, 0, 0, 0, s, s, s), { mat: M.ROOF, color: [0.36, 0.14, 0.065] }, 22);
      leafCluster(B, V3(p.x, p.y + 0.43 * s, p.z), 0.19 * s, 0.17 * s, 0.19 * s, 130, 0.085 * s, V3(0, 1, 0), [0.055, 0.135, 0.032]);
      if (s < 1) for (let k = 0; k < 30; k++) leaf(B, V3(p.x + rand(-0.13, 0.13), p.y + rand(0.42, 0.57) * s, p.z + rand(-0.13, 0.13)), 0.035, V3(0, 1, 0), [0.6, 0.07, 0.1], M.PETAL);
    }
  }

  // ── bicycle against the lamp facade ──
  bicycle(B, HERO.p(3.0, 0, 0.30), HERO.U, 0.13);
  // a barrel and a crate by the hero door, and bins down the lane
  {
    const p = HERO.p(0.85, 0.03, 0.36);
    lathe(B, [[0.001, 0], [0.23, 0], [0.28, 0.18], [0.29, 0.34], [0.27, 0.52], [0.23, 0.68], [0.001, 0.66]], mtx(p.x, p.y, p.z), { mat: M.BOARD, color: [0.18, 0.09, 0.035] }, 28);
    for (const [y, r] of [[0.08, 0.26], [0.24, 0.287], [0.48, 0.283], [0.62, 0.248]]) { const t = new THREE.TorusGeometry(r, 0.011, 6, 40); B.add(t, mtx(p.x, p.y + y, p.z, Math.PI / 2), { mat: M.IRON, color: COL.iron }); t.dispose(); }
    leafCluster(B, V3(p.x, 0.82, p.z), 0.17, 0.12, 0.17, 100, 0.075, V3(0, 1, 0), [0.06, 0.13, 0.03]);
    for (let k = 0; k < 24; k++) leaf(B, V3(p.x + rand(-0.15, 0.15), rand(0.85, 0.99), p.z + rand(-0.15, 0.15)), 0.036, V3(0, 1, 0), [0.75, 0.55, 0.06], M.PETAL);
  }

  // ── church tower beyond the end of the lane ──
  {
    const cx = 1.25, cz = -34.5;
    const st = { mat: M.STONE, color: [0.34, 0.31, 0.26] };
    wbox(B, cx, 8.5, cz, 3.5, 17.0, 3.5, st);
    for (const y of [10.4, 13.9, 17.1]) wbox(B, cx, y, cz, 3.8, 0.24, 3.8, st);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { wbox(B, cx + sx * 1.76, 8.6, cz + sz * 1.76, 0.32, 17.2, 0.32, st); rod(B, V3(cx + sx * 1.6, 17.1, cz + sz * 1.6), V3(cx + sx * 1.6, 18.9, cz + sz * 1.6), 0.18, st, 6, 0.02); }
    const FT = new Frame(V3(cx - 1.75, 0, cz + 1.76), V3(1, 0, 0));
    // belfry louvres
    for (const u of [0.55, 1.95]) {
      box(B, FT, u, u + 0.98, 14.3, 16.1, -0.03, 0.02, { mat: M.MATTE, color: [0.006, 0.006, 0.008] });
      const t = new THREE.CircleGeometry(0.49, 20, 0, Math.PI); B.add(t, FT.at(u + 0.49, 16.1, 0.025), { mat: M.MATTE, color: [0.006, 0.006, 0.008] }); t.dispose();
      const a = new THREE.TorusGeometry(0.55, 0.09, 6, 24, Math.PI); B.add(a, FT.at(u + 0.49, 16.1, 0.04), st); a.dispose();
      for (let v = 14.4; v < 16.0; v += 0.2) B.add(boxGeo(0.96, 0.05, 0.14), FT.at(u + 0.49, v, 0.05, 0.6, 0, 0), { mat: M.WOOD, color: [0.06, 0.045, 0.035] });
    }
    // clock face (plain hour marks, no numerals)
    const c = new THREE.CircleGeometry(0.86, 48); B.add(c, FT.at(1.75, 12.15, 0.03), { mat: M.STONE, color: [0.66, 0.63, 0.50] }); c.dispose();
    const cr = new THREE.TorusGeometry(0.9, 0.07, 8, 48); B.add(cr, FT.at(1.75, 12.15, 0.05), st); cr.dispose();
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; B.add(boxGeo(0.045, i % 3 ? 0.11 : 0.2, 0.02), FT.at(1.75 + Math.sin(a) * 0.71, 12.15 + Math.cos(a) * 0.71, 0.05, 0, 0, -a), { mat: M.IRON, color: COL.iron }); }
    B.add(boxGeo(0.07, 0.48, 0.02), FT.at(1.75 - 0.18, 12.15 + 0.11, 0.065, 0, 0, 1.02), { mat: M.IRON, color: COL.iron });
    B.add(boxGeo(0.045, 0.68, 0.02), FT.at(1.75 + 0.02, 12.15 + 0.32, 0.075, 0, 0, -0.06), { mat: M.IRON, color: COL.iron });
    for (const y of [7.4]) { box(B, FT, 1.45, 2.05, y, y + 1.3, -0.02, 0.02, { mat: M.GLASS, color: [0.01, 0.01, 0.012] }); surround(B, FT, 1.45, 2.05, y, y + 1.3); }
    const sp = new THREE.ConeGeometry(2.35, 6.4, 8, 1); B.add(sp, mtx(cx, 20.4, cz, 0, Math.PI / 8, 0), { mat: M.ROOF, color: [0.10, 0.07, 0.065] }); sp.dispose();
    rod(B, V3(cx, 23.5, cz), V3(cx, 24.6, cz), 0.04, { mat: M.IRON, color: COL.iron }); rod(B, V3(cx - 0.28, 24.2, cz), V3(cx + 0.28, 24.2, cz), 0.035, { mat: M.IRON, color: COL.iron });
    // nave roof and houses huddled at its foot
    for (const [x, y, z, w, h, d] of [[-4.8, 3.9, -31, 5.5, 7.8, 5], [6.8, 4.4, -31.5, 5, 8.8, 5], [-1.2, 2.9, -29.5, 3.6, 5.8, 3]]) {
      wbox(B, x, y, z, w, h, d, { mat: M.PLASTER, color: pick([COL.grey, COL.cream, COL.ochre]) });
      B.add(boxGeo(w + 0.4, 0.14, d * 0.75), mtx(x, y + h / 2 + 0.75, z + d * 0.22, 0.62, 0, 0), { mat: M.ROOF, color: [0.15, 0.065, 0.04] });
      for (let i = 0; i < 3; i++) wbox(B, x - w / 3 + i * w / 3, y + h / 2 - 1.5, z + d / 2 + 0.02, 0.55, 0.85, 0.05, { mat: M.GLASS, color: [0.01, 0.01, 0.012] });
    }
  }
  // chimneys on the roof lines
  chimney(B, -5.0, 10.2, -7.2, 0.5); chimney(B, -2.75, 9.0, -13.0); chimney(B, -2.8, 9.0, -17.4); chimney(B, 3.2, 10.35, -14.6); chimney(B, 3.15, 10.35, -17.8); chimney(B, 1.5, 7.0, -19.55, 1.57); chimney(B, 5.2, 9.4, -9.5, -1.0);
  // closing masses so no sky shows through gaps
  wbox(B, -3.4, 4.2, -20.0, 2.7, 8.4, 2.0, { mat: M.PLASTER, color: COL.grey });
  wbox(B, 3.55, 4.8, -20.0, 2.6, 9.6, 2.0, { mat: M.PLASTER, color: COL.rose });
  wbox(B, -2.5, 4.8, -10.35, 0.55, 9.5, 0.34, { mat: M.PLASTER, color: COL.ochre }, 0.15);
  wbox(B, 5.4, 4.5, -8.2, 1.2, 9.0, 0.5, { mat: M.PLASTER, color: COL.cream });
  // buildings behind the camera: seen only in reflections and shadows
  wbox(B, -5.6, 5.0, 8.0, 3.0, 10.0, 9.0, { mat: M.PLASTER, color: COL.grey });

  // gutter lantern bracket (the old street lamp)
  buildLanternStatic(B);
  buildNeonBacking(B);
  return B;
}

function buildLanternStatic(B) {
  const L = LAMPS[1].pos; const iron = { mat: M.IRON, color: [0.025, 0.032, 0.028] };
  const wallX = -1.96;
  const base = V3(wallX, L.y + 0.42, L.z);
  tube(B, [base, V3(wallX + 0.25, L.y + 0.58, L.z), V3(L.x - 0.06, L.y + 0.56, L.z), V3(L.x, L.y + 0.40, L.z)], 0.022, iron, 28, 8);
  tube(B, [V3(wallX, L.y - 0.05, L.z), V3(wallX + 0.18, L.y + 0.08, L.z), V3(wallX + 0.30, L.y + 0.37, L.z), V3(wallX + 0.43, L.y + 0.55, L.z)], 0.015, iron, 20, 6);
  const t = new THREE.TorusGeometry(0.095, 0.01, 6, 28, 5.2); B.add(t, mtx(wallX + 0.17, L.y + 0.36, L.z, 0, 0, 1.2), iron); t.dispose();
  wbox(B, wallX + 0.02, L.y + 0.25, L.z, 0.05, 0.75, 0.16, iron);
}
function buildLanternHead(B) { // excluded from the lantern's own shadow map; its glass glows
  const L = LAMPS[1].pos; const iron = { mat: M.IRON, color: [0.025, 0.032, 0.028] };
  const top = 0.19, bot = -0.2, wt = 0.165, wb = 0.10;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) rod(B, V3(L.x + sx * wt, L.y + top, L.z + sz * wt), V3(L.x + sx * wb, L.y + bot, L.z + sz * wb), 0.012, iron, 6);
  for (const [y, w] of [[top, wt], [bot, wb]]) for (const [a, b] of [[[1, 1], [1, -1]], [[1, -1], [-1, -1]], [[-1, -1], [-1, 1]], [[-1, 1], [1, 1]]]) rod(B, V3(L.x + a[0] * w, L.y + y, L.z + a[1] * w), V3(L.x + b[0] * w, L.y + y, L.z + b[1] * w), 0.014, iron, 6);
  const cap = new THREE.ConeGeometry(0.29, 0.17, 4); B.add(cap, mtx(L.x, L.y + top + 0.09, L.z, 0, Math.PI / 4, 0), iron); cap.dispose();
  sphere(B, V3(L.x, L.y + top + 0.2, L.z), 0.035, iron); sphere(B, V3(L.x, L.y + bot - 0.04, L.z), 0.045, iron);
  sphere(B, L, 0.055, { mat: M.EMIT, color: [0.82, 1.0, 0.80], lamp: 1, glow: 16 }, 1, 1.35, 1);
  // frosted panes: thin glowing plates, inset
  const pane = { mat: M.EMIT, color: [0.50, 0.92, 0.66], lamp: 1, glow: 1.15 };
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const quad = new THREE.BufferGeometry();
    const v = [-wb * 0.88, bot + 0.02, wb * 0.93, wb * 0.88, bot + 0.02, wb * 0.93, wt * 0.88, top - 0.02, wt * 0.93, -wb * 0.88, bot + 0.02, wb * 0.93, wt * 0.88, top - 0.02, wt * 0.93, -wt * 0.88, top - 0.02, wt * 0.93];
    quad.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); quad.computeVertexNormals();
    // leave the pane that faces the camera open to its mantle, with glazing bars
    if (i !== 0) B.add(quad, mtx(L.x, L.y, L.z, 0, a, 0), pane);
    quad.dispose();
  }
  for (const dx of [-0.045, 0.045]) rod(B, V3(L.x + dx, L.y + bot, L.z + wb), V3(L.x + dx * 1.5, L.y + top, L.z + wt), 0.006, iron, 5);
}
const NEON_F = (() => { const o = CAFE.p(0.47, 0, 0); return new Frame(o, CAFE.N.clone().negate()); })();
function neonLocal(a, b, d = 0.035) { // a: out from the wall, b: height relative to the sign centre
  return CAFE.p(0.47 + d, 3.36 + b, 0.58 + a);
}
function buildNeonBacking(B) {
  const iron = { mat: M.IRON, color: [0.02, 0.02, 0.024] };
  const ring = []; for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283; ring.push(neonLocal(Math.cos(a) * 0.43, Math.sin(a) * 0.43, -0.03)); }
  tube(B, ring, 0.016, iron, 90, 6, true);
  rod(B, CAFE.p(0.47, 3.80, 0.0), CAFE.p(0.47, 3.80, 0.62), 0.018, iron);
  rod(B, neonLocal(0, 0.43, -0.03), CAFE.p(0.47, 3.80, 0.58), 0.012, iron);
  rod(B, CAFE.p(0.47, 3.18, 0.0), neonLocal(-0.42, -0.1, -0.03), 0.012, iron);
  for (const b of [-0.2, 0.05]) rod(B, neonLocal(-0.39, b, -0.03), neonLocal(0.39, b, -0.03), 0.006, iron);
}
function buildNeonTubes(B) { // a neon cup of coffee: no lettering
  const pink = { mat: M.EMIT, color: [1.0, 0.07, 0.30], lamp: 2, glow: 5.2 };
  const amber = { mat: M.EMIT, color: [1.0, 0.36, 0.07], lamp: 2, glow: 4.5 };
  const teal = { mat: M.EMIT, color: [0.10, 0.86, 1.0], lamp: 2, glow: 4.2 };
  const P = (a, b) => neonLocal(a, b);
  tube(B, [P(-0.23, 0.06), P(-0.215, -0.08), P(-0.15, -0.19), P(-0.03, -0.225), P(0.07, -0.19), P(0.135, -0.08), P(0.15, 0.06)], 0.017, pink, 40, 8);
  tube(B, [P(-0.23, 0.06), P(-0.13, 0.068), P(0.05, 0.068), P(0.15, 0.06)], 0.017, pink, 24, 8);
  tube(B, [P(0.148, 0.025), P(0.235, 0.035), P(0.265, -0.03), P(0.21, -0.1), P(0.117, -0.115)], 0.015, pink, 28, 8);
  tube(B, [P(-0.29, -0.255), P(-0.18, -0.29), P(-0.04, -0.30), P(0.10, -0.29), P(0.22, -0.255)], 0.016, amber, 30, 8);
  for (const [a, s] of [[-0.135, 0.85], [-0.035, 1.0], [0.065, 0.8]]) tube(B, [P(a, 0.12), P(a + 0.035, 0.175), P(a - 0.025, 0.24), P(a + 0.02, 0.12 + 0.22 * s)], 0.011, teal, 24, 8);
}

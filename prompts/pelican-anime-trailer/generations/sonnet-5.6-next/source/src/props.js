// ---------- set dressing ----------
function earClip(poly) {
  const idx = poly.map((_, i) => i), tris = [];
  let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1;
  const cr = (a, b, c) => ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * sgn;
  let guard = 0;
  while (idx.length > 3 && guard++ < 2000) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
      const a = poly[i0], b = poly[i1], c = poly[i2];
      if (cr(a, b, c) <= 0) continue;
      let inside = false;
      for (const j of idx) { if (j === i0 || j === i1 || j === i2) continue; const p = poly[j]; if (cr(a, b, p) > 0 && cr(b, c, p) > 0 && cr(c, a, p) > 0) { inside = true; break; } }
      if (inside) continue;
      tris.push([i0, i1, i2]); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}
// extrude a polygon (x,y) between z0..z1
function buildPrism(mb, poly, z0, z1, mat, part, lw = 1) {
  const tris = earClip(poly);
  for (const z of [z0, z1]) {
    const base = mb.nv; for (const p of poly) mb.vert([p[0], p[1], z], [0, 0, z === z1 ? 1 : -1], p[0], p[1], mat, part, lw, z === z1 ? -0.25 : 0);
    for (const [a, b, c] of tris) mb.tri(base + a, base + b, base + c);
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    let n = norm([b[1] - a[1], -(b[0] - a[0]), 0]);
    let area = 0; for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1]; }
    if (area < 0) n = mul(n, -1);
    const q = [[a, z0], [b, z0], [b, z1], [a, z1]].map(([p, z]) => mb.vert([p[0], p[1], z], n, 0, 0, mat, part + (i % 2), lw, 0));
    mb.tri(q[0], q[1], q[2]); mb.tri(q[0], q[2], q[3]);
  }
}
function buildRail(mb, scroll, z, o = {}) {
  const sp = 2.2, from = o.from === undefined ? -16 : o.from, to = o.to === undefined ? 16 : o.to;
  const off = ((scroll % sp) + sp) % sp;
  for (let x = from - off; x <= to; x += sp) mb.tube([[x, 0, z], [x, 0.62, z]], 0.045, 0.040, { mat: MAT.pole, part: 430, nv: 8, lw: 0.7 });
  for (const y of [0.46, 0.60]) mb.box([(from + to) / 2, y, z + 0.035], [(to - from) / 2, 0, 0], [0, 0.042, 0], [0, 0, 0.012], { mat: MAT.rail, part: y > 0.5 ? 431 : 432, lw: 0.7 });
}
// guard rail following an arc (hairpin): centre (0, -R)
function buildArcRail(mb, R, along, outer) {
  const rr = R + outer, sp = 1.5;
  const off = (along % sp + sp) % sp;
  const P = (a, y, r = rr) => [Math.sin(a) * r, y, -R + Math.cos(a) * r];
  const k0 = -14, k1 = 14;
  for (let k = k0; k <= k1; k++) { const a = (k * sp - off) / R; mb.tube([P(a, 0), P(a, 0.55)], 0.042, 0.036, { mat: MAT.pole, part: 430, nv: 8, lw: 0.7 }); }
  for (const y of [0.40, 0.53]) mb.loft(u => P(lerp((k0 * sp) / R, (k1 * sp) / R, u), y), () => [0.040, 0.014], { mat: y > 0.45 ? MAT.red : MAT.rail, part: y > 0.45 ? 431 : 432, nu: 110, nv: 8, lw: 0.7 });
}
function buildPine(mb, p, h, part) {
  mb.tube([p, add(p, [0, h * 0.28, 0])], h * 0.045, h * 0.035, { mat: MAT.wood, part: part, nv: 8 });
  mb.loft(u => add(p, [0, h * (0.2 + 0.8 * u), 0]), u => { const tier = 1 - fract(u * 4) * 0.62; const r = h * 0.27 * (1 - u * 0.9) * tier + 0.002; return [r, r]; }, { mat: MAT.pine, part: part + 1, nu: 36, nv: 14, up: [1, 0, 0], lw: 0.8 });
}
function buildPines(mb, scroll, z, spacing, seed, span = 24) {
  const k0 = Math.floor((scroll - span) / spacing), k1 = Math.ceil((scroll + span) / spacing);
  for (let k = k0; k <= k1; k++) {
    const r = hash2(k, seed); if (r < 0.28) continue;
    const x = k * spacing - scroll + (hash2(k, seed + 1) - 0.5) * spacing * 0.8;
    buildPine(mb, [x, -0.05, z - hash2(k, seed + 2) * 2.2], 1.0 + hash2(k, seed + 3) * 1.5, 440 + ((k % 8) + 8) % 8 * 2);
  }
}
function buildRock(mb, c, r, seed, mat = MAT.rock, part = 460) {
  mb.grid(7, 9, (u, v) => {
    const th = u * PI, ph = v * TAU; const j = 1 + (hash2(Math.round(u * 7) * 17 + Math.round((v % 1) * 9), seed) - 0.5) * 0.55 * Math.sin(th);
    return [c[0] + Math.sin(th) * Math.cos(ph) * r * j * 1.25, c[1] - Math.cos(th) * r * j * 0.8, c[2] + Math.sin(th) * Math.sin(ph) * r * j];
  }, { mat, part, wrapV: true, lw: 0.9 });
}
function buildRocks(mb, scroll, z, spacing, seed, size, mat, span = 20) {
  const k0 = Math.floor((scroll - span) / spacing), k1 = Math.ceil((scroll + span) / spacing);
  for (let k = k0; k <= k1; k++) {
    if (hash2(k, seed) < 0.4) continue;
    const r = size * (0.5 + hash2(k, seed + 4));
    buildRock(mb, [k * spacing - scroll + hash2(k, seed + 1) * spacing * 0.7, r * 0.25, z - hash2(k, seed + 2) * 1.5], r, k * 31 + seed, mat, 462 + ((k % 4) + 4) % 4);
  }
}
function buildLamps(mb, scroll) {
  const sp = 9, k0 = Math.floor((scroll - 28) / sp), k1 = Math.ceil((scroll + 28) / sp);
  for (let k = k0; k <= k1; k++) {
    const x = k * sp - scroll;
    mb.tube([[x, 0, -4.35], [x, 2.75, -4.35]], 0.065, 0.045, { mat: MAT.pole, part: 470, nv: 10 });
    mb.tube([[x, 2.72, -4.35], [x, 3.06, -4.2], [x, 3.08, -3.9]], 0.038, 0.030, { mat: MAT.pole, part: 470, nv: 8 });
    mb.ellipsoid([x, 3.03, -3.9], [0.14, 0, 0], [0, 0.06, 0], [0, 0, 0.17], { mat: MAT.pole, part: 471 });
    mb.ellipsoid([x, 2.985, -3.9], [0.095, 0, 0], [0, 0.038, 0], [0, 0, 0.12], { mat: MAT.lamp, part: 472, nu: 8, nv: 12 });
  }
}
function buildGrassTufts(mb, scroll, z, spacing, seed, span = 12) {
  const k0 = Math.floor((scroll - span) / spacing), k1 = Math.ceil((scroll + span) / spacing);
  for (let k = k0; k <= k1; k++) {
    if (hash2(k, seed) < 0.35) continue;
    const x = k * spacing - scroll + hash2(k, seed + 1) * spacing, zz = z + (hash2(k, seed + 2) - 0.5) * 0.8;
    for (let b = 0; b < 5; b++) mb.blade([x + (b - 2) * 0.03, 0, zz], norm([(hash2(k * 7 + b, seed) - 0.5) * 0.9, 1, (b % 2) * 0.2]), [1, 0, 0], 0.09 + 0.12 * hash2(k + b, seed + 8), 0.030, { mat: MAT.grass, part: 480, lw: 0.6, shape: 'spike' });
  }
}
// start / finish gate with checker banner
function buildGate(mb, x, z0, z1, h) {
  for (const z of [z0, z1]) { mb.tube([[x, 0, z], [x, h, z]], 0.07, 0.06, { mat: MAT.pole, part: 490, nv: 10 }); mb.sphere([x, h + 0.06, z], 0.085, { mat: MAT.gold, part: 491 }); }
  mb.grid(2, 24, (u, v) => [x, h - 0.46 + u * 0.40 + Math.sin(v * 14) * 0.012, lerp(z0, z1, v)], { mat: MAT.checker, part: 492, uv: (u, v) => [v, u], lw: 0.9 });
}
function buildCone(mb, x, z, part) { mb.tube([[x, 0, z], [x, 0.30, z]], 0.095, 0.012, { mat: MAT.leg, part, nv: 12 }); mb.box([x, 0.012, z], [0.12, 0, 0], [0, 0.012, 0], [0, 0, 0.12], { mat: MAT.black, part: part + 1 }); }
// launch ramp (wooden wedge)
function buildRamp(mb, x0, x1, h, z0, z1) {
  buildPrism(mb, [[x0, -0.02], [x1, -0.02], [x1, h], [lerp(x0, x1, 0.62), h * 0.42], [lerp(x0, x1, 0.3), h * 0.12]], z0, z1, MAT.wood, 494);
}

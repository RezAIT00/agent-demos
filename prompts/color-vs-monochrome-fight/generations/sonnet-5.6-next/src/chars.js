// chars.js — IRO and SUMI, built from the solved rig every drawing
const CHARSTYLE = {
  iro: {
    cls: 10, ink: hex(0x2b0b1f), rim: hex(0xffe9b0), hullPx: 2.5, dry: 0,
    mats: [
      /*0 skin*/ [0xffc296, 0xdb7e62, 0x984956, 0],
      /*1 hair root*/ [0xc20e63, 0x80083f, 0x4e0434, 3],
      /*2 hair mid*/ [0xff4a26, 0xb81f3e, 0x720c42, 0],
      /*3 hair tip*/ [0xffc41c, 0xe06a1c, 0x992a2c, 0],
      /*4 jacket*/ [0x12d6c6, 0x0a8a99, 0x074a70, 5],
      /*5 gold*/ [0xffcc2a, 0xdb8210, 0x8c4812, 0],
      /*6 top*/ [0x59208a, 0x391061, 0x210840, 0],
      /*7 pants*/ [0xff5530, 0xc3283e, 0x741046, 0],
      /*8 wraps*/ [0xfff0d0, 0xdcb59e, 0x9a7280, 1],
      /*9 boot*/ [0x0f7f88, 0x084e60, 0x052c40, 0],
      /*10 sash magenta*/ [0xff2a8c, 0xb61270, 0x6c0852, 0],
      /*11 sash gold*/ [0xffd634, 0xe88814, 0x9e4012, 0],
      /*12 eye white*/ [0xfffaf2, 0xfffaf2, 0xe8d0d0, 9],
      /*13 iris*/ [0x10e8f8, 0x10e8f8, 0x10e8f8, 9],
      /*14 pupil*/ [0x06284c, 0x06284c, 0x06284c, 9],
      /*15 glint*/ [0xffffff, 0xffffff, 0xffffff, 9],
      /*16 lash*/ [0x2c0a24, 0x2c0a24, 0x2c0a24, 9],
      /*17 mouth*/ [0x5c0c26, 0x5c0c26, 0x5c0c26, 9],
      /*18 teeth*/ [0xfff5e8, 0xfff5e8, 0xfff5e8, 9],
      /*19 tongue*/ [0xea5268, 0xea5268, 0xea5268, 9],
      /*20 face paint*/ [0x12d6c6, 0x0a9aa8, 0x0a9aa8, 9],
      /*21 blush*/ [0xff8a70, 0xe0685c, 0xb05058, 9],
      /*22 nose*/ [0xd8765c, 0xa85058, 0x984956, 9],
      /*23 belt*/ [0x3a1262, 0x250842, 0x15042a, 0],
    ],
  },
  sumi: {
    cls: 20, ink: [0, 0, 0], rim: hex(0xf4f4f4), hullPx: 3.1, dry: 1,
    mats: [
      /*0 skin*/ [0xb4b4b4, 0x747474, 0x404040, 0],
      /*1 ink hair*/ [0x111111, 0x070707, 0x000000, 4],
      /*2 vest*/ [0x272727, 0x141414, 0x060606, 5],
      /*3 white piping*/ [0xeeeeee, 0xb0b0b0, 0x6a6a6a, 0],
      /*4 hakama*/ [0x212121, 0x101010, 0x040404, 2],
      /*5 rope*/ [0xdcdcdc, 0x9e9e9e, 0x5e5e5e, 1],
      /*6 ink arm*/ [0x161616, 0x0a0a0a, 0x010101, 6],
      /*7 skin (under ink)*/ [0xb4b4b4, 0x747474, 0x404040, 0],
      /*8 mantle*/ [0xd6d6d6, 0x949494, 0x525252, 0],
      /*9 boots*/ [0x1a1a1a, 0x0c0c0c, 0x020202, 0],
      /*10 eye white*/ [0xffffff, 0xffffff, 0xffffff, 9],
      /*11 eye line*/ [0x000000, 0x000000, 0x000000, 9],
      /*12 ink stripe*/ [0x101010, 0x080808, 0x040404, 9],
      /*13 mouth*/ [0x1c1c1c, 0x1c1c1c, 0x1c1c1c, 9],
      /*14 nose*/ [0x6e6e6e, 0x484848, 0x383838, 9],
      /*15 teeth*/ [0xf0f0f0, 0xd0d0d0, 0xb0b0b0, 9],
      /*16 torso vest*/ [0x272727, 0x141414, 0x060606, 7],
    ],
  },
};

// ---------- secondary motion: length-preserving chain pushed by relative wind ----------
function flowChain(base, restDirs, segLen, drag, flex, flutter, t, seed, gravity = 0) {
  const pts = [base.slice()];
  const n = restDirs.length;
  let p = base.slice();
  for (let i = 0; i < n; i++) {
    const s = (i + 1) / n;
    let d = V.norm(restDirs[i]);
    d = V.mad(d, drag, flex * (0.25 + 0.9 * s));
    d = V.mad(d, [0, -1, 0], gravity * s);
    const dl = V.len(drag);
    const w1 = Math.sin(t * 13.0 - s * 6.2 + seed * 17.0), w2 = Math.sin(t * 8.3 - s * 4.1 + seed * 5.0);
    const side = V.norm(V.cross(d, [0.21, 0.92, 0.33]));
    const up = V.norm(V.cross(side, d));
    const amp = flutter * s * (0.35 + Math.min(dl, 2.0) * 0.55);
    d = V.mad(d, side, w1 * amp);
    d = V.mad(d, up, w2 * amp * 0.8);
    d = V.norm(d);
    p = V.mad(p, d, segLen);
    pts.push(p.slice());
  }
  return pts;
}

// ---------- shared anatomy ----------
function limbPath(a, m, b, n = 18, round = 0.16) {
  // polyline a->m->b with the joint softened by a quadratic curve
  const out = [];
  const half = Math.floor(n / 2);
  const p0 = V.lerp(m, a, round), p1 = V.lerp(m, b, round);
  for (let i = 0; i < half; i++) out.push(V.lerp(a, p0, i / half));
  for (let i = 0; i <= 4; i++) { const u = i / 4; out.push(V.lerp(V.lerp(p0, m, u), V.lerp(m, p1, u), u)); }
  for (let i = 1; i <= half; i++) out.push(V.lerp(p1, b, i / half));
  return out;
}

function buildHand(mb, wr, el, side, rig, grip, scale, mat, size, ol, pole) {
  const sx = side === 'L' ? 1 : -1;
  const f = V.norm(V.sub(wr, el));
  let back = V.sub(M3.v(rig.Rc, [sx, 0.25, -0.2]), V.mul(f, V.dot(M3.v(rig.Rc, [sx, 0.25, -0.2]), f)));
  if (V.len(back) < 0.01) back = V.cross(f, [0, 1, 0]);
  back = V.norm(back);
  let across = V.norm(V.cross(f, back));
  if (V.dot(across, M3.v(rig.Rc, [0, 1, 0])) < 0) across = V.neg(across);
  const s = size * scale;
  const R = M3.fromCols(across, back, f);
  const at = (a, b, c) => V.add(wr, V.add(V.mul(across, a * s), V.add(V.mul(back, b * s), V.mul(f, c * s))));
  if (grip === 1) {
    // fist: boxy palm, four knuckle ridges, thumb wrapped across the front
    const rings = [];
    const prof_ = [[0, 0.52, 0.36], [0.25, 0.68, 0.50], [0.62, 0.78, 0.60], [0.95, 0.74, 0.55], [1.06, 0.55, 0.38]];
    for (const [c, a, b] of prof_) rings.push({ c: at(0, 0, c), U: V.mul(across, a * s), V: V.mul(back, b * s) });
    mb.loft(rings, 12, { mat, e: 0.55, ol });
    for (let i = 0; i < 4; i++) {
      const x = -0.54 + i * 0.36;
      mb.tube([at(x, 0.40, 0.84), at(x, 0.36, 1.12), at(x, -0.10, 1.18), at(x, -0.40, 0.88)], () => 0.185 * s, 7, across, { mat, ol: ol * 0.55 });
    }
    mb.tube([at(0.68, -0.15, 0.30), at(0.58, -0.58, 0.70), at(0.05, -0.62, 0.92)], t => (0.25 - 0.07 * t) * s, 8, f, { mat, ol: ol * 0.6 });
  } else {
    const rings = [];
    for (const [c, a, b] of [[0, 0.46, 0.30], [0.35, 0.60, 0.30], [0.80, 0.66, 0.24], [0.95, 0.6, 0.17]])
      rings.push({ c: at(0, 0, c), U: V.mul(across, a * s), V: V.mul(back, b * s) });
    mb.loft(rings, 12, { mat, e: 0.7, ol });
    for (let i = 0; i < 4; i++) {
      const x = 0.46 - i * 0.31;
      const spread = (grip === 3 ? 0.22 : 0.13) * (1.5 - i);
      const extended = grip === 0 || grip === 3 || (grip === 2 && i < 2);
      const len = [0.86, 0.95, 0.88, 0.70][i];
      if (extended) {
        const curl = grip === 3 ? 0.55 : (grip === 2 ? 0.0 : 0.12);
        const sp = grip === 2 ? 0.02 : spread;
        mb.tube([at(x, 0, 0.82), at(x + sp * 0.5, 0.02, 0.82 + len * 0.52), at(x + sp, -curl * 0.55, 0.82 + len * (grip === 3 ? 0.8 : 1.0))],
          t => (0.17 - 0.085 * t) * s, 7, across, { mat, ol: ol * 0.55 });
      } else {
        mb.tube([at(x, 0.1, 0.84), at(x, 0.02, 1.10), at(x, -0.34, 0.92)], () => 0.17 * s, 7, across, { mat, ol: ol * 0.5 });
      }
    }
    const th = grip === 2 ? [at(0.55, -0.1, 0.25), at(0.62, -0.42, 0.68), at(0.15, -0.46, 0.92)]
      : [at(0.52, -0.05, 0.22), at(0.98, -0.18, 0.62), at(1.05, -0.28, 1.0)];
    mb.tube(th, t => (0.22 - 0.11 * t) * s, 7, f, { mat, ol: ol * 0.6 });
  }
}

function buildFoot(mb, an, rig, side, B, scale, mats, ol, wide) {
  const fd = rig.footDir(side);
  const s = scale * wide;
  const at = (z, y, x = 0) => V.add(an, V.add(V.mul(fd.f, z * s), V.add(V.mul(fd.u, y * s), V.mul(fd.r, x * s))));
  const rings = [];
  const spec = [[-0.055, -0.035, 0.030, 0.035], [-0.045, -0.025, 0.047, 0.055], [0.0, -0.015, 0.052, 0.062],
    [0.05, -0.040, 0.054, 0.040], [0.11, -0.052, 0.050, 0.028], [0.165, -0.055, 0.036, 0.020], [0.188, -0.056, 0.012, 0.008]];
  for (const [z, y, a, b] of spec) rings.push({ c: at(z, y), U: V.mul(fd.r, a * s), V: V.mul(fd.u, b * s) });
  mb.loft(rings, 12, { mat: mats[0], e: 0.7, ol });
  // sole
  const sole = [];
  for (const [z, w] of [[-0.058, 0.03], [-0.03, 0.054], [0.05, 0.058], [0.13, 0.048], [0.192, 0.014]])
    sole.push({ c: at(z, -0.072), U: V.mul(fd.r, w * s), V: V.mul(fd.u, 0.016 * s) });
  mb.loft(sole, 10, { mat: mats[1], e: 0.6, ol: ol * 0.7 });
}

function headLoft(mb, c, R, profile, mat, scale, inflate = 0, M = 22) {
  const X = M3.col(R, 0), Y = M3.col(R, 1), Z = M3.col(R, 2);
  const rings = profile.map(([y, wx, zf, zb]) => ({
    c: V.mad(c, Y, y * scale), U: V.mul(X, (wx + inflate) * scale), V: V.mul(Z, (zb + inflate) * scale), vf: (zf + inflate) / (zb + inflate || 1),
  }));
  mb.loft(rings, M, { mat, e: 0.88, ol: 1 });
}
function faceZ(profile, x, y) {
  const wx = prof(profile.map(p => [p[0], p[1]]), y), zf = prof(profile.map(p => [p[0], p[2]]), y);
  const k = clamp(Math.abs(x) / Math.max(wx, 1e-4), 0, 0.985);
  return zf * Math.pow(1 - Math.pow(k, 2 / 0.88), 0.88 / 2);
}
// draw a 2D polygon onto the face surface (tessellated so it hugs the curve)
function faceDecal(mb, c, R, profile, scale, pts2d, mat, lift) {
  let cx = 0, cy = 0;
  for (const p of pts2d) { cx += p[0]; cy += p[1]; }
  cx /= pts2d.length; cy /= pts2d.length;
  const P = (x, y) => {
    const z = faceZ(profile, x, y) + lift;
    return V.add(c, M3.v(R, [x * scale, y * scale, z * scale]));
  };
  const n = M3.v(R, V.norm([cx * 4, 0, 1]));
  const N = pts2d.length, K = 3;
  for (let i = 0; i < N; i++) {
    const a = pts2d[i], b = pts2d[(i + 1) % N];
    for (let k = 0; k < K; k++) {
      const u0 = k / K, u1 = (k + 1) / K;
      const a0 = [lerp(cx, a[0], u0), lerp(cy, a[1], u0)], b0 = [lerp(cx, b[0], u0), lerp(cy, b[1], u0)];
      const a1 = [lerp(cx, a[0], u1), lerp(cy, a[1], u1)], b1 = [lerp(cx, b[0], u1), lerp(cy, b[1], u1)];
      const pa0 = P(a0[0], a0[1]), pa1 = P(a1[0], a1[1]), pb1 = P(b1[0], b1[1]), pb0 = P(b0[0], b0[1]);
      mb.tri(pa0, pa1, pb1, n, mat);
      if (k > 0) mb.tri(pa0, pb1, pb0, n, mat);
    }
  }
}
// tapered line on the face
function faceStroke(mb, c, R, profile, scale, pts, widths, mat, lift) {
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = widths[i] / 2;
    left.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    right.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  for (let i = 0; i < pts.length - 1; i++)
    faceDecal(mb, c, R, profile, scale, [left[i], left[i + 1], right[i + 1], right[i]], mat, lift);
}
const ellipsePts = (cx, cy, rx, ry, n = 12) => { const o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; };

const IRO_HEAD = [[-0.122, 0.010, 0.074, 0.004], [-0.104, 0.040, 0.089, 0.020], [-0.074, 0.068, 0.095, 0.048], [-0.036, 0.087, 0.093, 0.084],
  [0.008, 0.099, 0.097, 0.106], [0.054, 0.099, 0.095, 0.110], [0.094, 0.081, 0.076, 0.094], [0.119, 0.048, 0.046, 0.060], [0.130, 0.004, 0.004, 0.004]];
const SUMI_HEAD = [[-0.128, 0.026, 0.080, 0.010], [-0.114, 0.060, 0.098, 0.034], [-0.080, 0.082, 0.100, 0.060], [-0.040, 0.090, 0.098, 0.090],
  [0.008, 0.100, 0.102, 0.108], [0.054, 0.100, 0.098, 0.112], [0.096, 0.082, 0.080, 0.096], [0.122, 0.048, 0.048, 0.060], [0.134, 0.004, 0.004, 0.004]];

function iroFace(mb, c, R, sc, eyes, mouth) {
  const D = (pts, mat, lift) => faceDecal(mb, c, R, IRO_HEAD, sc, pts, mat, lift);
  const S = (pts, w, mat, lift) => faceStroke(mb, c, R, IRO_HEAD, sc, pts, w, mat, lift);
  for (const sx of [1, -1]) {
    const ex = sx * 0.040, ey = -0.016;
    const open = eyes === 'wide' ? 1.25 : (eyes === 'sharp' ? 0.78 : (eyes === 'strain' ? 0.55 : 1.0));
    const X = u => ex + sx * u, Y = v => ey + v * open;
    if (eyes === 'closed') {
      S([[X(-0.020), ey - 0.001], [X(0.0), ey - 0.008], [X(0.022), ey + 0.002]], [0.002, 0.006, 0.002], 16, 0.004);
    } else {
      D([[X(-0.019), Y(0.004)], [X(-0.006), Y(0.015)], [X(0.014), Y(0.016)], [X(0.025), Y(0.008)], [X(0.018), Y(-0.010)], [X(0.002), Y(-0.014)], [X(-0.014), Y(-0.008)]], 12, 0.0022);
      D(ellipsePts(X(0.002), Y(0.000), 0.0115, 0.0132 * open), 13, 0.0030);
      D(ellipsePts(X(0.002), Y(0.001), eyes === 'wide' ? 0.003 : 0.0052, (eyes === 'wide' ? 0.004 : 0.0075) * open), 14, 0.0036);
      D(ellipsePts(X(-0.003), Y(0.0065), 0.0036, 0.0036 * open, 8), 15, 0.0042);
      S([[X(-0.022), Y(0.003)], [X(-0.007), Y(0.0165)], [X(0.014), Y(0.0175)], [X(0.027), Y(0.009)], [X(0.034), Y(0.015)]], [0.0015, 0.0062, 0.0085, 0.0068, 0.001], 16, 0.0046);
      S([[X(-0.008), Y(-0.0145)], [X(0.012), Y(-0.012)]], [0.0008, 0.0026], 16, 0.0040);
    }
    // brows: slanted hard when determined
    const tilt = eyes === 'wide' ? -0.004 : (eyes === 'open' ? 0.003 : 0.011);
    S([[X(-0.022), 0.0185 - tilt], [X(0.004), 0.0275], [X(0.030), 0.0295 + tilt * 0.35]], [0.0075, 0.0056, 0.0012], 16, 0.0044);
    D([[X(0.008), -0.040], [X(0.030), -0.037], [X(0.032), -0.041], [X(0.010), -0.044]], 21, 0.0018);
  }
  // paint mark under her left eye
  D([[0.040, -0.034], [0.049, -0.050], [0.040, -0.066], [0.034, -0.050]], 20, 0.0034);
  D([[0.002, -0.036], [0.0075, -0.056], [-0.001, -0.054]], 22, 0.003);
  if (mouth === 'grin') {
    D([[-0.030, -0.070], [-0.012, -0.075], [0.014, -0.074], [0.032, -0.064], [0.020, -0.088], [0.000, -0.095], [-0.018, -0.088]], 17, 0.0028);
    D([[-0.026, -0.0725], [-0.011, -0.0765], [0.014, -0.0755], [0.028, -0.068], [0.021, -0.078], [-0.018, -0.081]], 18, 0.0036);
    D([[0.012, -0.075], [0.019, -0.075], [0.0155, -0.086]], 18, 0.004);
  } else if (mouth === 'shout') {
    D([[-0.026, -0.066], [0.000, -0.070], [0.026, -0.064], [0.019, -0.094], [0.000, -0.108], [-0.019, -0.095]], 17, 0.0028);
    D([[-0.021, -0.0685], [0.000, -0.072], [0.021, -0.067], [0.016, -0.076], [-0.016, -0.0775]], 18, 0.0036);
    D(ellipsePts(0.0, -0.097, 0.012, 0.0065, 10), 19, 0.0036);
  } else if (mouth === 'grit') {
    D([[-0.028, -0.072], [0.028, -0.070], [0.020, -0.087], [-0.021, -0.088]], 17, 0.0028);
    D([[-0.024, -0.0745], [0.024, -0.073], [0.018, -0.0845], [-0.019, -0.0855]], 18, 0.0036);
    S([[-0.022, -0.0795], [0.021, -0.0785]], [0.0016, 0.0016], 17, 0.0042);
  } else if (mouth === 'smirk') {
    S([[-0.018, -0.080], [0.000, -0.081], [0.014, -0.076], [0.024, -0.069]], [0.0015, 0.0038, 0.0042, 0.001], 17, 0.003);
  } else if (mouth === 'open') {
    D(ellipsePts(0.002, -0.082, 0.010, 0.011, 10), 17, 0.003);
  } else {
    S([[-0.016, -0.079], [0.000, -0.0805], [0.016, -0.078]], [0.001, 0.0036, 0.001], 17, 0.003);
  }
}

function sumiFace(mb, c, R, sc, eyes, mouth) {
  const D = (pts, mat, lift) => faceDecal(mb, c, R, SUMI_HEAD, sc, pts, mat, lift);
  const S = (pts, w, mat, lift) => faceStroke(mb, c, R, SUMI_HEAD, sc, pts, w, mat, lift);
  // the single ink stripe through his left eye
  D([[0.024, 0.100], [0.052, 0.094], [0.054, 0.020], [0.060, -0.020], [0.046, -0.070], [0.040, -0.112], [0.030, -0.060], [0.026, -0.018], [0.022, 0.030]], 12, 0.0018);
  for (const sx of [1, -1]) {
    const X = u => sx * (0.040 + u), ey = -0.012;
    const o = eyes === 'wide' ? 1.7 : (eyes === 'sharp' ? 1.0 : (eyes === 'strain' ? 0.7 : 1.15));
    if (eyes === 'closed') {
      S([[X(-0.022), ey], [X(0.022), ey + 0.005]], [0.002, 0.005], 11, 0.004);
    } else {
      D([[X(-0.024), ey - 0.002], [X(-0.006), ey + 0.006 * o], [X(0.016), ey + 0.011 * o], [X(0.030), ey + 0.012 * o], [X(0.018), ey - 0.004 * o], [X(-0.002), ey - 0.006 * o]], 10, 0.0034);
      S([[X(-0.027), ey - 0.003], [X(-0.007), ey + 0.0075 * o], [X(0.016), ey + 0.0125 * o], [X(0.036), ey + 0.016 * o]], [0.0015, 0.0066, 0.0075, 0.001], 11, 0.0042);
      S([[X(-0.012), ey - 0.0062 * o], [X(0.016), ey - 0.0048 * o]], [0.0008, 0.0024], 11, 0.004);
    }
    S([[X(-0.030), 0.002], [X(-0.004), 0.019], [X(0.038), 0.027]], [0.013, 0.0095, 0.002], 11, 0.0046);
  }
  S([[0.000, 0.012], [0.004, -0.040], [0.011, -0.052], [0.000, -0.056]], [0.001, 0.0035, 0.004, 0.001], 14, 0.003);
  if (mouth === 'shout') {
    D([[-0.032, -0.075], [0.000, -0.071], [0.032, -0.075], [0.026, -0.105], [0.000, -0.114], [-0.026, -0.105]], 13, 0.0028);
    D([[-0.026, -0.077], [0.000, -0.0745], [0.026, -0.077], [0.022, -0.084], [-0.022, -0.084]], 15, 0.0036);
  } else if (mouth === 'grit') {
    D([[-0.034, -0.077], [0.034, -0.075], [0.028, -0.093], [-0.028, -0.095]], 13, 0.0028);
    D([[-0.029, -0.0795], [0.029, -0.078], [0.024, -0.090], [-0.024, -0.0915]], 15, 0.0036);
    S([[-0.027, -0.085], [0.027, -0.084]], [0.0018, 0.0018], 13, 0.0042);
  } else {
    S([[-0.028, -0.088], [-0.008, -0.081], [0.012, -0.081], [0.030, -0.087]], [0.0012, 0.0042, 0.0046, 0.0012], 13, 0.003);
  }
}

// ---------- hair clumps ----------
function hairClump(mb, headC, R, sc, spec, drag, t, mat, lineW) {
  const [bx, by, bz, dx, dy, dz, len, wid, cx, cy, cz, flex, seed] = spec;
  const n = 9;
  const base = V.add(headC, M3.v(R, [bx * sc, by * sc, bz * sc]));
  const rest = [];
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) / n;
    rest.push(M3.v(R, V.norm([dx + cx * s * 2, dy + cy * s * 2, dz + cz * s * 2])));
  }
  const pts = flowChain(base, rest, len * sc / n, drag, flex, 0.10 * flex, t, seed);
  const radius = s => {
    const belly = Math.sin(Math.min(1, s * 1.9 + 0.34) * Math.PI / 2);
    const k = Math.max(0.015, belly * Math.pow(1 - s, 0.78));
    return [wid * sc * k, wid * sc * k * 0.42];
  };
  const out = V.norm(V.sub(base, headC));
  let side = V.cross(rest[0], out);
  if (V.len(side) < 0.05) side = M3.col(R, 0);
  mb.tube(pts, radius, 8, side, { mat, ol: lineW, uOff: seed * 1.7, olT: s => lineW * (1 - s * s * 0.75) });
}

// [base xyz, dir xyz, length, width, curl xyz, flex, seed]
const IRO_HAIR = [
  // fringe
  [-0.030, 0.104, 0.062, -0.35, -0.20, 0.65, 0.135, 0.030, -0.10, -0.55, -0.10, 0.10, 1],
  [0.002, 0.112, 0.062, -0.05, -0.12, 0.70, 0.150, 0.033, -0.30, -0.62, -0.15, 0.10, 2],
  [0.034, 0.104, 0.060, 0.45, -0.22, 0.62, 0.130, 0.028, 0.15, -0.55, -0.12, 0.10, 3],
  [-0.064, 0.086, 0.045, -0.75, -0.40, 0.30, 0.140, 0.027, 0.00, -0.55, -0.05, 0.12, 4],
  [0.066, 0.084, 0.044, 0.75, -0.42, 0.30, 0.125, 0.026, 0.05, -0.52, -0.05, 0.12, 5],
  // side locks
  [-0.092, 0.030, 0.024, -0.28, -0.90, 0.18, 0.27, 0.024, 0.10, -0.20, -0.10, 0.34, 6],
  [0.092, 0.030, 0.024, 0.28, -0.90, 0.18, 0.25, 0.024, -0.10, -0.20, -0.10, 0.34, 7],
  // crown flare
  [-0.020, 0.122, 0.010, -0.18, 0.80, -0.30, 0.27, 0.052, -0.05, -0.20, -0.62, 0.30, 8],
  [0.040, 0.116, -0.004, 0.40, 0.68, -0.40, 0.24, 0.048, 0.10, -0.30, -0.55, 0.30, 9],
  [-0.062, 0.100, -0.020, -0.60, 0.55, -0.45, 0.26, 0.050, -0.05, -0.30, -0.55, 0.34, 10],
  // the mane (two broad core clumps give it mass)
  [0.000, 0.030, -0.045, 0.00, 0.14, -0.99, 0.52, 0.150, 0.00, -0.34, -0.05, 0.50, 20],
  [0.000, 0.065, -0.040, 0.00, 0.46, -0.89, 0.50, 0.136, 0.00, -0.34, -0.15, 0.46, 21],
  [0.000, 0.100, -0.070, 0.00, 0.48, -0.80, 0.78, 0.100, 0.00, -0.34, -0.20, 0.50, 11],
  [-0.050, 0.070, -0.082, -0.30, 0.24, -0.88, 0.66, 0.088, -0.06, -0.30, -0.10, 0.52, 12],
  [0.052, 0.072, -0.082, 0.30, 0.28, -0.88, 0.62, 0.084, 0.06, -0.34, -0.10, 0.52, 13],
  [0.000, 0.040, -0.098, 0.00, -0.08, -0.95, 0.70, 0.096, 0.00, -0.42, 0.00, 0.55, 14],
  [-0.070, 0.020, -0.070, -0.50, -0.20, -0.75, 0.52, 0.070, -0.05, -0.40, -0.05, 0.55, 15],
  [0.072, 0.018, -0.070, 0.50, -0.22, -0.75, 0.48, 0.068, 0.05, -0.40, -0.05, 0.55, 16],
  [-0.030, -0.025, -0.086, -0.20, -0.58, -0.70, 0.46, 0.068, 0.00, -0.30, 0.05, 0.55, 17],
  [0.034, -0.028, -0.086, 0.22, -0.60, -0.70, 0.42, 0.064, 0.00, -0.30, 0.05, 0.55, 18],
  [0.018, 0.112, -0.050, 0.10, 0.82, -0.50, 0.50, 0.070, 0.00, -0.46, -0.45, 0.44, 19],
];
const SUMI_FRINGE = [
  [-0.026, 0.110, 0.064, -0.55, -0.35, 0.50, 0.095, 0.020, -0.05, -0.55, -0.10, 0.08, 31],
  [0.012, 0.116, 0.058, -0.20, -0.20, 0.65, 0.120, 0.019, -0.40, -0.60, -0.15, 0.10, 32],
  [-0.080, 0.050, 0.028, -0.40, -0.85, 0.10, 0.15, 0.016, 0.05, -0.15, -0.10, 0.20, 33],
];

// ---------- IRO ----------
function buildIro(mb, rig, env) {
  const J = rig.J, B = rig.B, P = rig.pose;
  const t = env.time, drag = env.drag;
  const M = {
    skin: 0, hair: 1, jacket: 4, gold: 5, top: 6, pants: 7, wrap: 8, boot: 9, sashM: 10, sashY: 11, belt: 23,
  };
  // torso
  const spine = s => {
    if (s < 0.4) return V.lerp(J.pelvis, J.mid, s / 0.4);
    if (s < 0.78) return V.lerp(J.mid, J.chest, (s - 0.4) / 0.38);
    return V.lerp(J.chest, J.neck, (s - 0.78) / 0.22);
  };
  const torsoSpec = [ // s, halfW, halfD, zOff
    [-0.20, 0.050, 0.045, -0.005], [-0.10, 0.112, 0.082, -0.008], [0.04, 0.130, 0.092, -0.012], [0.18, 0.112, 0.082, -0.004],
    [0.34, 0.088, 0.068, 0.004], [0.48, 0.098, 0.074, 0.008], [0.62, 0.122, 0.092, 0.016], [0.74, 0.135, 0.098, 0.014],
    [0.86, 0.146, 0.082, 0.0], [0.95, 0.095, 0.060, -0.006], [1.02, 0.040, 0.040, 0.0]];
  const ringAt = (s, w, d, zo, grow = 0) => {
    const Rm = rig.spineAt(clamp(s * 1.15));
    const c = V.add(spine(s), M3.v(Rm, [0, 0, zo]));
    if (s < 0) c.splice(0, 3, ...V.add(J.pelvis, M3.v(rig.Rp, [0, s * 0.55, zo])));
    return { c, U: V.mul(M3.col(Rm, 0), w + grow), V: V.mul(M3.col(Rm, 2), d + grow), t: clamp((s + 0.2) / 1.22) };
  };
  const tr = torsoSpec.map(a => ringAt(a[0], a[1], a[2], a[3]));
  mb.loft(tr, 20, {
    e: 0.82, ol: 1,
    matF: (u, tt) => { const s = tt * 1.22 - 0.2; if (s < 0.14) return M.pants; if (s < 0.21) return M.belt; if (s < 0.50) return M.skin; if (s < 0.90) return M.top; return M.skin; },
    biasF: (u, tt) => { const s = tt * 1.22 - 0.2; return (s > 0.40 && s < 0.50) ? -0.35 : 0; },
  });
  // cropped open jacket: two side panels plus back, collar flaring
  {
    const spec = [[0.56, 0.130, 0.102, 0.014], [0.68, 0.145, 0.112, 0.016], [0.80, 0.162, 0.104, 0.008], [0.89, 0.172, 0.092, -0.004], [0.97, 0.100, 0.072, -0.012], [1.05, 0.070, 0.064, -0.018]];
    const rings = spec.map(a => ringAt(a[0], a[1], a[2], a[3]));
    rings.forEach((r, i) => r.t = i / (spec.length - 1));
    rings[0].t = 1; rings[1].t = 0.8; rings[2].t = 0.6; rings[3].t = 0.4; rings[4].t = 0.2; rings[5].t = 0;
    // open at the front: leave a V-shaped gap around u = 0.25 (+Z)
    const Mseg = 26, a0 = 0.25 * TAU + 0.52, a1 = 0.25 * TAU + TAU - 0.52;
    const rows = rings.map((r, i) => {
      const gap = [0.62, 0.52, 0.46, 0.38, 0.58, 0.66][i];
      const lo = 0.25 * TAU + gap, hi = 0.25 * TAU + TAU - gap;
      const row = [];
      for (let j = 0; j <= Mseg; j++) {
        const a = lo + (hi - lo) * j / Mseg;
        const cc = Math.cos(a), ss = Math.sin(a);
        const cx = Math.sign(cc) * Math.pow(Math.abs(cc), 0.82), sy = Math.sign(ss) * Math.pow(Math.abs(ss), 0.82);
        row.push({ p: V.add(r.c, V.add(V.mul(r.U, cx), V.mul(r.V, sy))), n: V.norm(V.add(V.mul(V.norm(r.U), cx), V.mul(V.norm(r.V), sy))) });
      }
      return row;
    });
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < Mseg; j++) {
      const q = [rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]];
      const tv = [rings[i].t, rings[i + 1].t, rings[i + 1].t, rings[i].t];
      const mat = (j === 0 || j === Mseg - 1) ? M.gold : M.jacket;
      for (const k of [0, 1, 2, 0, 2, 3]) mb.v(q[k].p, q[k].n, mat, 0.85, 0, j / Mseg, tv[k]);
    }
  }
  // belt ring and gold buckle
  mb.loft([ringAt(0.115, 0.128, 0.093, -0.008), ringAt(0.20, 0.116, 0.088, -0.004)], 18, { mat: M.belt, e: 0.85, ol: 0.8 });
  mb.ellipsoid(V.add(spine(0.16), M3.v(rig.spineAt(0.2), [0, 0, 0.095])), rig.spineAt(0.2), [0.030, 0.026, 0.014], M.gold, { ol: 0.7, M: 8, rings: 5 });

  // legs
  for (const side of ['L', 'R']) {
    const hip = J['hip' + side], kn = J['kn' + side], an = J['an' + side];
    const sx = side === 'L' ? 1 : -1;
    const top = V.lerp(hip, J.pelvis, 0.28);
    const path = limbPath(top, kn, an, 22, 0.17);
    const side0 = M3.v(rig.Rp, [1, 0, 0]);
    const rad = [[0, 0.078], [0.10, 0.098], [0.22, 0.104], [0.36, 0.104], [0.47, 0.108], [0.54, 0.104], [0.585, 0.070], [0.60, 0.046], [0.66, 0.056], [0.74, 0.054], [0.86, 0.036], [0.95, 0.031], [1.0, 0.033]];
    mb.tube(path, s => { const r = prof(rad, s); return [r, r * (s < 0.55 ? 0.92 : 1.0)]; }, 16, side0, {
      ol: 1, matF: (u, s) => s < 0.575 ? M.pants : (s < 0.595 ? M.gold : (s < 0.93 ? M.wrap : M.skin)),
      biasF: (u, s) => (s > 0.54 && s < 0.575) ? -0.5 : 0,
    });
    // gold anklet: the part of her that lights up when she kicks
    const ad = V.norm(V.sub(an, kn));
    mb.tube([V.mad(an, ad, -0.085), V.mad(an, ad, -0.05), V.mad(an, ad, -0.018)], s => 0.047 + Math.sin(s * Math.PI) * 0.008, 14, side0, { mat: M.gold, ol: 0.9 });
    buildFoot(mb, an, rig, side, B, P['fs' + side], [M.boot, M.gold], 1, 1.04);
  }

  // arms
  for (const side of ['L', 'R']) {
    const sh = J['sh' + side], el = J['el' + side], wr = J['wr' + side], clav = J['clav' + side];
    mb.tube([clav, V.lerp(clav, sh, 0.55), sh], s => 0.05 - 0.004 * s, 12, [0, 1, 0], { mat: M.jacket, ol: 0.8 });
    mb.ellipsoid(sh, rig.Rc, [0.062, 0.058, 0.060], M.jacket, { ol: 0.9, M: 12, rings: 7 });
    const path = limbPath(V.lerp(sh, el, 0.02), el, wr, 20, 0.16);
    const rad = [[0, 0.046], [0.10, 0.047], [0.22, 0.043], [0.40, 0.033], [0.50, 0.031], [0.60, 0.041], [0.74, 0.036], [0.90, 0.026], [1.0, 0.025]];
    mb.tube(path, s => prof(rad, s), 12, M3.v(rig.Rc, [0, 0, 1]), { ol: 1, matF: (u, s) => s < 0.56 ? M.skin : M.wrap });
    const fd = V.norm(V.sub(wr, el));
    mb.tube([V.mad(wr, fd, -0.115), V.mad(wr, fd, -0.065), V.mad(wr, fd, -0.012)], s => 0.039 + Math.sin(s * Math.PI * 0.9) * 0.008, 12, M3.v(rig.Rc, [0, 0, 1]), { mat: M.gold, ol: 0.85 });
    const big = P['hs' + side];
    buildHand(mb, wr, el, side, rig, P['grip' + side], big, P['grip' + side] === 1 ? M.wrap : M.skin, 0.062, 0.9);
  }

  // neck + head
  mb.tube([V.lerp(J.chest, J.neck, 0.75), J.neck, J.neckTop, V.lerp(J.neckTop, J.head, 0.4)], s => 0.040 - 0.004 * Math.sin(s * 3.14), 12, M3.col(rig.Rc, 0), { mat: M.skin, ol: 0.8, bias: -0.35 });
  const hc = J.head, R = rig.Rh, sc = B.headScale;
  headLoft(mb, hc, R, IRO_HEAD, M.skin, sc);
  for (const sx of [1, -1]) mb.ellipsoid(V.add(hc, M3.v(R, [sx * 0.104, -0.022, -0.012])), R, [0.012, 0.028, 0.019], M.skin, { ol: 0.7, M: 8, rings: 5 });
  iroFace(mb, hc, R, sc, P.eyes, P.mouth);
  // scalp cap: rows from crown to a hairline that dips lower toward the back
  {
    const Mseg = 28, rows = [];
    const lower = a => { const f = Math.cos(a); return f > 0.55 ? 0.068 : (f > 0.0 ? lerp(-0.01, 0.068, f / 0.55) : lerp(-0.01, -0.082, clamp(-f * 1.4))); };
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const row = [];
      for (let j = 0; j <= Mseg; j++) {
        const a = j / Mseg * TAU;
        const y = lerp(0.1315, lower(a), i / N);
        const wx = prof(IRO_HEAD.map(p => [p[0], p[1]]), y) + 0.011, zf = prof(IRO_HEAD.map(p => [p[0], p[2]]), y) + 0.010, zb = prof(IRO_HEAD.map(p => [p[0], p[3]]), y) + 0.014;
        const s = Math.sin(a), c = Math.cos(a);
        const lx = wx * Math.sign(s) * Math.pow(Math.abs(s), 0.88), lz = (c >= 0 ? zf : zb) * Math.sign(c) * Math.pow(Math.abs(c), 0.88);
        const yy = y + (i === 0 ? 0.009 : 0.003);
        row.push({ p: V.add(hc, M3.v(R, [lx * sc, yy * sc, lz * sc])), n: M3.v(R, V.norm([lx, (y - 0.02) * 0.9, lz])) });
      }
      rows.push(row);
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < Mseg; j++) {
      const q = [rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]];
      const tv = [i / N * 0.3, (i + 1) / N * 0.3, (i + 1) / N * 0.3, i / N * 0.3];
      for (const k of [0, 1, 2, 0, 2, 3]) mb.v(q[k].p, q[k].n, M.hair, 0.8, 0, (j + (k >= 2 && k !== 3 ? 1 : 0)) / Mseg, tv[k]);
    }
  }
  const headDrag = drag.hair;
  for (const spec of IRO_HAIR) {
    const sp = spec.slice();
    if (sp[12] >= 8 && sp[12] <= 19) sp[7] *= 1.22;
    hairClump(mb, hc, R, sc * 1.02, sp, headDrag, t, M.hair, 0.95);
  }
  // hair tie
  mb.ellipsoid(V.add(hc, M3.v(R, [0, 0.075, -0.115])), R, [0.045, 0.045, 0.040], M.jacket, { ol: 0.8, M: 10, rings: 6 });

  // the two sash tails
  for (const [sx, mat, len, seed] of [[0.07, M.sashM, 1.15, 0.31], [-0.07, M.sashY, 0.98, 0.77]]) {
    const base = V.add(spine(0.14), M3.v(rig.spineAt(0.2), [sx, 0, -0.092]));
    const n = 14, rest = [];
    for (let i = 0; i < n; i++) rest.push(rig.dir(V.norm([sx * 1.6, -1.0 + i / n * 0.35, -0.55 - i / n * 0.5])));
    const pts = flowChain(base, rest, len / n, drag.cloth, 0.62, 0.17, t, seed, 0.10);
    for (const p of pts) if (p[1] < env.floor + 0.02) p[1] = env.floor + 0.02;
    mb.tube(pts, s => [(0.034 + 0.040 * Math.sin(Math.min(1, s * 1.2) * Math.PI * 0.62)) * (s > 0.86 ? Math.max(0.08, (1 - s) / 0.14) : 1), 0.006], 8,
      rig.dir(V.norm([0.45, 0.2, 0.87])), { mat, ol: 0.75, twist: s => Math.sin(s * 5.2 - t * 9.0 + seed * 9) * 0.75 + (sx > 0 ? 0.35 : -0.35) });
  }
}

// ---------- SUMI ----------
function buildSumi(mb, rig, env) {
  const J = rig.J, B = rig.B, P = rig.pose;
  const t = env.time, drag = env.drag;
  const M = { skin: 0, hair: 1, vest: 2, trim: 3, hakama: 4, rope: 5, arm: 6, mantle: 8, boot: 9 };
  const spine = s => {
    if (s < 0) return V.add(J.pelvis, M3.v(rig.Rp, [0, s * 0.62, 0]));
    if (s < 0.36) return V.lerp(J.pelvis, J.mid, s / 0.36);
    if (s < 0.76) return V.lerp(J.mid, J.chest, (s - 0.36) / 0.40);
    return V.lerp(J.chest, J.neck, (s - 0.76) / 0.24);
  };
  const ringAt = (s, w, d, zo, grow = 0) => {
    const Rm = rig.spineAt(clamp(s * 1.15));
    return { c: V.add(spine(s), M3.v(Rm, [0, 0, zo])), U: V.mul(M3.col(Rm, 0), w + grow), V: V.mul(M3.col(Rm, 2), d + grow), t: clamp((s + 0.2) / 1.22) };
  };
  const spec = [[-0.22, 0.075, 0.075, 0], [-0.08, 0.175, 0.135, -0.01], [0.08, 0.200, 0.142, -0.01], [0.26, 0.192, 0.138, 0.0],
    [0.40, 0.205, 0.145, 0.008], [0.54, 0.250, 0.170, 0.018], [0.68, 0.315, 0.205, 0.030], [0.78, 0.345, 0.200, 0.022],
    [0.87, 0.345, 0.165, -0.004], [0.95, 0.215, 0.125, -0.016], [1.04, 0.085, 0.090, 0.0]];
  mb.loft(spec.map(a => ringAt(a[0], a[1], a[2], a[3])), 22, {
    e: 0.80, ol: 1,
    matF: (u, tt) => (tt * 1.22 - 0.2 < 0.2 ? M.hakama : 16),
    biasF: (u, tt) => { const s = tt * 1.22 - 0.2; return (s > 0.58 && s < 0.66) ? -0.3 : 0; },
  });
  // pectoral slab so the chest reads as mass
  for (const sx of [1, -1]) mb.ellipsoid(V.add(spine(0.72), M3.v(rig.spineAt(0.85), [sx * 0.155, -0.035, 0.115])), rig.spineAt(0.85), [0.125, 0.085, 0.080], M.vest, { ol: 0, M: 12, rings: 7 });
  // standing collar that hides the throat
  {
    const Rm = rig.Rc;
    const rings = [[-0.035, 0.150, 0.130], [0.030, 0.115, 0.112], [0.095, 0.112, 0.108]].map(([y, a, b], i) => ({
      c: V.add(J.neck, M3.v(Rm, [0, y, -0.012])), U: V.mul(M3.col(Rm, 0), a), V: V.mul(M3.col(Rm, 2), b), t: i / 2,
    }));
    mb.loft(rings, 20, { e: 0.85, ol: 0.9, cap: false, matF: (u, tt) => tt > 0.82 ? M.trim : M.vest });
  }
  // rope belt, two twisted strands and hanging ends
  for (const [s, gr] of [[0.185, 0.026], [0.27, 0.018]]) mb.loft([ringAt(s - 0.032, 0.196, 0.140, 0, gr * 0.5), ringAt(s, 0.196, 0.140, 0, gr), ringAt(s + 0.032, 0.196, 0.140, 0, gr * 0.5)], 22, { mat: M.rope, e: 0.82, ol: 0.9 });
  {
    const knot = V.add(spine(0.22), M3.v(rig.spineAt(0.25), [0.07, 0, 0.165]));
    mb.ellipsoid(knot, rig.spineAt(0.25), [0.062, 0.055, 0.042], M.rope, { ol: 0.9, M: 10, rings: 6 });
    for (const [dx, len, seed] of [[0.18, 0.62, 0.2], [-0.04, 0.50, 0.9]]) {
      const rest = []; for (let i = 0; i < 9; i++) rest.push(rig.dir(V.norm([dx, -1, 0.14 - i * 0.03])));
      const pts = flowChain(knot, rest, len / 9, drag.cloth, 0.40, 0.10, t, seed, 0.35);
      for (const p of pts) if (p[1] < env.floor + 0.03) p[1] = env.floor + 0.03;
      mb.tube(pts, s => s > 0.86 ? 0.040 - (s - 0.86) * 0.1 : 0.021, 8, [1, 0, 0], { mat: M.rope, ol: 0.8 });
    }
  }

  // hakama: each leg is a wide, flaring tube of heavy cloth
  for (const side of ['L', 'R']) {
    const hip = J['hip' + side], kn = J['kn' + side], an = J['an' + side];
    const sx = side === 'L' ? 1 : -1;
    const top = V.lerp(hip, J.pelvis, 0.35);
    const hem = V.lerp(an, kn, 0.10);
    const sway = V.mul(drag.cloth, 0.035);
    const path = limbPath(top, V.add(kn, V.mul(sway, 0.4)), V.add(hem, sway), 20, 0.30);
    const rad = [[0, 0.130], [0.12, 0.165], [0.30, 0.170], [0.50, 0.165], [0.68, 0.190], [0.86, 0.225], [1.0, 0.252]];
    mb.tube(path, s => { const r = prof(rad, s); return [r, r * 0.80]; }, 18, M3.v(rig.Rp, [1, 0, 0]), { mat: M.hakama, ol: 1, e: 0.85, uOff: sx * 0.03 });
    mb.tube([V.lerp(an, kn, 0.28), an], s => 0.092 - 0.026 * s, 12, M3.v(rig.Rp, [1, 0, 0]), { mat: M.boot, ol: 0.9 });
    buildFoot(mb, an, rig, side, B, P['fs' + side], [M.boot, M.rope], 1, 1.52);
  }

  // arms: heavy, ink-dipped from below the elbow
  for (const side of ['L', 'R']) {
    const sh = J['sh' + side], el = J['el' + side], wr = J['wr' + side], clav = J['clav' + side];
    mb.tube([clav, V.lerp(clav, sh, 0.6), sh], s => 0.105 - 0.008 * s, 14, [0, 1, 0], { mat: M.vest, ol: 0.9 });
    mb.ellipsoid(sh, rig.Rc, [0.140, 0.128, 0.128], M.skin, { ol: 1, M: 16, rings: 9 });
    const up = limbPath(sh, el, wr, 22, 0.15);
    const rad = [[0, 0.100], [0.12, 0.112], [0.26, 0.103], [0.42, 0.072], [0.50, 0.068], [0.62, 0.096], [0.76, 0.094], [0.90, 0.068], [1.0, 0.056]];
    mb.tube(up, s => prof(rad, s), 16, M3.v(rig.Rc, [0, 0, 1]), {
      ol: 1, matF: (u, s) => s < 0.40 ? M.skin : M.arm,
      vT: s => clamp((s - 0.40) / 0.60),
    });
    const fd = V.norm(V.sub(wr, el));
    mb.tube([V.mad(wr, fd, -0.10), V.mad(wr, fd, -0.055), V.mad(wr, fd, -0.015)], s => 0.071 + Math.sin(s * Math.PI) * 0.008, 14, M3.v(rig.Rc, [0, 0, 1]), { mat: M.rope, ol: 0.8 });
    buildHand(mb, wr, el, side, rig, P['grip' + side], P['hs' + side], 9, 0.128, 1);
  }

  // thick neck + head
  mb.tube([V.lerp(J.chest, J.neck, 0.7), J.neck, J.neckTop, V.lerp(J.neckTop, J.head, 0.35)], s => 0.074 - 0.012 * s, 14, M3.col(rig.Rc, 0), { mat: M.skin, ol: 0.8, bias: -0.3 });
  const hc = J.head, R = rig.Rh, sc = B.headScale;
  headLoft(mb, hc, R, SUMI_HEAD, M.skin, sc);
  for (const sx of [1, -1]) mb.ellipsoid(V.add(hc, M3.v(R, [sx * 0.106, -0.018, -0.012])), R, [0.013, 0.032, 0.021], M.skin, { ol: 0.7, M: 8, rings: 5 });
  sumiFace(mb, hc, R, sc, P.eyes, P.mouth);
  {
    const Mseg = 26, N = 8, rows = [];
    const lower = a => { const f = Math.cos(a); return f > 0.5 ? 0.078 : (f > -0.1 ? lerp(0.012, 0.078, (f + 0.1) / 0.6) : lerp(0.012, -0.062, clamp(-(f + 0.1) * 1.4))); };
    for (let i = 0; i <= N; i++) {
      const row = [];
      for (let j = 0; j <= Mseg; j++) {
        const a = j / Mseg * TAU, y = lerp(0.1355, lower(a), i / N);
        const wx = prof(SUMI_HEAD.map(p => [p[0], p[1]]), y) + 0.007, zf = prof(SUMI_HEAD.map(p => [p[0], p[2]]), y) + 0.007, zb = prof(SUMI_HEAD.map(p => [p[0], p[3]]), y) + 0.009;
        const s = Math.sin(a), c = Math.cos(a);
        const lx = wx * Math.sign(s) * Math.pow(Math.abs(s), 0.88), lz = (c >= 0 ? zf : zb) * Math.sign(c) * Math.pow(Math.abs(c), 0.88);
        const yy = y + (i === 0 ? 0.006 : 0.002);
        row.push({ p: V.add(hc, M3.v(R, [lx * sc, yy * sc, lz * sc])), n: M3.v(R, V.norm([lx, (y - 0.02) * 0.9, lz])) });
      }
      rows.push(row);
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < Mseg; j++) {
      const q = [rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]];
      for (const k of [0, 1, 2, 0, 2, 3]) mb.v(q[k].p, q[k].n, M.hair, 0.75, 0, j / Mseg, 0.2);
    }
  }
  for (const s of SUMI_FRINGE) hairClump(mb, hc, R, sc, s, drag.hair, t, M.hair, 0.8);
  // the brush: a topknot shaped like a loaded calligraphy brush
  {
    const base = V.add(hc, M3.v(R, [0, 0.150 * sc, -0.045 * sc]));
    const n = 16, len = 0.98, rest = [];
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) / n;
      rest.push(M3.v(R, V.norm([0.0, 1.0 - s * 2.5, -0.42 - Math.sin(s * 3.14) * 0.75])));
    }
    const pts = flowChain(base, rest, len / n, drag.hair, 0.40, 0.075, t, 0.42, 0.05);
    const rad = [[0, 0.036], [0.08, 0.050], [0.22, 0.092], [0.40, 0.106], [0.58, 0.086], [0.76, 0.050], [0.90, 0.022], [1.0, 0.002]];
    mb.tube(pts, s => { const r = prof(rad, s); return [r, r * 0.82]; }, 14, M3.col(R, 0), { mat: M.hair, ol: 1 });
    // split bristles at the tip and along the belly
    for (const [at, off, l, sd] of [[9, 0.062, 0.40, 1.3], [10, -0.055, 0.34, 2.9], [12, 0.030, 0.30, 4.1], [7, -0.070, 0.30, 5.3]]) {
      const b0 = V.add(pts[at], M3.v(R, [off, 0.0, 0.0]));
      const dr = V.norm(V.sub(pts[at + 2], pts[at - 1]));
      const rs = []; for (let i = 0; i < 6; i++) rs.push(V.norm(V.add(dr, M3.v(R, [off * 2.5, -i * 0.04, 0]))));
      const bp = flowChain(b0, rs, l / 6, drag.hair, 0.55, 0.12, t, sd);
      mb.tube(bp, s => [0.026 * (1 - s) + 0.001, 0.012 * (1 - s) + 0.001], 7, M3.col(R, 0), { mat: M.hair, ol: 0.7 });
    }
    // cord binding it
    const d0 = V.norm(V.sub(pts[1], pts[0]));
    mb.tube([V.mad(pts[0], d0, -0.03), V.mad(pts[0], d0, 0.015), V.mad(pts[0], d0, 0.065)], s => 0.052 + Math.sin(s * 3.14) * 0.008, 14, M3.col(R, 0), { mat: M.rope, ol: 0.9 });
  }

  // half mantle: one sheet of pale cloth from the far shoulder, ragged at the hem
  {
    const sh = J.shR;
    mb.ellipsoid(V.add(sh, M3.v(rig.Rc, [-0.040, 0.080, -0.015])), M3.mul(rig.Rc, M3.rz(0.50)), [0.180, 0.078, 0.172], M.mantle, { ol: 1, M: 16, rings: 8 });
    // anchor line: from in front of the shoulder, over its outer edge, across to the middle of the back
    const anchors = [[0.00, 0.06, 0.15], [-0.14, 0.05, 0.09], [-0.19, 0.04, -0.03], [-0.12, 0.05, -0.15], [0.04, 0.04, -0.19], [0.19, 0.02, -0.20], [0.30, 0.00, -0.19]];
    const lens = [0.66, 0.92, 1.18, 1.34, 1.16, 1.28, 0.96];
    const n = 10, cols = [];
    anchors.forEach((an, k) => {
      const base = V.add(sh, M3.v(rig.Rc, an));
      const rest = []; for (let i = 0; i < n; i++) rest.push(rig.dir(V.norm([-0.22 + k * 0.03, -1.0, -0.22 - i / n * 0.40 + (k < 2 ? 0.20 : 0)])));
      const pts = flowChain(base, rest, lens[k] / n, drag.cloth, 0.55, 0.075, t, 0.13 + k * 0.045, 0.22);
      for (const p of pts) if (p[1] < env.floor + 0.02) p[1] = env.floor + 0.02;
      cols.push(pts);
    });
    const K = 3, fine = [];
    for (let k = 0; k < cols.length - 1; k++) {
      for (let q = 0; q < K; q++) {
        const u = q / K;
        fine.push(cols[k].map((p, i) => {
          const m = V.lerp(p, cols[k + 1][i], u);
          const nn = V.norm(V.sub(m, V.add(sh, [0, -0.5, 0])));
          const fold = Math.sin(u * Math.PI * 2) * 0.034 * (i / n);
          const rag = (i === n && q !== 0) ? 0.075 * Math.sin(u * Math.PI) : 0;
          return V.add(V.mad(m, nn, fold), [0, rag, 0]);
        }));
      }
    }
    fine.push(cols[cols.length - 1]);
    for (let a = 0; a < fine.length - 1; a++) for (let i = 0; i < n; i++) {
      const p00 = fine[a][i], p10 = fine[a][i + 1], p11 = fine[a + 1][i + 1], p01 = fine[a + 1][i];
      let nn = V.norm(V.cross(V.sub(p10, p00), V.sub(p01, p00)));
      if (V.dot(nn, V.sub(p00, J.chest)) < 0) nn = V.neg(nn);
      const bias = (a % K === 1) ? -0.45 : 0;
      const u0 = a / (fine.length - 1), u1 = (a + 1) / (fine.length - 1), v0 = i / n, v1 = (i + 1) / n;
      mb.v(p00, nn, M.mantle, 0, bias, u0, v0); mb.v(p10, nn, M.mantle, 0, bias, u0, v1); mb.v(p11, nn, M.mantle, 0, bias, u1, v1);
      mb.v(p00, nn, M.mantle, 0, bias, u0, v0); mb.v(p11, nn, M.mantle, 0, bias, u1, v1); mb.v(p01, nn, M.mantle, 0, bias, u1, v0);
    }
    // inked edges
    const edge = pts => mb.tube(pts, () => 0.0075, 6, [1, 0, 0], { mat: M.vest, ol: 0 });
    edge(fine[0]); edge(fine[fine.length - 1]); edge(fine.map(c => c[n]));
  }
}

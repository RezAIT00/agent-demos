// ---------- THE PELICAN ----------
const PEL = {
  hipPivot: [-0.120, 1.020, 0],
  hip: [-0.125, 1.020, 0.086],
  femur: 0.190, shank: 0.372, tarsus: 0.345,
  shoulder: [0.040, 1.190, 0.132],
  upperArm: 0.340, foreArm: 0.330,
  bodySpine: [[0, -0.500, 1.108], [0.15, -0.410, 1.090], [0.35, -0.272, 1.082], [0.55, -0.120, 1.092], [0.75, 0.025, 1.130], [0.9, 0.115, 1.170], [1.0, 0.168, 1.192]],
  bodyRad: [[0, 0.006, 0.012], [0.07, 0.040, 0.052], [0.15, 0.072, 0.086], [0.35, 0.138, 0.144], [0.55, 0.167, 0.168], [0.75, 0.148, 0.148], [0.9, 0.104, 0.102], [0.97, 0.060, 0.060], [1.0, 0.012, 0.012]]
};
// neck poses: base, two controls, head centre, head pitch
const NECKS = {
  ride: { B: [0.092, 1.185, 0], C1: [0.285, 1.205, 0], C2: [0.150, 1.425, 0], H: [0.300, 1.488, 0], pitch: -0.13 },
  tuck: { B: [0.092, 1.176, 0], C1: [0.325, 1.152, 0], C2: [0.250, 1.322, 0], H: [0.432, 1.352, 0], pitch: -0.07 },
  tall: { B: [0.085, 1.200, 0], C1: [0.272, 1.298, 0], C2: [0.055, 1.472, 0], H: [0.195, 1.598, 0], pitch: -0.05 },
  proud: { B: [0.085, 1.200, 0], C1: [0.300, 1.300, 0], C2: [0.040, 1.500, 0], H: [0.200, 1.630, 0], pitch: 0.10 },
  sky: { B: [0.085, 1.200, 0], C1: [0.215, 1.370, 0], C2: [0.030, 1.480, 0], H: [0.118, 1.668, 0], pitch: 0.80 },
  slump: { B: [0.092, 1.165, 0], C1: [0.360, 1.110, 0], C2: [0.320, 1.215, 0], H: [0.455, 1.185, 0], pitch: -0.52 },
  front: { B: [0.092, 1.180, 0], C1: [0.300, 1.180, 0], C2: [0.215, 1.335, 0], H: [0.385, 1.385, 0], pitch: -0.20 }
};
function neckPose(spec) {
  if (typeof spec === 'string') return NECKS[spec];
  const a = NECKS[spec.a], b = NECKS[spec.b], k = clamp(spec.k);
  return { B: vlerp(a.B, b.B, k), C1: vlerp(a.C1, b.C1, k), C2: vlerp(a.C2, b.C2, k), H: vlerp(a.H, b.H, k), pitch: lerp(a.pitch, b.pitch, k) };
}

function headBasis(pitch, yaw = 0, roll = 0) {
  let f = [Math.cos(pitch), Math.sin(pitch), 0], u = [-Math.sin(pitch), Math.cos(pitch), 0], s = [0, 0, 1];
  if (yaw) { f = rotAxis(f, u, yaw); s = rotAxis(s, u, yaw); }
  if (roll) { u = rotAxis(u, f, roll); s = rotAxis(s, f, roll); }
  return { f, u, s };
}

// eye decal hugging the head ellipsoid
function eyeDecal(mb, Hc, hb, radii, side, k, mat, part, fwdBias, upBias) {
  const { f, u, s } = hb;
  const d = norm(comb([f, fwdBias], [u, upBias], [s, side * 0.86]));
  const tf = norm(sub(f, mul(d, dot(f, d)))), tu = norm(cross(side > 0 ? d : tf, side > 0 ? tf : d));
  const place = (a, b) => {
    const dir = norm(comb([d, 1], [tf, a * k], [tu, b * k]));
    return comb([Hc, 1], [f, dot(dir, f) * radii[0] * 1.085], [u, dot(dir, u) * radii[1] * 1.085], [s, dot(dir, s) * radii[2] * 1.095]);
  };
  mb.grid(18, 18, (x, y) => place(-1.45 + 2.9 * x, -1.12 + 2.42 * y), { mat, part, lw: 0.75, uv: (x, y) => [-1.45 + 2.9 * x, -1.12 + 2.42 * y], flip: side > 0 });
  return place(0.13, 0.0);
}

// feather row between two joints
function featherRow(mb, a, b, n, dirA, dirB, lenA, lenB, wid, mat, parts, off, flutter, t, seed, wdirHint, lw = 0.8) {
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const base = add(vlerp(a, b, k), off);
    let d = norm(vlerp(dirA, dirB, k));
    const fl = flutter * (Math.sin(t * 21 + i * 1.7 + seed) * 0.6 + Math.sin(t * 33 + i * 2.9 + seed) * 0.4);
    d = norm(add(d, [0, fl * 0.09, fl * 0.03]));
    let wd = wdirHint || norm(sub(b, a));
    mb.blade(base, d, wd, lerp(lenA, lenB, k), wid, { mat, part: parts[i % parts.length], lw, bend: 0.05, cup: 0.12 });
  }
}

function buildWing(mb, out, cfg) {
  const { side, S, grip, gripAxis, sp, flap, t, wind, parts, mats, scale = 1, style } = cfg;
  const z = side;
  // gripping pose
  const Wg = add(grip, [-0.058, 0.034, z * 0.012]);
  const Eg = ik2(S, Wg, PEL.upperArm * scale, PEL.foreArm * scale, norm([-0.22, -0.62, z * 0.78]));
  // spread pose (flap rotates about the body's long axis)
  const fa = (flap || 0) * z;
  const rot = p => { const q = sub(p, S); return add(S, rotAxis(q, [1, 0, 0], -fa)); };
  const Es = rot(add(S, [-0.075 * scale, 0.215 * scale, z * 0.420 * scale]));
  const Ws = rot(add(S, [-0.015 * scale, 0.360 * scale, z * 0.900 * scale]));
  let E = vlerp(Eg, Es, sp), Wr = vlerp(Wg, Ws, sp);
  if (cfg.E) E = cfg.E; if (cfg.W) Wr = cfg.W;
  const shR = u => { const p = profile([[0, 0.030, 0.020], [0.18, 0.080, 0.050], [0.55, 0.064, 0.040], [1, 0.046, 0.029]], u); return [p[0] * scale, p[1] * scale]; };
  mb.loft(u => bez3(S, vlerp(S, E, 0.35), vlerp(S, E, 0.7), E, u), shR, { mat: mats.arm, part: parts.arm, nu: 14, nv: 14, lw: 1.0 });
  mb.loft(u => vlerp(E, Wr, u), u => [lerp(0.047, 0.026, u) * scale, lerp(0.031, 0.021, u) * scale], { mat: mats.arm, part: parts.arm, nu: 12, nv: 12, caps: true });
  mb.sphere(E, 0.043 * scale * (1 - 0.40 * sp), { mat: mats.arm, part: parts.arm });
  mb.sphere(Wr, 0.028 * scale * (1 - 0.50 * sp), { mat: mats.arm, part: parts.arm });
  const trailG = norm([-0.90, -0.40, z * 0.07]);
  const mixd = (g, s2) => norm(vlerp(g, rot(add(S, s2)).map((v, i) => v - S[i]), sp));
  const flut = (wind || 0) * (1 - sp * 0.5) + sp * 0.25;
  const offO = [0, -0.012, z * 0.020], offI = [0, -0.020, z * 0.006];
  // when the wing opens, a continuous covered edge fills the span between bone and flight feathers
  if (sp > 0.12) {
    const k = smooth(0.12, 0.65, sp), n = 22, Lp = [], Rp = [];
    const dA = mixd(trailG, [-0.40, -0.92, z * 0.05]), dB = mixd(trailG, [-0.34, -0.90, z * 0.20]), dC = mixd(trailG, [-0.30, -0.84, z * 0.44]);
    for (let i = 0; i <= n; i++) {
      const q = i / n;
      const lead = q < 0.52 ? vlerp(S, E, q / 0.52) : vlerp(E, Wr, (q - 0.52) / 0.48);
      const d = norm(q < 0.5 ? vlerp(dA, dB, q / 0.5) : vlerp(dB, dC, (q - 0.5) / 0.5));
      const w = (0.215 - 0.125 * q) * k * scale * (1 + 0.10 * Math.abs(Math.sin(q * 34)));
      Lp.push(add(lead, [0.004, 0.018 * (1 - q) * k, z * 0.012]));
      Rp.push(add(mad(lead, d, w), [-0.004, 0, z * 0.016]));
    }
    mb.ribbon(Lp, Rp, { mat: mats.cov, part: parts.arm, lw: 0.85 });
  }
  // upper-arm flight feathers (dark) then coverts (light) on top
  featherRow(mb, vlerp(S, E, 0.35), E, 4, mixd(trailG, [-0.40, -0.92, z * 0.06]), mixd(trailG, [-0.38, -0.92, z * 0.14]), lerp(0.150, 0.360, sp) * scale, lerp(0.215, 0.470, sp) * scale, lerp(0.062, 0.118, sp) * scale, mats.sec, [parts.sec, parts.sec + 1], offI, flut, t, 1 * z, norm(sub(E, S)));
  featherRow(mb, E, vlerp(E, Wr, 0.95), 5, mixd(trailG, [-0.36, -0.92, z * 0.16]), mixd(norm([-0.95, -0.30, z * 0.05]), [-0.32, -0.88, z * 0.36]), lerp(0.215, 0.480, sp) * scale, lerp(0.180, 0.500, sp) * scale, lerp(0.056, 0.108, sp) * scale, mats.sec, [parts.sec + 1, parts.sec], offI, flut, t, 4 * z, norm(sub(Wr, E)));
  featherRow(mb, vlerp(S, E, 0.18), E, 5, mixd(trailG, [-0.40, -0.90, z * 0.05]), mixd(trailG, [-0.38, -0.90, z * 0.15]), lerp(0.110, 0.200, sp) * scale, lerp(0.130, 0.245, sp) * scale, lerp(0.058, 0.095, sp) * scale, mats.cov, [parts.cov, parts.cov + 1], offO, flut * 0.5, t, 7 * z, norm(sub(E, S)), 0.65);
  featherRow(mb, E, vlerp(E, Wr, 0.9), 5, mixd(trailG, [-0.36, -0.90, z * 0.2]), mixd(trailG, [-0.30, -0.86, z * 0.38]), lerp(0.115, 0.250, sp) * scale, lerp(0.080, 0.230, sp) * scale, lerp(0.050, 0.090, sp) * scale, mats.cov, [parts.cov + 1, parts.cov], offO, flut * 0.5, t, 9 * z, norm(sub(Wr, E)), 0.65);
  // primaries: sweep back along the forearm when gripping, fan wide when spread
  const N = 8;
  const fore = norm(sub(E, Wr));
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const gd = norm(vlerp(norm(add(fore, [-0.10, -0.12, z * 0.30])), norm([-0.96, -0.26, z * (0.10 + 0.14 * k)]), 0.25 + 0.75 * k));
    const sdLocal = norm([lerp(-0.30, -0.05, k), lerp(-0.80, 0.50, k), z * lerp(0.52, 0.86, k)]);
    const sd = rotAxis(sdLocal, [1, 0, 0], -fa);
    let d = norm(vlerp(gd, sd, sp));
    const fl = flut * Math.sin(t * 24 + i * 2.1 + z * 3);
    d = norm(add(d, [0, fl * 0.08, 0]));
    const len = lerp(lerp(0.150, 0.275, Math.sin(k * PI * 0.85)), lerp(0.470, 0.790, Math.sin(PI * (0.18 + 0.72 * k))), sp) * scale;
    const wd = norm(vlerp([0.25, 1, 0], rotAxis([0.05, 0.85, -0.5 * z], [1, 0, 0], -fa), sp));
    const base = add(mad(Wr, d, -0.012), [0, 0, z * (0.014 + i * 0.002) * (1 - sp)]);
    mb.blade(base, d, wd, len, lerp(0.036, 0.098, sp) * scale, { mat: mats.prim, part: parts.prim + (i % 2), lw: 0.8, bend: 0.06 * (1 - sp), cup: 0.1 });
  }
  // fingers wrapping the bar
  const wrapK = 1 - smooth(0.04, 0.30, sp);
  if (!cfg.noFingers && wrapK > 0.01) {
    const ax = norm(gripAxis);
    const toW = sub(Wr, grip); const e1 = norm(sub(toW, mul(ax, dot(toW, ax))));
    const e2 = mul(norm(cross(ax, e1)), z > 0 ? 1 : -1);
    const e2s = dot(e2, [0, 0, z]) < 0 ? mul(e2, -1) : e2;
    for (let f = 0; f < 4; f++) {
      const off = -0.040 + f * 0.027;
      const C = mad(grip, ax, off);
      const ring = (psi, r) => comb([C, 1], [e1, Math.cos(psi) * r], [e2s, Math.sin(psi) * r]);
      const cu = cfg.curl === undefined ? 1 : cfg.curl;
      const rc = (psi, r) => ring(-0.15 + (psi + 0.15) * cu, r + (1 - cu) * 0.11 * Math.max(0, psi) / 4.35);
      const pts = [mad(Wr, ax, off * 0.45), rc(-0.15, 0.036), rc(0.85, 0.032), rc(1.75, 0.030), rc(2.65, 0.0285), rc(3.5, 0.027), rc(4.35, 0.024)];
      mb.loft(u => catmull(pts, u), u => { const r = lerp(0.0138, 0.0048, u * u) * scale * wrapK; return [r, r]; }, { mat: mats.prim, part: parts.finger + f, nu: 28, nv: 8, lw: 0.7 });
    }
  }
  out.anchors[(cfg.pre || '') + (z > 0 ? 'wristR' : 'wristL')] = M4.pt(mb.M, Wr);
  out.anchors[(cfg.pre || '') + (z > 0 ? 'wingTipR' : 'wingTipL')] = M4.pt(mb.M, add(Wr, mul(norm(vlerp([-0.9, -0.2, 0.2 * z], [-0.1, 0.4, 0.9 * z], sp)), lerp(0.2, 0.6, sp))));
}

function legSolve(hip, pf, side, L) {
  const A = comb([pf.P, 1], [pf.ex, -0.054], [pf.ey, 0.064]);
  const h = clamp((pf.P[1] - (BG.BB[1] - BG.crankL)) / (2 * BG.crankL));
  const phi = lerp(-1.17, -0.66, h);
  const K = [hip[0] + Math.cos(phi) * L.femur, hip[1] + Math.sin(phi) * L.femur, side * 0.124];
  const J = ik2(K, A, L.shank, L.tarsus, norm([-1, 0.12, side * 0.10]));
  return { H: hip, K, J, A, reach: dist(K, A) / (L.shank + L.tarsus) };
}

// webbed foot lying on a pedal frame
function buildFoot(mb, pf, side, A, parts, mats, scale = 1) {
  const L = (x, y, z) => comb([pf.P, 1], [pf.ex, x * scale], [pf.ey, y], [pf.ez, z * scale]);
  const sole = BG.pedalH + 0.0015;
  const heel = L(-0.046, sole + 0.0145, 0), ball = L(-0.018, sole + 0.0214, 0);
  mb.capsule(A, ball, 0.0205, 0.0215, { mat: mats.leg, part: parts.foot, nv: 12 });
  mb.capsule(heel, ball, 0.014, 0.021, { mat: mats.leg, part: parts.foot, nv: 10 });
  const tips = [[0.092, side * 0.066], [0.122, side * 0.022], [0.106, -side * 0.026], [0.048, -side * 0.060]];
  for (let i = 0; i < 4; i++) {
    const [tx, tz] = tips[i];
    const tip = L(tx, sole + 0.0068, tz), mid = L(tx * 0.52 - 0.012, sole + 0.0205, tz * 0.55);
    mb.tube([ball, mid, L(tx * 0.82, sole + 0.0125, tz * 0.85), tip], 0.0140, 0.0066, { mat: mats.leg, part: parts.foot, nv: 8, nu: 14, lw: 0.75 });
    mb.capsule(tip, L(tx + 0.017, sole + 0.0038, tz * 1.07), 0.0052, 0.0012, { mat: mats.claw, part: parts.claw, nv: 6, nu: 6, lw: 0.4 });
  }
  const outline = [L(-0.044, sole, side * 0.014)];
  for (let i = 0; i < 4; i++) {
    const [tx, tz] = tips[i]; outline.push(L(tx, sole + 0.0016, tz));
    if (i < 3) { const [ux, uz] = tips[i + 1]; outline.push(L((tx + ux) * 0.5 - 0.026, sole + 0.0016, (tz + uz) * 0.5)); }
  }
  outline.push(L(-0.044, sole, -side * 0.016), L(-0.050, sole, 0));
  mb.fan(L(-0.004, sole + 0.0045, 0), outline.concat([outline[0]]), pf.ey, { mat: mats.web, part: parts.web, lw: 0.8 });
}

function buildLeg(mb, out, cfg) {
  const { side, hip, pf, L, parts, mats, t, wind } = cfg;
  const S = cfg.solve || legSolve(hip, pf, side, L);
  const { H, K, J, A } = S;
  if (cfg.onPedal && window.__legStats) window.__legStats(cfg.pre || '', S.reach);
  // feathered thigh: hip -> forward knee
  mb.loft(u => bez3(add(H, [-0.02, 0.012, -side * 0.012]), vlerp(H, K, 0.3), vlerp(H, K, 0.7), K, u), u => { const p = profile([[0, 0.060, 0.050], [0.3, 0.082, 0.062], [0.75, 0.062, 0.050], [1, 0.044, 0.040]], u); return [p[0] * (cfg.fat || 1), p[1] * (cfg.fat || 1)]; }, { mat: mats.thigh, part: parts.thigh, nu: 14, nv: 14, caps: true });
  mb.sphere(K, 0.044 * (cfg.fat || 1), { mat: mats.thigh, part: parts.thigh });
  // shank: feathered half, then bare
  const mid = vlerp(K, J, 0.50);
  mb.loft(u => vlerp(K, mid, u), u => { const r = lerp(0.047, 0.028, u) * (cfg.fat || 1); return [r, r * 0.88]; }, { mat: mats.thigh, part: parts.thigh, nu: 8, nv: 12 });
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + 0.5;
    const o = [0, Math.cos(a) * 0.016, Math.sin(a) * 0.016];
    mb.blade(add(vlerp(K, mid, 0.55), o), norm(add(norm(sub(J, K)), mul(o, 6 + Math.sin(t * 19 + i) * (wind || 0) * 2))), [0, -Math.sin(a), Math.cos(a)], 0.075, 0.030, { mat: mats.thigh, part: parts.thigh, lw: 0.55, shape: 'spike' });
  }
  mb.tube([vlerp(K, J, 0.40), J], 0.0262, 0.0238, { mat: mats.leg, part: parts.leg, nv: 12 });
  mb.sphere(J, 0.0278, { mat: mats.leg, part: parts.leg });
  mb.tube([J, A], 0.0245, 0.0198, { mat: mats.leg, part: parts.leg, nv: 12, nu: 3 });
  mb.sphere(A, 0.0222, { mat: mats.leg, part: parts.leg });
  (cfg.footFn || buildFoot)(mb, pf, side, A, parts, mats, cfg.footScale || 1);
  const n = (cfg.pre || '') + (side > 0 ? 'footR' : 'footL');
  out.anchors[n] = M4.pt(mb.M, pf.P);
  out.legs[n] = { H: M4.pt(mb.M, H), K: M4.pt(mb.M, K), J: M4.pt(mb.M, J), A: M4.pt(mb.M, A), reach: S.reach };
}

// ribbon scarf tail
function scarfTail(mb, knot, o) {
  const { len, t, wind, phase, zoff, lift, part, width } = o;
  const dir = norm(vlerp([-0.30, -1.0, zoff * 0.8], [-1.0, lift, zoff], clamp(wind)));
  const Lp = [], Rp = [], N = 30;
  let side = norm(cross(dir, [0, 0, 1])); if (side[1] < 0) side = mul(side, -1);
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const w1 = Math.sin(s * 9.5 - t * 17 + phase) * 0.050 * s * (0.25 + wind) + Math.sin(s * 4.4 - t * 7.6 + phase * 2) * 0.034 * s * wind;
    const w2 = Math.sin(s * 7.4 - t * 12.2 + phase * 1.3) * 0.045 * s * (0.3 + wind);
    let p = comb([knot, 1], [dir, s * len], [side, w1], [[0, 0, 1], w2 + zoff * s * 0.18]);
    p[1] -= (1 - clamp(wind)) * 0.20 * s * s;
    if (o.floorY !== undefined && p[1] < o.floorY) p[1] = o.floorY + (p[1] - o.floorY) * 0.1;
    const tw = Math.sin(s * 5.2 - t * 9.4 + phase) * 0.75 * s + 0.25;
    const wv = norm(comb([side, Math.cos(tw)], [[0, 0, 1], Math.sin(tw)]));
    const wd = width * (0.55 + 0.75 * Math.sin(Math.min(1, s * 1.25) * PI * 0.62));
    let a = mad(p, wv, wd * 0.5), b = mad(p, wv, -wd * 0.5);
    if (i === N) { a = mad(a, dir, 0.045); b = mad(b, dir, -0.012); }
    Lp.push(a); Rp.push(b);
  }
  mb.ribbon(Lp, Rp, { mat: o.mat || MAT.scarf, part, lw: 1.0, fold: u => mul([-0.0, 0.006, 0.006], Math.sin(u * 23 - t * 14 + phase)) });
  return vlerp(Lp[N], Rp[N], 0.5);
}

/* state:
   crank, neck, head{pitch,yaw,roll,dx,dy}, beakOpen, pouch, wiggle, fishTail, wing{spread,flap,targets,free},
   body{pitch,bob}, wind, t, scarf{wind,lift,len,off}, crestRaise, legs (custom {r:{pf}, l:{pf}}), squash, fishInPouch
*/
function buildPelican(mb, out, st) {
  const t = st.t || 0, wind = st.wind === undefined ? 0.7 : st.wind;
  if (st.root) mb.push(st.root);
  const bp = (st.body && st.body.pitch) || 0, bob = (st.body && st.body.bob) || 0;
  const bodyM = M4.chain(M4.T([0, bob, 0]), M4.about(PEL.hipPivot, M4.Rz(bp)));
  const T = p => M4.pt(bodyM, p);
  mb.push(bodyM);
  const sq = st.squash || 1;
  if (sq !== 1) mb.push(M4.about([-0.12, 0.93, 0], M4.S(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq))));
  // ---- body ----
  const spine = u => catmull(PEL.bodySpine.map(q => [q[1], q[2], 0]), segU(PEL.bodySpine, u));
  function segU(pts, u) { let i = 1; while (i < pts.length - 1 && u > pts[i][0]) i++; const a = pts[i - 1][0], b = pts[i][0]; return (i - 1 + clamp((u - a) / (b - a))) / (pts.length - 1); }
  mb.loft(spine, u => profile(PEL.bodyRad, u), {
    mat: MAT.white, part: 1, nu: 46, nv: 36, lw: 1.25,
    shape: (u, a) => { const ruff = Math.max(0, -Math.cos(a)) * smooth(0.12, 0.42, u) * (1 - smooth(0.55, 0.7, u)); return 1 + ruff * 0.035 * Math.pow(Math.abs(Math.sin(a * 7 + u * 26)), 0.6); },
    ao: (u, v) => -0.10 * Math.pow(Math.max(0, -Math.cos(v * TAU)), 2)
  });
  // tail fan
  for (let i = 0; i < 6; i++) {
    const k = i / 5 - 0.5;
    const d = norm([-1, 0.34 - Math.abs(k) * 0.28 + Math.sin(t * 15 + i * 1.3) * 0.045 * wind + (i % 2) * 0.09, k * 0.95]);
    mb.blade([-0.455, 1.108, k * 0.040], d, [0, 0.55, 0.85], 0.170 - Math.abs(k) * 0.045, 0.062, { mat: MAT.plume, part: 44 + i, lw: 0.9, bend: 0.1 });
  }
  // flank feather tips: layered white scallops break up the body mass
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const bx = -0.255 - i * 0.052, by = 1.052 + i * 0.012;
    mb.blade([bx + 0.045, by, s * (0.138 - i * 0.021)], norm([-1, -0.10 + i * 0.07 + Math.sin(t * 17 + i * 2) * 0.03 * wind, s * 0.02]), [0.1, 1, 0], 0.135, 0.048, { mat: MAT.plume, part: 44 + ((i + 2) % 6), lw: 0.55 });
  }
  // ---- neck ----
  const N = neckPose(st.neck || 'ride');
  const hd = st.head || {};
  const Hc = add(N.H, [hd.dx || 0, hd.dy || 0, hd.dz || 0]);
  const pitch = N.pitch + (hd.pitch || 0);
  const hb = headBasis(pitch, hd.yaw || 0, hd.roll || 0);
  const neckPt = u => bez3(N.B, N.C1, add(N.C2, [(hd.dx || 0) * 0.5, (hd.dy || 0) * 0.5, (hd.dz || 0) * 0.4]), Hc, u);
  const neckR0 = u => profile([[0, 0.104, 0.094], [0.18, 0.078, 0.073], [0.45, 0.058, 0.054], [0.80, 0.054, 0.050], [1, 0.064, 0.056]], u);
  // a swallow travels down the neck as a bulge (gulp: 0 at the head, 1 at the body)
  const neckR = u => { const r = neckR0(u); if (st.gulp > 0 && st.gulp < 1) { const b = 1 + 0.75 * Math.exp(-Math.pow((u - (0.92 - 0.85 * st.gulp)) / 0.075, 2)); return [r[0] * b, r[1] * b]; } return r; };
  mb.loft(neckPt, neckR, { mat: MAT.plume, part: 1, nu: 36, nv: 24, lw: 1.15, up: [-1, 0.2, 0] });
  // ---- head ----
  const HR = [0.100, 0.084, 0.071];
  mb.ellipsoid(Hc, mul(hb.f, HR[0]), mul(hb.u, HR[1]), mul(hb.s, HR[2]), { mat: MAT.plume, part: 1, nu: 24, nv: 30, lw: 1.1 });
  const hp = (a, b, c = 0) => comb([Hc, 1], [hb.f, a], [hb.u, b], [hb.s, c]);
  const dirH = (a, b, c = 0) => norm(comb([hb.f, a], [hb.u, b], [hb.s, c]));
  // crest: the anime hair
  const raise = st.crestRaise || 0;
  const crest = [[-0.020, 0.071, 0.000, -1, 0.46, 0.00, 0.235, 0.046], [-0.050, 0.052, 0.026, -1, 0.22, 0.20, 0.260, 0.040], [-0.050, 0.052, -0.026, -1, 0.22, -0.20, 0.260, 0.040], [-0.072, 0.022, 0.032, -1, -0.02, 0.22, 0.190, 0.038], [-0.072, 0.022, -0.032, -1, -0.02, -0.22, 0.190, 0.038], [0.012, 0.074, 0.014, -0.82, 0.66, 0.08, 0.165, 0.036], [0.030, 0.070, -0.016, -0.80, 0.60, -0.10, 0.120, 0.030], [-0.076, -0.012, 0.000, -1, -0.22, 0.00, 0.150, 0.034]];
  crest.forEach((c, i) => {
    const fl = Math.sin(t * 23 + i * 1.9) * 0.10 * wind + Math.sin(t * 9.5 + i) * 0.05 * wind;
    const droop = (1 - clamp(wind)) * 0.42;
    const d = dirH(c[3], c[4] + fl - droop + raise * 0.55, c[5]);
    mb.blade(hp(c[0], c[1], c[2]), d, hb.u, c[6] * (1 + raise * 0.22), c[7], { mat: MAT.crest, part: 2 + (i % 7), lw: 0.95, bend: 0.12 * (1 - raise), shape: 'spike' });
  });
  // ---- bill ----
  const BL = 0.475 * (st.beakLen || 1);
  const open = st.beakOpen || 0;
  const upF = rotAxis(hb.f, hb.s, open * 0.26), upU = rotAxis(hb.u, hb.s, open * 0.26);
  const bBase = hp(0.064, -0.004);
  const culmen = s => comb([bBase, 1], [upF, s * BL], [upU, -0.014 * s - 0.006 * s * s - 0.036 * smooth(0.90, 1, s)]);
  const upRad = s => profile([[0, 0.043, 0.050], [0.07, 0.036, 0.041], [0.2, 0.0245, 0.0315], [0.5, 0.0175, 0.0245], [0.84, 0.0135, 0.0215], [0.915, 0.0170, 0.0232], [0.965, 0.0140, 0.0175], [1, 0.0018, 0.0022]], s);
  mb.loft(culmen, upRad, { mat: MAT.beak, part: 30, nu: 52, nv: 24, up: upU, lw: 1.1, uv: (u, v) => [u, v <= 0.5 ? v * 2 : v * 2 - 2], caps: true });
  // lower jaw hinge under the eye
  const gape = hp(0.030, -0.040);
  const lf = rotAxis(hb.f, hb.s, -open), lu = rotAxis(hb.u, hb.s, -open);
  const closedBase = hp(0.064, -0.030);
  const rel = sub(closedBase, gape);
  const lBase = add(gape, rotAxis(rel, hb.s, -open));
  const rimC = s => comb([lBase, 1], [lf, s * BL * 0.945], [lu, -0.010 * s - 0.006 * s * s - 0.016 * smooth(0.90, 1, s)]);
  const fill = clamp(st.pouch || 0, 0, 1.4);
  const bumpAt = s => profile([[-0.16, 0.20], [-0.06, 0.58], [0.05, 0.86], [0.20, 1.0], [0.42, 0.84], [0.66, 0.48], [0.86, 0.20], [0.97, 0.02]], s)[0];
  const rimW = s => Math.max(0.006, upRad(clamp(s, 0, 1))[1] * 0.90) * (s < 0 ? 1.0 + s * 1.2 : 1);
  for (const sd of [-1, 1]) mb.loft(u => mad(rimC(u * 0.985), hb.s, sd * rimW(u * 0.985) * (1 + fill * 0.45 * bumpAt(u))), u => { const r = lerp(0.0100, 0.0042, u); return [r, r * 0.85]; }, { mat: MAT.beak, part: 31, nu: 30, nv: 8, lw: 0.8, uv: (u, v) => [u * 0.88, 0.8], up: lu });
  const wig = st.wiggle || 0;
  const pouchPt = (s, a, depthK) => { // s along bill, a in [-1,1] across
    const bmp = bumpAt(s);
    let depth = (0.094 + fill * 0.132) * bmp * depthK + 0.003;
    let wdt = rimW(s) * (1 + fill * 1.05 * bmp);
    const ph = a * PI / 2;
    let bulge = 1;
    if (wig > 0) { for (let j = 0; j < 2; j++) { const sc = 0.22 + 0.26 * j + 0.09 * Math.sin(t * (13 + j * 4) + j * 3); const ac = 0.55 * Math.sin(t * (17 - j * 3) + j); const g = Math.exp(-Math.pow((s - sc) / 0.075, 2) - Math.pow((a - ac) / 0.55, 2)); bulge += g * wig * 0.55; } }
    if (st.lumps) { for (const lp of st.lumps) { const g = Math.exp(-Math.pow((s - lp[0]) / 0.07, 2) - Math.pow((a - lp[1]) / 0.38, 2)); bulge += g * lp[2]; } }
    const sag = Math.sin(t * 11 + s * 7) * 0.004 * wind * bmp;
    const c = s < 0 ? mad(gape, lf, s * BL * 0.62) : rimC(s * 0.985);
    const cc = s < 0.1 ? vlerp(mad(mad(gape, lf, s * BL * 0.62), lu, -0.004), rimC(Math.max(0, s) * 0.985), clamp((s + 0.16) / 0.26)) : c;
    return comb([cc, 1], [hb.s, Math.sin(ph) * wdt * bulge], [lu, -Math.cos(ph) * depth * bulge + sag * Math.cos(ph)]);
  };
  mb.grid(40, 18, (u, v) => pouchPt(-0.16 + u * 1.12, v * 2 - 1, 1), { mat: MAT.pouch, part: 32, lw: 0.95, uv: (u, v) => [-0.16 + u * 1.12, v * 2 - 1], flip: true });
  if (open > 0.06) {
    mb.grid(24, 8, (u, v) => { const s = 0.02 + u * 0.9, a = v * 2 - 1; return comb([rimC(s * 0.985), 1], [hb.s, a * rimW(s) * 0.86 * (1 + fill * 0.8 * bumpAt(s))], [lu, -0.030 * bumpAt(s) * (1 - a * a) + 0.002]); }, { mat: MAT.mouth, part: 33, lw: 0.3 });
    mb.grid(20, 6, (u, v) => { const s = 0.02 + u * 0.88, a = v * 2 - 1; return comb([culmen(s), 1], [hb.s, a * upRad(s)[1] * 0.72], [upU, -upRad(s)[0] * 0.80 - 0.002]); }, { mat: MAT.mouth, part: 33, lw: 0.3 });
    // tongue
    mb.tube([comb([gape, 1], [lf, 0.01]), comb([rimC(0.16), 1], [lu, -0.012]), comb([rimC(0.34), 1], [lu, -0.002])], 0.012, 0.004, { mat: MAT.pouch, part: 33, nv: 8 });
  }
  if (st.fishTail > 0.01) {
    const s = 0.52, w = Math.sin(t * 38) * 0.55;
    const root = comb([rimC(s), 1], [hb.s, rimW(s) * 0.75], [lu, 0.004]);
    const d = norm(comb([lf, 0.25 + w * 0.35], [lu, -0.75], [hb.s, 0.62]));
    const tip = mad(root, d, 0.105 * st.fishTail);
    mb.tube([mad(root, d, -0.02), tip], 0.029, 0.0115, { mat: MAT.fish, part: 37, nv: 12, wide: 0.55 });
    for (const q of [-1, 1]) mb.blade(tip, norm(add(d, mul(lf, q * 0.85))), lf, 0.095 * st.fishTail, 0.050, { mat: MAT.fish, part: 37, lw: 0.9, shape: 'spike' });
  }
  // ---- eyes ----
  const eR = eyeDecal(mb, Hc, hb, HR, 1, 0.60, MAT.eye, 35, 0.42 + (st.eyeFwd || 0), 0.22);
  const eL = eyeDecal(mb, Hc, hb, HR, -1, 0.60, MAT.eye, 36, 0.42 + (st.eyeFwd || 0), 0.22);
  // brow feathers: sharp spikes that give the profile its scowl
  const browA = st.brow === undefined ? 0.75 : st.brow;
  for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) {
    const base = hp(0.050 - i * 0.026, 0.063 + i * 0.006, sd * (0.047 - i * 0.004));
    mb.blade(base, dirH(-1, 0.26 + browA * 0.20 + i * 0.12 + Math.sin(t * 20 + i * 2 + sd) * 0.05 * wind, sd * 0.26), hb.u, 0.100 + i * 0.030 + raise * 0.03, 0.021, { mat: MAT.crest, part: 2 + ((i + 3) % 7), lw: 0.7, shape: 'spike' });
  }
  // ---- scarf ----
  const sc = st.scarf || {};
  let tailEnd = null, knotW = null;
  if (!sc.off) {
    const u0 = 0.205;
    const Cn = neckPt(u0), tn = norm(sub(neckPt(u0 + 0.03), neckPt(u0 - 0.03)));
    const e1 = norm(cross(tn, [0, 0, 1])), e2 = norm(cross(tn, e1));
    const rn = neckR(u0)[0] + 0.006;
    for (let w = 0; w < 2; w++) {
      const off = (w - 0.5) * 0.034;
      mb.loft(u => { const a = u * TAU; return comb([Cn, 1], [e1, Math.cos(a) * (rn + w * 0.003)], [e2, Math.sin(a) * (rn + w * 0.003)], [tn, off + Math.sin(a * 2 + w * 2) * 0.007]); }, () => [0.022, 0.020], { mat: MAT.scarf, part: 40, nu: 40, nv: 10, up: tn, lw: 0.85, uv: (u, v) => [u * 0.5, v] });
    }
    const up2 = norm([-0.85, 0.5, 0]);
    const knot = comb([Cn, 1], [up2, rn + 0.014], [[0, 0, 1], 0.026]);
    mb.ellipsoid(knot, [0.034, 0.010, 0], [-0.008, 0.028, 0], [0, 0, 0.030], { mat: MAT.scarf, part: 43, uv: () => [0.3, 0] });
    const len = sc.len === undefined ? 1 : sc.len;
    const sw = sc.wind === undefined ? wind : sc.wind;
    const lift = sc.lift === undefined ? 0.16 : sc.lift;
    tailEnd = scarfTail(mb, add(knot, [-0.01, 0.006, 0.012]), { len: 0.84 * len, t, wind: sw, phase: 0.0, zoff: 0.22, lift: lift + 0.05, part: 41, width: 0.088, floorY: sc.floorY });
    scarfTail(mb, add(knot, [-0.012, -0.008, -0.030]), { len: 0.64 * len, t, wind: sw, phase: 2.3, zoff: -0.20, lift: lift - 0.12, part: 42, width: 0.076, floorY: sc.floorY });
    knotW = M4.pt(mb.M, knot);
  }
  const A = out.anchors;
  const MM = mb.M;
  A.eyeR = M4.pt(MM, eR); A.eyeL = M4.pt(MM, eL); A.head = M4.pt(MM, Hc); A.beakTip = M4.pt(MM, culmen(1)); A.lowTip = M4.pt(MM, rimC(0.97));
  A.pouchMid = M4.pt(MM, pouchPt(0.25, 0.3, 1)); A.mouthOut = M4.pt(MM, rimC(0.5)); A.chest = M4.pt(MM, [0.1, 1.1, 0]); A.belly = M4.pt(MM, [-0.12, 0.93, 0]); A.knot = knotW; A.scarfEnd = tailEnd ? M4.pt(MM, tailEnd) : null; A.neckMid = M4.pt(MM, neckPt(0.45));
  out.head = { Hc: M4.pt(MM, Hc), f: norm(M4.dir(MM, hb.f)), u: norm(M4.dir(MM, hb.u)), s: norm(M4.dir(MM, hb.s)) };
  if (sq !== 1) mb.pop();
  mb.pop(); // body frame
  // ---- wings ----
  const wg = st.wing || {};
  for (const sd of [1, -1]) {
    const S = T([PEL.shoulder[0], PEL.shoulder[1], sd * PEL.shoulder[2]]);
    const ov = wg[sd > 0 ? 'r' : 'l'] || {};
    const grip = ov.grip || [BG.grip[0], BG.grip[1] + (st.gripY || 0), sd * BG.grip[2]];
    buildWing(mb, out, {
      side: sd, S, grip, gripAxis: ov.axis || BG.gripAxis, sp: ov.spread === undefined ? (wg.spread || 0) : ov.spread, flap: ov.flap === undefined ? (wg.flap || 0) : ov.flap, t, wind,
      E: ov.E, W: ov.W, noFingers: ov.noFingers || wg.noFingers, curl: ov.curl === undefined ? wg.curl : ov.curl,
      parts: sd > 0 ? { arm: 10, cov: 11, sec: 13, finger: 15, prim: 19 } : { arm: 50, cov: 51, sec: 53, finger: 55, prim: 59 },
      mats: { arm: MAT.plume, cov: MAT.covert, sec: MAT.secondary, prim: MAT.wingBlack }
    });
  }
  // ---- legs ----
  for (const sd of [1, -1]) {
    const key = sd > 0 ? 'r' : 'l';
    const custom = st.legs && st.legs[key];
    const hip = T([PEL.hip[0], PEL.hip[1], sd * PEL.hip[2]]);
    const pf = custom ? custom.pf : pedalFrame(st.crank || 0, sd);
    let solve = null;
    if (custom && custom.solve) solve = custom.solve(hip);
    buildLeg(mb, out, {
      side: sd, hip, pf, solve, L: PEL, t, wind, onPedal: !custom,
      parts: sd > 0 ? { thigh: 61, leg: 62, foot: 63, web: 64, claw: 65 } : { thigh: 71, leg: 72, foot: 73, web: 74, claw: 75 },
      mats: { thigh: MAT.plume, leg: MAT.leg, web: MAT.web, claw: MAT.claw }
    });
  }
  if (st.root) mb.pop();
}

// free (not pedalling) foot: build a pedal-like frame at a target with an angle
function freeFoot(p, ang, z) { return { P: [p[0], p[1], z], ex: [Math.cos(ang), Math.sin(ang), 0], ey: [-Math.sin(ang), Math.cos(ang), 0], ez: [0, 0, 1] }; }

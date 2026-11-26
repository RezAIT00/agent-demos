// ---------- the rival: THE PEREGRINE ----------
const FAL = {
  hipPivot: [-0.12, 1.01, 0], hip: [-0.125, 1.008, 0.080], femur: 0.185, shank: 0.368, tarsus: 0.338, shoulder: [0.055, 1.178, 0.112],
  bodySpine: [[0, -0.455, 1.080], [0.2, -0.355, 1.062], [0.45, -0.195, 1.062], [0.65, -0.040, 1.096], [0.85, 0.100, 1.150], [1.0, 0.185, 1.200]],
  bodyRad: [[0, 0.004, 0.010], [0.2, 0.052, 0.058], [0.45, 0.106, 0.104], [0.65, 0.138, 0.130], [0.85, 0.128, 0.120], [0.95, 0.078, 0.074], [1, 0.014, 0.014]]
};
const FNECKS = {
  aero: { B: [0.10, 1.17, 0], C1: [0.20, 1.19, 0], C2: [0.25, 1.28, 0], H: [0.325, 1.335, 0], pitch: -0.10 },
  sit: { B: [0.09, 1.19, 0], C1: [0.16, 1.27, 0], C2: [0.17, 1.35, 0], H: [0.215, 1.440, 0], pitch: 0.02 },
  slump: { B: [0.10, 1.15, 0], C1: [0.24, 1.12, 0], C2: [0.30, 1.19, 0], H: [0.385, 1.205, 0], pitch: -0.38 }
};
function buildTalon(mb, pf, side, A, parts, mats) {
  const L = (x, y, z) => comb([pf.P, 1], [pf.ex, x], [pf.ey, y], [pf.ez, z]);
  const top = BG.pedalH;
  const ball = L(-0.010, top + 0.020, 0);
  mb.capsule(A, ball, 0.017, 0.021, { mat: mats.leg, part: parts.foot });
  for (let i = 0; i < 3; i++) {
    const z = side * (0.034 - i * 0.034);
    const pts = [ball, L(0.026, top + 0.024, z * 0.7), L(0.052, top + 0.010, z), L(0.060, top - 0.008, z)];
    mb.tube(pts, 0.0125, 0.0080, { mat: mats.leg, part: parts.foot, nv: 8, nu: 14, lw: 0.75 });
    mb.tube([pts[3], L(0.058, top - 0.026, z), L(0.047, top - 0.032, z)], 0.0065, 0.0010, { mat: mats.claw, part: parts.claw, nv: 6, lw: 0.4 });
  }
  const bk = [ball, L(-0.040, top + 0.014, -side * 0.012), L(-0.055, top - 0.006, -side * 0.014)];
  mb.tube(bk, 0.0115, 0.0075, { mat: mats.leg, part: parts.foot, nv: 8, lw: 0.7 });
  mb.tube([bk[2], L(-0.052, top - 0.026, -side * 0.014)], 0.0060, 0.0010, { mat: mats.claw, part: parts.claw, nv: 6, lw: 0.4 });
}
function buildFalcon(mb, out, st) {
  const t = st.t || 0, wind = st.wind === undefined ? 0.7 : st.wind;
  if (st.root) mb.push(st.root);
  const bp = (st.body && st.body.pitch) || 0, bob = (st.body && st.body.bob) || 0;
  const bodyM = M4.chain(M4.T([0, bob, 0]), M4.about(FAL.hipPivot, M4.Rz(bp)));
  const T = p => M4.pt(bodyM, p);
  mb.push(bodyM);
  const pts = FAL.bodySpine;
  const segU = u => { let i = 1; while (i < pts.length - 1 && u > pts[i][0]) i++; const a = pts[i - 1][0], b = pts[i][0]; return (i - 1 + clamp((u - a) / (b - a))) / (pts.length - 1); };
  mb.loft(u => catmull(pts.map(q => [q[1], q[2], 0]), segU(u)), u => profile(FAL.bodyRad, u), { mat: MAT.fbody, part: 101, nu: 40, nv: 30, lw: 1.2 });
  // long barred tail
  for (let i = 0; i < 5; i++) {
    const k = i / 4 - 0.5;
    const d = norm([-1, 0.10 - Math.abs(k) * 0.18 + Math.sin(t * 17 + i) * 0.03 * wind + (i % 2) * 0.05, k * 0.6]);
    mb.blade([-0.40, 1.082, k * 0.035], d, [0, 0.7, 0.7], 0.34 - Math.abs(k) * 0.08, 0.060, { mat: i % 2 ? MAT.fwing : MAT.fslate, part: 104 + i, lw: 0.9 });
  }
  const NN = typeof st.neck === 'object' ? (() => { const a = FNECKS[st.neck.a], b = FNECKS[st.neck.b], k = clamp(st.neck.k); return { B: vlerp(a.B, b.B, k), C1: vlerp(a.C1, b.C1, k), C2: vlerp(a.C2, b.C2, k), H: vlerp(a.H, b.H, k), pitch: lerp(a.pitch, b.pitch, k) }; })() : FNECKS[st.neck || 'aero'];
  const hd = st.head || {};
  const Hc = add(NN.H, [hd.dx || 0, hd.dy || 0, 0]);
  const hb = headBasis(NN.pitch + (hd.pitch || 0), hd.yaw || 0, hd.roll || 0);
  mb.loft(u => bez3(NN.B, NN.C1, NN.C2, Hc, u), u => profile([[0, 0.092, 0.088], [0.4, 0.071, 0.069], [1, 0.064, 0.060]], u), { mat: MAT.fbody, part: 101, nu: 22, nv: 22, up: [-0.8, 0.6, 0] });
  const HR = [0.100, 0.088, 0.078];
  mb.ellipsoid(Hc, mul(hb.f, HR[0]), mul(hb.u, HR[1]), mul(hb.s, HR[2]), { mat: MAT.fhead, part: 102, nu: 30, nv: 34, lw: 1.15, uv: (u, v) => [u, v <= 0.5 ? v * 2 : v * 2 - 2] });
  const hp = (a, b, c = 0) => comb([Hc, 1], [hb.f, a], [hb.u, b], [hb.s, c]);
  const dirH = (a, b, c = 0) => norm(comb([hb.f, a], [hb.u, b], [hb.s, c]));
  const open = st.beakOpen || 0;
  // hooked beak
  const bk = s => comb([hp(0.082, 0.004), 1], [hb.f, s * 0.092], [hb.u, -0.062 * Math.pow(s, 2.6) + 0.006 * Math.sin(s * PI)]);
  const bkR = s => profile([[0, 0.036, 0.031], [0.3, 0.032, 0.026], [0.65, 0.022, 0.016], [0.9, 0.011, 0.008], [1, 0.001, 0.001]], s);
  mb.loft(bk, bkR, { mat: (u) => u > 0.64 ? MAT.fhood : MAT.fbeak, part: 103, nu: 28, nv: 16, up: hb.u, lw: 1.0 });
  mb.loft(u => bk(u * 0.2 - 0.06), u => { const r = bkR(0.1); return [r[0] * 1.12, r[1] * 1.14]; }, { mat: MAT.fyellow, part: 113, nu: 6, nv: 18, up: hb.u, lw: 0.6 });
  const gp = hp(0.060, -0.038);
  const lf = rotAxis(hb.f, hb.s, -open), lu = rotAxis(hb.u, hb.s, -open);
  mb.loft(u => comb([gp, 1], [lf, u * 0.082], [lu, 0.003 * u - 0.004]), u => [lerp(0.016, 0.003, u), lerp(0.022, 0.004, u)], { mat: u => u > 0.6 ? MAT.fhood : MAT.fbeak, part: 114, nu: 14, nv: 12, up: lu, lw: 0.8, caps: true });
  if (open > 0.05) mb.blade(gp, lf, hb.s, 0.075, 0.036, { mat: MAT.mouth, part: 115, lw: 0.3, shape: 'spike' });
  const eR = eyeDecal(mb, Hc, hb, HR, 1, 0.50, MAT.feye, 135, 0.58, 0.20);
  const eL = eyeDecal(mb, Hc, hb, HR, -1, 0.50, MAT.feye, 136, 0.58, 0.20);
  // swept crest
  const raise = st.crestRaise || 0;
  [[-0.01, 0.080, 0.000, 0.40, 0.000, 0.215], [-0.04, 0.068, 0.026, 0.24, 0.16, 0.205], [-0.04, 0.068, -0.026, 0.24, -0.16, 0.205], [-0.070, 0.034, 0.030, 0.06, 0.18, 0.165], [-0.070, 0.034, -0.030, 0.06, -0.18, 0.165]].forEach((c, i) => {
    const fl = Math.sin(t * 26 + i * 2.2) * 0.07 * wind;
    const base = hp(c[0], c[1], c[2]), d = dirH(-1, c[3] + fl + raise * 0.5, c[4]);
    mb.blade(base, d, hb.u, c[5], 0.040, { mat: MAT.fhood, part: 117 + (i % 3), lw: 0.9, shape: 'spike', bend: -0.10 });
    mb.blade(mad(base, d, c[5] * 0.45), norm(add(d, mul(hb.u, 0.06))), hb.u, c[5] * 0.62, 0.015, { mat: MAT.violet, part: 120, lw: 0.4, shape: 'spike', bend: -0.12 });
  });
  // violet collar with a silver stud
  {
    const u0 = 0.30, pt = u => bez3(NN.B, NN.C1, NN.C2, Hc, u);
    const C = pt(u0), tn = norm(sub(pt(u0 + 0.05), pt(u0 - 0.05))), e1 = norm(cross(tn, [0, 0, 1])), e2 = norm(cross(tn, e1));
    mb.loft(u => comb([C, 1], [e1, Math.cos(u * TAU) * 0.081], [e2, Math.sin(u * TAU) * 0.078]), () => [0.017, 0.009], { mat: MAT.violet, part: 121, nu: 40, nv: 8, up: tn, lw: 0.8 });
    mb.sphere(mad(C, [0.2, 0, 1], 0.082), 0.014, { mat: MAT.silver, part: 122 });
  }
  const A = out.anchors, MM = mb.M;
  A.f_eyeR = M4.pt(MM, eR); A.f_eyeL = M4.pt(MM, eL); A.f_head = M4.pt(MM, Hc); A.f_beak = M4.pt(MM, bk(1));
  mb.pop();
  const wg = st.wing || {};
  for (const sd of [1, -1]) {
    const S = T([FAL.shoulder[0], FAL.shoulder[1], sd * FAL.shoulder[2]]);
    const ov = wg[sd > 0 ? 'r' : 'l'] || {};
    buildWing(mb, out, {
      side: sd, S, grip: ov.grip || [0.606, 0.887, sd * 0.19], gripAxis: [0.96, 0.27, 0], sp: ov.spread === undefined ? (wg.spread || 0) : ov.spread, flap: ov.flap || wg.flap || 0, t, wind, scale: 0.93, pre: 'f_', E: ov.E, W: ov.W, noFingers: ov.noFingers,
      parts: sd > 0 ? { arm: 130, cov: 131, sec: 133, finger: 137, prim: 141 } : { arm: 150, cov: 151, sec: 153, finger: 157, prim: 161 },
      mats: { arm: MAT.fslate, cov: MAT.fslate, sec: MAT.fwing, prim: MAT.fwing }
    });
  }
  for (const sd of [1, -1]) {
    const hip = T([FAL.hip[0], FAL.hip[1], sd * FAL.hip[2]]);
    const custom = st.legs && st.legs[sd > 0 ? 'r' : 'l'];
    buildLeg(mb, out, {
      side: sd, hip, pf: custom ? custom.pf : pedalFrame(st.crank || 0, sd), L: FAL, t, wind, pre: 'f_', onPedal: !custom, fat: 0.92, footFn: buildTalon,
      parts: sd > 0 ? { thigh: 171, leg: 172, foot: 173, web: 174, claw: 175 } : { thigh: 181, leg: 182, foot: 183, web: 184, claw: 185 },
      mats: { thigh: MAT.fbody, leg: MAT.fyellow, web: MAT.fyellow, claw: MAT.claw }
    });
  }
  if (st.root) mb.pop();
}

// ---------- fish ----------
function buildFish(mb, M, bend, id) {
  mb.push(M);
  const sp = u => [-0.075 + u * 0.155, 0, Math.sin((1 - u) * 2.6) * bend * 0.04 * (1 - u)];
  mb.loft(sp, u => profile([[0, 0.009, 0.004], [0.16, 0.017, 0.008], [0.42, 0.037, 0.019], [0.68, 0.038, 0.021], [0.88, 0.026, 0.016], [1, 0.003, 0.002]], u), { mat: MAT.fish, part: 400 + id * 4, nu: 18, nv: 16, lw: 0.9 });
  const tp = sp(0.02);
  for (const q of [-1, 1]) mb.blade(tp, norm([-0.75, q * 0.66, bend * 0.5]), [1, 0, 0], 0.058, 0.030, { mat: MAT.fish, part: 401 + id * 4, lw: 0.9, shape: 'spike' });
  mb.blade([0.01, 0.030, 0], norm([-0.55, 0.83, 0]), [1, 0.2, 0], 0.042, 0.030, { mat: MAT.fish, part: 402 + id * 4, lw: 0.8, shape: 'spike' });
  mb.blade([0.02, -0.018, 0.016], norm([-0.7, -0.6, 0.35]), [1, 0, 0], 0.036, 0.018, { mat: MAT.fish, part: 402 + id * 4, lw: 0.7, shape: 'spike' });
  for (const q of [-1, 1]) {
    mb.sphere([0.050, 0.008, q * 0.0165], 0.0115, { mat: MAT.fishEye, part: 403 + id * 4 });
    mb.sphere([0.053, 0.008, q * 0.0262], 0.0052, { mat: MAT.pupil, part: 403 + id * 4 });
  }
  mb.pop();
}

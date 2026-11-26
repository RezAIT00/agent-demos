// ---------- the bicycle ----------
// x forward, y up, +z = drive side (rider's right). metres.
const BG = {
  tireOut: 0.340, tireR: 0.0165,
  RA: [-0.410, 0.340, 0], FA: [0.625, 0.340, 0], BB: [0, 0.272, 0],
  ST: [-0.161, 0.800, 0], HTT: [0.415, 0.825, 0], HTB: [0.455, 0.690, 0],
  saddleTop: 0.927, saddleX: -0.185,
  clamp: [0.500, 0.862, 0],
  grip: [0.603, 0.886, 0.19], gripAxis: norm([0.70, 0.71, 0]),
  ringT: 45, cogT: 18, pitch: 0.0145, chainZ: 0.050,
  crankL: 0.165, pedalZ: 0.118, pedalH: 0.011
};
BG.ringR = BG.ringT * BG.pitch / TAU; BG.cogR = BG.cogT * BG.pitch / TAU; BG.gear = BG.ringT / BG.cogT;

// pedal platform frame. theta grows as the rider pedals forward (clockwise seen from +z)
function pedalFrame(theta, side) {
  const a = (side > 0 ? 0 : PI) - theta;
  const P = [BG.BB[0] + BG.crankL * Math.cos(a), BG.BB[1] + BG.crankL * Math.sin(a), side * BG.pedalZ];
  const d = -0.05 + 0.13 * Math.sin(a + 0.35); // gentle ankling, platform stays near level
  return { P, ex: [Math.cos(d), Math.sin(d), 0], ey: [-Math.sin(d), Math.cos(d), 0], ez: [0, 0, 1], a };
}
// closed chain path around ring and cog, parametrised in direction of travel
function chainPath() {
  const c1 = BG.BB, c2 = BG.RA, r1 = BG.ringR, r2 = BG.cogR;
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], D = Math.hypot(dx, dy), phi = Math.atan2(dy, dx), beta = Math.acos((r1 - r2) / D);
  const at = phi - beta, ab = phi + beta;
  const P = (c, r, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  const a1 = at, a1e = ab - TAU, L1 = r1 * (a1 - a1e);
  const q0 = P(c1, r1, ab), q1 = P(c2, r2, ab), L2 = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
  const L3 = r2 * (ab - at);
  const s0 = P(c2, r2, at), s1 = P(c1, r1, at), L4 = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
  const L = L1 + L2 + L3 + L4;
  return {
    L, at(s) {
      s = ((s % L) + L) % L; let p;
      if (s < L1) p = P(c1, r1, a1 - s / r1);
      else if (s < L1 + L2) { const k = (s - L1) / L2; p = [lerp(q0[0], q1[0], k), lerp(q0[1], q1[1], k)]; }
      else if (s < L1 + L2 + L3) p = P(c2, r2, ab - (s - L1 - L2) / r2);
      else { const k = (s - L1 - L2 - L3) / L4; p = [lerp(s0[0], s1[0], k), lerp(s0[1], s1[1], k)]; }
      return [p[0], p[1], BG.chainZ];
    }
  };
}
const CHAIN = chainPath();

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

// B: {wheel (rad), blur (rad per shutter), crank (rad), rival, chainFast, root, wheelOff {rear,front}, noFront, noRear}
function buildBike(mb, out, B) {
  const rv = !!B.rival, base = rv ? 300 : 200;
  const fr = rv ? MAT.fframe : MAT.frame, acc = rv ? MAT.violet : MAT.gold, rimM = rv ? MAT.fframe : MAT.chrome;
  const root = B.root || M4.id();
  mb.push(root);
  const tube = (a, b, r0, r1, part = base, mat = fr, o = {}) => mb.tube([a, b], r0, r1, Object.assign({ mat, part: part, nv: 12, nu: 3, lw: 0.9 }, o, rv && part === base ? { squash: 1.55, wide: 0.7 } : {}));
  const collar = (a, b, t, r, mat = acc) => { const d = norm(sub(b, a)); const c = vlerp(a, b, t); mb.tube([mad(c, d, -0.011), mad(c, d, 0.011)], r, r, { mat, part: base + 1, nv: 12, lw: 0.55 }); };
  const { BB, ST, HTT, HTB, RA, FA } = BG;
  // main triangle
  tube(BB, ST, 0.0175, 0.0165); tube(ST, HTT, 0.0160, 0.0160); tube(BB, HTB, 0.0200, 0.0188); tube(HTB, HTT, 0.0235, 0.0235);
  tube([HTB[0] + 0.004, HTB[1] - 0.012, 0], HTB, 0.027, 0.027); tube(HTT, [HTT[0] - 0.003, HTT[1] + 0.012, 0], 0.025, 0.025);
  collar(BB, ST, 0.88, 0.0215); collar(BB, ST, 0.16, 0.022); collar(BB, HTB, 0.88, 0.024); collar(ST, HTT, 0.90, 0.020); collar(ST, HTT, 0.09, 0.020); collar(HTB, HTT, 0.12, 0.029); collar(HTB, HTT, 0.9, 0.029);
  // stays
  const seatJ = vlerp(ST, BB, 0.075);
  for (const s of [-1, 1]) {
    tube([BB[0], BB[1], s * 0.026], [RA[0], RA[1], s * 0.064], 0.0115, 0.0090);
    tube([seatJ[0], seatJ[1], s * 0.017], [RA[0], RA[1] + 0.006, s * 0.064], 0.0095, 0.0082);
    mb.capsule([RA[0] - 0.012, RA[1], s * 0.066], [RA[0] + 0.012, RA[1] + 0.004, s * 0.066], 0.011, 0.011, { mat: acc, part: base + 1, lw: 0.5 });
    // fork blades
    mb.tube([[HTB[0] + 0.008, HTB[1] - 0.018, s * 0.020], [0.505, 0.585, s * 0.040], [0.560, 0.435, s * 0.047], [FA[0], FA[1], s * 0.050]], 0.0135, 0.0085, { mat: rv ? MAT.fframe : MAT.chrome, part: base + 2, nv: 10, lw: 0.8, squash: rv ? 1.7 : 1, wide: rv ? 0.65 : 1 });
  }
  mb.tube([[HTB[0] + 0.007, HTB[1] - 0.015, -0.03], [HTB[0] + 0.007, HTB[1] - 0.015, 0.03]], 0.016, 0.016, { mat: acc, part: base + 1, nv: 10 });
  // bottom bracket + axle
  mb.tube([[BB[0], BB[1], -0.045], [BB[0], BB[1], 0.045]], 0.030, 0.030, { mat: fr, part: base, nv: 16 });
  // seat post & saddle
  const postTop = [BG.saddleX - 0.004, BG.saddleTop - 0.034, 0];
  mb.tube([ST, postTop], 0.0120, 0.0120, { mat: MAT.silver, part: base + 31, nv: 10 });
  collar(BB, ST, 0.995, 0.021);
  mb.loft(u => [BG.saddleX - 0.118 + u * 0.255, BG.saddleTop - 0.016 + 0.006 * Math.sin(u * PI) + 0.004 * u * u, 0], u => { const p = profile([[0, 0.006, 0.020], [0.08, 0.017, 0.066], [0.3, 0.016, 0.058], [0.55, 0.014, 0.026], [0.9, 0.012, 0.016], [1, 0.002, 0.004]], u); return p; }, { mat: MAT.saddle, part: base + 30, nu: 20, nv: 16, caps: true });
  mb.tube([[BG.saddleX - 0.05, BG.saddleTop - 0.040, 0], [BG.saddleX + 0.045, BG.saddleTop - 0.030, 0]], 0.0055, 0.0055, { mat: MAT.silver, part: base + 31 });
  // stem + bars
  const steer = [HTT[0] - 0.010, HTT[1] + 0.036, 0];
  mb.tube([HTT, steer], 0.0135, 0.0135, { mat: MAT.silver, part: base + 32 });
  mb.tube([steer, BG.clamp], 0.0150, 0.0140, { mat: MAT.black, part: base + 34 });
  const grips = [];
  for (const s of [-1, 1]) {
    const C = BG.clamp;
    const pts = rv ? [[C[0], C[1], s * 0.0], [C[0] + 0.005, C[1], s * 0.12], [C[0] + 0.05, C[1] - 0.004, s * 0.178], [0.600, 0.884, s * 0.19], [0.660, 0.900, s * 0.19]]
      : [[C[0], C[1], s * 0.0], [C[0] + 0.002, C[1], s * 0.13], [C[0] + 0.040, C[1] - 0.001, s * 0.188], [0.575, 0.868, s * 0.19], [0.606, 0.890, s * 0.19], [0.636, 0.924, s * 0.19], [0.648, 0.964, s * 0.19]];
    mb.tube(pts, 0.0125, 0.0120, { mat: MAT.silver, part: base + 32, nv: 10, nu: 36 });
    mb.tube(pts.slice(1), 0.0152, 0.0150, { mat: rv ? MAT.violet : MAT.tape, part: base + 33, nv: 12, nu: 36 });
    const tip = pts[pts.length - 1];
    mb.capsule(tip, mad(tip, norm(sub(tip, pts[pts.length - 2])), 0.012), 0.0168, 0.0150, { mat: acc, part: base + 1 });
    mb.tube([[0.640, 0.935, s * 0.19], [0.668, 0.915, s * 0.19], [0.668, 0.875, s * 0.19], [0.652, 0.850, s * 0.19]], 0.0075, 0.0045, { mat: MAT.black, part: base + 34, nv: 8 });
    grips.push([BG.grip[0], BG.grip[1], s * BG.grip[2]]);
  }
  // brake calipers + cables
  mb.tube([[0.505, 0.682, 0.026], [0.530, 0.706, 0], [0.505, 0.682, -0.026]], 0.0090, 0.0090, { mat: MAT.silver, part: base + 34, nv: 8 });
  mb.tube([[-0.215, 0.690, 0.026], [-0.233, 0.712, 0], [-0.215, 0.690, -0.026]], 0.0085, 0.0085, { mat: MAT.silver, part: base + 34, nv: 8 });
  mb.tube([[0.665, 0.900, 0.185], [0.640, 0.985, 0.09], [0.540, 0.880, 0.03], [0.530, 0.708, 0.0]], 0.0027, 0.0027, { mat: MAT.black, part: base + 35, nv: 6, nu: 30, lw: 0.35 });
  // wheels
  const rot = B.wheel || 0, blur = Math.abs(B.blur || 0);
  if (window.__driveStats) window.__driveStats(rv, rot, B.crank || 0);
  const wheels = [[RA, 0, B.noRear, B.rearM], [FA, 1, B.noFront, B.frontM]];
  for (const [c, wi, skip, wm] of wheels) {
    if (skip) continue;
    if (wm) mb.push(wm);
    const R = BG.tireOut - BG.tireR;
    const ca = Math.cos(-rot), sa = Math.sin(-rot), ex = [ca, sa, 0], ey = [-sa, ca, 0];
    mb.torus(c, ex, ey, Z, R, BG.tireR, BG.tireR, { mat: MAT.tire, part: base + 12 + wi, nu: 110, nv: 16, uv: (u, v) => [u, v <= 0.5 ? v * 2 : v * 2 - 2] });
    const disc = rv && wi === 0;
    if (disc) {
      mb.ringPlate(c, ex, ey, Z, 0.311, 0.018, 0.026, 120, { mat: MAT.disc, part: base + 10, lw: 0.7 });
    } else if (rv) {
      mb.ringPlate(c, ex, ey, Z, 0.311, 0.252, 0.020, 100, { mat: MAT.fframe, part: base + 10 + wi, lw: 0.8 });
      for (const s of [-1, 1]) mb.ringPlate([c[0], c[1], s * 0.0115], ex, ey, Z, 0.268, 0.259, 0.002, 90, { mat: MAT.violetGlow, part: base + 10 + wi, lw: 0 });
    } else {
      mb.torus(c, ex, ey, Z, 0.3035, 0.0085, 0.0115, { mat: rimM, part: base + 10 + wi, nu: 100, nv: 12 });
    }
    // hub
    mb.tube([[c[0], c[1], -0.058], [c[0], c[1], 0.058]], 0.0080, 0.0080, { mat: MAT.silver, part: base + 35, nv: 10 });
    mb.tube([[c[0], c[1], -0.034], [c[0], c[1], 0.034]], 0.0165, 0.0165, { mat: MAT.silver, part: base + 35, nv: 14 });
    for (const s of [-1, 1]) mb.ringPlate([c[0], c[1], s * 0.031], ex, ey, Z, 0.030, 0.006, 0.004, 28, { mat: MAT.silver, part: base + 36 });
    // valve stem
    const va = comb([ex, 0], [ey, -1]);
    mb.tube([mad(c, va, 0.298), mad(c, va, 0.274)], 0.0042, 0.0042, { mat: acc, part: base + 37, nv: 6, lw: 0.4 });
    if (!disc) {
      const M = mb.M;
      out.spokes.push({ c: M4.pt(M, c), ex: norm(M4.dir(M, X)), ey: norm(M4.dir(M, Y)), r: rv ? 0.254 : 0.297, hub: 0.029, rot: -rot + wi * 0.31, blur: blur, seed: 3 + wi * 5 + (rv ? 11 : 0), col: rv ? [0.45, 0.40, 0.62] : [0.86, 0.90, 0.97], hi: rv ? [0.75, 0.5, 1] : [1, 1, 1] });
    }
    if (wm) mb.pop();
  }
  // drivetrain: chainring (rotates with crank), cog (rotates with rear wheel)
  const th = B.crank || 0;
  const tooth = (R, T, ph) => a => R - 0.0035 + 0.0085 * clamp(1.6 - 3.4 * Math.abs(fract((a + ph) * T / TAU) - 0.5), 0, 1);
  mb.ringPlate([BB[0], BB[1], BG.chainZ], X, Y, Z, tooth(BG.ringR, BG.ringT, th), BG.ringR - 0.016, 0.0045, BG.ringT * 8, { mat: rv ? MAT.violet : MAT.silver, part: base + 21, lw: 0.55 });
  mb.ringPlate([BB[0], BB[1], BG.chainZ], X, Y, Z, 0.030, 0.008, 0.007, 30, { mat: MAT.black, part: base + 21, lw: 0.5 });
  for (let k = 0; k < 5; k++) { const a = -th + k * TAU / 5 + 0.3; mb.tube([[BB[0] + Math.cos(a) * 0.02, BB[1] + Math.sin(a) * 0.02, BG.chainZ + 0.002], [BB[0] + Math.cos(a) * (BG.ringR - 0.011), BB[1] + Math.sin(a) * (BG.ringR - 0.011), BG.chainZ + 0.002]], 0.0085, 0.0058, { mat: rv ? MAT.violet : MAT.silver, part: base + 21, nv: 8, lw: 0.55 }); }
  mb.ringPlate([RA[0], RA[1], BG.chainZ], X, Y, Z, tooth(BG.cogR, BG.cogT, th * BG.gear), 0.010, 0.006, BG.cogT * 8, { mat: MAT.silver, part: base + 36, lw: 0.5 });
  // chain: travel = crank angle x ring radius
  const travel = th * BG.ringR;
  if (B.chainFast) {
    mb.loft(u => CHAIN.at(u * CHAIN.L), () => [0.0052, 0.0052], { mat: MAT.chain, part: base + 20, nu: 150, nv: 8, lw: 0.4, up: [0, 0, 1], uv: (u) => [(u * CHAIN.L - travel) / (BG.pitch * 2), 0] });
  } else {
    const N = Math.round(CHAIN.L / BG.pitch), p = CHAIN.L / N;
    for (let i = 0; i < N; i++) {
      const s = i * p + travel; const a = CHAIN.at(s - p * 0.42), b = CHAIN.at(s + p * 0.42);
      const d = sub(b, a), l = vlen(d), dn = mul(d, 1 / l), n = norm(cross(Z, dn));
      const outer = i % 2 === 0;
      mb.box(vlerp(a, b, 0.5), mul(dn, l * 0.56), mul(n, outer ? 0.0050 : 0.0040), [0, 0, outer ? 0.0068 : 0.0046], { mat: MAT.chain, part: base + 20, lw: 0.35 });
      // box() lays uv across faces; tag alternate links through ao so they read as separate plates
      const o = mb.nv - 24; for (let k = 0; k < 24; k++) { mb.v[(o + k) * VSTR + 6] = outer ? 0.2 : 0.75; if (!outer) mb.v[(o + k) * VSTR + 11] = -0.12; }
    }
  }
  // cranks + pedals
  const pedals = {};
  for (const s of [1, -1]) {
    const pf = pedalFrame(th, s), end = [pf.P[0], pf.P[1], s * 0.066];
    const pid = base + (s > 0 ? 22 : 23);
    mb.tube([[BB[0], BB[1], s * 0.060], end], 0.0165, 0.0112, { mat: rv ? MAT.violet : MAT.silver, part: pid, nv: 10, squash: 1.0, wide: 0.7 });
    mb.sphere([BB[0], BB[1], s * 0.066], 0.020, { mat: MAT.black, part: pid });
    mb.sphere(end, 0.0135, { mat: MAT.silver, part: pid });
    mb.tube([end, [pf.P[0], pf.P[1], s * (BG.pedalZ + 0.042)]], 0.0055, 0.0055, { mat: MAT.silver, part: pid, nv: 8 });
    const pp = base + (s > 0 ? 24 : 25);
    mb.box(pf.P, mul(pf.ex, 0.050), mul(pf.ey, BG.pedalH), [0, 0, 0.042], { mat: MAT.black, part: pp, lw: 0.75 });
    for (const q of [-1, 1]) mb.box(mad(pf.P, pf.ex, q * 0.051), mul(pf.ex, 0.0045), mul(pf.ey, 0.0095), [0, 0, 0.044], { mat: rv ? MAT.violet : MAT.gold, part: pp, lw: 0.4 });
    pedals[s > 0 ? 'r' : 'l'] = pf;
  }
  const M = mb.M; const W = p => M4.pt(M, p);
  const a = out.anchors, pre = rv ? 'f_' : '';
  a[pre + 'rearContact'] = W([RA[0], 0.004, 0]); a[pre + 'frontContact'] = W([FA[0], 0.004, 0]); a[pre + 'rearHub'] = W(RA); a[pre + 'frontHub'] = W(FA);
  a[pre + 'rimLow'] = W([RA[0] - 0.23, 0.12, 0.012]); a[pre + 'bb'] = W(BB); a[pre + 'pedalR'] = W(pedals.r.P); a[pre + 'pedalL'] = W(pedals.l.P); a[pre + 'bars'] = W(BG.grip);
  mb.pop();
  return { grips, pedals };
}

// rig.js — skeleton, two-bone IK, pose maths. Local space: +Z forward, +Y up, +X = the character's own left.
const BODY = {
  iro: {
    hipH: 0.93, thigh: 0.455, shin: 0.455, ankle: 0.075, s1: 0.17, s2: 0.19, s3: 0.135, neck: 0.075, headUp: 0.115,
    shW: 0.168, shY: 0.065, hipW: 0.088, upArm: 0.285, foreArm: 0.27, headScale: 1.06,
  },
  sumi: {
    hipH: 1.13, thigh: 0.555, shin: 0.555, ankle: 0.10, s1: 0.24, s2: 0.27, s3: 0.20, neck: 0.07, headUp: 0.12,
    shW: 0.355, shY: 0.09, hipW: 0.15, upArm: 0.42, foreArm: 0.41, headScale: 1.08,
  },
};

function ik2(root, target, a, b, pole) {
  let d = V.sub(target, root);
  let L = V.len(d);
  const dir = L > 1e-5 ? V.mul(d, 1 / L) : [0, -1, 0];
  L = clamp(L, Math.abs(a - b) + 0.005, a + b - 0.002);
  const cosA = clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  let p = V.sub(pole, V.mul(dir, V.dot(pole, dir)));
  if (V.len(p) < 1e-4) p = V.cross(dir, [1, 0, 0]);
  p = V.norm(p);
  const mid = V.add(root, V.add(V.mul(dir, cosA * a), V.mul(p, sinA * a)));
  const end = V.add(root, V.mul(dir, L));
  return { mid, end };
}

// root: {pos:[x,y,z], yaw, pitch, roll, spin}
function solveRig(kind, pose, root) {
  const B = BODY[kind];
  const pel = [pose.hip[0], B.hipH + pose.hip[1], pose.hip[2]];
  const Rp = M3.euler(pose.pel[0], pose.pel[1], pose.pel[2]);
  const spineAt = s => M3.mul(Rp, M3.euler(pose.spine[0] * s, pose.spine[1] * s, pose.spine[2] * s));
  const R1 = spineAt(0.5), Rc = spineAt(1);
  const mid = V.add(pel, M3.v(R1, [0, B.s1, 0]));
  const chest = V.add(mid, M3.v(spineAt(0.8), [0, B.s2, 0]));
  const neck = V.add(chest, M3.v(Rc, [0, B.s3, 0.005]));
  const Rn = M3.mul(Rc, M3.euler(pose.head[0] * 0.35, pose.head[1] * 0.35, pose.head[2] * 0.35));
  const neckTop = V.add(neck, M3.v(Rn, [0, B.neck, 0.012]));
  const Rh = M3.mul(Rc, M3.euler(pose.head[0], pose.head[1], pose.head[2]));
  const headC = V.add(neckTop, M3.v(Rh, [0, B.headUp * 0.72, 0.012]));

  const out = { kind, B, pose };
  const J = {};
  J.pelvis = pel; J.mid = mid; J.chest = chest; J.neck = neck; J.neckTop = neckTop; J.head = headC;
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const clav = V.add(chest, M3.v(Rc, [sx * B.shW * 0.45, B.shY * 0.9, -0.005]));
    // shoulders follow the hand a little, which keeps big reaching poses connected
    const hRel = pose['h' + side];
    const reachF = clamp((hRel[2] - 0.15) * 0.22, -0.05, 0.09), reachU = clamp((hRel[1] - 0.05) * 0.16, -0.03, 0.08);
    const sh = V.add(chest, M3.v(Rc, [sx * B.shW, B.shY + reachU, reachF]));
    const hand = V.add(chest, M3.v(Rc, hRel));
    const arm = ik2(sh, hand, B.upArm, B.foreArm, M3.v(Rc, pose['e' + side]));
    J['clav' + side] = clav; J['sh' + side] = sh; J['el' + side] = arm.mid; J['wr' + side] = arm.end;
    const hip = V.add(pel, M3.v(Rp, [sx * B.hipW, -0.025, 0]));
    const foot = pose['f' + side].slice(); foot[1] += B.ankle;
    const leg = ik2(hip, foot, B.thigh, B.shin, pose['k' + side]);
    J['hip' + side] = hip; J['kn' + side] = leg.mid; J['an' + side] = leg.end;
  }

  // root transform: yaw, then whole-body rotation about the pelvis
  const Ry = M3.ry((root.yaw || 0) * D2R);
  const Rf = M3.mul(M3.mul(M3.rz((root.roll || 0) * D2R), M3.rx((root.pitch || 0) * D2R)), M3.ry((root.spin || 0) * D2R));
  const piv = [pel[0], pel[1], pel[2]];
  const Rw = M3.mul(Ry, Rf);
  const W = p => {
    const q = M3.v(Rf, V.sub(p, piv));
    const r = M3.v(Ry, V.add(q, piv));
    return V.add(r, root.pos);
  };
  const WJ = {};
  for (const k in J) WJ[k] = W(J[k]);
  out.J = WJ;
  out.W = W;
  out.Rw = Rw;
  out.dir = d => M3.v(Rw, d);
  out.Rp = M3.mul(Rw, Rp);
  out.Rc = M3.mul(Rw, Rc);
  out.Rh = M3.mul(Rw, Rh);
  out.Rn = M3.mul(Rw, Rn);
  out.spineAt = s => M3.mul(Rw, spineAt(s));
  out.footDir = side => {
    const kp = pose['k' + side];
    const yawF = Math.atan2(kp[0], Math.abs(kp[2]) + 0.35) / D2R * 0.8;
    const toe = pose['toe' + side] || 0;
    const R = M3.mul(M3.ry(yawF * D2R), M3.rx(toe * D2R));
    return { f: M3.v(Rw, M3.v(R, [0, 0, 1])), u: M3.v(Rw, M3.v(R, [0, 1, 0])), r: M3.v(Rw, M3.v(R, [1, 0, 0])) };
  };
  out.center = V.lerp(WJ.pelvis, WJ.chest, 0.5);
  return out;
}

const POSE_VEC = ['hip', 'pel', 'spine', 'head', 'hL', 'hR', 'eL', 'eR', 'fL', 'fR', 'kL', 'kR'];
const POSE_NUM = ['toeL', 'toeR', 'hsL', 'hsR', 'fsL', 'fsR'];
function lerpPose(a, b, u) {
  const o = {};
  for (const k of POSE_VEC) o[k] = V.lerp(a[k], b[k], u);
  for (const k of POSE_NUM) o[k] = lerp(a[k], b[k], u);
  const s = u < 0.5 ? a : b;
  o.gripL = s.gripL; o.gripR = s.gripR; o.eyes = s.eyes; o.mouth = s.mouth;
  return o;
}
function makePose(base, ov) {
  const o = {};
  for (const k of POSE_VEC) o[k] = (ov[k] || base[k]).slice();
  for (const k of POSE_NUM) o[k] = ov[k] !== undefined ? ov[k] : base[k];
  for (const k of ['gripL', 'gripR', 'eyes', 'mouth']) o[k] = ov[k] !== undefined ? ov[k] : base[k];
  return o;
}

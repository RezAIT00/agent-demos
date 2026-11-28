// KOE's full body: a small forward-kinematics puppet plus silhouette rendering.
// Angles are measured from straight down; positive swings toward where she faces.
'use strict';
const POSES = {
  stand: { lean: 0, armN: [0.16, 0.2], armF: [-0.2, -0.16], legN: [0.09, 0.03], legF: [-0.11, -0.05], head: 0 },
  leap: { lean: 0.32, armN: [-1.25, -0.75], armF: [2.3, 2.62], legN: [1.38, 0.12], legF: [-0.72, -1.9], head: -0.12 },
  fly: { lean: 1.22, armN: [-0.86, -1.04], armF: [1.78, 1.62], legN: [-1.02, -1.18], legF: [-1.28, -1.9], head: -0.72, hpos: -0.25, htilt: 0.62 },
  rocket: { lean: 0.02, armN: [-0.42, -0.2], armF: [2.92, 3.06], legN: [0.12, -0.06], legF: [-0.1, -0.95], head: -0.16 },
  float: { lean: -0.1, armN: [1.78, 2.12], armF: [-1.78, -2.12], legN: [0.22, -0.12], legF: [-0.18, -0.82], head: -0.14 },
  crouch: { lean: 0.55, armN: [0.75, 1.85], armF: [-1.05, -0.45], legN: [1.52, -0.32], legF: [0.35, -1.55], head: -0.34 },
  peace: { lean: -0.05, armN: [1.18, 2.92], armF: [-0.72, 0.62], legN: [0.2, 0.08], legF: [-0.24, -0.02], head: 0.1 },
  cheer: { lean: -0.06, armN: [2.55, 2.95], armF: [-2.55, -2.95], legN: [0.32, 0.1], legF: [-0.32, -0.1], head: -0.05 },
  discoUp: { lean: -0.12, armN: [2.45, 2.55], armF: [-0.75, 0.75], legN: [0.4, 0.2], legF: [-0.26, -0.08], head: 0.08 },
  discoDown: { lean: 0.16, armN: [0.42, 0.7], armF: [-0.8, 0.9], legN: [0.55, -0.2], legF: [-0.5, -0.5], head: -0.1 },
  wave: { lean: 0.08, armN: [1.6, 2.3], armF: [-1.6, -1.0], legN: [0.1, -0.15], legF: [-0.52, -0.3], head: 0.12 },
};
for (const key in POSES) { const q = POSES[key]; if (q.hpos === undefined) q.hpos = q.head; if (q.htilt === undefined) q.htilt = q.lean * 0.35 + q.head; }
function blendPose(a, b, k) {
  const o = {};
  for (const key in a) {
    const bv = b[key] === undefined ? a[key] : b[key];
    o[key] = Array.isArray(a[key]) ? mix2(a[key], bv, k) : lerp(a[key], bv, k);
  }
  return o;
}
function runPose(phase) {
  const leg = q => {
    const th = 0.2 + 0.95 * Math.sin(TAU * q);
    return [th, th - 0.3 - 1.65 * Math.pow(Math.max(0, Math.cos(TAU * q)), 1.2)];
  };
  const arm = q => { const u = -1.0 * Math.sin(TAU * q) - 0.1; return [u, u + 1.65]; };
  return { lean: 0.34, legN: leg(phase), legF: leg(phase + 0.5), armN: arm(phase), armF: arm(phase + 0.5), head: -0.2 };
}

function capsule(ctx, a, b, ra, rb) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx), off = Math.acos(clamp((ra - rb) / d, -1, 1));
  ctx.beginPath();
  ctx.arc(a[0], a[1], ra, ang + off, ang - off + TAU);
  ctx.arc(b[0], b[1], rb, ang - off, ang + off);
  ctx.closePath();
}
// Several capsules drawn as one outlined shape.
function limb(ctx, segs, lw = 7) {
  for (const [a, b, ra, rb] of segs) { capsule(ctx, a, b, ra, rb); paint(ctx, null, KOE.line, lw * 2); }
  for (const [a, b, ra, rb, col] of segs) { capsule(ctx, a, b, ra, rb); paint(ctx, col); }
}
const step = (p, a, len) => [p[0] + Math.sin(a) * len, p[1] + Math.cos(a) * len];

function drawFigureRaw(ctx, pose, o) {
  const hip = [0, 0];
  const up = Math.PI - pose.lean;
  const neck = step(hip, up, 236);
  const chest = mix2(hip, neck, 0.8);
  const side = [Math.cos(pose.lean), Math.sin(pose.lean)];
  const shN = [chest[0] - side[0] * 22, chest[1] - side[1] * 22 + 6], shF = [chest[0] + side[0] * 40, chest[1] + side[1] * 40 + 4];
  const headAt = step(neck, up - (pose.hpos ?? pose.head) * 0.4, 70);
  const headOpt = {
    x: headAt[0] + 8, y: headAt[1] - 4, s: 0.44, tilt: pose.htilt ?? (pose.lean * 0.35 + pose.head), turn: o.turn ?? 0.7, t: o.t,
    wind: o.wind, lift: o.lift || 0, mouth: o.mouth || 'smile', open: o.open ?? 0.6, brow: o.brow || 0, eyeL: o.eyes ?? 1, eyeR: o.eyeR ?? o.eyes ?? 1,
    glow: o.glow ?? 0.35, blush: 0.6, happy: o.happy || false, length: o.hairLength || 1.25,
  };
  const arm = (angles, sh, far) => {
    const el = step(sh, angles[0], 138), hand = step(el, angles[1], 128);
    const sleeve = far ? KOE.jacketShade : KOE.jacket;
    limb(ctx, [[sh, el, 36, 25, sleeve], [el, mix2(el, hand, 0.72), 27, 29, sleeve]]);
    const cuff = mix2(el, hand, 0.74);
    limb(ctx, [[mix2(el, hand, 0.68), cuff, 31, 31, KOE.tip]], 5);
    const tip = step(hand, angles[1], 34);
    const skin = far ? KOE.skinShade : KOE.skin;
    const segs = [[cuff, hand, 13, 15, skin], [hand, tip, 15, 9, skin]];
    if (o.peaceHand && !far) {
      segs.length = 1; segs.push([hand, hand, 21, 21, skin], [hand, step(hand, Math.PI + 0.32, 56), 9, 7, skin], [hand, step(hand, Math.PI - 0.34, 56), 9, 7, skin]);
    }
    limb(ctx, segs, 5);
    return hand;
  };
  const leg = (angles, far) => {
    const root = [far ? 22 : -16, 0];
    const knee = step(root, angles[0], 218), foot = step(knee, angles[1], 212);
    const thigh = far ? KOE.darkShade : KOE.dark, boot = far ? KOE.jacketShade : KOE.jacket;
    limb(ctx, [[root, knee, 50, 28, thigh], [knee, mix2(knee, foot, 0.45), 28, 21, thigh]]);
    const toe = step(foot, angles[1] + 1.45, 62);
    limb(ctx, [[mix2(knee, foot, 0.34), foot, 33, 24, boot], [foot, toe, 26, 17, boot]]);
    capsule(ctx, mix2(knee, foot, 0.4), mix2(knee, foot, 0.4), 31, 31); ctx.save(); ctx.clip();
    ctx.fillStyle = KOE.tip; const a = mix2(knee, foot, 0.4); ctx.fillRect(a[0] - 40, a[1] - 8, 80, 12); ctx.restore();
    poly(ctx, [step(foot, angles[1], 22), step(toe, angles[1], 16)], false); paint(ctx, null, KOE.scarf, 12);
  };

  backHair(ctx, headOpt);
  const farHand = arm(pose.armF, shF, true);
  leg(pose.legF, true);
  // scarf tails stream behind her
  const w = o.wind;
  for (const [i, len, width] of [[0, 430, 25], [1, 340, 19]]) {
    const base = Math.abs(w) < 0.25 ? Math.PI / 2 + 0.35 : (w < 0 ? Math.PI - 0.12 - o.lift : 0.12 + o.lift);
    const sp = flow(neck[0] - 18, neck[1] + 8 + i * 14, base + i * 0.22, len, o.t, { amp: 48, speed: 9, phase: i * 2, n: 24 });
    const wf = u => width * (1 + 0.5 * Math.sin(u * 5 + o.t * 4 + i)) - (u > 0.9 ? (u - 0.9) * width * 9 : 0);
    ribbon(ctx, sp, wf); paint(ctx, i ? KOE.scarfShade : KOE.scarf, KOE.line, 6);
  }
  // torso
  const at = (u, off) => { const p = mix2(hip, neck, u); return [p[0] + side[0] * off, p[1] + side[1] * off]; };
  const torso = () => spline(ctx, [at(0, -54), at(0.32, -40), at(0.72, -64), at(0.97, -48), at(1.05, 0), at(0.97, 52), at(0.72, 68), at(0.52, 48), at(0.32, 36), at(0, 52), at(-0.1, 0)]);
  torso(); paint(ctx, KOE.jacket, KOE.line, 7);
  ctx.save(); torso(); ctx.clip();
  poly(ctx, [at(-0.2, -90), at(0.42, -90), at(0.42, 90), at(-0.2, 90)]); paint(ctx, KOE.dark);
  poly(ctx, [at(0.42, -90), at(0.42, 90)], false); paint(ctx, null, KOE.tip, 12);
  poly(ctx, [at(0.38, 22), at(1.1, 26), at(1.1, 100), at(0.38, 100)]); paint(ctx, KOE.jacketShade);
  poly(ctx, [at(1.05, -8), at(0.62, 26), at(1.05, 42)]); paint(ctx, KOE.dark);
  ctx.restore();
  // pleated skirt that kicks out as she moves
  const flare = o.flare ?? Math.min(1, Math.abs(w));
  const hem = [];
  const dirx = w < 0 ? -1 : 1;
  for (let i = 0; i <= 8; i++) {
    const u = i / 8, x = lerp(-112, 112, u) + dirx * flare * 46 * (dirx < 0 ? 1 - u : u);
    const y = 116 + (i % 2 ? 20 : 0) - flare * 34 * (dirx < 0 ? 1 - u : u) + Math.sin(o.t * 9 + i) * 6 * (0.4 + flare);
    hem.push([x, y, 1]);
  }
  spline(ctx, [[-58, -22, 1], [56, -22, 1], [92, 44], ...hem.reverse(), [-92, 44]]); paint(ctx, KOE.dark, KOE.line, 7);
  ctx.save(); ctx.clip();
  for (let i = 1; i < 8; i += 2) { const h = hem[i]; poly(ctx, [[(i - 4) * -12, -22], [h[0] + 16, h[1] + 30], [h[0] - 24, h[1] + 30]]); paint(ctx, KOE.darkShade); }
  ctx.beginPath(); hem.forEach((p, i) => i ? ctx.lineTo(p[0], p[1] - 14) : ctx.moveTo(p[0], p[1] - 14)); paint(ctx, null, KOE.tip, 8);
  ctx.restore();
  limb(ctx, [[at(0.02, -52), at(0.02, 50), 15, 15, KOE.scarf]], 5);
  leg(pose.legN, false);
  limb(ctx, [[neck, step(neck, up, 34), 21, 19, KOE.skin]], 6);
  face(ctx, headOpt);
  frontHair(ctx, headOpt);
  limb(ctx, [[[neck[0] - 40, neck[1] + 20], [neck[0] + 40, neck[1] + 16], 24, 24, KOE.scarf]], 6);
  const nearHand = arm(pose.armN, shN, false);
  return { nearHand, farHand, head: headAt, neck };
}

const figBuf = mk(2400, 2400), figTint = mk(2400, 2400), figOut = mk(2400, 2400);
// Draws the figure with its hip at (x, y). With `silhouette`, renders a flat
// shape with a hard rim light, the classic anime backlit look.
function figure(ctx, pose, o) {
  o = Object.assign({ x: 960, y: 640, s: 1, facing: 1, rot: 0, t: 0, wind: -0.8 }, o);
  const opts = Object.assign({}, o, { wind: o.wind * o.facing });
  if (!o.silhouette) {
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot); ctx.scale(o.s * o.facing, o.s);
    const joints = drawFigureRaw(ctx, pose, opts);
    ctx.restore();
    return joints;
  }
  const k = Math.min(1.5, Math.max(0.25, o.s));
  const size = Math.min(2400, Math.ceil(1750 * k)), c = size / 2;
  const g = figBuf.getContext('2d'); g.clearRect(0, 0, size, size);
  g.save(); g.translate(c, c); g.rotate(o.rot); g.scale(k * o.facing, k);
  const joints = drawFigureRaw(g, pose, opts);
  g.restore();
  const tint = (target, color) => {
    const q = target.getContext('2d'); q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, size, size);
    q.drawImage(figBuf, 0, 0, size, size, 0, 0, size, size);
    q.globalCompositeOperation = 'source-in'; q.fillStyle = color; q.fillRect(0, 0, size, size);
    q.globalCompositeOperation = 'source-over';
  };
  tint(figOut, o.rim || '#ffd9a0'); tint(figTint, o.silhouette);
  const q = figOut.getContext('2d');
  q.globalCompositeOperation = 'source-atop';
  const [rx, ry] = o.rimOffset || [-9, 8];
  q.drawImage(figTint, 0, 0, size, size, rx * k, ry * k, size, size);
  q.globalCompositeOperation = 'source-over';
  const z = o.s / k;
  ctx.drawImage(figOut, 0, 0, size, size, o.x - c * z, o.y - c * z, size * z, size * z);
  return joints;
}

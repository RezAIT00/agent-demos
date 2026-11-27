// fx.js — smoke, spray, shock rings, hit stars, smears, signature effects, screen-space accents
const PAL = [[1.0, 0.16, 0.50], [1.0, 0.32, 0.14], [1.0, 0.76, 0.12], [0.05, 0.80, 0.76], [0.46, 0.22, 0.95]];
const INKC = [[0.015, 0.015, 0.015], [0.015, 0.015, 0.015], [0.95, 0.95, 0.95], [0.34, 0.34, 0.34]];
const HER_TINTS = [3, 9, 4, 5, 6];

// impact frames: frame -> [mode, seed, threshold]  (1 ink negative, 2 paint field, 3 split, 4 paper, 5 night)
const IMPACT = {
  205: [5, 3, 0.5], 206: [4, 7, 0.5], 207: [3, 2, 0.55],
  335: [1, 4, 0.50],
  405: [2, 5, 0.5], 406: [2, 11, 0.5],
  545: [2, 9, 0.5],
  625: [1, 8, 0.50],
  705: [3, 6, 0.55], 706: [3, 13, 0.55],
  765: [2, 15, 0.5],
  795: [5, 10, 0.5], 796: [5, 31, 0.5], 797: [3, 14, 0.5],
  1085: [5, 21, 0.5], 1086: [4, 23, 0.5], 1087: [3, 25, 0.52],
};
// cracked-glass overlays: [from, to, radius0, radius1]
const CRACKS_SCREEN = [[207, 212, 0.55, 0.85], [405, 408, 0.35, 0.55], [765, 769, 0.4, 0.6], [795, 802, 0.7, 1.15], [1087, 1092, 0.75, 1.35]];
// [from, to, amount, dark?, focus spec, inner radius]
const SPEED = [
  [62, 70, 0.55, 1, ['sumi', 'head'], 0.30], [192, 204, 0.75, 0, [0, 1.5, 0], 0.30],
  [244, 247, 0.55, 0, ['pt', 'm1'], 0.20], [254, 257, 0.60, 1, ['pt', 'm2'], 0.20], [264, 267, 0.55, 0, ['pt', 'm3'], 0.20], [274, 277, 0.60, 1, ['pt', 'm4'], 0.20], [212, 221, 0.9, 0, [0, 1.6, 0], 0.22],
  [238, 244, 0.7, 0, ['iro', 'chest'], 0.35], [288, 297, 0.75, 1, ['sumi', 'chest'], 0.28], [328, 334, 0.75, 0, ['iro', 'chest'], 0.33],
  [338, 347, 0.9, 1, ['iro', 'chest'], 0.22], [390, 398, 0.85, 0, ['iro', 'chest'], 0.30], [409, 418, 0.9, 0, ['sumi', 'chest'], 0.22],
  [444, 450, 0.35, 0, ['sumi', 'chest'], 0.4], [466, 474, 0.5, 1, ['sumi', 'chest'], 0.35], [508, 518, 0.4, 0, ['iro', 'chest'], 0.4],
  [536, 544, 0.55, 1, ['sumi', 'chest'], 0.33], [549, 566, 0.85, 0, ['sumi', 'chest'], 0.26], [586, 598, 0.8, 0, ['iro', 'chest'], 0.30],
  [610, 624, 0.7, 0, ['iro', 'chest'], 0.30], [633, 639, 0.5, 0, ['iro', 'chest'], 0.30], [684, 704, 0.7, 0, ['iro', 'chest'], 0.33],
  [710, 718, 0.85, 1, [30, 112, 0], 0.22], [756, 764, 0.55, 1, ['sumi', 'head'], 0.35], [769, 787, 0.95, 0, ['sumi', 'chest'], 0.22],
  [787, 794, 0.8, 1, ['sumi', 'chest'], 0.26], [802, 810, 0.8, 0, [24.5, 0, 0], 0.22], [1058, 1072, 0.8, 0, [23.5, 3.2, 0], 0.28],
  [1072, 1084, 0.45, 1, [23.5, 3.3, 0], 0.42], [1092, 1102, 0.9, 1, [23.5, 3.2, 0], 0.16],
];
// [frame, centre spec] distortion waves are derived from rings; these add full-screen air ripples at contact
const AIRWAVE = [[54, 0.55, 0.020], [204, 1.2, 0.050], [244, 0.35, 0.014], [254, 0.4, 0.016], [264, 0.35, 0.014], [274, 0.4, 0.016], [284, 0.8, 0.030], [334, 0.8, 0.032], [404, 0.85, 0.034], [474, 0.9, 0.036],
  [544, 0.9, 0.036], [624, 0.9, 0.034], [704, 1.2, 0.052], [764, 1.0, 0.040], [794, 1.2, 0.055], [802, 1.3, 0.050], [1084, 1.4, 0.060], [1092, 1.6, 0.085]];

class FX {
  constructor(world, anim) {
    this.world = world; this.anim = anim;
    this.rng = mulberry32(24601);
    this.puffs = []; this.drops = []; this.rings = []; this.stars = [];
    this.out = { puffs: new PuffBatch(), drops: new DropBatch(), ribbons: new RibbonBatch(), rings: [], stars: [], blobs: { n: 0, batches: [] }, waves: [] };
    this.points = {};
    this.computePoints();
    this.author();
  }
  joint(kind, f, j) { const s = this.anim.evaluate(kind, f); return solveRig(kind, s.pose, s.root).J[j]; }
  computePoints() {
    const P = this.points;
    const mid = (a, b, t = 0.5) => V.lerp(a, b, t);
    P.H3 = mid(this.joint('iro', 204, 'anR'), this.joint('sumi', 204, 'wrR'));
    P.m1 = mid(this.joint('iro', 244, 'knR'), this.joint('sumi', 244, 'wrL'));
    P.m2 = mid(this.joint('sumi', 254, 'wrR'), this.joint('iro', 254, 'wrL'));
    P.m3 = mid(this.joint('iro', 264, 'elR'), this.joint('sumi', 264, 'wrR'));
    P.m4 = mid(this.joint('sumi', 274, 'wrR'), this.joint('iro', 274, 'wrR'));
    P.H4 = mid(this.joint('iro', 284, 'anR'), this.joint('sumi', 284, 'chest'), 0.4);
    P.H5 = mid(this.joint('sumi', 334, 'wrR'), this.joint('iro', 334, 'mid'), 0.55);
    P.H6 = mid(this.joint('iro', 404, 'anR'), this.joint('sumi', 404, 'head'), 0.45);
    P.H8 = mid(this.joint('iro', 544, 'anL'), this.joint('sumi', 544, 'chest'), 0.45);
    P.c1 = this.joint('sumi', 598, 'wrL');
    P.H10 = mid(this.joint('iro', 704, 'anR'), this.joint('sumi', 704, 'wrR'));
    P.H11 = mid(this.joint('iro', 764, 'anR'), this.joint('sumi', 764, 'wrL'));
    P.H13 = mid(this.joint('iro', 1084, 'anR'), this.joint('sumi', 1084, 'wrR'));
    P.H1 = [0, 0.04, 2.5]; P.H2 = [0.02, 0.05, 2.47]; P.H7 = [26.7, 0.12, 0.15]; P.H9 = [55.2, 14.2, 3.0];
    P.H12 = [24.5, -0.4, 0];
    this.dripAt = V.add(this.joint('iro', 940, 'wrR'), [0.13, -0.06, 0.02]);
    this.dripGround = [this.dripAt[0], groundHeight(this.dripAt[0], this.dripAt[2], 940), this.dripAt[2]];
    // the paint pool her single drop falls into: first his ink, then her colour in the middle of it
    this.world.splat(866, this.dripGround, 1.05, 2, 6, 0.61);
    this.world.splat(946, [this.dripGround[0], this.dripGround[1], this.dripGround[2]], 0.34, 1, 12, 0.08);
  }

  // ---------- authoring helpers ----------
  puff(f, p0, v0, o) {
    this.puffs.push(Object.assign({ f, wt: WARP(f), p0, v0, k: 3.2, rise: 0.25, r0: 0.2, r1: 1.0, life: 1.6, tint: 0, op: 0.96, seed: this.rng() * 50 }, o));
  }
  dust(f, p, n, o) {
    const r = this.rng;
    const { speed = [2, 7], dir = [0, 0.4, 0], spread = 1, r0 = [0.12, 0.3], r1 = [0.5, 1.3], life = [0.9, 2.0], tints = [0, 0, 1], box = 0.3, k = 3.2, rise = 0.25, op = 0.96, delay = 0 } = o;
    for (let i = 0; i < n; i++) {
      const d = V.norm([dir[0] + rr(r, -spread, spread), dir[1] + rr(r, -spread * 0.5, spread * 0.7), dir[2] + rr(r, -spread, spread)]);
      const sp = rr(r, speed[0], speed[1]);
      this.puff(f + Math.floor(r() * (delay + 1)), [p[0] + rr(r, -box, box), p[1] + rr(r, -box * 0.3, box * 0.5), p[2] + rr(r, -box, box)], V.mul(d, sp),
        { k, rise, r0: rr(r, r0[0], r0[1]), r1: rr(r, r1[0], r1[1]), life: rr(r, life[0], life[1]), tint: tints[Math.floor(r() * tints.length)], op });
    }
  }
  dustRing(f, c, n, o) {
    const r = this.rng;
    const { speed = [8, 14], r0 = 0.25, r1 = 1.2, life = [1.0, 1.9], tints = [0, 1], y = 0.25, k = 3.0, split = null, lane = 0 } = o;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rr(r, -0.1, 0.1);
      if (lane && Math.abs(Math.sin(a)) < lane) continue;
      const sp = rr(r, speed[0], speed[1]);
      let tint = tints[Math.floor(r() * tints.length)];
      if (split !== null) tint = Math.cos(a) < 0 ? (r() < 0.45 ? HER_TINTS[Math.floor(r() * 5)] : 0) : (r() < 0.45 ? 2 : 0);
      this.puff(f, [c[0] + Math.cos(a) * 0.6, c[1] + y + rr(r, -0.1, 0.2), c[2] + Math.sin(a) * 0.6], [Math.cos(a) * sp, rr(r, 0, 1.4), Math.sin(a) * sp],
        { k, rise: 0.2, r0: r0 * rr(r, 0.7, 1.3), r1: r1 * rr(r, 0.6, 1.4), life: rr(r, life[0], life[1]), tint, op: 0.95 });
    }
  }
  spray(f, p, n, o) {
    const r = this.rng;
    const { owner = 'iro', dir = [0, 0.5, 0], spread = 1, speed = [3, 12], w = [0.015, 0.06], life = [0.35, 0.9], g = 12, kind = 0, box = 0.1, hole = 0 } = o;
    for (let i = 0; i < n; i++) {
      const own = owner === 'both' ? (r() < 0.5 ? 'iro' : 'sumi') : owner;
      let d = V.norm([dir[0] + rr(r, -spread, spread), dir[1] + rr(r, -spread, spread), dir[2] + rr(r, -spread, spread)]);
      if (owner === 'both') d = V.norm([own === 'iro' ? -Math.abs(d[0]) : Math.abs(d[0]), d[1], d[2]]);
      const col = own === 'iro' ? PAL[Math.floor(r() * 5)] : INKC[Math.floor(r() * 4)];
      this.drops.push({ f, wt: WARP(f), p: [p[0] + rr(r, -box, box) + d[0] * hole, p[1] + rr(r, -box, box) + d[1] * hole, p[2] + rr(r, -box, box) + d[2] * hole], v: V.mul(d, rr(r, speed[0], speed[1])), w: rr(r, w[0], w[1]) * (r() < 0.08 ? 2.2 : 1), life: rr(r, life[0], life[1]), g, kind, col });
    }
  }
  ring(f, c, n, R, dur, w, kind, o = {}) { this.rings.push(Object.assign({ f, c, n, R, dur, w, kind, alpha: 1, distort: 0, disc: false, seed: this.rng() * 10 }, o)); }
  star(f, p, size, kind, o = {}) { this.stars.push(Object.assign({ f, p, size, kind, dur: 7, seed: this.rng() * 90, spikes: 13, rot: this.rng() * 6, stretch: 1 }, o)); }

  // a complete contact: star, spikes, rings, spray in the owner's colour
  contact(f, p, scale, owner, dir, o = {}) {
    const kind = owner === 'iro' ? 0 : (owner === 'sumi' ? 1 : 2);
    const behind = !!o.behind;
    const s = 0.28 + scale * 0.088;
    if (!o.noStar) this.star(f, p, s * (o.star || 1), kind, { dur: 4 + Math.round(scale * 0.5), spikes: 9 + Math.round(scale), behind });
    if (scale >= 5 && !o.noStar) this.star(f + 1, V.add(p, V.mul(dir, behind ? 0 : 0.25)), s * 0.62 * (o.star || 1), kind, { dur: 5, spikes: 7, stretch: 1.9, behind });
    const rk = kind === 2 ? 3 : kind;
    const n = V.norm(dir);
    this.ring(f, p, n, 0.5 + scale * 0.30, 9 + scale, 0.12 + scale * 0.035, rk, { alpha: 0.95, distort: 0.006 + scale * 0.0022 });
    if (scale >= 4.8 && !o.noDisc) this.ring(f + 1, V.add(V.mad(p, n, 0.35), [0, 0, -0.7]), n, 0.7 + scale * 0.30, 10 + scale, 0.35, 2, { disc: true, alpha: 0.55 });
    if (scale >= 5.4 && !o.noDisc) this.ring(f + 2, p, [0.15, 0.1, 1], 1.0 + scale * 0.55, 13 + scale, 0.08 + scale * 0.02, rk, { alpha: 0.85, distort: 0.004 + scale * 0.0016 });
    this.spray(f, p, Math.round(8 + scale * 7), { owner, dir: V.mul(n, 0.8), spread: 1.0, speed: [4, 6 + scale * 2.1], w: [0.010, 0.018 + scale * 0.0045], hole: 0.22 + scale * 0.055 });
    this.spray(f, p, Math.round(4 + scale * 2.5), { owner: 'sumi', dir: [0, 0, 0], spread: 1, speed: [10, 14 + scale * 2], w: [0.005, 0.011], life: [0.10, 0.22], g: 0, kind: 1, hole: 0.4 + scale * 0.07 });
  }

  author() {
    const P = this.points, F = id => HIT[id].f;
    // ---- hook
    this.spray(F('H1'), P.H1, 90, { owner: 'iro', dir: [0, 0.75, 0], spread: 1.1, speed: [0.6, 2.9], w: [0.003, 0.014], g: 9, life: [0.4, 1.1], box: 0.03 });
    this.ring(F('H1'), [0, 0.02, 2.5], [0, 1, 0], 0.95, 16, 0.05, 0, { distort: 0.010, alpha: 0.9 });
    this.ring(F('H1') + 3, [0, 0.02, 2.5], [0, 1, 0], 0.7, 15, 0.025, 0, { alpha: 0.7 });
    this.dustRing(F('H1'), [0, -0.2, 2.5], 18, { speed: [0.8, 1.8], r0: 0.012, r1: 0.06, life: [0.4, 0.9], tints: [0], y: 0.22, k: 4 });
    this.star(F('H2'), P.H2, 0.62, 1, { dur: 6, spikes: 15, stretch: 2.4, rot: 0.04, keepFront: true });
    this.ring(F('H2'), [0.02, 0.04, 2.47], [0, 1, 0], 2.7, 14, 0.30, 1, { distort: 0.018 });
    this.ring(F('H2') + 2, [0.02, 0.1, 2.47], [0, 1, 0], 1.8, 12, 0.10, 2, { alpha: 0.8 });
    this.spray(F('H2'), P.H2, 130, { owner: 'sumi', dir: [0, 0.55, 0], spread: 1.1, speed: [1.5, 6.5], w: [0.006, 0.035], g: 11, box: 0.18 });
    this.dustRing(F('H2'), [0.02, -0.05, 2.47], 30, { speed: [2.2, 4.6], r0: 0.05, r1: 0.24, life: [0.7, 1.4], tints: [2, 2, 0], y: 0.12, k: 4 });

    // ---- H3 first clash
    const f3 = F('H3');
    this.contact(f3, P.H3, 7, 'both', [0, 1, 0], { star: 1.25 });
    this.ring(f3, [0.1, 0.06, 0], [0, 1, 0], 19, 24, 1.1, 3, { distort: 0.030 });
    this.ring(f3 + 3, [0.1, 0.10, 0], [0, 1, 0], 13, 24, 0.35, 3, { alpha: 0.8 });
    this.ring(f3 + 1, V.add(P.H3, [0, 0, -1.1]), [1, 0.05, 0.15], 3.6, 15, 0.5, 2, { disc: true, alpha: 0.65, distort: 0.018 });
    this.ring(f3 + 8, P.H3, [0.12, 0.06, 1], 15, 20, 0.45, 3, { distort: 0.045 });
    this.dustRing(f3 + 2, [0.1, -0.15, 0], 120, { speed: [16, 31], r0: 0.2, r1: 1.0, life: [0.8, 1.6], split: 0.1, y: 0.1, k: 2.2, lane: 0.5 });
    this.dustRing(f3 + 6, [0.1, -0.15, 0], 50, { speed: [7, 13], r0: 0.14, r1: 0.55, life: [0.7, 1.4], tints: [0, 0, 1], y: 0.1, lane: 0.6 });
    this.spray(f3, P.H3, 120, { owner: 'both', dir: [0, 0.2, -0.15], spread: 1.2, speed: [9, 30], w: [0.014, 0.060], life: [0.5, 1.2], hole: 1.05 });

    // ---- flurry
    for (const [id, dir] of [['m1', [1, 0.3, 0]], ['m2', [-1, 0.1, 0]], ['m3', [1, 0.1, 0.2]], ['m4', [-1, 0.5, 0]]]) {
      const h = HIT[id];
      this.contact(h.f, P[id], h.scale, h.owner, dir, { star: 1.75 });
      this.ring(h.f, P[id], [0.12, 0.08, 1], 1.35, 8, 0.16, h.owner === 'iro' ? 0 : 1, { alpha: 0.95, distort: 0.016 });
      this.dust(h.f, [P[id][0], 0.1, 0], 12, { speed: [2, 6], dir: [dir[0], 0.2, 0], spread: 1, r1: [0.3, 0.7], life: [0.5, 1.0], tints: h.owner === 'iro' ? [0, 9, 4] : [2, 0, 0] });
    }
    // ---- H4 + obelisk
    this.contact(F('H4'), P.H4, 5.2, 'iro', [1, 0.15, 0]);
    this.dustRing(F('H4'), [2.8, 0, 0], 34, { speed: [5, 10], tints: [0, 9, 3, 0], r1: 0.9 });
    this.dust(F('s1') + 4, [9.9, 1.8, -0.5], 26, { speed: [2, 8], dir: [0.8, 0.2, -0.2], r1: [0.7, 1.6], life: [1.2, 2.4], tints: [0, 0, 1, 0, 9], box: 0.8 });
    this.dust(F('s1') + 6, [9.8, 0.4, -0.9], 16, { speed: [1, 5], dir: [0, 0.2, 0], r1: [0.7, 1.5], life: [1.5, 3.0], tints: [0, 1], box: 1.4 });
    this.star(F('s1'), [9.4, 2.3, 0.1], 0.9, 0);
    this.ring(F('s1'), [9.5, 2.2, 0.2], [1, 0, 0.35], 3.6, 12, 0.4, 2, { disc: true, alpha: 0.7, distort: 0.012 });
    this.dust(304, [12.4, 0.15, -0.8], 12, { speed: [1, 3], r1: [0.35, 0.8], life: [0.9, 1.6], tints: [0, 1, 2] });

    // ---- H5 + wall
    this.contact(F('H5'), P.H5, 5.6, 'sumi', [-1, 0.05, 0]);
    this.dust(F('H5'), [4.6, 0.1, 0], 30, { speed: [5, 12], dir: [-1, 0.15, 0], spread: 0.7, r1: [0.5, 1.2], tints: [2, 0, 2] });
    this.dust(F('s2') + 2, [-10.1, 2.0, -0.5], 70, { speed: [3, 14], dir: [-0.95, 0.2, 0], r1: [0.8, 2.2], life: [1.4, 3.2], tints: [0, 0, 1, 2], box: 1.1 });
    this.star(F('s2'), [-9.0, 2.0, 0.2], 1.15, 1, { spikes: 15 });
    this.ring(F('s2'), [-9.3, 2.0, -0.2], [0.85, 0, 0.53], 5.2, 14, 0.5, 1, { distort: 0.020 });
    this.dust(F('s2') + 7, [-15.0, 0.15, 0.3], 40, { speed: [2, 8], dir: [-0.3, 0.5, 0], r1: [0.7, 1.7], life: [1.5, 2.8], tints: [0, 1, 2], box: 0.7 });
    this.dustRing(F('s2') + 7, [-15.0, 0, 0.3], 28, { speed: [5, 9], r1: 0.9 });
    // her flare out of the rubble
    this.ring(384, [-14.9, 0.05, 0.3], [0, 1, 0], 4.5, 12, 0.3, 0, { distort: 0.014 });
    this.spray(384, [-14.9, 1.0, 0.3], 110, { owner: 'iro', dir: [0, 0.8, 0], spread: 0.9, speed: [3, 12], w: [0.012, 0.05], g: 4, life: [0.4, 1.0], box: 0.35 });
    this.dust(389, [-15.2, 0.2, 0.3], 26, { speed: [3, 9], dir: [-0.8, 0.25, 0], r1: [0.5, 1.3], tints: [9, 3, 0, 4] });

    // ---- H6 + storefront
    this.contact(F('H6'), P.H6, 6.0, 'iro', [0.4, 1, 0]);
    this.dustRing(F('H6'), [-2.0, 0, 0], 40, { speed: [6, 12], r1: 1.0, tints: [0, 9, 3, 0, 4] });
    this.dust(F('s3'), [14.2, 2.8, -0.5], 70, { speed: [3, 13], dir: [1, 0.2, 0], r1: [0.8, 2.0], life: [1.1, 2.4], tints: [0, 0, 1, 0, 9], box: 1.2 });
    this.star(F('s3'), [13.7, 3.0, 0.2], 1.1, 0, { spikes: 14 });
    this.ring(F('s3'), [14.1, 3.0, -0.2], [0.9, 0, 0.45], 5.5, 14, 0.5, 0, { distort: 0.020 });
    this.dust(F('s4'), [20.0, 2.4, -0.3], 60, { speed: [3, 13], dir: [1, 0.15, 0], r1: [0.8, 1.9], life: [1.1, 2.4], tints: [0, 1, 0, 9, 0], box: 1.0 });
    this.star(F('s4'), [19.4, 2.5, 0.2], 1.0, 0);
    this.ring(F('s4'), [19.8, 2.4, -0.2], [0.9, 0, 0.43], 5.0, 13, 0.45, 2, { disc: true, alpha: 0.65, distort: 0.016 });
    this.dust(436, [24.6, 0.2, 0], 26, { speed: [2, 7], dir: [0.8, 0.2, 0], r1: [0.5, 1.2], tints: [0, 1, 2] });
    for (const f of [440, 443, 446]) this.dust(f, [25.2 + (f - 440) * 0.12, 0.15, 0], 10, { speed: [2, 6], dir: [-0.6, 0.4, 0], r1: [0.35, 0.8], tints: [0, 2] });

    // ---- H7 the street opens
    const f7 = F('H7');
    this.contact(f7, [26.65, 0.35, 0.35], 6.4, 'sumi', [0, 1, 0], { star: 1.2 });
    this.ring(f7, [27.2, 0.12, 0], [0, 1, 0], 13, 20, 0.8, 1, { distort: 0.026 });
    this.ring(f7 + 5, [27.2, 0.2, 0], [0, 1, 0], 9, 18, 0.3, 1, { alpha: 0.8 });
    this.dustRing(f7 + 1, [27.2, 0, 0], 56, { speed: [9, 17], r0: 0.3, r1: 1.5, tints: [0, 2, 1, 2], k: 2.6 });
    for (let x = 28; x < 62; x += 1.5) {
      const fx = f7 + 1 + Math.round((x - 26) * 0.38);
      this.dust(fx, [x, 0.1, (this.rng() < 0.5 ? -3.2 : 3.2) + (this.rng() - 0.5)], 2, { speed: [3, 9], dir: [0, 1, 0], spread: 0.5, r1: [0.6, 1.3], life: [0.9, 2.0], tints: [0, 1, 2], box: 0.4 });
    }
    // ---- H8 and the trail of wreckage
    this.contact(F('H8'), P.H8, 7.0, 'iro', [1, 0.12, 0]);
    this.dustRing(F('H8'), [28.0, 0, 0], 36, { speed: [6, 12], tints: [0, 9, 4, 0], r1: 1.0 });
    this.dust(F('s5'), [35.2, 0.9, -0.3], 40, { speed: [3, 11], dir: [0.8, 0.4, 0], r1: [0.6, 1.5], tints: [0, 1, 3, 9], box: 0.8 });
    this.star(F('s5'), [35.0, 1.2, 0.5], 1.1, 0);
    this.ring(F('s5'), [35.2, 1.1, 0], [1, 0, 0.3], 3.8, 11, 0.35, 0, { distort: 0.014 });
    this.star(F('s6'), [40.2, 1.5, 0.2], 0.7, 0);
    this.star(F('s6') + 3, [43.8, 1.6, 0.8], 0.65, 0);
    for (let x = 32; x < 50; x += 1.7) this.dust(F('H8') + Math.round((x - 31) * 1.0), [x, 0.15, 0], 5, { speed: [1.5, 5], dir: [0.6, 0.5, 0], r1: [0.5, 1.4], life: [1.2, 2.4], tints: [0, 0, 9, 4, 1], box: 0.5 });
    this.contact(F('s7'), [50.35, 1.8, 0.7], 5.8, 'iro', [-1, 0.2, 0.5]);
    this.dust(F('s7'), [50.3, 2.0, 0.3], 85, { speed: [3, 13], dir: [-0.7, 0.35, 0.5], r1: [1.0, 2.6], life: [1.4, 3.0], tints: [0, 0, 1, 1, 9], box: 1.3 });
    this.dustRing(F('s7') + 3, [50, 0, 0.5], 44, { speed: [5, 10], r1: 1.4 });

    // ---- the catch, the tower
    this.contact(F('c1'), P.c1, 3.4, 'sumi', [-1, 0.2, 0]);
    this.ring(619, [49.5, 3.4, 2.4], [0.5, 0.7, 0.2], 3.4, 10, 0.25, 1, { distort: 0.012 });
    this.contact(F('H9'), [55.2, 14.4, 2.72], 7.4, 'sumi', [0, 0.1, 1], { star: 2.1, behind: true });
    this.dust(F('H9'), [55.2, 14.2, 3.0], 70, { speed: [3, 13], dir: [-0.1, 0.1, 1], spread: 0.9, r1: [0.9, 2.3], life: [1.2, 3.0], tints: [0, 0, 1, 2], box: 1.4 });
    this.dust(F('H9') + 5, [57.8, 15.3, -2.0], 24, { speed: [2, 6], r1: [0.8, 1.8], tints: [9, 3, 4], box: 1.5 });
    this.contact(F('s8'), [64.4, 16.8, -3.8], 4.8, 'iro', [1, 0.25, 0]);
    this.dust(F('s8'), [63.9, 17, -4.4], 55, { speed: [4, 15], dir: [1, 0.2, 0], spread: 0.6, r1: [0.9, 2.2], life: [1.2, 2.8], tints: [9, 3, 4, 5, 6, 0], box: 1.2 });
    // collapse
    for (let f = 658; f < 694; f += 2) for (const x of [51, 55, 59, 63]) this.dust(f, [x, 19.5 - 0.46 * (x - 57), 2.6], 2, { speed: [1, 5], dir: [0.2, -0.2, 0.7], r1: [0.7, 1.7], life: [1.2, 2.6], tints: [0, 1], box: 0.5 });
    this.dust(F('x2'), [66, 3, -3], 90, { speed: [4, 17], dir: [0.2, 0.5, 0], spread: 1.2, r1: [1.6, 4.2], life: [2.0, 4.0], tints: [0, 0, 1, 1, 2], box: 5 });
    this.dustRing(F('x2'), [66, 0, -3], 60, { speed: [10, 20], r0: 0.8, r1: 3.0, life: [1.8, 3.4], tints: [0, 1] });

    // ---- H10 clash above the clouds
    const f10 = F('H10');
    this.contact(f10, P.H10, 8.0, 'both', [1, 0.05, 0], { star: 1.2 });
    this.ring(f10, V.add(P.H10, [0, 0, -1.3]), [1, 0.08, 0.1], 3.4, 16, 0.9, 2, { disc: true, alpha: 0.6, distort: 0.026 });
    this.ring(f10 + 2, P.H10, [0.1, 0.1, 1], 24, 26, 0.9, 3, { distort: 0.040 });
    this.ring(f10 + 6, [30, 98, 0], [0, 1, 0], 34, 26, 1.6, 3, { distort: 0.02 });
    this.spray(f10, P.H10, 110, { owner: 'both', dir: [0, 0, -0.2], spread: 1, speed: [12, 36], w: [0.018, 0.07], life: [0.5, 1.3], g: 6, hole: 1.1 });
    // cloud wall thrown outward around the new hole
    for (let i = 0; i < 90; i++) {
      const a = i / 90 * TAU, r = this.rng;
      const left = Math.cos(a) < 0;
      this.puff(f10 + 3 + Math.floor(r() * 3), [30 + Math.cos(a) * 7, 90 + rr(r, -2, 3), Math.sin(a) * 7], [Math.cos(a) * rr(r, 24, 40), rr(r, 1, 8), Math.sin(a) * rr(r, 24, 40)],
        { k: 1.9, rise: 0.3, r0: rr(r, 1.2, 2.4), r1: rr(r, 2.8, 5.4), life: rr(r, 3.6, 5.6), tint: r() < 0.66 ? 7 : (left ? HER_TINTS[Math.floor(r() * 5)] : 8), op: 0.98, big: true });
    }
    // H11
    this.contact(F('H11'), P.H11, 8.0, 'iro', [0, -1, 0], { star: 1.1 });
    this.ring(F('H11') + 1, P.H11, [0.1, 1, 0.12], 7, 16, 0.6, 2, { disc: true, alpha: 0.85, distort: 0.022 });
    this.ring(F('H11') + 7, [31, 103, 0], [0.1, 1, 0], 4.5, 12, 0.45, 2, { alpha: 0.9 });
    this.ring(777, [29.6, 84, 0], [0.1, 1, 0], 9, 12, 0.7, 2, { alpha: 0.95, distort: 0.012 });
    this.ring(783, [28.0, 55, 0], [0.1, 1, 0], 6, 12, 0.5, 2, { alpha: 0.9 });
    this.ring(790, [25.4, 15, 0], [0.1, 1, 0], 5, 8, 0.4, 2, { alpha: 0.9, distort: 0.012 });

    // ---- H12 the ground
    const f12 = F('H12');
    const g12 = groundHeight(24.5, 0, f12);
    this.contact(f12, [24.5, g12 + 0.04, 0.0], 9.0, 'iro', [0, 1, 0], { noStar: true, noDisc: true });
    this.ring(f12, [24.5, g12 + 0.07, 0], [0, 1, 0], 11, 12, 0.9, 0, { distort: 0.014 });
    this.ring(f12 + 8, [24.5, 0.4, 0], [0, 1, 0], 46, 30, 2.4, 0, { distort: 0.050 });
    this.ring(f12 + 12, [24.5, 0.8, 0], [0, 1, 0], 34, 30, 0.8, 2, { alpha: 0.75 });
    this.ring(f12 + 8, [24.5, 2, 0], [0.1, 0.05, 1], 21, 24, 0.8, 0, { distort: 0.045 });
    this.spray(f12, [24.5, g12 + 0.15, 0], 70, { owner: 'iro', dir: [0, 0.35, -0.25], spread: 1.1, speed: [12, 30], w: [0.020, 0.070], life: [0.6, 1.4], hole: 3.0 });
    this.spray(f12 + 8, [24.5, -1, 0], 260, { owner: 'iro', dir: [0, 0.9, 0], spread: 1.0, speed: [12, 36], w: [0.05, 0.2], life: [0.8, 2.0], g: 14, box: 2 });
    this.dustRing(f12 + 2, [24.5, g12 - 0.2, 0], 40, { speed: [14, 22], r1: 1.1, tints: [0, 1], lane: 0.35 });
    this.dustRing(f12 + 8, [24.5, -0.8, 0], 170, { speed: [18, 40], r0: 1.0, r1: 3.6, life: [2.0, 4.4], tints: [0, 0, 1, 0, 9, 0, 1, 1], y: 0.8, k: 1.9 });
    this.dust(f12 + 8, [24.5, -1.0, 0], 90, { speed: [6, 30], dir: [0, 1, 0], spread: 0.65, r0: [0.8, 1.6], r1: [2.0, 5.0], life: [2.2, 4.8], tints: [0, 0, 1, 1, 0, 1, 9], box: 3, k: 2.0, rise: 0.9 });
    for (const tw of this.world.sideTowers) {
      this.dust(tw.f + 2, [tw.x, 1.0, tw.z], 20, { speed: [3, 10], dir: [0, 0.3, 0], r1: [1.5, 3.4], life: [1.8, 3.4], tints: [0, 1], box: 3.5 });
      this.dust(tw.f + 26, [tw.x + Math.sign(tw.x - 24.5) * 10, 2.0, tw.z * 1.25], 30, { speed: [4, 14], dir: [0, 0.4, 0], r1: [2.0, 4.6], life: [2.0, 3.8], tints: [0, 0, 1], box: 5 });
    }
    // ---- the lull: dust settling, small
    for (let i = 0; i < 46; i++) {
      const r = this.rng, a = r() * TAU, d = rr(r, 7, 19);
      const x = 24.5 + Math.cos(a) * d, z = Math.sin(a) * d * 0.8 - 2;
      this.puff(842 + Math.floor(r() * 90), [x, groundHeight(x, z, 900) + 0.4, z], [rr(r, -0.5, 0.5), rr(r, 0.1, 0.8), rr(r, -0.5, 0.5)], { k: 0.8, rise: 0.15, r0: 0.4, r1: rr(r, 1.0, 2.4), life: rr(r, 2.5, 5), tint: r() < 0.5 ? 0 : 1, op: 0.26 });
    }
    const gl_ = groundHeight(19.6, 1, 874);
    this.dustRing(874, [19.6, gl_, 1.0], 20, { speed: [2.5, 5], r0: 0.05, r1: 0.30, life: [0.7, 1.2], tints: [0] });
    this.ring(946, [this.dripGround[0], this.dripGround[1] + 0.03, this.dripGround[2]], [0, 1, 0], 0.55, 13, 0.025, 0, { distort: 0.006 });
    this.ring(949, [this.dripGround[0], this.dripGround[1] + 0.03, this.dripGround[2]], [0, 1, 0], 0.34, 11, 0.012, 0, { alpha: 0.8 });
    this.spray(946, V.add(this.dripGround, [0, 0.03, 0]), 20, { owner: 'iro', dir: [0, 0.8, 0], spread: 0.9, speed: [0.3, 1.3], w: [0.002, 0.007], g: 7, life: [0.25, 0.55], box: 0.015 });

    // ---- launches into the last exchange
    for (const [f, x] of [[1057, 19.0], [1058, 28.0]]) {
      const y = groundHeight(x, 0.2, f);
      this.ring(f, [x, y + 0.1, 0.2], [0, 1, 0], 6, 12, 0.4, x < 23 ? 0 : 1, { distort: 0.016 });
      this.dustRing(f, [x, y, 0.2], 30, { speed: [5, 11], r1: 1.2, tints: x < 23 ? [0, 9, 4] : [2, 0] });
    }
    // ---- H13
    const f13 = F('H13'), c = P.H13;
    this.contact(f13, c, 8.6, 'both', [1, 0.1, 0], { star: 0.95 });
    this.ring(f13 + 1, V.add(c, [0, 0, -1.2]), [1, 0.05, 0.1], 4.4, 14, 0.6, 2, { disc: true, alpha: 0.65, distort: 0.026 });
    this.ring(f13 + 3, c, [0.05, 0.05, 1], 6.5, 14, 0.4, 3, { distort: 0.034 });
    this.spray(f13, c, 100, { owner: 'both', dir: [0, 0, -0.2], spread: 1, speed: [9, 32], w: [0.012, 0.050], life: [0.5, 1.5], g: 4, hole: 1.15 });
    const f14 = f13 + 8;
    for (const [dt, R, w, dur] of [[0, 30, 1.8, 18], [2, 62, 3.2, 28], [6, 105, 5.0, 36]]) this.ring(f14 + dt, [c[0], c[1], c[2]], [0.02, 0.04, 1], R, dur, w, 3, { distort: 0.055, noDepth: dt === 0 });
    for (const [dt, R, w, dur] of [[0, 90, 5, 30], [4, 150, 8, 40]]) this.ring(f14 + dt, [23.5, -2, 0], [0, 1, 0], R, dur, w, 3, { distort: 0.03 });
    this.dustRing(f14 + 1, [23.5, -5, 0], 200, { speed: [40, 90], r0: 1.6, r1: 6.5, life: [1.8, 3.8], split: 23.5, y: 2.0, k: 1.5 });
    this.dustRing(f14 + 3, [23.5, -6, 0], 90, { speed: [30, 55], r0: 1.0, r1: 4.0, life: [1.4, 2.8], tints: [0, 0, 1], y: 1.5, k: 1.6 });
    for (let i = 0; i < 110; i++) {
      const r = this.rng;
      const d = V.norm([rr(r, -1, 1), rr(r, -0.35, 0.35), rr(r, -1, 0.35)]);
      const left = d[0] < 0;
      this.puff(f14 + 4 + Math.floor(r() * 6), V.add(c, V.mul(d, 3)), V.mul(d, rr(r, 18, 70)), { k: 1.7, rise: 1.4, r0: rr(r, 0.5, 1.4), r1: rr(r, 1.8, 4.6), life: rr(r, 1.5, 4.2), tint: left ? (r() < 0.34 ? 10 + Math.floor(r() * 5) : 0) : (r() < 0.55 ? 2 : (r() < 0.6 ? 1 : 0)), op: 0.9 });
    }
    this.spray(f14, c, 520, { owner: 'both', dir: [0, 0.15, 0], spread: 1.1, speed: [20, 75], w: [0.06, 0.34], life: [0.8, 2.6], g: 8, box: 1.5 });
    // smoke still rising from the ruins in the final view
    for (let i = 0; i < 90; i++) {
      const r = this.rng, a = r() * TAU, d = rr(r, 44, 120);
      this.puff(1120 + Math.floor(r() * 50), [23.5 + Math.cos(a) * d, rr(r, 0, 3), Math.sin(a) * d * 0.85], [rr(r, -1, 1), rr(r, 1, 3), rr(r, -1, 1)], { k: 0.6, rise: 1.1, r0: 1.4, r1: rr(r, 3, 7), life: rr(r, 4, 9), tint: r() < 0.5 ? 1 : 0, op: 0.7 });
    }
  }

  // ---------- per-frame assembly ----------
  frame(f, cam, C, renderer, subjects = []) {
    const o = this.out;
    o.puffs.reset(); o.drops.reset(); o.ribbons.reset(); o.rings.length = 0; o.stars.length = 0; o.waves.length = 0; o.blobs = { n: 0, batches: [] };
    const wt = WARP(f);
    const camPos = cam.pos;
    const sub = subjects.map(q => { const d = V.sub(q.c, camPos), L = V.len(d) || 1; return { dir: V.mul(d, 1 / L), L, r: q.r }; });
    for (const p of this.puffs) {
      if (f < p.f) continue;
      const age = wt - p.wt + 0.035;
      const life = p.life * 0.80;
      if (age > life) continue;
      const e = (1 - Math.exp(-p.k * age)) / p.k;
      const pos = [p.p0[0] + p.v0[0] * e, p.p0[1] + p.v0[1] * e + p.rise * age, p.p0[2] + p.v0[2] * e];
      const u = age / life;
      let rad = (p.r0 + (p.r1 - p.r0) * (1 - Math.exp(-age * 3.6))) * (p.big ? 1 : 0.76);
      const vec = V.sub(pos, camPos), dc = V.len(vec);
      if (dc < rad * 2.4 + 0.9) continue;                      // never let a puff swallow the lens
      rad = Math.min(rad, dc * 0.13);
      let op = p.op * (1 - 0.55 * smooth(0.28, 1.0, u));
      let erode = smooth(0.30, 1.0, u);
      if (!p.big && (p.tint === 9 || (p.tint >= 3 && p.tint <= 6))) { rad *= 0.62; op *= 0.74; erode = Math.min(1, 0.16 + erode * 1.1); }
      for (const q of sub) {
        const t = V.dot(vec, q.dir);
        if (t <= 0 || t > q.L + 0.2) continue;
        const perp = Math.sqrt(Math.max(0, dc * dc - t * t));
        const need = rad * 0.95 + q.r * (t / q.L);
        if (perp < need) {
          const k = smooth(0, 0.45 * need, need - perp);
          op *= 1 - 0.92 * k; erode = Math.min(1, erode + 0.45 * k);
        }
      }
      // the big blast clears for the quiet that follows it
      if (f >= 826 && f < 1000 && p.f < 826) op *= 1 - smooth(826, 850, f) * 0.92;
      if (op < 0.04) continue;
      o.puffs.add(pos, rad, p.seed, p.tint, op, erode);
    }
    for (const d of this.drops) {
      if (f < d.f) continue;
      const age = wt - d.wt + 0.012;
      if (age > d.life) continue;
      const at = t => [d.p[0] + d.v[0] * t, d.p[1] + d.v[1] * t - 0.5 * d.g * t * t, d.p[2] + d.v[2] * t];
      const head = at(age);
      if (d.g > 0 && head[1] < groundHeight(head[0], head[2], f) - 0.02) continue;
      if (sub.length) {
        const vx = head[0] - camPos[0], vy = head[1] - camPos[1], vz = head[2] - camPos[2];
        let hidden = false;
        for (const q of sub) {
          const t = vx * q.dir[0] + vy * q.dir[1] + vz * q.dir[2];
          if (t <= 0 || t > q.L + 0.45) continue;
          if (vx * vx + vy * vy + vz * vz - t * t < Math.pow(q.r * 0.86 * t / q.L, 2)) { hidden = true; break; }
        }
        if (hidden) continue;
      }
      const tailT = Math.max(0, age - (d.kind === 1 ? 0.05 : (d.f < 40 ? 0.007 : 0.017)));
      const fade = 1 - smooth(0.72, 1, age / d.life);
      const wd = d.w * (0.4 + 0.6 * fade);
      let tail = at(tailT);
      if (d.kind === 0) { const L = V.dist(head, tail), cap = wd * 4.2; if (L > cap) tail = V.lerp(head, tail, cap / L); }
      o.drops.add(head, tail, wd, d.kind, [d.col[0], d.col[1], d.col[2], d.kind === 1 ? fade : 1]);
    }
    for (const r of this.rings) {
      const age = f - r.f;
      if (age < 0 || age >= r.dur) continue;
      const u = (age + 0.7) / (r.dur + 0.7);
      const rad = r.R * Ease.out3(u);
      const alpha = r.alpha * (1 - Math.pow(u, 2.2));
      o.rings.push({ c: r.c, n: r.n, r: rad, w: r.w * (1 - u * 0.65), seed: r.seed, disc: r.disc, alpha, kind: r.kind, noDepth: r.noDepth });
      if (r.distort > 0 && C) {
        const s = renderer.project(C, r.c);
        if (s[2] > 0.2) {
          const sr = rad / (s[2] * C.tanY * 2);
          if (sr < 1.6) o.waves.push({ c: [s[0], s[1]], r: sr, w: 0.035 + sr * 0.10, s: r.distort * (1 - u) * clamp(6 / (s[2] + 2), 0.35, 1.4) });
        }
      }
    }
    for (const s of this.stars) {
      const age = f - s.f;
      if (age < 0 || age >= s.dur) continue;
      let sp = s.p, behind = s.behind;
      if (age >= 1 && !s.keepFront && !behind) { sp = V.mad(s.p, V.norm(V.sub(s.p, camPos)), 0.55); behind = true; }
      o.stars.push({ behind, p: sp, size: s.size * (age === 0 ? 0.82 : 1 + age * 0.05), kind: s.kind, seed: s.seed + (age > 1 ? 1 : 0), spikes: s.spikes, rot: s.rot, stretch: s.stretch, age: age * (6 / s.dur) });
    }
    this.smears(f, cam);
    this.signature(f, cam, wt);
    this.burstStroke(f);
    this.wallCracks(f);
    this.ambient(f, cam, wt);
    o.waves.sort((a, b) => b.s - a.s);
    if (o.waves.length > 6) o.waves.length = 6;
    if (C) for (const [af, rmax, str] of AIRWAVE) {
      const age = f - af;
      if (age < 0 || age > 14) continue;
      const key = this.points[Object.keys(HIT).find(k => HIT[k].f === af && this.points[k])] || (af === 802 ? [24.5, 0, 0] : (af === 1092 ? this.points.H13 : null));
      let c = [0.5, 0.5];
      if (key) { const s = renderer.project(C, key); if (s[2] > 0) c = [clamp(s[0], -0.2, 1.2), clamp(s[1], -0.2, 1.2)]; }
      const u = (age + 1) / 15;
      o.waves.push({ c, r: rmax * Ease.out(u), w: 0.05 + 0.1 * u, s: str * (1 - u) });
    }
    return o;
  }

  // motion arcs on fast limbs and streaks behind bodies in flight
  smears(f, cam) {
    const A = this.anim, rib = this.out.ribbons;
    for (const kind of ['iro', 'sumi']) {
      if (!onScreen(kind, f) || (f >= 600 && f < 618)) continue;
      const fd = drawingFrame(f);
      const times = [fd - 3, fd - 2.25, fd - 1.5, fd - 0.75, fd];
      if (times[0] < 0) continue;
      const ks = A.keys[kind];
      if (ks.some(k => k.cut && k.f > times[0] && k.f <= fd)) continue;
      const rigs = times.map(t => { const s = A.sample(kind, t, t); return solveRig(kind, s.pose, s.root); });
      const view = V.norm(V.sub(cam.pos, rigs[4].J.chest));
      const rootMove = V.dist(rigs[4].J.pelvis, rigs[1].J.pelvis);
      for (const [j, wd] of [['anR', 0.105], ['anL', 0.10], ['wrR', kind === 'sumi' ? 0.17 : 0.07], ['wrL', kind === 'sumi' ? 0.15 : 0.065]]) {
        const pts = rigs.map(r => r.J[j]);
        let travel = 0; for (let i = 1; i < 5; i++) travel += V.dist(pts[i], pts[i - 1]);
        const rel = travel - V.dist(rigs[4].J.pelvis, rigs[0].J.pelvis) * 0.9;
        if (rel < 0.75 || travel > 9) continue;
        const fine = [];
        for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) {
          const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(4, i + 2)], t = k / 3;
          fine.push([0, 1, 2].map(a => 0.5 * ((2 * p1[a]) + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t * t + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t * t * t)));
        }
        fine.push(pts[4]);
        const k = clamp((rel - 0.75) / 0.8);
        const ws = fine.map((_, i) => wd * (0.15 + 0.85 * Math.pow(i / (fine.length - 1), 0.7)) * (0.55 + 0.75 * k));
        if (kind === 'iro') rib.add(fine, ws, 0, j.length + (j.endsWith('R') ? 0.3 : 1.7), j.startsWith('an') ? [1.0, 0.72, 0.10, 1] : [1.0, 0.2, 0.5, 1], view);
        else rib.add(fine, ws, 1, j.endsWith('R') ? 0.4 : 2.2, [0, 0, 0, 1], view);
      }
      if (rootMove > 2.0 && rootMove < 60 && !(f >= 794 && f < 806)) {
        const trail = [];
        for (let i = 12; i >= 0; i--) {
          const t = f - i * 0.45;
          const s = A.sample(kind, Math.max(0, t), Math.max(0, t));
          if (ks.some(k => k.cut && k.f > t && k.f <= f)) continue;
          trail.push(V.add(s.root.pos, [0, kind === 'iro' ? 0.95 : 1.2, -0.25]));
        }
        if (trail.length > 3) {
          const v2 = V.norm(V.sub(cam.pos, trail[trail.length - 1]));
          const far = clamp(V.dist(cam.pos, trail[trail.length - 1]) / 11, 1, 4.2);
          if (kind === 'iro') {
            for (const [dy, wdt, sd] of [[0.34, 0.20, 0.1], [-0.05, 0.34, 1.3], [-0.42, 0.16, 2.6]]) rib.add(trail.map(p => V.add(p, [0, dy, 0])), trail.map((_, i) => wdt * far * Math.pow(i / (trail.length - 1), 0.6)), 2, sd, [1, 1, 1, 1], v2);
          } else {
            const thin = f >= 770 && f < 794 ? 0.34 : 1;
            for (const [dy, wdt0, sd] of [[0.30, 0.42, 0.7], [-0.40, 0.30, 3.1]]) { const wdt = wdt0 * thin; rib.add(trail.map(p => V.add(p, [0, dy, -0.1])), trail.map((_, i) => wdt * far * Math.pow(i / (trail.length - 1), 0.55)), 1, sd, [0, 0, 0, 1], v2); }
          }
          for (let s = 0; s < 5; s++) {
            const off = [0, (vnoise1(s * 7.3 + Math.floor(f / 2), 3) - 0.5) * 2.4, (vnoise1(s * 3.1 + Math.floor(f / 2), 5) - 0.5) * 1.4];
            rib.add(trail.map(p => V.add(p, off)), 0.018, 3, s, [1, 1, 1, 0.9], v2);
          }
        }
      }
    }
  }

  // helper: teardrop mesh
  dropMesh(c, rx, ry, tip, kind) {
    const data = [], N = 14, M = 18;
    const P = (i, j) => {
      const ph = -Math.PI / 2 + i / N * Math.PI, th = j / M * TAU;
      const s = Math.sin(ph), k = Math.cos(ph);
      const stretch = s > 0 ? 1 + tip * Math.pow(s, 3) : 1;
      const pinch = s > 0 ? 1 - 0.55 * tip / (tip + 1) * Math.pow(s, 2) : 1;
      return { p: [c[0] + Math.cos(th) * k * rx * pinch, c[1] + s * ry * stretch, c[2] + Math.sin(th) * k * rx * pinch], n: V.norm([Math.cos(th) * k / rx, s / ry, Math.sin(th) * k / rx]) };
    };
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
      for (const k of [0, 1, 2, 0, 2, 3]) data.push(...q[k].p, ...q[k].n);
    }
    this.out.blobs.batches.push({ kind, data: new Float32Array(data) });
    this.out.blobs.n++;
  }
  crown(c, R, h, n, thick, kind, seed) {
    const data = [], M = 150, K = 5;
    const peak = a => {
      const u = a / TAU * n, i = Math.floor(u), f_ = u - i;
      const tall = 0.45 + hash1(((i % n) + n) % n * 13 + seed);
      return Math.pow(Math.max(0, 1 - Math.abs(f_ - 0.5) * 2), 2.4) * tall;
    };
    const at = (j, k) => {
      const a = j / M * TAU, v = k / K;
      const hh = h * (0.30 + 0.95 * peak(a));
      const rad = R * (0.62 + 0.42 * Math.pow(v, 0.6) + 0.10 * v * v);
      return [c[0] + Math.cos(a) * rad, c[1] + hh * Math.pow(v, 0.85), c[2] + Math.sin(a) * rad];
    };
    for (let j = 0; j < M; j++) for (let k = 0; k < K; k++) {
      const q = [at(j, k), at(j, k + 1), at(j + 1, k + 1), at(j + 1, k)];
      const nm = V.norm(V.cross(V.sub(q[1], q[0]), V.sub(q[3], q[0])));
      for (const i of [0, 1, 2, 0, 2, 3]) data.push(...q[i], ...nm);
    }
    this.out.blobs.batches.push({ kind, data: new Float32Array(data) });
    this.out.blobs.n++;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * TAU;
      const hh = h * (0.30 + 0.95 * peak(a));
      const rad = R * 1.17;
      this.dropMesh([c[0] + Math.cos(a) * rad, c[1] + hh + thick * 1.6, c[2] + Math.sin(a) * rad], thick * 0.72, thick * 0.78, 0.7, kind);
    }
  }
  signature(f, cam, wt) {
    const rib = this.out.ribbons, A = this.anim;
    const viewAt = p => V.norm(V.sub(cam.pos, p));
    // ---- the hook drop and its crown
    if (f < 18) {
      const u = f / 18;
      const y = 0.84 * (1 - Math.pow(u, 1.75)) + 0.052;
      const wob = Math.sin(f * 1.9) * 0.05;
      this.dropMesh([0, y, 2.5], 0.052 * (1 - wob), 0.056 * (1 + wob), 0.35 + u * 0.9, 0);
      for (let i = 0; i < 3; i++) this.dropMesh([Math.sin(i * 2.1) * 0.012, y + 0.15 + i * 0.07, 2.5], 0.012 - i * 0.003, 0.014 - i * 0.003, 0.5, 0);
      rib.add([[0, y + 0.62, 2.5], [0, y + 0.3, 2.5], [0, y + 0.07, 2.5]], 0.006, 3, 1, [1, 1, 1, 0.8], viewAt([0, y, 2.5]));
    } else if (f < 36) {
      const age = WARP(f) - WARP(18) + 0.02;
      const u = clamp(age / 0.2);
      if (u < 1) {
        this.crown([0, 0.0, 2.5], 0.07 + Ease.out(u) * 0.21, 0.19 * Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 17, 0.016 * (1 - u * 0.6), 0, 5);
        const rebound = Math.sin(Math.PI * clamp((u - 0.3) / 0.7));
        if (rebound > 0.02) this.dropMesh([0, 0.02 + 0.20 * rebound, 2.5], 0.022 * rebound + 0.006, 0.030 * rebound + 0.006, 0.6, 0);
      }
    }
    // ---- the single drop in the lull
    if (f >= 930 && f < 947) {
      const a = this.dripAt, g = this.dripGround;
      if (f < 939) {
        const s = smooth(929, 938, f);
        this.dropMesh([a[0], a[1] - 0.02 * s, a[2]], 0.012 + 0.012 * s, 0.012 + 0.018 * s, 1.0 - 0.3 * s, 0);
      } else {
        const u = (f - 939) / 7;
        const y = lerp(a[1] - 0.02, g[1] + 0.03, u * u);
        this.dropMesh([a[0], y, a[2]], 0.022, 0.028 + 0.012 * u, 0.8, 0);
      }
    }
    if (f >= 946 && f < 960) {
      const u = (f - 945) / 11;
      if (u < 1) this.crown(this.dripGround, 0.025 + 0.085 * Ease.out(u), 0.075 * Math.sin(Math.PI * Math.min(1, u)), 11, 0.006 * (1 - u * 0.5), 0, 9);
    }
    // ---- her flare out of the rubble
    if (f >= 382 && f < 396) {
      const c = A.position('iro', f);
      const k = smooth(382, 386, f) * (1 - smooth(391, 396, f));
      for (let i = 0; i < 22; i++) {
        const pts = [];
        const a0 = hash1(i * 19) * TAU, r0 = 0.45 + hash1(i * 7) * 0.9, hgt = (1.3 + hash1(i * 11) * 2.6) * k;
        const rise = ((f - 382) * (0.09 + hash1(i) * 0.05) + hash1(i * 3)) % 1;
        for (let j = 0; j <= 9; j++) {
          const u = j / 9, y = (rise * 0.8 + u * 0.75) * hgt;
          const rad = r0 * (1 + 0.35 * y / 3) + Math.sin(u * 5 + i + f * 0.7) * 0.10;
          pts.push([c[0] + Math.cos(a0 + u * 0.35) * rad, c[1] + 0.05 + y, c[2] + Math.sin(a0 + u * 0.35) * rad * 0.7 - 0.25]);
        }
        rib.add(pts, pts.map((_, j) => 0.12 * k * Math.sin(Math.PI * Math.min(1, j / 9 * 0.9 + 0.08))), 0, i * 0.7, [...PAL[i % 5], 1], viewAt(c));
      }
    }
    // ---- ink gathering on his palm before H5, and on both fists before H7
    for (const [f0, f1, kind, joints] of [[194, 204, 'sumi', ['wrR']], [194, 204, 'iro', ['anR']], [318, 334, 'sumi', ['wrR']], [460, 474, 'sumi', ['wrR', 'wrL']], [526, 544, 'iro', ['anL']], [746, 764, 'iro', ['anR']]]) {
      if (f < f0 || f >= f1) continue;
      const s = A.evaluate(kind, f), rg = solveRig(kind, s.pose, s.root);
      const k = smooth(f0, f0 + 6, f);
      for (const j of joints) {
        const h = rg.J[j];
        for (let i = 0; i < 14; i++) {
          const ph = hash1(i * 17 + 3);
          const t = ((f - f0) * (0.07 + ph * 0.05) + ph) % 1;
          const dir = V.norm([hash1(i * 5) - 0.5, hash1(i * 11) - 0.5, hash1(i * 23) - 0.5]);
          const tang = V.norm(V.cross(dir, [0.3, 1, 0.2]));
          const pt = q => V.add(h, V.add(V.mul(dir, (1 - q) * 1.5 + 0.1), V.mul(tang, Math.sin(q * 3.4) * 0.35 * (1 - q))));
          const pts = [pt(Math.max(0, t - 0.28)), pt(Math.max(0, t - 0.14)), pt(t)];
          if (kind === 'sumi') rib.add(pts, [0.006, 0.028 * k, 0.045 * k], 1, i, [0, 0, 0, 1], viewAt(h));
          else rib.add(pts, [0.003, 0.024 * k, 0.038 * k], 0, i, [...PAL[i % 5], 1], viewAt(h));
        }
        this.out.stars.push({ p: h, size: (kind === 'sumi' ? 0.22 : 0.26) * k * (1 + 0.14 * ((f % 4) < 2 ? 1 : -1)), kind: kind === 'sumi' ? 1 : 0, seed: Math.floor(f / 2) * 1.7, spikes: 14, rot: f * 0.21, stretch: 1, age: 2.6 });
      }
    }
    if (f >= 794 && f < 802) {
      const gy = groundHeight(24.5, 0, f);
      const k = f === 794 ? 0.82 : 1.0 + (f - 795) * 0.025;
      this.out.rings.push({ c: [24.45, gy + 0.035, -0.05], n: [0, 1, 0], r: 2.55 * k, w: 1, seed: 11, disc: true, alpha: 1, kind: 4, noDepth: false });
    }
    // ---- the shadow that spreads where he is about to land
    if (f >= 784 && f < 794) {
      const u = invlerp(784, 793, f);
      this.out.rings.push({ c: [24.5, 0.06, 0], n: [0, 1, 0], r: lerp(6.5, 2.1, u), w: 1, seed: 7, disc: true, alpha: 0.30 + 0.55 * u, kind: 5 });
      for (let k = 0; k < 2; k++) this.out.rings.push({ c: [24.5, 0.09, 0], n: [0, 1, 0], r: lerp(8, 2.0, (u * 2.2 + k * 0.5) % 1), w: 0.12, seed: k, disc: false, alpha: 0.8 * u, kind: 2 });
    }
    // ---- one stroke across the tower
    if (f >= 650 && f < 670) {
      const cut = this.world.tower.cut;
      const yAt = x => cut.p[1] - cut.n[0] / cut.n[1] * (x - cut.p[0]);
      const prog = f < 652 ? (f - 649) / 3 : 1;
      const x0 = 47.0, x1 = 68.0;
      const pts = [];
      for (let i = 0; i <= 40; i++) { const x = lerp(x0, lerp(x0, x1, prog), i / 40); pts.push([x, yAt(x), 3.2]); }
      const fade = f < 660 ? 1 : 1 - smooth(660, 670, f);
      const wdt = pts.map((_, i) => (0.10 + 0.34 * Math.sin(Math.PI * Math.min(1, i / 40 * 0.92 + 0.05))) * fade * (f < 655 ? 2.6 : 1.2));
      if (f < 660) rib.add(pts.map(p => [p[0], p[1], p[2] - 0.05]), wdt.map(w => w * 1.55), 0, 2.1, [0.97, 0.97, 0.97, 1], [0, 0, 1]);
      rib.add(pts, wdt, 5, 3.3, [0, 0, 0, 1], [0, 0, 1]);
      if (f >= 650 && f < 656) rib.add(pts.map(p => [p[0], p[1], p[2] + 0.05]), 0.09, 3, 1, [1, 1, 1, 1], [0, 0, 1]);
    }
    // ---- a paper moon rises behind him: the only white in the drained world
    if (f >= 990 && f < 1092) {
      const chest = V.add(A.position('sumi', Math.min(f, 1084)), [0, 1.65, 0]);
      const away = V.norm(V.sub(chest, cam.pos));
      const grow = Ease.back(invlerp(990, 1008, f));
      const back = 3.0;
      const dist = V.dist(chest, cam.pos);
      const ctr = V.add(V.mad(chest, away, back), [0, 0.35, 0]);
      ctr[1] = Math.max(ctr[1], groundHeight(ctr[0], ctr[2], f) + 1.2);
      this.out.rings.push({ c: ctr, n: V.neg(away), r: Math.min(4.4, 0.27 * (dist + back)) * grow, w: 1, seed: 3, disc: true, alpha: 1, kind: 4 });
    }
    // ---- ONE STROKE: ink torn out of the ground, then the colossal stroke
    if (f >= 976 && f < 1092) {
      const c = A.position('sumi', f);
      const base = groundHeight(c[0], c[2], f);
      const k = smooth(976, 992, f) * (1 - smooth(1054, 1062, f));
      if (k > 0) for (let i = 0; i < 11; i++) {
        const ph = hash1(i * 31 + 1), a = Math.PI + hash1(i * 13) * Math.PI, rad = 2.2 + hash1(i * 7) * 4.2;
        const rise = ((f - 976) * (0.022 + ph * 0.02) + ph) % 1;
        const pts = [];
        for (let j = 0; j <= 10; j++) {
          const q = j / 10, hgt = (rise * 1.25 - (1 - q) * 0.5) * (3.4 + ph * 3.2);
          const sw = a + Math.max(0, hgt) * 0.34 * (i % 2 ? 1 : -1);
          const rr_ = rad * (1 - clamp(hgt / 8) * 0.7);
          pts.push([c[0] + Math.cos(sw) * rr_, base + Math.max(0.02, hgt), c[2] - 1.6 - Math.abs(Math.sin(sw)) * rr_ * 0.65]);
        }
        rib.add(pts, pts.map((_, j) => (0.03 + 0.46 * Math.pow(Math.sin(Math.PI * Math.min(1, j / 10 * 0.82 + 0.05)), 1.5)) * k * (1 - rise * 0.45)), 1, i * 0.9, [0, 0, 0, 1], viewAt(c));
      }
      // the great arc drawn behind him
      const prog = smooth(996, 1030, f);
      if (prog > 0 && f < 1092) {
        const cx = 27.4, cy = base + 4.2, cz = -4.4, RX = 6.4, RY = 5.6;
        const fall = smooth(1056, 1082, f);
        const pts = [], ws = [];
        const N = 70;
        for (let i = 0; i <= N; i++) {
          const q = i / N * prog;
          const a = -1.15 + q * 5.45;
          pts.push([cx + Math.cos(a) * RX - fall * 1.6, cy + Math.sin(a) * RY - fall * 1.2, cz + fall * 1.5]);
          const t = q;
          ws.push((0.14 + 1.25 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.86 + 0.06)), 0.8)) * (1 - 0.35 * fall));
        }
        rib.add(pts, ws, 5, 1.7, [0, 0, 0, 1], [0, 0, 1]);
      }
      // in flight the stroke follows his fist
      if (f >= 1060 && f < 1092) {
        const s = A.evaluate('sumi', Math.min(f, 1084)), rg = solveRig('sumi', s.pose, s.root);
        const tip = V.add(rg.J.wrR, [0.15, 0, -1.25]);
        const grow = smooth(1060, 1074, f);
        for (const [dy, wdt, sd] of [[0.0, 0.85, 4.2], [0.75, 0.34, 6.1], [-0.7, 0.27, 8.4]]) {
          const pts = [], ws = [];
          for (let i = 0; i <= 30; i++) {
            const q = i / 30, back = (1 - q) * 11 * grow + 0.05;
            pts.push([tip[0] + back, tip[1] + dy * (1 - q * 0.8) - Math.pow(1 - q, 2) * 2.2 + Math.sin(q * 6 + sd) * 0.08, tip[2] - (1 - q) * 1.4]);
            ws.push(wdt * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, q * 0.78 + 0.08))));
          }
          rib.add(pts, ws, 5, sd, [0, 0, 0, 1], [0, 0, 1]);
        }
      }
    }
    // ---- PRISM COMET: every colour pulled into her, then the fall
    if (f >= 1012 && f < 1058) {
      const c = V.add(A.position('iro', f), [0, 1.0, 0]);
      const k = smooth(1012, 1022, f);
      for (let i = 0; i < 34; i++) {
        const ph = hash1(i * 29 + 5);
        const t = ((f - 1012) * (0.028 + ph * 0.018) + ph) % 1;
        const a0 = hash1(i * 3) * TAU, el = (hash1(i * 11) - 0.25) * 2.2;
        const pts = [], ws = [];
        for (let j = 0; j <= 14; j++) {
          const q = clamp(t - 0.30 + j / 14 * 0.30);
          const rad = Math.pow(1 - q, 1.25) * (7.5 + ph * 5) + 0.25;
          const a = a0 + q * 4.3;
          pts.push([c[0] + Math.cos(a) * rad, c[1] + el * rad * 0.42 + Math.sin(a * 1.7) * 0.2 * rad * 0.2, c[2] + Math.sin(a) * rad * 0.62]);
          ws.push((0.004 + 0.050 * Math.sin(Math.PI * Math.min(1, j / 14 * 0.86 + 0.04))) * k * (0.5 + t));
        }
        if (pts.some(q => V.dist(q, cam.pos) < 2.4)) continue;
        rib.add(pts, ws, 2, i * 1.3, [...PAL[i % 5], 1], viewAt(c));
      }
      const aura = smooth(1026, 1046, f);
      if (aura > 0) {
        for (let i = 0; i < 26; i++) {
          const pts = [];
          const a0 = hash1(i * 23) * TAU, r0 = 0.40 + hash1(i * 5) * 0.75;
          const rise = ((f - 1012) * (0.055 + hash1(i * 9) * 0.035) + hash1(i * 31)) % 1;
          for (let j = 0; j <= 10; j++) {
            const u = j / 10, y = (rise + u * 0.55) * (1.5 + aura * 2.6);
            const a = a0 + y * 0.55 - f * 0.12;
            const rad = r0 * (1 - 0.22 * y / 4) + 0.06 * Math.sin(u * 7 + i + f);
            pts.push([c[0] + Math.cos(a) * rad, c[1] - 0.95 + y, c[2] + Math.sin(a) * rad * 0.7 - 0.2]);
          }
          rib.add(pts, pts.map((_, j) => (0.016 + 0.10 * aura * Math.sin(Math.PI * Math.min(1, j / 10 * 0.9 + 0.06))) * aura), 0, i * 0.53, [...PAL[i % 5], 1], viewAt(c));
        }
      }
    }
    if (f >= 1062 && f < 1092) {
      const trail = [];
      const end = Math.min(f, 1084);
      for (let i = 22; i >= 0; i--) {
        const t = end - i * 0.75;
        if (t < 1058) continue;
        const s = A.sample('iro', t, t), rg = solveRig('iro', s.pose, s.root);
        trail.push(V.mad(rg.J.chest, [1, -0.2, 0], -0.1));
      }
      if (trail.length > 3) {
        const grow = smooth(1062, 1072, f);
        // extend the tail well past where she started so the comet always has a long wake
        const d0 = V.norm(V.sub(trail[0], trail[Math.min(3, trail.length - 1)]));
        for (let k = 1; k <= 8; k++) trail.unshift(V.mad(trail[0], V.norm([d0[0] - 0.6, d0[1] + 0.15, 0]), 0.9 * grow));
        const v = [0, 0, 1];
        for (const [dy, wdt, sd] of [[0, 0.80, 0.2], [0.55, 0.40, 1.7], [-0.55, 0.36, 3.2], [1.0, 0.18, 4.8], [-1.0, 0.16, 6.3]]) {
          rib.add(trail.map((p, i) => [p[0], p[1] + dy * (1 - 0.75 * Math.pow(i / (trail.length - 1), 2)), p[2] - 0.35]), trail.map((_, i) => wdt * (0.2 + 0.8 * Math.pow(i / (trail.length - 1), 0.5)) * grow), 2, sd, [1, 1, 1, 1], v);
        }
      }
    }
  }

  wallCracks(f) {
    if (f < 624 || f >= 700) return;
    const rib = this.out.ribbons;
    const c = [55.2, 14.35, 2.62];
    const grow = Ease.out3(clamp((f - 623) / 5));
    for (let i = 0; i < 17; i++) {
      const h = k => hash1(i * 61 + k);
      let a = i / 17 * TAU + (h(1) - 0.5) * 0.35, x = c[0] + Math.cos(a) * 0.55, y = c[1] + Math.sin(a) * 0.55;
      const len = (2.2 + h(2) * 4.6) * grow;
      const pts = [[x, y, c[2]]];
      const n = 9;
      for (let j = 1; j <= n; j++) {
        a += (hash1(i * 13 + j * 7) - 0.5) * 0.95;
        x += Math.cos(a) * len / n; y += Math.sin(a) * len / n;
        pts.push([x, clamp(y, 9.5, 18.6), c[2]]);
      }
      const ws = pts.map((_, j) => (0.15 - 0.138 * j / n) * (0.7 + h(3) * 0.8));
      rib.add(pts, ws.map(w => w * 1.9), 0, i * 0.3, [0.96, 0.96, 0.96, 1], [0, 0, 1]);
      rib.add(pts.map(p => [p[0], p[1], p[2] + 0.03]), ws, 0, i * 0.7, [0.01, 0.01, 0.01, 1], [0, 0, 1]);
    }
  }

  burstStroke(f) {
    if (f < 1092 || f >= 1126) return;
    const rib = this.out.ribbons, c = this.points.H13;
    const age = f - 1092;
    const grow = Ease.out3(clamp((age + 1.5) / 17));
    const die = smooth(16, 34, age);
    for (let i = 0; i < 110; i++) {
      const h = k => hash1(i * 191 + k);
      const a = (i + h(1) * 0.8) / 110 * TAU;
      let d = V.norm([Math.cos(a), Math.sin(a) * 0.82 + 0.08, (h(2) - 0.62) * 0.55]);
      const left = d[0] < 0;
      const major = i % 7 === 0;
      const len = (major ? 30 + h(3) * 22 : 8 + h(3) * 19) * grow;
      const tail = len * die * 0.96 + (major ? 0.8 : 1.6) * grow;
      if (len - tail < 0.4) continue;
      const side = V.norm(V.cross(d, [0, 0, 1]));
      const curl = (h(4) - 0.5) * 0.30;
      const pts = [], ws = [];
      for (let j = 0; j <= 12; j++) {
        const u = j / 12;
        const r = lerp(tail, len, u);
        pts.push(V.add(c, V.add(V.mul(d, r), V.mul(side, curl * r * r / 22))));
        ws.push((major ? 1.7 : 0.55 + h(5) * 0.7) * grow * (0.10 + 0.90 * Math.pow(u, 0.65)) * (u > 0.93 ? 0.55 : 1) * (1 - die * 0.55));
      }
      if (left) {
        if (i % 3 === 0) rib.add(pts, ws, 2, i * 0.77, [1, 1, 1, 1], [0, 0, 1]);
        else rib.add(pts, ws, 0, i * 0.41, [...PAL[i % 5], 1], [0, 0, 1]);
      } else {
        if (i % 6 === 0) rib.add(pts, ws.map(w => w * 0.45), 0, i * 0.41, [0.97, 0.97, 0.97, 1], [0, 0, 1]);
        else rib.add(pts, ws, 5, i * 0.91, [0, 0, 0, 1], [0, 0, 1]);
      }
      // a thrown bead at the end of each tongue
      const tip = pts[12];
      this.out.drops.add(V.mad(tip, d, 0.6 + h(6) * 3), V.mad(tip, d, 0.1), (major ? 0.55 : 0.25) * grow * (1 - die), 0, left ? [...PAL[(i + 2) % 5], 1] : [0.02, 0.02, 0.02, 1]);
    }
  }

  ambient(f, cam, wt) {
    const d = this.out.drops, rib = this.out.ribbons;
    // wind-borne grit and scraps in the stare-down and opening of the fight
    if (f >= 72 && f < 204) {
      const still = smooth(186, 193, f);
      const tt = f < 186 ? f / 24 : 186 / 24 + (f - 186) / 24 * 0.12;
      for (let i = 0; i < 150; i++) {
        const h = k => hash1(i * 97 + k);
        const x = ((h(1) * 26 - tt * (2.2 + h(2) * 3.6)) % 26 + 26) % 26 - 13;
        const y = 0.05 + Math.pow(h(3), 1.8) * 3.4 + Math.sin(tt * 3 + h(4) * 9) * 0.12;
        const z = h(5) * 9 - 3.5;
        const scrap = i % 9 === 0;
        const len = scrap ? 0.03 : 0.10 * (1 - still * 0.9);
        d.add([x, y, z], [x + len + 0.004, y + (scrap ? Math.sin(tt * 7 + i) * 0.03 : 0.004), z], scrap ? 0.022 : 0.007, scrap ? 0 : 1, [0.2 + h(6) * 0.5, 0.2 + h(6) * 0.5, 0.2 + h(6) * 0.5, scrap ? 1 : 0.8]);
      }
      for (let i = 0; i < 9; i++) {
        const h = k => hash1(i * 53 + k);
        const ph = (tt * (0.5 + h(1) * 0.4) + h(2)) % 1;
        const x = 12 - ph * 26, y = 0.3 + h(3) * 3.6, z = h(4) * 6 - 3;
        const pts = [];
        for (let j = 0; j <= 10; j++) pts.push([x + j * 0.28, y + Math.sin(j * 0.5 + i + tt * 2) * 0.08, z]);
        rib.add(pts.reverse(), 0.012, 3, i, [1, 1, 1, 0.55 * (1 - still) * Math.sin(ph * Math.PI)], [0, 0, 1]);
      }
      // the pebble that ticks in the silence
      if (f >= 186) {
        const u = (f - 186) / 5;
        const y = u < 1 ? 0.55 * (1 - u * u) + 0.03 : 0.03 + Math.max(0, Math.sin((u - 1) * 2.4)) * 0.09;
        d.add([-1.2, y, 1.9], [-1.2, y + 0.012, 1.9], 0.034, 0, [0.14, 0.14, 0.14, 1]);
      }
    }
    // ink shedding off him
    if (onScreen('sumi', f) && f >= 72 && !(f >= 794 && f < 878)) {
      for (let i = 0; i < 18; i++) {
        const period = 17 + (i % 7) * 3;
        const born = f - ((f + i * 11) % period);
        if (born < 72 || !onScreen('sumi', born)) continue;
        const age = (f - born) / 24;
        if (age > 0.55) continue;
        const s = this.anim.evaluate('sumi', born), rg = solveRig('sumi', s.pose, s.root);
        const j = ['wrL', 'wrR', 'elL', 'elR', 'head', 'wrL', 'wrR', 'shR'][i % 8];
        const p0 = V.add(rg.J[j], [(hash1(i * 7 + born) - 0.5) * 0.2, -0.06 + (j === 'head' ? 0.18 : 0), (hash1(i * 5 + born) - 0.5) * 0.2]);
        const jump = f - born > 3 && this.anim.velocity('sumi', born).reduce((a, b) => a + Math.abs(b), 0) > 20;
        if (jump) continue;
        const y = p0[1] - 5.5 * age * age;
        if (y < groundHeight(p0[0], p0[2], f)) continue;
        d.add([p0[0], y, p0[2]], [p0[0], y + 0.03 + age * 0.22, p0[2]], 0.011 + hash1(i) * 0.012, 0, [0.02, 0.02, 0.02, 1]);
      }
    }
    // ash in the lull and after the end
    const lull = f >= 838 && f < 1000, after = f >= 1128;
    if (lull || after) {
      const t = wt;
      const n = after ? Math.round(lerp(420, 170, smooth(1150, 1180, f))) : 340;
      for (let i = 0; i < n; i++) {
        const h = k => hash1(i * 131 + k + (after ? 7 : 0));
        const R = after ? 60 : 20;
        const x = 24 + (h(1) - 0.5) * R * 2 + Math.sin(t * 0.9 + h(2) * 9) * 0.35;
        const z = (h(3) - 0.5) * R * 1.4 + Math.cos(t * 0.7 + h(4) * 9) * 0.3;
        const top = after ? 30 : 8;
        const y = ((h(5) * (top + 6) - t * (0.35 + h(6) * 0.5)) % (top + 6) + top + 6) % (top + 6) - 5;
        if (V.dist([x, y, z], cam.pos) < 1.0) continue;
        const colour = after && i % 3 === 0;
        const col = colour ? [...PAL[i % 5], 1] : [0.72, 0.72, 0.72, 0.9];
        const col2 = !colour && i % 4 === 0 ? [0.08, 0.08, 0.08, 1] : col;
        d.add([x, y, z], [x + 0.012, y + 0.028, z], (after ? 0.05 : 0.012) * (0.5 + h(7)), 0, col2);
      }
    }
    // falling through the sky: vertical air streaks
    if (f >= 770 && f < 794) {
      const c = this.anim.anchor('sumi', f, 1.0);
      for (let i = 0; i < 60; i++) {
        const h = k => hash1(i * 71 + k);
        const x = c[0] + (h(1) - 0.5) * 16, z = c[2] + (h(2) - 0.5) * 9;
        const y = c[1] + (((h(3) * 24 + f * 3.3) % 24) - 12);
        if (y < 1) continue;
        d.add([x, y, z], [x, y - 1.6 - h(4) * 2, z], 0.018, 2, [1, 1, 1, 0.75]);
      }
    }
  }
}

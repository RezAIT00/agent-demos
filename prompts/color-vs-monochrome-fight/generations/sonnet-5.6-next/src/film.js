// film.js — assembles everything for one frame. renderFrame(f) is a pure function of f.
const keyf = (f, table) => {
  if (f <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (f <= table[i][0]) { const [a, va] = table[i - 1], [b, vb] = table[i]; return lerp(va, vb, smooth(a, b, f)); }
  return table[table.length - 1][1];
};

// sky paint: [frame, dir, angular radius, type(1 colour, 2 ink), seed, grow frames]
const SKY_SPLATS = [
  [206, [-0.62, 0.34, -0.72], 0.40, 1, 0.2, 14], [206, [0.62, 0.34, -0.72], 0.40, 2, 0.7, 14],
  [336, [-0.80, 0.22, -0.55], 0.24, 2, 1.9, 9], [406, [0.30, 0.52, -0.80], 0.30, 1, 3.1, 9],
  [476, [0.78, 0.30, -0.55], 0.30, 2, 4.4, 12], [546, [0.55, 0.18, -0.82], 0.28, 1, 5.2, 9],
  [706, [-0.94, 0.02, -0.34], 0.72, 1, 6.8, 16], [706, [0.94, 0.02, -0.34], 0.72, 2, 7.9, 16],
  [798, [-0.05, 0.40, -0.92], 0.42, 1, 8.6, 20], [1093, [-0.55, 0.30, -0.78], 0.9, 1, 9.4, 18],
];
const GLASS = [[204, [0, 3, -19], 46, 22], [564, [51, 4, 2], 13, 8], [624, [55, 14.5, 2.5], 7, 4], [636, [63.5, 17, -4], 8, 4], [806, [24, 9, -26], 38, 16], [1092, [23.5, 6, 0], 260, 22]];
// contact flashes of chromatic aberration and local air pressure
const CA_HITS = [[54, 0.5], [204, 1.6], [244, 0.5], [254, 0.6], [264, 0.5], [274, 0.6], [284, 1.0], [334, 1.1], [404, 1.2], [474, 1.2], [544, 1.3], [564, 0.8], [624, 1.3], [704, 1.6], [764, 1.4], [794, 0.7], [802, 1.6], [1084, 1.8], [1092, 2.4]];

class Film {
  constructor(R) {
    this.R = R;
    this.world = new World();
    this.anim = new Animator();
    this.fx = new FX(this.world, this.anim);
    this.dir = new Director(this.anim);
    this.dir.fx = this.fx;
    R.setWorldGeometry(this.world);
    this.cu = document.createElement('canvas'); this.cu.width = 1920; this.cu.height = 1080;
    // CPU rasterisation: the GPU canvas path is not bit-stable from run to run
    this.cuCtx = this.cu.getContext('2d', { willReadFrequently: true });
    this.ov = document.createElement('canvas'); this.ov.width = 1920; this.ov.height = 1080;
    this.ovCtx = this.ov.getContext('2d', { willReadFrequently: true });
  }

  wind(f) {
    const gust = 1 + 0.28 * Math.sin(f * 0.19) + 0.18 * Math.sin(f * 0.47 + 1.7);
    if (f < 72) return [0.05, 0.0, 0.0];
    if (f < 188) return V.mul([-0.62, 0.07, 0.10], gust);
    if (f < 194) return V.mul([-0.62, 0.07, 0.10], 1 - smooth(188, 193, f));
    if (f >= 840 && f < 976) return V.mul([-0.20, 0.02, 0.05], gust * 0.7);
    if (f >= 976 && f < 1058) return V.mul([0.0, 0.75 * smooth(980, 1015, f), 0.0], gust);
    if (f >= 1132) return V.mul([-0.28, 0.05, 0.06], gust);
    return [-0.16, 0.03, 0.04];
  }
  env(kind, f, rig) {
    const fd = drawingFrame(f);
    const vel = this.anim.velocity(kind, f);
    let w = this.wind(fd);
    // pressure waves from nearby impacts throw hair and cloth
    const centre = rig.J.chest;
    for (const h of HITDATA.hits) {
      const age = fd - h.f;
      if (age < 0 || age > 30) continue;
      const p = this.fx.points[h.id];
      if (!p) continue;
      const d = V.sub(centre, p), dist = V.len(d);
      if (dist > 26) continue;
      const k = h.scale * 0.20 * Math.exp(-age / 8) / (1 + dist * 0.09);
      w = V.mad(w, V.norm(d), k * (1 + 0.35 * Math.sin(age * 1.3)));
    }
    const limit = (v, m) => { const l = V.len(v); return l > m ? V.mul(v, m / l) : v; };
    const hair = limit(V.mad(w, vel, -0.060), 1.7);
    const cloth = limit(V.mad(V.mul(w, 1.35), vel, -0.080), 2.3);
    return { time: fd / 24, floor: groundHeight(rig.J.pelvis[0], rig.J.pelvis[2], f), drag: { hair, cloth } };
  }
  character(kind, f) {
    const s = this.anim.evaluate(kind, f);
    const rig = solveRig(kind, s.pose, s.root);
    const ch = { kind, rig, env: this.env(kind, f, rig), boil: Math.floor(f / 2) % 7 };
    if (s.stretch && Math.abs(s.stretch - 1) > 0.02) {
      let axis = this.anim.velocity(kind, f + 1);
      if (V.len(axis) < 3) axis = this.anim.velocity(kind, f + 3);
      if (V.len(axis) < 3) axis = [0, 1, 0];
      const k = s.stretch;
      ch.stretch = { axis, along: 1 + (k - 1) * 0.8, across: 1 / Math.sqrt(1 + (k - 1) * 0.8) };
    }
    if (f >= 760 && f < 794 && kind === 'sumi') ch.lineScale = 1.15;
    return ch;
  }

  paint(f) {
    const P = { splats: this.world.paintState(f) };
    // ONE STROKE drains the world to ink; the last impact gives it back
    if (f >= 976 && f < 1092) {
      const r = keyf(f, [[976, 0.1], [986, 9], [996, 34], [1010, 200], [1091, 260]]);
      P.drain = [27.6, -3, 0, r];
    }
    if (f >= 1146) P.bloom = [23.5, 0, 27.5 * Ease.io(invlerp(1147, 1180, f)) + 0.01, smooth(1146, 1153, f)];
    // ash from the collapse settles over the quiet; later it mutes everything outside the final crater
    if (f >= 826 && f < 1004) P.ash = [keyf(f, [[826, 0], [850, 1.0], [976, 1.0], [1003, 0]]), 24, 0, 0];
    if (f >= 1108) {
      // pale ash, like paper, falls over everything the blast left behind
      P.ash = [lerp(0.96 * smooth(1108, 1130, f), 1.04, smooth(1140, 1150, f)), 23.5, 31, 1.0];
      P.ashLum = lerp(0.50, 0.80, smooth(1141, 1150, f));
    }
    return P;
  }
  sky(f, cam) {
    const splats = [];
    for (const [sf, dir, r, type, seed, grow] of SKY_SPLATS) {
      if (f < sf) continue;
      let alpha = 0.96;
      if (f >= 1092 && sf < 1092) alpha *= 1 - smooth(1092, 1100, f);
      if (alpha > 0) splats.push({ dir: V.norm(dir), r: r * Ease.out3(invlerp(sf - 1, sf + grow, f)), type, seed, alpha });
    }
    const dark = keyf(f, [[0, 0.0], [200, 0.0], [212, 0.12], [480, 0.2], [700, 0.04], [706, 0.14], [770, 0.16], [785, 0.56], [793, 0.54], [795, 0.1], [810, 0.34], [900, 0.2], [975, 0.3], [1006, 0.86], [1091, 0.9], [1094, 0.25], [1140, 0.0], [1199, 0.0]]);
    const sk = { splats, dark, altitude: cam.pos[1] > 62, erase: f >= 1094 ? Ease.out(invlerp(1094, 1126, f)) : 0 };
    if (f >= 978 && f < 1092) sk.drain = [0.86, 0.12, -0.5, keyf(f, [[978, 0.0], [996, 1.3], [1012, 3.9], [1091, 3.9]])];
    if (f >= 1118) sk.bloom = 1.05 * Ease.out(invlerp(1118, 1168, f));
    return sk;
  }

  blurFor(f, cam, C) {
    const out = { blur: [0, 0], radial: 0 };
    if (f <= cam.shotStart || (cam.opts && cam.opts.noBlur)) return out;
    const prev = this.dir.base(f - 1, cam.shot);
    const gh = groundHeight(prev.pos[0], prev.pos[2], f - 1);
    if (prev.pos[1] < gh + 0.18) prev.pos = [prev.pos[0], gh + 0.18, prev.pos[2]];
    const pc = this.R.camera(prev);
    const now = this.R.camera(Object.assign({}, cam, { sx: 0, sy: 0 }));
    const probe = V.mad(cam.pos, now.fwd, V.dist(cam.pos, cam.tgt));
    const a = this.R.project(pc, probe);
    if (a[2] > 0) {
      const dx = 0.5 - a[0], dy = 0.5 - a[1], l = Math.hypot(dx, dy);
      if (l > 0.055) { const k = Math.min(l - 0.055, 0.07) / l * 0.55; out.blur = [dx * k, dy * k]; }
    }
    const d0 = V.dist(prev.pos, prev.tgt), d1 = V.dist(cam.pos, cam.tgt);
    const zr = Math.abs(d1 / d0 - 1);
    if (zr > 0.12) out.radial = Math.min(0.055, (zr - 0.12) * 0.14);
    return out;
  }

  post(f, cam, C, fxOut) {
    const P = { waves: fxOut.waves.slice(), bloom: 0.20, vig: 0.28, grain: 0.032, halo: 1 };
    let ca = 0;
    for (const [hf, k] of CA_HITS) { const age = f - hf; if (age >= 0 && age < 16) ca += k * Math.exp(-age / 3.2); }
    P.ca = Math.min(ca, 2.2);
    const mb = this.blurFor(f, cam, C);
    P.blur = mb.blur; P.radial = mb.radial;
    const uvOf = spec => {
      let p = spec;
      if (spec[0] === 'pt') p = this.fx.points[spec[1]];
      else if (typeof spec[0] === 'string') { const s = this.anim.evaluate(spec[0], f); p = solveRig(spec[0], s.pose, s.root).J[spec[1]]; }
      const s = this.R.project(C, p);
      return s[2] > 0 ? [clamp(s[0], -0.1, 1.1), clamp(s[1], -0.1, 1.1)] : [0.5, 0.5];
    };
    P.radialC = [0.5, 0.5];
    for (const [a, b, amt, dark, focus, inner] of SPEED) {
      if (f < a || f >= b) continue;
      const edge = Math.min(1, (f - a + 1) / 2, (b - f) / 2);
      P.speed = amt * edge; P.speedDark = !!dark; P.speedC = uvOf(focus); P.speedInner = inner;
    }
    const hitPoint = () => {
      let best = null;
      for (const h of HITDATA.hits) if (h.f <= f && this.fx.points[h.id] && (!best || h.f > best.f)) best = h;
      if (!best) return [0.5, 0.5];
      const s = this.R.project(C, this.fx.points[best.id]);
      return s[2] > 0 ? [clamp(s[0], 0.1, 0.9), clamp(s[1], 0.1, 0.9)] : [0.5, 0.5];
    };
    if (IMPACT[f]) {
      const [mode, seed, thr] = IMPACT[f];
      P.impact = mode; P.impactSeed = seed; P.impactThr = thr; P.impactC = hitPoint();
      P.blur = [0, 0]; P.radial = 0; P.ca = 0; P.waves = []; P.speed = 0;
    }
    for (const [a, b, r0, r1] of CRACKS_SCREEN) if (f >= a && f < b) { P.crack = lerp(r0, r1, Ease.out(invlerp(a, b - 1, f))); P.crackC = hitPoint(); }
    // the one sustained white-out, as the last impact opens
    if (f >= 1093 && f < 1103) {
      const a = keyf(f, [[1093, 0.0], [1094.5, 0.66], [1095.5, 0.62], [1101, 0.0]]);
      if (a > 0) P.flash = [0.95, 0.95, 0.95, a];
    }
    if (f >= 976 && f < 1092) P.vig = lerp(0.28, 0.55, smooth(976, 1012, f));
    if (f >= 1070 && f < 1084) { P.vig = 0.62; }
    P.haze = (f >= 1000 && f < 1056) ? smooth(1000, 1030, f) * 0.45 : 0;
    P.bloom = f >= 1092 && f < 1130 ? 0.34 : 0.20;
    // the calm zone behind SUMI is for busy wide and medium shots, not for portraits or the drained world
    const camGap = V.dist(cam.pos, this.anim.anchor('sumi', f, 1.4));
    P.quiet = smooth(3.0, 7.5, camGap) * (f >= 980 && f < 1092 ? 0.45 : 1) * (f >= 1146 ? 0 : 1);
    if (f >= 1150) P.halo = lerp(1.0, 1.7, smooth(1150, 1176, f));
    // fighters stay findable in the big pull-backs
    if (f >= 218 && f < 244) P.halo = 1.7;
    return P;
  }

  // what must stay visible this frame
  subjects(f) {
    const out = [];
    for (const kind of ['iro', 'sumi']) {
      if (!onScreen(kind, f)) continue;
      const s = this.anim.evaluate(kind, f), rg = solveRig(kind, s.pose, s.root);
      const big = kind === 'sumi' ? 1.25 : 1.0;
      out.push({ c: rg.J.chest, r: 0.78 * big }, { c: rg.J.pelvis, r: 0.70 * big }, { c: rg.J.head, r: 0.55 * big });
    }
    return out;
  }
  renderFrame(f) {
    const R = this.R;
    for (const [a, b, draw, mono] of CLOSEUPS) {
      if (f < a || f >= b) continue;
      this.cuCtx.reset();                       // no canvas state may leak between frames
      draw(this.cuCtx, f - a, f);
      const lf = f - a;
      const post = { bloom: 0.12, grain: 0.030, vig: 0.30, monoAll: mono };
      if (draw === drawCloseupIro && lf >= 6 && lf < 12) post.speed = 0.5 * (1 - (lf - 6) / 6);
      if (draw === drawCloseupSumi && lf >= 9 && lf < 15) { post.speed = 0.55 * (1 - (lf - 9) / 6); post.speedDark = true; }
      if (post.speed) post.speedInner = 0.55;
      R.render({ closeup: this.cu, frame: f, time: f / 24, post });
      return;
    }
    const cam = this.dir.camera(f);
    const C = R.camera(cam);
    const subjects = this.subjects(f);
    this.world.update(f, cam, subjects);
    const chars = [];
    for (const kind of ['sumi', 'iro']) if (onScreen(kind, f)) chars.push(this.character(kind, f));
    if (f >= 976 && f < 1092) for (const ch of chars) if (ch.kind === 'sumi') ch.rimDir = V.norm([0.2, 0.6, -0.7]);
    const sky = this.sky(f, cam);
    const fxOut = this.fx.frame(f, cam, C, R, subjects);
    const ground = this.world.groundState(f);
    if (f >= 1146) ground.enso = [23.5, 0, 31.0, Ease.io(invlerp(1147, 1174, f))];
    const aerial = smooth(20, 60, cam.pos[1]);
    const fogGrey = lerp(0.76, 0.34, sky.dark);
    const so = cam.opts || {};
    const shadowR = so.shadow || 16;
    const S = {
      camera: cam, chars, frame: f, time: f / 24, world: this.world,
      ground, paint: this.paint(f), sky,
      glass: GLASS.filter(g => f >= g[0]).map(g => ({ p: g[1], r: g[2] * Ease.out(invlerp(g[0] - 1, g[0] + g[3], f)) })).slice(-6),
      shadow: (so.sky || f >= 1093 && f < 1105) ? null : { center: [cam.tgt[0], Math.min(cam.tgt[1], 3), cam.tgt[2]], radius: shadowR },
      env: { fogCol: [fogGrey, fogGrey, fogGrey], fogDen: lerp(0.0085, 0.0018, aerial) * (f >= 1140 ? 1 - 0.7 * smooth(1150, 1175, f) : 1), dim: keyf(f, [[0, 1], [1068, 1], [1076, 0.74], [1083, 0.62], [1085, 1], [1199, 1]]) },
      macro: f < 34,
      puffs: fxOut.puffs,
      fx: { ribbons: fxOut.ribbons, drops: fxOut.drops, rings: fxOut.rings, stars: fxOut.stars, blobs: fxOut.blobs },
    };
    if (so.sky) {
      const hr = f < 704 ? 0 : (f < 764 ? 20 * Ease.out3(invlerp(703, 716, f)) : 20 + 9 * Ease.out3(invlerp(763, 774, f)));
      S.clouds = { y: 90, hole: [30, 0, hr, 1] };
      S.sky.altitude = true;
    }
    S.post = this.post(f, cam, C, fxOut);
    if (f >= 1170) { this.ovCtx.reset(); if (drawTitle(this.ovCtx, f)) S.overlay = this.ov; }
    R.render(S);
  }
}

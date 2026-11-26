// ---------- ACT 5-7: power-up, title, stinger ----------
SHOTFN.falling = (F, u, ua) => {
  const drop = 0.26 * u * u + 0.34 * u;
  const k = easeInOut(clamp(u / 2.25));
  const c = lerpCam(cam([0.75, 1.26, 6.4], [0.35, 1.12, 0], 30, 0.03), cam([0.55, 1.05, 4.9], [0.28, 1.12, 0], 30, 0.085), k);
  const closing = smooth(1.25, 1.75, u);
  const v = view3d(F, {
    cam: c, env: { mode: 7, time: u * 0.25, scroll: 7.2, ground: 0, sun: [-0.42, 0.04 + drop * 0.03, -0.9], dim: lerp(1.0, 0.62, k) },
    light: Object.assign({}, LIGHT.sunset, { dir: [0.2, 0.55, 0.65], lit: vlerp(LIGHT.sunset.lit, [0.74, 0.66, 0.86], k), shade: vlerp(LIGHT.sunset.shade, [0.48, 0.38, 0.66], k) }), noShadow: true,
    scene: (mb, out) => {
      hero(mb, out, { root: M4.about([0.05, 0.8, 0], M4.Rz(-0.05 - 0.16 * k + 0.015 * Math.sin(ua * 4))), t: ua * 0.45, wind: 0.28, neck: 'ride', head: { yaw: -0.18, pitch: lerp(0.10, -0.20, closing) }, beakOpen: 0.11 * (1 - closing), brow: -0.35, scarf: { wind: 0.34, lift: 0.95 } }, { wheel: 9 + ua * 1.4, crank: 0.2, blur: 0.12 });
      // the far ledge rises out of reach, with the Peregrine already on it
      mb.push(M4.T([-0.5, drop * 1.15, 0]));
      rival(mb, out, { root: M4.chain(M4.T([2.95, 0.30, -0.7]), M4.S(0.84)), t: ua * 0.5, wind: 0.4, neck: 'sit', head: { yaw: -2.55, pitch: -0.28 } }, { wheel: 1, crank: 0.1 });
      ledgeLip(mb, 2.18, 16, 0.30, -1.7, 0.4, 511);
      buildPrism(mb, [[16, 0.30], [2.20, 0.30], [1.93, 0.16], [2.17, -0.40], [1.81, -0.82], [2.33, -1.40], [2.11, -2.2], [2.63, -3.1], [2.35, -4.4], [3.05, -5.8], [2.75, -9], [16, -9]], -1.7, 0.4, MAT.silRock, 504, 1.0);
      mb.pop();
    }, eyes: { hero: u < 0.5 ? { open: 1, mode: 1, brow: -0.5, lookY: 0.2 } : { open: lerp(1, 0, closing), mode: closing > 0.92 ? 5 : 0, brow: -0.35, pupil: 0.8, lookX: 0.2, lookY: -0.2 }, falcon: { open: 0.9, mode: 4, brow: 1.0 } }
  });
  const g = fxLayer(F);
  const b = v.P('belly');
  for (let i = 0; i < 3; i++) featherBurst(g, b[0] - 140 + i * 130, b[1] + 80, u - 0.15 - i * 0.45, 61 + i, { n: 5, gravity: -150, lift: 190, s: 0.8, wind: -60 });
  g.strokeStyle = 'rgba(255,225,210,0.34)'; g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 24; i++) { const x = hash2(i, 131) * W, span = H + 300, y = span - ((hash2(i, 132) * span + u * (500 + 700 * hash2(i, 133))) % span) - 100; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 40 + 110 * hash2(i, 134)); g.stroke(); }
  F.post = { vig: 0.42 + 0.25 * k + 0.10 * Math.max(pulse(u, bt(0.2), 0.3), pulse(u, bt(2.2), 0.3), pulse(u, bt(4.2), 0.3)), bloom: 0.35, sat: lerp(1.05, 0.46, k), letter: 0.085, fade: smooth(2.12, 2.25, u) * 0.55 };
};

SHOTFN.flashback = (F, u) => {
  const i = Math.min(3, Math.floor(u / BE + 1e-4)), lu = u - i * BE;
  const src = [['wobble', 0.70, 0.74], ['crash', 0.40, 0.72], ['rainfall', 0.40, 1.28], ['down', 0.28, 1.30]][i];
  const t = src[1] + lu * 0.42;
  F.S = TL.byId[src[0]];
  SHOTFN[src[0]](F, t, twos(t), F.S);
  F.type = null;
  const gn = src[2] * (1 - 0.10 * i);
  F.post = { vig: 0.78, bloom: 0.15, sepia: 0.88, gain: [gn, gn * 0.96, gn * 0.95], letter: 0.085, grain: 0.07, shake: [0, 0, 1.06 + lu * 0.18, (i % 2 ? 1 : -1) * 0.02], chroma: 1.2 };
  const tx = typeLayer(F);
  const words = ['EVERY WOBBLE.', 'EVERY CRASH.', 'EVERY NIGHT.', 'EVERY TIME.'];
  slamText(tx, words[i], 960, 868, 96, lu, 0.0, { from: 1.28, jolt: 7, drift: 0.12, layers: [['#10060f', 11]] });
};

function auraFlames2D(g, t, k, seed) {
  g.save();
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = ['rgba(232,52,40,0.78)', 'rgba(255,184,28,0.86)', 'rgba(255,248,200,0.92)'][layer];
    const H0 = [330, 215, 105][layer] * k;
    for (const flip of [0, 1]) {
      g.beginPath(); const base = flip ? -10 : H + 10, dir = flip ? 1 : -1, amp = flip ? 0.45 : 1;
      g.moveTo(-20, base);
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const x = i / n * (W + 40) - 20; const edge = 0.45 + 0.9 * Math.pow(Math.abs(i / n - 0.5) * 2, 1.6);
        const h = H0 * amp * edge * (0.55 + 0.75 * Math.abs(fbm1(i * 0.9 + t * 7.5, seed + layer + flip * 9)) + 0.25 * hash2(i, Math.floor(t * 12) + layer));
        g.quadraticCurveTo(x - 36, base + dir * h * 0.26, x - 6 + Math.sin(t * 13 + i) * 18, base + dir * h);
        g.quadraticCurveTo(x + 16, base + dir * h * 0.40, x + 38, base + dir * h * 0.16);
      }
      g.lineTo(W + 20, base); g.closePath(); g.fill();
    }
  }
  g.restore();
}
SHOTFN.eyesnap = (F, u) => {
  const g = fxLayer(F), tOpen = bt(138.5) - bt(138);
  const k = u < tOpen ? 0 : clamp((u - tOpen) / 0.085);
  const open = k <= 0 ? 0 : easeOutBack(k, 3.0);
  const glint = u < tOpen + 0.04 ? 0 : Math.max(0, 1 - (u - tOpen - 0.04) / 0.34);
  const jolt = pulse(u, tOpen, 0.3);
  const lit = smooth(tOpen - 0.02, tOpen + 0.08, u);
  g.save(); g.translate(fbm1(u * 46, 41) * 26 * jolt, fbm1(u * 46, 42) * 26 * jolt);
  drawEyeCloseup(g, { pal: 'gold', t: u + 3, open, glint, zoom: 1.08 + u * 0.12 + 0.08 * lit, brow: 1.5, pupil: 0.62, dim: 0.56 * (1 - lit) });
  g.restore();
  if (lit > 0) { auraFlames2D(g, u, 0.45 + 0.55 * clamp((u - tOpen) / 0.4), 5); speedRadial(g, 960, 560, F.draw, { inner: 560, alpha: 0.5 * lit, n: 100, color: '#fff2b8' }); }
  F.post = { vig: 0.42, bloom: 0.52, bloomThr: 0.88, chroma: 2 * jolt, letter: 0.085 * (1 - lit) };
};

const goldAura = (amt, o = {}) => Object.assign({ amt, len: 0.19, halo: 0.019, c0: AURA.gold.c0, c1: AURA.gold.c1, c2: AURA.gold.c2, min: 0.90, max: 1.1 }, o);
SHOTFN.ignite = (F, u, ua) => {
  const k = clamp(u / 0.75);
  const c = lerpCam(cam([2.75, 0.42, 3.35], [0.10, 1.12, 0], 34, -0.10), cam([2.05, 0.40, 2.55], [0.14, 1.16, 0], 33, -0.04), easeIn(k));
  const v = view3d(F, {
    cam: shake(c, u, 0.008 + 0.035 * k, 31), env: { mode: 8, time: u * (0.4 + k), vanish: [0.5, 0.46], dim: lerp(0.22, 0.52, k) }, light: LIGHT.power, noShadow: true,
    scene: (mb, out) => hero(mb, out, { t: ua, wind: lerp(0.3, 1, k), neck: { a: 'ride', b: 'proud', k: easeInOut(k) }, brow: 1, crestRaise: easeOutBack(k), scarf: { wind: lerp(0.3, 1, k), lift: lerp(0.1, 0.62, k), len: 1.35 }, wing: { spread: 0.20 * smooth(0.35, 0.75, ua), curl: 1 } }, drive(0.3 + ua * ua * 12, { blur: 0.2 + ua * 2.6 })),
    discBlur: 1, eyes: { hero: { open: 1, brow: 1.4, glow: 0.85, glowCol: [1.0, 0.97, 0.62], pupil: 0.7 } }
  });
  const g = fxLayer(F);
  embers(g, u * 2.4 + 1, { n: Math.floor(40 + 90 * k), stretch: 3.4 });
  for (let i = 0; i < 3; i++) shockRing(g, v.P('chest')[0], v.P('chest')[1] + 120, u - i * BE * 0.66, { r: 900, color: i % 2 ? '#ffd23c' : '#fff6d0', w: 30, life: 0.42, flat: 0.36 });
  F.post = { vig: 0.38, bloom: 0.26 + 0.12 * k, bloomThr: 0.90, aura: goldAura(smooth(0.0, 0.34, u), { len: 0.06 + 0.13 * k }), chroma: 1.5 * k };
};

SHOTFN.scream = (F, u, ua) => {
  const k = easeOutBack(clamp(ua / 0.26), 1.7);
  const push = easeInOut(clamp(u / 0.75));
  const c = lerpCam(cam([3.95, 0.56, 1.12], [0.10, 1.44, 0], 41, -0.04), cam([3.45, 0.50, 0.96], [0.12, 1.47, 0], 41, 0.02), push);
  const v = view3d(F, {
    cam: shake(c, u, 0.007, 40), env: { mode: 8, time: u * 0.22, vanish: [0.5, 0.50], dim: 0.40 }, light: LIGHT.power, noShadow: true, focus: [0, 1.3, 0], shadowSize: 2.4,
    scene: (mb, out) => hero(mb, out, { t: ua * 0.55, wind: 1, neck: { a: 'proud', b: 'sky', k: clamp(ua / 0.22) }, head: { pitch: -0.18 + 0.03 * Math.sin(ua * 47), yaw: -0.30 }, beakOpen: 0.60 * clamp((ua - 0.04) / 0.16), crestRaise: 1, brow: 1, eyeFwd: 0.2, wing: { spread: clamp(k, 0, 1.08), flap: 0.10 * Math.sin(ua * 20) }, scarf: { wind: 1, lift: 0.70, len: 1.45 } }, drive(5 + ua * 15, { blur: 2.4 })),
    discBlur: 2, eyes: { hero: { open: 1.0, brow: 1.6, glow: 1.0, glowCol: [1.0, 0.98, 0.72], pupil: 0.55 } }
  });
  const g = fxLayer(F);
  // the silence made visible: rings of sound with no sound
  const bk = v.P('beakTip');
  for (let i = 0; i < 5; i++) shockRing(g, bk[0], bk[1], u - 0.14 - i * 0.11, { r: 620, color: '#fffbe6', w: 13, life: 0.46 });
  speedRadial(g, 960, 470, F.draw, { inner: 700, alpha: 0.42, n: 96, color: '#fff4c4' });
  embers(g, u * 0.7 + 3, { n: 90, stretch: 2.2 });
  F.post = { vig: 0.38, bloom: 0.30, bloomThr: 0.90, aura: goldAura(1, { len: 0.13, halo: 0.016 }) };
};

SHOTFN.roar = (F, u, ua) => {
  const k = easeOut(clamp(u / 1.5));
  const az = lerp(1.42, 0.50, k), el = lerp(-0.13, 0.04, k), D = lerp(3.55, 5.3, easeOutExpo(clamp(u / 0.8)));
  const c = Object.assign(orbit(az, el, D, [0.06, 1.28, 0], 38), { roll: lerp(0.18, -0.07, k) });
  view3d(F, {
    cam: shake(c, u, 0.04 * Math.max(0.25, pulse(u, 0, 0.8)), 31), env: { mode: 8, time: u * 1.5 + 2, vanish: [0.54, 0.50], dim: 0.70 }, light: LIGHT.power, noShadow: true, focus: [0, 1.3, 0], shadowSize: 2.4,
    scene: (mb, out) => hero(mb, out, { t: ua, wind: 1, neck: { a: 'sky', b: 'front', k: smooth(0.55, 1.1, ua) }, head: { pitch: 0.025 * Math.sin(ua * 53), yaw: -0.12 }, beakOpen: lerp(0.62, 0.30, smooth(0.5, 1.1, ua)), crestRaise: 1, brow: 1, wing: { spread: 1, flap: 0.26 * Math.sin(ua * TAU * 1.34) }, scarf: { wind: 1, lift: 0.34, len: 1.6 } }, drive(12 + ua * 17, { blur: 2.6 })),
    discBlur: 2, eyes: { hero: { open: 1, brow: 1.6, glow: 1.0, glowCol: [1.0, 0.98, 0.72], pupil: 0.6 } }
  });
  const g = fxLayer(F);
  embers(g, u * 3 + 5, { n: 120, stretch: 4.2 });
  speedRadial(g, 990, 540, F.draw, { inner: 640, alpha: 0.55, n: 100, color: '#fff2b8' });
  for (let i = 0; i < 2; i++) shockRing(g, 960, 540, u - 0.09 - i * 0.16, { r: 1500, color: i ? '#ffc83a' : '#fffbe0', w: 20, life: 0.46 });
  F.post = { vig: 0.30, bloom: 0.34, bloomThr: 0.90, aura: goldAura(1, { len: 0.16, lean: -0.15, halo: 0.018 }), chroma: 1.0 + pulse(u, 0, 0.5) * 2 };
};

function cometTrail(g, x, y, t, k, seed, dirX = -1) {
  g.save(); g.lineCap = 'round';
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = ['rgba(230,56,44,0.55)', 'rgba(255,180,30,0.70)', 'rgba(255,248,205,0.85)'][layer];
    const n = 9 - layer * 2;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * (46 - layer * 12) + Math.sin(t * 17 + i * 2 + layer) * 10;
      const len = (560 + 520 * hash2(seed + layer, i)) * k * (1 - layer * 0.17) * (1 - Math.abs(i - (n - 1) / 2) / n);
      const w = (30 - layer * 7) * (0.6 + 0.7 * hash2(seed + 7, i + Math.floor(t * 12)));
      // each streak is pointed at both ends, with ragged starting positions
      const x0 = x + (hash2(seed + 11, i + layer * 31) - 0.35) * 150, y0 = y + off;
      g.beginPath(); g.moveTo(x0 - dirX * 26, y0); g.quadraticCurveTo(x0 + dirX * len * 0.20, y0 + off * 0.18 - w * 0.9 + Math.sin(t * 11 + i) * 20, x0 + dirX * len, y + off * 1.65 + Math.sin(t * 9 + i * 3) * 40); g.quadraticCurveTo(x0 + dirX * len * 0.22, y0 + off * 0.22 + w * 0.8, x0 - dirX * 26, y0); g.closePath(); g.fill();
    }
  }
  g.restore();
}
SHOTFN.fly = (F, u, ua) => {
  const k = clamp(u / 1.5);
  const path = t => [lerp(-1.75, 0.50, easeInOut(clamp(t / 1.5))) + 0.06 * Math.sin(t * 5), 0.46 + 0.50 * easeOut(clamp(t / 1.5)) + 0.04 * Math.sin(t * 8), 0];
  const c = lerpCam(cam([1.35, 0.78, 7.15], [0.12, 1.24, 0], 33, -0.10), cam([2.20, 1.20, 6.65], [0.30, 1.42, 0], 33, -0.055), easeInOut(k));
  const p = path(ua);
  const v = view3d(F, {
    cam: shake(c, u, 0.016, 23), env: { mode: 7, time: u * 2, scroll: 14 + u * 17, ground: 0, sun: [-0.62, 0.10, -0.78], dim: 0.80 }, light: Object.assign({}, LIGHT.sunset, { dir: [0.5, 0.35, 0.75], rim: [1.0, 0.9, 0.45], lit: [0.98, 0.86, 0.76] }), noShadow: true, focus: [0.2, 1.7, 0], shadowSize: 2.6,
    scene: (mb, out) => {
      hero(mb, out, { root: M4.chain(M4.T(p), M4.about([0.1, 0.9, 0], M4.Rz(0.12 - 0.07 * ua))), t: ua, wind: 1, neck: 'front', beakOpen: 0.16, crestRaise: 0.8, brow: 1, wing: { spread: 1, flap: 0.40 * Math.sin(ua * TAU * 1.34) }, scarf: { wind: 1, lift: 0.1, len: 1.55 } }, drive(20 + ua * 13.5, { blur: 2.6 }));
      // the near ledge falls away behind; the far one slides underneath, with the Peregrine staring up from it
      const ledge = -2.05 - u * 1.05, ledgeA = -2.05 - ua * 1.05;
      rival(mb, out, { root: M4.chain(M4.T([4.30 + ledgeA + 1.05, -0.42, -0.55]), M4.S(0.74)), t: ua * 0.6, wind: 0.5, neck: 'sit', head: { yaw: -2.45 - 0.35 * smooth(0.3, 1.1, ua), pitch: 0.55 }, beakOpen: 0.34, crestRaise: 0.8 }, { wheel: 3, crank: 0.35 });
      buildCliffs(mb, -0.30, 0.95 - u * 1.5, ledge);
    }, discBlur: 2, eyes: { hero: { open: 1, brow: 1.35, glow: 0.75, glowCol: [1.0, 0.97, 0.65] }, falcon: { open: 1, mode: 1, pupil: 0.6 } }
  });
  const g = fxLayer(F);
  const rc = v.P('rearHub');
  cometTrail(g, rc[0] - 130, rc[1] - 130, u, 0.75 + 0.45 * k, 3);
  speedH(g, u, 105, { n: 28, alpha: 0.42, y0: 40, y1: 1050, v: 5200, len: 480, dir: 1, color: '#fff0cc' });
  embers(g, u * 1.6, { n: 50, stretch: 1.4 });
  F.post = { vig: 0.32, bloom: 0.26, bloomThr: 0.92, aura: goldAura(0.95, { len: 0.085, lean: -1.2, halo: 0.013 }) };
};

SHOTFN.overtake = (F, u, ua) => {
  const spd = 26;
  const tPass = bt(153) - bt(152);
  const hx = kf(u, [[0, -4.4], [tPass - 0.16, -1.65], [tPass + 0.10, 0.30], [tPass + 0.36, 2.9], [1.5, 7.5]]);
  const zoomK = easeOutExpo(clamp((u - 0.78) / 0.34));
  const wide = cam([1.35, 0.92, 4.75], [0.05, 0.98, 0.0], 33, 0.06);
  const face = cam([1.52, 1.40, 1.05], [0.46, 1.33, -0.45], 28, -0.11);
  const c = lerpCam(wide, face, zoomK);
  const smearing = ua > tPass - 0.13 && ua < tPass + 0.12;
  const blown = smooth(tPass, tPass + 0.12, ua);
  const v = view3d(F, {
    cam: shake(c, u, 0.012 + 0.05 * pulse(u, tPass, 0.45), 29), env: { mode: 6, time: u + 11, scroll: spd * u + 300, speed: spd, sun: [-0.55, 0.45, -0.65], slope: HILL.k }, light: Object.assign({}, LIGHT.mountain, { dir: [0.45, 0.65, 0.6] }), focus: [0.2, 0.9, -0.2], shadowSize: 2.6,
    scene: (mb, out) => {
      mb.push(HILL.rig);
      rival(mb, out, { root: M4.chain(M4.T([0, 0, -0.40]), leanM(0.20 * Math.sin(Math.max(0, ua - tPass) * 14) * Math.exp(-Math.max(0, ua - tPass) * 3))), t: ua, wind: 1, neck: { a: 'aero', b: 'sit', k: blown * 0.8 }, head: { yaw: -0.35 * blown, pitch: 0.10 * blown }, beakOpen: 0.30 * blown, crestRaise: blown }, drive(0.3 + ua * 12, { blur: 2.4, chainFast: true }));
      if (hx < 6.8) {
        const stretch = smearing ? 2.1 : 1.0;
        const root = M4.chain(M4.T([hx, 0, 1.02]), M4.about([0.5, 0, 0], M4.S(stretch, 1, 1)));
        hero(mb, out, { root, t: ua, wind: 1, neck: 'tuck', brow: 1, scarf: { wind: 1, len: 1.5, lift: 0.1 }, wing: { spread: 0.0 } }, drive(ua * 17, { blur: 2.6, chainFast: true }));
      }
      mb.pop(); mb.push(HILL.shear);
      buildRail(mb, spd * u + 300, -2.8); buildPines(mb, spd * u + 300, -5.0, 2.3, 61, 22);
      mb.pop();
    }, discBlur: 2.2,
    eyes: { falcon: ua < tPass ? { open: 0.75, mode: 4, brow: 1.1, lookX: 0.3 } : { open: 1, mode: 1, brow: -0.6, lookX: 0.6 }, hero: { open: 1, brow: 1.4, glow: 0.8, glowCol: [1.0, 0.97, 0.65] } }
  });
  const g = fxLayer(F);
  if (u < tPass + 0.42 && hx > -3.8 && hx < 4.2) { const h = v.P('rearHub'); cometTrail(g, h[0] - 70, h[1] - 175, u, 1.45, 13); }
  speedH(g, u, 111, { n: 40 + (u > tPass && u < tPass + 0.5 ? 40 : 0), alpha: 0.55, y0: 30, y1: 1060, v: 7200, len: 620, dir: 1 });
  if (u > tPass) { const h = v.P('f_head'); featherBurst(g, h[0] - 90, h[1] + 20, u - tPass, 19, { n: 14, wind: -1100, gravity: 100, s: 0.9 }); }
  if (u > 0.82) { const h = v.P('f_head'); sweatDrops(g, h[0] + 20, h[1] - 120, ua); speedRadial(g, h[0], h[1], F.draw, { inner: 520, alpha: 0.42, n: 80 }); }
  caption(typeLayer(F), 'IMPOSSIBLE!', 955, u, 0.98, { size: 76, heavy: true, color: '#ecd8ff', bar: 'rgba(26,8,46,0.88)' });
  F.post = { vig: 0.32, bloom: 0.28, bloomThr: 0.90, aura: goldAura(hx < 3.5 && u < tPass + 0.3 ? 0.9 : 0.0, { len: 0.07, lean: -1.2, halo: 0.011 }) };
};

SHOTFN.finish = (F, u, ua) => {
  const arrive = easeOut(clamp(ua / 0.72));
  const x = lerp(-3.4, 0.15, arrive);
  const yaw = -0.62 * easeOutBack(clamp((ua - 0.30) / 0.42), 1.9);
  const lean = 0.30 * Math.sin(PI * clamp((ua - 0.28) / 0.62));
  const posed = smooth(0.74, 0.98, ua);
  const c = lerpCam(cam([2.9, 0.36, 3.75], [-0.25, 1.02, 0], 35, 0.11), cam([2.20, 0.30, 3.45], [0.08, 1.20, 0], 35, 0.04), easeInOut(clamp(u / 1.5)));
  const v = view3d(F, {
    cam: shake(c, u, 0.035 * pulse(u, 0.55, 0.45), 27), env: { mode: 9, time: u, scroll: 40, sun: [-0.30, 0.09, -0.95], p: [0, 0, 0, 38.0], dim: 0.90 }, light: LIGHT.finish, focus: [0.1, 0.8, 0], shadowSize: 2.8,
    scene: (mb, out) => {
      const root = M4.chain(M4.T([x, 0, 0]), M4.about([0.1, 0, 0], M4.Ry(yaw)), leanM(-lean));
      hero(mb, out, { root, t: ua, wind: lerp(1, 0.62, posed), neck: { a: 'tuck', b: 'proud', k: posed }, beakOpen: 0.10 * (1 - posed), crestRaise: 0.4 * posed, brow: 1, wing: { l: { spread: 0.92 * posed, flap: 0.20 * posed }, r: {} }, scarf: { wind: lerp(1, 0.75, posed), len: 1.4, lift: 0.28 } }, { wheel: (x + 3.4) / BG.tireOut, crank: 0.15, blur: 1.6 * (1 - arrive) });
      buildGate(mb, -1.55, -2.9, 1.75, 2.75); buildRocks(mb, 40, -3.9, 2.4, 131, 0.28, MAT.rock, 14);
    }, discBlur: 1.2 * (1 - arrive), eyes: { hero: u > 1.1 ? { open: 1, brow: 0.9, glint: pulse(u, 1.15, 0.35) } : { open: 0.85, brow: 1.2 } }
  });
  const g = fxLayer(F);
  const rc = v.P('rearContact');
  dustBurst(g, rc[0], rc[1] - 10, u - 0.42, 41, { s: 1.15, life: 1.0, n: 15, fill: '#ffd9b8', shade: '#c9808a' });
  if (u < 0.5) speedH(g, u, 121, { n: 24, alpha: 0.5 * (1 - u / 0.5), y0: 200, y1: 1000, v: 6000, len: 500, dir: 1, color: '#ffe2c4' });
  for (let i = 0; i < 90; i++) { const born = 0.5 + hash2(i, 201) * 0.5; const a = u - born; if (a < 0) continue; const px = hash2(i, 202) * W + Math.sin(a * 5 + i) * 40, py = -40 + a * (260 + 380 * hash2(i, 203)); g.save(); g.translate(px, py); g.rotate(a * (3 + 6 * hash2(i, 204)) + i); g.scale(1, Math.abs(Math.cos(a * 9 + i)) * 0.8 + 0.2); g.fillStyle = ['#ffd23a', '#ff4d62', '#2fd8c4', '#ffffff'][i % 4]; g.fillRect(-9, -6, 18, 12); g.restore(); }
  F.post = { vig: 0.34, bloom: 0.5, bloomThr: 0.82, aura: goldAura(lerp(0.60, 0.0, smooth(0.35, 0.95, u)), { len: 0.08, halo: 0.011 }) };
};

// ---------- title ----------
const titleCanvas = mkCanvas();
SHOTFN.title = (F, u, ua) => {
  const k = easeOut(clamp(u / 6));
  const c = cam([2.15 - 0.45 * k, 1.55, 8.00 - 0.35 * k], [0.14, 2.03 - 0.03 * k, 0], 30, 0);
  view3d(F, {
    cam: c, env: { mode: 10, time: u, vanish: [0.5, 0.68], dim: lerp(1.05, 0.88, clamp((u - 1) / 3)) }, light: Object.assign({}, LIGHT.power, { dir: [0.5, 0.45, 0.72], lit: [0.97, 0.88, 0.80], shade: [0.50, 0.40, 0.66], rim: [1.0, 0.80, 0.26], rimDir: [-0.7, 0.35, -0.5] }), noShadow: true,
    scene: (mb, out) => { const r = ride(3, ua, { cadence: 3.6 }); hero(mb, out, { t: ua * 0.8, wind: 0.7, neck: { a: 'ride', b: 'proud', k: 0.5 }, brow: 1, scarf: { wind: 0.9, len: 1.5, lift: 0.24 }, crestRaise: 0.3, body: { bob: 0.006 * Math.sin(r.crank * 2) } }, r); }, discBlur: 0.5,
    eyes: { hero: u > bt(172) - bt(160) && u < bt(173.5) - bt(160) ? { open: 1, mode: 5 } : { open: 0.9, brow: 1.15, glint: pulse(u, bt(173.5) - bt(160), 0.4), glow: 0.35 } }
  });
  const g = fxLayer(F);
  embers(g, u * 0.55, { n: 70, stretch: 2.0 });
  shockRing(g, 960, 290, u - 0.02, { r: 1500, color: '#fff3c4', w: 60, life: 0.6 });
  if (u < 0.8) speedRadial(g, 960, 290, F.draw, { inner: 600, alpha: 0.55 * (1 - u / 0.8), n: 100, color: '#ffe9a8' });
  // the logo
  const tg = freshCtx(titleCanvas);
  const gold = [[0, '#ffffff'], [0.34, '#fff1a8'], [0.60, '#ffb71c'], [1, '#f2531c']];
  const drawWord = (word, y, size, t0, step) => heavyText(tg, word, 960, y, size, { skew: 0.20, track: 6, fill: gold, layers: [['#150822', size * 0.105], ['#fff8e8', size * 0.055], ['#150822', size * 0.022]], drop: [size * 0.055, size * 0.065, '#a30f32'],
    letter: i => { const a = u - t0 - i * step; if (a < -0.001) return { a: 0 }; const q = clamp(a / 0.13); const sh = Math.max(0, 1 - a / 0.3); return { s: lerp(2.5, 1, easeOutBack(q, 1.8)), a: clamp(a / 0.04), dx: fbm1(u * 55, i) * 14 * sh, dy: fbm1(u * 55, i + 40) * 14 * sh }; } });
  drawWord('BEAK', 190, 202, 0.0, 0.062);
  drawWord('VELOCITY', 390, 172, bt(162) - bt(160), 0.047);
  const sweep = (u - 2.55) / 0.55;
  if (sweep > 0 && sweep < 1) { tg.globalCompositeOperation = 'source-atop'; const x = lerp(-300, 2200, sweep); const gr = tg.createLinearGradient(x - 150, 0, x + 150, 90); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.88)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); tg.fillStyle = gr; tg.fillRect(0, 0, W, H); tg.globalCompositeOperation = 'source-over'; }
  const tx = typeLayer(F);
  const grow = 1 + 0.022 * k;
  tx.save(); tx.translate(960, 300); tx.scale(grow, grow); tx.translate(-960, -300); tx.drawImage(titleCanvas, 0, 0); tx.restore();
  const tK = bt(164) - bt(160);
  if (u > tK) kanaText(tx, 'ペリカン', 960, 44, 48, { color: '#ffffff', outline: '#17081f', letter: i => clamp((u - tK - i * 0.07) / 0.06), track: 1.5 });
  const tT = bt(166) - bt(160);
  if (u > tT) {
    const w = easeOut(clamp((u - tT) / 0.22));
    const bw = (heavyWidth('A PELICAN RIDING A BICYCLE', 54, 11) + 120) * w;
    tx.fillStyle = 'rgba(14,6,22,0.92)'; tx.beginPath(); tx.moveTo(960 - bw / 2 + 18, 505); tx.lineTo(960 + bw / 2 + 18, 505); tx.lineTo(960 + bw / 2 - 18, 569); tx.lineTo(960 - bw / 2 - 18, 569); tx.closePath(); tx.fill();
    tx.fillStyle = '#ee2a3e'; tx.fillRect(960 - bw / 2 - 22, 572, bw, 6);
    tx.save(); tx.globalAlpha = w; heavyText(tx, 'A PELICAN RIDING A BICYCLE', 960, 537, 44, { track: 11, skew: 0.18, fill: '#fff8ec' }); tx.restore();
  }
  const tS = bt(168) - bt(160);
  if (u > tS) {
    const q = slam(u, tS, 1.7);
    tx.save(); tx.translate(1655, 986); tx.scale(q.s, q.s); tx.rotate(-0.045); tx.globalAlpha = q.a;
    tx.fillStyle = '#ee2a3e'; tx.fillRect(-205, -48, 410, 96); tx.strokeStyle = '#fff8ec'; tx.lineWidth = 6; tx.strokeRect(-205, -48, 410, 96);
    heavyText(tx, 'SEASON ONE', 0, 0, 48, { skew: 0.16, fill: '#fff8ec', track: 9 }); tx.restore();
    strokeText(tx, 'NO TRAINING WHEELS.', 112, 988, 27, { align: 'left', color: '#ffd45a', outline: '#17081f', weight: 4.4, track: 2.2, reveal: clamp((u - tS - 0.45) / 0.7) });
  }
  F.post = { vig: 0.34, bloom: 0.26, bloomThr: 0.92, aura: goldAura(0.80 * (1 - 0.65 * clamp((u - 1.4) / 2.2)), { len: 0.05, halo: 0.007 }), chroma: 2.2 * pulse(u, 0, 0.4), fade: smooth(5.72, 6.0, u) };
};

// ---------- stinger ----------
function finishLineSet(mb) { buildRocks(mb, 12, -4.2, 2.6, 141, 0.24, MAT.rock, 16); buildCone(mb, -2.35, -0.95, 520); buildCone(mb, 2.55, -1.55, 522); buildGate(mb, -2.9, -3.4, -2.0, 2.2); }
const FINAL_ENV = u => ({ mode: 9, time: u * 0.35, scroll: 12, sun: [0.34, 0.075, -0.94] });
SHOTFN.aftermath = (F, u, ua) => {
  const k = easeInOut(clamp(u / 2.25));
  const c = lerpCam(cam([-0.05, 1.02, 5.95], [0.14, 0.94, 0], 30, 0), cam([0.20, 1.05, 5.35], [0.18, 0.96, 0], 30, 0), k);
  const pant = Math.pow(Math.abs(Math.sin(ua * PI * 1.75)), 1.5);
  const smugAt = 1.5;
  const turn = easeInOut(clamp((ua - smugAt) / 0.4));
  const v = view3d(F, {
    cam: c, env: FINAL_ENV(u), light: LIGHT.finish, focus: [0.2, 0.7, 0], shadowSize: 2.8,
    scene: (mb, out) => {
      hero(mb, out, { root: M4.T([-0.92, 0, 0.12]), t: ua * 0.35, wind: 0.14, neck: 'proud', head: { pitch: 0.02, yaw: -0.5 * turn }, pouch: 0.46, brow: 0.3, body: { bob: 0.003 * Math.sin(ua * 2.4) }, scarf: { wind: 0.22, lift: -0.12, len: 1.05 } }, { wheel: 0.9, crank: 0.12 });
      rival(mb, out, { root: M4.chain(M4.T([1.62, 0, -0.22]), M4.Ry(PI)), t: ua * 0.35, wind: 0.12, neck: { a: 'slump', b: 'aero', k: smooth(0.55, 0.95, ua) * 0.6 }, head: { pitch: -0.06 + 0.05 * pant, yaw: 0.28 }, beakOpen: 0.14 + 0.18 * pant, body: { bob: -0.012 + 0.020 * pant, pitch: -0.05 + 0.035 * pant } }, { wheel: 0.4, crank: 0.4 });
      finishLineSet(mb);
    }, eyes: { hero: turn > 0.6 ? { open: 0.9, mode: 4, brow: 0.3, lookX: 0.15 } : { open: 1, mode: 3, brow: 0.2 }, falcon: ua < 0.7 ? { open: 0.45, brow: -0.3 } : { open: 1, brow: -0.5, lookX: 0.5 } }
  });
  const g = fxLayer(F);
  const fb = v.P('f_beak');
  for (let i = 0; i < 4; i++) { const age = u - i * 0.57 - 0.1; if (age > 0 && age < 0.55) { const q = age / 0.55; puffCluster(g, [[fb[0] - 30 - q * 70, fb[1] + 6 - q * 30, 13 + q * 24], [fb[0] - 56 - q * 95, fb[1] - 10 - q * 44, 9 + q * 18], [fb[0] - 18 - q * 52, fb[1] - 16 - q * 18, 7 + q * 14]], 'rgba(255,238,230,' + (0.9 * (1 - q)) + ')', 'rgba(220,180,200,' + (0.7 * (1 - q)) + ')', null); } }
  const h = v.P('f_head'); sweatDrops(g, h[0] + 30, h[1] - 60, ua);
  featherBurst(g, 1500, -60, u * 0.5, 211, { n: 6, wind: -90, gravity: 150, s: 0.75 });
  caption(typeLayer(F), '...HOW?', 940, u, bt(178) - bt(176), { size: 74, x: 280, heavy: true, color: '#e8d4ff', bar: 'rgba(26,8,46,0.84)' });
  F.post = { vig: 0.36, bloom: 0.3, bloomThr: 0.92, fade: u < 0.22 ? 1 - u / 0.22 : 0 };
};

SHOTFN.pouch = (F, u, ua) => {
  const tOpen = bt(183) - bt(182);
  const k = easeInOut(clamp((u - 0.62) / 0.85));
  const c = lerpCam(cam([1.26, 1.28, 2.70 - 0.12 * clamp(u / 0.6)], [0.42, 1.02, 0.14], 31, -0.03), cam([1.36, 1.02, 4.62 + 0.08 * clamp((u - 1.4) / 1.2)], [0.72, 0.665, 0.18], 31, 0.008), k);
  const releases = TL.FISH.map(b => bt(b) - bt(182));
  const out_ = releases.filter(r => ua >= r).length;
  const gape = easeOutBack(clamp((ua - tOpen + 0.06) / 0.18), 2.4);
  const fill = u < tOpen ? 0.55 + 0.75 * easeInOut(clamp(u / (tOpen - 0.04))) : lerp(1.30, 0.20, out_ / 11);
  const lumps = [];
  for (let i = out_; i < 11; i += 2) lumps.push([0.10 + 0.055 * i + 0.03 * Math.sin(ua * 17 + i), 0.55 * Math.sin(i * 2.3 + ua * (9 + i % 3)), 0.34 * smooth(0, tOpen, ua)]);
  const v = view3d(F, {
    cam: shake(c, u, 0.012 * pulse(u, tOpen, 0.3), 25), env: FINAL_ENV(u + 3), light: LIGHT.finish, focus: [0.4, 0.6, 0], shadowSize: 1.9,
    scene: (mb, out) => {
      hero(mb, out, { root: M4.T([-0.28, 0, 0.12]), t: ua * 0.45, wind: 0.12, neck: { a: 'proud', b: 'front', k: easeInOut(clamp(ua / 0.34)) }, head: { pitch: -0.10 * clamp(gape), yaw: -0.22 }, beakOpen: 0.60 * clamp(gape, 0, 1.12), pouch: fill, lumps, brow: 0.3, scarf: { wind: 0.2, lift: -0.12, len: 1.0 } }, { wheel: 0.9, crank: 0.12 });
      // eleven fish, each on its own deterministic arc
      const mouth = M4.pt(M4.T([0, 0, 0]), out.anchors.mouthOut);
      releases.forEach((rt, i) => {
        const a = ua - rt; if (a < 0) return;
        const h1 = hash2(i, 301), h2 = hash2(i, 302), h3 = hash2(i, 303);
        const land = [mouth[0] + 0.06 + 0.075 * ((i * 4) % 11) + 0.05 * h1, 0.040 + 0.052 * Math.floor(i / 5), 0.36 + (h2 - 0.5) * 0.46];
        const dur = 0.42 + 0.08 * h3; const q = clamp(a / dur);
        const start = [mouth[0], mouth[1] - 0.02, mouth[2] + 0.03];
        let p = [lerp(start[0], land[0], q), lerp(start[1], land[1], q * q) + 0.20 * Math.sin(PI * q) * (0.5 + h1), lerp(start[2], land[2], easeOut(q))];
        const after = Math.max(0, a - dur); const decay = Math.exp(-after * 2.6);
        if (q >= 1) p = [land[0] + 0.03 * Math.sin(after * 13 + i) * decay, land[1] + 0.085 * Math.abs(Math.sin(after * 12 + i * 0.4)) * decay, land[2]];
        const spin = q < 1 ? -1.2 - q * (3.2 + 2.5 * h2) * (i % 2 ? 1 : -0.7) : (i % 3 - 1) * 0.28 + 0.22 * Math.sin(after * 24 + i) * decay + (i % 2 ? PI : 0);
        const roll = q < 1 ? q * 2.4 * (h3 - 0.5) : (h3 - 0.5) * 0.7;
        const M = M4.chain(M4.T(p), M4.Ry((h1 - 0.5) * 0.9), M4.Rz(spin), M4.Rx(roll), M4.S(0.98 + 0.34 * h2));
        buildFish(mb, M4.chain(M, M4.S(1.18)), Math.sin(a * 27 + i * 2) * (0.35 + 0.65 * decay), i);
      });
      rival(mb, out, { root: M4.chain(M4.T([2.02, 0, -0.72]), M4.Ry(PI)), t: ua * 0.35, wind: 0.1, neck: 'sit', head: { yaw: 0.35, pitch: -0.14 * smooth(tOpen, tOpen + 0.3, ua) }, beakOpen: 0.34 * smooth(tOpen, tOpen + 0.25, ua) }, { wheel: 0.4, crank: 0.4 });
      finishLineSet(mb);
    }, eyes: { hero: { open: 0.92, mode: 4, brow: 0.3, lookX: 0.1, lookY: -0.2 }, falcon: ua > tOpen + 0.05 ? { open: 1, mode: 1, brow: -0.7, pupil: 0.55 } : { open: 0.9, brow: -0.3 } }
  });
  const g = fxLayer(F);
  const m = v.P('mouthOut');
  if (u > tOpen) { shockRing(g, m[0], m[1], u - tOpen, { r: 360, color: '#e8f8ff', w: 18 }); }
  releases.forEach((rt, i) => { const a = u - rt - 0.46; if (a > 0 && a < 0.3) { const q = v.pt([0.55 + 0.075 * ((i * 4) % 11), 0.02, 0.48]); dustBurst(g, q[0], q[1], a, 330 + i, { s: 0.22, life: 0.3, n: 7, fill: '#ffe2cc', shade: '#d89a94', line: null }); } });
  sfxWord(g, 'FWUMP', 1450, 225, 140, u - tOpen, { rot: 0.12, life: 0.55 });
  const tCard = bt(185.4) - bt(182);
  const tx = typeLayer(F);
  if (u > tCard) {
    const w = easeOut(clamp((u - tCard) / 0.16));
    tx.fillStyle = 'rgba(12,5,20,0.94)'; tx.fillRect(960 - 960 * w, 912, 1920 * w, 134);
    tx.fillStyle = '#ffbe1c'; tx.fillRect(960 - 960 * w, 1046, 1920 * w, 9);
    slamText(tx, 'IT CARRIED THE FISH THE WHOLE RACE.', 960, 980, 72, u, tCard, { from: 1.22, jolt: 9, drift: 0.004, track: 9 });
  }
  F.post = { vig: 0.36, bloom: 0.3, bloomThr: 0.92 };
};

SHOTFN.gulp = (F, u, ua) => {
  const tSlurp = bt(189.8) - bt(189), tGulp = bt(190.35) - bt(189);
  const suck = clamp((ua - tSlurp) / 0.16);
  const gulp = clamp((ua - tGulp) / 0.38);
  const N = neckPose('proud');
  const k = easeOut(clamp(u / 1.125));
  const c = lerpCam(cam([N.H[0] + 0.66, 1.67, 1.74], [N.H[0] + 0.14, 1.515, 0], 29, -0.02), cam([N.H[0] + 0.58, 1.66, 1.58], [N.H[0] + 0.13, 1.525, 0], 29, 0.025), k);
  const happy = ua > tGulp + 0.17;
  view3d(F, {
    cam: c, env: FINAL_ENV(u + 6), light: LIGHT.finish, focus: [0.3, 1.4, 0], shadowSize: 1.2,
    scene: (mb, out) => {
      hero(mb, out, { t: ua * 0.5, wind: 0.14, neck: 'proud', head: { pitch: 0.05 * Math.sin(PI * suck) + (happy ? 0.03 : 0), yaw: -0.2 }, beakOpen: 0.07 * Math.sin(PI * suck), pouch: 0.22 * (1 - gulp), fishTail: (1 - easeIn(suck)) * 1.12, gulp: gulp > 0 && gulp < 1 ? gulp : 0, brow: 0.3, scarf: { wind: 0.2, lift: -0.1, len: 1.0 } }, { wheel: 0.9, crank: 0.12 });
      finishLineSet(mb);
    }, eyes: { hero: happy ? { open: 1, mode: 3, brow: 0.15 } : { open: 0.9, mode: 4, brow: 0.35, lookX: -0.15 } }
  });
  const g = fxLayer(F);
  sfxWord(g, 'SLURP', 1425, 330, 112, u - tSlurp, { rot: 0.12, life: 0.3 });
  sfxWord(g, 'GULP.', 480, 760, 148, u - tGulp - 0.06, { rot: -0.12, life: 0.62 });
  const tEnd = bt(190.9) - bt(189);
  const tx = typeLayer(F);
  if (u > tEnd) { const q = easeOut(clamp((u - tEnd) / 0.14)); tx.save(); tx.globalAlpha = q; heavyText(tx, 'BEAK VELOCITY', 1850, 975, 66, { align: 'right', skew: 0.2, fill: [[0, '#ffffff'], [0.5, '#ffd84a'], [1, '#f2641c']], layers: [['#150822', 9]] }); tx.restore(); }
  F.post = { vig: 0.4, bloom: 0.3, bloomThr: 0.92, fade: smooth(0.88, 1.09, u) };
};

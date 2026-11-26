// ---------- ACT 3-4: the rival and the race ----------
SHOTFN.rwheel = (F, u, ua) => {
  const k = easeOut(clamp(u / 1.25));
  const x = lerp(-1.75, 0.22, k), travelled = x + 1.75;
  const v = view3d(F, {
    cam: cam([-0.05 - 0.2 * k, 0.30, 1.50 - 0.18 * k], [-0.16, 0.40, 0], 35, 0.06), env: { mode: 12, time: u, scroll: 0 }, light: Object.assign({}, LIGHT.rival, { rimAmt: 1.0 }), focus: [-0.1, 0.4, 0], shadowSize: 1.4,
    scene: (mb, out) => rival(mb, out, { root: M4.T([x, 0, 0]), t: ua, wind: 0.2 }, { wheel: (Math.floor(travelled * 12) / 12 + ua * 0.4) / BG.tireOut, crank: 0.35, blur: 0.12 * (1 - k) + 0.02 }),
    discBlur: 0.05 + 0.7 * (1 - k), eyes: { falcon: { open: 1, brow: 1 } }
  });
  const g = fxLayer(F);
  const sw = (u - (bt(66.4) - bt(64))) / 0.42;
  if (sw > 0 && sw < 1) {
    const hub = v.P('f_rearHub'), edge = v.pt(add(v.A.f_rearHub || [0, 0, 0], [0.3, 0, 0])); const rad = Math.abs(edge[0] - hub[0]);
    g.save(); g.beginPath(); g.arc(hub[0], hub[1], rad, 0, TAU); g.clip(); g.globalCompositeOperation = 'lighter';
    const gx = hub[0] - rad * 1.5 + sw * rad * 3; const gr = g.createLinearGradient(gx - 120, 0, gx + 120, 0); gr.addColorStop(0, 'rgba(150,70,255,0)'); gr.addColorStop(0.5, 'rgba(235,215,255,0.78)'); gr.addColorStop(1, 'rgba(150,70,255,0)');
    g.translate(hub[0], hub[1]); g.rotate(0.45); g.translate(-hub[0], -hub[1]); g.fillStyle = gr; g.fillRect(gx - 140, hub[1] - rad * 1.6, 280, rad * 3.2); g.restore();
    glintStar(g, hub[0] + rad * 0.52, hub[1] - rad * 0.60, 190, Math.sin(PI * clamp((sw - 0.45) * 2.2)), '#ecd8ff', sw);
  }
  F.post = { vig: 0.6, bloom: 0.75, bloomThr: 0.7, fade: u < 0.3 ? 1 - u / 0.3 : 0 };
};

SHOTFN.reye = (F, u) => {
  const g = fxLayer(F), tOpen = bt(69.5) - bt(68);
  const k = u < tOpen ? 0 : clamp((u - tOpen) / 0.09);
  const glint = u < tOpen + 0.04 ? 0 : Math.max(0, 1 - (u - tOpen - 0.04) / 0.42);
  drawEyeCloseup(g, { pal: 'fal', flip: true, t: u + 9, open: k <= 0 ? 0 : easeOutBack(k, 1.8) * 0.90, glint, zoom: 1.04 + u * 0.05, brow: 1.45, pupil: 0.85, dim: u < tOpen ? 0.45 : 0 });
  if (u > tOpen + 0.08) speedRadial(g, 960, 540, F.draw, { inner: 600, alpha: 0.30, n: 80, color: '#c79bff' });
  F.post = { vig: 0.6, bloom: 0.5, bloomThr: 0.86, fade: u < 0.12 ? 1 - u / 0.12 : 0 };
};

SHOTFN.rhero = (F, u, ua) => {
  const k = easeOut(clamp(u / 3.0));
  const c = lerpCam(cam([2.45, 0.26, 2.05], [0.10, 1.02, 0], 36, 0.12), cam([1.45, 0.34, 3.0], [0.03, 1.04, 0], 33, 0.05), k);
  const flash = Math.max(pulse(u, bt(74.5) - bt(72), 0.34), pulse(u, bt(78.2) - bt(72), 0.30) * 0.8);
  const v = view3d(F, {
    cam: shake(c, u, 0.02 * Math.max(pulse(u, 0, 0.4), flash), 24), env: { mode: 5, time: u, scroll: 0, flash: flash * 0.75, ground: 1, p: [0, 0, 0, 1], sun: norm(add(norm(sub(c.tgt, c.pos)), [0.030, 0.050, 0])) },
    light: Object.assign({}, LIGHT.rival, { lit: vlerp([0.82, 0.70, 1.0], [1.15, 1.05, 1.25], flash) }),
    scene: (mb, out) => {
      rival(mb, out, { t: ua, wind: 0.65, neck: 'sit', head: { yaw: -0.30, pitch: -0.05 + 0.02 * Math.sin(ua * 2.2) }, crestRaise: 0.45 + 0.1 * Math.sin(ua * 9) }, { wheel: 0.6, crank: 0.15 });
      buildRocks(mb, 0, -1.9, 1.15, 17, 0.26, MAT.rockDark, 6); buildRocks(mb, 0.5, 2.2, 1.7, 29, 0.15, MAT.rockDark, 5);
    }, eyes: { falcon: { open: 1, brow: 1.25, mode: u > 1.9 ? 4 : 0, glow: 0.55, glint: pulse(u, 1.55, 0.35) } }, discBlur: 0
  });
  const g = fxLayer(F);
  embers(g, u * 0.5, { n: 34, stretch: 1.4 });
  speedH(g, u, 51, { n: 15, alpha: 0.25, color: '#d4b0ff', y0: 80, y1: 900, v: 3000, len: 560 });
  const tx = typeLayer(F);
  if (u > 0.22) {
    const w = easeOut(clamp((u - 0.22) / 0.2));
    tx.fillStyle = 'rgba(12,4,22,0.90)'; tx.beginPath(); tx.moveTo(0, 790); tx.lineTo(1230 * w, 790); tx.lineTo(1150 * w, 1000); tx.lineTo(0, 1000); tx.closePath(); tx.fill();
    tx.fillStyle = '#9a4dff'; tx.beginPath(); tx.moveTo(0, 1000); tx.lineTo(1150 * w, 1000); tx.lineTo(1142 * w, 1022); tx.lineTo(0, 1022); tx.closePath(); tx.fill();
    slamText(tx, 'THE PEREGRINE', 80, 870, 118, u, 0.26, { align: 'left', from: 1.35, jolt: 14, drift: 0.008, fill: [[0, '#ffffff'], [1, '#d9b8ff']] });
  }
  const t2 = bt(76) - bt(72);
  if (u > t2) strokeText(tx, 'FASTEST BIRD ALIVE', 86, 958, 34, { align: 'left', color: '#ffd04a', weight: 5.4, track: 2.6, reveal: clamp((u - t2) / 0.35) });
  F.post = { vig: 0.45, bloom: 0.36, bloomThr: 0.86, aura: { amt: 0.40 + 0.35 * k, len: 0.095, halo: 0.009, c0: AURA.violet.c0, c1: AURA.violet.c1, c2: AURA.violet.c2, min: 0.38, max: 0.52 } };
};

SHOTFN.versus = (F, u, ua) => {
  const kin = easeOutBack(clamp(u / 0.22), 1.3);
  const L = [[0, 0], [0.565, 0], [0.435, 1], [0, 1]], Rp = [[0.565, 0], [1, 0], [1, 1], [0.435, 1]];
  const off = 1 - kin;
  const wig = (u > bt(82.2) - bt(80) && u < bt(82.2) - bt(80) + 0.27) || (u > bt(83.1) - bt(80) && u < bt(83.1) - bt(80) + 0.17) ? 1 : 0;
  const N = neckPose('front');
  view3d(F, {
    cam: cam([N.H[0] + 0.52, 1.40, 1.72 - 0.10 * u], [N.H[0] + 0.15, 1.335, 0], 27, -0.05), poly: L.map(([x, y]) => [x - off, y]), offset: [-0.235 - off, 0],
    env: { mode: 8, time: u, vanish: [0.35, 0.52], dim: 0.78 }, light: Object.assign({}, LIGHT.sunset, { dir: [0.55, 0.45, 0.7], rim: [1.0, 0.70, 0.24], rimDir: [-0.7, 0.4, -0.5] }), focus: [0.4, 1.3, 0], shadowSize: 1.0,
    scene: (mb, out) => hero(mb, out, { t: ua, wind: 0.55, neck: 'front', pouch: 0.16, wiggle: wig, fishTail: 0, brow: 1, scarf: { wind: 0.8 } }, { wheel: 0.4, crank: 0.5 }),
    eyes: { hero: { open: 0.92, brow: 1.1, lookY: wig ? -0.75 : 0, lookX: wig ? 0.3 : 0.15, glint: pulse(u, 0.4, 0.3) } }
  });
  view3d(F, {
    cam: cam([-0.62, 1.30, 1.40 - 0.08 * u], [-0.37, 1.30, 0], 27, 0.05), poly: Rp.map(([x, y]) => [x + off, y]), offset: [0.235 + off, 0],
    env: { mode: 5, time: u + 3, scroll: 0 }, light: Object.assign({}, LIGHT.rival, { dir: [-0.45, 0.4, 0.75], rimDir: [0.7, 0.4, -0.55] }), focus: [-0.3, 1.3, 0], shadowSize: 1.0,
    scene: (mb, out) => rival(mb, out, { root: M4.Ry(PI), t: ua, wind: 0.55, neck: 'aero', head: { pitch: 0.04 } }, { wheel: 0.4, crank: 0.5 }),
    eyes: { falcon: { open: 0.82, brow: 1.4, glow: 0.7, glint: pulse(u, 0.55, 0.3) } }
  });
  const g = fxLayer(F);
  // the divider and its clash
  g.save(); g.lineCap = 'butt';
  const a = [0.565 * W, 0], b = [0.435 * W, H];
  g.strokeStyle = '#0c0716'; g.lineWidth = 34; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  g.strokeStyle = '#fff6da'; g.lineWidth = 14; g.beginPath(); let first = true; for (let i = 0; i <= 18; i++) { const q = i / 18; const jx = i % 18 === 0 ? 0 : (hash2(i, F.draw) - 0.5) * 46 * (u > 0.38 ? 1 : 0); const x = lerp(a[0], b[0], q) + jx, y = lerp(a[1], b[1], q); first ? g.moveTo(x, y) : g.lineTo(x, y); first = false; } g.stroke(); g.restore();
  const tc = bt(81) - bt(80);
  if (u > tc) { sparks(g, u, { x: 960, y: 540, t0: tc, rate: 220, dir: -PI / 2, spread: 5.8, speed: 1200, life: 0.34, width: 6 }); shockRing(g, 960, 540, u - tc, { r: 720, color: '#fff', w: 26 }); }
  const tx = typeLayer(F);
  slamText(tx, 'VS', 960, 548, 250, u, tc, { from: 2.4, jolt: 30, fill: [[0, '#fff7c8'], [0.55, '#ffbe1c'], [1, '#e8531a']], layers: [['#120818', 24], ['#ffffff', 10], ['#120818', 4]] });
  caption(tx, 'THE PELICAN', 985, u, 0.2, { x: -540, size: 52, heavy: true, color: '#ffd24a' });
  caption(tx, 'THE PEREGRINE', 985, u, 0.28, { x: 540, size: 52, heavy: true, color: '#cfa2ff' });
  F.post = { vig: 0.25, bloom: 0.45, bloomThr: 0.84, chroma: 1.6 * pulse(u, tc, 0.25), shake: [fbm1(u * 40, 14) * 0.010 * pulse(u, tc, 0.3), 0, 1 + 0.02 * pulse(u, tc, 0.3), 0] };
};

const HERO_Z = 0.56, RIV_Z = -0.78;
SHOTFN.start = (F, u, ua) => {
  const tGo = bt(88) - bt(84);
  const go = Math.max(0, u - tGo), goA = Math.max(0, ua - tGo);
  const hx = 5.2 * goA * goA + 0.2 * goA, fx = -0.12 + 6.6 * goA * goA + 0.2 * goA;
  const k = easeInOut(clamp(u / tGo));
  const c = lerpCam(cam([4.75, 1.22, 3.60], [0.10, 1.22, -0.1], 32, 0.04), cam([3.85, 0.66, 2.95], [0.22, 1.30, -0.1], 34, -0.06), k);
  const idle = Math.sin(ua * 7) * 0.006;
  const v = view3d(F, {
    cam: shake(c, u, 0.004 + 0.05 * pulse(u, tGo, 0.55), 24), env: { mode: 6, time: u, scroll: 0, sun: [0.55, 0.55, -0.62] }, light: LIGHT.mountain, focus: [0.2, 0.7, 0], shadowSize: 2.8,
    scene: (mb, out) => {
      hero(mb, out, { root: M4.T([hx, 0, HERO_Z]), t: ua, wind: 0.35 + clamp(goA * 3) * 0.6, neck: goA > 0 ? 'tuck' : { a: 'ride', b: 'tuck', k: smooth(1.0, tGo, ua) }, body: { bob: idle, pitch: -0.05 * smooth(1.0, tGo, ua) }, brow: 1, scarf: { wind: 0.35 + clamp(goA * 3) * 0.6 } }, drive(0.6 + goA * 9, { blur: clamp(goA * 5, 0, 2.2) }));
      rival(mb, out, { root: M4.T([fx, 0, RIV_Z]), t: ua, wind: 0.35 + clamp(goA * 3) * 0.6, neck: 'aero', body: { bob: -idle } }, drive(0.4 + goA * 10, { blur: clamp(goA * 5, 0, 2.2) }));
      buildGate(mb, 1.55, -2.35, 2.05, 2.55); buildRail(mb, 0, -2.9, { from: -9, to: 9 }); buildPines(mb, 0, -4.6, 1.7, 61, 12); buildRocks(mb, 0, -3.6, 2.3, 71, 0.22, MAT.rock, 10);
    }, discBlur: clamp(goA * 3), eyes: { hero: { open: u > 1.12 && u < tGo ? 0.82 : 1, brow: 1.15, glint: pulse(u, 1.15, 0.3) }, falcon: { open: 0.9, brow: 1.3, glow: 0.4 } }
  });
  const g = fxLayer(F);
  if (go > 0) {
    for (const [x, z, seed, s] of [[-0.45, HERO_Z, 3, 0.85], [-0.55, RIV_Z, 8, 0.6]]) { const p = v.pt([x + 0.25 * go, 0.02, z]); dustBurst(g, p[0], p[1], go, seed, { s, life: 0.7, fill: '#efe6dc', shade: '#b9aec0', drift: -700 }); }
    speedRadial(g, 960, 560, F.draw, { inner: 640, alpha: 0.5 * clamp(go * 6), n: 80 });
  }
  const tx = typeLayer(F);
  const nums = [['3', bt(85) - bt(84)], ['2', bt(86) - bt(84)], ['1', bt(87) - bt(84)]];
  for (const [n, t0] of nums) if (u >= t0 && u < t0 + BE) slamText(tx, n, 960, 190, 240, u, t0, { from: 2.1, jolt: 20, drift: 0.12, layers: [['#101020', 24], ['#ffffff', 11], ['#101020', 4]], fill: [[0, '#fff3bc'], [1, '#ff9d1a']] });
  if (u >= tGo) slamText(tx, 'GO!', 960, 185, 250, u, tGo, { from: 1.32, jolt: 34, drift: 0.18, layers: [['#101020', 28], ['#ffffff', 12], ['#101020', 5]], fill: [[0, '#ff9a86'], [0.5, '#ee2a3e'], [1, '#a30a2a']] });
  F.post = { vig: 0.28, bloom: 0.3, chroma: 1.8 * pulse(u, tGo, 0.35) };
};

SHOTFN.charge = (F, u, ua) => {
  const spd = 19, k = clamp(u / 2.25);
  const weave = Math.sin(ua * 3.1);
  const hx = kf(u, [[0, 0.05], [0.9, 0.35], [1.5, 0.12], [2.25, 0.30]]), fx = kf(u, [[0, -1.35], [0.8, -0.75], [1.7, 0.18], [2.25, 0.42]]);
  const hz = 0.46 + weave * 0.06, fz = -0.64 - weave * 0.05;
  const c = lerpCam(cam([4.05, 0.46, 0.62], [0.0, 1.02, -0.02], 33, -0.13), cam([3.25, 0.58, 0.20], [0.0, 1.03, -0.02], 33, 0.09), easeInOut(k));
  const r = ride(spd, ua, { cadence: 13 }), fr = ride(spd, ua, { cadence: 11, th0: 1.1 });
  const v = view3d(F, {
    cam: shake(c, u, 0.018, 27), env: { mode: 6, time: u, scroll: spd * u, speed: spd, sun: [-0.7, 0.45, 0.55], slope: HILL.k }, light: Object.assign({}, LIGHT.mountain, { dir: [0.75, 0.6, 0.25] }), focus: [0.1, 0.8, 0], shadowSize: 2.4,
    scene: (mb, out) => {
      mb.push(HILL.rig);
      hero(mb, out, { root: M4.chain(M4.T([hx, 0, hz]), leanM(weave * 0.085)), t: ua, wind: 1, neck: 'front', head: { pitch: 0.03 * Math.sin(ua * 17) }, body: { bob: 0.016 * Math.abs(Math.sin(r.crank)), pitch: -0.07 }, brow: 1, scarf: { wind: 1, len: 1.25, lift: 0.34 }, eyeFwd: 0.16 }, r);
      rival(mb, out, { root: M4.chain(M4.T([fx, 0, fz]), leanM(-weave * 0.09)), t: ua, wind: 1, neck: 'aero', head: { yaw: -0.18 } }, fr);
      mb.pop(); mb.push(HILL.shear);
      buildPines(mb, spd * u, -4.4, 2.6, 61, 26); buildPines(mb, spd * u, 5.6, 3.4, 83, 18); buildRail(mb, spd * u, -3.5, { from: -30, to: 5 });
      mb.pop();
    }, discBlur: 1.1, eyes: { hero: { open: 0.9, brow: 1.2 }, falcon: { open: 0.85, brow: 1.2 } }
  });
  const g = fxLayer(F);
  speedRadial(g, 960, 470, F.draw, { inner: 610, alpha: 0.62, n: 100 });
  for (const [key, seed] of [['rearContact', 5], ['f_rearContact', 9]]) { const p = v.P(key); for (let i = 0; i < 4; i++) { const age = fract(u * 2.6 + i / 4) * 0.4; dustBurst(g, p[0], p[1], age, seed + i, { s: 0.38, life: 0.4, fill: '#e8e2da', shade: '#b0a8bc', alpha: 0.8, line: null }); } }
  F.post = { vig: 0.32, bloom: 0.32 };
};

SHOTFN.side = (F, u, ua) => {
  const spd = 23, r = ride(spd, ua, { cadence: 13.5 });
  const fx = kf(u, [[0, -1.65], [0.6, -1.05], [1.45, 0.15], [2.25, 1.30]]);
  const c = lerpCam(cam([-0.35, 1.72, 4.65], [0.02, 0.93, -0.5], 32, -0.055), cam([0.75, 2.02, 4.35], [0.20, 0.89, -0.5], 31, -0.015), easeInOut(clamp(u / 2.25)));
  const teeth = u > 1.28 && u < 1.62;
  const v = view3d(F, {
    cam: shake(c, u, 0.016, 21), env: { mode: 6, time: u, scroll: spd * u, speed: spd, sun: [-0.5, 0.5, -0.7], slope: HILL.k }, light: LIGHT.mountain, focus: [0.1, 0.8, -0.3], shadowSize: 2.6,
    scene: (mb, out) => {
      mb.push(HILL.rig);
      hero(mb, out, { t: ua, wind: 1, neck: 'tuck', head: { pitch: 0.025 * Math.sin(ua * 19), dy: 0.008 * Math.sin(ua * 23) }, body: { bob: 0.018 * Math.abs(Math.sin(r.crank)), pitch: -0.08 }, pouch: 0.18, wiggle: u > 1.15 && u < 1.75 ? 1 : 0, fishTail: teeth ? 1 : 0, brow: 1, scarf: { wind: 1, len: 1.3, lift: 0.18 } }, r);
      rival(mb, out, { root: M4.T([fx, 0, -2.25]), t: ua, wind: 1, neck: 'aero', head: { yaw: u > 1.25 ? -0.85 : 0 } }, { wheel: spd * ua / BG.tireOut, crank: 0.05, blur: 2.4 });
      mb.pop(); mb.push(HILL.shear);
      buildRail(mb, spd * u, -3.9); buildPines(mb, spd * u * 0.9, -6.2, 2.3, 61, 22); buildRocks(mb, spd * u, 2.0, 5.5, 91, 0.10, MAT.rock, 12);
      mb.pop();
    }, discBlur: 2.0, eyes: { hero: { open: u > 1.7 ? 1 : 0.8, brow: 1.25 }, falcon: u > 1.25 ? { open: 1, mode: 4, brow: 0.9, lookX: 0.4 } : { open: 0.9, brow: 1.1 } }
  });
  const g = fxLayer(F);
  speedH(g, u, 61, { n: 44, alpha: 0.5, y0: 40, y1: 1060, v: 6800, len: 520, dir: 1 });
  speedH(g, u, 71, { n: 16, alpha: 0.5, y0: 900, y1: 1075, v: 9000, len: 760, th: 9, color: '#cfd6e8' });
  const h = v.P('head'); if (u < 1.2) sweatDrops(g, h[0] - 70, h[1] - 55, ua);
  F.post = { vig: 0.3, bloom: 0.3 };
};

SHOTFN.sparks = (F, u, ua) => {
  const spd = 21;
  const flick = 0.7 + 0.3 * Math.sin(u * 91) * Math.sin(u * 37);
  const c = lerpCam(cam([-1.88, 0.25, 1.56], [-0.12, 0.76, 0], 44, 0.20), cam([-1.52, 0.21, 1.68], [-0.02, 0.80, 0], 44, 0.13), clamp(u / 1.5));
  const v = view3d(F, {
    cam: shake(c, u, 0.015, 33), env: { mode: 6, time: u + 4, scroll: spd * u + 50, speed: spd, sun: [0.7, 0.5, -0.5], dim: 0.66, slope: HILL.k }, light: Object.assign({}, LIGHT.mountain, { lit: [1.05 + 0.12 * flick, 0.97, 0.90 - 0.08 * flick], rim: [1.0, 0.66, 0.2], rimDir: [-0.7, -0.15, 0.55], rimAmt: flick }), focus: [-0.2, 0.5, 0], shadowSize: 1.5,
    scene: (mb, out) => {
      mb.push(HILL.rig);
      hero(mb, out, { root: leanM(0.16), t: ua, wind: 1, neck: 'tuck', body: { pitch: -0.09, bob: 0.008 * Math.sin(ua * 31) }, brow: 1, scarf: { wind: 1, len: 1.2, lift: 0.12 } }, { wheel: spd * ua / BG.tireOut, crank: PI * 0.04, blur: 2.4, chainFast: false });
      mb.pop(); mb.push(HILL.shear);
      buildRail(mb, spd * u + 50, -1.45, { from: -9, to: 14 }); buildPines(mb, spd * u + 50, -4.6, 2.2, 61, 18);
      mb.pop();
    }, discBlur: 2.0, eyes: { hero: { open: 0.8, brow: 1.3 } }
  });
  const g = fxLayer(F);
  const p = v.pt(HILL.pt([-0.62, 0.075, 0.06]));
  sparks(g, u, { x: p[0], y: p[1], t0: -0.3, rate: 520, dir: PI * 1.06, spread: 0.62, speed: 2100, life: 0.40, width: 9, gravity: 2100 });
  sparks(g, u, { x: p[0], y: p[1], t0: -0.3, rate: 150, dir: -PI * 0.72, spread: 1.4, speed: 1100, life: 0.34, width: 5 });
  glintStar(g, p[0], p[1], 130 + 60 * flick, 0.9, '#fff1b0', u * 9);
  speedH(g, u, 81, { n: 26, alpha: 0.42, y0: 40, y1: 500, v: 6400, len: 480, dir: 1 });
  sfxWord(g, 'SKRRRAAK', 1420, 235, 128, u - 0.2, { rot: -0.12, life: 0.85, fill: [[0, '#fff2b0'], [1, '#ff7a1a']] });
  F.post = { vig: 0.42, bloom: 0.62, bloomThr: 0.84 };
};

SHOTFN.hairpin = (F, u, ua) => {
  const spd = 14, Rr = 6.5;
  const into = easeInOut(clamp(ua / 0.55)), out_ = easeInOut(clamp((ua - 2.45) / 0.5));
  const lean = 0.63 * into * (1 - 0.65 * out_);
  const drift = 0.46 * easeOutBack(clamp((ua - 0.30) / 0.45), 2.0) * (1 - out_) + 0.035 * Math.sin(ua * 23) * into;
  const root = M4.chain(M4.about([0.62, 0, 0], M4.Ry(drift)), leanM(-lean));
  const k = easeInOut(clamp(u / 3.0));
  const az = lerp(1.18, -0.10, k), el = lerp(0.30, 0.55, Math.sin(k * PI * 0.8)), D = lerp(4.5, 3.7, Math.sin(k * PI));
  const c = Object.assign(orbit(az, el, D, [0.05, 0.62, -0.2], 34), { roll: lerp(0.30, 0.14, k) });
  const along = spd * u;
  const v = view3d(F, {
    cam: shake(c, u, 0.014 * into, 29), env: { mode: 6, time: u + 6, scroll: along, speed: 0, p: [Rr, 0, 0, 0], sun: [0.6, 0.55, -0.55] }, light: LIGHT.mountain, focus: [0.0, 0.5, -0.2], shadowSize: 2.2,
    scene: (mb, out) => {
      hero(mb, out, { root, t: ua, wind: 0.9, neck: { a: 'ride', b: 'tuck', k: 0.6 }, head: { roll: -lean * 0.55, yaw: 0.20 * into, pitch: 0.04 }, body: { pitch: -0.04 }, brow: 1, beakOpen: ua > 0.7 && ua < 1.7 ? 0.13 : 0, scarf: { wind: 0.95, len: 1.25, lift: 0.30 } }, { wheel: spd * ua / BG.tireOut, crank: PI / 2, blur: 2.2 });
      buildArcRail(mb, Rr, along, 1.95);
      for (let i = 0; i < 9; i++) { const a = ((i * 2.1 - (along % 2.1)) - 8) / Rr; const rr = Rr - 4.6 - (i % 3) * 0.7; buildPine(mb, [Math.sin(a) * rr, -0.03, -Rr + Math.cos(a) * rr], 1.0 + (i % 4) * 0.28, 440 + (i % 8) * 2); }
    }, discBlur: 1.6, eyes: { hero: { open: 0.86, brow: 1.3, glint: pulse(u, 2.3, 0.35) } }
  });
  const g = fxLayer(F);
  const rc = v.A.rearContact || [0, 0, 0];
  if (u > 0.35) {
    // rubber left on the road, then smoke rolling off the sliding wheel
    const arcPt = (back, lat) => { const a = -back / Rr; const rr = Rr + lat; return [Math.sin(a) * rr + rc[0], 0.006, -Rr + Math.cos(a) * rr]; };
    const lat0 = rc[2];
    g.strokeStyle = 'rgba(22,14,30,0.72)'; g.lineCap = 'round';
    const len = Math.min(3.4, (u - 0.35) * spd * 0.5);
    for (let i = 0; i < 20; i++) { const a = v.pt(arcPt(i / 20 * len, lat0 + i * 0.006)), b = v.pt(arcPt((i + 1) / 20 * len, lat0 + (i + 1) * 0.006)); if (a[2] < 0 || b[2] < 0) continue; g.lineWidth = Math.max(2, 17 * (1 - i / 22)); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    if (u < 2.7) {
      const circles = [];
      for (let i = 13; i >= 0; i--) { const age = i * 0.045 + fract(u * 22) * 0.045; const w = arcPt(age * spd * 0.28, lat0 + 0.05 + (hash2(i + F.draw, 3) - 0.5) * 0.25); w[1] = 0.05 + age * 0.55; const p = v.pt(w); if (p[2] < 0.2) continue; const px = pxPerUnit(v.cm, w); const rad = px * (0.040 + age * 0.30) * (0.75 + 0.5 * hash2(i + F.draw, 9)); circles.push([p[0] + (hash2(i + F.draw, 5) - 0.5) * 30, p[1], rad], [p[0] + (hash2(i + F.draw, 15) - 0.5) * rad * 2.2, p[1] - rad * (0.2 + 0.8 * hash2(i + F.draw, 17)), rad * 0.66]); }
      puffCluster(g, circles, '#f3eef0', '#b9aecb', 'rgba(40,26,58,0.9)', 4);
    }
    const p = v.pt(rc); sparks(g, u, { x: p[0], y: p[1], t0: 0.45, t1: 2.4, rate: 110, dir: PI * 1.1, spread: 1.0, speed: 1200, life: 0.3, width: 5 });
  }
  speedRadial(g, 960, 540, F.draw, { inner: 720, alpha: 0.38, n: 70 });
  sfxWord(g, 'SKEEEEE', 470, 205, 135, u - 0.5, { rot: -0.2, life: 1.1, fill: [[0, '#ffffff'], [1, '#cfd8ff']] });
  F.post = { vig: 0.3, bloom: 0.35 };
};

SHOTFN.taunt = (F, u, ua) => {
  const spd = 20;
  const k = clamp(u / 1.5);
  const c = lerpCam(cam([2.05, 1.52, 2.15], [-0.55, 1.10, -0.15], 34, -0.10), cam([1.72, 1.48, 1.85], [-0.40, 1.16, -0.12], 33, -0.065), easeOut(k));
  const turn = easeInOut(clamp(ua / 0.34));
  const behind = kf(u, [[0, -1.95], [1.5, -2.75]]);
  const v = view3d(F, {
    cam: shake(c, u, 0.008, 18), env: { mode: 6, time: u + 8, scroll: spd * u + 120, speed: spd, sun: [-0.6, 0.5, -0.6], slope: HILL.k }, light: Object.assign({}, LIGHT.mountain, { dir: [0.35, 0.7, 0.65] }), focus: [0.0, 1.0, 0], shadowSize: 2.4,
    scene: (mb, out) => {
      mb.push(HILL.rig);
      rival(mb, out, { root: M4.T([0.12, 0, 0]), t: ua, wind: 1, neck: { a: 'aero', b: 'sit', k: turn * 0.6 }, head: { yaw: -2.50 * turn, pitch: 0.05 }, beakOpen: ua > 0.5 && ua < 1.2 ? 0.14 * Math.abs(Math.sin(ua * 17)) : 0, crestRaise: 0.15 }, { wheel: spd * ua / BG.tireOut, crank: 0.05, blur: 2.4 });
      hero(mb, out, { root: M4.T([behind, 0, -0.95]), t: ua, wind: 1, neck: 'tuck', beakOpen: 0.2, brow: 1, scarf: { wind: 1 } }, ride(spd, ua, { cadence: 13 }));
      mb.pop(); mb.push(HILL.shear);
      buildRail(mb, spd * u + 120, -2.6, { from: -22, to: 10 }); buildPines(mb, spd * u + 120, -4.8, 2.3, 61, 24);
      mb.pop();
    }, discBlur: 2.0, eyes: { falcon: { open: 1, mode: u > 0.3 ? 4 : 0, brow: 1.05, lookX: 0.3, glow: 0.35, glint: pulse(u, 0.55, 0.35) }, hero: { open: 0.8, brow: 1.2 } }
  });
  const g = fxLayer(F);
  speedH(g, u, 91, { n: 26, alpha: 0.42, y0: 40, y1: 1000, v: 5600, len: 520, dir: -1 });
  const h = v.P('head'); sweatDrops(g, h[0] - 40, h[1] - 30, ua);
  caption(typeLayer(F), 'SPEED IS EVERYTHING.', 950, u, 0.34, { size: 58, heavy: true, color: '#ecdcff', bar: 'rgba(26,8,46,0.86)' });
  F.post = { vig: 0.36, bloom: 0.4 };
};

SHOTFN.ramp = (F, u, ua) => {
  const spd = 20;
  const rampX = x => 3.9 - 3.85 * x; const LEN = 2.4, HGT = 0.74;
  const hOf = (wx, rx) => { const q = (wx - rx) / LEN; return q <= 0 ? 0 : q <= 1 ? HGT * Math.pow(q, 1.5) : HGT + (q - 1) * LEN * HGT * 0.55 / LEN * 1.9; };
  const place = (x0, z, time) => {
    const rx = rampX(time); const hr = hOf(x0 + BG.RA[0], rx), hf = hOf(x0 + BG.FA[0], rx); const ang = Math.atan2(hf - hr, BG.FA[0] - BG.RA[0]);
    return M4.chain(M4.T([x0, hr, z]), M4.about([BG.RA[0], 0, 0], M4.Rz(ang)));
  };
  const c = lerpCam(cam([0.35, 0.34, 4.35], [0.30, 0.98, 0], 34, -0.04), cam([0.95, 0.55, 4.65], [0.45, 1.25, 0], 34, -0.11), easeIn(clamp(u / 1.5)));
  const r = ride(spd, ua, { cadence: 14 });
  const v = view3d(F, {
    cam: shake(c, u, 0.014 + 0.03 * pulse(u, 0.72, 0.3), 25), env: { mode: 7, time: u, scroll: spd * u, speed: spd * (1 - smooth(0.8, 1.2, u)), sun: [0.34, 0.14, -0.93] }, light: LIGHT.sunset, focus: [0.2, 0.9, 0], shadowSize: 2.8,
    scene: (mb, out) => {
      hero(mb, out, { root: place(-0.35, 0.35, ua), t: ua, wind: 1, neck: 'tuck', body: { bob: 0.018 * Math.abs(Math.sin(r.crank)), pitch: -0.07 }, brow: 1, scarf: { wind: 1, len: 1.3, lift: 0.06 } }, r);
      rival(mb, out, { root: place(0.95, -0.95, ua), t: ua, wind: 1, neck: 'aero' }, drive(1.4 + ua * 10, { blur: 2.2, chainFast: true }));
      const rx = rampX(u); buildRamp(mb, rx, rx + LEN, HGT, -1.55, 0.95);
      buildRocks(mb, spd * u, -3.0, 2.6, 101, 0.30, MAT.rock, 16);
    }, discBlur: 1.8, eyes: { hero: { open: 1, brow: 1.3, glint: pulse(u, 0.5, 0.3) }, falcon: { open: 0.9, brow: 1.3 } }
  });
  const g = fxLayer(F);
  speedRadial(g, 1300, 400, F.draw, { inner: 600, alpha: 0.30 + 0.3 * smooth(0.6, 1.4, u), n: 90, color: '#fff0d8' });
  speedH(g, u, 95, { n: 20, alpha: 0.4, y0: 650, y1: 1070, v: 6200, len: 520, dir: 1, color: '#ffe0c0' });
  const p = v.P('rearContact'); if (u > 0.9) sparks(g, u, { x: p[0], y: p[1], t0: 0.9, t1: 1.35, rate: 180, dir: PI * 1.05, spread: 0.8, speed: 1400, life: 0.3, width: 6 });
  F.post = { vig: 0.32, bloom: 0.5, bloomThr: 0.82 };
};

// canyon cliffs seen in profile; dy shifts them vertically as the camera falls
// the sunlit lip that makes a ledge read as a ledge
function ledgeLip(mb, x0, x1, y, z0, z1, part) {
  mb.box([(x0 + x1) / 2, y + 0.012, (z0 + z1) / 2], [(x1 - x0) / 2, 0, 0], [0, 0.030, 0], [0, 0, (z1 - z0) / 2 + 0.02], { mat: MAT.rock, part, lw: 0.9, ao: 0.55 });
}
function buildCliffs(mb, dy = 0, dxL = 0, dxR = 0) {
  mb.push(M4.T([dxL, dy, 0])); ledgeLip(mb, -16, -3.33, 0.0, -1.5, 0.7, 510);
  buildPrism(mb, [[-16, 0.0], [-3.35, 0.0], [-3.10, -0.10], [-3.22, -0.62], [-2.86, -0.95], [-3.28, -1.55], [-3.05, -2.4], [-3.55, -3.1], [-3.30, -4.3], [-3.95, -5.4], [-3.7, -9], [-16, -9]], -1.5, 0.7, MAT.silRock, 500, 1.0);
  mb.pop(); mb.push(M4.T([dxR, dy, 0])); ledgeLip(mb, 4.28, 16, -0.16, -1.5, 0.7, 511);
  buildPrism(mb, [[16, -0.16], [4.30, -0.16], [4.02, -0.28], [4.28, -0.80], [3.90, -1.20], [4.40, -1.75], [4.18, -2.6], [4.70, -3.4], [4.45, -4.8], [5.05, -6.0], [4.8, -9], [16, -9]], -1.5, 0.7, MAT.silRock, 504, 1.0);
  mb.pop();
}
SHOTFN.leap = (F, u, ua) => {
  const slow = t => t < 0.42 ? t / 0.42 : 1 + (t - 0.42) * 0.17;
  const q = slow(u), qa = slow(ua);
  const heroP = s => [lerp(-3.05, -0.35, Math.min(1, s)) + Math.max(0, s - 1) * 1.15, 0.05 + 1.00 * Math.sin(Math.min(1.5, s) * PI * 0.40), 0.45];
  const falP = s => [lerp(-1.55, 1.40, Math.min(1, s)) + Math.max(0, s - 1) * 2.05, 0.18 + 1.40 * Math.sin(Math.min(1.6, s) * PI * 0.38), -0.55];
  const k = easeInOut(clamp(u / 2.25));
  const c = lerpCam(cam([0.45, 1.05, 10.9], [0.45, 1.08, 0], 29, 0.0), cam([0.35, 0.90, 8.9], [0.30, 1.18, 0], 29, -0.035), k);
  const hp = heroP(qa), fp = falP(qa);
  const pit = 0.30 - 0.22 * Math.min(1.3, qa);
  view3d(F, {
    cam: c, env: { mode: 7, time: u * 0.3, scroll: 6 + q * 0.6, ground: 0, sun: [0.012, 0.062, -1.0] }, light: Object.assign({}, LIGHT.sunset, { dir: [0.15, 0.55, 0.45], rimDir: [0.15, 0.55, -0.8] }), sil: 0.90, silCol: [0.13, 0.025, 0.14], noShadow: true, line: 2.6, ink: [0.08, 0.01, 0.09],
    scene: (mb, out) => {
      hero(mb, out, { root: M4.chain(M4.T(hp), M4.about([0.1, 0.7, 0], M4.Rz(pit))), t: ua * 0.55, wind: 0.85, neck: { a: 'tuck', b: 'ride', k: smooth(0.4, 1.2, ua) }, brow: 1, scarf: { wind: 1, len: 1.55, lift: 0.14 }, crestRaise: 0.2 }, { wheel: 5 + qa * 6, crank: 0.15, blur: ua < 0.42 ? 1.8 : 0.25 });
      rival(mb, out, { root: M4.chain(M4.T(fp), M4.about([0.1, 0.7, 0], M4.Rz(pit * 0.8))), t: ua * 0.55, wind: 0.85, neck: 'aero' }, { wheel: 5 + qa * 6, crank: 0.1, blur: ua < 0.42 ? 1.8 : 0.25 });
      buildCliffs(mb);
    }, discBlur: ua < 0.42 ? 1.5 : 0.2, eyes: { hero: { open: 1, brow: 1.1 }, falcon: { open: 1, brow: 1.1, glow: 0.8 } }
  });
  const g = fxLayer(F);
  if (u < 0.45) speedH(g, u, 99, { n: 34, alpha: 0.55 * (1 - u / 0.45), y0: 100, y1: 950, v: 6000, len: 520, color: '#ffe8c0' });
  embers(g, u * 0.25, { n: 30, stretch: 1.0 });
  F.post = { vig: 0.38, bloom: 0.55, bloomThr: 0.84, letter: 0.085 * smooth(0.45, 0.75, u) };
};

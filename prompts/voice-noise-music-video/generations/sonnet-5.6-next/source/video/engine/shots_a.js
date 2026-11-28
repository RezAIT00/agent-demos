// Act 1: the original recording, the silent world, the riff and the Hush.
'use strict';
const SHOTS = [];
const shot = (name, start, end, draw) => SHOTS.push({ name, start, end, draw });
const quake = (t, amt) => [noise1(t * 31, 3) * amt, noise1(t * 37, 8) * amt];
const since = (t, t0, k = 8) => t < t0 ? 0 : Math.exp(-(t - t0) * k);
const frames = (u, a, n) => u >= a && u < a + n / 24;
function desaturate(g, amount = 1) {
  g.save(); g.globalCompositeOperation = 'saturation'; g.globalAlpha = amount; g.fillStyle = '#808080'; g.fillRect(0, 0, W, H); g.restore();
}
function wash(g, color, alpha = 1, mode = 'source-over') {
  g.save(); g.globalCompositeOperation = mode; g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(-200, -200, W + 400, H + 400); g.restore();
}
const DUSK = ['#1d1b66', '#7a3fb0', '#ff9a76', '#ffe3c4', '#8a4fa8'];
const DAWN = ['#2f6fe8', '#6fc4ff', '#ffd9a8', '#ffffff', '#a8b8f0'];
const STORM = ['#0d0a22', '#2b1c4a', '#4a3560', '#8d7ca8', '#241636'];
const NIGHT = ['#060a2e', '#16246e', '#4b3f9e', '#7f78c8', '#1c2260'];
const sky = (g, t, c, sun = [1300, 800, 0.8, 0.5], scroll = [0, 0, 0, 1]) => backdrop(g, 'sky', t, c, sun, scroll);

// ------------------------------------------------------------ the recording
const SLOT = i => [210 + i * 300, 962];
function waveStrip(g, t, x, y, w, h) {
  const wave = D.originalWave, len = D.originalLength, per = wave.length / w;
  for (let px = 0; px < w; px += 4) {
    let m = 0;
    for (let k = Math.floor(px * per); k < (px + 4) * per && k < wave.length; k++) m = Math.max(m, Math.abs(wave[k]));
    const at = px / w * len, seg = D.original.find(s => at >= s.start && at <= s.end), played = at <= t;
    const bh = Math.max(3, Math.sqrt(m) * h);
    g.fillStyle = played ? (seg ? SPIRITS[seg.i].color : '#cfd6ff') : '#39407a';
    g.fillRect(x + px, y - bh / 2, 3, bh);
  }
  if (t <= len) { const px = x + t / len * w; g.fillStyle = '#ffffff'; g.fillRect(px - 2, y - h * 0.62, 4, h * 1.24); glow(g, px, y, 70, '#9fe8ff', 0.8); }
}
function introBack(g, t, tint) {
  g.fillStyle = lin(g, 0, 0, 0, H, ['#070720', '#14103c', '#070720']); g.fillRect(0, 0, W, H);
  if (tint) glow(g, W / 2, 430, 900, tint, 0.34);
  g.save(); g.globalAlpha = 0.17; g.strokeStyle = '#7d8bff'; g.lineWidth = 1.5;
  for (let i = -16; i <= 16; i++) { g.beginPath(); g.moveTo(W / 2 + i * 34, 640); g.lineTo(W / 2 + i * 260, H); g.stroke(); }
  for (let i = 0; i < 12; i++) { const k = ((i + t * 0.8) % 12) / 12, y = 640 + k * k * 440; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.restore();
  motes(g, t, 60, 8, ['#8ea0ff', '#ff8fd0', '#8ff6ff'], { rise: 40, size: 4, alpha: 0.5 });
}

shot('recording', 0, D.originalLength, (g, t, u, fx) => {
  const cur = D.original.findLast(s => t >= s.start - 0.04);
  const live = cur && t <= cur.end + 0.42 ? cur : null;
  const c = live ? SPIRITS[live.i] : null;
  introBack(g, t, c && c.color);
  const env = D.originalEnv[clamp(Math.floor(t * 60), 0, D.originalEnv.length - 1)];
  // header
  circle(g, 96, 84, 13 + 3 * Math.sin(t * 8)); paint(g, '#ff3f5f');
  plain(g, 'THE ORIGINAL RECORDING', 132, 74, 46, '#ffffff', { align: 'left', weight: 800, spacing: 5 });
  plain(g, 'your noises, exactly as you recorded them', 134, 122, 28, '#9fa8e8', { align: 'left', weight: 500, spacing: 2 });
  plain(g, `00:0${Math.min(t, D.originalLength).toFixed(2)}`, W - 80, 82, 46, '#ffffff', { align: 'right', weight: 600, spacing: 3 });
  if (!live && t < D.original[0].start) {
    const k = easeOut(prog(t, 0.1, 0.55));
    lettering(g, 'オリジナル', W / 2, 400, 128, { font: FONT_JP, fill: ['#ffffff', '#9fe8ff'], alpha: k, scale: 0.8 + 0.2 * k });
    plain(g, 'SIX NOISES FOUND', W / 2, 520, 44, '#ffd1ee', { spacing: 16, alpha: k });
  }
  if (live) {
    const a = t - live.start, pop = a < 0 ? 0 : backOut(clamp(a / 0.26)), leave = easeInOut(prog(t, live.end + 0.12, live.end + 0.42));
    const idx = SPIRIT_IDS.indexOf(live.i);
    lettering(g, c.kana, W / 2, 440, c.kana.length > 2 ? 400 : 520, { font: FONT_JP, fill: c.color, stroke: null, key: null, drop: null, alpha: 0.2 * (1 - leave), scale: 1.35 - 0.35 * expoOut(clamp(a / 0.4)) });
    // circular oscilloscope drawn from the actual samples around the playhead
    const at = Math.floor(clamp(t, 0, D.originalLength) * 6000);
    g.beginPath();
    for (let i = 0; i <= 360; i++) {
      const ang = i / 360 * TAU - Math.PI / 2, s = D.originalWave[Math.max(0, at - 360 + (i % 360))] || 0;
      const rr = (262 + s * 330) * pop * (1 - leave);
      const x = W / 2 + Math.cos(ang) * rr, y = 430 + Math.sin(ang) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    paint(g, null, c.color, 7); paint(g, null, '#ffffffcc', 2);
    for (let i = 0; i < 3; i++) ring(g, W / 2, 430, a - i * 0.13, c.color, { speed: 720, life: 0.8, width: 22 });
    const [sx, sy] = SLOT(idx);
    spirit(g, live.i, lerp(W / 2, sx, leave), lerp(430, sy, leave), lerp(165 * pop, 60, leave), { t, sing: a >= 0 && t <= live.end ? clamp(env * 1.6) : 0, energy: env * (1 - leave) });
    if (a >= 0) {
      const k = expoOut(clamp(a / 0.28)), out = 1 - leave;
      lettering(g, c.name, lerp(-300, 380, k), 400, 150, { fill: ['#ffffff', c.light, c.color], drop: c.dark, alpha: out });
      plain(g, `NOISE ${c.n} OF 6`, lerp(-300, 380, k), 520, 36, '#ffffff', { spacing: 10, alpha: out });
      lettering(g, c.kana, lerp(W + 300, W - 360, k), 440, 130, { font: FONT_JP, fill: c.color, drop: null, alpha: out, rot: 0.06 });
    }
    fx.flash = since(t, live.start, 14) * 0.32; fx.flashColor = c.color;
    fx.shake = quake(t, since(t, live.start, 9) * 0.006); fx.chroma = 2 + 14 * since(t, live.start, 7);
  }
  waveStrip(g, t, 140, 785, 1640, 150);
  D.original.forEach((s, i) => {
    const [x, y] = SLOT(i), done = t > s.end + 0.42, c2 = SPIRITS[s.i];
    ellipse(g, x, y + 62, 94, 20); paint(g, done ? c2.color + '55' : '#ffffff10', done ? c2.color : '#4a4f8a', 3);
    if (done) spirit(g, s.i, x, y, 60, { t, energy: since(t, s.end + 0.42, 5) });
    else if (!live || live !== s) plain(g, String(i + 1), x, y + 10, 52, '#4a4f8a');
    plain(g, c2.name, x, y + 98, 25, done ? '#ffffff' : '#5a60a0', { spacing: 4 });
  });
  fx.bloom = 0.8; fx.thresh = 0.66; fx.fade = 1 - prog(t, 0, 0.25);
});

shot('gather', D.originalLength, D.songAt, (g, t, u, fx, p) => {
  introBack(g, t, '#8a5cff');
  const spin = u * 2 + u * u * u * 5.2, radius = u < 0.45 ? 340 : 340 * (1 - easeIn(prog(u, 0.95, 1.5)));
  const fly = easeInOut(prog(u, 0, 0.5));
  for (let i = 0; i < 6; i++) {
    const a = spin + i / 6 * TAU - Math.PI / 2, [sx, sy] = SLOT(i);
    const x = lerp(sx, W / 2 + Math.cos(a) * radius * 1.35, fly), y = lerp(sy, 500 + Math.sin(a) * radius * 0.82, fly);
    const trail = [];
    for (let k = 0; k < 18; k++) { const b = a - k * 0.075 * (0.4 + p * 2); trail.push([W / 2 + Math.cos(b) * radius * 1.35, 500 + Math.sin(b) * radius * 0.82]); }
    if (fly > 0.9) waveRibbon(g, trail, SPIRITS[SPIRIT_IDS[i]].color, 12, t, i);
    spirit(g, SPIRIT_IDS[i], x, y, lerp(60, 76, fly) * (1 - 0.6 * prog(u, 1.2, 1.52)), { t, sing: 0.6, energy: p });
  }
  glow(g, W / 2, 500, 120 + 720 * easeIn(p), '#ffffff', easeIn(p));
  const k1 = expoOut(prog(u, 0.12, 0.4)), k2 = expoOut(prog(u, 0.66, 0.92));
  lettering(g, 'SIX NOISES', W / 2, 150, 118, { fill: ['#ffffff', '#9fe8ff'], alpha: k1, scale: 1.5 - 0.5 * k1 });
  lettering(g, 'ONE SONG', W / 2, 890, 150, { fill: ['#fff7b0', '#ff6ab0'], alpha: k2, scale: 1.7 - 0.7 * k2 });
  if (radius < 300) focusLines(g, W / 2, 500, t, { inner: 340, alpha: prog(u, 0.9, 1.4) * 0.7 });
  fx.bloom = 0.8 + p; fx.zoom = 0.09 * easeIn(p); fx.shake = quake(t, 0.007 * easeIn(p));
  fx.flash = easeIn(prog(u, 1.34, 1.52));
});

// ------------------------------------------------------------ 静寂 : silence
function silentCity(g, t) {
  sky(g, t * 0.4, ['#1c1e26', '#4a4e5a', '#8b8f98', '#b4b8c0', '#3a3d48'], [1500, 200, 0.12, 0.74], [t * 14, 0, 0, 1]);
  city(g, 'night', 400 + t * 9, H + 40, 1.05);
}
shot('silence_wide', barT(0), barT(2), (g, t, u, fx, p) => {
  const z = 1 + 0.2 * easeInOut(p);
  inCam(g, lerp(960, 860, p), lerp(540, 520, p), z, 0, () => {
    silentCity(g, t);
    rooftop(g, 250, 842, 640, '#9aa4c8', '#08070f');
    figure(g, POSES.stand, { x: 760, y: 610, s: 0.52, t: onTwos(t), wind: -0.55, silhouette: '#0a0912', rim: '#dfe6ff', turn: 0.8 });
    desaturate(g, 0.96);
    rain(g, t, 520, 0.6);
    // the only colour left: each hint of the tune ripples through the rain
    recent('ooo', t, 1.1, ['chime']).forEach(e => {
      const k = Math.round((e.t - D.songAt) / BEAT), c = SPIRITS[SPIRIT_IDS[k % 6]].color, x = 360 + hash(k + 4) * 1200, y = 180 + hash(k + 9) * 520;
      ring(g, x, y, t - e.t, c, { speed: 290, life: 1.1, width: 13 });
      ring(g, x, y, t - e.t - 0.14, c, { speed: 220, life: 0.9, width: 7 });
      glow(g, x, y, 130, c, since(t, e.t, 3.2));
    });
  });
  const a = easeOut(prog(u, 0.35, 1.1));
  vertical(g, '静寂', 1720, 190, 112, '#ffffff', a);
  vertical(g, 'しじま', 1612, 240, 40, '#d8dcec', a);
  g.save(); g.shadowColor = '#000000'; g.shadowBlur = 14;
  for (let k = 0; k < 3; k++) plain(g, 'the world forgot how to make a sound', 96, 925, 40, '#ffffff', { align: 'left', weight: 600, spacing: 5, alpha: easeOut(prog(u, 0.9, 1.7)) });
  g.restore();
  fx.bars = 0.1; fx.flash = 1 - easeOut(prog(u, 0, 0.6)); fx.bloom = 0.45; fx.vig = 0.55; fx.grain = 0.045;
  fx.shake = quake(t, hitEnv('kick', t, 0.1) * 0.0016);
});
shot('silence_face', barT(2), barT(3), (g, t, u, fx, p) => {
  silentCity(g, t); wash(g, '#05060c', 0.35);
  const k = hitEnv('kick', t, 0.16), o = { x: 960, y: 500, s: 1.52 + 0.1 * p + k * 0.018, t: onTwos(t), eyeL: 0, eyeR: 0, mouth: 'flat', wind: -0.2, blush: 0.25, glow: k, tilt: -0.05 };
  portrait(g, o);
  desaturate(g, 0.92 - 0.2 * p);
  wash(g, '#7d86ad', 0.65, 'multiply'); fx.thresh = 0.86;
  for (const s of [-1, 1]) { const x = o.x + s * 192 * o.s, y = o.y + 40 * o.s; glow(g, x, y, 150 + 130 * k, '#35e8ff', 0.35 + 0.65 * k); ring(g, x, y, t - (barT(2) + Math.floor(u / BEAT) * BEAT), '#6ff2ff', { speed: 420, life: 0.34, width: 14 }); }
  rain(g, t, 360, 0.55);
  fx.bars = 0.1; fx.vig = 0.6; fx.bloom = 0.5; fx.chroma = 2 + k * 7; fx.shake = quake(t, k * 0.003);
});
shot('silence_eyes', barT(3), barT(4), (g, t, u, fx, p) => {
  const k = hitEnv('kick', t, 0.12), s = 4.7 + 0.5 * easeIn(p) + k * 0.09;
  g.fillStyle = '#0c0a14'; g.fillRect(0, 0, W, H);
  const tremble = u > BEAT * 2.5 ? Math.max(0, Math.sin(u * 52)) * 0.09 * prog(u, BEAT * 2.5, BEAT * 4) : 0;
  portrait(g, { x: 960, y: 540 - 36 * s, s, t: onTwos(t), eyeL: tremble, eyeR: tremble, mouth: 'flat', wind: -0.1, blush: 0.2, phones: false, brow: 0.2 * p, bust: false, scarfTail: false });
  desaturate(g, 1 - easeIn(p) * 0.75);
  wash(g, '#59628f', 0.8 - 0.3 * easeIn(p), 'multiply');
  fx.thresh = 0.9; fx.bloom = 0.4;
  glow(g, -80, 560, 800, '#35e8ff', 0.2 + 0.4 * k); glow(g, 2000, 560, 800, '#ff3fa4', (0.15 + 0.35 * k) * p);
  motes(g, t, 40, 3, ['#6ff2ff', '#ff8fd0'], { rise: 160, size: 6, alpha: p });
  fx.bars = lerp(0.1, 0.17, easeOut(p)); fx.vig = 0.55; fx.shake = quake(t, easeIn(p) * 0.004); fx.chroma = 2 + 9 * p;
});

// ------------------------------------------------------------ the riff
function irisSix(g, t) {
  return (ctx) => SPIRIT_IDS.forEach((id, i) => { const a = i / 6 * TAU + t * 4.5; sparkle(ctx, Math.cos(a) * 19, Math.sin(a) * 25, 7.5, SPIRITS[id].color, a); });
}
shot('eyes_open', barT(4), barT(4, 3), (g, t, u, fx, p) => {
  const open = backOut(clamp(u / 0.14), 3), s = 5.5 - 0.75 * expoOut(clamp(u / 0.5)) + 0.12 * p;
  backdrop(g, 'warp', t, ['#1a0b45', '#ff3fa4', '#3ff2ff', '#ffe14a'], [960, 540, 0.9, 0.6]);
  portrait(g, { x: 960, y: 540 - 34 * s, s, t: onTwos(t), eyeL: open, eyeR: open, mouth: 'determined', wind: 0.5, brow: 0.55, phones: false, bust: false, scarfTail: false, irisMark: irisSix(g, t), irisPulse: hitEnv('nyaa', t, 0.1) });
  focusLines(g, 960, 540, t, { inner: 760, alpha: 0.85, count: 130 });
  for (const sd of [-1, 1]) ring(g, 960 + sd * 66 * s, 540, u - 0.05, '#aef6ff', { speed: 1300, life: 0.7, width: 36 });
  if (frames(u, 0, 2)) { fx.impact = 1; fx.ink = '#14032e'; fx.paper = '#ffffff'; }
  else if (frames(u, 2 / 24, 1)) { fx.invert = 1; }
  fx.chroma = 3 + 26 * since(t, barT(4), 5); fx.zoom = 0.1 * since(t, barT(4), 6); fx.shake = quake(t, 0.016 * since(t, barT(4), 5));
  fx.bloom = 0.8; fx.bars = 0.17 * (1 - expoOut(clamp(u / 0.3)));
});
shot('title', barT(4, 3), barT(6), (g, t, u, fx, p) => {
  backdrop(g, 'burst', t, ['#ff2f87', '#ff7a45', '#7a1fae'], [960, 520, t * 1.7, 18]);
  const k = hitEnv('nyaa', t, 0.09);
  const word = (w, x, y, size, delay, rot) => {
    const q = prog(u, delay, delay + 0.2); if (q <= 0) return;
    lettering(g, w, x, y, size, { fill: ['#ffffff', '#fff3a8', '#ffb02e'], drop: '#3a0b6e', rot, scale: (2.6 - 1.6 * expoOut(q)) * (1 + k * 0.025), alpha: clamp(q * 3) });
  };
  inCam(g, 960, 540, 1 + 0.05 * p, -0.035 + 0.02 * p, () => {
    SPIRIT_IDS.forEach((id, i) => {
      const pos = [[245, 235], [610, 140], [1660, 205], [250, 855], [1290, 925], [1710, 815]][i], q = prog(u, 0.12 + i * 0.07, 0.4 + i * 0.07);
      liveSpirit(g, id, pos[0], pos[1], 100 * backOut(q), t, { rot: (i - 2.5) * 0.07 });
    });
    word('TAKE', 800, 360, 290, 0.0, -0.05);
    word('ON ME', 1100, 640, 290, BEAT * 0.5, -0.05);
  });
  const q = expoOut(prog(u, BEAT * 1.4, BEAT * 1.4 + 0.3));
  g.save(); g.translate(lerp(2400, 960, q), 862); g.rotate(-0.035); g.fillStyle = INK; g.fillRect(-520, -48, 1040, 96); g.restore();
  plain(g, '★ PERFORMED BY SIX NOISES ★', lerp(2400, 960, q), 862, 50, '#ffffff', { weight: 800, spacing: 6 });
  petals(g, t, 40, 21, { vx: -900, vy: 380 });
  fx.flash = since(t, barT(4, 3), 11) * 0.9; fx.chroma = 3 + 12 * since(t, barT(4, 3), 6) + k * 4;
  fx.shake = quake(t, 0.01 * Math.max(since(u, BEAT * 0.5, 9) * (u > BEAT * 0.5 ? 1 : 0), since(u, 0, 9)));
});

function orbit(g, t, cx, cy, rx, ry, front, r = 58, speed = 1.1) {
  SPIRIT_IDS.forEach((id, i) => {
    const a = i / 6 * TAU + t * speed, z = Math.sin(a);
    if ((z > 0) !== front) return;
    liveSpirit(g, id, cx + Math.cos(a) * rx, cy + z * ry, r * (1 + z * 0.3), t);
  });
}
shot('hero', barT(6), barT(7, 4), (g, t, u, fx, p) => {
  const tc = onTwos(t);
  inCam(g, 960, 540, 1.16 - 0.14 * easeInOut(p), lerp(-0.045, 0.025, p), () => {
    sky(g, t, DUSK, [1640, 780, 0.55, 0.56], [t * 70, 0, 0.5, 1]);
    city(g, 'dusk', 900 + t * 40, H + 190, 1);
    orbit(g, t, 960, 620, 700, 190, false);
    portrait(g, { x: 940, y: 505 + Math.sin(t * 2) * 8, s: 1.38, t: tc, mouth: u < 1.35 ? 'smile' : 'grin', wind: -0.72, turn: -0.28 + 0.12 * p, tilt: 0.05 - 0.06 * p, brow: 0.1, look: [-0.2, 0], glow: hitEnv('nyaa', t, 0.1), eyeL: u > 2.0 && u < 2.14 ? 0 : 1, eyeR: u > 2.0 && u < 2.14 ? 0 : 1 });
    orbit(g, t, 960, 620, 700, 190, true);
    petals(g, t, 70, 7, { vx: -620, vy: 170 });
  });
  sparkles(g, t, 26, 31, [0, 0, W, 700], 30);
  glow(g, 1700, 800, 420, '#ffb070', 0.18);
  // colour floods back outward from her
  const k = prog(u, 0, 0.7);
  if (k < 1) {
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(960, 520, 1300 * easeOut(k), 0, TAU, true); g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fill('evenodd'); g.restore();
    ring(g, 960, 520, u, '#ffffff', { speed: 1300, life: 0.7, width: 60 });
  }
  fx.bloom = 0.5; fx.thresh = 0.86; fx.flash = since(t, barT(6), 9) * 0.5; fx.chroma = 2.4 + hitEnv('kick', t, 0.08) * 5;
  fx.zoom = hitEnv('kick', t, 0.07) * 0.012;
});

function roofs(g, scroll, y, rim, body) {
  const span = 1180;
  for (let i = -1; i < 3; i++) {
    const k = Math.floor(scroll / span) + i, x = k * span - scroll + 200;
    rooftop(g, x, y + (hash(k + 2) - 0.5) * 70, 930, rim, body);
  }
}
shot('run', barT(8), barT(9, 2), (g, t, u, fx, p) => {
  const tc = onTwos(t), speed = 1500;
  const air = prog(u, BEAT * 2.4, BEAT * 5.2), lift = Math.sin(Math.PI * air) * 250;
  inCam(g, 960, 540, 1.04 + 0.05 * Math.sin(Math.PI * air), -0.05, () => {
    sky(g, t, DUSK, [420, 760, 0.95, 0.5], [t * 220, 0, 0.35, 1]);
    city(g, 'dusk', t * speed * 0.55, H + 30, 0.98);
    roofs(g, t * speed, 925, '#ffb08a', '#150a33');
    // spirits stream behind her on ribbons of light
    SPIRIT_IDS.forEach((id, i) => {
      const bx = 640 - i * 108, by = 470 + Math.sin(t * 5 + i * 1.1) * 62 + (i % 2) * 130 - lift * 0.5;
      const tr = []; for (let k = 0; k < 16; k++) tr.push([bx - k * 34, by + Math.sin((t - k * 0.035) * 5 + i * 1.1) * 62 - Math.sin(t * 5 + i * 1.1) * 62]);
      waveRibbon(g, tr, SPIRITS[id].color, 9, t, i);
      liveSpirit(g, id, bx, by, 43, t);
    });
    const running = runPose((songBeat(tc) / 2) % 1);
    const pose = air > 0 && air < 1 ? blendPose(running, POSES.leap, smooth(clamp(Math.sin(Math.PI * air) * 2))) : running;
    const bob = air > 0 && air < 1 ? 0 : Math.abs(Math.sin(songBeat(tc) * Math.PI)) * 34;
    figure(g, pose, { x: 1100, y: 640 - bob - lift, s: 0.74, t: tc, wind: -1, mouth: air > 0.1 && air < 0.9 ? 'open' : 'smile', open: 0.6, brow: 0.35 });
  });
  streaks(g, t, 0, { count: 44, alpha: 0.55, len: 560, speed: 5600, band: 150 });
  petals(g, t, 46, 13, { vx: -1500, vy: 60, size: 13 });
  fx.chroma = 3 + hitEnv('kick', t, 0.07) * 6; fx.shake = quake(t, hitEnv('kick', t, 0.06) * 0.0035); fx.zoom = 0.008 + 0.012 * hitEnv('kick', t, 0.06);
  fx.flash = since(t, barT(8), 10) * 0.8; fx.center = [0.58, 0.55];
});

shot('panels', barT(9, 2), barT(10), (g, t, u, fx) => {
  const tc = onTwos(t);
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  const slide = i => (1 - expoOut(prog(u, i * BEAT * 0.5, i * BEAT * 0.5 + 0.16)));
  if (u >= 0) {
    g.save(); g.translate(-slide(0) * 2000, 0);
    panel(g, [[30, 40], [1890, 40], [1890, 420], [30, 520]], () => {
      g.fillStyle = '#ff4f9c'; g.fillRect(0, 0, W, H);
      streaks(g, t, 0, { count: 70, alpha: 0.5, color: '#fff0f8' });
      portrait(g, { x: 960 - u * 40, y: 175, s: 3.5, t: tc, mouth: 'determined', brow: 1, wind: -0.6, phones: false, bust: false, scarfTail: false });
    });
    g.restore();
  }
  if (u >= BEAT * 0.5) {
    g.save(); g.translate(0, slide(1) * 900);
    panel(g, [[30, 552], [930, 502], [800, 1040], [30, 1040]], () => {
      sky(g, t, DUSK, [300, 800, 0.8, 0.5], [t * 800, 0, 0, 1]);
      const run = runPose((songBeat(tc) / 1.4) % 1);
      figure(g, run, { x: 410, y: 440, s: 1.5, t: tc, wind: -1 });
      streaks(g, t, 0, { count: 50, alpha: 0.7, width: 7 });
    });
    g.restore();
  }
  if (u >= BEAT) {
    g.save(); g.translate(slide(2) * 1200, 0);
    panel(g, [[962, 500], [1890, 452], [1890, 1040], [832, 1040]], () => {
      backdrop(g, 'burst', t, ['#18c8e8', '#2f6fe8', '#12104a'], [1390, 760, -t * 3, 16]);
      portrait(g, { x: 1150, y: 640, s: 2.2, t: tc, turn: 0.75, mouth: 'smile', wind: -0.8, glow: 0.5 + 0.5 * hitEnv('nyaa', t, 0.1), bust: false, scarfTail: false });
      for (let i = 0; i < 3; i++) ring(g, 1590, 760, (u - BEAT - i * 0.12), '#ffffff', { speed: 700, life: 0.5, width: 20 });
    });
    g.restore();
  }
  lettering(g, 'ダッ', 905, 545, 118, { font: FONT_JP, fill: '#ffffff', drop: '#ff3f8e', rot: -0.14, scale: backOut(prog(u, BEAT * 0.5, BEAT)) });
  const hit = [0, 0.5, 1].reduce((a, b) => Math.max(a, u >= b * BEAT ? since(u, b * BEAT, 13) : 0), 0);
  fx.shake = quake(t, hit * 0.012); fx.chroma = 2 + hit * 12;
});

function bigMoon(g, x, y, r) {
  glow(g, x, y, r * 1.8, '#7aa0ff', 0.45);
  circle(g, x, y, r); paint(g, rad(g, x - r * 0.2, y - r * 0.25, r * 0.1, r * 1.25, ['#f4ecd0', '#e6d4b4', '#a999cc']));
  g.save(); circle(g, x, y, r); g.clip();
  const q = rng(44);
  for (let i = 0; i < 34; i++) { const a = q() * TAU, d = Math.sqrt(q()) * r * 0.95, s = r * (0.025 + q() * q() * 0.19); ellipse(g, x + Math.cos(a) * d, y + Math.sin(a) * d, s, s * 0.84, a); paint(g, '#8f78b455'); }
  g.restore();
}
shot('moon_leap', barT(10), barT(11), (g, t, u, fx, p) => {
  const tc = onTwos(t);
  inCam(g, 960, 540, 1.02 + 0.09 * p, 0.015 - 0.03 * p, () => {
    sky(g, t * 0.6, NIGHT, [0, 0, 0, 0.34], [t * 30, 0, 1.1, 1.2]);
    bigMoon(g, 1010, 450, 405);
    puff(g, 1500 - u * 90, 700, 720, 3, '#8f86d0', '#35317a', 0.9); puff(g, 420 - u * 60, 790, 880, 9, '#7b72c0', '#2a2668', 0.95);
    city(g, 'night', 1400 + t * 110, H + 210, 0.95);
    const q = lerp(0.08, 0.92, p * 0.55 + easeOut(p) * 0.45);
    const x = lerp(330, 1560, q), y = 790 - Math.sin(Math.PI * q) * 340;
    SPIRIT_IDS.forEach((id, i) => {
      const b = clamp(q - 0.075 - i * 0.052), sx = lerp(330, 1560, b), sy = 835 - Math.sin(Math.PI * b) * 340 + Math.sin(t * 7 + i * 2) * 28;
      glow(g, sx, sy, 90, SPIRITS[id].color, 0.5); spirit(g, id, sx, sy, 25, { t, sing: hitEnv(id, t), energy: hitEnv(id, t), aura: 0.4 });
    });
    figure(g, POSES.leap, { x, y, s: 0.54, rot: (q - 0.5) * 0.45, t: tc, wind: -1, lift: 0.12, silhouette: '#171040', rim: '#fff0c8', rimOffset: [-7, 9] });
  });
  sparkles(g, t, 30, 61, [0, 0, W, 760], 22);
  fx.bloom = 0.5; fx.thresh = 0.87; fx.bars = 0.1; fx.flash = since(t, barT(10), 12) * 0.5;
});

function crackLines(g, x, y, grow, seed = 5) {
  const r = rng(seed);
  for (let i = 0; i < 8; i++) {
    let px = x, py = y, a = i / 8 * TAU + r() * 0.6; const pts = [[px, py]];
    const n = Math.floor(16 * clamp(grow - r() * 0.2));
    for (let k = 0; k < n; k++) { a += (r() - 0.5) * 1.5; const l = 30 + r() * 60; px += Math.cos(a) * l; py += Math.sin(a) * l * 0.8; pts.push([px, py]); }
    if (pts.length > 1) { poly(g, pts, false); paint(g, null, '#b24dff88', 30); paint(g, null, '#07020f', 13); paint(g, null, '#e9c4ff', 3); }
  }
}
shot('sky_cracks', barT(11), barT(12), (g, t, u, fx, p) => {
  const tc = onTwos(t), land = prog(u, 0, 0.22), tilt = easeInOut(prog(u, 0.42, 1.3));
  g.save(); g.translate(0, tilt * 260);
  g.save(); g.translate(0, -260); sky(g, t, DUSK, [1560, 980, 0.7, 0.5], [t * 24, 0, 0.5, 1]); g.restore();
  wash(g, '#14042c', 0.55 * prog(u, 0.55, 1.4));
  crackLines(g, 1130, 90, prog(u, 0.45, 1.35) * 1.15);
  city(g, 'dusk', 2100, H + 260, 1);
  rooftop(g, 360, 902, 520, '#ffb08a', '#12092b');
  for (let i = 0; i < 5; i++) { g.fillStyle = '#12092b'; g.fillRect(560 - i * 2, 902 - i * 40, 8 + i * 4, 44); }
  const pose = blendPose(POSES.crouch, POSES.stand, easeInOut(prog(u, 0.55, 1.0)));
  figure(g, pose, { x: 640, y: lerp(260, 750, easeIn(land)) - 40 * easeInOut(prog(u, 0.55, 1.0)), s: 0.5, t: tc, wind: lerp(-1, -0.5, p), lift: land < 1 ? 0.9 : 0, brow: 0.8, mouth: 'determined' });
  if (u > 0.22) { ring(g, 640, 900, u - 0.22, '#ffe0c0', { speed: 1100, life: 0.6, width: 36, flat: 0.22 }); shards(g, 640, 900, u - 0.22, { n: 26, speed: 760, size: 24, fill: ['#2a1650', '#40246e'], edge: '#ffb08a', gravity: 1500 }); }
  g.restore();
  fx.shake = quake(t, since(t, barT(11) + 0.22, 8) * 0.014 + 0.007 * prog(u, 0.6, 1.4)); fx.chroma = 2 + 8 * p;
});

// ------------------------------------------------------------ the Hush
function flatline(g, t, y, amp, color) {
  g.beginPath();
  for (let x = 0; x <= W; x += 8) { const v = y + Math.sin(x * 0.045 - t * 22) * noise1(x * 0.02 + t * 6, 2) * amp; x ? g.lineTo(x, v) : g.moveTo(x, v); }
  paint(g, null, color, 5);
}
shot('hush_rises', barT(12), barT(14), (g, t, u, fx, p) => {
  const rise = easeInOut(prog(u, 0, BAR * 1.45)), eyeOpen = easeInOut(prog(u, BAR * 0.9, BAR * 1.15)), drain = prog(u, 0, BAR * 1.6);
  inCam(g, 960, 540, 1.03 + 0.07 * p, 0, () => {
    sky(g, t * 0.7, STORM, [960, 300, 0.1, 0.7], [t * 90, t * 10, 0.2, 0.9]);
    crackLines(g, 1100, 150, 1.15);
    hush(g, 990, lerp(1500, 500, rise), 0.82 + 0.28 * rise, t, { eye: eyeOpen, reach: 0.4 + 0.75 * rise, look: [-0.8 * eyeOpen, 0.9 * eyeOpen] });
    city(g, 'night', 600, H + 250, 1.04);
    desaturate(g, drain * 0.62);
    glow(g, 390, 700, 330, '#7a4ad0', 0.5);
    rooftop(g, -60, 880, 640, '#c9b0ff', '#05020c');
    figure(g, POSES.stand, { x: 390, y: 698, s: 0.43, t: onTwos(t), wind: -0.95, silhouette: '#08040f', rim: '#f0e0ff', rimOffset: [13, 8] });
  });
  const a = easeOut(prog(u, BAR * 0.55, BAR * 1.1));
  vertical(g, '静寂', 190, 150, 170, '#e6dcff', a * 0.92);
  plain(g, 'THE HUSH', 190, 560, 44, '#e6dcff', { spacing: 9, alpha: a });
  flatline(g, t, 1018, 56 * (1 - drain), '#c9a8ff');
  fx.bars = 0.1; fx.vig = 0.62; fx.sat = 1 - drain * 0.25; fx.grain = 0.018 + drain * 0.04;
  fx.shake = quake(t, 0.0025 + hitEnv('kick', t, 0.13) * 0.007); fx.chroma = 3 + 9 * hitEnv('kick', t, 0.1);
});
function tendrilsClose(g, t, k) {
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU + hash(i) * 0.3, x = 960 + Math.cos(a) * 1250, y = 540 + Math.sin(a) * 850;
    const sp = flow(x, y, a + Math.PI + (hash(i + 7) - 0.5) * 0.9, 1260 * clamp(k * (0.8 + hash(i + 3) * 0.5)), t, { amp: 120, freq: 1.5, speed: 5, phase: i, n: 24, droop: (hash(i + 1) - 0.5) * 1.6 });
    ribbon(g, sp, v => 175 * Math.pow(1 - v, 0.9) + 2); paint(g, '#06020d', '#8d42e0', 6);
  }
}
shot('engulfed', barT(14), barT(14, 2), (g, t, u, fx, p) => {
  sky(g, t, STORM, [960, 300, 0.08, 0.72], [t * 160, 0, 0, 1]);
  hush(g, 960, 440, 1.2 + 0.9 * easeIn(p), t, { eye: 1, reach: 1.3, look: [0, 0.4] });
  figure(g, POSES.crouch, { x: 960, y: 850, s: 0.55 * (1 - 0.3 * p), t: onTwos(t), wind: -0.9, silhouette: '#140a26', rim: '#e8ccff' });
  tendrilsClose(g, t, easeIn(p) * 1.2);
  wash(g, '#030108', easeIn(prog(p, 0.66, 1)));
  fx.shake = quake(t, 0.006 + 0.014 * p); fx.chroma = 4 + 16 * p; fx.zoom = 0.07 * easeIn(p); fx.sat = 0.75;
  if (frames(u, 0, 2)) fx.invert = 1;
});
shot('darkness', barT(14, 2), barT(15, 2), (g, t, u, fx, p) => {
  const lit = Math.min(6, Math.floor(u / (BEAT * 0.62)) + 1), light = lit / 6;
  g.fillStyle = '#04020b'; g.fillRect(0, 0, W, H);
  portrait(g, { x: 960, y: 520, s: 1.75 + 0.2 * p, t: onTwos(t), mouth: 'determined', brow: 0.25 + 0.75 * p, wind: 0.1, lift: 0.1 * p, eyeL: 0.55 + 0.45 * p, eyeR: 0.55 + 0.45 * p, glow: light, blush: 0.2, look: [0, -0.1], irisPulse: light, irisMark: irisSix(g, t) });
  wash(g, '#0b0630', 0.82 - 0.58 * light, 'source-over');
  const s = 1.75 + 0.2 * p;
  for (const sd of [-1, 1]) { glow(g, 960 + sd * 66 * s, 520 + 30 * s, 90 + 90 * light, '#6ff6ff', 0.25 + 0.5 * light); glow(g, 960 + sd * 192 * s, 520 + 44 * s, 220, '#35e8ff', 0.5 * light); }
  for (let i = 0; i < lit; i++) {
    const pos = [[300, 250], [1620, 250], [210, 590], [1710, 590], [360, 900], [1560, 900]][i], t0 = barT(14, 2) + i * BEAT * 0.62;
    spirit(g, SPIRIT_IDS[i], pos[0], pos[1], 88 * backOut(prog(t, t0, t0 + 0.18)), { t, sing: since(t, t0, 4), energy: since(t, t0, 5) });
    ring(g, pos[0], pos[1], t - t0, SPIRITS[SPIRIT_IDS[i]].color, { speed: 620, life: 0.5, width: 24 });
  }
  motes(g, t, 90, 6, SPIRIT_IDS.map(k => SPIRITS[k].color), { rise: 220 * (0.3 + p), size: 5, alpha: light });
  fx.bloom = 0.65 + 0.5 * light; fx.shake = quake(t, 0.008 * p); fx.zoom = 0.025 * p; fx.chroma = 2 + 8 * p; fx.vig = 0.55;
  fx.flash = since(u, 0, 8) * 0.0;
});
shot('charge', barT(15, 2), barT(16), (g, t, u, fx, p) => {
  backdrop(g, 'warp', t, ['#06031a', '#8a3cff', '#35e8ff', '#ff3fa4'], [960, 560, 0.4 + 2 * p, 0.3 + p]);
  motes(g, t, 130, 17, SPIRIT_IDS.map(k => SPIRITS[k].color), { rise: 600 + 900 * p, size: 8 });
  glow(g, 960, 690, 400 + 420 * easeIn(p), '#ffffff', 0.35 + 0.6 * p);
  figure(g, POSES.crouch, { x: 960, y: 660, s: 0.88 + 0.06 * p, t: onTwos(t), wind: -0.1, lift: 0.8, silhouette: '#12083a', rim: '#bffbff', rimOffset: [0, 11] });
  for (let i = 0; i < 4; i++) ring(g, 960, 890, (u - i * 0.17), '#8ff6ff', { speed: 900, life: 0.45, width: 30, flat: 0.24 });
  focusLines(g, 960, 600, t, { inner: 640 - 330 * p, alpha: 0.4 + 0.5 * p });
  lettering(g, 'ゴゴゴ', 340, 300, 150, { font: FONT_JP, fill: '#d8b8ff', drop: '#3a0b6e', rot: -0.2, scale: 1 + 0.05 * Math.sin(t * 40) });
  lettering(g, 'ゴゴ', 1590, 760, 150, { font: FONT_JP, fill: '#d8b8ff', drop: '#3a0b6e', rot: 0.16, scale: 1 + 0.05 * Math.cos(t * 43) });
  fx.shake = quake(t, 0.003 + 0.017 * easeIn(p)); fx.zoom = 0.07 * easeIn(p); fx.chroma = 4 + 18 * p; fx.bloom = 0.8 + 0.7 * p;
  fx.flash = easeIn(prog(p, 0.82, 1));
});

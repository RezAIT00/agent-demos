// Act 2: the chorus, the transformation, the voice beam, the finale and end card.
'use strict';
const GOLD = ['#1c2080', '#6a46c0', '#ff9a70', '#ffd9c0', '#7a50a8'];
function cloudSea(g, t, sun, horizon, travel, side = 0, colors = ['#141e78', '#5658c4', '#f59a78', '#ffd6c4', '#6a4ea4'], starAmt = 0.5) {
  backdrop(g, 'sea', t, colors, [sun[0], sun[1], horizon, travel], [side, starAmt, 0, 0]);
}
function flare(g, x, y, a) {
  g.save(); g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a * 0.7; g.fillStyle = lin(g, x - 900, y, x + 900, y, [[0, '#6fd8ff00'], [0.5, '#e8f8ff'], [1, '#6fd8ff00']]); g.fillRect(x - 900, y - 3, 1800, 6);
  const dx = 960 - x, dy = 540 - y;
  [[0.55, 46, '#7ad8ff'], [0.95, 22, '#ffd27a'], [1.35, 96, '#b88aff'], [1.8, 34, '#7affc0']].forEach(([k, r, c]) => { g.globalAlpha = a * 0.2; circle(g, x + dx * k, y + dy * k, r); g.fillStyle = c; g.fill(); });
  g.restore();
}
function impactStart(fx, u, ink, paper, ink2 = '#ffffff', paper2 = '#12051f') {
  if (frames(u, 0, 2)) { fx.impact = 1; fx.ink = ink; fx.paper = paper; }
  else if (frames(u, 2 / 24, 2)) { fx.impact = 1; fx.ink = ink2; fx.paper = paper2; }
}

// -------------------------------------------- "take" : she breaks out
shot('burst_out', barT(16), barT(17), (g, t, u, fx, p) => {
  const tc = onTwos(t);
  backdrop(g, 'warp', t, ['#2b1470', '#ff4f9c', '#6ff2ff', '#ffe14a'], [960, 620, 1.2, 1.0]);
  glow(g, 960, 620, 600, '#fff0c8', 0.34);
  shards(g, 960, 620, u + 0.03, { n: 120, speed: 2300, size: 130 });
  const rise = u < 0.5 ? lerp(210, 0, expoOut(prog(u, 0, 0.5))) : -1150 * easeIn(prog(u, 0.75, BAR));
  const spine = []; for (let k = 0; k < 20; k++) spine.push([960, 640 + rise + k * 52]);
  SPIRIT_IDS.forEach((id, i) => waveRibbon(g, spine.map((q, k) => [q[0] + Math.sin(k * 0.55 - t * 9 + i * TAU / 6) * (18 + k * 11), q[1]]), SPIRITS[id].color, 10, t, i));
  figure(g, POSES.rocket, { x: 960, y: 620 + rise, s: 0.92, t: tc, wind: -0.08, lift: -0.1, mouth: 'open', open: singOpen(t), brow: 0.4 });
  for (let i = 0; i < 3; i++) ring(g, 960, 620, u - i * 0.11, ['#ffffff', '#6ff2ff', '#ff6ab0'][i], { speed: 1700, life: 0.75, width: 55 });
  focusLines(g, 960, 560, t, { inner: 620, alpha: 0.75 });
  lettering(g, 'ドン!!', 360, 270, 230, { font: FONT_JP, fill: ['#ffffff', '#ffe14a'], drop: '#ff2f6a', rot: -0.17, scale: 2 - expoOut(prog(u, 0.02, 0.24)), alpha: 1 - prog(u, 0.9, 1.15) });
  impactStart(fx, u, '#1a0030', '#ffffff', '#ff1f5a', '#fff6e0');
  fx.shake = quake(t, 0.022 * since(u, 0, 4) + 0.003); fx.chroma = 4 + 30 * since(u, 0, 4); fx.zoom = 0.13 * since(u, 0, 5); fx.bloom = 0.5;
  fx.wave = [u * 1.5, 0, 0.05 * since(u, 0, 2.5)]; fx.center = [0.5, 0.57];
});
// -------------------------------------------- "on" : rocket through clouds
shot('rocket', barT(17), barT(18), (g, t, u, fx, p) => {
  const tc = onTwos(t);
  backdrop(g, 'rush', t, ['#0e1a72', '#d0608f', '#ffd9dc', '#7a5ab4'], [u * 2.2 + u * u * 0.6, 1]);
  inCam(g, 960, 540, 1.0 + 0.16 * p, -0.2 + 0.3 * easeInOut(p), () => {
    const x = 960 + Math.sin(t * 3) * 24, y = lerp(760, 540, expoOut(p));
    for (const sd of [-1, 1]) { const tr = []; for (let k = 0; k < 18; k++) tr.push([x + sd * (40 + k * 6) + Math.sin(k * 0.5 - t * 11) * k * 4, y + 150 + k * 60]); waveRibbon(g, tr, sd < 0 ? '#ff5fb0' : '#52f2ff', 16, t, sd); }
    glow(g, x, y - 150, 340, '#ffd0e8', 0.22);
    const swirl = front => SPIRIT_IDS.forEach((id, i) => { const a = t * 5 + i * TAU / 6, z = Math.sin(a); if ((z > 0) === front) liveSpirit(g, id, x + Math.cos(a) * 470, y + 150 + z * 110 + (i - 2.5) * 24, 40 * (1 + z * 0.25), t); });
    swirl(false);
    figure(g, POSES.rocket, { x, y, s: 0.96, t: tc, wind: -0.06, lift: -0.12, mouth: 'open', open: singOpen(t), brow: 0.5 });
    swirl(true);
  });
  streaks(g, t, Math.PI / 2, { count: 55, alpha: 0.6, len: 640, speed: -6200, band: 300 });
  fx.shake = quake(t, 0.005); fx.chroma = 6; fx.zoom = 0.016; fx.center = [0.5, 0.35]; fx.flash = since(u, 0, 12) * 0.75; fx.bloom = 0.42; fx.thresh = 0.92;
});
// -------------------------------------------- "me" : above the clouds
shot('above', barT(18), barT(19), (g, t, u, fx, p) => {
  const tc = onTwos(t), arrive = expoOut(prog(u, 0, 0.55));
  inCam(g, 960, 540, 1.28 - 0.26 * easeOut(p), 0.02 - 0.035 * p, () => {
    cloudSea(g, t, [960, 560], 650, t * 0.35);
    glow(g, 960, 520, 520, '#ffb070', 0.22);
    for (let i = 0; i < 18; i++) { // god rays
      const a = i / 18 * TAU + t * 0.07; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.045; poly(g, [[960, 560], [960 + Math.cos(a - 0.045) * 1900, 560 + Math.sin(a - 0.045) * 1900], [960 + Math.cos(a + 0.045) * 1900, 560 + Math.sin(a + 0.045) * 1900]]); paint(g, '#fff0c0'); g.restore();
    }
    const y = lerp(1250, 470, arrive) + Math.sin(t * 2.2) * 12;
    figure(g, POSES.float, { x: 960, y: y + 26, s: 0.7, t: tc, wind: -0.55, mouth: 'open', open: singOpen(t), happy: u > 0.55, turn: 0.2, lift: 0.1 });
    puff(g, 960 - 330 * arrive, 920 + 70 * p, 800, 21, '#fff6f0', '#c89ad0', 1); puff(g, 960 + 350 * arrive, 945 + 70 * p, 860, 22, '#fff6f0', '#c89ad0', 1);
    SPIRIT_IDS.forEach((id, i) => { const a = Math.PI * (1.04 + i * 0.184), rr = 520 * arrive; liveSpirit(g, id, 960 + Math.cos(a) * rr * 1.3, 585 + Math.sin(a) * rr * 0.72, 44, t); });
    ring(g, 960, 880, u - 0.05, '#fff4d0', { speed: 1500, life: 0.9, width: 46, flat: 0.28 });
    petals(g, t, 55, 33, { vx: -150, vy: -60, color: ['#fff2d0', '#ffc2dc', '#ffffff'], size: 12 });
  });
  flare(g, 960, 300, 0.6); sparkles(g, t, 34, 8, [0, 0, W, 760], 26);
  fx.bloom = 0.42; fx.thresh = 0.9; fx.flash = since(u, 0, 11) * 0.75; fx.bars = 0.09 * easeOut(prog(u, 0.1, 0.5));
});
// -------------------------------------------- the echo: Ooo and Eee answer
function echoSide(g, t, id, x, flip, colors, kana, u, spin) {
  backdrop(g, 'burst', t, colors, [x, 580, spin, 16]);
  const e = hitEnv(id, t, 0.12, ['echo']);
  for (const ev of recent(id, t, 0.7, ['echo'])) for (let k = 0; k < 3; k++) ring(g, x, 580, t - ev.t - k * 0.08, '#ffffff', { speed: 950, life: 0.6, width: 26 });
  spirit(g, id, x, 590, 218 * (0.9 + 0.1 * backOut(prog(u, 0, 0.25)) + e * 0.06), { t, sing: e, energy: e, flip });
  lettering(g, kana, x + flip * 40, 205, 140, { font: FONT_JP, fill: '#ffffff', drop: SPIRITS[id].dark, rot: -0.1 * flip, scale: 0.9 + e * 0.22 });
}
function echoSplit(g, t, u, fx) {
  const k = 1 - expoOut(prog(u, 0, 0.2));
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  g.save(); g.translate(-k * 1100, 0); panel(g, [[-20, -20], [1060, -20], [860, 1100], [-20, 1100]], () => echoSide(g, t, 'ooo', 470, 1, ['#2455cc', '#3fa9ff', '#0b1c66'], 'ウー♪', u, t)); g.restore();
  g.save(); g.translate(k * 1100, 0); panel(g, [[1060, -20], [1940, -20], [1940, 1100], [860, 1100]], () => echoSide(g, t, 'eee', 1450, -1, ['#0f8fc0', '#52f2ff', '#12306a'], 'イー♪', u, -t)); g.restore();
  const e = Math.max(hitEnv('ooo', t, 0.08, ['echo']), hitEnv('eee', t, 0.08, ['echo']));
  fx.shake = quake(t, e * 0.007); fx.chroma = 3 + e * 10; fx.bloom = 0.5; fx.thresh = 0.85;
}
shot('echo_one', barT(19), barT(20), (g, t, u, fx) => echoSplit(g, t, u, fx));

// -------------------------------------------- "take me" : flight
function sideFlight(g, t, x, y, s, rot, opt = {}) {
  const hand = [x + 160 * s, y - 190 * s];
  SPIRIT_IDS.forEach((id, i) => {
    const tr = []; for (let k = 0; k < 26; k++) tr.push([x - 90 * s - k * 52, y + 20 + (i - 2.5) * (8 + k * 5.6) + Math.sin(k * 0.34 - t * 7 + i) * k * 3.2]);
    waveRibbon(g, tr, SPIRITS[id].color, 7, t, i);
  });
  figure(g, POSES.fly, Object.assign({ x, y, s, rot, t: onTwos(t), wind: -1, mouth: 'open', open: singOpen(t), brow: 0.2 }, opt));
  return hand;
}
shot('flight', barT(20), barT(21), (g, t, u, fx, p) => {
  inCam(g, 960, 540, 1.05 + 0.06 * p, -0.075 + 0.035 * p, () => {
    cloudSea(g, t, [1500, 480], 560, t * 0.7, t * 520);
    for (let i = 0; i < 4; i++) puff(g, ((2600 - u * (700 + i * 130) - i * 620) % 2800 + 2800) % 2800 - 400, 250 + i * 70, 420 + i * 60, 40 + i, '#fff4e8', '#b890d0', 0.9);
    sideFlight(g, t, lerp(560, 1080, easeOut(p)), 520 + Math.sin(t * 3.3) * 24, 0.82, Math.sin(t * 2.4) * 0.04);
    SPIRIT_IDS.forEach((id, i) => liveSpirit(g, id, 330 + i * 250 + Math.sin(t * 2 + i) * 30, i % 2 ? 845 + Math.sin(t * 3 + i) * 28 : 205 + Math.cos(t * 3 + i) * 28, 40, t));
  });
  for (let i = 0; i < 3; i++) puff(g, ((3000 - u * 2900 - i * 1150) % 3400 + 3400) % 3400 - 700, 1010 + i * 30, 900, 60 + i, '#fff8f2', '#a984c8', 0.96);
  streaks(g, t, -0.05, { count: 34, alpha: 0.5, len: 620, band: 190 });
  flare(g, 1500, 480, 0.38); petals(g, t, 40, 71, { vx: -1500, vy: 90, size: 12 });
  fx.flash = since(u, 0, 10) * 0.8; fx.chroma = 3 + hitEnv('kick', t, 0.07) * 7; fx.zoom = 0.012 + hitEnv('kick', t, 0.07) * 0.012; fx.shake = quake(t, 0.002);
});
function lance(g, t, y0, y1, k, w = 90) {
  if (k <= 0) return;
  const sp = []; const n = 24, reach = easeOut(clamp(k));
  for (let i = 0; i < n; i++) { const u = i / (n - 1) * reach; sp.push([lerp(2150, -250, u), lerp(y0, y1, u) + Math.sin(u * 9 - t * 12 + y0) * 56 * u]); }
  ribbon(g, sp, v => w * Math.pow(1 - v, 0.55) + 2); paint(g, '#07020f', '#b24dff', 9);
}
shot('dodge', barT(21), barT(22), (g, t, u, fx, p) => {
  const spin = easeInOut(prog(u, 0.2, 1.05)) * TAU;
  inCam(g, 960, 540, 1.08, -0.1 + 0.2 * easeInOut(p), () => {
    cloudSea(g, t, [320, 420], 620, t * 1.1, t * 800, ['#14104a', '#5a2f8a', '#e0647a', '#ffd0c0', '#4a2a6e']);
    lance(g, t, 60, 330, prog(u, 0.08, 0.5)); lance(g, t, 1020, 780, prog(u, 0.28, 0.72)); lance(g, t, 330, 900, prog(u, 0.62, 1.06), 70); lance(g, t, 860, 130, prog(u, 0.82, 1.28), 74);
    sideFlight(g, t, 760 + Math.sin(p * Math.PI * 2) * 150, 540 - Math.sin(p * Math.PI * 2) * 190, 0.78, spin - 0.1);
  });
  streaks(g, t, -0.08, { count: 60, alpha: 0.65, len: 700, speed: 7600, band: 130 });
  lettering(g, 'シュバッ', 1380, 190, 135, { font: FONT_JP, fill: '#ffffff', drop: '#8a2bd0', rot: -0.14, alpha: prog(u, 0.18, 0.24) * (1 - prog(u, 0.9, 1.1)), scale: 1.6 - 0.6 * expoOut(prog(u, 0.18, 0.4)) });
  for (const hitAt of [0.34, 0.9]) if (frames(u, hitAt, 2)) { fx.impact = 1; fx.ink = '#10001c'; fx.paper = '#ff3b6e'; }
  fx.shake = quake(t, 0.006 + 0.012 * Math.max(since(u, 0.34, 9) * (u > 0.34 ? 1 : 0), since(u, 0.9, 9) * (u > 0.9 ? 1 : 0))); fx.chroma = 8; fx.zoom = 0.02;
  fx.flash = since(u, 0, 14) * 0.6;
});
// -------------------------------------------- "on" : she sings
shot('singing', barT(22), barT(23), (g, t, u, fx, p) => {
  const o = singOpen(t), joy = u > 0.85;
  inCam(g, 960, 540, 1.0 + 0.13 * easeInOut(p), -0.1 + 0.05 * p, () => {
    sky(g, t, GOLD, [1620, 330, 1.05, 0.5], [t * 330, -t * 26, 0.6, 0.9]);
    portrait(g, { x: 860, y: 500, s: 1.72, t: onTwos(t), mouth: 'open', open: o, happy: joy, eyeL: joy ? 0 : 0.92, eyeR: joy ? 0 : 0.92, wind: -0.92, turn: -0.25, tilt: -0.13 + 0.05 * p, brow: -0.25, glow: 0.4 + 0.6 * beatPulse(t), blush: 0.95 });
    for (let i = 0; i < 6; i++) { const q = ((u * 1.1 + i / 6) % 1); lettering(g, i % 2 ? '♪' : '♫', 920 + q * 880 + Math.sin(i * 3 + t * 4) * 40, 700 - q * 520 + (i - 3) * 42, 92 + q * 50, { fill: SPIRITS[SPIRIT_IDS[i]].color, drop: null, alpha: Math.sin(Math.PI * q), rot: Math.sin(t * 3 + i) * 0.3 }); }
    petals(g, t, 60, 5, { vx: -780, vy: 120 });
  });
  flare(g, 1620, 330, 0.45); sparkles(g, t, 30, 12, [0, 0, W, H], 34);
  fx.bloom = 0.4; fx.thresh = 0.92; fx.flash = since(u, 0, 10) * 0.55; fx.bars = 0.09;
});
shot('echo_strike', barT(23), barT(24), (g, t, u, fx, p) => {
  cloudSea(g, t, [960, 520], 640, t * 0.5, 0, ['#14104a', '#5a2f8a', '#e0647a', '#ffd0c0', '#4a2a6e']);
  const hits = [0, BEAT, BEAT * 2];
  const broken = u > BEAT * 2;
  if (!broken) { lance(g, t, 120, 470, prog(u, -0.2, 0.5), 130); lance(g, t, 960, 610, prog(u, -0.1, 0.62), 130); }
  else shards(g, 960, 540, u - BEAT * 2, { n: 130, speed: 2100, size: 90 });
  for (const [id, x, flip] of [['ooo', 300, 1], ['eee', 1620, -1]]) {
    const e = hitEnv(id, t, 0.12, ['echo']);
    hits.forEach(h => ring(g, x, 600, u - h, SPIRITS[id].color, { speed: 1500, life: 0.65, width: 60 }));
    spirit(g, id, x, 600 + Math.sin(t * 3) * 14, 150, { t, sing: e, energy: e, flip });
  }
  figure(g, POSES.float, { x: 960, y: 545, s: 0.56, t: onTwos(t), wind: -0.2, lift: 0.2, mouth: 'smile', brow: 0.6, turn: 0.25 });
  if (broken) lettering(g, 'パリン!', 960, 190, 170, { font: FONT_JP, fill: ['#ffffff', '#9ff4ff'], drop: '#5a1fae', rot: -0.07, scale: 1.9 - 0.9 * expoOut(prog(u - BEAT * 2, 0, 0.2)) });
  const k = broken ? since(u, BEAT * 2, 6) : 0;
  fx.shake = quake(t, 0.018 * k + 0.002); fx.chroma = 3 + 22 * k; fx.flash = k * 0.5;
  if (frames(u, BEAT * 2, 2)) { fx.impact = 1; fx.ink = '#ffffff'; fx.paper = '#160430'; }
});

// -------------------------------------------- "I'll be gone" : into space
const SPACE = ['#030418', '#4a1d8a', '#0f6fa8', '#3affc0', '#b04dff'];
const space = (g, t, aurora = 1, drift = [0, 0], neb = 1) => backdrop(g, 'space', t, SPACE, [aurora, neb], [drift[0], drift[1], 0, 0]);
shot('ascend', barT(24), barT(25), (g, t, u, fx, p) => {
  inCam(g, 960, 540, 1.02 + 0.05 * p, 0.04 - 0.08 * p, () => {
    space(g, t, 1, [t * 40, -u * 420]);
    planet(g, 960 - u * 80, 2600 + u * 130, 1780, t);
    const x = lerp(520, 1240, easeInOut(p)), y = lerp(820, 330, easeInOut(p));
    SPIRIT_IDS.forEach((id, i) => { const tr = []; for (let k = 0; k < 26; k++) tr.push([x - 60 - k * 38, y + 70 + k * 25 + Math.sin(k * 0.45 - t * 8 + i * 1.05) * (10 + k * 3.6)]); waveRibbon(g, tr, SPIRITS[id].color, 7, t, i); });
    // spirits fly in a loose arc below her so none crosses her face
    SPIRIT_IDS.forEach((id, i) => liveSpirit(g, id, x - 330 + i * 150 + Math.sin(t * 3 + i) * 26, y + 150 + (i % 2) * 120 + i * 22 + Math.cos(t * 3.6 + i) * 24, 36, t));
    figure(g, POSES.fly, { x, y, s: 0.66, rot: -0.62, t: onTwos(t), wind: -1, lift: -0.2, mouth: 'open', open: singOpen(t) });
  });
  streaks(g, t, 2.58, { count: 30, alpha: 0.4, len: 520, speed: -4200, band: 260 });
  sparkles(g, t, 26, 91, [0, 0, W, H], 20);
  fx.flash = since(u, 0, 8) * 0.9; fx.bloom = 0.85; fx.chroma = 4;
});

// The wings: six ribbons of sound, three a side, one per noise.
function wings(g, x, y, s, t, open = 1) {
  SPIRIT_IDS.forEach((id, i) => {
    const sd = i < 3 ? -1 : 1, k = i % 3, flap = Math.sin(t * 3.2 + k * 0.8) * 0.09;
    const ang = (-0.78 + k * 0.5 - flap) * open + 1.2 * (1 - open);
    const pts = [];
    for (let j = 0; j <= 22; j++) { const v = j / 22, a = ang + v * v * 0.62, r = v * (640 - k * 90) * s * open; pts.push([x + sd * (40 * s + Math.cos(a) * r), y + Math.sin(a) * r - Math.sin(v * Math.PI) * 120 * s]); }
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5;
    ribbon(g, pts, v => (62 - k * 9) * s * Math.sin(Math.PI * Math.min(0.96, v * 0.9 + 0.06))); g.fillStyle = SPIRITS[id].color; g.fill(); g.restore();
    for (let j = 3; j < 22; j += 2) { // equaliser feathers
      const q = pts[j], e = 0.35 + 0.65 * Math.abs(Math.sin(j * 1.7 + t * 9 + i)) * (0.5 + hitEnv(id, t, 0.2) * 0.5), h = (40 + 150 * Math.sin(Math.PI * j / 23)) * s * e * open;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + sd * h * 0.34, q[1] + h); paint(g, null, SPIRITS[id].color + 'cc', 15 * s); paint(g, null, '#ffffffcc', 4 * s); g.restore();
    }
    waveRibbon(g, pts, SPIRITS[id].color, 8 * s, t, i);
  });
}
shot('transform', barT(25), barT(26), (g, t, u, fx, p) => {
  backdrop(g, 'warp', t, ['#4a127a', '#ff6ab8', '#52e8ff', '#ffe27a'], [960, 520, 0.55, 0.28]);
  const each = BAR * 0.82 / 6, merged = Math.floor(u / each);
  const behind = [], front = [];
  for (let i = 0; i < 6; i++) {
    const q = prog(u, i * each - 0.25, i * each + each * 0.9);
    if (q >= 1) continue;
    const a = i / 6 * TAU + t * 5.5, r = 640 * (1 - easeIn(q));
    (Math.sin(a) > 0 ? front : behind).push([SPIRIT_IDS[i], 960 + Math.cos(a) * r, 520 + Math.sin(a) * r * 0.5, 74 * (1 - 0.7 * easeIn(q))]);
  }
  for (const [id, x, y, r] of behind) spirit(g, id, x, y, r, { t, sing: 0.8, energy: 0.6 });
  const wrapRib = (frontPass) => SPIRIT_IDS.slice(0, Math.min(6, merged)).forEach((id, i) => {
    const pts = [];
    for (let k = 0; k <= 60; k++) { const v = k / 60, a = v * TAU * 2.2 + t * 7 + i * TAU / 6; if ((Math.sin(a) > 0) !== frontPass) { if (pts.length > 1) waveRibbon(g, pts.splice(0), SPIRITS[id].color, 7, t, i); pts.length = 0; continue; } pts.push([960 + Math.cos(a) * (120 + 130 * Math.sin(v * Math.PI)), 920 - v * 780 + Math.sin(a) * 34]); }
    if (pts.length > 1) waveRibbon(g, pts, SPIRITS[id].color, 7, t, i);
  });
  wrapRib(false);
  glow(g, 960, 520, 430, '#ff8ad8', 0.3);
  const tint = merged > 0 ? SPIRITS[SPIRIT_IDS[Math.min(5, merged - 1)]].color : '#ffffff';
  figure(g, POSES.float, { x: 960, y: 560, s: 0.78 + 0.05 * p, t: onTwos(t), wind: -0.06, lift: 0.35, turn: 0.15, silhouette: '#ffffff', rim: tint, rimOffset: [0, 13] });
  wrapRib(true);
  for (const [id, x, y, r] of front) spirit(g, id, x, y, r, { t, sing: 0.8, energy: 0.6 });
  for (let i = 0; i < 6; i++) { const t0 = barT(25) + i * each + each * 0.9; ring(g, 960, 520, t - t0, SPIRITS[SPIRIT_IDS[i]].color, { speed: 1500, life: 0.5, width: 70 }); }
  if (merged >= 1) lettering(g, SPIRITS[SPIRIT_IDS[Math.min(5, merged - 1)]].kana, merged % 2 ? 320 : 1600, 300 + (merged % 3) * 200, 150, { font: FONT_JP, fill: SPIRITS[SPIRIT_IDS[Math.min(5, merged - 1)]].color, rot: merged % 2 ? -0.18 : 0.16 });
  sparkles(g, t, 60, 55, [260, 60, 1400, 960], 38);
  const last = since(t, barT(25) + (merged > 0 ? (Math.min(5, merged - 1)) * each + each * 0.9 : 99), 12);
  fx.flash = Math.max(since(u, 0, 8), last * 0.25, easeIn(prog(u, BAR * 0.88, BAR))); fx.bloom = 0.45; fx.thresh = 0.94; fx.chroma = 3 + 8 * last; fx.shake = quake(t, last * 0.006);
});
shot('awakened', barT(26), barT(28), (g, t, u, fx, p) => {
  const open = backOut(prog(u, 0.05, 0.75), 1.4), push = easeIn(prog(u, BAR * 1.45, BAR * 2));
  inCam(g, 960, lerp(540, 440, push), 1.22 - 0.22 * easeOut(prog(u, 0, BAR * 1.2)) + 0.2 * push, -0.025 + 0.05 * p, () => {
    space(g, t, 0.9, [t * 26, 0]);
    hush(g, 1540, 250, 0.44, t, { eye: 0.55 + 0.45 * push, reach: 1.2, alpha: 0.88, look: [-1, 0.5] });
    planet(g, 960, 2330 - p * 60, 1520, t);
    glow(g, 960, 460, 620, '#a46bff', 0.55);
    wings(g, 960, 430, 1.05, t, open);
    const y = 560 + Math.sin(t * 1.8) * 12;
    figure(g, POSES.float, { x: 960, y, s: 0.72, t: onTwos(t), wind: -0.14, lift: 0.28, turn: 0.2, mouth: 'open', open: singOpen(t), brow: 0.35, glow: 1 });
    ring(g, 960, 470, u - 0.04, '#ffffff', { speed: 1800, life: 1.0, width: 55 });
    motes(g, t, 80, 23, SPIRIT_IDS.map(k => SPIRITS[k].color), { rise: 110, size: 6 });
  });
  const a = easeOut(prog(u, 0.45, 0.95)) * (1 - push);
  vertical(g, '覚醒', 190, 190, 150, '#ffffff', a); plain(g, 'SIX-NOISE FORM', 190, 560, 34, '#bff6ff', { spacing: 5, alpha: a });
  sparkles(g, t, 40, 66, [200, 0, 1520, H], 28);
  fx.flash = since(u, 0, 6); fx.bloom = 0.55; fx.thresh = 0.86; fx.bars = 0.1; fx.zoom = 0.05 * push; fx.shake = quake(t, 0.008 * push); fx.chroma = 2.4 + 8 * push;
});

// -------------------------------------------- "in a day or" : four cuts
const cut = k => barT(28, k * 2);
shot('cut_eye', cut(0), cut(1), (g, t, u, fx, p) => {
  const s = 8.6 + 0.9 * p;
  backdrop(g, 'warp', t, ['#0a0420', '#ff3fa4', '#3ff2ff', '#ffe14a'], [960, 540, 1.1, 0.7]);
  portrait(g, { x: 960 + 66 * s - u * 60, y: 540 - 30 * s, s, t: onTwos(t), eyeL: 1.08, eyeR: 1.08, brow: 0.8, mouth: 'determined', phones: false, bust: false, scarfTail: false, wind: 0.5, irisPulse: 1, irisMark: irisSix(g, t * 1.6) });
  focusLines(g, 960, 540, t, { inner: 700, alpha: 0.9 });
  lettering(g, 'キッ!', 1560, 190, 190, { font: FONT_JP, fill: '#ffffff', drop: '#ff2f8a', rot: 0.15, scale: 1.8 - 0.8 * expoOut(prog(u, 0.03, 0.2)) });
  impactStart(fx, u, '#16002c', '#ffffff'); fx.zoom = 0.09 * since(u, 0, 7); fx.chroma = 4 + 20 * since(u, 0, 7); fx.shake = quake(t, 0.014 * since(u, 0, 7));
});
shot('cut_wings', cut(1), cut(2), (g, t, u, fx, p) => {
  backdrop(g, 'burst', t, ['#3a1090', '#8a2bd0', '#ff4f9c'], [960, 520, t * 2.4, 20]);
  const s = 0.9 + 0.14 * expoOut(p);
  glow(g, 960, 500, 520, '#ffffff', 0.6);
  wings(g, 960, 430, 1.25 * s, t, 0.65 + 0.35 * backOut(prog(u, 0, 0.35), 2.8));
  figure(g, POSES.cheer, { x: 960, y: 640, s, t: onTwos(t), wind: -0.42, lift: 0.1, turn: 0.15, mouth: 'grin', brow: 0.4 });
  focusLines(g, 960, 520, t, { inner: 780, alpha: 0.7 });
  lettering(g, 'バッ!!', 330, 220, 190, { font: FONT_JP, fill: ['#ffffff', '#ffe14a'], drop: '#ff2f6a', rot: -0.16, scale: 1.8 - 0.8 * expoOut(prog(u, 0.03, 0.2)) });
  impactStart(fx, u, '#ffffff', '#2a0050', '#00e5ff', '#10001c'); fx.zoom = 0.09 * since(u, 0, 7); fx.chroma = 4 + 20 * since(u, 0, 7); fx.shake = quake(t, 0.014 * since(u, 0, 7));
});
shot('cut_breath', cut(2), cut(3), (g, t, u, fx, p) => {
  const s = 4.9 + 0.8 * easeIn(p);
  g.fillStyle = '#16063a'; g.fillRect(0, 0, W, H); glow(g, 960, 640, 1100, '#8a3cff', 0.8);
  portrait(g, { x: 960, y: 640 - 126 * s, s, t: onTwos(t), mouth: 'open', open: easeOut(prog(u, 0.05, 0.6)), eyeL: 0, eyeR: 0, phones: false, bust: true, scarfTail: false, wind: -0.4, blush: 0.9 });
  for (let i = 0; i < 40; i++) { // air and light rushing into her breath
    const a = hash(i) * TAU, q = 1 - ((u * 2.2 + hash(i + 5)) % 1), r0 = 180 + q * 900;
    poly(g, [[960 + Math.cos(a) * r0, 680 + Math.sin(a) * r0], [960 + Math.cos(a) * (r0 + 130 * q), 680 + Math.sin(a) * (r0 + 130 * q)]], false); paint(g, null, SPIRITS[SPIRIT_IDS[i % 6]].color + 'cc', 8 * (1 - q) + 2);
  }
  lettering(g, 'すぅ…', 1580, 250, 150, { font: FONT_JP, fill: '#ffffff', drop: '#5a1fae', rot: 0.08, alpha: prog(u, 0.05, 0.3) });
  impactStart(fx, u, '#10001c', '#ffd9ef'); fx.zoom = 0.03 + 0.05 * p; fx.chroma = 4 + 6 * p; fx.center = [0.5, 0.62];
});
shot('cut_charge', cut(3), cut(4), (g, t, u, fx, p) => {
  space(g, t * 2, 0.7, [0, 0]);
  wash(g, '#0a0228', 0.35);
  const R = 40 + 300 * easeIn(p);
  SPIRIT_IDS.forEach((id, i) => {
    const a = i / 6 * TAU + t * 3 + p * 2.5, d = 470 - 90 * p, x = 960 + Math.cos(a) * d, y = 540 + Math.sin(a) * d * 0.86;
    waveRibbon(g, [...Array(14)].map((_, k) => [lerp(x, 960, k / 13), lerp(y, 540, k / 13)]), SPIRITS[id].color, 11, t, i);
    spirit(g, id, x, y, 80, { t, sing: 1, energy: 0.8 });
  });
  glow(g, 960, 540, R * 2.8, '#ff6ad0', 0.85); glow(g, 960, 540, R * 1.8, '#8ff6ff', 0.9); circle(g, 960, 540, R * 0.55 * (1 + 0.06 * Math.sin(t * 60))); paint(g, '#ffffff');
  focusLines(g, 960, 540, t, { inner: 700 - 200 * p, alpha: 0.85 });
  lettering(g, 'キィィィン', 960, 960, 130, { font: FONT_JP, fill: '#ffffff', drop: '#2a6fe0', rot: -0.03, scale: 1 + 0.05 * Math.sin(t * 50) });
  impactStart(fx, u, '#ffffff', '#10001c'); fx.shake = quake(t, 0.004 + 0.016 * p); fx.zoom = 0.08 * easeIn(p); fx.chroma = 5 + 18 * p; fx.bloom = 0.9 + 0.8 * p;
  fx.flash = easeIn(prog(p, 0.84, 1));
});

// -------------------------------------------- "TWO" : the voice beam
shot('beam_close', barT(30), barT(31), (g, t, u, fx, p) => {
  const grow = expoOut(prog(u, 0.12, 0.45));
  inCam(g, 960, 540, 1.06 - 0.05 * p, -0.06, () => {
    space(g, t * 3, 0.8, [-t * 500, 0]);
    streaks(g, t, 0, { count: 80, alpha: 0.5, len: 640, speed: -7000, color: '#bfe8ff' });
    wings(g, 330, 400, 0.9, t, 1);
    portrait(g, { x: 430, y: 455, s: 1.42, t: onTwos(t), mouth: 'open', open: 1, eyeL: 1, eyeR: 1, brow: 0.95, turn: 0.75, tilt: -0.05, wind: -1, glow: 0.6, scarfTail: true, blush: 0.5 });
    // the voice leaves her mouth and widens only once it is clear of her face
    beam(g, 478, 640, 2300, 700, 300 * (0.87 + 0.13 * Math.sin(t * 34)), t, grow, 1.15);
    for (let i = 0; i < 4; i++) ring(g, 478, 640, u - 0.12 - i * 0.2, '#ffffff', { speed: 1200, life: 0.5, width: 34 });
  });
  lettering(g, 'アアアアア!!', 1220, 180, 168, { font: FONT_JP, fill: ['#ffffff', '#fff3a8', '#ff8a3d'], drop: '#7a1fae', rot: -0.06, scale: (2 - expoOut(prog(u, 0.1, 0.35))) * (1 + 0.025 * Math.sin(t * 55)), alpha: prog(u, 0.1, 0.16) });
  if (frames(u, 0, 2)) { fx.impact = 1; fx.ink = '#000000'; fx.paper = '#ffffff'; }
  else if (frames(u, 2 / 24, 2)) { fx.impact = 1; fx.ink = '#ffffff'; fx.paper = '#d0003c'; }
  else if (frames(u, 4 / 24, 1)) fx.invert = 1;
  fx.shake = quake(t, 0.012 + 0.016 * since(u, 0.12, 4)); fx.chroma = 12 + 18 * since(u, 0.12, 4); fx.zoom = 0.035; fx.center = [0.25, 0.59]; fx.bloom = 0.36; fx.thresh = 0.93;
});
shot('beam_wide', barT(31), barT(31, 2), (g, t, u, fx, p) => {
  inCam(g, 960, 540, 1.0 + 0.1 * p, 0.05, () => {
    space(g, t, 0.6, [t * 60, 0]);
    planet(g, 400, 2250, 1380, t);
    hush(g, 1370, 420, 0.86, t, { eye: 1 - 0.4 * p, crack: 0.25 + 0.75 * p, reach: 1.15, look: [-1, 0.6] });
    wings(g, 330, 780, 0.55, t, 1);
    beam(g, 430, 760, 1370, 420, 120 + 90 * p, t, 1);
    figure(g, POSES.float, { x: 330, y: 840, s: 0.42, t: onTwos(t), wind: -0.7, mouth: 'open', open: 1, turn: 0.8, brow: 0.8, glow: 1 });
    glow(g, 1370, 420, 360 + 300 * p, '#ffffff', 0.3 + 0.55 * p * p);
    shards(g, 1370, 420, u * 0.8, { n: 40, speed: 900, size: 50, fill: ['#e9e4f2', '#1e0a38'], edge: '#ffffff', gravity: 0 });
  });
  fx.shake = quake(t, 0.016 + 0.012 * p); fx.chroma = 14; fx.zoom = 0.025 + 0.03 * p; fx.center = [0.71, 0.39]; fx.flash = since(u, 0, 12) * 0.7;
});
shot('shatter', barT(31, 2), barT(32), (g, t, u, fx, p) => {
  space(g, t, 1, [0, 0]);
  glow(g, 960, 500, 1100, '#fff4d8', 0.95);
  if (u < 0.17) hush(g, 960, 500, 1.15 + u * 0.8, t, { eye: 0.2, crack: 1, reach: 1.1 });
  shards(g, 960, 480, u - 0.14, { n: 190, speed: 2600, size: 150, fill: ['#0a0414', '#e9e4f2', '#3a1466'], edge: '#ffffff', gravity: 220 });
  for (let i = 0; i < 6; i++) ring(g, 960, 480, u - 0.14 - i * 0.055, SPIRITS[SPIRIT_IDS[i]].color, { speed: 2100, life: 0.65, width: 80 });
  lettering(g, 'パァァン!!', 960, 880, 175, { font: FONT_JP, fill: ['#ffffff', '#9ff4ff'], drop: '#5a1fae', rot: -0.05, scale: 2 - expoOut(prog(u, 0.15, 0.36)), alpha: prog(u, 0.15, 0.2) });
  if (frames(u, 0.14, 2)) { fx.impact = 1; fx.ink = '#ffffff'; fx.paper = '#10001c'; }
  fx.shake = quake(t, u > 0.14 ? 0.025 * since(u, 0.14, 4) : 0.012); fx.chroma = 6 + 28 * since(u, 0.14, 4); fx.bloom = 1.1;
  fx.wave = [Math.max(0, u - 0.14) * 1.6, 0, u > 0.14 ? 0.06 : 0]; fx.flash = easeIn(prog(u, 0.36, BEAT * 2));
});

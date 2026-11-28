// Act 3: the world sounds again.
'use strict';
function rainbow(g, cx, cy, r, grow, alpha) {
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha;
  SPIRIT_IDS.forEach((id, i) => { g.beginPath(); g.arc(cx, cy, r - i * 22, Math.PI, Math.PI + Math.PI * grow); paint(g, null, SPIRITS[id].color, 22); });
  g.restore();
}
shot('restored', barT(32), barT(34), (g, t, u, fx, p) => {
  const tc = onTwos(t), down = easeInOut(prog(u, 0, BAR * 0.95)), landed = u > BAR * 0.95;
  inCam(g, 960, lerp(470, 540, easeOut(p)), 1.16 - 0.16 * easeOut(p), -0.03 + 0.03 * p, () => {
    sky(g, t, DAWN, [960, 700, 0.6, 0.46], [t * 60, 0, 0, 1]);
    rainbow(g, 960, 1020, 900, easeInOut(prog(u, 0.1, BAR * 1.1)), 0.7);
    city(g, 'dawn', 300 + t * 55, H + 120, 1);
    // colour sweeping back across the city
    for (let i = 0; i < 6; i++) ring(g, 960, 760, u - 0.05 - i * 0.12, SPIRITS[SPIRIT_IDS[i]].color, { speed: 1900, life: 1.1, width: 90, flat: 0.55 });
    rooftop(g, 600, 948, 720, '#fff0c8', '#3a3478');
    const y = lerp(60, 600, down);
    if (!landed) { wings(g, 960, y - 190, 0.7 * (1 - prog(u, BAR * 0.7, BAR * 0.95)), t, 1); }
    const pose = landed ? blendPose(POSES.crouch, POSES.cheer, backOut(prog(u, BAR * 1.08, BAR * 1.35), 1.6)) : POSES.float;
    figure(g, pose, { x: 960, y: landed ? lerp(758, 650, easeOut(prog(u, BAR * 1.05, BAR * 1.3))) : y, s: 0.7, t: tc, wind: -0.55, lift: landed ? 0 : 0.25, mouth: 'grin', happy: u > BAR * 1.2, turn: 0.3 });
    if (landed) ring(g, 960, 930, u - BAR * 0.95, '#ffffff', { speed: 1200, life: 0.7, width: 40, flat: 0.22 });
    orbit(g, t, 960, 600, 640, 180, true, 48, 1.7);
  });
  confetti(g, t, 90, 3); flare(g, 960, 640, 0.55); sparkles(g, t, 30, 14, [0, 0, W, 700], 24);
  fx.flash = 1 - easeOut(prog(u, 0, 0.6)); fx.bloom = 0.4; fx.thresh = 0.93; fx.zoom = hitEnv('kick', t, 0.07) * 0.012; fx.chroma = 2 + hitEnv('kick', t, 0.08) * 4;
});

const DANCE = ['discoUp', 'wave', 'discoDown', 'cheer', 'discoUp', 'peace', 'discoDown', 'cheer'];
const BEAT_COLORS = [['#ff2f87', '#ff6aa8', '#7a1fae'], ['#1ca8e8', '#52d8ff', '#1b2a8a'], ['#ffb01c', '#ffd84a', '#e0551c'], ['#7a3cf0', '#a874ff', '#2a0f6e']];
shot('dance', barT(34), barT(36), (g, t, u, fx, p) => {
  const tc = onTwos(t), b = Math.floor(u / BEAT), q = (u % BEAT) / BEAT, flip = Math.floor(b / 2) % 2 ? -1 : 1;
  backdrop(g, 'burst', t, BEAT_COLORS[b % 4], [960, 480, (b % 2 ? -1 : 1) * t * 1.4, 14 + (b % 3) * 3]);
  const camZ = 1 + 0.05 * Math.exp(-q * 5) + (b >= 4 ? 0.07 : 0);
  inCam(g, 960, 560, camZ, [-0.05, 0.05, -0.025, 0.025][b % 4], () => {
    ellipse(g, 960, 962, 900, 66); paint(g, '#12042c66');
    SPIRIT_IDS.forEach((id, i) => {
      const x = [180, 400, 620, 1300, 1520, 1740][i], hop = Math.abs(Math.sin(Math.PI * (u / BEAT + (i % 2) * 0.5))) * 150;
      ellipse(g, x, 960, 84 - hop * 0.2, 20); paint(g, '#12042c55');
      liveSpirit(g, id, x, 858 - hop, 82, t, { rot: Math.sin(Math.PI * (u / BEAT)) * 0.22 * (i % 2 ? 1 : -1) });
    });
    const from = POSES[DANCE[(b + 7) % 8]], to = POSES[DANCE[b % 8]], pose = blendPose(from, to, backOut(clamp(q / 0.3), 2.4));
    const sq = 1 - 0.07 * Math.exp(-q * 9);
    g.save(); g.translate(960, 960); g.scale(2 - sq, sq); g.translate(-960, -960);
    figure(g, pose, { x: 960, y: 590 + 22 * Math.sin(Math.PI * q) * -1 + 24, s: 0.84, facing: flip, t: tc, wind: -0.45 * flip, mouth: 'grin', happy: b % 4 > 1, turn: 0.4, peaceHand: DANCE[b % 8] === 'peace', eyeR: DANCE[b % 8] === 'peace' ? 0 : 1 });
    g.restore();
  });
  for (let i = 0; i < 8; i++) lettering(g, i % 2 ? '♪' : '♫', 150 + ((i * 263 + t * 190) % 1640), 140 + (i % 3) * 92 + Math.sin(t * 5 + i) * 30, 96, { fill: '#ffffff', drop: INK, key: null, alpha: 0.9, rot: Math.sin(t * 4 + i) * 0.3 });
  confetti(g, t, 70, 29);
  fx.flash = Math.exp(-q * 14) * 0.22; fx.chroma = 2 + 9 * Math.exp(-q * 8); fx.shake = quake(t, 0.006 * Math.exp(-q * 9)); fx.bloom = 0.28; fx.thresh = 0.94;
});

const CARD_BG = { ahh: ['#7a0f2e', '#c01e4c'], ooo: ['#0f2a7a', '#2455cc'], mmm: ['#0c5a48', '#25997a'], nyaa: ['#a0480c', '#e57a1c'], dum: ['#2a0f6e', '#5a2fc0'], eee: ['#064a70', '#1292c6'] };
shot('roll_call', barT(36), barT(37, 2), (g, t, u, fx) => {
  const i = Math.min(5, Math.floor(u / BEAT)), id = SPIRIT_IDS[i], c = SPIRITS[id], q = u - i * BEAT, dir = i % 2 ? -1 : 1;
  backdrop(g, 'burst', t, [CARD_BG[id][0], CARD_BG[id][1], '#10042a'], [dir > 0 ? 1350 : 570, 540, t * 3 * dir, 18]);
  const k = expoOut(clamp(q / 0.17));
  g.save(); g.translate((1 - k) * 900 * dir, 0);
  lettering(g, c.kana, dir > 0 ? 540 : 1380, 410, c.kana.length > 2 ? 215 : 285, { font: FONT_JP, fill: ['#ffffff', c.light, c.color], drop: c.dark, rot: -0.07 * dir });
  lettering(g, c.name, dir > 0 ? 540 : 1380, 680, 150, { fill: '#ffffff', drop: INK });
  plain(g, `NOISE No.${c.n}`, dir > 0 ? 540 : 1380, 825, 52, '#ffffff', { weight: 800, spacing: 12 });
  g.restore();
  spirit(g, id, (dir > 0 ? 1390 : 530) - (1 - k) * 700 * dir, 590, 270 * (0.82 + 0.18 * backOut(clamp(q / 0.25))), { t, sing: 0.55 + 0.45 * Math.exp(-((q % (BEAT / 2)) * 12)), energy: Math.exp(-q * 4), flip: dir });
  focusLines(g, dir > 0 ? 1390 : 530, 590, t, { inner: 620, alpha: 0.55 });
  fx.flash = Math.exp(-q * 18) * 0.65; fx.flashColor = c.light; fx.shake = quake(t, 0.012 * Math.exp(-q * 11)); fx.chroma = 2 + 14 * Math.exp(-q * 9);
});
shot('all_six', barT(37, 2), barT(38), (g, t, u, fx) => {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  SPIRIT_IDS.forEach((id, i) => {
    const col = i % 3, row = Math.floor(i / 3), x = col * 640, y = row * 540, c = SPIRITS[id];
    const k = backOut(prog(u, i * 0.022 - 0.04, i * 0.022 + 0.11));
    if (k <= 0) return;
    panel(g, [[x + 14 + (row ? -20 : 20), y + 14], [x + 626 + (row ? -20 : 20), y + 14], [x + 626 - (row ? -20 : 20), y + 526], [x + 14 - (row ? -20 : 20), y + 526]], () => {
      g.fillStyle = CARD_BG[id][1]; g.fillRect(x - 40, y, 720, 540); glow(g, x + 320, y + 270, 400, c.color, 0.8);
      spirit(g, id, x + 320, y + 262, 138 * k, { t, sing: 0.6 + 0.4 * beatPulse(t, 4), energy: beatPulse(t) });
      lettering(g, c.name, x + 320, y + 462, 70, { drop: c.dark });
    }, '#ffffff', 10);
  });
  fx.flash = since(u, 0, 14) * 0.7; fx.shake = quake(t, 0.006 * beatPulse(t, 8)); fx.chroma = 2 + 6 * beatPulse(t);
});
shot('joy', barT(38), barT(39), (g, t, u, fx, p) => {
  const o = singOpen(t);
  inCam(g, 960, 540, 1.14 - 0.1 * easeOut(p), 0.07 - 0.09 * p, () => {
    sky(g, t, DAWN, [430, 300, 0.55, 0.5], [t * 240, -t * 20, 0, 0.95]);
    orbit(g, t, 960, 590, 760, 230, false, 62, 2.2);
    portrait(g, { x: 980, y: 505 + Math.abs(Math.sin(songBeat(t) * Math.PI)) * -22, s: 1.5, t: onTwos(t), mouth: 'open', open: Math.max(o, 0.35), happy: true, eyeL: 0, eyeR: 0, wind: -0.8, tilt: 0.12 * Math.sin(songBeat(t) * Math.PI / 2), turn: -0.1, blush: 1, brow: -0.15, glow: beatPulse(t) });
    orbit(g, t, 960, 590, 760, 230, true, 62, 2.2);
    petals(g, t, 80, 41, { vx: -700, vy: 190 });
  });
  flare(g, 430, 300, 0.45); sparkles(g, t, 36, 77, [0, 0, W, H], 32);
  fx.flash = since(u, 0, 9) * 0.7; fx.bloom = 0.4; fx.thresh = 0.93; fx.zoom = hitEnv('kick', t, 0.07) * 0.012;
});
shot('toward_you', barT(39), barT(40), (g, t, u, fx, p) => {
  const k = easeIn(p) * 0.6 + p * 0.4;
  sky(g, t, DUSK, [960, 640, 0.7, 0.5], [t * 120, 0, 0.3, 1]);
  city(g, 'dusk', 800 + t * 260, H + 260 + 120 * k, 1 + 0.1 * k);
  focusLines(g, 960, 520, t, { inner: 640, alpha: 0.7 });
  const x = lerp(520, 930, easeOut(p)), y = 640 - Math.sin(Math.PI * Math.min(1, p * 0.72)) * 230;
  SPIRIT_IDS.forEach((id, i) => { const a = i / 6 * TAU + t * 2; liveSpirit(g, id, x + Math.cos(a) * (330 + 420 * k), y + Math.sin(a) * (230 + 220 * k), 30 + 55 * k, t); });
  figure(g, POSES.leap, { x, y, s: 0.5 + 0.85 * k, rot: -0.16 + 0.2 * p, t: onTwos(t), wind: -0.9, mouth: 'grin', turn: 0.55 });
  fx.zoom = 0.02 + 0.08 * easeIn(p); fx.chroma = 3 + 14 * easeIn(p); fx.shake = quake(t, 0.002 + 0.012 * easeIn(p)); fx.flash = easeIn(prog(p, 0.86, 1)); fx.bloom = 0.45; fx.center = [0.49, 0.47];
});

shot('final_pose', barT(40), barT(41, 1), (g, t, u, fx, p) => {
  backdrop(g, 'burst', t, ['#ff4f9c', '#ffd23f', '#7a1fae'], [960, 460, t * 0.7, 20]);
  const k = backOut(prog(u, 0, 0.3), 1.8);
  inCam(g, 960, 540, 1 + 0.05 * easeOut(p), -0.03, () => {
    glow(g, 760, 470, 640, '#ffffff', 0.65);
    portrait(g, { x: 770, y: 480, s: 1.5 * (0.86 + 0.14 * k), t: onTwos(Math.min(t, barT(40) + 0.9) + (t > barT(40) + 0.9 ? Math.sin(t * 2) * 0.05 : 0)), mouth: 'grin', eyeL: 1.04, eyeR: 0, tilt: 0.11, turn: 0.18, wind: -0.55, blush: 1, glow: 0.7 });
    // peace sign held up beside her face
    const hx = 1190, hy = 640;
    g.save(); g.translate(hx, hy); g.scale(k, k); g.rotate(0.18);
    limb(g, [[[60, 330], [8, 70], 96, 62, KOE.jacket]], 8); limb(g, [[[14, 92], [8, 66], 70, 68, KOE.tip]], 7);
    limb(g, [[[6, 50], [0, 0], 54, 66, KOE.skin], [[-26, -10], [-76, -196], 33, 25, KOE.skin], [[26, -14], [58, -204], 33, 25, KOE.skin]], 8);
    limb(g, [[[44, 24], [-18, 28], 29, 25, KOE.skin]], 7); limb(g, [[[44, -16], [8, -30], 27, 23, KOE.skin]], 7);
    g.restore();
    const spots = [[205, 230], [185, 800], [1590, 190], [1730, 520], [1560, 880], [420, 940]];
    SPIRIT_IDS.forEach((id, i) => spirit(g, id, spots[i][0], spots[i][1] + Math.sin(t * 4 + i) * 12, 96 * backOut(prog(u, 0.06 + i * 0.05, 0.34 + i * 0.05)), { t, sing: clamp(1 - u * 0.4), energy: since(u, 0.1 + i * 0.05, 2) }));
  });
  lettering(g, 'やったね!', 1500, 340, 150, { font: FONT_JP, fill: ['#ffffff', '#fff3a8'], drop: '#7a1fae', rot: 0.1, scale: 2 - expoOut(prog(u, 0.22, 0.45)), alpha: prog(u, 0.22, 0.28) });
  confetti(g, t, 120, 57); sparkles(g, t, 40, 19, [0, 0, W, H], 40);
  ring(g, 960, 520, u, '#ffffff', { speed: 1800, life: 0.8, width: 70 });
  impactStart(fx, u, '#2a0044', '#ffffff', '#ffffff', '#ff2f87');
  fx.shake = quake(t, 0.016 * since(u, 0, 5)); fx.chroma = 3 + 20 * since(u, 0, 5); fx.zoom = 0.08 * since(u, 0, 6); fx.bloom = 0.45; fx.thresh = 0.88;
});

shot('end_card', barT(41, 1), D.duration + 0.1, (g, t, u, fx) => {
  g.fillStyle = lin(g, 0, 0, 0, H, ['#0a0828', '#2a1466', '#5a2478']); g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.55; space(g, t, 0.7, [t * 20, 0], 0.7); g.restore();
  const a = easeOut(prog(u, 0, 0.35));
  lettering(g, 'TAKE ON ME', 960, 235, 188, { fill: ['#ffffff', '#fff3a8', '#ff9a3d'], drop: '#ff2f8a', scale: 0.92 + 0.08 * a, alpha: a });
  plain(g, 'originally by a-ha  ·  a personal-use cover', 960, 385, 38, '#d8d4ff', { spacing: 3, alpha: a, weight: 500 });
  plain(g, 'EVERY SOUND IN THE SONG IS MADE FROM YOUR RECORDING', 960, 500, 42, '#ffffff', { spacing: 3, alpha: easeOut(prog(u, 0.15, 0.5)), weight: 800 });
  SPIRIT_IDS.forEach((id, i) => {
    const x = 285 + i * 270, k = backOut(prog(u, 0.2 + i * 0.07, 0.5 + i * 0.07));
    spirit(g, id, x, 700, 82 * k, { t, sing: Math.max(0, Math.sin(t * 7 - i)) * 0.4 });
    plain(g, SPIRITS[id].name, x, 850, 38, '#ffffff', { spacing: 4, alpha: clamp(k) });
  });
  plain(g, 'drums sliced from the six noises  ·  words sung as the closest-sounding noise', 940, 940, 30, '#b8b2f0', { alpha: easeOut(prog(u, 0.55, 1)), weight: 500, spacing: 2 });
  plain(g, '完', 1790, 970, 84, '#ffffff', { font: FONT_JP, weight: 900, alpha: easeOut(prog(u, 0.8, 1.3)) });
  sparkles(g, t, 24, 99, [0, 0, W, H], 22);
  fx.flash = since(u, 0, 8) * 0.8; fx.bloom = 0.55; fx.thresh = 0.8; fx.fade = easeIn(prog(t, D.duration - 0.8, D.duration - 0.05));
});

// Act 1b: the verse. Koe walks the waking city; the six noises sing the words and
// every sung syllable pops out of the spirit that sings it. (Bars 8-15 of the song.)
'use strict';
const GROUND = 930;
const footY = s => GROUND - 385 * s;
function street(g, scroll, rim = '#ffb08a', body = '#150a33') {
  g.fillStyle = body; g.fillRect(-100, GROUND, W + 200, H - GROUND + 200);
  g.fillStyle = rim; g.fillRect(-100, GROUND, W + 200, 9);
  g.fillStyle = '#00000055'; g.fillRect(-100, GROUND + 34, W + 200, 12);
  g.fillStyle = '#ffffff22';
  for (let x = -((scroll * 1) % 260); x < W + 260; x += 260) g.fillRect(x, GROUND + 78, 120, 10);
}
const strollPose = (t) => blendPose(POSES.stand, runPose((songBeat(t) / 4) % 1), 0.5);

// 8-9 "We're talking away ... I don't know what I'm to say": a stroll with the six noises
shot('verse_walk', rawT(8), rawT(10), (g, t, u, fx, p) => {
  const tc = onTwos(t), L = lip(t), s = 0.78;
  const spots = SPIRIT_IDS.map((id, i) => [1080 + (i % 3) * 270 + Math.sin(t * 2 + i) * 18, 330 + Math.floor(i / 3) * 190 + Math.sin(t * 3.1 + i * 1.7) * 26 - (i % 3) * 18]);
  inCam(g, 960, 540, 1.1 - 0.07 * easeOut(p), -0.025 + 0.035 * p, () => {
    sky(g, t, DUSK, [1560, 760, 0.55, 0.52], [t * 38, 0, 0.45, 1]);
    city(g, 'dusk', t * 150, H + 150, 1);
    street(g, t * 460);
    SPIRIT_IDS.forEach((id, i) => {
      const [x, y] = spots[i], e = hitEnv(id, t, 0.12, ['vocal']);
      glow(g, x, y, 130 + 70 * e, SPIRITS[id].color, 0.28 + 0.5 * e);
      liveSpirit(g, id, x, y, 62 + 14 * e, t, { sing: Math.max(e, hitEnv(id, t, 0.13)) });
    });
    figure(g, strollPose(tc), Object.assign({ x: 640, y: footY(s) - Math.abs(Math.sin(songBeat(tc) * Math.PI / 2)) * 10, s, t: tc, wind: -0.7, brow: 0.1, turn: 0.2, happy: true }, L));
    pops(g, t, (e) => { const [x, y] = spots[SPIRIT_IDS.indexOf(e.i)]; return [x, y - 60]; }, { size: 118, rise: 120 });
    petals(g, t, 44, 17, { vx: -520, vy: 150 });
  });
  sparkles(g, t, 22, 43, [700, 0, 1220, 620], 26);
  fx.flash = since(u, 0, 9) * 0.55; fx.bloom = 0.42; fx.thresh = 0.88; fx.chroma = 2 + hitEnv('kick', t, 0.08) * 3.5; fx.zoom = hitEnv('kick', t, 0.07) * 0.008;
});

// 10 "I'll say it anyway": close up, every syllable rings out of her mouth
shot('verse_close', rawT(10), rawT(11), (g, t, u, fx, p) => {
  const tc = onTwos(t), L = lip(t), kick = hitEnv('kick', t, 0.1);
  backdrop(g, 'burst', t, ['#ffb86b', '#ff5fa0', '#4a1a8a'], [960, 500, t * 0.9, 17]);
  inCam(g, 960, 540, 1.04 + 0.06 * easeOut(p), 0.03 - 0.05 * p, () => {
    glow(g, 960, 520, 760, '#fff3c8', 0.4);
    portrait(g, Object.assign({ x: 960, y: 540 + Math.sin(t * 3) * 6, s: 1.5, t: tc, wind: -0.65, turn: -0.12 + 0.1 * p, tilt: 0.05 - 0.07 * p, brow: 0.2, happy: true, glow: 0.4 + 0.5 * kick }, L));
    SPIRIT_IDS.forEach((id, i) => {
      const a = (i / 6) * TAU + t * 1.1, e = hitEnv(id, t, 0.12, ['vocal']);
      liveSpirit(g, id, 960 + Math.cos(a) * 640, 520 + Math.sin(a) * 260, 54 + 14 * e, t, { sing: e });
    });
  });
  for (const e of recent('eee', t, 0.9, ['vocal']).concat(recent('ahh', t, 0.9, ['vocal']), recent('dum', t, 0.9, ['vocal']), recent('nyaa', t, 0.9, ['vocal']), recent('ooo', t, 0.9, ['vocal']), recent('mmm', t, 0.9, ['vocal'])))
    ring(g, 960, 640, t - e.t, SPIRITS[e.i].color, { speed: 900, life: 0.6, width: 34, flat: 0.5 });
  pops(g, t, (e, a) => { const k = SYLL.indexOf(e); return [960 + (k % 2 ? 1 : -1) * (470 + 40 * (k % 3)), 330 + (k % 3) * 120]; }, { size: 150, rise: 70 });
  sparkles(g, t, 26, 91, [0, 0, W, H], 28);
  fx.flash = since(u, 0, 9) * 0.5; fx.bloom = 0.5; fx.thresh = 0.86; fx.chroma = 2 + 8 * kick; fx.shake = quake(t, 0.004 * kick);
});

// 11-12 "Today's another day to find you": the tune scrolls past as lit notes, one spirit per syllable
shot('verse_roll', rawT(11), rawT(13), (g, t, u, fx, p) => {
  const L = lip(t), now = 560, PX = 360, lo = 50, hi = 68, yOf = m => 800 - (m - lo) / (hi - lo) * 470;
  sky(g, t * 0.7, NIGHT, [1500, 160, 0.4, 0.5], [t * 24, 0, 0.8, 1]);
  city(g, 'night', t * 60, H + 220, 0.95);
  wash(g, '#0a0630', 0.38);
  // staff lines
  g.save(); g.globalAlpha = 0.22; g.fillStyle = '#9fa8ff';
  for (let m = 52; m <= 66; m += 2) if ([52, 55, 59, 62, 66].includes(m)) g.fillRect(0, yOf(m) - 1.5, W, 3);
  g.restore();
  // notes
  for (const e of VOCAL) {
    const x = now + (e.t - t) * PX, w = Math.max(34, e.d * PX - 6);
    if (x > W + 60 || x + w < -60 || e.m == null) continue;
    const c = SPIRITS[e.i], y = yOf(e.m), live = t >= e.t && t < e.t + e.d, past = t >= e.t + e.d;
    g.save(); g.globalAlpha = past ? 0.4 : 1;
    if (live) glow(g, x + w / 2, y, 200 + 90 * Math.exp(-(t - e.t) * 8), c.color, 0.9);
    g.beginPath(); g.roundRect(x, y - 21, w, 42, 21); paint(g, live ? c.light : c.color, INK, 5);
    if (e.n === 1) spirit(g, e.i, x + 10, y - 62, 29 * (live ? 1.3 : 1), { t, sing: live ? 1 : 0.2, energy: live ? 1 : 0.2 });
    g.restore();
  }
  // playhead
  g.save(); g.fillStyle = '#ffffff'; g.fillRect(now - 3, 270, 6, 600); glow(g, now, 570, 340, '#ffffff', 0.4); g.restore();
  const cur = vocalAt(t);
  if (cur) { const c = SPIRITS[cur.i], y = yOf(cur.m); ring(g, now, y, (t - cur.t) % 0.5, c.color, { speed: 700, life: 0.5, width: 26, flat: 0.8 }); }
  // Koe conducts from the corner
  portrait(g, Object.assign({ x: 270, y: 700, s: 0.86, t: onTwos(t), wind: -0.6, turn: 0.3, happy: true, brow: 0.15, glow: 0.4 }, L));
  pops(g, t, (e) => [now + 230, yOf(e.m) - 120], { size: 110, rise: 60, life: 0.7 });
  fx.flash = since(u, 0, 9) * 0.5; fx.bloom = 0.46; fx.thresh = 0.88; fx.chroma = 2 + hitEnv('kick', t, 0.08) * 3;
});

// 13 "Shying away": a shy spirit hides behind a chimney
shot('verse_shy', rawT(13), rawT(14), (g, t, u, fx, p) => {
  const tc = onTwos(t), L = lip(t), s = 0.8, x = lerp(250, 640, easeOut(p));
  inCam(g, 960, 540, 1.06 - 0.04 * p, 0.02 - 0.03 * p, () => {
    sky(g, t, DUSK, [300, 720, 0.7, 0.5], [t * 24, 0, 0.3, 1]);
    city(g, 'dusk', t * 90, H + 120, 1);
    street(g, 0);
    const peek = 0.5 + 0.5 * Math.sin(t * 3.4), sx = 1330 + peek * 60 - p * 40;
    glow(g, sx, 600, 190, SPIRITS.eee.color, 0.4);
    spirit(g, 'eee', sx, 610, 112, { t, sing: hitEnv('eee', t, 0.12, ['vocal']), energy: 0.4 });
    // the chimney she hides behind
    g.fillStyle = '#2a1850'; g.fillRect(1150, 420, 190, GROUND - 420); g.fillStyle = '#ffb08a'; g.fillRect(1150, 420, 190, 9);
    g.fillStyle = '#ffffff12'; for (let y = 470; y < GROUND; y += 52) g.fillRect(1150, y, 190, 5);
    figure(g, blendPose(POSES.stand, POSES.wave, 0.35 * easeOut(p)), Object.assign({ x, y: footY(s) - Math.abs(Math.sin(songBeat(tc) * Math.PI / 2)) * 8, s, t: tc, wind: -0.55, turn: 0.35, happy: true, brow: 0.2 }, L));
    pops(g, t, (e) => [sx - 40, 470], { size: 126, rise: 90 });
    petals(g, t, 30, 29, { vx: -420, vy: 140 });
  });
  fx.flash = since(u, 0, 9) * 0.4; fx.bloom = 0.4; fx.thresh = 0.89; fx.chroma = 2 + hitEnv('kick', t, 0.08) * 3;
});

// 14-15 "I'll be coming for your love, okay?": she runs straight at the camera, then flashes the peace sign
shot('verse_coming', rawT(14), rawT(16), (g, t, u, fx, p) => {
  const tc = onTwos(t), L = lip(t), run = prog(u, 0, BAR * 1.45), pose = u < BAR * 1.5 ? runPose((songBeat(tc) / 1.3) % 1) : POSES.peace;
  const s = lerp(0.34, 1.0, easeIn(run)) * (u < BAR * 1.5 ? 1 : 1.04);
  inCam(g, 960, 540, 1.0 + 0.1 * p, 0.03 * Math.sin(t * 1.3), () => {
    sky(g, t, DUSK, [960, 600, 0.9, 0.5], [t * 60, 0, 0.5, 1]);
    city(g, 'dusk', t * 240, H + 180 + 110 * run, 1 + 0.12 * run);
    focusLines(g, 960, 520, t, { inner: 380 + 300 * (1 - run), alpha: 0.4 + 0.4 * run, count: 120 });
    SPIRIT_IDS.forEach((id, i) => {
      const a = (i / 6) * TAU + t * 2.2, r = 190 + 520 * easeIn(run), e = hitEnv(id, t, 0.12, ['vocal']);
      liveSpirit(g, id, 960 + Math.cos(a) * r * 1.35, 520 + Math.sin(a) * r * 0.62, 38 + 40 * run + 12 * e, t, { sing: e });
    });
    figure(g, pose, Object.assign({ x: 960, y: lerp(560, 600, run) - Math.abs(Math.sin(songBeat(tc) * Math.PI)) * 18 * s, s, t: tc, wind: -0.6, brow: 0.25, turn: 0, happy: u > BAR * 1.5 }, L));
    pops(g, t, (e) => { const k = SYLL.indexOf(e); return [960 + (k % 2 ? 1 : -1) * (360 + 60 * (k % 3)), 250 + (k % 3) * 130]; }, { size: 132, rise: 80, life: 0.75 });
  });
  streaks(g, t, 0, { count: 36, alpha: 0.35 * run, len: 620, speed: 5200, band: 400 });
  if (u > BAR * 1.5) {
    const q = u - BAR * 1.5;
    lettering(g, 'オッケー!', 1380, 330, 140, { font: FONT_JP, fill: ['#ffffff', '#fff3a8'], drop: '#7a1fae', rot: 0.08, scale: 2 - expoOut(prog(q, 0, 0.18)), alpha: prog(q, 0, 0.08) });
    ring(g, 960, 540, q, '#ffffff', { speed: 1800, life: 0.7, width: 60 });
    fx.flash = since(q, 0, 10) * 0.8;
  }
  fx.bloom = 0.46; fx.thresh = 0.88; fx.chroma = 2 + 10 * run + hitEnv('kick', t, 0.08) * 4; fx.zoom = 0.015 + 0.03 * run;
  fx.flash = Math.max(fx.flash, since(u, 0, 9) * 0.4, easeIn(prog(u, BAR * 1.82, BAR * 2)));
});

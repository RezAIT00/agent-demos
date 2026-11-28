// The six noise spirits, one per recorded noise, and the Hush.
'use strict';
const SPIRITS = {
  ahh: { n: 1, name: 'AHH', kana: 'アー', color: '#ff5b45', dark: '#c01e4c', light: '#ffc84a' },
  ooo: { n: 2, name: 'OOO', kana: 'ウー', color: '#3fa9ff', dark: '#2455cc', light: '#c2f2ff' },
  mmm: { n: 3, name: 'MMM', kana: 'ムー', color: '#6fe9a2', dark: '#25997a', light: '#eafff0' },
  nyaa: { n: 4, name: 'NYAA', kana: 'ニャー', color: '#ffd93f', dark: '#e57a1c', light: '#fff8c8' },
  dum: { n: 5, name: 'DUM', kana: 'ドゥム', color: '#9d62ff', dark: '#4b22a6', light: '#decaff' },
  eee: { n: 6, name: 'EEE', kana: 'イー', color: '#52f2ff', dark: '#1292c6', light: '#ffffff' },
};
const SPIRIT_IDS = ['ahh', 'ooo', 'mmm', 'nyaa', 'dum', 'eee'];
const INK = '#230a31';

function celBody(ctx, pathFn, c, r, lw) {
  pathFn(); paint(ctx, c.color, null);
  ctx.save(); pathFn(); ctx.clip();
  ellipse(ctx, r * 0.38, r * 0.46, r * 1.08, r * 0.9, -0.5);
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath(); ctx.rect(-r * 3, -r * 3, r * 6, r * 6);
  ctx.ellipse(-r * 0.2, -r * 0.22, r * 1.05, r * 0.96, -0.5, 0, TAU, true);
  ctx.fillStyle = c.dark + 'aa'; ctx.fill('evenodd');
  ellipse(ctx, -r * 0.4, -r * 0.45, r * 0.24, r * 0.14, -0.7); paint(ctx, '#ffffffcc');
  circle(ctx, -r * 0.12, -r * 0.62, r * 0.055); paint(ctx, '#ffffffcc');
  ctx.restore();
  pathFn(); paint(ctx, null, INK, lw);
}

function dotEyes(ctx, r, y, dx, size, blink) {
  for (const s of [-1, 1]) {
    if (blink) { ctx.beginPath(); ctx.arc(s * dx, y + size * 0.4, size, Math.PI * 1.15, Math.PI * 1.85); paint(ctx, null, INK, r * 0.07); continue; }
    ellipse(ctx, s * dx, y, size * 0.78, size); paint(ctx, INK);
    circle(ctx, s * dx - size * 0.25, y - size * 0.38, size * 0.34); paint(ctx, '#fff');
    circle(ctx, s * dx + size * 0.25, y + size * 0.4, size * 0.15); paint(ctx, '#fff');
  }
}
function cheeks(ctx, r, y, dx) {
  for (const s of [-1, 1]) { ellipse(ctx, s * dx, y, r * 0.14, r * 0.075); paint(ctx, '#ff4f7a77'); }
}
function openMouth(ctx, r, y, w, h) {
  ctx.beginPath(); ctx.moveTo(-w, y); ctx.quadraticCurveTo(0, y + h * 0.12, w, y);
  ctx.bezierCurveTo(w * 0.9, y + h, -w * 0.9, y + h, -w, y); ctx.closePath();
  paint(ctx, '#8d1840', INK, r * 0.055);
  ctx.save(); ctx.clip(); ellipse(ctx, 0, y + h * 0.82, w * 0.62, h * 0.32); paint(ctx, '#ff7e8d'); ctx.restore();
}

// r is the body radius. `sing` opens the mouth, `energy` makes it bounce and glow.
function spirit(ctx, id, x, y, r, { t = 0, sing = 0, energy = 0, rot = 0, aura = 1, flip = 1 } = {}) {
  if (r < 1) return;
  const c = SPIRITS[id], lw = Math.max(2, r * 0.075), k = c.n;
  const bob = Math.sin(t * 3.4 + k * 1.9) * r * 0.08;
  if (aura) glow(ctx, x, y + bob, r * (2.1 + energy * 1.1), c.color, (0.26 + 0.55 * energy) * aura);
  ctx.save();
  ctx.translate(x, y + bob - energy * r * 0.18);
  ctx.rotate(rot + Math.sin(t * 2.2 + k) * 0.06);
  const sq = 1 + energy * 0.13 * Math.cos(t * 20);
  ctx.scale((2 - sq) * (1 + energy * 0.12) * flip, sq * (1 + energy * 0.12));
  const blink = ((t * 0.37 + k * 0.31) % 1) > 0.955;
  const m = clamp(sing);

  if (id === 'ahh') { // flame fox
    const tail = flow(r * 0.55, r * 0.35, -0.35, r * 1.5, t, { amp: r * 0.3, speed: 9, droop: -1.1 });
    ribbon(ctx, tail, u => r * 0.34 * Math.sin(Math.PI * (0.2 + 0.8 * u)) + 1); paint(ctx, c.light, INK, lw);
    const fl = i => Math.sin(t * 13 + i * 2) * r * 0.09;
    const body = () => spline(ctx, [[0, r], [r * 0.82, r * 0.7], [r, 0], [r * 0.82, -r * 0.5], [r * 0.98 + fl(1), -r * 1.35, 1], [r * 0.4, -r * 0.82],
      [r * 0.2 + fl(2), -r * 1.18, 1], [0, -r * 0.84], [-r * 0.22 + fl(3), -r * 1.5, 1], [-r * 0.46, -r * 0.8], [-r * 0.98 + fl(4), -r * 1.35, 1], [-r * 0.82, -r * 0.5], [-r, 0], [-r * 0.82, r * 0.7]]);
    celBody(ctx, body, c, r, lw);
    ellipse(ctx, 0, r * 0.52, r * 0.55, r * 0.38); paint(ctx, c.light + 'dd');
    dotEyes(ctx, r, -r * 0.14, r * 0.36, r * 0.2, blink); cheeks(ctx, r, r * 0.12, r * 0.62);
    openMouth(ctx, r, r * 0.12, r * (0.17 + 0.1 * m), r * (0.14 + 0.52 * m));
  } else if (id === 'ooo') { // bubble jellyfish
    for (let i = -2; i <= 2; i++) {
      const tn = flow(i * r * 0.34, r * 0.3, Math.PI / 2 + i * 0.16, r * 1.35, t, { amp: r * 0.2, speed: 6, phase: i * 1.4 });
      ribbon(ctx, tn, u => r * 0.11 * (1 - u) + 1.5); paint(ctx, i % 2 ? c.light : c.color, INK, lw * 0.75);
    }
    const body = () => spline(ctx, [[0, -r * 1.05], [r * 0.82, -r * 0.7], [r * 1.05, r * 0.08], [r * 0.9, r * 0.56, 1], [r * 0.6, r * 0.38], [r * 0.3, r * 0.62, 1],
      [0, r * 0.42], [-r * 0.3, r * 0.62, 1], [-r * 0.6, r * 0.38], [-r * 0.9, r * 0.56, 1], [-r * 1.05, r * 0.08], [-r * 0.82, -r * 0.7]]);
    celBody(ctx, body, c, r, lw);
    dotEyes(ctx, r, -r * 0.22, r * 0.38, r * 0.19, blink); cheeks(ctx, r, r * 0.03, r * 0.66);
    ellipse(ctx, 0, r * 0.14, r * (0.1 + 0.07 * m), r * (0.12 + 0.15 * m)); paint(ctx, '#8d1840', INK, lw * 0.7);
  } else if (id === 'mmm') { // cloud sheep
    const puffs = [[0, -0.62, .52], [0.6, -0.34, .5], [0.82, 0.22, .46], [0.46, 0.62, .48], [-0.2, 0.72, .5], [-0.72, 0.38, .46], [-0.82, -0.2, .48], [-0.52, -0.52, .48], [0, 0, .9]];
    for (const [px, py, pr] of puffs) { circle(ctx, px * r, py * r, pr * r + Math.sin(t * 4 + px * 7) * r * 0.025); paint(ctx, null, INK, lw * 2); }
    for (const [px, py, pr] of puffs) { circle(ctx, px * r, py * r, pr * r + Math.sin(t * 4 + px * 7) * r * 0.025); paint(ctx, c.light); }
    for (const [px, py, pr] of puffs.slice(2, 6)) { ctx.beginPath(); ctx.arc(px * r, py * r, pr * r * 0.72, 0.2, 2.1); paint(ctx, null, c.color, r * 0.13); }
    for (const s of [-1, 1]) {
      ctx.beginPath(); for (let i = 0; i <= 30; i++) { const a = i / 30 * 4.6, rr = r * 0.34 * (1 - i / 42); const px = s * (r * 0.86 + Math.cos(a - 1.9) * rr), py = -r * 0.45 + Math.sin(a - 1.9) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      paint(ctx, null, INK, r * 0.2); paint(ctx, null, c.dark, r * 0.1);
    }
    ellipse(ctx, 0, r * 0.1, r * 0.62, r * 0.5); paint(ctx, '#fff4e0', INK, lw * 0.8);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.25, r * 0.08, r * 0.14, Math.PI * 1.12, Math.PI * 1.88); paint(ctx, null, INK, lw); }
    cheeks(ctx, r, r * 0.22, r * 0.44);
    if (m > 0.15) { ellipse(ctx, 0, r * 0.3, r * 0.08, r * (0.03 + 0.09 * m)); paint(ctx, '#8d1840', INK, lw * 0.6); }
    else { ctx.beginPath(); ctx.moveTo(-r * 0.12, r * 0.28); ctx.quadraticCurveTo(-r * 0.06, r * 0.36, 0, r * 0.28); ctx.quadraticCurveTo(r * 0.06, r * 0.36, r * 0.12, r * 0.28); paint(ctx, null, INK, lw * 0.7); }
  } else if (id === 'nyaa') { // neon cat
    const tail = [[r * 0.7, r * 0.5], [r * 1.35, r * 0.3], [r * 1.08, 0], [r * 1.65, -r * 0.3], [r * 1.35, -r * 0.62], [r * 1.9, -r * 1.05]].map((p, i) => [p[0] + Math.sin(t * 8 + i) * r * 0.05 * i, p[1]]);
    ribbon(ctx, tail, u => r * 0.15 * (1 - u * 0.8)); paint(ctx, c.dark, INK, lw);
    const body = () => spline(ctx, [[0, r * 0.98], [r * 0.8, r * 0.72], [r * 1.08, r * 0.05], [r * 0.94, -r * 0.46], [r * 0.98, -r * 1.3, 1], [r * 0.36, -r * 0.84], [0, -r * 0.9], [-r * 0.36, -r * 0.84], [-r * 0.98, -r * 1.3, 1], [-r * 0.94, -r * 0.46], [-r * 1.08, r * 0.05], [-r * 0.8, r * 0.72]]);
    celBody(ctx, body, c, r, lw);
    for (const s of [-1, 1]) { poly(ctx, [[s * r * 0.82, -r * 1.02], [s * r * 0.48, -r * 0.76], [s * r * 0.8, -r * 0.56]]); paint(ctx, '#ff5fa2'); }
    for (const [a, b] of [[-0.2, -0.86], [0, -0.9], [0.2, -0.86]]) { poly(ctx, [[a * r - r * 0.07, b * r], [a * r, b * r + r * 0.28], [a * r + r * 0.07, b * r]]); paint(ctx, c.dark); }
    for (const s of [-1, 1]) {
      if (blink) { dotEyes(ctx, r, -r * 0.12, r * 0.4, r * 0.22, true); break; }
      ellipse(ctx, s * r * 0.4, -r * 0.12, r * 0.2, r * 0.25, s * -0.12); paint(ctx, '#7dffd2', INK, lw * 0.8);
      ellipse(ctx, s * r * 0.4, -r * 0.12, r * (0.05 + 0.08 * energy), r * 0.21); paint(ctx, INK);
      circle(ctx, s * r * 0.4 - r * 0.07, -r * 0.22, r * 0.065); paint(ctx, '#fff');
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(s * r * 0.72, r * (0.12 + i * 0.13)); ctx.lineTo(s * r * 1.36, r * (0.04 + i * 0.2)); paint(ctx, null, INK, lw * 0.5); }
    }
    poly(ctx, [[-r * 0.08, r * 0.14], [r * 0.08, r * 0.14], [0, r * 0.22]]); paint(ctx, '#ff5fa2', INK, lw * 0.4);
    if (m > 0.15) openMouth(ctx, r, r * 0.28, r * 0.2, r * (0.15 + 0.42 * m));
    else { ctx.beginPath(); ctx.moveTo(-r * 0.24, r * 0.26); ctx.quadraticCurveTo(-r * 0.12, r * 0.45, 0, r * 0.27); ctx.quadraticCurveTo(r * 0.12, r * 0.45, r * 0.24, r * 0.26); paint(ctx, null, INK, lw * 0.8); }
  } else if (id === 'dum') { // taiko golem
    for (const s of [-1, 1]) {
      spline(ctx, [[s * r * 0.34, -r * 0.8, 1], [s * r * 0.78, -r * 1.42, 1], [s * r * 0.76, -r * 0.76, 1]]); paint(ctx, c.light, INK, lw);
      ellipse(ctx, s * r * 1.12, r * 0.32 - energy * r * 0.35, r * 0.3, r * 0.36, s * 0.5); paint(ctx, c.dark, INK, lw);
      ellipse(ctx, s * r * 0.55, r * 1.04, r * 0.34, r * 0.2); paint(ctx, c.dark, INK, lw);
    }
    const body = () => spline(ctx, [[0, -r * 0.94], [r * 0.82, -r * 0.84], [r * 1.04, -r * 0.1], [r * 0.98, r * 0.72], [r * 0.5, r * 1.02], [-r * 0.5, r * 1.02], [-r * 0.98, r * 0.72], [-r * 1.04, -r * 0.1], [-r * 0.82, -r * 0.84]]);
    celBody(ctx, body, c, r, lw);
    circle(ctx, 0, r * 0.5, r * 0.45); paint(ctx, '#fff0d8', INK, lw);
    circle(ctx, 0, r * 0.5, r * 0.35); paint(ctx, null, '#d4306a', r * 0.06);
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(0, r * 0.5); ctx.rotate(i * TAU / 3 + t * (1 + energy * 3));
      ctx.beginPath(); ctx.arc(0, -r * 0.13, r * 0.095, 0, TAU); ctx.moveTo(r * 0.095, -r * 0.13); ctx.quadraticCurveTo(r * 0.1, r * 0.04, -r * 0.1, r * 0.04); ctx.quadraticCurveTo(r * 0.02, -r * 0.04, -r * 0.04, -r * 0.1);
      paint(ctx, '#d4306a'); ctx.restore();
    }
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.62, -r * 0.62); ctx.lineTo(s * r * 0.16, -r * 0.46); paint(ctx, null, INK, lw * 1.7); }
    dotEyes(ctx, r, -r * 0.31, r * 0.36, r * 0.15, blink);
    openMouth(ctx, r, -r * 0.14, r * 0.24, r * (0.07 + 0.25 * m));
  } else { // eee: spark star
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.72 : r * (1.38 + energy * 0.2 + Math.sin(t * 15 + i) * 0.05);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr, i % 2 ? 0 : 1]);
    }
    celBody(ctx, () => spline(ctx, pts), c, r, lw);
    dotEyes(ctx, r, -r * 0.18, r * 0.3, r * 0.18, blink); cheeks(ctx, r, r * 0.06, r * 0.52);
    const w = r * (0.34 + 0.08 * m), h = r * (0.18 + 0.22 * m);
    ctx.beginPath(); ctx.moveTo(-w, r * 0.1); ctx.quadraticCurveTo(0, r * 0.16, w, r * 0.1); ctx.bezierCurveTo(w * 0.72, r * 0.1 + h * 1.3, -w * 0.72, r * 0.1 + h * 1.3, -w, r * 0.1); ctx.closePath();
    paint(ctx, '#fff', INK, lw * 0.8);
    ctx.beginPath(); ctx.moveTo(-w * 0.88, r * 0.1 + h * 0.45); ctx.lineTo(w * 0.88, r * 0.1 + h * 0.45);
    for (let i = -2; i <= 2; i++) { ctx.moveTo(i * w * 0.3, r * 0.13); ctx.lineTo(i * w * 0.3, r * 0.1 + h * 0.85); }
    paint(ctx, null, INK, lw * 0.45);
  }
  ctx.restore();
}

// A spirit that sings and bounces whenever its noise plays in the song.
function liveSpirit(ctx, id, x, y, r, t, extra = {}) {
  const e = hitEnv(id, t, 0.13);
  const drum = id === 'dum' ? hitEnv('kick', t, 0.1) : 0;
  spirit(ctx, id, x, y, r, Object.assign({ t, sing: e, energy: Math.max(e, drum) }, extra));
}

// ------------------------------------------------------------------- the Hush
// A silence so large it has a face: a stitched mouth and one eye.
function hush(ctx, x, y, s, t, { eye = 1, crack = 0, reach = 1, alpha = 1, look = [0, 0] } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = alpha;
  for (let i = 0; i < 15; i++) { // tendrils
    const a = i / 15 * TAU + Math.sin(t * 0.4 + i) * 0.12;
    const spine = flow(Math.cos(a) * 250, Math.sin(a) * 230, a, (480 + 380 * hash(i)) * reach, t,
      { amp: 90, freq: 1.7, speed: 2.4, phase: i * 2.2, droop: (hash(i + 4) - 0.5) * 2.6, n: 26 });
    ribbon(ctx, spine, u => 74 * Math.pow(1 - u, 1.15) + 1);
    paint(ctx, '#07030f', '#7c35c9', 5);
  }
  const blob = (rr, wob, seed) => {
    const pts = [];
    for (let i = 0; i < 30; i++) {
      const a = i / 30 * TAU, q = rr * (1 + noise1(i * 0.7 + t * 1.7, seed) * wob + (i % 3 === 0 ? wob * 1.4 : 0));
      pts.push([Math.cos(a) * q, Math.sin(a) * q * 0.94, i % 3 === 0 ? 1 : 0]);
    }
    spline(ctx, pts);
  };
  for (let i = 0; i < 46; i++) { // soft smoke boiling off the edge
    const a = i / 46 * TAU + Math.sin(t * 0.31 + i) * 0.1, d = 390 + 70 * hash(i + 21) + Math.sin(t * 1.6 + i * 2.3) * 28, rr = 80 + 90 * hash(i + 33);
    const px = Math.cos(a) * d, py = Math.sin(a) * d * 0.94;
    ctx.fillStyle = rad(ctx, px, py, 0, rr, [[0, '#0e0420f2'], [0.6, '#2a0c52b0'], [1, '#5a1ea000']]);
    circle(ctx, px, py, rr); ctx.fill();
  }
  blob(430, 0.1, 1); paint(ctx, '#1a0830', '#6c2fb0', 4);
  blob(372, 0.09, 2); paint(ctx, '#0c0418');
  blob(300, 0.08, 3); paint(ctx, '#050209');
  // mask
  const mask = () => spline(ctx, [[0, -262], [126, -222], [186, -96], [158, 60], [88, 178], [0, 262, 1], [-88, 178], [-158, 60], [-186, -96], [-126, -222]]);
  glow(ctx, 0, 0, 380, '#8b46ff', 0.32);
  mask(); paint(ctx, '#e9e4f2', '#1a0830', 10);
  ctx.save(); mask(); ctx.clip();
  spline(ctx, [[40, -300], [96, -150], [78, 40], [34, 190], [8, 300], [300, 300], [300, -300]]); paint(ctx, '#b5a9d4');
  for (const sd of [-1, 1]) {
    spline(ctx, [[sd * 36, 38, 1], [sd * 92, 10], [sd * 160, -2, 1], [sd * 112, 40], [sd * 120, 92], [sd * 96, 52]]); paint(ctx, '#3a1466');
  }
  ctx.restore();
  // the single eye
  const open = clamp(eye);
  ctx.save(); ctx.translate(0, -78);
  const lid = () => { ctx.beginPath(); ctx.moveTo(-128, 0); ctx.quadraticCurveTo(0, -112 * open - 2, 128, 0); ctx.quadraticCurveTo(0, 90 * open + 2, -128, 0); ctx.closePath(); };
  lid(); paint(ctx, '#12041f', '#2a0a44', 12);
  ctx.save(); lid(); ctx.clip();
  const ex = look[0] * 26, ey = look[1] * 16;
  circle(ctx, ex, ey, 62); paint(ctx, rad(ctx, ex, ey, 4, 62, ['#fff6c0', '#ff2b66', '#4a0070']));
  for (let i = 1; i <= 3; i++) { circle(ctx, ex, ey, 16 + i * 13 + Math.sin(t * 5 - i) * 3); paint(ctx, null, '#1a0030aa', 4); }
  ellipse(ctx, ex, ey, 9, 40); paint(ctx, '#0a0014');
  circle(ctx, ex - 20, ey - 22, 9); paint(ctx, '#fff');
  ctx.restore(); lid(); paint(ctx, null, '#1a0830', 8);
  ctx.restore();
  glow(ctx, 0, -78, 170 * open + 10, '#ff2b66', 0.5 * open);
  // stitched-shut mouth
  ctx.beginPath(); ctx.moveTo(-96, 148); ctx.quadraticCurveTo(0, 118, 96, 148); paint(ctx, null, '#1a0830', 9);
  for (let i = -3; i <= 3; i++) {
    const px = i * 29, py = 133 + (i / 3) ** 2 * 14;
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(px - 11, py - 17 * d); ctx.lineTo(px + 11, py + 17 * d); paint(ctx, null, '#1a0830', 7); }
  }
  if (crack > 0) {
    const r = rng(77);
    for (let i = 0; i < 11; i++) {
      let px = (r() - 0.5) * 40, py = -40 + (r() - 0.5) * 60, a = i / 11 * TAU + r() * 0.4;
      const pts = [[px, py]];
      const steps = Math.ceil(9 * clamp(crack * 1.3 - r() * 0.3));
      for (let k = 0; k < steps; k++) { a += (r() - 0.5) * 1.3; px += Math.cos(a) * 34; py += Math.sin(a) * 34; pts.push([px, py]); }
      if (pts.length > 1) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        poly(ctx, pts, false); paint(ctx, null, '#ff9be855', 22 * crack); paint(ctx, null, '#ffffff', 5 + 4 * crack);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

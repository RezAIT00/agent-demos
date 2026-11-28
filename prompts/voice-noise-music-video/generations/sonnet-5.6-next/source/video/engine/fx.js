// Anime effects: focus lines, particles, shards, beams, hand-lettered type.
'use strict';
function focusLines(ctx, cx, cy, t, { count = 110, color = '#ffffff', inner = 430, alpha = 0.9, width = 1 } = {}) {
  const r = rng(Math.floor(onTwos(t) * 12) + 17);
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = (i + r() * 0.9) / count * TAU, r0 = inner * (0.8 + r() * 0.85), half = (0.002 + r() * r() * 0.012) * width;
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a - half) * 2300, cy + Math.sin(a - half) * 2300);
    ctx.lineTo(cx + Math.cos(a + half) * 2300, cy + Math.sin(a + half) * 2300);
  }
  ctx.fill(); ctx.restore();
}
function streaks(ctx, t, ang, { count = 60, color = '#ffffff', speed = 5200, len = 520, alpha = 0.7, width = 5, seed = 4, band = null } = {}) {
  const r = rng(seed);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    let y = (r() - 0.5) * 1900;
    if (band && Math.abs(y) < band) y += Math.sign(y || 1) * band;
    const l = len * (0.35 + r()), v = speed * (0.6 + r() * 0.8), span = 2600 + l;
    const x = 1300 - ((r() * span + t * v) % span), h = width * (0.3 + r());
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l * 0.65, y - h / 2); ctx.lineTo(x + l, y); ctx.lineTo(x + l * 0.65, y + h / 2); ctx.fill();
  }
  ctx.restore();
}
function sparkle(ctx, x, y, r, color = '#ffffff', rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath(); ctx.moveTo(0, -r);
  for (let i = 1; i <= 4; i++) { const a = -Math.PI / 2 + i * Math.PI / 2, m = a - Math.PI / 4; ctx.quadraticCurveTo(Math.cos(m) * r * 0.13, Math.sin(m) * r * 0.13, Math.cos(a) * r, Math.sin(a) * r); }
  ctx.fillStyle = color; ctx.fill(); ctx.restore();
  glow(ctx, x, y, r * 0.8, color.slice(0, 7), 0.5);
}
function sparkles(ctx, t, n, seed, area = [0, 0, W, H], size = 26, colors = ['#ffffff', '#fff3a8', '#aef6ff']) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * area[2], y = area[1] + r() * area[3], ph = r() * TAU, sp = 2 + r() * 4;
    const k = Math.max(0, Math.sin(t * sp + ph));
    if (k > 0.15) sparkle(ctx, x, y, size * (0.4 + r()) * k, colors[i % colors.length]);
  }
}
// drifting petals or embers; (vx, vy) in pixels per second
function petals(ctx, t, n, seed, { vx = -190, vy = 150, color = ['#ffc2dc', '#ff8fbd', '#fff0f6'], size = 17, alpha = 0.95 } = {}) {
  const r = rng(seed), wrap = (v, m) => ((v % m) + m) % m;
  ctx.save(); ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const depth = 0.4 + r() * 1.2, x0 = r() * 2200, y0 = r() * 1300, ph = r() * TAU;
    const x = wrap(x0 + vx * t * depth + Math.sin(t * 2 + ph) * 40, 2200) - 140, y = wrap(y0 + vy * t * depth, 1300) - 110;
    const s = size * depth;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ph + t * (1 + r() * 2)); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(t * 3 + ph)));
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 0.2, -s * 0.85, s, -s * 0.18); ctx.lineTo(s * 0.62, 0); ctx.lineTo(s, s * 0.22); ctx.quadraticCurveTo(-s * 0.2, s * 0.8, -s, 0);
    ctx.fillStyle = color[i % color.length]; ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
function motes(ctx, t, n, seed, color, { rise = 90, size = 7, alpha = 0.8 } = {}) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = r() * W + Math.sin(t * (0.6 + r()) + i) * 40, y = H + 60 - ((r() * 1200 + t * rise * (0.4 + r())) % 1200), s = size * (0.3 + r());
    ctx.globalAlpha = alpha * (0.35 + 0.65 * Math.abs(Math.sin(t * 2 + i)));
    circle(ctx, x, y, s); ctx.fillStyle = Array.isArray(color) ? color[i % color.length] : color; ctx.fill();
  }
  ctx.restore();
}
function confetti(ctx, t, n, seed) {
  petals(ctx, t, n, seed, { vx: -40, vy: 330, size: 15, color: SPIRIT_IDS.map(k => SPIRITS[k].color) });
}
function rain(ctx, t, n = 420, alpha = 0.5, color = '#cfd8ee') {
  const r = rng(91);
  ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const d = 0.4 + r(), x0 = r() * 2400, y0 = r() * 1300, v = 1900 * d;
    const y = (y0 + t * v) % 1300 - 110, x = ((x0 - t * v * 0.2) % 2400 + 2400) % 2400 - 200;
    ctx.globalAlpha = alpha * d * 0.7; ctx.lineWidth = 1.4 * d;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 12 * d, y + 62 * d); ctx.stroke();
  }
  ctx.restore();
}
// shockwave ring `age` seconds after a hit
function ring(ctx, x, y, age, color = '#ffffff', { speed = 1500, life = 0.55, width = 40, flat = 1 } = {}) {
  if (age < 0 || age > life) return;
  const k = age / life, r = speed * life * expoOut(k);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k;
  ellipse(ctx, x, y, r, r * flat); paint(ctx, null, color, width * (1 - k) + 2);
  ellipse(ctx, x, y, r * 0.82, r * 0.82 * flat); paint(ctx, null, color, width * 0.25 * (1 - k) + 1);
  ctx.restore();
}
function shards(ctx, x, y, age, { n = 90, seed = 12, speed = 1700, size = 95, fill = ['#0a0414', '#1e0a38'], edge = '#d59bff', gravity = 500 } = {}) {
  if (age < 0 || age > 2.4) return;
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, v = speed * (0.2 + r()), s = size * (0.2 + r() * r() * 1.6), d = v * (1 - Math.exp(-age * 2.4)) / 1.6;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + gravity * age * age * 0.5;
    ctx.save(); ctx.translate(px, py); ctx.rotate(a + age * (r() - 0.5) * 12); ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(age * 5 + i)));
    ctx.globalAlpha = clamp(2.2 - age * 1.4);
    poly(ctx, [[-s * 0.6, -s * 0.3 * r()], [s * (0.5 + r() * 0.5), -s * 0.15], [s * (r() - 0.5) * 0.6, s * (0.4 + r() * 0.5)]]);
    paint(ctx, fill[i % fill.length], edge, 3); ctx.restore();
  }
}
// The voice beam: layered light with six waveforms twisting inside it.
function beam(ctx, x0, y0, x1, y1, width, t, grow = 1, flare = 1.7) {
  const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0) * grow;
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter';
  const body = (w, color, a) => {
    ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -w * 0.08);
    // starts as thin as a breath and only reaches full width well away from her face
    const open = u => 0.05 + 0.95 * Math.pow(clamp(u * flare), 1.35);
    for (let u = 0; u <= 1.001; u += 0.04) ctx.lineTo(u * len, -w * open(u) * (1 + 0.07 * noise1(u * 22 - t * 38, 1)));
    for (let u = 1; u >= -0.001; u -= 0.04) ctx.lineTo(u * len, w * open(u) * (1 + 0.07 * noise1(u * 22 - t * 38, 2)));
    ctx.fill();
  };
  body(width * 1.5, '#5a1ae0', 0.34); body(width * 1.05, '#e0209a', 0.46); body(width * 0.66, '#1fb8ee', 0.55); body(width * 0.24, '#ffffff', 0.9);
  SPIRIT_IDS.forEach((id, i) => {
    ctx.globalAlpha = 0.95; ctx.beginPath();
    for (let x = 0; x <= len; x += 14) {
      const env = Math.pow(clamp(x / len * flare), 1.35), y = Math.sin(x * (0.012 + i * 0.0022) - t * (30 + i * 4) + i) * width * (0.55 + 0.28 * Math.sin(i + t * 7)) * env;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    paint(ctx, null, SPIRITS[id].color, 9);
  });
  for (let i = 0; i < 9; i++) { // pressure rings racing outward
    const u = ((t * 2.4 + i / 9) % 1), k = Math.pow(clamp(u * flare), 1.35); ctx.globalAlpha = (1 - u) * 0.75;
    ellipse(ctx, u * len, 0, width * 0.2 * (1 + u) * k, width * (0.7 + u * 1.1) * k); paint(ctx, null, '#ffffff', 7 * (1 - u) + 2);
  }
  ctx.restore();
  glow(ctx, x0, y0, width * 0.62, '#ffd8f4', 0.7);
}
function waveRibbon(ctx, pts, color, width, t, i = 0) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const [w, a] of [[width * 3.2, 0.16], [width * 1.5, 0.4], [width * 0.45, 1]]) {
    ctx.globalAlpha = a; ctx.beginPath();
    pts.forEach((p, k) => { const off = Math.sin(k * 0.9 - t * 14 + i) * width * 1.4 * (k / pts.length); k ? ctx.lineTo(p[0], p[1] + off) : ctx.moveTo(p[0], p[1] + off); });
    ctx.strokeStyle = a === 1 ? '#ffffff' : color; ctx.lineWidth = w; ctx.stroke();
  }
  ctx.restore();
}
const FONT_JP = '"Yu Gothic", "Meiryo", "MS Gothic", sans-serif';
const FONT_EN = '"Bahnschrift", "Arial Black", "Segoe UI", sans-serif';
// Poster lettering: thick dark outline, white keyline, solid or gradient fill, offset drop.
function lettering(ctx, str, x, y, size, { fill = '#ffffff', stroke = INK, key = '#ffffff', rot = 0, skew = -0.12, scale = 1, font = FONT_EN, weight = 900, align = 'center', drop = '#ff3f8e', alpha = 1, spacing = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.transform(1, 0, skew, 1, 0, 0); ctx.scale(scale, scale); ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.letterSpacing = spacing + 'px';
  if (drop) { ctx.fillStyle = drop; ctx.strokeStyle = drop; ctx.lineWidth = size * 0.2; ctx.strokeText(str, size * 0.075, size * 0.09); ctx.fillText(str, size * 0.075, size * 0.09); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = size * 0.2; ctx.strokeText(str, 0, 0); }
  if (key) { ctx.strokeStyle = key; ctx.lineWidth = size * 0.07; ctx.strokeText(str, 0, 0); }
  ctx.fillStyle = Array.isArray(fill) ? lin(ctx, 0, -size * 0.45, 0, size * 0.45, fill) : fill;
  ctx.fillText(str, 0, 0); ctx.restore();
}
function plain(ctx, str, x, y, size, color = '#fff', { font = FONT_EN, weight = 600, align = 'center', spacing = 0, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.letterSpacing = spacing + 'px'; ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
}
function vertical(ctx, str, x, y, size, color, alpha = 1) {
  [...str].forEach((ch, i) => plain(ctx, ch, x, y + i * size * 1.12, size, color, { font: FONT_JP, weight: 900, alpha }));
}
// slanted manga panel: run fn clipped to the quad, then draw its border
function panel(ctx, pts, fn, border = '#ffffff', lw = 16) {
  ctx.save(); poly(ctx, pts); ctx.clip(); fn(); ctx.restore();
  poly(ctx, pts); paint(ctx, null, INK, lw + 10); poly(ctx, pts); paint(ctx, null, border, lw);
}

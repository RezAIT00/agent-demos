// ---------- 2D anime effects (all analytic in t) ----------
function glintStar(g, x, y, r, a, color = '#fff8d0', rot = 0) {
  if (a <= 0.01) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.55); gr.addColorStop(0, 'rgba(255,250,220,' + 0.75 * a + ')'); gr.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 0.55, 0, TAU); g.fill();
  g.globalAlpha = clamp(a * 1.3); g.fillStyle = color;
  for (let k = 0; k < 4; k++) { const L = k % 2 ? r * 0.62 : r; g.save(); g.rotate(k * PI / 2); g.beginPath(); g.moveTo(0, -r * 0.045); g.quadraticCurveTo(L * 0.2, -r * 0.012, L, 0); g.quadraticCurveTo(L * 0.2, r * 0.012, 0, r * 0.045); g.closePath(); g.fill(); g.restore(); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r * 0.06, 0, TAU); g.fill();
  g.restore();
}
// radial focus lines (shuusensen)
function speedRadial(g, cx, cy, seed, o = {}) {
  const n = o.n || 110, inner = o.inner === undefined ? 520 : o.inner, r = rng(seed * 131 + 7);
  g.save(); g.fillStyle = o.color || '#ffffff'; g.globalAlpha = o.alpha === undefined ? 0.85 : o.alpha;
  const sx = o.sx || 1.45;
  for (let i = 0; i < n; i++) {
    const a = (i + r()) / n * TAU, r0 = inner * (0.82 + r() * 0.7), r1 = 1800, w = (o.width || 0.011) * (0.25 + r() * r() * 2.1);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0 * sx, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a - w) * r1 * sx, cy + Math.sin(a - w) * r1); g.lineTo(cx + Math.cos(a + w) * r1 * sx, cy + Math.sin(a + w) * r1); g.closePath(); g.fill();
  }
  g.restore();
}
function speedH(g, t, seed, o = {}) {
  const n = o.n || 60, y0 = o.y0 || 0, y1 = o.y1 || H, v = o.v || 5200, r = rng(seed * 17 + 3);
  g.save(); g.fillStyle = o.color || '#ffffff';
  for (let i = 0; i < n; i++) {
    const y = y0 + r() * (y1 - y0), len = (o.len || 420) * (0.3 + r() * 1.3), sp = v * (0.6 + r() * 0.8), span = W + len * 2 + 400;
    let x = ((r() * span - t * sp) % span + span) % span - len - 200;
    if (o.dir === -1) x = W - x;
    const th = (o.th || 4.5) * (0.35 + r() * 1.2); g.globalAlpha = (o.alpha === undefined ? 0.7 : o.alpha) * (0.4 + r() * 0.6);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len * 0.5, y - th * 0.6, x + len, y); g.quadraticCurveTo(x + len * 0.5, y + th * 0.6, x, y); g.fill();
  }
  g.restore();
}
// spark shower from a moving contact point
function sparks(g, t, o) {
  const rate = o.rate || 260, life = o.life || 0.42, t0 = o.t0 === undefined ? 0 : o.t0, t1 = o.t1 === undefined ? 1e9 : o.t1;
  const first = Math.max(0, Math.floor((t - life - t0) * rate)), last = Math.floor((Math.min(t, t1) - t0) * rate);
  g.save(); g.lineCap = 'round'; g.globalCompositeOperation = 'source-over';
  for (let i = first; i <= last; i++) {
    const born = t0 + i / rate, age = t - born; const L = life * (0.4 + 0.6 * hash2(i, 1)); if (age < 0 || age > L) continue;
    const ang = o.dir + (hash2(i, 2) - 0.5) * (o.spread || 0.8), sp = (o.speed || 1500) * (0.35 + hash2(i, 3));
    const gy = o.gravity === undefined ? 2600 : o.gravity;
    const pos = a => [o.x + Math.cos(ang) * sp * a, o.y + Math.sin(ang) * sp * a + 0.5 * gy * a * a];
    const p = pos(age), q = pos(Math.max(0, age - 0.028)); const k = age / L;
    const w = (o.width || 7) * (1 - k * 0.7) * (0.5 + hash2(i, 4));
    g.strokeStyle = o.color2 || 'rgba(255,110,20,0.75)'; g.lineWidth = w * 1.9; g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(p[0], p[1]); g.stroke();
    g.strokeStyle = k < 0.35 ? '#fffbe0' : (o.color || '#ffd23c'); g.lineWidth = w; g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(p[0], p[1]); g.stroke();
  }
  g.restore();
}
// cel-shaded anime smoke cluster: union outline, flat fill, one shadow tone
function puffCluster(g, circles, fill, shade, line, lw = 5) {
  if (!circles.length) return;
  g.save();
  if (line) { g.strokeStyle = line; g.lineWidth = lw * 2; for (const c of circles) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, TAU); g.stroke(); } }
  g.fillStyle = fill; for (const c of circles) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, TAU); g.fill(); }
  g.fillStyle = shade; for (const c of circles) { g.beginPath(); g.arc(c[0], c[1], c[2] * 0.985, 0.12 * PI, 0.88 * PI); g.quadraticCurveTo(c[0], c[1] + c[2] * 0.28, c[0] + Math.cos(0.12 * PI) * c[2], c[1] + Math.sin(0.12 * PI) * c[2]); g.fill(); }
  g.restore();
}
function dustBurst(g, x, y, age, seed, o = {}) {
  const life = o.life || 0.9; if (age < 0 || age > life) return;
  const k = age / life, n = o.n || 12, S = o.s || 1, cs = [];
  for (let i = 0; i < n; i++) {
    const a = PI + (hash2(seed, i) - 0.5) * PI * 1.1 + (i % 2 ? PI : 0) * (o.both === false ? 0 : 1);
    const d = (60 + hash2(seed, i + 20) * 240) * easeOut(k) * S;
    const rad = (26 + hash2(seed, i + 40) * 56) * S * (0.35 + easeOut(Math.min(1, k * 2.2))) * (1 - Math.pow(k, 2.2));
    if (rad < 2) continue;
    cs.push([x + Math.cos(a) * d * 1.5 + (o.drift || 0) * age, y - Math.abs(Math.sin(a)) * d * 0.35 - (o.rise || 60) * k * S * hash2(seed, i + 60), rad]);
  }
  g.save(); g.globalAlpha = (o.alpha || 1) * (1 - smooth(0.72, 1, k)); puffCluster(g, cs, o.fill || '#f1dcc0', o.shade || '#c69c8c', o.line === undefined ? 'rgba(60,30,50,0.9)' : o.line, 4); g.restore();
}
// water crown + droplets
function splash(g, x, y, age, seed, o = {}) {
  const life = o.life || 0.8; if (age < 0 || age > life) return;
  const S = o.s || 1, k = age / life, ex = easeOut(k);
  g.save(); g.lineJoin = 'round'; g.globalAlpha = 1 - smooth(0.75, 1, k);
  g.strokeStyle = '#e4f4ff'; g.lineWidth = 14 * (1 - k) * S + 2; g.beginPath(); g.ellipse(x, y + 4, (120 + 330 * ex) * S, (26 + 66 * ex) * S, 0, 0, TAU); g.stroke();
  const n = 11;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    if (i % 2 !== pass) continue;
    const u = (i / (n - 1) - 0.5) * 2;
    const hgt = (120 + 150 * hash2(seed, i)) * S * Math.sin(PI * clamp(k * 1.25 + 0.08)) * (1 - 0.30 * u * u) * (pass ? 0.78 : 1.1);
    if (hgt < 6) continue;
    const bx = x + u * (120 + 170 * ex) * S, tipx = bx + u * (80 + 190 * ex) * S, tipy = y - hgt, wd = (38 - 10 * hash2(seed + 4, i)) * S * (1 - 0.4 * k);
    g.beginPath(); g.moveTo(bx - wd, y + 6); g.quadraticCurveTo(bx - wd * 0.2, y - hgt * 0.62, tipx - wd * 0.16, tipy); g.arc(tipx, tipy, wd * 0.23, PI, 0); g.quadraticCurveTo(bx + wd * 0.55, y - hgt * 0.46, bx + wd, y + 6); g.quadraticCurveTo(bx, y + 22 * S, bx - wd, y + 6); g.closePath();
    g.fillStyle = pass ? '#7fb4e8' : '#cfeaff'; g.fill(); g.strokeStyle = 'rgba(18,28,72,0.9)'; g.lineWidth = 4; g.stroke();
    g.beginPath(); g.arc(tipx + u * 20 * S * (1 + k), tipy - (26 + 40 * k) * S, wd * 0.24, 0, TAU); g.fillStyle = '#eaf7ff'; g.fill(); g.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const a = -PI / 2 + (hash2(seed + 1, i) - 0.5) * 2.5, sp = (380 + hash2(seed + 2, i) * 1000) * S, gy = 2100 * S;
    const pos = q => [x + Math.cos(a) * sp * q, y + Math.sin(a) * sp * q + 0.5 * gy * q * q];
    const p = pos(age), q = pos(Math.max(0, age - 0.022)); if (p[1] > y + 50 * S) continue;
    g.strokeStyle = i % 4 ? '#bfe0ff' : '#ffffff'; g.lineCap = 'round'; g.lineWidth = (4 + hash2(seed + 3, i) * 11) * S * (1 - k * 0.7); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(p[0], p[1]); g.stroke();
  }
  g.restore();
}
function rain(g, t, o = {}) {
  const n = o.n || 520, slant = o.slant === undefined ? -0.24 : o.slant;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const depth = hash2(i, 91), len = 40 + depth * 150, sp = 1700 + depth * 2300;
    const span = H + 400; const y = ((hash2(i, 92) * span + t * sp) % span) - 200;
    const x = ((hash2(i, 93) * (W + 700) + y * slant) % (W + 700) + (W + 700)) % (W + 700) - 200;
    g.strokeStyle = 'rgba(190,220,255,' + (0.14 + depth * 0.38) * (o.alpha === undefined ? 1 : o.alpha) + ')'; g.lineWidth = 1 + depth * 2.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + slant * len, y + len); g.stroke();
  }
  g.restore();
}
function sweatDrops(g, x, y, t, o = {}) {
  g.save();
  for (let i = 0; i < 4; i++) {
    const k = fract(t * 1.7 + i * 0.27), a = -PI * 0.5 + (i - 1.5) * 0.55 - 0.35;
    const px = x + Math.cos(a) * (50 + k * 120), py = y + Math.sin(a) * (50 + k * 90) + k * k * 60, r = 15 * (1 - k * 0.5);
    g.translate(px, py); g.rotate(a + PI / 2);
    g.beginPath(); g.moveTo(0, -r * 1.9); g.quadraticCurveTo(r, -r * 0.4, r, r * 0.3); g.arc(0, r * 0.3, r, 0, PI); g.quadraticCurveTo(-r, -r * 0.4, 0, -r * 1.9); g.closePath();
    g.fillStyle = '#bfe8ff'; g.fill(); g.strokeStyle = '#1b2a55'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-r * 0.3, r * 0.2, r * 0.25, 0, TAU); g.fill();
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  g.restore();
}
// loose feathers drifting
function featherBurst(g, x, y, age, seed, o = {}) {
  if (age < 0) return;
  const n = o.n || 14, S = o.s || 1;
  for (let i = 0; i < n; i++) {
    const a = hash2(seed, i) * TAU, sp = (160 + hash2(seed, i + 9) * 620) * S, drag = 1 - Math.exp(-age * 3.2);
    const px = x + Math.cos(a) * sp * drag / 1.8 + (o.wind || 0) * age + Math.sin(age * 5 + i) * 26 * S, py = y + Math.sin(a) * sp * drag / 2.6 + (o.gravity === undefined ? 120 : o.gravity) * age * age * 0.9 - (o.lift || 0) * age;
    const ang = age * (2 + hash2(seed, i + 3) * 4) * (i % 2 ? 1 : -1) + i, ln = (58 + hash2(seed, i + 5) * 52) * S, dark = i % 4 === 0;
    tuft(g, px, py, ang, ln, 34 * S, dark ? '#2c2842' : '#fbf8f2', 'rgba(30,18,50,0.9)', 0.22);
    g.strokeStyle = dark ? '#8d86b4' : '#a9a6c8'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(px - Math.cos(ang) * 12 * S, py - Math.sin(ang) * 12 * S); g.quadraticCurveTo(px + Math.cos(ang) * ln * 0.5, py + Math.sin(ang) * ln * 0.5, px + Math.cos(ang + 0.18) * ln * 0.88, py + Math.sin(ang + 0.18) * ln * 0.88); g.stroke();
  }
}
function shockRing(g, x, y, age, o = {}) {
  const life = o.life || 0.35; if (age < 0 || age > life) return;
  const k = age / life, r = easeOut(k) * (o.r || 520);
  g.save(); g.translate(x, y); g.scale(1, o.flat || 1); g.strokeStyle = o.color || '#fff'; g.globalAlpha = 1 - k; g.lineWidth = (o.w || 34) * (1 - k) + 2; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); g.restore();
}
function embers(g, t, o = {}) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const n = o.n || 80;
  for (let i = 0; i < n; i++) {
    const sp = 90 + hash2(i, 3) * 260, span = H + 200;
    const y = span - ((hash2(i, 4) * span + t * sp) % span) - 100, x = hash2(i, 5) * W + Math.sin(t * (1 + hash2(i, 6) * 2) + i) * 50;
    const r = 1.5 + hash2(i, 7) * 5;
    g.fillStyle = i % 3 ? 'rgba(255,170,50,0.8)' : 'rgba(255,240,180,0.9)'; g.beginPath(); g.ellipse(x, y, r * 0.6, r * (o.stretch || 1.8), 0, 0, TAU); g.fill();
  }
  g.restore();
}
// glass shatter of a flat picture: triangle fan shards flying out of the impact point
function shatterDraw(g, src, age, cx, cy, seed) {
  const rings = [0, 130, 330, 620, 1000, 2400], spokes = 17;
  const ang = []; for (let i = 0; i < spokes; i++) ang.push((i + 0.15 + 0.7 * hash2(seed, i)) / spokes * TAU);
  const pt = (ri, si) => { const s = ((si % spokes) + spokes) % spokes; const rr = rings[ri] * (ri === 0 || ri === rings.length - 1 ? 1 : 0.78 + 0.44 * hash2(seed + ri, s)); return [cx + Math.cos(ang[s]) * rr, cy + Math.sin(ang[s]) * rr]; };
  const fly = Math.max(0, age - 0.10);
  for (let ri = 0; ri < rings.length - 1; ri++) for (let si = 0; si < spokes; si++) {
    const poly = ri === 0 ? [pt(0, si), pt(1, si), pt(1, si + 1)] : [pt(ri, si), pt(ri + 1, si), pt(ri + 1, si + 1), pt(ri, si + 1)];
    const mx = poly.reduce((a, p) => a + p[0], 0) / poly.length, my = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const delay = ri * 0.022; const f = Math.max(0, fly - delay);
    const dir = Math.atan2(my - cy, mx - cx), sp = 2400 * (0.55 + hash2(seed + 40 + ri, si)) / (1 + ri * 0.28);
    const dx = Math.cos(dir) * sp * f, dy = Math.sin(dir) * sp * f + 1900 * f * f, rot = (hash2(seed + 80 + ri, si) - 0.5) * 9 * f, sc = 1 + f * (0.9 + hash2(seed + 99, si + ri * 20) * 1.5);
    if (Math.abs(dx) > 2400 || dy > 1800) continue;
    g.save(); g.translate(mx + dx, my + dy); g.rotate(rot); g.scale(sc * (1 - Math.min(0.6, f * hash2(si, ri) * 1.4)), sc); g.translate(-mx, -my);
    g.beginPath(); poly.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.save(); g.clip(); g.drawImage(src, 0, 0); g.restore();
    g.strokeStyle = f > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(30,24,60,' + clamp(age / 0.04) + ')'; g.lineWidth = f > 0 ? 5 : 4; g.stroke();
    g.restore();
  }
}
function panelBorder(g, poly, w = 12) {
  g.save(); g.lineJoin = 'miter';
  const path = () => { g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)); g.closePath(); };
  path(); g.strokeStyle = '#0c0716'; g.lineWidth = w + 12; g.stroke(); path(); g.strokeStyle = '#fbf8f2'; g.lineWidth = w; g.stroke(); g.restore();
}
// anime sound-effect lettering
function sfxWord(g, text, x, y, size, age, o = {}) {
  if (age < 0 || age > (o.life || 0.55)) return;
  const pop = easeOutBack(clamp(age / 0.12));
  heavyText(g, text, x, y, size * (0.55 + 0.45 * pop), { rot: o.rot || -0.1, skew: 0.22, fill: o.fill || ['#fff7c2', '#ffbe1c'].map((c, i) => [i, c]), layers: [['#140a1c', size * 0.085], ['#ffffff', size * 0.04], ['#140a1c', size * 0.018]],
    letter: (i) => ({ dy: (i % 2 ? -1 : 1) * size * 0.05 + Math.sin(age * 80 + i * 2) * size * 0.02 * Math.max(0, 1 - age * 3), rot: (i % 2 ? 0.05 : -0.05), a: 1 - smooth((o.life || 0.55) - 0.1, o.life || 0.55, age) }) });
}

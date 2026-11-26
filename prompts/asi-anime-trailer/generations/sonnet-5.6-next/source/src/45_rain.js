'use strict';
// ---------------------------------------------------------------------------
// rain. One 3D field of drops with a "rain clock": the clock runs, stops dead
// at 2.0 s (the blink), and starts again at 73.0 s when the blink ends.
// ---------------------------------------------------------------------------
const FREEZE_T = 2.0, RESUME_T = 73.0;
// rain time and its rate (0 = frozen) as pure functions of film time
function rainClock(t) {
  if (t < FREEZE_T) return t;
  if (t < RESUME_T) return FREEZE_T;
  const u = t - RESUME_T, a = .9;           // eases back to full speed over 0.9 s
  return FREEZE_T + (u < a ? u * u / (2 * a) : u - a / 2);
}
const rainRate = t => (t < FREEZE_T ? 1 : t < RESUME_T ? 0 : clamp((t - RESUME_T) / .9));

function dropSprite(level, tint) {
  return cached(`drop:${level}:${tint}`, () => {
    const raw = CV(96, 128), x = C2D(raw);
    x.translate(48, 66);
    const body = new Path2D('M 0 -40 C 8 -30 25 -12 25 8 C 25 24 14 35 0 35 C -14 35 -25 24 -25 8 C -25 -12 -8 -30 0 -40 Z');
    x.fillStyle = linGrad(x, 0, -40, 0, 35, [[0, rgba('#16245c', .30)], [.45, rgba(tint, .12)], [1, rgba(tint, .62)]]);
    x.fill(body);
    x.save(); x.clip(body);
    ell(x, 0, 31, 22, 17, rgba('#f2fbff', .85));
    ell(x, 0, 22, 21, 15, rgba(tint, .55));
    ell(x, 0, -25, 24, 20, rgba('#0c1848', .30));
    x.restore();
    x.strokeStyle = rgba(tint, .85); x.lineWidth = 2.4; x.stroke(body);
    ell(x, -9, -4, 6.5, 9, '#ffffff', .45);
    dot(x, 9, 20, 3, 'rgba(255,255,255,0.95)');
    if (level === 0) return raw;
    const out = CV(96, 128), y = C2D(out);
    y.filter = `blur(${[0, 2.4, 6, 11][level]}px)`;
    y.drawImage(raw, 0, 0);
    return out;
  });
}
function bokehSprite(tint) {
  return cached('bokeh:' + tint, () => {
    const c = CV(128, 128), x = C2D(c);
    x.filter = 'blur(3px)';
    dot(x, 64, 64, 54, rgba(tint, .20));
    x.strokeStyle = rgba(tint, .42); x.lineWidth = 4; x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke();
    return c;
  });
}
// one drop centred at (sx,sy), r = half width in px, blur 0..3
function drawDrop(ctx, sx, sy, r, level = 0, a = 1, tint = '#cfe6ff') {
  if (a <= .01 || r < .35) return;
  ctx.globalAlpha = a;
  if (r < 2.2) { dot(ctx, sx, sy, r, rgba(tint, .85)); ctx.globalAlpha = 1; return; }
  const k = r / 25;
  ctx.drawImage(dropSprite(level, tint), sx - 48 * k, sy - 66 * k, 96 * k, 128 * k);
  ctx.globalAlpha = 1;
}
/**
 * field(ctx, g, t, o)
 * o: seed, n, camx, camy, camz, focus (z in focus), f (focal px), near, far,
 *    alpha, tint, cx, cy, size, wind, hole {x,y,r} keeps an area clear
 */
function rainField(ctx, g, t, o = {}) {
  const n = o.n ?? 900, R = rng(o.seed ?? 31);
  const f = o.f ?? 1100, near = o.near ?? .75, far = o.far ?? 14, focus = o.focus ?? 4;
  const camx = o.camx ?? 0, camy = o.camy ?? 0, camz = o.camz ?? 0;
  const rt = rainClock(t), rate = o.rate ?? rainRate(t);
  const XS = o.xs ?? 11, YS = o.ys ?? 7, fall = o.fall ?? 9.5, wind = o.wind ?? .9;
  const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, A = o.alpha ?? 1, size = o.size ?? 1, tint = o.tint ?? '#cfe6ff';
  for (let i = 0; i < n; i++) {
    const x0 = R.range(-XS, XS), y0 = R.range(-YS, YS), z0 = near + Math.pow(R(), .8) * (far - near), sp = R.range(.82, 1.18), s = R.range(.55, 1.3);
    let y = ((y0 + fall * sp * rt + YS) % (2 * YS) + 2 * YS) % (2 * YS) - YS;
    let x = x0 + wind * (y / YS) * .6;
    const z = z0 - camz;
    if (z < .35) continue;
    const sx = cx + f * (x - camx) / z, sy = cy + f * (y - camy) / z;
    if (sx < -140 || sx > W + 140 || sy < -220 || sy > H + 220) continue;
    if (o.hole) { const dx = (sx - o.hole.x) / o.hole.r, dy = (sy - o.hole.y) / o.hole.r; if (dx * dx + dy * dy < 1 && z < focus * 1.1) continue; }
    const rad = clamp(f * .0175 * s * size / z, .6, 70);
    const blur = Math.abs(1 / z - 1 / focus);
    const level = blur < .07 ? 0 : blur < .2 ? 1 : blur < .45 ? 2 : 3;
    const fade = clamp(1.15 - z / (far * 1.1)) * A;
    if (rate > .02) {
      // falling: a tapered streak whose length follows the clock rate
      const len = f * fall * sp * .042 * rate / z, dx = f * wind * .003 * len / (f * .05);
      if (len > rad * 2.2) {
        ctx.strokeStyle = rgba(tint, clamp(fade * (level > 1 ? .18 : .42)));
        ctx.lineWidth = Math.max(.8, rad * (level > 1 ? .9 : .5));
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx - dx, sy - len); ctx.lineTo(sx, sy); ctx.stroke();
        continue;
      }
    }
    if (level === 3 && rad > 16) { ctx.globalAlpha = fade * .55; ctx.drawImage(bokehSprite(tint), sx - rad * 1.7, sy - rad * 1.7, rad * 3.4, rad * 3.4); ctx.globalAlpha = 1; continue; }
    drawDrop(ctx, sx, sy, rad, level, clamp(fade * (level > 1 ? .75 : 1)), tint);
    if (g && level === 0 && (i % 9) === 0 && rad > 3) glow(g, sx - rad * .3, sy - rad * .2, rad * 2.6, '#dff2ff', .38 * fade);
  }
}
// a named drop: ringed, glowing, carrying a leader line and a handwritten tag
function litDrop(ctx, g, x, y, r, k, o = {}) {
  if (k <= 0) return;
  const col = o.color ?? '#9ff6ff';
  const pop = E.outBack(clamp(k * 1.6), 2.6);
  drawDrop(ctx, x, y, r * (1 + .12 * (1 - pop)), 0, 1, '#e6fbff');
  glow(ctx, x, y + r * .25, r * 3.4, col, .34 * clamp(k * 2));
  if (g) glow(g, x, y + r * .2, r * 5, col, .75 * clamp(k * 2));
  ctx.strokeStyle = rgba(col, .9 * clamp(k * 3)); ctx.lineWidth = Math.max(1.4, r * .075);
  ctx.beginPath(); ctx.arc(x, y, r * 1.65 * pop, -.5 * Math.PI, -.5 * Math.PI + TAU * clamp(k * 1.5)); ctx.stroke();
  const ping = clamp(k * 1.3);
  if (ping < 1) { ctx.strokeStyle = rgba(col, (1 - ping) * .7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * (1.7 + ping * 2.6), 0, TAU); ctx.stroke(); }
}
// splash ring and crown when a falling drop lands
function splash(ctx, g, x, y, u, s = 1) {
  if (u < 0 || u > .75) return;
  const k = E.outCubic(u / .75), a = 1 - u / .75;
  ctx.strokeStyle = rgba('#eaffff', a); ctx.lineWidth = 3.5 * s * a + .6;
  ctx.beginPath(); ctx.ellipse(x, y, (10 + 90 * k) * s, (4 + 28 * k) * s, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const an = -Math.PI + (i + .5) / 11 * Math.PI, sp = 70 + hash(i + 40) * 80;
    const px = x + Math.cos(an) * sp * k * s, py = y + (Math.sin(an) * sp * k + 130 * k * k) * s;
    drawDrop(ctx, px, py, (3.2 + hash(i) * 3) * s * a, 0, a, '#e8fbff');
  }
  if (g) glow(g, x, y, 90 * s, '#bff6ff', .7 * a);
}

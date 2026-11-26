'use strict';
// ---------------------------------------------------------------------------
// director: the shot list, per-frame post settings and window.renderAt(t)
// ---------------------------------------------------------------------------
const defaultPost = () => ({
  bloom: .55, thresh: .74, glowK: 1.0, ca: 1.1, vig: .42, sat: 1.04, con: 1.025, flash: 0, fade: 0, impact: 0,
  zoom: 1, grain: 1.4, frame: 0, radial: 0, lift: [0, 0, 0], gain: [1, 1, 1], flashCol: [1, 1, 1],
  inkCol: [.03, .02, .1], paperCol: [.96, .95, 1], shake: [0, 0], center: [.5, .5],
});

let SCENE, SCTX, GLOWC, GCTX, ready = false;
function initFilm(canvas) {
  SCENE = CV(W, H); SCTX = SCENE.getContext('2d', { alpha: false });
  GLOWC = CV(W / 2, H / 2); GCTX = GLOWC.getContext('2d');
  Post.init(canvas);
  ready = true;
}
// the thumbnail: the opening eye with the title and the premise
function renderThumb() {
  const ctx = SCTX, g = GCTX;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W / 2, H / 2); g.setTransform(.5, 0, 0, .5, 0, 0);
  drawECU(ctx, .75, { x: 960, y: 486, s: 1.1, lid: 0, ma: 1, still: true, gaze: [7, 2], webA: 1.15 });
  rect(ctx, 0, 640, W, 440, linGrad(ctx, 0, 640, 0, 1080, [[0, 'rgba(10,6,34,0)'], [.5, 'rgba(10,6,34,0.8)'], [1, 'rgba(10,6,34,0.96)']]));
  type(ctx, 'BETWEEN BLINKS', 960, 818, { size: 138, bold: true, weight: 26, track: 24, color: '#ffffff', shadow: { color: 'rgba(8,4,30,0.8)', y: 9, grow: 7 } });
  type(ctx, 'you blink.  it lives nine thousand years.', 960, 1002, { size: 42, weight: 4.4, track: 8, color: '#ffeec4', shadow: { color: 'rgba(8,4,30,0.85)', y: 3, grow: 9 } });
  drawMaKanji(ctx, g, 168, 160, 196, 1, { sun: 1 });
  const P = defaultPost(); P.bloom = .42; P.thresh = .82; P.vig = .42; P.grain = 0;
  Post.render(SCENE, GLOWC, P);
}
function renderAt(t) {
  t = clamp(t, 0, DURATION - 1e-4);
  const frame = Math.round(t * FPS);
  const ctx = SCTX, g = GCTX;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  rect(ctx, 0, 0, W, H, '#000');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W / 2, H / 2); g.setTransform(.5, 0, 0, .5, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const P = defaultPost(); P.frame = frame;
  for (const s of SHOTS) {
    if (t >= s.t0 - 1e-6 && t < s.t1 - 1e-6) {
      ctx.save(); g.save();
      s.draw({ ctx, g, t, u: t - s.t0, d: s.t1 - s.t0, P, t0: s.t0, t1: s.t1 });
      ctx.restore(); g.restore();
    }
  }
  for (const f of FLASHES) {
    const u = t - f.t;
    if (u > -f.up && u < f.down) {
      const a = (u < 0 ? 1 + u / f.up : 1 - u / f.down) * f.peak;
      if (a > P.flash) { P.flash = a; P.flashCol = vec3(f.color); }
    }
  }
  for (const m of IMPACTS) {
    const f0 = Math.round(m.t * FPS);
    if (frame >= f0 && frame < f0 + m.n) { P.impact = m.mode; P.inkCol = vec3(m.ink); P.paperCol = vec3(m.paper); P.grain = 0; }
  }
  Post.render(SCENE, GLOWC, P);
}

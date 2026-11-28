// Picks the shot for a moment in time, draws it and runs the final pass.
// renderFrame(t) depends only on t, so any frame can be rendered on its own.
'use strict';
const sceneCanvas = mk();
const sceneCtx = sceneCanvas.getContext('2d', { alpha: false });
SHOTS.sort((a, b) => a.start - b.start);
const finalCanvas = mk(), finalCtx = finalCanvas.getContext('2d', { alpha: false });
window.OUTPUT = finalCanvas;

window.renderFrame = function (t) {
  let s = SHOTS[0];
  for (const q of SHOTS) if (q.start <= t + 1e-4) s = q;
  const g = sceneCtx, fx = FX0();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const u = Math.max(0, t - s.start);
  g.save();
  s.draw(g, t, u, fx, clamp(u / (s.end - s.start)));
  g.restore();
  fx.chroma = Math.min(fx.chroma, 34);
  postProcess(sceneCanvas, fx, t);
  finalCtx.drawImage(outCanvas, 0, 0);
  drawLyrics(finalCtx, t);
  return s.name;
};
window.SHOT_LIST = () => SHOTS.map(s => ({ name: s.name, start: s.start, end: s.end }));

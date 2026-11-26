// Public interface: DURATION, renderAt(t), yearAt(t), rateAt(t).
SCENES.sort((a, b) => a.at - b.at);

window.DURATION = TL.DURATION;
window.yearAt = TL.yearAt;
window.rateAt = TL.rateAt;
window.FPS = TL.FPS;

window.renderAt = function renderAt(t) {
  t = clamp(+t || 0, 0, TL.DURATION);
  const frame = Math.round(t * TL.FPS);
  HUD.riding.length = 0;
  const { fb, post } = DIR.render(t);
  window.lastHUD = HUD.draw(t);
  GFX.present(fb, {
    bloomK: post.bloom, thresh: post.thresh, vig: post.vig, exposure: post.exposure,
    fade: 1, frame,
  });
  return window.lastHUD;
};

// Poster frame for thumbnail.png: the ember mid-way between the two pairs of hands.
window.renderThumb = function renderThumb() {
  GFX.clearLayers();
  const env = newEnv();
  const L = GFX.layers;
  SKY.stars(L.back, 2.6, { alpha: 0.85, pole: [1560, -300], density: 0.7 });
  const H_ = handoff({ t: 4.0, u: 4.0, env, back: L.back, far: L.far, near: L.near, glow: L.glow },
    { rise: 1, tip: 0.585, lift: 0, push: 0.9, intensity: 1.06 });
  sparks(L.glow, H_.ex, H_.ey - 20, 4.0, { n: 40, spread: 60, height: 380, size: 2.4, alpha: 0.9, seed: 21 });
  const fb = GFX.composeScene(env, 0, 4.0);
  const hud = L.hud;
  hud.setTransform(1, 0, 0, 1, 0, 0);
  hud.clearRect(0, 0, W, H);
  const g = hud.createLinearGradient(0, 700, 0, H);
  g.addColorStop(0, 'rgba(2,3,9,0)'); g.addColorStop(1, 'rgba(2,3,9,0.78)');
  hud.fillStyle = g; hud.fillRect(0, 700, W, H - 700);
  FONT.draw(hud, 'THE SAME FIRE', 960, 912, 112, { align: 'center', color: '#fff1da', weight: 11, track: 22 });
  FONT.draw(hud, '300,000 years of us in 80 seconds', 960, 1014, 50, { align: 'center', color: '#ffc47a', weight: 5.4 });
  GFX.present(fb, { bloomK: 0.66, thresh: 0.70, vig: 0.30, frame: 0 });
};

// Interactive preview (ignored when the capture tools load the page).
(function player() {
  if (location.search.includes('capture')) return;
  const bar = document.getElementById('bar');
  const range = document.getElementById('scrub');
  const btn = document.getElementById('play');
  const stamp = document.getElementById('stamp');
  if (!bar) return;
  bar.hidden = false;
  let playing = false, t = 0, last = 0;
  const show = () => { window.renderAt(Math.min(t, 1919 / 24)); range.value = t; stamp.textContent = t.toFixed(2) + ' s'; };
  const tick = (now) => {
    if (!playing) return;
    t += Math.min(0.1, (now - last) / 1000); last = now;
    if (t >= TL.DURATION) { t = TL.DURATION; playing = false; btn.textContent = 'play'; }
    show();
    if (playing) requestAnimationFrame(tick);
  };
  const toggle = () => {
    playing = !playing; btn.textContent = playing ? 'pause' : 'play';
    if (playing) { if (t >= TL.DURATION) t = 0; last = performance.now(); requestAnimationFrame(tick); }
  };
  btn.onclick = toggle;
  document.getElementById('film').onclick = toggle;
  range.oninput = () => { t = +range.value; show(); };
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') { t = Math.min(80, t + (e.shiftKey ? 1 : 1 / 24)); show(); }
    if (e.code === 'ArrowLeft') { t = Math.max(0, t - (e.shiftKey ? 1 : 1 / 24)); show(); }
  });
  const q = new URLSearchParams(location.search);
  if (q.has('t')) t = +q.get('t');
  show();
})();

window.READY = true;

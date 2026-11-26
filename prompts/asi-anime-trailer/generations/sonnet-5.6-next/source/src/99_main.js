'use strict';
// ---------------------------------------------------------------------------
// boot, public API and a small preview player
// ---------------------------------------------------------------------------
window.ERRS = [];
window.addEventListener('error', e => window.ERRS.push(String(e.message)));
(function boot() {
  try {
    const view = document.getElementById('view');
    initFilm(view);
    window.DURATION = DURATION;
    window.FPS = FPS;
    window.renderAt = renderAt;
    window.renderThumb = renderThumb;
    window.readFrame = () => Post.read();
    window.gpuName = () => Post.info();
    // metadata used by the audit tools
    window.TIMELINE = () => ({
      duration: DURATION, fps: FPS,
      shots: SHOTS.map(s => ({ id: s.id, t0: s.t0, t1: s.t1 })),
      cuts: typeof CUTS !== 'undefined' ? CUTS : [],
      ramps: typeof RAMPS !== 'undefined' ? RAMPS : [],
      impacts: IMPACTS.map(m => ({ t: m.t, n: m.n })),
      flashes: FLASHES.map(f => ({ t: f.t, up: f.up, down: f.down, peak: f.peak })),
    });
    const q = new URLSearchParams(location.search);
    if (q.has('capture')) {
      document.body.classList.add('capture');
      window.READY = true;
      return;
    }
    // preview: soundtrack.wav is optional, the picture works without it
    const audio = new Audio('soundtrack.wav');
    const seek = document.getElementById('seek'), btn = document.getElementById('play');
    let playing = false, base = 0, start = 0, cur = 0;
    const now = () => performance.now() / 1000;
    const setPlaying = p => {
      playing = p; btn.classList.toggle('on', p);
      if (p) { if (cur >= DURATION - .05) cur = 0; base = cur; start = now(); audio.currentTime = cur; audio.play().catch(() => {}); }
      else audio.pause();
    };
    btn.onclick = () => setPlaying(!playing);
    view.onclick = () => setPlaying(!playing);
    seek.oninput = () => { cur = seek.value / 1000 * DURATION; base = cur; start = now(); audio.currentTime = cur; renderAt(Math.floor(cur * FPS) / FPS); };
    window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); } });
    let lastF = -1;
    (function loop() {
      if (playing) {
        cur = !audio.paused && audio.currentTime > 0 ? audio.currentTime : base + now() - start;
        if (cur >= DURATION) { cur = DURATION; setPlaying(false); }
        const f = Math.floor(cur * FPS);
        if (f !== lastF) { renderAt(f / FPS); lastF = f; seek.value = String(cur / DURATION * 1000); }
      }
      requestAnimationFrame(loop);
    })();
    renderAt(t0FromHash());
    function t0FromHash() { const m = location.hash.match(/t=([\d.]+)/); return m ? +m[1] : 0; }
    window.READY = true;
  } catch (e) {
    window.FAILED = String(e && e.stack || e);
    console.log(window.FAILED);
  }
})();

// main.js — boot, public hooks (window.DURATION / window.renderAt), live preview and sheets
const FPS = 24, NFRAMES = 1200;
let R = null, FILM = null;
window.DURATION = NFRAMES / FPS;

function boot() {
  const canvas = document.getElementById('c');
  const params = new URLSearchParams(location.search);
  const capturing = params.has('cap');
  const ss = parseFloat(params.get('ss') || (capturing ? '2' : '1'));
  R = new Renderer(canvas, ss);
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.GPU_NAME = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
  if (typeof Film !== 'undefined') FILM = new Film(R);
  window.renderAt = t => {
    const f = clamp(Math.floor(t * FPS + 1e-3), 0, NFRAMES - 1);
    FILM.renderFrame(f);
  };
  if (!capturing && FILM) livePreview(canvas);
}

function livePreview(canvas) {
  let t0 = performance.now(), paused = false, t = 0, last = -1;
  const q = new URLSearchParams(location.search);
  if (q.has('t')) { t = parseFloat(q.get('t')); paused = true; }
  const tick = now => {
    if (!paused) t = ((now - t0) / 1000) % window.DURATION;
    const f = Math.floor(t * FPS);
    if (f !== last) { window.renderAt(t); last = f; }
    requestAnimationFrame(tick);
  };
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { paused = !paused; t0 = performance.now() - t * 1000; e.preventDefault(); }
    if (e.code === 'ArrowRight') { paused = true; t = Math.min(window.DURATION - 0.001, t + 1 / FPS); }
    if (e.code === 'ArrowLeft') { paused = true; t = Math.max(0, t - 1 / FPS); }
  });
  canvas.addEventListener('click', e => { paused = true; t = e.offsetX / canvas.clientWidth * window.DURATION; });
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ character sheet
function sheetChar(kind, pose, yaw, opts = {}) {
  const root = Object.assign({ pos: [0, 0, 0], yaw }, opts.root || {});
  const rig = solveRig(kind, pose, root);
  const back = M3.v(M3.ry(yaw * D2R), [0, 0, -1]);
  const wind = opts.wind || [0.18, 0.02, 0];
  return {
    kind, rig,
    env: { time: 0.37, floor: opts.floor !== undefined ? opts.floor : 0, drag: { hair: V.add(V.mul(back, 0.18), wind), cloth: V.add(V.mul(back, 0.22), V.mul(wind, 1.5)) } },
    sun: V.norm([-0.5, 0.72, 0.62]),
  };
}

window.renderSheet = async function (name) {
  const CW = 960, CH = 1080;
  const cv = document.createElement('canvas'); cv.width = CW * 4; cv.height = CH * 4 + 360;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#d9d6d0'; ctx.fillRect(0, 0, cv.width, cv.height);
  const rows = [
    { kind: 'iro', title: 'IRO  -  COLOUR.  FAST, WILD, AIRBORNE', turn: true },
    { kind: 'iro', title: 'IRO  KEY POSES', poses: [['READY STANCE', IRO.ready, 72, {}], ['HEEL FLIGHT', IRO.flyKick, 78, { root: { pos: [-0.15, 0.1, 0] } }], ['RISING HEEL', IRO.rise, 76, {}], ['SIGNATURE: PRISM COMET', IRO.comet, 70, { root: { pos: [-0.12, 0.25, 0], pitch: 8 }, fx: 'comet' }]] },
    { kind: 'sumi', title: 'SUMI  -  INK.  HEAVY, PRECISE, STILL', turn: true },
    { kind: 'sumi', title: 'SUMI  KEY POSES', poses: [['STANCE', SUMI.stance, 62, {}], ['INK PALM', SUMI.palm, 26, { root: { pos: [-0.05, 0, 0] } }], ['TWO-FIST HAMMER', SUMI.hammerUp, 62, { root: { pos: [0, 0.18, 0] } }], ['SIGNATURE: ONE STROKE', SUMI.strokeUp, 44, { fx: 'stroke' }]] },
  ];
  let y = 0;
  for (const row of rows) {
    ctx.fillStyle = '#141216'; ctx.fillRect(0, y, cv.width, 90);
    drawText(ctx, row.title, 60, y + 24, 42, { color: row.kind === 'iro' ? '#ffcf3a' : '#f2f2f2', weight: 0.13 });
    y += 90;
    for (let i = 0; i < 4; i++) {
      let ch, label, opts = {};
      if (row.turn) {
        const yaw = [0, 45, 90, 180][i];
        ch = sheetChar(row.kind, row.kind === 'iro' ? IRO.stand : SUMI.stand, yaw);
        label = ['FRONT', 'THREE-QUARTER', 'SIDE', 'BACK'][i];
      } else {
        const p = row.poses[i];
        opts = p[3];
        ch = sheetChar(row.kind, p[1], p[2], opts);
        label = p[0];
      }
      const big = row.kind === 'sumi';
      const dist = 8;
      const fov = (big ? (row.turn ? 23.8 : 25.0) : (row.turn ? 17.8 : 20.5));
      const ty = big ? (row.turn ? 1.17 : 1.33) : (row.turn ? 0.93 : 1.00);
      const S = {
        camera: { pos: [0, ty + 0.45, dist], tgt: [0, ty, 0], fov, roll: 0 },
        chars: [ch], world: null, time: 0.37, frame: 0, shadow: false,
        clear: [0.80, 0.785, 0.76],
        post: { bloom: 0.12, grain: 0.018, vig: 0.12, halo: 1 },
        fx: opts.fx ? sheetFx(opts.fx, ch) : {},
      };
      R.render(S);
      ctx.drawImage(R.canvas, 480, 0, 960, 1080, i * CW, y, CW, CH);
      drawText(ctx, label, i * CW + CW / 2, y + CH - 54, 34, { align: 'center', color: '#141216', weight: 0.14, outline: '#e9e6e0' });
      ctx.fillStyle = 'rgba(20,18,22,0.18)'; ctx.fillRect(i * CW, y, 2, CH);
    }
    y += CH;
  }
  return cv;
};

function sheetFx(kind, ch) {
  const rib = new RibbonBatch();
  const J = ch.rig.J;
  if (kind === 'comet') {
    const foot = J.anR, dir = V.norm(V.sub(J.anR, J.pelvis));
    for (let k = 0; k < 7; k++) {
      const pts = [], ws = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, a = u * 5.2 + k * 0.9;
        const back = V.mad(foot, dir, -(1 - u) * 1.9);
        const rad = (1 - u) * 0.55 + 0.03;
        pts.push(V.add(back, [Math.cos(a) * rad * 0.3, Math.sin(a) * rad, Math.cos(a) * rad]));
        ws.push(0.02 + 0.055 * u);
      }
      rib.add(pts, ws, 2, k * 0.37, [1, 1, 1, 1], [0, 0, 1]);
    }
  } else if (kind === 'stroke') {
    const h = J.wrR;
    const pts = [], ws = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40, a = -0.35 + u * 3.55;
      pts.push([h[0] + Math.cos(a) * 0.98 - 0.05, h[1] - 1.05 + Math.sin(a) * 1.12, h[2] - 0.55]);
      ws.push(0.05 + 0.17 * Math.sin(Math.min(1, u * 1.1) * Math.PI) );
    }
    rib.add(pts, ws, 5, 0.2, [0, 0, 0, 1], [0, 0, 1]);
  }
  return { ribbons: rib };
}

window.addEventListener('DOMContentLoaded', () => {
  window.READY = new Promise((res, rej) => { try { boot(); res(); } catch (e) { rej(e); } });
  window.READY.catch(e => console.error(e && e.stack || String(e)));
});

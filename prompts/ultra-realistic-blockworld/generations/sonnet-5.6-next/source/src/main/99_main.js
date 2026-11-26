// ================================================================ boot and main loop
const canvas = document.getElementById('view');
const Stats = { fps: 60, ft: 16.7, cpu: 4, calls: 0, tris: 0 };

function fatal(msg) {
  const t = document.getElementById('load-text');
  if (t) t.textContent = msg;
  window.__fatal = msg;
}

async function boot() {
  const fill = document.getElementById('load-fill'), text = document.getElementById('load-text');
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe || !probe.getExtension('EXT_color_buffer_float')) { fatal('ASHLAR needs WebGL 2 with floating point render targets.'); return; }
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: DEMO, stencil: false });
  renderer.autoClear = false; renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(1); renderer.info.autoReset = false;
  renderer.debug.checkShaderErrors = true;
  const t0 = performance.now();
  const pool = new WorkerPool(WORKER_COUNT);
  await Materials.bake(pool, Q.texSize, (p, n) => { fill.style.width = (p * 62) + '%'; text.textContent = 'quarrying materials · ' + n.replace(/_/g, ' '); });
  const bakeMs = performance.now() - t0;
  text.textContent = 'lighting the sky'; fill.style.width = '66%'; await nextFrame();
  Sky.init(); WorldMats.init(); Pipeline.init(); Pipeline.applyQuality();
  Effects.init(); Entities.init(); Viewmodel.init(); Icons.init(); UI.init();
  Game.pool = pool;
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  window.__ashlar = { Game, Pipeline, U, Sky, Creatures, Effects, Entities, Viewmodel, UI, Settings, Materials, Audio, Icons, B, BLOCKS, ITEMS, RECIPES, BIOME, LAYER, renderer, get Q() { return Q; }, gpuName, bakeMs, THREE };
  window.__stats = () => ({ fps: +Stats.fps.toFixed(1), ft: +Stats.ft.toFixed(2), cpu: +Stats.cpu.toFixed(2), calls: Stats.calls, tris: Stats.tris, w: Pipeline.W, h: Pipeline.H, gpu: gpuName, bakeMs: Math.round(bakeMs), preset: Q.name });

  if (DEMO) { await Demo.boot(fill, text); return; }

  Game.resize();
  addEventListener('resize', () => Game.resize());
  Game.bindInput(canvas);
  Game.showTitle();
  const tW = performance.now();
  // build the view behind the menu before showing it
  for (;;) {
    const cam = Pipeline.camera;
    Game.world.update(cam.position.x, cam.position.z, Q.viewDist, 0, 0); Game.world.applyPending(80);
    const left = Game.world.missing;
    text.textContent = 'cutting terrain · ' + left + ' chunks to go'; fill.style.width = (66 + 28 * clamp(1 - left / (Q.viewDist * Q.viewDist * 3), 0, 1)) + '%';
    if ((Game.world.missing === 0 && Game.world.lodPending < 12) || performance.now() - tW > 20000) break;
    await sleep(30);
  }
  text.textContent = 'compiling shaders'; fill.style.width = '97%'; await nextFrame();
  Game.tick(0.016); Game.applyEnvironment(0.016, true); Game.render(0.016); await nextFrame();
  fill.style.width = '100%';
  document.getElementById('loading').classList.add('done');

  let last = performance.now(), frames = 0, acc = 0, accN = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const raw = now - last; last = now;
    const dt = Math.min(0.05, Math.max(0.001, raw / 1000));
    Stats.ft = lerp(Stats.ft, raw, 0.06); Stats.fps = 1000 / Stats.ft;
    const c0 = performance.now();
    renderer.info.reset();
    try {
      Game.tick(dt);
      Game.render(dt);
      UI.updateHUD(dt, Game);
    } catch (e) { console.error(e); window.__lastError = String(e.stack || e); }
    Stats.cpu = lerp(Stats.cpu, performance.now() - c0, 0.08);
    Stats.calls = renderer.info.render.calls; Stats.tris = renderer.info.render.triangles;
    accN++; acc += raw; if (acc > 250) { UI.updateDebug(Game, Stats); acc = 0; accN = 0; }
    if (++frames === 20) {
      window.__ready = true;
      if (QS.get('play')) Game.startNew(QS.get('seed') || '4242', QS.get('play'));
    }
  }
  requestAnimationFrame(loop);
}
boot().catch((e) => { console.error(e); fatal(String(e.stack || e)); });

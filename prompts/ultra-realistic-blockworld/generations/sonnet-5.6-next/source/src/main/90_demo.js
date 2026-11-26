// ================================================================ cinematic: every frame is a pure function of time
const DEMO_SEED = 4242, DEMO_LENGTH = 30.0, SHUTTER = 1 / 120;

function demoFeatures() {
  const g = new WorldGen(DEMO_SEED);
  const yAt = (x, z) => Math.floor(g.baseColumn(x, z, {}).h);
  return {
    village: { x: 104, z: -848, y: yAt(104, -848), r: 34, seed: 7 },
    ruin: { x: 398, z: -1812, y: yAt(398, -1812), r: 15 },
    caverns: [{ x: -362, z: -3040, y: 34, rx: 27, ry: 14, rz: 23, lava: 6, sparse: 0.5 }],
    // an oak standing between the meadow camera and the rising sun, so the light breaks through its crown
    trees: [{ x: -380, z: -3085, kind: 'bigoak', seed: 90211 }],
    // keep trunks out of the lens along the glide, and let the grazing animals stand in trodden grass
    clearings: [{ x: -409, z: -3090, r: 7.5 }, { x: -399, z: -3088.5, r: 6.5 }],
    trample: [{ x: -388.0, z: -3091.1, r: 3.0 }, { x: -387.2, z: -3086.6, r: 2.6 }, { x: -395.8, z: -3087.6, r: 2.0 }],
    tunnels: [[[-424, 85, -3066, 5.6], [-414, 72, -3060, 4.6], [-404, 58, -3054, 4.3], [-393, 46, -3048, 4.8], [-380, 38, -3042, 6.5]]],
  };
}

// Catmull-Rom through unevenly spaced keys [u, a, b, c ...]
function track(keys, u) {
  const n = keys.length;
  if (u <= keys[0][0]) return keys[0].slice(1);
  if (u >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0; while (u > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const h = k2[0] - k1[0], t = (u - k1[0]) / h, t2 = t * t, t3 = t2 * t;
  const out = [];
  for (let c = 1; c < k1.length; c++) {
    const m1 = (k2[c] - k0[c]) / Math.max(1e-5, k2[0] - k0[0]) * h, m2 = (k3[c] - k1[c]) / Math.max(1e-5, k3[0] - k1[0]) * h;
    out.push((2 * t3 - 3 * t2 + 1) * k1[c] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * k2[c] + (t3 - t2) * m2);
  }
  return out;
}
const easeFilm = (u) => lerp(u, u * u * (3 - 2 * u), 0.55);

const GRADE0 = { tint: [1, 1, 1], sat: 1.0, contrast: 1.05, lift: [0.003, 0.004, 0.008], bloom: 0.05, flare: 1.0, vignette: 0.28, grain: 0.01, ca: 0.0055, exp: 1.0, sharp: 0.42 };
const ENV0 = { vol: 0.0016, forest: 0.0012, cave: 0, glow: 0.0018, volMax: 130, fog: 0.0008, haze: 1.2, water: [0.004, 0.05, 0.072], albedo: [0.1, 0.12, 0.05] };
const NOPARTS = { motes: 0, fireflies: 0, leaves: 0, petals: 0, butterflies: 0, rain: 0, snowfall: 0 };

function demoShots(F) {
  const R = F.ruin, V = F.village;
  return [
    { // 1 — first light over the sea and the snow range
      t0: 0, t1: 5.4, fadeIn: 0.9, fadeOut: 0.14, mode: 'yaw',
      cam: [[0, 2214, 126, 2079, -1.47, -0.085, 62], [0.5, 2229, 131.5, 2071, -1.545, -0.068, 61], [1, 2249, 138.5, 2060, -1.63, -0.045, 60]],
      time: (u) => 6.2 + u * 0.34, cover: 0.46, cloud: [140, 60], drift: [9, 3], wind: 0.55,
      env: { vol: 0.0011, forest: 0.0004, volMax: 170, fog: 0.00062, haze: 1.5 },
      grade: { tint: [1.025, 0.995, 0.965], sat: 1.04, exp: 1.1, bloom: 0.06 },
    },
    { // 2 — low glide through the meadow into the shafts under the canopy
      t0: 5.4, t1: 10.8, fadeIn: 0.22, fadeOut: 0.14, mode: 'yaw', follow: 1.85,
      cam: [[0, -409, 0.2, -3091.2, -1.5, 0.015, 62], [0.5, -401.5, 0.02, -3089, -1.575, 0.04, 61], [1, -393.5, -0.12, -3087.2, -1.65, 0.07, 60]],
      time: (u) => 7.12 + u * 0.16, cover: 0.3, cloud: [900, 340], drift: [6, 2], wind: 0.95,
      env: { vol: 0.0019, forest: 0.0052, volMax: 96, fog: 0.0008, haze: 1.1 },
      grade: { tint: [1.018, 1.0, 0.955], sat: 1.03, exp: 0.98, contrast: 1.075, bloom: 0.046, flare: 0.7 },
      parts: { motes: 1.5, leaves: 0.8, butterflies: 1 },
      dof: { aperture: 0.0095, focus: (u) => lerp(8.5, 12.5, u) },
      creatures: [
        { type: 'mossback', seed: 0.31, keys: [[0, -388.4, -3090.9], [1, -387.6, -3091.3]], yaw: -2.0, graze: 1 },
        { type: 'mossback', seed: 0.73, keys: [[0, -386.4, -3086.4], [1, -388.0, -3086.8]], graze: 0.1 },
        { type: 'plumehare', seed: 0.52, keys: [[0, -397.6, -3084.6], [1, -394.2, -3090.8]], graze: 0 },
      ],
    },
    { // 3 — down the sinkhole into the lava hall
      t0: 10.8, t1: 16.4, fadeIn: 0.22, fadeOut: 0.14, mode: 'look',
      cam: [[0, -432.5, 91, -3071, 66], [0.2, -422.5, 81.5, -3065, 66], [0.42, -411, 68.5, -3058.4, 67], [0.62, -399.5, 53.5, -3051.4, 68], [0.8, -388, 42.2, -3045.6, 68], [1, -374.5, 37.2, -3043.4, 66]],
      look: [[0, -418, 72, -3062], [0.2, -411, 66, -3058], [0.42, -399, 49, -3051], [0.62, -386, 38, -3045], [0.8, -366, 31, -3041], [1, -346, 29.5, -3034]],
      time: () => 10.6, cover: 0.3, cloud: [400, 100], drift: [5, 2], wind: 0.35,
      camSky: (u) => 1 - sstep(0.17, 0.5, u),
      env: { vol: 0.0014, forest: 0.001, cave: 0.0024, glow: 0.0011, volMax: 90, fog: 0.0007, albedo: [0.1, 0.12, 0.05] },
      // the eye is caught out by the dark, then opens up and lets the lava bloom
      ev: [[0, -0.1], [0.24, -0.1], [0.4, -0.85], [0.56, -0.5], [0.72, -0.08], [0.84, 0.1], [1, 0.0]],
      grade: { tint: [1.03, 0.985, 0.95], sat: 0.93, contrast: 1.1, bloom: 0.045, flare: 0.4, exp: 0.9 },
      // the lake behaves as one broad warm source, lifting rock colour across the hall
      lights: [
        { x: -368, y: 31, z: -3046, color: [1, 0.55, 0.24], power: 15, radius: 30, type: 1, held: true, noGlow: true },
        { x: -352, y: 31, z: -3036, color: [1, 0.55, 0.24], power: 15, radius: 30, type: 1, held: true, noGlow: true },
        { x: -409, y: 68, z: -3057, color: [0.75, 0.85, 1], power: 2.4, radius: 14, type: 1, held: true, noGlow: true },
      ],
      parts: { motes: 0.5 },
      creatures: [{ type: 'hollowlantern', seed: 0.2, keys: [[0, -357, -3047.5], [1, -360.5, -3045.5]], y: [[0, 31.2], [1, 30.4]], yaw: -1.9 }],
    },
    { // 4 — golden hour across the rust dunes
      t0: 16.4, t1: 20.9, fadeIn: 0.22, fadeOut: 0.14, mode: 'yaw',
      cam: [[0, -1797.8, 103.4, -2970, 0.27, -0.082, 62], [0.5, -1800.6, 103.9, -2978.5, 0.345, -0.062, 61], [1, -1804.4, 105.2, -2988, 0.43, -0.045, 60]],
      time: (u) => 17.12 + u * 0.22, cover: 0.2, cloud: [2600, 1500], drift: [7, 3], wind: 0.65,
      env: { vol: 0.0008, forest: 0, volMax: 160, fog: 0.0007, haze: 1.7, albedo: [0.34, 0.2, 0.1] },
      grade: { tint: [1.045, 0.99, 0.93], sat: 0.99, exp: 1.06, contrast: 1.075 },
    },
    { // 5 — the storm arrives over the ruined colonnade
      t0: 20.9, t1: 25.8, fadeIn: 0.22, fadeOut: 0.16, mode: 'yaw',
      cam: [[0, R.x - 12.4, R.y + 3.5, R.z + 12.8, -0.815, 0.04, 66], [0.5, R.x - 9.2, R.y + 3.0, R.z + 9.6, -0.775, 0.065, 65], [1, R.x - 6.2, R.y + 2.7, R.z + 6.6, -0.74, 0.085, 64]],
      time: () => 17.25, cover: (u) => 0.74 + u * 0.22, cloud: [1500, 700], drift: [34, 12], wind: (u) => 1.0 + u * 0.7,
      storm: (u) => 0.72 + 0.28 * sstep(0, 0.65, u), rain: (u) => 0.4 + 0.6 * sstep(0.0, 0.55, u), wet: 1, puddle: 0.96,
      env: { vol: 0.0036, forest: 0.0006, glow: 0.0058, volMax: 120, fog: 0.0024, haze: 0.5, water: [0.006, 0.04, 0.05] },
      grade: { tint: [0.945, 0.99, 1.06], sat: 0.84, exp: 1.04, contrast: 1.09, bloom: 0.062, flare: 0 },
      parts: { rain: 1 },
      strikes: [
        { at: 22.02, from: [R.x + 150, 372, R.z - 90], to: [R.x + 128, R.y, R.z - 108], seed: 12 },
        { at: 23.55, from: [R.x + 84, 366, R.z - 190], to: [R.x + 96, R.y - 8, R.z - 160], seed: 41 },
        { at: 24.86, from: [R.x + 62, 360, R.z - 86], to: [R.x + 52, R.y, R.z - 70], seed: 7 },
      ],
      dof: { aperture: 0.008, focus: () => 16 },
      creatures: [{ type: 'gloamstalker', seed: 0.41, keys: [[0, R.x + 3.4, R.z - 3.0], [1, R.x + 2.2, R.z - 1.8]], yaw: -0.8, graze: 0 }],
    },
    { // 6 — lamps in the village under the galaxy
      t0: 25.8, t1: 30.0, fadeIn: 0.26, fadeOut: 0.75, mode: 'yaw', stars: 2.1,
      cam: [[0, V.x - 25, V.y + 7.2, V.z + 26, -0.79, -0.075, 64], [0.45, V.x - 28.5, V.y + 10.5, V.z + 30, -0.82, 0.045, 64], [1, V.x - 34, V.y + 15.5, V.z + 36, -0.865, 0.225, 66]],
      time: (u) => 22.35 + u * 0.12, cover: 0.03, cloud: [5200, 600], drift: [3, 1], wind: 0.4,
      env: { vol: 0.0007, forest: 0.0004, glow: 0.0019, volMax: 100, fog: 0.0005, haze: 0.6 },
      grade: { tint: [0.93, 0.975, 1.08], sat: 0.9, exp: 0.96, contrast: 1.065, bloom: 0.058, flare: 0, grain: 0.012 },
      parts: { fireflies: 1 },
    },
  ];
}

const Demo = {
  spp: 8, ss: 2, playing: false, shotIndex: -1, actors: [], activeStrike: null, lights: [],
  async boot(fill, text) {
    const capture = QS.get('capture') === '1';
    this.ss = +(QS.get('ss') || (capture ? 2 : 1));
    this.spp = +(QS.get('spp') || 8);
    Q.cloudScale = this.ss > 1 ? 0.36 : 0.5;
    document.getElementById('ui').style.display = 'none';
    canvas.style.objectFit = 'contain'; canvas.style.background = '#000';
    renderer.setSize(1920, 1080, false);
    Pipeline.resize(1920 * this.ss, 1080 * this.ss, 1920, 1080);
    this.features = demoFeatures();
    this.shots = demoShots(this.features);
    Game.pool = Materials.pool || Game.pool;
    Game.createWorld(DEMO_SEED, this.features);
    this.world = Game.world; Game.state = 'film';
    Creatures.enabled = false;
    text.textContent = 'staging the first shot'; fill.style.width = '85%';
    this.pose(0, true);
    const cam = Pipeline.camera;
    await this.world.settle(cam.position.x, cam.position.z, Q.viewDist, (m) => { text.textContent = 'staging the first shot · ' + m; });
    document.getElementById('loading').classList.add('done');
    window.renderAt = (t, o) => this.renderAt(t, o);
    window.__demo = this;
    window.__demoReady = true; window.__ready = true;
    if (!capture) this.preview();
  },

  // real-time playback of the same timeline (temporal anti-aliasing instead of accumulation)
  preview() {
    this.playing = true;
    let start = performance.now(), last = start, shot = -1;
    const loop = (now) => {
      if (!this.playing) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      let t = ((now - start) / 1000) % DEMO_LENGTH;
      this.pose(t, true);
      if (this.shotIndex !== shot) { shot = this.shotIndex; Pipeline.dirtyHistory = true; Pipeline.shadowAge = 0; }
      const cam = Pipeline.camera;
      this.world.update(cam.position.x, cam.position.z, Q.viewDist, 0, 0); this.world.applyPending(12);
      renderer.info.reset();
      Pipeline.renderFrame(dt, { viewmodel: false, effects: (d) => Effects.bind(d) });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    addEventListener('keydown', (e) => { if (e.code === 'Space') { if (this.playing) this.playing = false; else { this.playing = true; start = performance.now(); requestAnimationFrame(loop); } } });
  },

  shotAt(t) { for (let i = 0; i < this.shots.length; i++) if (t < this.shots[i].t1) return i; return this.shots.length - 1; },
  groundY(x, z, from) {
    for (let y = from; y > 2; y--) { const id = this.world.getId(Math.floor(x), y, Math.floor(z)); if (T_SOLID[id] && T_KIND[id] !== KIND.leaves && !BLOCKS[id].axis) return y + 1; }
    return null;
  },
  cameraAt(S, u) {
    const cam = Pipeline.camera;
    const k = track(S.cam, u);
    if (S.mode === 'look') {
      const tg = track(S.look, u);
      cam.position.set(k[0], k[1], k[2]);
      const dx = tg[0] - k[0], dy = tg[1] - k[1], dz = tg[2] - k[2];
      cam.rotation.set(Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(-dx, -dz), 0, 'YXZ');
      cam.fov = k[3];
      return;
    }
    let y = k[1];
    if (S.follow) {
      // ride a smoothed ground height so the glide never clips a step
      let sum = 0, n = 0;
      for (let ox = -4; ox <= 4; ox += 2) for (let oz = -2; oz <= 2; oz += 2) { const g = this.groundY(k[0] + ox, k[2] + oz, 130); if (g !== null) { sum += g; n++; } }
      y = (n ? sum / n : 78) + S.follow + k[1];
      const under = this.groundY(k[0], k[2], 130);
      if (under !== null) y = Math.max(y, under + 1.25);
    }
    cam.position.set(k[0], y, k[2]);
    // breathing handheld drift, far below the threshold of shake
    cam.rotation.set(k[4] + Math.sin(u * 7.1) * 0.0022, k[3] + Math.sin(u * 5.3 + 1.7) * 0.0026, 0, 'YXZ');
    cam.fov = k[5];
  },
  stageActors(S) {
    Creatures.reset();
    this.actors = (S.creatures || []).map((a) => ({ spec: a, c: Creatures.spawn(a.type, a.keys[0][1], 90, a.keys[0][2], a.seed) }));
  },
  poseActors(S, u, t) {
    for (const { spec, c } of this.actors) {
      const p = track(spec.keys, u), q = track(spec.keys, Math.max(0, u - 0.01)), q2 = track(spec.keys, Math.min(1, u + 0.01));
      const vx = (q2[0] - q[0]) / (0.02 * (S.t1 - S.t0)), vz = (q2[1] - q[1]) / (0.02 * (S.t1 - S.t0));
      const speed = Math.hypot(vx, vz);
      let y;
      if (spec.y) y = track(spec.y, u)[0];
      else { const g = this.groundY(p[0], p[1], 125); y = g === null ? 90 : g; }
      c.pos.set(p[0], y, p[1]);
      c.yaw = spec.yaw !== undefined && speed < 0.45 ? spec.yaw : Math.atan2(vx, vz);
      c.speedNow = speed; c.graze = spec.graze || 0; c.state = speed > 0.3 ? 'wander' : 'idle'; c.stateT = t - S.t0; c.hitT = 0;
      const travelled = Math.hypot(p[0] - spec.keys[0][1], p[1] - spec.keys[0][2]);
      c.gait = spec.seed * 100 + (c.spec.hop ? (t - S.t0) * 7.5 * clamp(speed / 2, 0, 1.6) : travelled * (c.type === 'mossback' ? 3.6 : 3.1));
      const l = this.world.getLight(Math.floor(p[0]), y + 0.8, Math.floor(p[1]));
      c.light.set(l[0], l[1], l[2], l[3]);
      c.updateBones(t + 100); c.syncMesh(); c.mesh.visible = true; c.shadow.visible = true;
    }
  },

  // place every part of the scene for film time t
  pose(t, main) {
    const i = this.shotAt(t), S = this.shots[i];
    if (i !== this.shotIndex) { this.shotIndex = i; this.stageActors(S); Effects.reset(); this.activeStrike = null; }
    const raw = clamp((t - S.t0) / (S.t1 - S.t0), 0, 1), u = easeFilm(raw);
    const val = (v, d) => (v === undefined ? d : typeof v === 'function' ? v(u) : v);
    this.cameraAt(S, u);
    const cam = Pipeline.camera; cam.updateMatrixWorld();
    const clock = 100 + t;
    U.uTime.value = clock;
    const E = Object.assign({}, ENV0, S.env), G = Object.assign({}, GRADE0, S.grade);
    const storm = val(S.storm, 0), rain = val(S.rain, 0), camSky = val(S.camSky, 1), cave = 1 - camSky;
    U.uStorm.value = storm; U.uRain.value = rain; U.uWetness.value = val(S.wet, 0); U.uPuddle.value = val(S.puddle, 0); U.uSnowCover.value = 0; U.uSnowfall.value = 0;
    U.uCloudCover.value = val(S.cover, 0.45);
    U.uCloudOffset.value.set(S.cloud[0] + S.drift[0] * (t - S.t0), S.cloud[1] + S.drift[1] * (t - S.t0));
    U.uWind.value.set(0.82, 0.57, val(S.wind, 0.6), 0);
    U.uCamSky.value = camSky;
    U.uUnderwater.value = 0;
    Pipeline.lightPass.u.uStarGain.value = val(S.stars, 1);
    {
      // the galaxy is laid across the last composition: low on the left, climbing to the upper right
      const dir = (yaw, el) => V3(-Math.sin(yaw) * Math.cos(el), Math.sin(el), -Math.cos(yaw) * Math.cos(el));
      Pipeline.lightPass.u.uGalaxy.value.crossVectors(dir(-0.38, 0.12), dir(-1.2, 0.6)).normalize();
    }
    U.uWaterColor.value.set(E.water[0], E.water[1], E.water[2]);
    U.uFogDensity.value = E.fog * (1 - cave * 0.9); U.uHaze.value = E.haze;
    U.uPlayerPos.value.set(0, -999, 0);
    const v = Pipeline.volPass.u;
    v.uVolDensity.value = E.vol * (1 - cave); v.uForestHaze.value = E.forest * (1 - cave); v.uCaveHaze.value = E.cave * cave; v.uGlow.value = E.glow; v.uVolMax.value = E.volMax;
    const hours = S.time(u);
    Game.time = hours;
    Sky.update(hours, E.albedo, main);
    // scripted exposure compensation plus the dips between shots
    const ev = S.ev ? track(S.ev, u)[0] : 0;
    const fade = sstep(0, S.fadeIn, t - S.t0) * sstep(0, S.fadeOut, S.t1 - t);
    const PG = Pipeline.grade;
    PG.tint.set(G.tint[0], G.tint[1], G.tint[2]); PG.sat = G.sat; PG.contrast = G.contrast; PG.lift.set(G.lift[0] * fade, G.lift[1] * fade, G.lift[2] * fade);
    PG.bloom = G.bloom; PG.flare = G.flare; PG.vignette = G.vignette; PG.grain = G.grain; PG.ca = G.ca; PG.sharp = G.sharp;
    PG.expComp = G.exp * Math.pow(2, ev) * fade;
    this.fade = fade; this.dofNow = S.dof ? { aperture: S.dof.aperture, focus: S.dof.focus(u) } : null;
    this.poseActors(S, u, t);
    // lightning replays from its seed whenever the frame falls inside a strike
    const st = (S.strikes || []).find((s) => t >= s.at && t < s.at + 0.75) || null;
    if (st !== this.activeStrike) { this.activeStrike = st; if (st) Effects.strike(st.at, st.from, st.to, st.seed); else Effects.strikeT = -99; }
    if (!st) Effects.strikeT = -99;
    this.world.updateGrass(cam.position);
    const lights = this.lights; lights.length = 0;
    Game.world.collectLights(cam.position.x, cam.position.y, cam.position.z, lights);
    for (const l of lights) {
      if (l.type === 0 || l.type === 5) { const s = (l.x * 7.3 + l.z * 3.1) % 6.28; l.flicker = 0.9 + Math.sin(clock * 11 + s) * 0.06 + Math.sin(clock * 23.7 + s * 2) * 0.04 + Math.sin(clock * 5.3 + s * 3) * 0.05; }
      else if (l.type === 2) l.flicker = 0.92 + Math.sin(clock * 1.7 + l.x) * 0.08;
      else if (l.type === 3) l.flicker = 0.9 + Math.sin(clock * 1.2 + l.x * 2 + l.z) * 0.1;
      else l.flicker = 1;
    }
    for (const { c } of this.actors) {
      if (c.type === 'hollowlantern') lights.push({ x: c.pos.x, y: c.pos.y + 1.35, z: c.pos.z, color: [0.55, 0.36, 1], power: 2.2 * c.emisBoost, radius: 9, type: 1, held: true });
      else if (c.type === 'gloamstalker') lights.push({ x: c.pos.x + Math.sin(c.yaw) * 0.55, y: c.pos.y + 0.9, z: c.pos.z + Math.cos(c.yaw) * 0.55, color: [1, 0.4, 0.08], power: 0.6 * c.emisBoost, radius: 4.5, type: 1, held: true });
    }
    for (const l of S.lights || []) lights.push(Object.assign({ flicker: 0.94 + Math.sin(clock * 1.9 + l.x) * 0.06, boost: 50 }, l));
    lights.sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);
    Pipeline.setLights(lights.slice());
    Effects.update(clock, 0, cam.position, this.world, Object.assign({}, NOPARTS, S.parts, { rain: rain * (S.parts && S.parts.rain ? 1 : 0) }), lights.filter((l) => !l.held));
    // Effects.update works on the film clock offset, lightning on raw film time
    Effects.updateLightning(t);
  },

  async renderAt(t, opts = {}) {
    this.playing = false;
    t = clamp(t, 0, DEMO_LENGTH - 1e-4);
    const frame = Math.round(t * 60), spp = opts.spp || this.spp;
    this.pose(t, true);
    const cam = Pipeline.camera;
    await this.world.settle(cam.position.x, cam.position.z, Q.viewDist);
    this.pose(t, true);
    const P = Pipeline, rt = P.rt;
    P.frameIndex = frame * 64; P.shadowAge = 0; P.dirtyHistory = true;
    U.uFrame.value = (frame * spp) % 1024;
    P.setCamera(0, 0);
    P.prepareSky();
    P.renderShadows(cam);
    renderer.setRenderTarget(rt.accum); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
    for (let s = 0; s < spp; s++) {
      const ts = clamp(t + ((s + 0.5) / spp - 0.5) * SHUTTER, 0, DEMO_LENGTH - 1e-4);
      // keep a shot's sub-samples inside that shot so cuts stay clean
      const S = this.shots[this.shotAt(t)];
      this.pose(clamp(ts, S.t0, S.t1 - 1e-4), false);
      P.frameIndex++;
      U.uFrame.value = (frame * spp + s) % 1024;
      const jx = halton(s + 1, 2) - 0.5, jy = halton(s + 1, 3) - 0.5;
      let dof = this.dofNow, lx = 0, ly = 0;
      if (dof) {
        const r = Math.sqrt((s + 0.5) / spp) * dof.aperture, a = s * 2.39996323;
        lx = Math.cos(a) * r; ly = Math.sin(a) * r;
        cam.position.add(V3(lx, ly, 0).applyQuaternion(cam.quaternion));
      }
      P.setCamera(jx * this.ss * 0.5, jy * this.ss * 0.5);
      if (dof) {
        // shear the frustum so the focal plane stays put while the lens moves
        const e = cam.projectionMatrix.elements;
        e[8] -= (lx * e[0]) / dof.focus; e[9] -= (ly * e[5]) / dof.focus;
        cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
        P.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); P.invViewProj.copy(P.viewProj).invert();
      }
      P.renderScene({ temporal: false, viewmodel: false, effects: (d) => Effects.bind(d) });
      P.accumPass.u.uSrc.value = rt.comp.texture; P.accumPass.render(rt.accum);
    }
    P.resolvePass.u.uSrc.value = rt.accum.texture; P.resolvePass.render(rt.taa[0]);
    // grade and exposure come from the centre of the frame
    this.pose(t, false);
    P.setCamera(0, 0);
    const bloom = P.exposureAndBloom(rt.taa[0].texture, 0, true);
    P.present(rt.taa[0].texture, bloom, { grainSeed: frame % 1024 });
    return { t, frame, shot: this.shotIndex };
  },
  pixels() {
    const gl = renderer.getContext();
    if (!this._px) this._px = new Uint8Array(1920 * 1080 * 4);
    renderer.setRenderTarget(null);
    gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, this._px);
    return this._px;
  },
};

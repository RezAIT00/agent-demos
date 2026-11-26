// ================================================================ game state, environment, saving and input
const SAVE_KEY = 'ashlar.save.v1';
const TITLE_VIEW = { seed: 4242, pos: [-200, 117, 250], yaw: 0.6, pitch: -0.19, time: 7.45 };
const WEATHER = {
  clear: { cover: 0.4, rain: 0, storm: 0, wind: 0.5, next: [['clear', 0.35], ['cloudy', 0.65]], dur: [150, 340] },
  cloudy: { cover: 0.6, rain: 0, storm: 0, wind: 0.72, next: [['clear', 0.5], ['rain', 0.3], ['storm', 0.2]], dur: [90, 220] },
  rain: { cover: 0.8, rain: 0.68, storm: 0.55, wind: 0.85, next: [['cloudy', 0.7], ['storm', 0.3]], dur: [70, 170] },
  storm: { cover: 0.94, rain: 1.0, storm: 1.0, wind: 1.45, next: [['rain', 0.45], ['cloudy', 0.55]], dur: [60, 130] },
};

const Game = {
  state: 'title', pool: null, world: null, player: null, time: 7.4, day: 1, mode: 'survival', biome: 3,
  chests: new Map(), furnaces: new Map(), stats: { broken: 0, placed: 0, crafted: 0, kills: 0 },
  weather: { kind: 'clear', timer: 220, rain: 0, snow: 0, storm: 0, wet: 0, puddle: 0, snowCover: 0, cover: 0.4, wind: 0.5, nextStrike: 4 },
  env: { cave: 0, enclosed: 0, river: 0, surf: 0, fire: 0, lava: 0, probeT: 0, camSky: 1, humid: 0, cold: 0 },
  lights: [], clock: 0, autosaveT: 0, hideHud: false, testMode: QS.get('test') === '1',

  // ---------------------------------------------------------------- world lifecycle
  disposeWorld() {
    if (this.world) this.world.dispose();
    Entities.reset(); Creatures.reset(); Effects.reset();
    this.world = null; this.player = null; this.chests.clear(); this.furnaces.clear();
  },
  createWorld(seed, features) {
    this.disposeWorld();
    this.world = new World(this.pool, seed, features || {});
    this.world.onEntities = (c, list) => Entities.setChunk(c, list);
    Pipeline.dirtyHistory = true; Pipeline.shadowAge = 0;
  },
  seedFrom(text) {
    const s = String(text || '').trim();
    if (!s) return (Math.random() * 0xffffffff) >>> 0;
    if (/^\d+$/.test(s)) return Number(s) >>> 0;
    let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  },
  showTitle() {
    this.state = 'title'; this.releaseMouse();
    if (!this.world || this.world.seed !== TITLE_VIEW.seed || this.player) this.createWorld(TITLE_VIEW.seed);
    this.time = TITLE_VIEW.time; this.setWeather('clear', true);
    const cam = Pipeline.camera; cam.position.fromArray(TITLE_VIEW.pos); cam.rotation.order = 'YXZ'; cam.rotation.set(TITLE_VIEW.pitch, TITLE_VIEW.yaw, 0); cam.fov = 66;
    UI.showTitle(this);
  },
  findSpawn(gen) {
    for (let r = 0; r < 3000; r += 14) {
      const steps = Math.max(1, Math.floor((r * 6.28) / 26));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * 6.283 + r;
        const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
        const c = gen.col(x, z);
        if (![BIOME.MEADOW, BIOME.FOREST, BIOME.GROVE].includes(c.biome) || c.h < SEA + 3 || c.h > SEA + 34 || c.river > 0.02 || c.lake > 0.02) continue;
        if ([[6, 0], [-6, 0], [0, 6], [0, -6]].every(([dx, dz]) => Math.abs(gen.col(x + dx, z + dz).h - c.h) < 3.4)) return [x, z];
      }
    }
    return [0, 0];
  },
  // an open patch of ground near the preferred column
  safeStand(x, z) {
    const w = this.world;
    for (let r = 0; r < 24; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const bx = x + dx, bz = z + dz;
      for (let y = Math.min(WORLD_H - 3, w.gen.topSolid(bx, bz) + 3); y > SEA; y--) {
        const below = w.getId(bx, y - 1, bz);
        if (!T_SOLID[below]) continue;
        if (T_KIND[below] === KIND.leaves || BLOCKS[below].axis) break;
        let open = true; for (let k = 0; k < 4; k++) { const id = w.getId(bx, y + k, bz); if (T_SOLID[id] || id === B.water) open = false; }
        if (open) return V3(bx + 0.5, y, bz + 0.5);
        break;
      }
    }
    return V3(x + 0.5, w.surfaceY(x, z) + 2, z + 0.5);
  },
  async enterWorld(spawnXZ, saved) {
    UI.showBusy('cutting terrain…');
    const px = saved ? saved.player.pos[0] : spawnXZ[0], pz = saved ? saved.player.pos[2] : spawnXZ[1];
    const near = Math.min(5, Q.viewDist);
    const startT = performance.now();
    for (;;) {
      this.world.update(px, pz, near, 0, 0); this.world.applyPending(60);
      let ready = true;
      for (let dz = -2; dz <= 2 && ready; dz++) for (let dx = -2; dx <= 2; dx++) { const c = this.world.chunk((Math.floor(px) >> 4) + dx, (Math.floor(pz) >> 4) + dz); if (!c || !c.meshed) { ready = false; break; } }
      if (ready || performance.now() - startT > 30000) break;
      await sleep(16);
    }
  },
  async startNew(seedText, mode) {
    Audio.init();
    if (this.starting) return; this.starting = true;
    const seed = this.seedFrom(seedText);
    this.state = 'loading';
    this.createWorld(seed);
    const [sx, sz] = this.findSpawn(this.world.gen);
    await this.enterWorld([sx, sz]);
    this.mode = mode;
    const p = this.player = new Player();
    p.mode = mode; p.pos.copy(this.safeStand(sx, sz)); p.spawn.copy(p.pos);
    // look toward the highest ground on the horizon
    let best = 0, bh = -1e9;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; const h = this.world.gen.column(p.pos.x - Math.sin(a) * 180, p.pos.z - Math.cos(a) * 180, {}).h; if (h > bh) { bh = h; best = a; } }
    p.yaw = p.camYaw = best; p.pitch = p.camPitch = -0.03;
    if (mode === 'creative') ['stone_bricks', 'oak_planks', 'oak_log', 'glass', 'torch', 'lamp', 'door', 'cobble', 'oak_leaves'].forEach((k, i) => { p.inventory.slots[i] = { k, n: 64 }; });
    else { p.inventory.add('torch', 8); p.inventory.add('apple', 4); }
    this.time = 7.6; this.day = 1; this.stats = { broken: 0, placed: 0, crafted: 0, kills: 0 };
    this.setWeather('clear', true);
    this.starting = false;
    this.begin();
    UI.hint.textContent = mode === 'survival' ? 'Punch a tree for logs · E to craft\nPlanks → sticks → Joiner’s Bench → tools\nTorches keep the night creatures away' : 'E opens the block palette · F toggles flight\nT fast-forwards time · J changes the weather';
    UI.hint.style.opacity = 1; this.hintT = 22;
  },
  async continueGame() {
    Audio.init();
    const d = this.readSave(); if (!d || this.starting) return; this.starting = true;
    this.state = 'loading';
    this.createWorld(d.seed);
    this.world.loadEdits(d.edits);
    await this.enterWorld(null, d);
    this.player = new Player(); this.player.load(d.player); this.mode = d.player.mode;
    this.time = d.time; this.day = d.day; this.stats = d.stats || this.stats;
    for (const [k, slots] of d.chests) { const inv = new Inventory(27); inv.load(slots); this.chests.set(k, inv); }
    for (const [k, f] of d.furnaces) { const inv = new Inventory(3); inv.load(f.slots); this.furnaces.set(k, { slots: inv.slots, burn: f.burn, burnMax: f.burnMax, progress: f.progress, lit: false }); }
    this.setWeather(d.weather || 'clear', true);
    this.starting = false;
    this.begin();
  },
  begin() { UI.clearLayer(); UI.screen = null; UI.setHUD(true); this.state = 'playing'; Pipeline.dirtyHistory = true; this.captureMouse(); UI.lastBiome = -1; },
  resume() { UI.clearLayer(); UI.screen = null; this.state = 'playing'; this.captureMouse(); },
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.player.keys.clear(); this.player.mouse.left = this.player.mouse.right = false; UI.showPause(this); this.releaseMouse(); },
  closeScreen() { UI.closeScreen(); this.state = 'playing'; this.captureMouse(); },
  captureMouse() { if (this.testMode) return; try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* pointer lock refused */ } },
  releaseMouse() { if (document.pointerLockElement) document.exitPointerLock(); },
  onDeath() { this.state = 'dead'; this.releaseMouse(); UI.showDeath(this, this.player.deathCause); },
  respawn() { this.player.respawn(); for (const c of [...Creatures.list]) if (c.spec.hostile) { c.dispose(); Creatures.list.splice(Creatures.list.indexOf(c), 1); } this.begin(); },
  damagePlayer(n, from) { this.player.damage(n, this, from, 'creature'); },

  // ---------------------------------------------------------------- containers
  getChest(pos) {
    let c = this.chests.get(pos);
    if (c) return c;
    c = new Inventory(27); this.chests.set(pos, c);
    const [x, y, z] = pos.split(',').map(Number);
    const edits = this.world.edits.get(chunkKey(x >> 4, z >> 4));
    if (!edits || !edits.has(bidx(x & 15, y, z & 15))) {
      // chests that were part of a settlement hold supplies
      const r = mulberry32(ihash(x, y, z, this.world.seed));
      const loot = [['torch', 4, 12], ['apple', 1, 5], ['coal', 3, 10], ['iron_ingot', 1, 4], ['copper_ingot', 2, 6], ['oak_planks', 6, 24], ['stick', 4, 12], ['roast_meat', 1, 3], ['stone_pick', 1, 1], ['iron_blade', 1, 1], ['glass', 2, 9], ['skyglass', 1, 2]];
      const n = 4 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) { const [k, lo, hi] = loot[Math.floor(r() * (i === 0 ? 4 : loot.length))]; const at = Math.floor(r() * 27); if (!c.slots[at]) { c.slots[at] = { k, n: lo + Math.floor(r() * (hi - lo + 1)) }; if (ITEMS[k].durability) c.slots[at].d = ITEMS[k].durability; } }
    }
    return c;
  },
  getFurnace(pos) { let f = this.furnaces.get(pos); if (!f) { f = { slots: [null, null, null], burn: 0, burnMax: 0, progress: 0, lit: false }; this.furnaces.set(pos, f); } return f; },
  removeContainer(pos, center) {
    const v = this.world.getId(...pos.split(',').map(Number));
    const spill = (slots) => { for (const s of slots) if (s) Entities.spawnDrop(s.k, s.n, center, null, 0.5, s.d); };
    if (v === B.chest) { spill(this.getChest(pos).slots); this.chests.delete(pos); Entities.openChests.delete(pos); }
    const f = this.furnaces.get(pos); if (f) { spill(f.slots); this.furnaces.delete(pos); }
  },
  tickFurnaces(dt) {
    for (const [pos, f] of this.furnaces) {
      tickFurnace(f, dt);
      const lit = f.burn > 0;
      const [x, y, z] = pos.split(',').map(Number);
      const v = this.world.getBlock(x, y, z);
      if ((v & 255) !== B.furnace) continue;
      if ((((v >> 8) & 4) !== 0) !== lit) this.world.setBlock(x, y, z, B.furnace | ((((v >> 8) & 3) | (lit ? 4 : 0)) << 8), { noPhysics: true });
    }
  },

  // ---------------------------------------------------------------- persistence
  save() {
    if (!this.player || !this.world || this.state === 'title' || DEMO) return;
    const data = {
      v: 1, seed: this.world.seed, time: this.time, day: this.day, weather: this.weather.kind, stats: this.stats, player: this.player.serialize(), edits: this.world.serializeEdits(),
      chests: [...this.chests].map(([k, c]) => [k, c.serialize()]),
      furnaces: [...this.furnaces].map(([k, f]) => { const inv = new Inventory(3); inv.slots = f.slots; return [k, { slots: inv.serialize(), burn: f.burn, burnMax: f.burnMax, progress: f.progress }]; }),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { UI.toast('Could not save: browser storage is unavailable or full'); return false; }
  },
  readSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); return d && d.v === 1 ? d : null; } catch (e) { return null; } },
  peekSave() { const d = this.readSave(); return d ? { mode: d.player.mode, day: d.day } : null; },

  // ---------------------------------------------------------------- weather and environment
  setWeather(kind, instant) {
    const w = this.weather, P = WEATHER[kind];
    w.kind = kind; w.timer = P.dur[0] + Math.random() * (P.dur[1] - P.dur[0]);
    if (instant) { w.cover = P.cover; w.rain = P.rain; w.storm = P.storm; w.wind = P.wind; w.snow = 0; w.wet = P.rain; w.puddle = P.rain; w.snowCover = 0; }
  },
  updateWeather(dt) {
    const w = this.weather;
    w.timer -= dt;
    if (w.timer <= 0) { let r = Math.random(), next = 'clear'; for (const [k, p] of WEATHER[w.kind].next) { r -= p; if (r <= 0) { next = k; break; } } this.setWeather(next, false); }
    const P = WEATHER[w.kind], cam = Pipeline.camera.position;
    const col = this.world.gen.col(Math.floor(cam.x), Math.floor(cam.z));
    const cold = col.temp - Math.max(0, col.h - SEA - 38) * 0.004 < -0.24 || cam.y > 150;
    const dry = col.desert > 0.5;
    const ease = (v, t, rate) => v + clamp(t - v, -rate * dt, rate * dt);
    w.cover = ease(w.cover, dry ? Math.min(P.cover, P.storm > 0 ? 0.7 : 0.3) : P.cover, 0.035);
    w.storm = ease(w.storm, dry ? P.storm * 0.3 : cold ? P.storm * 0.6 : P.storm, 0.06);
    w.rain = ease(w.rain, cold || dry ? 0 : P.rain, 0.09);
    w.snow = ease(w.snow, cold ? Math.max(P.rain, P.cover > 0.55 ? 0.25 : 0) : 0, 0.09);
    w.wind = ease(w.wind, P.wind, 0.08);
    w.wet = clamp(w.wet + (w.rain > 0.15 ? w.rain * dt / 22 : -dt / 90), 0, 1);
    w.puddle = clamp(w.puddle + (w.rain > 0.3 ? w.rain * dt / 45 : -dt / 160), 0, 1);
    w.snowCover = clamp(w.snowCover + (w.snow > 0.3 ? dt / 70 : cold ? -dt / 600 : -dt / 40), 0, 0.85);
    this.env.cold = cold ? 1 : 0;
    // lightning
    if (w.storm > 0.75 && w.rain > 0.5) {
      w.nextStrike -= dt;
      if (w.nextStrike <= 0) {
        w.nextStrike = 4 + Math.random() * 11;
        const a = Math.random() * 6.283, d = 50 + Math.random() * 360;
        const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
        const ground = Math.max(SEA, this.world.roofAt(x, z) || this.world.gen.column(x, z, {}).h);
        Effects.strike(this.clock, [x + (Math.random() - 0.5) * 60, CB_Y + 30, z + (Math.random() - 0.5) * 60], [x, ground, z], (Math.random() * 1e9) | 0);
        Audio.thunder(d);
      }
    }
  },
  // look around the camera for cover, water and fire; drives sound and reverb
  probe(dt) {
    const E = this.env;
    E.probeT -= dt; if (E.probeT > 0) return;
    E.probeT = 0.35;
    const w = this.world, c = Pipeline.camera.position;
    let hits = 0;
    const dirs = [[0, 1, 0], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7], [1, 0.1, 0], [-1, 0.1, 0], [0, 0.1, 1], [0, 0.1, -1], [0.5, 0.85, 0.2], [-0.2, 0.85, -0.5]];
    for (const d of dirs) if (w.raycast(c, V3(d[0], d[1], d[2]).normalize(), 18)) hits++;
    const l = w.getLight(Math.floor(c.x), c.y, Math.floor(c.z));
    const roofed = w.roofAt(c.x, c.z) > c.y + 1;
    E.enclosedT = hits >= 8 && roofed ? 1 : roofed ? 0.55 : 0;
    E.caveT = l[3] < 0.2 && hits >= 6 ? 1 : l[3] < 0.45 && c.y < SEA - 4 ? 0.6 : 0;
    let water = 0, ocean = 0, lava = 0;
    for (let i = 0; i < 40; i++) {
      const a = i * 2.39996, r = 2 + (i / 40) * 20;
      const x = Math.floor(c.x + Math.cos(a) * r), z = Math.floor(c.z + Math.sin(a) * r);
      const col = w.gen.col(x, z);
      if (col.h < SEA - 0.5 && Math.abs(c.y - SEA) < 24) { if (col.cont < -0.06) ocean += 1 - r / 24; else water += (1 - r / 24) * (col.river > 0.2 ? 1.5 : 0.5); }
    }
    for (const lt of this.lights) { const d2 = (lt.x - c.x) ** 2 + (lt.y - c.y) ** 2 + (lt.z - c.z) ** 2; if (lt.type === 2) lava = Math.max(lava, 1 - Math.sqrt(d2) / 16); }
    let fire = 0; for (const lt of this.lights) if (lt.type === 5 || lt.type === 0) { const d = Math.hypot(lt.x - c.x, lt.y - c.y, lt.z - c.z); fire = Math.max(fire, (lt.type === 5 ? 1 : 0.28) * (1 - d / (lt.type === 5 ? 12 : 6))); }
    E.riverT = clamp(water / 6, 0, 1); E.surfT = clamp(ocean / 5, 0, 1); E.lavaT = clamp(lava, 0, 1); E.fireT = clamp(fire, 0, 1);
  },
  // everything that sets the look of the frame
  applyEnvironment(dt, snap) {
    const cam = Pipeline.camera.position, w = this.world, W = this.weather, E = this.env;
    const k = snap ? 1 : 1 - Math.exp(-dt * 1.6);
    for (const n of ['enclosed', 'cave', 'river', 'surf', 'lava', 'fire']) E[n] = lerp(E[n] || 0, E[n + 'T'] || 0, snap ? 1 : 1 - Math.exp(-dt * 2.4));
    const col = w.gen.col(Math.floor(cam.x), Math.floor(cam.z));
    this.biome = col.biome;
    const l = w.getLight(Math.floor(cam.x), cam.y, Math.floor(cam.z));
    const skyT = cam.y > SEA + 40 ? 1 : sstep(0.04, 0.55, l[3]);
    U.uCamSky.value = lerp(U.uCamSky.value, skyT, snap ? 1 : 1 - Math.exp(-dt * 2));
    const cave = 1 - U.uCamSky.value;
    U.uCloudCover.value = W.cover; U.uStorm.value = W.storm; U.uRain.value = W.rain; U.uWetness.value = W.wet; U.uPuddle.value = W.puddle; U.uSnowCover.value = W.snowCover;
    U.uWind.value.z = W.wind;
    const underId = w.getId(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z));
    const under = underId === B.water || underId === B.kelp || underId === B.seagrass;
    if (under !== (U.uUnderwater.value > 0.5)) Pipeline.dirtyHistory = true;
    U.uUnderwater.value = under ? 1 : 0;
    const waterCol = col.biome === BIOME.REEF ? [0.008, 0.115, 0.115] : col.biome === BIOME.SWAMP ? [0.026, 0.044, 0.01] : col.biome === BIOME.OCEAN ? [0.003, 0.042, 0.074] : [0.006, 0.068, 0.066];
    const wc = U.uWaterColor.value; wc.set(lerp(wc.x, waterCol[0], k), lerp(wc.y, waterCol[1], k), lerp(wc.z, waterCol[2], k));
    const albedo = col.desert > 0.5 ? [0.34, 0.2, 0.1] : col.biome === BIOME.TAIGA || E.cold ? [0.55, 0.58, 0.62] : col.biome === BIOME.OCEAN || col.biome === BIOME.REEF ? [0.03, 0.06, 0.08] : col.biome === BIOME.BEACH ? [0.26, 0.2, 0.12] : [0.1, 0.12, 0.05];
    Sky.update(this.time, albedo);
    const morning = sstep(4.8, 6.4, this.time) * sstep(11.0, 8.2, this.time);
    const wooded = col.biome === BIOME.FOREST || col.biome === BIOME.GROVE || col.biome === BIOME.TAIGA ? 1 : col.biome === BIOME.SWAMP ? 1.5 : 0.15;
    const v = Pipeline.volPass.u;
    const setLerp = (u, t) => { u.value = lerp(u.value, t, k); };
    setLerp(v.uVolDensity, (0.0011 + morning * 0.0013 + W.rain * 0.0022 + (col.biome === BIOME.SWAMP ? 0.0035 : 0) + W.snow * 0.003) * (1 - cave) * (col.desert > 0.5 ? 0.5 : 1));
    setLerp(v.uForestHaze, wooded * (0.0009 + morning * 0.0036) * (1 - cave));
    setLerp(v.uCaveHaze, cave * (0.0028 + E.lava * 0.0028));
    v.uGlow.value = 0.0016 + cave * 0.0008 + U.uNight.value * 0.001 + W.rain * 0.002;
    v.uVolMax.value = lerp(96, 150, 1 - wooded * 0.4);
    U.uFogDensity.value = lerp(U.uFogDensity.value, 0.00055 + morning * 0.0011 + W.rain * 0.0019 + W.snow * 0.0035 + (col.biome === BIOME.SWAMP ? 0.0018 : 0), k);
    U.uHaze.value = 1 + morning * 0.6;
    // grade by hour and weather
    const G = Pipeline.grade, sunY = U.uSunDir.value.y;
    const golden = sstep(0.34, 0.05, sunY) * sstep(-0.08, 0.04, sunY), night = U.uNight.value;
    G.tint.set(1 + golden * 0.045 - night * 0.09 - W.storm * 0.035, 1 - golden * 0.004 - night * 0.025, 1 - golden * 0.065 + night * 0.09 + W.storm * 0.025);
    G.sat = 1.0 + golden * 0.05 - night * 0.14 - W.storm * 0.16;
    G.contrast = 1.035 + cave * 0.035 + golden * 0.01;
    G.lift.set(0.003 + night * 0.0, 0.004 + night * 0.002, 0.007 + night * 0.008);
    G.expComp = lerp(1.04, 0.86, night * (1 - cave)) * (1 - W.storm * 0.1) * (under ? 1.05 : 1);
    G.bloom = 0.042 + cave * 0.018 + night * 0.012 + W.rain * 0.012;
  },
  advanceSky(dt) {
    const off = U.uCloudOffset.value, wind = U.uWind.value;
    off.x += wind.x * wind.z * dt * 5.5; off.y += wind.y * wind.z * dt * 5.5;
  },
  ambienceEnv() {
    const E = this.env, W = this.weather, bio = this.biome, c = Pipeline.camera.position;
    return {
      pos: c, yaw: this.player ? this.player.yaw : 0, underwater: U.uUnderwater.value > 0.5, cave: E.cave, enclosed: E.enclosed, river: E.river, surf: E.surf, fire: E.fire, lava: E.lava,
      rain: W.rain, storm: W.storm, night: U.uNight.value, swamp: bio === BIOME.SWAMP ? 1 : 0,
      birds: bio === BIOME.FOREST || bio === BIOME.GROVE ? 1 : bio === BIOME.MEADOW || bio === BIOME.SWAMP ? 0.6 : bio === BIOME.TAIGA ? 0.3 : 0.1,
      warm: bio === BIOME.TAIGA || E.cold ? 0 : bio === BIOME.DESERT || bio === BIOME.MESA ? 0.6 : 1,
    };
  },
  particleEnv() {
    const E = this.env, W = this.weather, bio = this.biome, night = U.uNight.value, dry = 1 - Math.min(1, W.rain * 3), open = U.uCamSky.value;
    const wooded = bio === BIOME.FOREST || bio === BIOME.GROVE || bio === BIOME.SWAMP;
    const lowSun = sstep(0.62, 0.12, U.uSunDir.value.y) * sstep(-0.02, 0.06, U.uSunDir.value.y);
    return {
      motes: ((wooded ? 0.55 + lowSun * 0.9 : lowSun * 0.35) * dry * open + E.cave * 0.12) * (Pipeline.camera.position.y - this.world.roofAt(Pipeline.camera.position.x, Pipeline.camera.position.z) < 9 ? 1 : 0),
      fireflies: sstep(0.5, 0.9, night) * (wooded || bio === BIOME.MEADOW ? 1 : 0) * dry * open,
      leaves: bio === BIOME.FOREST || bio === BIOME.SWAMP ? open : 0,
      petals: bio === BIOME.GROVE ? open : 0,
      butterflies: (bio === BIOME.MEADOW || bio === BIOME.GROVE) ? (1 - night) * dry * open : 0,
      rain: W.rain, snowfall: W.snow,
    };
  },
  gatherLights(t) {
    const cam = Pipeline.camera.position, out = this.lights;
    out.length = 0;
    this.world.collectLights(cam.x, cam.y, cam.z, out);
    for (const l of out) {
      if (l.type === 0 || l.type === 5) { const s = (l.x * 7.3 + l.z * 3.1) % 6.28; l.flicker = 0.9 + Math.sin(t * 11 + s) * 0.06 + Math.sin(t * 23.7 + s * 2) * 0.04 + Math.sin(t * 5.3 + s * 3) * 0.05; }
      else if (l.type === 2) l.flicker = 0.92 + Math.sin(t * 1.7 + l.x) * 0.08;
      else if (l.type === 3) l.flicker = 0.9 + Math.sin(t * 1.2 + l.x * 2 + l.z) * 0.1;
      else l.flicker = 1;
    }
    for (const c of Creatures.list) {
      if (c.type === 'hollowlantern' && c.state !== 'dying') out.push({ x: c.pos.x, y: c.pos.y + 1.35, z: c.pos.z, color: [0.55, 0.36, 1], power: 1.7 * c.emisBoost, radius: 8, type: 1, held: true });
      else if (c.type === 'gloamstalker' && c.state !== 'dying') out.push({ x: c.pos.x + Math.sin(c.yaw) * 0.55, y: c.pos.y + 0.9, z: c.pos.z + Math.cos(c.yaw) * 0.55, color: [1, 0.4, 0.08], power: 0.55 * c.emisBoost, radius: 4.5, type: 1, held: true });
    }
    return out;
  },

  // ---------------------------------------------------------------- per frame
  tick(dt) {
    const w = this.world;
    if (!w) return;
    const cam = Pipeline.camera, simulate = this.state === 'playing' || this.state === 'screen' || this.state === 'dead';
    const frozen = this.state === 'paused';
    if (!frozen) { this.clock += dt; U.uTime.value = this.clock; this.advanceSky(dt); }
    if (this.state === 'title' || !this.player) {
      if (this.state === 'title') { cam.rotation.set(TITLE_VIEW.pitch + Math.sin(this.clock * 0.05) * 0.015, TITLE_VIEW.yaw + Math.sin(this.clock * 0.031) * 0.34, 0); cam.position.set(TITLE_VIEW.pos[0], TITLE_VIEW.pos[1] + Math.sin(this.clock * 0.07) * 1.2, TITLE_VIEW.pos[2]); }
    }
    const p = this.player;
    const center = p && this.state !== 'loading' ? p.pos : cam.position;
    const dirx = p ? -Math.sin(p.yaw) : -Math.sin(cam.rotation.y), dirz = p ? -Math.cos(p.yaw) : -Math.cos(cam.rotation.y);
    if (simulate && p) {
      this.time += (dt * 24) / (Settings.dayLength * 60);
      if (p.keys.has('KeyT') && p.mode === 'creative') this.time += dt * 2.2;
      if (this.time >= 24) { this.time -= 24; this.day++; }
      p.update(dt, this);
      w.tickPhysics(dt, (x, y, z, id) => Entities.spawnFalling(x, y, z, id), (x, y, z, id) => { Entities.burst(w, V3(x + 0.5, y + 0.4, z + 0.5), id, 6); const d = BLOCKS[id].drop; if (d && p.mode === 'survival') { const key = d.startsWith('item:') ? DROP_ALIAS[d.slice(5)] || d.slice(5) : d; if (ITEMS[key]) Entities.spawnDrop(key, 1, V3(x + 0.5, y + 0.4, z + 0.5)); } });
      this.tickFurnaces(dt);
      Entities.update(dt, w, p, p.inventory, () => Audio.play('pickup', 0.7));
      Creatures.update(dt, this.clock, this);
      p.applyCamera(cam, dt, this.clock);
      this.autosaveT += dt; if (this.autosaveT > 45 && !p.dead) { this.autosaveT = 0; this.save(); }
      if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) UI.hint.style.opacity = 0; }
    }
    if (p) {
      w.update(center.x, center.z, Q.viewDist, dirx, dirz);
    } else w.update(cam.position.x, cam.position.z, Q.viewDist, dirx, dirz);
    w.applyPending(this.state === 'loading' ? 24 : 3);
    cam.updateMatrixWorld();
    if (!frozen && this.state !== 'loading') this.updateWeather(dt);
    this.probe(dt);
    this.applyEnvironment(dt, false);
    w.updateGrass(cam.position);
    U.uPlayerPos.value.copy(p ? p.pos : V3(0, -999, 0));
    const lights = this.gatherLights(this.clock);
    let held = null;
    if (p && this.state !== 'title') {
      Viewmodel.update(frozen ? 0 : dt, this.clock, p, w, cam);
      held = Viewmodel.heldLight(p, cam);
    }
    const all = held ? lights.concat([held]) : lights.slice();
    Pipeline.setLights(all);
    Effects.update(this.clock, frozen ? 0 : dt, cam.position, w, this.particleEnv(), lights);
    Audio.update(dt, this.ambienceEnv());
  },
  render(dt) {
    const p = this.player;
    const vm = !!p && !p.dead && !this.hideHud && this.state !== 'title' && this.state !== 'loading';
    Pipeline.renderFrame(dt, { viewmodel: vm, effects: (d) => Effects.bind(d) });
  },

  // ---------------------------------------------------------------- input
  bindInput(canvas) {
    this.canvas = canvas;
    addEventListener('keydown', (e) => {
      const p = this.player;
      if (e.code === 'F3') { UI.debug = !UI.debug; e.preventDefault(); return; }
      if (e.code === 'F1') { this.hideHud = !this.hideHud; UI.setHUD(!this.hideHud && !!p); e.preventDefault(); return; }
      if (this.state === 'screen') { if (e.code === 'KeyE' || e.code === 'Escape') { this.closeScreen(); e.preventDefault(); } return; }
      if (this.state === 'paused') { if (e.code === 'Escape') { if (UI.screen === 'pause') this.resume(); else UI.showPause(this); } return; }
      if (this.state !== 'playing' || !p) return;
      if (['Space', 'Tab', 'ControlLeft'].includes(e.code) || e.ctrlKey) e.preventDefault();
      if (e.repeat) return;
      p.keys.add(e.code);
      p.onKey(e.code, performance.now() / 1000);
      if (e.code === 'KeyE') { p.keys.clear(); p.mouse.left = p.mouse.right = false; UI.openInventory(); }
      else if (/^Digit[1-9]$/.test(e.code)) p.selected = Number(e.code.slice(5)) - 1;
      else if (e.code === 'KeyQ') { const s = p.held; if (s) { Entities.spawnDrop(s.k, 1, p.eyePos().addScaledVector(p.lookDir(), 0.4), p.lookDir().multiplyScalar(5).add(V3(0, 1.4, 0)), 1.1, s.d); p.inventory.take(p.selected, 1); Viewmodel.swing(); } }
      else if (e.code === 'KeyJ') { const order = ['clear', 'cloudy', 'rain', 'storm']; this.setWeather(order[(order.indexOf(this.weather.kind) + 1) % 4], false); UI.toast('Weather turning ' + this.weather.kind); }
      else if (e.code === 'Escape') this.pause();
    });
    addEventListener('keyup', (e) => { if (this.player) this.player.keys.delete(e.code); });
    addEventListener('blur', () => { if (this.player) { this.player.keys.clear(); this.player.mouse.left = this.player.mouse.right = false; } });
    canvas.addEventListener('mousedown', (e) => {
      Audio.init();
      const p = this.player;
      if (this.state !== 'playing' || !p) return;
      if (!document.pointerLockElement && !this.testMode) { this.captureMouse(); return; }
      if (e.button === 0) { p.mouse.left = true; p.attackCd = Math.min(p.attackCd, 0.05); }
      if (e.button === 2) { p.mouse.right = true; p.useCd = 0; }
      if (e.button === 1 && p.target && p.mode === 'creative') {
        const key = BLOCKS[p.target.id].key;
        if (ITEMS[key]) { const at = p.inventory.slots.findIndex((s, i) => i < 9 && s && s.k === key); if (at >= 0) p.selected = at; else p.inventory.slots[p.selected] = { k: key, n: 64 }; p.inventory.version++; }
        e.preventDefault();
      }
    });
    addEventListener('mouseup', (e) => { const p = this.player; if (!p) return; if (e.button === 0) p.mouse.left = false; if (e.button === 2) p.mouse.right = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => { if (this.state === 'playing' && this.player && (document.pointerLockElement === canvas || this.testMode)) this.player.look(e.movementX || 0, e.movementY || 0); });
    addEventListener('wheel', (e) => { if (this.state === 'playing' && this.player) this.player.selected = (this.player.selected + (e.deltaY > 0 ? 1 : 8)) % 9; }, { passive: true });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.state === 'playing' && !this.testMode) this.pause(); });
    addEventListener('beforeunload', () => { if (this.player && this.state !== 'title') this.save(); });
  },

  // ---------------------------------------------------------------- graphics settings
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(320, Math.round(innerWidth * dpr)), ch = Math.max(200, Math.round(innerHeight * dpr));
    const budget = Q.name === 'ultra' ? 3840 * 2160 : Q.name === 'high' ? 1920 * 1080 : Q.name === 'medium' ? 1920 * 1080 : 1600 * 900;
    const outK = Math.min(1, Math.sqrt((Math.max(budget, 1920 * 1080)) / (cw * ch)));
    const ow = Math.round(cw * outK), oh = Math.round(ch * outK);
    const k = Math.min(Q.renderScale, Math.sqrt(budget / (ow * oh)));
    renderer.setSize(ow, oh, false);
    Pipeline.resize(ow * k, oh * k, ow, oh);
  },
  async applyGraphics() {
    const prevScreen = UI.screen;
    UI.showBusy('re-cutting materials…');
    await sleep(30);
    applyQuality();
    if (Q.texSize !== Materials.texSize) { await Materials.bake(this.pool, Q.texSize, () => {}); Icons.cache.clear(); }
    Pipeline.applyQuality();
    this.resize();
    if (this.world) {
      this.world.clump = grassClumpGeometry(Q.name === 'ultra' ? 12 : Q.name === 'high' ? 10 : Q.name === 'medium' ? 8 : 6);
      for (const c of this.world.chunks.values()) if (c.meshed) c.dirty = true;
      for (const m of this.world.lod) { for (const t of m.values()) this.world._freeLod(t); m.clear(); }
      this.world.ringKey = '';
    }
    UI.screen = prevScreen;
  },
};

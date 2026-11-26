// ================================================================ first person controller, interaction and survival
const REACH = 5.0;
const SOIL = new Set([B.grass, B.dirt, B.forest_floor, B.mud, B.snowy_grass, B.moss_block]);
const DROP_ALIAS = { mushroom: 'mushroom_food' };

class Player {
  constructor() {
    this.pos = V3(0, 100, 0); this.vel = V3(); this.yaw = 0; this.pitch = 0; this.camYaw = 0; this.camPitch = 0;
    this.mode = 'survival'; this.flying = false; this.crouching = false; this.sprinting = false; this.onGround = false; this.inWater = false; this.headWater = false; this.onLadder = false;
    this.health = 20; this.hunger = 20; this.air = 10; this.dead = false; this.hurtT = 0; this.invulnT = 0;
    this.inventory = new Inventory(36); this.selected = 0;
    this.eye = 1.62; this.bobPhase = 0; this.bobAmt = 0; this.landOff = 0; this.landVel = 0; this.stepOff = 0; this.fovKick = 0; this.roll = 0; this.hurtRoll = 0;
    this.peakY = null; this.spawn = V3(0, 100, 0);
    this.keys = new Set(); this.mouse = { left: false, right: false }; this.lookDX = 0; this.lookDY = 0;
    this.mining = null; this.attackCd = 0; this.useCd = 0; this.eatT = 0; this.regenT = 0; this.starveT = 0; this.hazardT = 0; this.lastSpace = -1; this.lastW = -1; this.digT = 0;
    this.target = null;
  }
  get held() { return this.inventory.slots[this.selected]; }
  get heldDef() { const s = this.held; return s ? ITEMS[s.k] : null; }
  get height() { return this.crouching ? 1.48 : 1.8; }
  eyePos() { return V3(this.pos.x, this.pos.y + this.eye + this.stepOff, this.pos.z); }
  lookDir() { const cp = Math.cos(this.pitch); return V3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }

  look(dx, dy) {
    const s = 0.0022 * Settings.sensitivity;
    this.yaw -= dx * s; this.pitch = clamp(this.pitch - dy * s, -1.553, 1.553);
    this.lookDX += dx; this.lookDY += dy;
  }
  onKey(code, now) {
    if (code === 'Space') {
      if (this.mode === 'creative' && now - this.lastSpace < 0.3) { this.flying = !this.flying; this.vel.y = 0; this.lastSpace = -1; } else this.lastSpace = now;
    }
    if (code === 'KeyW') { if (now - this.lastW < 0.28) this.tapSprint = true; this.lastW = now; }
    if (code === 'KeyF' && this.mode === 'creative') { this.flying = !this.flying; this.vel.y = 0; }
  }

  update(dt, game) {
    const world = game.world, K = this.keys;
    this.attackCd -= dt; this.useCd -= dt; this.hurtT = Math.max(0, this.hurtT - dt); this.invulnT -= dt;
    const px = Math.floor(this.pos.x), pz = Math.floor(this.pos.z);
    if (!world.isLoaded(px, pz)) return;
    const feetId = world.getId(px, Math.floor(this.pos.y + 0.2), pz), bodyId = world.getId(px, Math.floor(this.pos.y + 0.9), pz);
    const eyeId = world.getId(px, Math.floor(this.pos.y + this.eye + 0.05), pz);
    const wasWater = this.inWater;
    this.inWater = feetId === B.water || bodyId === B.water || feetId === B.seagrass || feetId === B.kelp || bodyId === B.kelp;
    this.headWater = eyeId === B.water || eyeId === B.kelp || eyeId === B.seagrass;
    const inLava = feetId === B.lava || bodyId === B.lava;
    this.onLadder = feetId === B.ladder || bodyId === B.ladder;
    if (this.inWater && !wasWater && this.vel.y < -5) { Effects.splash(world, V3(this.pos.x, Math.floor(this.pos.y + 0.9) + 0.9, this.pos.z)); Audio.play('splash', Math.min(1, -this.vel.y / 14)); }

    let fx = 0, fz = 0;
    if (!this.dead && game.state === 'playing') {
      if (K.has('KeyW') || K.has('ArrowUp')) fz += 1; if (K.has('KeyS') || K.has('ArrowDown')) fz -= 1;
      if (K.has('KeyA') || K.has('ArrowLeft')) fx -= 1; if (K.has('KeyD') || K.has('ArrowRight')) fx += 1;
    }
    const wantCrouch = (K.has('KeyC') || K.has('ControlLeft')) && !this.flying && game.state === 'playing';
    if (wantCrouch) this.crouching = true; else if (this.crouching && !aabbHits(world, this.pos.x, this.pos.y, this.pos.z, 0.29, 1.8)) this.crouching = false;
    if (fz <= 0) this.tapSprint = false;
    this.sprinting = fz > 0 && !this.crouching && (K.has('ShiftLeft') || K.has('ShiftRight') || this.tapSprint) && (this.mode === 'creative' || this.hunger > 4);
    const len = Math.hypot(fx, fz) || 1;
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const wx = (-sinY * fz + cosY * fx) / len, wz = (-cosY * fz - sinY * fx) / len;
    const moving = fx !== 0 || fz !== 0;
    const space = K.has('Space') && !this.dead && game.state === 'playing';
    let speed = this.flying ? (this.sprinting ? 24 : 10.5) : this.crouching ? 1.5 : this.sprinting ? 6.1 : 4.25;
    if (this.inWater && !this.flying) speed = this.sprinting ? 3.4 : 2.4;
    if (inLava && !this.flying) speed = 1.4;
    const accel = this.flying ? 7 : this.onGround ? 15 : this.inWater ? 5 : 2.4;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += ((moving ? wx * speed : 0) - this.vel.x) * k;
    this.vel.z += ((moving ? wz * speed : 0) - this.vel.z) * k;

    if (this.flying) {
      const up = (space ? 1 : 0) - (K.has('KeyC') || K.has('ControlLeft') ? 1 : 0);
      this.vel.y += (up * (this.sprinting ? 15 : 8.5) - this.vel.y) * (1 - Math.exp(-9 * dt));
    } else if (this.onLadder) {
      let v = -1.6;
      if (space || (fz > 0 && this._facingLadder(world))) v = 2.7; else if (this.crouching) v = 0;
      this.vel.y += (v - this.vel.y) * (1 - Math.exp(-14 * dt));
      this.peakY = null;
    } else if (this.inWater || inLava) {
      this.vel.y -= 7 * dt;
      this.vel.y *= Math.exp(-2.6 * dt);
      if (space) this.vel.y += (3.4 - this.vel.y) * (1 - Math.exp(-7 * dt));
      // climb out onto the bank
      if (space && moving && !this.headWater && (this._blockedAhead(world, wx, wz))) this.vel.y = 6.4;
      this.peakY = null;
    } else {
      this.vel.y -= 27 * dt;
      this.vel.y = Math.max(this.vel.y, -62);
      if (space && this.onGround) { this.vel.y = 8.35; this.onGround = false; this.exert(0.05); if (this.sprinting) { this.vel.x += wx * 0.8; this.vel.z += wz * 0.8; } }
    }
    // crouching never walks off a ledge
    if (this.crouching && this.onGround) {
      const supported = (x, z) => !!aabbHits(world, x, this.pos.y - 0.62, z, 0.29, 0.62);
      if (!supported(this.pos.x + this.vel.x * dt, this.pos.z)) this.vel.x = 0;
      if (!supported(this.pos.x + this.vel.x * dt, this.pos.z + this.vel.z * dt)) this.vel.z = 0;
    }
    const before = this.pos.clone(), vy = this.vel.y;
    const res = moveBody(world, this.pos, this.vel, dt, 0.29, this.height, this.flying ? 0 : 0.57, this.onGround);
    if (res.stepped) this.stepOff -= res.stepped;
    const wasGround = this.onGround;
    this.onGround = res.ground || (wasGround && this.vel.y <= 0 && !!aabbHits(world, this.pos.x, this.pos.y - 0.03, this.pos.z, 0.29, 0.03));
    if (this.flying && res.ground && (K.has('KeyC') || K.has('ControlLeft'))) this.flying = false;
    // falling and landing
    if (!this.onGround && !this.flying && !this.inWater && !this.onLadder) this.peakY = this.peakY === null ? this.pos.y : Math.max(this.peakY, this.pos.y);
    if (this.onGround && !wasGround) {
      const impact = -vy;
      if (impact > 3) { this.landVel -= Math.min(2.4, impact * 0.16); Audio.step(this._groundSound(world), Math.min(1, impact / 11), true); }
      if (this.peakY !== null) {
        const fall = this.peakY - this.pos.y;
        if (fall > 3.4 && !this.inWater) { this.damage(Math.floor(fall - 2.4), game, null, 'fall'); Effects.dust(world, this.pos.clone().add(V3(0, 0.1, 0)), [0.45, 0.38, 0.28], 12, 0.9); }
      }
      this.peakY = null;
    }
    if (this.inWater || this.flying) this.peakY = null;
    // footsteps and head bob follow the distance actually walked
    const walked = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    const spd = walked / Math.max(dt, 1e-4);
    const bobTarget = this.onGround && spd > 0.4 ? clamp(spd / 5.2, 0, 1.25) : 0;
    this.bobAmt = lerp(this.bobAmt, bobTarget, 1 - Math.exp(-8 * dt));
    if ((this.onGround || this.onLadder) && walked > 0) {
      const prev = Math.floor(this.bobPhase);
      this.bobPhase += walked * (this.sprinting ? 0.5 : 0.62);
      if (Math.floor(this.bobPhase) !== prev && !this.crouching) Audio.step(this.onLadder ? 'wood' : this._groundSound(world), this.sprinting ? 0.8 : 0.52);
      if (this.sprinting && Math.floor(this.bobPhase) !== prev) { const g = this._groundBlock(world); if (g && (g === B.sand || g === B.red_sand || g === B.dirt || g === B.gravel || g === B.snow)) Effects.dust(world, this.pos.clone().add(V3(0, 0.05, 0)), Materials.avgLinear[BLOCKS[g].layers[0]], 3, 0.3); }
    }
    if (this.inWater && spd > 0.5) { this.swimT = (this.swimT || 0) + dt; if (this.swimT > 0.62) { this.swimT = 0; Audio.step('water', 0.5); } }
    if (this.sprinting && walked > 0) this.exert(walked * 0.006);

    this._survival(dt, game, world, inLava, feetId, bodyId);
    this._interact(dt, game);
  }
  _facingLadder(world) { return true; }
  _blockedAhead(world, wx, wz) { return !!aabbHits(world, this.pos.x + wx * 0.45, this.pos.y + 0.15, this.pos.z + wz * 0.45, 0.29, 0.9); }
  _groundBlock(world) {
    const hit = aabbHits(world, this.pos.x, this.pos.y - 0.12, this.pos.z, 0.29, 0.12);
    return hit ? world.getId(hit.bx, hit.by, hit.bz) : 0;
  }
  _groundSound(world) {
    if (this.inWater) return 'water';
    const over = world.getId(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.1), Math.floor(this.pos.z));
    if (over === B.tall_grass || over === B.fern) return 'grass';
    const g = this._groundBlock(world);
    return g ? BLOCKS[g].sound : 'stone';
  }
  exert(a) { if (this.mode === 'survival') this.hunger = Math.max(0, this.hunger - a); }
  _survival(dt, game, world, inLava, feetId, bodyId) {
    if (this.dead || this.mode !== 'survival') { this.air = 10; return; }
    this.hunger = Math.max(0, this.hunger - dt / 48);
    if (this.hunger > 15 && this.health < 20) { this.regenT += dt; if (this.regenT > 2.6) { this.regenT = 0; this.health = Math.min(20, this.health + 1); this.exert(0.45); } }
    if (this.hunger <= 0 && this.health > 1) { this.starveT += dt; if (this.starveT > 4) { this.starveT = 0; this.damage(1, game, null, 'starve'); } }
    if (this.headWater) { this.air = Math.max(0, this.air - dt * 0.72); if (this.air <= 0) { this.drownT = (this.drownT || 0) + dt; if (this.drownT > 1) { this.drownT = 0; this.damage(2, game, null, 'drown'); } } }
    else { this.air = Math.min(10, this.air + dt * 4); this.drownT = 0; }
    this.hazardT -= dt;
    if (this.hazardT <= 0) {
      if (inLava) { this.hazardT = 0.5; this.damage(4, game, null, 'lava'); Effects.dust(world, this.pos.clone().add(V3(0, 0.8, 0)), [0.2, 0.18, 0.16], 6, 0.6); }
      else if (feetId === B.campfire) { this.hazardT = 0.6; this.damage(1, game, null, 'fire'); }
      else { const h = aabbHits(world, this.pos.x, this.pos.y - 0.04, this.pos.z, 0.34, this.height); if (h && world.getId(h.bx, h.by, h.bz) === B.cactus) { this.hazardT = 0.8; this.damage(1, game, null, 'cactus'); } }
    }
  }
  damage(n, game, from, cause) {
    if (this.mode !== 'survival' || this.dead || n <= 0) return;
    if (from && this.invulnT > 0) return;
    this.invulnT = 0.5;
    this.health = Math.max(0, this.health - n); this.hurtT = 0.55; this.hurtRoll = (Math.random() < 0.5 ? -1 : 1) * 0.07;
    Audio.play(cause === 'drown' ? 'gulp' : 'hurt', 0.8);
    if (from) { const away = V3(this.pos.x - from.x, 0, this.pos.z - from.z).normalize(); this.vel.x = away.x * 7.5; this.vel.z = away.z * 7.5; this.vel.y = 5; this.onGround = false; }
    if (this.health <= 0) { this.dead = true; this.deathCause = cause || 'creature'; this.mining = null; U.uBreak.value.set(0, -999, 0, 0); game.onDeath(); }
  }
  respawn() { this.dead = false; this.health = 20; this.hunger = 20; this.air = 10; this.vel.set(0, 0, 0); this.pos.copy(this.spawn); this.peakY = null; }

  // ---------------------------------------------------------------- aiming, mining, placing
  breakTime(id, item) {
    const def = BLOCKS[id];
    const harvest = !def.tier || (item && item.tool === 'pick' && item.tier >= def.tier);
    const matches = item && item.type === 'tool' && item.tool === def.tool;
    let t = def.hardness * (harvest ? 1.15 : 3.6) / (matches ? item.speed : 1);
    if (this.headWater) t *= 2.5;
    if (!this.onGround && !this.flying) t *= 1.6;
    return Math.max(0.06, t);
  }
  _interact(dt, game) {
    const world = game.world;
    if (this.dead || game.state !== 'playing') { this.target = null; Effects.setOutline(null); U.uBreak.value.w = 0; this.mining = null; return; }
    const origin = this.eyePos(), dir = this.lookDir();
    const reach = this.mode === 'creative' ? 6.5 : REACH;
    const hit = world.raycast(origin, dir, reach);
    const mob = Creatures.raycast(origin, dir, Math.min(reach - 1, 3.6));
    const mobFirst = mob && (!hit || mob.t < hit.t);
    this.target = mobFirst ? null : hit;
    this.mobTarget = mobFirst ? mob.creature : null;
    Effects.setOutline(this.target);
    const item = this.heldDef;
    // ---- primary: attack or mine
    if (this.mouse.left) {
      if (mobFirst) {
        this.mining = null;
        if (this.attackCd <= 0) {
          this.attackCd = 0.42; Viewmodel.swing();
          const dmg = item && item.type === 'tool' ? item.damage : 1;
          Creatures.damage(mob.creature, dmg, this.pos);
          Effects.dust(world, origin.clone().addScaledVector(dir, mob.t), mob.creature.spec.hostile ? [0.5, 0.2, 0.05] : [0.4, 0.32, 0.22], 6, 0.2);
          this._wear(item && item.type === 'tool' && item.tool === 'blade' ? 1 : 2);
          this.exert(0.08);
        }
      } else if (hit) {
        Viewmodel.mine();
        if (this.mode === 'creative') {
          if (this.attackCd <= 0 && hit.id !== B.bedrock) { this.attackCd = 0.24; Viewmodel.swing(); this.breakBlock(hit, game, false); }
        } else if (BLOCKS[hit.id].hardness !== Infinity) {
          const key = hit.x + ',' + hit.y + ',' + hit.z;
          if (!this.mining || this.mining.key !== key) { this.mining = { key, progress: 0 }; this.digT = 0; }
          this.mining.progress += dt / this.breakTime(hit.id, item);
          this.digT -= dt;
          if (this.digT <= 0) {
            this.digT = 0.24; Audio.dig(BLOCKS[hit.id].sound, 0.5);
            Entities.burst(world, V3(hit.px, hit.py, hit.pz), hit.id, 3, 0.18, V3(hit.nx, hit.ny, hit.nz));
          }
          U.uBreak.value.set(hit.x, hit.y, hit.z, Math.min(1, this.mining.progress));
          if (this.mining.progress >= 1) { this.breakBlock(hit, game, true); this.mining = null; this.attackCd = 0.12; U.uBreak.value.w = 0; }
        }
      } else if (this.attackCd <= 0) { this.attackCd = 0.38; Viewmodel.swing(); }
    } else { this.mining = null; U.uBreak.value.w = 0; Viewmodel.stopMine(); }
    if (!this.mouse.left || !hit || mobFirst) { U.uBreak.value.w = 0; }
    // ---- secondary: use, place or eat
    if (this.mouse.right) {
      const food = item && item.food > 0;
      if (this.useCd <= 0 && hit && BLOCKS[hit.id].use && !this.crouching) { this.useCd = 0.35; this.useBlock(hit, game); this.mouse.right = BLOCKS[hit.id].use === 'door' ? false : this.mouse.right; }
      else if (food && (this.hunger < 19.5 || this.mode === 'creative')) {
        this.eatT += dt; Viewmodel.eat(this.eatT);
        if (this.eatT % 0.3 < dt) Audio.play('chew', 0.6);
        if (this.eatT > 1.25) { this.eatT = 0; this.hunger = Math.min(20, this.hunger + item.food); if (item.key === 'apple' || item.key === 'roast_meat') this.health = Math.min(20, this.health + 1); if (this.mode === 'survival') this.inventory.take(this.selected, 1); Audio.play('burp', 0.4); }
      } else if (this.useCd <= 0 && hit && item && item.type === 'block') { this.useCd = 0.23; if (this.placeBlock(hit, item, game)) Viewmodel.place(); }
    } else this.eatT = 0;
  }
  _wear(n = 1) {
    const s = this.held;
    if (!s || s.d === undefined || this.mode !== 'survival') return;
    s.d -= n; this.inventory.version++;
    if (s.d <= 0) { this.inventory.slots[this.selected] = null; Audio.play('snap', 0.8); }
  }
  breakBlock(hit, game, drops) {
    const world = game.world, def = BLOCKS[hit.id], item = this.heldDef;
    const { x, y, z } = hit;
    const harvest = !def.tier || (item && item.tool === 'pick' && item.tier >= def.tier);
    const center = V3(x + 0.5, y + 0.5, z + 0.5);
    Entities.burst(world, center, hit.id, T_KIND[hit.id] === KIND.cross ? 8 : 24, 1);
    if (T_KIND[hit.id] !== KIND.cross && T_KIND[hit.id] !== KIND.leaves) Effects.dust(world, center, Materials.avgLinear[def.layers[2]].map((v) => v * 1.3 + 0.03), 7, 0.8);
    Audio.breakBlock(def.sound);
    const pos = x + ',' + y + ',' + z;
    game.removeContainer(pos, center);
    let replacement = 0;
    // blocks removed under water refill immediately when a source touches them
    if (hit.id === B.seagrass || hit.id === B.kelp) replacement = B.water;
    world.setBlock(x, y, z, replacement);
    if (hit.id === B.door) { const other = (hit.meta & 8) ? y - 1 : y + 1; if (world.getId(x, other, z) === B.door) world.setBlock(x, other, z, 0); }
    if (drops && harvest && def.drop) {
      let key = def.drop, n = 1;
      if (key.startsWith('item:')) { key = key.slice(5); key = DROP_ALIAS[key] || key; }
      if (key === 'coal' || key === 'skyglass' || key === 'ember_shard') n = 1 + (Math.random() < 0.4 ? 1 : 0);
      if (key === 'raw_copper') n = 1 + Math.floor(Math.random() * 3);
      if (key === 'berries') n = 1 + Math.floor(Math.random() * 3);
      if (T_KIND[hit.id] === KIND.leaves) { n = 0; if (Math.random() < 0.05 && (hit.id === B.oak_leaves || hit.id === B.blossom_leaves)) { key = 'apple'; n = 1; } else if (Math.random() < 0.06) { key = 'stick'; n = 1; } }
      if (n > 0 && ITEMS[key]) Entities.spawnDrop(key, n, center);
    }
    this._wear(def.hardness > 0.1 ? 1 : 0);
    this.exert(0.03);
    game.stats.broken++;
  }
  useBlock(hit, game) {
    const use = BLOCKS[hit.id].use, pos = hit.x + ',' + hit.y + ',' + hit.z;
    if (use === 'craft') UI.openCrafting(3);
    else if (use === 'furnace') UI.openFurnace(pos);
    else if (use === 'chest') { UI.openChest(pos); Entities.openChests.add(pos); Audio.play('chest', 0.8); }
    else if (use === 'door') {
      const y0 = (hit.meta & 8) ? hit.y - 1 : hit.y;
      for (const y of [y0, y0 + 1]) { const v = game.world.getBlock(hit.x, y, hit.z); if ((v & 255) === B.door) game.world.setBlock(hit.x, y, hit.z, v ^ (4 << 8), { noPhysics: true }); }
      Audio.play('door', 0.8); Viewmodel.swing();
    }
  }
  placeBlock(hit, item, game) {
    const world = game.world, id = item.block, def = BLOCKS[id];
    let x = hit.x, y = hit.y, z = hit.z, nx = hit.nx, ny = hit.ny, nz = hit.nz;
    const hitDef = BLOCKS[hit.id];
    if (!(hitDef.replaceable && hit.id !== id)) { x += nx; y += ny; z += nz; } else { nx = 0; ny = 1; nz = 0; }
    if (y <= 0 || y >= WORLD_H - 1) return false;
    const cur = world.getId(x, y, z);
    if (cur !== 0 && !BLOCKS[cur].replaceable) return false;
    const below = world.getId(x, y - 1, z);
    const dir = this.lookDir();
    // which way the front of a placed object faces: back toward the player
    const toPlayer = Math.abs(dir.x) > Math.abs(dir.z) ? (dir.x > 0 ? 3 : 1) : (dir.z > 0 ? 0 : 2);
    let meta = 0;
    if (id === B.torch) {
      if (ny === 1 || (ny === 0 && !nx && !nz)) { if (!T_SOLID[below]) return false; }
      else if (ny === 0) { meta = TORCH_DIR.findIndex((d) => d[0] === nx && d[1] === nz); if (meta < 1 || !T_SOLID[world.getId(x - nx, y, z - nz)]) return false; }
      else return false;
      if (cur === B.water) return false;
    } else if (id === B.ladder) {
      let m = LADDER_DIR.findIndex((d) => d[0] === -nx && d[1] === -nz);
      if (ny !== 0 || m < 0) m = [0, 1, 2, 3].find((i) => T_SOLID[world.getId(x + LADDER_DIR[i][0], y, z + LADDER_DIR[i][1])]);
      if (m === undefined || !T_SOLID[world.getId(x + LADDER_DIR[m][0], y, z + LADDER_DIR[m][1])]) return false;
      meta = m;
    } else if (id === B.door) {
      const above = world.getId(x, y + 1, z);
      if (!T_SOLID[below] || (above !== 0 && !BLOCKS[above].replaceable)) return false;
      meta = toPlayer;
    } else if (id === B.chest || id === B.furnace || id === B.crafting_table) meta = toPlayer;
    else if (def.axis) meta = ny !== 0 ? 0 : nx !== 0 ? 1 : 2;
    else if (id === B.lily_pad) { if (below !== B.water) return false; }
    else if (id === B.reeds) { const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => world.getId(x + a, y - 1, z + b) === B.water); if (!(below === B.reeds || (SOIL.has(below) || below === B.sand || below === B.gravel) && wet)) return false; }
    else if (id === B.cactus) { if (below !== B.sand && below !== B.red_sand && below !== B.cactus) return false; }
    else if (T_KIND[id] === KIND.cross) {
      const ok = SOIL.has(below) || (id === B.pebbles && T_SOLID[below]) || (id === B.dead_bush && (below === B.sand || below === B.red_sand || SOIL.has(below))) || ((id === B.mushroom || id === B.glowshroom) && T_OPAQUE[below]) || ((id === B.seagrass || id === B.kelp) && cur === B.water);
      if (!ok) return false;
    } else if (id === B.campfire && !T_SOLID[below]) return false;
    if (T_SOLID[id]) {
      const boxes = collisionBoxes(id, meta) || FULL_BOX;
      const overlaps = (p, hw, h) => boxes.some((b) => p.x + hw > x + b[0] && p.x - hw < x + b[3] && p.y + h > y + b[1] && p.y < y + b[4] && p.z + hw > z + b[2] && p.z - hw < z + b[5]);
      if (overlaps(this.pos, 0.29, this.height) || Creatures.list.some((c) => overlaps(c.pos, c.spec.w, c.spec.h))) return false;
    }
    if (T_KIND[id] === KIND.leaves) meta = 0;
    if (!world.setBlock(x, y, z, id | (meta << 8))) return false;
    if (id === B.door) world.setBlock(x, y + 1, z, id | ((meta | 8) << 8));
    Audio.place(def.sound);
    Effects.dust(world, V3(x + 0.5, y + 0.12, z + 0.5), [0.35, 0.31, 0.25], 3, 0.9);
    if (this.mode === 'survival') this.inventory.take(this.selected, 1);
    game.stats.placed++;
    return true;
  }

  applyCamera(cam, dt, t) {
    // a little inertia on the view, bob from the stride, spring on landing
    const k = 1 - Math.exp(-dt * 38);
    this.camYaw += (this.yaw - this.camYaw) * k; this.camPitch += (this.pitch - this.camPitch) * k;
    const eyeT = this.dead ? 0.35 : this.crouching ? 1.3 : this.inWater && !this.onGround ? 1.5 : 1.62;
    this.eye = lerp(this.eye, eyeT, 1 - Math.exp(-dt * (this.dead ? 3 : 14)));
    this.landVel += (-this.landOff * 130 - this.landVel * 17) * dt; this.landOff += this.landVel * dt;
    this.stepOff = lerp(this.stepOff, 0, 1 - Math.exp(-dt * 13));
    const bob = Settings.bob ? this.bobAmt : 0;
    const ph = this.bobPhase * Math.PI;
    const bx = Math.cos(ph) * 0.028 * bob, by = (Math.abs(Math.sin(ph)) - 0.5) * 0.058 * bob;
    const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    this.roll = lerp(this.roll, -strafe * 0.011 * (this.flying ? 2 : 1), 1 - Math.exp(-dt * 7));
    this.hurtRoll = lerp(this.hurtRoll, this.dead ? 0.35 : 0, 1 - Math.exp(-dt * (this.dead ? 2.5 : 7)));
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    cam.position.set(this.pos.x + rx * bx, this.pos.y + this.eye + by + this.landOff * 0.5 + this.stepOff + Math.sin(t * 1.7) * 0.0035, this.pos.z + rz * bx);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.camPitch + this.landOff * 0.12 + Math.sin(ph * 2) * 0.0022 * bob, this.camYaw, this.roll + Math.cos(ph) * 0.0045 * bob + this.hurtRoll);
    const kick = (this.sprinting && Math.hypot(this.vel.x, this.vel.z) > 3 ? (this.flying ? 12 : 8.5) : 0) - (this.headWater ? 5 : 0);
    this.fovKick = lerp(this.fovKick, kick, 1 - Math.exp(-dt * 7));
    cam.fov = Settings.fov + this.fovKick;
  }
  serialize() { return { pos: this.pos.toArray(), yaw: this.yaw, pitch: this.pitch, mode: this.mode, flying: this.flying, health: this.health, hunger: this.hunger, spawn: this.spawn.toArray(), selected: this.selected, inv: this.inventory.serialize() }; }
  load(d) { this.pos.fromArray(d.pos); this.yaw = this.camYaw = d.yaw; this.pitch = this.camPitch = d.pitch; this.mode = d.mode; this.flying = !!d.flying; this.health = d.health; this.hunger = d.hunger; this.spawn.fromArray(d.spawn); this.selected = d.selected || 0; this.inventory.load(d.inv); }
}

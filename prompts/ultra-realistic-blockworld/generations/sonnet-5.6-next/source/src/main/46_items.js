// ================================================================ items, crafting, containers and icons
const ITEMS = {};
function defItem(key, name, o = {}) { ITEMS[key] = Object.assign({ key, name, stack: 64, type: 'item', fuel: 0, food: 0 }, o); }
for (const b of BLOCKS) {
  // (branch variants of logs share the item of their log)
  if (['air', 'water', 'lava', 'bedrock'].includes(b.key)) continue;
  const fuel = /_log$/.test(b.key) ? 1.5 : /planks$/.test(b.key) ? 1.5 : b.key === 'thatch' ? 0.75 : b.key === 'dead_bush' ? 0.5 : 0;
  defItem(b.key, b.name, { type: 'block', block: b.id, fuel, group: b.group });
}
defItem('stick', 'Stick', { fuel: 0.5 });
defItem('coal', 'Coal', { fuel: 8 });
defItem('raw_copper', 'Raw Copper');
defItem('raw_iron', 'Raw Iron');
defItem('raw_gold', 'Raw Gold');
defItem('copper_ingot', 'Copper Ingot');
defItem('iron_ingot', 'Iron Ingot');
defItem('gold_ingot', 'Gold Ingot');
defItem('skyglass', 'Skyglass Shard');
defItem('ember_shard', 'Ember Shard', { fuel: 16 });
defItem('brick', 'Fired Brick Bar');
defItem('plume', 'Plume Fibre');
defItem('gloam_core', 'Gloam Core', { fuel: 24 });
defItem('lantern_shard', 'Lantern Shard');
defItem('berries', 'Duskberries', { food: 3 });
defItem('mushroom_food', 'Field Mushroom', { food: 2 });
defItem('apple', 'Wild Apple', { food: 4 });
defItem('raw_meat', 'Raw Haunch', { food: 2 });
defItem('roast_meat', 'Roast Haunch', { food: 8 });

const TIERS = [
  { key: 'timber', name: 'Timber', mat: 'planks', speed: 2.2, tier: 1, dur: 70, dmg: 3, layer: 'pine_planks', tint: [1, 0.96, 0.9], metal: 0, rough: -1 },
  { key: 'stone', name: 'Stone', mat: 'cobble', speed: 4, tier: 2, dur: 150, dmg: 4, layer: 'stone', tint: [0.92, 0.92, 0.94], metal: 0, rough: -1 },
  { key: 'copper', name: 'Copper', mat: 'copper_ingot', speed: 5.6, tier: 3, dur: 240, dmg: 5, layer: 'iron', tint: [1.0, 0.62, 0.42], metal: 0.95, rough: 0.34 },
  { key: 'iron', name: 'Iron', mat: 'iron_ingot', speed: 7.2, tier: 4, dur: 460, dmg: 6, layer: 'iron', tint: [0.98, 0.98, 1.0], metal: -1, rough: -1 },
  { key: 'skyglass', name: 'Skyglass', mat: 'skyglass', speed: 10, tier: 5, dur: 1300, dmg: 8, layer: 'crystal_azure', tint: [0.9, 0.98, 1], metal: 0.25, rough: 0.1 },
];
const TOOL_KINDS = { pick: { name: 'Pick', pattern: ['MMM', ' S ', ' S '], dmgK: 0.8 }, axe: { name: 'Hatchet', pattern: ['MM', 'MS', ' S'], dmgK: 1.1 }, shovel: { name: 'Spade', pattern: ['M', 'S', 'S'], dmgK: 0.7 }, blade: { name: 'Blade', pattern: ['M', 'M', 'S'], dmgK: 1.4 } };
for (const t of TIERS) for (const [k, d] of Object.entries(TOOL_KINDS)) defItem(t.key + '_' + k, t.name + ' ' + d.name, { type: 'tool', stack: 1, tool: k, tier: t.tier, tierDef: t, speed: t.speed, damage: Math.round(t.dmg * d.dmgK + (k === 'blade' ? 1 : 0)), durability: t.dur, fuel: t.key === 'timber' ? 1 : 0, group: 'tools' });

// ---------------------------------------------------------------- recipes
const ANY = { planks: ['oak_planks', 'birch_planks', 'pine_planks'], logs: ['oak_log', 'birch_log', 'pine_log', 'cypress_log', 'rosewood_log'] };
const RECIPES = [];
const shaped = (pattern, keys, out, n = 1) => RECIPES.push({ pattern, keys, out, n });
const shapeless = (ins, out, n = 1) => RECIPES.push({ ins, out, n });
shapeless(['oak_log'], 'oak_planks', 4); shapeless(['birch_log'], 'birch_planks', 4); shapeless(['pine_log'], 'pine_planks', 4); shapeless(['cypress_log'], 'oak_planks', 4); shapeless(['rosewood_log'], 'birch_planks', 4);
shaped(['P', 'P'], { P: 'planks' }, 'stick', 4);
shaped(['PP', 'PP'], { P: 'planks' }, 'crafting_table');
shaped(['C', 'S'], { C: 'coal', S: 'stick' }, 'torch', 4);
shaped(['CCC', 'C C', 'CCC'], { C: 'cobble' }, 'furnace');
shaped(['PPP', 'P P', 'PPP'], { P: 'planks' }, 'chest');
shaped(['PP', 'PP', 'PP'], { P: 'planks' }, 'door');
shaped(['S S', 'SSS', 'S S'], { S: 'stick' }, 'ladder', 3);
for (const t of TIERS) for (const [k, d] of Object.entries(TOOL_KINDS)) shaped(d.pattern, { M: t.mat, S: 'stick' }, t.key + '_' + k);
shaped(['SS', 'SS'], { S: 'stone' }, 'stone_bricks', 4);
shaped(['BBB'], { B: 'stone_bricks' }, 'stone_slab', 6);
shaped(['PPP'], { P: 'planks' }, 'wood_slab', 6);
shaped(['SS', 'SS'], { S: 'sand' }, 'sandstone');
shaped(['SS', 'SS'], { S: 'red_sand' }, 'red_sandstone');
shaped(['SS', 'SS'], { S: 'sandstone' }, 'pale_sandstone', 4);
shaped(['III', 'III', 'III'], { I: 'iron_ingot' }, 'iron_block');
shapeless(['iron_block'], 'iron_ingot', 9);
shaped([' G ', 'GTG', ' G '], { G: 'glass', T: 'torch' }, 'lamp');
shaped(['RR', 'RR'], { R: 'reeds' }, 'thatch', 2);
shaped([' S ', 'SCS', 'LLL'], { S: 'stick', C: 'coal', L: 'logs' }, 'campfire');
shaped(['BB', 'BB'], { B: 'brick' }, 'clay_bricks');
shaped(['II', 'II'], { I: 'ice' }, 'packed_ice');
shapeless(['cobble', 'moss_block'], 'mossy_cobble', 1);
shaped(['PP', 'PP'], { P: 'plume' }, 'thatch', 3);
shaped(['L', 'T'], { L: 'lantern_shard', T: 'torch' }, 'lamp', 2);

const SMELT = { raw_copper: 'copper_ingot', raw_iron: 'iron_ingot', raw_gold: 'gold_ingot', sand: 'glass', red_sand: 'glass', cobble: 'stone', clay: 'brick', raw_meat: 'roast_meat', oak_log: 'coal', birch_log: 'coal', pine_log: 'coal', cypress_log: 'coal', rosewood_log: 'coal', mud: 'terracotta' };
const SMELT_TIME = 6;

const ingredientMatches = (want, have) => want === have || (ANY[want] && ANY[want].includes(have));
function matchRecipe(grid, size) {
  // trim the grid to its occupied bounding box
  let x0 = 9, y0 = 9, x1 = -1, y1 = -1; const present = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (grid[y * size + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); present.push(grid[y * size + x].k); }
  if (!present.length) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (const r of RECIPES) {
    if (r.ins) {
      if (r.ins.length !== present.length) continue;
      const pool = [...present];
      if (r.ins.every((i) => { const k = pool.findIndex((p) => ingredientMatches(i, p)); if (k < 0) return false; pool.splice(k, 1); return true; })) return r;
      continue;
    }
    if (r.pattern.length !== h || r.pattern[0].length !== w) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const ch = r.pattern[y][mirror ? w - 1 - x : x];
        const cell = grid[(y0 + y) * size + (x0 + x)];
        if (ch === ' ') ok = !cell; else ok = !!cell && ingredientMatches(r.keys[ch], cell.k);
      }
      if (ok) return r;
    }
  }
  return null;
}

class Inventory {
  constructor(n = 36) { this.slots = new Array(n).fill(null); this.version = 0; }
  maxStack(k) { return ITEMS[k] ? ITEMS[k].stack : 64; }
  add(k, n = 1, d) {
    if (!ITEMS[k]) return n;
    const max = this.maxStack(k);
    for (const s of this.slots) if (s && s.k === k && s.n < max && max > 1) { const t = Math.min(n, max - s.n); s.n += t; n -= t; if (!n) break; }
    for (let i = 0; i < this.slots.length && n > 0; i++) if (!this.slots[i]) { const t = Math.min(n, max); this.slots[i] = { k, n: t }; if (ITEMS[k].durability) this.slots[i].d = d !== undefined ? d : ITEMS[k].durability; n -= t; }
    this.version++;
    return n;
  }
  take(i, n = 1) { const s = this.slots[i]; if (!s) return; s.n -= n; if (s.n <= 0) this.slots[i] = null; this.version++; }
  count(k) { return this.slots.reduce((a, s) => a + (s && s.k === k ? s.n : 0), 0); }
  serialize() { return this.slots.map((s) => (s ? [s.k, s.n, s.d] : 0)); }
  load(a) { for (let i = 0; i < this.slots.length; i++) { const s = a && a[i]; this.slots[i] = s && ITEMS[s[0]] ? { k: s[0], n: s[1], d: s[2] === null ? undefined : s[2] } : null; } this.version++; }
}

function tickFurnace(f, dt) {
  const input = f.slots[0], out = f.slots[2];
  const result = input ? SMELT[input.k] : null;
  const canSmelt = result && (!out || (out.k === result && out.n < ITEMS[result].stack));
  let changed = false;
  if (f.burn <= 0 && canSmelt) {
    const fuel = f.slots[1];
    if (fuel && ITEMS[fuel.k].fuel > 0) {
      f.burnMax = f.burn = ITEMS[fuel.k].fuel * SMELT_TIME;
      fuel.n--; if (fuel.n <= 0) f.slots[1] = null;
      changed = true;
    }
  }
  if (f.burn > 0) {
    f.burn -= dt;
    if (canSmelt) {
      f.progress += dt;
      if (f.progress >= SMELT_TIME) {
        f.progress = 0;
        if (f.slots[2]) f.slots[2].n++; else f.slots[2] = { k: result, n: 1 };
        input.n--; if (input.n <= 0) f.slots[0] = null;
        changed = true;
      }
    } else f.progress = 0;
  } else f.progress = Math.max(0, f.progress - dt * 2);
  return changed;
}

// ---------------------------------------------------------------- item geometry (viewmodel, drops, icons)
const L_ = (name) => LAYER[name];
function blockModel(mb, id, size = 1, tintRGB = null) {
  const def = BLOCKS[id], h = size / 2;
  const grassTint = [0.39, 0.5, 0.24], foliage = [0.33, 0.45, 0.2];
  const kind = T_KIND[id];
  const tint = tintRGB || (def.tint === 1 ? grassTint : def.tint === 2 ? foliage : null);
  // textures that are authored relative to a tint need to be rescaled around mid grey
  const k = (c) => c.map((v) => Math.min(1, v * 2.0));
  if (kind === KIND.cross) {
    for (let i = 0; i < 2; i++) {
      const a = i * 1.5708 + 0.7854, dx = Math.cos(a) * h, dz = Math.sin(a) * h;
      mb.quad([[-dx, -h, -dz], [dx, -h, dz], [dx, h, dz], [-dx, h, -dz]], [[0, 0], [1, 0], [1, 1], [0, 1]], { layer: def.layers[2], color: tint ? k(tint) : [1, 1, 1], rough: 0.8, metal: 0, emissive: id === B.glowshroom ? 2.2 : 0 }, [[0, 0.8, 0.6], [0, 0.8, 0.6], [0, 0.8, 0.6], [0, 0.8, 0.6]]);
    }
    return;
  }
  if (kind === KIND.leaves) {
    const r = mulberry32(id * 31);
    for (let i = 0; i < 9; i++) {
      const c = [(r() - 0.5) * h, (r() - 0.5) * h, (r() - 0.5) * h], a = r() * 6.28, tl = (r() - 0.5) * 2;
      const rx = [Math.cos(a) * h * 0.8, 0, Math.sin(a) * h * 0.8], up = [-Math.sin(a) * Math.sin(tl) * h * 0.8, Math.cos(tl) * h * 0.8, Math.cos(a) * Math.sin(tl) * h * 0.8];
      const nn = v3norm(v3add(c, [0, 0.2, 0.2]));
      mb.quad([v3sub(v3sub(c, rx), up), v3sub(v3add(c, rx), up), v3add(v3add(c, rx), up), v3add(v3sub(c, rx), up)], [[0, 0], [1, 0], [1, 1], [0, 1]], { layer: def.layers[2], color: tint ? k(tint) : [1, 1, 1], rough: 0.8, metal: 0 }, [nn, nn, nn, nn]);
    }
    return;
  }
  if (kind === KIND.torch) {
    mb.tube([[0, -h, 0], [0, h * 0.45, 0]], [size * 0.065, size * 0.075], 7, { layer: L_('oak_bark'), metal: 0 });
    mb.tube([[0, h * 0.42, 0], [0, h * 0.7, 0]], [size * 0.095, size * 0.085], 8, { layer: L_('charwood'), emissive: 6, metal: 0 });
    return;
  }
  if (kind === KIND.crystal) {
    const r = mulberry32(id);
    for (let i = 0; i < 6; i++) {
      const base = [(r() - 0.5) * h, -h, (r() - 0.5) * h], len = (i ? 0.4 + r() * 0.5 : 1.1) * size * 0.8;
      const dir = v3norm([base[0] * 1.8, 1, base[2] * 1.8]), rad = size * (i ? 0.07 : 0.14);
      mb.tube([base, v3add(base, v3mul(dir, len * 0.8)), v3add(base, v3mul(dir, len))], [rad, rad * 0.85, 0.002], 6, { layer: def.layers[2], emissive: 2.4, metal: 0 });
    }
    return;
  }
  const layers = def.layers;
  const faceOpts = (f) => {
    const layer = f === 2 ? layers[0] : f === 3 ? layers[1] : layers[2];
    const useTint = tint && !(def.tint === 1 && f === 3);
    return { layer: kind === KIND.model && id === B.furnace && f === 4 ? LAYER.furnace_front : layer, color: useTint ? k(tint) : [1, 1, 1], fit: true, emissive: id === B.lamp ? 3 : id === B.ember_ore ? 2 : id === B.azurite_ore ? 1.8 : 0 };
  };
  if (kind === KIND.slab) { mb.box([0, -h / 2, 0], [h, h / 2, h], {}, undefined, faceOpts); return; }
  if (kind === KIND.door) { mb.box([0, 0, 0], [h * 0.5, h, h * 0.09], {}, undefined, () => ({ layer: LAYER.door, fit: true })); return; }
  if (kind === KIND.ladder) { for (const x of [-0.62, 0.62]) mb.box([x * h, 0, 0], [h * 0.09, h, h * 0.09], { layer: LAYER.oak_planks }); for (let i = 0; i < 4; i++) mb.box([0, -h * 0.75 + i * h * 0.5, 0], [h * 0.62, h * 0.07, h * 0.06], { layer: LAYER.pine_planks }); return; }
  if (kind === KIND.chest) { mb.box([0, -h * 0.1, 0], [h * 0.92, h * 0.8, h * 0.92], { layer: LAYER.chest_wood }, undefined, () => ({ layer: LAYER.chest_wood, fit: true })); for (const x of [-0.7, 0.7]) mb.box([x * h, -h * 0.1, 0], [h * 0.07, h * 0.82, h * 0.94], { layer: LAYER.iron }); mb.box([0, h * 0.12, h * 0.94], [h * 0.12, h * 0.16, h * 0.05], { layer: LAYER.iron, color: [1, 0.82, 0.45], metal: 1, rough: 0.3 }); return; }
  if (kind === KIND.campfire) { for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.4; mb.tube([[Math.cos(a) * h * 0.75, -h * 0.8, Math.sin(a) * h * 0.75], [-Math.cos(a) * h * 0.1, 0.05, -Math.sin(a) * h * 0.1]], size * 0.09, 7, { layer: i & 1 ? LAYER.oak_bark : LAYER.charwood, emissive: i & 1 ? 0 : 4 }); } for (let i = 0; i < 8; i++) { const a = i * 0.785; mb.ellipsoid([Math.cos(a) * h * 0.82, -h * 0.82, Math.sin(a) * h * 0.82], [h * 0.2, h * 0.15, h * 0.2], 7, 5, { layer: LAYER.stone }); } return; }
  mb.box([0, 0, 0], [h, h, h], {}, undefined, faceOpts);
}

function toolModel(mb, kind, tier) {
  // handle along +Y, head at the top; units are metres
  const wood = { layer: LAYER.oak_planks, color: [0.95, 0.86, 0.74], metal: 0, uvScale: 1.6 };
  const wrap = { layer: LAYER.leather, metal: 0, uvScale: 3 };
  const headO = { layer: LAYER[tier.layer], color: tier.tint, metal: tier.metal, rough: tier.rough, emissive: tier.key === 'skyglass' ? 0.9 : 0, uvScale: 2.2, fit: false };
  const handleTop = kind === 'blade' ? 0.02 : 0.3;
  mb.tube([[0, -0.3, 0], [0.004, -0.1, 0], [-0.003, 0.12, 0], [0, handleTop, 0]], [0.023, 0.019, 0.02, 0.021], 9, wood, 0.82);
  mb.tube([[0, -0.255, 0], [0, -0.12, 0]], [0.0255, 0.0235], 9, wrap, 0.86);
  mb.tube([[0, -0.318, 0], [0, -0.292, 0]], [0.028, 0.027], 9, headO);
  const flat = (p) => [p[0], p[1], p[2]];
  const shift = (dx, dy) => (p) => [p[0] + dx, p[1] + dy, p[2]];
  if (kind === 'pick') {
    mb.extrude([[-0.215, -0.055], [-0.14, 0.012], [-0.06, 0.042], [0, 0.05], [0.06, 0.042], [0.14, 0.012], [0.215, -0.055], [0.13, -0.02], [0.05, -0.004], [0, -0.002], [-0.05, -0.004], [-0.13, -0.02]], 0.03, 0.011, shift(0, 0.27), headO);
    mb.box([0, 0.288, 0], [0.031, 0.036, 0.022], headO);
  } else if (kind === 'axe') {
    mb.extrude([[-0.032, -0.042], [0.03, -0.034], [0.085, -0.075], [0.135, -0.1], [0.158, -0.035], [0.157, 0.028], [0.135, 0.083], [0.075, 0.05], [0.03, 0.036], [-0.032, 0.04]], 0.028, 0.014, shift(0, 0.26), headO);
    mb.box([-0.048, 0.26, 0], [0.018, 0.028, 0.019], headO);
  } else if (kind === 'shovel') {
    mb.extrude([[-0.064, 0], [-0.07, 0.085], [-0.048, 0.15], [0, 0.178], [0.048, 0.15], [0.07, 0.085], [0.064, 0], [0.024, -0.014], [-0.024, -0.014]], 0.018, 0.012, shift(0, 0.31), headO);
    mb.tube([[0, 0.27, 0], [0, 0.325, 0]], [0.026, 0.021], 9, headO);
  } else {
    mb.extrude([[-0.036, 0], [-0.04, 0.3], [-0.03, 0.43], [0, 0.505], [0.03, 0.43], [0.04, 0.3], [0.036, 0]], 0.016, 0.019, shift(0, 0.035), headO);
    mb.extrude([[-0.115, -0.006], [-0.1, 0.022], [-0.03, 0.026], [0.03, 0.026], [0.1, 0.022], [0.115, -0.006], [0.06, -0.016], [-0.06, -0.016]], 0.036, 0.008, shift(0, 0.012), { layer: LAYER.iron, color: [0.85, 0.72, 0.5], metal: 0.9, rough: 0.35 });
  }
}

function itemModel(mb, key) {
  const it = ITEMS[key];
  if (!it) return;
  if (it.type === 'block') { blockModel(mb, it.block, 1); return; }
  if (it.type === 'tool') { toolModel(mb, it.tool, it.tierDef); return; }
  const ingot = (color) => {
    const o = { layer: LAYER.iron, color, metal: 0.95, rough: 0.3, uvScale: 1.4 };
    for (const [y, dz] of [[-0.12, -0.2], [-0.12, 0.2], [0.13, 0]]) {
      const w = 0.4, hh = 0.11, d = 0.15, t = 0.72;
      const p = (sx, sy, sz) => [sx * w * (sy > 0 ? t : 1), y + sy * hh, dz + sz * d * (sy > 0 ? t : 1)];
      for (const q of [[[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]]) mb.quad(q.map((c) => p(...c)), [[0, 0], [1, 0], [1, 0.4], [0, 0.4]], o);
    }
  };
  const lumps = (layer, color, o = {}) => {
    const r = mulberry32(key.length * 977 + key.charCodeAt(0));
    for (let i = 0; i < 4; i++) { const c = i ? [(r() - 0.5) * 0.5, (r() - 0.5) * 0.35 - 0.05, (r() - 0.5) * 0.4] : [0, 0, 0]; const s = i ? 0.17 + r() * 0.1 : 0.3; const pts = []; mb.ellipsoid(c, [s, s * 0.85, s * 0.9], 7, 5, Object.assign({ layer, color, uvScale: 0.8 }, o), (d) => 0.74 + rand01(Math.round(d[0] * 3), Math.round(d[1] * 3), Math.round(d[2] * 3), i) * 0.5); }
  };
  const crystals = (layer) => {
    const r = mulberry32(7 + key.length);
    for (let i = 0; i < 4; i++) { const base = [(r() - 0.5) * 0.35, -0.35 + r() * 0.1, (r() - 0.5) * 0.3]; const dir = v3norm([base[0] * 1.7, 1, base[2] * 1.7]), len = i ? 0.45 + r() * 0.25 : 0.82, rad = i ? 0.09 : 0.15; mb.tube([base, v3add(base, v3mul(dir, len * 0.78)), v3add(base, v3mul(dir, len))], [rad, rad * 0.86, 0.002], 6, { layer, emissive: 2.2, metal: 0.1 }); }
  };
  const orb = (c, s, color, rough = 0.35, extra = {}) => mb.ellipsoid(c, [s, s * 0.96, s], 12, 9, Object.assign({ color, rough, metal: 0 }, extra));
  switch (key) {
    case 'stick': mb.tube([[-0.28, -0.36, 0], [-0.04, -0.03, 0.02], [0.28, 0.36, 0]], [0.05, 0.045, 0.04], 7, { layer: LAYER.oak_bark, color: [1, 0.92, 0.8] }); break;
    case 'coal': lumps(LAYER.coal_ore, [0.35, 0.35, 0.37], { metal: 0.35, rough: 0.3 }); break;
    case 'raw_copper': lumps(LAYER.copper_ore, [1, 0.72, 0.55], { metal: 0.7, rough: 0.5 }); break;
    case 'raw_iron': lumps(LAYER.iron_ore, [1, 0.86, 0.76], { metal: 0.6, rough: 0.55 }); break;
    case 'raw_gold': lumps(LAYER.stone, [1, 0.8, 0.28], { metal: 1, rough: 0.34 }); break;
    case 'copper_ingot': ingot([1.0, 0.64, 0.45]); break;
    case 'iron_ingot': ingot([0.95, 0.96, 1]); break;
    case 'gold_ingot': ingot([1.0, 0.82, 0.34]); break;
    case 'brick': ingot([0.9, 0.45, 0.32]); break;
    case 'skyglass': crystals(LAYER.crystal_azure); break;
    case 'ember_shard': lumps(LAYER.ember_ore, [1, 0.8, 0.7], { emissive: 3, rough: 0.2 }); break;
    case 'lantern_shard': crystals(LAYER.crystal_amber); break;
    case 'gloam_core': orb([0, 0, 0], 0.3, [0.2, 0.06, 0.03], 0.3, { layer: LAYER.charwood, emissive: 7 }); break;
    case 'berries': for (const c of [[-0.17, -0.1, 0.06], [0.15, -0.14, 0.02], [0.0, 0.09, 0.12], [0.2, 0.12, -0.08], [-0.12, 0.17, -0.06]]) orb(c, 0.155, [0.42, 0.08, 0.38], 0.22); mb.tube([[0, 0.1, 0], [0.05, 0.38, 0]], 0.02, 5, { color: [0.3, 0.4, 0.15], rough: 0.8 }); break;
    case 'mushroom_food': mb.tube([[0, -0.32, 0], [0.02, 0.05, 0]], [0.11, 0.08], 9, { layer: LAYER.mushroom_stem }); mb.ellipsoid([0.02, 0.1, 0], [0.34, 0.2, 0.34], 14, 8, { layer: LAYER.mushroom_cap }, (d) => (d[1] < -0.1 ? 0.45 : 1)); break;
    case 'apple': mb.ellipsoid([0, -0.04, 0], [0.34, 0.32, 0.34], 18, 12, { colorFn: (p) => (p[0] + p[1] * 0.6 > 0.12 ? [0.82, 0.62, 0.16] : [0.72, 0.1, 0.06]), rough: 0.28, metal: 0 }, (d) => 1 - Math.pow(Math.max(0, Math.abs(d[1]) - 0.78), 1.2) * 0.5); mb.tube([[0, 0.24, 0], [0.04, 0.42, 0]], [0.022, 0.016], 5, { layer: LAYER.oak_bark }); break;
    case 'raw_meat': case 'roast_meat': { const c = key === 'raw_meat' ? [0.72, 0.24, 0.22] : [0.48, 0.24, 0.1]; mb.ellipsoid([0.06, 0.04, 0], [0.34, 0.24, 0.22], 14, 10, { layer: LAYER.skin, color: c, rough: key === 'raw_meat' ? 0.35 : 0.55, metal: 0 }, (d) => 1 + d[0] * 0.18); mb.tube([[-0.2, -0.04, 0], [-0.46, -0.2, 0]], [0.065, 0.05], 8, { color: [0.86, 0.8, 0.68], rough: 0.6 }); orb([-0.47, -0.21, 0], 0.085, [0.86, 0.8, 0.68], 0.6); break; }
    case 'plume': for (let i = 0; i < 7; i++) { const a = -0.8 + i * 0.27; mb.tube([[0, -0.38, 0], [Math.sin(a) * 0.2, 0.0, 0], [Math.sin(a) * 0.46, 0.32 - Math.abs(a) * 0.12, 0]], [0.02, 0.06, 0.005], 6, { color: [0.86, 0.74, 0.54], rough: 0.9 }, 0.35); } break;
    default: lumps(LAYER.stone, [1, 1, 1]);
  }
}

const _geoCache = new Map();
function itemGeometry(key) {
  let g = _geoCache.get(key);
  if (!g) { const mb = new ModelBuilder(); itemModel(mb, key); g = mb.geometry(); _geoCache.set(key, g); }
  return g;
}

// ---------------------------------------------------------------- icons rendered from the real 3D materials
const Icons = {
  cache: new Map(), rt: null,
  init() {
    this.size = 96;
    this.rt = new THREE.WebGLRenderTarget(this.size * 2, this.size * 2, { type: THREE.UnsignedByteType, depthBuffer: true });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    this.camera.position.set(0, 0, 3);
    this.material = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: G_MODEL_VERT, fragmentShader: G_ICON_FRAG, uniforms: modelUniforms(), side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.frustumCulled = false; this.scene.add(this.mesh);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.big = document.createElement('canvas'); this.big.width = this.big.height = this.size * 2;
  },
  get(key) {
    let url = this.cache.get(key);
    if (url) return url;
    const it = ITEMS[key];
    if (!it) return '';
    const m = this.mesh;
    m.geometry = itemGeometry(key);
    m.rotation.set(0, 0, 0); m.position.set(0, 0, 0); m.scale.setScalar(1);
    const kind = it.type === 'block' ? T_KIND[it.block] : -1;
    if (it.type === 'tool') { m.rotation.set(0, -0.28, -0.72); m.scale.setScalar(1.17); m.position.set(-0.04, -0.05, 0); }
    else if (it.type === 'block' && (kind === KIND.cube || kind === KIND.slab || kind === KIND.model || kind === KIND.chest || kind === KIND.glass || kind === KIND.leaves || kind === KIND.campfire)) { m.rotation.set(0.52, -0.785, 0, 'XYZ'); m.scale.setScalar(kind === KIND.leaves ? 0.66 : 0.6); }
    else if (it.type === 'block') { m.rotation.set(0.1, kind === KIND.cross ? -0.785 : 0.25, 0); m.scale.setScalar(0.9); }
    else { m.rotation.set(0.45, -0.5, 0); m.scale.setScalar(0.95); }
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
    renderer.render(this.scene, this.camera);
    const s = this.size * 2, px = new Uint8Array(s * s * 4);
    renderer.readRenderTargetPixels(this.rt, 0, 0, s, s, px);
    renderer.setRenderTarget(prev);
    const bctx = this.big.getContext('2d'), img = bctx.createImageData(s, s);
    for (let y = 0; y < s; y++) img.data.set(px.subarray((s - 1 - y) * s * 4, (s - y) * s * 4), y * s * 4);
    bctx.putImageData(img, 0, 0);
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.drawImage(this.big, 0, 0, this.size, this.size);
    url = this.canvas.toDataURL('image/png');
    this.cache.set(key, url);
    return url;
  },
};

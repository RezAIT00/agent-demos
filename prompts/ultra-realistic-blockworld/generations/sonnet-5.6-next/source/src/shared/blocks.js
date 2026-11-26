// ---------------------------------------------------------------- material layers
// [name, texSpan(blocks covered by one texture), tiling(0 perBlock jitter,1 world blended,2 hex,3 aligned), pomDepth, bevel, matClass, porosity]
// matClass: 0 standard, 1 foliage, 2 snow, 3 skin/fur, 4 ice, 5 lava
const LAYER_DEFS = [
  ['stone', 3, 2, 0.055, 0.55, 0, 0.5], ['limestone', 3, 1, 0.05, 0.55, 0, 0.6], ['slate', 3, 1, 0.05, 0.55, 0, 0.3],
  ['basalt', 3, 2, 0.05, 0.55, 0, 0.3], ['sandstone', 3, 1, 0.045, 0.5, 0, 0.8], ['red_sandstone', 3, 1, 0.045, 0.5, 0, 0.8],
  ['pale_sandstone', 3, 1, 0.04, 0.5, 0, 0.8], ['terracotta', 3, 1, 0.035, 0.45, 0, 0.7],
  ['dirt', 2, 2, 0.035, 0.35, 0, 1.0], ['grass_top', 2, 2, 0, 0.12, 0, 0.6], ['grass_side', 1, 3, 0, 0.35, 0, 0.8],
  ['forest_top', 2, 2, 0, 0.12, 0, 0.8], ['forest_side', 1, 3, 0, 0.35, 0, 0.8], ['mud', 2, 2, 0.02, 0.25, 0, 0.5],
  ['sand', 3, 2, 0, 0.05, 0, 1.0], ['red_sand', 3, 2, 0, 0.05, 0, 1.0], ['gravel', 2, 2, 0.075, 0.3, 0, 0.4],
  ['scree', 2.5, 2, 0.11, 0.3, 0, 0.4], ['snow', 3, 2, 0, 0.2, 2, 0.1], ['snow_side', 1, 3, 0, 0.35, 2, 0.4],
  ['ice', 2, 1, 0, 0.6, 4, 0.0], ['packed_ice', 2, 1, 0, 0.6, 4, 0.0], ['clay', 2, 2, 0, 0.35, 0, 0.8], ['moss', 2, 2, 0.04, 0.4, 0, 1.0],
  ['cobble', 2, 3, 0.1, 0.85, 0, 0.4], ['mossy_cobble', 2, 3, 0.1, 0.85, 0, 0.7], ['stone_bricks', 1, 3, 0.05, 0.7, 0, 0.45],
  ['clay_bricks', 1, 3, 0.04, 0.55, 0, 0.6], ['oak_planks', 1, 0, 0.02, 0.65, 0, 0.5], ['birch_planks', 1, 0, 0.02, 0.65, 0, 0.5],
  ['pine_planks', 1, 0, 0.02, 0.65, 0, 0.5], ['oak_bark', 1, 3, 0.055, 0.7, 0, 0.6], ['oak_end', 1, 3, 0, 0.7, 0, 0.6],
  ['birch_bark', 1, 3, 0.025, 0.7, 0, 0.4], ['birch_end', 1, 3, 0, 0.7, 0, 0.6], ['pine_bark', 1, 3, 0.09, 0.7, 0, 0.6],
  ['pine_end', 1, 3, 0, 0.7, 0, 0.6], ['cypress_bark', 1, 3, 0.07, 0.7, 0, 0.7], ['rosewood_bark', 1, 3, 0.04, 0.7, 0, 0.5],
  ['rosewood_end', 1, 3, 0, 0.7, 0, 0.6], ['cypress_end', 1, 3, 0, 0.7, 0, 0.6], ['cactus_side', 1, 3, 0.035, 0.9, 1, 0.1],
  ['cactus_top', 1, 3, 0, 0.9, 1, 0.1], ['coral_pink', 1, 0, 0.05, 0.9, 0, 0.0], ['coral_orange', 1, 0, 0.05, 0.9, 0, 0.0],
  ['coral_violet', 1, 0, 0.05, 0.9, 0, 0.0], ['coal_ore', 2, 1, 0.05, 0.55, 0, 0.4], ['copper_ore', 2, 1, 0.045, 0.55, 0, 0.4],
  ['iron_ore', 2, 1, 0.045, 0.55, 0, 0.4], ['gold_ore', 2, 1, 0.045, 0.55, 0, 0.4], ['azurite_ore', 2, 1, 0.06, 0.55, 0, 0.3],
  ['ember_ore', 2, 1, 0.06, 0.55, 0, 0.3], ['bedrock', 2, 2, 0.07, 0.5, 0, 0.2], ['obsidian', 2, 2, 0.02, 0.6, 0, 0.0],
  ['thatch', 1, 0, 0.05, 0.4, 1, 0.8], ['glass', 1, 3, 0, 0.0, 0, 0.0], ['lamp', 1, 3, 0, 0.6, 0, 0.0],
  ['iron', 1, 0, 0, 0.5, 0, 0.0], ['table_top', 1, 3, 0.012, 0.6, 0, 0.4], ['table_side', 1, 3, 0.015, 0.6, 0, 0.5],
  ['furnace_front', 1, 3, 0.04, 0.7, 0, 0.4], ['furnace_side', 1, 3, 0.04, 0.7, 0, 0.4], ['chest_wood', 1, 3, 0, 0.5, 0, 0.4],
  ['door', 1, 3, 0, 0.4, 0, 0.4], ['cloth', 1, 3, 0, 0, 0, 0.9], ['skin', 1, 3, 0, 0, 3, 0.2], ['leather', 1, 3, 0, 0, 0, 0.5],
  ['leaf_oak', 1, 3, 0, 0, 1, 0.2], ['leaf_birch', 1, 3, 0, 0, 1, 0.2], ['leaf_pine', 1, 3, 0, 0, 1, 0.2],
  ['leaf_blossom', 1, 3, 0, 0, 1, 0.2], ['leaf_willow', 1, 3, 0, 0, 1, 0.2],
  ['plant_grass', 1, 3, 0, 0, 1, 0.2], ['plant_fern', 1, 3, 0, 0, 1, 0.2], ['flower_red', 1, 3, 0, 0, 1, 0.2],
  ['flower_blue', 1, 3, 0, 0, 1, 0.2], ['flower_yellow', 1, 3, 0, 0, 1, 0.2], ['flower_white', 1, 3, 0, 0, 1, 0.2],
  ['bush', 1, 3, 0, 0, 1, 0.2], ['berry_bush', 1, 3, 0, 0, 1, 0.2], ['dead_bush', 1, 3, 0, 0, 1, 0.5], ['reeds', 1, 3, 0, 0, 1, 0.2],
  ['lily', 1, 3, 0, 0, 1, 0.0], ['mushroom_cap', 1, 3, 0, 0, 1, 0.3], ['mushroom_stem', 1, 3, 0, 0, 1, 0.5],
  ['glow_cap', 1, 3, 0, 0, 1, 0.1], ['crystal_azure', 1, 3, 0, 0, 4, 0.0], ['crystal_amber', 1, 3, 0, 0, 4, 0.0],
  ['seagrass', 1, 3, 0, 0, 1, 0.0], ['kelp', 1, 3, 0, 0, 1, 0.0], ['lava', 6, 1, 0, 0, 5, 0.0], ['charwood', 1, 3, 0, 0, 0, 0.3],
];
const LAYER = {};
LAYER_DEFS.forEach((d, i) => { LAYER[d[0]] = i; });
const LAYER_COUNT = LAYER_DEFS.length;
const FIRST_CUTOUT_LAYER = LAYER.leaf_oak;

// ---------------------------------------------------------------- blocks
const BLOCKS = [];
const B = {};
function defBlock(key, name, o) {
  const id = BLOCKS.length;
  const t = o.tex || 'stone';
  const faces = Array.isArray(t) ? t : [t, t, t];
  const b = Object.assign({
    id, key, name, kind: 'cube', opaque: true, solid: true, light: 15, emit: null, hardness: 1.5, tool: 'pick', tier: 0,
    drop: key, sound: 'stone', tint: 0, group: 'building', replaceable: false,
  }, o);
  b.layers = [LAYER[faces[0]], LAYER[faces[1]], LAYER[faces[2]]]; // top, bottom, side
  if (b.kind !== 'cube') {
    if (o.opaque === undefined) b.opaque = false;
    if (o.light === undefined) b.light = 0;
  }
  BLOCKS.push(b);
  B[key] = id;
}
const nat = { group: 'natural' };
defBlock('air', 'Air', { kind: 'air', solid: false, replaceable: true, drop: null });
defBlock('stone', 'Granite', { ...nat, tex: 'stone', hardness: 1.8, tier: 1, drop: 'cobble' });
defBlock('limestone', 'Limestone', { ...nat, tex: 'limestone', hardness: 1.6, tier: 1 });
defBlock('slate', 'Slate', { ...nat, tex: 'slate', hardness: 2.0, tier: 1 });
defBlock('basalt', 'Basalt', { ...nat, tex: 'basalt', hardness: 2.4, tier: 1 });
defBlock('sandstone', 'Sandstone', { ...nat, tex: 'sandstone', hardness: 1.2, tier: 1 });
defBlock('red_sandstone', 'Red Sandstone', { ...nat, tex: 'red_sandstone', hardness: 1.2, tier: 1 });
defBlock('pale_sandstone', 'Pale Sandstone', { ...nat, tex: 'pale_sandstone', hardness: 1.2, tier: 1 });
defBlock('terracotta', 'Ochre Claystone', { ...nat, tex: 'terracotta', hardness: 1.4, tier: 1 });
defBlock('dirt', 'Soil', { ...nat, tex: 'dirt', hardness: 0.7, tool: 'shovel', sound: 'gravel' });
defBlock('grass', 'Turf', { ...nat, tex: ['grass_top', 'dirt', 'grass_side'], hardness: 0.75, tool: 'shovel', sound: 'grass', drop: 'dirt', tint: 1 });
defBlock('forest_floor', 'Forest Litter', { ...nat, tex: ['forest_top', 'dirt', 'forest_side'], hardness: 0.75, tool: 'shovel', sound: 'grass', drop: 'dirt' });
defBlock('mud', 'Peat Mud', { ...nat, tex: 'mud', hardness: 0.8, tool: 'shovel', sound: 'gravel' });
defBlock('sand', 'Sand', { ...nat, tex: 'sand', hardness: 0.6, tool: 'shovel', sound: 'sand' });
defBlock('red_sand', 'Rust Sand', { ...nat, tex: 'red_sand', hardness: 0.6, tool: 'shovel', sound: 'sand' });
defBlock('gravel', 'River Gravel', { ...nat, tex: 'gravel', hardness: 0.8, tool: 'shovel', sound: 'gravel' });
defBlock('scree', 'Scree', { ...nat, tex: 'scree', hardness: 1.0, tool: 'shovel', sound: 'gravel' });
defBlock('snow', 'Snow', { ...nat, tex: 'snow', hardness: 0.4, tool: 'shovel', sound: 'snow' });
defBlock('snowy_grass', 'Frozen Turf', { ...nat, tex: ['snow', 'dirt', 'snow_side'], hardness: 0.7, tool: 'shovel', sound: 'snow', drop: 'dirt' });
defBlock('ice', 'Ice', { ...nat, tex: 'ice', hardness: 0.8, sound: 'glass', light: 3 });
defBlock('packed_ice', 'Glacier Ice', { ...nat, tex: 'packed_ice', hardness: 1.4, sound: 'glass' });
defBlock('clay', 'River Clay', { ...nat, tex: 'clay', hardness: 0.8, tool: 'shovel', sound: 'gravel' });
defBlock('moss_block', 'Moss Cushion', { ...nat, tex: 'moss', hardness: 0.6, tool: 'shovel', sound: 'grass' });
defBlock('cobble', 'Fieldstone', { tex: 'cobble', hardness: 1.9, tier: 1 });
defBlock('mossy_cobble', 'Mossy Fieldstone', { tex: 'mossy_cobble', hardness: 1.9, tier: 1 });
defBlock('stone_bricks', 'Dressed Ashlar', { tex: 'stone_bricks', hardness: 2.0, tier: 1 });
defBlock('clay_bricks', 'Fired Brick', { tex: 'clay_bricks', hardness: 1.8, tier: 1 });
defBlock('oak_planks', 'Oak Planks', { tex: 'oak_planks', hardness: 1.2, tool: 'axe', sound: 'wood' });
defBlock('birch_planks', 'Birch Planks', { tex: 'birch_planks', hardness: 1.2, tool: 'axe', sound: 'wood' });
defBlock('pine_planks', 'Pine Planks', { tex: 'pine_planks', hardness: 1.2, tool: 'axe', sound: 'wood' });
const logDef = (key, name, bark, end) => defBlock(key, name, { ...nat, tex: [end, end, bark], hardness: 1.4, tool: 'axe', sound: 'wood', axis: true });
logDef('oak_log', 'Oak Log', 'oak_bark', 'oak_end');
logDef('birch_log', 'Birch Log', 'birch_bark', 'birch_end');
logDef('pine_log', 'Pine Log', 'pine_bark', 'pine_end');
logDef('cypress_log', 'Cypress Log', 'cypress_bark', 'cypress_end');
logDef('rosewood_log', 'Blossomwood Log', 'rosewood_bark', 'rosewood_end');
const leafDef = (key, name, tex, tint) => defBlock(key, name, { ...nat, kind: 'leaves', tex, hardness: 0.25, tool: null, sound: 'leaves', light: 1, tint });
leafDef('oak_leaves', 'Oak Foliage', 'leaf_oak', 2);
leafDef('birch_leaves', 'Birch Foliage', 'leaf_birch', 2);
leafDef('pine_leaves', 'Pine Boughs', 'leaf_pine', 0);
leafDef('blossom_leaves', 'Blossom Canopy', 'leaf_blossom', 0);
leafDef('willow_leaves', 'Willow Fronds', 'leaf_willow', 2);
defBlock('cactus', 'Barrel Cactus', { ...nat, tex: ['cactus_top', 'cactus_top', 'cactus_side'], hardness: 0.6, tool: null, sound: 'cloth' });
defBlock('coral_pink', 'Rose Coral', { ...nat, tex: 'coral_pink', hardness: 0.8 });
defBlock('coral_orange', 'Flame Coral', { ...nat, tex: 'coral_orange', hardness: 0.8 });
defBlock('coral_violet', 'Violet Coral', { ...nat, tex: 'coral_violet', hardness: 0.8 });
defBlock('coal_ore', 'Coal Seam', { ...nat, tex: 'coal_ore', hardness: 2.2, tier: 1, drop: 'item:coal' });
defBlock('copper_ore', 'Copper Lode', { ...nat, tex: 'copper_ore', hardness: 2.4, tier: 2, drop: 'item:raw_copper' });
defBlock('iron_ore', 'Iron Lode', { ...nat, tex: 'iron_ore', hardness: 2.6, tier: 2, drop: 'item:raw_iron' });
defBlock('gold_ore', 'Gold Vein', { ...nat, tex: 'gold_ore', hardness: 2.6, tier: 3, drop: 'item:raw_gold' });
defBlock('azurite_ore', 'Skyglass Geode', { ...nat, tex: 'azurite_ore', hardness: 3.0, tier: 4, drop: 'item:skyglass', emit: [1, 3, 5] });
defBlock('ember_ore', 'Emberstone', { ...nat, tex: 'ember_ore', hardness: 3.0, tier: 3, drop: 'item:ember_shard', emit: [5, 2, 0] });
defBlock('bedrock', 'Deeprock', { ...nat, tex: 'bedrock', hardness: Infinity, drop: null });
defBlock('obsidian', 'Obsidian', { ...nat, tex: 'obsidian', hardness: 6, tier: 4 });
defBlock('thatch', 'Thatch', { tex: 'thatch', hardness: 0.6, tool: 'axe', sound: 'grass' });
defBlock('glass', 'Glass Pane', { kind: 'glass', tex: 'glass', hardness: 0.35, tool: null, sound: 'glass', drop: null });
defBlock('lamp', 'Hearth Lamp', { tex: 'lamp', hardness: 0.5, tool: null, sound: 'glass', emit: [13, 11, 8] });
defBlock('torch', 'Torch', { kind: 'torch', solid: false, tex: 'charwood', hardness: 0.05, tool: null, sound: 'wood', emit: [13, 10, 6] });
const crystalDef = (key, name, tex, emit) => defBlock(key, name, { ...nat, kind: 'crystal', solid: false, tex, hardness: 0.8, sound: 'glass', emit });
crystalDef('crystal_azure', 'Azure Crystal', 'crystal_azure', [2, 6, 9]);
crystalDef('crystal_amber', 'Amethyst Bloom', 'crystal_amber', [5, 3, 6]);
defBlock('glowshroom', 'Lantern Fungus', { ...nat, kind: 'cross', solid: false, tex: 'glow_cap', hardness: 0.1, tool: null, sound: 'grass', emit: [2, 5, 4] });
defBlock('crafting_table', 'Joiner’s Bench', { kind: 'model', tex: ['table_top', 'oak_planks', 'table_side'], hardness: 1.4, tool: 'axe', sound: 'wood', use: 'craft', group: 'functional', light: 1 });
defBlock('furnace', 'Kiln Furnace', { kind: 'model', tex: 'furnace_side', hardness: 2.0, tier: 1, use: 'furnace', group: 'functional', light: 2 });
defBlock('chest', 'Storage Chest', { kind: 'chest', tex: 'chest_wood', hardness: 1.4, tool: 'axe', sound: 'wood', use: 'chest', group: 'functional' });
defBlock('door', 'Plank Door', { kind: 'door', tex: 'door', hardness: 1.2, tool: 'axe', sound: 'wood', use: 'door', group: 'functional' });
defBlock('ladder', 'Rung Ladder', { kind: 'ladder', solid: false, tex: 'oak_planks', hardness: 0.4, tool: 'axe', sound: 'wood', group: 'functional' });
const plantDef = (key, name, tex, o = {}) => defBlock(key, name, { ...nat, kind: 'cross', solid: false, tex, hardness: 0.02, tool: null, sound: 'grass', replaceable: false, ...o });
plantDef('tall_grass', 'Meadow Grass', 'plant_grass', { tint: 1, replaceable: true, drop: null });
plantDef('fern', 'Fern', 'plant_fern', { tint: 2 });
plantDef('flower_red', 'Emberbell', 'flower_red');
plantDef('flower_blue', 'Skyspire', 'flower_blue');
plantDef('flower_yellow', 'Sunmote', 'flower_yellow');
plantDef('flower_white', 'Moonpetal', 'flower_white');
plantDef('bush', 'Shrub', 'bush', { tint: 2, hardness: 0.2 });
plantDef('berry_bush', 'Duskberry Bush', 'berry_bush', { hardness: 0.2, drop: 'item:berries' });
plantDef('dead_bush', 'Dry Brush', 'dead_bush', { replaceable: true, drop: 'item:stick' });
plantDef('reeds', 'Reeds', 'reeds');
plantDef('lily_pad', 'Lily Pad', 'lily');
plantDef('mushroom', 'Field Mushroom', 'mushroom_cap', { drop: 'item:mushroom' });
plantDef('pebbles', 'Pebbles', 'gravel', { sound: 'gravel' });
plantDef('seagrass', 'Seagrass', 'seagrass', { waterlogged: true, drop: null });
plantDef('kelp', 'Kelp', 'kelp', { waterlogged: true });
defBlock('water', 'Water', { ...nat, kind: 'water', solid: false, tex: 'glass', hardness: Infinity, light: 2, replaceable: true, drop: null, sound: 'water' });
defBlock('lava', 'Lava', { ...nat, kind: 'lava', solid: false, tex: 'lava', hardness: Infinity, light: 1, replaceable: true, drop: null, emit: [15, 7, 2] });
defBlock('stone_slab', 'Ashlar Slab', { kind: 'slab', tex: 'stone_bricks', hardness: 1.8, tier: 1 });
defBlock('wood_slab', 'Oak Slab', { kind: 'slab', tex: 'oak_planks', hardness: 1.0, tool: 'axe', sound: 'wood' });
defBlock('iron_block', 'Iron Block', { tex: 'iron', hardness: 3.0, tier: 2, sound: 'metal' });
defBlock('campfire', 'Campfire', { kind: 'campfire', solid: false, tex: 'charwood', hardness: 0.6, tool: 'axe', sound: 'wood', emit: [14, 10, 5], group: 'functional' });

const BLOCK_COUNT = BLOCKS.length;
// fast lookup tables
const T_OPAQUE = new Uint8Array(256), T_SOLID = new Uint8Array(256), T_LIGHT = new Uint8Array(256);
const T_EMIT_R = new Uint8Array(256), T_EMIT_G = new Uint8Array(256), T_EMIT_B = new Uint8Array(256);
const KIND = { air: 0, cube: 1, leaves: 2, cross: 3, water: 4, lava: 5, model: 6, torch: 7, glass: 8, slab: 9, door: 10, chest: 11, ladder: 12, crystal: 13, campfire: 14 };
const T_KIND = new Uint8Array(256);
const T_AXIS = new Uint8Array(256);
for (const b of BLOCKS) if (b.axis) T_AXIS[b.id] = 1;
// a limb is a log voxel drawn as a tapered branch: it must not hide its neighbours' faces
const LIMB_VOL = 255;
T_SOLID[LIMB_VOL] = 1; T_LIGHT[LIMB_VOL] = 1;
for (const b of BLOCKS) {
  T_OPAQUE[b.id] = b.opaque ? 1 : 0;
  T_SOLID[b.id] = b.solid ? 1 : 0;
  T_LIGHT[b.id] = b.light;
  T_KIND[b.id] = KIND[b.kind];
  if (b.emit) { T_EMIT_R[b.id] = b.emit[0]; T_EMIT_G[b.id] = b.emit[1]; T_EMIT_B[b.id] = b.emit[2]; }
}

const CHUNK = 16, WORLD_H = 256, SEA = 72;
const bidx = (x, y, z) => x | (z << 4) | (y << 8); // local index inside a chunk

const BIOME = { OCEAN: 0, REEF: 1, BEACH: 2, MEADOW: 3, FOREST: 4, GROVE: 5, DESERT: 6, MESA: 7, TAIGA: 8, SWAMP: 9, MOUNTAIN: 10 };
const BIOME_NAMES = ['Open Ocean', 'Coral Shallows', 'Shoreline', 'Meadow', 'Broadleaf Forest', 'Blossom Grove', 'Dune Desert', 'Layered Mesa', 'Snow Taiga', 'Peat Swamp', 'High Peaks'];

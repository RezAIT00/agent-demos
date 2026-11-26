// THE PROGRAM. These strings are what types on screen AND what runs: at each `enter` time the engine
// executes the string with new Function() against `world`, and the picture reads nothing else.
// `steps` are live edits: [time, text on screen, cursor index].
const glass = { ior: 1.52, stained: true, frozen: true };
const PROGRAM = [
  { type: [0.10, 0.80], enter: 1.00, code: 'sea.wind = 38' },
  { type: [4.05, 4.65], enter: 5.00, code: 'wave.height = 54' },
  { type: [8.30, 8.78], enter: 9.00, code: 'water = glass' },
  // the line arrives as "= 6", the 6 is deleted and 18 typed over it: a whole day passes
  { type: [10.28, 10.58], enter: 11.00, code: 'sky.hour = 18', from: 'sky.hour = 6', steps: [[10.68, 'sky.hour = '], [10.78, 'sky.hour = 1'], [10.88, 'sky.hour = 18']] },
  { type: [13.25, 13.62], enter: 14.00, code: 'shards.fly()' },
  { type: [18.22, 18.78], enter: 19.00, code: 'city.floors = 160' },
  // arrives as 9.8; the cursor walks back three places and a minus goes in front of the 9
  { type: [25.40, 25.80], enter: 27.00, code: 'gravity = -9.8', from: 'gravity = 9.8', steps: [[26.10, 'gravity = 9.8', 12], [26.20, 'gravity = 9.8', 11], [26.30, 'gravity = 9.8', 10], [26.52, 'gravity = -9.8', 11], [26.72, 'gravity = -9.8', 14]] },
  { type: [33.45, 34.10], enter: 35.00, code: 'time.scale = 1e15' },
  { type: [41.90, 42.30], enter: 43.00, code: 'collapse()' },
];
const FINALE = { lines: ["I'm Opus.", 'What should we make?'], cursorAt: 45.95, slide: [46.55, 46.95], type: [47.05, 49.85] };
const DURATION = 55.0;
function makeWorld() {
  const w = { sea: { wind: 0 }, wave: { height: 0 }, water: null, sky: { hour: 6 }, city: { floors: 0 }, gravity: 9.8, time: { scale: 1 }, collapsed: false, flying: false };
  w.shards = { fly: () => { w.flying = true; } }; w.collapse = () => { w.collapsed = true; }; return w;
}
function execLine(world, code) { new Function('world', 'glass', 'with(world){' + code + '}')(world, glass); }
// Values reached after each line, read back from the world the code produced.
const VALUES = (() => {
  const w = makeWorld(), out = [];
  for (const L of PROGRAM) { execLine(w, L.code); out.push({ t: L.enter, wind: w.sea.wind, height: w.wave.height, glass: w.water === glass ? 1 : 0, hour: w.sky.hour, fly: w.flying, floors: w.city.floors, g: w.gravity, ts: w.time.scale, col: w.collapsed }); }
  return out;
})();
const V_WIND = VALUES[0].wind, V_HEIGHT = VALUES[1].height, V_HOUR0 = makeWorld().sky.hour, V_HOUR1 = VALUES[3].hour;
const V_FLOORS = VALUES[5].floors, V_G0 = makeWorld().gravity, V_G1 = VALUES[6].g, V_TSCALE = VALUES[7].ts;
const T_SEA = PROGRAM[0].enter, T_WAVE = PROGRAM[1].enter, T_GLASS = PROGRAM[2].enter, T_SUN = PROGRAM[3].enter, T_FLY = PROGRAM[4].enter;
const T_CITY = PROGRAM[5].enter, T_GRAV = PROGRAM[6].enter, T_TIME = PROGRAM[7].enter, T_COLL = PROGRAM[8].enter, T_SMASH = 12.935;
if (!VALUES[4].fly || !VALUES[8].col || !VALUES[2].glass) throw new Error('program did not run');

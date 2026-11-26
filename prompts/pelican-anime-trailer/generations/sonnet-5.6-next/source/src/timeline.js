// ---------- single source of truth for picture and sound ----------
// 160 BPM: one beat = 0.375 s = 9 frames at 24 fps.
const TL = (() => {
  const BPM = 160, BEAT = 60 / BPM, FPS = 24, DURATION = 72;
  const b = x => x * BEAT;
  // id, first beat, last beat, sound bed {speed m/s, pedal, rain, wind, crowd, coast}
  const SHOTS = [
    ['eye', 0, 3], ['click', 3, 6], ['grip', 6, 8],
    ['card1', 8, 10], ['card2', 10, 12], ['card3', 12, 16], ['svg', 16, 22], ['shatter', 22, 24, { wind: 0.7 }],
    ['wobble', 24, 28, { speed: 2.6, pedal: 1, wind: 0.18 }], ['crash', 28, 30], ['fallcard', 30, 32],
    ['rain', 32, 35, { speed: 6.5, pedal: 1, rain: 1, wind: 0.35 }], ['rainfall', 35, 37, { rain: 1 }], ['againcard', 37, 38, { rain: 0.4 }],
    ['down', 38, 42, { rain: 0.85 }], ['slam', 42, 44, { rain: 0.6 }], ['scarf', 44, 48, { wind: 0.7, rain: 0.12 }],
    ['split', 48, 52, { speed: 8, pedal: 1, wind: 0.4 }], ['night', 52, 56, { speed: 9, pedal: 1, wind: 0.5 }], ['dawn', 56, 64, { speed: 7.5, pedal: 1, wind: 0.4 }],
    ['rwheel', 64, 68, { speed: 3, coast: 1 }], ['reye', 68, 72], ['rhero', 72, 80, { wind: 0.6 }], ['versus', 80, 84, { wind: 0.3 }],
    ['start', 84, 90, { wind: 0.35 }], ['charge', 90, 96, { speed: 19, pedal: 1, wind: 0.9 }], ['side', 96, 102, { speed: 23, pedal: 1, wind: 1.0 }],
    ['sparks', 102, 106, { speed: 21, coast: 1, wind: 0.8 }], ['hairpin', 106, 114, { speed: 14, coast: 1, wind: 0.7 }], ['taunt', 114, 118, { speed: 20, coast: 1, wind: 0.75 }],
    ['ramp', 118, 122, { speed: 20, pedal: 1, wind: 0.95 }], ['leap', 122, 128, { speed: 18, coast: 1, wind: 0.6 }],
    ['falling', 128, 134, { coast: 1, speed: 4, wind: 0.28 }], ['flashback', 134, 138], ['eyesnap', 138, 140], ['ignite', 140, 142, { wind: 0.5 }],
    ['scream', 142, 144], ['roar', 144, 148, { speed: 20, pedal: 1, wind: 1.0 }], ['fly', 148, 152, { speed: 24, pedal: 1, wind: 1.0 }],
    ['overtake', 152, 156, { speed: 26, pedal: 1, wind: 1.0 }], ['finish', 156, 160, { speed: 8, coast: 1, wind: 0.5 }],
    ['title', 160, 176, { wind: 0.12 }], ['aftermath', 176, 182, { wind: 0.16 }], ['pouch', 182, 189, { wind: 0.1 }], ['gulp', 189, 192, { wind: 0.08 }]
  ];
  const shots = SHOTS.map(([id, a, z, bed]) => ({ id, a, z, t0: b(a), t1: b(z), bed: bed || {} }));
  const byId = Object.fromEntries(shots.map(s => [s.id, s]));
  // ink-inverted impact frames: [beat, style]  (2 frames each)
  const IMPACTS = [[28, 1], [72, 2], [144, 1], [153, 1], [160, 2]];
  // fish tumble out of the pouch in the stinger: release beats
  const FISH = Array.from({ length: 11 }, (_, i) => 183.2 + i * 0.24 + (i % 3) * 0.04);
  // sound effects: [beat, type, gain, pan, extra]
  const SFX = [
    [0.05, 'heart', 1.0], [1.0, 'heart', 1.15], [0.5, 'revcym', 0.55, 0, 1.5], [2.0, 'shing', 1.0], [2.0, 'boom', 0.8],
    [3.3, 'whoosh', 0.5, 0.2], [4.0, 'click', 1.0], [4.0, 'boom', 0.5], [4.15, 'chainsnap', 0.8], [5.1, 'ratchet', 0.5],
    [6.35, 'creak', 0.8], [6.95, 'creak', 0.6], [6.4, 'thud', 0.45],
    [16, 'plink', 1.0, 0, 0], [18, 'plink', 1.0, 0, 1], [20, 'plink', 1.0, 0, 2], [21.55, 'crack', 1.0], [22, 'shatter', 1.0], [22.05, 'whoosh', 0.9], [23, 'whoosh', 0.45, -0.3],
    [24.3, 'boing', 0.5, -0.2], [25.4, 'boing', 0.4, 0.3], [26.6, 'boing', 0.55, 0], [26.2, 'squawk', 0.28, 0, 'yelp'],
    [27.75, 'whoosh', 0.6], [28, 'crash', 1.0], [28.9, 'thud', 0.9, 0.2], [29.5, 'clatter', 0.7, 0.3],
    [34.6, 'whoosh', 0.5], [35, 'splash', 1.0], [35.05, 'crash', 0.55], [35.9, 'thud', 0.6], [38.6, 'thunder', 0.8, -0.4],
    [40.5, 'shing', 0.5], [42, 'splash', 0.85], [42, 'boom', 0.85], [42.8, 'creak', 0.4],
    [44.9, 'cloth', 0.8], [46.0, 'snap', 1.0], [46.05, 'whoosh', 0.7, -0.4],
    [48, 'whoosh', 0.7, -0.6], [49, 'whoosh', 0.7, 0.6], [50, 'whoosh', 0.8, 0], [52, 'whoosh', 0.6, 0.3], [53.5, 'pass', 0.5], [54.75, 'pass', 0.5], [56, 'shimmer', 0.7],
    [64.0, 'hum', 0.9, 0, 4], [66.4, 'gleam', 0.8, 0.3], [69.5, 'shing2', 1.0], [72, 'boom', 1.0], [72, 'thunderclap', 0.8], [74.5, 'thunder', 0.9, 0.5], [76, 'slamhit', 0.7], [78.2, 'thunder', 0.6, -0.5],
    [80, 'whoosh', 0.9, -0.7], [80.25, 'whoosh', 0.9, 0.7], [81, 'slamhit', 1.0], [81.1, 'sparks', 0.8, 0, 1.2], [82.2, 'wriggle', 0.75, -0.4], [83.1, 'wriggle', 0.5, -0.4],
    [85, 'beep', 0.8, 0, 0], [86, 'beep', 0.8, 0, 0], [87, 'beep', 0.8, 0, 0], [88, 'beep', 1.0, 0, 1], [88, 'whoosh', 1.0, 0], [88.1, 'chainsnap', 0.7],
    [93, 'pass', 0.7, 0.4], [96, 'whoosh', 0.8, -0.5], [99.2, 'pass', 0.9, 0.2], [99.9, 'wriggle', 0.4, 0],
    [102, 'whoosh', 0.7], [102.1, 'sparks', 1.0, 0.1, 3.6], [102.2, 'grind', 0.8, 0, 3.4],
    [106, 'whoosh', 0.8, 0.5], [106.5, 'skid', 1.0, 0.1, 6.4], [110.5, 'sparks', 0.5, -0.3, 2.0],
    [114, 'whoosh', 0.7], [115.4, 'squawk', 0.30, 0.3, 'falcon'], [118, 'whoosh', 0.8], [120.6, 'clatter', 0.6], [121.5, 'whoosh', 1.0], [122, 'boom', 0.8],
    [124, 'slowmo', 0.8, 0, 4], [128.2, 'heart', 0.9], [130.2, 'heart', 0.8], [132.2, 'heart', 0.7], [133.0, 'revcym', 0.5, 0, 1.0],
    [134, 'flashhit', 0.8], [135, 'flashhit', 0.85], [136, 'flashhit', 0.9], [137, 'flashhit', 1.0],
    [138.5, 'shing', 1.0], [139.0, 'heart', 1.2], [140, 'ignite', 1.0], [140.2, 'auraroar', 0.8, 0, 1.75],
    [144, 'boom', 1.2], [144.05, 'squawk', 1.0, 0, 'battle'], [144.1, 'auraroar', 0.9, 0, 8.0], [148, 'whoosh', 1.0, -0.5],
    [152.6, 'pass', 1.0, -0.2], [153, 'boom', 1.0], [153.1, 'whoosh', 1.0, 0.7], [154.4, 'squawk', 0.38, 0.4, 'falcon'],
    [156, 'whoosh', 0.7], [156.9, 'thud', 0.9], [157.0, 'skid', 0.85, 0.2, 2.2], [158.9, 'snap', 0.6],
    [160, 'boom', 1.2], [160, 'slamhit', 1.0], [160.75, 'slamhit', 0.55], [161.5, 'slamhit', 0.65], [164, 'slamhit', 0.45], [166, 'click', 0.5], [168, 'slamhit', 0.6],
    [176.3, 'pant', 0.8, 0.35], [177.6, 'pant', 0.7, 0.35], [179.2, 'pant', 0.55, 0.35], [180.6, 'cricket', 0.5], [182.4, 'creak', 0.5, -0.3], [182.95, 'unroll', 1.0, -0.3],
    ...FISH.map((f, i) => [f + 0.95, 'flop', 0.9 - (i % 4) * 0.08, -0.35 + (i % 5) * 0.2, i]),
    [187.4, 'flop', 0.5, 0.1, 12], [188.4, 'flop', 0.4, -0.2, 13], [189.25, 'wriggle', 0.5], [189.8, 'slurp', 0.9], [190.35, 'gulp', 1.0], [191.2, 'ding', 0.8]
  ];
  const shotAt = t => { let s = shots[0]; for (const q of shots) if (t >= q.t0 - 1e-6) s = q; return s; };
  return { BPM, BEAT, FPS, DURATION, shots, byId, IMPACTS, FISH, SFX, b, shotAt, cuts: () => shots.slice(1).map(s => +s.t0.toFixed(4)) };
})();

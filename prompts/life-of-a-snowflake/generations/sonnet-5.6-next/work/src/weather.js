// The scripted air the crystal falls through, and how that air maps onto the
// Gravner–Griffeath parameters.
//
//   rho  (far-field vapour)       = 0.045 * supersaturation over ice [%]
//   beta (attachment barrier for tips and flat prism faces) is lowest at -15 °C,
//   rises toward both plate shoulders, and rises further as the air dries.
//
// Low beta + high rho  -> branching (dendrites).   High beta -> faceted plates.
function nakaya(T, S) {
  const dT = T + 15;
  const shoulder = dT > 0 ? 0.18 * dT : 0.045 * dT * dT;
  const dry = Math.max(0, 14 - S);
  return {
    rho: 0.045 * S,
    beta: 1.30 + shoulder * (1 + 0.126 * dry),
    alpha: 0.08, theta: 0.025, kappa: 0.003, mu: 0.07, gamma: 0.00005,
  };
}

// [first step, temperature °C, supersaturation over ice %, label]
// Temperature rises as the crystal sinks, apart from one updraught that lofts it
// back into the -15 °C layer.
const HERO_TIMELINE = [
  [0,     -19.4, 13.8, 'young plate'],
  [2290,  -19.4, 10.2, 'dry pocket: first rib'],
  [4790,  -19.4, 14.7, 'plate'],
  [9815,  -19.4, 10.2, 'dry pocket: second rib'],
  [12315, -19.4, 14.7, 'plate'],
  [18530, -16.5, 10.7, 'six arms'],
  [42956, -15.0, 16.7, 'humidity spike: side branches'],
  [44595, -13.3,  8.9, 'dry layer: waist plates'],
  [51595, -15.2, 14.7, 'updraught: second branches'],
  [54108, -12.8, 12.9, 'humidity falls: sectored plates'],
  [67760, -11.2, 10.4, 'dry cloud base: facets'],
];
const HERO_STEPS = 73760;

function timelineEnv(timeline, endStep, ease) {
  ease = ease || 120;
  let k = 0;
  return function (step) {
    if (step >= endStep) return { done: true };
    while (k + 1 < timeline.length && step >= timeline[k + 1][0]) k++;
    const cur = timeline[k], prev = timeline[Math.max(0, k - 1)];
    const w = Math.min(1, (step - cur[0]) / ease);
    const p = nakaya(prev[1], prev[2]), q = nakaya(cur[1], cur[2]);
    q.rho = p.rho + (q.rho - p.rho) * w;
    q.beta = p.beta + (q.beta - p.beta) * w;
    return q;
  };
}

// Kinds of air a neighbouring flake may have fallen through: [T °C, S %].
const AIR = {
  plate: [-19.4, 13.8], dryPocket: [-19.4, 10.2], arms: [-16.5, 10.7], burst: [-15.0, 16.7],
  dry: [-13.3, 8.9], updraught: [-15.2, 14.7], sector: [-12.8, 12.9], facet: [-11.2, 10.4],
  fern: [-15.0, 17.8], broad: [-14.0, 15.8],
};

// Each neighbour flake gets its own randomly scripted sequence of layers:
// [radius fraction that ends the layer, T, S, most steps it may last]
function neighbourHistory(seed) {
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const jit = (name, r, maxSteps) => {
    const a = AIR[name];
    return [r, a[0] + (rnd() - 0.5) * 0.5, a[1] + (rnd() - 0.5) * 0.9, maxSteps || 16000];
  };
  const family = seed % 6;
  const L = [];
  const core = 0.08 + rnd() * 0.22;
  L.push(jit('plate', core * 0.55, 12000));
  if (rnd() < 0.6) L.push(jit('dryPocket', core * 0.62, 2200));
  L.push(jit('plate', core, 14000));
  if (family === 0) {            // stellar dendrite
    L.push(jit('arms', 0.38 + rnd() * 0.2)); L.push(jit('burst', 1.0, 30000));
  } else if (family === 1) {     // sectored plate
    L.push(jit('arms', 0.3 + rnd() * 0.25)); L.push(jit('sector', 1.0, 40000));
  } else if (family === 2) {     // dendrite with plate tips
    L.push(jit('updraught', 0.55 + rnd() * 0.2)); L.push(jit('sector', 0.92, 30000)); L.push(jit('facet', 1.0, 6000));
  } else if (family === 3) {     // fern
    L.push(jit('arms', core + 0.12)); L.push(jit('fern', 1.0, 30000));
  } else if (family === 4) {     // stop-and-go star
    L.push(jit('burst', 0.4 + rnd() * 0.1)); L.push(jit('dry', 0.55 + rnd() * 0.1, 4000 + rnd() * 5000));
    L.push(jit('updraught', 0.82 + rnd() * 0.1)); L.push(jit(rnd() < 0.5 ? 'sector' : 'dry', 1.0, 14000));
  } else {                       // broad-branched crystal
    L.push(jit('arms', 0.35 + rnd() * 0.2)); L.push(jit('broad', 0.78 + rnd() * 0.12)); L.push(jit('facet', 1.0, 9000));
  }
  return L;
}

function layeredEnv(layers, R) {
  let k = 0, start = 0;
  return function (step, radius) {
    while (radius >= layers[k][0] * (R - 6) || step - start >= layers[k][3]) {
      if (k === layers.length - 1) return { done: true };
      k++; start = step;
    }
    const cur = layers[k], prev = layers[Math.max(0, k - 1)];
    const w = Math.min(1, (step - start) / 120);
    const p = nakaya(prev[1], prev[2]), q = nakaya(cur[1], cur[2]);
    q.rho = p.rho + (q.rho - p.rho) * w;
    q.beta = p.beta + (q.beta - p.beta) * w;
    return q;
  };
}

if (typeof module !== 'undefined') module.exports = { nakaya, HERO_TIMELINE, HERO_STEPS, timelineEnv, neighbourHistory, layeredEnv };

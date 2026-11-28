// The soundtrack of "Diary of a Snowflake": ambience, synced effects and a
// sparse celesta / felt-piano score, all synthesised here from seeded noise and
// sine partials. Cue times come from cues.json (see cues.js).
//   node synth.js            ->  snowflake.wav (48 kHz, 24-bit stereo, 20.000 s)
//   node synth.js --stems    ->  also writes stems/*.wav for inspection
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const D = require('./dsp.js');
const { SR, LEN, TAU, clamp, lerp, sstep, db, rng, SVF, pinkSource, Bus, env, bell, NOTE, partials, celesta, glass, piano, reverb, truePeakLimit, wav24 } = D;

const sheet = JSON.parse(fs.readFileSync(path.join(__dirname, 'cues.json'), 'utf8'));
const { cues, tracks, fps } = sheet;
const SPF = SR / fps;                               // 1600 samples per video frame
const at = (frame) => Math.round(frame * SPF);
const all = (id) => cues.filter((c) => c.id === id);
const one = (id) => { const c = all(id)[0]; if (!c) throw new Error('missing cue ' + id); return c; };
const F = (id) => one(id).frame;
const S = (id) => at(F(id));
// a per-frame control track read at sample i
const tr = (name, i) => { const x = clamp(i / SPF, 0, tracks[name].length - 1), k = Math.floor(x); return lerp(tracks[name][k], tracks[name][Math.min(k + 1, tracks[name].length - 1)], x - k); };
const envPts = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) if (t <= pts[k][0]) return lerp(pts[k - 1][1], pts[k][1], sstep(pts[k - 1][0], pts[k][0], t));
  return pts[pts.length - 1][1];
};
const sec = (frame) => frame / fps;

if (process.argv.includes('--templates')) Bus.log = [];
const bus = {
  wind: new Bus('wind'), valley: new Bus('valley'), air: new Bus('air'), nucleus: new Bus('nucleus'), lattice: new Bus('lattice'),
  chimes: new Bus('chimes'), landing: new Bus('landing'), pad: new Bus('pad'), keys: new Bus('keys'),
};

const tTouch = sec(F('touchdown'));
// a held breath just before the touchdown, so the tiny tick can be heard
const hush = envPts([[0, 1], [tTouch - 0.55, 1], [tTouch - 0.12, 0.22], [tTouch + 0.06, 0.20], [tTouch + 0.34, 0.76], [tTouch + 0.8, 0.9]]);

// ================================================================ cloud wind
// each layer of air has its own voice: [time, band centre Hz, Q, hiss, level]
function windShape() {
  const key = (id, fc, q, hiss, level) => [sec(F(id)), fc, q, hiss, level];
  const steps = [
    [0, 430, 1.4, 0.16, 0.82], key('lattice', 470, 1.4, 0.16, 0.86), key('arms', 640, 1.7, 0.26, 0.98), key('burst', 910, 1.1, 0.62, 1.12),
    key('dry', 1480, 5.5, 0.07, 0.74), key('updraught', 760, 1.9, 0.46, 1.20), key('sector', 520, 1.9, 0.19, 0.94), key('facets', 370, 1.2, 0.12, 0.86),
  ];
  return [1, 2, 3, 4].map((c) => {
    const pts = [[0, steps[0][c]]];
    for (let k = 1; k < steps.length; k++) pts.push([steps[k][0], steps[k - 1][c]], [steps[k][0] + 0.45, steps[k][c]]);
    return envPts(pts);
  });
}
{
  const [fcAt, qAt, hissAt, lvlAt] = windShape();
  for (let ch = 0; ch < 2; ch++) {
    const rn = rng(101 + ch), pink = pinkSource(rn), white = rng(201 + ch);
    const body = new SVF(), voice = new SVF(), hissHp = new SVF(), hissLp = new SVF();
    const out = ch ? bus.wind.R : bus.wind.L;
    const ph = [rn() * TAU, rn() * TAU, rn() * TAU];
    for (let i = 0; i < LEN; i++) {
      const t = i / SR;
      const open = tr('reveal', i);
      if (open >= 0.9999) continue;
      const gust = 1 + 0.22 * Math.sin(TAU * 0.23 * t + ph[0]) + 0.14 * Math.sin(TAU * 0.61 * t + ph[1]) + 0.07 * Math.sin(TAU * 1.7 * t + ph[2]);
      const speed = 0.52 + 0.48 * clamp(tr('fallSpeed', i) / 1.15, 0, 1.2);
      const fc = fcAt(t) * (1 + 0.22 * Math.sin(TAU * 0.37 * t + ph[1]) + 0.1 * (gust - 1)) * lerp(1, 0.42, open);
      const x = pink();
      body.run(x, lerp(300 + 120 * tr('mist', i), 160, open), 0.7);
      voice.run(x, fc, qAt(t));
      hissHp.run(white() * 2 - 1, 3200, 0.7); hissLp.run(hissHp.hp, lerp(8200, 3000, open), 0.7);
      const v = body.lp * 0.85 + voice.bp * (0.62 + 0.5 * Math.sqrt(qAt(t) / 2)) + hissLp.lp * hissAt(t) * 0.040 * tr('mist', i);
      out[i] += v * gust * speed * lvlAt(t) * Math.pow(1 - open, 1.3) * 0.60;
    }
  }
}

// mist bands: a whoosh that rises, loudest on the frame the band is thickest
all('band').forEach((c, k) => {
  const half = Math.floor(0.5 * SR), start = at(c.frame) - half;
  const random = rng(300 + k), pink = pinkSource(random), f = new SVF();
  const dir = k % 2 ? -1 : 1;
  for (let i = 0; i < half * 2; i++) {
    const u = (i - half) / half;
    f.run(pink(), 360 * Math.pow(6.2, (u + 1) / 2), 2.4);
    const v = f.bp * bell(u) * 0.62, a = (clamp(dir * u * 0.55, -1, 1) + 1) * Math.PI / 4;
    bus.air.put(start + i, v * Math.cos(a), v * Math.sin(a), 0.18);
  }
});

// light sliding across the faces: a faint, airy shimmer
all('sheen').forEach((c, k) => {
  const half = Math.floor(0.62 * SR), start = at(c.frame) - half;
  const random = rng(340 + k), a = new SVF(), b = new SVF();
  for (let i = 0; i < half * 2; i++) {
    const u = (i - half) / half;
    a.run(random() * 2 - 1, 6500 + 2200 * u, 3.5);
    b.run(random() * 2 - 1, 9800 - 1500 * u, 5.0);
    const g = bell(u) * 0.016;
    bus.air.put(start + i, a.bp * g, b.bp * g, 0.5);
  }
});

// ================================================================ nucleation
// vapour streaming in: sparse, minute hissing motes that follow the picture
{
  const random = rng(400);
  let i = 0;
  while (i < LEN) {
    const amt = tr('vapour', i);
    i += Math.max(60, Math.floor(-Math.log(1 - random()) * SR / (12 + amt * 85)));
    if (amt <= 0.01 || i >= LEN) continue;
    const f = new SVF(), fc = 3600 + random() * 6200, n = Math.floor((0.008 + random() * 0.022) * SR), noise = rng(i);
    bus.nucleus.voice(i, n, random() * 1.8 - 0.9, 0.030 * Math.min(1.2, amt), 0.3, (t, j) => f.run(noise() * 2 - 1, fc * (1 - 0.25 * j / n), 3.5).bp * Math.sin(Math.PI * j / n));
  }
}
// the grain catching the light
all('glint').forEach((c, k) => {
  const g = Math.min(1.9, c.strength);
  partials(bus.nucleus, at(c.frame), 4850 + 420 * k, [[1, 1, 0.065], [1.533, 0.55, 0.040], [2.31, 0.22, 0.022]], { gain: 0.050 * g * g * 0.6, pan: k ? 0.25 : -0.2, send: 0.5, attack: 0.001 });
});
// condensation: a soft wet swell with droplet plips
{
  const a = S('condense'), b = S('freeze');
  let phase = 0;
  const random = rng(410);
  bus.nucleus.voice(a, b - a + Math.floor(0.25 * SR), 0, 0.050, 0.35, (t) => {
    const u = clamp(t / ((b - a) / SR), 0, 1);
    phase += TAU * (228 + 150 * u + 6 * Math.sin(TAU * 7.3 * t) + 3 * Math.sin(TAU * 12.1 * t)) / SR;
    return (Math.sin(phase) + 0.25 * Math.sin(2 * phase + 1.3)) * sstep(0, 0.3, t) * (1 - sstep((b - a) / SR - 0.05, (b - a) / SR + 0.22, t));
  });
  let s = a, k = 0;
  while (s < b - 2000) {
    const u = (s - a) / (b - a);
    const f0 = 620 + 640 * random() + 260 * u;
    let ph = 0;
    bus.nucleus.voice(s, Math.floor(0.07 * SR), random() * 1.1 - 0.55, (k === 0 ? 0.11 : 0.045 + 0.05 * u), 0.35, (t) => {
      ph += TAU * f0 * (1 + 1.1 * (1 - Math.exp(-t / 0.018))) / SR;
      return Math.sin(ph) * env(t, 0.002, 0.016);
    });
    s += Math.floor((0.075 + random() * 0.15 * (1.3 - u)) * SR); k++;
  }
}
// the freezing front: crackling ice that travels across the droplet
{
  const c = one('freeze'), a = at(c.frame), b = at(c.endFrame);
  const random = rng(420);
  const click = (s, gain, pan) => {
    const f = new SVF(), fc = 2700 + random() * 5600, q = 5 + random() * 9, tau = 0.0012 + random() * 0.0042, noise = rng(s * 3 + 1);
    bus.nucleus.voice(s, Math.floor(tau * 9 * SR), pan, gain, 0.22, (t) => f.run(noise() * 2 - 1, fc, q).bp * env(t, 0.0003, tau) * 3.0);
  };
  click(a, 0.46, -0.6);                              // the first crystal nucleus
  let s = a + 200;
  while (s < b) {
    const u = (s - a) / (b - a);
    const rate = 55 + 430 * Math.pow(Math.sin(Math.PI * clamp(u, 0.04, 0.96)), 1.4);
    click(s, 0.075 + 0.21 * random() * random(), clamp(tr('front', s) / 1.25, -1, 1) * 0.65 + (random() - 0.5) * 0.25);
    s += Math.max(24, Math.floor(-Math.log(1 - random()) * SR / rate));
  }
  const creak = new SVF(), noise = rng(421);
  bus.nucleus.voice(a, b - a, 0, 0.060, 0.3, (t, i) => { const u = i / (b - a); return creak.run(noise() * 2 - 1, 900 + 1500 * u + 120 * Math.sin(TAU * 31 * t), 14).bp * bell(u * 2 - 1) * 2.2; });
}
// facets forming: glass partials gathering up into the flash
{
  const a = S('facet'), b = S('flash'), dur = (b - a) / SR;
  [[1174.7, 0], [1760, 0.12], [2349.3, 0.22], [2960, 0.31], [3520, 0.4], [4698.6, 0.5]].forEach(([f, lag], k) => {
    let ph = 0;
    bus.nucleus.voice(a + Math.floor(lag * (b - a)), b - a - Math.floor(lag * (b - a)) + Math.floor(0.06 * SR), (k % 2 ? 1 : -1) * (0.15 + 0.1 * k), 0.017, 0.55, (t) => {
      const u = clamp((t + lag * dur) / dur, 0, 1);
      ph += TAU * f * (0.965 + 0.035 * u) / SR;
      return Math.sin(ph) * u * u * (1 - sstep(dur * (1 - lag), dur * (1 - lag) + 0.055, t)) * sstep(0, 0.02, t);
    });
  });
}
// the flash: the first prism rings
{
  const a = S('flash');
  [['D6', 0, -0.25, 0.150], ['A6', 340, 0.3, 0.112], ['F#6', 700, -0.45, 0.085], ['E7', 1060, 0.5, 0.060]].forEach(([n, lag, pan, g], k) => glass(bus.chimes, a + lag, NOTE(n), { gain: g, pan, send: 0.55, length: 1.25, seed: 11 + k }));
  const random = rng(430);
  for (let k = 0; k < 46; k++) {
    const s = a + Math.floor(Math.pow(random(), 1.8) * 0.55 * SR);
    partials(bus.chimes, s, 3800 + random() * 6200, [[1, 1, 0.018 + random() * 0.03]], { gain: 0.014 * (1 - (s - a) / SR), pan: random() * 1.8 - 0.9, send: 0.6, attack: 0.001, seed: k });
  }
}
// the prism spreading into a plate, then the lattice taking over
{
  const a = S('flatten'), n = Math.floor(0.78 * SR);
  [[1975.5, -0.35], [1318.5, 0.35]].forEach(([f, pan], k) => {
    let ph = 0;
    bus.nucleus.voice(a, n, pan, 0.016, 0.55, (t, i) => { ph += TAU * f * (1 - 0.34 * sstep(0, 0.78, t)) / SR; return Math.sin(ph) * bell((i / n) * 2 - 1) * (1 + 0.25 * Math.sin(TAU * (9 + 3 * k) * t)); });
  });
  ['A6', 'C#7', 'E7'].forEach((n2, k) => celesta(bus.chimes, S('lattice') + k * 420, NOTE(n2), { gain: 0.030, pan: (k - 1) * 0.5, send: 0.6, length: 0.8, seed: 21 + k }));
}

// ================================================================ the lattice, audible
// Every video frame, grains in proportion to the cells the model froze during it.
// Pitch follows how far out they froze; each weather layer has its own texture.
{
  const textures = [
    { from: 0, scale: ['D6', 'E6', 'F#6', 'A6', 'C#7', 'E7'], list: [[1, 1, 0.085]], attack: 0.006, gain: 0.0170 },                       // plate: round glass
    { from: F('arms'), scale: ['B5', 'C#6', 'D6', 'F#6', 'A6', 'B6', 'D7'], list: [[1, 1, 0.070], [2.756, 0.30, 0.030]], attack: 0.002, gain: 0.0185 }, // arms: bright
    { from: F('burst'), scale: ['D7', 'E7', 'F#7', 'A7', 'B7', 'C#7'], list: [[1, 1, 0.030]], attack: 0.001, gain: 0.0130 },             // humid: glitter
    { from: F('dry'), scale: ['E5', 'G5', 'B5', 'D6', 'E6'], list: [[1, 1, 0.030], [3.93, 0.35, 0.010]], attack: 0.0015, gain: 0.0200 }, // dry: hollow
    { from: F('updraught'), scale: ['A5', 'C#6', 'E6', 'F#6', 'B6', 'C#7', 'E7'], list: [[1, 1, 0.075], [1.007, 0.8, 0.075]], attack: 0.002, gain: 0.0130 }, // beating shimmer
    { from: F('sector'), scale: ['G5', 'A5', 'B5', 'D6', 'F#6', 'A6'], list: [[1, 1, 0.190], [2.0, 0.12, 0.08]], attack: 0.008, gain: 0.0135 }, // sector: long, warm
    { from: F('facets'), scale: ['A6', 'C#7', 'E7', 'A7'], list: [[1, 1, 0.050]], attack: 0.001, gain: 0.0095 },                          // facets: fine polish
  ];
  const random = rng(500);
  for (let f = F('lattice'); f < sheet.frames; f++) {
    const cells = tracks.cells[f];
    if (!cells) continue;
    const tex = [...textures].reverse().find((x) => f >= x.from);
    const count = clamp(Math.round(Math.sqrt(cells) * 0.17), 1, 9);
    for (let k = 0; k < count; k++) {
      const reach = clamp(tracks.cellRadius[f] + (random() - 0.5) * 0.28, 0, 0.999);
      const idx = clamp(Math.floor(reach * tex.scale.length), 0, tex.scale.length - 1);
      const s = at(f) + Math.floor((k + random() * 0.9) / count * (SPF - 80));   // every grain starts inside its own frame
      partials(bus.lattice, s, NOTE(tex.scale[idx]), tex.list, { gain: tex.gain * (0.45 + 0.75 * random()) * clamp(Math.sqrt(cells) / 28, 0.5, 1.25), pan: (random() * 2 - 1) * (0.2 + 0.7 * tracks.crystalRadius[f]), send: 0.45, attack: tex.attack, seed: f * 11 + k });
    }
  }
}
// hollows sealing: little drops of trapped air
all('bubble').forEach((c, k) => {
  const f0 = 360 + 45 * ((k * 3) % 5);
  let ph = 0;
  bus.chimes.voice(at(c.frame), Math.floor(0.14 * SR), ((k % 3) - 1) * 0.45, 0.050, 0.22, (t) => { ph += TAU * f0 * (1 + 1.15 * (1 - Math.exp(-t / 0.028))) / SR; return Math.sin(ph) * env(t, 0.003, 0.027); });
});

// ================================================================ a chime for each new stage
const roll = (inst, frame, notes, gap, o = {}) => notes.forEach((n, k) => {
  const pans = o.pans || notes.map((_, j) => (notes.length > 1 ? (j / (notes.length - 1)) * 1.1 - 0.55 : 0));
  inst(bus.chimes, at(frame) + Math.round(k * gap), NOTE(n), { gain: (o.gain || 0.08) * (o.swell ? 0.8 + 0.4 * k / notes.length : 1), pan: pans[k], send: o.send === undefined ? 0.5 : o.send, length: o.length || 1, seed: frame + k });
});
const around = [0, 1, 2, 3, 4, 5].map((k) => +(Math.cos(k * Math.PI / 3) * 0.62).toFixed(2));
roll(glass, F('rib1'), ['D6'], 0, { gain: 0.095, length: 1.1 });
roll(glass, F('rib2'), ['F#6'], 0, { gain: 0.095, length: 1.1 });
// six arms sprout: six notes, three frames apart, circling the stereo field
roll(celesta, F('arms'), ['B4', 'D5', 'F#5', 'A5', 'C#6', 'F#6'], 3 * SPF, { gain: 0.135, pans: around, swell: true });
roll(celesta, F('burst'), ['D6', 'F#6', 'B5', 'A6', 'C#7', 'F#6', 'D7', 'B6', 'F#7'], 1.5 * SPF, { gain: 0.070, length: 0.65 });
roll(glass, F('dry'), ['E5', 'B5'], 4 * SPF, { gain: 0.085, length: 0.38, send: 0.18 });
roll(celesta, F('updraught'), ['A4', 'C#5', 'E5', 'B5', 'C#6', 'E6'], 3 * SPF, { gain: 0.110, pans: [...around].reverse(), swell: true });
roll(celesta, F('updraught') + 1, ['A5', 'C#6', 'E6', 'B6', 'C#7', 'E7'], 3 * SPF, { gain: 0.026, length: 0.7 });
roll(glass, F('sector'), ['G4', 'D5', 'A5', 'B5', 'F#6'], 2 * SPF, { gain: 0.082, length: 1.8 });
roll(glass, F('facets'), ['A6', 'E7'], 3 * SPF, { gain: 0.046, length: 0.9, send: 0.65 });
roll(celesta, F('grown'), ['D5', 'F#5', 'A5', 'D6'], 2.5 * SPF, { gain: 0.082, length: 1.35 });

// ================================================================ cloud base and valley
// falling out: one long breath downward as the cloud lifts away
{
  const a = S('exit'), b = S('valley') + Math.floor(0.35 * SR), n = b - a;
  for (let ch = 0; ch < 2; ch++) {
    const pink = pinkSource(rng(600 + ch)), f = new SVF(), out = ch ? bus.air.R : bus.air.L;
    for (let i = 0; i < n; i++) { const u = i / n; f.run(pink(), 1900 * Math.pow(0.105, u) * (ch ? 1.07 : 1), 1.5); out[a + i] += f.bp * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 2) * 0.50; }
  }
}
// muffled snowfall over a calm valley
{
  const mittenT = sec(F('mitten'));
  const cut = envPts([[0, 760], [mittenT, 760], [tTouch - 0.1, 400], [20, 430]]);
  for (let ch = 0; ch < 2; ch++) {
    const rn = rng(620 + ch), pink = pinkSource(rn), hp = new SVF(), lp = new SVF(), lp2 = new SVF(), far = new SVF();
    const out = ch ? bus.valley.R : bus.valley.L, ph = rn() * TAU;
    for (let i = a0(); i < LEN; i++) {
      const t = i / SR, open = tr('reveal', i);
      const x = pink();
      hp.run(x, 95, 0.7); lp.run(hp.hp, cut(t), 0.6); lp2.run(lp.lp, cut(t) * 1.25, 0.6);
      far.run(x, 255 + 40 * Math.sin(TAU * 0.19 * t + ph), 2.2);
      const breathe = 1 + 0.12 * Math.sin(TAU * 0.31 * t + ph) + 0.06 * Math.sin(TAU * 0.83 * t);
      out[i] += (lp2.lp * 1.05 + far.bp * 0.20) * open * breathe * 0.62 * hush(t);
    }
  }
  function a0() { return Math.max(0, S('exit') - 10); }
  // snow settling: very small, soft, wide
  const random = rng(640);
  let s = S('exit');
  while (s < LEN - 2000) {
    const open = tr('reveal', s);
    s += Math.max(80, Math.floor(-Math.log(1 - random()) * SR / (10 + 34 * open)));
    if (s >= LEN - 2000) break;
    const f = new SVF(), g = new SVF(), fc = 1300 + random() * 1900, noise = rng(s + 5);
    const gain = 0.030 * open * hush(s / SR) * (0.25 + random() * random() * 1.3);
    bus.valley.voice(s, Math.floor(0.016 * SR), random() * 2 - 1, gain, 0.12, (t) => g.run(f.run(noise() * 2 - 1, fc, 1.6).bp, 3100, 0.7).lp * env(t, 0.0012, 0.0036) * 2.6);
  }
}
// the mitten rises: the air sinks and softens
{
  const a = S('mitten'), n = S('touchdown') - a - Math.floor(0.16 * SR);
  for (let ch = 0; ch < 2; ch++) {
    const pink = pinkSource(rng(660 + ch)), f = new SVF(), out = ch ? bus.air.R : bus.air.L;
    for (let i = 0; i < n; i++) { const u = i / n; f.run(pink(), 880 * Math.pow(0.27, u), 1.7); out[a + i] += f.bp * Math.pow(Math.sin(Math.PI * Math.pow(u, 1.35)), 2) * 0.40; }
  }
}

// ================================================================ touchdown
{
  const a = S('touchdown');
  const n1 = rng(700), n2 = rng(701), bp = new SVF(), lp = new SVF();
  bus.landing.voice(a, Math.floor(0.02 * SR), -0.04, 0.27, 0.07, (t) => bp.run(n1() * 2 - 1, 3300, 1.4).bp * env(t, 0.00025, 0.0022) * 2.2);
  partials(bus.landing, a, 2380, [[1, 1, 0.0085], [1.62, 0.4, 0.005]], { gain: 0.095, pan: -0.04, send: 0.10, attack: 0.0004 });
  let ph = 0;                                      // the wool taking its weight
  bus.landing.voice(a, Math.floor(0.3 * SR), 0, 0.13, 0.03, (t) => { ph += TAU * (92 + 46 * Math.exp(-t / 0.018)) / SR; return Math.sin(ph) * env(t, 0.002, 0.042); });
  bus.landing.voice(a, Math.floor(0.25 * SR), 0, 0.15, 0.06, (t) => lp.run(n2() * 2 - 1, 640, 0.7).lp * env(t, 0.004, 0.040) * 1.7);
  glass(bus.landing, a + 90, NOTE('D7'), { gain: 0.024, pan: 0.05, send: 0.55, length: 0.55, seed: 77 });
}

// ================================================================ six arms catch the light
{
  const scale = ['A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];
  all('arm').forEach((c, k) => {
    celesta(bus.chimes, at(c.frame), NOTE(scale[k]), { gain: 0.165 - 0.008 * k, pan: c.pan * 0.8, send: 0.55, length: 0.8, seed: 800 + k });
    partials(bus.chimes, at(c.frame), NOTE(scale[k]) * 4.01, [[1, 1, 0.05]], { gain: 0.020, pan: c.pan, send: 0.7, attack: 0.001, seed: 820 + k });
  });
  // the resting chord
  const a = S('settle');
  [['D4', 0], ['A4', 620], ['E5', 1240], ['F#5', 1900]].forEach(([n, lag], k) => piano(bus.keys, a + lag, NOTE(n), { gain: 0.080, pan: (k - 1.5) * 0.22, send: 0.42, seed: 90 + k }));
  celesta(bus.keys, a + 2600, NOTE('D6'), { gain: 0.032, pan: 0.1, send: 0.6, length: 1.2, seed: 95 });
}

// ================================================================ score
// felt piano: gentle and sparse; notes sit on the film's own cue frames
{
  const P = (frame, note, gain, pan = 0, send = 0.34, length = 1) => piano(bus.keys, at(frame), NOTE(note), { gain, pan, send, length, seed: frame + note.length });
  P(0, 'D3', 0.075, -0.15, 0.4, 1.3); P(6, 'A4', 0.058, 0.2); P(F('condense') + 21, 'E5', 0.052, -0.2);
  P(F('flash'), 'D3', 0.100, -0.2, 0.4, 1.4); P(F('flash') + 2, 'A3', 0.062, -0.05, 0.4);
  P(F('lattice') + 20, 'F#5', 0.066, 0.2); P(F('rib2') + 9, 'A5', 0.054, 0.3);
  P(F('arms'), 'B2', 0.115, -0.25, 0.34, 1.2); P(F('arms') + 26, 'D5', 0.070, 0.15);
  P(F('burst'), 'G2', 0.105, -0.25); P(F('burst') + 17, 'C#5', 0.058, 0.2);
  P(F('dry'), 'E3', 0.095, -0.15, 0.2, 0.7);
  P(F('updraught'), 'F#2', 0.110, -0.2); P(F('updraught') + 21, 'B4', 0.064, 0.25); P(F('updraught') + 31, 'A4', 0.054, 0.1);
  P(F('sector'), 'G2', 0.115, -0.25, 0.38, 1.4); P(F('sector') + 3, 'D3', 0.072, -0.1, 0.38, 1.4); P(F('sector') + 36, 'D5', 0.068, 0.2); P(F('sector') + 58, 'B4', 0.058, 0.05);
  P(F('facets'), 'A2', 0.100, -0.2); P(F('facets') + 17, 'E4', 0.058, 0.2);
  P(F('grown'), 'D3', 0.108, -0.25, 0.42, 1.5);
  // over the valley: the one little melody
  P(F('grown') + 12, 'F#5', 0.092, 0.18, 0.46); P(F('grown') + 27, 'E5', 0.075, 0.12, 0.46); P(F('valley'), 'A5', 0.092, 0.22, 0.48, 1.3);
  P(F('valley') + 2, 'A2', 0.075, -0.25, 0.45, 1.4); P(F('valley') + 15, 'D5', 0.072, 0.1, 0.46); P(F('mitten') + 6, 'B4', 0.066, 0.0, 0.46);
  P(F('mitten') + 7, 'G2', 0.072, -0.2, 0.45, 1.2); P(F('mitten') + 25, 'A4', 0.050, 0.05, 0.46);
}
// a quiet bed of held strings of sine, changing chord with each layer
{
  const chords = [
    [0, ['D3', 'A3', 'E4']], [F('flash'), ['D3', 'A3', 'F#4', 'C#5', 'E5']], [F('arms'), ['B2', 'F#3', 'D4', 'A4', 'C#5']],
    [F('burst'), ['G2', 'D3', 'B3', 'F#4', 'C#5']], [F('dry'), ['E3', 'B3', 'G4', 'D5']], [F('updraught'), ['F#2', 'C#3', 'A3', 'E4', 'B4']],
    [F('sector'), ['G2', 'D3', 'B3', 'F#4', 'A4']], [F('facets'), ['A2', 'E3', 'D4', 'E4', 'A4']], [F('grown'), ['D2', 'A2', 'F#3', 'C#4', 'E4']],
    [F('valley'), ['D3', 'F#3', 'A3', 'C#4', 'E4', 'B4']], [F('mitten'), ['G2', 'D3', 'B3', 'F#4', 'A4']],
    [F('touchdown') + 8, ['A2', 'E3', 'B3', 'D4']], [F('settle'), ['D2', 'A2', 'D3', 'F#3', 'E4']],
  ];
  const level = envPts([[0, 0.82], [2.9, 1.0], [7.1, 1.1], [8.5, 0.80], [11.1, 1.12], [14.9, 1.18], [17.2, 1.0], [20, 1.05]]);
  chords.forEach(([frame, notes], c) => {
    const a = c === 0 ? 0 : at(frame) - Math.floor(0.12 * SR);
    const b = c + 1 < chords.length ? at(chords[c + 1][0]) + Math.floor(0.35 * SR) : LEN;
    notes.forEach((name, k) => {
      const f = NOTE(name), random = rng(900 + c * 10 + k), ph = [random() * TAU, random() * TAU, random() * TAU];
      const pan = (k / Math.max(1, notes.length - 1)) * 1.2 - 0.6, a2 = (pan + 1) * Math.PI / 4;
      const amp = 0.0215 * Math.pow(220 / Math.max(110, f), 0.35);
      for (let i = a; i < Math.min(b, LEN); i++) {
        const t = i / SR, u = (i - a) / SR, left = (b - i) / SR;
        const e = (c === 0 ? sstep(0, 0.25, u) : sstep(0, 0.55, u)) * sstep(0, 0.45, left);
        const v = Math.sin(TAU * f * t + ph[0]) + 0.8 * Math.sin(TAU * f * 1.0035 * t + ph[1]) + 0.17 * Math.sin(TAU * f * 2.001 * t + ph[2]);
        const g = v * e * amp * level(t) * (0.35 + 0.65 * hush(t)) * (1 + 0.07 * Math.sin(TAU * 0.4 * t + k));
        bus.pad.put(i, g * Math.cos(a2), g * Math.sin(a2), 0.28);
      }
    });
  });
}
// keep the wind soft: take out the sub rumble that pink noise brings with it
for (const channel of [bus.wind.L, bus.wind.R]) {
  const f1 = new SVF(), f2 = new SVF();
  for (let i = 0; i < LEN; i++) channel[i] = f2.run(f1.run(channel[i], 85, 0.707).hp, 70, 0.707).hp;
}
// the cloud wind also holds its breath before the landing (it is gone by then, kept for safety)
for (const b of [bus.wind]) for (let i = 0; i < LEN; i++) { const h = hush(i / SR); b.L[i] *= h; b.R[i] *= h; }

// keep the score light: a gentle low shelf (about -5 dB under 190 Hz) on the pad and the piano
for (const b of [bus.pad, bus.keys]) for (const channel of [b.L, b.R, b.sL, b.sR]) {
  const low = new SVF();
  for (let i = 0; i < LEN; i++) channel[i] -= 0.44 * low.run(channel[i], 190, 0.6).lp;
}

// ================================================================ mix
const mixGain = { wind: 0.43, valley: 0.58, air: 0.62, nucleus: 1.0, lattice: 1.40, chimes: 1.0, landing: 1.0, pad: 0.74, keys: 1.0 };
const dryL = new Float32Array(LEN), dryR = new Float32Array(LEN), sendL = new Float32Array(LEN), sendR = new Float32Array(LEN);
for (const [name, b] of Object.entries(bus)) {
  const g = mixGain[name];
  for (let i = 0; i < LEN; i++) { dryL[i] += b.L[i] * g; dryR[i] += b.R[i] * g; sendL[i] += b.sL[i] * g; sendR[i] += b.sR[i] * g; }
}
const [wetL, wetR] = reverb(sendL, sendR, { rt60: 2.35, damp: 0.34, predelay: 0.024 });
const mixL = new Float32Array(LEN), mixR = new Float32Array(LEN);
{
  const hpL = new SVF(), hpR = new SVF(), shelfL = new SVF(), shelfR = new SVF();
  for (let i = 0; i < LEN; i++) {
    // remove rumble below 28 Hz
    hpL.run(dryL[i] + wetL[i] * 0.62, 28, 0.707); hpR.run(dryR[i] + wetR[i] * 0.62, 28, 0.707);
    mixL[i] = hpL.hp; mixR[i] = hpR.hp;
  }
}

// ================================================================ master: -16 LUFS, true peak safe
const TARGET = -16.0, CEILING = db(-2.0);            // headroom for the AAC encoder
const fadeIn = Math.floor(0.06 * SR), fadeOut = Math.floor(0.30 * SR);
function finish(gain) {
  const L = new Float32Array(LEN), R = new Float32Array(LEN);
  for (let i = 0; i < LEN; i++) { L[i] = mixL[i] * gain; R[i] = mixR[i] * gain; }
  const out = truePeakLimit(L, R, CEILING);
  for (let i = 0; i < LEN; i++) {
    let f = 1;
    if (i < fadeIn) f = 0.5 - 0.5 * Math.cos(Math.PI * i / fadeIn);
    if (i >= LEN - fadeOut) f *= 0.5 - 0.5 * Math.cos(Math.PI * (LEN - 1 - i) / fadeOut);
    out.L[i] *= f; out.R[i] *= f;
  }
  return out;
}
function measure(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const num = (re) => +re.exec(tail)[1];
  return { I: num(/I:\s+(-?[\d.]+) LUFS/), LRA: num(/LRA:\s+(-?[\d.]+) LU/), TP: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}
const outFile = path.join(__dirname, 'snowflake.wav');
let gain = 1, report = null, result = null;
for (let pass = 0; pass < 8; pass++) {
  result = finish(gain);
  fs.writeFileSync(outFile, wav24(result.L, result.R));
  report = measure(outFile);
  console.log(`pass ${pass}: gain ${(20 * Math.log10(gain)).toFixed(2)} dB  I ${report.I} LUFS  TP ${report.TP} dBTP  max limiting ${result.maxReductionDb.toFixed(1)} dB`);
  if (Math.abs(report.I - TARGET) <= 0.05) break;
  gain *= db((TARGET - report.I) * (pass < 2 ? 1 : 0.9));
}
const stats = {
  ...report, gainDb: +(20 * Math.log10(gain)).toFixed(2), maxLimiterReductionDb: +result.maxReductionDb.toFixed(2),
  percentTimeLimitedOver1dB: +(100 * result.fractionOver1dB).toFixed(3), samples: LEN, seconds: LEN / SR,
};
fs.writeFileSync(path.join(__dirname, 'mix_report.json'), JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats));

if (Bus.log) {
  // for each hit cue: the dry sound of whatever starts on that frame, alone
  const dir = path.join(__dirname, 'templates');
  fs.mkdirSync(dir, { recursive: true });
  const kinds = { glint: ['nucleus'], freeze: ['nucleus'], flash: ['chimes', 'keys'], rib1: ['chimes'], rib2: ['chimes'], arms: ['chimes', 'keys'],
    burst: ['chimes', 'keys'], dry: ['chimes', 'keys'], updraught: ['chimes', 'keys'], sector: ['chimes', 'keys'], facets: ['chimes', 'keys'],
    grown: ['chimes', 'keys'], bubble: ['chimes'], touchdown: ['landing'], arm: ['chimes'], settle: ['keys'] };
  const index = [];
  for (const c of cues) {
    if (!kinds[c.id]) continue;
    const s0 = at(c.frame), len = Math.floor(0.09 * SR), L = new Float32Array(len);
    // voices that begin on the cue's own sample (rolled notes within 3 ms belong to the same hit);
    // vapour motes are left out: they are background, not the hit
    for (const v of Bus.log) {
      if (!kinds[c.id].includes(v.bus) || v.at < s0 || v.at > s0 + (c.id === 'settle' ? 2000 : 150)) continue;
      for (let i = 0; i < len; i++) { const j = i - (v.at - s0); if (j >= 0 && j < v.data.length) L[i] += v.data[j] * (v.gl + v.gr) * 0.5 * mixGain[v.bus] * gain; }
    }
    const name = `${c.id}_${c.frame}.f32`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(L.buffer));
    index.push({ id: c.id, frame: c.frame, file: name, sample: s0 });
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index));
  console.log('templates written:', index.length);
}

if (process.argv.includes('--stems')) {
  const dir = path.join(__dirname, 'stems');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, b] of Object.entries(bus)) {
    const L = new Float32Array(LEN), R = new Float32Array(LEN);
    for (let i = 0; i < LEN; i++) { L[i] = b.L[i] * mixGain[name] * gain; R[i] = b.R[i] * mixGain[name] * gain; }
    fs.writeFileSync(path.join(dir, name + '.wav'), wav24(L, R));
  }
  console.log('stems written (dry, pre-limiter)');
}

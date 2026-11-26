// The score. 60 BPM: one beat is one slot. Times below are film seconds.
//
// One tune, the "ember theme" (D A-G F | E-F D), is handed along: humming voice,
// bone flute, lyre, bronze, bowed strings, piano, synthesizer, and back to the
// same humming voice. It is written for this film.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hz, curve, ramp, clamp, smooth, TAU, rng } from './dsp.mjs';
import * as I from './instruments.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TL = createRequire(import.meta.url)(path.join(root, 'src', '00_timeline.js'));

// [beat, length, note]
const THEME = [[0, 1.5, 'D4'], [1.5, 0.5, 'A4'], [2, 1, 'G4'], [3, 1, 'F4'], [4, 1.5, 'E4'], [5.5, 0.5, 'F4'], [6, 2, 'D4']];
const THEME_MAJOR = [[0, 1.5, 'D4'], [1.5, 0.5, 'A4'], [2, 1, 'G4'], [3, 1, 'F#4'], [4, 1.5, 'E4'], [5.5, 0.5, 'F#4'], [6, 2, 'D4']];
const ANSWER = [[0, 1, 'F4'], [1, 1, 'A4'], [2, 1.5, 'C5'], [3.5, 0.5, 'A4'], [4, 1, 'B4'], [5, 1, 'G4'], [6, 2, 'A4']];
const play = (notes, t0, beat, fn, oct = 1) => {
  let prev = null;
  for (const [b, len, n] of notes) { const f = hz(n) * oct; fn(t0 + b * beat, len * beat, f, prev); prev = f; }
};
const chord = (s) => s.split(' ').map(hz);
const win = (a, b, f = 0.5) => (t) => ramp(a, a + f, t) * (1 - ramp(b - f, b, t));

export function compose() {
  const R = rng(4242);

  // ---------------- 0 - 5.6  out of the dark --------------------------------
  I.fire(0.02, 13.0, curve([[0, 0.10], [0.35, 0.14], [1.5, 0.40], [4.6, 0.46], [6.2, 1.0], [10.6, 0.85], [12.6, 0]]));
  // a long breath onto the ember
  I.wash(0.35, 1.45, { gain: 0.21, f: 900, q: 1.1, color: 'pink', send: 0.25, env: (x) => Math.pow(Math.sin(Math.PI * clamp(x / 1.45)), 1.6), sweep: (x) => 620 + 900 * Math.sin(Math.PI * clamp(x / 1.45)) });
  I.tone(1.0, 11.5, { f: () => hz('D2'), gain: 0.036, attack: 3.0, release: 2.0, harm: 0.22 });
  I.tone(2.2, 10.0, { f: () => hz('A2'), gain: 0.028, attack: 3.5, release: 2.0, harm: 0.15 });
  for (let s = 1; s <= 10; s++) I.heart(s, { gain: s < 6 ? 0.22 : 0.15 });
  // the first voice
  play([[0, 1.4, 'D4'], [1.4, 0.5, 'A4'], [1.9, 1.05, 'G4'], [2.95, 1.25, 'F4']], 1.7, 1.0, (t, d, f, p) => I.sing(t, d, f, { gain: 0.115, from: p, send: 0.4 }));
  // the tip of the hands: a few sparks you can hear
  for (let i = 0; i < 12; i++) I.click(3.35 + i * 0.075 + R() * 0.03, { gain: 0.035, f: 3200 + R() * 3600, q: 6, pan: -0.2 + i * 0.05 });
  I.bell(4.55, hz('D5'), { gain: 0.035, dur: 2.2, hard: 0.1, send: 0.8 });

  // ---------------- 5.6 - 11  the people ----------------------------------
  I.crickets(5.6, 11.4, win(5.6, 11.4, 1.0));
  play([[0, 1.5, 'E4'], [1.5, 0.5, 'F4'], [2, 2.2, 'D4']], 6.15, 1.0, (t, d, f, p) => {
    I.sing(t, d, f, { gain: 0.082, from: p, pan: -0.3 });
    I.sing(t + 0.04, d, f / 2, { gain: 0.07, from: p && p / 2, pan: 0.3, vowel: 'oo' });
  });
  for (let k = 0; k < 12; k++) { const t = (Math.PI / 2 + TAU * k) / 5.6; if (t > 5.9 && t < 8.9) I.click(t, { gain: 0.075, f: 2600 + (k % 3) * 300, q: 9, pan: 0.34 }); }
  for (let t = 9.15; t < 11.2; t += 0.52) I.drum(t, 62, { gain: 0.11, snap: 0.5, dur: 0.28, pan: -0.15 });
  I.wash(10.2, 1.7, { gain: 0.20, f: 500, q: 0.8, send: 0.4, env: (x) => Math.pow(clamp(x / 1.2), 2) * (1 - ramp(1.2, 1.7, x)), sweep: (x) => 220 + 1500 * x * x, stereo: 0.7 });

  // ---------------- 11 - 18  across the world ------------------------------
  I.wash(10.9, 7.4, { gain: 0.060, f: 420, q: 0.7, attack: 1.2, release: 1.0, stereo: 0.8, sweep: (x) => 340 + 130 * Math.sin(x * 0.9) });
  for (const [t, d, c] of [[11.2, 2.6, 'D3 A3 D4'], [13.8, 2.2, 'C3 G3 E4'], [16.0, 2.2, 'Bb2 F3 D4']]) chord(c).forEach((f, i) => I.sing(t, d, f, { gain: 0.050, vowel: 'oo', pan: (i - 1) * 0.5, attack: 0.8, release: 0.8, send: 0.6 }));
  for (let s = 12; s < 18; s++) {
    I.drum(s, 88, { gain: 0.17, snap: 0.28 });
    if (s >= 14) I.drum(s + 0.5, 116, { gain: 0.085, snap: 0.5, dur: 0.35, pan: 0.25 });
    if (s >= 16) { I.click(s + 0.25, { gain: 0.045, f: 1700, pan: -0.4 }); I.click(s + 0.75, { gain: 0.06, f: 1900, pan: 0.4 }); }
  }
  // every arrival rings
  [[12.7, 'D5', -0.2], [13.4, 'F5', 0.1], [14.9, 'G5', 0.25], [15.95, 'A5', 0.4], [17.15, 'C6', 0.55], [17.55, 'D6', -0.35]].forEach(([t, n, p]) => {
    I.pluck(t, hz(n) / 2, { gain: 0.12, pan: p, send: 0.75, bright: 0.9, dur: 1.4 });
    I.bell(t, hz(n), { gain: 0.030, pan: p, dur: 1.5, hard: 0.2, send: 0.8 });
  });
  play([[0, 0.9, 'D4'], [0.9, 0.4, 'A4'], [1.3, 0.7, 'G4'], [2, 1.2, 'F4']], 14.3, 1.0, (t, d, f, p) => I.sing(t, d, f * 1, { gain: 0.075, from: p, vowel: 'ah', send: 0.7 }));
  I.wash(17.5, 1.1, { gain: 0.16, f: 900, q: 0.8, send: 0.4, env: (x) => Math.pow(clamp(x / 0.7), 2) * (1 - ramp(0.7, 1.1, x)), sweep: (x) => 300 + 2200 * x * x });

  // ---------------- 18 - 23  the cave: the bone flute ------------------------
  I.fire(17.9, 23.4, curve([[17.9, 0], [18.4, 0.42], [22.6, 0.40], [23.4, 0]]), 19);
  I.tone(18.0, 5.0, { f: () => hz('D2'), gain: 0.032, attack: 1.0, release: 1.0, harm: 0.1 });
  [18.35, 19.05, 20.72, 21.28, 22.1, 22.55].forEach((t, i) => I.drip(t, 1300 + (i * 397) % 900, (i % 2 ? 0.6 : -0.55)));
  for (let s = 18; s < 23; s++) I.heart(s, { gain: 0.14 });
  play(THEME, 18.55, 0.545, (t, d, f, p) => I.flute(t, d * 0.97, f * 2, { gain: 0.050, from: p && p * 2, send: 0.5 }));
  for (const [a, b] of [[19.38, 19.86], [20.0, 20.46], [20.58, 21.02]]) I.wash(a, b - a, { gain: 0.062, type: 'bp', f: 2300, q: 0.8, color: 'white', pan: 0.3, send: 0.4, attack: 0.05, release: 0.14 });
  chord('D4 A4 E5').forEach((f, i) => I.bell(21.38 + i * 0.07, f, { gain: 0.040, dur: 2.4, hard: 0.1, send: 0.9, pan: (i - 1) * 0.4 }));

  // ---------------- 23 - 27  the ice ----------------------------------------
  I.wash(22.7, 3.9, { gain: 0.17, f: 520, q: 2.6, attack: 0.7, release: 1.2, stereo: 0.9, sweep: (x) => 430 + 240 * Math.sin(x * 1.7) + 90 * Math.sin(x * 4.3) });
  I.wash(22.8, 3.8, { gain: 0.05, type: 'hp', f: 3600, q: 0.6, color: 'white', attack: 0.8, release: 1.2, stereo: 0.6 });
  I.pad(23.0, 2.2, chord('Bb2 F3 A3 D4'), { gain: 0.040, attack: 0.9, release: 0.9, glass: 0.4 });
  I.fire(23.2, 25.9, curve([[23.2, 0], [23.8, 0.35], [25.2, 0.28], [25.9, 0]]), 29);
  // something very large calls across the snow
  I.tone(23.75, 1.25, { f: (x) => 112 + 46 * Math.sin(Math.PI * clamp(x / 1.1)) + 3 * Math.sin(x * 55), gain: 0.052, harm: 0.55, attack: 0.18, release: 0.45, pan: 0.55, send: 0.9 });
  for (let s = 23; s < 27; s++) I.heart(s, { gain: 0.15 });
  for (let t = 24.3; t < 25.35; t += 0.34) I.wash(t, 0.13, { gain: 0.15, f: 1500, q: 0.7, color: 'white', attack: 0.006, release: 0.09, pan: 0.2 });
  I.pad(25.25, 1.9, chord('D3 A3 E4 F4'), { gain: 0.042, attack: 0.6, release: 0.7 });
  play([[0, 0.7, 'A4'], [0.7, 0.35, 'C5'], [1.05, 0.9, 'D5']], 24.95, 1.0, (t, d, f, p) => I.flute(t, d, f, { gain: 0.042, from: p, send: 0.5 }));
  [[25.55, 'E5'], [26.15, 'A5'], [26.7, 'D6']].forEach(([t, n], i) => I.bell(t, hz(n), { gain: 0.030, dur: 1.4, hard: 0.2, send: 0.8, pan: 0.3 - i * 0.3 }));

  // ---------------- 27 - 33.6  the first dawn: the key turns major ----------
  chord('D3 A3 D4 F#4').forEach((f, i) => I.sing(26.75, 2.4, f, { gain: 0.060, vowel: 'ah', pan: (i - 1.5) * 0.45, attack: 1.1, release: 1.0, send: 0.65 }));
  for (const [t, d, c] of [[26.8, 2.3, 'D2 A2 D3 F#3 A3'], [29.0, 1.4, 'G2 D3 B3 D4'], [30.35, 1.65, 'B2 F#3 B3 D4'], [32.0, 1.6, 'A2 E3 A3 C#4']]) I.pad(t, d, chord(c), { gain: 0.040, attack: 0.5, release: 0.7, glass: 0.15 });
  const bird = (t, p) => { const n = 2 + (R() * 3 | 0), b = 2600 + R() * 1600; for (let k = 0; k < n; k++) I.chirp(t + k * (0.085 + R() * 0.03), { gain: 0.020, pan: p, f0: b + R() * 500, f1: b + 700 + R() * 900, dur: 0.05 + R() * 0.05 }); };
  [27.15, 27.9, 28.35, 29.25, 30.1, 31.2, 32.55, 33.4, 34.7, 36.2].forEach((t, i) => bird(t, (i % 3 - 1) * 0.7));
  // the drum keeps time with the planting hands
  for (let k = 0; k < 6; k++) {
    const t = 27.45 + k;
    I.drum(t, 98, { gain: 0.21, snap: 0.36 });
    I.drum(t + 0.5, 147, { gain: 0.085, snap: 0.6, dur: 0.3, pan: 0.3 });
    for (const q of [0.25, 0.75]) I.wash(t + q, 0.085, { gain: 0.060, type: 'hp', f: 5200, color: 'white', attack: 0.012, release: 0.06, pan: -0.35 });
  }
  play(THEME_MAJOR, 28.15, 0.62, (t, d, f, p) => I.flute(t, d * 0.95, f * 2, { gain: 0.050, from: p && p * 2, send: 0.4, bright: 1.3 }));
  for (const [t, n] of [[30.35, 'F#5'], [32.0, 'A5']]) { I.bell(t, hz(n), { gain: 0.036, dur: 1.8, hard: 0.2, send: 0.7 }); I.bell(t + 0.11, hz(n) * 1.5, { gain: 0.020, dur: 1.4, hard: 0.1, send: 0.8, pan: 0.4 }); }

  // ---------------- 33.6 - 38.3  cities: the lyre ---------------------------
  const arp = (t0, t1, notes, step, gain, bright = 0.6) => { let i = 0; for (let t = t0; t < t1 - 1e-6; t += step, i++) I.pluck(t, hz(notes[i % notes.length]), { gain: gain * (i % 4 === 0 ? 1.25 : 1), pan: -0.35 + 0.2 * (i % 4), bright, dur: 1.3, decay: 0.996 }); };
  arp(33.5, 35.0, ['D3', 'A3', 'D4', 'A3'], 0.5, 0.15);
  arp(35.0, 36.0, ['C3', 'G3', 'C4', 'G3'], 0.25, 0.12);
  arp(36.0, 37.0, ['G2', 'D3', 'G3', 'B3'], 0.25, 0.13);
  arp(37.0, 38.0, ['D3', 'A3', 'D4', 'F#4'], 0.25, 0.12);
  play(THEME_MAJOR, 33.9, 0.52, (t, d, f) => I.pluck(t, f, { gain: 0.20, pan: 0.22, bright: 0.85, dur: Math.max(0.9, d * 1.6), send: 0.45 }));
  for (let s = 34; s < 38; s++) { I.drum(s, 82, { gain: 0.18, snap: 0.3 }); I.drum(s + 0.5, 130, { gain: 0.075, dur: 0.3, snap: 0.55, pan: -0.3 }); }
  // the stylus, mark by mark
  for (let k = 0; k < 40; k++) { const t = (Math.PI * (k + 0.5)) / 15; if (t > 33.9 && t < 35.5) I.click(t + 33.3 * 0, { gain: 0.030, f: 3400, q: 3, pan: 0.2, len: 0.03 }); }
  for (let k = 0; k < 34; k++) I.click(33.9 + k * 0.047, { gain: 0.022 + 0.012 * R(), f: 2800 + R() * 900, q: 3.5, pan: 0.2, len: 0.028 });
  I.wash(33.4, 4.8, { gain: 0.030, f: 640, q: 0.6, attack: 0.8, release: 0.9, stereo: 0.9, env: (x) => win(33.4, 38.2, 0.8)(33.4 + x) * (0.7 + 0.3 * Math.sin(x * 7) * Math.sin(x * 2.3)) });
  I.bell(35.5, hz('A3'), { gain: 0.065, dur: 2.6, hard: 0.5 });
  I.bell(37.75, hz('D3'), { gain: 0.070, dur: 2.6, hard: 0.3, send: 0.8 });

  // ---------------- 38.3 - 42.1  roads: bronze ------------------------------
  arp(38.0, 39.0, ['G2', 'D3', 'G3', 'B3', 'D4', 'B3', 'G3', 'D3'], 0.25, 0.12, 0.7);
  arp(39.0, 40.0, ['A2', 'E3', 'A3', 'C#4', 'E4', 'C#4', 'A3', 'E3'], 0.25, 0.12, 0.7);
  arp(40.0, 41.0, ['B2', 'F#3', 'B3', 'D4', 'F#4', 'D4', 'B3', 'F#3'], 0.25, 0.12, 0.7);
  arp(41.0, 42.0, ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4', 'E4', 'C#4'], 0.25, 0.11, 0.7);
  play(ANSWER, 38.3, 0.46, (t, d, f) => I.bell(t, f, { gain: 0.082, dur: Math.max(1.4, d * 2.2), hard: 0.7, pan: -0.1 }));
  for (let s = 38; s < 42; s++) {
    I.drum(s, 90, { gain: 0.20 }); I.drum(s + 0.75, 90, { gain: 0.09 }); I.drum(s + 0.5, 140, { gain: 0.10, dur: 0.3, snap: 0.6, pan: 0.3 });
    for (let q = 0; q < 4; q++) I.bell(s + q * 0.25 + 0.012, 2350 + (q % 2) * 190, { gain: 0.011, dur: 0.28, hard: 1.2, send: 0.2, pan: -0.55 });
  }
  for (const [t, d, c] of [[38.2, 1.8, 'G2 D3'], [40.0, 2.2, 'B2 F#3']]) I.pad(t, d, chord(c), { gain: 0.045, attack: 0.4, release: 0.5 });

  // ---------------- 42.1 - 45  the ocean; the bow arrives ---------------------
  for (const [t, d] of [[41.8, 1.5], [43.05, 1.45], [44.2, 1.2]]) I.wash(t, d, { gain: 0.095, type: 'lp', f: 900, q: 0.6, stereo: 0.9, send: 0.25, env: (x) => Math.pow(Math.sin(Math.PI * clamp(x / d)), 1.7), sweep: (x) => 340 + 1600 * Math.pow(Math.sin(Math.PI * clamp(x / d)), 2) });
  I.wash(41.9, 3.4, { gain: 0.040, type: 'lp', f: 300, q: 0.7, attack: 0.4, release: 0.4, stereo: 0.8 });
  play([[0, 0.6, 'D5'], [0.6, 0.3, 'E5'], [0.9, 0.7, 'F#5']], 42.2, 1.0, (t, d, f, p) => I.flute(t, d, f, { gain: 0.040, from: p, send: 0.5 }));
  I.strings(43.15, 1.0, chord('D3 A3 E4 F#4'), { gain: 0.036, attack: 0.45, release: 0.45 });
  I.strings(44.15, 0.85, chord('G2 D4 F#4 B4'), { gain: 0.036, attack: 0.3, release: 0.4 });
  play([[0, 0.62, 'A4'], [0.62, 0.4, 'D5'], [1.02, 0.72, 'F#5']], 43.2, 1.0, (t, d, f) => I.strings(t, d, [f], { gain: 0.040, attack: 0.14, release: 0.25, cutoff: 2800 }));
  for (let s = 42; s < 45; s++) { I.drum(s, 70, { gain: 0.16, dur: 0.9, snap: 0.15 }); I.drum(s + 0.66, 105, { gain: 0.07, pan: 0.3 }); }
  I.bell(43.15, hz('A6'), { gain: 0.016, dur: 1.8, hard: 0.1, send: 0.9 });

  // ---------------- 45 - 47  plague ----------------------------------------
  [45.08, 46.02, 46.96].forEach((t, i) => I.bell(t, hz('D3'), { gain: 0.19 - i * 0.025, dur: 2.7, hard: 0.35, kind: 'church', send: 0.65, pan: 0.25 }));
  I.strings(45.1, 1.85, chord('D2 A2 F3'), { gain: 0.052, attack: 0.6, release: 0.6, cutoff: 900 });
  [[45.25, 'D4'], [45.75, 'C4'], [46.25, 'Bb3'], [46.7, 'A3']].forEach(([t, n], i, a) => I.sing(t, 0.52, hz(n), { gain: 0.060, vowel: 'oo', from: i ? hz(a[i - 1][1]) : null, attack: 0.12, release: 0.2, send: 0.7 }));
  I.wash(45.0, 2.2, { gain: 0.050, f: 360, q: 1.8, attack: 0.5, release: 0.6, stereo: 0.7, sweep: (x) => 300 + 90 * Math.sin(x * 2.1) });

  // ---------------- 47 - 49  1492 -------------------------------------------
  for (const [t, d] of [[46.9, 1.3], [47.9, 1.25]]) I.wash(t, d, { gain: 0.13, type: 'lp', f: 700, q: 0.6, stereo: 0.8, env: (x) => Math.pow(Math.sin(Math.PI * clamp(x / d)), 1.6), sweep: (x) => 300 + 1100 * Math.sin(Math.PI * clamp(x / d)) });
  I.strings(47.05, 0.95, chord('G2 D3 Bb3'), { gain: 0.056, attack: 0.3, release: 0.35, cutoff: 1200 });
  I.strings(48.0, 0.8, chord('A2 Eb3 Bb3'), { gain: 0.050, attack: 0.3, release: 0.4, cutoff: 1000 });
  I.drum(47.2, 55, { gain: 0.34, dur: 1.2, snap: 0.1, send: 0.5 });
  I.drum(48.2, 49, { gain: 0.27, dur: 1.2, snap: 0.1, send: 0.5 });
  I.fire(47.1, 48.9, curve([[47.1, 0], [47.45, 0.30], [48.05, 0.28], [48.85, 0]]), 39);

  // ---------------- 49 - 52  the hold: one voice -----------------------------
  const creak = (t, d, f0, f1, p) => { I.tone(t, d, { f: (x) => (f0 + (f1 - f0) * (x / d)) * (1 + 0.07 * Math.sin(x * 190) * Math.sin(x * 23)), gain: 0.016, harm: 0.85, attack: 0.05, release: 0.12, pan: p, send: 0.5 }); };
  creak(49.15, 0.5, 148, 120, -0.6); creak(50.35, 0.65, 112, 139, 0.55); creak(51.5, 0.45, 160, 131, -0.3);
  I.wash(48.8, 3.5, { gain: 0.095, type: 'lp', f: 130, q: 0.9, attack: 0.5, release: 0.7, stereo: 0.8, env: (x) => win(48.8, 52.3, 0.5)(48.8 + x) * (0.75 + 0.25 * Math.sin(x * 3.1)) });
  for (let s = 49; s <= 51; s++) I.heart(s, { gain: 0.30, soft: 0.4 });
  [[49.2, 0.85, 'A3'], [50.05, 0.4, 'Bb3'], [50.45, 0.8, 'A3'], [51.25, 0.35, 'G3'], [51.6, 0.55, 'D4']].forEach(([t, d, n], i, a) => I.sing(t, d, hz(n), { gain: 0.112, vowel: 'ah', from: i ? hz(a[i - 1][2]) : null, vib: 1.5, breath: 0.03, attack: 0.14, release: 0.28, send: 0.6 }));
  I.tone(49.0, 3.0, { f: () => hz('D2'), gain: 0.045, attack: 0.8, release: 0.6, harm: 0.2 });
  [49.7, 50.9, 51.42].forEach((t, i) => I.click(t, { gain: 0.030, f: 3900 - i * 300, q: 12, pan: (i - 1) * 0.6, send: 0.6 }));

  // ---------------- 52 - 56  engines, and the hammered string ----------------
  I.fire(52.2, 54.9, curve([[52.2, 0], [52.6, 0.75], [54.1, 0.5], [54.9, 0]]), 49);
  for (let k = 0; k < 16; k++) {
    const t = 52.25 + k * 0.25, strong = k % 4 === 0;
    I.wash(t, 0.17, { gain: (strong ? 0.20 : 0.11) * Math.min(1, 0.4 + k / 6), f: strong ? 520 : 760, q: 0.9, color: 'white', attack: 0.008, release: 0.12, pan: k % 2 ? 0.25 : -0.1 });
    if (strong) { I.drum(t, 58, { gain: 0.24, dur: 0.35, snap: 0.2 }); }
    if (k % 4 === 2) I.bell(t, 780, { gain: 0.030, dur: 0.5, hard: 1.4, send: 0.3, pan: 0.45 });
  }
  const bass = [['D2', 'D3', 'A2', 'D3'], ['F2', 'F3', 'C3', 'F3'], ['C2', 'C3', 'G2', 'C3'], ['A1', 'A2', 'E2', 'A2']];
  bass.forEach((bar, b) => bar.forEach((n, i) => I.piano(52.25 + b + i * 0.25, hz(n), { gain: 0.125, pan: -0.2, dur: 0.9 })));
  [['D4', 'F4', 'A4'], ['C4', 'F4', 'A4'], ['C4', 'E4', 'G4'], ['C#4', 'E4', 'A4']].forEach((c, b) => { for (const n of c) { I.piano(52.25 + b + 0.5, hz(n), { gain: 0.055, pan: 0.2 }); } I.strings(52.25 + b, 0.9, c.map((n) => hz(n) / 2), { gain: 0.030, attack: 0.12, release: 0.25, cutoff: 1500 }); });
  play(THEME.slice(0, 4), 52.5, 0.75, (t, d, f) => I.piano(t, f * 2, { gain: 0.085, pan: 0.15, dur: 1.4 }));
  // a steam whistle over the viaduct
  for (const f of [466, 587]) I.tone(53.55, 0.85, { f: (x) => f * (1 - 0.02 * Math.exp(-x * 9)), gain: 0.028, harm: 0.35, attack: 0.08, release: 0.22, pan: 0.4, send: 0.7 });
  I.wash(53.55, 0.9, { gain: 0.055, f: 2600, q: 0.8, color: 'white', attack: 0.07, release: 0.25, pan: 0.4 });
  // the thread of metal lights
  I.bell(55.62, hz('D6'), { gain: 0.070, dur: 1.6, hard: 0.9, send: 0.6, pan: 0.3 });
  I.tone(55.62, 2.2, { f: () => 120, gain: 0.020, harm: 0.6, attack: 0.25, release: 0.7, pan: 0.3 });
  ['D4', 'A4', 'D5', 'F#5', 'A5', 'D6', 'E6', 'F#6'].forEach((n, i) => I.piano(55.74 + i * 0.075, hz(n), { gain: 0.060, pan: -0.4 + i * 0.11, dur: 1.1, send: 0.5 }));

  // ---------------- 56 - 58.15  war -----------------------------------------
  I.strings(56.15, 0.9, chord('D3 F3 A3'), { gain: 0.045, attack: 0.35, release: 0.4, cutoff: 1400 });
  I.strings(57.0, 1.1, chord('D2 A2 D3 Eb3'), { gain: 0.070, attack: 0.5, release: 0.2, cutoff: 1100, swell: 0.7 });
  for (let t = 56.9; t < 58.12; t += 0.25) {
    const k = Math.round((t - 56.9) / 0.25), lvl = ramp(56.9, 57.6, t);
    I.drum(t, k % 2 ? 178 : 160, { gain: 0.045 + 0.060 * lvl, dur: 0.2, snap: 1.5, send: 0.15 });
    if (k % 4 === 0) I.drum(t, 52, { gain: 0.14 * (0.5 + lvl * 0.5), dur: 0.6, snap: 0.1 });
  }
  I.tone(57.1, 1.15, { f: (x) => 330 + 210 * Math.sin(Math.PI * clamp(x / 1.15)), gain: 0.024, harm: 0.3, attack: 0.3, release: 0.35, pan: -0.5, send: 0.8 });
  for (const [t, p] of [[57.22, -0.4], [57.6, 0.5], [57.86, 0.1]]) {
    I.tone(t, 0.9, { f: (x) => 62 * Math.exp(-x * 1.4), gain: 0.10, attack: 0.008, release: 0.5, pan: p, send: 0.5 });
    I.wash(t, 0.8, { gain: 0.09, type: 'lp', f: 220, q: 0.7, pan: p, send: 0.5, env: (x) => smooth(x / 0.015) * Math.exp(-x * 5) });
  }
  // the second line: almost nothing. one low bowed note and a small flame
  I.strings(58.35, 1.05, [hz('A2')], { gain: 0.150, attack: 0.45, release: 0.14, cutoff: 700 });
  I.strings(58.7, 0.75, [hz('E3')], { gain: 0.070, attack: 0.4, release: 0.1, cutoff: 800 });
  I.fire(58.3, 59.55, curve([[58.3, 0], [58.7, 0.26], [59.45, 0.26], [59.55, 0]]), 59);

  // ---------------- 59.62  the bloom ------------------------------------------
  I.tone(59.66, 1.35, { f: (x) => 30 + 22 * Math.exp(-x * 2.0), gain: 0.23, harm: 0.30, attack: 0.28, release: 0.7, send: 0.3 });
  I.wash(59.66, 1.4, { gain: 0.31, type: 'lp', f: 150, q: 0.6, stereo: 0.9, send: 0.4, env: (x) => smooth(x / 0.36) * (1 - ramp(0.62, 1.4, x)), sweep: (x) => 90 + 420 * smooth(x / 0.5) * (1 - ramp(0.55, 1.3, x)) });
  I.tone(59.75, 1.1, { f: () => 3950, gain: 0.0085, attack: 0.35, release: 0.55, send: 0.6 });

  // ---------------- 60.2 - 62  the screen and the Moon -------------------------
  I.wash(60.14, 0.34, { gain: 0.075, type: 'hp', f: 2200, color: 'white', attack: 0.02, release: 0.2, send: 0.05, env: (x) => smooth(x / 0.03) * (1 - ramp(0.1, 0.34, x)) * (0.6 + 0.4 * Math.sin(x * 260)) });
  I.tone(60.2, 1.1, { f: () => 60, gain: 0.020, harm: 0.5, attack: 0.2, release: 0.3 });
  I.pad(60.15, 1.0, chord('F3 A3 C4 E4'), { gain: 0.052, attack: 0.35, release: 0.4, glass: 0.2 });
  I.pad(61.12, 0.8, chord('C3 G3 B3 E4 G4'), { gain: 0.045, attack: 0.25, release: 0.6, glass: 0.7 });
  for (let i = 0; i < 8; i++) I.synth(60.45 + i * 0.125, hz(['F4', 'C5', 'A4', 'E5'][i % 4]), { gain: 0.045, open: 2200, dur: 0.2, pan: (i % 2) * 0.6 - 0.3 });
  I.tone(60.98, 0.22, { f: () => 2525, gain: 0.030, attack: 0.008, release: 0.015, pan: -0.25 });
  I.tone(61.55, 0.22, { f: () => 2475, gain: 0.030, attack: 0.008, release: 0.015, pan: 0.25 });
  I.drum(61.12, 46, { gain: 0.22, dur: 0.5, snap: 0.25, send: 0.7 });
  I.wash(61.12, 0.28, { gain: 0.085, f: 900, q: 0.6, color: 'white', attack: 0.01, release: 0.2 });
  play([[0, 0.28, 'E5'], [0.28, 0.45, 'B5']], 61.3, 1.0, (t, d, f) => I.bell(t, f, { gain: 0.030, dur: 1.6, hard: 0.1, send: 0.9 }));

  // ---------------- 62 - 63  a vaccine ------------------------------------------
  I.pad(62.0, 1.0, chord('D3 A3 D4 F#4'), { gain: 0.050, attack: 0.25, release: 0.4 });
  play([[0, 0.25, 'D4'], [0.25, 0.25, 'F#4'], [0.5, 0.25, 'A4'], [0.75, 0.4, 'D5']], 62.05, 1.0, (t, d, f) => I.pluck(t, f, { gain: 0.16, bright: 0.7, dur: 1.4 }));
  bird(62.2, -0.5); bird(62.72, 0.6);
  I.heart(62, { gain: 0.18 });

  // ---------------- 63 - 65  one lit planet -----------------------------------
  const net = [['B3', 'D4', 'F#4', 'A4'], ['G3', 'B3', 'D4', 'F#4'], ['D4', 'F#4', 'A4', 'D5'], ['A3', 'C#4', 'E4', 'A4']];
  for (let k = 0; k < 16; k++) { const t = 63.0 + k * 0.125, bar = net[Math.min(3, k >> 2)]; I.synth(t, hz(bar[k % 4]) * 2, { gain: 0.048 + 0.001 * k, open: 1600 + k * 190, pan: ((k % 4) - 1.5) * 0.4 }); }
  for (let k = 0; k < 15; k++) { const t = 65.0 - 0.125 * (15 - k) + 0.0; if (t >= 64.9) break; I.synth(t, hz(net[2 + (k > 7)][k % 4]) * 2, { gain: 0.060, open: 4200 + k * 120, pan: ((k % 4) - 1.5) * 0.45 }); }
  for (let s = 63; s < 65; s += 0.5) I.drum(s, 60, { gain: 0.18, dur: 0.3, snap: 0.15 });
  I.strings(63.0, 1.0, chord('B2 F#3 D4'), { gain: 0.040, attack: 0.4, release: 0.2, cutoff: 2000 });
  I.strings(64.0, 0.92, chord('G2 D3 A3 B3 E4'), { gain: 0.046, attack: 0.3, release: 0.06, cutoff: 2600, swell: 0.9 });
  for (let i = 0; i < 26; i++) { const t = 63.1 + R() * 1.7; I.chirp(t, { gain: 0.006, f0: 3000 + R() * 4000, f1: 3000 + R() * 4000, dur: 0.025, pan: R() * 1.6 - 0.8 }); }
  I.wash(63.9, 1.1, { gain: 0.095, type: 'hp', f: 1500, color: 'white', stereo: 0.8, send: 0.3, env: (x) => Math.pow(clamp(x / 1.05), 3.2) * (1 - ramp(1.05, 1.1, x)), sweep: (x) => 900 + 5200 * x });

  // ---------------- 65.0  NOW --------------------------------------------------
  I.tone(65.0, 1.5, { f: (x) => 34 + 52 * Math.exp(-x * 7), gain: 0.26, attack: 0.006, release: 0.9, send: 0.25 });
  I.drum(65.0, 55, { gain: 0.26, dur: 1.4, snap: 0.35, send: 0.7 });
  I.bell(65.0, hz('D6'), { gain: 0.135, dur: 3.2, hard: 0.5, send: 0.75 });
  I.bell(65.0, hz('D5'), { gain: 0.060, dur: 3.0, hard: 0.2, send: 0.75 });
  // someone humming to a new child
  play([[0, 0.34, 'A4'], [0.34, 0.34, 'G4'], [0.68, 0.62, 'F#4']], 65.32, 1.0, (t, d, f, p) => I.sing(t, d, f, { gain: 0.105, from: p, attack: 0.1, release: 0.22 }));

  // ---------------- 65.6 - 73.2  projection -----------------------------------
  for (const [t, d, c] of [[65.55, 2.4, 'D3 A3 E4 F#4'], [67.95, 2.0, 'B2 F#3 A3 D4 E4'], [69.95, 1.55, 'G2 D3 B3 F#4'], [71.55, 1.05, 'E2 B2 G3 D4 F#4'], [72.55, 0.75, 'A2 E3 G3 D4']]) {
    I.pad(t, d, chord(c), { gain: 0.042, attack: 0.55, release: 0.8, glass: 0.75 });
    I.strings(t + 0.15, Math.max(0.5, d - 0.3), chord(c).slice(0, 2), { gain: 0.030, attack: 0.6, release: 0.7, cutoff: 1100 });
  }
  for (let s = 66; s < 73; s++) {
    I.heart(s, { gain: 0.17 });
    I.synth(s + 0.5, hz(s < 68 ? 'A5' : s < 70 ? 'F#5' : s < 72 ? 'B5' : 'G5'), { gain: 0.022, open: 2600, dur: 0.3, pan: 0.35, send: 0.7 });
  }
  play(THEME_MAJOR, 66.1, 0.84, (t, d, f, p) => I.flute(t, d * 0.92, f * 2, { gain: 0.036, from: p && p * 2, send: 0.5, bright: 0.7 }));
  for (const [t, d] of [[66.9, 1.5], [68.1, 1.45]]) I.wash(t, d, { gain: 0.11, type: 'lp', f: 800, q: 0.6, stereo: 0.9, env: (x) => Math.pow(Math.sin(Math.PI * clamp(x / d)), 1.6), sweep: (x) => 320 + 1200 * Math.sin(Math.PI * clamp(x / d)) });
  for (let i = 0; i < 38; i++) { const t = 69.85 + i * 0.037 + R() * 0.02; I.bell(t, hz(['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'][(R() * 6) | 0]), { gain: 0.0075, dur: 0.5, hard: 0.15, send: 0.8, pan: R() * 1.4 - 0.5 }); }
  bird(71.7, 0.6); bird(72.25, -0.4);

  // ---------------- 73 - 80  one second, one year --------------------------------
  I.crickets(72.9, 76.3, win(72.9, 76.3, 0.8));
  I.fire(73.0, 80, curve([[73.0, 0], [73.8, 0.80], [76.0, 0.50], [79.2, 0.38], [80, 0]]), 69);
  for (let s = 73; s <= 79; s++) I.heart(s, { gain: 0.26 + 0.018 * (s - 73) });
  I.tone(73.2, 6.8, { f: () => hz('D2'), gain: 0.032, attack: 1.6, release: 0.6, harm: 0.2 });
  // the same voice, the same notes, the same octave as the first one
  play([[0, 1.5, 'D4'], [1.5, 0.5, 'A4'], [2, 1.05, 'G4'], [3.05, 1.2, 'F4']], 73.55, 1.0, (t, d, f, p) => I.sing(t, d, f, { gain: 0.125, from: p, send: 0.4 }));
  play([[0, 1.05, 'E4'], [1.05, 0.4, 'F#4']], 77.8, 1.0, (t, d, f, p) => I.sing(t, d, f, { gain: 0.118, from: p || hz('F4') }));
  I.sing(79.25, 0.72, hz('D4'), { gain: 0.13, from: hz('F#4'), release: 0.03, attack: 0.1 });
  play([[0, 0.95, 'A4'], [0.95, 0.35, 'D5'], [1.3, 0.75, 'C#5']], 76.55, 1.0, (t, d, f, p) => I.flute(t, d, f, { gain: 0.036, from: p, send: 0.55, bright: 0.7 }));
  I.flute(78.65, 1.33, hz('D5'), { gain: 0.042, from: hz('C#5'), send: 0.55, bright: 0.7 });
  I.strings(75.9, 1.9, chord('G2 D3 B3'), { gain: 0.034, attack: 1.0, release: 0.7, cutoff: 1100 });
  I.strings(77.6, 1.2, chord('A2 E3 C#4 E4'), { gain: 0.042, attack: 0.7, release: 0.5, cutoff: 1500 });
  I.strings(78.75, 1.25, chord('D2 A2 D3 F#3 A3'), { gain: 0.055, attack: 0.5, release: 0.02, cutoff: 1800 });
  I.pad(78.7, 1.3, chord('D4 F#4 A4'), { gain: 0.030, attack: 0.7, release: 0.02, glass: 0.4 });
  I.bell(79.5, hz('D5'), { gain: 0.096, dur: 1.4, hard: 0.45, send: 0.85 });
  I.bell(79.5, hz('A5'), { gain: 0.055, dur: 1.2, hard: 0.1, send: 0.9, pan: 0.35 });
  I.bell(79.5, hz('F#6'), { gain: 0.020, dur: 1.0, hard: 0.1, send: 0.9, pan: -0.35 });

  // ---------------- the gear changes -----------------------------------------
  const changes = [];
  for (let n = 1; n < TL.DURATION; n++) if (TL.RATES[n] !== TL.RATES[n - 1]) changes.push(n);
  changes.forEach((n, i) => {
    if (n === TL.NOW_T) return;                     // 2026 has its own sound
    const k = i / (changes.length - 1);             // lower with every downshift
    const big = Math.log10(TL.RATES[n - 1]) - Math.log10(TL.RATES[n]);
    const gain = 0.8 + Math.min(1, big * 2.2) * 0.6;
    const f = 4100 - 2600 * k;
    I.click(n - 0.036, { gain: 0.055 * gain, f: f * 1.15, q: 7, pan: -0.55, send: 0.12 });
    I.click(n - 0.018, { gain: 0.070 * gain, f, q: 7, pan: -0.5, send: 0.12 });
    I.click(n, { gain: 0.105 * gain, f: f * 0.72, q: 5, pan: -0.45, send: 0.2, len: 0.09 });
    I.tone(n, 0.24, { f: (x) => (128 - 62 * k) * (0.55 + 0.45 * Math.exp(-x * 22)), gain: 0.13 * gain, attack: 0.004, release: 0.17, pan: -0.3, send: 0.1 });
  });
  return { changes };
}

// Every instrument is synthesized here; nothing is sampled.
import { SR, TAU, voice, Biquad, pinkSource, whiteSource, saw, adsr, rng, smooth, clamp } from './dsp.mjs';

let seedN = 1000;
const nextSeed = () => seedN++;

// a human voice: glottal source through vowel resonances
export function sing(t, dur, f, o = {}) {
  const { gain = 0.2, pan = 0, send = 0.35, vowel = 'hum', from = null, vib = 1, breath = 0.012, attack = 0.18, release = 0.35 } = o;
  const V = {
    hum: [[270, 5, 1.0], [640, 5, 0.28], [2300, 9, 0.03]],
    oo: [[340, 7, 1.0], [800, 8, 0.45], [2500, 10, 0.05]],
    ah: [[690, 6, 1.0], [1120, 8, 0.7], [2650, 10, 0.18]],
  }[vowel];
  const bands = V.map(([fc, q, a]) => [new Biquad('bp', fc, q), a * Math.sqrt(q)]);
  const lp = new Biquad('lp', vowel === 'hum' ? 1100 : 3200, 0.6);
  const noise = pinkSource(nextSeed());
  const r = rng(nextSeed());
  let phase = 0, jit = 0;
  voice(t, dur + release, (tau) => {
    const glide = from ? from + (f - from) * smooth(tau / 0.12) : f;
    const v = 1 + vib * 0.0075 * Math.sin(TAU * 5.1 * tau + 0.6 * Math.sin(tau * 2.3)) * smooth((tau - 0.22) / 0.5);
    jit += ((r() - 0.5) * 0.0016 - jit * 0.002);
    const ff = glide * v * (1 + jit * 0.5);
    phase = (phase + ff / SR) % 1;
    // soft glottal pulse: saw with a rounded edge
    const src = saw(phase, ff / SR) * 0.55 + Math.sin(TAU * phase) * 0.75;
    const n = noise();
    let y = 0;
    for (const [bq, a] of bands) y += bq.run(src + n * breath * 14) * a;
    y = lp.run(y + Math.sin(TAU * phase) * 0.34);
    const env = smooth(tau / attack) * (tau > dur ? smooth(1 - (tau - dur) / release) : 1);
    return y * env * (0.92 + 0.08 * Math.sin(tau * 3.1));
  }, { gain, pan, send });
}

// a bone or wood flute
export function flute(t, dur, f, o = {}) {
  const { gain = 0.16, pan = 0, send = 0.5, from = null, bright = 1 } = o;
  const noise = whiteSource(nextSeed());
  const bp = new Biquad('bp', f * 2.0, 7);
  const air = new Biquad('hp', 2400, 0.7);
  let p = 0;
  voice(t, dur + 0.16, (tau) => {
    const scoop = 1 - 0.030 * Math.exp(-tau * 28);
    const glide = from ? from + (f - from) * smooth(tau / 0.07) : f;
    const vib = 1 + 0.0065 * Math.sin(TAU * 4.9 * tau) * smooth((tau - 0.25) / 0.4);
    p += glide * scoop * vib / SR;
    const tone = Math.sin(TAU * p) + 0.16 * bright * Math.sin(TAU * p * 2 + 0.4) + 0.085 * bright * Math.sin(TAU * p * 3);
    const n = noise();
    const chiff = bp.run(n) * (0.9 * Math.exp(-tau * 22) + 0.20) + air.run(n) * 0.012;
    const env = smooth(tau / 0.055) * (tau > dur ? smooth(1 - (tau - dur) / 0.16) : 1);
    return (tone * 0.82 + chiff * 0.85) * env;
  }, { gain, pan, send });
}

// plucked string (Karplus-Strong with fractional delay)
export function pluck(t, f, o = {}) {
  const { gain = 0.2, pan = 0, send = 0.3, dur = 2.2, bright = 0.55, decay = 0.9962 } = o;
  const len = SR / f - 0.5;
  const n = Math.floor(len), frac = len - n;
  const buf = new Float64Array(n + 2);
  const noise = whiteSource(nextSeed());
  let lp = 0;
  for (let i = 0; i < buf.length; i++) { lp += bright * (noise() - lp); buf[i] = lp; }
  let mean = 0; for (const v of buf) mean += v / buf.length;
  for (let i = 0; i < buf.length; i++) buf[i] -= mean;
  let idx = 0, prev = 0, ap = 0, apx = 0;
  const C = (1 - frac) / (1 + frac);
  const ring = new Float64Array(n);
  for (let i = 0; i < n; i++) ring[i] = buf[i];
  voice(t, dur, (tau) => {
    const out = ring[idx];
    const avg = (out + prev) * 0.5 * decay;
    prev = out;
    const y = C * avg + apx - C * ap;      // first-order allpass for tuning
    apx = avg; ap = y;
    ring[idx] = y;
    idx = (idx + 1) % n;
    return out * smooth(tau / 0.002) * (tau > dur - 0.25 ? smooth((dur - tau) / 0.25) : 1);
  }, { gain, pan, send });
}

// struck bronze
export function bell(t, f, o = {}) {
  const { gain = 0.18, pan = 0, send = 0.55, dur = 3.2, hard = 1, kind = 'bronze' } = o;
  const P = kind === 'church'
    ? [[0.5, 0.5, 1.0], [1.0, 1.0, 0.82], [1.19, 0.62, 0.66], [1.5, 0.35, 0.5], [2.0, 0.55, 0.38], [2.51, 0.3, 0.26], [2.66, 0.22, 0.22], [3.01, 0.18, 0.18], [4.1, 0.1, 0.12]]
    : [[1.0, 1.0, 1.0], [2.005, 0.42, 0.62], [2.76, 0.30, 0.42], [4.07, 0.16, 0.26], [5.40, 0.10, 0.18], [6.8, 0.05, 0.10]];
  const phases = P.map(() => 0);
  const noise = whiteSource(nextSeed());
  const hp = new Biquad('bp', Math.min(f * 6, 9000), 1.4);
  voice(t, dur, (tau) => {
    let y = 0;
    for (let i = 0; i < P.length; i++) {
      const [ratio, amp, d] = P[i];
      phases[i] += f * ratio * (1 + (i % 2 ? 0.0009 : -0.0006)) / SR;
      y += Math.sin(TAU * phases[i]) * amp * Math.exp(-tau * 3.1 / (dur * d));
    }
    y = y * 0.4 + hp.run(noise()) * Math.exp(-tau * 90) * 0.35 * hard;
    return y * smooth(tau / 0.003) * (tau > dur - 0.2 ? smooth((dur - tau) / 0.2) : 1);
  }, { gain, pan, send });
}

// a bowed string section
export function strings(t, dur, freqs, o = {}) {
  const { gain = 0.08, send = 0.45, attack = 0.7, release = 0.9, cutoff = 1900, swell = 0 } = o;
  freqs.forEach((f, k) => {
    for (const [det, pan] of [[-0.0045, -0.7], [0.0004, 0], [0.0049, 0.7]]) {
      const lp = new Biquad('lp', cutoff, 0.6), body = new Biquad('pk', 460, 1.2, 3);
      let p = hash01(k * 31 + det * 1000);
      voice(t, dur + release, (tau, i) => {
        const vib = 1 + 0.0038 * Math.sin(TAU * (5.0 + k * 0.23) * tau + k + det * 900) * smooth(tau / 1.2);
        const ff = f * (1 + det) * vib;
        p = (p + ff / SR) % 1;
        if ((i & 511) === 0) lp.set('lp', cutoff * (0.7 + 0.3 * smooth(tau / (attack * 2)) + swell * clamp(tau / dur)), 0.6);
        const env = smooth(tau / attack) * (tau > dur ? smooth(1 - (tau - dur) / release) : 1);
        return body.run(lp.run(saw(p, ff / SR))) * env * (1 + swell * clamp(tau / dur));
      }, { gain: gain * (det === 0.0004 ? 0.75 : 0.55), pan, send });
    }
  });
}
const hash01 = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// slow sine pad with a glassy upper shimmer
export function pad(t, dur, freqs, o = {}) {
  const { gain = 0.07, send = 0.55, attack = 1.0, release = 1.2, glass = 0.3 } = o;
  freqs.forEach((f, k) => {
    const pan = ((k % 3) - 1) * 0.55;
    const ph = [0, 0, 0, 0];
    voice(t, dur + release, (tau) => {
      ph[0] += f / SR; ph[1] += f * 1.0035 / SR; ph[2] += f * 2.001 / SR; ph[3] += f * 3.012 / SR;
      const shimmer = 0.5 + 0.5 * Math.sin(TAU * (0.31 + k * 0.07) * tau + k * 2);
      const y = Math.sin(TAU * ph[0]) * 0.6 + Math.sin(TAU * ph[1]) * 0.4 + Math.sin(TAU * ph[2]) * 0.20 * (0.4 + glass * shimmer) + Math.sin(TAU * ph[3]) * glass * 0.18 * (1 - shimmer);
      const env = smooth(tau / attack) * (tau > dur ? smooth(1 - (tau - dur) / release) : 1);
      return y * env;
    }, { gain, pan, send });
  });
}

// hammered strings, for the age of the piano
export function piano(t, f, o = {}) {
  const { gain = 0.14, pan = 0, send = 0.3, dur = 1.8 } = o;
  const B = 0.00035;
  const parts = [];
  for (let n = 1; n <= 9; n++) parts.push([n * f * Math.sqrt(1 + B * n * n), Math.pow(n, -1.35), 1.6 / (1 + n * 0.55)]);
  const ph = parts.map(() => 0);
  const noise = whiteSource(nextSeed()), thump = new Biquad('lp', 900, 0.7);
  voice(t, dur, (tau) => {
    let y = 0;
    for (let i = 0; i < parts.length; i++) {
      const [ff, a, d] = parts[i];
      ph[i] += ff / SR;
      y += Math.sin(TAU * ph[i]) * a * Math.exp(-tau / (d * 0.62));
    }
    return (y * 0.5 + thump.run(noise()) * Math.exp(-tau * 70) * 0.5) * smooth(tau / 0.003) * (tau > dur - 0.2 ? smooth((dur - tau) / 0.2) : 1);
  }, { gain, pan, send });
}

// electronic pluck with a closing filter
export function synth(t, f, o = {}) {
  const { gain = 0.07, pan = 0, send = 0.28, dur = 0.22, open = 3800, res = 3.5 } = o;
  const lp = new Biquad('lp', open, res);
  let p = 0, q = 0.31;
  voice(t, dur, (tau, i) => {
    p = (p + f / SR) % 1; q = (q + f * 1.006 / SR) % 1;
    if ((i & 63) === 0) lp.set('lp', 300 + open * Math.exp(-tau * 18), res);
    return lp.run(saw(p, f / SR) * 0.6 + saw(q, f * 1.006 / SR) * 0.4) * smooth(tau / 0.004) * Math.exp(-tau * 8) * (tau > dur - 0.02 ? (dur - tau) / 0.02 : 1);
  }, { gain, pan, send });
}

// stretched skin
export function drum(t, f, o = {}) {
  const { gain = 0.3, pan = 0, send = 0.18, dur = 0.7, snap = 0.4 } = o;
  const modes = [[1, 1, 1], [1.59, 0.5, 0.6], [2.14, 0.3, 0.45], [2.30, 0.22, 0.4], [2.92, 0.12, 0.3]];
  const ph = modes.map(() => 0);
  const noise = whiteSource(nextSeed()), bp = new Biquad('bp', f * 9, 0.9);
  voice(t, dur, (tau) => {
    let y = 0;
    const bend = 1 + 0.16 * Math.exp(-tau * 30);
    for (let i = 0; i < modes.length; i++) {
      ph[i] += f * modes[i][0] * bend / SR;
      y += Math.sin(TAU * ph[i]) * modes[i][1] * Math.exp(-tau * 7.5 / (modes[i][2] * dur * 1.6));
    }
    return (y * 0.55 + bp.run(noise()) * snap * Math.exp(-tau * 55)) * smooth(tau / 0.0015) * (tau > dur - 0.05 ? clamp((dur - tau) / 0.05) : 1);
  }, { gain, pan, send });
}

// a heart: two soft low thumps
export function heart(t, o = {}) {
  const { gain = 0.34, send = 0.08, soft = 1 } = o;
  for (const [dt, k, f] of [[0, 1, 58], [0.17, 0.62, 66]]) {
    let p = 0;
    voice(t + dt, 0.3, (tau) => {
      p += (f * 0.72 + f * 0.7 * Math.exp(-tau * 34)) / SR;
      return (Math.sin(TAU * p) + 0.22 * Math.sin(TAU * p * 2) * soft) * Math.exp(-tau * 17) * smooth(tau / 0.006) * k;
    }, { gain, send });
  }
}

// wood or stone struck together
export function click(t, o = {}) {
  const { gain = 0.1, pan = 0, f = 2200, q = 5, send = 0.2, len = 0.07, near = 0.2 } = o;
  const noise = whiteSource(nextSeed()), bp = new Biquad('bp', f, q);
  voice(t, len, (tau) => bp.run(noise()) * Math.exp(-tau * 95) * smooth(tau / 0.0006) * 3.2, { gain, pan, send, near });
}

// filtered noise with an envelope: breath, wind, water, steam, rumble
export function wash(t, dur, o = {}) {
  const { gain = 0.1, pan = 0, send = 0.2, type = 'bp', f = 800, q = 0.9, color = 'pink', env = null, sweep = null, attack = 0.2, release = 0.3, stereo = 0 } = o;
  const make = (p) => {
    const src = color === 'pink' ? pinkSource(nextSeed()) : whiteSource(nextSeed());
    const bq = new Biquad(type, f, q), hp = new Biquad('hp', 30, 0.7);
    voice(t, dur, (tau, i) => {
      if (sweep && (i & 127) === 0) bq.set(type, sweep(tau), q);
      const e = env ? env(tau) : adsr(tau, dur, attack, release);
      return hp.run(bq.run(src())) * e;
    }, { gain: stereo ? gain * 0.72 : gain, pan: p, send });
  };
  if (stereo) { make(-stereo); make(stereo); } else make(pan);
}

// a swelling or falling pure tone (sub drops, rumbles, hits)
export function tone(t, dur, o = {}) {
  const { gain = 0.2, pan = 0, send = 0.15, f = () => 55, env = null, attack = 0.02, release = 0.3, harm = 0 } = o;
  let p = 0;
  voice(t, dur, (tau) => {
    p += f(tau) / SR;
    const e = env ? env(tau) : adsr(tau, dur, attack, release);
    return (Math.sin(TAU * p) + harm * Math.sin(TAU * p * 2) + harm * 0.5 * Math.sin(TAU * p * 3)) * e;
  }, { gain, pan, send });
}

// campfire: a low breathing roar and many small sharp cracks
export function fire(t0, t1, level, seed = 7) {
  const dur = t1 - t0;
  const roar = pinkSource(seed), lp = new Biquad('lp', 380, 0.7);
  const lvl = (tau) => level(t0 + tau);
  let wob = 0;
  const r = rng(seed + 1);
  voice(t0, dur, (tau) => {
    wob += ((r() - 0.5) * 0.02 - wob * 0.0006);
    return lp.run(roar()) * lvl(tau) * (0.8 + clamp(wob, -0.5, 0.5));
  }, { gain: 0.15, send: 0.08 });
  const c = rng(seed + 2);
  let t = t0;
  while (t < t1) {
    t += -Math.log(1 - c()) / 17;
    const a = level(t) * Math.pow(c(), 2.4);
    if (a < 0.004 || t >= t1) continue;
    const big = c() < 0.04;
    click(t, { gain: a * (big ? 0.42 : 0.17), pan: (c() - 0.5) * 0.9, f: big ? 700 + c() * 900 : 1500 + c() * 4800, q: 1.4 + c() * 5, send: 0.1, near: 0.15, len: big ? 0.09 : 0.04 });
  }
}

export function crickets(t0, t1, level) {
  for (const [seed, f, rate, pan] of [[3, 4350, 1.45, -0.65], [8, 3920, 1.13, 0.7], [15, 4780, 0.92, 0.25]]) {
    const r = rng(seed);
    let t = t0 + r() * 0.7;
    while (t < t1) {
      const a = level(t);
      const pulses = 3 + (r() * 2 | 0);
      if (a > 0.01) for (let k = 0; k < pulses; k++) {
        let p = 0;
        voice(t + k * 0.034, 0.026, (tau) => { p += f / SR; return Math.sin(TAU * p) * Math.sin(Math.PI * tau / 0.026); }, { gain: 0.012 * a, pan, send: 0.25 });
      }
      t += (1 / rate) * (0.82 + r() * 0.36);
    }
  }
}

export function chirp(t, o = {}) {
  const { gain = 0.03, pan = 0, f0 = 2800, f1 = 4200, dur = 0.09, send = 0.4 } = o;
  let p = 0;
  voice(t, dur, (tau) => {
    const k = tau / dur;
    p += (f0 + (f1 - f0) * k + Math.sin(k * 21) * 190) / SR;
    return Math.sin(TAU * p) * Math.sin(Math.PI * k);
  }, { gain, pan, send });
}

export function drip(t, f, pan) {
  let p = 0;
  voice(t, 0.2, (tau) => { p += f * (1 + 0.5 * smooth(tau / 0.03)) / SR; return Math.sin(TAU * p) * Math.exp(-tau * 38) * smooth(tau / 0.002); }, { gain: 0.07, pan, send: 0.9 });
}

// ================================================================ synthesised sound: every noise, call and echo is generated live
const Audio = {
  ctx: null, ready: false, listener: { pos: V3(), yaw: 0 }, wet: 0.06, timers: {},
  init() {
    if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || DEMO) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = Settings.volume;
    this.muffle = c.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 3.5;
    this.master.connect(this.muffle); this.muffle.connect(this.comp); this.comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0.9; this.amb.connect(this.master);
    // convolution reverb with a generated impulse: sparse early reflections into a darkening tail
    this.verb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.8), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) { const t = i / c.sampleRate; const k = 0.75 - Math.min(0.68, t * 0.34); lp += ((Math.random() * 2 - 1) - lp) * k; d[i] = lp * Math.exp(-t * 2.35) * (t < 0.012 ? 0 : 1); }
      for (const [t, a] of [[0.017, 0.7], [0.029, 0.5], [0.047, 0.55], [0.071, 0.36], [0.11, 0.3]]) { const i = Math.floor((t + ch * 0.0043) * c.sampleRate); d[i] += a * (ch ? -1 : 1); }
    }
    this.verb.buffer = ir;
    this.send = c.createGain(); this.send.gain.value = this.wet;
    this.sfx.connect(this.send); this.send.connect(this.verb); this.verb.connect(this.master);
    const mkNoise = (secs, kind) => {
      const b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate), d = b.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, br = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * 0.7;
        else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16; }
        else { br = (br + 0.02 * w) / 1.02; d[i] = br * 3.2; }
      }
      // crossfade the ends so loops do not click
      const f = Math.min(2000, d.length >> 3);
      for (let i = 0; i < f; i++) { const a = i / f; d[i] = d[i] * a + d[d.length - f + i] * (1 - a); }
      return b;
    };
    this.noise = { white: mkNoise(2, 'white'), pink: mkNoise(3, 'pink'), brown: mkNoise(5, 'brown') };
    const loop = (buf, type, freq, q, extra) => {
      const src = c.createBufferSource(); src.buffer = this.noise[buf]; src.loop = true;
      const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.value = freq; flt.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      let last = flt; src.connect(flt);
      if (extra) { const f2 = c.createBiquadFilter(); f2.type = extra[0]; f2.frequency.value = extra[1]; flt.connect(f2); last = f2; }
      last.connect(g); g.connect(this.amb);
      src.start(0, Math.random() * 1.5);
      return { src, flt, g, f2: extra ? last : null };
    };
    this.loops = {
      wind: loop('brown', 'bandpass', 340, 0.7), whistle: loop('pink', 'bandpass', 900, 5),
      rain: loop('white', 'highpass', 500, 0.4, ['lowpass', 6500]), drum: loop('pink', 'bandpass', 380, 0.8),
      water: loop('pink', 'bandpass', 520, 0.6), surf: loop('brown', 'lowpass', 700, 0.3),
      cave: loop('brown', 'lowpass', 110, 1.2), fire: loop('brown', 'lowpass', 420, 0.8), lava: loop('brown', 'lowpass', 190, 2.5),
    };
    this.ready = true;
  },
  setVolume(v) { if (this.ready) this.master.gain.value = v; },

  burst({ buf = 'white', type = 'bandpass', freq = 1000, q = 1, gain = 0.2, attack = 0.002, decay = 0.1, delay = 0, rate = 1, pan = 0, sweep = 0, dest }) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noise[buf]; src.playbackRate.value = rate;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), t + attack + decay);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f); f.connect(g);
    this._out(g, pan, dest);
    src.start(t, Math.random() * 1.4); src.stop(t + attack + decay + 0.05);
  },
  tone({ type = 'sine', freq = 440, end = 0, gain = 0.1, attack = 0.005, decay = 0.2, delay = 0, pan = 0, vib = 0, vibRate = 6, filter = 0, q = 1, dest }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (end) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + attack + decay);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vibRate; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + attack + decay + 0.05); }
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    let last = o;
    if (filter) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filter; f.Q.value = q; o.connect(f); last = f; }
    last.connect(g); this._out(g, pan, dest);
    o.start(t); o.stop(t + attack + decay + 0.05);
  },
  _out(node, pan, dest) {
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node.connect(p); p.connect(dest || this.sfx); } else node.connect(dest || this.sfx);
  },
  // ---------------------------------------------------------------- materials underfoot and under tools
  material(m, vol, pitch = 1) {
    const r = () => 0.88 + Math.random() * 0.26;
    const B_ = (o) => this.burst(o);
    switch (m) {
      case 'grass': B_({ buf: 'pink', freq: 1500 * r() * pitch, q: 0.8, gain: 0.2 * vol, attack: 0.012, decay: 0.12 }); B_({ type: 'highpass', freq: 4200, gain: 0.035 * vol, attack: 0.02, decay: 0.1 }); B_({ buf: 'brown', type: 'lowpass', freq: 240 * pitch, gain: 0.2 * vol, decay: 0.07 }); break;
      case 'gravel': for (let i = 0; i < 8; i++) B_({ freq: (1300 + Math.random() * 2800) * pitch, q: 2.2, gain: (0.07 + Math.random() * 0.11) * vol, decay: 0.014 + Math.random() * 0.02, delay: Math.random() * 0.085 }); B_({ buf: 'pink', type: 'lowpass', freq: 600 * pitch, gain: 0.17 * vol, decay: 0.1 }); break;
      case 'sand': B_({ buf: 'pink', type: 'lowpass', freq: 1700 * r() * pitch, gain: 0.2 * vol, attack: 0.025, decay: 0.17 }); B_({ type: 'bandpass', freq: 3200, q: 0.7, gain: 0.035 * vol, attack: 0.03, decay: 0.12 }); break;
      case 'snow': for (let i = 0; i < 16; i++) B_({ freq: (2200 + Math.random() * 3600) * pitch, q: 3, gain: (0.025 + Math.random() * 0.05) * vol, decay: 0.012, delay: i * 0.008 + Math.random() * 0.008 }); B_({ buf: 'brown', type: 'lowpass', freq: 330 * pitch, gain: 0.26 * vol, attack: 0.015, decay: 0.13 }); break;
      case 'wood': this.tone({ freq: 190 * r() * pitch, end: 120 * pitch, gain: 0.17 * vol, decay: 0.085 }); B_({ freq: 720 * r() * pitch, q: 5, gain: 0.25 * vol, decay: 0.055 }); B_({ type: 'highpass', freq: 3200, gain: 0.045 * vol, decay: 0.018 }); break;
      case 'water': B_({ buf: 'pink', freq: 750 * r(), q: 1.1, gain: 0.3 * vol, attack: 0.03, decay: 0.26, sweep: 2.1 }); B_({ freq: 2600, q: 1.4, gain: 0.06 * vol, attack: 0.01, decay: 0.14, delay: 0.04 }); break;
      case 'leaves': B_({ type: 'highpass', freq: 2300 * r() * pitch, gain: 0.12 * vol, attack: 0.012, decay: 0.15 }); B_({ buf: 'pink', freq: 1400, q: 1.5, gain: 0.08 * vol, decay: 0.09, delay: 0.03 }); break;
      case 'glass': B_({ type: 'highpass', freq: 4300, gain: 0.1 * vol, decay: 0.05 }); this.tone({ freq: 2350 * r() * pitch, gain: 0.04 * vol, decay: 0.16 }); this.tone({ freq: 3720 * r() * pitch, gain: 0.025 * vol, decay: 0.11 }); break;
      case 'cloth': B_({ buf: 'pink', type: 'lowpass', freq: 640 * r() * pitch, gain: 0.28 * vol, attack: 0.008, decay: 0.09 }); break;
      case 'metal': this.tone({ freq: 880 * r() * pitch, gain: 0.07 * vol, decay: 0.24 }); this.tone({ freq: 2210 * pitch, gain: 0.045 * vol, decay: 0.16 }); B_({ type: 'highpass', freq: 3000, gain: 0.1 * vol, decay: 0.025 }); break;
      default: B_({ type: 'bandpass', freq: 1850 * r() * pitch, q: 1.3, gain: 0.19 * vol, decay: 0.045 }); B_({ buf: 'brown', type: 'lowpass', freq: 300 * pitch, gain: 0.3 * vol, decay: 0.07 }); this.tone({ type: 'triangle', freq: 130 * r() * pitch, end: 85, gain: 0.09 * vol, decay: 0.05 });
    }
  },
  step(m, vol, land) { if (!this.ready) return; this.material(m, vol * (land ? 1.35 : 0.8), land ? 0.82 : 1); },
  dig(m, vol) { if (!this.ready) return; this.material(m, vol * 0.85, 0.86); },
  breakBlock(m) { if (!this.ready) return; this.material(m, 1.2, 0.78); this.material(m, 0.8, 1.05); for (let i = 0; i < 6; i++) this.burst({ buf: 'pink', freq: 500 + Math.random() * 1800, q: 1.5, gain: 0.07, decay: 0.05, delay: 0.05 + Math.random() * 0.2 }); },
  place(m) { if (!this.ready) return; this.tone({ freq: 128, end: 62, gain: 0.3, decay: 0.12 }); this.burst({ buf: 'brown', type: 'lowpass', freq: 380, gain: 0.36, decay: 0.1 }); this.material(m, 0.65, 0.9); },
  play(name, vol = 1) {
    if (!this.ready) return;
    const v = vol;
    if (name === 'splash') { this.burst({ buf: 'pink', freq: 600, q: 0.7, gain: 0.55 * v, attack: 0.02, decay: 0.6, sweep: 3 }); for (let i = 0; i < 10; i++) this.tone({ freq: 500 + Math.random() * 900, end: 1500 + Math.random() * 900, gain: 0.025 * v, decay: 0.05, delay: 0.12 + Math.random() * 0.5 }); }
    else if (name === 'hurt') { this.tone({ type: 'sawtooth', freq: 190, end: 90, gain: 0.2 * v, decay: 0.2, filter: 520, q: 1.5 }); this.burst({ buf: 'brown', type: 'lowpass', freq: 600, gain: 0.35 * v, decay: 0.14 }); }
    else if (name === 'gulp') { this.tone({ freq: 320, end: 120, gain: 0.2 * v, decay: 0.22 }); }
    else if (name === 'chest') { this.tone({ type: 'sawtooth', freq: 92, end: 138, gain: 0.05 * v, attack: 0.06, decay: 0.3, filter: 900, q: 7, vib: 7, vibRate: 23 }); this.material('wood', 0.7 * v, 0.7); }
    else if (name === 'door') { this.tone({ type: 'sawtooth', freq: 120, end: 175, gain: 0.04 * v, attack: 0.04, decay: 0.24, filter: 1100, q: 8, vib: 11, vibRate: 31 }); this.material('wood', 0.8 * v, 0.62); this.material('metal', 0.25 * v, 0.8); }
    else if (name === 'pickup') { this.tone({ freq: 620, end: 930, gain: 0.07 * v, decay: 0.09 }); this.tone({ freq: 930, end: 1250, gain: 0.04 * v, decay: 0.08, delay: 0.045 }); }
    else if (name === 'craft') { for (let i = 0; i < 3; i++) { this.tone({ freq: 230 + i * 25, end: 150, gain: 0.11 * v, decay: 0.07, delay: i * 0.09 }); this.burst({ freq: 900, q: 4, gain: 0.14 * v, decay: 0.04, delay: i * 0.09 }); } }
    else if (name === 'chew') { for (let i = 0; i < 2; i++) this.burst({ buf: 'pink', freq: 900 + Math.random() * 700, q: 2, gain: 0.16 * v, decay: 0.07, delay: i * 0.08 }); }
    else if (name === 'burp') { this.tone({ type: 'sawtooth', freq: 140, end: 90, gain: 0.07 * v, decay: 0.2, filter: 420, q: 3 }); }
    else if (name === 'snap') { this.burst({ type: 'highpass', freq: 2400, gain: 0.3 * v, decay: 0.06 }); this.material('wood', v, 1.3); }
    else if (name === 'click') { this.tone({ type: 'triangle', freq: 540, end: 420, gain: 0.05 * v, decay: 0.045 }); }
  },
  thunder(dist) {
    if (!this.ready) return;
    const delay = clamp(dist / 343, 0.08, 4), near = clamp(1 - dist / 900, 0.15, 1);
    if (near > 0.5) { this.burst({ type: 'highpass', freq: 1500, gain: 0.55 * near, decay: 0.22, delay }); this.burst({ buf: 'pink', type: 'bandpass', freq: 900, q: 0.5, gain: 0.6 * near, decay: 0.5, delay: delay + 0.03, sweep: 0.2 }); }
    this.burst({ buf: 'brown', type: 'lowpass', freq: 340, gain: 0.95 * near, attack: 0.03, decay: 3.6, delay: delay + 0.04, sweep: 0.25 });
    for (let i = 0; i < 6; i++) this.burst({ buf: 'brown', type: 'lowpass', freq: 130 + Math.random() * 200, gain: (0.25 + Math.random() * 0.5) * near, attack: 0.08, decay: 0.5 + Math.random() * 0.8, delay: delay + 0.25 + i * 0.37 + Math.random() * 0.2 });
  },
  creature(kind, pos, vol) {
    if (!this.ready) return;
    const dx = pos.x - this.listener.pos.x, dz = pos.z - this.listener.pos.z, d = Math.hypot(dx, dz, pos.y - this.listener.pos.y);
    const att = vol / (1 + d * d / 90);
    if (att < 0.012) return;
    const pan = clamp((dx * Math.cos(this.listener.yaw) - dz * Math.sin(this.listener.yaw)) / (d + 0.001), -1, 1) * 0.85;
    const T = (o) => this.tone(Object.assign({ pan }, o)), N = (o) => this.burst(Object.assign({ pan }, o));
    const j = 0.9 + Math.random() * 0.2;
    switch (kind) {
      case 'grunt': T({ type: 'sawtooth', freq: 104 * j, end: 78 * j, gain: 0.34 * att, attack: 0.05, decay: 0.36, filter: 380, q: 2.4, vib: 5, vibRate: 14 }); T({ type: 'sawtooth', freq: 156 * j, end: 110, gain: 0.12 * att, attack: 0.06, decay: 0.28, filter: 780, q: 4 }); break;
      case 'squeak': T({ freq: 1850 * j, end: 2750 * j, gain: 0.07 * att, decay: 0.09 }); T({ freq: 2200 * j, end: 1700, gain: 0.05 * att, decay: 0.08, delay: 0.12 }); break;
      case 'call': T({ freq: 880 * j, end: 1420 * j, gain: 0.1 * att, attack: 0.04, decay: 0.26, vib: 34, vibRate: 17 }); T({ freq: 1380 * j, end: 640, gain: 0.09 * att, attack: 0.02, decay: 0.42, delay: 0.29, vib: 28, vibRate: 21 }); break;
      case 'growl': T({ type: 'sawtooth', freq: 55 * j, end: 46, gain: 0.34 * att, attack: 0.2, decay: 0.85, filter: 240, q: 1.3, vib: 9, vibRate: 27 }); N({ buf: 'brown', type: 'lowpass', freq: 430, gain: 0.3 * att, attack: 0.25, decay: 0.7 }); break;
      case 'hiss': N({ type: 'highpass', freq: 2600, gain: 0.34 * att, attack: 0.42, decay: 0.24, sweep: 1.7 }); T({ type: 'sawtooth', freq: 70, end: 150, gain: 0.2 * att, attack: 0.45, decay: 0.2, filter: 420, q: 2, vib: 14, vibRate: 33 }); break;
      case 'snarl': T({ type: 'sawtooth', freq: 190 * j, end: 66, gain: 0.34 * att, attack: 0.01, decay: 0.36, filter: 560, q: 1.2, vib: 22, vibRate: 41 }); N({ buf: 'pink', freq: 1300, q: 1, gain: 0.3 * att, decay: 0.3 }); break;
      case 'chime': for (const [f, a] of [[618, 0.06], [931, 0.04], [1313, 0.028], [1772, 0.016]]) T({ freq: f * j, gain: a * att, attack: 0.12, decay: 1.6, vib: 3, vibRate: 3.4 }); break;
      case 'charge': T({ freq: 190, end: 940, gain: 0.14 * att, attack: 0.6, decay: 0.16, vib: 26, vibRate: 24 }); T({ type: 'triangle', freq: 285, end: 1420, gain: 0.07 * att, attack: 0.62, decay: 0.14 }); break;
      case 'dash': N({ buf: 'pink', freq: 480, q: 1.4, gain: 0.4 * att, attack: 0.04, decay: 0.34, sweep: 4.5 }); break;
      case 'hurt': T({ type: 'sawtooth', freq: 300 * j, end: 150, gain: 0.2 * att, decay: 0.15, filter: 700, q: 2 }); N({ buf: 'brown', type: 'lowpass', freq: 700, gain: 0.4 * att, decay: 0.1 }); break;
      case 'death': T({ type: 'sawtooth', freq: 220, end: 44, gain: 0.22 * att, decay: 0.8, filter: 430, q: 1.4 }); N({ buf: 'pink', type: 'lowpass', freq: 2400, gain: 0.26 * att, attack: 0.02, decay: 1.0, sweep: 0.1 }); break;
    }
  },
  _every(name, dt, min, max, fn) { this.timers[name] = (this.timers[name] === undefined ? min * Math.random() : this.timers[name]) - dt; if (this.timers[name] <= 0) { this.timers[name] = min + Math.random() * (max - min); fn(); } },
  // continuous ambience, driven by where the player is and what the sky is doing
  update(dt, env) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, L = this.loops;
    const set = (node, v, tc = 0.4) => node.setTargetAtTime(v, t, tc);
    this.listener.pos.copy(env.pos); this.listener.yaw = env.yaw;
    set(this.muffle.frequency, env.underwater ? 520 : 20000, 0.07);
    this.wet = env.cave > 0.5 ? 0.5 : env.enclosed > 0.5 ? 0.24 : 0.05;
    set(this.send.gain, this.wet);
    const open = (1 - env.cave) * (env.underwater ? 0.15 : 1);
    const gust = 0.65 + 0.35 * Math.sin(t * 0.37) * Math.sin(t * 0.91 + 1.7);
    const alt = clamp((env.pos.y - SEA) / 110, 0, 1);
    set(L.wind.g.gain, (0.035 + alt * 0.16 + env.storm * 0.2) * gust * open); set(L.wind.flt.frequency, 240 + alt * 380 + env.storm * 260 + gust * 130);
    set(L.whistle.g.gain, (alt * alt * 0.05 + env.storm * 0.035) * gust * gust * open); set(L.whistle.flt.frequency, 700 + gust * 600);
    const cover = env.enclosed;
    set(L.rain.g.gain, env.rain * (0.22 - cover * 0.12) * open); set(L.rain.f2.frequency, cover > 0.5 ? 1400 : 6500);
    set(L.drum.g.gain, env.rain * cover * 0.16 * (1 - env.cave));
    const swell = 0.5 + 0.5 * Math.sin(t * 0.62) * Math.sin(t * 0.23 + 2);
    set(L.water.g.gain, env.river * 0.17 * (0.85 + 0.15 * Math.sin(t * 5.3)) * open);
    set(L.surf.g.gain, env.surf * (0.05 + swell * swell * 0.2) * open, 0.25);
    set(L.cave.g.gain, env.cave * 0.15, 1.0);
    set(L.fire.g.gain, env.fire * 0.14); set(L.lava.g.gain, env.lava * 0.2);
    if (env.fire > 0.05) this._every('crackle', dt, 0.03, 0.2, () => this.burst({ type: 'highpass', freq: 1400 + Math.random() * 3000, gain: 0.09 * env.fire * Math.random(), decay: 0.006 + Math.random() * 0.025 }));
    if (env.lava > 0.05) this._every('bubble', dt, 0.25, 1.4, () => { this.tone({ freq: 70 + Math.random() * 70, end: 160 + Math.random() * 90, gain: 0.12 * env.lava, attack: 0.03, decay: 0.14 }); if (Math.random() < 0.3) this.burst({ type: 'highpass', freq: 2000, gain: 0.06 * env.lava, decay: 0.25 }); });
    if (env.cave > 0.5) this._every('drip', dt, 0.8, 4.5, () => { const f = 900 + Math.random() * 1500, pan = Math.random() * 1.6 - 0.8; this.tone({ freq: f, end: f * 1.9, gain: 0.07, decay: 0.07, pan }); if (Math.random() < 0.35) this.tone({ freq: f * 0.8, end: f * 1.5, gain: 0.04, decay: 0.06, delay: 0.16, pan }); });
    const outdoors = (1 - env.cave) * (1 - env.rain) * (env.underwater ? 0 : 1);
    if (outdoors > 0.3 && env.night < 0.35 && env.birds > 0) this._every('bird', dt, 0.7, 4.2, () => {
      const pan = Math.random() * 1.8 - 0.9, vol = (0.018 + Math.random() * 0.03) * env.birds, species = Math.floor(Math.random() * 4);
      const base = [2900, 3900, 2300, 4600][species] * (0.9 + Math.random() * 0.2);
      const n = [3, 6, 2, 5][species] + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const d = i * [0.13, 0.075, 0.28, 0.095][species] + Math.random() * 0.02;
        this.tone({ freq: base * (1 + (species === 1 ? i * 0.03 : (Math.random() - 0.5) * 0.12)), end: base * [1.3, 0.82, 0.7, 1.18][species], gain: vol, attack: 0.012, decay: [0.07, 0.04, 0.2, 0.05][species], delay: d, pan, vib: species === 2 ? 120 : 0, vibRate: 28, dest: this.amb });
      }
    });
    if (outdoors > 0.3 && env.night > 0.55 && env.warm > 0) {
      this._every('cricket', dt, 0.28, 0.55, () => { const pan = [-0.7, 0.15, 0.75][Math.floor(Math.random() * 3)], f = 4100 + pan * 260; for (let i = 0; i < 3; i++) this.tone({ freq: f, gain: 0.012 * env.warm, attack: 0.006, decay: 0.028, delay: i * 0.042, pan, dest: this.amb }); });
      this._every('owl', dt, 9, 26, () => { for (let i = 0; i < 2; i++) this.tone({ freq: 392, end: 352, gain: 0.025, attack: 0.07, decay: 0.34, delay: i * 0.62, pan: 0.5, dest: this.amb }); });
      if (env.swamp > 0) this._every('frog', dt, 0.5, 2.4, () => { const pan = Math.random() * 1.6 - 0.8, f = 150 + Math.random() * 120; for (let i = 0; i < 2; i++) this.tone({ type: 'sawtooth', freq: f, end: f * 1.4, gain: 0.07 * env.swamp, decay: 0.09, delay: i * 0.13, filter: f * 5, q: 5, pan, dest: this.amb }); });
    }
    if (env.underwater) this._every('bubbles', dt, 0.3, 1.8, () => { for (let i = 0; i < 3; i++) this.tone({ freq: 280 + Math.random() * 400, end: 800 + Math.random() * 500, gain: 0.05, decay: 0.06, delay: i * 0.07 }); });
  },
};

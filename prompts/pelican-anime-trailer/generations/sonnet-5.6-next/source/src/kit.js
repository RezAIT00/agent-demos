// ---------- shared shot toolkit ----------
const BE = TL.BEAT, bt = x => x * TL.BEAT;
const mkCanvas = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d', { willReadFrequently: true }); return c; };
const SHOTFN = {};
const twos = u => Math.floor(u * 12 + 1e-4) / 12;
const pulse = (u, t0, d = 0.25) => u < t0 ? 0 : Math.max(0, 1 - (u - t0) / d);
const kf = (u, keys) => { // [[t, v], ...] with smooth interpolation
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return lerp(va, vb, easeInOut((u - a) / (b - a))); }
  return keys[keys.length - 1][1];
};
function fxLayer(F) { if (!F.fx) { FX.reset(); F.fx = fxCanvas; } return FX; }
function typeLayer(F) { if (!F.type) { TX.reset(); F.type = typeCanvas; } return TX; }
const freshCtx = c => { const g = c.getContext('2d'); g.reset(); return g; };

// camera shake: deterministic noise
function shake(cam, t, amp, freq = 17) {
  if (amp <= 0) return cam;
  const d = [fbm1(t * freq, 3) * amp, fbm1(t * freq, 11) * amp, 0];
  const cm = camMatrices(cam);
  const off = comb([cm.right, d[0]], [cm.up, d[1]]);
  return Object.assign({}, cam, { pos: add(cam.pos, off), tgt: add(cam.tgt, off), roll: (cam.roll || 0) + fbm1(t * freq * 0.7, 29) * amp * 0.25 });
}
const lerpCam = (a, b, k) => ({ pos: vlerp(a.pos, b.pos, k), tgt: vlerp(a.tgt, b.tgt, k), fov: lerp(a.fov, b.fov, k), roll: lerp(a.roll || 0, b.roll || 0, k) });
const cam = (pos, tgt, fov = 30, roll = 0) => ({ pos, tgt, fov, roll });

// drivetrain lock: the only way a pedalling wheel angle is ever produced
const drive = (crank, extra) => Object.assign({ crank, wheel: crank * BG.gear }, extra || {});
// ride state. Cadence may be capped so the legs stay readable on twos; the wheel still follows the crank exactly.
function ride(speed, ta, o = {}) {
  const R0 = BG.tireOut;
  const rolled = ((o.d0 || 0) + speed * ta) / R0;
  const pedal = o.coast === undefined;
  const crank = pedal ? (o.th0 || 0) + (o.cadence !== undefined ? o.cadence * ta : rolled / BG.gear) : o.coast;
  const wheel = pedal ? crank * BG.gear : rolled;
  const blur = Math.min(2.6, speed / R0 / 12 * 0.72);
  return { wheel, crank, blur, chainFast: pedal && speed > 4.5 };
}

const LIGHT = {
  day: { dir: [0.45, 0.75, 0.55], lit: [1.0, 0.98, 0.93], shade: [1.0, 0.98, 1.02], rim: [1.0, 0.90, 0.62], rimDir: [-0.8, 0.35, -0.5], rimAmt: 0.7 },
  rain: { dir: [0.35, 0.82, 0.45], lit: [0.62, 0.72, 0.92], shade: [0.40, 0.48, 0.72], rim: [0.62, 0.90, 1.0], rimDir: [-0.75, 0.45, -0.5], rimAmt: 0.95 },
  night: { dir: [0.3, 0.8, -0.2], lit: [1.0, 0.86, 0.66], shade: [0.42, 0.42, 0.72], rim: [0.55, 0.72, 1.0], rimDir: [-0.8, 0.3, -0.4], rimAmt: 0.9 },
  dawn: { dir: [-0.35, 0.55, 0.65], lit: [1.05, 0.90, 0.80], shade: [0.82, 0.66, 0.86], rim: [1.0, 0.66, 0.28], rimDir: [-0.25, 0.30, -0.9], rimAmt: 1.0 },
  rival: { dir: [0.25, 0.35, 0.8], lit: [0.82, 0.70, 1.0], shade: [0.50, 0.38, 0.70], rim: [0.86, 0.46, 1.0], rimDir: [-0.7, 0.4, -0.55], rimAmt: 1.0 },
  mountain: { dir: [0.5, 0.78, 0.42], lit: [1.02, 0.99, 0.95], shade: [0.90, 0.94, 1.05], rim: [0.86, 0.96, 1.0], rimDir: [-0.7, 0.4, -0.6], rimAmt: 0.65 },
  sunset: { dir: [0.35, 0.55, 0.75], lit: [1.05, 0.84, 0.70], shade: [0.74, 0.50, 0.74], rim: [1.0, 0.62, 0.18], rimDir: [-0.2, 0.30, -0.9], rimAmt: 1.0 },
  power: { dir: [0.25, -0.20, 0.9], lit: [1.0, 0.88, 0.70], shade: [0.84, 0.50, 0.58], rim: [1.0, 0.93, 0.50], rimDir: [-0.5, -0.5, -0.5], rimAmt: 1.0 },
  macro: { dir: [0.5, 0.7, 0.5], lit: [1.0, 0.90, 0.78], shade: [0.54, 0.46, 0.72], rim: [0.55, 0.80, 1.0], rimDir: [-0.8, 0.4, -0.4], rimAmt: 1.0 },
  finish: { dir: [0.45, 0.50, 0.72], lit: [0.98, 0.85, 0.75], shade: [0.78, 0.58, 0.80], rim: [1.0, 0.68, 0.34], rimDir: [-0.35, 0.30, -0.88], rimAmt: 0.95 }
};
const AURA = {
  gold: { c0: [1.0, 0.99, 0.82], c1: [1.0, 0.76, 0.14], c2: [0.95, 0.24, 0.16] },
  violet: { c0: [0.96, 0.86, 1.0], c1: [0.68, 0.32, 1.0], c2: [0.30, 0.08, 0.55] }
};

// scene helpers
function hero(mb, out, st, bike) {
  const b = Object.assign({ wheel: 0, crank: st.crank || 0, blur: 0 }, bike || {});
  st.crank = b.crank;
  if (!b.hidden) buildBike(mb, out, Object.assign({ root: st.root }, b));
  buildPelican(mb, out, st);
}
function rival(mb, out, st, bike) {
  const b = Object.assign({ wheel: 0, crank: st.crank || 0, blur: 0, rival: true }, bike || {});
  st.crank = b.crank;
  if (!b.hidden) buildBike(mb, out, Object.assign({ root: st.root }, b));
  buildFalcon(mb, out, st);
}
function view3d(F, o) {
  const scene = makeScene(o.scene || (() => { }));
  const v = { cam: o.cam, cm: camMatrices(o.cam), env: o.env, light: o.light || LIGHT.day, mesh: scene.mesh, spokes: scene.spokes, eyes: o.eyes || {}, focus: o.focus, shadowSize: o.shadowSize, poly: o.poly, offset: o.offset, zoom: o.zoom, sil: o.sil, silCol: o.silCol, line: o.line, ink: o.ink, discBlur: o.discBlur, chainBlur: o.chainBlur === undefined ? 0 : o.chainBlur, noShadow: o.noShadow, bright: o.bright };
  F.views.push(v);
  const P = name => scene.A[name] ? project(v.cm, scene.A[name]) : [-999, -999, 1];
  return { A: scene.A, P, cm: v.cm, v, pt: p => project(v.cm, p) };
}
// lean the whole rig about the tyre contact line (positive = toward +z)
const leanM = a => M4.Rx(a);

// downhill: bikes pitch rigidly (wheels stay round); scenery is sheared so trunks and posts stay upright
function downhill(deg) {
  const a = deg * D2R, k = Math.tan(a), shear = M4.id(); shear[1] = -k;
  return { k, rig: M4.Rz(-a), shear, pt: q => M4.pt(M4.Rz(-a), q) };
}
const HILL = downhill(8.5);
// full-screen 2D card
function cardBG(g, o = {}) {
  g.fillStyle = o.color || '#08040f'; g.fillRect(0, 0, W, H);
  const t = o.t || 0;
  g.save(); g.globalAlpha = 0.5;
  for (let i = 0; i < 26; i++) {
    const y = hash2(i, 61) * H, len = 160 + hash2(i, 62) * 620, x = ((hash2(i, 63) * 2600 + t * (240 + 900 * hash2(i, 64))) % 2600) - 600;
    const gr = g.createLinearGradient(x, y, x + len, y); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, o.streak || 'rgba(120,80,190,0.35)'); g.fillStyle = gr; g.fillRect(x, y, len, 1.5 + hash2(i, 65) * 3);
  }
  g.restore();
}
const slam = (u, t0, from = 1.55) => { const k = (u - t0) / 0.14; if (u < t0) return null; return { s: k >= 1 ? 1 : lerp(from, 1, easeOutBack(clamp(k), 0.55)), a: clamp(0.55 + (u - t0) / 0.07), shake: Math.max(0, 1 - (u - t0) / 0.22) }; };
function slamText(g, text, x, y, size, u, t0, o = {}) {
  const s = slam(u, t0, o.from); if (!s) return;
  const jx = fbm1(u * 60, 5) * s.shake * (o.jolt || 16), jy = fbm1(u * 60, 9) * s.shake * (o.jolt || 16);
  const drift = 1 + (u - t0) * (o.drift === undefined ? 0.035 : o.drift);
  g.save(); g.translate(x + jx, y + jy); g.scale(s.s * drift, s.s * drift); g.globalAlpha = s.a;
  heavyText(g, text, 0, 0, size, Object.assign({ skew: 0.16, fill: '#fbf8f2' }, o));
  g.restore();
}
// subtitle bar used for names and lines
function caption(g, text, y, u, t0, o = {}) {
  if (u < t0) return;
  const k = easeOut(clamp((u - t0) / 0.18));
  const size = o.size || 58, wTxt = o.heavy ? heavyWidth(text.toUpperCase(), size) : strokeWidth(text, size);
  g.save(); g.translate(W / 2 + (o.x || 0), y);
  if (o.bar) { g.fillStyle = o.bar; const bw = (wTxt + 110) * k; g.beginPath(); g.moveTo(-bw / 2 + 24, -size * 0.84); g.lineTo(bw / 2 + 24, -size * 0.84); g.lineTo(bw / 2 - 24, size * 0.84); g.lineTo(-bw / 2 - 24, size * 0.84); g.closePath(); g.fill(); }
  g.globalAlpha = k;
  if (o.heavy) heavyText(g, text, (1 - k) * -60, 0, size, { skew: 0.18, fill: o.color || '#fff', layers: o.layers || [['#0d0616', size * 0.12]] });
  else strokeText(g, text, (1 - k) * -40, 0, size, { color: o.color || '#fff', outline: o.outline === undefined ? '#0d0616' : o.outline, weight: size * 0.14, outlineW: size * 0.22 });
  g.restore();
}

// master dispatch
function filmFrame(t) {
  const S = TL.shotAt(t);
  const u = t - S.t0, ua = twos(u);
  const F = { t, draw: Math.floor(u * 12 + 1e-4) + Math.round(S.t0 * 12), views: [], post: {}, fx: null, type: null, S };
  if (SHOTFN[S.id]) SHOTFN[S.id](F, u, ua, S); else { const g = fxLayer(F); cardBG(g, { t }); heavyText(g, S.id, 960, 540, 120); }
  // ink-inverted impact frames: exactly one drawing (2 frames) each
  for (const [beat, style] of TL.IMPACTS) { const dt = t - bt(beat); if (dt >= -1e-4 && dt < 2 / 24 - 1e-4) { F.post.impact = style; } }
  // lens-like punch on every hard hit
  for (const [beat] of TL.IMPACTS) { const dt = t - bt(beat); if (dt >= 0 && dt < 0.4) { const k = 1 - dt / 0.4; const s = F.post.shake || [0, 0, 1, 0]; F.post.shake = [s[0] + fbm1(t * 31, 2) * 0.012 * k * k, s[1] + fbm1(t * 31, 7) * 0.016 * k * k, s[2] + 0.035 * k * k, s[3]]; F.post.chroma = Math.max(F.post.chroma || 0, 1.4 * k); } }
  return F;
}

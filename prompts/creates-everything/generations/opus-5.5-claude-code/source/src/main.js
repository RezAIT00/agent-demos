// Timeline: everything is a pure function of t.
const RAD = Math.PI / 180;
const kSpeed = keys([[0, 3], [1, 6], [1.25, 38], [1.6, 50], [1.9, 36], [2.02, -42], [2.17, -66], [2.36, -30], [2.5, 40], [2.75, 102], [3.2, 116], [4.0, 112], [5.0, 110], [7.0, 104], [8.2, 96], [9.0, 88], [9.7, 60], [10.4, 62], [11, 54], [12.2, 58], [12.96, 125], [13.14, 22], [13.6, 14], [14.0, 14], [14.6, 30], [15.5, 36], [17, 38], [18.6, 42], [19.0, 48], [20, 58], [22, 62], [24, 58], [25.5, 46], [26.5, 24], [27, 14], [28, 7], [35, 5]]);
const kHead = keys([[0, 36], [1, 36], [2.55, 34], [3.1, 16], [3.7, 8], [4.4, 3], [5.0, 4], [5.8, 3], [6.87, 0], [7.93, -3], [9.0, 1], [9.6, -7], [10.3, 8], [10.9, 7], [11.5, -9], [12.1, -5], [12.6, 2], [13, 0], [14, 0], [15, 6], [16, -8], [17, 7], [18, -3], [19, 0], [21, 0], [22, 2.5], [23, -2.5], [24, 2], [25, 0], [35, 0]]);
const kY = keys([[0, 4.5], [1, 5], [1.6, 7], [2.0, 9], [2.5, 10], [2.72, 34], [3.1, 11], [3.6, 9], [4.2, 10], [5.0, 12], [6.07, 12], [7.13, 17], [8.07, 19], [9.0, 15], [9.6, 9], [10.2, 4.6], [10.7, 6.5], [11.4, 24], [12, 35], [12.5, 32], [13, 30], [13.35, 27], [14, 26], [15, 32], [16, 40], [17, 30], [18, 34], [19, 36], [19.6, 48], [20.5, 92], [21.5, 128], [22.5, 104], [23.5, 62], [24.5, 50], [25.5, 72], [26.5, 104], [27, 116]]);
const kPitch = keys([[0, 2.5], [1, 2.5], [1.3, 5], [1.6, 4], [1.85, -4], [2.05, -12], [2.3, -14], [2.55, -12], [2.8, -9], [3.2, -3], [4, 3], [5, 4], [6.2, 11], [7.67, 5], [9.0, 4], [9.6, 5], [10.2, 10], [10.7, 17], [11.3, 10], [11.9, -5], [12.4, -2], [13, 0], [13.5, 2], [14.2, 5], [15, 3], [16, -2], [17, 4], [18, 0], [18.8, -6], [19.3, -14], [20, -16], [21, -12], [22, -6], [23, 0], [24, 6], [25.5, 14], [26.5, 24], [27, 30], [28, 45], [30, 58], [35, 62]]);
const kRollX = keys([[0, 0], [1, 0], [1.9, -4], [2.15, 12], [2.4, -6], [2.7, 8], [3.2, 0], [9, 0], [9.5, -10], [10.1, 6], [10.8, 16], [11.5, -15], [12.1, -20], [12.5, 9], [12.95, 0], [13.3, 6], [14, -4], [15, 10], [16, -12], [17, 8], [18, -6], [19, 0], [20, 0], [21, -14], [22, 12], [23, -10], [24, 6], [25, 0], [35, 0]]);
const kFov = keys([[0, 68], [1, 68], [1.35, 98], [2.0, 92], [2.4, 104], [2.8, 92], [4, 84], [5, 84], [6.87, 94], [9, 92], [10, 86], [11, 82], [12.4, 84], [13, 106], [14, 82], [15, 78], [17, 80], [19, 86], [20, 96], [23, 90], [26, 84], [27, 86], [30, 92], [35, 94]]);
const kExpo = keys([[0, .34], [1.6, .34], [3, .36], [5, .38], [7.93, .46], [9.0, .46], [9.6, .72], [10.1, .95], [11, .98], [11.4, .62], [11.75, .42], [12.3, .80], [12.9, .95], [13.06, .62], [13.4, .50], [14, .55], [15.5, .62], [17, .8], [18.5, 1.25], [19.5, 1.8], [21, 1.9], [25, 2.0], [27, 2.1], [30, 2.6], [35, 3.0]]);
const kWave = keys([[5, 0], [5.6, .10], [6.33, .36], [7, .68], [7.67, .92], [8.2, 1]]);
const PATH = (() => { // integrated once at 1/480 s
  const T1 = 36, dt = 1 / 480, n = Math.ceil(T1 / dt) + 4, X = new Float64Array(n), Z = new Float64Array(n); let x = 0, z = 0;
  for (let i = 0; i < n; i++) { X[i] = x; Z[i] = z; const t = i * dt, h = kHead(t) * RAD, s = kSpeed(t); x += Math.sin(h) * s * dt; z += Math.cos(h) * s * dt; }
  const at = (A, t) => { const f = clamp(t, 0, T1) / dt, i = Math.min(n - 2, Math.floor(f)); return A[i] + (A[i + 1] - A[i]) * (f - i); };
  const x0 = at(X, 8.6); const xr = at(X, 12.95) - x0 - 1.5; return { x: t => at(X, t) - x0 - 1.5 - xr * sstep(9.2, 12.9, t), z: t => at(Z, t) };
})();
const BC = (() => { const s = sunAt(1), n = Math.hypot(s.d[0], s.d[2]); return [PATH.x(1) + s.d[0] / n * 420, PATH.z(1) + s.d[2] / n * 420]; })();
function ringR(t) { const tau = t - T_SEA; if (tau < 0) return -5000; const R = 260 * (1 - Math.exp(-tau / .35)) + 110 * tau + 1400 * Math.max(0, tau - 1.6) ** 2; return R > 24000 ? 1e5 : R; }
function ringS(t) { const tau = t - T_SEA; return tau < 0 ? 0 : sstep(0, .08, tau) * (1 - .45 * sstep(.4, 1.6, tau)) * .95; }
// waterspouts stand where the flight path will shave past them: [path time, metres right of path, radius, seed, birth]
const SPOUTS = [[3.45, 30, 7, .3, 2.3], [3.95, -28, 8, 2.1, 2.45], [4.55, 34, 7.5, 4.4, 2.6], [5.6, -150, 13, 1.2, 2.2], [6.3, 420, 19, 3.3, 2.3], [5.2, -420, 17, 5.1, 2.3], [8.0, 60, 22, 2.7, 2.2]];
function spoutWGSL() { const P = SPOUTS.map(([t, r, R, s]) => { const h = kHead(t) * RAD; return 'vec4f(' + [PATH.x(t) + Math.cos(h) * r, PATH.z(t) - Math.sin(h) * r, R, s].map(v => v.toFixed(3)).join(',') + ')'; }); return 'const SP=array<vec4f,7>(' + P.join(',') + '); const SPT=array<f32,7>(' + SPOUTS.map(s => s[4].toFixed(3)).join(',') + '); fn s0(k:i32)->f32 { return SPT[k]; }'; }
const Z_FREEZE = PATH.z(T_GLASS), Z_END = PATH.z(13.0);
const CITY = { xb: 0, z0: 0 }; // filled after PATH exists
let SEA_H = null; // smoothed swell height under the camera, so the stunt flying hugs real crests
function bakeSea() { const n = Math.ceil(9 * 30) + 2, a = []; for (let i = 0; i < n; i++) { const t = i / 30; let m = -9; for (const la of [0, .12, .25]) m = Math.max(m, seaHeight(E.sp, PATH.x(t + la), PATH.z(t + la), oceanTime(t))); a.push(m); } const b = a.map((_, i) => { let s = 0, w = 0; for (let k = -10; k <= 10; k++) { const j = clamp(i + k, 0, n - 1), g = Math.exp(-k * k / 30); s += a[j] * g; w += g; } return s / w; }); SEA_H = t => { const f = clamp(t, 0, 9) * 30, i = Math.min(n - 2, Math.floor(f)); return lerp(b[i], b[i + 1], f - i); }; }
function oceanTime(t) { const tf = T_GLASS + .10; return 40 + (t < tf ? t : tf + (1 - Math.exp(-(t - tf) * 7)) / 7) * 1.0 + Math.max(0, t - (T_SMASH - .04)) * .7; }
function shake(t) { let a = 0; for (const [h, s, k] of [[T_SEA + .02, 1.1, 3.2], [2.02, 1.9, 3.5], [2.5, 1.0, 4], [T_WAVE, .5, 4], [T_GLASS, .55, 4], [T_SUN, .35, 5], [T_SMASH, 1.7, 4.5], [T_FLY, .4, 4], [T_CITY + .5, 1.0, 2.5], [T_GRAV, .9, 3], [T_TIME, .5, 3]]) if (t > h) a += s * Math.exp(-(t - h) * k); a += .10 * sstep(1.2, 2, t) * (1 - sstep(8.8, 9.2, t)) + .06 * sstep(19.5, 20, t) * (1 - sstep(26, 27, t)); const n = (f, p) => Math.sin(t * f + p) * .6 + Math.sin(t * f * 1.71 + p * 2.3) * .4; const fade = 1 - sstep(35, 36, t); return [a * n(41, .3) * .010 * fade, a * n(47, 2.1) * .010 * fade, a * n(37, 4.2) * .012 * fade]; }
function sunAt(t) { // sky.hour drives both azimuth and elevation; after the day pass the sun keeps setting into night
  const k0 = clamp((t - T_SUN) / 1.36), k = k0 * k0 * (3 - 2 * k0), h = lerp(V_HOUR0, V_HOUR1, k), day = (h - 6) / 12, az = lerp(42, 1.2, sstep(0, 1, day)) * RAD;
  let el = lerp(7.2, 3.1, day) + 40 * Math.sin(Math.PI * day); if (t > T_SUN + 1.36) { const x = t - T_SUN - 1.36; el = 3.1 - 2.6 * sstep(1.8, 5.6, x) - Math.max(0, x - 4.2) * 2.6; el = Math.max(-16, el); }
  el *= RAD; return { d: [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], el, az, h };
}
function sunRad(el) { // E0 * transmittance, same medium as sky.wgsl
  if (el < -.02) return [0, 0, 0];
  const RG = 6360000, RT = 6420000, d = [0, Math.sin(el), Math.cos(el)], o = RG + 30, b = o * d[1], L = -b + Math.sqrt(b * b - o * o + RT * RT); let od = [0, 0, 0]; const n = 60;
  for (let i = 0; i < n; i++) { const a = i / n, c = (i + 1) / n, t0 = L * a * a, t1 = L * c * c, m = (t0 + t1) / 2, h = Math.max(0, Math.hypot(o + d[1] * m, d[2] * m) - RG), r = Math.exp(-h / 8000), mi = Math.exp(-h / 1200), oz = Math.max(0, 1 - Math.abs(h - 25000) / 15000), B = [5.802e-6, 13.558e-6, 33.1e-6], O = [.65e-6, 1.881e-6, .085e-6]; for (let q = 0; q < 3; q++) od[q] += (B[q] * r + 4.4e-6 * TURB * mi + O[q] * oz) * (t1 - t0); }
  const g = sstep(-.02, .01, el); return [20 * Math.exp(-od[0]) * g, 19.4 * Math.exp(-od[1]) * g, 18.6 * Math.exp(-od[2]) * g];
}
const TURB = 2.2;
const smax = (a, b, k) => (a + b + Math.sqrt((a - b) ** 2 + k * k)) / 2;
let CLR = null; // a cone envelope over the wall bound: the camera climbs at most 170 m/s and never touches the water
function clearAt(t) { if (!CLR) { const dt = 1 / 240, n = Math.round(2.6 / dt) + 1, req = new Float64Array(n), env = new Float64Array(n); for (let i = 0; i < n; i++) { const tt = 1.0 + i * dt; let w = 0; for (const d of [-25, 0, 25]) { const h = kHead(tt) * RAD; w = Math.max(w, ringBoundJS(PATH.x(tt) + Math.sin(h) * d, PATH.z(tt) + Math.cos(h) * d, ringR(tt), ringS(tt))); } req[i] = w > .5 ? w + 16 : -50; } for (let i = 0; i < n; i++) { let e = -50; for (let j = 0; j < n; j++) e = Math.max(e, req[j] - 170 * Math.abs(i - j) * dt); env[i] = e; } const sg = .10 * 240, K = Math.ceil(3 * sg); CLR = env.map((_, i) => { let s = 0, ws = 0; for (let k = -K; k <= K; k++) { const g = Math.exp(-k * k / (2 * sg * sg)); s += env[clamp(i + k, 0, n - 1)] * g; ws += g; } return s / ws + 9; }); } const f = clamp((t - 1.0) * 240, 0, CLR.length - 1), i = Math.min(CLR.length - 2, Math.floor(f)); return lerp(CLR[i], CLR[i + 1], f - i); }
function camY(t) {
  const hug = sstep(2.9, 3.4, t) * (1 - sstep(5.3, 6.4, t)); let y = kY(t) + (SEA_H ? SEA_H(t) * 1.45 * hug : 0);
  if (t > 1.0 && t < 3.6) y = smax(y, clearAt(t), 6 + 22 * sstep(1.05, 1.3, t) * (1 - sstep(3.3, 3.55, t)));
  if (t > T_GRAV) y += .5 * -V_G1 * 1.05 * (t - T_GRAV) ** 2;
  return y;
}
// the cosmic camera: eye and target relative to the galaxy centre
const kCos = { ex: keys([[35, 0], [37, 0], [38.5, -1200], [40, -2600], [43, -5400], [45, -4800]]), ey: keys([[35, -2300], [36.5, -1300], [37.5, -200], [38.5, 1800], [40, 4200], [43, 6900], [45, 6000]]), ez: keys([[35, -900], [37, -700], [38.5, -2600], [40, -5600], [43, -6600], [45, -5700]]), tx: keys([[35, 0], [43, 0]]), ty: keys([[35, 600], [36.5, 300], [37.5, 0], [45, 0]]), tz: keys([[35, 300], [37, 0], [45, 0]]), fov: keys([[35, 94], [37, 100], [39, 74], [43, 64], [44.6, 56], [45, 56]]) };
let GALC = [0, 0, 0];
function camAt(t) {
  const dt = 1 / 240, head = kHead(t), dh = (kHead(t + dt) - kHead(t - dt)) / (2 * dt); const sk = shake(t);
  let y = camY(t); const vy = (camY(t + .18) - camY(t - .18)) / .36, sp = Math.max(Math.abs(kSpeed(t)), 8);
  const vp = sstep(1.25, 1.6, t) * (1 - sstep(3.25, 3.6, t)) * Math.atan2(vy, sp) * .45 / RAD;
  const roll = clamp(dh * .62, -34, 34) * .9 + kRollX(t), yaw = head * RAD + sk[0], pit = clamp(kPitch(t) + vp, -80, 80) * RAD + sk[1], ro = roll * RAD + sk[2];
  let F = [Math.sin(yaw) * Math.cos(pit), Math.sin(pit), Math.cos(yaw) * Math.cos(pit)], p = [PATH.x(t), y, PATH.z(t)], fov = kFov(t) * RAD, rollA = ro;
  if (t > T_TIME) { // hand over to the cosmic camera
    const b = ease5(T_TIME, T_TIME + 1.4, t), eye = [GALC[0] + kCos.ex(t), GALC[1] + kCos.ey(t), GALC[2] + kCos.ez(t)], tg = [GALC[0] + kCos.tx(t), GALC[1] + kCos.ty(t), GALC[2] + kCos.tz(t)];
    p = v3.add(v3.mul(p, 1 - b), v3.mul(eye, b)); const F2 = v3.norm(v3.sub(tg, p)); F = v3.norm(v3.add(v3.mul(F, 1 - b), v3.mul(F2, b))); fov = lerp(fov, kCos.fov(t) * RAD, b); rollA = ro * (1 - b) + b * .12 * Math.sin((t - 35) * .3);
  }
  const upH = Math.abs(F[1]) > .985 ? [0, 0, 1] : [0, 1, 0];
  let R = v3.norm(v3.cross(upH, F)), U = v3.cross(F, R);
  const c = Math.cos(rollA), s = Math.sin(rollA); const R2 = v3.add(v3.mul(R, c), v3.mul(U, -s)), U2 = v3.add(v3.mul(U, c), v3.mul(R, s));
  return { p, F, R: R2, U: U2, fov };
}
function project(cam, d) { const z = v3.dot(d, cam.F), f = 1 / Math.tan(cam.fov / 2), asp = RW / RH; return [(v3.dot(d, cam.R) / z * f) * .5 + .5, .5 - (v3.dot(d, cam.U) / z * f * asp) * .5]; }

function worldAt(t) {
  const tau = t - T_SEA, s = sunAt(t), cam = camAt(t), w = { t, cam, sun: s, sunC: sunRad(s.el) };
  w.R = ringR(t); w.ring = ringS(t);
  w.reveal = tau < 0 ? 0 : 5.2 * (1 - Math.exp(-tau * 1.75)); w.warp = tau < 0 ? .05 : 1 - .9 * Math.exp(-tau * 2.6); if (tau > 2.4) w.warp = 1;
  w.light = tau < 0 ? 0 : sstep(0, .16, tau) * (1 + .35 * Math.exp(-tau * 2.5)); w.flash = tau < 0 ? 0 : Math.exp(-tau * 5.0) * sstep(0, .03, tau);
  w.stage = kWave(t); w.flow = 15 * Math.max(0, Math.min(t, T_GLASS + .15) - T_WAVE);
  const g = t - T_GLASS; w.frOn = g >= 0 ? 1 : 0; w.frZ = g < 0 ? -1e5 : Z_FREEZE + 4 + 150 * g + 120 * Math.pow(Math.min(g, 6), 2.2); w.shat = t - 13.0;
  w.inside = sstep(6.4, 7.8, t) * (1 - sstep(T_SMASH, T_SMASH + .25, t)); w.vol = lerp(.0012, .0040, sstep(9.2, 10.6, t)) * sstep(6.6, 8.2, t) * (1 - sstep(T_SMASH, T_SMASH + .4, t)); w.dust = sstep(9, 9.6, t) * (1 - sstep(T_SMASH, T_SMASH + .3, t));
  w.otime = oceanTime(t); w.expo = t < T_TIME ? kExpo(t) : lerp(lerp(kExpo(T_TIME), .55, sstep(T_TIME, T_TIME + 1.2, t)), 1.0, sstep(T_TIME + 2.4, T_TIME + 4.5, t)); w.haze = lerp(lerp(.00004, .00002, sstep(14, 17, t)), .00045, sstep(18.5, 20.5, t) * (1 - sstep(33, 35, t)));
  w.disp = lerp(1, .42, sstep(14.5, 19, t)) * (1 + .5 * sstep(T_GRAV, T_GRAV + 4, t)); w.night = sstep(-1 * RAD, -10 * RAD, -s.el) ; w.night = sstep(.5, 10, -s.el / RAD);
  w.space = sstep(T_TIME + .7, T_TIME + 1.9, t); w.coll = t < T_COLL ? 0 : Math.pow(clamp((t - T_COLL) / 1.65), 2.2);
  w.rg = lerp(1300, 5600, ease5(T_TIME, T_TIME + 4.2, t)); w.tg = Math.max(0, t - T_TIME) * V_TSCALE / 1e15; w.morph = ease5(T_TIME, T_TIME + 2.6, t); w.ign = sstep(T_TIME + 1.0, T_TIME + 3.4, t);
  return w;
}
// The reflection pass runs while anything can show it: the birth mirror (until the ring is done), the barrel and nave, the city.
function reflPass(w) { const tt = w.t, world = w.space < .999; return world && (w.inside > .001 || tt < T_SEA + 1.7 || w.R < 9e4 || (tt > T_CITY - .2)); }
function shadowVP(w) { const L = w.sun.d, c = [0, 24, w.cam.p[2] + 110], R = v3.norm(v3.cross([0, 1, 0], L)), U = v3.cross(L, R), sa = Math.abs(Math.sin(w.sun.az)), hw = 42 + 150 * sa, hh = 78, eye = v3.add(c, v3.mul(L, 420)); return mmul(orthoM(hw, hh, 1, 900), viewM(eye, R, U, v3.mul(L, -1))); }
function fillU(w, vp, ivp, svp, rvp, passId, camP, jit, sub, n) {
  const f = new Float32Array(148); f.set(vp, 0); f.set(ivp, 16); f.set(svp, 32); f.set(rvp, 48); const c = w.cam;
  const V = [[camP[0], camP[1], camP[2], w.t], [...w.sun.d, w.light], [...w.sunC.map(x => x * Math.min(1, w.light)), w.expo], [BC[0], BC[1], w.R, w.ring], [w.reveal, w.warp, w.haze, w.flash], [w.stage, w.cam.p[2], .50, Math.max(0, w.t - T_WAVE)], [w.frZ, w.frOn, Z_END, w.shat], [RW, RH, sub, n], jit, [PROF.W, PROF.HW, PROF.GR, PROF.GB], [w.flow, w.disp, 1.0, w.inside], [...c.F, c.fov], [...c.R, RW / RH], [...c.U, passId], [w.frOn, w.otime, w.vol, w.dust],
    [w.t - T_FLY, w.t - T_CITY, w.t - T_GRAV, w.t - T_TIME], [w.coll, w.night, V_FLOORS, w.space], [...GALC, w.rg], [w.tg, w.morph, w.ign, w.t - T_SEA], [CITY.xb, CITY.z0, -V_G1, w.t - T_SMASH], [passId === 0 && w.reflOn ? 1 : 0, 0, 0, 0]];
  V.forEach((v, i) => f.set(v, 64 + i * 4)); return f;
}
function gridFor(w) {
  const g = new Float32Array(NXG + NZG), cs = w.cam.p[0], cz = w.cam.p[2], zone = w.stage > 0.01, hi = clamp((w.cam.p[1] - 40) / 400, 0, 6);
  const fill = (off, n, c, rate, base, lim) => { const h = n >> 1; let a = 0; for (let i = h; i < n; i++) { g[off + i] = c + a; let d = base + rate * a; a += lim ? lim(c + a, d) : d; } a = 0; for (let i = h - 1; i >= 0; i--) { let d = base + rate * a; a += lim ? lim(c - a, d) : d; g[off + i] = c - a; } };
  const b0 = .10 * (1 + hi * 4); fill(0, NXG, cs, .0118, b0, zone ? (s, d) => (s > -40 && s < 170) ? Math.min(d, .42) : (s >= 170 && s < 330) ? Math.max(Math.min(d, 2.2), .8) : d * 1.35 : null); fill(NXG, NZG, cz, .0118, b0, null); return g;
}
// ---- type
function glyphsFor(w) {
  const t = w.t, out = [], refl = [], E_ = Math.max(w.expo, .2), em0 = .058, asp = RH / RW;
  const push = (arr, ch, penX, base, em, col, a, mode) => { const u = em / GL.EM, ua = Math.abs(u), idx = mode % 2 ? 0 : GL.idx[ch] ?? 0; const h = GL.CH * u, y = base - GL.BY * u; arr.push([(penX - GL.OX * ua * asp), y, GL.CW * ua * asp, h, ...col, a, mode, idx, GL.n, Math.max(.012, .9 / (Math.abs(em) * RH))]); };
  for (let i = 0; i < PROGRAM.length; i++) {
    const L = PROGRAM[i], t0 = i === 0 ? -1 : L.type[0] - .12; if (t < t0 || t > L.enter + .55) continue;
    const str = L.from || L.code; let n = Math.floor(clamp((t - L.type[0]) / (L.type[1] - L.type[0])) * str.length + 1e-6), shown = str.slice(0, n), cur = shown.length;
    if (L.steps) for (const [st, s, ci] of L.steps) if (t >= st) { shown = s; cur = ci ?? s.length; }
    const full = L.code.length, em = em0, adv = GL.ADV * em * asp, post = t - L.enter; let x0, base, vp, hy = 0;
    if (i === 0) { const c1 = camAt(Math.min(t, 1)); const sp = project(c1, sunAt(1).d); x0 = sp[0] - adv * (full + .42); base = sp[1] + em * .5; vp = sp; hy = project(c1, v3.norm([c1.F[0], 0, c1.F[2]]))[1]; }
    else { x0 = .5 - adv * full / 2; base = .86; vp = project(w.cam, v3.norm(v3.add(w.cam.F, v3.mul(w.cam.U, -.12)))); }
    let sc = 1, al = 1, boost = 1;
    if (post > 0) { if (i === 0) { sc = 1 + 10 * post * post + 1.5 * post; al = 1 - sstep(.06, .30, post); boost = 1 + 3 * Math.exp(-post * 18); } else { sc = 1 / (1 + Math.pow(post * 8.5, 2.2)); al = 1 - sstep(.18, .5, post); boost = 1 + 2.2 * Math.exp(-post * 14); } } else if (i > 0) al = sstep(t0, t0 + .1, t);
    if (al <= .002) continue; const C = 2.1 / E_ * boost; const eq = L.code.indexOf('='), op = L.code.indexOf('(');
    const P = (x, y) => [vp[0] + (x - vp[0]) * sc, vp[1] + (y - vp[1]) * sc];
    for (let k = 0; k < shown.length; k++) { const ch = shown[k]; if (ch === ' ') continue; const [px, py] = P(x0 + k * adv, base), num = eq > 0 ? k > eq : op > 0 && k >= op, col = num ? [C * 1.0, C * .62, C * .22] : [C * .86, C * .95, C]; push(out, ch, px, py, em * sc, col, al, 0); if (i === 0 && post < 0) push(refl, ch, px, 2 * hy - py, -em * sc, col, al, 0); }
    if (!(i === 0 && post > .02)) { const [px, py] = P(x0 + cur * adv, base), bl = L.steps && t > L.steps[0][0] && t < L.enter ? 1 : 1; push(out, '', px, py, em * sc, [C * bl, C * bl, C * bl], al, 1); if (i === 0) push(refl, '', px, 2 * hy - py, -em * sc, [C, C, C], al, 1); }
  }
  // the finale: the point is the cursor
  if (t > FINALE.cursorAt - .3) {
    const em = .055, adv = GL.ADV * em * asp, C = 2.1 / E_, L0 = FINALE.lines[0], L1 = FINALE.lines[1], n0 = L0.length, n1 = L1.length;
    const ty = FINALE.type, total = n0 + n1, k = clamp((t - ty[0]) / (ty[1] - ty[0])), nt = Math.floor(Math.pow(k, .92) * total + 1e-6);
    const x0a = .5 - adv * n0 / 2, x0b = .5 - adv * n1 / 2, ya = .5 - em * .55, yb = ya + em * 2.45;
    const shown0 = L0.slice(0, Math.min(nt, n0)), shown1 = L1.slice(0, Math.max(0, nt - n0));
    for (let i = 0; i < shown0.length; i++) if (shown0[i] !== ' ') push(out, shown0[i], x0a + i * adv, ya, em, [C * .9, C * .95, C], 1, 0);
    for (let i = 0; i < shown1.length; i++) if (shown1[i] !== ' ') push(out, shown1[i], x0b + i * adv, yb, em, [C * .9, C * .95, C], 1, 0);
    let cx, cy; const sl = ease5(FINALE.slide[0], FINALE.slide[1], t);
    if (nt <= n0) { cx = lerp(.5 - adv * .3, x0a, sl) + shown0.length * adv; cy = lerp(.5 + em * .5, ya, sl); } else { cx = x0b + shown1.length * adv; cy = yb; }
    const typing = t > ty[0] && t < ty[1] + .05, blink = typing || t < FINALE.cursorAt + .5 ? 1 : (Math.floor((t - ty[1]) / .53) % 2 === 0 ? 1 : 0), app = sstep(FINALE.cursorAt - .25, FINALE.cursorAt + .05, t);
    if (blink) push(out, '', cx, cy, em, [C, C, C], app, 1);
  }
  const all = out.concat(refl).slice(0, 256), f = new Float32Array(256 * 12); all.forEach((o, i) => f.set(o, i * 12)); return { f, n: Math.min(out.length, 256), nr: Math.max(0, all.length - out.length) };
}
const HAL = (() => { const h = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }; return Array.from({ length: 128 }, (_, i) => [h(i + 1, 2), h(i + 1, 3), h(i + 1, 5), h(i + 1, 7)]); })();
let domeKey = '';
function shutterAt(t) { return (t > 3.0 && t < 5.2 ? .30 : t > 13.1 && t < 19 ? .26 : t > T_TIME + 1 ? .4 : .5) / 60; }
async function renderAt(tSec, opts = {}) {
  const t = clamp(tSec, 0, DURATION - 1e-4), dev = E.dev, q = dev.queue, N = opts.n || NSUB0, P = E.P, shutter = shutterAt(t);
  const w0 = worldAt(t), space = w0.space > .999;
  // sky dome: once per frame, only when it changed
  const key = w0.sun.d.map(x => x.toFixed(5)).join() + '|' + Math.floor(t * 12);
  if (key !== domeKey && !space) { domeKey = key; for (let i = 0; i < 8; i++) { q.writeBuffer(E.su[i], 0, new Float32Array([...w0.sun.d, 0, t + (w0.sun.h - 6) * 90, 0.02, TURB, i])); const en = dev.createCommandEncoder(), c = en.beginComputePass(); c.setPipeline(E.skyP); c.setBindGroup(0, E.skyBG[i]); c.dispatchWorkgroups(512, 16); c.end(); q.submit([en.finish()]); } const en = dev.createCommandEncoder(), c = en.beginComputePass(); c.setPipeline(E.mipP); for (const m of E.mDome) { c.setBindGroup(0, m.bg); c.dispatchWorkgroups(m.x, m.y, m.z); } c.end(); q.submit([en.finish()]); await q.onSubmittedWorkDone(); }
  // ocean FFT
  q.writeBuffer(E.fu, 0, new Float32Array([w0.otime, 1.55, 1.12, 0])); { const en = dev.createCommandEncoder(), c = en.beginComputePass(); c.setBindGroup(0, E.fftBG); c.setPipeline(E.cp.spectrum); c.dispatchWorkgroups(32, 32, 1); c.setPipeline(E.cp.fftRow); c.dispatchWorkgroups(256, 4, 1); c.setPipeline(E.cp.fftCol); c.dispatchWorkgroups(256, 4, 1); c.setPipeline(E.cp.assemble); c.dispatchWorkgroups(32, 32, 1); c.setPipeline(E.mipP); for (const m of [...E.mDisp, ...E.mDer]) { c.setBindGroup(0, m.bg); c.dispatchWorkgroups(m.x, m.y, m.z); } c.end(); q.submit([en.finish()]); }
  q.writeBuffer(E.grid, 0, gridFor(w0)); q.writeBuffer(E.accU, 0, new Float32Array([1 / N, 0, 0, 0, 0, 0, 0, 0]));
  for (let s = 0; s < N; s++) {
    const H = HAL[s % 128], ts = Math.min(t + shutter * ((s + .5) / N - .5), DURATION - 1e-5), w = worldAt(Math.max(0, ts)), c = w.cam, asp = RW / RH, jx = (H[0] - .5) * 2 / RW, jy = (H[1] - .5) * 2 / RH;
    const proj = perspM(c.fov, asp, .12, jx, jy), view = viewM(c.p, c.R, c.U, c.F), vp = mmul(proj, view), ivp = minv(vp), mir = new Float64Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), rvp = mmul(vp, mir), svp = shadowVP(w), jit = [H[2], H[3], H[0], H[1]];
    w.reflOn = reflPass(w);
    q.writeBuffer(E.ub[0], 0, fillU(w, vp, ivp, svp, rvp, 0, c.p, jit, s, N)); q.writeBuffer(E.ub[1], 0, fillU(w, rvp, ivp, svp, rvp, 1, [c.p[0], -c.p[1], c.p[2]], jit, s, N)); q.writeBuffer(E.ub[2], 0, fillU(w, svp, ivp, svp, rvp, 2, c.p, jit, s, N));
    const gl = glyphsFor(w); if (gl.n + gl.nr) q.writeBuffer(E.gl, 0, gl.f, 0, (gl.n + gl.nr) * 12);
    const tt = w.t, world = w.space < .999, en = dev.createCommandEncoder(), city = tt > T_CITY - .2 && world, birds = tt > T_FLY - .02 && tt < 21.6 && world;
    const ins = w.reflOn, nave = w.frOn > .5 && w.shat < 1.6, NB = 30, vL = 24 * 10 * 6, vS = 3 * 8 * 6;
    { const p = en.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: E.shD.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } }); if (nave) { p.setBindGroup(0, E.bgSh); p.setPipeline(P.tubeLSh); p.draw(vL, TUBES.nL * NB); p.setPipeline(P.tubeSSh); p.draw(vS, TUBES.nS * NB); } p.end(); }
    { const p = en.beginRenderPass({ colorAttachments: [{ view: E.shC.createView(), clearValue: [1, 1, 1, 1], loadOp: 'clear', storeOp: 'store' }] }); if (w.stage > .25 && tt < T_FLY) { p.setBindGroup(0, E.bgSh); p.setIndexBuffer(E.idx, 'uint32'); p.setPipeline(P.surfShC); p.drawIndexed(E.idxN); if (nave) { p.setPipeline(P.roseSh); p.draw(144 * 216 * 6); } } p.end(); }
    const scene = (p, bg, refl) => {
      p.setBindGroup(0, bg);
      if (world && !(window.DBG || {}).noSea) { p.setIndexBuffer(E.idx, 'uint32'); p.setPipeline(P.surf); p.drawIndexed(E.idxN); }
      if (nave) { p.setPipeline(P.tubeL); p.draw(vL, TUBES.nL * NB); p.setPipeline(P.tubeS); p.draw(vS, TUBES.nS * (refl ? 12 : 22)); p.setPipeline(P.rose); p.draw(144 * 216 * 6); if (!refl && tt < T_GLASS + 2) { p.setPipeline(P.spike); p.draw(18, 36 * 76); } }
      if (tt > T_SEA - .01 && tt < T_SEA + 3.2 && !(refl && tt > T_SEA + .42) && !(window.DBG || {}).noCrown) { p.setPipeline(P.crown); p.draw(480 * 96 * 6); }
      if (birds) { p.setPipeline(P.bird); p.draw(BIRDV, NBIRD); }
      if (city) { p.setPipeline(P.tower); p.draw(TOWERV, CITYN); }
      p.setPipeline(P.sky); p.draw(3);
    };
    if (ins) { const p = en.beginRenderPass({ colorAttachments: [{ view: E.refl.createView(), clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: E.reflD.createView(), depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } }); scene(p, E.bgRefl, true); p.end();
      if (gl.nr) { const p2 = en.beginRenderPass({ colorAttachments: [{ view: E.refl.createView(), loadOp: 'load', storeOp: 'store' }] }); p2.setPipeline(P.textR); p2.setBindGroup(0, E.bgVol); p2.setBindGroup(1, E.bgText); p2.draw(6, gl.nr, 0, gl.n); p2.end(); } }
    { const p = en.beginRenderPass({ colorAttachments: [{ view: E.hdr.createView(), clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: E.dep.createView(), depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } }); scene(p, E.bgMain, false);
      const D = window.DBG || {}; if (tt > T_SEA && tt < 9.6 && !D.noSpray) { p.setPipeline(P.spray); p.draw(6, 160000); } if (tt > T_SEA && tt < T_SEA + 2.6 && !D.noBurst) { p.setPipeline(P.burst); p.draw(6, 140000); }
      if (w.dust > .01) { p.setPipeline(P.drop); p.draw(6, 2600); }
      const DB = window.DBG || {}; if (city) { if (!DB.noCasc) { p.setPipeline(P.cascade); p.draw(6, CITYN * 192); } if (!DB.noLant) { p.setPipeline(P.lantern); p.draw(6, CITYN * 160); } if (tt > T_GRAV - .1 && !DB.noRain) { p.setPipeline(P.rainUp); p.draw(6, 120000); } }
      if (tt > T_TIME - .1 && !(window.DBG || {}).noStar) { p.setPipeline(P.star); { const DB = window.DBG || {}; if (DB.starA) p.draw(6, CITYN * 160); else if (DB.starB) p.draw(6, NSTAR - CITYN * 160, 0, CITYN * 160); else p.draw(6, NSTAR); } p.setPipeline(P.dust); p.draw(6, NDUST); }
      p.end(); }
    if (tt > T_SEA + .5 && tt < 10.4 && !(window.DBG || {}).noSpout) { const p = en.beginRenderPass({ colorAttachments: [{ view: E.hdr.createView(), loadOp: 'load', storeOp: 'store' }] }); p.setPipeline(P.spout); p.setBindGroup(0, E.bgVol); p.draw(3); p.end(); }
    if (w.vol > 1e-5) { const p = en.beginRenderPass({ colorAttachments: [{ view: E.hdr.createView(), loadOp: 'load', storeOp: 'store' }] }); p.setPipeline(P.vol); p.setBindGroup(0, E.bgVol); p.draw(3); p.end(); }
    if (gl.n) { const p = en.beginRenderPass({ colorAttachments: [{ view: E.hdr.createView(), loadOp: 'load', storeOp: 'store' }] }); p.setPipeline(P.text); p.setBindGroup(0, E.bgVol); p.setBindGroup(1, E.bgText); p.draw(6, gl.n); p.end(); }
    { const p = en.beginRenderPass({ colorAttachments: [{ view: E.acc.createView(), clearValue: [0, 0, 0, 0], loadOp: s ? 'load' : 'clear', storeOp: 'store' }] }); p.setPipeline(P.acc); p.setBindGroup(0, E.accBG); p.draw(3); p.end(); }
    q.submit([en.finish()]); if (s % 4 === 3) await q.onSubmittedWorkDone();
  }
  // post: grade strength, lens water after the wall hits
  const grade = lerp(.55, 1, sstep(2.6, 3.2, t) * (1 - sstep(5.2, 6, t))), lens = -1;
  q.writeBuffer(E.finU, 0, new Float32Array([w0.expo, 0, t, 0, 0, 0, .075, .010, lens, grade, w0.coll, sstep(44.9, 45.1, t)])); const en = dev.createCommandEncoder(), fs = (pipe, bg, view, load) => { const p = en.beginRenderPass({ colorAttachments: [{ view, loadOp: load ? 'load' : 'clear', clearValue: [0, 0, 0, 1], storeOp: 'store' }] }); p.setPipeline(pipe); p.setBindGroup(0, bg); p.draw(3); p.end(); };
  for (let i = 0; i < 7; i++) fs(P.down, E.downs[i], E.bl[i].t.createView()); for (const u of E.ups) fs(P.up, u.bg, u.dst.createView(), true);
  fs(P.fin, E.finBG, E.out.createView()); en.copyTextureToTexture({ texture: E.out }, { texture: E.ctx.getCurrentTexture() }, [RW, RH]); q.submit([en.finish()]); await q.onSubmittedWorkDone();
}
async function readFrame() { const bpr = Math.ceil(RW * 4 / 256) * 256, en = E.dev.createCommandEncoder(); en.copyTextureToBuffer({ texture: E.out }, { buffer: E.rb, bytesPerRow: bpr }, [RW, RH]); E.dev.queue.submit([en.finish()]); await E.rb.mapAsync(1); const s = new Uint8Array(E.rb.getMappedRange()), o = new Uint8Array(RW * RH * 4); if (bpr === RW * 4) o.set(s.subarray(0, o.length)); else for (let y = 0; y < RH; y++) o.set(s.subarray(y * bpr, y * bpr + RW * 4), y * RW * 4); E.rb.unmap(); return o; }
window.renderAt = renderAt; window.readFrame = readFrame; window.DURATION = DURATION; window.PROGRAM = PROGRAM; window.camAt = camAt; window.worldAt = worldAt;
(async () => {
  try {
    CITY.xb = PATH.x(21.5); CITY.z0 = PATH.z(T_CITY) + 170; { const c = [PATH.x(T_TIME), 0, PATH.z(T_TIME)]; GALC = [c[0], camY(T_TIME) + 2600, c[2] + 900]; }
    const tb = performance.now(); E.birds = bakeBirds(t => [PATH.x(t), camY(t), PATH.z(t)]); console.log('birds baked', E.birds.N, Math.round(performance.now() - tb) + 'ms');
    await initEngine(); bakeSea(); await renderAt(0); window.READY = true;
    if (!Q.get('capture')) { const t0 = performance.now(); for (;;) { const t = ((performance.now() - t0) / 1000) % DURATION; await renderAt(t, { n: 2 }); await new Promise(requestAnimationFrame); } }
  }
  catch (e) { console.log('INIT ' + (e.stack || e)); window.FAILED = String(e); document.body.style.color = '#fff'; document.body.append('This film needs WebGPU (Chrome or Edge on desktop). ' + e); }
})();

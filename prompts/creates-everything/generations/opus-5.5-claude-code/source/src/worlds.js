// CPU mirrors of a few GPU functions (f32-rounded so they agree with the shaders) and the baked flock.
const F = Math.fround, fr = x => F(x - Math.floor(x));
function h21(x, y) { let a = fr(F(x * F(.1031))), b = fr(F(y * F(.1031))), c = fr(F(x * F(.1031))); const d = F(F(a * F(b + 33.33)) + F(b * F(c + 33.33)) + F(c * F(a + 33.33))); a = F(a + d); b = F(b + d); c = F(c + d); return fr(F(F(a + b) * c)); }
function h22(x, y) { let a = fr(F(x * F(.1031))), b = fr(F(y * F(.1030))), c = fr(F(x * F(.0973))); const d = F(F(a * F(b + 33.33)) + F(b * F(c + 33.33)) + F(c * F(a + 33.33))); a = F(a + d); b = F(b + d); c = F(c + d); return [fr(F(F(a + b) * c)), fr(F(F(a + c) * b))]; }
function h33(x, y, z) { let a = fr(F(x * F(.1031))), b = fr(F(y * F(.1030))), c = fr(F(z * F(.0973))); const d = F(F(a * F(b + 33.33)) + F(b * F(a + 33.33)) + F(c * F(c + 33.33))); a = F(a + d); b = F(b + d); c = F(c + d); return [fr(F(F(a + b) * c)), fr(F(F(a + a) * b)), fr(F(F(b + a) * a))]; }
function vnoiseJS(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy); return lerp(lerp(h21(ix, iy), h21(ix + 1, iy), wx), lerp(h21(ix, iy + 1), h21(ix + 1, iy + 1), wx), wy); }
// ---- the shock wall, same formula as ringAt() in common.wgsl (height only)
function ringHeightJS(x, z, t, bx, bz, R, strength) {
  const dx = x - bx, dz = z - bz, r = Math.hypot(dx, dz), k = r - R, an = Math.atan2(dx, dz);
  const nzl = vnoiseJS(an * 10, t * 1.1) - .5, nzh = vnoiseJS(an * 70, t * 5) - .5, nz = nzl + .22 * nzh, kk = k + nzl * 26 + nzh * 6;
  const front = 1 / (1 + Math.exp(kk / 7)), hq = kk / (kk > 0 ? 24 : 64), h = Math.exp(-hq * hq);
  const lump = lerp(1, .75 + .5 * vnoiseJS(an * 6, 2 + t * .7), Math.exp(-Math.max(R, 0) / 900));
  return strength * h * (96 + nz * 22) * front * 1.35 * lump * (.12 + .88 * sstep(0, 160, R));
}
// conservative upper bound of the wall height (noise at its worst), so the camera can never dip into it
function ringBoundJS(x, z, R, S) { const r = Math.hypot(x - BC[0], z - BC[1]); let m = 0; for (let d = -18; d <= 18; d += 2) { const kk = r - R + d, front = 1 / (1 + Math.exp(kk / 7)), hq = kk / (kk > 0 ? 24 : 64); m = Math.max(m, front * Math.exp(-hq * hq)); } return S * m * 107 * 1.35 * 1.25 * (.12 + .88 * sstep(0, 160, R)); }
// ---- rose shards: geometry + slow-motion dynamics, mirrored in tubes.wgsl (shardDyn)
const ROSE = { NX: 144, NY: 216 };
function roseVertJS(ix, iy) { const j = h22(ix + 71, iy + 71); return [-20 + (ix + (j[0] - .5) * .72) * 40 / 144, (iy + (j[1] - .5) * .72) * 60 / 216]; }
function roseGlassJS(px, py) { // geometric stone/glass split of roseAt()
  const cx = px, cy = py - 30, r = Math.hypot(cx, cy), th = Math.atan2(cx, cy) / (2 * Math.PI) + .5;
  if (r < 1.7) return true;
  if (r < 6.6) { const f = th * 12, l = Math.abs(fr(f) - .5) * 2 * Math.PI * r / 12, w = lerp(.25, 1.35, sstep(1.7, 5.4, r)), cap = Math.hypot(l, Math.max(r - 5.2, 0)) - 1.35; return (l < w && r < 5.2 && r > 2.1) || (cap < 0 && r >= 5.2); }
  if (r < 11.6) { const f = th * 24 + .5, l = Math.abs(fr(f) - .5) * 2 * Math.PI * r / 24, w = lerp(.55, 1.28, sstep(7, 10.2, r)), cap = Math.hypot(l, Math.max(r - 10.1, 0)) - 1.25; return (l < w && r < 10.1 && r > 7) || (cap < 0 && r >= 10.1); }
  if (r < 14.6) { const i = Math.floor(th * 24), a = (i + .5) / 24 * 2 * Math.PI; return Math.hypot(cx - Math.sin(a - Math.PI) * 12.95, cy - Math.cos(a - Math.PI) * 12.95) < 1.18; }
  if (py < 14.2 && py > 3 && Math.abs(px) < 14) { const li = Math.floor(px / 4 + .5), lx = px - li * 4; let w = 1.5; if (py > 11.8) w = Math.sqrt(Math.max(0, 2.4 * 2.4 - (py - 11.8) ** 2)) - .9; return Math.abs(lx) < w; }
  return false;
}
// slow motion: the burst decelerates to a hover; shards that are not birds fall once the birds have gone
function shardTime(t) { const tau = t - 13.0 + .07; return tau <= 0 ? 0 : .62 * (1 - Math.exp(-tau / .24)); }
function shardPosJS(ix, iy, t) {
  const flip = h21(ix, iy) > .5; let d0 = roseVertJS(ix, iy), d1 = roseVertJS(ix + 1, iy + 1); if (flip) { d0 = roseVertJS(ix + 1, iy); d1 = roseVertJS(ix, iy + 1); }
  const mid = [(d0[0] + d1[0]) / 2, (d0[1] + d1[1]) / 2], h = h33(ix, iy, 1), h2 = h33(iy, ix, 6), rel = [mid[0], mid[1] - 30], r = Math.hypot(rel[0], rel[1]);
  const tt = Math.max(shardTime(t) - r * .006, 0), sp = lerp(78, 16, clamp(r / 17)) * (.3 + h[0]), rn = Math.max(r, .2);
  return { p: [mid[0] + rel[0] / rn * sp * .42 * tt + (h2[0] - .5) * 9 * tt, mid[1] + rel[1] / rn * sp * .42 * tt + (h2[1] - .5) * 9 * tt - 1.2 * tt * tt, Z_END + sp * 1.5 * tt * (.3 + h[1]) + (h2[2] - .5) * 9 * tt], mid, h, h2 };
}
// ---- the flock: shards that are glass become birds; boids baked at 60 Hz, stored at 30 Hz
const NBIRD = 6144, BIRD_HZ = 30, BIRD_T0 = 14.0, BIRD_T1 = 22.0, BIRD_NF = Math.round((BIRD_T1 - BIRD_T0) * BIRD_HZ) + 1;
function pickBirds() {
  const cand = [];
  for (let iy = 0; iy < ROSE.NY; iy++) for (let ix = 0; ix < ROSE.NX; ix++) { const flip = h21(ix, iy) > .5; let d0 = roseVertJS(ix, iy), d1 = roseVertJS(ix + 1, iy + 1); if (flip) { d0 = roseVertJS(ix + 1, iy); d1 = roseVertJS(ix, iy + 1); } const m = [(d0[0] + d1[0]) / 2, (d0[1] + d1[1]) / 2]; if (Math.abs(m[0]) > PROF.W - .3 || m[1] < .3) continue; if (roseGlassJS(m[0], m[1])) cand.push([h21(ix + 913, iy + 377), ix, iy]); }
  cand.sort((a, b) => a[0] - b[0]); return cand.slice(0, NBIRD).map(c => [c[1], c[2]]);
}
function bakeBirds(camP) {
  const ids = pickBirds(), N = ids.length, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), out = new Float32Array(BIRD_NF * NBIRD * 4), dead = new Float32Array(N);
  const isBird = new Uint8Array(ROSE.NX * ROSE.NY); ids.forEach(([ix, iy]) => isBird[iy * ROSE.NX + ix] = 1);
  const rnd = rng(9123);
  for (let i = 0; i < N; i++) { const s = shardPosJS(ids[i][0], ids[i][1], BIRD_T0); pos.set(s.p, i * 3); const rel = [s.mid[0], s.mid[1] - 30], rl = Math.hypot(...rel) + 1; vel.set([rel[0] / rl * 9 + (rnd() - .5) * 4, rel[1] / rl * 9 + 3 + (rnd() - .5) * 4, 16 + rnd() * 10], i * 3); }
  const cs = 7, cell = new Int32Array(N), order = new Int32Array(N), start = new Map();
  const steps = (BIRD_NF - 1) * 2, dt = 1 / (BIRD_HZ * 2);
  const ph = Array.from({ length: N }, () => rnd() * 6.28);
  for (let st = 0; st <= steps; st++) {
    const t = BIRD_T0 + st * dt;
    if (st % 2 === 0) { const f = st / 2; for (let i = 0; i < N; i++) { const o = (f * NBIRD + i) * 4; out[o] = pos[i * 3]; out[o + 1] = pos[i * 3 + 1]; out[o + 2] = pos[i * 3 + 2]; out[o + 3] = dead[i]; } }
    if (st === steps) break;
    // spatial hash (sorted cells)
    const keys = new Array(N); for (let i = 0; i < N; i++) { const cx = Math.floor(pos[i * 3] / cs), cy = Math.floor(pos[i * 3 + 1] / cs), cz = Math.floor(pos[i * 3 + 2] / cs); keys[i] = cx * 73856093 ^ cy * 19349663 ^ cz * 83492791; }
    start.clear(); for (let i = 0; i < N; i++) { const k = keys[i]; let a = start.get(k); if (!a) { a = []; start.set(k, a); } a.push(i); }
    const c0 = camP(t), c = camP(t + .9), dive = sstep(T_CITY - .1, T_CITY + .8, t), a1 = t * .82, a2 = t * 1.31;
    const tgt = [c[0] + 46 * Math.sin(a1) * (1 - dive), lerp(c[1] + 6 + 14 * Math.sin(a2), -40, dive), c[2] + lerp(78 + 30 * Math.cos(a1 * .7), 260, dive)];
    for (let i = 0; i < N; i++) {
      if (dead[i] > 0) continue; const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2]; let vx = vel[i * 3], vy = vel[i * 3 + 1], vz = vel[i * 3 + 2];
      let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0, n = 0;
      const bx = Math.floor(px / cs), by = Math.floor(py / cs), bz = Math.floor(pz / cs);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const L = start.get((bx + dx) * 73856093 ^ (by + dy) * 19349663 ^ (bz + dz) * 83492791); if (!L) continue;
        for (const j of L) { if (j === i) continue; const ex = pos[j * 3] - px, ey = pos[j * 3 + 1] - py, ez = pos[j * 3 + 2] - pz, d2 = ex * ex + ey * ey + ez * ez; if (d2 > 49) continue; if (d2 < 4.4) { const w = 1 / (d2 + .05); sx -= ex * w; sy -= ey * w; sz -= ez * w; } ax += vel[j * 3]; ay += vel[j * 3 + 1]; az += vel[j * 3 + 2]; cx += ex; cy += ey; cz += ez; n++; if (n > 24) break; }
      }
      let fx = sx * 2.6, fy = sy * 2.6, fz = sz * 2.6;
      if (n) { fx += (ax / n - vx) * 1.4 + cx / n * .9; fy += (ay / n - vy) * 1.4 + cy / n * .9; fz += (az / n - vz) * 1.4 + cz / n * .9; }
      // steer to the moving target with a swirl around it: a murmuration, not a cloud
      const tx = tgt[0] - px, ty = tgt[1] - py, tz = tgt[2] - pz, td = Math.hypot(tx, ty, tz) + 1e-3, pull = lerp(.9, 3.2, dive) * Math.min(1, td / 25);
      fx += tx / td * 12 * pull; fy += ty / td * 12 * pull; fz += tz / td * 12 * pull;
      { const ex = px - c0[0], ey = py - c0[1], ez = pz - c0[2], cd = Math.hypot(ex, ey, ez); if (cd < 34) { const k = (34 - cd) / 34 * 60 / (cd + 1); fx += ex * k; fy += ey * k; fz += ez * k; } }
      const sw = 9 * (1 - dive); fx += -tz / td * sw * Math.sin(ph[i] * .1 + t * .5); fz += tx / td * sw * Math.sin(ph[i] * .1 + t * .5); fy += Math.sin(px * .021 + t * 1.7) * 5 * (1 - dive);
      vx += fx * dt; vy += fy * dt; vz += fz * dt; const sp = Math.hypot(vx, vy, vz), mx = lerp(31, 58, dive), mn = 13; const k = sp > mx ? mx / sp : sp < mn ? mn / sp : 1; vx *= k; vy *= k; vz *= k;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; pos[i * 3] = px + vx * dt; pos[i * 3 + 1] = py + vy * dt; pos[i * 3 + 2] = pz + vz * dt;
      if (pos[i * 3 + 1] < 0 && dive > .05) dead[i] = t;
    }
  }
  return { ids, data: out, isBird, N };
}

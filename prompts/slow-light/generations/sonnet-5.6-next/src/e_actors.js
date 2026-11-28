// ───────────────────────────── actors ─────────────────────────────
// Everything here is a pure function of t, and each is posed at (t - distance/c): you see it as it was.
function dynMesh(B, mat) { const m = new THREE.Mesh(B.geometry(), mat); m.frustumCulled = false; return m; }
function paint(geo, matId, color, rough = 0.75, interior = false) {
  const g = geo.index ? geo.toNonIndexed() : geo; const n = g.attributes.position.count;
  const c = new Float32Array(n * 3), m = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { c.set(color, i * 3); m.set([matId + (interior ? 100 : 0), rough, 0, 0], i * 4); }
  g.setAttribute('aColor', new THREE.BufferAttribute(c, 3)); g.setAttribute('aMat', new THREE.BufferAttribute(m, 4));
  return g;
}
function sdfPart(sdf, min, max, cell, matId, color, mat, interior = false) { const m = new THREE.Mesh(paint(sdfMesh(sdf, min, max, cell), matId, color, 0.75, interior), mat); m.frustumCulled = false; return m; }

// ── the figure at the window ──
function buildFigure(mat) {
  const F = HERO, ub = F.ub;
  const group = new THREE.Group();
  const SHIRT = [0.30, 0.25, 0.20], PANTS = [0.035, 0.04, 0.055], SKIN = [0.38, 0.20, 0.13], HAIR = [0.035, 0.018, 0.010];
  // local space of the figure: x along the wall, y up, z out of the window; origin at its feet
  const base = { u: ub - 0.43, v: 5.12, d: -0.235 };
  const body = new THREE.Group(); group.add(body);
  body.matrixAutoUpdate = false;
  const torso = sdfPart(p => {
    let d = sdCapsule(p, V3(0, 1.04, -0.01), V3(0, 1.38, 0), 0.115, 0.135);
    d = smin(d, sdEllipsoid(p, V3(0, 1.37, 0), V3(0.205, 0.12, 0.11)), 0.07);
    d = smin(d, sdCapsule(p, V3(-0.16, 1.43, 0), V3(0.16, 1.43, 0), 0.062), 0.05);
    d = smin(d, sdCapsule(p, V3(0.19, 1.42, 0), V3(0.245, 1.13, 0.0), 0.056, 0.042), 0.025);   // left arm at rest
    d = smin(d, sdCapsule(p, V3(0.245, 1.13, 0.0), V3(0.24, 0.88, 0.04), 0.042, 0.031), 0.02);
    return d;
  }, V3(-0.3, 0.8, -0.2), V3(0.34, 1.54, 0.2), 0.013, M.CLOTH, SHIRT, mat);
  const legs = sdfPart(p => smin(smin(sdEllipsoid(p, V3(0, 0.98, -0.01), V3(0.14, 0.11, 0.10)), sdCapsule(p, V3(-0.075, 0.95, -0.01), V3(-0.09, 0.05, 0), 0.075, 0.05), 0.05), sdCapsule(p, V3(0.075, 0.95, -0.01), V3(0.09, 0.05, 0), 0.075, 0.05), 0.05), V3(-0.2, 0, -0.15), V3(0.2, 1.12, 0.15), 0.018, M.CLOTH, PANTS, mat);
  const hand0 = sdfPart(p => sdEllipsoid(p, V3(0.238, 0.83, 0.048), V3(0.024, 0.05, 0.03)), V3(0.19, 0.75, 0), V3(0.29, 0.9, 0.1), 0.008, M.MATTE, SKIN, mat);
  body.add(torso, legs, hand0);
  const head = new THREE.Group(); body.add(head);
  head.add(
    sdfPart(p => smin(smin(sdEllipsoid(p, V3(0, 0.115, 0.005), V3(0.088, 0.112, 0.097)), sdCapsule(p, V3(0, -0.03, -0.01), V3(0, 0.07, 0), 0.043, 0.047), 0.03), sdEllipsoid(p, V3(0, 0.095, 0.104), V3(0.014, 0.025, 0.018)), 0.012), V3(-0.13, -0.08, -0.14), V3(0.13, 0.26, 0.15), 0.009, M.MATTE, SKIN, mat),
    sdfPart(p => { let d = smin(sdEllipsoid(p, V3(0, 0.158, -0.012), V3(0.10, 0.088, 0.108)), sdEllipsoid(p, V3(0, 0.09, -0.06), V3(0.078, 0.09, 0.065)), 0.04); d = smin(d, sdEllipsoid(p, V3(-0.015, 0.205, -0.075), V3(0.05, 0.043, 0.05)), 0.02); return Math.max(d, -sdEllipsoid(p, V3(0, 0.085, 0.105), V3(0.08, 0.105, 0.085))); }, V3(-0.14, -0.02, -0.16), V3(0.14, 0.28, 0.13), 0.009, M.MATTE, HAIR, mat));
  for (const sx of [-0.031, 0.031]) { const e = new THREE.Mesh(paint(new THREE.SphereGeometry(0.009, 8, 6), M.MATTE, [0.02, 0.012, 0.01]), mat); e.position.set(sx, 0.128, 0.093); head.add(e); }
  // right arm: two bones and a hand, solved each frame
  const U1 = 0.285, U2 = 0.27;
  const seg = (len, r0, r1, col, m = M.CLOTH) => sdfPart(p => sdCapsule(p, V3(0, 0, 0), V3(0, len, 0), r0, r1), V3(-0.08, -0.08, -0.08), V3(0.08, len + 0.08, 0.08), 0.01, m, col, mat);
  const upper = seg(U1, 0.058, 0.042, SHIRT), fore = seg(U2, 0.041, 0.027, SHIRT);
  const hand = new THREE.Group();
  hand.add(sdfPart(p => { let d = sdEllipsoid(p, V3(0, 0.03, 0), V3(0.03, 0.042, 0.019)); d = smin(d, sdCapsule(p, V3(0.008, 0.055, 0), V3(0.012, 0.112, 0.0), 0.0105, 0.008), 0.012); d = smin(d, sdCapsule(p, V3(-0.018, 0.025, 0.006), V3(-0.036, 0.06, 0.012), 0.011, 0.008), 0.012); return d; }, V3(-0.06, -0.03, -0.04), V3(0.05, 0.14, 0.04), 0.0065, M.MATTE, SKIN, mat));
  body.add(upper, fore, hand);
  const lever = new THREE.Mesh(paint(new THREE.BoxGeometry(0.018, 0.05, 0.02), M.BRASS, [0.55, 0.40, 0.14], 0.3), mat);
  const leverP = F.p(ub - 0.87, 6.525, 0.07);
  lever.position.copy(leverP); group.add(lever);
  const wallQ = new THREE.Quaternion().setFromRotationMatrix(F.m);

  const key = (e) => { // [raise 0..1, flick 0..1, lean]
    let raise = 0, flick = 0;
    if (e < 6) { raise = sstep(-1.75, -0.55, e) * (1 - sstep(0.75, 1.9, e)); flick = sstep(-0.035, 0.02, e); }
    else { raise = sstep(10.55, 11.65, e) * (1 - sstep(12.5, 13.7, e)); flick = 1 - sstep(12.015, 12.07, e); }
    const lean = sstep(2.1, 4.2, e) * (1 - sstep(9.6, 11.0, e));
    return { raise, flick, lean };
  };
  const place = (mesh, a, b) => { mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()); };
  function update(t, cam) {
    const e = poseTime(t, F.p(ub - 0.55, 6.5, -0.15), cam);
    const k = key(e);
    const breathe = Math.sin(e * 1.55) * 0.0035;
    const walk = (1 - sstep(-2.4, -1.2, e)) * 0.09;
    const m = F.m.clone().multiply(mtx(base.u + walk + 0.05 * k.lean, base.v + breathe, base.d + 0.03 * k.lean, 0.07 * k.lean, -0.50 - 0.05 * k.raise + 0.30 * k.lean, 0.02 * k.raise));
    body.matrix.copy(m); body.matrixWorldNeedsUpdate = true;
    head.position.set(0.0, 1.49, 0.01);
    head.rotation.set(0.05 + 0.24 * k.lean + 0.02 * Math.sin(e * 0.7), -0.45 * k.raise * (1 - k.lean) + 0.30 * k.lean - 0.12 + 0.05 * Math.sin(e * 0.43), 0.03 * Math.sin(e * 0.9));
    const inv = m.clone().invert();
    const S = V3(-0.19, 1.425, 0.0);
    const swTip = F.p(ub - 0.862, 6.552 - 0.045 * k.flick, 0.092).applyMatrix4(inv);
    // the wrist sits behind and below the fingertip
    const wristAtSwitch = swTip.clone().add(V3(0.075, -0.070, -0.045));
    const rest = V3(-0.245, 0.90, 0.045);
    const W = rest.clone().lerp(wristAtSwitch, k.raise);
    W.z += Math.sin(k.raise * Math.PI) * 0.09; W.x -= Math.sin(k.raise * Math.PI) * 0.05;
    const d = clamp(S.distanceTo(W), 0.08, U1 + U2 - 0.002);
    const dir = W.clone().sub(S).normalize();
    const a = (U1 * U1 - U2 * U2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(U1 * U1 - a * a, 0));
    const pole = V3(-0.7, -1, -0.25).normalize(); const perp = pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const E = S.clone().addScaledVector(dir, a).addScaledVector(perp, hh);
    const Wc = S.clone().addScaledVector(dir, d);
    place(upper, S, E); place(fore, E, Wc);
    const tipDir = swTip.clone().sub(Wc).normalize();
    hand.position.copy(Wc);
    hand.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(0, -1, 0).lerp(tipDir, clamp(k.raise * 1.3, 0.02, 1)).normalize());
    lever.quaternion.copy(wallQ).multiply(new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), lerp(-0.55, 0.55, k.flick)));
  }
  return { group, update };
}

// ── the cat on the wall ──
function buildCat(mat) {
  const F = Frame.wall(3.12, -7.65, 3.30, -5.15);
  const g = new THREE.Group(); const p0 = F.p(1.0, 0.958, -0.13);
  g.position.copy(p0); g.rotation.y = Math.PI + 0.20; g.scale.setScalar(1.18);
  const FUR = [0.135, 0.10, 0.068];
  const body = sdfPart(p => {
    let d = sdEllipsoid(p, V3(-0.085, 0.108, 0), V3(0.128, 0.112, 0.096));
    d = smin(d, sdCapsule(p, V3(-0.07, 0.135, 0), V3(0.052, 0.255, 0), 0.098, 0.072), 0.05);
    d = smin(d, sdEllipsoid(p, V3(0.062, 0.215, 0), V3(0.068, 0.095, 0.068)), 0.035);
    d = smin(d, sdCapsule(p, V3(0.06, 0.28, 0), V3(0.098, 0.348, 0), 0.052, 0.043), 0.03);
    for (const z of [-0.038, 0.038]) {
      d = smin(d, sdCapsule(p, V3(0.07, 0.19, z), V3(0.112, 0.018, z), 0.030, 0.020), 0.018);
      d = smin(d, sdEllipsoid(p, V3(0.132, 0.019, z), V3(0.038, 0.021, 0.025)), 0.012);
    }
    for (const z of [-0.073, 0.073]) { d = smin(d, sdEllipsoid(p, V3(-0.062, 0.092, z), V3(0.092, 0.08, 0.045)), 0.022); d = smin(d, sdEllipsoid(p, V3(0.012, 0.022, z * 1.12), V3(0.075, 0.025, 0.028)), 0.015); }
    return d;
  }, V3(-0.25, -0.01, -0.16), V3(0.2, 0.43, 0.16), 0.0085, M.FUR, FUR, mat);
  const head = new THREE.Group();
  head.add(sdfPart(p => {
    let d = sdEllipsoid(p, V3(0, 0, 0), V3(0.063, 0.056, 0.064));
    d = smin(d, sdEllipsoid(p, V3(0.048, -0.019, 0), V3(0.029, 0.022, 0.031)), 0.016);
    for (const z of [-1, 1]) d = smin(d, sdCapsule(p, V3(0.0, 0.036, z * 0.036), V3(-0.012, 0.107, z * 0.052), 0.023, 0.002), 0.008);
    return d;
  }, V3(-0.09, -0.08, -0.09), V3(0.1, 0.13, 0.09), 0.0055, M.FUR, FUR, mat));
  for (const z of [-0.024, 0.024]) { const e = new THREE.Mesh(paint(new THREE.SphereGeometry(0.0105, 10, 8), M.BRASS, [0.75, 0.62, 0.10], 0.15), mat); e.position.set(0.054, 0.006, z); head.add(e); }
  { const nose = new THREE.Mesh(paint(new THREE.SphereGeometry(0.0065, 8, 6), M.MATTE, [0.12, 0.05, 0.045]), mat); nose.position.set(0.078, -0.012, 0); head.add(nose); }
  const wb = new Builder(); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) rod(wb, V3(0.062, -0.022, s * 0.016), V3(0.062 + i * 0.006, -0.036 + i * 0.012, s * 0.095), 0.0008, { mat: M.MATTE, color: [0.45, 0.44, 0.4] }, 3);
  head.add(dynMesh(wb, mat));
  head.position.set(0.112, 0.392, 0);
  const tail = new THREE.Mesh(new THREE.BufferGeometry(), mat); tail.frustumCulled = false;
  g.add(body, head, tail);
  const tLit = LAMPS[0].pos.distanceTo(p0) / C_LIGHT;        // when the lamp's light reaches the cat
  function update(t, cam) {
    const e = poseTime(t, p0, cam);
    const turn = sstep(tLit + 0.35, tLit + 1.25, e) * (1 - 0.45 * sstep(6.6, 7.9, e));
    const turn2 = sstep(12.4, 13.5, e);
    head.rotation.set(0, lerp(lerp(0.55, -0.28, turn), 0.45, turn2 * 0.7), lerp(-0.02, 0.36, turn * (1 - turn2 * 0.6)));
    const sw = Math.sin(e * 1.35) * 0.5 + Math.sin(e * 0.57 + 1.0) * 0.5;
    // the tail hangs over the lane side of the wall and sways
    const pts = [V3(-0.19, 0.07, 0.0), V3(-0.21, 0.025, 0.08), V3(-0.12, 0.016, 0.13), V3(0.02, 0.017, 0.14), V3(0.14, 0.004, 0.13), V3(0.19, -0.075, 0.135 + sw * 0.012), V3(0.19 + sw * 0.02, -0.17, 0.14 + sw * 0.03), V3(0.19 + sw * 0.06, -0.24, 0.14 + sw * 0.06), V3(0.20 + sw * 0.10, -0.245 + Math.abs(sw) * 0.02, 0.14 + sw * 0.085)];
    const c = new THREE.CatmullRomCurve3(pts);
    const tg = new THREE.TubeGeometry(c, 48, 0.026, 10, false);
    const pa = tg.attributes.position; const uv = tg.attributes.uv;
    for (let i = 0; i < pa.count; i++) { const s = uv.getX(i); const cc = c.getPointAt(Math.min(1, s)); const k = 1.0 - 0.45 * s * s; pa.setXYZ(i, cc.x + (pa.getX(i) - cc.x) * k, cc.y + (pa.getY(i) - cc.y) * k, cc.z + (pa.getZ(i) - cc.z) * k); }
    tg.computeVertexNormals();
    tail.geometry.dispose(); tail.geometry = paint(tg, M.FUR, FUR);
    body.scale.set(1, 1 + Math.sin(e * 2.1) * 0.006, 1 + Math.sin(e * 2.1) * 0.012);
  }
  return { group: g, update };
}

// ── laundry ──
function buildLaundry(mat) {
  const group = new THREE.Group(); const items = [];
  const lines = [
    { a: V3(-1.95, 5.55, -10.9), b: V3(2.36, 5.80, -12.75), sag: 0.17, cloth: [[0.09, 0.50, 0.58, 'shirt', [0.52, 0.10, 0.06]], [0.25, 0.30, 0.42, 'cloth', [0.62, 0.55, 0.38]], [0.63, 1.02, 1.02, 'sheet', [0.70, 0.68, 0.62]], [0.86, 0.46, 0.62, 'shirt', [0.12, 0.20, 0.36]]] },
    { a: V3(-1.97, 6.15, -16.55), b: V3(2.27, 6.25, -17.05), sag: 0.2, cloth: [[0.17, 0.8, 0.9, 'sheet', [0.55, 0.58, 0.60]], [0.40, 0.46, 0.6, 'shirt', [0.64, 0.62, 0.56]], [0.60, 0.32, 0.75, 'trouser', [0.08, 0.10, 0.16]], [0.79, 0.55, 0.5, 'cloth', [0.50, 0.22, 0.08]]] },
  ];
  const sb = new Builder();
  for (const L of lines) {
    const at = s => L.a.clone().lerp(L.b, s).add(V3(0, -L.sag * 4 * s * (1 - s), 0));
    const pts = []; for (let i = 0; i <= 24; i++) pts.push(at(i / 24));
    tube(sb, pts, 0.006, { mat: M.MATTE, color: [0.16, 0.13, 0.09] }, 60, 4);
    const len = L.a.distanceTo(L.b);
    for (const [s, w, h, type, col] of L.cloth) {
      const g = new THREE.PlaneGeometry(1, 1, 26, 34);
      const uv = g.attributes.uv; const index = g.index.array; const keep = [];
      const inside = (u, v) => { // v: 1 at the line
        if (type === 'shirt') { const sleeve = v > 0.68; const bodyW = 0.30; if (!sleeve && Math.abs(u - 0.5) > bodyW) return false; if (sleeve && v < 0.68 + Math.max(0, Math.abs(u - 0.5) - 0.3) * 0.35) return false; if (Math.hypot((u - 0.5) * 1.0, (v - 1.02) * 1.1) < 0.12) return false; return true; }
        if (type === 'trouser') return !(v < 0.62 && Math.abs(u - 0.5) < 0.07 + (0.62 - v) * 0.06);
        return true;
      };
      for (let i = 0; i < index.length; i += 3) { let u = 0, v = 0; for (let k = 0; k < 3; k++) { u += uv.getX(index[i + k]) / 3; v += uv.getY(index[i + k]) / 3; } if (inside(u, v)) keep.push(index[i], index[i + 1], index[i + 2]); }
      const base = []; for (let i = 0; i < uv.count; i++) base.push([uv.getX(i), uv.getY(i)]);
      g.setIndex(keep);
      const ng = g.toNonIndexed();
      const painted = paint(ng, M.CLOTH, col, 0.85);
      const mesh = new THREE.Mesh(painted, mat); mesh.frustumCulled = false;
      const uvs = []; const u2 = painted.attributes.uv; for (let i = 0; i < u2.count; i++) uvs.push([u2.getX(i), u2.getY(i)]);
      items.push({ mesh, at, s, w, h, len, uvs, phase: rand(0, 6.28) });
      group.add(mesh);
      for (const du of [-0.36, 0.36]) { const p = at(s + du * w / len); wbox(sb, p.x, p.y - 0.01, p.z, 0.022, 0.085, 0.03, { mat: M.WOOD, color: [0.32, 0.2, 0.09] }); }
    }
  }
  group.add(dynMesh(sb, mat));
  function update(t, cam) {
    for (const it of items) {
      const mid = it.at(it.s); const e = poseTime(t, mid, cam);
      const pos = it.mesh.geometry.attributes.position;
      const side = it.at(Math.min(1, it.s + 0.05)).sub(it.at(Math.max(0, it.s - 0.05))); side.y = 0; side.normalize();
      const nrm = V3(-side.z, 0, side.x);
      for (let i = 0; i < pos.count; i++) {
        const [u, v] = it.uvs[i]; const down = 1 - v;
        const top = it.at(it.s + (u - 0.5) * it.w / it.len);
        const gust = Math.sin(e * 1.15 + it.phase) * 0.65 + Math.sin(e * 2.05 + it.phase * 1.7) * 0.35;
        const off = (gust * 0.10 + 0.035) * Math.pow(down, 1.5) * it.h
          + Math.sin(u * 15 + it.phase + down * 3.0) * 0.026 * (0.25 + down)
          + Math.sin(u * 6.5 - e * 2.7 + down * 7.0) * 0.022 * down;
        pos.setXYZ(i, top.x + nrm.x * off, top.y - down * it.h * (1 - 0.012 * Math.sin(u * 15 + it.phase)) - 0.008, top.z + nrm.z * off);
      }
      pos.needsUpdate = true; it.mesh.geometry.computeVertexNormals();
    }
  }
  return { group, update };
}

// ── moths ──
function buildMoths(mat) {
  const moths = [];
  const add = (lamp, n) => { for (let i = 0; i < n; i++) moths.push({ lamp, r: rand(0.17, 0.52), w: rand(2.0, 4.6) * (RNG() < 0.5 ? -1 : 1), p1: rand(0, 6.28), p2: rand(0, 6.28), p3: rand(0, 6.28), tilt: rand(-0.7, 0.7), delay: rand(0.2, 2.4), s: rand(0.65, 1.15), f: rand(8.5, 12.5) }); };
  add(0, 7); add(1, 6);
  const geo = new THREE.BufferGeometry();
  const nv = moths.length * 12;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  const painted = paint(geo, M.CLOTH, [0.20, 0.16, 0.11], 0.8);
  const mesh = new THREE.Mesh(painted, mat); mesh.frustumCulled = false;
  function posAt(m, e) {
    const L = LAMPS[m.lamp];
    const since = e - L.on - m.delay;
    // before the lamp is lit they drift idly further out; afterwards they are drawn in
    const pull = since > 0 ? 1 + 2.6 * Math.exp(-since * 0.9) : 3.6;
    const a = m.p1 + m.w * e * (since > 0 ? 1 : 0.45) + 0.6 * Math.sin(e * 2.3 + m.p2);
    const r = m.r * pull * (1 + 0.28 * Math.sin(e * 3.1 + m.p3));
    return V3(L.pos.x + Math.cos(a) * r + 0.09 * Math.sin(e * 7.3 + m.p2),
      L.pos.y + Math.sin(a * 0.8 + m.p3) * r * 0.55 + Math.sin(a) * m.tilt * r + 0.05 * Math.sin(e * 9.1 + m.p1),
      L.pos.z + Math.sin(a) * r * 0.75 + 0.20 * (m.lamp === 0 ? 1 : 0));
  }
  function update(t, cam) {
    const P = painted.attributes.position, N = painted.attributes.normal; let k = 0;
    for (const m of moths) {
      const e = poseTime(t, LAMPS[m.lamp].pos, cam);
      const c = posAt(m, e), c2 = posAt(m, e + 0.03);
      const fwd = c2.sub(c).normalize(); if (!isFinite(fwd.x) || fwd.lengthSq() < 0.5) fwd.set(1, 0, 0);
      const rt = new THREE.Vector3().crossVectors(fwd, V3(0, 1, 0)).normalize(); const up = new THREE.Vector3().crossVectors(rt, fwd).normalize();
      const flap = Math.sin(e * m.f * 6.283 + m.p2) * 1.05 + 0.25;
      const s = 0.034 * m.s;
      for (const side of [-1, 1]) {
        const wing = rt.clone().multiplyScalar(side * Math.cos(flap)).addScaledVector(up, Math.sin(flap));
        const root = c.clone().addScaledVector(rt, side * 0.004);
        const tip1 = root.clone().addScaledVector(wing, s).addScaledVector(fwd, s * 0.55);
        const tip2 = root.clone().addScaledVector(wing, s * 0.9).addScaledVector(fwd, -s * 0.65);
        const back = root.clone().addScaledVector(fwd, -s * 0.5), nose = root.clone().addScaledVector(fwd, s * 0.4);
        const nn = new THREE.Vector3().crossVectors(wing, fwd).normalize();
        for (const q of [nose, tip1, tip2, nose, tip2, back]) { P.setXYZ(k, q.x, q.y, q.z); N.setXYZ(k, nn.x, nn.y, nn.z); k++; }
      }
    }
    P.needsUpdate = true; N.needsUpdate = true;
  }
  return { group: mesh, update };
}

// ── drips from gutters and wet washing ──
const DRIPS = [ // x, y (source), z, period, phase
  [-0.62, 8.9, -6.75, 1.9, 0.2], [-0.28, 8.9, -7.25, 2.7, 1.35], [1.38, 8.6, -5.55, 2.3, 0.75], [1.05, 5.05, -9.3, 1.7, 0.4],
  [0.55, 5.1, -11.9, 2.1, 1.1], [0.15, 5.0, -13.5, 1.55, 0.05], [-0.15, 5.3, -12.9, 2.9, 2.0], [-1.2, 8.4, -10.7, 2.5, 0.9],
  [-0.75, 5.6, -16.7, 1.8, 1.6], [0.9, 8.7, -17.3, 2.2, 0.3], [0.7, 8.9, -3.35, 3.1, 2.4], [2.02, 8.8, -8.35, 1.45, 1.0], [-2.35, 9.4, -6.65, 2.05, 0.55],
];
const fallTime = y => Math.sqrt(2 * y / 9.81) * 1.04;
function dripUniforms() { const out = []; for (let i = 0; i < 24; i++) { const d = DRIPS[i]; out.push(d ? new THREE.Vector4(d[0], d[2], d[4] + fallTime(d[1]), d[3]) : new THREE.Vector4(0, 0, 0, 0)); } return out; }
function buildDrips(mat) {
  const group = new THREE.Group();
  const geo = paint(new THREE.SphereGeometry(1, 7, 6), M.BOTTLE, [0.75, 0.85, 0.95], 0.05);
  const drops = DRIPS.map(d => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; group.add(m); return { m, d }; });
  function update(t, cam) {
    for (const { m, d } of drops) {
      const [x, y, z, per, ph] = d;
      const e = poseTime(t, V3(x, 2, z), cam);
      let age = (e - ph) % per; if (age < 0) age += per;
      const yy = y - 0.5 * 9.81 * Math.pow(age / 1.04, 2);
      if (yy < 0.02) { m.visible = false; continue; }
      m.visible = true;
      const v = 9.81 * age; const st = 0.011 + v * 0.0042;
      m.position.set(x, yy, z); m.scale.set(0.0065, st, 0.0065);
    }
  }
  return { group, update };
}

// ── the lamp bodies ──
function buildLampMeshes(mat) {
  const out = [];
  { const B = new Builder(); const L = LAMPS[0].pos;
    sphere(B, L, 0.047, { mat: M.EMIT, color: [1.0, 0.70, 0.38], lamp: 0, glow: 55 }, 1, 1.18, 1, 24);
    lathe(B, [[0.001, 0.045], [0.026, 0.048], [0.027, 0.095], [0.02, 0.105], [0.001, 0.107]], mtx(L.x, L.y, L.z), { mat: M.BRASS, color: [0.38, 0.28, 0.12] }, 18);
    out.push(dynMesh(B, mat)); }
  { const B = new Builder(); buildLanternHead(B); out.push(dynMesh(B, mat)); }
  { const B = new Builder(); buildNeonTubes(B); out.push(dynMesh(B, mat)); }
  return out;
}

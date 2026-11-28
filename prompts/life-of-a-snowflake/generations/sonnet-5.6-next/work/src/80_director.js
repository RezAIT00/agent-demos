// ---------------------------------------------------------------- director
// Everything below is a pure function of film time t (seconds).
const FILM = 20.0;
const HERO_RADIUS_MM = 2.65;

// film time -> simulation step, keyed on the ends of the weather layers
const GROWTH_KEYS = [[2.52, 0], [3.0, 1100], [3.55, 3900], [4.65, 12315], [5.3, 18530], [7.05, 42956], [8.5, 44595],
  [9.5, 51595], [11.1, 54108], [13.75, 67760], [14.9, 73760]];

function makeGrowthClock(res) {
  const steps = res.steps;
  const bin = 40, nb = Math.ceil(steps / bin) + 2;
  const area = new Float64Array(nb);
  for (let k = 0; k < res.N; k++) if (res.attachStep[k] >= 0) area[Math.min(nb - 1, Math.ceil(res.attachStep[k] / bin))]++;
  for (let i = 1; i < nb; i++) area[i] += area[i - 1];
  const reach = [[0, 0]];
  for (let i = 0; i < res.radiusLog.length; i++) if (res.radiusLog[i] > reach[reach.length - 1][1]) reach.push([(i + 1) * 20, res.radiusLog[i]]);
  if (reach[reach.length - 1][0] < steps) reach.push([steps, res.radius]);
  const reachAt = (s) => {
    let lo = 0, hi = reach.length - 1;
    if (s >= reach[hi][0]) return reach[hi][1];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (reach[m][0] <= s) lo = m; else hi = m; }
    return lerp(reach[lo][1], reach[hi][1], clamp((s - reach[lo][0]) / (reach[hi][0] - reach[lo][0]), 0, 1));
  };
  const radiusAt = (s) => {
    let sum = 0, w = 0;
    for (let k = -4; k <= 4; k++) { const a = 5 - Math.abs(k); sum += a * reachAt(Math.max(0, s + k * 110)); w += a; }
    return sum / w;
  };
  const areaAt = (s) => { const x = clamp(s / bin, 0, nb - 1.001), i = Math.floor(x); return lerp(area[i], area[i + 1], x - i); };
  const total = areaAt(steps), Rf = res.radius;
  // visual progress: part reach, part size of the ice
  const progress = (s) => 0.55 * radiusAt(s) / Rf + 0.45 * Math.sqrt(areaAt(s) / total);
  const raw = (t) => {
    if (t <= GROWTH_KEYS[0][0]) return 0;
    const last = GROWTH_KEYS[GROWTH_KEYS.length - 1];
    if (t >= last[0]) return steps;
    let k = 0; while (t > GROWTH_KEYS[k + 1][0]) k++;
    const [ta, sa] = GROWTH_KEYS[k], [tb, sb0] = GROWTH_KEYS[k + 1];
    const sb = Math.min(sb0, steps);
    const u = (t - ta) / (tb - ta);
    const pa = progress(sa), pb = progress(sb);
    if (pb - pa < 1e-5) return lerp(sa, sb, u);
    const want = lerp(pa, pb, u);
    let lo = sa, hi = sb;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (progress(m) < want) lo = m; else hi = m; }
    return lerp((lo + hi) / 2, lerp(sa, sb, u), 0.12);
  };
  const step = (t) => { let s = 0, w = 0; for (let k = -4; k <= 4; k++) { const a = 5 - Math.abs(k); s += a * raw(t + k * 0.036); w += a; } return s / w; };
  const final = (t) => (t >= 15.0 ? steps + 400 : step(t));
  return { step: final, radiusAt, radius: (t) => radiusAt(Math.min(steps, step(t))), steps };
}

function makeDirector(clock, cellMM, restPos) {
  const preV = track([[0, Math.log(19)], [0.9, Math.log(23)], [1.9, Math.log(31)], [2.9, Math.log(31)], [3.6, Math.log(52)]]);
  const fill = track([[2.7, 0.33], [3.5, 0.42], [4.65, 0.45], [5.3, 0.45], [7.05, 0.58], [8.5, 0.66], [9.5, 0.68], [11.1, 0.74], [13.75, 0.79], [15.0, 0.79], [15.9, 0.64], [17.3, 0.58]]);
  const smoothRadius = (t) => { let s = 0, w = 0; for (let i = -5; i <= 5; i++) { const k = 1 - Math.abs(i) / 6; s += k * clock.radius(t + i * 0.09); w += k; } return Math.max(8, s / w); };
  const halfWidthCells = (t) => {
    const a = preV(t);
    if (t < 2.7) return Math.exp(a);
    const b = Math.log(smoothRadius(t) / fill(t));
    return Math.exp(lerp(a, b, sstep(2.7, 3.7, t)));
  };
  const W17 = halfWidthCells(17.05) * cellMM;
  const wideMM = track([[17.05, W17], [17.55, 5.8], [17.95, 6.65], [18.5, 7.4], [18.86, 7.3], [19.14, 5.95], [19.4, 4.5], [19.65, 4.04], [20.0, 3.9]]);
  const halfWidthMM = (t) => {
    if (t <= 17.05) return halfWidthCells(t) * cellMM;
    return wideMM(t);
  };

  const pitch = track([[0, -0.02], [4.5, -0.07], [9.5, -0.01], [14.0, -0.07], [15.2, -0.11], [16.2, -0.17], [17.05, -0.26], [17.52, -0.52], [17.94, -0.74], [18.5, -0.90], [20.0, -0.935]]);
  const yaw = track([[0, 0.11], [3, 0.03], [8, -0.07], [13, 0.06], [17, 0.01], [19.2, 0.0], [20, 0.035]]);
  const tilt = track([[0, 0.55], [2.4, 0.62], [3.2, 0.70], [4.1, 0.56], [4.9, 0.30], [5.9, 0.60], [6.8, 0.30], [7.7, 0.62], [8.35, 0.98], [9.1, 0.40], [10.2, 0.24], [11.0, 0.55], [11.9, 0.30], [12.65, 0.92], [13.5, 0.30], [14.5, 0.22], [15.4, 0.46], [16.2, 0.30], [17.0, 0.55], [17.8, 0.38], [20, 0.30]]);
  const SPIN_REST = 0.20;
  const approachS = track([[17.05, Math.log(0.0082)], [17.47, Math.log(0.031)], [17.89, Math.log(0.098)], [18.28, Math.log(0.285)], [18.60, Math.log(0.71)], [18.80, Math.log(0.965)], [18.9, 0]]);
  const below = track([[17.05, -0.285], [17.47, -0.135], [17.89, -0.055], [18.4, -0.014], [18.78, 0]]);

  // layer by layer colour of the air: top, bottom, mist, sun glow, density, warm
  const L = (t, top, bot, mist, sun, dens, warm) => [t, top, bot, mist, sun, [dens, warm]];
  const layers = [
    L(0.0, [0.0030, 0.0062, 0.021], [0.0085, 0.017, 0.044], [0.034, 0.064, 0.135], [0.085, 0.150, 0.300], 0.55, 0.62),
    L(2.9, [0.0035, 0.0075, 0.025], [0.0095, 0.021, 0.052], [0.040, 0.078, 0.160], [0.095, 0.170, 0.320], 0.56, 0.58),
    L(4.5, [0.0050, 0.0170, 0.044], [0.0130, 0.034, 0.072], [0.060, 0.120, 0.225], [0.130, 0.230, 0.390], 0.62, 0.45),
    L(6.2, [0.0070, 0.0230, 0.054], [0.0180, 0.046, 0.090], [0.075, 0.158, 0.272], [0.160, 0.270, 0.430], 0.72, 0.40),
    L(7.8, [0.0160, 0.0480, 0.084], [0.0360, 0.088, 0.132], [0.165, 0.285, 0.385], [0.250, 0.370, 0.490], 0.96, 0.35),
    L(9.1, [0.0075, 0.0070, 0.026], [0.0250, 0.0180, 0.046], [0.080, 0.064, 0.142], [0.180, 0.165, 0.340], 0.40, 0.95),
    L(10.6, [0.0070, 0.0320, 0.054], [0.0180, 0.064, 0.092], [0.090, 0.240, 0.300], [0.140, 0.320, 0.400], 0.90, 0.42),
    L(12.6, [0.0032, 0.0160, 0.030], [0.0100, 0.034, 0.052], [0.040, 0.115, 0.160], [0.095, 0.220, 0.290], 0.56, 0.62),
    L(14.4, [0.0140, 0.0160, 0.038], [0.0520, 0.034, 0.056], [0.135, 0.110, 0.178], [0.190, 0.180, 0.300], 0.76, 1.25),
    L(16.6, [0.0150, 0.0180, 0.042], [0.0500, 0.036, 0.060], [0.120, 0.105, 0.175], [0.170, 0.170, 0.290], 0.70, 1.25),
  ];
  const col = (i) => track(layers.map((l) => [l[0], l[i]]));
  const cTop = col(1), cBot = col(2), cMist = col(3), cSun = col(4), cDW = col(5);
  const bandTimes = [4.95, 7.0, 8.55, 9.55, 11.15, 13.85];

  const fall = integralTable(track([[0, 0.34], [2.4, 0.42], [3.6, 0.85], [8, 1.05], [14, 1.15], [17, 1.0], [18.35, 0.6], [19.05, 0.12], [20, 0.1]]), 21, 2100);
  const snowTravel = integralTable((t) => lerp(0.115, -0.082, sstep(18.3, 19.05, t)), 21, 2100);

  const vapourAmt = track([[0, 0.85], [1.0, 1.15], [2.0, 1.0], [2.9, 0.55], [4.0, 0.24], [6.5, 0.20], [7.8, 0.42], [9.2, 0.08], [10.6, 0.34], [12.2, 0.14], [14.5, 0.08], [15.3, 0]]);
  const exposure = track([[0, 1.18], [2.0, 1.12], [2.6, 1.0], [3.2, 1.02], [14, 1.0], [16, 1.0], [18, 1.06], [20, 1.16]]);
  const vAlt = track([[14.6, 322], [16.0, 255], [17.0, 214], [18.4, 178], [20, 170]]);
  const vPitch = track([[14.6, -0.060], [16.0, -0.105], [17.05, -0.175], [17.55, -0.36], [18.0, -0.54], [18.65, -0.70], [20, -0.72]]);

  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qC = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

  return {
    fall, snowTravel, halfWidthMM, W17,
    state(t) {
      const s = {};
      s.t = t;
      // growth
      s.S = clock.step(t);
      s.soft = Math.max(24, Math.abs(clock.step(t + 0.034) - clock.step(t - 0.034)) * 0.55);
      s.radiusCells = clock.radius(t);

      // camera
      const W = halfWidthMM(t);
      s.halfWidth = W;
      s.camDist = W / Math.tan(10 * D2R);
      eul.set(pitch(t), yaw(t), 0.018 * Math.sin(t * 0.47 + 1.0) * (1 - sstep(18, 19, t)));
      s.camQuat = new THREE.Quaternion().setFromEuler(eul);
      s.fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(s.camQuat);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.camQuat), right = new THREE.Vector3(1, 0, 0).applyQuaternion(s.camQuat);

      // where the flake is: it falls onto the mitten along the line of sight
      s.mittenOn = t >= 17.05;
      s.flakePos = new THREE.Vector3();
      let dist = 0;
      if (s.mittenOn) {
        const k = Math.exp(approachS(Math.min(t, 18.9)));
        dist = s.camDist * (1 / k - 1);
        s.flakePos.copy(restPos).addScaledVector(s.fwd, -dist).addScaledVector(up, -below(Math.min(t, 18.78)) * (dist + s.camDist));
      }
      s.dist = dist;
      // gentle drift keeps the macro operator's framing alive
      const live = 1 - sstep(18.15, 19.0, t);
      const driftX = (0.045 * Math.sin(t * 0.93 + 0.4) + 0.022 * Math.sin(t * 2.17)) * W * live;
      const driftY = (0.036 * Math.sin(t * 0.77 + 2.0) + 0.018 * Math.sin(t * 1.83 + 1.0)) * W * live;
      const target = s.flakePos.clone().addScaledVector(right, -driftX).addScaledVector(up, -driftY);
      // once landed, ease the frame a touch so the arms sit centred
      target.addScaledVector(up, 0.10 * sstep(18.95, 19.6, t));
      s.camPos = target.clone().addScaledVector(s.fwd, -s.camDist);

      // pose: tumbling relative to the camera, then lying flat on the wool
      const th = tilt(t);
      const phi = 1.1 + 0.52 * t + 0.6 * Math.sin(0.61 * t);
      const spin = SPIN_REST + 0.205 * (t - 17.75) + 0.13 * Math.sin(0.83 * t) * (1 - sstep(17.0, 18.15, t));
      const falling = s.camQuat.clone()
        .multiply(qA.setFromAxisAngle(new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0), th))
        .multiply(qB.setFromAxisAngle(Z, spin));
      const rest = qC.setFromAxisAngle(X, -Math.PI / 2 + 0.075).clone().multiply(qB.setFromAxisAngle(Z, SPIN_REST + 0.03));
      const land = sstep(17.6, 18.86, t);
      s.quat = falling.slerp(rest, land);
      if (t > 18.82) {
        const u = t - 18.82;
        s.quat.premultiply(qA.setFromAxisAngle(new THREE.Vector3(0.85, 0, 0.52), 0.085 * Math.exp(-u * 8.5) * Math.sin(u * 23.0)));
      }

      // nucleation
      const grow = sstep(0.62, 2.0, t);
      s.dropR = lerp(2.8, 11.6, Math.pow(grow, 0.8));
      s.dropOpacity = sstep(0.62, 1.0, t) * (1 - sstep(3.55, 3.98, t));
      s.frost = t < 1.96 ? 0 : 1 - sstep(2.52, 2.98, t);
      s.front = lerp(-1.25, 1.25, sstep(1.98, 2.5, t));
      s.morph = sstep(2.40, 2.93, t);
      s.prismR = Math.max(lerp(11.6, 12.8, sstep(2.4, 3.0, t)), t > 2.9 ? s.radiusCells * 1.02 : 0);
      s.prismAspect = lerp(0.62, 0.17, sstep(2.95, 3.75, t));
      s.crystalOpacity = sstep(3.32, 3.78, t);
      s.grainGlint = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 5.3 + 0.7), 6) + 1.2 * Math.exp(-((t - 0.55) ** 2) * 60);
      s.flash = Math.exp(-((t - 2.9) ** 2) * 70);

      // air
      s.top = cTop(t); s.bot = cBot(t); s.mist = cMist(t); s.sun = cSun(t);
      const dw = cDW(t); s.density = dw[0]; s.warm = dw[1];
      s.band = -3; s.bandAmt = 0;
      for (const bt of bandTimes) {
        const u = (t - bt) / 0.5;                      // layers are >= 1 s apart: windows never overlap
        if (Math.abs(u) < 1) { s.band = -u * 1.75; s.bandAmt = 0.72 * (1 - u * u) * (1 - u * u); }
      }
      s.fall = fall(t);
      s.snowTravel = snowTravel(t);
      s.reveal = sstep(14.72, 16.55, t);
      s.valleyOn = t > 14.7;
      s.vAlt = vAlt(t);
      s.vPitch = vPitch(t);
      s.vYaw = 0.055 * (1 - sstep(14.7, 18, t));

      // light
      const dusk = sstep(14.9, 16.3, t), onWool = sstep(17.5, 18.65, t);
      const mix3 = (a, b, c) => [0, 1, 2].map((i) => lerp(lerp(a[i], b[i], dusk), c[i], onWool));
      s.envTop = mix3([0.048, 0.092, 0.170], [0.052, 0.092, 0.205], [0.080, 0.125, 0.240]);
      s.envMid = mix3([0.015, 0.031, 0.060], [0.150, 0.098, 0.128], [0.070, 0.070, 0.112]);
      s.envLow = mix3([0.0035, 0.0065, 0.013], [0.020, 0.025, 0.046], [0.007, 0.008, 0.013]);
      s.keyCol = mix3([0.64, 0.82, 1.0], [0.62, 0.76, 1.0], [0.68, 0.84, 1.0]);
      s.rimCol = mix3([1.08, 0.50, 0.19], [1.18, 0.50, 0.20], [1.22, 0.55, 0.23]);
      // the layers also tint the studio the ice reflects
      const air = (1 - dusk);
      s.envMid = s.envMid.map((v, i) => v + s.mist[i] * 0.10 * air);
      s.milk = lerp(1 + 0.45 * sstep(6.6, 9.2, t) * (1 - sstep(14.6, 16.0, t)), 1.5, onWool);
      s.sweep = sstep(18.92, 19.14, t) * (1 - 0.45 * sstep(19.72, 20.0, t));
      s.sweepAngle = lerp(2.9, -1.75, sstep(18.94, 19.9, t));
      s.sweepOffset = 1;
      s.armAmt = sstep(18.98, 19.14, t);
      s.armAngle = -2.35 + Math.PI * 2 * 1.08 * sstep(19.02, 19.82, t);
      s.armRest = sstep(19.66, 19.93, t);
      // as each new layer of air arrives, a soft light slides across the faces
      for (const [at, ang, amp] of [[5.75, 2.5, 0.22], [7.65, -0.6, 0.30], [9.55, 0.7, 0.46], [10.85, 3.5, 0.44], [12.15, -1.9, 0.40], [13.45, 2.1, 0.46], [14.75, 0.2, 0.40], [16.25, 2.8, 0.34]]) {
        const u = (t - at) / 0.64;                     // spaced >= 1.3 s: windows never overlap
        if (Math.abs(u) < 1) { s.sweep = amp * (1 - u * u) * (1 - u * u); s.sweepAngle = ang; s.sweepOffset = u * 0.95; }
      }

      // lens
      const near = Math.max(s.camDist * 0.18, 0.05);
      s.near = near;
      s.far = s.mittenOn ? dist + s.camDist + 900 : s.camDist * 8;
      s.lens = {
        // focus a hair behind the flake so the nap under it stays crisp too
        near, far: s.far, focus: s.camDist + 0.28 * onWool,
        aperture: lerp(62, 82, onWool),
        maxCoc: t < 17.05 ? 15 : track([[17.05, 3.2], [17.75, 7.5], [18.35, 13], [18.85, 19], [20, 21]])(t),
        bgCoc: 0,
      };
      s.vapour = vapourAmt(t);
      s.exposure = exposure(t) * (1 + 0.30 * s.flash);
      s.bloom = 0.42 + 0.25 * s.flash;
      s.star = 0.34;
      return s;
    },
  };
}

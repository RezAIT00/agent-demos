// Jointed silhouette people. Local units are body heights: x forward, y up,
// origin on the ground under the hips. Elbows and knees are solved by 2-bone IK.
const FIG = (() => {
  function ik(rx, ry, tx, ty, a, b, sign) {
    let dx = tx - rx, dy = ty - ry;
    let d = Math.hypot(dx, dy) || 1e-6;
    const dd = clamp(d, Math.abs(a - b) + 1e-4, a + b - 1e-4);
    const base = Math.atan2(dy, dx);
    const al = Math.acos(clamp((a * a + dd * dd - b * b) / (2 * a * dd), -1, 1));
    const j = [rx + a * Math.cos(base + sign * al), ry + a * Math.sin(base + sign * al)];
    const e = [rx + Math.cos(base) * dd, ry + Math.sin(base) * dd];
    return [j, e];
  }

  // ---- poses -------------------------------------------------------------
  const base = {
    hip: [0, 0.505], lean: 0.03, tilt: 0.0,
    footA: [0.04, 0.035], footB: [-0.05, 0.035], handA: [0.05, 0.465], handB: [-0.03, 0.47],
    kneeA: 1, kneeB: 1, elbowA: -1, elbowB: -1,
  };
  const pose = (o) => ({ ...base, ...o });
  const stand = (o = {}) => pose(o);
  function walk(phase, o = {}) {
    const { stride = 0.36, lift = 0.075, lean = 0.06, swing = 0.13 } = o;
    const foot = (q) => {
      const p = mod(q, 1);
      if (p < 0.6) return [lerp(stride / 2, -stride / 2, p / 0.6), 0.035];
      const u = (p - 0.6) / 0.4;
      return [lerp(-stride / 2, stride / 2, smooth(u)), 0.035 + lift * Math.sin(PI * u)];
    };
    const c = Math.cos(TAU * (phase + 0.05));
    return pose({
      hip: [0, 0.495 + 0.014 * Math.abs(Math.sin(TAU * (phase - 0.05)))], lean,
      footA: foot(phase), footB: foot(phase + 0.5),
      handA: [-swing * c + 0.02, 0.485 - 0.02 * c * c], handB: [swing * c + 0.02, 0.485 - 0.02 * c * c],
      ...(o.over || {}),
    });
  }
  // distance covered by one walk cycle, in body heights
  const cycleLength = (stride = 0.36) => stride / 0.6;
  const sit = (o = {}) => pose({ hip: [-0.06, 0.105], lean: 0.14, footA: [0.15, 0.045], footB: [0.09, 0.05], handA: [0.15, 0.22], handB: [0.12, 0.24], ...o });
  const seat = (o = {}) => pose({ hip: [-0.07, 0.30], lean: 0.08, footA: [0.17, 0.035], footB: [0.11, 0.035], handA: [0.13, 0.36], handB: [0.10, 0.37], ...o });
  const kneel = (o = {}) => pose({ hip: [-0.04, 0.275], lean: 0.30, footA: [0.17, 0.035], footB: [-0.23, 0.045], handA: [0.22, 0.20], handB: [0.18, 0.23], ...o });
  const crouch = (o = {}) => pose({ hip: [-0.11, 0.23], lean: 0.62, footA: [0.06, 0.035], footB: [-0.05, 0.035], handA: [0.27, 0.12], handB: [0.22, 0.17], ...o });
  const mix = (a, b, k) => {
    const o = { ...a };
    for (const key of Object.keys(base)) {
      if (Array.isArray(base[key])) o[key] = [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k)];
      else if (key === 'lean' || key === 'tilt') o[key] = lerp(a[key], b[key], k);
      else o[key] = k < 0.5 ? a[key] : b[key];
    }
    return o;
  };

  // ---- drawing -----------------------------------------------------------
  function person(c, o) {
    const {
      x, y, h, face = 1, p = stand(), color = '#07060a', far = null, cloth = null,
      dress = 'wrap', hair = 'short', hat = null, scarf = null, child = 0, thick = 1,
      t = 0, wind = 0, lit = null, accent = null,
    } = o;
    const garment = cloth || color;
    const headK = 1 + child * 0.30;
    const legK = 1 - child * 0.07;
    const bulk = dress === 'astronaut' ? 1.75 : dress === 'fur' ? 1.34 : dress === 'modern' || dress === 'coat' ? 1.07 : 1;
    const lw = thick * bulk;

    const lean = p.lean;
    const dir = [Math.sin(lean), Math.cos(lean)];
    const nf = [dir[1], -dir[0]];                // forward normal of the spine
    const hip = p.hip;
    const along = (d, f = 0) => [hip[0] + dir[0] * d + nf[0] * f, hip[1] + dir[1] * d + nf[1] * f];
    const torsoK = 1 - child * 0.04;
    const shoulder = along(0.275 * torsoK);
    const neckBase = along(0.315 * torsoK);
    const ha = lean * 0.45 + p.tilt;
    const head = [neckBase[0] + Math.sin(ha) * 0.082 * headK + 0.008, neckBase[1] + Math.cos(ha) * 0.082 * headK];

    const leg = (foot, sign, back) => {
      const root = [hip[0] + (back ? -0.012 : 0.012), hip[1]];
      return ik(root[0], root[1], foot[0], foot[1], 0.245 * legK, 0.238 * legK, sign);
    };
    const arm = (hand, sign, back) => {
      const root = [shoulder[0] + (back ? -0.014 : 0.006), shoulder[1] - 0.012];
      const [j, e] = ik(root[0], root[1], hand[0], hand[1], 0.168, 0.158, sign);
      return [root, j, e];
    };

    c.save();
    c.translate(x, y);
    c.scale(face * h, -h);

    // soft side-lighting toward a nearby light source
    let fill = color, fillCloth = garment, fillFar = far || color;
    if (lit) {
      const lx = (lit.x - x) / (face * h), ly = (y - lit.y) / h;
      const mk = (from, k) => {
        const g = c.createRadialGradient(lx, ly, 0, lx, ly, lit.r / h);
        g.addColorStop(0, M(from, lit.color, k));
        g.addColorStop(0.5, M(from, lit.color, k * 0.42));
        g.addColorStop(1, C(from));
        return g;
      };
      fill = mk(color, lit.k ?? 0.55);
      fillCloth = mk(garment, (lit.k ?? 0.55) * 0.9);
      fillFar = mk(far || color, (lit.k ?? 0.55) * 0.3);
    }

    const drawLeg = (foot, sign, back) => {
      const [knee, ank] = leg(foot, sign, back);
      const root = [hip[0] + (back ? -0.012 : 0.012), hip[1]];
      const calf = [lerp(knee[0], ank[0], 0.34), lerp(knee[1], ank[1], 0.34)];
      chain(c, [[root[0], root[1], 0.056 * lw], [knee[0], knee[1], 0.031 * lw], [calf[0], calf[1], 0.034 * lw], [ank[0], ank[1], 0.0165 * lw]]);
      const planted = ank[1] < 0.06;
      const fa = planted ? 0 : clamp((ank[1] - 0.06) * 6, 0, 0.8);
      const toe = [ank[0] + 0.074 * Math.cos(fa), ank[1] - 0.022 - 0.055 * Math.sin(fa)];
      chain(c, [[ank[0] - 0.008, ank[1] - 0.008, 0.020 * lw], [toe[0], toe[1], 0.0125 * lw]]);
    };
    const drawArm = (hand, sign, back) => {
      const [root, el, wr] = arm(hand, sign, back);
      const fx = wr[0] - el[0], fy = wr[1] - el[1], fl = Math.hypot(fx, fy) || 1;
      const tip = [wr[0] + fx / fl * 0.052, wr[1] + fy / fl * 0.052];
      chain(c, [[root[0], root[1], 0.036 * lw], [el[0], el[1], 0.0225 * lw], [wr[0], wr[1], 0.0132 * lw]]);
      chain(c, [[wr[0], wr[1], 0.015 * lw], [tip[0], tip[1], 0.0092 * lw]]);
      chain(c, [[wr[0] + fx / fl * 0.016, wr[1] + fy / fl * 0.016, 0.011 * lw], [wr[0] + fx / fl * 0.034 - fy / fl * 0.022, wr[1] + fy / fl * 0.034 + fx / fl * 0.022, 0.006 * lw]]);
      if (dress === 'robe' || dress === 'coat' || dress === 'fur' || dress === 'modern') {
        c.save(); c.fillStyle = back ? fillFar : fillCloth;
        chain(c, [[root[0], root[1], 0.042 * lw], [el[0], el[1], 0.028 * lw], [lerp(el[0], wr[0], dress === 'modern' ? 0.1 : 0.78), lerp(el[1], wr[1], dress === 'modern' ? 0.1 : 0.78), (dress === 'robe' ? 0.03 : 0.021) * lw]]);
        c.restore();
      }
      return wr;
    };

    // long hair behind the body
    if (hair === 'long' || hair === 'braid') {
      c.fillStyle = fillFar;
      const sway = Math.sin(t * 1.7) * 0.008 - wind * 0.05;
      if (hair === 'long') blob(c, [[head[0] - 0.02, head[1] + 0.062], [head[0] - 0.075, head[1] + 0.01], [shoulder[0] - 0.09 + sway, shoulder[1] - 0.03], [shoulder[0] - 0.03 + sway, shoulder[1] - 0.05], [head[0] - 0.01, head[1] - 0.03]], 0.9);
      else chain(c, [[head[0] - 0.045, head[1] - 0.01, 0.028], [shoulder[0] - 0.075 + sway, shoulder[1] - 0.02, 0.018], [shoulder[0] - 0.08 + sway * 2, shoulder[1] - 0.10, 0.008]]);
    }
    // a cloak that hangs and moves behind
    if (dress === 'cloak' || dress === 'hide') {
      c.fillStyle = M(garment, '#000000', 0.25);
      const fl = wind * 0.1 + Math.sin(t * 3.1) * 0.012 * (1 + wind * 2);
      const low = dress === 'cloak' ? Math.max(0.1, hip[1] - 0.32) : Math.max(0.08, hip[1] - 0.17);
      blob(c, [along(0.30, 0.02), along(0.29, -0.07), [hip[0] - 0.12 - fl, (hip[1] + low) / 2 + 0.02], [hip[0] - 0.14 - fl * 1.6, low], [hip[0] - 0.02, low + 0.03], along(0.06, -0.02)], 0.55);
    }

    c.fillStyle = fillFar; drawLeg(p.footB, p.kneeB, true);
    const handB = (() => { c.fillStyle = fillFar; return drawArm(p.handB, p.elbowB, true); })();

    // torso
    const fk = bulk === 1.34 ? 1.28 : bulk === 1.75 ? 1.55 : bulk;
    const S = (d, f) => along(d * torsoK, f * fk * thick);
    c.fillStyle = fill;
    blob(c, [S(-0.015, -0.062), S(0.075, -0.044), S(0.18, -0.060), S(0.272, -0.053), S(0.318, -0.016),
      S(0.312, 0.024), S(0.255, 0.052), S(0.19, 0.070), S(0.09, 0.044), S(0.005, 0.048), S(-0.035, 0)], 0.85);
    disc(c, hip[0], hip[1], 0.056 * lw);
    disc(c, shoulder[0], shoulder[1] - 0.006, 0.047 * lw);

    c.fillStyle = fill; drawLeg(p.footA, p.kneeA, false);

    // clothing over legs
    const [kA, aA] = leg(p.footA, p.kneeA, false), [kB, aB] = leg(p.footB, p.kneeB, true);
    const front = (u, v) => (u[0] > v[0] ? u : v), rear = (u, v) => (u[0] < v[0] ? u : v);
    c.fillStyle = fillCloth;
    if (dress === 'wrap' || dress === 'hide') {
      const kf = front(kA, kB), kr = rear(kA, kB);
      const f = [lerp(hip[0], kf[0], 0.62) + 0.045, lerp(hip[1], kf[1], 0.62)];
      const r = [lerp(hip[0], kr[0], 0.58) - 0.052, lerp(hip[1], kr[1], 0.58)];
      fillPoly(c, [S(0.085, -0.052), S(0.085, 0.052), S(0.0, 0.060), [f[0], f[1]],
        [lerp(f[0], r[0], 0.24), lerp(f[1], r[1], 0.24) - 0.034], [lerp(f[0], r[0], 0.45), lerp(f[1], r[1], 0.45) + 0.004],
        [lerp(f[0], r[0], 0.7), lerp(f[1], r[1], 0.7) - 0.03], r, S(0.0, -0.070)]);
      if (dress === 'hide') blob(c, [S(0.30, -0.05), S(0.31, 0.01), S(0.20, 0.03), S(0.09, -0.05), S(0.16, -0.075)], 0.6);
    } else if (dress === 'tunic' || dress === 'fur' || dress === 'coat') {
      const k = dress === 'coat' ? 1.18 : dress === 'fur' ? 0.82 : 0.9;
      const kf = front(kA, kB), kr = rear(kA, kB);
      const w = dress === 'fur' ? 0.082 : 0.056;
      const f = [lerp(hip[0], kf[0], Math.min(1, k)) + w, lerp(hip[1], kf[1], Math.min(1, k))];
      let r = [lerp(hip[0], kr[0], Math.min(1, k)) - w, lerp(hip[1], kr[1], Math.min(1, k))];
      if (k > 1) r = [r[0] - 0.02 - wind * 0.06, r[1] - 0.09];
      fillPoly(c, [S(0.295, -0.050), S(0.30, 0.025), S(0.19, 0.073), S(0.08, 0.052), S(-0.02, 0.062), f,
        [(f[0] + r[0]) / 2, (f[1] + r[1]) / 2 - 0.012], r, S(-0.02, -0.074), S(0.09, -0.052), S(0.2, -0.062)]);
      if (dress === 'fur') for (let i = 0; i <= 9; i++) disc(c, lerp(r[0], f[0], i / 9), lerp(r[1], f[1], i / 9) - 0.004 + (i % 2) * 0.008, 0.018);
    } else if (dress === 'robe' || dress === 'dress') {
      const low = Math.max(0.03, Math.min(aA[1], aB[1]) + (dress === 'dress' ? 0.05 : -0.005));
      const x0 = Math.min(aA[0], aB[0], hip[0] - 0.04) - 0.055 - wind * 0.07;
      const x1 = Math.max(aA[0], aB[0], hip[0] + 0.04) + 0.048;
      const sitting = hip[1] < 0.36;
      const kf = front(kA, kB);
      blob(c, sitting
        ? [S(0.295, -0.048), S(0.31, 0.02), S(0.18, 0.074), S(0.05, 0.06), [kf[0] + 0.05, kf[1] + 0.03], [x1, low + 0.02], [x1 - 0.02, low - 0.012], [x0, 0.02], [hip[0] - 0.11, hip[1]], S(0.10, -0.058)]
        : [S(0.295, -0.048), S(0.31, 0.02), S(0.19, 0.074), S(0.08, 0.050), S(-0.03, 0.062), [(kf[0] + x1) / 2 + 0.03, kf[1] - 0.02], [x1, low], [(x0 + x1) / 2, low - 0.018], [x0, low], [hip[0] - 0.085, hip[1] - 0.06], S(0.01, -0.07), S(0.10, -0.050)], 0.45);
    } else if (dress === 'modern') {
      blob(c, [S(0.29, -0.052), S(0.31, 0.02), S(0.19, 0.074), S(0.06, 0.052), S(-0.01, 0.058), S(-0.015, -0.068), S(0.09, -0.052), S(0.2, -0.062)], 0.7);
    } else if (dress === 'astronaut') {
      blob(c, [along(0.31, -0.07), along(0.31, -0.17), along(0.08, -0.18), along(0.07, -0.08)], 0.4);
    }
    if (accent) {                                  // a band of colour at the waist
      c.fillStyle = accent;
      chain(c, [[...S(0.085, -0.05), 0.014], [...S(0.085, 0.048), 0.014]]);
    }

    // neck and head
    c.fillStyle = fill;
    chain(c, [[neckBase[0], neckBase[1] - 0.018, 0.029 * lw], [head[0] - 0.008, head[1] - 0.02, 0.027 * thick]]);
    c.save();
    c.translate(head[0], head[1]); c.rotate(-ha * 0.7);
    const hr = 0.058 * headK;
    oval(c, -0.004, 0.006, hr * 0.97, hr * 1.04);
    blob(c, [[-0.02, hr * 0.5], [hr * 0.86, hr * 0.36], [hr * 0.93, 0.0], [hr * 1.18, -hr * 0.18], [hr * 0.90, -hr * 0.30],
      [hr * 0.90, -hr * 0.50], [hr * 0.80, -hr * 0.82], [hr * 0.42, -hr * 1.0], [-hr * 0.2, -hr * 0.6]], 0.6);
    // hair
    c.fillStyle = fillFar;
    if (hair === 'curls') {
      for (let i = 0; i < 15; i++) {
        const a = -0.25 + i * 0.27;
        disc(c, Math.cos(a) * hr * 0.80 - 0.012, Math.sin(a) * hr * 0.86 + 0.014, hr * 0.38 + (i % 3) * 0.003);
      }
    } else if (hair === 'bun') {
      blob(c, [[-hr * 0.9, -hr * 0.2], [-hr * 0.9, hr * 0.7], [0, hr * 1.15], [hr * 0.85, hr * 0.55], [hr * 0.2, hr * 0.6], [-hr * 0.4, 0]], 0.8);
      disc(c, -hr * 1.1, hr * 0.25, hr * 0.48);
    } else if (hair !== 'none') {
      blob(c, [[-hr * 0.98, -hr * 0.35], [-hr * 0.95, hr * 0.7], [0, hr * 1.14], [hr * 0.86, hr * 0.6], [hr * 0.35, hr * 0.62], [-hr * 0.4, hr * 0.1]], 0.8);
    }
    c.fillStyle = fillCloth;
    if (hat === 'hood' || hat === 'furhood') {
      blob(c, [[hr * 0.75, hr * 0.85], [hr * 0.1, hr * 1.38], [-hr * 1.15, hr * 0.8], [-hr * 1.3, -hr * 0.5], [-hr * 0.55, -hr * 1.25], [-hr * 0.25, -hr * 0.2], [hr * 0.1, hr * 0.55]], 0.75);
      if (hat === 'furhood') for (let i = 0; i <= 9; i++) {
        const a = 1.9 - i * 0.40;
        disc(c, Math.cos(a) * hr * 0.55 + hr * 0.38, Math.sin(a) * hr * 1.12, hr * 0.24);
      }
    } else if (hat === 'scarfhead') {
      blob(c, [[hr * 0.82, hr * 0.62], [0, hr * 1.26], [-hr * 1.15, hr * 0.5], [-hr * 1.5, -hr * 1.1], [-hr * 0.5, -hr * 0.9], [-hr * 0.2, 0.0], [hr * 0.2, hr * 0.6]], 0.7);
    } else if (hat === 'wrap') {
      oval(c, -hr * 0.08, hr * 0.72, hr * 1.12, hr * 0.56, 0.12);
      oval(c, -hr * 0.55, hr * 1.0, hr * 0.55, hr * 0.42, 0.4);
    } else if (hat === 'conical') {
      fillPoly(c, [[-hr * 2.0, hr * 0.42], [-hr * 0.02, hr * 1.9], [hr * 2.0, hr * 0.50], [0, hr * 0.66]]);
    } else if (hat === 'brim') {
      oval(c, 0, hr * 0.72, hr * 1.75, hr * 0.17, 0.04);
      blob(c, [[-hr * 0.8, hr * 0.7], [-hr * 0.65, hr * 1.55], [hr * 0.55, hr * 1.52], [hr * 0.75, hr * 0.74]], 0.5);
    } else if (hat === 'cap') {
      blob(c, [[-hr * 1.0, hr * 0.45], [-hr * 0.8, hr * 1.2], [hr * 0.4, hr * 1.28], [hr * 1.5, hr * 0.62], [hr * 0.5, hr * 0.66]], 0.5);
    } else if (hat === 'steel') {
      blob(c, [[-hr * 1.35, hr * 0.36], [-hr * 0.8, hr * 1.18], [hr * 0.5, hr * 1.25], [hr * 1.1, hr * 0.52], [hr * 1.55, hr * 0.30], [0, hr * 0.52]], 0.45);
    }
    if (dress === 'astronaut') {
      c.fillStyle = fill; disc(c, 0.006, 0.004, hr * 1.55);
      c.fillStyle = accent || '#c99a52'; oval(c, hr * 0.62, 0.004, hr * 0.72, hr * 0.98, -0.1);
    }
    c.restore();

    c.fillStyle = fill; const handA = drawArm(p.handA, p.elbowA, false);

    if (scarf) {
      c.fillStyle = scarf;
      const n0 = [neckBase[0] - 0.004, neckBase[1] + 0.006];
      chain(c, [[n0[0] - 0.026, n0[1] + 0.006, 0.021], [n0[0] + 0.022, n0[1] - 0.006, 0.021]]);
      const w = 0.35 + wind;
      const pt = (k) => [n0[0] - 0.02 - k * 0.19 * w, n0[1] - k * (0.17 - 0.10 * clamp(wind)) + Math.sin(t * 4.3 - k * 4.2) * 0.022 * k * (0.5 + wind)];
      chain(c, [[...pt(0), 0.020], [...pt(0.35), 0.021], [...pt(0.7), 0.018], [...pt(1.0), 0.011]]);
      chain(c, [[n0[0] + 0.012, n0[1] - 0.012, 0.015], [n0[0] + 0.03, n0[1] - 0.10, 0.011]]);
    }
    c.restore();

    const toS = (q) => [x + q[0] * face * h, y - q[1] * h];
    return {
      handA: toS([handA[0], handA[1]]), handB: toS([handB[0], handB[1]]),
      head: toS(head), hip: toS(hip), shoulder: toS(shoulder), chest: toS(along(0.2, 0.06)),
    };
  }

  // a swaddled infant, cradled: a wrapped bundle, folds, and a small face
  function baby(c, x, y, s, color, headColor, rot = -0.25) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = color;
    blob(c, [[-s * 1.20, -s * 0.02], [-s * 0.88, -s * 0.30], [-s * 0.25, -s * 0.40], [s * 0.34, -s * 0.46], [s * 0.66, -s * 0.18], [s * 0.60, s * 0.26], [s * 0.10, s * 0.46], [-s * 0.62, s * 0.36], [-s * 1.08, s * 0.20]], 0.75);
    // folds in the cloth
    c.strokeStyle = 'rgba(40,6,2,0.50)'; c.lineWidth = Math.max(1.4, s * 0.045); c.lineCap = 'round';
    c.beginPath(); c.moveTo(s * 0.50, -s * 0.34); c.quadraticCurveTo(s * 0.06, s * 0.02, -s * 0.42, s * 0.34); c.stroke();
    c.beginPath(); c.moveTo(s * 0.04, -s * 0.40); c.quadraticCurveTo(-s * 0.40, -s * 0.06, -s * 0.92, s * 0.20); c.stroke();
    c.beginPath(); c.moveTo(s * 0.56, s * 0.04); c.quadraticCurveTo(s * 0.34, s * 0.26, s * 0.02, s * 0.40); c.stroke();
    c.strokeStyle = 'rgba(255,170,120,0.28)'; c.lineWidth = Math.max(1, s * 0.03);
    c.beginPath(); c.moveTo(s * 0.44, -s * 0.38); c.quadraticCurveTo(s * 0.0, -s * 0.02, -s * 0.50, s * 0.31); c.stroke();
    // head, resting back, with brow, nose and a wisp of hair
    const hc = headColor || color;
    c.fillStyle = hc;
    disc(c, s * 0.80, -s * 0.36, s * 0.31);
    blob(c, [[s * 0.78, -s * 0.66], [s * 1.04, -s * 0.54], [s * 1.10, -s * 0.38], [s * 1.18, -s * 0.30], [s * 1.07, -s * 0.24], [s * 1.04, -s * 0.12], [s * 0.88, -s * 0.07], [s * 0.74, -s * 0.30]], 0.7);
    c.fillStyle = 'rgba(14,6,4,0.75)';
    blob(c, [[s * 0.52, -s * 0.42], [s * 0.62, -s * 0.68], [s * 0.86, -s * 0.69], [s * 0.98, -s * 0.60], [s * 0.76, -s * 0.58], [s * 0.62, -s * 0.40]], 0.8);
    c.strokeStyle = 'rgba(14,6,4,0.8)'; c.lineWidth = Math.max(1, s * 0.028);
    c.beginPath(); c.arc(s * 0.97, -s * 0.36, s * 0.055, 0.25, PI - 0.35); c.stroke();
    // the fold of blanket under the chin
    c.fillStyle = color;
    blob(c, [[s * 0.46, -s * 0.44], [s * 0.66, -s * 0.30], [s * 0.88, -s * 0.06], [s * 0.74, s * 0.06], [s * 0.50, -s * 0.12]], 0.8);
    c.restore();
  }

  // ---- animals -----------------------------------------------------------
  function mammoth(c, x, y, s, phase = 0, face = 1, color = '#0b1424') {
    c.save(); c.translate(x, y); c.scale(face * s, -s); c.fillStyle = color;
    const legs = [[-0.34, 0.0, 0], [0.30, 0.5, 0], [-0.20, 0.5, 1], [0.42, 0.0, 1]];
    for (const [lx, off, front] of legs) {
      const q = mod(phase + off, 1);
      const sw = q < 0.7 ? lerp(0.09, -0.09, q / 0.7) : lerp(-0.09, 0.09, smooth((q - 0.7) / 0.3));
      const up = q < 0.7 ? 0 : 0.05 * Math.sin((q - 0.7) / 0.3 * PI);
      chain(c, [[lx, 0.50, 0.12], [lx + sw * 0.45, 0.27, 0.078], [lx + sw, 0.055 + up, 0.068]]);
    }
    blob(c, [[-0.52, 0.50], [-0.56, 0.74], [-0.34, 0.86], [-0.05, 0.84], [0.16, 0.98], [0.37, 1.02], [0.50, 0.86], [0.46, 0.55], [0.20, 0.38], [-0.28, 0.36]], 0.85);
    blob(c, [[0.34, 1.00], [0.52, 1.10], [0.68, 1.00], [0.74, 0.78], [0.62, 0.62], [0.42, 0.62]], 0.9);
    const tr = Math.sin(phase * TAU) * 0.03;
    chain(c, [[0.66, 0.80, 0.100], [0.77, 0.58, 0.062], [0.79 + tr, 0.35, 0.045], [0.76 + tr * 2, 0.17, 0.032], [0.84 + tr * 2, 0.10, 0.022]]);
    for (let i = 0; i < 24; i++) {                      // shaggy fringe
      const u = i / 23;
      const hx = lerp(-0.50, 0.46, u), hy = 0.40 + Math.sin(u * PI) * -0.03 + u * 0.06;
      fillPoly(c, [[hx - 0.035, hy + 0.08], [hx + 0.035, hy + 0.08], [hx - 0.008, hy - 0.05 - hash(i + 3) * 0.06]]);
    }
    chain(c, [[-0.54, 0.74, 0.03], [-0.62, 0.52, 0.016], [-0.62, 0.40, 0.028]]);
    c.strokeStyle = '#b9c7dc'; c.lineCap = 'round';
    for (const [w, dx] of [[0.030, 0], [0.022, 0.06]]) {
      c.lineWidth = w; c.beginPath(); c.moveTo(0.66 + dx, 0.66);
      c.bezierCurveTo(0.78 + dx, 0.30, 1.04 + dx, 0.28, 1.04 + dx, 0.54); c.stroke();
    }
    c.restore();
  }

  function dog(c, x, y, s, t, color, face = 1, lit = null) {
    c.save(); c.translate(x, y); c.scale(face * s, -s); c.fillStyle = color;
    const br = Math.sin(t * 2.4) * 0.012;
    blob(c, [[-0.58, 0.04], [-0.56, 0.28 + br], [-0.22, 0.40 + br], [0.14, 0.33], [0.34, 0.36], [0.40, 0.14], [0.16, 0.02], [-0.3, 0.0]], 0.85);
    chain(c, [[0.26, 0.26, 0.12], [0.45, 0.44, 0.085]]);
    disc(c, 0.49, 0.47, 0.105);
    chain(c, [[0.52, 0.46, 0.07], [0.71, 0.405, 0.032]]);
    fillPoly(c, [[0.40, 0.53], [0.43, 0.70], [0.50, 0.55]]);
    fillPoly(c, [[0.48, 0.54], [0.55, 0.68], [0.57, 0.52]]);
    chain(c, [[0.22, 0.05, 0.05], [0.62, 0.035, 0.038]]);
    chain(c, [[0.14, 0.04, 0.048], [0.50, 0.025, 0.034]]);
    chain(c, [[-0.52, 0.12, 0.07], [-0.70, 0.06, 0.055], [-0.62, 0.015, 0.035]]);
    c.restore();
  }

  function camel(c, x, y, s, phase, color, face = 1) {
    c.save(); c.translate(x, y); c.scale(face * s, -s); c.fillStyle = color;
    for (const [lx, off] of [[-0.30, 0.0], [0.26, 0.25], [-0.24, 0.5], [0.32, 0.75]]) {
      const q = mod(phase + off, 1);
      const sw = q < 0.68 ? lerp(0.13, -0.13, q / 0.68) : lerp(-0.13, 0.13, smooth((q - 0.68) / 0.32));
      const up = q < 0.68 ? 0 : 0.07 * Math.sin((q - 0.68) / 0.32 * PI);
      chain(c, [[lx, 0.62, 0.065], [lx + sw * 0.5 + 0.03, 0.33 + up * 0.5, 0.028], [lx + sw, 0.025 + up, 0.022]]);
    }
    blob(c, [[-0.42, 0.62], [-0.38, 0.78], [-0.18, 0.80], [-0.02, 0.99], [0.16, 0.82], [0.40, 0.76], [0.38, 0.55], [0.0, 0.50], [-0.3, 0.52]], 0.85);
    const nb = Math.sin(phase * TAU * 2) * 0.015;
    chain(c, [[0.34, 0.66, 0.10], [0.55, 0.64 + nb, 0.056], [0.66, 0.88 + nb, 0.042], [0.70, 1.04 + nb, 0.038]]);
    chain(c, [[0.69, 1.07 + nb, 0.052], [0.86, 1.02 + nb, 0.028]]);
    chain(c, [[0.68, 1.11 + nb, 0.016], [0.66, 1.16 + nb, 0.007]]);
    chain(c, [[-0.40, 0.70, 0.02], [-0.48, 0.48, 0.012]]);
    c.restore();
  }

  function bird(c, x, y, s, flap, color, w = 2) {
    c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round';
    const f = Math.sin(flap) * s * 0.45;
    c.beginPath();
    c.moveTo(x - s, y - f); c.quadraticCurveTo(x - s * 0.45, y - s * 0.30 - f * 0.3, x, y);
    c.quadraticCurveTo(x + s * 0.45, y - s * 0.30 - f * 0.3, x + s, y - f);
    c.stroke();
  }

  return { person, baby, stand, walk, sit, seat, kneel, crouch, mix, pose, ik, cycleLength, mammoth, dog, camel, bird };
})();

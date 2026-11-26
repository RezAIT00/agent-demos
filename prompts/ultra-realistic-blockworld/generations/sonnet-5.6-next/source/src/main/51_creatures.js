// ================================================================ creatures: original procedural models, animation, behaviour
// every species is modelled in rest pose facing +Z with the feet on y = 0
function noise3h(x, y, z) { return rand01(Math.round(x * 31), Math.round(y * 31), Math.round(z * 31), 5); }
function softNoise(p, f) {
  const x = p[0] * f, y = p[1] * f, z = p[2] * f;
  return (Math.sin(x * 1.7 + Math.sin(z * 1.3) * 2) * Math.sin(y * 2.1 + x * 0.7) + Math.sin(z * 2.3 + y * 1.1)) * 0.5;
}
const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function rig(defs) {
  const bones = defs.map(([name, parent, pivot]) => ({ name, parent, pivot }));
  const ix = {}; bones.forEach((b, i) => { ix[b.name] = i; });
  return { bones, ix };
}

const SPECIES = {
  mossback: {
    name: 'Mossback', hp: 18, speed: 0.95, run: 3.4, w: 0.45, h: 1.15, hostile: false, herd: true, shell: 0.095,
    drops: [['raw_meat', 1, 3]], sound: 'grunt',
    build() {
      const R = rig([['root', -1, [0, 0.6, 0]], ['body', 0, [0, 0.7, 0]], ['neck', 1, [0, 0.8, 0.5]], ['head', 2, [0, 0.9, 0.84]], ['jaw', 3, [0, 0.86, 0.98]], ['earL', 3, [0.15, 1.0, 0.9]], ['earR', 3, [-0.15, 1.0, 0.9]],
        ['fl', 1, [0.23, 0.66, 0.38]], ['flk', 7, [0.25, 0.33, 0.4]], ['fr', 1, [-0.23, 0.66, 0.38]], ['frk', 9, [-0.25, 0.33, 0.4]], ['bl', 1, [0.23, 0.68, -0.4]], ['blk', 11, [0.25, 0.34, -0.43]], ['br', 1, [-0.23, 0.68, -0.4]], ['brk', 13, [-0.25, 0.34, -0.43]], ['tail', 1, [0, 0.84, -0.62]]]);
      const m = new ModelBuilder(), I = R.ix;
      const coat = (p, n) => {
        const moss = sstep(0.82, 1.02, p[1] + softNoise(p, 9) * 0.07) * sstep(0.2, 0.7, n[1]);
        const base = mixC([0.34, 0.27, 0.2], [0.5, 0.42, 0.31], clamp(softNoise(p, 6) * 0.6 + 0.4, 0, 1));
        const belly = sstep(0.62, 0.45, p[1]);
        return mixC(mixC(base, [0.62, 0.56, 0.45], belly * 0.6), mixC([0.28, 0.34, 0.13], [0.43, 0.47, 0.19], clamp(softNoise(p, 17) + 0.5, 0, 1)), moss);
      };
      const fur = (len) => ({ colorFn: coat, rough: 0.85, metal: 0, fur: len });
      m.ellipsoid([0, 0.72, -0.04], [0.37, 0.34, 0.66], 30, 22, Object.assign(fur(1), { bone: I.body, aoFn: (p) => 0.55 + 0.45 * sstep(0.42, 0.85, p[1]) }), (d) => 1 + softNoise(d, 4) * 0.045);
      m.ellipsoid([0, 0.9, 0.2], [0.3, 0.25, 0.37], 22, 16, Object.assign(fur(1.15), { bone: I.body }), (d) => 1 + softNoise(d, 5) * 0.06);
      m.ellipsoid([0, 0.78, -0.45], [0.3, 0.28, 0.26], 20, 14, Object.assign(fur(0.9), { bone: I.body }));
      m.tube([[0, 0.76, 0.42], [0, 0.86, 0.66], [0, 0.92, 0.86]], [0.24, 0.18, 0.145], 16, Object.assign(fur(0.8), { bone: I.body, bone2: I.neck, weight: (p) => sstep(0.44, 0.68, p[2]) }));
      const face = { color: [0.3, 0.24, 0.2], rough: 0.7, metal: 0, bone: I.head };
      m.ellipsoid([0, 0.93, 0.98], [0.17, 0.165, 0.22], 20, 16, Object.assign({}, fur(0.22), { bone: I.head }));
      m.ellipsoid([0, 0.875, 1.16], [0.122, 0.095, 0.14], 18, 12, face);
      m.ellipsoid([0, 0.9, 1.285], [0.075, 0.048, 0.034], 12, 9, { color: [0.07, 0.055, 0.05], rough: 0.35, metal: 0, bone: I.head });
      m.ellipsoid([0, 0.815, 1.12], [0.095, 0.045, 0.13], 14, 9, { color: [0.24, 0.18, 0.15], rough: 0.72, metal: 0, bone: I.jaw });
      for (const s of [1, -1]) {
        m.ellipsoid([s * 0.138, 0.965, 1.075], [0.03, 0.026, 0.024], 12, 9, { color: [0.05, 0.03, 0.02], rough: 0.04, metal: 0.2, bone: I.head });
        m.ellipsoid([s * 0.134, 0.992, 1.07], [0.042, 0.018, 0.036], 10, 6, face);
        m.tube([[s * 0.095, 1.045, 0.95], [s * 0.2, 1.13, 0.9], [s * 0.285, 1.13, 0.8], [s * 0.31, 1.045, 0.76], [s * 0.285, 1.0, 0.83]], [0.052, 0.043, 0.032, 0.022, 0.006], 9, { colorFn: (p) => mixC([0.42, 0.35, 0.25], [0.84, 0.78, 0.62], sstep(1.04, 1.13, p[1]) * 0.7 + noise3h(p[0] * 2, p[1] * 2, p[2] * 2) * 0.2), rough: 0.48, metal: 0, bone: I.head });
        m.ellipsoid([s * 0.215, 0.975, 0.9], [0.095, 0.032, 0.048], 12, 8, Object.assign({}, fur(0.16), { bone: s > 0 ? I.earL : I.earR }), null, [[s * 0.9, -0.42, 0], [0.42 * s, 0.9, 0], [0, 0, 1]]);
      }
      const legs = [['fl', 1, 0.38], ['fr', -1, 0.38], ['bl', 1, -0.41], ['br', -1, -0.41]];
      for (const [n, s, z] of legs) {
        m.tube([[s * 0.22, 0.7, z], [s * 0.255, 0.5, z + 0.015], [s * 0.25, 0.32, z + (z > 0 ? 0.02 : -0.03)]], [0.15, 0.1, 0.075], 12, Object.assign({}, fur(0.42), { bone: I[n] }));
        m.tube([[s * 0.25, 0.34, z + (z > 0 ? 0.02 : -0.03)], [s * 0.25, 0.18, z + 0.01], [s * 0.25, 0.08, z + 0.025]], [0.074, 0.056, 0.058], 11, { color: [0.2, 0.155, 0.12], rough: 0.8, metal: 0, bone: I[n + 'k'] });
        m.ellipsoid([s * 0.25, 0.056, z + 0.05], [0.078, 0.062, 0.092], 12, 9, { color: [0.09, 0.075, 0.065], rough: 0.42, metal: 0, bone: I[n + 'k'] });
      }
      m.tube([[0, 0.84, -0.62], [0, 0.72, -0.76], [0, 0.58, -0.8]], [0.065, 0.045, 0.03], 9, Object.assign({}, fur(0.5), { bone: I.tail }));
      m.ellipsoid([0, 0.54, -0.8], [0.065, 0.1, 0.065], 10, 8, { color: [0.2, 0.15, 0.1], rough: 0.9, metal: 0, fur: 1.1, bone: I.tail });
      return { m, R };
    },
    animate(c, p, t) {
      const I = c.R.ix, g = c.gait, amp = clamp(c.speedNow / 1.2, 0, 1), runK = clamp((c.speedNow - 1.4) / 2, 0, 1);
      p.pos[I.root][1] = Math.abs(Math.sin(g * 2)) * 0.025 * amp + Math.sin(t * 1.4 + c.seed) * 0.006;
      p.rot[I.body][2] = Math.sin(g) * 0.025 * amp;
      p.rot[I.body][0] = Math.sin(g * 2) * 0.018 * amp * (1 + runK * 3);
      const legs = [['fl', 0], ['br', 0.25], ['fr', Math.PI], ['bl', Math.PI + 0.25]];
      for (const [n, off] of legs) {
        const ph = g + off;
        p.rot[I[n]][0] = Math.sin(ph) * (0.42 + runK * 0.3) * amp;
        p.rot[I[n + 'k']][0] = Math.max(0, -Math.cos(ph)) * (0.75 + runK * 0.4) * amp * (n[0] === 'b' ? -1 : 1);
      }
      const graze = c.graze;
      p.rot[I.neck][0] = graze * 0.78 + Math.sin(g * 2 + 1) * 0.04 * amp + Math.sin(t * 0.7 + c.seed) * 0.03;
      p.rot[I.head][0] = graze * 0.36 + Math.sin(t * 0.93 + c.seed * 3) * 0.05;
      p.rot[I.head][1] = Math.sin(t * 0.41 + c.seed * 7) * 0.32 * (1 - graze) * (1 - amp);
      p.rot[I.jaw][0] = graze > 0.7 ? Math.abs(Math.sin(t * 5.5)) * 0.14 : 0;
      const flick = Math.pow(Math.max(0, Math.sin(t * 1.9 + c.seed * 5)), 18);
      p.rot[I.earL][2] = flick * 0.5 + Math.sin(t * 1.1) * 0.05; p.rot[I.earR][2] = -flick * 0.4;
      p.rot[I.tail][2] = Math.sin(t * 2.2 + c.seed) * 0.22; p.rot[I.tail][0] = -runK * 0.7;
    },
  },
  plumehare: {
    name: 'Plumehare', hp: 6, speed: 1.4, run: 5.2, w: 0.22, h: 0.55, hostile: false, shy: 6, shell: 0.055, hop: true,
    drops: [['plume', 1, 2], ['raw_meat', 0, 1]], sound: 'squeak',
    build() {
      const R = rig([['root', -1, [0, 0.2, 0]], ['body', 0, [0, 0.22, 0]], ['head', 1, [0, 0.31, 0.13]], ['earL', 2, [0.045, 0.43, 0.15]], ['earR', 2, [-0.045, 0.43, 0.15]], ['hl', 1, [0.1, 0.2, -0.1]], ['hr', 1, [-0.1, 0.2, -0.1]], ['fl', 1, [0.065, 0.22, 0.12]], ['fr', 1, [-0.065, 0.22, 0.12]], ['tail', 1, [0, 0.26, -0.2]]]);
      const m = new ModelBuilder(), I = R.ix;
      const coat = (p, n) => mixC(mixC([0.62, 0.46, 0.28], [0.74, 0.6, 0.4], clamp(softNoise(p, 22) + 0.5, 0, 1)), [0.92, 0.87, 0.76], sstep(-0.1, -0.6, n[1]) + sstep(0.1, 0.02, p[1]) * 0.5);
      const fur = (l, bone) => ({ colorFn: coat, rough: 0.9, metal: 0, fur: l, bone });
      m.ellipsoid([0, 0.22, -0.03], [0.135, 0.145, 0.2], 20, 16, fur(1, I.body));
      m.ellipsoid([0, 0.25, 0.1], [0.095, 0.115, 0.095], 16, 12, fur(0.9, I.body));
      m.ellipsoid([0, 0.37, 0.18], [0.098, 0.093, 0.108], 20, 15, fur(0.35, I.head));
      m.ellipsoid([0, 0.348, 0.265], [0.05, 0.042, 0.04], 12, 9, fur(0.18, I.head));
      m.ellipsoid([0, 0.362, 0.304], [0.018, 0.013, 0.01], 8, 6, { color: [0.62, 0.34, 0.3], rough: 0.4, metal: 0, bone: I.head });
      for (const s of [1, -1]) {
        m.ellipsoid([s * 0.077, 0.392, 0.23], [0.027, 0.028, 0.022], 12, 9, { color: [0.07, 0.035, 0.02], rough: 0.03, metal: 0.25, bone: I.head });
        const ear = s > 0 ? I.earL : I.earR;
        m.tube([[s * 0.045, 0.43, 0.15], [s * 0.072, 0.54, 0.12], [s * 0.092, 0.65, 0.07], [s * 0.1, 0.72, 0.02]], [0.032, 0.046, 0.036, 0.006], 10, { colorFn: (p, n) => (n[2] > 0.55 ? [0.78, 0.52, 0.44] : p[1] > 0.66 ? [0.22, 0.14, 0.1] : [0.66, 0.5, 0.32]), rough: 0.85, metal: 0, bone: ear }, 0.34);
        const h = s > 0 ? I.hl : I.hr, f = s > 0 ? I.fl : I.fr;
        m.ellipsoid([s * 0.105, 0.17, -0.1], [0.07, 0.105, 0.12], 14, 11, fur(0.5, h));
        m.ellipsoid([s * 0.11, 0.032, -0.03], [0.042, 0.03, 0.125], 10, 8, fur(0.25, h));
        m.tube([[s * 0.062, 0.2, 0.12], [s * 0.07, 0.11, 0.15], [s * 0.07, 0.028, 0.17]], [0.038, 0.028, 0.03], 9, fur(0.22, f));
      }
      const plume = { colorFn: (p) => mixC([0.7, 0.54, 0.34], [0.98, 0.95, 0.88], sstep(0.24, 0.42, p[1])), rough: 0.95, metal: 0, fur: 2.2, bone: I.tail };
      m.ellipsoid([0, 0.3, -0.27], [0.075, 0.1, 0.085], 14, 11, plume);
      m.ellipsoid([0, 0.43, -0.3], [0.055, 0.09, 0.06], 12, 10, plume);
      return { m, R };
    },
    animate(c, p, t) {
      const I = c.R.ix, moving = c.speedNow > 0.15;
      const hop = moving ? Math.max(0, Math.sin(c.gait * 1.4)) : 0;
      p.pos[I.root][1] = hop * (0.1 + clamp(c.speedNow / 5, 0, 1) * 0.16);
      p.rot[I.body][0] = moving ? Math.cos(c.gait * 1.4) * 0.28 : Math.sin(t * 2.2 + c.seed) * 0.012;
      for (const n of ['hl', 'hr']) p.rot[I[n]][0] = hop * 1.05 - (moving ? 0.2 : 0);
      for (const n of ['fl', 'fr']) p.rot[I[n]][0] = -hop * 0.75;
      const alert = c.state === 'idle' ? 1 : 0;
      p.rot[I.head][0] = c.graze * 0.7 - alert * 0.08 + Math.sin(t * 7 + c.seed) * 0.02;
      p.rot[I.head][1] = Math.sin(t * 0.8 + c.seed * 4) * 0.4 * (moving ? 0 : 1);
      const tw = Math.pow(Math.max(0, Math.sin(t * 1.3 + c.seed)), 12);
      p.rot[I.earL][0] = -hop * 0.7 + tw * 0.3; p.rot[I.earR][0] = -hop * 0.62 - c.graze * 0.3;
      p.rot[I.earL][2] = -tw * 0.18; p.rot[I.earR][2] = 0.06;
      p.rot[I.tail][2] = Math.sin(t * 3.1 + c.seed) * 0.12; p.rot[I.tail][0] = hop * 0.5;
    },
  },
  reedstrider: {
    name: 'Reedstrider', hp: 8, speed: 0.8, run: 4.2, w: 0.25, h: 1.5, hostile: false, shy: 7, shell: 0.025,
    drops: [['plume', 1, 3], ['raw_meat', 1, 1]], sound: 'call',
    build() {
      const R = rig([['root', -1, [0, 0.8, 0]], ['body', 0, [0, 0.84, 0]], ['neck1', 1, [0, 0.92, 0.24]], ['neck2', 2, [0, 1.16, 0.33]], ['head', 3, [0, 1.36, 0.32]], ['ll', 0, [0.075, 0.76, 0.0]], ['llk', 5, [0.08, 0.43, -0.07]], ['llf', 6, [0.08, 0.05, 0.02]], ['lr', 0, [-0.075, 0.76, 0.0]], ['lrk', 8, [-0.08, 0.43, -0.07]], ['lrf', 9, [-0.08, 0.05, 0.02]], ['tail', 1, [0, 0.86, -0.3]], ['wl', 1, [0.15, 0.94, 0.12]], ['wr', 1, [-0.15, 0.94, 0.12]]]);
      const m = new ModelBuilder(), I = R.ix;
      const body = (p, n) => mixC([0.27, 0.41, 0.43], [0.78, 0.75, 0.64], sstep(0.0, -0.7, n[1]) + sstep(0.9, 0.76, p[1]) * 0.35);
      m.ellipsoid([0, 0.84, -0.03], [0.17, 0.165, 0.33], 24, 18, { colorFn: body, rough: 0.7, metal: 0, fur: 0.9, bone: I.body });
      m.tube([[0, 0.88, 0.2], [0, 1.04, 0.34], [0, 1.18, 0.34]], [0.085, 0.046, 0.038], 12, { colorFn: body, rough: 0.72, metal: 0, fur: 0.4, bone: I.body, bone2: I.neck1, weight: (p) => sstep(0.9, 1.02, p[1]) });
      m.tube([[0, 1.17, 0.34], [0, 1.28, 0.28], [0, 1.37, 0.33]], [0.038, 0.034, 0.04], 11, { color: [0.75, 0.72, 0.62], rough: 0.75, metal: 0, fur: 0.25, bone: I.neck1, bone2: I.neck2, weight: (p) => sstep(1.14, 1.24, p[1]) });
      m.ellipsoid([0, 1.385, 0.37], [0.055, 0.052, 0.078], 16, 12, { colorFn: (p, n) => (n[1] > 0.5 ? [0.18, 0.22, 0.24] : [0.8, 0.77, 0.68]), rough: 0.65, metal: 0, bone: I.head });
      m.tube([[0, 1.378, 0.43], [0, 1.352, 0.55], [0, 1.312, 0.67]], [0.025, 0.015, 0.003], 8, { colorFn: (p) => mixC([0.86, 0.5, 0.14], [0.24, 0.18, 0.12], sstep(0.55, 0.67, p[2])), rough: 0.35, metal: 0, bone: I.head }, 0.8);
      for (const s of [1, -1]) {
        m.ellipsoid([s * 0.046, 1.398, 0.398], [0.014, 0.015, 0.012], 9, 7, { color: [0.95, 0.66, 0.1], rough: 0.05, metal: 0.2, bone: I.head });
        m.ellipsoid([s * 0.055, 1.399, 0.403], [0.007, 0.008, 0.006], 7, 5, { color: [0.02, 0.02, 0.02], rough: 0.03, metal: 0.3, bone: I.head });
        const w = s > 0 ? I.wl : I.wr;
        m.ellipsoid([s * 0.155, 0.87, -0.09], [0.045, 0.115, 0.3], 14, 12, { colorFn: (p) => { const band = Math.sin(p[2] * 60 + p[1] * 25) > 0.3 ? 0.82 : 1.0; return mixC([0.2, 0.3, 0.34], [0.09, 0.11, 0.13], sstep(-0.16, -0.36, p[2])).map((v) => v * band); }, rough: 0.62, metal: 0, bone: w });
        const [a, k, f] = s > 0 ? [I.ll, I.llk, I.llf] : [I.lr, I.lrk, I.lrf];
        m.tube([[s * 0.07, 0.77, 0], [s * 0.08, 0.6, -0.04], [s * 0.08, 0.43, -0.07]], [0.048, 0.023, 0.019], 8, { color: [0.62, 0.46, 0.2], rough: 0.6, metal: 0, bone: a });
        m.tube([[s * 0.08, 0.43, -0.07], [s * 0.08, 0.24, -0.02], [s * 0.08, 0.05, 0.02]], [0.019, 0.015, 0.015], 8, { color: [0.58, 0.42, 0.18], rough: 0.55, metal: 0, bone: k });
        for (const [tx, tz] of [[-0.07, 0.13], [0, 0.17], [0.07, 0.13], [0, -0.08]]) m.tube([[s * 0.08, 0.045, 0.02], [s * 0.08 + tx * 0.5, 0.018, 0.02 + tz * 0.5], [s * 0.08 + tx, 0.01, 0.02 + tz]], [0.014, 0.01, 0.005], 6, { color: [0.5, 0.36, 0.16], rough: 0.55, metal: 0, bone: f });
      }
      for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.14; m.tube([[0, 0.87, -0.3], [a * 0.35, 0.85, -0.46], [a * 0.7, 0.78 + Math.abs(a) * 0.05, -0.64]], [0.034, 0.03, 0.006], 7, { colorFn: (p) => mixC([0.22, 0.34, 0.38], [0.52, 0.2, 0.2], sstep(-0.42, -0.6, p[2])), rough: 0.65, metal: 0, bone: I.tail }, 0.28); }
      for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.022; m.tube([[x * 0.4, 1.43, 0.37], [x, 1.5 - Math.abs(x), 0.26], [x * 2.2, 1.49 - i * 0.012, 0.13]], [0.012, 0.009, 0.002], 6, { color: [0.68, 0.2, 0.24], rough: 0.6, metal: 0, bone: I.head }, 0.35); }
      return { m, R };
    },
    animate(c, p, t) {
      const I = c.R.ix, g = c.gait, amp = clamp(c.speedNow / 1.0, 0, 1), run = clamp((c.speedNow - 1.5) / 2.2, 0, 1);
      p.pos[I.root][1] = Math.abs(Math.cos(g)) * 0.03 * amp + run * Math.max(0, Math.sin(g * 0.5)) * 0.3;
      for (const [a, k, f, off] of [['ll', 'llk', 'llf', 0], ['lr', 'lrk', 'lrf', Math.PI]]) {
        const ph = g + off, lift = Math.max(0, Math.cos(ph));
        p.rot[I[a]][0] = Math.sin(ph) * 0.46 * amp - lift * 0.16 * amp;
        p.rot[I[k]][0] = lift * 1.0 * amp;
        p.rot[I[f]][0] = -p.rot[I[a]][0] - p.rot[I[k]][0] * 0.7;
      }
      const bobz = Math.sin(g * 2) * amp * (1 - run);
      const peck = c.graze;
      p.rot[I.neck1][0] = peck * 1.15 + bobz * 0.14 + run * 0.5 + Math.sin(t * 0.8 + c.seed) * 0.04;
      p.rot[I.neck2][0] = peck * 0.62 - bobz * 0.2 - run * 0.15;
      p.rot[I.head][0] = -peck * 0.55 - run * 0.3 + (peck > 0.8 ? Math.abs(Math.sin(t * 6)) * 0.25 : 0);
      p.rot[I.head][1] = Math.sin(t * 0.6 + c.seed * 9) * 0.5 * (1 - amp) * (1 - peck);
      p.rot[I.body][0] = peck * 0.3 + run * 0.14;
      const flap = run * Math.sin(t * 16);
      p.rot[I.wl][2] = run * 0.9 + flap * 0.6; p.rot[I.wr][2] = -run * 0.9 - flap * 0.6;
      p.rot[I.tail][0] = Math.sin(t * 1.4 + c.seed) * 0.07 - run * 0.2;
    },
  },
  gloamstalker: {
    name: 'Gloamstalker', hp: 22, speed: 1.25, run: 3.9, w: 0.4, h: 1.45, hostile: true, damage: 3, reach: 2.9, shell: 0,
    drops: [['gloam_core', 0, 1], ['coal', 0, 2]], sound: 'growl',
    build() {
      const R = rig([['root', -1, [0, 0.85, 0]], ['hips', 0, [0, 0.82, -0.3]], ['chest', 0, [0, 0.95, 0.05]], ['neck', 2, [0, 1.1, 0.4]], ['head', 3, [0, 1.14, 0.56]], ['jawL', 4, [0.05, 1.07, 0.66]], ['jawR', 4, [-0.05, 1.07, 0.66]],
        ['al', 2, [0.24, 1.08, 0.24]], ['alk', 7, [0.46, 0.68, 0.34]], ['ar', 2, [-0.24, 1.08, 0.24]], ['ark', 9, [-0.46, 0.68, 0.34]], ['ll', 1, [0.15, 0.82, -0.3]], ['llk', 11, [0.23, 0.55, -0.1]], ['lr', 1, [-0.15, 0.82, -0.3]], ['lrk', 13, [-0.23, 0.55, -0.1]], ['tail', 1, [0, 0.82, -0.46]], ['tail2', 15, [0, 0.74, -0.82]], ['core', 2, [0, 0.96, 0.4]]]);
      const m = new ModelBuilder(), I = R.ix;
      const bark = (bone, extra = {}) => Object.assign({ layer: LAYER.charwood, color: [0.62, 0.58, 0.62], rough: 0.72, metal: 0.05, emissive: 3.2, bone, uvScale: 1.5 }, extra);
      const bone_ = { color: [0.46, 0.4, 0.34], rough: 0.5, metal: 0 };
      const ridged = (k) => (d) => 1 + softNoise(d, 6) * k + Math.max(0, softNoise(d, 13)) * k * 0.7;
      m.ellipsoid([0, 1.04, 0.18], [0.25, 0.27, 0.3], 24, 18, bark(I.chest), ridged(0.12));
      m.ellipsoid([0, 0.82, -0.3], [0.17, 0.17, 0.22], 18, 14, bark(I.hips), ridged(0.1));
      m.tube([[0, 0.84, -0.28], [0, 0.92, -0.08], [0, 1.03, 0.1]], [0.115, 0.075, 0.15], 12, bark(I.hips, { bone2: I.chest, weight: (p) => sstep(-0.22, 0.02, p[2]) }));
      // glowing ribcage core
      m.ellipsoid([0, 0.94, 0.38], [0.085, 0.11, 0.085], 14, 11, { color: [1, 0.42, 0.08], emissive: 6.5, rough: 0.35, metal: 0, bone: I.core });
      for (const s of [1, -1]) for (let k = 0; k < 4; k++) m.tube([[s * 0.2, 1.1 - k * 0.075, 0.26 - k * 0.03], [s * 0.17, 1.04 - k * 0.085, 0.45 - k * 0.03], [s * 0.035, 0.99 - k * 0.08, 0.485 - k * 0.035]], [0.027, 0.02, 0.009], 6, bark(I.chest, { emissive: 1.5 }));
      // back spines
      for (let k = 0; k < 7; k++) {
        const z = 0.34 - k * 0.125, y = 1.26 - k * 0.062, len = 0.3 - Math.abs(k - 2) * 0.035;
        for (const s of [1, -1]) m.tube([[s * 0.06, y - 0.06, z], [s * (0.12 + (k % 2) * 0.05), y + len * 0.6, z - len * 0.35], [s * (0.14 + (k % 2) * 0.07), y + len, z - len * 0.85]], [0.045, 0.021, 0.002], 6, bark(k < 4 ? I.chest : I.hips, { emissive: 1.2 }));
      }
      m.tube([[0, 1.06, 0.34], [0, 1.13, 0.46], [0, 1.15, 0.58]], [0.105, 0.075, 0.07], 11, bark(I.neck));
      m.ellipsoid([0, 1.15, 0.65], [0.11, 0.095, 0.17], 18, 13, bark(I.head, { emissive: 1.4 }), ridged(0.09));
      m.ellipsoid([0, 1.185, 0.68], [0.1, 0.052, 0.15], 14, 8, Object.assign({ bone: I.head }, bone_));
      m.ellipsoid([0, 1.075, 0.72], [0.05, 0.035, 0.1], 10, 7, { color: [1, 0.35, 0.05], emissive: 5, rough: 0.4, metal: 0, bone: I.head });
      for (const s of [1, -1]) {
        for (const [ex, ey, ez, r] of [[0.078, 1.178, 0.755, 0.021], [0.092, 1.15, 0.705, 0.014]]) m.ellipsoid([s * ex, ey, ez], [r, r * 0.8, r], 9, 7, { color: [1, 0.62, 0.12], emissive: 11, rough: 0.2, metal: 0, bone: I.head });
        const jaw = s > 0 ? I.jawL : I.jawR;
        m.tube([[s * 0.06, 1.07, 0.65], [s * 0.1, 1.02, 0.8], [s * 0.07, 1.0, 0.9], [s * 0.018, 1.01, 0.945]], [0.036, 0.028, 0.017, 0.003], 8, Object.assign({ bone: jaw }, bone_));
        for (let k = 0; k < 4; k++) m.tube([[s * (0.088 - k * 0.006), 1.03 - k * 0.004, 0.74 + k * 0.05], [s * 0.035, 1.045, 0.755 + k * 0.05]], [0.011, 0.001], 5, { color: [0.78, 0.72, 0.6], rough: 0.3, metal: 0, bone: jaw });
        const [a, k_] = s > 0 ? [I.al, I.alk] : [I.ar, I.ark];
        m.tube([[s * 0.2, 1.1, 0.22], [s * 0.37, 0.92, 0.2], [s * 0.46, 0.68, 0.34]], [0.1, 0.056, 0.05], 10, bark(a));
        m.ellipsoid([s * 0.46, 0.68, 0.33], [0.07, 0.07, 0.07], 10, 8, bark(a, { emissive: 1 }), ridged(0.2));
        m.tube([[s * 0.46, 0.68, 0.34], [s * 0.45, 0.4, 0.47], [s * 0.4, 0.13, 0.52]], [0.052, 0.036, 0.046], 10, bark(k_));
        for (let c = -1; c <= 1; c++) m.tube([[s * 0.4 + c * 0.035, 0.14, 0.52], [s * 0.4 + c * 0.08, 0.075, 0.65], [s * 0.4 + c * 0.095, 0.008, 0.72]], [0.022, 0.014, 0.002], 6, Object.assign({ bone: k_ }, bone_));
        const [l, lk] = s > 0 ? [I.ll, I.llk] : [I.lr, I.lrk];
        m.tube([[s * 0.14, 0.82, -0.3], [s * 0.2, 0.68, -0.17], [s * 0.23, 0.55, -0.1]], [0.085, 0.064, 0.048], 10, bark(l));
        m.tube([[s * 0.23, 0.55, -0.1], [s * 0.21, 0.36, -0.32], [s * 0.2, 0.19, -0.42], [s * 0.2, 0.06, -0.3]], [0.048, 0.03, 0.028, 0.036], 9, bark(lk, { emissive: 1.2 }));
        for (let c = -1; c <= 1; c += 2) m.tube([[s * 0.2, 0.055, -0.3], [s * 0.2 + c * 0.05, 0.012, -0.17]], [0.024, 0.003], 6, Object.assign({ bone: lk }, bone_));
      }
      m.tube([[0, 0.82, -0.46], [0, 0.75, -0.64], [0, 0.73, -0.82]], [0.07, 0.048, 0.036], 9, bark(I.tail));
      m.tube([[0, 0.73, -0.82], [0, 0.76, -1.0], [0, 0.9, -1.16]], [0.036, 0.02, 0.004], 8, bark(I.tail2, { emissive: 2 }));
      return { m, R };
    },
    animate(c, p, t) {
      const I = c.R.ix, g = c.gait, amp = clamp(c.speedNow / 1.4, 0, 1), run = clamp((c.speedNow - 1.6) / 2, 0, 1);
      const wind = c.state === 'windup' ? smooth01(clamp(c.stateT / 0.55, 0, 1)) : 0;
      const lunge = c.state === 'lunge' ? Math.sin(clamp(c.stateT / 0.42, 0, 1) * Math.PI) : 0;
      p.pos[I.root][1] = Math.abs(Math.sin(g * 2)) * 0.04 * amp - wind * 0.22 + lunge * 0.22 + Math.sin(t * 1.9 + c.seed) * 0.012;
      p.pos[I.root][2] = -wind * 0.14 + lunge * 0.3;
      p.rot[I.chest][0] = -wind * 0.5 + lunge * 0.55 + Math.sin(g * 2) * 0.05 * amp;
      p.rot[I.chest][1] = Math.sin(g) * 0.1 * amp;
      p.rot[I.hips][1] = -Math.sin(g) * 0.12 * amp;
      for (const [a, k, off, s] of [['al', 'alk', 0, 1], ['ar', 'ark', Math.PI, -1]]) {
        const ph = g + off;
        p.rot[I[a]][0] = Math.sin(ph) * (0.5 + run * 0.28) * amp - wind * 1.0 - lunge * 1.35;
        p.rot[I[a]][2] = s * (wind * 0.35 - lunge * 0.15);
        p.rot[I[k]][0] = -Math.max(0, Math.cos(ph)) * 0.8 * amp - wind * 0.55 + lunge * 0.5;
      }
      for (const [a, k, off] of [['ll', 'llk', Math.PI], ['lr', 'lrk', 0]]) {
        const ph = g + off;
        p.rot[I[a]][0] = Math.sin(ph) * 0.5 * amp - wind * 0.5 + lunge * 0.8;
        p.rot[I[k]][0] = Math.max(0, Math.cos(ph)) * 0.7 * amp + wind * 0.7 - lunge * 0.4;
      }
      const jaw = wind * 0.75 + lunge * 0.55 + Math.max(0, Math.sin(t * 1.3 + c.seed)) * 0.1;
      p.rot[I.jawL][1] = jaw; p.rot[I.jawR][1] = -jaw;
      p.rot[I.neck][0] = -wind * 0.22 + lunge * 0.2 + Math.sin(t * 0.9 + c.seed) * 0.07;
      p.rot[I.head][0] = wind * 0.5 - lunge * 0.4;
      p.rot[I.head][2] = Math.pow(Math.max(0, Math.sin(t * 0.7 + c.seed * 3)), 8) * 0.4 + (wind ? Math.sin(t * 34) * 0.07 * wind : 0);
      p.rot[I.tail][1] = Math.sin(t * 2.1 + c.seed) * 0.28; p.rot[I.tail2][1] = Math.sin(t * 2.1 + c.seed - 1) * 0.4; p.rot[I.tail][0] = wind * 0.5;
      c.emisBoost = 1 + wind * 2.6 + lunge * 1.6 + Math.sin(t * 3.4 + c.seed) * 0.14;
    },
  },
  hollowlantern: {
    name: 'Hollow Lantern', hp: 14, speed: 1.2, run: 2.8, w: 0.36, h: 1.7, hostile: true, damage: 3, reach: 2.9, shell: 0, floating: true,
    drops: [['lantern_shard', 0, 2]], sound: 'chime',
    build() {
      const defs = [['root', -1, [0, 1.35, 0]], ['hood', 0, [0, 1.4, 0]], ['core', 0, [0, 1.32, 0]]];
      for (let i = 0; i < 6; i++) defs.push(['shard' + i, 0, [0, 1.32, 0]]);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; defs.push(['t' + i, 1, [Math.cos(a) * 0.17, 1.16, Math.sin(a) * 0.17]]); defs.push(['t' + i + 'b', 9 + i * 2, [Math.cos(a) * 0.2, 0.82, Math.sin(a) * 0.2]]); }
      const R = rig(defs), I = R.ix, m = new ModelBuilder();
      const stone = (bone, extra = {}) => Object.assign({ layer: LAYER.basalt, color: [0.62, 0.62, 0.72], rough: 0.62, metal: 0.05, bone, uvScale: 1.6 }, extra);
      // hooded shell: open toward the front so the core shows through
      m.ellipsoid([0, 1.47, -0.05], [0.31, 0.33, 0.3], 30, 22, stone(I.hood), (d) => {
        const open = sstep(0.3, 0.78, d[2]) * sstep(0.62, 0.15, d[1]);
        return (1 - open * 0.62) * (1 + Math.max(0, softNoise(d, 5)) * 0.14 + (d[1] < -0.45 ? softNoise(d, 11) * 0.22 : 0));
      });
      m.tube([[0, 1.74, -0.05], [0, 1.9, -0.14], [0.02, 1.93, -0.3]], [0.11, 0.05, 0.004], 8, stone(I.hood));
      m.ellipsoid([0, 1.32, 0.02], [0.14, 0.17, 0.14], 18, 14, { layer: LAYER.crystal_amber, color: [0.8, 0.74, 1], emissive: 5.5, rough: 0.12, metal: 0.1, bone: I.core }, (d) => 1 + Math.abs(softNoise(d, 8)) * 0.16);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283, y = 1.3 + Math.sin(i * 2.4) * 0.22;
        const c = [Math.cos(a) * 0.46, y, Math.sin(a) * 0.46];
        m.ellipsoid(c, [0.055, 0.14 + (i % 3) * 0.03, 0.05], 8, 6, stone(I['shard' + i]), (d) => 0.6 + rand01(Math.round(d[0] * 2), Math.round(d[1] * 2), Math.round(d[2] * 2), i) * 0.8);
        m.ellipsoid([c[0] * 0.93, y, c[2] * 0.93], [0.014, 0.06, 0.014], 6, 5, { color: [0.55, 0.38, 1], emissive: 5, rough: 0.3, metal: 0, bone: I['shard' + i] });
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.283, cx = Math.cos(a), cz = Math.sin(a);
        m.tube([[cx * 0.16, 1.2, cz * 0.16], [cx * 0.22, 1.0, cz * 0.22], [cx * 0.2, 0.82, cz * 0.2]], [0.036, 0.022, 0.017], 7, { color: [0.13, 0.12, 0.18], rough: 0.55, metal: 0, bone: I['t' + i] });
        m.tube([[cx * 0.2, 0.82, cz * 0.2], [cx * 0.15, 0.62, cz * 0.15], [cx * 0.19, 0.44 - (i % 2) * 0.1, cz * 0.19]], [0.017, 0.01, 0.002], 6, { colorFn: (p) => mixC([0.55, 0.36, 1], [0.13, 0.12, 0.18], sstep(0.5, 0.7, p[1])), emissive: 0.7, rough: 0.4, metal: 0, bone: I['t' + i + 'b'] });
      }
      return { m, R };
    },
    animate(c, p, t) {
      const I = c.R.ix;
      const wind = c.state === 'windup' ? smooth01(clamp(c.stateT / 0.7, 0, 1)) : 0;
      const dash = c.state === 'lunge' ? 1 : 0;
      p.pos[I.root][1] = Math.sin(t * 1.7 + c.seed) * 0.09 + wind * 0.2 - dash * 0.15;
      p.rot[I.hood][0] = Math.sin(t * 1.1 + c.seed) * 0.07 + dash * 0.45 - wind * 0.25 + clamp(c.speedNow * 0.07, 0, 0.25);
      p.rot[I.hood][2] = Math.sin(t * 0.83 + c.seed * 2) * 0.08;
      for (let i = 0; i < 6; i++) {
        const spin = t * (0.7 + wind * 6) + c.seed;
        p.rot[I['shard' + i]][1] = spin;
        p.scale[I['shard' + i]] = 1 - wind * 0.45 + dash * 0.3;
        p.pos[I['shard' + i]][1] = Math.sin(t * 2.1 + i * 1.9) * 0.055 * (1 - wind);
      }
      p.scale[I.core] = 1 + wind * 0.38 + Math.sin(t * 5 + c.seed) * 0.04;
      for (let i = 0; i < 5; i++) {
        const drag = clamp(c.speedNow * 0.24, 0, 0.8);
        p.rot[I['t' + i]][0] = Math.sin(t * 2.0 + i * 1.3) * 0.2 + drag; p.rot[I['t' + i]][2] = Math.cos(t * 1.6 + i * 1.7) * 0.17;
        p.rot[I['t' + i + 'b']][0] = Math.sin(t * 2.4 + i * 1.3 - 1.2) * 0.38 + drag * 0.8;
      }
      c.emisBoost = 1 + wind * 3 + dash * 1.2 + Math.sin(t * 2.7 + c.seed) * 0.16;
    },
  },
};

const _speciesCache = {};
function speciesModel(type) {
  let s = _speciesCache[type];
  if (!s) { const { m, R } = SPECIES[type].build(); s = _speciesCache[type] = { geo: m.geometry(true), R }; }
  return s;
}

const _m4a = new THREE.Matrix4(), _m4b = new THREE.Matrix4(), _eu = new THREE.Euler();
let _creatureSerial = 1;
class Creature {
  constructor(type, x, y, z, seed) {
    this.type = type; this.spec = SPECIES[type]; this.id = _creatureSerial++;
    const sm = speciesModel(type); this.R = sm.R;
    this.pos = V3(x, y, z); this.vel = V3(); this.yaw = (seed || Math.random()) * 6.28; this.seed = (seed === undefined ? Math.random() : seed) * 100;
    this.health = this.spec.hp; this.state = 'idle'; this.stateT = 0; this.timer = 1 + Math.random() * 3; this.target = null; this.path = null; this.pathT = 0;
    this.gait = this.seed; this.speedNow = 0; this.graze = 0; this.hitT = 0; this.dieT = 0; this.onGround = false; this.emisBoost = 1; this.soundT = 3 + Math.random() * 8; this.cooldown = 0;
    this.light = V4(0, 0, 0, 1);
    const shells = this.spec.shell > 0 ? { low: 0, medium: 5, high: 9, ultra: 14 }[Q.name] : 0;
    const g = new THREE.InstancedBufferGeometry();
    for (const k of Object.keys(sm.geo.attributes)) g.setAttribute(k, sm.geo.attributes[k]);
    g.setIndex(sm.geo.index);
    const iShell = new Float32Array(shells + 1); for (let i = 0; i <= shells; i++) iShell[i] = shells ? i / shells : 0;
    g.setAttribute('iShell', new THREE.InstancedBufferAttribute(iShell, 1));
    g.instanceCount = shells + 1;
    this.geo = g;
    this.mat = makeModelMaterial({ skinned: true, matClass: this.spec.hostile ? 0 : 3 });
    this.mat.uniforms.uShellLen.value = this.spec.shell;
    this.shadowMat = makeModelShadowMaterial({ skinned: true }, this.mat.uniforms);
    this.mesh = new THREE.Mesh(g, this.mat); this.shadow = new THREE.Mesh(g, this.shadowMat);
    for (const m of [this.mesh, this.shadow]) { m.frustumCulled = false; }
    Pipeline.scenes.gbuf.add(this.mesh); Pipeline.scenes.shadow.add(this.shadow);
    const n = this.R.bones.length;
    this.pose = { rot: Array.from({ length: n }, () => [0, 0, 0]), pos: Array.from({ length: n }, () => [0, 0, 0]), scale: new Array(n).fill(1) };
  }
  dispose() {
    Pipeline.scenes.gbuf.remove(this.mesh); Pipeline.scenes.shadow.remove(this.shadow);
    this.mat.dispose(); this.shadowMat.dispose(); this.geo.dispose();
  }
  // forward kinematics straight into the skinning uniforms
  updateBones(t) {
    const P = this.pose;
    for (let i = 0; i < P.rot.length; i++) { P.rot[i][0] = P.rot[i][1] = P.rot[i][2] = 0; P.pos[i][0] = P.pos[i][1] = P.pos[i][2] = 0; P.scale[i] = 1; }
    this.spec.animate(this, P, t);
    const M = this.mat.uniforms.uBones.value, bones = this.R.bones;
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i], pv = b.pivot, r = P.rot[i], o = P.pos[i], s = P.scale[i];
      _m4a.makeRotationFromEuler(_eu.set(r[0], r[1], r[2], 'YXZ'));
      if (s !== 1) _m4a.scale(V3(s, s, s));
      _m4a.setPosition(pv[0] + o[0], pv[1] + o[1], pv[2] + o[2]);
      _m4a.multiply(_m4b.makeTranslation(-pv[0], -pv[1], -pv[2]));
      if (b.parent >= 0) M[i].multiplyMatrices(M[b.parent], _m4a); else M[i].copy(_m4a);
    }
    const u = this.mat.uniforms;
    u.uLight.value.copy(this.light); u.uHit.value = clamp(this.hitT / 0.28, 0, 1); u.uDissolve.value = this.state === 'dying' ? clamp((this.stateT - 0.35) / 1.0, 0, 1) : 0; u.uEmisBoost.value = this.emisBoost; u.uWetness.value = U.uRain.value * 0.6 * this.light.w;
  }
  syncMesh() {
    const fall = this.state === 'dying' ? smooth01(clamp(this.stateT / 0.55, 0, 1)) : 0;
    for (const m of [this.mesh, this.shadow]) {
      m.position.copy(this.pos); m.rotation.set(0, this.yaw, fall * 1.45 * (this.spec.floating ? 0.35 : 1), 'YXZ');
      if (this.spec.floating) m.position.y -= fall * 0.8;
      m.updateMatrixWorld();
    }
  }
}

// ---------------------------------------------------------------- shared voxel collision for walking bodies
function aabbHits(world, x, y, z, hw, h) {
  const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw), y0 = Math.floor(y), y1 = Math.floor(y + h - 0.001), z0 = Math.floor(z - hw), z1 = Math.floor(z + hw);
  for (let by = y0 - 0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) for (let bx = x0; bx <= x1; bx++) {
    const v = world.getBlock(bx, by, bz), id = v & 255;
    if (!T_SOLID[id]) continue;
    const boxes = collisionBoxes(id, v >> 8);
    for (const b of boxes) if (x + hw > bx + b[0] && x - hw < bx + b[3] && y + h > by + b[1] && y < by + b[4] && z + hw > bz + b[2] && z - hw < bz + b[5]) return { bx, by, bz, top: by + b[4], bottom: by + b[1], box: b };
  }
  return null;
}
// sweep one axis at a time in small steps; returns which axes were blocked
function moveBody(world, pos, vel, dt, hw, h, stepUp, onGround) {
  const res = { ground: false, wallX: false, wallZ: false, ceil: false };
  const total = V3(vel.x * dt, vel.y * dt, vel.z * dt);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(total.x), Math.abs(total.y), Math.abs(total.z)) / 0.3));
  for (let s = 0; s < steps; s++) {
    for (const ax of ['y', 'x', 'z']) {
      let d = total[ax] / steps;
      if (d === 0 || (ax === 'y' && res.ground) || (ax === 'y' && res.ceil)) continue;
      const next = pos[ax] + d;
      const trial = { x: pos.x, y: pos.y, z: pos.z }; trial[ax] = next;
      const hit = aabbHits(world, trial.x, trial.y, trial.z, hw, h);
      if (!hit) { pos[ax] = next; continue; }
      if (ax === 'y') {
        if (d < 0) { pos.y = hit.top + 0.0001; res.ground = true; } else { pos.y = hit.bottom - h - 0.0001; res.ceil = true; }
        vel.y = 0;
      } else {
        const rise = hit.top - pos.y;
        if (onGround && rise > 0 && rise <= stepUp && !aabbHits(world, trial.x, hit.top + 0.001, trial.z, hw, h)) { pos[ax] = next; pos.y = hit.top + 0.001; res.stepped = rise; continue; }
        res[ax === 'x' ? 'wallX' : 'wallZ'] = true;
        const b = hit.box;
        if (ax === 'x') pos.x = d > 0 ? hit.bx + b[0] - hw - 0.0001 : hit.bx + b[3] + hw + 0.0001; else pos.z = d > 0 ? hit.bz + b[2] - hw - 0.0001 : hit.bz + b[5] + hw + 0.0001;
        vel[ax] = 0;
      }
    }
  }
  return res;
}

function findPath(world, sx, sy, sz, tx, ty, tz, maxNodes = 520) {
  const walk = (x, y, z) => !T_SOLID[world.getId(x, y, z)] && !T_SOLID[world.getId(x, y + 1, z)] && T_SOLID[world.getId(x, y - 1, z)] && world.getId(x, y, z) !== B.lava;
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const start = { x: sx, y: sy, z: sz, g: 0, f: 0, p: null };
  const open = [start], seen = new Map([[key(sx, sy, sz), 0]]);
  let best = start, bestH = 1e9, n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const hh = Math.abs(cur.x - tx) + Math.abs(cur.z - tz) + Math.abs(cur.y - ty) * 0.6;
    if (hh < bestH) { bestH = hh; best = cur; }
    if (hh < 1.2) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const diag = dx && dz;
      if (diag && (T_SOLID[world.getId(cur.x + dx, cur.y, cur.z)] || T_SOLID[world.getId(cur.x, cur.y, cur.z + dz)])) continue;
      let ny = null;
      if (walk(cur.x + dx, cur.y, cur.z + dz)) ny = cur.y;
      else if (!diag && walk(cur.x + dx, cur.y + 1, cur.z + dz) && !T_SOLID[world.getId(cur.x, cur.y + 2, cur.z)]) ny = cur.y + 1;
      else for (let d = 1; d <= 3 && ny === null; d++) if (walk(cur.x + dx, cur.y - d, cur.z + dz) && !T_SOLID[world.getId(cur.x + dx, cur.y - d + 2, cur.z + dz)]) ny = cur.y - d;
      if (ny === null) continue;
      const k = key(cur.x + dx, ny, cur.z + dz);
      const g = cur.g + (diag ? 1.414 : 1) + Math.abs(ny - cur.y) * 0.6;
      if (seen.has(k) && seen.get(k) <= g) continue;
      seen.set(k, g);
      open.push({ x: cur.x + dx, y: ny, z: cur.z + dz, g, f: g + Math.abs(cur.x + dx - tx) + Math.abs(cur.z + dz - tz), p: cur });
    }
  }
  const path = [];
  for (let c = best; c && c.p; c = c.p) path.push(c);
  return path.reverse();
}

const Creatures = {
  list: [], spawnT: 1, enabled: true,
  reset() { for (const c of this.list) c.dispose(); this.list = []; },
  spawn(type, x, y, z, seed) { const c = new Creature(type, x, y, z, seed); this.list.push(c); return c; },
  count(hostile) { return this.list.reduce((a, c) => a + (c.spec.hostile === hostile && c.state !== 'dying' ? 1 : 0), 0); },
  standable(world, x, z, nearY, range = 24) {
    for (let y = Math.min(WORLD_H - 3, Math.floor(nearY) + range); y > Math.max(2, Math.floor(nearY) - range); y--) {
      const below = world.getId(x, y - 1, z);
      if (T_SOLID[below] && !T_SOLID[world.getId(x, y, z)] && !T_SOLID[world.getId(x, y + 1, z)] && world.getId(x, y, z) !== B.water && world.getId(x, y, z) !== B.lava) return { y, below };
    }
    return null;
  },
  trySpawn(world, player, night) {
    const a = Math.random() * 6.283;
    const wantHostile = this.count(true) < (night > 0.6 ? 5 : 3) && Math.random() < (night > 0.6 ? 0.4 : 0.22) && player.mode === 'survival';
    const d = wantHostile ? 17 + Math.random() * 26 : 20 + Math.random() * 38;
    const x = Math.floor(player.pos.x + Math.cos(a) * d), z = Math.floor(player.pos.z + Math.sin(a) * d);
    if (!world.isLoaded(x, z)) return;
    if (wantHostile) {
      const underground = player.pos.y < world.surfaceY(Math.floor(player.pos.x), Math.floor(player.pos.z)) - 5;
      const fromY = !underground && night > 0.6 && Math.random() < 0.9 ? world.surfaceY(x, z) + 1 : player.pos.y + (Math.random() - 0.5) * 12;
      const s = this.standable(world, x, z, fromY, 10);
      if (!s || T_KIND[s.below] === KIND.leaves) return;
      const l = world.getLight(x, s.y, z);
      const dark = Math.max(l[0], l[1], l[2]) < 0.28 && (l[3] < 0.3 || night > 0.65);
      if (!dark) return;
      this.spawn(Math.random() < 0.68 ? 'gloamstalker' : 'hollowlantern', x + 0.5, s.y, z + 0.5);
      return;
    }
    if (this.count(false) >= 14 || night > 0.5) return;
    const sy = world.surfaceY(x, z) + 1;
    const s = this.standable(world, x, z, sy, 6);
    if (!s || s.y < SEA) return;
    const col = world.gen.col(x, z);
    if (![B.grass, B.forest_floor, B.snowy_grass, B.snow, B.moss_block, B.mud, B.sand].includes(s.below)) return;
    let type = null;
    if (col.biome === BIOME.SWAMP || col.biome === BIOME.BEACH) type = 'reedstrider';
    else if (col.biome === BIOME.MEADOW) type = Math.random() < 0.55 ? 'mossback' : Math.random() < 0.7 ? 'plumehare' : 'reedstrider';
    else if (col.biome === BIOME.FOREST || col.biome === BIOME.GROVE) type = Math.random() < 0.5 ? 'plumehare' : 'mossback';
    else if (col.biome === BIOME.TAIGA || col.biome === BIOME.MOUNTAIN) type = Math.random() < 0.65 ? 'mossback' : 'plumehare';
    else if (col.biome === BIOME.DESERT) type = Math.random() < 0.25 ? 'plumehare' : null;
    if (!type) return;
    const herd = SPECIES[type].herd ? 3 + Math.floor(Math.random() * 3) : type === 'reedstrider' ? 2 : 1;
    for (let i = 0; i < herd && this.count(false) < 14; i++) {
      const hx = x + Math.floor((Math.random() - 0.5) * 7), hz = z + Math.floor((Math.random() - 0.5) * 7);
      const hs = this.standable(world, hx, hz, s.y, 4);
      if (hs) this.spawn(type, hx + 0.5, hs.y, hz + 0.5);
    }
  },
  update(dt, t, game) {
    const world = game.world, player = game.player;
    if (this.enabled) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = 1.1; this.trySpawn(world, player, U.uNight.value); }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      const dp = c.pos.distanceTo(player.pos);
      if (c.spec.hostile && c.state !== 'dying') c.lostT = dp > 30 || Math.abs(c.pos.y - player.pos.y) > 9 ? (c.lostT || 0) + dt : 0;
      if (dp > 96 || c.pos.y < -10 || (c.lostT > 18 && dp > 16)) { c.dispose(); this.list.splice(i, 1); continue; }
      if (!world.isLoaded(Math.floor(c.pos.x), Math.floor(c.pos.z))) continue;
      this.think(c, dt, game, dp);
      const l = world.getLight(Math.floor(c.pos.x), c.pos.y + c.spec.h * 0.6, Math.floor(c.pos.z));
      c.light.x = lerp(c.light.x, l[0], 0.12); c.light.y = lerp(c.light.y, l[1], 0.12); c.light.z = lerp(c.light.z, l[2], 0.12); c.light.w = lerp(c.light.w, l[3], 0.12);
      c.updateBones(t); c.syncMesh();
      const vis = dp < Q.viewDist * 16; c.mesh.visible = vis; c.shadow.visible = vis && dp < 48;
      if (c.state === 'dying' && c.stateT > 1.4) {
        for (const [k, lo, hi] of c.spec.drops) { const n = lo + Math.floor(Math.random() * (hi - lo + 1)); if (n > 0) Entities.spawnDrop(k, n, V3(c.pos.x, c.pos.y + 0.6, c.pos.z)); }
        c.dispose(); this.list.splice(i, 1);
      }
    }
  },
  think(c, dt, game, dp) {
    const world = game.world, player = game.player, S = c.spec;
    c.stateT += dt; c.timer -= dt; c.hitT = Math.max(0, c.hitT - dt); c.cooldown -= dt; c.soundT -= dt;
    const setState = (s, timer) => { c.state = s; c.stateT = 0; if (timer !== undefined) c.timer = timer; };
    let wish = null, speed = 0, faceTo = null;
    if (c.soundT <= 0 && c.state !== 'dying') { c.soundT = (S.hostile ? 4 : 9) + Math.random() * 10; if (dp < 28) Audio.creature(S.sound, c.pos, 0.6); }
    if (c.state === 'dying') {
      if (c.stateT > 0.5 && Math.random() < dt * 30) Effects.ember(V3(c.pos.x + (Math.random() - 0.5), c.pos.y + Math.random() * 0.8, c.pos.z + (Math.random() - 0.5)), S.hostile ? [1, 0.42, 0.1] : [0.9, 0.9, 0.8]);
    } else if (!S.hostile) {
      const scared = c.state === 'flee';
      if (!scared && S.shy && dp < S.shy && !player.crouching && player.mode === 'survival') { setState('flee', 3 + Math.random() * 2); c.fleeFrom = player.pos.clone(); }
      if (c.state === 'flee') {
        const away = V3().subVectors(c.pos, c.fleeFrom || player.pos); away.y = 0; away.normalize();
        wish = V3(away.x + Math.sin(c.stateT * 2.3 + c.seed) * 0.55, 0, away.z + Math.cos(c.stateT * 1.9 + c.seed) * 0.55).normalize(); speed = S.run;
        if (c.timer <= 0) setState('idle', 2);
      } else if (c.state === 'wander') {
        if (c.target) { const to = V3(c.target.x - c.pos.x, 0, c.target.z - c.pos.z); if (to.length() < 0.8) setState(Math.random() < 0.65 ? 'graze' : 'idle', 3 + Math.random() * 6); else { wish = to.normalize(); speed = S.speed; } }
        if (c.timer <= 0) setState('idle', 1 + Math.random() * 3);
      } else if (c.timer <= 0) {
        if (c.state === 'idle' && Math.random() < 0.4) setState('graze', 3 + Math.random() * 5);
        else {
          let tx = c.pos.x + (Math.random() - 0.5) * 16, tz = c.pos.z + (Math.random() - 0.5) * 16;
          if (S.herd) {
            // drift toward the centre of the herd
            let sx = 0, sz = 0, n = 0;
            for (const o of this.list) if (o !== c && o.type === c.type && o.pos.distanceTo(c.pos) < 24) { sx += o.pos.x; sz += o.pos.z; n++; }
            if (n) { tx = lerp(tx, sx / n + (Math.random() - 0.5) * 7, 0.6); tz = lerp(tz, sz / n + (Math.random() - 0.5) * 7, 0.6); }
          }
          c.target = V3(tx, c.pos.y, tz); setState('wander', 8);
        }
      }
      c.graze = lerp(c.graze, c.state === 'graze' ? 1 : 0, 1 - Math.exp(-dt * 3.5));
    } else {
      const canSee = !player.dead && player.mode === 'survival' && dp < (U.uNight.value > 0.6 ? 40 : 24);
      const toP = V3(player.pos.x - c.pos.x, 0, player.pos.z - c.pos.z); const flat = toP.length() || 1e-3; toP.divideScalar(flat);
      const dyP = player.pos.y - c.pos.y;
      // daylight burns them away
      const l = c.light;
      if (U.uNight.value < 0.3 && l.w > 0.92 && U.uRain.value < 0.3) { c.sun = (c.sun || 0) + dt; if (c.sun > 3) { c.health -= dt * 5; if (Math.random() < dt * 14) Effects.ember(V3(c.pos.x, c.pos.y + Math.random() * S.h, c.pos.z), [1, 0.5, 0.12]); if (c.health <= 0) setState('dying'); } } else c.sun = 0;
      if (c.state === 'windup') {
        faceTo = toP;
        if (c.stateT > (S.floating ? 0.75 : 0.62)) { setState('lunge'); c.hasHit = false; c.vel.x = toP.x * (S.floating ? 8.5 : 7.2); c.vel.z = toP.z * (S.floating ? 8.5 : 7.2); if (!S.floating) c.vel.y = 4.6; else c.vel.y = clamp(dyP, -3, 3) * 2; Audio.creature(S.floating ? 'dash' : 'snarl', c.pos, 1); }
      } else if (c.state === 'lunge') {
        faceTo = toP;
        if (!c.hasHit && flat < 1.25 && Math.abs(dyP) < 1.7) { c.hasHit = true; game.damagePlayer(S.damage, c.pos); }
        if (c.stateT > 0.42) { setState('recover'); }
      } else if (c.state === 'recover') {
        faceTo = toP;
        if (c.stateT > 0.85) setState('chase');
      } else if (c.state === 'stagger') {
        if (c.stateT > 0.35) setState('chase');
      } else if (canSee) {
        if (c.state !== 'chase') setState('chase');
        if (flat < S.reach && Math.abs(dyP) < 1.8 && c.cooldown <= 0) { setState('windup'); c.cooldown = 1.9; Audio.creature(S.floating ? 'charge' : 'hiss', c.pos, 1); }
        else if (flat > S.reach * 0.6) {
          speed = S.run;
          if (S.floating) wish = toP;
          else {
            c.pathT -= dt;
            if (c.pathT <= 0 && dp < 26) { c.pathT = 0.7 + Math.random() * 0.3; c.path = findPath(world, Math.floor(c.pos.x), Math.floor(c.pos.y + 0.1), Math.floor(c.pos.z), Math.floor(player.pos.x), Math.floor(player.pos.y + 0.1), Math.floor(player.pos.z)); }
            while (c.path && c.path.length && Math.hypot(c.path[0].x + 0.5 - c.pos.x, c.path[0].z + 0.5 - c.pos.z) < 0.55) c.path.shift();
            if (c.path && c.path.length) { const n = c.path[0]; wish = V3(n.x + 0.5 - c.pos.x, 0, n.z + 0.5 - c.pos.z).normalize(); if (n.y > Math.floor(c.pos.y + 0.1) && c.onGround) c.vel.y = 7.6; } else wish = toP;
          }
        }
        faceTo = wish || toP;
      } else {
        if (c.timer <= 0) { c.target = V3(c.pos.x + (Math.random() - 0.5) * 14, c.pos.y, c.pos.z + (Math.random() - 0.5) * 14); setState(Math.random() < 0.6 ? 'wander' : 'idle', 2 + Math.random() * 4); }
        if (c.state === 'wander' && c.target) { const to = V3(c.target.x - c.pos.x, 0, c.target.z - c.pos.z); if (to.length() > 0.8) { wish = to.normalize(); speed = S.speed; } }
      }
    }
    // steering and physics
    const inWater = world.getId(Math.floor(c.pos.x), Math.floor(c.pos.y + 0.3), Math.floor(c.pos.z)) === B.water;
    const lunging = c.state === 'lunge' || c.state === 'stagger';
    if (!lunging) {
      const tvx = wish ? wish.x * speed : 0, tvz = wish ? wish.z * speed : 0;
      const k = 1 - Math.exp(-dt * (c.onGround || S.floating ? 7 : 1.5));
      c.vel.x += (tvx - c.vel.x) * k; c.vel.z += (tvz - c.vel.z) * k;
    }
    if (!S.hostile && wish && c.onGround) {
      // do not walk off ledges or into water
      const ax = Math.floor(c.pos.x + wish.x * 0.9), az = Math.floor(c.pos.z + wish.z * 0.9), ay = Math.floor(c.pos.y + 0.1);
      let ground = false; for (let d = 0; d <= 2; d++) if (T_SOLID[world.getId(ax, ay - d, az)]) ground = true;
      const wet = c.type !== 'reedstrider' && world.getId(ax, ay - 1, az) === B.water;
      if ((!ground || wet) && c.state !== 'flee') { c.vel.x = 0; c.vel.z = 0; c.timer = 0; c.state = 'idle'; }
    }
    if (S.floating) {
      let ground = null;
      for (let d = 0; d < 6; d++) if (T_SOLID[world.getId(Math.floor(c.pos.x), Math.floor(c.pos.y) - d, Math.floor(c.pos.z))]) { ground = Math.floor(c.pos.y) - d + 1; break; }
      const want = ground === null ? c.pos.y - 1 : ground + 0.12;
      if (c.state !== 'lunge') c.vel.y += ((want - c.pos.y) * 5 - c.vel.y) * (1 - Math.exp(-dt * 4));
    } else {
      c.vel.y -= (inWater ? 6 : 26) * dt;
      if (inWater) { c.vel.y = Math.max(c.vel.y, -2); c.vel.y += 12 * dt; c.vel.x *= 0.94; c.vel.z *= 0.94; }
    }
    const res = moveBody(world, c.pos, c.vel, dt, Math.min(S.w, 0.45), S.h, 0.6, c.onGround);
    c.onGround = res.ground;
    if ((res.wallX || res.wallZ) && wish && c.onGround && !S.floating) c.vel.y = 7.4;
    if ((res.wallX || res.wallZ) && S.floating) c.vel.y = 3;
    c.speedNow = lerp(c.speedNow, Math.hypot(c.vel.x, c.vel.z), 1 - Math.exp(-dt * 8));
    c.gait += dt * (S.hop ? 7.5 : 1) * (S.hop ? clamp(c.speedNow / 2, 0, 1.6) : c.speedNow * (c.type === 'mossback' ? 3.6 : c.type === 'reedstrider' ? 3.9 : 3.0));
    const face = faceTo || (wish && speed > 0 ? wish : null);
    if (face) { const want = Math.atan2(face.x, face.z); let d = want - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); c.yaw += d * (1 - Math.exp(-dt * 7)); }
    if (world.getId(Math.floor(c.pos.x), Math.floor(c.pos.y + 0.2), Math.floor(c.pos.z)) === B.lava && c.state !== 'dying') { c.health -= dt * 12; c.hitT = 0.2; if (c.health <= 0) { c.state = 'dying'; c.stateT = 0; } }
  },
  // returns the nearest creature whose body the ray crosses
  raycast(origin, dir, maxDist) {
    let best = null, bt = maxDist;
    for (const c of this.list) {
      if (c.state === 'dying') continue;
      const w = c.spec.w + 0.12;
      const hit = rayBox(origin, dir, c.pos.x - w, c.pos.y + (c.spec.floating ? 0.5 : 0), c.pos.z - w, c.pos.x + w, c.pos.y + c.spec.h, c.pos.z + w);
      if (hit && hit.t < bt) { bt = hit.t; best = c; }
    }
    return best ? { creature: best, t: bt } : null;
  },
  damage(c, amount, from) {
    if (c.state === 'dying') return;
    c.health -= amount; c.hitT = 0.3;
    const away = V3(c.pos.x - from.x, 0, c.pos.z - from.z).normalize();
    c.vel.x = away.x * 6.4; c.vel.z = away.z * 6.4; c.vel.y = Math.max(c.vel.y, 4.6); c.onGround = false;
    Audio.creature('hurt', c.pos, 1);
    if (c.health <= 0) { c.state = 'dying'; c.stateT = 0; Audio.creature('death', c.pos, 1); }
    else if (c.spec.hostile) {
      const now = performance.now() / 1000;
      if (c.state !== 'lunge' && now - (c.staggeredAt || 0) > 2.2) { c.state = 'stagger'; c.stateT = 0; c.staggeredAt = now; }
      else { c.vel.x *= 0.4; c.vel.z *= 0.4; c.vel.y = Math.min(c.vel.y, 2); c.cooldown = Math.min(c.cooldown, 0.15); }
    }
    else { c.state = 'flee'; c.stateT = 0; c.timer = 4 + Math.random() * 2; c.fleeFrom = from.clone(); for (const o of this.list) if (o !== c && o.type === c.type && o.pos.distanceTo(c.pos) < 12) { o.state = 'flee'; o.stateT = 0; o.timer = 3 + Math.random() * 2; o.fleeFrom = from.clone(); } }
  },
};

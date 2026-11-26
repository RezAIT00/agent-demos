// Cathedral skeleton for one bay, in sheet coordinates (z, s). Each tube: [z0,s0,z1,s1, r0,r1,h,kind]
const TUBES = (() => {
  const W = PROF.W, HW = PROF.HW, S1 = W + HW, SR = S1 + 35, mir = s => 2 * SR - s;
  const L = [], S = [];
  const both = (a, f) => { f.push(a); f.push([a[0], mir(a[1]), a[2], mir(a[3]), a[4], a[5], a[6], a[7]]); };
  // clustered shafts at the column line z=7
  const sh = [[-1.25, .30, .30], [-.68, .85, .36], [0, 1.15, .52], [.68, .85, .36], [1.25, .30, .30]];
  for (const [dz, h, r] of sh) both([7 + dz, W + .2, 7 + dz, S1 + .5, r, r * .95, h, 1], L);
  // fan ribs
  [-7, -5.2, -3.5, -1.75, 0, 1.75, 3.5, 5.2, 7].forEach(d => { const k = Math.abs(d) / 7; both([7 + d * .10, S1 - .5, 7 + d, SR, .30 - .10 * k, .17, .62 - .30 * k, 2], L); });
  both([7, S1, 7, SR, .55, .45, .55, 2], L); // transverse arch
  L.push([-7, SR, 7, SR, .34, .34, .25, 2]);
  for (const ds of [15, 25]) both([-7, S1 + ds, 7, S1 + ds, .12, .12, .22, 2], L);
  // string courses
  for (const y of [1.8, 29.4]) both([-7, W + y, 7, W + y, .26, .26, .15, 1], L);
  // plinths + capitals
  both([7 - 1.5, W + .6, 7 + 1.5, W + .6, .85, .85, .55, 1], S); both([7 - 1.35, S1 - 1.0, 7 + 1.35, S1 - 1.0, .42, .42, .75, 1], S); both([7 - 1.2, S1 + .1, 7 + 1.2, S1 + .1, .30, .30, .95, 1], S); both([7, W + .1, 7, W + 2.2, 1.25, .75, .6, 1], S);
  // window frames
  const hw = 5.5, spr = 19.5, R = 8.4, ar = (cx, cy, r, a0, a1, n, th, h) => { for (let i = 0; i < n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180, b = (a0 + (a1 - a0) * (i + 1.06) / n) * Math.PI / 180; both([cx + r * Math.cos(a), W + cy + r * Math.sin(a), cx + r * Math.cos(b), W + cy + r * Math.sin(b), th, th, h, 1], S); } };
  for (const sg of [-1, 1]) { both([sg * hw, W + 2.2, sg * hw, W + spr, .26, .26, .18, 1], S); both([sg * (hw + .55), W + 2.2, sg * (hw + .55), W + spr, .20, .20, .42, 1], S); }
  ar(hw - R, spr, R, 0, 70, 7, .26, .18); ar(R - hw, spr, R, 180, 110, 7, .26, .18); ar(hw - R, spr, R + .6, 0, 71, 7, .20, .42); ar(R - hw, spr, R + .6, 180, 109, 7, .20, .42);
  for (const x of [-hw / 3, hw / 3]) both([x, W + 2.2, x, W + 16.6, .13, .13, .14, 1], S);
  for (const x of [-2 * hw / 3, 0, 2 * hw / 3]) ar(x, 15.2, hw / 3, 0, 180, 6, .11, .13);
  ar(0, 22.6, 2.38, 0, 360, 14, .16, .16); ar(-2.75, 18.6, 1.58, 0, 360, 11, .12, .14); ar(2.75, 18.6, 1.58, 0, 360, 11, .12, .14);
  for (let i = 0; i < 8; i++) { const a = (i + .5) * Math.PI / 4; both([.75 * Math.cos(a), W + 22.6 + .75 * Math.sin(a), 2.3 * Math.cos(a), W + 22.6 + 2.3 * Math.sin(a), .08, .08, .12, 1], S); }
  ar(0, 22.6, .75, 0, 360, 8, .08, .12);
  const pack = [...L, ...S], data = new Float32Array(pack.length * 8); pack.forEach((a, i) => data.set(a, i * 8));
  return { data, nL: L.length, nS: S.length };
})();

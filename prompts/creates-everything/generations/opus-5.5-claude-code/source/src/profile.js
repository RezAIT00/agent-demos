// The sheet. One continuous cross-section curve, parameterised by arc length s, whose heading angle is
// integrated. stage a: 0 = flat sea, 1 = barrel of height wave.height, 2 = gothic nave. Every vertex in the
// film lives on this sheet, so sea -> barrel -> cathedral is a single uninterrupted deformation.
const PROF = (() => {
  const NS = 2048, NA = 129, S0 = -120, DS = 0.25, R = V_HEIGHT / 2; // <- wave.height drives the curl radius
  const W = 18, HW = 30, GB = 1.15, GR = 35 / GB;               // nave half width, wall height, arch angle + radius
  const LA = 1.5 * Math.PI * R;                                 // barrel arc length (270 deg)
  const S_TIP = 152, data = new Float32Array(NS * NA * 4);
  const rad = Math.PI / 180;
  const bar = (s, a) => s < 0 ? 0 : 270 * rad * a * Math.min(1, s / LA);
  const goth = s => { // smoothed corners
    const ss = (x, w) => sstep(-w, w, x);
    let f = 0; f += 90 * rad * ss(s - W, .8); const q1 = clamp((s - (W + HW)) / 35), q2 = clamp((s - (W + HW + 35)) / 35);
    f += GB * q1; f += (180 * rad - 2 * GB) * ss(s - (W + HW + 35), .6); f += GB * q2; return f;
  };
  for (let ia = 0; ia < NA; ia++) {
    const a = ia / (NA - 1) * 2, b = clamp(a - 1), ab = Math.min(a, 1);
    let X = S0, Y = 0; const hb = [];
    for (let i = 0; i < NS; i++) {
      const s = S0 + i * DS; let phi;
      if (s <= S_TIP) phi = lerp(bar(s, ab), goth(s), b);
      else { // back of the wave: wrap round the tip and run down to sea level
        const lip = lerp(bar(S_TIP, ab), goth(S_TIP), b), q = clamp((s - S_TIP) / 150), tip = sstep(0, 2.5, s - S_TIP);
        const turn = 180 * rad * sstep(.05, .35, ab);
        const h0 = lip - turn * tip, hmid = -38 * rad * sstep(0, .3, ab); phi = lerp(h0, hmid, sstep(0, .75, q)); phi = lerp(phi, 0, sstep(.75, 1, q));
      }
      const o = (ia * NS + i) * 4; data[o] = X - s; data[o + 1] = Y; data[o + 2] = phi; data[o + 3] = 0; hb.push(Y);
      X += Math.cos(phi) * DS; Y += Math.sin(phi) * DS;
    }
    // bring the back down to y=0 at s = S_TIP+150 and fade the horizontal shift away
    const iTip = Math.round((S_TIP - S0) / DS), iEnd = Math.round((S_TIP + 150 - S0) / DS), yEnd = data[(ia * NS + iEnd) * 4 + 1];
    for (let i = iTip; i < NS; i++) { const k = clamp((i - iTip) / (iEnd - iTip)); data[(ia * NS + i) * 4 + 1] -= yEnd * Math.pow(k, .8); if (i >= iEnd) data[(ia * NS + i) * 4 + 1] = 0; if (i > iEnd) data[(ia * NS + i) * 4] *= 1 - sstep(0, 1, (i - iEnd) / (NS - 1 - iEnd)); }
  }
  return { NS, NA, S0, DS, R, W, HW, GB, GR, S_TIP, data, APEX: HW + GR * Math.sin(GB) };
})();

// ---------------------------------------------------------------- the mitten
// World units are millimetres. Our flake lands at the origin on the back of the
// hand; the fingers point toward -z.
const MIT = {
  stitchW: 2.7, rowH: 1.95, loopH: 3.15, swing: 0.262, depth: 0.88, plyOff: 0.205, plyR: 0.295, twist: 3.5,
  patchX: 40, patchZ0: -49, patchZ1: 42,
  keyW: new THREE.Vector3(-0.58, 0.66, 0.47).normalize(),
  rimW: new THREE.Vector3(0.62, 0.30, -0.72).normalize(),
};

// the same ragged ellipse bounds the real yarn here and in the body shader
function patchRadius(x, z) {
  return Math.hypot(x / MIT.patchX, (z + 3) / 45) + 0.055 * Math.sin(x * 0.41 + z * 0.13) * Math.sin(z * 0.33 - x * 0.09) + 0.03 * Math.sin(x * 0.97) * Math.sin(z * 0.83);
}

function sdCap(px, pz, ax, az, ar, bx, bz, br) {
  const abx = bx - ax, abz = bz - az;
  const h = clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz), 0, 1);
  return Math.hypot(px - ax - abx * h, pz - az - abz * h) - lerp(ar, br, h);
}
function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); }
function mittenSD(x, z) {
  const hand = sdCap(x, z, 2, -44, 47, 0, 54, 39);
  const thumb = sdCap(x, z, -27, 44, 22, -68, -2, 15);
  const qx = Math.abs(x) - 31, qz = Math.abs(z - 94) - 26;
  const cuff = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - 8;
  return smin(smin(hand, thumb, 7), cuff, 9);
}
function mittenY(x, z) {
  const inside = -mittenSD(x, z);
  const u = clamp(inside / 36, 0, 1);
  let y = -1.62 - 24 * (1 - Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))));
  // the crease where the thumb joins the hand
  const crease = sdCap(x, z, -42, -6, 0, -34, 50, 0);
  y -= 4.2 * Math.exp(-crease * crease / 14) * sstep(0, 9, inside);
  const cuff = sstep(66, 74, z);
  y += cuff * (1.5 * Math.abs(Math.cos(x * Math.PI / 6.4)) - 0.4) - 2.4 * Math.exp(-((z - 69) ** 2) / 5);
  return y;
}

const WOOL_LIGHT = `
uniform vec3 uKeyW, uRimW, uKeyWCol, uRimWCol, uAmb;
uniform sampler2D uShadowTex, uHeroH;
uniform mat4 uHeroInv;
uniform vec3 uHeroP, uHeroN;
uniform float uHeroOn, uDetail;
float flakeShadow(vec3 wp){
  vec2 lp = wp.xz + uKeyW.xz/uKeyW.y*(0.2 - wp.y);
  float stat = textureLod(uShadowTex, lp/80.0 + 0.5, clamp(-wp.y*0.8, 0.0, 3.0) + 1.0).r;
  float sh = 1.0 - 0.52*clamp(stat, 0.0, 1.0);
  if (uHeroOn > 0.5) {
    float den = dot(uKeyW, uHeroN);
    if (abs(den) > 0.05) {
      float d = dot(uHeroP - wp, uHeroN)/den;
      if (d > 0.0) {
        vec4 loc = uHeroInv*vec4(wp + uKeyW*d, 1.0);
        if (max(abs(loc.x), abs(loc.y)) < 1.0) sh *= 1.0 - 0.60*textureLod(uHeroH, loc.xy*0.5 + 0.5, 2.0 + d*1.3).g*exp(-d*0.11);
      }
    }
    float up = dot(uHeroP - wp, uHeroN)/max(uHeroN.y, 0.2);
    if (up > -0.2) {
      vec4 loc = uHeroInv*vec4(wp + vec3(0.0, up, 0.0), 1.0);
      if (max(abs(loc.x), abs(loc.y)) < 1.0) sh *= 1.0 - 0.45*textureLod(uHeroH, loc.xy*0.5 + 0.5, 3.6).g*smoothstep(3.0, 0.1, up);
    }
  }
  return sh;
}
`;

function woolUniforms(mit) {
  const names = ['uKeyW', 'uRimW', 'uKeyWCol', 'uRimWCol', 'uAmb', 'uShadowTex', 'uHeroH', 'uHeroInv', 'uHeroP', 'uHeroN', 'uHeroOn', 'uDetail'];
  const u = {};
  names.forEach((n) => { u[n] = mit.uniforms[n]; });
  return u;
}

function buildBody(mit) {
  const step = 0.85, x0 = -94, x1 = 58, z0 = -100, z1 = 130;
  const nx = Math.ceil((x1 - x0) / step) + 1, nz = Math.ceil((z1 - z0) / step) + 1;
  const pos = [], ok = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let x = x0 + i * step, z = z0 + j * step;
    let d = mittenSD(x, z);
    ok[j * nx + i] = d < 1.3 ? 1 : 0;
    if (d > 0 && d < 1.4) {
      const gx = mittenSD(x + 0.1, z) - mittenSD(x - 0.1, z), gz = mittenSD(x, z + 0.1) - mittenSD(x, z - 0.1);
      const gl = Math.hypot(gx, gz) || 1;
      x -= gx / gl * d; z -= gz / gl * d;
    }
    pos.push(x, mittenY(x, z), z);
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (ok[a] && ok[c] && ok[b]) idx.push(a, c, b);
    if (ok[b] && ok[c] && ok[d]) idx.push(b, c, d);
  }
  // the underside, mirrored through the rim, closes the shape with round edges
  const topCount = pos.length / 3, topTris = idx.length;
  for (let v = 0; v < topCount; v++) {
    const rim = -25.62;
    pos.push(pos[v * 3], rim - Math.max(0, pos[v * 3 + 1] - rim) * 0.75 - 0.02, pos[v * 3 + 2]);
  }
  for (let t = 0; t < topTris; t += 3) idx.push(idx[t] + topCount, idx[t + 2] + topCount, idx[t + 1] + topCount);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.DoubleSide, uniforms: woolUniforms(mit),
    vertexShader: `out vec3 vW; out vec3 vN; void main(){ vW = position; vN = normal; gl_Position = projectionMatrix*viewMatrix*vec4(position,1.0); }`,
    fragmentShader: `precision highp float; in vec3 vW; in vec3 vN; out vec4 o; ${GLSL_NOISE} ${WOOL_LIGHT}
      float knit(vec2 p){
        if (p.y > 69.0) { float r = abs(cos(p.x*3.14159/6.4)); return r*0.5 + 0.5*pow(abs(sin(p.x*3.14159/1.6)), 0.6)*r + 0.12*sin(p.y*3.3); }
        float sx = p.x/${MIT.stitchW.toFixed(2)}, fu = fract(sx);
        float sz = p.y/${MIT.rowH.toFixed(2)};
        float lx = abs(fu - 0.5);                        // 0 centre .. 0.5 edge
        float fv = fract(sz + (lx - 0.25)*1.15);
        float leg = max(0.0, 1.0 - pow((lx - 0.23)/0.23, 2.0));
        return sqrt(leg)*(0.45 + 0.55*pow(sin(3.14159*fv), 0.5));
      }
      void main(){
        vec3 n = normalize(vN); if (n.y < 0.0 && dot(n, cameraPosition - vW) < 0.0) n = -n;
        float fw = length(fwidth(vW.xz));
        float amp = 1.0 - smoothstep(0.45, 1.7, fw);
        vec2 e = vec2(0.09, 0.0);
        float h = knit(vW.xz);
        vec2 gr = vec2(knit(vW.xz + e.xy) - knit(vW.xz - e.xy), knit(vW.xz + e.yx) - knit(vW.xz - e.yx))/0.18;
        vec3 fz = vec3(vnoise(vW*5.5) - 0.5, 0.0, vnoise(vW*5.5 + 9.0) - 0.5);
        n = normalize(n + vec3(-gr.x, 0.0, -gr.y)*0.55*amp + fz*0.9*amp);
        float heather = vnoise(vW*1.9) * 0.6 + vnoise(vW*0.31)*0.4 + (vnoise(vW*4.3) - 0.5)*0.35*amp;
        vec3 albedo = mix(vec3(0.0115,0.0140,0.0225), vec3(0.030,0.034,0.046), smoothstep(0.45, 0.85, heather));
        float ao = mix(0.47, 0.05 + 0.82*h, amp);
        float pr = length(vec2(vW.x/40.0, (vW.z + 3.0)/45.0)) + 0.055*sin(vW.x*0.41 + vW.z*0.13)*sin(vW.z*0.33 - vW.x*0.09) + 0.03*sin(vW.x*0.97)*sin(vW.z*0.83);
        float inPatch = 1.0 - smoothstep(0.74, 0.865, pr);
        ao *= mix(1.0, 0.42, inPatch*uDetail);
        vec3 V = normalize(cameraPosition - vW);
        float sh = flakeShadow(vW);
        float k = max((dot(n, uKeyW) + 0.30)/1.30, 0.0), r = max((dot(n, uRimW) + 0.35)/1.35, 0.0);
        albedo *= mix(1.75, 0.97, uDetail);
        vec3 col = albedo*(uAmb*(0.65 + 0.35*n.y) + uKeyWCol*k*sh + uRimWCol*r*r*mix(0.8, 0.22, uDetail))*ao;
        float graze = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 2.2);
        col += graze*(uKeyWCol*0.006 + uRimWCol*mix(0.024, 0.008, uDetail)*max(0.55 + dot(-V, uRimW), 0.0) + uAmb*0.035);
        o = vec4(max(col, vec3(0.0)), 1.0);
      }`,
  });
  return new THREE.Mesh(g, mat);
}

function buildYarn(mit) {
  const NS = 26, RING = 7, TAU = Math.PI * 2;
  const noise = makeNoise2(88);
  const P = [], N = [], T = [], D = [], idx = [], roots = [];
  const y00 = mittenY(0, 0);
  const rowMin = Math.ceil(MIT.patchZ0 / MIT.rowH), rowMax = Math.floor((MIT.patchZ1 + MIT.loopH) / MIT.rowH);
  for (let row = rowMin; row <= rowMax; row++) {
    const zr = row * MIT.rowH;
    const th0 = Math.floor(-MIT.patchX / MIT.stitchW) * TAU, th1 = Math.ceil(MIT.patchX / MIT.stitchW) * TAU;
    const n = Math.round((th1 - th0) / TAU * NS) + 1;
    const C = [], S = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const th = th0 + (i / (n - 1)) * (th1 - th0);
      let x = MIT.stitchW * (th / TAU + MIT.swing * Math.sin(2 * th));
      let z = zr - MIT.loopH * (1 - Math.cos(th)) / 2 + 0.9;
      let y = MIT.depth * (1 - Math.cos(2 * th)) / 2 - MIT.depth - 0.62;
      x += 0.34 * (noise.n(th * 0.23 + row * 7.3, row * 1.7) - 0.5);
      z += 0.38 * (noise.n(th * 0.19 + row * 3.1, 9 + row) - 0.5);
      y += 0.34 * (noise.n(th * 0.31, row * 5.9) - 0.5);
      const edge = sstep(0.80, 1.02, patchRadius(x, z));
      y += mittenY(x, z) - y00 - 2.3 * edge;
      C.push(new THREE.Vector3(x, y, z));
      if (i) S[i] = S[i - 1] + C[i].distanceTo(C[i - 1]);
    }
    for (let ply = 0; ply < 3; ply++) {
      const centres = [], outs = [];
      const phase = ply * TAU / 3 + row * 1.3;
      for (let i = 0; i < n; i++) {
        const tang = C[Math.min(n - 1, i + 1)].clone().sub(C[Math.max(0, i - 1)]).normalize();
        const side = new THREE.Vector3(0, 1, 0).cross(tang).normalize();
        const bin = tang.clone().cross(side).normalize();
        const phi = phase + S[i] / MIT.twist * TAU;
        const swell = 1 + 0.22 * (noise.n(S[i] * 0.8 + ply * 13, row * 2.3) - 0.5);
        const out = side.multiplyScalar(Math.cos(phi)).addScaledVector(bin, Math.sin(phi));
        outs.push(out);
        centres.push(C[i].clone().addScaledVector(out, MIT.plyOff * swell));
      }
      const start = P.length / 3;
      for (let i = 0; i < n; i++) {
        const tp = centres[Math.min(n - 1, i + 1)].clone().sub(centres[Math.max(0, i - 1)]).normalize();
        const e1 = outs[i].clone().addScaledVector(tp, -outs[i].dot(tp)).normalize();
        const e2 = tp.clone().cross(e1);
        const rad = MIT.plyR * (1 + 0.16 * (noise.n(S[i] * 2.3, row * 11 + ply) - 0.5));
        const heather = noise.n(S[i] * 0.45 + ply * 5.1, row * 3.7 + ply);
        for (let k = 0; k < RING; k++) {
          const a = k / RING * TAU;
          const nx = e1.x * Math.cos(a) + e2.x * Math.sin(a), ny = e1.y * Math.cos(a) + e2.y * Math.sin(a), nz = e1.z * Math.cos(a) + e2.z * Math.sin(a);
          const vx = centres[i].x + nx * rad, vy = centres[i].y + ny * rad, vz = centres[i].z + nz * rad;
          const rel = vy - (mittenY(centres[i].x, centres[i].z) - y00);
          const ao = clamp(0.12 + 0.88 * sstep(-2.2, -0.2, rel), 0, 1) * (0.16 + 0.84 * Math.pow(0.5 + 0.5 * Math.cos(a), 1.15));
          P.push(vx, vy, vz); N.push(nx, ny, nz); T.push(tp.x, tp.y, tp.z); D.push(ao, heather);
          if (ny > -0.15 && i > 0 && i < n - 1) roots.push([vx, vy, vz, nx, ny, nz, tp.x, tp.y, tp.z, heather]);
        }
      }
      for (let i = 0; i < n - 1; i++) for (let k = 0; k < RING; k++) {
        const a = start + i * RING + k, b = start + i * RING + (k + 1) % RING, c = a + RING, d = b + RING;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aTan', new THREE.Float32BufferAttribute(T, 3));
  g.setAttribute('aData', new THREE.Float32BufferAttribute(D, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.DoubleSide, uniforms: woolUniforms(mit), alphaToCoverage: true,
    vertexShader: `in vec3 aTan; in vec2 aData; out vec3 vW; out vec3 vN; out vec3 vT; out vec2 vD;
      void main(){ vW = position; vN = normal; vT = aTan; vD = aData; gl_Position = projectionMatrix*viewMatrix*vec4(position,1.0); }`,
    fragmentShader: `precision highp float; in vec3 vW; in vec3 vN; in vec3 vT; in vec2 vD; out vec4 o; ${GLSL_NOISE} ${WOOL_LIGHT}
      void main(){
        vec3 n = normalize(vN), T = normalize(vT), V = normalize(cameraPosition - vW);
        float fw = length(fwidth(vW));
        float fine = 1.0 - smoothstep(0.03, 0.13, fw);
        // filaments combed along the ply
        vec3 q = vW - T*dot(vW, T)*0.93;
        float s1 = vnoise(q*24.0), s2 = vnoise(q*51.0 + 7.0);
        vec3 bend = vec3(vnoise(q*19.0 + 3.0), vnoise(q*19.0 + 11.0), vnoise(q*19.0 + 23.0)) - 0.5;
        bend -= T*dot(bend, T);
        n = normalize(n + bend*1.35*fine);
        float strand = mix(0.5, s1*0.62 + s2*0.38, fine);
        vec3 albedo = mix(vec3(0.0112,0.0135,0.0215), vec3(0.036,0.040,0.052), smoothstep(0.42, 0.80, vD.y));
        albedo = mix(albedo, vec3(0.085,0.062,0.052), smoothstep(0.72, 0.86, s2)*smoothstep(0.55, 0.75, vnoise(vW*2.4))*fine);
        albedo *= 0.25 + 1.55*strand;
        // far away the loops average out: match the knit drawn on the rest of the mitten
        float farK = smoothstep(0.07, 0.45, fw);
        float ao = mix(clamp(vD.x, 0.0, 1.0), 0.50, farK);
        albedo *= mix(1.0, 1.25, farK);
        n = normalize(mix(n, vec3(0.0, 1.0, 0.0), farK*0.75));
        float sh = flakeShadow(vW);
        float k = max((dot(n, uKeyW) + 0.28)/1.28, 0.0), r = max((dot(n, uRimW) + 0.30)/1.30, 0.0);
        vec3 col = albedo*(uAmb*(0.62 + 0.38*n.y) + uKeyWCol*k*sh + uRimWCol*r*r*0.85)*ao;
        vec3 H = normalize(uKeyW + V);
        float th = dot(normalize(T + n*0.35), H);
        col += uKeyWCol*pow(max(1.0 - th*th, 0.0), 22.0)*0.0070*ao*sh*(0.4 + strand);
        float graze = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.4);
        col += graze*ao*(uRimWCol*0.030*max(0.45 + dot(-V, uRimW), 0.0) + uKeyWCol*0.006 + uAmb*0.03);
        o = vec4(max(col, vec3(0.0)), uDetail);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return { mesh, roots, positions: P };
}

// Highest wool at (x,z): used to rest flakes on the fibres instead of floating.
function makeHeightMap(positions) {
  const cell = 0.3, ext = 34, n = Math.ceil(ext * 2 / cell);
  const map = new Float32Array(n * n).fill(-9);
  for (let i = 0; i < positions.length; i += 3) {
    const gx = Math.floor((positions[i] + ext) / cell), gz = Math.floor((positions[i + 2] + ext) / cell);
    if (gx < 0 || gz < 0 || gx >= n || gz >= n) continue;
    const k = gz * n + gx;
    if (positions[i + 1] > map[k]) map[k] = positions[i + 1];
  }
  return (x, z) => {
    const gx = Math.floor((x + ext) / cell), gz = Math.floor((z + ext) / cell);
    let best = -9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const i = gx + a, j = gz + b;
      if (i >= 0 && j >= 0 && i < n && j < n) best = Math.max(best, map[j * n + i]);
    }
    return best < -8 ? mittenY(x, z) + 1.3 : best;
  };
}

function fibreGeometry(segments) {
  const base = [];
  for (let s = 0; s < segments; s++) {
    const a = s / segments, b = (s + 1) / segments;
    base.push(a, -1, 0, a, 1, 0, b, 1, 0, a, -1, 0, b, 1, 0, b, -1, 0);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(base, 3));
  return g;
}

function buildFibres(mit, roots, clearances) {
  const rnd = makeRng(4242);
  const R = [], M = [], E = [], I = [];
  const v = new THREE.Vector3();
  const addFibre = (px, py, pz, nx, ny, nz, tx, ty, tz, len, width, heather, kind) => {
    const sgn = rnd() < 0.5 ? -1 : 1;
    v.set(nx * 0.85 + tx * sgn * 0.65 + (rnd() - 0.5) * 1.5, ny * 0.85 + ty * sgn * 0.65 + (rnd() - 0.5) * 1.1 + 0.12, nz * 0.85 + tz * sgn * 0.65 + (rnd() - 0.5) * 1.5).normalize();
    const mx = px + v.x * len * 0.55, my = py + v.y * len * 0.55, mz = pz + v.z * len * 0.55;
    let ex = mx + (v.x + (rnd() - 0.5) * 1.7) * len * 0.45, ey = my + (v.y + (rnd() - 0.65) * 1.3) * len * 0.45, ez = mz + (v.z + (rnd() - 0.5) * 1.7) * len * 0.45;
    let myy = my;
    // keep the fuzz under the crystals that rest on it (a few strays cross over)
    if (kind === 0 && rnd() > 0.012) {
      for (const c of clearances) {
        const dx = ex - c.x, dz = ez - c.z;
        if (dx * dx + dz * dz < c.r * c.r) { ey = Math.min(ey, c.y - 0.07); myy = Math.min(myy, c.y - 0.05); }
      }
    }
    R.push(px, py, pz); M.push(mx, myy, mz); E.push(ex, ey, ez);
    I.push(width, rnd(), heather, kind);
  };
  const want = 330000;
  let guard = 0;
  while (R.length / 3 < want && guard++ < want * 12) {
    const q = roots[Math.floor(rnd() * roots.length)];
    const d = Math.hypot(q[0], q[2] + 3);
    const keep = d < 9 ? 1 : d < 17 ? 0.55 : d < 26 ? 0.27 : 0.13;
    if (rnd() > keep) continue;
    const stray = rnd() < 0.025;
    const len = stray ? 1.2 + 1.5 * rnd() : 0.13 + 0.85 * Math.pow(rnd(), 2.4);
    addFibre(q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8], len, (stray ? 0.007 : 0.0085) + 0.013 * rnd() * rnd(), q[9], 0);
  }
  // halo of fuzz round the outline, which is what makes the shape read as wool
  let made = 0; guard = 0;
  while (made < 36000 && guard++ < 4e6) {
    const x = -94 + rnd() * 152, z = -100 + rnd() * 230;
    const s = mittenSD(x, z);
    if (s > 0 || s < -5.5) continue;
    const gx = mittenSD(x + 0.2, z) - mittenSD(x - 0.2, z), gz = mittenSD(x, z + 0.2) - mittenSD(x, z - 0.2);
    const gl = Math.hypot(gx, gz) || 1;
    addFibre(x, mittenY(x, z), z, gx / gl * 0.9, 0.5, gz / gl * 0.9, -gz / gl, 0, gx / gl, 1.2 + 3.4 * rnd() * rnd(), 0.06 + 0.07 * rnd(), rnd(), 1);
    made++;
  }
  const g = fibreGeometry(5);
  g.setAttribute('aRoot', new THREE.InstancedBufferAttribute(new Float32Array(R), 3));
  g.setAttribute('aMid', new THREE.InstancedBufferAttribute(new Float32Array(M), 3));
  g.setAttribute('aEnd', new THREE.InstancedBufferAttribute(new Float32Array(E), 3));
  g.setAttribute('aInfo', new THREE.InstancedBufferAttribute(new Float32Array(I), 4));
  g.instanceCount = R.length / 3;
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.DoubleSide, alphaToCoverage: true,
    uniforms: Object.assign({ uPxAngle: { value: 0.0002 } }, woolUniforms(mit)),
    vertexShader: `
      in vec3 aRoot; in vec3 aMid; in vec3 aEnd; in vec4 aInfo; uniform float uPxAngle;
      out vec3 vW; out vec3 vT; out float vAlpha; out float vS; out vec4 vInfo; out float vAcross;
      void main(){
        float t = position.x, u = 1.0 - t;
        vec3 p = aRoot*u*u + aMid*2.0*u*t + aEnd*t*t;
        vec3 d = (aMid - aRoot)*2.0*u + (aEnd - aMid)*2.0*t;
        d = normalize(d + 1e-5);
        vec3 toCam = cameraPosition - p; float dist = length(toCam);
        vec3 side = normalize(cross(d, toCam) + 1e-5);
        float w = aInfo.x*(1.0 - 0.72*t);
        float wd = max(w, dist*uPxAngle*1.35);
        p += side*position.y*wd*0.5;
        vW = p; vT = d; vS = t; vInfo = aInfo; vAlpha = clamp(w/wd, 0.0, 1.0); vAcross = position.y;
        gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
      }`,
    fragmentShader: `precision highp float; in vec3 vW; in vec3 vT; in float vAlpha; in float vS; in vec4 vInfo; in float vAcross; out vec4 o; ${GLSL_NOISE} ${WOOL_LIGHT}
      void main(){
        vec3 T = normalize(vT), V = normalize(cameraPosition - vW);
        float hue = fract(vInfo.y*7.31);
        vec3 albedo = mix(vec3(0.026,0.031,0.048), vec3(0.088,0.096,0.122), smoothstep(0.45, 0.82, vInfo.z));
        if (hue > 0.93) albedo = vec3(0.24,0.25,0.29); else if (hue > 0.885) albedo = vec3(0.16,0.075,0.050);
        float sh = flakeShadow(vW);
        float tl = dot(T, uKeyW), sinTL = sqrt(max(0.0, 1.0 - tl*tl));
        float tr = dot(T, uRimW), sinTR = sqrt(max(0.0, 1.0 - tr*tr));
        float along = clamp(vS, 0.0, 1.0), across = clamp(vAcross, -1.0, 1.0);
        float ao = 0.34 + 0.66*smoothstep(0.0, 0.7, along);
        if (vInfo.w < 0.5) ao *= smoothstep(-2.6, -0.5, vW.y)*0.75 + 0.25;
        float round_ = 0.72 + 0.28*(1.0 - across*across);
        vec3 col = albedo*(uAmb*0.9 + uKeyWCol*sinTL*0.62*sh + uRimWCol*sinTR*0.30)*ao*round_;
        vec3 H = normalize(uKeyW + V); float th = dot(T, H);
        col += uKeyWCol*pow(max(1.0 - th*th, 0.0), 45.0)*0.018*ao*sh;
        // warm light threading forward through the fibres
        float fwd = pow(max(dot(-V, uRimW)*0.5 + 0.5, 0.0), 3.0);
        col += uRimWCol*sinTR*fwd*(0.045 + 0.05*along)*ao*(0.35 + 0.65*step(0.55, fract(vInfo.y*3.7)));
        o = vec4(max(col, vec3(0.0)), clamp(vAlpha, 0.0, 1.0)*(0.55 + 0.45*(1.0 - along*along))*(vInfo.w < 0.5 ? uDetail : 1.0));
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// crumbs of broken snow caught in the fuzz
function buildGrains(mit, heightAt, clearances) {
  const rnd = makeRng(99);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: woolUniforms(mit),
    vertexShader: `out vec3 vW; void main(){ vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `precision highp float; in vec3 vW; out vec4 o; ${GLSL_NOISE} ${WOOL_LIGHT}
      void main(){
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); vec3 V = normalize(cameraPosition - vW); if (dot(n,V) < 0.0) n = -n;
        vec3 col = uAmb*0.42 + uKeyWCol*0.045*max(dot(n,uKeyW)+0.3, 0.0) + uRimWCol*0.07*max(dot(n,uRimW)+0.5, 0.0);
        col += uKeyWCol*pow(max(dot(reflect(-V,n), uKeyW),0.0), 40.0)*1.3;
        o = vec4(max(col, vec3(0.0)), 1.0);
      }`,
  });
  const count = 360;
  const im = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let n = 0, guard = 0;
  while (n < count && guard++ < 20000) {
    const a = rnd() * Math.PI * 2, r = 2.4 + 26 * Math.pow(rnd(), 1.25);
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 4;
    const s = 0.012 + 0.048 * Math.pow(rnd(), 3.0);
    if (clearances.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r * 0.9) ** 2)) continue;
    e.set(rnd() * 6, rnd() * 6, rnd() * 6); q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.5 + rnd() * 0.12, z), q, new THREE.Vector3(s * (0.8 + rnd()), s * 0.8, s));
    im.setMatrixAt(n++, m);
  }
  im.count = n;
  im.frustumCulled = false;
  return im;
}

function buildSleeve(mit) {
  const rings = 150, seg = 96;
  const pos = [], idx = [], info = [];
  const p0 = new THREE.Vector3(1, -27, 112), p1 = new THREE.Vector3(14, -62, 190), p2 = new THREE.Vector3(185, -185, 205);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const c = p0.clone().multiplyScalar((1 - u) * (1 - u)).addScaledVector(p1, 2 * u * (1 - u)).addScaledVector(p2, u * u);
    const tg = p1.clone().sub(p0).multiplyScalar(2 * (1 - u)).addScaledVector(p2.clone().sub(p1), 2 * u).normalize();
    const side = up.clone().cross(tg).normalize(), top = tg.clone().cross(side).normalize();
    // ribbed storm cuff, then puffed quilt channels
    const cuff = 1 - sstep(0.085, 0.105, u);
    const channel = Math.pow(Math.abs(Math.sin((u - 0.1) * Math.PI * 7.0)), 0.38);
    const puff = lerp(36.5 + 4.6 * channel + 6 * u, 38.5, cuff);
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const wr = 1 + (1 - cuff) * 0.022 * Math.sin(a * 6 + u * 29) * Math.sin(u * 37 + a * 3);
      const q = c.clone().addScaledVector(side, Math.cos(a) * puff * wr).addScaledVector(top, Math.sin(a) * puff * 0.66 * wr);
      pos.push(q.x, q.y, q.z);
      info.push(cuff, channel, a);
    }
  }
  for (let i = 0; i < rings; i++) for (let k = 0; k < seg; k++) {
    const a = i * (seg + 1) + k, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.DoubleSide, uniforms: woolUniforms(mit),
    vertexShader: `in vec3 aInfo; out vec3 vW; out vec3 vN; out vec3 vI; void main(){ vW = position; vN = normal; vI = aInfo; gl_Position = projectionMatrix*viewMatrix*vec4(position,1.0); }`,
    fragmentShader: `precision highp float; in vec3 vW; in vec3 vN; in vec3 vI; out vec4 o; ${GLSL_NOISE} ${WOOL_LIGHT}
      void main(){
        vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vW); if (dot(n, V) < 0.0) n = -n;
        vec3 fine = vec3(vnoise(vW*0.8), vnoise(vW*0.8+3.0), vnoise(vW*0.8+5.0)) - 0.5;
        n = normalize(n + fine*0.18);
        vec3 shell = vec3(0.050,0.0115,0.0135)*(0.9 + 0.2*vnoise(vW*0.3));
        vec3 ribbed = vec3(0.008,0.012,0.018)*(0.55 + 0.75*abs(sin(vI.z*70.0)));
        vec3 albedo = mix(shell, ribbed, vI.x);
        float seam = mix(0.35 + 0.65*smoothstep(0.05, 0.75, vI.y), 1.0, vI.x);
        float k = max((dot(n,uKeyW) + 0.35)/1.35, 0.0), r = max((dot(n,uRimW) + 0.3)/1.3, 0.0);
        vec3 col = albedo*(uAmb*1.2 + uKeyWCol*k + uRimWCol*r*1.1)*seam;
        vec3 H = normalize(uRimW + V);
        col += (uRimWCol*0.045*pow(max(dot(n, H), 0.0), 18.0) + uKeyWCol*0.020*pow(max(dot(n, normalize(uKeyW + V)), 0.0), 14.0))*(1.0 - vI.x);
        float dust = smoothstep(0.66, 0.84, vnoise(vW*0.42)*0.6 + vnoise(vW*1.6)*0.4)*smoothstep(0.3, 0.9, n.y);
        col = mix(col, uAmb*0.60 + uKeyWCol*0.10*k + uRimWCol*0.05*r, dust*0.75);
        col += pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0)*(uRimWCol*0.040 + uAmb*0.055);
        o = vec4(max(col, vec3(0.0)), 1.0);
      }`,
  });
  return new THREE.Mesh(g, mat);
}

// powder lying over the whole mitten: what reads as snow while it is still far
function buildDusting(mit) {
  const rnd = makeRng(321);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: woolUniforms(mit),
    vertexShader: `in float aInner; uniform float uDetail; out vec3 vW; void main(){ vec3 p = position*(1.0 - aInner*smoothstep(0.25, 0.95, uDetail)); vec4 w = modelMatrix*instanceMatrix*vec4(p,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `precision highp float; in vec3 vW; out vec4 o; ${GLSL_NOISE} ${WOOL_LIGHT}
      void main(){
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); vec3 V = normalize(cameraPosition - vW); if (dot(n,V) < 0.0) n = -n;
        o = vec4(uAmb*0.42 + uKeyWCol*0.045*max(dot(n,uKeyW)+0.3, 0.0) + uRimWCol*0.055*max(dot(n,uRimW)+0.5, 0.0), 1.0);
      }`,
  });
  const count = 2300;
  const inner = new Float32Array(count);
  const im = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let n = 0, guard = 0;
  while (n < count && guard++ < 60000) {
    const x = -90 + rnd() * 145, z = -96 + rnd() * 160;
    if (mittenSD(x, z) > -1.5) continue;
    if (Math.hypot(x, z) < 7) continue;
    const onYarn = patchRadius(x, z) < 0.96;
    inner[n] = onYarn ? 1 : 0;
    const s = 0.16 + 0.52 * Math.pow(rnd(), 3.0);
    e.set(rnd() * 6, rnd() * 6, rnd() * 6); q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, mittenY(x, z) + (onYarn ? 1.6 : 0.8) + s * 0.2, z), q, new THREE.Vector3(s, s * 0.45, s));
    im.setMatrixAt(n++, m);
  }
  geo.setAttribute('aInner', new THREE.InstancedBufferAttribute(inner, 1));
  im.count = n;
  im.frustumCulled = false;
  return im;
}

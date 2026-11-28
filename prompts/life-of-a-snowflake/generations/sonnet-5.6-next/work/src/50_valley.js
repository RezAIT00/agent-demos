// ---------------------------------------------------------------- valley at dusk
function makeNoise2(seed) {
  const perm = new Float32Array(1024);
  const rnd = makeRng(seed);
  for (let i = 0; i < 1024; i++) perm[i] = rnd();
  const at = (x, y) => perm[((x * 157 + y * 311) & 1023 ^ ((x * 31 + y * 17) >> 5)) & 1023];
  const n = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(at(ix, iy), at(ix + 1, iy), u), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), u), v);
  };
  const fbm = (x, y, o) => { let a = 0.5, s = 0; for (let i = 0; i < o; i++) { s += a * n(x, y); x = x * 2.03 + 11.3; y = y * 2.03 + 7.1; a *= 0.5; } return s; };
  const ridged = (x, y, o) => { let a = 0.5, s = 0; for (let i = 0; i < o; i++) { const r = 1 - Math.abs(n(x, y) * 2 - 1); s += a * r * r; x = x * 2.1 + 5.2; y = y * 2.1 + 1.3; a *= 0.5; } return s; };
  return { n, fbm, ridged };
}

const VN = makeNoise2(1234);
const meander = (z) => 85 * Math.sin(z / 330 + 0.7) + 38 * Math.sin(z / 137 + 2.1);
const riverX = (z) => meander(z) + 22 * Math.sin(z / 71);
function valleyHeight(x, z) {
  const d = Math.abs(x - meander(z));
  const wall = sstep(55, 520, d);
  let h = VN.fbm(x / 140, z / 140, 4) * 11 - 4;
  h += Math.pow(wall, 1.25) * (150 + 190 * VN.fbm(x / 420 + 3, z / 420, 4));
  h += wall * 85 * VN.ridged(x / 260, z / 260, 4);
  const far = sstep(1500, 2900, -z);
  const gap = 0.38 + 0.62 * sstep(60, 700, Math.abs(x - 230));
  h += far * gap * (60 + 520 * VN.ridged(x / 900 + 1.7, z / 900, 5));
  h += sstep(3300, 4800, -z) * (80 + 300 * VN.ridged(x / 700, z / 650 + 4, 5)) * gap;
  const rd = Math.abs(x - riverX(z));
  if (rd < 34 && z > -2100) h = lerp(-3.2, h, sstep(9, 34, rd));
  return h;
}

const VALLEY_COMMON = `
uniform vec3 uSunDir;
${GLSL_NOISE}
vec3 skyColour(vec3 d){
  float az = max(dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz)), 0.0);
  float e = max(d.y, 0.0);
  vec3 horizon = mix(vec3(0.115,0.120,0.205), vec3(0.98,0.43,0.20), pow(az, 5.0));
  horizon = mix(horizon, vec3(0.42,0.20,0.25), pow(az, 1.6)*(1.0 - pow(az, 5.0))*0.85);
  vec3 mid = mix(vec3(0.070,0.100,0.215), vec3(0.30,0.22,0.34), pow(az, 3.0));
  vec3 top = vec3(0.012,0.027,0.080);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.16, e));
  col = mix(col, top, smoothstep(0.12, 0.60, e));
  col += vec3(1.0,0.50,0.20)*pow(max(dot(normalize(d), uSunDir), 0.0), 90.0)*0.85;
  return col;
}
vec3 haze(vec3 col, vec3 wp, vec3 cam){
  vec3 d = wp - cam; float dist = length(d); d /= dist;
  float mistLow = exp(-max(wp.y, 0.0)/70.0);
  float f = 1.0 - exp(-dist*(0.00017 + 0.00040*mistLow));
  vec3 h = skyColour(normalize(vec3(d.x, 0.015, d.z)))*0.80 + vec3(0.008,0.014,0.032);
  return mix(col, h, clamp(f, 0.0, 1.0));
}
vec3 snowLight(vec3 n, float shade){
  vec3 sky = mix(vec3(0.055,0.062,0.095), vec3(0.150,0.215,0.390), clamp(n.y*0.65 + 0.35, 0.0, 1.0));
  float sun = clamp(dot(n, normalize(uSunDir + vec3(0.0, 0.16, 0.0))), 0.0, 1.0);
  return (sky*(0.9 + 0.35*n.y) + vec3(1.00,0.47,0.30)*pow(sun, 1.4)*0.62*shade)*0.74;
}
`;

function makeValley() {
  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(0.20, 0.035, -1).normalize();
  const shared = { uSunDir: { value: sunDir }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 } };

  const sky = new THREE.Mesh(new THREE.SphereGeometry(12000, 64, 32), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.BackSide, depthWrite: false, uniforms: shared,
    vertexShader: `out vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `precision highp float; in vec3 vD; out vec4 o; uniform float uTime; ${VALLEY_COMMON}
      void main(){
        vec3 d = normalize(vD);
        vec3 col = skyColour(d);
        float e = d.y;
        // long thin bars of cloud catching the last light
        float s = fbm3(vec3(d.x*3.2 + uTime*0.01, e*34.0, d.z*3.2));
        float bars = smoothstep(0.54, 0.76, s)*smoothstep(0.015, 0.05, e)*smoothstep(0.24, 0.08, e);
        float az = max(dot(normalize(d.xz), normalize(uSunDir.xz)), 0.0);
        col = mix(col, mix(vec3(0.070,0.070,0.130), vec3(0.95,0.40,0.28), pow(az, 4.0)*smoothstep(0.17, 0.04, e)), bars*0.80);
        // the base of the cloud we have just dropped out of
        float base = smoothstep(0.075, 0.30, e + (fbm3(vec3(d.x*2.2, e*5.0, d.z*2.2 + uTime*0.02)) - 0.5)*0.24);
        float lump = fbm3(vec3(d.x*5.5, e*11.0, d.z*5.5 + uTime*0.03));
        vec3 under = mix(vec3(0.030,0.040,0.078), vec3(0.105,0.115,0.185), smoothstep(0.35, 0.75, lump));
        under += vec3(0.60,0.21,0.14)*pow(az, 3.0)*smoothstep(0.30, 0.09, e)*(0.25 + 0.75*smoothstep(0.62, 0.30, lump));
        col = mix(col, under, base*0.94);
        o = vec4(col, 1.0);
      }`,
  }));
  scene.add(sky);

  // terrain: dense near the camera, coarse toward the mountains
  const NX = 460, NZ = 560;
  const geo = new THREE.PlaneGeometry(1, 1, NX, NZ);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) + 0.5;
    const z = 260 - Math.pow(v, 1.55) * 5600;
    const x = Math.sign(u) * Math.pow(Math.abs(u), 1.35) * (900 + Math.max(0, -z) * 0.62);
    p.setXYZ(i, x, valleyHeight(x, z), z);
  }
  geo.computeVertexNormals();
  if (geo.attributes.normal.getY(Math.floor(p.count / 2)) < 0) {
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    geo.computeVertexNormals();
  }
  const terrain = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: shared, side: THREE.DoubleSide,
    vertexShader: `out vec3 vW; out vec3 vN; void main(){ vW = position; vN = normal; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `precision highp float; in vec3 vW; in vec3 vN; out vec4 o; uniform vec3 uCam; ${VALLEY_COMMON}
      float riverCentre(float z){ return 85.0*sin(z/330.0 + 0.7) + 38.0*sin(z/137.0 + 2.1) + 22.0*sin(z/71.0); }
      void main(){
        vec3 n = normalize(vN); if (n.y < 0.0) n = -n;
        vec3 bump = vec3(fbm3(vW*0.055) - 0.5, 0.0, fbm3(vW*0.055 + 31.0) - 0.5);
        n = normalize(n + bump*0.55);
        float rock = smoothstep(0.74, 0.52, n.y + (fbm3(vW*0.018) - 0.5)*0.45)*smoothstep(40.0, 160.0, vW.y);
        vec3 snow = snowLight(n, 0.55 + 0.45*smoothstep(0.3, 0.7, fbm3(vW*0.006)));
        vec3 col = mix(snow, vec3(0.030,0.034,0.050) + snow*0.10, rock);
        // distant forest as a dark stipple where individual trees are too small
        float wood = smoothstep(0.47, 0.62, fbm3(vW*0.0085))*smoothstep(0.55, 0.80, n.y)*smoothstep(330.0, 230.0, vW.y)*smoothstep(5.0, 22.0, vW.y);
        float farness = smoothstep(1300.0, 2300.0, length(vW - uCam));
        col = mix(col, vec3(0.012,0.022,0.032) + 0.10*snow*vnoise(vW*0.13), wood*farness*0.9);
        float rd = abs(vW.x - riverCentre(vW.z));
        float bankW = 6.0 + 15.0*smoothstep(0.30, 0.75, fbm3(vec3(vW.z*0.0105, 7.0, 0.0)));
        float river = (1.0 - smoothstep(bankW, bankW + 4.0, rd + (fbm3(vW*0.060) - 0.5)*17.0))*step(-2100.0, vW.z)*step(vW.y, 2.4);
        if (river > 0.0) {
          vec3 V = normalize(vW - uCam);
          vec3 wn = normalize(vec3((fbm3(vW*0.22) - 0.5)*0.09, 1.0, (fbm3(vW*0.17 + 9.0) - 0.5)*0.09));
          vec3 R = reflect(V, wn); R.y = abs(R.y);
          // snow-covered ice with a narrow dark lead of open water winding down it
          // glazed ice: a cool sheen with wind-blown drifts across it
          float glaze = smoothstep(0.34, 0.66, fbm3(vW*vec3(0.085, 0.085, 0.030)));
          vec3 sheet = mix(snow*0.96, vec3(0.040, 0.098, 0.165) + skyColour(normalize(vec3(R.x, R.y + 0.2, R.z)))*0.22, glaze);
          float wide = 2.2 + 6.5*fbm3(vec3(vW.z*0.017, 3.0, 0.0));
          float lead = 1.0 - smoothstep(wide*0.7, wide*1.25, abs(vW.x - riverCentre(vW.z) - 3.2*sin(vW.z/23.0)) + (fbm3(vW*0.11) - 0.5)*6.5);
          lead *= smoothstep(0.42, 0.56, fbm3(vW*vec3(0.020, 0.020, 0.024) + 4.0));
          vec3 water = vec3(0.007, 0.024, 0.050) + skyColour(normalize(vec3(-R.x*0.3, R.y + 0.65, R.z*0.2)))*0.30;
          water += vec3(0.35, 0.46, 0.62)*smoothstep(0.74, 0.92, vnoise(vW*vec3(0.55, 0.5, 0.10)))*0.22;
          vec3 ice = mix(sheet, water, lead);
          col = mix(col, ice, river);
        }
        o = vec4(haze(col, vW, uCam), 1.0);
      }`,
  }));
  scene.add(terrain);

  // pines: stacked ragged tiers with snow lying on the boughs
  const treeGeo = (() => {
    const V = [], T = [];
    const rnd = makeRng(31);
    const tri = (a, b, c, ta, tb, tc) => { V.push(...a, ...b, ...c); T.push(ta, tb, tc); };
    const tiers = 9;
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers;
      const y0 = 0.10 + f * 0.82, r = 0.235 * (1 - f * 0.86) * (0.88 + 0.24 * rnd()), apex = y0 + 0.17 * (1 - f * 0.45);
      const seg = 13;
      for (let s = 0; s < seg; s++) {
        const a0 = (s / seg) * Math.PI * 2 + i * 1.7, a1 = ((s + 1) / seg) * Math.PI * 2 + i * 1.7, am = (a0 + a1) / 2;
        const rr = r * (0.9 + 0.3 * rnd());
        const tip = [Math.cos(am) * rr, y0 - 0.035 * rnd() - 0.012, Math.sin(am) * rr];
        const l = [Math.cos(a0) * r * 0.52, y0 + 0.022, Math.sin(a0) * r * 0.52], rt = [Math.cos(a1) * r * 0.52, y0 + 0.022, Math.sin(a1) * r * 0.52];
        const top = [0, apex, 0];
        tri(top, tip, l, 0.15, 1, 0.55); tri(top, rt, tip, 0.15, 0.55, 1);
      }
    }
    for (let s = 0; s < 6; s++) {
      const a0 = (s / 6) * Math.PI * 2, a1 = ((s + 1) / 6) * Math.PI * 2;
      tri([Math.cos(a0) * 0.022, -0.03, Math.sin(a0) * 0.022], [Math.cos(a1) * 0.022, -0.03, Math.sin(a1) * 0.022], [0, 0.4, 0], -1, -1, -1);
    }
    tri([-0.018, 0.9, 0], [0.018, 0.9, 0], [0, 1.03, 0], 0.2, 0.2, 0.2);
    tri([0.018, 0.9, 0], [-0.018, 0.9, 0], [0, 1.03, 0], 0.2, 0.2, 0.2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
    g.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
    g.computeVertexNormals();
    return g;
  })();
  const trees = [];
  const rnd = makeRng(2024);
  const cabinZ = -430, cabinX = riverX(cabinZ) + 46;
  const addBand = (zNear, zFar, step, maxN) => {
    let n = 0;
    for (let z = zNear; z > zFar && n < maxN; z -= step) {
      const halfW = 520 + Math.max(0, -z) * 0.45;
      for (let x = -halfW; x < halfW; x += step) {
        const px = x + (rnd() - 0.5) * step * 1.5, pz = z + (rnd() - 0.5) * step * 1.5;
        const y = valleyHeight(px, pz);
        const grove = VN.fbm(px / 115 + 9, pz / 115, 3);
        const rd = Math.abs(px - riverX(pz));
        if (rd < 19 || y > 300 + 60 * VN.n(px / 90, pz / 90)) continue;
        const want = sstep(0.40, 0.56, grove) + (rd < 42 && VN.n(px / 40, pz / 40) > 0.55 ? 0.8 : 0);
        if (rnd() > want) continue;
        if (Math.hypot(px - cabinX, pz - cabinZ) < 26) continue;
        trees.push([px, y - 1.2, pz, (9 + 15 * rnd() * rnd() + 4 * grove), rnd()]);
        n++;
      }
    }
  };
  addBand(150, -700, 7.2, 24000);
  addBand(-700, -1500, 10.5, 16000);
  addBand(-1500, -2500, 15, 12000);
  const inst = new THREE.InstancedMesh(treeGeo, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: shared, side: THREE.DoubleSide,
    vertexShader: `in float aTip; out vec3 vW; out vec3 vN; out float vTip; out float vId;
      void main(){ vec4 w = instanceMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(instanceMatrix)*normal); vTip = aTip;
        vId = fract(instanceMatrix[3].x*0.137 + instanceMatrix[3].z*0.071); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `precision highp float; in vec3 vW; in vec3 vN; in float vTip; in float vId; out vec4 o; uniform vec3 uCam; ${VALLEY_COMMON}
      void main(){
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 needle = vec3(0.0045,0.0125,0.0135)*(0.65 + 0.8*vId);
        float sunW = clamp(dot(n, normalize(uSunDir + vec3(0.0,0.2,0.0))), 0.0, 1.0);
        vec3 col = needle*(1.0 + 1.6*clamp(n.y, 0.0, 1.0)) + vec3(0.045,0.016,0.008)*sunW;
        float load = smoothstep(0.50, 0.78, abs(n.y)*0.55 + vnoise(vW*1.35)*0.62)*smoothstep(0.20, 0.62, vTip)*(0.45 + 0.55*smoothstep(0.1, 0.5, vId));
        col = mix(col, snowLight(normalize(vec3(n.x, abs(n.y) + 0.35, n.z)), 0.8)*0.80, load*0.88);
        if (vTip < 0.0) col = vec3(0.006,0.005,0.006);
        o = vec4(haze(col, vW, uCam), 1.0);
      }`,
  }), trees.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  trees.forEach((t, i) => {
    q.setFromAxisAngle(up, t[4] * Math.PI * 2);
    m.compose(new THREE.Vector3(t[0], t[1], t[2]), q, new THREE.Vector3(t[3] * (0.85 + 0.3 * t[4]), t[3], t[3] * (0.85 + 0.3 * t[4])));
    inst.setMatrixAt(i, m);
  });
  inst.frustumCulled = false;
  scene.add(inst);

  // one cabin with its lamps lit
  const cabin = new THREE.Group();
  const base = valleyHeight(cabinX, cabinZ);
  const flat = (col) => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.DoubleSide, uniforms: Object.assign({ uCol: { value: new THREE.Vector3(...col) } }, shared),
    vertexShader: `out vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `precision highp float; in vec3 vW; out vec4 o; uniform vec3 uCol, uCam; ${VALLEY_COMMON} void main(){ o = vec4(haze(uCol, vW, uCam), 1.0); }`,
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(17, 8, 11), flat([0.030, 0.015, 0.011])); box.position.y = 4; cabin.add(box);
  // two roof slopes pitched about the ridge, which runs along the house
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(19.6, 0.9, 8.8), flat(side > 0 ? [0.235, 0.255, 0.355] : [0.125, 0.165, 0.280]));
    slope.position.set(0, 10.7, side * 3.35); slope.rotation.x = side * 0.70; cabin.add(slope);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(19.8, 0.55, 0.55), flat([0.012, 0.008, 0.008]));
    eave.position.set(0, 7.85, side * 6.75); cabin.add(eave);
  }
  const gableShape = new THREE.Shape(); gableShape.moveTo(-5.5, 0); gableShape.lineTo(0, 4.9); gableShape.lineTo(5.5, 0); gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 16.9, bevelEnabled: false }); gableGeo.rotateY(Math.PI / 2); gableGeo.translate(-8.45, 8, 0);
  cabin.add(new THREE.Mesh(gableGeo, flat([0.036, 0.018, 0.012])));
  for (const [wx, wy] of [[-5.0, 4.1], [0.8, 4.1], [4.9, 4.1]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.3), flat([4.8, 2.1, 0.52])); w.position.set(wx, wy, 5.56); cabin.add(w);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.3), flat([0.03, 0.015, 0.01])); bar.position.set(wx, wy, 5.60); cabin.add(bar);
  }
  // lamplight spilling onto the snow, fading out softly
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `out vec2 vUv; void main(){ vUv = uv*2.0 - 1.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; void main(){ float a = max(exp(-dot(vUv,vUv)*3.4) - 0.034, 0.0); o = vec4(vec3(0.30,0.125,0.035)*a, 1.0); }`,
  }));
  spill.rotation.x = -Math.PI / 2; spill.position.set(0, 1.4, 12.5); cabin.add(spill);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(1.8, 6, 1.8), flat([0.03, 0.02, 0.022])); chim.position.set(5, 12, 0); cabin.add(chim);
  cabin.position.set(cabinX, base + 0.6, cabinZ); cabin.rotation.y = 0.52; cabin.scale.setScalar(1.18);
  scene.add(cabin);

  const smoke = new THREE.Group();
  const puffMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, uniforms: shared,
    vertexShader: `out vec2 vUv; out float vA; void main(){ vUv = uv*2.0 - 1.0; vA = instanceMatrix[1][3] ; vec4 mv = modelViewMatrix*vec4(instanceMatrix[3].xyz, 1.0); mv.xy += position.xy*instanceMatrix[0][0]; gl_Position = projectionMatrix*mv; vA = instanceMatrix[3].y; }`,
    fragmentShader: `precision highp float; in vec2 vUv; in float vA; out vec4 o; void main(){ float a = exp(-dot(vUv,vUv)*2.6) - 0.07; if (a <= 0.0) discard; o = vec4(0.19,0.18,0.26, a*0.15*(1.0 - 0.0*vA)); }`,
  });
  const puffs = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), puffMat, 18);
  puffs.frustumCulled = false;
  smoke.add(puffs);
  scene.add(smoke);

  const camera = new THREE.PerspectiveCamera(46, 1, 2, 30000);
  return {
    scene, camera, shared, treeCount: trees.length,
    update(t) {
      shared.uTime.value = t;
      shared.uCam.value.copy(camera.position);
      for (let i = 0; i < 18; i++) {
        const ph = (t * 0.11 + i / 18) % 1;
        const s = 2.6 + ph * 11;
        m.makeScale(s, s, s);
        m.setPosition(cabinX + 6 + ph * ph * 46 + Math.sin(i * 9.1) * 3 * ph, base + 18.5 + ph * 24, cabinZ - 3 + Math.cos(i * 5.7) * 3 * ph);
        puffs.setMatrixAt(i, m);
      }
      puffs.instanceMatrix.needsUpdate = true;
    },
  };
}

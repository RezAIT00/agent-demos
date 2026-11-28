// ───────────────────────────── renderer ─────────────────────────────
const OUT = RENDER_MODE ? 1080 : Math.max(360, Math.min(1080, Math.round(Math.min(innerWidth, innerHeight) * Math.min(devicePixelRatio, 1.5))));
const SS = RENDER_MODE ? Number(QS.get('ss') || 2) : 1;
const RES = OUT * SS;
const SAMPLES = RENDER_MODE ? Number(QS.get('samples') || 16) : 1;
const HALF = Math.round(RES / 2);
const REFL = RENDER_MODE ? OUT : Math.round(OUT * 0.6);
const SHUTTER = 1 / 60;
const BN = 64;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(OUT, OUT, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.autoClear = true;
const gl = renderer.getContext();
gl.getExtension('EXT_float_blend'); gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');

// ── generated textures ──
function blueNoise(size, seed) { // void-and-cluster
  const N = size * size, R = 7; const rng = mulberry32(seed);
  const kern = []; for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) kern.push([x, y, Math.exp(-(x * x + y * y) / (2 * 1.9 * 1.9))]);
  const on = new Uint8Array(N), E = new Float64Array(N);
  const splat = (i, s) => { const px = i % size, py = (i / size) | 0; for (const [x, y, w] of kern) E[((py + y + size) % size) * size + ((px + x + size) % size)] += s * w; };
  const tightest = () => { let b = -1, v = -Infinity; for (let i = 0; i < N; i++) if (on[i] && E[i] > v) { v = E[i]; b = i; } return b; };
  const voidest = () => { let b = -1, v = Infinity; for (let i = 0; i < N; i++) if (!on[i] && E[i] < v) { v = E[i]; b = i; } return b; };
  const init = N / 10 | 0; let c = 0; while (c < init) { const i = rng() * N | 0; if (!on[i]) { on[i] = 1; splat(i, 1); c++; } }
  for (let it = 0; it < 2000; it++) { const t = tightest(); on[t] = 0; splat(t, -1); const v = voidest(); on[v] = 1; splat(v, 1); if (v === t) break; }
  const rank = new Int32Array(N); const savedOn = on.slice(), savedE = E.slice();
  for (let r = init - 1; r >= 0; r--) { const t = tightest(); on[t] = 0; splat(t, -1); rank[t] = r; }
  on.set(savedOn); E.set(savedE);
  for (let r = init; r < N; r++) { const v = voidest(); on[v] = 1; splat(v, 1); rank[v] = r; }
  return Float32Array.from(rank, r => (r + 0.5) / N);
}
function makeBlueTexture() {
  const ch = [blueNoise(BN, 11), blueNoise(BN, 23), blueNoise(BN, 37), blueNoise(BN, 51)];
  const d = new Float32Array(BN * BN * 4);
  for (let i = 0; i < BN * BN; i++) for (let k = 0; k < 4; k++) d[i * 4 + k] = ch[k][i];
  const t = new THREE.DataTexture(d, BN, BN, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t;
}
function makeNoise3D() {
  const S = 64; const data = new Uint8Array(S * S * S); const rng = mulberry32(99);
  const octs = [[8, 0.55], [16, 0.3], [32, 0.15]].map(([n, a]) => ({ n, a, v: Float32Array.from({ length: n * n * n }, () => rng()) }));
  const f = x => x * x * (3 - 2 * x);
  for (let z = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0;
    for (const o of octs) {
      const n = o.n, gx = x / S * n, gy = y / S * n, gz = z / S * n; const ix = gx | 0, iy = gy | 0, iz = gz | 0; const fx = f(gx - ix), fy = f(gy - iy), fz = f(gz - iz);
      const v = (i, j, k) => o.v[((i % n) + n * ((j % n) + n * (k % n)))];
      s += o.a * lerp(lerp(lerp(v(ix, iy, iz), v(ix + 1, iy, iz), fx), lerp(v(ix, iy + 1, iz), v(ix + 1, iy + 1, iz), fx), fy), lerp(lerp(v(ix, iy, iz + 1), v(ix + 1, iy, iz + 1), fx), lerp(v(ix, iy + 1, iz + 1), v(ix + 1, iy + 1, iz + 1), fx), fy), fz);
    }
    data[x + S * (y + S * z)] = clamp((s - 0.5) * 1.35 + 0.5, 0, 1) * 255;
  }
  const t = new THREE.Data3DTexture(data, S, S, S); t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.LinearFilter; t.unpackAlignment = 1; t.needsUpdate = true; return t;
}

// ── one-bounce virtual lights: where does each lamp's light land? ──
function buildVPLs() {
  const ground = { o: V3(-4.6, 0.02, -23), a: V3(9.6, 0, 0), b: V3(0, 0, 26), n: V3(0, 1, 0), albedo: [0.10, 0.095, 0.085] };
  const rects = [ground, ...PROXIES];
  const out = [];
  const trace = (li, count) => {
    const L = LAMPS[li];
    for (let i = 0; i < count; i++) {
      const y = 1 - 2 * (i + 0.5) / count, r = Math.sqrt(1 - y * y), a = i * 2.399963229;
      const d = V3(Math.cos(a) * r, y, Math.sin(a) * r);
      let best = 1e9, hit = null;
      for (const R of rects) {
        const den = d.dot(R.n); if (Math.abs(den) < 1e-5) continue;
        const t = R.o.clone().sub(L.pos).dot(R.n) / den; if (t < 0.2 || t >= best) continue;
        const q = L.pos.clone().addScaledVector(d, t).sub(R.o);
        const u = q.dot(R.a) / R.a.lengthSq(), v = q.dot(R.b) / R.b.lengthSq();
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        best = t; hit = { R, den };
      }
      if (!hit) continue;
      const n = hit.R.n.clone(); if (hit.den > 0) n.negate();
      const p = L.pos.clone().addScaledVector(d, best).addScaledVector(n, 0.06);
      const flux = L.I * 4 * Math.PI / count * 0.72;
      out.push({ p, path: best, n, f: hit.R.albedo.map(v => v * flux), li });
    }
  };
  trace(0, 156); trace(1, 34); trace(2, 14);
  const NV = Math.min(out.length, 112);
  const data = new Float32Array(112 * 3 * 4);
  // interleave so that any stride is still a fair sample
  const order = out.map((_, i) => i).sort((a, b) => ((a * 61) % 197) - ((b * 61) % 197)).slice(0, NV);
  order.forEach((k, j) => { const v = out[k]; data.set([v.p.x, v.p.y, v.p.z, v.path], j * 4); data.set([v.n.x, v.n.y, v.n.z, 0], (112 + j) * 4); data.set([v.f[0], v.f[1], v.f[2], v.li], (224 + j) * 4); });
  const t = new THREE.DataTexture(data, 112, 3, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true;
  return { tex: t, count: NV, total: out.length };
}

// ── targets ──
function rt(w, h, o = {}) { return new THREE.WebGLRenderTarget(w, h, Object.assign({ type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }, o)); }
function gbuffer(w, h) {
  const g = new THREE.WebGLRenderTarget(w, h, { count: 4, type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  g.textures[0].type = THREE.FloatType; g.textures[3].type = THREE.FloatType;
  return g;
}
const gMain = gbuffer(RES, RES), gRG = gbuffer(REFL, REFL), gRM = gbuffer(RES, RES);
const halfRT = new THREE.WebGLRenderTarget(HALF, HALF, { count: 2, type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
const litRT = rt(RES, RES, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const reflRTg = rt(REFL, REFL, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
const reflRTm = rt(RES, RES);
const accRT = rt(RES, RES, { type: THREE.FloatType });
const bloomDown = [], bloomUp = [];
for (let i = 0, s = RES >> 1; i < 7; i++, s >>= 1) { bloomDown.push(rt(s, s)); bloomUp.push(rt(s, s)); }

// ── scene ──
const blueTex = makeBlueTexture();
const noise3 = makeNoise3D();
const gbufUniforms = { uViewPos: { value: V3() }, uClipPlane: { value: new THREE.Vector4(0, 0, 0, 1) }, uTime: { value: 0 }, uDrips: { value: dripUniforms() } };
const gMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: GBUF_VERT, fragmentShader: GBUF_FRAG, uniforms: gbufUniforms, side: THREE.DoubleSide });
const distUniforms = { uOrigin: { value: V3() }, uAxis: { value: MOON_DIR.clone() }, uMode: { value: 0 } };
const distMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: DIST_VERT, fragmentShader: DIST_FRAG, uniforms: distUniforms, side: THREE.DoubleSide });

const scene = new THREE.Scene(); scene.matrixWorldAutoUpdate = true;
const staticB = buildStreet();
const staticMesh = new THREE.Mesh(staticB.geometry(), gMat); staticMesh.frustumCulled = false;
const ground = new THREE.Group();
ground.add(buildCobbles(gMat));
{ const grit = new THREE.Mesh(gridPlane(-4.9, 5.1, -25.5, 3.4, 0.07, (x, z) => groundBase(x, z) + 0.0045, M.GRIT, [0.085, 0.072, 0.055]), gMat); grit.frustumCulled = false; ground.add(grit); }
{ const water = new THREE.Mesh(gridPlane(-4.9, 5.1, -25.5, 3.4, 0.06, () => 0.0, M.WATER, [0, 0, 0], (x, z) => clamp(-(groundBase(x, z) + 0.004) * 34, 0, 1)), gMat); water.frustumCulled = false; ground.add(water); }
const figure = buildFigure(gMat), cat = buildCat(gMat), laundry = buildLaundry(gMat), moths = buildMoths(gMat), drips = buildDrips(gMat);
const lampMeshes = buildLampMeshes(gMat);
scene.add(staticMesh, ground, figure.group, cat.group, laundry.group, moths.group, drips.group, ...lampMeshes);
const vpl = buildVPLs();

// ── shadow maps ──
const cubes = LAMPS.map(L => {
  const target = new THREE.WebGLCubeRenderTarget(L.shadow, { type: THREE.FloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  const cam = new THREE.CubeCamera(0.04, 90, target); cam.position.copy(L.pos); return { target, cam };
});
const MOON_RES = 4096;
const moonRT = rt(MOON_RES, MOON_RES, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
const moonCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 140);
{
  const ctr = V3(0, 8, -15); moonCam.position.copy(ctr).addScaledVector(MOON_DIR, 60); moonCam.lookAt(ctr); moonCam.updateMatrixWorld(true);
  const inv = moonCam.matrixWorld.clone().invert(); const bb = new THREE.Box3();
  for (const x of [-7, 7]) for (const y of [0, 20]) for (const z of [-28, 4]) bb.expandByPoint(V3(x, y, z).applyMatrix4(inv));
  moonCam.left = bb.min.x; moonCam.right = bb.max.x; moonCam.bottom = bb.min.y; moonCam.top = bb.max.y; moonCam.updateProjectionMatrix();
}
const moonMatrix = new THREE.Matrix4().multiplyMatrices(moonCam.projectionMatrix, moonCam.matrixWorldInverse.copy(moonCam.matrixWorld).invert());

function renderShadows() {
  renderer.setClearColor(new THREE.Color(1, 1, 1), 1);
  scene.overrideMaterial = distMat;
  const vis = [ground.visible, moths.group.visible, drips.group.visible, ...lampMeshes.map(m => m.visible)];
  ground.visible = false; moths.group.visible = false; drips.group.visible = false; lampMeshes.forEach(m => m.visible = false);
  distUniforms.uMode.value = 0;
  LAMPS.forEach((L, i) => { distUniforms.uOrigin.value.copy(L.pos); cubes[i].cam.update(renderer, scene); });
  distUniforms.uMode.value = 1; distUniforms.uOrigin.value.copy(moonCam.position);
  renderer.setRenderTarget(moonRT); renderer.clear(); renderer.render(scene, moonCam);
  scene.overrideMaterial = null;
  [ground.visible, moths.group.visible, drips.group.visible] = vis; lampMeshes.forEach((m, i) => m.visible = vis[3 + i]);
  renderer.setClearColor(new THREE.Color(0, 0, 0), 0);
}

// ── full-screen passes ──
const fsScene = new THREE.Scene(); const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsTri = new THREE.BufferGeometry(); fsTri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
const fsMesh = new THREE.Mesh(fsTri, null); fsMesh.frustumCulled = false; fsScene.add(fsMesh);
function pass(mat, target) { fsMesh.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }
const fsMat = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial(Object.assign({ glslVersion: THREE.GLSL3, vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false }, extra));

const shared = {
  uShadowDummy: { value: null },
  tShadow0: { value: cubes[0].target.texture }, tShadow1: { value: cubes[1].target.texture }, tShadow2: { value: cubes[2].target.texture },
  tMoonShadow: { value: moonRT.texture }, uMoonMatrix: { value: moonMatrix }, uMoonDir: { value: MOON_DIR }, uMoonOrigin: { value: moonCam.position },
  tNoise3: { value: noise3 }, tBlue: { value: blueTex }, tVpl: { value: vpl.tex }, uVplCount: { value: vpl.count },
  uLampPos: { value: LAMPS.map(l => l.pos) }, uLampCol: { value: LAMPS.map(l => V3(...l.color)) }, uFlareCol: { value: LAMPS.map(l => V3(...l.flare)) },
  uLampTiming: { value: LAMPS.map(l => V3(l.on, l.off, l.radius)) }, uLampI: { value: LAMPS.map(l => l.I) },
};
delete shared.uShadowDummy;
const viewUniforms = () => ({ uViewPos: { value: V3() }, uInvViewProj: { value: new THREE.Matrix4() }, uViewProj: { value: new THREE.Matrix4() }, uPlane: { value: new THREE.Vector4(0, 0, 0, 1) }, uIsRefl: { value: 0 }, uSample: { value: 0 }, uTime: { value: 0 }, uAudit: { value: 0 }, uRes: { value: new THREE.Vector2(RES, RES) } });
const gTex = g => ({ tPos: { value: g.textures[0] }, tNor: { value: g.textures[1] }, tAlb: { value: g.textures[2] }, tEmi: { value: g.textures[3] } });

const halfMat = fsMat(HALF_FRAG, Object.assign({}, shared, viewUniforms(), gTex(gMain)));
const glassU = (() => {
  const a = { c: CAFE.p((CAFE_WIN.u0 + CAFE_WIN.u1) / 2, (CAFE_WIN.v0 + CAFE_WIN.v1) / 2, -0.085), hw: (CAFE_WIN.u1 - CAFE_WIN.u0) / 2, hh: (CAFE_WIN.v1 - CAFE_WIN.v0) / 2, U: CAFE.U, N: CAFE.N };
  const b = { c: ENDW.p((SHOP.u0 + SHOP.u1) / 2, (SHOP.v0 + SHOP.v1) / 2, -0.03), hw: (SHOP.u1 - SHOP.u0) / 2, hh: (SHOP.v1 - SHOP.v0) / 2, U: ENDW.U, N: ENDW.N };
  const z = { c: V3(), hw: -1, hh: 0, U: V3(1, 0, 0), N: V3(0, 0, 1) };
  const arr = [a, b, z, z];
  return { uGlass: { value: arr.map(g => new THREE.Vector4(g.c.x, g.c.y, g.c.z, g.hw)) }, uGlassU: { value: arr.map(g => g.U.clone()) }, uGlassN: { value: arr.map(g => new THREE.Vector4(g.N.x, g.N.y, g.N.z, g.hh)) } };
})();
const blankTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blankTex.needsUpdate = true;
const lightExtra = () => ({ tHalfMist: { value: blankTex }, tHalfInd: { value: blankTex }, tReflG: { value: blankTex }, tReflM: { value: blankTex }, uMirrorN: { value: MIRROR.n } });
const mainLight = fsMat(LIGHT_FRAG, Object.assign({}, shared, viewUniforms(), gTex(gMain), lightExtra(), glassU));
mainLight.uniforms.tHalfMist.value = halfRT.textures[0]; mainLight.uniforms.tHalfInd.value = halfRT.textures[1];
mainLight.uniforms.tReflG.value = reflRTg.texture; mainLight.uniforms.tReflM.value = reflRTm.texture;
const reflLightG = fsMat(LIGHT_FRAG, Object.assign({}, shared, viewUniforms(), gTex(gRG), lightExtra(), glassU));
const reflLightM = fsMat(LIGHT_FRAG, Object.assign({}, shared, viewUniforms(), gTex(gRM), lightExtra(), glassU));

const accMat = fsMat(ACC_FRAG, { tSrc: { value: litRT.texture }, uW: { value: 1 } }, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, transparent: true });
const downMat = fsMat(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 } });
const upMat = fsMat(UP_FRAG, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 0.65 } });
const finalMat = fsMat(FINAL_FRAG, { tHDR: { value: accRT.texture }, tBloom: { value: null }, tBlue: { value: blueTex }, uOut: { value: new THREE.Vector2(OUT, OUT) }, uFrame: { value: 0 }, uSS: { value: SS }, uExposure: { value: Number(QS.get('exp') || 1.0) } });

// ── cameras ──
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.08, 400);
const reflCam = new THREE.PerspectiveCamera(FOV, 1, 0.08, 400);
reflCam.matrixAutoUpdate = false; reflCam.matrixWorldAutoUpdate = false;
const proj0 = new THREE.Matrix4();
function reflectionMatrix(n, d) { return new THREE.Matrix4().set(1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.z, -2 * d * n.x, -2 * n.y * n.x, 1 - 2 * n.y * n.y, -2 * n.y * n.z, -2 * d * n.y, -2 * n.z * n.x, -2 * n.z * n.y, 1 - 2 * n.z * n.z, -2 * d * n.z, 0, 0, 0, 1); }
const RM_GROUND = reflectionMatrix(V3(0, 1, 0), 0);
const MIR_D = -MIRROR.n.dot(MIRROR.c);
const RM_MIRROR = reflectionMatrix(MIRROR.n, MIR_D);

function setView(mat, cam, viewPos) {
  const u = mat.uniforms;
  u.uViewPos.value.copy(viewPos);
  u.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  u.uInvViewProj.value.copy(u.uViewProj.value).invert();
}
function drawG(target, cam, viewPos, clip) {
  gbufUniforms.uViewPos.value.copy(viewPos); gbufUniforms.uClipPlane.value.copy(clip);
  renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, cam);
}
function renderReflection(RM, n, d, gTarget, lightMat, outRT, camPos, clipOffset, hideGround, scissor) {
  reflCam.matrixWorldInverse.multiplyMatrices(camera.matrixWorldInverse, RM);
  reflCam.matrixWorld.copy(reflCam.matrixWorldInverse).invert();
  reflCam.projectionMatrix.copy(camera.projectionMatrix); reflCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  const mpos = camPos.clone().applyMatrix4(RM);
  ground.visible = !hideGround;
  if (scissor) { for (const t of [gTarget, outRT]) { t.scissorTest = true; t.scissor.copy(scissor); } }
  drawG(gTarget, reflCam, mpos, new THREE.Vector4(n.x, n.y, n.z, d - clipOffset));
  ground.visible = true;
  setView(lightMat, reflCam, mpos);
  lightMat.uniforms.uPlane.value.set(n.x, n.y, n.z, d); lightMat.uniforms.uIsRefl.value = 1;
  pass(lightMat, outRT);
}
function mirrorScissor() { // only the part of the frame the cafe mirror covers needs a reflection
  let x0 = 1, y0 = 1, x1 = -1, y1 = -1;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const p = MIRROR.c.clone().addScaledVector(MIRROR.right, sx * MIRROR.hw).addScaledVector(MIRROR.up, sy * MIRROR.hh).project(camera);
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const px = v => clamp(Math.floor((v * 0.5 + 0.5) * RES), 0, RES);
  const a = Math.max(0, px(x0) - 6), b = Math.max(0, px(y0) - 6), c = Math.min(RES, px(x1) + 6), d = Math.min(RES, px(y1) + 6);
  return new THREE.Vector4(a, b, Math.max(1, c - a), Math.max(1, d - b));
}

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const debugState = { lastCam: null };

function poseAll(t, camPos) {
  figure.update(t, camPos); cat.update(t, camPos); laundry.update(t, camPos); moths.update(t, camPos); drips.update(t, camPos);
  scene.updateMatrixWorld(true);
}

function renderFrame(t, samples) {
  const c = cameraAt(t);
  camera.position.copy(c.pos); camera.lookAt(c.tgt); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  proj0.copy(camera.projectionMatrix);
  debugState.lastCam = c;
  poseAll(t, c.pos);
  renderShadows();
  renderer.setRenderTarget(accRT); renderer.clear();
  const frameNo = Math.round(t * 30);
  for (let k = 0; k < samples; k++) {
    // jitter in pixel, in shutter time (motion blur of the fronts) and in every stochastic filter
    const jx = samples > 1 ? halton(k + 1, 2) - 0.5 : 0, jy = samples > 1 ? halton(k + 1, 3) - 0.5 : 0;
    const tk = samples > 1 ? t + ((((k * 7) % samples) + 0.5) / samples - 0.5) * SHUTTER : t;
    camera.projectionMatrix.copy(proj0);
    camera.projectionMatrix.elements[8] += jx * 2 / RES; camera.projectionMatrix.elements[9] += jy * 2 / RES;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    gbufUniforms.uTime.value = tk;
    const sid = k;
    for (const m of [halfMat, mainLight, reflLightG, reflLightM]) { m.uniforms.uTime.value = tk; m.uniforms.uSample.value = sid; }
    // 1. reflections, each from its mirrored camera: path length |L-P| + |P-C'| is the full bounce path
    renderReflection(RM_GROUND, V3(0, 1, 0), 0, gRG, reflLightG, reflRTg, c.pos, 0.001, true, null);
    renderReflection(RM_MIRROR, MIRROR.n, MIR_D, gRM, reflLightM, reflRTm, c.pos, 0.075, false, mirrorScissor());
    // 2. the street itself
    drawG(gMain, camera, c.pos, new THREE.Vector4(0, 0, 0, 1));
    setView(halfMat, camera, c.pos); pass(halfMat, halfRT);
    setView(mainLight, camera, c.pos); pass(mainLight, litRT);
    accMat.uniforms.uW.value = 1 / samples;
    renderer.autoClear = false; pass(accMat, accRT); renderer.autoClear = true;
  }
  camera.projectionMatrix.copy(proj0);
  // bloom
  let src = accRT;
  for (let i = 0; i < bloomDown.length; i++) { downMat.uniforms.tSrc.value = src.texture; downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); downMat.uniforms.uFirst.value = i === 0 ? 1 : 0; pass(downMat, bloomDown[i]); src = bloomDown[i]; }
  let prev = bloomDown[bloomDown.length - 1];
  for (let i = bloomDown.length - 2; i >= 0; i--) { upMat.uniforms.tSrc.value = prev.texture; upMat.uniforms.tBase.value = bloomDown[i].texture; upMat.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height); pass(upMat, bloomUp[i]); prev = bloomUp[i]; }
  finalMat.uniforms.tBloom.value = prev.texture; finalMat.uniforms.uFrame.value = frameNo;
  pass(finalMat, null);
}

// ── tools for auditing the physics: world position under a pixel, and the clock ──
function probe(px, py, t) { // px, py in output pixels, origin top-left; returns the surface under that pixel
  renderFrame(t, 1);
  const buf = new Float32Array(4);
  renderer.readRenderTargetPixels(gMain, Math.floor(px * SS), Math.floor(RES - 1 - py * SS), 1, 1, buf, undefined, 0);
  return Array.from(buf);
}
function projectPoint(x, y, z, t) {
  const c = cameraAt(t); const cm = new THREE.PerspectiveCamera(FOV, 1, 0.08, 400); cm.position.copy(c.pos); cm.lookAt(c.tgt); cm.updateMatrixWorld(true);
  const p = V3(x, y, z).project(cm); return [(p.x * 0.5 + 0.5) * OUT, (0.5 - p.y * 0.5) * OUT];
}

// linear radiance (this lamp only) in a small patch of the shaded frame, plus what the G-buffers hold there
function audit(px, py, t, lamp) {
  for (const m of [mainLight, reflLightG, reflLightM]) m.uniforms.uAudit.value = lamp + 1;
  renderFrame(t, 1);
  for (const m of [mainLight, reflLightG, reflLightM]) m.uniforms.uAudit.value = 0;
  const X = Math.floor(px * SS), Y = Math.floor(RES - 1 - py * SS);
  const h = new Uint16Array(5 * 5 * 4); renderer.readRenderTargetPixels(litRT, X - 2, Y - 2, 5, 5, h);
  const v = []; for (let i = 0; i < 25; i++) v.push(0.2126 * THREE.DataUtils.fromHalfFloat(h[i * 4]) + 0.7152 * THREE.DataUtils.fromHalfFloat(h[i * 4 + 1]) + 0.0722 * THREE.DataUtils.fromHalfFloat(h[i * 4 + 2]));
  v.sort((a, b) => a - b);
  const g = (target, size) => { const b = new Float32Array(4); renderer.readRenderTargetPixels(target, Math.floor((X + 0.5) / RES * size), Math.floor((Y + 0.5) / RES * size), 1, 1, b, undefined, 0); return Array.from(b); };
  return { value: v[12], center: v, main: g(gMain, RES), reflGround: g(gRG, REFL), reflMirror: g(gRM, RES) };
}

// ── run ──
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
window.gpuInfo = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
window.sceneInfo = { staticTriangles: staticB.pos.length / 9, vpls: vpl.count, vplTotal: vpl.total, res: RES, samples: SAMPLES };

if (RENDER_MODE) {
  document.body.classList.add('render');
  window.renderAt = (t) => { renderFrame(t, SAMPLES); gl.finish(); return true; };
  const viewMat = fsMat(`precision highp float; in vec2 vUv; uniform sampler2D tSrc; uniform float uGain; layout(location=0) out vec4 o; void main(){ vec3 c = textureLod(tSrc, vUv, 0.0).rgb*uGain; o = vec4(pow(c/(1.0+c), vec3(1.0/2.2)),1.0); }`, { tSrc: { value: null }, uGain: { value: 1 } });
  window.dumpRefl = (t, which, gain) => { renderFrame(t, 1); viewMat.uniforms.tSrc.value = (which === 'g' ? reflRTg : reflRTm).texture; viewMat.uniforms.uGain.value = gain || 1; renderer.setRenderTarget(null); pass(viewMat, null); return canvas.toDataURL('image/png'); };
  // debug: the same instant in a world where no lamp is ever switched on
  window.setLampsNeverLit = (v) => { shared.uLampTiming.value.forEach((q, i) => { q.x = v ? 1000 : LAMPS[i].on; }); };
  window.slow = { cameraAt, LAMPS, MIRROR, MIRROR_AIM, audit, probe, projectPoint, frameData: () => canvas.toDataURL('image/png') };
  window.ready = true;
} else {
  let start = null;
  const restart = () => { start = null; };
  addEventListener('click', restart);
  addEventListener('keydown', e => { if (e.code === 'Space') restart(); });
  const loop = (now) => {
    if (start === null) start = now;
    const t = ((now - start) / 1000) % (DURATION + 1.0);
    renderFrame(Math.min(t, DURATION), 1);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
const loading = document.getElementById('loading'); if (loading) loading.remove();

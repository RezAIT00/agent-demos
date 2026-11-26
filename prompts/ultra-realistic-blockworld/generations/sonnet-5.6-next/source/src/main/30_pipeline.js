// ================================================================ frame orchestration
const SHADOW_SPLITS = [0.062, 0.165, 0.43, 1.0];
const Pipeline = {
  ready: false,
  init() {
    this.camera = new THREE.PerspectiveCamera(74, 16 / 9, 0.09, 6000);
    this.vmCamera = new THREE.PerspectiveCamera(56, 16 / 9, 0.02, 20);
    const sc = () => { const s = new THREE.Scene(); s.matrixAutoUpdate = false; return s; };
    this.scenes = { gbuf: sc(), lod: sc(), view: sc(), water: sc(), glass: sc(), fx: sc(), shadow: sc(), shadowNear: sc() };
    this.viewProj = new THREE.Matrix4(); this.viewProjUnjit = new THREE.Matrix4(); this.prevViewProj = new THREE.Matrix4(); this.invViewProj = new THREE.Matrix4(); this.vmInvViewProj = new THREE.Matrix4();
    this.shadowCams = [0, 1, 2, 3].map(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 1200));
    this.shadowMats = [0, 1, 2, 3].map(() => new THREE.Matrix4());
    this.cascTexel = V4(1, 1, 1, 1); this.cascDepth = V4(1, 1, 1, 1); this.cascSize = V4(1, 1, 1, 1);
    this.pointPos = Array.from({ length: 48 }, () => V4()); this.pointCol = Array.from({ length: 48 }, () => V4()); this.pointCount = 0;
    this.shared = {
      uViewProj: { value: this.viewProj }, uInvViewProj: { value: this.invViewProj }, uPrevViewProj: { value: this.prevViewProj }, uCurViewProj: { value: this.viewProjUnjit },
      uNearFar: { value: V2(0.09, 6000) }, uShadowMap: { value: null }, uShadowMat: { value: this.shadowMats }, uCascadeTexel: { value: this.cascTexel }, uCascadeDepth: { value: this.cascDepth }, uCascadeSize: { value: this.cascSize },
      uShadowOn: { value: 1 }, uShadowTile: { value: 1 / 2048 }, uPcf: { value: Q.pcf },
      uPointPos: { value: this.pointPos }, uPointCol: { value: this.pointCol }, uPointCount: { value: 0 },
    };
    this.frameIndex = 0; this.dirtyHistory = true; this.shadowAge = 0;
    this.grade = { tint: V3(1, 1, 1), sat: 1.0, contrast: 1.04, lift: V3(0.004, 0.005, 0.009), vignette: 0, grain: 0, ca: 0, bloom: 0.045, flare: 1.0, expComp: 1.0, sharp: 0.5 };
    this._buildPasses();
    this.ready = true;
  },
  pick(...names) { const o = {}; for (const n of names) o[n] = this.shared[n] || U[n] || (() => { throw new Error('uniform ' + n); })(); return o; },
  _buildPasses() {
    const P = this.pick.bind(this);
    const t = (v = null) => ({ value: v });
    this.aoPass = new FSPass(G_AO_FRAG, { uDepth: t(), uGN: t(), uGM: t(), uInvProj: t(new THREE.Matrix4()), uView: t(new THREE.Matrix4()), uProj: t(new THREE.Matrix4()), uRes: t(V2()), uFrame: U.uFrame, uRadius: t(1.25), uSlices: t(Q.aoSlices), uSteps: t(Q.aoSteps) });
    this.aoBlur = new FSPass(G_AOBLUR_FRAG, { uSrc: t(), uDir: t(V2()) });
    this.cloudPass = new FSPass(G_CLOUD_FRAG, Object.assign(P('uNoiseTex', 'uSkyView', 'uInvViewProj', 'uPrevViewProj', 'uCamPos', 'uSunDir', 'uMoonDir', 'uLightDir', 'uLightColor', 'uFlashPos', 'uFrame', 'uFlash', 'uTime', 'uSH', 'uCloudNoise', 'uCloudDetail', 'uCloudCover', 'uCloudDensity', 'uStorm', 'uCloudOffset'), { uDepth: t(), uHistory: t(), uHistoryWeight: t(0), uSteps: t(Q.cloudSteps), uMaxDist: t(6500) }));
    this.lightPass = new FSPass(G_LIGHTING_FRAG, Object.assign(P('uNoiseTex', 'uSkyView', 'uInvViewProj', 'uViewProj', 'uNearFar', 'uShadowMap', 'uShadowMat', 'uCascadeTexel', 'uCascadeDepth', 'uCascadeSize', 'uShadowOn', 'uShadowTile', 'uPcf', 'uPointPos', 'uPointCol', 'uPointCount', 'uCamPos', 'uSunDir', 'uMoonDir', 'uLightDir', 'uLightColor', 'uBounce', 'uTime', 'uFrame', 'uNight', 'uFlash', 'uFlashPos', 'uSH', 'uCloudNoise', 'uCloudDetail', 'uCloudCover', 'uCloudDensity', 'uStorm', 'uCloudOffset', 'uFogDensity', 'uFogHeight', 'uFogBase', 'uHaze', 'uCamSky', 'uUnderwater'), {
      uGA: t(), uGN: t(), uGL: t(), uGM: t(), uDepth: t(), uAO: t(), uCloudTex: t(), uFarHeight: U.uFarHeight, uFarInfo: U.uFarInfo, uVmInvViewProj: t(this.vmInvViewProj), uContactSteps: t(Q.contact), uSSRon: t(Q.ssr > 0 ? 1 : 0), uAOon: t(1), uSunDisc: t(V3()), uStarSpin: t(0), uPixelAngle: t(0.001), uStarGain: t(1.25), uGalaxy: t(V3(0.52, 0.5, -0.69).normalize()),
    }));
    this.ssrPass = new FSPass(G_SSR_FRAG, Object.assign(P('uSkyView', 'uInvViewProj', 'uViewProj', 'uNearFar', 'uCamPos', 'uBounce', 'uFrame', 'uSH'), { uScene: t(), uOpaqueDepth: t(), uGA: t(), uGN: t(), uGL: t(), uGM: t(), uAO: t(), uSSRSteps: t(Q.ssr), uAOon: t(1) }), { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth });
    this.volPass = new FSPass(G_VOL_FRAG, Object.assign(P('uNoiseTex', 'uInvViewProj', 'uCamPos', 'uSunDir', 'uLightDir', 'uLightColor', 'uTime', 'uFrame', 'uShadowMap', 'uShadowMat', 'uCascadeTexel', 'uCascadeDepth', 'uCascadeSize', 'uShadowOn', 'uShadowTile', 'uPcf', 'uPointPos', 'uPointCol', 'uPointCount', 'uSH', 'uCloudNoise', 'uCloudDetail', 'uCloudCover', 'uCloudDensity', 'uStorm', 'uCloudOffset', 'uUnderwater', 'uFlash', 'uFogBase', 'uCamSky', 'uWaterColor'), { uDepth: t(), uVolDensity: t(0.002), uVolMax: t(110), uForestHaze: t(0), uCaveHaze: t(0), uGlow: t(0.0025), uVolSteps: t(Q.volSteps) }));
    this.compPass = new FSPass(G_COMPOSITE_FRAG, Object.assign(P('uInvViewProj', 'uCamPos', 'uWaterColor', 'uLightColor', 'uUnderwater', 'uCamSky', 'uNearFar', 'uSH'), { uScene: t(), uDepth: t(), uVol: t(), uVolRes: t(V2()) }));
    this.taaPass = new FSPass(G_TAA_FRAG, Object.assign(P('uInvViewProj', 'uPrevViewProj', 'uCurViewProj'), { uCurrent: t(), uHistory: t(), uDepth: t(), uGM: t(), uRes: t(V2()), uReset: t(1) }));
    this.lumPass = new FSPass(G_LUM_FRAG, { uSrc: t() });
    this.reducePass = new FSPass(G_REDUCE_FRAG, { uSrc: t(), uFactor: t(4) });
    this.adaptPass = new FSPass(G_ADAPT_FRAG, { uAvg: t(), uPrev: t(), uDt: t(0.016), uInstant: t(1), uComp: t(1), uMinExp: t(0.05), uMaxExp: t(12.5) });
    this.downPass = new FSPass(G_DOWN_FRAG, { uSrc: t(), uTexel: t(V2()), uFirst: t(0) });
    this.upPass = new FSPass(G_UP_FRAG, { uSrc: t(), uBase: t(), uTexel: t(V2()), uScatter: t(0.68) });
    this.tonePass = new FSPass(G_TONEMAP_FRAG, { uScene: t(), uBloom: t(), uExposure: t(), uDepth: t(), uCloudTex: t(), uRes: t(V2()), uSunUV: t(V2()), uBloomAmt: t(0.045), uFlareAmt: t(1), uVignette: t(0.18), uCA: t(0), uExpScale: t(1), uSat: t(1), uContrast: t(1), uUnderwater: U.uUnderwater, uTime: U.uTime, uTint: t(V3(1, 1, 1)), uLift: t(V3()), uSunFlareColor: t(V3()) });
    this.sharpPass = new FSPass(G_SHARPEN_FRAG, { uSrc: t(), uTexel: t(V2()), uSharp: t(0.5), uGrain: t(0), uGrainSeed: t(0), uDownsample: t(0) });
    this.accumPass = new FSPass(G_ACCUM_FRAG, { uSrc: t(), uWeightScale: t(1) }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, transparent: true });
    this.resolvePass = new FSPass(G_RESOLVE_FRAG, { uSrc: t() });
    this.copyPass = new FSPass(G_COPY_FRAG, { uSrc: t() });
    this.waterMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: G_WATER_VERT, fragmentShader: G_WATER_FRAG, side: THREE.DoubleSide, uniforms: this._forwardUniforms() });
    this.glassMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: G_VOXEL_VERT, fragmentShader: G_GLASS_FRAG, side: THREE.DoubleSide, uniforms: Object.assign(this._forwardUniforms(), uni('uAlbedoArr', 'uNormalArr', 'uExtraArr', 'uWind')) });
    this.forwardTex = { uScene: this.waterMat.uniforms.uScene, uOpaqueDepth: this.waterMat.uniforms.uOpaqueDepth };
    this.glassMat.uniforms.uScene = this.waterMat.uniforms.uScene; this.glassMat.uniforms.uOpaqueDepth = this.waterMat.uniforms.uOpaqueDepth;
  },
  _forwardUniforms() {
    const P = this.pick.bind(this);
    if (!this._fwdShared) this._fwdShared = { uRes: { value: V2(1, 1) }, uSSRSteps: { value: Q.ssr }, uSunDisc: { value: V3() } };
    return Object.assign(P('uNoiseTex', 'uWaterNormals', 'uSkyView', 'uRainMap', 'uRainMapInfo', 'uInvViewProj', 'uViewProj', 'uNearFar', 'uCamPos', 'uSunDir', 'uLightDir', 'uLightColor', 'uTime', 'uFrame', 'uRain', 'uUnderwater', 'uFlash', 'uNight', 'uSH', 'uCloudNoise', 'uCloudDetail', 'uCloudCover', 'uCloudDensity', 'uStorm', 'uCloudOffset', 'uShadowMap', 'uShadowMat', 'uCascadeTexel', 'uCascadeDepth', 'uCascadeSize', 'uShadowOn', 'uShadowTile', 'uPcf', 'uFogDensity', 'uFogHeight', 'uFogBase', 'uHaze', 'uCamSky', 'uWaterColor'), this._fwdShared, { uScene: { value: null }, uOpaqueDepth: { value: null } });
  },

  // ---------------------------------------------------------------- targets
  resize(w, h, outW, outH) {
    w = Math.max(64, Math.floor(w / 2) * 2); h = Math.max(64, Math.floor(h / 2) * 2);
    this.W = w; this.H = h; this.outW = outW; this.outH = outH;
    for (const k in this.rt || {}) { const v = this.rt[k]; (Array.isArray(v) ? v : [v]).forEach((x) => x && x.dispose && x.dispose()); }
    const rt = this.rt = {};
    const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    const gDepth = new THREE.DepthTexture(w, h, THREE.FloatType);
    gDepth.minFilter = gDepth.magFilter = THREE.NearestFilter;
    rt.gbuf = new THREE.WebGLRenderTarget(w, h, Object.assign({ count: 4, type: THREE.UnsignedByteType, depthTexture: gDepth, depthBuffer: true, generateMipmaps: false }, nearest));
    rt.gbuf.textures[1].type = THREE.HalfFloatType;
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    rt.ao = makeRT(hw, hh, { format: THREE.RGFormat }); rt.aoB = makeRT(hw, hh, { format: THREE.RGFormat });
    const cw = Math.ceil(w * Q.cloudScale), ch = Math.ceil(h * Q.cloudScale);
    rt.cloud = [makeRT(cw, ch), makeRT(cw, ch)];
    rt.hdrA = makeRT(w, h);
    const bDepth = new THREE.DepthTexture(w, h, THREE.FloatType);
    bDepth.minFilter = bDepth.magFilter = THREE.NearestFilter;
    rt.hdrB = makeRT(w, h, { depthBuffer: true, depthTexture: bDepth });
    rt.vol = makeRT(hw, hh);
    rt.comp = makeRT(w, h);
    rt.taa = [makeRT(w, h), makeRT(w, h)];
    const lf = { format: THREE.RGFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    rt.lum = [makeRT(64, 64, lf), makeRT(16, 16, lf), makeRT(4, 4, lf), makeRT(1, 1, lf)];
    rt.exp = [makeRT(1, 1, Object.assign({ type: THREE.FloatType }, nearest)), makeRT(1, 1, Object.assign({ type: THREE.FloatType }, nearest))];
    rt.down = []; rt.up = [];
    let bw = w, bh = h;
    for (let i = 0; i < 6; i++) { bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); rt.down.push(makeRT(bw, bh)); rt.up.push(makeRT(bw, bh)); }
    rt.ldr = makeRT(w, h, { type: THREE.UnsignedByteType });
    if (DEMO) { rt.accum = makeRT(w, h, Object.assign({ type: THREE.FloatType }, nearest)); }
    this.buildShadowTarget();
    this.camera.aspect = outW / outH; this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = outW / outH; this.vmCamera.updateProjectionMatrix();
    this._fwdShared.uRes.value.set(w, h);
    this.dirtyHistory = true; this.shadowAge = 0;
  },
  buildShadowTarget() {
    const res = Q.shadowRes || 16;
    if (this.shadowRT && this.shadowRT.width === res * 2) return;
    if (this.shadowRT) this.shadowRT.dispose();
    const d = new THREE.DepthTexture(res * 2, res * 2, THREE.FloatType);
    d.minFilter = d.magFilter = THREE.NearestFilter;
    this.shadowRT = new THREE.WebGLRenderTarget(res * 2, res * 2, { type: THREE.UnsignedByteType, format: THREE.RedFormat, depthTexture: d, depthBuffer: true, generateMipmaps: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.shared.uShadowMap.value = d;
    this.shared.uShadowTile.value = 1.0 / res;
    this.shadowRes = res; this.shadowAge = 0;
  },
  applyQuality() {
    this.shared.uPcf.value = Q.pcf; U.uPomSteps.value = Q.pom; U.uGrassDist.value = Q.grassDist;
    this.aoPass.u.uSlices.value = Q.aoSlices; this.aoPass.u.uSteps.value = Q.aoSteps;
    this.cloudPass.u.uSteps.value = Q.cloudSteps; this.volPass.u.uVolSteps.value = Q.volSteps;
    this.lightPass.u.uContactSteps.value = Q.contact; this.lightPass.u.uSSRon.value = Q.ssr > 0 ? 1 : 0; this.ssrPass.u.uSSRSteps.value = Q.ssr; this._fwdShared.uSSRSteps.value = Q.ssr;
    this.shared.uShadowOn.value = Q.shadowRes ? 1 : 0;
  },

  updateShadowCascades(cam) {
    const L = U.uLightDir.value;
    const fwd = V3(0, 0, -1).applyQuaternion(cam.quaternion);
    const tanY = Math.tan(cam.fov * Math.PI / 360), k = Math.sqrt(1 + cam.aspect * cam.aspect) * tanY, k2 = k * k;
    const upRef = Math.abs(L.y) > 0.985 ? V3(1, 0, 0) : V3(0, 1, 0);
    const right = V3().crossVectors(upRef, L).normalize(), up = V3().crossVectors(L, right).normalize();
    const todo = [];
    for (let c = 0; c < 4; c++) {
      // distant cascades are refreshed less often, on frames that do not coincide
      const every = DEMO ? 1 : [1, 2, 4, 8][c], phase = [0, 0, 1, 3][c];
      if (this.shadowAge > 0 && every > 1 && (this.frameIndex % every) !== phase) continue;
      const n = c === 0 ? 0.1 : SHADOW_SPLITS[c - 1] * Q.shadowDist, f = SHADOW_SPLITS[c] * Q.shadowDist;
      let cz, r;
      if (k2 >= (f - n) / (f + n)) { cz = f; r = f * k; }
      else { cz = 0.5 * (f + n) * (1 + k2); r = 0.5 * Math.sqrt((f - n) ** 2 + 2 * (f * f + n * n) * k2 + (f + n) ** 2 * k2 * k2); }
      r = Math.ceil(r * 1.04 * 8) / 8;
      const center = V3().copy(cam.position).addScaledVector(fwd, cz);
      const texel = (2 * r) / this.shadowRes;
      const cx = Math.floor(center.dot(right) / texel) * texel, cy = Math.floor(center.dot(up) / texel) * texel, cd = center.dot(L);
      const snapped = V3().addScaledVector(right, cx).addScaledVector(up, cy).addScaledVector(L, cd);
      const sc = this.shadowCams[c];
      const dist = 520;
      sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = dist + r + 160;
      sc.position.copy(snapped).addScaledVector(L, dist);
      sc.up.copy(up); sc.lookAt(snapped); sc.updateMatrixWorld(); sc.updateProjectionMatrix();
      this.shadowMats[c].set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(sc.projectionMatrix).multiply(sc.matrixWorldInverse);
      this.cascTexel.setComponent(c, texel); this.cascSize.setComponent(c, 2 * r); this.cascDepth.setComponent(c, sc.far - sc.near);
      todo.push(c);
    }
    return todo;
  },
  renderShadows(cam) {
    if (!Q.shadowRes) return;
    const todo = this.updateShadowCascades(cam);
    const res = this.shadowRes, rt = this.shadowRT;
    for (const c of todo) {
      rt.viewport.set((c & 1) * res, (c >> 1) * res, res, res); rt.scissor.copy(rt.viewport); rt.scissorTest = true;
      renderer.setRenderTarget(rt);
      renderer.clear(false, true, false);
      renderer.render(this.scenes.shadow, this.shadowCams[c]);
      if (c === 0 && Q.grass >= 0.7) renderer.render(this.scenes.shadowNear, this.shadowCams[c]);
    }
    this.shadowAge++;
  },

  setLights(list) {
    // keep the most influential emitters within the budget
    const cp = this.camera.position, fwd = V3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    for (const l of list) {
      const dx = l.x - cp.x, dy = l.y - cp.y, dz = l.z - cp.z, d2 = dx * dx + dy * dy + dz * dz;
      const front = dx * fwd.x + dy * fwd.y + dz * fwd.z;
      l.score = (l.power * (l.boost || 1)) / (1 + d2 / 60) * (front < -l.radius ? 0.15 : 1);
      if (d2 > 80 * 80) l.score = 0;
    }
    list.sort((a, b) => b.score - a.score);
    const n = Math.min(Q.maxLights, list.length);
    let m = 0;
    for (let i = 0; i < n; i++) {
      const l = list[i];
      if (l.score <= 0) break;
      // fade out the weakest lights in the budget to avoid popping
      const fade = n >= Q.maxLights && i > n - 5 ? (n - i) / 5 : 1;
      this.pointPos[m].set(l.x, l.y, l.z, l.radius);
      const p = l.power * fade * 0.9 * (l.flicker || 1);
      this.pointCol[m].set(l.color[0] * p, l.color[1] * p, l.color[2] * p, l.noGlow ? -1 : l.held ? 0 : 1);
      m++;
    }
    this.shared.uPointCount.value = m;
  },

  setCamera(jx, jy) {
    const cam = this.camera;
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    this.viewProjUnjit.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    cam.projectionMatrix.elements[8] += (jx * 2) / this.W;
    cam.projectionMatrix.elements[9] += (jy * 2) / this.H;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    this.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.invViewProj.copy(this.viewProj).invert();
    const vm = this.vmCamera;
    vm.position.copy(cam.position); vm.quaternion.copy(cam.quaternion); vm.updateMatrixWorld(); vm.updateProjectionMatrix();
    vm.projectionMatrix.elements[8] += (jx * 2) / this.W; vm.projectionMatrix.elements[9] += (jy * 2) / this.H;
    this.vmInvViewProj.multiplyMatrices(vm.projectionMatrix, vm.matrixWorldInverse).invert();
    U.uCamPos.value.copy(cam.position);
  },

  // everything up to the HDR composite (one jittered sample of the scene)
  renderScene(opts) {
    const rt = this.rt, r = renderer, cam = this.camera;
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(rt.gbuf); r.clear(true, true, false);
    r.render(this.scenes.gbuf, cam);
    r.render(this.scenes.lod, cam);
    if (opts.viewmodel && this.scenes.view.children.length) r.render(this.scenes.view, this.vmCamera);
    const g = rt.gbuf.textures, depth = rt.gbuf.depthTexture;
    // ambient occlusion
    const useAO = Q.aoSlices > 0;
    if (useAO) {
      const a = this.aoPass.u;
      a.uDepth.value = depth; a.uGN.value = g[1]; a.uGM.value = g[3]; a.uInvProj.value.copy(cam.projectionMatrixInverse); a.uView.value.copy(cam.matrixWorldInverse); a.uProj.value.copy(cam.projectionMatrix); a.uRes.value.set(this.W, this.H);
      this.aoPass.render(rt.ao);
      this.aoBlur.u.uSrc.value = rt.ao.texture; this.aoBlur.u.uDir.value.set(1 / rt.ao.width, 0); this.aoBlur.render(rt.aoB);
      this.aoBlur.u.uSrc.value = rt.aoB.texture; this.aoBlur.u.uDir.value.set(0, 1 / rt.ao.height); this.aoBlur.render(rt.ao);
    }
    // clouds
    const ci = this.frameIndex & 1;
    const cu = this.cloudPass.u;
    cu.uDepth.value = depth; cu.uHistory.value = rt.cloud[ci ^ 1].texture; cu.uHistoryWeight.value = opts.temporal && !this.dirtyHistory ? 0.88 : 0;
    this.cloudPass.render(rt.cloud[ci]);
    const cloudTex = rt.cloud[ci].texture;
    this.lastCloud = cloudTex;
    // lighting
    const l = this.lightPass.u;
    l.uGA.value = g[0]; l.uGN.value = g[1]; l.uGL.value = g[2]; l.uGM.value = g[3]; l.uDepth.value = depth; l.uAO.value = rt.ao.texture; l.uCloudTex.value = cloudTex; l.uAOon.value = useAO ? 1 : 0;
    l.uPixelAngle.value = 2 * Math.tan(cam.fov * Math.PI / 360) / this.H;
    this.lightPass.render(rt.hdrA);
    // reflections + depth transfer
    const s = this.ssrPass.u;
    s.uScene.value = rt.hdrA.texture; s.uOpaqueDepth.value = depth; s.uGA.value = g[0]; s.uGN.value = g[1]; s.uGL.value = g[2]; s.uGM.value = g[3]; s.uAO.value = rt.ao.texture; s.uAOon.value = useAO ? 1 : 0;
    this.ssrPass.render(rt.hdrB);
    // water and glass
    this.forwardTex.uScene.value = rt.hdrA.texture; this.forwardTex.uOpaqueDepth.value = depth;
    r.setRenderTarget(rt.hdrB);
    r.render(this.scenes.water, cam);
    r.render(this.scenes.glass, cam);
    // volumetrics
    const v = this.volPass.u;
    v.uDepth.value = rt.hdrB.depthTexture;
    this.volPass.render(rt.vol);
    const c = this.compPass.u;
    c.uScene.value = rt.hdrB.texture; c.uDepth.value = rt.hdrB.depthTexture; c.uVol.value = rt.vol.texture; c.uVolRes.value.set(rt.vol.width, rt.vol.height);
    this.compPass.render(rt.comp);
    // particles and other effects (they depth-test against the forward depth themselves)
    if (opts.effects) opts.effects(rt.hdrB.depthTexture);
    r.setRenderTarget(rt.comp);
    r.render(this.scenes.fx, cam);
  },

  exposureAndBloom(src, dt, instant) {
    const rt = this.rt;
    this.lumPass.u.uSrc.value = src; this.lumPass.render(rt.lum[0]);
    for (let i = 1; i < 4; i++) { this.reducePass.u.uSrc.value = rt.lum[i - 1].texture; this.reducePass.u.uFactor.value = 4; this.reducePass.render(rt.lum[i]); }
    this.expIdx = (this.expIdx || 0) ^ 1;
    const a = this.adaptPass.u;
    a.uAvg.value = rt.lum[3].texture; a.uPrev.value = rt.exp[this.expIdx ^ 1].texture; a.uDt.value = dt; a.uInstant.value = instant ? 1 : 0; a.uComp.value = 1.0;
    this.adaptPass.render(rt.exp[this.expIdx]);
    let s = src, w = this.W, h = this.H;
    for (let i = 0; i < 6; i++) {
      this.downPass.u.uSrc.value = s; this.downPass.u.uTexel.value.set(1 / w, 1 / h); this.downPass.u.uFirst.value = i === 0 ? 1 : 0;
      this.downPass.render(rt.down[i]); s = rt.down[i].texture; w = rt.down[i].width; h = rt.down[i].height;
    }
    let prev = rt.down[5].texture;
    for (let i = 4; i >= 0; i--) {
      this.upPass.u.uSrc.value = prev; this.upPass.u.uBase.value = rt.down[i].texture; this.upPass.u.uTexel.value.set(1 / rt.down[i + 1].width, 1 / rt.down[i + 1].height);
      this.upPass.render(rt.up[i]); prev = rt.up[i].texture;
    }
    return prev;
  },
  present(hdrTex, bloomTex, opts) {
    const rt = this.rt, G = this.grade, t = this.tonePass.u;
    t.uScene.value = hdrTex; t.uBloom.value = bloomTex; t.uExposure.value = rt.exp[this.expIdx].texture; t.uDepth.value = rt.hdrB.depthTexture; t.uCloudTex.value = this.lastCloud;
    t.uRes.value.set(this.W, this.H);
    const sun = V3().copy(U.uSunDir.value).multiplyScalar(1000).add(this.camera.position).project(this.camera);
    const front = V3(0, 0, -1).applyQuaternion(this.camera.quaternion).dot(U.uSunDir.value) > 0.15;
    t.uSunUV.value.set(front ? sun.x * 0.5 + 0.5 : -9, front ? sun.y * 0.5 + 0.5 : -9);
    const sd = this.lightPass.u.uSunDisc.value;
    const m = Math.max(sd.x, sd.y, sd.z, 1e-3);
    t.uSunFlareColor.value.set(sd.x / m, sd.y / m, sd.z / m).multiplyScalar(Math.min(1, m / 120) * 1.0);
    t.uFlareAmt.value = G.flare * (1 - U.uStorm.value) * (U.uUnderwater.value > 0.5 ? 0 : 1);
    t.uBloomAmt.value = G.bloom; t.uVignette.value = G.vignette; t.uCA.value = G.ca; t.uExpScale.value = G.expComp; t.uSat.value = G.sat; t.uContrast.value = G.contrast; t.uTint.value.copy(G.tint); t.uLift.value.copy(G.lift);
    this.tonePass.render(rt.ldr);
    const sh = this.sharpPass.u;
    sh.uSrc.value = rt.ldr.texture; sh.uTexel.value.set(1 / this.outW, 1 / this.outH); sh.uSharp.value = G.sharp; sh.uGrain.value = G.grain; sh.uGrainSeed.value = opts.grainSeed || (this.frameIndex % 64);
    sh.uDownsample.value = this.W > this.outW * 1.5 ? 1 : 0;
    if (sh.uDownsample.value) sh.uTexel.value.set(1 / this.W, 1 / this.H);
    this.sharpPass.render(null);
  },
  prepareSky() {
    Sky.render(this.camera.position.y);
    const sunY = U.uSunDir.value.y;
    const tr = Sky.transmittance(0.25, Math.max(sunY, 0.0));
    const vis = sstep(-0.03, 0.015, sunY);
    this.lightPass.u.uSunDisc.value.set(tr[0] * 820 * vis, tr[1] * 820 * vis, tr[2] * 820 * vis);
    this._fwdShared.uSunDisc.value.copy(this.lightPass.u.uSunDisc.value);
  },

  // real-time frame with temporal anti-aliasing
  renderFrame(dt, opts) {
    this.frameIndex++;
    U.uFrame.value = this.frameIndex % 1024;
    const ji = (this.frameIndex % 8) + 1;
    const jx = Q.taa ? halton(ji, 2) - 0.5 : 0, jy = Q.taa ? halton(ji, 3) - 0.5 : 0;
    this.setCamera(jx, jy);
    this.prepareSky();
    this.renderShadows(this.camera);
    this.renderScene(Object.assign({ temporal: true }, opts));
    const rt = this.rt;
    const ti = this.frameIndex & 1;
    const u = this.taaPass.u;
    u.uCurrent.value = rt.comp.texture; u.uHistory.value = rt.taa[ti ^ 1].texture; u.uDepth.value = rt.hdrB.depthTexture; u.uGM.value = rt.gbuf.textures[3]; u.uRes.value.set(this.W, this.H); u.uReset.value = this.dirtyHistory ? 1 : 0;
    this.taaPass.render(rt.taa[ti]);
    const bloom = this.exposureAndBloom(rt.taa[ti].texture, dt, this.dirtyHistory);
    this.present(rt.taa[ti].texture, bloom, {});
    this.prevViewProj.copy(this.viewProjUnjit);
    this.dirtyHistory = false;
  },
};

// ---------------------------------------------------------------- main
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const canvas = document.getElementById('view');
const status = document.getElementById('status');
if (RENDER) status.style.display = 'none';

function chooseSize() {
  if (RENDER) return +(params.get('res') || 2160);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return Math.max(480, Math.min(+(params.get('res') || 1440), Math.floor(Math.min(innerWidth, innerHeight) * dpr)));
}

async function main() {
  const t0 = performance.now();
  const N = chooseSize();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: RENDER, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(N, N, false);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const quality = N >= 1000 ? 1 : 0.5;

  // ---- grow every crystal in the film ----
  const { placed, columns } = layoutNeighbours();
  const capJobs = [3, 5, 9, 11, 15, 17].map((s) => ({ layers: SIM.neighbourHistory(s * 13 + 1), R: 110, maxSteps: 60000, margin: 45 }));
  const jobs = [{ hero: true, R: 440, maxSteps: 200000, margin: 70 }, ...neighbourJobs(placed), ...capJobs];
  let heroSteps = 0, doneJobs = 0;
  const results = await runJobs(jobs, (done, total, heroStep) => {
    if (heroStep !== undefined) heroSteps = heroStep; else doneJobs = done;
    status.textContent = `growing ${jobs.length} snow crystals on the lattice · ${doneJobs}/${jobs.length} done · hero crystal step ${heroSteps.toLocaleString()} of ${SIM.HERO_STEPS.toLocaleString()}`;
  });
  const hero = results[0];
  const growMs = performance.now() - t0;
  status.textContent = 'knitting the mitten…';
  await new Promise((r) => setTimeout(r, 30));

  // ---- hero crystal ----
  const heroWedge = SIM.makeWedge(hero.R);
  const heroField = { lattice: latticeTexture(hero), E: hero.radius * 1.04, ageSpan: hero.steps, R: hero.R };
  const cellMM = HERO_RADIUS_MM / hero.radius;
  const heroUnitMM = heroField.E * cellMM;        // millimetres per crystal-local unit
  const FIELD = N >= 1400 ? 2048 : 1536;
  const heroBuilder = new FieldBuilder(renderer, FIELD);
  const heroHeight = makeHeightRT(FIELD, renderer);
  const hollows = findSealedHollows(hero, heroWedge);
  const pockets = findAirPockets(hero, heroWedge).concat(hollows);
  const bubbles = bubbleTexture(renderer, pockets, heroField.E, 1536, hero.steps);

  const lights = {
    uEnvTop: { value: new THREE.Vector3() }, uEnvMid: { value: new THREE.Vector3() }, uEnvLow: { value: new THREE.Vector3() },
    uKeyCol: { value: new THREE.Vector3(0.65, 0.82, 1) }, uRimCol: { value: new THREE.Vector3(1, 0.54, 0.25) },
    uSweep: { value: 0 }, uSweepDir: { value: new THREE.Vector3(0, 0, 1) },
    uBg: { value: null }, uRes: { value: new THREE.Vector2(N, N) }, uRefract: { value: 0.15 },
  };
  const milk = { value: 1 };

  const iceScene = new THREE.Scene();
  const opaqueScene = new THREE.Scene();

  const heroGroup = new THREE.Group();
  const heroMesh = makeIceMesh(lights, heroHeight.texture, FIELD, { bubbles, seed: 1 });
  heroMesh.material.uniforms.uMilk = milk;
  heroMesh.scale.setScalar(heroUnitMM);
  heroGroup.add(heroMesh);
  const seedMesh = makePrismMesh(lights);
  seedMesh.scale.setScalar(heroUnitMM);
  heroGroup.add(seedMesh);
  iceScene.add(heroGroup);

  const grainGroup = new THREE.Group();
  const grain = makeGrain(lights);
  grain.scale.multiplyScalar(heroUnitMM);
  grainGroup.add(grain);
  opaqueScene.add(grainGroup);

  const vapour = makeVapour(lights, 2100);
  const vapourScene = new THREE.Scene();
  const vapourGroup = new THREE.Group();
  vapourGroup.add(vapour);
  vapourScene.add(vapourGroup);

  // ---- the mitten and everything resting on it ----
  const mit = {
    uniforms: {
      uKeyW: { value: MIT.keyW }, uRimW: { value: MIT.rimW },
      uKeyWCol: { value: new THREE.Vector3(2.05, 2.55, 3.5) }, uRimWCol: { value: new THREE.Vector3(4.3, 2.05, 0.8) },
      uAmb: { value: new THREE.Vector3(0.25, 0.33, 0.53) },
      uShadowTex: { value: null }, uHeroH: { value: heroHeight.texture }, uHeroInv: { value: new THREE.Matrix4() },
      uHeroP: { value: new THREE.Vector3() }, uHeroN: { value: new THREE.Vector3(0, 1, 0) }, uHeroOn: { value: 0 }, uDetail: { value: 1 },
    },
  };
  const mitten = new THREE.Group();
  mitten.add(buildBody(mit));
  const yarn = buildYarn(mit);
  mitten.add(yarn.mesh);
  mitten.add(buildSleeve(mit));
  mitten.add(buildDusting(mit));
  const heightAt = makeHeightMap(yarn.positions);
  const heroRest = restingFrame(heightAt, 0, 0, HERO_RADIUS_MM * 0.9, 0);
  const restPos = new THREE.Vector3(0, heroRest.y + 0.20, 0);

  const flakeBuilder = new FieldBuilder(renderer, 512);
  const flakes = [];
  const buildFlakeField = (res, seed) => {
    const field = { lattice: latticeTexture(res), E: res.radius * 1.04, ageSpan: res.steps, R: res.R };
    const rt = makeHeightRT(512, renderer);
    flakeBuilder.build(field, res.steps + 1000, 40, rt);
    field.lattice.dispose();
    const mesh = makeIceMesh(lights, rt.texture, 512, { seed });
    mesh.material.uniforms.uGlintAmt.value = 0.35;
    mesh.material.uniforms.uMilk = milk;
    return { mesh, height: rt.texture, E: field.E, radiusCells: res.radius };
  };
  const rndF = makeRng(606);
  const clearances = [{ x: 0, z: 0, r: HERO_RADIUS_MM * 1.02, y: restPos.y }];
  placed.forEach((p, i) => {
    const f = buildFlakeField(results[1 + i], 2 + (i % 17));
    const rf = restingFrame(heightAt, p[0], p[1], p[2], 0);
    const normal = rf.normal.clone().add(new THREE.Vector3((rndF() - 0.5) * 0.16, 0, (rndF() - 0.5) * 0.16)).normalize();
    const y = rf.y + 0.09 + rndF() * 0.09;
    f.mesh.position.set(p[0], y, p[1]);
    f.mesh.quaternion.copy(flakeQuaternion(normal, rndF() * Math.PI * 2));
    f.mesh.scale.setScalar(p[2] * f.E / f.radiusCells);
    f.mesh.material.uniforms.uBright.value = 0.96 + 0.1 * rndF();
    mitten.add(f.mesh);
    flakes.push(f);
    clearances.push({ x: p[0], z: p[1], r: p[2], y });
  });
  const iceGroupOnWool = new THREE.Group();
  flakes.forEach((f) => iceGroupOnWool.add(f.mesh));
  const caps = capJobs.map((_, i) => buildFlakeField(results[1 + placed.length + i], 21 + i));
  let capAt = 0;
  for (const spec of columns) {
    const pair = spec.kind === 'capped' ? [caps[capAt++], caps[capAt++]] : null;
    iceGroupOnWool.add(buildColumnCrystal(lights, spec, heightAt, pair));
    clearances.push({ x: spec.x, z: spec.z, r: 0.8, y: heightAt(spec.x, spec.z) + 0.3 });
  }
  iceScene.add(iceGroupOnWool);
  const fibres = buildFibres(mit, yarn.roots, clearances);
  mitten.add(fibres);
  const grains = buildGrains(mit, heightAt, clearances);
  mitten.add(grains);
  opaqueScene.add(mitten);
  iceGroupOnWool.updateMatrixWorld(true);
  mit.uniforms.uShadowTex.value = renderFlakeShadows(renderer, flakes);

  // ---- backdrops and post ----
  const half = N >> 1;
  const clock = makeGrowthClock(hero);
  const director = makeDirector(clock, cellMM, restPos);
  const valley = makeValley();
  // 2x supersampled and box filtered, rather than multisampled: thousands of
  // overlapping sub-pixel pines did not resolve bit-identically with MSAA
  const valleyRT = makeRT(half * 2, half * 2, { depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const boxDown = fsPass('uniform sampler2D uTex; void main(){ ivec2 p = ivec2(gl_FragCoord.xy)*2; outColor = 0.25*(texelFetch(uTex, p, 0) + texelFetch(uTex, p + ivec2(1,0), 0) + texelFetch(uTex, p + ivec2(0,1), 0) + texelFetch(uTex, p + ivec2(1,1), 0)); }', { uTex: { value: null } });
  const valleySmall = makeRT(half, half);
  const valleyA = makeRT(half, half), valleyB = makeRT(half, half);
  const blurPass = fsPass(FIELD_BLUR, { uTex: { value: null }, uStep: { value: new THREE.Vector2() }, uSigma: { value: 1 } });
  const bgRT = makeRT(half, half);
  const cloud = makeCloudPass();
  const motes = makeBokeh(520, 11, { sizeMin: 0.0035, sizeMax: 0.075, soft: 0.40, speed: 0.17, clear: 0.5 });
  const bigBokeh = makeBokeh(70, 23, { sizeMin: 0.03, sizeMax: 0.17, soft: 0.62, speed: 0.12, clear: 0.6 });
  const snowBack = makeBokeh(640, 37, { sizeMin: 0.0030, sizeMax: 0.030, soft: 0.50, speed: 1.0 });
  const snowFront = makeBokeh(30, 53, { sizeMin: 0.010, sizeMax: 0.085, soft: 0.66, speed: 1.25, clear: 0.9 });
  const frontMotes = makeBokeh(16, 71, { sizeMin: 0.05, sizeMax: 0.24, soft: 0.85, speed: 0.42, clear: 1.0 });
  const sparkles = makeBokeh(170, 83, { sizeMin: 0.0015, sizeMax: 0.0065, soft: 0.75, speed: 0.34, clear: 0.2 });

  const opaqueRT = makeRT(N, N, { samples: 4, depthBuffer: true });
  opaqueRT.depthTexture = new THREE.DepthTexture(N, N, THREE.UnsignedIntType);
  const refrRT = makeRT(N, N, { minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true });
  const sceneRT = makeRT(N, N, { depthBuffer: true });
  sceneRT.depthTexture = new THREE.DepthTexture(N, N, THREE.UnsignedIntType);
  const copy = fsPass('uniform sampler2D uTex; void main(){ outColor = textureLod(uTex, vUv, 0.0); }', { uTex: { value: null } });
  // the backdrop is the first thing drawn in the opaque pass, so the
  // multisampled target is filled and resolved exactly once per frame
  const backdrop = new THREE.Mesh(fsqGeo, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: { uTex: { value: bgRT.texture } }, depthTest: false, depthWrite: false,
    vertexShader: 'out vec2 vUv; void main(){ vUv = position.xy*0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; void main(){ o = vec4(textureLod(uTex, vUv, 0.0).rgb, 1.0); }',
  }));
  backdrop.frustumCulled = false; backdrop.renderOrder = -1000;
  opaqueScene.add(backdrop);
  const copyDepth = fsPass('uniform sampler2D uTex, uDepth; void main(){ outColor = textureLod(uTex, vUv, 0.0); gl_FragDepth = textureLod(uDepth, vUv, 0.0).r; }',
    { uTex: { value: null }, uDepth: { value: null } }, { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth });
  const post = new Post(renderer, N, quality);
  lights.uBg.value = refrRT.texture;

  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 5000);
  const basis = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const heroN = new THREE.Vector3(), tmpV = new THREE.Vector3();
  let builtKey = null;

  function frame(t) {
    t = clamp(t, 0, FILM);
    const s = director.state(t);
    renderer.setClearColor(0x000000, 0);

    // the crystal at this instant of its life
    const key = s.S.toFixed(2) + '|' + s.soft.toFixed(2);
    if (key !== builtKey) { heroBuilder.build(heroField, s.S, s.soft, heroHeight); builtKey = key; }

    lights.uEnvTop.value.fromArray(s.envTop); lights.uEnvMid.value.fromArray(s.envMid); lights.uEnvLow.value.fromArray(s.envLow);
    lights.uKeyCol.value.fromArray(s.keyCol); lights.uRimCol.value.fromArray(s.rimCol);
    milk.value = s.milk;

    camera.fov = 20; camera.near = s.near; camera.far = s.far;
    camera.position.copy(s.camPos); camera.quaternion.copy(s.camQuat);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);

    heroGroup.position.copy(s.flakePos); heroGroup.quaternion.copy(s.quat);
    heroGroup.updateMatrixWorld(true);
    grainGroup.position.copy(s.flakePos); grainGroup.quaternion.copy(s.quat);
    grain.rotation.set(0.5 + t * 0.9 * (1 - sstep(1.2, 2.4, t)) + 1.1 * sstep(1.2, 2.4, t), t * 1.3 * (1 - sstep(1.2, 2.4, t)) + 2.0 * sstep(1.2, 2.4, t), 0.3);
    grain.material.uniforms.uGlint.value = s.grainGlint;

    const hm = heroMesh.material.uniforms;
    hm.uOpacity.value = s.crystalOpacity;
    hm.uArmAmt.value = s.armAmt; hm.uArmAngle.value = s.armAngle; hm.uArmRest.value = s.armRest;
    hm.uStepFrac.value = Math.min(1.05, s.S / hero.steps);
    heroMesh.visible = s.crystalOpacity > 0.001;

    const su = seedMesh.material.uniforms;
    seedMesh.visible = s.dropOpacity > 0.001;
    su.uOpacity.value = s.dropOpacity;
    su.uSphereR.value = s.dropR * CELL;
    su.uRadius.value = s.prismR * CELL;
    su.uHalfH.value = s.prismR * CELL * s.prismAspect;
    su.uMorph.value = s.morph; su.uFrost.value = s.frost; su.uFront.value = s.front;
    su.uBright.value = 1 + 0.5 * s.flash;

    // finale: a warm lamp swings round the six arms
    heroN.set(0, 0, 1).applyQuaternion(s.quat);
    const nv = heroN.clone().applyQuaternion(q.copy(s.camQuat).invert());
    const V = new THREE.Vector3(0, 0, 1);
    const R = nv.clone().multiplyScalar(2 * nv.dot(V)).sub(V).normalize();
    const a = s.sweepAngle;
    R.add(tmpV.set(Math.cos(a) * 0.55, Math.sin(a) * 0.42, 0.10 * Math.sin(a * 2)).multiplyScalar(s.sweepOffset)).normalize();
    lights.uSweepDir.value.copy(R);
    lights.uSweep.value = s.sweep;

    mitten.visible = s.mittenOn;
    iceGroupOnWool.visible = s.mittenOn;
    mit.uniforms.uHeroOn.value = s.mittenOn ? 1 : 0;
    const detail = 1 - sstep(170, 520, s.dist);
    mit.uniforms.uDetail.value = detail;
    yarn.mesh.visible = detail > 0.01;
    grains.visible = detail > 0.6;
    mit.uniforms.uHeroP.value.copy(s.flakePos);
    mit.uniforms.uHeroN.value.copy(heroN.y < 0 ? heroN.clone().negate() : heroN);
    heroMesh.updateMatrixWorld(true);
    mit.uniforms.uHeroInv.value.copy(heroMesh.matrixWorld).invert();
    fibres.material.uniforms.uPxAngle.value = 2 * Math.tan(10 * D2R) / N;

    // ---- backdrop ----
    if (s.valleyOn) {
      const vc = valley.camera;
      vc.position.set(8 * Math.sin(t * 0.3), s.vAlt, -(t - 15) * 7);
      vc.quaternion.setFromEuler(eul.set(s.vPitch, s.vYaw, 0));
      vc.updateMatrixWorld(true);
      valley.update(t);
      renderer.setRenderTarget(valleyRT); renderer.clear(); renderer.render(valley.scene, vc);
      boxDown.u.uTex.value = valleyRT.texture; boxDown.render(renderer, valleySmall);
      // macro depth of field: the valley stays readable but soft
      const sigma = lerp(2.1, 4.6, sstep(17.2, 18.45, t)) * half / 1080;
      const bu = blurPass.u;
      bu.uSigma.value = sigma;
      bu.uTex.value = valleySmall.texture; bu.uStep.value.set(1 / half, 0); blurPass.render(renderer, valleyA);
      bu.uTex.value = valleyA.texture; bu.uStep.value.set(0, 1 / half); blurPass.render(renderer, valleyB);
    }
    const cu = cloud.u;
    basis.makeRotationFromQuaternion(s.camQuat); cu.uBasis.value.setFromMatrix4(basis);
    cu.uTime.value = t; cu.uFall.value = s.fall; cu.uDensity.value = s.density; cu.uBand.value = s.band; cu.uBandAmt.value = s.bandAmt;
    cu.uTop.value.fromArray(s.top); cu.uBot.value.fromArray(s.bot); cu.uMist.value.fromArray(s.mist); cu.uSunCol.value.fromArray(s.sun);
    cu.uWarm.value.set(0.46, 0.185, 0.070); cu.uWarmAmt.value = s.warm; cu.uReveal.value = s.reveal;
    cu.uValleyOn.value = s.valleyOn ? 1 : 0; cu.uValley.value = valleyB.texture;
    cloud.render(renderer, bgRT);

    const zoom = 1 + 0.10 * Math.sin(t * 0.21);
    const mistA = [s.mist[0] * 1.25 + 0.045, s.mist[1] * 1.25 + 0.075, s.mist[2] * 1.2 + 0.115];
    const cloudAmt = 1 - s.reveal;
    if (cloudAmt > 0.002) {
      for (const [b, gain] of [[bigBokeh, 0.34], [motes, 0.70]]) {
        b.u.uTime.value = t; b.u.uTravel.value = s.fall * 0.92; b.u.uZoom.value = zoom;
        b.u.uColA.value.fromArray(mistA); b.u.uColB.value.set(0.62, 0.30, 0.12);
        b.u.uAmount.value = cloudAmt * gain * (0.45 + 0.75 * s.density);
        b.render(renderer, bgRT);
      }
    }
    if (s.reveal > 0.002) {
      const u = snowBack.u;
      u.uTime.value = t; u.uTravel.value = s.snowTravel; u.uZoom.value = 1;
      u.uColA.value.set(0.30, 0.38, 0.56); u.uColB.value.set(0.70, 0.46, 0.34);
      u.uAmount.value = s.reveal * 0.55;
      snowBack.render(renderer, bgRT);
    }

    // ---- opaque things ----
    renderer.setRenderTarget(opaqueRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(opaqueScene, camera);

    copy.u.uTex.value = opaqueRT.texture;
    copy.render(renderer, refrRT);

    // ---- ice ----
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    copyDepth.u.uTex.value = opaqueRT.texture; copyDepth.u.uDepth.value = opaqueRT.depthTexture;
    copyDepth.render(renderer, sceneRT);
    renderer.setRenderTarget(sceneRT);
    renderer.render(iceScene, camera);

    // ---- lens ----
    const lens = s.lens;
    lens.tilt = s.mittenOn ? sstep(18.3, 18.95, t) : 0;
    if (lens.tilt > 0) {
      const pv = s.flakePos.clone().applyMatrix4(camera.matrixWorldInverse);
      const nvw = heroN.clone().transformDirection(camera.matrixWorldInverse);
      const ndc = s.flakePos.clone().project(camera);
      lens.planeP = pv; lens.planeN = nvw;
      lens.centre = [ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5];
      lens.radius = 0.5 * HERO_RADIUS_MM / s.halfWidth;
    }
    const out = post.dof(sceneRT, lens);

    if (s.vapour > 0.001) {
      const vu = vapour.material.uniforms;
      vapourGroup.position.copy(s.flakePos); vapourGroup.quaternion.copy(s.camQuat);
      vapour.scale.setScalar(heroUnitMM);
      vu.uTime.value = t; vu.uView.value = s.halfWidth / heroUnitMM;
      vu.uUnitMM.value = heroUnitMM;
      vu.uSurface.value = Math.max(t < 3.3 ? s.dropR : 0, s.radiusCells * 0.92, 3.5) * CELL;
      vu.uAmount.value = s.vapour * (0.15 + 0.17 * (1 - sstep(2.6, 4.2, t)));
      vu.uCol.value.setRGB(0.36 + s.mist[0], 0.55 + s.mist[1] * 0.8, 0.78 + s.mist[2] * 0.5);
      renderer.setRenderTarget(out);
      renderer.render(vapourScene, camera);
    }
    if (cloudAmt > 0.002) {
      let u = sparkles.u;
      u.uTime.value = t * 1.6; u.uTravel.value = s.fall; u.uZoom.value = zoom;
      u.uColA.value.set(0.60, 0.82, 1.05); u.uColB.value.set(1.2, 0.75, 0.40);
      u.uAmount.value = cloudAmt * 0.50 * (0.5 + 0.6 * s.density);
      sparkles.render(renderer, out);
      u = frontMotes.u;
      u.uTime.value = t; u.uTravel.value = s.fall; u.uZoom.value = zoom;
      u.uColA.value.fromArray(mistA); u.uColB.value.set(0.50, 0.24, 0.10);
      u.uAmount.value = cloudAmt * 0.17;
      frontMotes.render(renderer, out);
    }
    if (s.reveal > 0.002) {
      const u = snowFront.u;
      u.uTime.value = t; u.uTravel.value = s.snowTravel; u.uZoom.value = 1;
      u.uColA.value.set(0.36, 0.45, 0.65); u.uColB.value.set(0.80, 0.52, 0.36);
      u.uAmount.value = s.reveal * 0.30;
      snowFront.render(renderer, out);
    }

    post.finish(out, { exposure: s.exposure, bloom: s.bloom, star: s.star, vignette: 0.40, frame: Math.round(t * 30), fade: 1 });
    return s;
  }

  const info = () => {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', size: N, growMs: Math.round(growMs), setupMs: Math.round(performance.now() - t0),
      heroSteps: hero.steps, heroRadius: hero.radius, crystals: jobs.length, pockets: pockets.length, sealedHollows: hollows.length, trees: valley.treeCount,
    };
  };

  // warm up every program so the first captured frame is complete
  for (const t of [1.0, 3.0, 8.0, 15.6, 18.4, 19.8]) frame(t);
  renderer.getContext().finish();
  status.style.display = 'none';

  if (RENDER) {
    window.renderAt = (t) => { frame(t); };
    window.filmInfo = info();
    window.__dbg = { THREE, renderer, opaqueScene, mitten, fibres, yarn: yarn.mesh, iceScene, valley, grains, iceGroupOnWool, post, opaqueRT, sceneRT, bgRT, heroHeight };
    window.grabFrame = () => {
      const gl = renderer.getContext();
      renderer.setRenderTarget(null);
      const px = new Uint8Array(N * N * 4);
      gl.readPixels(0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    window.__ready = true;
    renderAt(0);
  } else {
    console.log('film ready', info());
    // the film clock advances by capped frame steps, so a stall (shader warm-up,
    // a background tab) pauses the story instead of skipping part of it
    const at = parseFloat(params.get('t'));
    let clockT = Number.isFinite(at) ? at : 0, last = null, paused = false;
    const loop = () => {
      const now = performance.now();
      if (last !== null && !paused) clockT += Math.min((now - last) / 1000, 0.1);
      last = now;
      if (clockT > FILM + 1.5) clockT = 0;       // hold the final macro, then replay
      window.__filmTime = clockT;
      frame(Math.min(clockT, FILM));
      requestAnimationFrame(loop);
    };
    addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); paused = !paused; } });
    canvas.addEventListener('click', () => { clockT = 0; paused = false; });
    requestAnimationFrame(loop);
  }
}

main().catch((e) => {
  console.error(e);
  status.style.display = 'block';
  status.textContent = 'could not start: ' + e.message;
  window.__error = String(e.stack || e);
});

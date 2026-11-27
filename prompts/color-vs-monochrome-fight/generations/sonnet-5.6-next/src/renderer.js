// renderer.js — the multi-pass cel pipeline
const SUN_DIR = V.norm([-0.55, 0.78, 0.46]);
const OUT_W = 1920, OUT_H = 1080;

class Renderer {
  constructor(canvas, ss) {
    glInit(canvas);
    this.canvas = canvas;
    this.ss = ss;
    const W = this.W = Math.round(OUT_W * ss), H = this.H = Math.round(OUT_H * ss);
    // G-buffer
    this.tColor = texRGBA8(W, H, gl.LINEAR);
    this.tND = texRGBA16F(W, H, gl.NEAREST);
    this.tId = texRGBA8(W, H, gl.NEAREST);
    this.tDepth = texDepth(W, H);
    this.fScene = makeFBO([this.tColor, this.tND, this.tId], this.tDepth);
    // smoke
    this.tSmA = texRGBA8(W, H, gl.NEAREST);
    this.tSmD = texR32F(W, H);
    this.tSmZ = texDepth(W, H);
    this.fSmoke = makeFBO([this.tSmA, this.tSmD], this.tSmZ);
    this.tInk = texRGBA8(W, H, gl.LINEAR);
    this.fInk = makeFBO([this.tInk]);
    this.tFx = texRGBA8(W, H, gl.LINEAR);
    this.fFx = makeFBO([this.tFx], this.tDepth);
    // output resolution
    this.tBase = texRGBA8(OUT_W, OUT_H, gl.LINEAR);
    this.tMask = texRGBA8(OUT_W, OUT_H, gl.LINEAR);
    this.fDown = makeFBO([this.tBase, this.tMask]);
    this.tFxD = texRGBA8(OUT_W, OUT_H, gl.LINEAR);
    this.fFxD = makeFBO([this.tFxD]);
    this.tB1 = texRGBA8(480, 270, gl.LINEAR); this.fB1 = makeFBO([this.tB1]);
    this.tB2 = texRGBA8(480, 270, gl.LINEAR); this.fB2 = makeFBO([this.tB2]);
    // shadow map
    this.tShadow = makeTex(4096, 4096, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, this.tShadow);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.fShadow = makeFBO([], this.tShadow);
    this.tOverlay = texRGBA8(OUT_W, OUT_H, gl.LINEAR);
    this.tCloseup = texRGBA8(OUT_W, OUT_H, gl.LINEAR);
    this.tBlackMask = makeTex(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, new Uint8Array([0, 0, 0, 255]));
    this.tClearFx = makeTex(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, new Uint8Array([0, 0, 0, 0]));

    this.pSky = makeProgram(FS_TRI_VS, FS_SKY, 'sky');
    this.pGround = makeProgram(VS_GROUND, FS_GROUND, 'ground');
    this.pChunk = makeProgram(VS_CHUNK, FS_CHUNK, 'chunk');
    this.pCrack = makeProgram(VS_CRACK, FS_CRACK, 'crack');
    this.pClouds = makeProgram(VS_CLOUDS, FS_CLOUDS, 'clouds');
    this.pChar = makeProgram(VS_CHAR, FS_CHAR, 'char');
    this.pShChar = makeProgram(VS_SHADOW_CHAR, FS_EMPTY, 'shChar');
    this.pShChunk = makeProgram(VS_SHADOW_CHUNK, FS_EMPTY, 'shChunk');
    this.pPuff = makeProgram(VS_PUFF, FS_PUFF, 'puff');
    this.pInk = makeProgram(FS_TRI_VS, FS_INK, 'ink');
    this.pDown = makeProgram(FS_TRI_VS, FS_DOWN, 'down');
    this.pFxDown = makeProgram(FS_TRI_VS, FS_FXDOWN, 'fxdown');
    this.pBright = makeProgram(FS_TRI_VS, FS_BRIGHT, 'bright');
    this.pBlur = makeProgram(FS_TRI_VS, FS_BLUR, 'blur');
    this.pPost = makeProgram(FS_TRI_VS, FS_POST, 'post');
    this.pStar = makeProgram(VS_STAR, FS_STAR, 'star');
    this.pRing = makeProgram(VS_RING, FS_RING, 'ring');
    this.pRibbon = makeProgram(VS_RIBBON, FS_RIBBON, 'ribbon');
    this.pDrop = makeProgram(VS_DROP, FS_DROP, 'drop');
    this.pBlob = makeProgram(VS_BLOB, FS_BLOB, 'blob');

    this.builders = { iro: new MeshBuilder(), sumi: new MeshBuilder(), iroS: new MeshBuilder(), sumiS: new MeshBuilder() };
    const charLayout = [[0, 3], [1, 3], [2, 4], [3, 2]];
    this.charVAO = { iro: makeVAO(charLayout, null), sumi: makeVAO(charLayout, null), iroS: makeVAO(charLayout, null), sumiS: makeVAO(charLayout, null) };
    this.palettes = {};
    for (const k of ['iro', 'sumi']) {
      const lit = [], shd = [], dp = [], pat = [];
      for (let i = 0; i < 40; i++) {
        const m = CHARSTYLE[k].mats[i] || [0xff00ff, 0xff00ff, 0xff00ff, 0];
        lit.push(...hex(m[0])); shd.push(...hex(m[1])); dp.push(...hex(m[2])); pat.push(m[3]);
      }
      this.palettes[k] = { lit, shd, dp, pat };
    }
    // puffs: instanced quads
    this.puffVAO = gl.createVertexArray(); this.puffVBO = gl.createBuffer();
    gl.bindVertexArray(this.puffVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.puffVBO);
    for (let i = 0; i < 2; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 32, i * 16); gl.vertexAttribDivisor(i, 1); }
    gl.bindVertexArray(null);
    this.dropVAO = gl.createVertexArray(); this.dropVBO = gl.createBuffer();
    gl.bindVertexArray(this.dropVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.dropVBO);
    for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, i * 16); gl.vertexAttribDivisor(i, 1); }
    gl.bindVertexArray(null);
    this.ribbonVAO = makeVAO([[0, 3], [1, 4], [2, 4]], null);
    this.blobVAO = makeVAO([[0, 3], [1, 3]], null);
  }

  setWorldGeometry(world) {
    this.chunkVAO = makeVAO([[0, 3], [1, 3], [2, 1], [3, 4], [4, 3]], world.chunkVerts);
    this.groundVAO = makeVAO([[0, 2]], world.groundVerts);
    this.crackVAO = makeVAO([[0, 3], [1, 4]], world.crackVerts);
    this.cloudVAO = makeVAO([[0, 2]], world.cloudVerts);
    this.tChunk = makeTex(1536, Math.ceil(world.chunkCount / 512), gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    this.world = world;
  }

  camera(cam) {
    const fwd = V.norm(V.sub(cam.tgt, cam.pos));
    let right = V.cross(fwd, Math.abs(fwd[1]) > 0.995 ? [0, 0, -1] : [0, 1, 0]); right = V.norm(right);
    let up = V.cross(right, fwd);
    const r = (cam.roll || 0) * D2R;
    up = V.add(V.mul(up, Math.cos(r)), V.mul(right, Math.sin(r)));
    const view = M4.lookAt(cam.pos, cam.tgt, up);
    const dist = V.dist(cam.pos, cam.tgt);
    const near = clamp(dist * 0.04, 0.06, 1.0);
    const proj = M4.perspective(cam.fov * D2R, 16 / 9, near, 3000);
    proj[8] -= (cam.sx || 0) * 2; proj[9] -= (cam.sy || 0) * 2;
    const vp = M4.mul(proj, view);
    return { view, proj, vp, invVP: M4.invert(vp), invView: M4.invert(view), pos: cam.pos, tanY: Math.tan(cam.fov * D2R / 2), right: V.norm(V.cross(fwd, up)), up, fwd };
  }

  project(C, p) {
    const c = M4.tp(C.vp, p);
    if (c[3] <= 0.01) return [0.5, 0.5, -1];
    return [c[0] / c[3] * 0.5 + 0.5, c[1] / c[3] * 0.5 + 0.5, c[3]];
  }

  buildChar(slot, ch) {
    const mb = this.builders[slot];
    mb.reset();
    const rig = ch.rig;
    if (ch.kind === 'iro') buildIro(mb, rig, ch.env); else buildSumi(mb, rig, ch.env);
    if (ch.stretch) mb.squash(0, rig.center, ch.stretch.axis, ch.stretch.along, ch.stretch.across);
    mb.orient();
    updateVAO(this.charVAO[slot], mb.b.a, mb.b.n);
  }

  drawChar(C, slot, ch, S, cls) {
    const st = CHARSTYLE[ch.kind], pal = this.palettes[ch.kind];
    const common = {
      uVP: C.vp, uView: C.view, uCamPos: C.pos, uSunDir: ch.sun || S.sunDir, uClass: cls !== undefined ? cls : st.cls,
      uInk: st.ink, uRimCol: st.rim, uRimDir: ch.rimDir || V.norm([0.7 * (ch.kind === 'iro' ? -1 : 1), 0.45, -0.25]),
      uLit: pal.lit, uShade: pal.shd, uDeep: pal.dp, uPattern: pal.pat, uMono: ch.kind === 'sumi' ? 1 : 0,
      uShadowMap: this.tShadow, uShadowVP: this.shadowVP || C.vp, uShadowOn: S.shadow ? 1 : 0,
      uPxWorld: 2 * C.tanY / OUT_H, uHullPx: st.hullPx * (ch.lineScale || 1), uBoil: ch.boil || 0, uDry: st.dry,
      uAmbientDim: ch.dim !== undefined ? ch.dim : 1, uFill: [-1, 0, 0],
    };
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
    useProgram(this.pChar, Object.assign({ uHull: 1 }, common));
    drawVAO(this.charVAO[slot]);
    gl.disable(gl.CULL_FACE);
    useProgram(this.pChar, Object.assign({ uHull: 0 }, common));
    drawVAO(this.charVAO[slot]);
  }

  groundUniforms(G) {
    const cr = new Float32Array(32), crp = new Float32Array(8), rp = new Float32Array(32);
    (G.craters || []).slice(0, 8).forEach((c, i) => { cr.set([c.x, c.z, c.R, c.depth], i * 4); crp[i] = c.p; });
    (G.ripples || []).slice(0, 8).forEach((c, i) => rp.set([c.x, c.z, c.age, c.amp], i * 4));
    return {
      uCrater: cr, uCraterP: crp, uCraterN: Math.min(8, (G.craters || []).length),
      uFissure: G.fissure || [0, 0, 0, 0], uFisP: G.fisP || 0, uRip: rp, uRipN: Math.min(8, (G.ripples || []).length),
    };
  }
  paintUniforms(P) {
    const a = new Float32Array(48 * 4), b = new Float32Array(48 * 4);
    const list = P.splats || [];
    const start = Math.max(0, list.length - 48);
    let n = 0;
    for (let i = start; i < list.length; i++, n++) {
      const s = list[i];
      a.set([s.p[0], s.p[1], s.p[2], s.r], n * 4);
      b.set([s.type, s.seed, s.birth, s.alpha], n * 4);
    }
    return { uSplatA: a, uSplatB: b, uSplatN: n, uDrain: P.drain || [0, 0, 0, 0], uBloomC: P.bloom || [0, 0, 0, 0], uAsh: P.ash || [0, 0, 0, 0], uAshLum: P.ashLum || 0.5 };
  }

  render(S) {
    const W = this.W, H = this.H;
    S.sunDir = S.sunDir || SUN_DIR;
    const post = S.post || {};
    if (S.closeup) { this.renderPost(S, null, true); return; }
    const C = this.camera(S.camera);
    this.lastCamera = C;
    const chars = S.chars || [];
    const slots = { iro: 'iro', sumi: 'sumi' };
    chars.forEach(ch => { ch.slot = ch.ghost ? slots[ch.kind] + 'S' : slots[ch.kind]; this.buildChar(ch.slot, ch); });

    if (this.world && S.world) {
      gl.bindTexture(gl.TEXTURE_2D, this.tChunk);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1536, this.tChunk.h, gl.RGBA, gl.FLOAT, S.world.chunkData);
    }
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.depthMask(true);
    // ---- shadow map
    if (S.shadow) {
      const c = S.shadow.center, r = S.shadow.radius;
      const eye = V.mad(c, S.sunDir, 200);
      const lv = M4.lookAt(eye, c, [0, 1, 0]);
      // snap to texels so cast shadows do not swim
      const tx = 2 * r / 4096;
      lv[12] = Math.round(lv[12] / tx) * tx; lv[13] = Math.round(lv[13] / tx) * tx;
      this.shadowVP = M4.mul(M4.ortho(-r, r, -r, r, 20, 460), lv);
      bindFBO(this.fShadow);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2);
      if (S.world) { useProgram(this.pShChunk, { uVP: this.shadowVP, uChunkTex: this.tChunk }); drawVAO(this.chunkVAO); }
      useProgram(this.pShChar, { uVP: this.shadowVP });
      for (const ch of chars) if (!ch.ghost) drawVAO(this.charVAO[ch.slot]);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    // ---- G-buffer
    bindFBO(this.fScene);
    const cc = S.clear || [0.6, 0.6, 0.6];
    gl.clearBufferfv(gl.COLOR, 0, [cc[0], cc[1], cc[2], 1]);
    gl.clearBufferfv(gl.COLOR, 1, [0, 0, 1, 4000]);
    gl.clearBufferfv(gl.COLOR, 2, [0, 0, 0, 1]);
    gl.clearBufferfv(gl.DEPTH, 0, [1]);
    const E = S.env || {};
    const envU = {
      uSunDir: S.sunDir, uCamPos: C.pos, uFogCol: E.fogCol || [0.74, 0.74, 0.74], uFogDen: E.fogDen !== undefined ? E.fogDen : 0.0042,
      uSceneDim: E.dim !== undefined ? E.dim : 1,
      uShadowMap: this.tShadow, uShadowVP: this.shadowVP || C.vp, uShadowOn: S.shadow ? 1 : 0,
    };
    if (S.sky) {
      gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
      const sa = new Float32Array(40), sb = new Float32Array(40);
      const sp = (S.sky.splats || []).slice(-10);
      sp.forEach((s, i) => { sa.set([s.dir[0], s.dir[1], s.dir[2], s.r], i * 4); sb.set([s.type, s.seed, s.alpha, 0], i * 4); });
      useProgram(this.pSky, {
        uInvVP: C.invVP, uCamPos2: C.pos, uTime: S.time, uDark: S.sky.dark || 0, uSunDir: S.sunDir,
        uSkyA: sa, uSkyB: sb, uSkyN: sp.length, uSceneDim: envU.uSceneDim, uSkylineErase: S.sky.erase || 0,
        uSkyDrain: S.sky.drain || [0, 0, -1, 0], uSkyBloom: S.sky.bloom || 0, uAltitude: S.sky.altitude ? 1 : 0,
      });
      drawFullscreen();
      gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
    }
    const GU = this.groundUniforms(S.ground || {});
    const PU = this.paintUniforms(S.paint || {});
    if (S.world) {
      if (!S.noGround) {
        useProgram(this.pGround, Object.assign({ uVP: C.vp, uView: C.view, uMacro: S.macro ? 1 : 0, uEnso: (S.ground && S.ground.enso) || [0, 0, 0, 0] }, envU, GU, PU));
        drawVAO(this.groundVAO);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
        useProgram(this.pCrack, Object.assign({ uVP: C.vp, uView: C.view, uTime: S.world.wt, uScour: [WARP(HIT.H13.f + 8) - 0.02, 33] }, envU, GU, PU));
        drawVAO(this.crackVAO);
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
      const gA = new Float32Array(24);
      (S.glass || []).slice(0, 6).forEach((g, i) => gA.set([g.p[0], g.p[1], g.p[2], g.r], i * 4));
      useProgram(this.pChunk, Object.assign({ uVP: C.vp, uView: C.view, uChunkTex: this.tChunk, uGlass: gA }, envU, PU));
      drawVAO(this.chunkVAO);
    }
    if (S.clouds) {
      useProgram(this.pClouds, Object.assign({ uVP: C.vp, uView: C.view, uCloudY: S.clouds.y, uTime: S.time, uHole: S.clouds.hole || [0, 0, 0, 0] }, envU));
      drawVAO(this.cloudVAO);
    }
    for (const ch of chars) this.drawChar(C, ch.slot, ch, S, ch.cls);

    // ---- smoke impostors
    const puffs = S.puffs;
    const smokeOn = puffs && puffs.n > 0;
    bindFBO(this.fSmoke);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 1, [1e9, 0, 0, 0]);
    gl.clearBufferfv(gl.DEPTH, 0, [1]);
    if (smokeOn) {
      useProgram(this.pPuff, { uView: C.view, uProj: C.proj, uSceneND: this.tND, uRes: [W, H] });
      gl.bindVertexArray(this.puffVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.puffVBO);
      gl.bufferData(gl.ARRAY_BUFFER, puffs.a.subarray(0, puffs.n * 8), gl.DYNAMIC_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, puffs.n);
      gl.bindVertexArray(null);
    }
    // ---- ink + smoke composite
    gl.disable(gl.DEPTH_TEST);
    bindFBO(this.fInk);
    const sunView = V.norm(M3.v([C.view[0], C.view[4], C.view[8], C.view[1], C.view[5], C.view[9], C.view[2], C.view[6], C.view[10]], V.norm([-0.45, 0.75, 0.55])));
    useProgram(this.pInk, {
      uColor: this.tColor, uND: this.tND, uId: this.tId, uSmokeA: this.tSmA, uSmokeD: this.tSmD,
      uPx: [1 / W, 1 / H], uSS: this.ss, uSmokeOn: smokeOn ? 1 : 0, uInvView: C.invView,
      uTan: [C.tanY * 16 / 9, C.tanY], uSunView: sunView, uSceneDim: envU.uSceneDim,
    });
    drawFullscreen();
    // ---- FX layer
    this.renderFx(S, C);
    // ---- downsample
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    bindFBO(this.fDown);
    useProgram(this.pDown, { uSrc: this.tInk, uId: this.tId, uSmokeA: this.tSmA, uSmokeD: this.tSmD, uND: this.tND, uPx: [1 / W, 1 / H], uSS: this.ss, uSmokeOn: smokeOn ? 1 : 0 });
    drawFullscreen();
    bindFBO(this.fFxD);
    useProgram(this.pFxDown, { uSrc: this.tFx, uPx: [1 / W, 1 / H], uSS: this.ss });
    drawFullscreen();
    this.renderPost(S, C, false);
  }

  renderFx(S, C) {
    const fx = S.fx || {};
    bindFBO(this.fFx);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.disable(gl.CULL_FACE);
    if (fx.blobs && fx.blobs.n) {
      for (const batch of fx.blobs.batches) {
        updateVAO(this.blobVAO, batch.data, batch.data.length);
        useProgram(this.pBlob, { uVP: C.vp, uCamPos: C.pos, uSunDir: SUN_DIR, uKind: batch.kind, uTime: S.time });
        drawVAO(this.blobVAO);
      }
    }
    gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (fx.rings) for (const r of fx.rings) {
      if (r.noDepth) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
      const n = V.norm(r.n);
      let u = V.cross(n, Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]); u = V.norm(u);
      const v = V.cross(n, u);
      useProgram(this.pRing, { uVP: C.vp, uCenter: r.c, uAxisU: u, uAxisV: v, uR: r.r, uW: r.w, uSeed: r.seed || 0, uDisc: r.disc ? 1 : 0, uAlpha: r.alpha, uKind: r.kind });
      if (!this.emptyVAO) this.emptyVAO = gl.createVertexArray();
      gl.bindVertexArray(this.emptyVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 322);
      gl.bindVertexArray(null);
    }
    gl.enable(gl.DEPTH_TEST);
    if (fx.ribbons && fx.ribbons.n) {
      updateVAO(this.ribbonVAO, fx.ribbons.a, fx.ribbons.n);
      useProgram(this.pRibbon, { uVP: C.vp, uTime: S.time });
      drawVAO(this.ribbonVAO);
    }
    if (fx.drops && fx.drops.n) {
      gl.bindVertexArray(this.dropVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dropVBO);
      gl.bufferData(gl.ARRAY_BUFFER, fx.drops.a.subarray(0, fx.drops.n * 12), gl.DYNAMIC_DRAW);
      useProgram(this.pDrop, { uVP: C.vp, uView: C.view, uCamPos: C.pos });
      gl.bindVertexArray(this.dropVAO);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, fx.drops.n);
      gl.bindVertexArray(null);
    }
    if (fx.stars) {
      for (const s of fx.stars) {
        if (s.behind) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
        useProgram(this.pStar, { uView: C.view, uProj: C.proj, uCenter: s.p, uSize: s.size, uRot: s.rot || 0, uAge: s.age, uSeed: s.seed, uKind: s.kind, uSpikes: s.spikes || 13, uStretch: s.stretch || 1, uPull: s.behind ? 0 : 1 });
        if (!this.emptyVAO) this.emptyVAO = gl.createVertexArray();
        gl.bindVertexArray(this.emptyVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
      }
    }
    gl.disable(gl.BLEND); gl.depthMask(true);
  }

  uploadCanvas(tex, canvas) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  renderPost(S, C, isCloseup) {
    const post = S.post || {};
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    let base = this.tBase, mask = this.tMask, fxt = this.tFxD;
    if (isCloseup) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, this.tCloseup);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, S.closeup);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      base = this.tCloseup; mask = this.tBlackMask; fxt = this.tClearFx;
    }
    // bloom
    const bloomAmt = post.bloom !== undefined ? post.bloom : 0.22;
    bindFBO(this.fB1);
    useProgram(this.pBright, { uSrc: base, uFx: fxt, uThr: 0.86 });
    drawFullscreen();
    for (let it = 0; it < 2; it++) {
      bindFBO(this.fB2); useProgram(this.pBlur, { uSrc: this.tB1, uDir: [(1 + it * 1.4) / 480, 0] }); drawFullscreen();
      bindFBO(this.fB1); useProgram(this.pBlur, { uSrc: this.tB2, uDir: [0, (1 + it * 1.4) / 270] }); drawFullscreen();
    }
    if (S.overlay) this.uploadCanvas(this.tOverlay, S.overlay);
    const waves = (post.waves || []).slice(0, 8);
    const wa = new Float32Array(32), ws = new Float32Array(8);
    waves.forEach((w, i) => { wa.set([w.c[0], w.c[1], w.r, w.w], i * 4); ws[i] = w.s; });
    bindFBO(null, OUT_W, OUT_H);
    useProgram(this.pPost, {
      uBase: base, uMask: mask, uFx: fxt, uBloom: this.tB1, uOverlay: this.tOverlay,
      uWaveA: wa, uWaveS: ws, uWaveN: waves.length, uCA: post.ca || 0, uFrame: S.frame || 0,
      uVig: post.vig !== undefined ? post.vig : 0.30, uGrain: post.grain !== undefined ? post.grain : 0.034,
      uBloomAmt: bloomAmt, uHaze: post.haze || 0,
      uBlurDir: post.blur || [0, 0], uRadialC: post.radialC || [0.5, 0.5], uRadial: post.radial || 0,
      uSpeed: post.speed || 0, uSpeedDark: post.speedDark ? 1 : 0, uSpeedInner: post.speedInner !== undefined ? post.speedInner : 0.30, uSpeedC: post.speedC || [0.5, 0.5],
      uImpact: post.impact || 0, uImpactC: post.impactC || [0.5, 0.5], uImpactSeed: post.impactSeed || 1, uImpactThr: post.impactThr !== undefined ? post.impactThr : 0.46,
      uCrack: post.crack || 0, uCrackC: post.crackC || [0.5, 0.5], uFlash: post.flash || [1, 1, 1, 0],
      uMonoAll: post.monoAll || 0, uHalo: isCloseup ? 0 : (post.halo !== undefined ? post.halo : 1.0), uOverlayOn: S.overlay ? 1 : 0,
      uExposure: post.exposure !== undefined ? post.exposure : 1, uQuiet: post.quiet !== undefined ? post.quiet : 1, uAudit: this.auditMode ? 1 : 0,
    });
    drawFullscreen();
  }

  readPixels(buf) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, OUT_W, OUT_H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }

}

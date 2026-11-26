// WebGPU plumbing: device, textures, pipelines, passes.
const ERRS = window.ERRS = [];
const Q = new URLSearchParams(location.search), RW = +(Q.get('w') || 1920), RH = +(Q.get('h') || 1080), NSUB0 = +(Q.get('n') || 4);
const NXG = 1500, NZG = 1500, LCASC = [997, 211, 47, 11], BIRDV = 66, TOWERV = 60, CITYNX = 44, CITYNZ = 60, CITYN = CITYNX * CITYNZ, NSTAR = 1100000, NDUST = 160000;
const E = {};
// JONSWAP spectrum. U10 is sea.wind, straight from the typed line.
function makeSpectrum(wind, sunAz) {
  const N = 256, g = 9.81, F = 260000, R = rng(5505), out = new Float32Array(4 * N * N * 4), modes = [];
  const wp = 22 * Math.pow(g * g / (wind * F), 1 / 3), al = 0.076 * Math.pow(wind * wind / (F * g), 0.22), wdx = -Math.sin(sunAz + .25), wdz = -Math.cos(sunAz + .25);
  const gauss = () => { const a = Math.max(R(), 1e-9), b = R(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
  const cut = [0, 6 * 2 * Math.PI / LCASC[1], 6 * 2 * Math.PI / LCASC[2], 6 * 2 * Math.PI / LCASC[3], 1e9];
  for (let c = 0; c < 4; c++) {
    const L = LCASC[c], dk = 2 * Math.PI / L, a = new Float32Array(N * N * 2);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const kx = (x < 128 ? x : x - 256) * dk, kz = (y < 128 ? y : y - 256) * dk, k = Math.hypot(kx, kz), r1 = gauss(), r2 = gauss();
      if (k < 1e-6 || k < cut[c] || k >= cut[c + 1]) continue;
      const w = Math.sqrt(g * k), sig = w <= wp ? .07 : .09, r = Math.exp(-Math.pow(w - wp, 2) / (2 * sig * sig * wp * wp));
      let S = al * g * g / Math.pow(w, 5) * Math.exp(-1.25 * Math.pow(wp / w, 4)) * Math.pow(3.3, r);
      const cs = (kx * wdx + kz * wdz) / k, D = (cs > 0 ? 2 / Math.PI * cs * cs : 0) * .9 + .1 / (2 * Math.PI) * (cs > 0 ? 1 : .4);
      S = S * D * (0.5 * Math.sqrt(g / k)) / k; S *= Math.exp(-Math.pow(k * .006, 2)); if (c > 0) S *= 1.25; else S *= 2.1;
      const amp = Math.sqrt(S * dk * dk / 2) / Math.SQRT2; a[(y * N + x) * 2] = r1 * amp; a[(y * N + x) * 2 + 1] = r2 * amp;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, j = ((N - y) % N) * N + (N - x) % N, o = (c * N * N + i) * 4; out[o] = a[i * 2]; out[o + 1] = a[i * 2 + 1]; out[o + 2] = a[j * 2]; out[o + 3] = -a[j * 2 + 1];
      if (c < 2) { const m = Math.hypot(a[i * 2], a[i * 2 + 1]); if (m > .015) { const kx = (x < 128 ? x : x - 256) * dk, kz = (y < 128 ? y : y - 256) * dk; modes.push([m, a[i * 2], a[i * 2 + 1], kx, kz, Math.sqrt(g * Math.hypot(kx, kz))]); } }
    }
  }
  modes.sort((p, q) => q[0] - p[0]); return { data: out, modes: modes.slice(0, 1600) };
}
function seaHeight(sp, x, z, t) { let h = 0; for (const m of sp.modes) { const p = m[3] * x + m[4] * z + m[5] * t; h += 2 * (m[1] * Math.cos(p) - m[2] * Math.sin(p)); } return h; }
async function initEngine() {
  const ad = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' }); if (!ad) throw new Error('no WebGPU adapter');
  const dev = E.dev = await ad.requestDevice({ requiredLimits: { maxBufferSize: 1 << 28, maxStorageBufferBindingSize: 1 << 27 } });
  dev.addEventListener('uncapturederror', e => { ERRS.push(e.error.message); if (ERRS.length < 5) console.log('GPUERR ' + e.error.message.slice(0, 1200)); });
  const TU = GPUTextureUsage, BU = GPUBufferUsage, SS = GPUShaderStage;
  const tex = (w, h, f, usage, o = {}) => dev.createTexture({ size: [w, h, o.d || 1], format: f, usage, mipLevelCount: o.m || 1, dimension: o.dim || '2d' });
  const buf = (n, usage, data) => { const b = dev.createBuffer({ size: n, usage: usage | BU.COPY_DST }); if (data) dev.queue.writeBuffer(b, 0, data); return b; };
  const mod = async (n, code) => { const m = dev.createShaderModule({ label: n, code }); const inf = await m.getCompilationInfo(); for (const x of inf.messages) if (x.type === 'error') { ERRS.push(n + ':' + x.lineNum + ' ' + x.message); console.log('WGSL ' + n + ':' + x.lineNum + ' ' + x.message + ' >> ' + (code.split('\n')[x.lineNum - 1] || '').slice(0, 220)); } return m; };
  Object.assign(E, { tex, buf, W: RW, H: RH });
  const HDR = 'rgba16float', ST = TU.STORAGE_BINDING | TU.TEXTURE_BINDING, RT = TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING;
  E.sRep = dev.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', addressModeW: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 16 });
  E.sClamp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' }); E.sCmp = dev.createSampler({ compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' });
  E.disp = tex(256, 256, HDR, ST, { d: 4, m: 9 }); E.deriv = tex(256, 256, HDR, ST, { d: 4, m: 9 }); E.domeT = tex(4096, 1024, HDR, ST, { m: 9 });
  E.vol = tex(128, 128, 'rgba8unorm', ST, { d: 128, dim: '3d' }); E.foam = tex(1024, 1024, 'rgba8unorm', ST | TU.COPY_DST | TU.COPY_SRC);
  E.lut = tex(PROF.NS, PROF.NA, 'rgba32float', TU.TEXTURE_BINDING | TU.COPY_DST); dev.queue.writeTexture({ texture: E.lut }, PROF.data, { bytesPerRow: PROF.NS * 16 }, [PROF.NS, PROF.NA]);
  E.glyph = tex(GL.CW * GL.n, GL.CH, 'r8unorm', TU.TEXTURE_BINDING | TU.COPY_DST); dev.queue.writeTexture({ texture: E.glyph }, GL.data, { bytesPerRow: GL.CW * GL.n }, [GL.CW * GL.n, GL.CH]);
  const SMW = E.SMW = 4096, SMH = E.SMH = 2560;
  E.shD = tex(SMW, SMH, 'depth32float', RT); E.shC = tex(SMW, SMH, HDR, RT); E.hdr = tex(RW, RH, HDR, RT); E.dep = tex(RW, RH, 'depth32float', RT);
  const rw = E.rw = Math.max(16, RW >> 1), rh = E.rh = Math.max(16, RH >> 1); E.refl = tex(rw, rh, HDR, RT); E.reflD = tex(rw, rh, 'depth32float', RT);
  E.acc = tex(RW, RH, HDR, RT); E.out = tex(RW, RH, 'rgba8unorm', RT | TU.COPY_SRC);
  E.bl = []; { let w = RW, h = RH; for (let i = 0; i < 7; i++) { w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); E.bl.push({ t: tex(w, h, HDR, RT), w, h }); } }
  E.dumC = tex(1, 1, HDR, RT); E.dumD = tex(1, 1, 'depth32float', RT);
  E.sp = makeSpectrum(V_WIND, 42 * Math.PI / 180);
  E.h0 = buf(E.sp.data.byteLength, BU.STORAGE, E.sp.data); E.fft = buf(4 * 65536 * 32, BU.STORAGE); E.fu = buf(16, BU.UNIFORM);
  E.grid = buf((NXG + NZG) * 4, BU.STORAGE); { const B = E.birds, nf = B.data.length, cells = ROSE.NX * ROSE.NY, a = new Float32Array(nf + Math.ceil(cells / 4) * 4 + NBIRD * 4); a.set(B.data, 0); for (let c = 0; c < cells; c++) a[nf + c] = B.isBird[c]; const o2 = nf + Math.ceil(cells / 4) * 4; B.ids.forEach(([ix, iy], i) => { a[o2 + i * 4] = ix; a[o2 + i * 4 + 1] = iy; a[o2 + i * 4 + 2] = 1; }); E.birdB = buf(a.byteLength, BU.STORAGE, a); E.birdOff = [nf / 4, o2 / 4]; } E.tubeB = buf(TUBES.data.byteLength, BU.STORAGE, TUBES.data);
  const idx = new Uint32Array((NXG - 1) * (NZG - 1) * 6); { let k = 0; for (let j = 0; j < NZG - 1; j++) for (let i = 0; i < NXG - 1; i++) { const a = j * NXG + i, b = a + 1, c = a + NXG, d = c + 1; idx[k++] = a; idx[k++] = b; idx[k++] = d; idx[k++] = a; idx[k++] = d; idx[k++] = c; } }
  E.idxN = idx.length; E.idx = buf(idx.byteLength, BU.INDEX, idx);
  E.ub = [0, 1, 2].map(() => buf(1024, BU.UNIFORM)); E.gl = buf(48 * 256, BU.STORAGE); E.su = []; for (let i = 0; i < 8; i++) E.su.push(buf(32, BU.UNIFORM));
  // ---- compute
  const cm = await mod('compute', WGSL.compute), mm = await mod('mips', WGSL.mips), nm = await mod('noise', WGSL.noise), sm = await mod('sky', WGSL.sky);
  const cl = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: SS.COMPUTE, buffer: {} }, { binding: 1, visibility: SS.COMPUTE, buffer: { type: 'read-only-storage' } }, { binding: 2, visibility: SS.COMPUTE, buffer: { type: 'storage' } }, { binding: 3, visibility: SS.COMPUTE, storageTexture: { format: HDR, viewDimension: '2d-array' } }, { binding: 4, visibility: SS.COMPUTE, storageTexture: { format: HDR, viewDimension: '2d-array' } }] });
  const v0 = t => t.createView({ dimension: '2d-array', baseMipLevel: 0, mipLevelCount: 1 });
  E.fftBG = dev.createBindGroup({ layout: cl, entries: [{ binding: 0, resource: { buffer: E.fu } }, { binding: 1, resource: { buffer: E.h0 } }, { binding: 2, resource: { buffer: E.fft } }, { binding: 3, resource: v0(E.disp) }, { binding: 4, resource: v0(E.deriv) }] });
  const cpl = dev.createPipelineLayout({ bindGroupLayouts: [cl] }); E.cp = {}; for (const e of ['spectrum', 'fftRow', 'fftCol', 'assemble']) E.cp[e] = dev.createComputePipeline({ layout: cpl, compute: { module: cm, entryPoint: e } });
  const mp = E.mipP = dev.createComputePipeline({ layout: 'auto', compute: { module: mm, entryPoint: 'mip' } });
  const mipSet = (t, n, layers, w, h) => { const o = []; for (let i = 0; i + 1 < n; i++) o.push({ bg: dev.createBindGroup({ layout: mp.getBindGroupLayout(0), entries: [{ binding: 0, resource: t.createView({ dimension: '2d-array', baseMipLevel: i, mipLevelCount: 1 }) }, { binding: 1, resource: t.createView({ dimension: '2d-array', baseMipLevel: i + 1, mipLevelCount: 1 }) }] }), x: Math.ceil(Math.max(1, w >> (i + 1)) / 8), y: Math.ceil(Math.max(1, h >> (i + 1)) / 8), z: layers }); return o; };
  E.mDisp = mipSet(E.disp, 9, 4, 256, 256); E.mDer = mipSet(E.deriv, 9, 4, 256, 256); E.mDome = mipSet(E.domeT, 9, 1, 4096, 1024);
  { const pv = dev.createComputePipeline({ layout: 'auto', compute: { module: nm, entryPoint: 'vol' } }), pf = dev.createComputePipeline({ layout: 'auto', compute: { module: nm, entryPoint: 'foam' } });
    const en = dev.createCommandEncoder(), c = en.beginComputePass(); c.setPipeline(pv); c.setBindGroup(0, dev.createBindGroup({ layout: pv.getBindGroupLayout(0), entries: [{ binding: 0, resource: E.vol.createView() }] })); c.dispatchWorkgroups(32, 32, 32);
    c.setPipeline(pf); c.setBindGroup(0, dev.createBindGroup({ layout: pf.getBindGroupLayout(0), entries: [{ binding: 1, resource: E.foam.createView() }] })); c.dispatchWorkgroups(128, 128); c.end(); dev.queue.submit([en.finish()]); }
  { const rb = dev.createBuffer({ size: 1024 * 1024 * 4, usage: BU.COPY_DST | BU.MAP_READ }), en = dev.createCommandEncoder(); en.copyTextureToBuffer({ texture: E.foam }, { buffer: rb, bytesPerRow: 4096 }, [1024, 1024]); dev.queue.submit([en.finish()]); await rb.mapAsync(1); let src = new Uint8Array(rb.getMappedRange().slice(0)); rb.unmap();
    const ft = tex(1024, 1024, 'rgba8unorm', TU.TEXTURE_BINDING | TU.COPY_DST, { m: 11 }); let w = 1024; for (let m = 0; m < 11; m++) { dev.queue.writeTexture({ texture: ft, mipLevel: m }, src, { bytesPerRow: w * 4 }, [w, w]); const n = w >> 1; if (n < 1) break; const d = new Uint8Array(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let q = 0; q < 4; q++) d[(y * n + x) * 4 + q] = (src[(y * 2 * w + x * 2) * 4 + q] + src[(y * 2 * w + x * 2 + 1) * 4 + q] + src[((y * 2 + 1) * w + x * 2) * 4 + q] + src[((y * 2 + 1) * w + x * 2 + 1) * 4 + q]) >> 2; src = d; w = n; } E.foamT = ft; }
  E.skyP = dev.createComputePipeline({ layout: 'auto', compute: { module: sm, entryPoint: 'main' } });
  E.skyBG = E.su.map(b => dev.createBindGroup({ layout: E.skyP.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: b } }, { binding: 1, resource: E.vol.createView() }, { binding: 2, resource: E.sRep }, { binding: 3, resource: E.domeT.createView({ baseMipLevel: 0, mipLevelCount: 1 }) }] }));
  // ---- scene bind groups
  const VF = SS.VERTEX | SS.FRAGMENT, T = (b, o = {}) => ({ binding: b, visibility: VF, texture: o });
  const sl = E.sl = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, buffer: {} }, { binding: 1, visibility: VF, sampler: {} }, { binding: 2, visibility: VF, sampler: {} }, T(3, { viewDimension: '2d-array' }), T(4, { viewDimension: '2d-array' }), T(5, { sampleType: 'unfilterable-float' }), T(6), T(7), T(8, { sampleType: 'depth' }), T(9), T(10), { binding: 11, visibility: SS.VERTEX, buffer: { type: 'read-only-storage' } }, { binding: 12, visibility: VF, sampler: { type: 'comparison' } }, { binding: 13, visibility: SS.VERTEX, buffer: { type: 'read-only-storage' } }, T(14, { viewDimension: '3d' }), T(15, { sampleType: 'depth' }), { binding: 16, visibility: VF, buffer: { type: 'read-only-storage' } }] });
  const mk = (ub, shD, shC, refl, dep) => dev.createBindGroup({ layout: sl, entries: [{ buffer: ub }, E.sRep, E.sClamp, E.disp.createView({ dimension: '2d-array' }), E.deriv.createView({ dimension: '2d-array' }), E.lut.createView(), E.domeT.createView(), E.foamT.createView(), shD.createView(), shC.createView(), refl.createView(), { buffer: E.grid }, E.sCmp, { buffer: E.tubeB }, E.vol.createView(), dep.createView(), { buffer: E.birdB }].map((resource, binding) => ({ binding, resource })) });
  E.bgMain = mk(E.ub[0], E.shD, E.shC, E.refl, E.dumD); E.bgRefl = mk(E.ub[1], E.shD, E.shC, E.dumC, E.dumD); E.bgSh = mk(E.ub[2], E.dumD, E.dumC, E.dumC, E.dumD); E.bgVol = mk(E.ub[0], E.shD, E.shC, E.dumC, E.dep);
  const consts = '\nconst BIRD_NF:u32=' + BIRD_NF + 'u; const NBIRDC:u32=' + NBIRD + 'u; const BIRD_OFF1:u32=' + E.birdOff[0] + 'u; const BIRD_OFF2:u32=' + E.birdOff[1] + 'u; const NLANT:u32=' + (CITYN * 160) + 'u; const T_CITY_C=' + T_CITY.toFixed(3) + '; const CITYNX_C:u32=' + CITYNX + 'u; const CITYNZ_C:i32=' + CITYNZ + '; const T_GRAV_C=' + T_GRAV.toFixed(3) + '; const T_FLY_C=' + T_FLY.toFixed(3) + '; const T_SEA_C=' + T_SEA.toFixed(3) + '; const T_TIME_C=' + T_TIME.toFixed(3) + ';\n';
  WGSL.common = WGSL.common + WGSL.common2 + consts;
  const pl = dev.createPipelineLayout({ bindGroupLayouts: [sl] }), surfM = await mod('surface', WGSL.common + WGSL.surface), tubeM = await mod('tubes', WGSL.common + WGSL.tubes), scrM = await mod('screen', WGSL.common + WGSL.screen.replace('/*SPOUTS*/', spoutWGSL()));
  const tl = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: SS.VERTEX, buffer: { type: 'read-only-storage' } }, { binding: 1, visibility: SS.FRAGMENT, texture: {} }] }); E.bgText = dev.createBindGroup({ layout: tl, entries: [{ binding: 0, resource: { buffer: E.gl } }, { binding: 1, resource: E.glyph.createView() }] });
  const rp = (m, vs, fs, o = {}) => dev.createRenderPipelineAsync({ layout: o.layout || pl, vertex: { module: m, entryPoint: vs, constants: o.k || {} }, fragment: fs ? { module: m, entryPoint: fs, targets: [{ format: o.fmt || HDR, blend: o.blend }] } : undefined, primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: o.nod ? undefined : { format: 'depth32float', depthWriteEnabled: o.dw ?? true, depthCompare: o.dc || 'greater', depthBias: o.bias || 0, depthBiasSlopeScale: o.bias ? 2 : 0 } });
  const alpha = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } }, volB = { color: { srcFactor: 'one', dstFactor: 'src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } }, mul = { color: { srcFactor: 'zero', dstFactor: 'src' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } }, srcA = { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };
  const addB = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } }; const wM = await mod('worlds', WGSL.common + WGSL.worlds);
  const nL = TUBES.nL, nS = TUBES.nS, kL = { ALONG: 24, RING: 10, FIRST: 0, PER: nL }, kS = { ALONG: 3, RING: 8, FIRST: nL, PER: nS };
  const P = E.P = {}; const jobs = {
    surf: rp(surfM, 'vsMain', 'fsMain', { k: { NX: NXG, NZ: NZG } }), surfShC: rp(surfM, 'vsShadow', 'fsShadow', { k: { NX: NXG, NZ: NZG }, blend: mul, nod: true }),
    tubeL: rp(tubeM, 'vsTube', 'fsTube', { k: kL }), tubeS: rp(tubeM, 'vsTube', 'fsTube', { k: kS }), tubeLSh: rp(tubeM, 'vsTubeSh', null, { k: kL, dc: 'less', bias: 2 }), tubeSSh: rp(tubeM, 'vsTubeSh', null, { k: kS, dc: 'less', bias: 2 }),
    spike: rp(tubeM, 'vsSpike', 'fsTube', {}), roseSh: rp(tubeM, 'vsRoseSh', 'fsRoseSh', { blend: mul, nod: true }), rose: rp(tubeM, 'vsRose', 'fsRose', {}), spray: rp(tubeM, 'vsSpray', 'fsSpray', { blend: alpha, dw: false }), burst: rp(tubeM, 'vsBurst', 'fsSpray', { blend: alpha, dw: false }), drop: rp(tubeM, 'vsDrop', 'fsDrop', { blend: srcA, dw: false }),
    sky: rp(scrM, 'vsFull', 'fsSky', { dw: false, dc: 'greater-equal' }), vol: rp(scrM, 'vsFull', 'fsVol', { nod: true, blend: volB }), spout: rp(scrM, 'vsFull', 'fsSpout', { nod: true, blend: volB }),
    text: rp(scrM, 'vsText', 'fsText', { nod: true, blend: alpha, layout: dev.createPipelineLayout({ bindGroupLayouts: [sl, tl] }) }), textR: rp(scrM, 'vsText', 'fsText', { nod: true, blend: alpha, layout: dev.createPipelineLayout({ bindGroupLayouts: [sl, tl] }) }),
    crown: rp(wM, 'vsCrown', 'fsCrown', {}), bird: rp(wM, 'vsBird', 'fsBird', {}), tower: rp(wM, 'vsTower', 'fsTower', {}), cascade: rp(wM, 'vsCascade', 'fsSpray2', { blend: alpha, dw: false }), lantern: rp(wM, 'vsLantern', 'fsGlow', { blend: addB, dw: false }), rainUp: rp(wM, 'vsRainUp', 'fsGlow', { blend: addB, dw: false }), star: rp(wM, 'vsStar', 'fsGlow', { blend: addB, dw: false }), dust: rp(wM, 'vsDust', 'fsDust', { blend: alpha, dw: false, dc: 'always' }),
  };
  for (const k in jobs) { try { P[k] = await jobs[k]; } catch (e) { ERRS.push(k + ' ' + e.message); console.log('PIPE ' + k + ' ' + e.message.slice(0, 900)); } }
  // ---- post
  const pm = await mod('post', WGSL.post); const ptl = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, buffer: {} }, { binding: 1, visibility: VF, sampler: {} }, { binding: 2, visibility: VF, texture: {} }, { binding: 3, visibility: VF, texture: {} }] }), ppl = dev.createPipelineLayout({ bindGroupLayouts: [ptl] });
  const pp = (fs, fmt, blend) => dev.createRenderPipeline({ layout: ppl, vertex: { module: pm, entryPoint: 'vsFull' }, fragment: { module: pm, entryPoint: fs, targets: [{ format: fmt, blend }] }, primitive: { topology: 'triangle-list' } }), add = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
  P.acc = pp('fsAccum', HDR, add); P.down = pp('fsDown', HDR); P.up = pp('fsUp', HDR, add); P.fin = pp('fsFinal', 'rgba8unorm');
  const pbuf = d => buf(48, BU.UNIFORM, new Float32Array(d)), pbg = (b, a, c) => dev.createBindGroup({ layout: ptl, entries: [{ binding: 0, resource: { buffer: b } }, { binding: 1, resource: E.sClamp }, { binding: 2, resource: a.createView() }, { binding: 3, resource: c.createView() }] });
  E.accU = pbuf([1, 0, 0, 0, 0, 0, 0, 0]); E.accBG = pbg(E.accU, E.hdr, E.dumC); E.downs = []; E.ups = [];
  for (let i = 0; i < 7; i++) { const s = i ? E.bl[i - 1] : { t: E.acc, w: RW, h: RH }; E.downs.push(pbg(pbuf([0, 0, 0, 0, 1 / s.w, 1 / s.h, i ? 0 : 1, 0]), s.t, E.dumC)); }
  for (let i = 6; i > 0; i--) E.ups.push({ bg: pbg(pbuf([0, 0.85, 0, 0, 1 / E.bl[i].w, 1 / E.bl[i].h, 0, 0]), E.bl[i].t, E.dumC), dst: E.bl[i - 1].t });
  E.finU = buf(48, BU.UNIFORM, new Float32Array(12)); E.finBG = pbg(E.finU, E.acc, E.bl[0].t);
  const cv = document.getElementById('c'); cv.width = RW; cv.height = RH; E.ctx = cv.getContext('webgpu'); E.ctx.configure({ device: dev, format: 'rgba8unorm', usage: TU.RENDER_ATTACHMENT | TU.COPY_DST });
  E.rb = dev.createBuffer({ size: Math.ceil(RW * 4 / 256) * 256 * RH, usage: BU.COPY_DST | BU.MAP_READ });
  await dev.queue.onSubmittedWorkDone();
}

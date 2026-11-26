// ---------- materials ----------
const MAT = {};
const matLit = new Float32Array(56 * 4), matShade = new Float32Array(56 * 4), matDeep = new Float32Array(56 * 4);
const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
function defMat(i, name, lit, shade, deep, o = {}) {
  MAT[name] = i;
  matLit.set([...hex(lit), o.pat || 0], i * 4); matShade.set([...hex(shade), o.spec || 0], i * 4); matDeep.set([...hex(deep), o.lw === undefined ? 1 : o.lw], i * 4);
}
// pelican
defMat(0, 'white', 0xf8f5ef, 0xb9bde0, 0x7476a8, { pat: 11 });
defMat(1, 'plume', 0xf8f5ef, 0xb9bde0, 0x7476a8);
defMat(2, 'wingBlack', 0x3b3650, 0x231f34, 0x100d1c, { pat: 8 });
defMat(3, 'crest', 0xfff0c4, 0xd8bfa6, 0x9a7f93);
defMat(4, 'beak', 0xffb52e, 0xd97a22, 0x8e421f, { pat: 1, spec: 0.35 });
defMat(5, 'pouch', 0xff9436, 0xcd5a2a, 0x8a3022, { pat: 2 });
defMat(6, 'mouth', 0x8a2233, 0x5c1226, 0x2e0816);
defMat(7, 'leg', 0xff8a26, 0xca5418, 0x7e2c18);
defMat(8, 'web', 0xff9f45, 0xd4681f, 0x8a381c);
defMat(9, 'claw', 0x4a2a2a, 0x2c1620, 0x180a12, { lw: 0.5 });
defMat(10, 'eye', 0xffc414, 0xa64c00, 0xffbe3a, { pat: 10, lw: 0.8 });   // lit=iris low, shade=iris high, deep=skin
defMat(11, 'scarf', 0xee2a3e, 0xa5102f, 0x5c0822, { pat: 6, lw: 1.15 });
defMat(12, 'covert', 0xf4f1ee, 0xaeb2d8, 0x6d6f9e, { pat: 8, lw: 0.7 });
defMat(13, 'secondary', 0x4c4866, 0x2d2944, 0x161227, { pat: 8, lw: 0.75 });
defMat(14, 'ink', 0x17101e, 0x100b16, 0x0a060e);
// hero bike
defMat(16, 'frame', 0x1fd0bd, 0x0e8590, 0x074352, { spec: 0.9 });
defMat(17, 'gold', 0xffc548, 0xbf7d22, 0x6c3d18, { spec: 0.8, lw: 0.6 });
defMat(18, 'rubber', 0x34303d, 0x1e1b27, 0x0f0d15);
defMat(19, 'tire', 0x34303d, 0x1e1b27, 0x0f0d15, { pat: 4 });
defMat(20, 'chrome', 0xdfe6f2, 0x8791b0, 0x424a6c, { spec: 1.0, lw: 0.65 });
defMat(21, 'black', 0x383344, 0x211d2d, 0x100d18, { spec: 0.45, lw: 0.8 });
defMat(22, 'saddle', 0x33222c, 0x1d1119, 0x0e070d, { spec: 0.25 });
defMat(23, 'tape', 0xf1e6cf, 0xb7a2a4, 0x75607a, { pat: 7, lw: 0.8 });
defMat(24, 'chain', 0xa9a5b4, 0x66627a, 0x34304a, { pat: 9, spec: 0.5, lw: 0.55 });
defMat(25, 'silver', 0xc9cfdc, 0x7b829e, 0x3d4260, { spec: 0.85, lw: 0.55 });
// falcon
defMat(26, 'feye', 0xd45cff, 0x40086e, 0xffcf2e, { pat: 10, lw: 0.8 });
defMat(27, 'fslate', 0x5b6b8c, 0x374064, 0x1e213c);
defMat(28, 'fbody', 0x5b6b8c, 0x374064, 0x1e213c, { pat: 3 });
defMat(29, 'fhood', 0x2b2a40, 0x19182b, 0x0c0b18);
defMat(30, 'fhead', 0xf0e4c8, 0xb3a2b4, 0x6e5c7e, { pat: 15 });
defMat(31, 'fbeak', 0x9aa8cc, 0x5d678f, 0x2d3254, { spec: 0.6 });
defMat(32, 'fyellow', 0xffcf2e, 0xcb8c12, 0x7a4c12);
defMat(33, 'fwing', 0x3a4266, 0x222846, 0x10132a, { pat: 8, lw: 0.7 });
defMat(34, 'violet', 0x9a4dff, 0x6424b8, 0x34106e, { spec: 0.5, lw: 0.6 });
defMat(35, 'violetGlow', 0xc58aff, 0xc58aff, 0xc58aff, { pat: 14, lw: 0.4 });
defMat(36, 'fframe', 0x2a2734, 0x17151f, 0x0a0910, { spec: 0.9 });
defMat(37, 'disc', 0x23202d, 0x12101a, 0x08070d, { pat: 5, spec: 0.35 });
// props
defMat(40, 'rail', 0xc4ccd8, 0x78809c, 0x3c4260, { spec: 0.6, lw: 0.7 });
defMat(41, 'wood', 0x8a5a3c, 0x573428, 0x2c1a1c, { lw: 0.8 });
defMat(42, 'pine', 0x2f7a58, 0x1b4a48, 0x0d2632, { lw: 0.55 });
defMat(43, 'rock', 0xb8744e, 0x7a4040, 0x3f1e32, { lw: 0.9 });
defMat(44, 'pole', 0x3e4260, 0x252842, 0x121428, { lw: 0.8 });
defMat(45, 'lamp', 0xfff1b8, 0xfff1b8, 0xfff1b8, { pat: 14, lw: 0.4 });
defMat(46, 'fish', 0x7fb4cf, 0x4a7496, 0x24405c, { pat: 12, spec: 0.7, lw: 0.75 });
defMat(47, 'fishEye', 0xfdfdf8, 0xd8d8e6, 0x9a9ab4, { lw: 0.6 });
defMat(48, 'pupil', 0x0e0a14, 0x0a0710, 0x06040a, { lw: 0 });
defMat(49, 'checker', 0xf4f2ec, 0xaaa8b4, 0x66647a, { pat: 13 });
defMat(50, 'red', 0xe0283a, 0x9a1230, 0x560a24);
defMat(51, 'snow', 0xeef4ff, 0xa8b8e4, 0x6874ac);
defMat(52, 'rockDark', 0x6a4458, 0x43263e, 0x211228, { lw: 0.9 });
defMat(53, 'grass', 0x6fae4a, 0x3f7440, 0x1f3c34, { lw: 0.6 });
defMat(54, 'silRock', 0x2a1030, 0x1c0a24, 0x0e0516, { lw: 0.8 });

// tileable fbm (R) and cellular noise (G), generated here so no image files are needed
function cloudNoise(N, period) {
  const out = new Uint8Array(N * N * 4);
  const lat = (x, y, per, seed) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const h = (a, b) => hash2(((a % per) + per) % per + (((b % per) + per) % per) * 1031, seed); return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); };
  const pts = []; for (let j = 0; j < period; j++) for (let i = 0; i < period; i++) pts.push([hash2(i + j * 131, 71), hash2(i + j * 131, 72)]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = x / N * period, py = y / N * period;
    let s = 0, a = 0.5; for (let o = 0; o < 4; o++) { const f = 1 << o; s += a * lat(px * f, py * f, period * f, 11 + o); a *= 0.5; }
    let md = 1.5; const ci = Math.floor(px), cj = Math.floor(py);
    for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const i = ci + c, j = cj + b, q = pts[((j % period + period) % period) * period + ((i % period + period) % period)]; const dx = i + q[0] - px, dy = j + q[1] - py, d = Math.sqrt(dx * dx + dy * dy); if (d < md) md = d; }
    const k = (y * N + x) * 4; out[k] = Math.min(255, Math.round(s / 0.9375 * 255)); out[k + 1] = Math.min(255, Math.round(md * 255)); out[k + 3] = 255;
  }
  return out;
}
// ---------- renderer ----------
const W = 1920, H = 1080, SS = 2;
class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no float targets');
    this.gl = gl; this.canvas = canvas;
    this.progs = {
      env: this.program(VS_FULL, FS_ENV), mesh: this.program(VS_MESH, FS_MESH), shadow: this.program(VS_SHADOW, FS_SHADOW),
      spoke: this.program(VS_SPOKE, FS_SPOKE), ink: this.program(VS_FULL, FS_INK), panel: this.program(VS_POLY, FS_PANEL),
      compose: this.program(VS_FULL, FS_COMPOSE), bright: this.program(VS_FULL, FS_BRIGHT), blur: this.program(VS_FULL, FS_BLUR), post: this.program(VS_FULL, FS_POST)
    };
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer(); this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    const st = VSTR * 4;
    [[0, 3, 0], [1, 3, 12], [2, 2, 24], [3, 4, 32]].forEach(([l, n, off]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, st, off); });
    gl.bindVertexArray(null);
    this.polyVao = gl.createVertexArray(); gl.bindVertexArray(this.polyVao); this.polyBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.polyBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
    this.emptyVao = gl.createVertexArray();

    this.scene = this.target(W * SS, H * SS, [[gl.RGBA8, gl.NEAREST], [gl.RGBA16F, gl.NEAREST]], true);
    this.panel = this.target(W, H, [[gl.RGBA8, gl.LINEAR]]);
    this.comp = this.target(W, H, [[gl.RGBA8, gl.LINEAR]]);
    this.compB = this.target(W, H, [[gl.RGBA8, gl.LINEAR]]);
    this.b0 = this.target(W / 4, H / 4, [[gl.RGBA8, gl.LINEAR]]); this.b1 = this.target(W / 4, H / 4, [[gl.RGBA8, gl.LINEAR]]);
    this.b2 = this.target(W / 8, H / 8, [[gl.RGBA8, gl.LINEAR]]); this.b3 = this.target(W / 8, H / 8, [[gl.RGBA8, gl.LINEAR]]);
    // shadow map
    this.shadowSize = 2048;
    this.shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE], [gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    this.shadowFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0); gl.drawBuffers([gl.NONE]);
    this.randTex = this.noiseTex(256, (() => { const d = new Uint8Array(256 * 256 * 4); for (let i = 0; i < 256 * 256; i++) { d[i * 4] = Math.floor(hash2(i, 4242) * 256); d[i * 4 + 1] = Math.floor(hash2(i, 977) * 256); d[i * 4 + 3] = 255; } return d; })());
    this.cloudTex = this.noiseTex(512, cloudNoise(512, 16));
    // 2d layers
    this.fxTex = this.canvasTex(); this.typeTex = this.canvasTex();
    // ink sample offsets sorted by radius
    const offs = [];
    const ring = (r, n, ph) => { for (let i = 0; i < n; i++) { const a = (i + ph) / n * TAU; offs.push([Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), r]); } };
    ring(1, 4, 0); ring(1.42, 4, 0.5); ring(2.2, 8, 0.25); ring(3.2, 12, 0); ring(4.3, 16, 0.5); ring(5.5, 16, 0); ring(6.9, 16, 0.5);
    this.offs = new Float32Array(offs.flat());
  }
  program(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ' ' + l).join('\n').slice(0, 6000));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const U = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nm = info.name.replace(/\[0\]$/, ''); U[nm] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size }; }
    return { p, U };
  }
  set(prog, vals) {
    const gl = this.gl;
    for (const k in vals) {
      const u = prog.U[k]; if (!u) continue; const v = vals[k]; if (v === undefined) continue;
      switch (u.type) {
        case gl.FLOAT: if (typeof v === 'number') gl.uniform1f(u.loc, v); else gl.uniform1fv(u.loc, v); break;
        case gl.INT: case gl.SAMPLER_2D: case gl.SAMPLER_2D_SHADOW: case gl.BOOL: gl.uniform1i(u.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
        default: throw new Error('uniform type ' + k);
      }
    }
  }
  target(w, h, formats, depth) {
    const gl = this.gl, fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const tex = formats.map(([fmt, filt], i) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0); return t;
    });
    if (depth) { const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
    gl.drawBuffers(formats.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo incomplete');
    return { fbo, tex, w, h };
  }
  noiseTex(size, data) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  }
  canvasTex() {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  upload(tex, cnv) {
    const gl = this.gl; gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, cnv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  bind(unit, tex) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
  full() { this.gl.bindVertexArray(this.emptyVao); this.gl.drawArrays(this.gl.TRIANGLES, 0, 3); }
  to(t) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null); gl.viewport(0, 0, t ? t.w : W, t ? t.h : H); }

  renderView(view, dest, frame) {
    const gl = this.gl, cm = view.cm || camMatrices(view.cam), L = view.light, env = view.env;
    const mesh = view.mesh;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferData(gl.ARRAY_BUFFER, mesh.v.subarray(0, mesh.nv * VSTR), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.i.subarray(0, mesh.ni), gl.STREAM_DRAW);
    // shadow pass
    const Ld = norm(L.dir), focus = view.focus || [0.1, 0.8, 0], size = view.shadowSize || 2.2;
    const lview = M4.lookAt(mad(focus, Ld, 6), focus, Math.abs(Ld[1]) > 0.98 ? [1, 0, 0] : [0, 1, 0]);
    const lvp = M4.mul(M4.ortho(size, size, 0.1, 14), lview);
    const shadowOn = view.noShadow ? 0 : 1;
    this.bind(3, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo); gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    if (shadowOn && mesh.ni) { gl.useProgram(this.progs.shadow.p); this.set(this.progs.shadow, { uVP: lvp }); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2); gl.drawElements(gl.TRIANGLES, mesh.ni, gl.UNSIGNED_INT, 0); gl.disable(gl.POLYGON_OFFSET_FILL); }
    // g-buffer pass
    this.to(this.scene); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.clearBufferfv(gl.COLOR, 0, view.clear || [0, 0, 0, 1]); gl.clearBufferfv(gl.COLOR, 1, [0, 1000, 0, 0]); gl.clearBufferfv(gl.DEPTH, 0, [1]);
    if (env) {
      const P = this.progs.env; gl.useProgram(P.p); gl.depthFunc(gl.ALWAYS);
      this.bind(3, this.shadowTex); this.bind(4, this.randTex); this.bind(5, this.cloudTex);
      this.set(P, {
        uRand: 4, uCloudTex: 5, uZ: 0, uMode: env.mode, uIVP: cm.ivp, uVP: cm.vp, uCam: cm.pos, uTime: env.time || 0, uScroll: env.scroll || 0, uSpeed: env.speed || 0,
        uSunDir: norm(env.sun || [0.3, 0.25, -1]), uP: env.p || [0, 0, 0, 0], uFlashL: env.flash || 0, uGround: env.ground === undefined ? 1 : env.ground,
        uShadowVP: lvp, uShadow: 3, uShadowOn: shadowOn, uRes: [W * SS, H * SS], uDrawN: env.draw || 0, uDim: env.dim === undefined ? 1 : env.dim, uVanish: env.vanish || [0.5, 0.5], uSlope: env.slope || 0
      });
      this.full(); gl.bindVertexArray(this.vao);
    }
    if (mesh.ni) {
      const P = this.progs.mesh; gl.useProgram(P.p); gl.depthFunc(gl.LEQUAL); gl.bindVertexArray(this.vao);
      this.bind(3, this.shadowTex);
      const eyes = view.eyes || {};
      const ea = new Float32Array(8), eb = new Float32Array(8), eg = new Float32Array(6);
      ['hero', 'falcon'].forEach((k, i) => { const e = eyes[k] || {}; ea.set([e.open === undefined ? 1 : e.open, e.brow === undefined ? 0.75 : e.brow, e.pupil || 1, e.mode || 0], i * 4); eb.set([e.glint || 0, e.glow || 0, e.lookX || 0, e.lookY || 0], i * 4); eg.set(e.glowCol || (i ? [0.85, 0.4, 1] : [1, 0.95, 0.55]), i * 3); });
      this.set(P, {
        uVP: cm.vp, uView: cm.view, uMatLit: matLit, uMatShade: matShade, uMatDeep: matDeep, uCam: cm.pos, uL: Ld, uRimDir: norm(L.rimDir || [-0.7, 0.35, -0.6]),
        uLitTint: L.lit || [1, 1, 1], uShadeTint: L.shade || [1, 1, 1], uRimCol: L.rim || [1, 1, 1], uRimAmt: L.rimAmt === undefined ? 0.8 : L.rimAmt,
        uFogCol: L.fogCol || [0.6, 0.7, 0.8], uFog: L.fog || 0, uSil: view.sil || 0, uSilCol: view.silCol || [0.08, 0.03, 0.12], uT1: L.t1 === undefined ? 0.06 : L.t1,
        uTime: env ? (env.time || 0) : 0, uDiscBlur: view.discBlur || 0, uChainBlur: view.chainBlur || 0, uBright: view.bright === undefined ? 1 : view.bright,
        uEyeA: ea, uEyeB: eb, uEyeGlow: eg, uShadowVP: lvp, uShadow: 3, uShadowOn: shadowOn
      });
      gl.drawElements(gl.TRIANGLES, mesh.ni, gl.UNSIGNED_INT, 0);
    }
    if (view.spokes && view.spokes.length) {
      const P = this.progs.spoke; gl.useProgram(P.p); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
      gl.depthMask(false); gl.depthFunc(gl.LESS); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.bindVertexArray(this.emptyVao);
      for (const s of view.spokes) {
        this.set(P, { uVP: cm.vp, uView: cm.view, uC: s.c, uEx: s.ex, uEy: s.ey, uR: s.r, uHub: s.hub, uRot: s.rot, uBlur: s.blur, uSeed: s.seed || 1, uK: 40, uCol: s.col || [0.84, 0.88, 0.95], uHi: s.hi || [1, 1, 1] });
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.disable(gl.BLEND); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    }
    // ink resolve
    gl.disable(gl.DEPTH_TEST);
    const P = this.progs.ink; this.to(dest); gl.useProgram(P.p);
    this.bind(3, null);
    this.bind(0, this.scene.tex[0]); this.bind(1, this.scene.tex[1]);
    this.set(P, { uColor: 0, uG: 1, uLine: view.line === undefined ? 3.3 : view.line, uSeed: (frame.draw || 0) % 3, uNS: 76, uSub: 4, uLineOn: view.line === 0 ? 0 : 1, uInk: view.ink || [0.085, 0.045, 0.125], uOff: this.offs });
    this.full();
    this.bind(0, null); this.bind(1, null);
    return cm;
  }

  render(frame) {
    const gl = this.gl, views = frame.views || [];
    // compose panels
    this.to(this.comp); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    for (const view of views) {
      if (!view.poly) { this.renderView(view, this.comp, frame); continue; }
      this.renderView(view, this.panel, frame);
      this.to(this.comp); const P = this.progs.panel; gl.useProgram(P.p);
      gl.bindVertexArray(this.polyVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.polyBuf);
      const pts = new Float32Array(view.poly.map(([x, y]) => [x, 1 - y]).flat()); gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STREAM_DRAW);
      this.bind(0, this.panel.tex[0]); this.set(P, { uTex: 0, uOffset: view.offset || [0, 0], uZoom: view.zoom || 1 });
      gl.drawArrays(gl.TRIANGLE_FAN, 0, view.poly.length); this.bind(0, null);
    }
    const post = frame.post || {};
    if (frame.fx) this.upload(this.fxTex, frame.fx);
    if (frame.type) this.upload(this.typeTex, frame.type);
    // scene + aura + fx + shake
    let P = this.progs.compose; this.to(this.compB); gl.useProgram(P.p); this.bind(0, this.comp.tex[0]); this.bind(1, this.fxTex);
    const aura = post.aura;
    this.set(P, {
      uScene: 0, uFx: 1, uFxOn: frame.fx ? 1 : 0, uShake: post.shake || [0, 0, 1, 0], uTime: frame.t, uDraw: frame.draw || 0,
      uAura: aura ? [aura.amt, aura.len || 0.2, aura.lean || 0, aura.halo || 0.022] : [0, 0, 0, 0],
      uAuraC0: aura ? aura.c0 : [1, 1, 1], uAuraC1: aura ? aura.c1 : [1, 1, 1], uAuraC2: aura ? aura.c2 : [1, 1, 1], uAuraMin: aura ? (aura.min === undefined ? 0.7 : aura.min) : 2, uAuraMax: aura ? (aura.max === undefined ? 1.1 : aura.max) : 2,
      uSmear: post.smear || 0, uSmearDir: post.smearDir || [1, 0]
    });
    this.full();
    // bloom
    P = this.progs.bright; this.to(this.b0); gl.useProgram(P.p); this.bind(0, this.compB.tex[0]);
    this.set(P, { uTex: 0, uTx: [1 / W * 2, 1 / H * 2], uThr: post.bloomThr === undefined ? 0.93 : post.bloomThr }); this.full();
    P = this.progs.blur; gl.useProgram(P.p);
    const pass = (src, dst, dir) => { this.to(dst); this.bind(0, src.tex[0]); this.set(P, { uTex: 0, uDir: dir }); this.full(); };
    pass(this.b0, this.b1, [1 / (W / 4), 0]); pass(this.b1, this.b0, [0, 1 / (H / 4)]);
    pass(this.b0, this.b2, [1.5 / (W / 8), 0]); pass(this.b2, this.b3, [0, 1.5 / (H / 8)]); pass(this.b3, this.b2, [2.5 / (W / 8), 0]); pass(this.b2, this.b3, [0, 2.5 / (H / 8)]);
    // final
    P = this.progs.post; this.to(null); gl.useProgram(P.p); this.bind(0, this.compB.tex[0]); this.bind(1, this.b3.tex[0]); this.bind(2, this.typeTex);
    this.set(P, {
      uTex: 0, uBloom: 1, uType: 2, uTypeOn: frame.type ? 1 : 0, uBloomAmt: post.bloom === undefined ? 0.45 : post.bloom, uVig: post.vig === undefined ? 0.32 : post.vig,
      uChroma: post.chroma || 0, uSat: post.sat === undefined ? 1.06 : post.sat, uCon: post.con === undefined ? 1.03 : post.con, uImpact: post.impact || 0, uImpC: post.impC || [0.5, 0.5],
      uFade: post.fade || 0, uGrain: post.grain === undefined ? 0.022 : post.grain, uDraw: frame.draw || 0, uGain: post.gain || [1, 1, 1], uLift: post.lift || [0, 0, 0], uFlash: post.flash || [1, 1, 1, 0], uSepia: post.sepia || 0, uFrame: 0, uLetter: post.letter || 0
    });
    this.full();
    this.bind(0, null); this.bind(1, null); this.bind(2, null);
  }
  read(buf) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf; }
}

'use strict';
// ---------------------------------------------------------------------------
// WebGL2: (1) a shader "painter" for skies, clouds, nebulae and water
//         (2) the final post pass: bloom, grade, aberration, impact frames
// ---------------------------------------------------------------------------
const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const GLSL_LIB = `#version 300 es
precision highp float;
in vec2 uv; out vec4 O;
uniform vec2 uRes;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ s+=a*vn(p); p=m*p; a*=.5; } return s; }
float fbm3(vec2 p){ float a=.5, s=0.; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<3;i++){ s+=a*vn(p); p=m*p; a*=.5; } return s/.875; }
`;

function glProgram(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ' ' + l).join('\n'));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  p.loc = new Map();
  return p;
}
const uloc = (gl, p, n) => { let l = p.loc.get(n); if (l === undefined) { l = gl.getUniformLocation(p, n); p.loc.set(n, l); } return l; };
function setUniforms(gl, p, U) {
  for (const [n, v] of Object.entries(U)) {
    const l = uloc(gl, p, n); if (l === null) continue;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v.v4) gl.uniform4fv(l, v.v4);
    else if (v.v3) gl.uniform3fv(l, v.v3);
    else if (v.i !== undefined) gl.uniform1i(l, v.i);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
  }
}
function quadBuffer(gl) {
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

const Painter = (() => {
  let cv, gl; const progs = new Map();
  function init() {
    cv = CV(16, 16);
    gl = cv.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('no webgl2');
    quadBuffer(gl);
  }
  // render fragment shader body into a w x h region and copy it into ctx at (dx,dy,dw,dh)
  function draw(ctx, name, fs, w, h, U, dx = 0, dy = 0, dw = w, dh = h) {
    if (!gl) init();
    let p = progs.get(name);
    if (!p) { p = glProgram(gl, VS, GLSL_LIB + fs); progs.set(name, p); }
    // the canvas is exactly the size of the painting: scaling it can never
    // sample leftovers of an earlier one (that would make frames order dependent)
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.useProgram(p);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uloc(gl, p, 'uRes'), w, h);
    setUniforms(gl, p, U);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.drawImage(cv, 0, 0, w, h, dx, dy, dw, dh);
  }
  // cached still painting
  function still(key, name, fs, w, h, U) {
    return layer('paint:' + key, w, h, x => draw(x, name, fs, w, h, typeof U === 'function' ? U() : U));
  }
  return { draw, still };
})();

// ------------------------------------------------------------------ post pass
const Post = (() => {
  let gl, cv, copy, blur, comp, sceneTex, glowTex, fbos = [];
  const FS_HEAD = `#version 300 es
precision highp float; in vec2 uv; out vec4 O;`;
  const FS_BRIGHT = FS_HEAD + `
uniform sampler2D uS, uG; uniform float uThresh, uGlowK; uniform vec2 uPx;
vec3 pick(vec2 q){ vec3 c = texture(uS, vec2(q.x, 1.-q.y)).rgb; float l = max(c.r, max(c.g, c.b));
  return c * smoothstep(uThresh, uThresh+.25, l); }
void main(){ vec3 s = (pick(uv+uPx*vec2(-1,-1)) + pick(uv+uPx*vec2(1,-1)) + pick(uv+uPx*vec2(-1,1)) + pick(uv+uPx*vec2(1,1)))*.25;
  vec4 g = texture(uG, vec2(uv.x, 1.-uv.y));
  O = vec4(s + g.rgb*g.a*uGlowK, 1.); }`;
  const FS_BLUR = FS_HEAD + `
uniform sampler2D uS; uniform vec2 uDir;
void main(){ vec3 c = texture(uS,uv).rgb*0.227027;
  c += (texture(uS,uv+uDir*1.3846).rgb + texture(uS,uv-uDir*1.3846).rgb)*0.316216;
  c += (texture(uS,uv+uDir*3.2308).rgb + texture(uS,uv-uDir*3.2308).rgb)*0.070270;
  O = vec4(c,1.); }`;
  const FS_COMP = FS_HEAD + `
uniform sampler2D uS, uB1, uB2, uB3;
uniform float uBloom, uCA, uVig, uSat, uCon, uFlash, uFade, uImpact, uZoom, uGrain, uFrame, uRadial;
uniform vec3 uLift, uGain, uFlashCol, uInkCol, uPaperCol;
uniform vec2 uShake, uCenter;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
vec3 samp(vec2 q){ return texture(uS, vec2(q.x, 1.-q.y)).rgb; }
void main(){
  vec2 q = (uv - .5)/uZoom + .5 + uShake/vec2(1920.,1080.);
  vec2 d = q - uCenter;
  vec2 ca = d * (uCA/1920.) * 2.;
  vec3 c = vec3(samp(q + ca).r, samp(q).g, samp(q - ca).b);
  if(uRadial > 0.001){
    vec3 acc = c; for(int i=1;i<14;i++){ float k = 1. - uRadial*float(i)/14.; acc += samp(uCenter + d*k); }
    c = acc/14.;
  }
  vec3 b = texture(uB1,q).rgb*.55 + texture(uB2,q).rgb*.7 + texture(uB3,q).rgb*.85;
  c = 1. - (1.-c)*(1.-clamp(b*uBloom, 0., 1.));
  c = c*uGain + uLift*(1.-c);
  float l = dot(c, vec3(.2126,.7152,.0722));
  c = mix(vec3(l), c, uSat);
  c = (c - .5)*uCon + .5;
  vec2 vv = (uv-.5)*vec2(1.05,1.15);
  c *= 1. - uVig*smoothstep(.28, .86, length(vv));
  if(uImpact > 0.5){
    float lum = dot(c, vec3(.2126,.7152,.0722));
    float edge = smoothstep(.40,.47,lum);
    if(uImpact > 1.5) edge = 1. - edge;
    c = mix(uInkCol, uPaperCol, edge);
  }
  c = mix(c, uFlashCol, uFlash);
  c *= 1. - uFade;
  float n = h(gl_FragCoord.xy + vec2(uFrame*17.13, uFrame*7.77)) - .5;
  c += n * uGrain / 255.;
  O = vec4(clamp(c,0.,1.), 1.);
}`;
  function makeTex(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }
  function makeFbo(w, h) {
    const tex = makeTex(w, h), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  function init(canvas) {
    cv = canvas;
    gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
    if (!gl) throw new Error('no webgl2');
    quadBuffer(gl);
    copy = glProgram(gl, VS, FS_BRIGHT); blur = glProgram(gl, VS, FS_BLUR); comp = glProgram(gl, VS, FS_COMP);
    sceneTex = makeTex(); glowTex = makeTex();
    for (const [w, h] of [[480, 270], [240, 135], [120, 68]]) fbos.push([makeFbo(w, h), makeFbo(w, h)]);
  }
  const bind = (unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); };
  function pass(prog, target, U, textures) {
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : cv.width, target ? target.h : cv.height);
    textures.forEach(([name, tex], i) => { bind(i, tex); gl.uniform1i(uloc(gl, prog, name), i); });
    setUniforms(gl, prog, U);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function render(scene, glowCv, P) {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    bind(0, sceneTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    bind(0, glowTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glowCv);
    pass(copy, fbos[0][0], { uThresh: P.thresh, uGlowK: P.glowK, uPx: [1 / 1920, 1 / 1080] }, [['uS', sceneTex], ['uG', glowTex]]);
    for (let lv = 0; lv < 3; lv++) {
      const [a, b] = fbos[lv];
      const src = lv === 0 ? a.tex : fbos[lv - 1][0].tex;
      if (lv > 0) pass(blur, a, { uDir: [0.5 / a.w, 0.5 / a.h] }, [['uS', src]]);
      for (let it = 0; it < 2; it++) {
        pass(blur, b, { uDir: [1 / a.w, 0] }, [['uS', a.tex]]);
        pass(blur, a, { uDir: [0, 1 / a.h] }, [['uS', b.tex]]);
      }
    }
    pass(comp, null, {
      uBloom: P.bloom, uCA: P.ca, uVig: P.vig, uSat: P.sat, uCon: P.con, uFlash: P.flash, uFade: P.fade, uImpact: P.impact,
      uZoom: P.zoom, uGrain: P.grain, uFrame: Math.floor(P.frame / 2), uRadial: P.radial,
      uLift: P.lift, uGain: P.gain, uFlashCol: P.flashCol, uInkCol: P.inkCol, uPaperCol: P.paperCol,
      uShake: [P.shake[0], -P.shake[1]], uCenter: P.center,
    }, [['uS', sceneTex], ['uB1', fbos[0][0].tex], ['uB2', fbos[1][0].tex], ['uB3', fbos[2][0].tex]]);
  }
  let readBuf = null;
  function read() {
    if (!readBuf) readBuf = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, readBuf);
    return readBuf;
  }
  function info() {
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
  }
  return { init, render, read, info };
})();

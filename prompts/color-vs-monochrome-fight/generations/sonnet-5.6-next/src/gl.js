// gl.js — thin WebGL2 helpers
let gl = null;

function glInit(canvas) {
  gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 not available');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float missing');
  gl.getExtension('OES_texture_float_linear');
  return gl;
}

function compileShader(type, src, name) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
    console.error(lines);
    throw new Error('Shader compile failed (' + name + '): ' + log);
  }
  return s;
}

function makeProgram(vs, fs, name) {
  const head = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\nprecision highp sampler2DShadow;\n';
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl.VERTEX_SHADER, head + vs, name + ' VS'));
  gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, head + fs, name + ' FS'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link failed (' + name + '): ' + gl.getProgramInfoLog(p));
  const prog = { p, u: {}, name };
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const nm = info.name.replace(/\[0\]$/, '');
    prog.u[nm] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
  }
  return prog;
}

// set uniforms from a plain object; textures given as {tex} get auto units
function useProgram(prog, uniforms) {
  gl.useProgram(prog.p);
  let unit = 0;
  for (const k in uniforms) {
    const u = prog.u[k];
    if (!u) continue;
    const v = uniforms[k];
    switch (u.type) {
      case gl.FLOAT: if (u.size > 1) gl.uniform1fv(u.loc, v); else gl.uniform1f(u.loc, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
      case gl.INT: case gl.BOOL: gl.uniform1i(u.loc, v | 0); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
      case gl.SAMPLER_2D: case gl.SAMPLER_2D_SHADOW:
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v);
        gl.uniform1i(u.loc, unit); unit++; break;
      default: throw new Error('uniform type ' + k);
    }
  }
}

function makeTex(w, h, internal, format, type, filter = gl.LINEAR, data = null) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  t.w = w; t.h = h;
  return t;
}
const texRGBA8 = (w, h, f) => makeTex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, f);
const texRGBA16F = (w, h, f) => makeTex(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, f);
const texR32F = (w, h) => makeTex(w, h, gl.R32F, gl.RED, gl.FLOAT, gl.NEAREST);
const texDepth = (w, h) => makeTex(w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);

function makeFBO(colors, depth = null) {
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  const bufs = [];
  colors.forEach((t, i) => {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
    bufs.push(gl.COLOR_ATTACHMENT0 + i);
  });
  if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  gl.drawBuffers(bufs.length ? bufs : [gl.NONE]);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplete 0x' + st.toString(16));
  const w = colors.length ? colors[0].w : depth.w, h = colors.length ? colors[0].h : depth.h;
  return { f, w, h, colors, depth };
}
function bindFBO(fbo, w, h) {
  if (fbo) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.f); gl.viewport(0, 0, fbo.w, fbo.h); }
  else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); }
}

// interleaved vertex buffer -> VAO. layout: [[location,size],...]
function makeVAO(layout, data, usage = gl.STATIC_DRAW) {
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  if (data) gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  const stride = layout.reduce((a, l) => a + l[1], 0) * 4;
  let off = 0;
  for (const [loc, size] of layout) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
    off += size * 4;
  }
  gl.bindVertexArray(null);
  return { vao, vbo, stride: stride / 4, count: data ? data.length / (stride / 4) : 0 };
}
function updateVAO(m, data, nfloats) {
  gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, nfloats), gl.DYNAMIC_DRAW);
  m.count = nfloats / m.stride;
}
function drawVAO(m, mode = gl.TRIANGLES) {
  if (!m.count) return;
  gl.bindVertexArray(m.vao);
  gl.drawArrays(mode, 0, m.count);
  gl.bindVertexArray(null);
}

// growable float buffer
class FBuf {
  constructor(n = 4096) { this.a = new Float32Array(n); this.n = 0; }
  reset() { this.n = 0; }
  need(k) {
    if (this.n + k > this.a.length) {
      let s = this.a.length * 2; while (s < this.n + k) s *= 2;
      const b = new Float32Array(s); b.set(this.a.subarray(0, this.n)); this.a = b;
    }
  }
}

const FS_TRI_VS = `
out vec2 vUv;
void main(){
  vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  vUv = p;
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;
let emptyVAO = null;
function drawFullscreen() {
  if (!emptyVAO) emptyVAO = gl.createVertexArray();
  gl.bindVertexArray(emptyVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

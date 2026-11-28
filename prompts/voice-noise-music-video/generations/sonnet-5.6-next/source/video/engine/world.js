// Backgrounds: GPU-painted skies plus procedurally drawn city, planet and weather.
'use strict';
const bgCanvas = mk();
const bgGL = bgCanvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
if (!bgGL) throw new Error('WebGL unavailable');
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';
function program(gl, frag) {
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const locs = {};
  return { p, loc: n => locs[n] ??= gl.getUniformLocation(p, n) };
}
function quad(gl) {
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}
quad(bgGL);
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

const COMMON = `precision highp float;
uniform float uTime; uniform vec3 uA, uB, uC, uD, uE; uniform vec4 uP, uQ;
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.03+vec2(19.1,7.7); a*=.5; } return v; }
vec2 screen(){ return vec2(gl_FragCoord.x, 1080.-gl_FragCoord.y); }
float stars(vec2 uv, float density, float t){ vec2 g=floor(uv), f=fract(uv)-.5; float h=hash(g);
  if(h<1.-density) return 0.; vec2 o=vec2(hash(g+3.1),hash(g+9.7))-.5; float d=length(f-o*.6);
  return smoothstep(.11,0.,d)*(.6+.4*sin(t*3.+h*90.)); }
`;
const SHADERS = {
  // uA zenith, uB middle, uC horizon, uD cloud lit, uE cloud shade
  // uP: sun x, sun y, sun strength, cloud coverage   uQ: scroll x, scroll y, star amount, cloud scale
  sky: `void main(){ vec2 s=screen(); float y=s.y/1080.;
    vec3 col = y<.55 ? mix(uA,uB,smoothstep(0.,.55,y)) : mix(uB,uC,smoothstep(.55,1.,y));
    float d=distance(s,uP.xy)/1080.;
    col += uP.z*(vec3(1.,.76,.46)*exp(-d*5.)*.46 + vec3(1.,.97,.9)*smoothstep(.058,.052,d)*.8);
    col += uQ.z*stars(s/26.+uQ.xy*.01,.07,uTime)*(1.-y*.8);
    for(int L=0;L<2;L++){ float fl=float(L);
      vec2 uv=(s+vec2(uQ.x*(1.+fl*1.7), uQ.y*(1.+fl)))/vec2(620.,330.)*uQ.w*(1.-fl*.35)+fl*7.3;
      vec2 w=vec2(fbm(uv*1.3+uTime*.012),fbm(uv*1.3+5.));
      float n=fbm(uv+w*.55), above=fbm(uv+w*.55-vec2(.03,.16));
      float th=1.-uP.w*(.62+.1*fl);
      float m=smoothstep(th,th+.025,n);
      float lit=smoothstep(-.005,.035,n-above);
      vec3 cc=mix(uE,uD,lit*.85+.15*smoothstep(th+.12,th,n));
      cc+=uP.z*vec3(1.,.68,.42)*exp(-d*3.4)*(1.-smoothstep(th,th+.09,n))*.45;
      col=mix(col,cc,m*(.78+.22*fl)); }
    gl_FragColor=vec4(col,1.); }`,
  // flying above a sea of clouds. uP: sun x, sun y, horizon y, forward travel  uQ: sideways travel
  sea: `void main(){ vec2 s=screen(); float hz=uP.z; float d=distance(s,uP.xy)/1080.;
    vec3 col;
    if(s.y<hz){ float y=s.y/hz; col=mix(uA,uB,smoothstep(0.,.7,y)); col=mix(col,uC,smoothstep(.68,1.,y));
      col+=stars(s/24.,.04,uTime)*max(0.,.6-y)*uQ.y;
      vec2 uv=vec2((s.x+uQ.x*.3)/500., s.y/90.); float n=fbm(uv+fbm(uv*.8));
      col=mix(col,mix(uD,uC,.4),smoothstep(.55,.75,n)*smoothstep(.55,.95,y)*.8);
    } else { float dy=(s.y-hz)/1080.+.012;
      vec2 uv=vec2((s.x-960.)/1080./dy*.62+uQ.x*.002, .62/dy+uP.w);
      vec2 w=vec2(fbm(uv*.45),fbm(uv*.45+4.));
      float n=fbm(uv*.72+w*1.2), up=fbm((uv+vec2(0.,.28))*.72+w*1.2);
      float body=smoothstep(.36,.62,n);
      float lit=smoothstep(-.02,.075,n-up);
      vec3 cc=mix(uE,uD,floor((lit*.7+body*.45)*4.+.5)/4.);
      col=mix(mix(uE,uB,.3),cc,smoothstep(.28,.5,n));
      col=mix(uC,col,smoothstep(0.,.2,dy));
      col+=vec3(1.,.7,.45)*exp(-abs(s.x-uP.x)/230.)*lit*.14; }
    col+=vec3(1.,.72,.42)*exp(-d*5.2)*.42+vec3(.5,.45,.35)*smoothstep(.07,.062,d)*step(s.y,hz);
    col+=vec3(1.,.7,.45)*exp(-abs(s.y-hz)/14.)*.2;
    gl_FragColor=vec4(col,1.); }`,
  // uA deep, uB nebula 1, uC nebula 2, uD aurora 1, uE aurora 2; uP: aurora amt, nebula amt; uQ: drift
  space: `void main(){ vec2 s=screen(); vec2 uv=(s+uQ.xy)/1080.;
    float n=fbm(uv*2.1+fbm(uv*3.2+uTime*.015)*1.4), m=fbm(uv*3.3-7.+fbm(uv*2.)*1.2);
    vec3 col=uA+uB*pow(n,3.2)*2.6*uP.y+uC*pow(m,4.)*3.2*uP.y;
    col+=stars((s+uQ.xy*.4)/17.,.075,uTime)*.8+stars((s+uQ.xy)/47.,.09,uTime)*1.2+stars((s+uQ.xy*1.8)/110.,.12,uTime)*1.5;
    for(int i=0;i<3;i++){ float fi=float(i);
      float base=.30+fi*.13+.11*sin(uv.x*2.3+uTime*.5+fi*2.)+.12*(fbm(vec2(uv.x*1.8+fi*5.,uTime*.12))-.5);
      float dd=s.y/1080.-base; float band=dd<0.?exp(dd*9.):exp(-dd*55.);
      float ray=.35+.65*fbm(vec2(uv.x*24.+fi*11.,uTime*.6));
      col+=mix(uD,uE,clamp(-dd*6.,0.,1.))*band*ray*uP.x*.75; }
    gl_FragColor=vec4(col,1.); }`,
  // hyper-speed tunnel. uA bg, uB,uC,uD streak colours; uP: centre x,y, speed, brightness
  warp: `void main(){ vec2 d=screen()-uP.xy; float r=length(d)/1080., a=atan(d.y,d.x)/6.2831853+.5;
    vec3 col=uA*(.5+r);
    for(int i=0;i<3;i++){ float fi=float(i); float cells=90.+fi*70.;
      float id=floor(a*cells); float h=hash(vec2(id,fi));
      float z=fract(log(r+.03)*(.9+fi*.25)-uTime*uP.z*(.5+h)+h*7.);
      float line=smoothstep(.5,0.,abs(fract(a*cells)-.5))*pow(z,3.)*step(.42,h);
      vec3 c= i==0?uB:(i==1?uC:uD);
      col+=c*line*smoothstep(.05,.45,r)*1.6; }
    col+=mix(uC,vec3(1.),.6)*exp(-r*7.)*uP.w;
    gl_FragColor=vec4(col,1.); }`,
  // rocketing straight up through clouds. uA sky top, uB sky bottom, uC lit, uD shade; uP: travel, density
  rush: `void main(){ vec2 s=screen(); vec3 col=mix(uA,uB,s.y/1080.);
    for(int L=0;L<3;L++){ float fl=float(L); float sc=1.+fl*.55;
      vec2 uv=vec2((s.x-960.)/560.*sc+fl*3.7, (s.y-uP.x*(420.+fl*560.))/900.*sc);
      vec2 w=vec2(fbm(uv*1.5),fbm(uv*1.5+9.));
      float n=fbm(uv+w*.8), up=fbm(uv+w*.8-vec2(0.,.14));
      float edge=smoothstep(0.,.55,abs(s.x-960.)/960.+.18*fl-.12);
      float m=smoothstep(.53-.1*edge,.64-.1*edge,n)*clamp(edge*1.5+.12,0.,1.)*uP.y;
      col=mix(col,mix(uD,uC,smoothstep(-.02,.05,n-up)),m); }
    float lx=floor(s.x/9.); float h=hash(vec2(lx,3.)); float z=fract(s.y/1500.-uTime*(2.2+h*2.)+h*9.);
    col+=step(.9,h)*pow(z,7.)*.7;
    gl_FragColor=vec4(col,1.); }`,
  // pop-art sunburst with halftone dots. uA,uB rays, uC dots; uP: cx, cy, spin, ray count
  burst: `void main(){ vec2 d=screen()-uP.xy; float r=length(d), a=atan(d.y,d.x);
    float ray=smoothstep(-.06,.06,sin(a*uP.w+uP.z+sin(r*.002)*.6));
    vec3 col=mix(uA,uB,ray);
    vec2 g=screen(); g=mat2(.866,-.5,.5,.866)*g/24.; float dot_=length(fract(g)-.5);
    float amt=smoothstep(250.,1150.,r)*.52;
    col=mix(col,uC,1.-smoothstep(amt-.05,amt+.05,dot_));
    col=mix(mix(uB,vec3(1.),.5),col,smoothstep(0.,520.,r)*.85+.15);
    gl_FragColor=vec4(col,1.); }`,
};
const bgPrograms = {};
for (const k in SHADERS) bgPrograms[k] = program(bgGL, COMMON + SHADERS[k]);

function backdrop(ctx, name, t, colors, p = [0, 0, 0, 0], q = [0, 0, 0, 0]) {
  const gl = bgGL, pr = bgPrograms[name];
  gl.useProgram(pr.p); gl.viewport(0, 0, W, H);
  gl.uniform1f(pr.loc('uTime'), t);
  'ABCDE'.split('').forEach((n, i) => gl.uniform3fv(pr.loc('u' + n), rgb(colors[i] || '#000000')));
  gl.uniform4f(pr.loc('uP'), p[0] || 0, p[1] || 0, p[2] || 0, p[3] || 0);
  gl.uniform4f(pr.loc('uQ'), q[0] || 0, q[1] || 0, q[2] || 0, q[3] || 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  ctx.drawImage(bgCanvas, 0, 0);
}

// -------------------------------------------------------------------- city
const SIGNS = ['おと', 'こえ', 'うた', 'ひびき', 'リズム', 'ノイズ', 'メロディ', '音', '声', '歌'];
function makeLayer(seed, { w = 3840, h = 760, minH, maxH, minW, maxW, body, edge, win, winOdds, neon }) {
  const c = mk(w, h), g = c.getContext('2d'), r = rng(seed);
  let x = -10;
  while (x < w) {
    const bw = Math.min(w + 10 - x, minW + r() * (maxW - minW)), bh = minH + r() * (maxH - minH), y = h - bh;
    g.fillStyle = body; g.fillRect(x, y, bw + 1, bh);
    g.fillStyle = edge; g.fillRect(x, y, 5, bh); g.fillRect(x, y, bw, 5);
    if (r() < 0.4) { g.fillStyle = body; g.fillRect(x + bw * 0.2, y - 30, bw * 0.35, 31); g.fillRect(x + bw * 0.62, y - 90, 5, 90); g.fillStyle = '#ff4f6d'; g.fillRect(x + bw * 0.62 - 2, y - 94, 9, 9); }
    const cw = 13, ch = 18;
    for (let wy = y + 22; wy < h - 14; wy += ch + 9) {
      const rowLit = r() < 0.25;
      for (let wx = x + 14; wx < x + bw - 20; wx += cw + 9) {
        if (r() < (rowLit ? winOdds * 2.2 : winOdds * 0.5)) { g.fillStyle = win[Math.floor(r() * win.length)]; g.fillRect(wx, wy, cw, ch); }
      }
    }
    if (neon && bw > 120 && r() < 0.62) {
      const word = SIGNS[Math.floor(r() * SIGNS.length)], col = ['#ff3fa4', '#3ff2ff', '#ffe14a', '#8dff6a'][Math.floor(r() * 4)];
      const size = 38, sx = x + 18 + r() * (bw - 90), sy = y + 34;
      g.save(); g.shadowColor = col; g.shadowBlur = 22; g.fillStyle = '#12082a';
      g.fillRect(sx - 8, sy - 8, size + 16, word.length * (size + 4) + 14);
      g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(sx - 8, sy - 8, size + 16, word.length * (size + 4) + 14);
      g.fillStyle = col; g.font = `900 ${size}px "Yu Gothic", "Meiryo", sans-serif`; g.textBaseline = 'top'; g.textAlign = 'center';
      [...word].forEach((ch2, i) => g.fillText(ch2, sx + size / 2, sy + i * (size + 4)));
      g.restore();
    }
    x += bw + r() * 16;
  }
  return c;
}
const cityCache = {};
function cityLayers(theme) {
  if (cityCache[theme]) return cityCache[theme];
  const T = {
    dusk: { bodies: ['#7b4c9b', '#43256e', '#1b0f3d'], edges: ['#e58fb4', '#ff8fa8', '#ffb08a'], win: ['#ffe9a8', '#ffb86b', '#8ff4ff'] },
    night: { bodies: ['#262b66', '#171a48', '#0a0c26'], edges: ['#4953a8', '#5b64c8', '#6fd8ff'], win: ['#ffe9a8', '#7ee8ff', '#ff7ac8'] },
    dawn: { bodies: ['#9fa8e8', '#6a6fc4', '#35357e'], edges: ['#ffe2c2', '#ffd0a8', '#ffe28a'], win: ['#fff6d0', '#ffd27a', '#aef6ff'] },
  }[theme];
  return cityCache[theme] = [0, 1, 2].map(i => makeLayer(100 + i * 31, {
    minH: [180, 150, 90][i], maxH: [500, 400, 300][i], minW: [70, 110, 190][i], maxW: [170, 250, 390][i],
    body: T.bodies[i], edge: T.edges[i], win: T.win, winOdds: [0.12, 0.17, 0.2][i], neon: i > 0 && theme !== 'dawn',
  }));
}
// scroll in pixels of the nearest layer; far layers move slower
function city(ctx, theme, scroll, base = H, scale = 1, only = null) {
  const layers = cityLayers(theme), speed = [0.16, 0.42, 1], lift = [-150, -62, 40];
  layers.forEach((c, i) => {
    if (only && !only.includes(i)) return;
    const w = c.width * scale, h = c.height * scale;
    let x = -((scroll * speed[i]) % w); if (x > 0) x -= w;
    for (; x < W; x += w) ctx.drawImage(c, x, base - h + lift[i] * scale, w, h);
    if (lift[i] < 0) { ctx.fillStyle = ['#7b4c9b', '#43256e'][i]; if (theme === 'night') ctx.fillStyle = ['#262b66', '#171a48'][i]; if (theme === 'dawn') ctx.fillStyle = ['#9fa8e8', '#6a6fc4'][i]; ctx.fillRect(0, base + lift[i] * scale - 1, W, -lift[i] * scale + 2); }
  });
}
function rooftop(ctx, x, y, w, rim = '#ffb08a', body = '#150a33') {
  ctx.fillStyle = body; ctx.fillRect(x, y, w, H - y + 300);
  ctx.fillStyle = rim; ctx.fillRect(x, y, w, 9); ctx.fillStyle = '#00000055'; ctx.fillRect(x, y + 34, w, 12);
  const r = rng(Math.floor(w * 7 + 3));
  for (let i = 0; i < w / 190; i++) { const bx = x + 30 + r() * (w - 140), bh = 18 + r() * 52; ctx.fillStyle = body; ctx.fillRect(bx, y - bh, 46 + r() * 60, bh); ctx.fillStyle = rim; ctx.fillRect(bx, y - bh, 46, 5); }
  for (let wx = x + 40; wx < x + w - 60; wx += 74) for (let wy = y + 90; wy < H + 200; wy += 96) if (hash(wx * 3 + wy) > 0.62) { ctx.fillStyle = hash(wx + wy) > 0.5 ? '#ffd88a' : '#6fe9ff'; ctx.fillRect(wx, wy, 34, 48); }
}

function planet(ctx, x, y, r, t) {
  glow(ctx, x, y, r * 1.28, '#4fc8ff', 0.8);
  ctx.save(); circle(ctx, x, y, r); ctx.fillStyle = lin(ctx, x - r, y - r, x + r * 0.5, y + r, ['#8af0ff', '#2c7be0', '#182a80']); ctx.fill(); ctx.clip();
  const q = rng(5);
  for (let i = 0; i < 46; i++) {
    const a = q() * TAU, d = Math.sqrt(q()) * r, px = x + Math.cos(a) * d + Math.sin(t * 0.2 + i) * 8, py = y + Math.sin(a) * d;
    ellipse(ctx, px, py, r * (0.05 + q() * 0.22), r * (0.012 + q() * 0.04), -0.35); ctx.fillStyle = i % 3 ? '#ffffff55' : '#5de8b066'; ctx.fill();
  }
  ctx.fillStyle = rad(ctx, x - r * 0.45, y - r * 0.55, r * 0.3, r * 1.75, [[0, '#0000'], [0.55, '#0000'], [1, '#020522ee']]); ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  circle(ctx, x, y, r); paint(ctx, null, '#bff6ffcc', 5);
}

// Fluffy anime cumulus built from overlapping discs, with two cel tones.
const puffCache = {};
function puff(ctx, x, y, w, seed, lit = '#fff2e8', shade = '#c78fc4', alpha = 1) {
  const key = seed + lit + shade;
  if (!puffCache[key]) {
    const c = mk(900, 520), g = c.getContext('2d'), r = rng(seed);
    const discs = [];
    for (let i = 0; i < 34; i++) { const u = r(); discs.push([110 + u * 680, 390 - Math.sin(Math.PI * u) * r() * 220, 34 + Math.sin(Math.PI * u) * 80 * (0.5 + r() * 0.6)]); }
    const all = (dx, dy, k, col) => { g.fillStyle = col; for (const [a, b, d] of discs) { g.beginPath(); g.arc(a + dx, b + dy, d * k, 0, TAU); g.fill(); } };
    all(0, 0, 1, shade);
    g.globalCompositeOperation = 'source-atop';
    all(-10, -26, 0.88, lit); all(-14, -38, 0.6, '#ffffff66');
    g.fillStyle = lin(g, 0, 300, 0, 480, [shade + '00', shade]); g.fillRect(0, 300, 900, 220);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = lin(g, 0, 400, 0, 470, ['#0000', '#000f']); g.fillRect(0, 400, 900, 120);
    puffCache[key] = c;
  }
  ctx.save(); ctx.globalAlpha = alpha; const h = w * 520 / 900; ctx.drawImage(puffCache[key], x - w / 2, y - h / 2, w, h); ctx.restore();
}

// Final GPU pass: bloom, lens fringing, zoom blur, shake, flashes, impact frames.
'use strict';
const outCanvas = mk();
document.body.appendChild(outCanvas);
window.OUTPUT = outCanvas;
const pg = outCanvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
quad(pg);

const POST_HEAD = 'precision highp float; uniform sampler2D uTex; uniform vec2 uRes;\n';
const brightProg = program(pg, POST_HEAD + `uniform float uThresh;
void main(){ vec2 uv=gl_FragCoord.xy/uRes; vec3 c=vec3(0.);
  for(int x=0;x<2;x++) for(int y=0;y<2;y++) c+=texture2D(uTex, uv+(vec2(float(x),float(y))-.5)/uRes*.5).rgb;
  c*=.25; float l=mix(max(c.r,max(c.g,c.b)), dot(c,vec3(.299,.587,.114)), .65);
  gl_FragColor=vec4(c*smoothstep(uThresh,uThresh+.22,l),1.); }`);
const blurProg = program(pg, POST_HEAD + `uniform vec2 uDir;
void main(){ vec2 uv=gl_FragCoord.xy/uRes, d=uDir/uRes;
  vec3 c=texture2D(uTex,uv).rgb*.227;
  c+=(texture2D(uTex,uv+d*1.385).rgb+texture2D(uTex,uv-d*1.385).rgb)*.316;
  c+=(texture2D(uTex,uv+d*3.231).rgb+texture2D(uTex,uv-d*3.231).rgb)*.07;
  gl_FragColor=vec4(c,1.); }`);
const finalProg = program(pg, POST_HEAD + `
uniform sampler2D uGlow1, uGlow2;
uniform float uBloom, uChroma, uZoom, uSat, uContrast, uVig, uGrain, uTime, uImpact, uBars, uFade, uInvert;
uniform vec2 uCenter, uShake; uniform vec4 uFlash; uniform vec3 uInk, uPaper, uTint; uniform vec3 uWave;
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 c=vec2(uCenter.x, 1.-uCenter.y);
  uv=(uv-.5)*(1.-(abs(uShake.x)+abs(uShake.y))*2.)+.5+vec2(uShake.x,-uShake.y);
  if(uWave.z>0.){ vec2 d=(uv-c)*vec2(1.7778,1.); float r=length(d); float k=exp(-pow((r-uWave.x)*16.,2.));
    uv-=normalize(d+1e-5)*k*uWave.z*vec2(.5625,1.); }
  vec2 dir=uv-c; vec3 col=vec3(0.);
  float spread=uChroma/1920.;
  for(int i=0;i<12;i++){ float k=float(i)/11.; vec2 p=uv-dir*uZoom*k;
    vec2 off=dir*spread*2.;
    col.r+=texture2D(uTex,p+off).r; col.g+=texture2D(uTex,p).g; col.b+=texture2D(uTex,p-off).b; }
  col/=12.;
  vec3 g=texture2D(uGlow1,uv).rgb*.65+texture2D(uGlow2,uv).rgb*.8;
  col=1.-(1.-col)*(1.-clamp(g*uBloom,0.,1.));
  float l=dot(col,vec3(.299,.587,.114));
  col=mix(vec3(l),col,uSat);
  col=(col-.5)*uContrast+.5;
  col*=uTint;
  if(uImpact>0.){ float t=smoothstep(.40,.47,dot(col,vec3(.299,.587,.114))); col=mix(col,mix(uInk,uPaper,t),uImpact); }
  if(uInvert>0.) col=mix(col,1.-col,uInvert);
  vec2 q=gl_FragCoord.xy/uRes-.5;
  col*=1.-uVig*smoothstep(.28,.86,length(q*vec2(1.12,1.)));
  col+=(hash(gl_FragCoord.xy+fract(uTime*7.31)*913.)-.5)*uGrain;
  col=mix(col,uFlash.rgb,clamp(uFlash.a,0.,1.));
  float y=1.-gl_FragCoord.y/uRes.y;
  if(y<uBars||y>1.-uBars) col=vec3(0.);
  gl_FragColor=vec4(col*(1.-uFade),1.);
}`);

function texture(w, h) {
  const t = pg.createTexture(); pg.bindTexture(pg.TEXTURE_2D, t);
  for (const [k, v] of [[pg.TEXTURE_MIN_FILTER, pg.LINEAR], [pg.TEXTURE_MAG_FILTER, pg.LINEAR], [pg.TEXTURE_WRAP_S, pg.CLAMP_TO_EDGE], [pg.TEXTURE_WRAP_T, pg.CLAMP_TO_EDGE]]) pg.texParameteri(pg.TEXTURE_2D, k, v);
  if (w) pg.texImage2D(pg.TEXTURE_2D, 0, pg.RGBA, w, h, 0, pg.RGBA, pg.UNSIGNED_BYTE, null);
  return t;
}
function target(w, h) {
  const t = texture(w, h), f = pg.createFramebuffer();
  pg.bindFramebuffer(pg.FRAMEBUFFER, f); pg.framebufferTexture2D(pg.FRAMEBUFFER, pg.COLOR_ATTACHMENT0, pg.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}
const sceneTex = texture();
const A1 = target(480, 270), B1 = target(480, 270), A2 = target(240, 135), B2 = target(240, 135);

function pass(prog, src, dst, set) {
  pg.useProgram(prog.p);
  pg.bindFramebuffer(pg.FRAMEBUFFER, dst ? dst.f : null);
  const w = dst ? dst.w : W, h = dst ? dst.h : H;
  pg.viewport(0, 0, w, h);
  pg.activeTexture(pg.TEXTURE0); pg.bindTexture(pg.TEXTURE_2D, src);
  pg.uniform1i(prog.loc('uTex'), 0); pg.uniform2f(prog.loc('uRes'), w, h);
  if (set) set();
  pg.drawArrays(pg.TRIANGLES, 0, 3);
}

const FX0 = () => ({ bloom: 0.5, thresh: 0.9, chroma: 2.2, zoom: 0, center: [0.5, 0.5], shake: [0, 0], flash: 0, flashColor: '#ffffff', sat: 1.06, contrast: 1.03, vig: 0.34, grain: 0.018, impact: 0, ink: '#120524', paper: '#ffffff', invert: 0, bars: 0, fade: 0, tint: [1, 1, 1], wave: [0, 0, 0] });

function postProcess(scene, fx, t) {
  pg.activeTexture(pg.TEXTURE0); pg.bindTexture(pg.TEXTURE_2D, sceneTex);
  pg.pixelStorei(pg.UNPACK_FLIP_Y_WEBGL, true);
  pg.texImage2D(pg.TEXTURE_2D, 0, pg.RGBA, pg.RGBA, pg.UNSIGNED_BYTE, scene);
  pg.pixelStorei(pg.UNPACK_FLIP_Y_WEBGL, false);
  pass(brightProg, sceneTex, A1, () => pg.uniform1f(brightProg.loc('uThresh'), fx.thresh));
  const blur = (src, dst, dx, dy) => pass(blurProg, src.t, dst, () => pg.uniform2f(blurProg.loc('uDir'), dx, dy));
  blur(A1, B1, 1, 0); blur(B1, A1, 0, 1); blur(A1, B1, 2, 0); blur(B1, A1, 0, 2);
  blur(A1, A2, 1, 0); blur(A2, B2, 2.5, 0); blur(B2, A2, 0, 2.5); blur(A2, B2, 4, 0); blur(B2, A2, 0, 4);
  pass(finalProg, sceneTex, null, () => {
    const u = finalProg.loc;
    pg.activeTexture(pg.TEXTURE1); pg.bindTexture(pg.TEXTURE_2D, A1.t); pg.uniform1i(u('uGlow1'), 1);
    pg.activeTexture(pg.TEXTURE2); pg.bindTexture(pg.TEXTURE_2D, A2.t); pg.uniform1i(u('uGlow2'), 2);
    pg.activeTexture(pg.TEXTURE0);
    for (const k of ['bloom', 'chroma', 'zoom', 'sat', 'contrast', 'vig', 'grain', 'impact', 'bars', 'fade', 'invert'])
      pg.uniform1f(u('u' + k[0].toUpperCase() + k.slice(1)), fx[k]);
    pg.uniform1f(u('uTime'), t);
    pg.uniform2f(u('uCenter'), fx.center[0], fx.center[1]);
    pg.uniform2f(u('uShake'), fx.shake[0], fx.shake[1]);
    const fc = rgb(fx.flashColor);
    pg.uniform4f(u('uFlash'), fc[0], fc[1], fc[2], fx.flash);
    pg.uniform3fv(u('uInk'), rgb(fx.ink)); pg.uniform3fv(u('uPaper'), rgb(fx.paper));
    pg.uniform3fv(u('uTint'), fx.tint); pg.uniform3fv(u('uWave'), fx.wave);
  });
}

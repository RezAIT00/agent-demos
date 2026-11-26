// Close-up hands: jointed rounded-cone skeletons ray-marched and lit by the ember.
// Units are roughly centimetres. x right, y up, z toward the camera.
const HANDS = (() => {
  const PER = 23, NH = 4;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const norm = (a) => mul(a, 1 / (hypot(a[0], a[1], a[2]) || 1));
  const rotX = (p, a) => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
  const rotY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
  const rotZ = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];

  // One right hand in its own frame: wrist at origin, fingers +x, palm up +y, thumb +z.
  function skeleton(o) {
    const { curl = 1, age = 0, child = 0 } = o;
    const prim = [];
    const seg = (a, b, ra, rb) => prim.push([a, b, ra, rb]);
    const fat = 1 + child * 0.16;
    // forearm
    seg([-52, -6.6, 0.6], [-11, -1.5, 0.2], 5.4 * fat, 3.15 * fat);
    seg([-11, -1.5, 0.2], [0.8, -0.35, 0], 3.15 * fat, 2.35 * fat);
    const fingers = [
      { z: 2.35, kx: 9.1, len: [3.9, 2.45, 2.15], r: [1.12, 0.96, 0.85, 0.72], c: 0.98, lat: 0.16 },
      { z: 0.62, kx: 9.55, len: [4.35, 2.75, 2.25], r: [1.16, 0.99, 0.87, 0.73], c: 1.02, lat: 0.04 },
      { z: -1.06, kx: 9.05, len: [4.05, 2.6, 2.2], r: [1.10, 0.95, 0.84, 0.71], c: 1.10, lat: -0.06 },
      { z: -2.60, kx: 8.15, len: [3.15, 2.0, 1.95], r: [0.98, 0.84, 0.75, 0.65], c: 1.18, lat: -0.17 },
    ];
    // palm: four metacarpals
    for (const f of fingers) {
      seg([1.3, -0.45, f.z * 0.52], [f.kx, 0.28 + Math.abs(f.z) * 0.09, f.z], 1.78 * fat, (f.r[0] + 0.14) * fat);
    }
    seg([1.4, 0.05, 2.1], [4.9, 0.62, 3.35], 1.95 * fat, 1.32 * fat);   // thenar pad
    seg([1.4, -0.1, -2.2], [6.2, 0.22, -2.85], 1.62 * fat, 1.08 * fat); // hypothenar pad
    const bend = [0.30, 0.50, 0.42];
    fingers.forEach((f, i) => {
      let p = [f.kx, 0.28 + Math.abs(f.z) * 0.09, f.z];
      let ang = 0;
      for (let j = 0; j < 3; j++) {
        ang += bend[j] * curl * f.c + (i === 0 ? -0.03 : 0);
        const dir = norm([Math.cos(ang), Math.sin(ang), f.lat * (j === 0 ? 0.16 : 0.05) - f.z * 0.012]);
        const q = add(p, mul(dir, f.len[j] * (1 - child * 0.08)));
        const knob = age * (j > 0 ? 0.075 : 0.05);
        seg(p, q, f.r[j] * fat * (1 + knob), f.r[j + 1] * fat * (1 - age * 0.05));
        p = q;
      }
    });
    // thumb
    let p = [2.1, 0.35, 2.9];
    const tdirs = [norm([0.72, 0.30, 0.62]), norm([0.86, 0.42 + 0.12 * (curl - 1), 0.28]), norm([0.80, 0.58, -0.06])];
    const tlen = [4.5, 3.0, 2.45], tr = [1.9, 1.42, 1.12, 0.84];
    for (let j = 0; j < 3; j++) {
      const q = add(p, mul(tdirs[j], tlen[j] * (1 - child * 0.1)));
      seg(p, q, tr[j] * fat * (1 + age * (j === 2 ? 0.06 : 0)), tr[j + 1] * fat);
      p = q;
    }
    return prim;
  }

  // A bowl = two hands side by side, little-finger edges touching.
  // o: {pos, yaw, pitch, roll, scale, curl, age, child, tone}
  function bowl(o) {
    const hands = [];
    for (const side of [1, -1]) {
      const prim = skeleton(o).map(([a, b, ra, rb]) => {
        const f = (v) => {
          let q = [v[0], v[1], v[2] * side];                   // mirror for the left hand
          q = rotX(q, -side * (o.roll ?? 0.26));               // tilt palms toward each other
          q = add(q, [0, 0, side * 3.45]);
          q = rotZ(sub(q, [7, 0, 0]), o.pitch || 0);           // tip about the middle of the palm
          q = rotY(q, o.yaw || 0);
          return add(mul(q, o.scale || 1), o.pos);
        };
        return [f(a), f(b), ra * (o.scale || 1), rb * (o.scale || 1)];
      });
      let up = rotX([0, 1, 0], -side * (o.roll ?? 0.26));
      up = rotY(rotZ(up, o.pitch || 0), o.yaw || 0);
      let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const [a, b, ra, rb] of prim) {
        for (const [v, r] of [[a, ra], [b, rb]]) {
          for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k] - r); hi[k] = Math.max(hi[k], v[k] + r); }
        }
      }
      const mid = mul(add(lo, hi), 0.5);
      let rad = 0;
      for (const [a, b, ra, rb] of prim) {
        rad = Math.max(rad, hypot(...sub(a, mid)) + ra, hypot(...sub(b, mid)) + rb);
      }
      hands.push({ prim, up, bound: [mid[0], mid[1], mid[2], rad], tone: o.tone, age: o.age || 0, scale: o.scale || 1 });
    }
    return hands;
  }

  // a point given in a bowl's local frame (x along fingers, y up, z sideways)
  function bowlPoint(o, local) {
    let q = rotZ(sub(local, [7, 0, 0]), o.pitch || 0);
    q = rotY(q, o.yaw || 0);
    return add(mul(q, o.scale || 1), o.pos);
  }

  const FS = GFX.HEAD + `
  out vec4 o;
  uniform vec4 uA[${PER * NH}]; uniform vec4 uB[${PER * NH}];
  uniform vec4 uBound[${NH}]; uniform vec3 uUp[${NH}]; uniform vec4 uTone[${NH}];
  uniform int uN;
  uniform vec4 uEmber; uniform float uEmberI, uT, uProj, uSolidR, uAmb;
  uniform vec3 uEye, uAt; uniform float uZoom;
  uniform vec3 uSkyA, uSkyB, uRimCol;
  uniform sampler2D uStars;

  float cone(vec3 p, vec4 A, vec4 B){
    vec3 a=A.xyz, ba=B.xyz-a; float r1=A.w, r2=B.w;
    float l2=dot(ba,ba), rr=r1-r2, a2=l2-rr*rr, il2=1.0/l2;
    vec3 pa=p-a; float y=dot(pa,ba), z=y-l2;
    vec3 xv=pa*l2-ba*y; float x2=dot(xv,xv), y2=y*y*l2, z2=z*z*l2;
    float k=sign(rr)*rr*rr*x2;
    if(sign(z)*a2*z2>k) return sqrt(x2+z2)*il2-r2;
    if(sign(y)*a2*y2<k) return sqrt(x2+y2)*il2-r1;
    return (sqrt(x2*a2*il2)+y*rr)*il2-r1;
  }
  float smin(float a, float b, float k){ float h=max(k-abs(a-b),0.0)/k; return min(a,b)-h*h*k*0.25; }
  float prim(vec3 p, int i){ return cone(p,uA[i],uB[i]); }

  float hand(vec3 p, int h, float sc){
    int b = h*${PER};
    float arm = smin(prim(p,b), prim(p,b+1), 1.4*sc);
    float palm = prim(p,b+2);
    for(int i=3;i<8;i++) palm = smin(palm, prim(p,b+i), 1.25*sc);
    float d = smin(arm, palm, 1.7*sc);
    float fg = 1e5;
    for(int f=0;f<4;f++){
      int s = b+8+f*3;
      float one = smin(smin(prim(p,s), prim(p,s+1), 0.30*sc), prim(p,s+2), 0.24*sc);
      fg = smin(fg, one, 0.20*sc);
    }
    d = smin(d, fg, 0.72*sc);
    float th = smin(smin(prim(p,b+20), prim(p,b+21), 0.55*sc), prim(p,b+22), 0.35*sc);
    return smin(d, th, 1.05*sc);
  }
  vec2 map(vec3 p){
    float best = 1e5, id = -1.0;
    for(int h=0; h<${NH}; h++){
      if(h >= uN) break;
      float bd = length(p-uBound[h].xyz) - uBound[h].w;
      if(bd > 1.2){ if(bd < best){ best = bd; id = float(h); } continue; }
      float d = hand(p, h, uTone[h].w);
      if(d < best){ best = d; id = float(h); }
    }
    return vec2(best,id);
  }
  float noise3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float n = i.x + i.y*57.0 + i.z*113.0;
    #define HH(k) fract(sin(k)*43758.5453)
    return mix(mix(mix(HH(n),HH(n+1.0),f.x), mix(HH(n+57.0),HH(n+58.0),f.x), f.y),
               mix(mix(HH(n+113.0),HH(n+114.0),f.x), mix(HH(n+170.0),HH(n+171.0),f.x), f.y), f.z); }
  float emberD(vec3 p){
    vec3 q = (p-uEmber.xyz)*vec3(1.0,1.28,1.08);
    return length(q) - uEmber.w*(0.86 + 0.30*noise3(q*1.9+3.0));
  }
  vec3 normalAt(vec3 p){
    vec2 e = vec2(1.0,-1.0)*0.035;
    return normalize(e.xyy*map(p+e.xyy).x + e.yyx*map(p+e.yyx).x + e.yxy*map(p+e.yxy).x + e.xxx*map(p+e.xxx).x);
  }
  float shadow(vec3 p, vec3 L, float dmax, float jit){
    float res = 1.0, t = 0.16 + 0.10*jit;
    for(int i=0;i<56;i++){
      if(t > dmax) break;
      float h = map(p+L*t).x;
      res = min(res, 5.5*h/t);
      if(res < 0.004) break;
      t += clamp(h*0.62, 0.07, 0.72);
    }
    res = clamp(res,0.0,1.0);
    return res*res*(3.0-2.0*res);
  }
  float aoAt(vec3 p, vec3 n){
    float s = 0.0, w = 1.0;
    for(int i=1;i<=5;i++){ float h = 0.28*float(i); s += (h - map(p+n*h).x)*w; w *= 0.68; }
    return clamp(1.0 - s*0.58, 0.0, 1.0);
  }

  void main(){
    vec2 sp = vec2(gl_FragCoord.x, RES.y-gl_FragCoord.y);
    vec2 uv = (gl_FragCoord.xy - RES*0.5)/RES.y;
    vec3 fw = normalize(uAt-uEye), rt = normalize(cross(fw,vec3(0,1,0))), up = cross(rt,fw);
    vec3 rd = normalize(fw*uZoom + rt*uv.x + up*uv.y);
    float pxAng = 1.0/(uZoom*RES.y);

    vec3 col = mix(uSkyB, uSkyA, smoothstep(-0.55,0.55,uv.y));
    col += texture(uStars, sp/RES).rgb;
    // warm air around the ember
    float along = max(dot(uEmber.xyz-uEye, rd), 0.0);
    float miss = length(uEye + rd*along - uEmber.xyz);
    col += vec3(1.0,0.40,0.10)*uEmberI*(0.115*exp(-miss*miss/60.0) + 0.028*exp(-miss/13.0));

    float t = 20.0, hit = -1.0, hid = -1.0, graze = 1e5, tg = 0.0;
    for(int i=0;i<150;i++){
      vec3 p = uEye + rd*t;
      vec2 m = map(p);
      float rel = m.x/(t*pxAng);
      if(rel < graze){ graze = rel; tg = t; }
      if(m.x < 0.006){ hit = t; hid = m.y; break; }
      t += m.x*0.80;
      if(t > 140.0) break;
    }
    float te = 20.0, ehit = -1.0;
    for(int i=0;i<70;i++){
      vec3 p = uEye+rd*te;
      float d = emberD(p);
      if(d < 0.015){ ehit = te; break; }
      te += d*0.7;
      if(te > 140.0) break;
    }

    float dotsG = smoothstep(0.50,0.28,length(fract(sp/5.5)-0.5));
    vec3 ink = vec3(0.66,0.90,1.0);

    if(hit > 0.0){
      vec3 p = uEye+rd*hit;
      vec3 n = normalAt(p);
      int h = int(hid+0.5);
      float age = uTone[h].y, sc = uTone[h].w;
      // skin grain, and deeper creasing for the old hands
      vec3 q = p/sc;
      vec3 bump = vec3(noise3(q*3.1), noise3(q*3.1+19.0), noise3(q*3.1+41.0)) - 0.5;
      vec3 fine = vec3(noise3(q*7.5+5.0), noise3(q*7.5+23.0), noise3(q*7.5+47.0)) - 0.5;
      vec3 crease = vec3(noise3(q*vec3(4.6,1.5,1.6)+2.0), noise3(q*vec3(4.6,1.5,1.6)+9.0), noise3(q*vec3(4.6,1.5,1.6)+13.0)) - 0.5;
      n = normalize(n + bump*0.10 + fine*0.075 + crease*age*0.42);
      float palm = smoothstep(0.05,0.85,dot(n,uUp[h]));
      float tn = uTone[h].x;
      vec3 skin = mix(vec3(0.355,0.200,0.130), vec3(0.560,0.350,0.245), tn);
      skin = mix(skin, skin*vec3(1.30,1.20,1.18)+vec3(0.05,0.012,0.008), palm*0.62);
      skin *= 0.87 + 0.20*noise3(q*0.85) + 0.07*noise3(q*5.0);
      skin *= 1.0 - age*0.20*smoothstep(0.55,0.85,noise3(q*1.7+30.0));

      vec3 Lv = uEmber.xyz + vec3(0.0,0.55,0.35) - p;
      float dist = length(Lv); vec3 L = Lv/dist;
      float att = uEmberI/(1.0 + pow(dist/8.6, 2.15));
      float ndl = dot(n,L);
      float sh = shadow(p+n*0.07, L, max(dist-uEmber.w*1.3, 0.0), h21(sp));
      float occ = aoAt(p,n);
      float wrap = clamp((ndl+0.32)/1.32, 0.0, 1.0);
      vec3 warm = vec3(1.0,0.63,0.31);
      vec3 c = skin*warm*att*(wrap*(0.20+0.80*sh))*3.0*(0.40+0.60*occ);
      // light bleeding through thin flesh
      float thin = clamp(map(p - n*0.9 + L*1.35).x*1.35 + 0.30, 0.0, 1.0);
      c += vec3(0.95,0.17,0.055)*att*thin*(0.38+0.62*(1.0-clamp(ndl,0.0,1.0)))*0.52*occ;
      vec3 hv = normalize(L - rd);
      c += warm*att*sh*pow(max(dot(n,hv),0.0), 22.0)*0.20*(1.0-age*0.4);
      // bounce from the glowing palm and a cool edge from the night sky
      c += skin*vec3(1.0,0.45,0.20)*att*0.16*occ;
      float fres = pow(1.0 - clamp(dot(n,-rd),0.0,1.0), 3.2);
      c += uRimCol*fres*(0.30+0.70*clamp(dot(n,normalize(vec3(0.35,0.8,-0.5)))+0.35,0.0,1.0))*occ;
      c += skin*uAmb*(0.5+0.5*n.y)*occ;

      if(uProj > 0.001){
        float near = exp(-pow(length(p-uEmber.xyz)/max(uSolidR,0.1), 4.0));
        float k = uProj*(1.0-near);
        float lum = dot(c, vec3(0.3,0.55,0.15));
        vec3 drawn = c*0.44 + vec3(0.010,0.030,0.055) + ink*dotsG*(0.055+0.42*fres+0.10*lum);
        drawn += ink*smoothstep(0.16,0.04,abs(fract((sp.x+sp.y)/8.5)-0.5))*0.045;
        c = mix(c, drawn, k);
      }
      col = c;
    } else if(graze < 2.2){
      // anti-aliased silhouette, with the drawn-light outline in projection
      vec3 p = uEye + rd*tg;
      vec3 n = normalAt(p);
      float cover = 1.0 - smoothstep(0.0,1.5,graze);
      float dist = length(uEmber.xyz-p);
      float att = uEmberI/(1.0+pow(dist/8.6,2.15));
      float back = clamp(dot(n,normalize(uEmber.xyz-p))+0.5,0.0,1.0);
      vec3 edgeCol = vec3(0.75,0.35,0.16)*att*back*0.75 + uRimCol*0.28;
      col = mix(col, edgeCol, cover*0.85);
    }
    if(uProj > 0.001){
      float near = exp(-pow(length(uEye+rd*tg-uEmber.xyz)/max(uSolidR,0.1), 4.0));
      float line = (hit > 0.0) ? 0.0 : exp(-pow((graze-1.1)/1.35, 2.0));
      col += ink*line*uProj*(1.0-near*0.85)*(0.34+0.72*dotsG);
    }

    if(ehit > 0.0 && (hit < 0.0 || ehit < hit)){
      vec3 p = uEye+rd*ehit;
      vec3 q = (p-uEmber.xyz)/uEmber.w;
      float cr = noise3(q*3.4 + vec3(0.0,uT*0.55,0.0));
      float cr2 = noise3(q*7.6 - vec3(uT*0.40,0.0,uT*0.3));
      float hot = smoothstep(0.34,0.78, cr*0.72+cr2*0.42);
      vec3 ec = mix(vec3(0.10,0.022,0.012), vec3(1.25,0.28,0.025), smoothstep(0.05,0.55,hot));
      ec = mix(ec, vec3(1.65,1.00,0.38), smoothstep(0.55,0.95,hot));
      ec = mix(ec, vec3(1.85,1.55,0.95), smoothstep(0.88,1.02,hot));
      col = ec*(0.34+0.82*uEmberI);
    }
    // soft corona
    col += vec3(1.0,0.46,0.11)*uEmberI*0.20*exp(-max(miss-uEmber.w*0.7,0.0)/1.25)*(hit > 0.0 && hit < along-1.6 ? 0.30 : 1.0);
    o = vec4(col,1.0);
  }`;

  const prog = GFX.program(FS);
  const A = new Float32Array(PER * NH * 4), B = new Float32Array(PER * NH * 4);
  const bound = new Float32Array(NH * 4), ups = new Float32Array(NH * 3), tones = new Float32Array(NH * 4);

  // scene: { hands:[...from bowl()], ember:[x,y,z,r], emberI, proj, solidR, eye, at, zoom, skyA, skyB, rim, amb }
  function render(s, fb, t, starsTex) {
    const gl = GFX.gl;
    A.fill(0); B.fill(0); bound.fill(0); ups.fill(0); tones.fill(0);
    s.hands.slice(0, NH).forEach((h, k) => {
      h.prim.forEach(([a, b, ra, rb], i) => {
        const j = (k * PER + i) * 4;
        A.set([a[0], a[1], a[2], ra], j);
        B.set([b[0], b[1], b[2], rb], j);
      });
      bound.set(h.bound, k * 4);
      ups.set(h.up, k * 3);
      tones.set([h.tone ?? 0.35, h.age, 0, h.scale], k * 4);
    });
    gl.disable(gl.BLEND);
    GFX.use(fb);
    gl.useProgram(prog);
    GFX.bind(prog, 'uStars', 0, starsTex);
    gl.uniform4fv(prog.u('uA[0]'), A); gl.uniform4fv(prog.u('uB[0]'), B);
    gl.uniform4fv(prog.u('uBound[0]'), bound); gl.uniform3fv(prog.u('uUp[0]'), ups);
    gl.uniform4fv(prog.u('uTone[0]'), tones);
    gl.uniform1i(prog.u('uN'), Math.min(NH, s.hands.length));
    gl.uniform4f(prog.u('uEmber'), ...s.ember);
    gl.uniform1f(prog.u('uEmberI'), s.emberI);
    gl.uniform1f(prog.u('uT'), t);
    gl.uniform1f(prog.u('uProj'), s.proj || 0);
    gl.uniform1f(prog.u('uSolidR'), s.solidR || 8);
    gl.uniform1f(prog.u('uAmb'), s.amb ?? 0.012);
    gl.uniform3f(prog.u('uEye'), ...s.eye); gl.uniform3f(prog.u('uAt'), ...s.at);
    gl.uniform1f(prog.u('uZoom'), s.zoom);
    gl.uniform3f(prog.u('uSkyA'), ...v3(s.skyA || '#04060f'));
    gl.uniform3f(prog.u('uSkyB'), ...v3(s.skyB || '#0a0810'));
    gl.uniform3f(prog.u('uRimCol'), ...v3(s.rim || '#5470b8', 0.55));
    GFX.draw();
  }

  // screen position (px) of a 3D point for the same camera
  function project(s, p) {
    const fw = norm(sub(s.at, s.eye));
    const rt = norm([-fw[2], 0, fw[0]]);
    const up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
    const d = sub(p, s.eye);
    const z = d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2];
    const x = (d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2]) / z * s.zoom;
    const y = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / z * s.zoom;
    return [W / 2 + x * H, H / 2 - y * H];
  }

  return { bowl, bowlPoint, render, project };
})();

// WebGL2 compositor. Canvas2D draws the layers; GL adds sky / planet / rock,
// rim light thrown by the flame, procedural fire, transitions, bloom and grade.
const GFX = (() => {
  const out = document.getElementById('film');
  out.width = W; out.height = H;
  const gl = out.getContext('webgl2', {
    preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 is required');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('float render targets are required');

  // The drawing layers use the CPU rasteriser. The GPU path renderer anti-aliases
  // the same path slightly differently depending on what it has cached, and every
  // frame here has to be a pure function of t.
  const layers = {};
  for (const name of ['back', 'far', 'near', 'glow', 'hud']) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    layers[name] = c.getContext('2d', { willReadFrequently: true });
  }

  const VS = `#version 300 es
  void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.0-1.0,0.0,1.0); }`;

  const HEAD = `#version 300 es
  precision highp float; precision highp int;
  const vec2 RES = vec2(1920.0,1080.0);
  float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return s/0.96875; }
  `;

  const SCENE_FS = HEAD + `
  out vec4 o;
  uniform sampler2D uBack,uFar,uNear,uGlow,uBgTex,uLand;
  uniform int uMode; uniform float uT;
  uniform vec3 uTop,uMid,uLow,uGround,uCloudCol,uSunCol,uMoonCol,uSkyRim,uHazeCol;
  uniform float uMidAt,uHorizon,uMilky,uAurora,uCloud,uRim,uSkyRimAmt,uHaze,uGlowGain,uBands;
  uniform vec4 uSun,uMoon;
  uniform vec4 uLPos[4]; uniform vec3 uLCol[4];
  uniform float uProj,uSweep,uGhost; uniform vec4 uSolid;
  uniform vec4 uGlobe; uniform mat3 uRot; uniform float uCity,uDawn;
  uniform vec4 uTorch; uniform vec3 uTorchCol; uniform vec4 uRock,uPanel;

  vec3 sky(vec2 p){
    float hz = uHorizon;
    float t = clamp(p.y/max(hz,1.0),0.0,1.0);
    vec3 c = t < uMidAt ? mix(uTop,uMid,smoothstep(0.0,uMidAt,t)) : mix(uMid,uLow,smoothstep(uMidAt,1.0,t));
    if(p.y > hz) c = mix(uLow,uGround,smoothstep(hz,hz+90.0,p.y));
    float above = 1.0 - smoothstep(hz-40.0,hz+10.0,p.y);
    if(uMilky > 0.001){
      vec2 q = p - vec2(960.0,300.0);
      float a = -0.42; q = mat2(cos(a),sin(a),-sin(a),cos(a))*q;
      float warp = (fbm(q*0.004)-0.5)*150.0;
      float band = exp(-pow((q.y+warp)/150.0,2.0));
      float dust = fbm(q*0.011+vec2(3.1,7.7));
      float lane = smoothstep(0.42,0.68,fbm(q*vec2(0.006,0.016)+vec2(11.0,2.0)));
      float m = band*(0.25+dust*1.1)*(1.0-0.75*lane*exp(-pow((q.y+warp)/55.0,2.0)));
      vec3 mc = mix(vec3(0.30,0.38,0.62),vec3(0.72,0.58,0.52),fbm(q*0.003+5.0));
      float grain = pow(h21(floor(p/1.6)),38.0)*band*1.6;
      c += (mc*m*0.30 + vec3(0.8,0.85,1.0)*grain*0.55)*uMilky*above;
    }
    if(uAurora > 0.001){
      vec3 acc = vec3(0.0);
      for(int i=0;i<3;i++){
        float fi = float(i);
        float x = p.x*0.0016 + fi*3.7 + uT*0.035*(1.0+fi*0.4);
        float base = 330.0 + fi*85.0 + (fbm(vec2(x*1.3,fi*5.0))-0.5)*330.0;
        float dy = base - p.y;
        float curtain = dy > 0.0 ? exp(-dy/(170.0+fi*40.0)) : exp(dy/16.0);
        float rays = 0.45 + 0.55*pow(vn(vec2(p.x*0.028 + fbm(vec2(x*3.0,uT*0.2))*9.0, fi*9.0+uT*0.25)),1.6)*1.6;
        float breadth = smoothstep(0.30,0.72,fbm(vec2(x*0.9+8.0,fi*2.0)));
        vec3 col = mix(vec3(0.10,0.95,0.55),vec3(0.42,0.22,0.85),clamp(dy/260.0,0.0,1.0));
        acc += col*curtain*rays*breadth;
      }
      c += acc*uAurora*0.36*above;
    }
    if(uSun.z > 0.0){
      float d = length(p-uSun.xy);
      c += uSunCol*(exp(-d/(uSun.w))*0.55 + exp(-d/(uSun.w*3.5))*0.22);
      c = mix(c, min(c+uSunCol*1.15,vec3(1.6)), (1.0-smoothstep(uSun.z-1.5,uSun.z+1.5,d))*above*smoothstep(0.0,0.25,max(uSunCol.r,uSunCol.g)));
    }
    if(uCloud > 0.001){
      vec2 cp = vec2(p.x*0.0017 + uT*0.018, p.y*0.0062);
      float n = fbm(cp + vec2(fbm(cp*2.1)*0.9, 0.0));
      float cl = smoothstep(0.50,0.80,n)*smoothstep(0.0,170.0,p.y)*above;
      float lit = fbm(cp+vec2(0.0,0.09));
      vec3 cc = mix(uCloudCol*0.72, uCloudCol*1.18, smoothstep(0.40,0.70,lit));
      if(uSun.z > 0.0) cc += uSunCol*exp(-length(p-uSun.xy)/380.0)*0.45;
      c = mix(c, cc, cl*uCloud);
    }
    if(uMoon.w > 0.001){
      vec2 q = p-uMoon.xy; float d = length(q);
      c += uMoonCol*exp(-d/(uMoon.z*3.0))*0.16*uMoon.w;
      float disc = 1.0-smoothstep(uMoon.z-1.2,uMoon.z+1.2,d);
      if(disc > 0.0){
        float shade = smoothstep(-6.0,6.0, length(q-vec2(-uMoon.z*0.55,-uMoon.z*0.18))-uMoon.z*0.98);
        float mare = fbm(q*(3.6/uMoon.z)+2.0);
        vec3 mc = uMoonCol*(0.86-0.30*smoothstep(0.46,0.72,mare));
        c = mix(c, mix(c+uMoonCol*0.045, mc, shade), disc*uMoon.w);
      }
    }
    return c;
  }

  vec3 globe(vec2 p, vec3 bg){
    vec2 d = (p-uGlobe.xy)/uGlobe.z;
    float r2 = dot(d,d), r = sqrt(r2);
    vec3 sunDir = normalize(vec3(-0.75,0.35,0.28));
    float halo = r > 1.0 ? exp(-(r-1.0)*24.0) : 0.0;
    bg += vec3(0.13,0.34,0.72)*halo*(0.35+0.65*clamp(dot(normalize(vec3(d.x,-d.y,0.0)),sunDir)+0.55,0.0,1.0))*0.85;
    float edge = 1.0 - smoothstep(1.0-1.6/uGlobe.z, 1.0+0.4/uGlobe.z, r);
    if(edge <= 0.0) return bg;
    float z = sqrt(max(0.0,1.0-min(r2,1.0)));
    vec3 n = vec3(d.x,-d.y,z);
    vec3 w = n*uRot;
    float lat = asin(clamp(w.y,-1.0,1.0)), lon = atan(w.x,w.z);
    vec2 uv = vec2(lon/6.2831853+0.5, 0.5-lat/3.14159265);
    vec2 q = vec2(lon,lat)*22.0;
    vec2 warp = vec2(fbm(q)-0.5, fbm(q+vec2(31.0,7.0))-0.5);
    vec2 q2 = vec2(lon,lat)*70.0;
    warp += 0.35*vec2(fbm(q2)-0.5, fbm(q2+vec2(3.0,51.0))-0.5);
    vec4 tx = texture(uLand, uv + warp*vec2(0.0065,0.013));
    float land = smoothstep(0.35,0.65,tx.r);
    float relief = fbm(vec2(lon,lat)*13.0 + warp*3.0);
    float dry = tx.g;
    vec3 green = mix(vec3(0.045,0.105,0.075),vec3(0.115,0.165,0.095),relief);
    vec3 sand = mix(vec3(0.19,0.135,0.075),vec3(0.30,0.225,0.125),relief);
    vec3 lc = mix(green,sand,smoothstep(0.2,0.8,dry));
    float ice = max(smoothstep(1.12,1.27,abs(lat)+(relief-0.5)*0.25), tx.b);
    lc = mix(lc, vec3(0.50,0.58,0.68), ice);
    vec3 ocean = mix(vec3(0.010,0.030,0.072),vec3(0.022,0.062,0.125),fbm(vec2(lon,lat)*5.0));
    vec3 col = mix(ocean,lc,land);
    float diff = clamp(dot(n,sunDir)*0.85+0.42,0.0,1.0);
    col *= 0.42 + diff*1.05;
    float clouds = smoothstep(0.52,0.82,fbm(vec2(lon*5.0+uT*0.02,lat*8.5)+warp*2.2));
    col = mix(col, vec3(0.45,0.55,0.70)*(0.25+diff*0.8), clouds*0.30);
    vec3 hv = normalize(sunDir+vec3(0.0,0.0,1.0));
    col += vec3(0.20,0.30,0.45)*pow(max(dot(n,hv),0.0),28.0)*(1.0-land)*0.5;
    if(uCity > 0.001){
      float seeds = pow(vn(vec2(lon,lat)*210.0),5.0)*2.0 + pow(vn(vec2(lon,lat)*95.0+9.0),7.0)*2.4;
      float dens = tx.a < 0.999 ? 1.0-tx.a : 0.0;
      float lights = dens*(0.28+seeds*2.1) + land*(1.0-ice)*seeds*0.08*(1.0-dry*0.8);
      col += vec3(1.0,0.66,0.30)*lights*uCity*(1.25-diff*0.55)*(0.35+0.65*z);
    }
    float rim = pow(1.0-z,2.6);
    col = mix(col, vec3(0.16,0.40,0.82)*(0.35+diff*0.9), rim*0.80);
    return mix(bg,col,edge);
  }

  float rockH(vec2 p){
    float a = fbm(p*0.0032);
    float b = fbm(p*0.0105 + a*2.4);
    float cr = 1.0-abs(fbm(p*vec2(0.0048,0.0075)+vec2(5.0,a))*2.0-1.0);
    return a*150.0 + b*34.0 - pow(cr,7.0)*17.0 + vn(p*0.09)*2.2;
  }
  float panelW(vec2 q){
    vec2 d = (q-uPanel.xy)/uPanel.zw;
    float r = length(d) + (fbm(q*0.0075)-0.5)*0.55;
    return 1.0-smoothstep(0.62,1.08,r);
  }
  float wallH(vec2 q){
    float h = rockH(q);
    return mix(h, 92.0 + (h-92.0)*0.16, panelW(q));
  }
  vec3 rockWall(vec2 p, vec4 paint){
    vec2 q = (p - 960.0*vec2(1.0,0.56))*uRock.z + uRock.xy;
    float h = wallH(q);
    float e = 2.0;
    vec3 n = normalize(vec3(-(wallH(q+vec2(e,0))-h)/e, -(wallH(q+vec2(0,e))-h)/e, 1.0));
    float t1 = fbm(q*0.0045+vec2(9.0,2.0)), t2 = fbm(q*0.016+vec2(2.0,19.0));
    vec3 alb = mix(vec3(0.33,0.215,0.135), vec3(0.62,0.46,0.29), smoothstep(0.3,0.72,t1));
    alb = mix(alb, vec3(0.43,0.22,0.12), smoothstep(0.55,0.75,t2)*0.5);
    alb *= 0.86 + 0.28*vn(q*0.35);
    float pw = panelW(q);
    vec3 calc = mix(vec3(0.66,0.54,0.38), vec3(0.80,0.70,0.52), fbm(q*0.012+vec2(40.0,3.0)));
    calc *= 0.90 + 0.18*vn(q*0.22) - 0.10*smoothstep(0.55,0.75,fbm(q*vec2(0.02,0.006)));
    alb = mix(alb, calc, pw*0.82);
    if(paint.a > 0.002){
      vec3 pc = paint.rgb/paint.a;
      float wear = 0.80 + 0.30*fbm(q*0.055);
      alb = mix(alb, pc, clamp(paint.a*wear,0.0,1.0));
    }
    vec3 lp = vec3(uTorch.xy, uTorch.z);
    vec3 pos = vec3(p, (h-90.0)*0.7);
    vec3 L = lp-pos; float dist = length(L); L /= dist;
    float diff = max(dot(n,L),0.0);
    float sh = 1.0;
    for(int i=1;i<=6;i++){
      float k = float(i)*11.0;
      vec2 sq = q + normalize(lp.xy-p)*k*uRock.z;
      float rise = (wallH(sq)-h)*0.7;
      sh *= 1.0 - clamp((rise - k*L.z/max(length(L.xy),0.05))*0.045,0.0,0.45);
    }
    float att = uTorch.w/(1.0+pow(dist/610.0,3.1));
    vec3 col = alb*uTorchCol*(diff*0.92+0.11)*att*sh*1.55;
    col += alb*vec3(0.010,0.014,0.026);
    return col;
  }

  vec4 tx(sampler2D s, vec2 p){ return texture(s, p/RES); }

  vec3 lightOn(vec2 p, vec3 base, float resp){
    vec3 add = vec3(0.0);
    for(int i=0;i<4;i++){
      float I = uLPos[i].w; if(I <= 0.0) continue;
      float d = length(p-uLPos[i].xy)/uLPos[i].z;
      add += uLCol[i]*I*exp(-d*d*2.2);
    }
    return base + (base*0.85+0.022)*add*resp;
  }
  vec3 rimOn(vec2 p, float a){
    vec3 add = vec3(0.0);
    for(int i=0;i<4;i++){
      float I = uLPos[i].w; if(I <= 0.0) continue;
      vec2 to = uLPos[i].xy-p; float dist = length(to);
      float d = dist/uLPos[i].z;
      vec2 dir = to/max(dist,1.0);
      float a1 = tx(uNear,p+dir*2.2).a, a2 = tx(uNear,p+dir*5.5).a, a3 = tx(uNear,p+dir*11.0).a;
      float m = a*((1.0-a1)*0.50 + (1.0-a2)*0.24 + (1.0-a3)*0.10);
      add += uLCol[i]*I*m*exp(-d*d*0.75);
    }
    add *= uRim;
    float up = tx(uNear,p+vec2(0.0,-3.0)).a;
    add += uSkyRim*a*(1.0-up)*uSkyRimAmt;
    return add;
  }

  // contour strength of a layer's alpha around p
  float contour(sampler2D s, vec2 p){
    float x = tx(s,p+vec2(1.8,0)).a - tx(s,p-vec2(1.8,0)).a;
    float y = tx(s,p+vec2(0,1.8)).a - tx(s,p-vec2(0,1.8)).a;
    return clamp(length(vec2(x,y))*1.15,0.0,1.0);
  }
  float inner(sampler2D s, vec2 p){
    vec3 w = vec3(0.30,0.55,0.15);
    float x = dot(tx(s,p+vec2(1.6,0)).rgb - tx(s,p-vec2(1.6,0)).rgb, w);
    float y = dot(tx(s,p+vec2(0,1.6)).rgb - tx(s,p-vec2(0,1.6)).rgb, w);
    return clamp(length(vec2(x,y))*6.0-0.12,0.0,1.0);
  }

  void main(){
    vec2 p = vec2(gl_FragCoord.x, RES.y-gl_FragCoord.y);
    vec4 back = tx(uBack,p), far = tx(uFar,p), near = tx(uNear,p), glow = tx(uGlow,p);
    vec3 col;
    if(uMode == 0){ col = sky(p) + back.rgb; }
    else if(uMode == 1){
      col = sky(p) + back.rgb;
      col = globe(p, col);
    }
    else if(uMode == 2){ col = rockWall(p, far); far = vec4(0.0); }
    else { col = texture(uBgTex, gl_FragCoord.xy/RES).rgb; }

    // projection weight: right of nothing, left of the sweeping 2026 line,
    // and relaxed close to the (solid) flame
    float pj = 0.0;
    if(uProj > 0.001){
      pj = uProj*(1.0-smoothstep(uSweep-3.0,uSweep+3.0,p.x));
      if(uSolid.z > 0.0){
        float d = length(p-uSolid.xy)/uSolid.z;
        pj *= 1.0 - uSolid.w*exp(-d*d*d*d);
      }
    }
    float dots = smoothstep(0.52,0.30,length(fract(p/5.5)-0.5));
    float hatch = smoothstep(0.16,0.06,abs(fract((p.x+p.y)/8.5)-0.5));
    vec3 ink = vec3(0.66,0.90,1.0);

    if(far.a > 0.001){
      vec3 fc = far.rgb/far.a;
      fc = mix(fc,uHazeCol,uHaze);
      fc = lightOn(p,fc,0.45);
      col = mix(col,fc,far.a);
    }
    if(pj > 0.001 && uMode != 2){
      float e = contour(uFar,p), ei = inner(uFar,p)*far.a;
      float lum = dot(col,vec3(0.3,0.55,0.15));
      vec3 cool = mix(col, vec3(lum)*vec3(0.76,0.95,1.17)+vec3(0.006,0.016,0.030), 0.42);
      cool += ink*(hatch*far.a*0.018 + max(e,ei*0.5)*(0.045+0.17*dots));
      col = mix(col,cool,pj);
    }
    if(near.a > 0.001 || pj > 0.001){
      float a = near.a;
      vec3 nc = a > 0.001 ? near.rgb/a : vec3(0.0);
      nc = lightOn(p,nc,1.0);
      vec3 rimc = rimOn(p,a);
      vec3 solid = mix(col, nc + rimc, a);
      if(pj > 0.001){
        float e = contour(uNear,p), ei = inner(uNear,p)*a;
        vec3 fill = nc*vec3(0.82,0.98,1.20) + vec3(0.008,0.024,0.044);
        vec3 drawn = mix(col, fill, a*0.82);
        drawn += ink*hatch*a*0.034;
        drawn += ink*(e*(0.12+0.50*dots) + ei*(0.04+0.17*dots));
        drawn += rimc*0.55;
        if(uGhost > 0.1){
          vec2 g = vec2(uGhost, -uGhost*0.28);
          drawn += ink*contour(uNear,p+g)*dots*0.24*(1.0-a);
          drawn += vec3(1.0,0.72,0.60)*contour(uNear,p-g*0.72)*dots*0.17*(1.0-a);
        }
        solid = mix(solid,drawn,pj);
      }
      col = solid;
    }
    col += glow.rgb*uGlowGain;
    if(uProj > 0.001 && uSweep > -100.0 && uSweep < 2100.0){
      float d = abs(p.x-uSweep);
      col += vec3(0.75,0.92,1.0)*(exp(-d/2.2)*0.95 + exp(-d/46.0)*0.16)*uProj;
    }
    o = vec4(col,1.0);
  }`;

  const FLAME_FS = HEAD + `
  out vec4 o;
  uniform vec4 uF; uniform vec4 uF2; uniform float uT;
  void main(){
    vec2 p = vec2(gl_FragCoord.x, RES.y-gl_FragCoord.y);
    float w = uF.z, h = uF.w, seed = uF2.x, I = uF2.y, lean = uF2.z;
    vec2 q = vec2((p.x-uF.x)/w, (uF.y-p.y)/h);
    q.x -= lean*q.y*q.y;
    float n1 = fbm(vec2(q.x*1.5+seed, q.y*2.0 - uT*2.9));
    float n2 = fbm(vec2(q.x*3.4-seed, q.y*4.2 - uT*5.1));
    float x = q.x + (n1-0.5)*1.15*clamp(q.y+0.15,0.0,1.2) + (n2-0.5)*0.35*q.y;
    float yy = q.y + (n2-0.5)*0.30*q.y;
    float wid = pow(clamp(1.0-yy,0.0,1.0),0.72)*smoothstep(-0.07,0.24,q.y)*(1.0+0.12*n2);
    float d = abs(x)/max(wid,0.0015);
    float body = (1.0-smoothstep(0.35,1.12,d))*step(0.002,wid);
    float tongue = smoothstep(0.30,0.72,n1+ (1.0-yy)*0.45);
    body *= mix(1.0,tongue,smoothstep(0.15,0.75,yy));
    float core = (1.0-smoothstep(0.0,0.72,d))*smoothstep(0.62,0.06,yy)*smoothstep(-0.05,0.14,q.y);
    vec3 c = mix(vec3(0.80,0.13,0.02), vec3(1.0,0.46,0.06), smoothstep(0.15,0.8,body*(1.1-yy*0.6)));
    c = mix(c, vec3(1.0,0.80,0.34), smoothstep(0.05,0.65,core));
    c = mix(c, vec3(1.0,0.96,0.80), smoothstep(0.55,1.0,core));
    vec3 col = c*body*(0.86+core*0.62)*I;
    float halo = exp(-length(vec2(q.x*w/(h*0.78), (q.y-0.30)*1.15))*2.7);
    col += vec3(1.0,0.42,0.10)*halo*0.17*I*uF2.w;
    o = vec4(col,1.0);
  }`;

  const TRANS_FS = HEAD + `
  out vec4 o;
  uniform sampler2D uA,uB; uniform int uKind; uniform float uP; uniform vec2 uC,uC2;
  vec3 S(sampler2D s, vec2 p){
    vec2 uv = vec2(p.x/RES.x, 1.0-p.y/RES.y);
    uv = 1.0-abs(1.0-abs(uv));
    return texture(s,uv).rgb;
  }
  // like S, but fading to dark beyond the picture instead of mirroring it
  vec3 E(sampler2D s, vec2 p, float amt){
    vec2 out2 = max(-p, p-RES);
    return S(s,p)*(1.0-amt*smoothstep(-190.0,0.0,max(out2.x,out2.y)));
  }
  void main(){
    vec2 p = vec2(gl_FragCoord.x, RES.y-gl_FragCoord.y);
    float k = uP; float e = k*k*(3.0-2.0*k);
    vec3 col;
    if(uKind == 0){ col = mix(S(uA,p),S(uB,p),e); }
    else if(uKind == 1){          // push in through the light
      vec3 a = S(uA, uC + (p-uC)/(1.0+e*e*1.5));
      vec3 b = S(uB, uC + (p-uC)/(0.78+0.22*e));
      float m = smoothstep(0.22,0.80,k);
      col = mix(a,b,m) + vec3(1.0,0.55,0.20)*exp(-length(p-uC)/230.0)*sin(3.14159*k)*0.20;
    }
    else if(uKind == 2){          // pull back
      vec3 a = E(uA, uC + (p-uC)*(1.0+e*0.55), smoothstep(0.0,0.45,k));
      vec3 b = S(uB, uC + (p-uC)/(1.0+(1.0-e)*(1.0-e)*1.1));
      col = mix(a,b,smoothstep(0.20,0.78,k));
    }
    else if(uKind == 3){          // light spreads out from the flame
      float R = e*2400.0 - 160.0;
      float d = length((p-uC)*vec2(1.0,1.15)) + (fbm(p*0.006)-0.5)*210.0;
      float m = 1.0-smoothstep(R-170.0,R+170.0,d);
      col = mix(S(uA,p),S(uB,p),m);
      col += vec3(1.0,0.60,0.26)*exp(-abs(d-R)/70.0)*sin(3.14159*k)*0.16;
    }
    else if(uKind == 4){          // burn away from the flame
      float field = fbm(p*0.0052)*0.62 + length(p-uC)/2300.0;
      float th = e*1.42 - 0.08;
      float m = smoothstep(field-0.035,field+0.035,th);
      col = mix(S(uA,p),S(uB,p),m);
      float edge = exp(-abs(field-th)*52.0)*sin(3.14159*k);
      col += vec3(1.0,0.46,0.10)*edge*0.62;
    }
    else if(uKind == 5){          // continuous travel to the right
      float seam = mix(2380.0,-460.0,e);
      float m = smoothstep(seam-270.0,seam+270.0, p.x + (fbm(p*0.0035)-0.5)*260.0);
      vec3 a = S(uA, p + vec2(e*430.0,0.0));
      vec3 b = S(uB, p - vec2((1.0-e)*430.0,0.0));
      col = mix(a,b,m);
    }
    else if(uKind == 6){          // dawn rises from the horizon
      float lift = mix(1500.0,-420.0,e);
      float m = smoothstep(lift-340.0,lift+340.0, p.y + (fbm(p*vec2(0.002,0.006))-0.5)*230.0);
      col = mix(S(uA,p),S(uB,p),m);
      col += vec3(1.0,0.68,0.36)*exp(-abs(p.y-lift)/170.0)*sin(3.14159*k)*0.14;
    }
    else {                        // carried through the dark: one ember is never put out
      vec2 c = mix(uC, uC2, smoothstep(0.28,0.72,k));
      float d = length((p-c)*vec2(1.0,1.12)) + (fbm(p*0.0062)-0.5)*110.0;
      float u = k < 0.5 ? smoothstep(0.0,0.5,k) : 1.0-smoothstep(0.5,1.0,k);   // 0 open, 1 closed
      float R = mix(2600.0, 30.0, pow(u,0.42));
      float m = 1.0-smoothstep(R*0.30, R+90.0, d);
      col = (k < 0.5 ? S(uA,p) : S(uB,p)) * m * (1.0-0.82*u*u*u);
      float w = smoothstep(0.10,0.46,k)*(1.0-smoothstep(0.54,0.90,k));
      float rd = length(p-c);
      float flick = 0.92+0.08*sin(k*37.0);
      col += vec3(1.0,0.60,0.24)*w*flick*(exp(-rd*rd/170.0)*1.0 + exp(-rd/68.0)*0.30);
      col += vec3(1.0,0.92,0.72)*w*exp(-rd*rd/38.0)*0.85;
    }
    o = vec4(col,1.0);
  }`;

  const DOWN_FS = HEAD + `
  out vec4 o; uniform sampler2D uS; uniform vec2 uTexel; uniform float uThresh; uniform vec2 uSize;
  vec3 pre(vec3 c){ if(uThresh<=0.0) return c; float l=max(c.r,max(c.g,c.b)); return c*smoothstep(uThresh,uThresh+0.45,l); }
  void main(){
    vec2 uv = gl_FragCoord.xy/uSize;
    vec3 c = pre(texture(uS,uv+uTexel*vec2(-1,-1)).rgb)+pre(texture(uS,uv+uTexel*vec2(1,-1)).rgb)
           + pre(texture(uS,uv+uTexel*vec2(-1,1)).rgb)+pre(texture(uS,uv+uTexel*vec2(1,1)).rgb);
    o = vec4(c*0.25,1.0);
  }`;
  const UP_FS = HEAD + `
  out vec4 o; uniform sampler2D uS; uniform vec2 uTexel; uniform vec2 uSize; uniform float uK;
  void main(){
    vec2 uv = gl_FragCoord.xy/uSize; vec3 c = vec3(0.0);
    for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++){
      float w = (x==0?2.0:1.0)*(y==0?2.0:1.0);
      c += texture(uS,uv+uTexel*vec2(x,y)).rgb*w;
    }
    o = vec4(c/16.0*uK,1.0);
  }`;
  const FINAL_FS = HEAD + `
  out vec4 o; uniform sampler2D uS,uBloom,uHud; uniform float uBloomK,uVig,uFade,uFrame,uExposure;
  // integer hash: exact on every compile of the shader, unlike a float hash
  float ih(uvec2 q, uint f){
    uint h = q.x*1597334673u ^ q.y*3812015801u ^ f*2798796415u;
    h ^= h >> 15u; h *= 2246822519u; h ^= h >> 13u; h *= 3266489917u; h ^= h >> 16u;
    return float(h >> 8u)/16777216.0;
  }
  void main(){
    vec2 uv = gl_FragCoord.xy/RES;
    vec2 p = vec2(gl_FragCoord.x, RES.y-gl_FragCoord.y);
    vec3 c = texture(uS,uv).rgb + texture(uBloom,uv).rgb*uBloomK;
    c *= uExposure;
    vec3 over = max(c-0.80,0.0);
    c = min(c,0.80) + 0.20*(1.0-exp(-over/0.26));
    vec2 q = (p-RES*0.5)/vec2(1100.0,760.0);
    c *= 1.0 - uVig*smoothstep(0.35,1.35,dot(q,q));
    c *= uFade;
    uvec2 cell = uvec2(gl_FragCoord.xy); uint fr = uint(uFrame + 0.5);
    float g = ih(cell, fr) + ih(cell.yx + uvec2(977u,131u), fr + 7919u) - 1.0;
    c = floor(c*4096.0 + 0.5)/4096.0;
    c += floor(g*(1.25/255.0)*4096.0 + 0.5)/4096.0;
    vec4 h = texture(uHud,p/RES);
    c = floor((c*(1.0-h.a) + h.rgb)*4096.0 + 0.5)/4096.0;
    o = vec4(clamp(c,0.0,1.0),1.0);
  }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('shader: ' + log + '\n' + src.split('\n').map((l, i) => (i + 1) + ' ' + l).join('\n').slice(0, 4000));
    }
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const loc = new Map();
    p.u = (n) => { if (!loc.has(n)) loc.set(n, gl.getUniformLocation(p, n)); return loc.get(n); };
    return p;
  }

  function texture(w, h, { float = false, repeat = false } = {}) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(w, h) {
    const tex = texture(w, h, { float: true });
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  const use = (t) => { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); gl.viewport(0, 0, t ? t.w : W, t ? t.h : H); };
  const bind = (prog, name, unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u(name), unit); };
  const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  const P = {
    scene: program(SCENE_FS), flame: program(FLAME_FS), trans: program(TRANS_FS),
    down: program(DOWN_FS), up: program(UP_FS), final: program(FINAL_FS),
  };
  const layerTex = {};
  for (const n of Object.keys(layers)) layerTex[n] = texture(W, H);
  const blank = texture(2, 2);
  const landTex = texture(2048, 1024, { repeat: true });
  const fbA = target(W, H), fbB = target(W, H), fbMain = target(W, H), fbHands = target(W, H);
  const bloom = [];
  for (let i = 0; i < 6; i++) bloom.push(target(W >> (i + 1), H >> (i + 1)));

  function upload(tex, source, premultiply = true) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  // Upload a drawing layer by its bytes. Handing texImage2D the canvas itself lets
  // the browser pick between two copy paths that round soft edges differently.
  function uploadLayer(tex, ctx) { upload(tex, ctx.getImageData(0, 0, W, H)); }
  // raw RGBA bytes (used for the land map, whose channels are all data)
  function setLand(bytes, w, h) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, landTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  }

  function clearLayers() {
    for (const n of ['back', 'far', 'near', 'glow']) {
      const c = layers[n];
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.shadowBlur = 0; c.shadowColor = 'transparent'; c.setLineDash([]); c.filter = 'none';
      c.clearRect(0, 0, W, H);
    }
  }

  const f3 = (p, n, v) => gl.uniform3f(p.u(n), v[0], v[1], v[2]);
  const f1 = (p, n, v) => gl.uniform1f(p.u(n), v);

  // composite one scene (its layers are already drawn) into fbA or fbB
  function composeScene(env, slot, t) {
    const fb = slot === 0 ? fbA : fbB;
    for (const n of ['back', 'far', 'near', 'glow']) uploadLayer(layerTex[n], layers[n]);
    if (env.bg === 'hands') HANDS.render(env.hands, fbHands, t, layerTex.back);
    gl.disable(gl.BLEND);
    use(fb);
    const p = P.scene; gl.useProgram(p);
    bind(p, 'uBack', 0, layerTex.back); bind(p, 'uFar', 1, layerTex.far);
    bind(p, 'uNear', 2, layerTex.near); bind(p, 'uGlow', 3, layerTex.glow);
    bind(p, 'uBgTex', 4, env.bg === 'hands' ? fbHands.tex : blank);
    bind(p, 'uLand', 5, landTex);
    gl.uniform1i(p.u('uMode'), { sky: 0, globe: 1, rock: 2, hands: 3 }[env.bg]);
    f1(p, 'uT', t);
    const s = env.sky;
    f3(p, 'uTop', v3(s.top)); f3(p, 'uMid', v3(s.mid)); f3(p, 'uLow', v3(s.low)); f3(p, 'uGround', v3(s.ground || s.low));
    f1(p, 'uMidAt', s.midAt ?? 0.58); f1(p, 'uHorizon', s.horizon ?? 760);
    f1(p, 'uMilky', s.milky ?? 0); f1(p, 'uAurora', s.aurora ?? 0); f1(p, 'uCloud', s.cloud ?? 0);
    f3(p, 'uCloudCol', v3(s.cloudColor || '#8890a8'));
    const sun = s.sun, moon = s.moon;
    gl.uniform4f(p.u('uSun'), sun ? sun.x : 0, sun ? sun.y : 0, sun ? sun.r : 0, sun ? sun.glow ?? 120 : 1);
    f3(p, 'uSunCol', sun ? v3(sun.color, sun.k ?? 1) : [0, 0, 0]);
    gl.uniform4f(p.u('uMoon'), moon ? moon.x : 0, moon ? moon.y : 0, moon ? moon.r : 1, moon ? moon.a ?? 1 : 0);
    f3(p, 'uMoonCol', v3(moon?.color || '#e8e4d8'));
    const lp = new Float32Array(16), lc = new Float32Array(12);
    env.lights.slice(0, 4).forEach((l, i) => {
      lp.set([l.x, l.y, l.r, l.i], i * 4);
      lc.set(v3(l.color || '#ff9a40'), i * 3);
    });
    gl.uniform4fv(p.u('uLPos[0]'), lp); gl.uniform3fv(p.u('uLCol[0]'), lc);
    f1(p, 'uRim', env.rim); f3(p, 'uSkyRim', v3(env.skyRim || '#6c80b8')); f1(p, 'uSkyRimAmt', env.skyRimAmt);
    f3(p, 'uHazeCol', v3(env.haze.color)); f1(p, 'uHaze', env.haze.amt);
    f1(p, 'uGlowGain', env.glowGain);
    f1(p, 'uProj', env.proj.amt); f1(p, 'uSweep', env.proj.sweep); f1(p, 'uGhost', env.proj.ghost);
    const so = env.proj.solid || { x: 0, y: 0, r: 0, k: 0 };
    gl.uniform4f(p.u('uSolid'), so.x, so.y, so.r, so.k ?? 1);
    const g = env.globe;
    gl.uniform4f(p.u('uGlobe'), g ? g.cx : 0, g ? g.cy : 0, g ? g.r : 1, 1);
    gl.uniformMatrix3fv(p.u('uRot'), false, g ? g.mat : [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    f1(p, 'uCity', g ? g.city : 0);
    const rk = env.rock;
    gl.uniform4f(p.u('uTorch'), rk ? rk.torch.x : 0, rk ? rk.torch.y : 0, rk ? rk.torch.z : 1, rk ? rk.torch.i : 0);
    f3(p, 'uTorchCol', rk ? v3(rk.torch.color || '#ffb066') : [0, 0, 0]);
    gl.uniform4f(p.u('uRock'), rk ? rk.ox : 0, rk ? rk.oy : 0, rk ? rk.scale : 1, 0);
    const pn = rk?.panel || [0, 0, 1, 1];
    gl.uniform4f(p.u('uPanel'), ...pn);
    draw();
    // fire, added in HDR
    if (env.flames.length) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      const fp = P.flame; gl.useProgram(fp);
      gl.enable(gl.SCISSOR_TEST);
      for (const f of env.flames) {
        if (f.i <= 0.002 || f.h <= 0.5) continue;
        const halo = f.halo ?? 1;
        const rx = f.w * 1.8 + (halo > 0 ? f.h * 1.7 : 0), top = f.h * (halo > 0 ? 2.2 : 1.35), bot = f.h * (halo > 0 ? 1.3 : 0.3);
        const x0 = Math.floor(f.x - rx), y0 = Math.floor(H - (f.y + bot));
        gl.scissor(x0, y0, Math.ceil(rx * 2), Math.ceil(top + bot));
        gl.uniform4f(fp.u('uF'), f.x, f.y, f.w, f.h);
        gl.uniform4f(fp.u('uF2'), f.seed ?? 1, f.i, f.lean ?? 0, halo);
        f1(fp, 'uT', t);
        draw();
      }
      gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
    }
    return fb;
  }

  function transition(kind, p, center, center2) {
    use(fbMain);
    const pr = P.trans; gl.useProgram(pr);
    bind(pr, 'uA', 0, fbA.tex); bind(pr, 'uB', 1, fbB.tex);
    gl.uniform1i(pr.u('uKind'), { mix: 0, push: 1, pull: 2, light: 3, burn: 4, pan: 5, dawn: 6, dip: 7 }[kind]);
    f1(pr, 'uP', p); gl.uniform2f(pr.u('uC'), center[0], center[1]);
    const c2 = center2 || center; gl.uniform2f(pr.u('uC2'), c2[0], c2[1]);
    draw();
    return fbMain;
  }

  function present(srcFb, { bloomK = 0.55, thresh = 0.62, vig = 0.30, fade = 1, frame = 0, exposure = 1 } = {}) {
    gl.disable(gl.BLEND);
    // bloom chain
    let src = srcFb;
    for (let i = 0; i < bloom.length; i++) {
      use(bloom[i]);
      const d = P.down; gl.useProgram(d);
      bind(d, 'uS', 0, src.tex);
      gl.uniform2f(d.u('uTexel'), 0.75 / src.w, 0.75 / src.h);
      gl.uniform2f(d.u('uSize'), bloom[i].w, bloom[i].h);
      f1(d, 'uThresh', i === 0 ? thresh : 0);
      draw();
      src = bloom[i];
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = bloom.length - 1; i > 0; i--) {
      use(bloom[i - 1]);
      const u = P.up; gl.useProgram(u);
      bind(u, 'uS', 0, bloom[i].tex);
      gl.uniform2f(u.u('uTexel'), 1 / bloom[i].w, 1 / bloom[i].h);
      gl.uniform2f(u.u('uSize'), bloom[i - 1].w, bloom[i - 1].h);
      f1(u, 'uK', 0.82);
      draw();
    }
    gl.disable(gl.BLEND);
    uploadLayer(layerTex.hud, layers.hud);
    use(null);
    const f = P.final; gl.useProgram(f);
    bind(f, 'uS', 0, srcFb.tex); bind(f, 'uBloom', 1, bloom[0].tex); bind(f, 'uHud', 2, layerTex.hud);
    f1(f, 'uBloomK', bloomK); f1(f, 'uVig', vig); f1(f, 'uFade', fade); f1(f, 'uFrame', frame);
    f1(f, 'uExposure', exposure);
    draw();
  }

  return { gl, out, layers, program, texture, target, use, bind, draw, upload, setLand, clearLayers, composeScene, transition, present, HEAD };
})();

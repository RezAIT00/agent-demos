struct Uniforms {
  vp : mat4x4f, ivp : mat4x4f, svp : mat4x4f, rvp : mat4x4f,
  cam : vec4f,    // xyz, t
  sun : vec4f,    // direction to sun, sky light on (0..1)
  sunC : vec4f,   // sun radiance (after atmosphere), w: exposure
  birth : vec4f,  // ring centre x,z, radius R, ring strength
  sky : vec4f,    // reveal angle, warp scale, haze density, flash
  wave : vec4f,   // base stage, cam z, peel far drop, rise time
  fr : vec4f,     // freeze front z, freeze on, nave z end, shatter time (s since, <0 = not yet)
  res : vec4f,    // w,h,sub idx,nsub
  jit : vec4f,    // rnd0..3
  nave : vec4f,   // W, HW, GR, GB
  flow : vec4f,   // face flow metres, displacement gain, foam gain, inside (0..1)
  camF : vec4f, camR : vec4f, camU : vec4f, // w of camF: hfov, camR.w: aspect, camU.w: pass id (0 main,1 reflect,2 shadow)
  misc : vec4f,   // frozen ocean flag, spray time, vol density, dust
  seg : vec4f,    // t - T_FLY, t - T_CITY, t - T_GRAV, t - T_TIME
  seg2 : vec4f,   // collapse, night, city.floors, space
  gal : vec4f,    // galaxy centre, radius
  gal2 : vec4f,   // galaxy time (from time.scale), lantern->star morph, star ignition, t - T_SEA
  city : vec4f,   // boulevard x, city z0, -gravity, t - smash
  ext : vec4f,    // x: the planar-reflection pass was rendered for this sub-frame (tRefl is valid), 0 otherwise
};
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var sRep : sampler;
@group(0) @binding(2) var sClamp : sampler;
@group(0) @binding(3) var tDisp : texture_2d_array<f32>;
@group(0) @binding(4) var tDeriv : texture_2d_array<f32>;
@group(0) @binding(5) var tLut : texture_2d<f32>;
@group(0) @binding(6) var tDome : texture_2d<f32>;
@group(0) @binding(7) var tFoam : texture_2d<f32>;
@group(0) @binding(8) var tShD : texture_depth_2d;
@group(0) @binding(9) var tShC : texture_2d<f32>;
@group(0) @binding(10) var tRefl : texture_2d<f32>;
@group(0) @binding(11) var<storage, read> grid : array<f32>;
@group(0) @binding(12) var sCmp : sampler_comparison;
@group(0) @binding(13) var<storage, read> tubes : array<vec4f>;
@group(0) @binding(14) var tNoise : texture_3d<f32>;
@group(0) @binding(15) var tDepth : texture_depth_2d;
@group(0) @binding(16) var<storage, read> birdsB : array<vec4f>;

const PI = 3.14159265;
const LC = vec4f(997.0, 211.0, 47.0, 11.0);
fn sat(x:f32)->f32 { return clamp(x,0.0,1.0); }
fn hash1(p:f32)->f32 { return fract(sin(p*127.1)*43758.5453); }
fn hash21(p:vec2f)->f32 { var q=fract(vec3f(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
fn hash22(p:vec2f)->vec2f { var q=fract(vec3f(p.xyx)*vec3f(0.1031,0.1030,0.0973)); q+=dot(q,q.yzx+33.33); return fract((q.xx+q.yz)*q.zy); }
fn hash33(p:vec3f)->vec3f { var q=fract(p*vec3f(0.1031,0.1030,0.0973)); q+=dot(q,q.yxz+33.33); return fract((q.xxy+q.yxx)*q.zyx); }
fn vnoise(p:vec2f)->f32 { let i=floor(p); let f=fract(p); let w=f*f*(3.0-2.0*f); return mix(mix(hash21(i),hash21(i+vec2f(1,0)),w.x),mix(hash21(i+vec2f(0,1)),hash21(i+vec2f(1,1)),w.x),w.y); }
fn fbm2(p0:vec2f)->f32 { var p=p0; var a=0.5; var s=0.0; for(var i=0;i<4;i++){ s+=a*vnoise(p); p=mat2x2f(1.6,1.2,-1.2,1.6)*p; a*=0.5; } return s; }
fn ign(p:vec2f, k:f32)->f32 { let q=p+5.588238*k; return fract(52.9829189*fract(0.06711056*q.x+0.00583715*q.y)); }
fn hg(c:f32,g:f32)->f32 { let g2=g*g; return (1.0-g2)/(4.0*PI*pow(max(1.0+g2-2.0*g*c,1e-4),1.5)); }

// --- dome mapping (dir <-> uv). Extra azimuth resolution ahead (+z), extra elevation resolution at the horizon.
fn domeUV(d:vec3f)->vec2f {
  let az=atan2(d.x,d.z)/PI; let el=asin(clamp(d.y,0.0,1.0));
  return vec2f(0.5+0.5*sign(az)*pow(abs(az),0.75), sqrt(el/(0.5*PI)));
}
fn domeDir(uv:vec2f)->vec3f {
  let q=uv.x*2.0-1.0; let az=sign(q)*pow(abs(q),1.0/0.75)*PI; let el=uv.y*uv.y*0.5*PI;
  return vec3f(sin(az)*cos(el), sin(el), cos(az)*cos(el));
}
fn domeRaw(d:vec3f,lod:f32)->vec4f { var v=domeUV(d); v.y=max(v.y,0.5/1024.0); return textureSampleLevel(tDome,sClamp,v,lod); }
// sky with the birth warp: the whole sky is thrown outward from the sun point
fn skyWarp(d:vec3f)->vec4f { // xyz warped dir, w reveal
  let c=clamp(dot(d,u.sun.xyz),-1.0,1.0); let ang=acos(c);
  var dd=d;
  if(u.sky.y<0.999){ let az0=atan2(u.sun.x,u.sun.z); var da=atan2(d.x,d.z)-az0; da-=2.0*PI*floor((da+PI)/(2.0*PI)); let az=az0+da/u.sky.y; let el=min(asin(clamp(d.y,-1.0,1.0))/mix(u.sky.y,1.0,0.35),1.5); dd=vec3f(sin(az)*cos(el),sin(el),cos(az)*cos(el)); }
  let rev=1.0-smoothstep(u.sky.x*0.72,u.sky.x,ang);
  return vec4f(dd,rev);
}
fn dome(d:vec3f,lod:f32)->vec4f {
  let w=skyWarp(d); let q=domeRaw(normalize(vec3f(w.x,max(w.y,0.001),w.z)),max(lod,4.0*smoothstep(0.004,-0.004,w.y)));
  let c=dot(d,u.sun.xyz); let ang=acos(clamp(c,-1.0,1.0));
  let eq=(ang-u.sky.x*0.85)/(0.10+0.06*u.sky.x); let edge=exp(-eq*eq)*step(0.001,u.sky.x)*(1.0-smoothstep(1.2,2.6,u.sky.x));
  return vec4f(q.rgb*w.w*u.sun.w + vec3f(1.0,0.62,0.30)*edge*2.2*u.sun.w, q.a);
}

// --- the sheet
fn lutAt(s:f32,a:f32)->vec3f { // X offset, Y, heading
  let x=clamp((s+120.0)/0.25,0.0,2046.0); let y=clamp(a*64.0,0.0,127.99);
  let i=i32(floor(x)); let j=i32(floor(y)); let fx=x-f32(i); let fy=y-f32(j);
  let a0=textureLoad(tLut,vec2i(i,j),0).xyz; let b0=textureLoad(tLut,vec2i(i+1,j),0).xyz;
  let a1=textureLoad(tLut,vec2i(i,j+1),0).xyz; let b1=textureLoad(tLut,vec2i(i+1,j+1),0).xyz;
  return mix(mix(a0,b0,fx),mix(a1,b1,fx),fy);
}
fn frontNoise(s:f32,z:f32)->f32 { return (vnoise(vec2f(s*0.085,z*0.06))-0.5)*16.0+(vnoise(vec2f(s*0.4,z*0.4))-0.5)*5.0; }
// freeze amount at (s,z): 0 water .. 1 glass
fn freezeAt(s:f32,z:f32)->f32 { return u.fr.y*sat((u.fr.x+frontNoise(s,z)-z)/60.0)*(1.0-step(u.fr.z+3.0,z)*smoothstep(-0.6,-0.4,u.fr.w)); }
fn barrelStage(z:f32)->f32 { let n=(vnoise(vec2f(z/52.0,1.5))-0.5)*0.11+(vnoise(vec2f(z/17.0,7.5))-0.5)*0.035; return clamp(u.wave.x*(1.0-u.wave.z*smoothstep(70.0,460.0,z-u.wave.y))+n*u.wave.x*(1.0-0.5*u.wave.x),0.0,1.0); }
fn stageAt(s:f32,z:f32)->f32 {
  let b=barrelStage(z); let f=u.fr.y*sat((u.fr.x-z)/85.0);
  let g=1.0-pow(1.0-f,3.0); let o=g+0.10*sin(g*PI)*sin(f*9.0);
  let e=1.0-smoothstep(u.fr.z+3.0,u.fr.z+4.0,z)*step(0.5,u.fr.y)*smoothstep(-0.6,-0.4,u.fr.w);
  return mix(b,2.0,clamp(o,0.0,1.0))*e;
}
struct Surf { p:vec3f, n:vec3f, ts:vec3f, tz:vec3f, y0:f32, st:f32, fz:f32, rim:f32 };
fn flowS(s:f32)->f32 { return u.flow.x*smoothstep(-420.0,-60.0,s)*(1.0-smoothstep(150.0,170.0,s)); }
fn waveMask(s:f32)->f32 { return smoothstep(-60.0,10.0,s)*(1.0-smoothstep(250.0,310.0,s)); }
fn baseSurf(s:f32,z:f32)->Surf {
  var o:Surf; let a=stageAt(s,z); let l=lutAt(s,a); let l1=lutAt(s,stageAt(s,z+2.0));
  o.st=a; o.fz=freezeAt(s,z);
  o.p=vec3f(s+l.x,l.y,z);
  o.ts=vec3f(cos(l.z),sin(l.z),0.0); o.tz=normalize(vec3f((l1.x-l.x)*0.5,(l1.y-l.y)*0.5,1.0));
  o.n=normalize(cross(o.tz,o.ts)); o.y0=l.y; return o;
}
fn seaDisp(q:vec2f,lod:f32,big:f32)->vec4f {
  var d=vec4f(0.0);
  for(var i=0;i<4;i++){ let L=LC[i]; let lo=max(0.0,lod+log2(256.0/L)); let w=select(1.0,big,i==0);
    let t=textureSampleLevel(tDisp,sRep,q/L,i,lo); d+=vec4f(t.xyz*w,0.0); d.w+=(1.0-t.w)*w; }
  return d;
}
fn ringAt(x:f32,z:f32)->vec3f { // height, sea gain, crest mask
  let d=vec2f(x,z)-u.birth.xy; let r=length(d); let R=u.birth.z; let k=r-R;
  let an=atan2(d.x,d.y); let nzl=vnoise(vec2f(an*10.0,u.cam.w*1.1))-0.5; let nzh=vnoise(vec2f(an*70.0,u.cam.w*5.0))-0.5; let early=exp(-max(R,0.0)/420.0); let fing=pow(vnoise(vec2f(an*31.0,u.cam.w*0.6)),3.0)*smoothstep(-34.0,-4.0,k)*early*0.0; let nz=nzl+0.22*nzh+fing*2.2;
  let kk=k+nzl*26.0+nzh*6.0; let front=1.0/(1.0+exp(kk/7.0)); let hq=kk/select(64.0,24.0,kk>0.0); let h=exp(-hq*hq);
  let gain=front*(1.0+0.6*exp(kk/260.0))*(1.0-0.55*h*u.birth.w);
  let lump=mix(1.0,0.75+0.5*vnoise(vec2f(an*6.0,2.0+u.cam.w*0.7)),exp(-max(R,0.0)/900.0)); return vec3f(u.birth.w*h*(96.0+nz*22.0)*front*1.35*lump*(0.12+0.88*smoothstep(0.0,160.0,R)), gain, h*front*u.birth.w);
}
fn surf(s:f32,z:f32,lod:f32)->Surf {
  var o=baseSurf(s,z);
  let m=waveMask(s)*sat(u.wave.x*1.4); let big=mix(1.0,0.10,m);
  let q=vec2f(s-flowS(s),z); var d=seaDisp(q,lod,big);
  let ring=ringAt(o.p.x,z);
  let keep=(1.0-o.fz)*u.flow.y*ring.y*mix(1.0,0.55,m)*(1.0-smoothstep(118.0,148.0,s)*(1.0-smoothstep(300.0,330.0,s))*sat(u.wave.x*2.0)*0.92);
  let outN=d.y*keep;
  o.p+=o.ts*d.x*keep+vec3f(0,0,1)*d.z*keep+o.n*outN;
  let mq=(s+25.0)/7.5; o.p.y+=ring.x+(1.0-o.fz)*exp(-mq*mq)*smoothstep(0.72,1.0,o.st)*(1.0-step(1.5,o.st))*(6.0+3.5*(vnoise(vec2f(z*0.2,u.cam.w*2.0))-0.3)); o.rim=ring.z; let cw=cityWater(o.p.x,z); o.p.y+=cw.x; if(u.birth.w>0.001&&u.birth.z<20000.0){ let e=2.0; let gx=(ringAt(o.p.x+e,z).x-ring.x)/e; let gz=(ringAt(o.p.x,z+e).x-ring.x)/e; let g=vec3f(gx,0.0,gz); o.n=normalize(o.n*1.0-g); o.ts=normalize(o.ts+vec3f(0.0,gx,0.0)); o.tz=normalize(o.tz+vec3f(0.0,gz,0.0)); }
  let dc=o.p.xz-u.cam.xz; o.p.y-=dot(dc,dc)/12742000.0;
  return o;
}

// --- analytic nave: what a ray inside the cathedral hits (for reflections in crystal and stone)
fn palette(i:i32)->vec3f {
  switch(i%7){ case 0:{return vec3f(0.006,0.035,0.62);} case 1:{return vec3f(0.80,0.008,0.016);} case 2:{return vec3f(1.0,0.40,0.015);} case 3:{return vec3f(0.005,0.34,0.20);} case 4:{return vec3f(0.22,0.012,0.55);} case 5:{return vec3f(0.012,0.22,0.80);} default:{return vec3f(0.95,0.09,0.12);} }
}
const BAY = 14.0;
// stained glass: rgb transmittance, a = lead / stone coverage
fn vor(p:vec2f)->vec4f { let ip=floor(p); var d1=9.0; var d2=9.0; var id=vec2f(0); for(var j=-1;j<=1;j++){for(var i=-1;i<=1;i++){ let c=ip+vec2f(f32(i),f32(j)); let o=c+0.15+0.7*hash22(c); let d=distance(o,p); if(d<d1){d2=d1;d1=d;id=c;}else if(d<d2){d2=d;} }} return vec4f(d1,d2,id); }
fn stained(z:f32,s:f32)->vec4f {
  let W=u.nave.x; let HW=u.nave.y; let bayI=floor(z/BAY+0.5); let x=z-bayI*BAY; // x in -7..7, columns at +-7
  var y=-1.0; var side=0.0;
  if(s>W && s<W+HW){y=s-W;side=1.0;} else if(s>W+HW+70.0 && s<W+2.0*HW+70.0){y=W+2.0*HW+70.0-s;side=-1.0;}
  if(y>=0.0){
    let hw=5.5; let spr=19.5; let R=8.4; // pointed arch window
    let ax=abs(x); var dw=hw-ax; if(y>spr){ dw=R-length(vec2f(ax+(R-hw),y-spr)); } dw=min(dw,y-2.2);
    if(dw<0.0){ return vec4f(vec3f(0.16,0.30,0.34)*0.5,0.86); }
    // tracery: 3 lights + roses
    let lw=hw*2.0/3.0; let li=floor(x/lw+0.5); let lx=x-li*lw; let top=18.0;
    var cell=0.0; var c=vec2f(lx,y); var edge=0.0; var key=0;
    let rose=length(vec2f(x,y-22.6)); let r2=length(vec2f(ax-2.75,y-18.6));
    if(rose<2.35){ key=7; c=vec2f(x,y-22.6); } else if(r2<1.55){ key=8; c=vec2f(ax-2.75,y-18.6); } else { key=i32(li)+1; }
    let v=vor(vec2f(x,y)*1.15+vec2f(bayI*17.0,side*9.0));
    let h=hash22(v.zw+bayI*3.1);
    var base:i32; let bi=i32(bayI)+100;
    if(key==7){ let a=atan2(c.y,c.x); let pet=floor((a/PI*0.5+0.5)*8.0); base=select(2,1,fract(pet*0.5)>0.25); if(length(c)<0.75){base=5;} }
    else if(key==8){ base=3; }
    else { // each bay keeps one ground colour; medallions carry the accent
      let seq=array<i32,6>(0,0,4,1,2,5); let gb=seq[(bi/2+select(0,3,side<0.0))%6]; base=gb; let ab=seq[(bi/2+2+select(0,3,side<0.0))%6];
      let med=fract((y+f32(key%2)*2.3)/4.6)*4.6-2.3; let qq=abs(vec2f(lx*1.05,med)); let quat=min(min(length(qq-vec2f(0.72,0.0)),length(qq-vec2f(0.0,0.72)))-0.62,(qq.x+qq.y)*0.707-0.72); let rr=length(qq); let sect=fract(floor((atan2(med,lx)/PI*0.5+0.5)*8.0)*0.5)>0.25;
      if(quat<0.0){ base=select(ab,(ab+1)%7,sect&&rr>0.5); if(rr<0.42){base=2;} } else if(quat<0.17){ base=2; } else { let lat=abs(fract((lx+med)*0.62)-0.5)+abs(fract((lx-med)*0.62)-0.5); if(lat>0.83){ base=ab; } } }
    var col=palette(base); let alt=palette((base+5)%7);
    col=mix(col,alt,step(0.90,h.y)); col=mix(col,vec3f(0.9,0.75,0.45),step(0.992,h.x)*0.5);
    col*=0.35+0.95*h.x*h.x+0.15*h.y;
    var lead=1.0-smoothstep(0.035,0.075,(v.y-v.x)*0.55);
    lead=max(lead,1.0-smoothstep(0.02,0.06,abs(abs(lx)-lw*0.5)*step(y,16.5)+10.0*step(16.5,y)));
    lead=max(lead,1.0-smoothstep(0.0,0.14,dw));
    return vec4f(col,lead);
  }
  // vault + floor edge: pale panels between ribs
  let vs=(s-(W+HW)); let v2=vor(vec2f(z*0.42,vs*0.42)); let hh=hash22(v2.zw);
  // midnight vault with gold stars
  let sc=vec2f(z,vs)*0.55; let sv=vor(sc+40.0); let star=1.0-smoothstep(0.05,0.085,sv.x*(0.75+0.35*abs(sin(atan2(sc.y-sv.w-0.5,sc.x-sv.z-0.5)*2.5)))); let nv=mix(vec3f(0.006,0.035,0.17),vec3f(0.02,0.012,0.16),hh.x)*(0.5+0.8*hh.y);
  return vec4f(mix(nv,vec3f(1.0,0.55,0.12)*1.2,star*step(0.35,hash21(sv.zw))),(1.0-smoothstep(0.015,0.04,(v2.y-v2.x)*0.5))*0.8);
}
fn skyThrough(d:vec3f,lod:f32)->vec3f { var q=d; q.y=abs(q.y)+0.03; let k=domeRaw(normalize(q),lod).rgb*u.sun.w; let c=sat(dot(d,u.sun.xyz)); return k+u.sunC.rgb*(hg(c,0.90)*0.10+hg(c,0.985)*0.030); }
fn naveHit(p:vec3f,d:vec3f)->vec3f { // x: t, y: z, z: s
  let W=u.nave.x; let HW=u.nave.y; let GR=u.nave.z;
  var t=1e9; var zz=0.0; var ss=0.0;
  if(d.y<-1e-4){ let tf=-p.y/d.y; t=tf; zz=p.z+d.z*tf; ss=-1.0; }
  if(abs(d.x)>1e-4){ let tw=(sign(d.x)*W-p.x)/d.x; let y=p.y+d.y*tw; if(tw>0.0&&tw<t&&y>=0.0&&y<=HW){ t=tw; zz=p.z+d.z*tw; ss=select(W+2.0*HW+70.0-y,W+y,d.x>0.0); } }
  for(var k=0;k<2;k++){ let sg=select(-1.0,1.0,k==0); let c=vec2f(-sg*(GR-W),HW); let o=p.xy-c; let a=dot(d.xy,d.xy); let b=dot(o,d.xy); let q=dot(o,o)-GR*GR; let disc=b*b-a*q;
    if(disc>0.0&&a>1e-6){ let tt=(-b+sqrt(disc))/a; let h=p.xy+d.xy*tt; if(tt>0.0&&tt<t&&h.y>=HW&&h.x*sg>=-0.01){ t=tt; zz=p.z+d.z*tt; let an=asin(clamp((h.y-HW)/GR,0.0,1.0)); ss=select(W+HW+70.0-an*GR,W+HW+an*GR,sg>0.0); } } }
  return vec3f(t,zz,ss);
}
fn shadowAt(p:vec3f,j:vec2f)->vec3f {
  let q=u.svp*vec4f(p,1.0); let uv=q.xy*vec2f(0.5,-0.5)+0.5+j;
  if(any(uv<vec2f(0.002))||any(uv>vec2f(0.998))){return vec3f(1.0);}
  let v=textureSampleCompareLevel(tShD,sCmp,uv,q.z-0.0012);
  return textureSampleLevel(tShC,sClamp,uv,0.0).rgb*v;
}
fn naveEnv(p:vec3f,d:vec3f)->vec3f {
  let h=naveHit(p,d); if(h.x>400.0){ return skyThrough(d,3.0)*0.5; }
  if(h.z<0.0){ let hp=p+d*h.x; return shadowAt(hp+vec3f(0,0.05,0),vec2f(0.0))*u.sunC.rgb*max(u.sun.y,0.05)*0.16+vec3f(0.02,0.03,0.05)*u.sun.w; }
  let g=stained(h.y,h.z); return g.rgb*(1.0-g.a*0.9)*skyThrough(d,3.0)*1.25;
}
fn fogColor(d:vec3f)->vec3f { let h=normalize(vec3f(d.x,0.012,d.z)); return dome(h,3.5).rgb; }

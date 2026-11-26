struct FO { @builtin(position) pos:vec4f, @location(0) uv:vec2f };
@vertex fn vsFull(@builtin(vertex_index) i:u32)->FO { var o:FO; let p=vec2f(f32((i<<1u)&2u),f32(i&2u)); o.pos=vec4f(p*2.0-1.0,0.0,1.0); o.uv=vec2f(p.x,1.0-p.y); return o; }
fn viewDir(uv:vec2f)->vec3f { let th=tan(u.camF.w*0.5); let n=(uv*2.0-1.0)*vec2f(1.0,-1.0); return normalize(u.camF.xyz+u.camR.xyz*n.x*th+u.camU.xyz*n.y*th/u.camR.w); }
@fragment fn fsSky(i:FO)->@location(0) vec4f {
  var d=viewDir(i.uv+(u.jit.zw-0.5)/u.res.xy); if(u.camU.w>0.5&&u.camU.w<1.5){ d=normalize(vec3f(d.x,abs(d.y)+0.001,d.z)); }
  let q=dome(d,0.0); var c=q.rgb; let mu=clamp(dot(d,u.sun.xyz),-1.0,1.0); let ang=acos(mu);
  let disc=1.0-smoothstep(0.0075,0.0095,ang); let tr=mix(q.a,1.0,0.25);
  c+=u.sunC.rgb*(disc*60.0*tr+exp(-ang*22.0)*0.55*tr+exp(-ang*5.0)*0.05)*u.sun.w;
  c+=vec3f(1.0,0.86,0.66)*u.sky.w*(exp(-ang*46.0)*60.0+exp(-ang*9.0)*3.0);
  c=c*(1.0-u.seg2.w)+starField(d,max(u.seg2.y,u.seg2.w)*(1.0-u.seg2.x));
  return vec4f(c,1.0);
}
@fragment fn fsVol(i:FO)->@location(0) vec4f {
  let px=vec2i(i.pos.xy); let z=textureLoad(tDepth,px,0); let d=viewDir(i.uv); var tmax=260.0;
  if(z>1e-7){ let ndc=vec4f((i.uv*2.0-1.0)*vec2f(1.0,-1.0),z,1.0); let w=u.ivp*ndc; tmax=min(tmax,distance(w.xyz/w.w,u.cam.xyz)); }
  let n=26; let j=ign(i.pos.xy,u.res.z+floor(u.jit.x*31.0)); var C=vec3f(0.0); var T=1.0; let mu=dot(d,u.sun.xyz); let ph=hg(mu,0.40)*0.62+hg(mu,0.82)*0.10+0.03; let amb=domeRaw(vec3f(0.1,0.95,0.2),6.0).rgb*u.sun.w;
  for(var k=0;k<n;k++){ let a=(f32(k)+j)/f32(n); let t=tmax*a*a; let dt=tmax*2.0*a/f32(n); let p=u.cam.xyz+d*t;
    let ins=step(p.z,u.fr.z); let nz=textureSampleLevel(tNoise,sRep,p/vec3f(46.0,30.0,46.0)+vec3f(0.0,-u.cam.w*0.01,u.cam.w*0.02),0.0);
    let den=u.misc.z*(0.35+1.3*nz.x)*ins; if(den>1e-6){ let s=shadowAt(p,vec2f(0.0)); let S=s*u.sunC.rgb*ph*1.25+amb*vec3f(0.10,0.14,0.17)*0.05; let Tn=T*exp(-den*dt); C+=S*(T-Tn); T=Tn; } }
  return vec4f(C,T);
}
// ---- waterspouts: hollow rotating columns from sea to cloud, marched per pixel
const NSP = 7;
/*SPOUTS*/
fn spAxis(s:vec4f,y:f32)->vec2f { let t=u.cam.w; return s.xy+vec2f(sin(y*0.0052+s.w+t*0.9),cos(y*0.0043+s.w*1.7+t*0.7))*(y*0.034)*s.z/14.0+vec2f(sin(y*0.031+s.w-t*2.2),cos(y*0.027+s.w*2.0-t*2.0))*s.z*0.22; }
fn spRad(s:vec4f,y:f32)->f32 { let k=y/760.0; return s.z*(0.40+0.55*exp(-y/26.0)+1.1*k+6.5*k*k*k*k); }
@fragment fn fsSpout(i:FO)->@location(0) vec4f {
  let px=vec2i(i.pos.xy); let z=textureLoad(tDepth,px,0); let d=viewDir(i.uv+(u.jit.zw-0.5)/u.res.xy); var tmax=6000.0; if(z>1e-7){ let ndc=vec4f((i.uv*2.0-1.0)*vec2f(1.0,-1.0),z,1.0); let w=u.ivp*ndc; tmax=min(tmax,distance(w.xyz/w.w,u.cam.xyz)); }
  var C=vec3f(0.0); var T=1.0; let o=u.cam.xyz; let t=u.cam.w; let j=ign(i.pos.xy,u.res.z+floor(u.jit.x*31.0)); let mu=dot(d,u.sun.xyz); let ph=hg(mu,0.55)*0.30+hg(mu,0.2)*0.08+0.02; let amb=domeRaw(vec3f(0.1,0.95,0.2),6.0).rgb*u.sun.w; let dxz=length(d.xz);
  for(var k=0;k<NSP;k++){ let s=SP[k]; let tau=t-s0(k); if(tau<0.0){continue;} let g=smoothstep(0.0,0.75,tau);
    let Rb=s.z*7.0+60.0; let oc=o.xz-s.xy; let a=dot(d.xz,d.xz); let b=dot(oc,d.xz); let c=dot(oc,oc)-Rb*Rb; let h=b*b-a*c; if(h<0.0){continue;} let q=sqrt(h); var t0=max((-b-q)/a,0.3); var t1=min((-b+q)/a,tmax);
    if(d.y>1e-4){ t1=min(t1,(860.0-o.y)/d.y); } else if(d.y<-1e-4){ t1=min(t1,(-6.0-o.y)/d.y); } if(t1<=t0){continue;}
    let n=44; let dt=(t1-t0)/f32(n);
    for(var m=0;m<n;m++){ let tt=t0+(f32(m)+j)*dt; let p=o+d*tt; let y=max(p.y,0.0); let ax=spAxis(s,y); let v=p.xz-ax; let r=length(v); let rr=r/spRad(s,y); var den=0.0;
      if(rr<1.9){ let an=atan2(v.y,v.x)+y*0.011*14.0/s.z-t*4.2; let nz=textureSampleLevel(tNoise,sRep,vec3f(cos(an)*0.30+s.w,y/(s.z*13.0)-t*0.55+an*0.10,sin(an)*0.30),0.0); let n2=textureSampleLevel(tNoise,sRep,vec3f(cos(an)*0.95,y/(s.z*4.5)-t*0.9+an*0.16,sin(an)*0.95+s.w),0.0); let e=nz.x*0.6+n2.y*0.5; let shq=(rr-0.66-0.75*(e-0.5))/0.24; den=(exp(-shq*shq)+0.12*step(rr,0.75))*(0.05+1.9*smoothstep(0.46,0.72,e))*0.12*(14.0/s.z); den*=1.0-smoothstep(560.0,820.0,y)*0.8; den*=max(smoothstep(0.0,0.06,g*1.06-y/860.0),smoothstep(0.0,0.1,y/860.0-1.0+g*0.6)); }
      if(y<90.0){ let m2=r/(s.z*(2.6+y*0.05)); let nn=textureSampleLevel(tNoise,sRep,vec3f(v.x,y*1.3-t*30.0,v.y)/64.0+vec3f(sin(t),0.0,cos(t))*0.2,0.0); den+=exp(-m2*m2)*exp(-y/24.0)*smoothstep(0.42,0.72,nn.x*0.7+nn.y*0.35)*0.035*g; }
      if(den>1e-4){ let lx=normalize(u.sun.xz); let vl=dot(v,lx); let r0=spRad(s,y)*1.05; let ch=max(-vl+sqrt(max(r0*r0-r*r+vl*vl,0.0)),0.0); let lit=exp(-ch*0.10*14.0/s.z)+0.25*exp(-ch*0.025*14.0/s.z); let sg=mix(vec3f(dot(u.sunC.rgb,vec3f(0.3,0.5,0.2))),u.sunC.rgb,0.62); let S=sg*ph*(lit*1.0+0.6*exp(-ch*0.5))*0.30+amb*vec3f(0.70,0.82,0.95)*0.85*(0.6+0.4*min(y/160.0,1.0)); let Tn=T*exp(-den*dt); C+=S*(T-Tn); T=Tn; } }
  }
  let keep=step(0.5,u.sun.w); return vec4f(C*keep,mix(1.0,T,keep));
}
// ---- text
struct Gl { r:vec4f, c:vec4f, m:vec4f };
@group(1) @binding(0) var<storage,read> gl : array<Gl>;
@group(1) @binding(1) var tGlyph : texture_2d<f32>;
struct GO { @builtin(position) pos:vec4f, @location(0) uv:vec2f, @location(1) c:vec4f, @location(2) @interpolate(flat) m:vec4f, @location(3) q:vec2f };
@vertex fn vsText(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->GO {
  let g=gl[ii]; let c=array<vec2f,6>(vec2f(0,0),vec2f(1,0),vec2f(1,1),vec2f(0,0),vec2f(1,1),vec2f(0,1))[vi]; var o:GO;
  let p=g.r.xy+c*g.r.zw; o.pos=vec4f(p.x*2.0-1.0,1.0-p.y*2.0,0.0,1.0); o.uv=c; o.c=g.c; o.m=g.m; o.q=p; return o;
}
fn glyphD(uv:vec2f,idx:f32,n:f32)->f32 { let w=1.0/n; let x=(idx+clamp(uv.x,0.01,0.99))*w; return textureSampleLevel(tGlyph,sClamp,vec2f(x,uv.y),0.0).r*0.5; }
@fragment fn fsText(i:GO)->@location(0) vec4f {
  var uv=i.uv; let mode=i.m.x; var d=9.0;
  if(mode>1.5){ let dist=(i.q.y-0.5); uv.x+=sin(i.q.y*150.0+u.cam.w*5.0+sin(i.q.x*23.0+u.cam.w*2.0)*1.2)*0.045*(0.4+dist*2.0)+(ign(i.pos.xy,u.res.z*3.0)-0.5)*0.05; uv.y+=sin(i.q.x*41.0+u.cam.w*3.0)*0.012+(ign(i.pos.yx,u.res.z*5.0)-0.5)*0.10; }
  if(fract(mode*0.5)>0.25){ let b=abs(uv-vec2f(0.5))-vec2f(0.30,0.36); d=(length(max(b,vec2f(0.0)))+min(max(b.x,b.y),0.0))*1.5+0.075; }
  else { if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){discard;} d=glyphD(uv,i.m.y,i.m.z); }
  let aa=i.m.w; let core=1.0-smoothstep(0.075-aa,0.075+aa,d); let halo=exp(-max(d-0.06,0.0)*13.0); let sh=(1.0-smoothstep(0.05,0.34,d));
  let col=i.c.rgb*(core+halo*0.10); let a=max(core,sh*0.34)*i.c.a;
  if(mode>1.5){ let k=core*0.28+halo*0.10; return vec4f(i.c.rgb*k*i.c.a,0.0); }
  return vec4f(col*i.c.a,a);
}

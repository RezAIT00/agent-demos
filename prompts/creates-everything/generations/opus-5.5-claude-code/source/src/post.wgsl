struct PU { a:vec4f, b:vec4f, c:vec4f }; // c: time since the wall hit the lens, grade, collapse, - // a: exposure, bloom, t, flash ; b: texel x,y, mode, ca
@group(0) @binding(0) var<uniform> pu : PU;
@group(0) @binding(1) var smp : sampler;
@group(0) @binding(2) var tA : texture_2d<f32>;
@group(0) @binding(3) var tB : texture_2d<f32>;
struct FO { @builtin(position) pos:vec4f, @location(0) uv:vec2f };
@vertex fn vsFull(@builtin(vertex_index) i:u32)->FO { var o:FO; let p=vec2f(f32((i<<1u)&2u),f32(i&2u)); o.pos=vec4f(p*2.0-1.0,0.0,1.0); o.uv=vec2f(p.x,1.0-p.y); return o; }
@fragment fn fsAccum(i:FO)->@location(0) vec4f { let c=textureLoad(tA,vec2i(i.pos.xy),0).rgb; return vec4f(min(c,vec3f(250.0))*pu.a.x,1.0); }
fn S(uv:vec2f)->vec3f { return textureSampleLevel(tA,smp,uv,0.0).rgb; }
@fragment fn fsDown(i:FO)->@location(0) vec4f {
  let t=pu.b.xy; let uv=i.uv; var c=S(uv)*0.125; c+=(S(uv+t*vec2f(-1,-1))+S(uv+t*vec2f(1,-1))+S(uv+t*vec2f(-1,1))+S(uv+t*vec2f(1,1)))*0.125;
  c+=(S(uv+t*vec2f(-2,0))+S(uv+t*vec2f(2,0))+S(uv+t*vec2f(0,-2))+S(uv+t*vec2f(0,2)))*0.0625; c+=(S(uv+t*vec2f(-2,-2))+S(uv+t*vec2f(2,-2))+S(uv+t*vec2f(-2,2))+S(uv+t*vec2f(2,2)))*0.03125;
  if(pu.b.z>0.5){ let l=max(c.r,max(c.g,c.b)); c*=min(1.0,60.0/max(l,1e-4)); }
  return vec4f(c,1.0);
}
@fragment fn fsUp(i:FO)->@location(0) vec4f {
  let t=pu.b.xy; let uv=i.uv; var c=S(uv)*4.0; c+=(S(uv+t*vec2f(-1,0))+S(uv+t*vec2f(1,0))+S(uv+t*vec2f(0,-1))+S(uv+t*vec2f(0,1)))*2.0; c+=S(uv+t*vec2f(-1,-1))+S(uv+t*vec2f(1,-1))+S(uv+t*vec2f(-1,1))+S(uv+t*vec2f(1,1));
  return vec4f(c/16.0*pu.a.y,1.0);
}
fn aces(x:vec3f)->vec3f {
  let m1=mat3x3f(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777); let m2=mat3x3f(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
  let v=m1*x; let a=v*(v+0.0245786)-0.000090537; let b=v*(0.983729*v+0.4329510)+0.238081; return clamp(m2*(a/b),vec3f(0.0),vec3f(1.0));
}
fn sat1(x:f32)->f32 { return clamp(x,0.0,1.0); }
fn h(p:vec2f)->f32 { var q=fract(vec3f(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
@fragment fn fsFinal(i:FO)->@location(0) vec4f {
  var uv=i.uv; let c0=uv-0.5; let r2=dot(c0,c0); let ca=c0*r2*pu.b.w;
  // water on the lens after the wall: each drop is a little inverted lens that slides and drains
  var shade=1.0; var spec=0.0; var soft=0.0; let lt=pu.c.x;
  if(lt>0.0&&lt<2.8){ for(var k=0;k<14;k++){ let fk=f32(k); let hk=vec3f(h(vec2f(fk,1.0)),h(vec2f(fk,2.0)),h(vec2f(fk,3.0))); let h2=vec2f(h(vec2f(fk,4.0)),h(vec2f(fk,5.0)));
      let a=lt-hk.z*0.16; if(a<0.0){continue;} let rad=(0.007+0.020*hk.x*hk.x)*(1.0+0.15*min(a,1.0)); let cp=vec2f(0.04+0.92*h2.x,0.04+0.92*h2.y+0.060*a*a*(0.25+hk.y));
      let life=1.0-smoothstep(0.5+hk.y*0.5,1.1+hk.y*0.5,a); let dv=(uv-cp)*vec2f(1.7778,1.0)*vec2f(1.0,0.55+0.35*hk.z); let d=length(dv)/rad; if(d<1.0&&life>0.01){ let w=life*smoothstep(1.0,0.82,d);
        uv=mix(uv,cp-(uv-cp)*0.85,w); shade*=mix(1.0,0.82+0.18*(1.0-pow(d,6.0)),w); spec+=w*exp(-dot(dv/rad-vec2f(-0.35,-0.40),dv/rad-vec2f(-0.35,-0.40))*30.0)*0.04; soft=max(soft,w*0.4); } } }
  var col=vec3f(textureSampleLevel(tA,smp,uv+ca,0.0).r,textureSampleLevel(tA,smp,uv,0.0).g,textureSampleLevel(tA,smp,uv-ca,0.0).b);
  col=mix(col,textureSampleLevel(tB,smp,uv,0.0).rgb*1.2,soft)*shade+vec3f(spec);
  let bl=textureSampleLevel(tB,smp,uv,0.0).rgb; col=mix(col,bl,pu.b.z);
  col*=pu.a.x; col*=1.0-0.55*r2*smoothstep(0.0,0.6,r2)*1.6;
  let l=dot(col,vec3f(0.2126,0.7152,0.0722)); col=max(mix(vec3f(l),col,1.14),vec3f(0.0));
  col=aces(col*1.25); col=pow(col,vec3f(1.0/2.2));
  let gk=pu.c.y; let lu=dot(col,vec3f(0.299,0.587,0.114)); col=mix(col,col*mix(vec3f(0.90,1.0,1.09),vec3f(1.07,1.0,0.91),smoothstep(0.12,0.72,lu)),0.55*gk); col=mix(col,col*col*(3.0-2.0*col),0.22*gk);
  let g=(h(i.pos.xy+fract(pu.a.z*7.13)*vec2f(531.0,317.0))+h(i.pos.xy+fract(pu.a.z*3.7)*vec2f(131.0,717.0))-1.0); col+=g*(0.009+0.009*(1.0-sat1(l)));
  return vec4f(col,1.0);
}

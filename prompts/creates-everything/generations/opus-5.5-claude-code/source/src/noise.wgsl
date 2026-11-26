// Cloud noise volume (128^3, tiling) and foam lace texture, both generated once on the GPU.
@group(0) @binding(0) var oVol : texture_storage_3d<rgba8unorm, write>;
@group(0) @binding(1) var oFoam : texture_storage_2d<rgba8unorm, write>;
fn h33(p:vec3f)->vec3f { var q=fract(p*vec3f(0.1031,0.1030,0.0973)); q+=dot(q,q.yxz+33.33); return fract((q.xxy+q.yxx)*q.zyx); }
fn wrap(p:vec3f,n:f32)->vec3f { return p-floor(p/n)*n; }
fn worley(p:vec3f,n:f32)->f32 { let ip=floor(p*n); let f=fract(p*n); var d=9.0; for(var z=-1;z<=1;z++){for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){ let o=vec3f(f32(x),f32(y),f32(z)); let c=h33(wrap(ip+o,n)+n*7.0); let r=o+c-f; d=min(d,dot(r,r)); }}} return 1.0-clamp(sqrt(d),0.0,1.0); }
fn grad(p:vec3f,f:vec3f)->f32 { let g=h33(p)*2.0-1.0; return dot(g,f); }
fn perlin(p:vec3f,n:f32)->f32 { let q=p*n; let i=floor(q); let f=fract(q); let w=f*f*f*(f*(f*6.0-15.0)+10.0); var v=array<f32,8>(); for(var k=0;k<8;k++){ let o=vec3f(f32(k&1),f32((k>>1)&1),f32((k>>2)&1)); v[k]=grad(wrap(i+o,n)+n*3.0,f-o); }
  let x0=mix(v[0],v[1],w.x); let x1=mix(v[2],v[3],w.x); let x2=mix(v[4],v[5],w.x); let x3=mix(v[6],v[7],w.x); return mix(mix(x0,x1,w.y),mix(x2,x3,w.y),w.z); }
fn remap(x:f32,a:f32,b:f32,c:f32,d:f32)->f32 { return c+(x-a)/(b-a)*(d-c); }
@compute @workgroup_size(4,4,4)
fn vol(@builtin(global_invocation_id) g:vec3u){
  let p=(vec3f(g)+0.5)/128.0;
  var pf=0.0; var a=0.5; var n=4.0; for(var i=0;i<5;i++){ pf+=a*perlin(p,n); n*=2.0; a*=0.5; }
  pf=clamp(pf*0.9+0.5,0.0,1.0);
  let w0=worley(p,4.0)*0.625+worley(p,8.0)*0.25+worley(p,16.0)*0.125;
  let pw=clamp(remap(pf,0.0,1.0,w0,1.0),0.0,1.0);
  let w1=worley(p,8.0)*0.625+worley(p,16.0)*0.25+worley(p,32.0)*0.125;
  let w2=worley(p,16.0)*0.625+worley(p,32.0)*0.25+worley(p,64.0)*0.125;
  textureStore(oVol,g,vec4f(pw,w1,w2,pf));
}
fn w2d(p:vec2f,n:f32,sd:f32)->vec2f { let ip=floor(p*n); let f=fract(p*n); var d1=9.0; var d2=9.0; for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){ let o=vec2f(f32(x),f32(y)); let c=ip+o; let cw=c-floor(c/n)*n; let r=o+h33(vec3f(cw,sd)).xy-f; let d=length(r); if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;} }} return vec2f(d1,d2); }
fn lace(p:vec2f,n:f32,sd:f32)->f32 { let w=w2d(p,n,sd); return 1.0-smoothstep(0.0,0.32,w.y-w.x); }
@compute @workgroup_size(8,8)
fn foam(@builtin(global_invocation_id) g:vec3u){
  let p=(vec2f(g.xy)+0.5)/1024.0;
  let wx=vec2f(perlin(vec3f(p,0.3),6.0),perlin(vec3f(p,0.7),6.0))*0.05+vec2f(perlin(vec3f(p,0.1),24.0),perlin(vec3f(p,0.9),24.0))*0.012;
  let q=fract(p+wx);
  let l=max(max(lace(q,14.0,1.0),lace(q,31.0,2.0)*0.75),lace(q,67.0,3.0)*0.55);
  let bub=w2d(q,90.0,4.0).x; let b=1.0-smoothstep(0.10,0.45,bub);
  let cl=perlin(vec3f(p,0.5),5.0)*0.9+perlin(vec3f(p,0.5),13.0)*0.5+perlin(vec3f(p,.5),40.0)*0.25;
  textureStore(oFoam,g.xy,vec4f(clamp(l,0.0,1.0),b,clamp(cl*0.7+0.5,0.0,1.0),w2d(q,200.0,5.0).x));
}

// ---------- FFT ocean ----------
struct FU { t:f32, gain:f32, choppy:f32, pad:f32 };
@group(0) @binding(0) var<uniform> fu : FU;
@group(0) @binding(1) var<storage,read> h0 : array<vec4f>;      // h0(k), conj h0(-k)
@group(0) @binding(2) var<storage,read_write> buf : array<vec4f>; // [c][y][x][2]
@group(0) @binding(3) var oDisp : texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(4) var oDer : texture_storage_2d_array<rgba16float, write>;
const N = 256u; const PI2 = 6.28318530718;
const LCs = vec4f(997.0, 211.0, 47.0, 11.0);
fn cmul(a:vec2f,b:vec2f)->vec2f { return vec2f(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x); }
fn im(a:vec2f)->vec2f { return vec2f(-a.y,a.x); }
@compute @workgroup_size(8,8,4)
fn spectrum(@builtin(global_invocation_id) g:vec3u){
  let L=LCs[g.z]; let kx=f32(select(i32(g.x)-256,i32(g.x),g.x<128u))*PI2/L; let kz=f32(select(i32(g.y)-256,i32(g.y),g.y<128u))*PI2/L;
  let k=max(sqrt(kx*kx+kz*kz),1e-6); let w=sqrt(9.81*k*(1.0+k*k/(370.0*370.0))); let ph=w*fu.t; let e=vec2f(cos(ph),sin(ph));
  let q=h0[g.z*N*N+g.y*N+g.x]; let h=(cmul(q.xy,e)+cmul(q.zw,vec2f(e.x,-e.y)))*fu.gain; let ih=im(h);
  let Dx=ih*(kx/k); let Dz=ih*(kz/k); let Dy=h; let sx=ih*kx; let sz=ih*kz; let dzx=-h*(kx*kz/k); let dxx=-h*(kx*kx/k); let dzz=-h*(kz*kz/k);
  let A=Dx+im(Dz); let B=Dy+im(dzx); let C=sx+im(sz); let E=dxx+im(dzz);
  let i=(g.z*N*N+g.y*N+g.x)*2u; buf[i]=vec4f(A,B); buf[i+1u]=vec4f(C,E);
}
var<workgroup> a : array<vec4f,512>;
fn rev8(x:u32)->u32 { return reverseBits(x)>>24u; }
fn fftN(li:u32){
  for(var m=0u;m<8u;m++){ workgroupBarrier(); let half=1u<<m; let grp=li>>m; let k=li&(half-1u); let i0=grp*2u*half+k; let i1=i0+half;
    let an=PI2*f32(k)/f32(2u*half); let w=vec2f(cos(an),sin(an));
    for(var c=0u;c<2u;c++){ let x=a[i0*2u+c]; let y=a[i1*2u+c]; let wy=vec4f(cmul(w,y.xy),cmul(w,y.zw)); a[i0*2u+c]=x+wy; a[i1*2u+c]=x-wy; } }
  workgroupBarrier();
}
@compute @workgroup_size(128)
fn fftRow(@builtin(local_invocation_id) l:vec3u,@builtin(workgroup_id) wg:vec3u){
  let base=(wg.y*N*N+wg.x*N)*2u;
  for(var c=0u;c<2u;c++){ for(var q=0u;q<2u;q++){ let j=l.x*2u+c; a[rev8(j)*2u+q]=buf[base+j*2u+q]; } }
  fftN(l.x);
  for(var c=0u;c<2u;c++){ for(var q=0u;q<2u;q++){ let j=l.x*2u+c; buf[base+j*2u+q]=a[j*2u+q]; } }
}
@compute @workgroup_size(128)
fn fftCol(@builtin(local_invocation_id) l:vec3u,@builtin(workgroup_id) wg:vec3u){
  let base=(wg.y*N*N+wg.x)*2u;
  for(var c=0u;c<2u;c++){ for(var q=0u;q<2u;q++){ let j=l.x*2u+c; a[rev8(j)*2u+q]=buf[base+j*N*2u+q]; } }
  fftN(l.x);
  for(var c=0u;c<2u;c++){ for(var q=0u;q<2u;q++){ let j=l.x*2u+c; buf[base+j*N*2u+q]=a[j*2u+q]; } }
}
@compute @workgroup_size(8,8,4)
fn assemble(@builtin(global_invocation_id) g:vec3u){
  let i=(g.z*N*N+g.y*N+g.x)*2u; let p=buf[i]; let q=buf[i+1u]; let l=fu.choppy;
  let jx=1.0+l*q.z; let jz=1.0+l*q.w; let J=jx*jz-l*l*p.w*p.w;
  let sx=q.x/max(jx,0.35); let sz=q.y/max(jz,0.35);
  textureStore(oDisp,g.xy,g.z,vec4f(l*p.x,p.z,l*p.y,J));
  textureStore(oDer,g.xy,g.z,vec4f(sx,sz,sx*sx+sz*sz,J));
}

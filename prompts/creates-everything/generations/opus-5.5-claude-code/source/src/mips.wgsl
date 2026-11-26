@group(0) @binding(0) var tIn : texture_2d_array<f32>;
@group(0) @binding(1) var tOut : texture_storage_2d_array<rgba16float, write>;
@compute @workgroup_size(8,8,1)
fn mip(@builtin(global_invocation_id) g:vec3u){
  let d=vec2i(textureDimensions(tIn,0)); let p=vec2i(g.xy)*2; let l=i32(g.z);
  let s=textureLoad(tIn,min(p,d-1),l,0)+textureLoad(tIn,min(p+vec2i(1,0),d-1),l,0)+textureLoad(tIn,min(p+vec2i(0,1),d-1),l,0)+textureLoad(tIn,min(p+vec2i(1,1),d-1),l,0);
  textureStore(tOut,g.xy,l,s*0.25);
}

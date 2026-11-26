// ================================================================ first person arm and held item, lit by the scene
const G_VFLAME_VERT = /* glsl */`
precision highp float;
out vec2 vUv; out vec3 vWorld; uniform float uTime;
void main(){
  vUv = uv;
  vec3 p = position;
  float h = uv.y;
  p.x += sin(uTime * 8.0 + h * 4.0) * 0.008 * h * h + sin(uTime * 15.0) * 0.004 * h;
  p.z += cos(uTime * 7.0 + h * 5.0) * 0.007 * h * h;
  vec4 wp = modelMatrix * vec4(p, 1.0); vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = (gl_Position.z + gl_Position.w) * 0.05 - gl_Position.w;
}`;
const G_VFLAME_FRAG = /* glsl */`
precision highp float;
in vec2 vUv; in vec3 vWorld;
uniform sampler2D uNoiseTex; uniform float uTime, uFrame;
${G_COMMON}
${G_GBUF}
void main(){
  float y = vUv.y, x = vUv.x * 2.0 - 1.0;
  float n1 = texture(uNoiseTex, vec2(vUv.x * 0.4, y * 0.55 - uTime * 0.95)).a - 0.5;
  float n2 = texture(uNoiseTex, vec2(vUv.x * 0.9 + 0.4, y * 1.2 - uTime * 1.5)).a - 0.5;
  x += (n1 * 1.2 + n2 * 0.6) * y;
  float w = smoothstep(0.0, 0.22, y) * pow(max(1.0 - y, 0.0), 0.62) * 1.05;
  float body = smoothstep(w, w * 0.2, abs(x)) * smoothstep(1.0, 0.5, y + n2 * 0.6);
  if (body < 0.28 + (ign(gl_FragCoord.xy, uFrame) - 0.5) * 0.5) discard;
  float core = smoothstep(0.55, 0.0, length(vec2(x * 1.7, (y - 0.24) * 2.1)));
  vec3 col = mix(vec3(0.95, 0.16, 0.01), vec3(1.0, 0.5, 0.05), smoothstep(0.1, 0.85, body * (1.15 - y)));
  col = mix(col, vec3(1.0, 0.86, 0.46), core);
  writeG(col, 1.0, vec3(0.0, 1.0, 0.0), 1.0, 0.0, vec4(0.0), (3.0 + core * 9.0) * (0.5 + body * 0.5), 0.0, 6.0, 0.0, 3.0);
}`;

const Viewmodel = {
  swingT: 1, mining: false, equipT: 1, currentKey: '', eatAmt: 0, sway: { x: 0, y: 0 }, placeT: 1,
  init() {
    this.root = new THREE.Group(); this.hand = new THREE.Group(); this.root.add(this.hand);
    this.elbow = new THREE.Group(); this.elbow.position.set(0.13, -0.19, 0.33); this.hand.add(this.elbow);
    this.grip = new THREE.Group(); this.grip.position.copy(this.elbow.position).negate(); this.elbow.add(this.grip);
    Pipeline.scenes.view.add(this.root);
    this.mat = makeModelMaterial({ viewmodel: true });
    this.skinMat = makeModelMaterial({ viewmodel: true, matClass: 3 });
    this.arm = new THREE.Mesh(this._armGeometry(), this.skinMat);
    this.sleeve = new THREE.Mesh(this._sleeveGeometry(), this.mat);
    this.item = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    const fg = new THREE.BufferGeometry();
    const pos = [], uv = [], idx = [];
    for (let k = 0; k < 3; k++) {
      const a = k * 1.047, c = Math.cos(a) * 0.045, s = Math.sin(a) * 0.045, b = k * 4;
      pos.push(-c, -0.012, -s, c, -0.012, s, c, 0.175, s, -c, 0.175, -s); uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx);
    this.flame = new THREE.Mesh(fg, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: G_VFLAME_VERT, fragmentShader: G_VFLAME_FRAG, uniforms: uni('uNoiseTex', 'uTime', 'uFrame'), side: THREE.DoubleSide }));
    this.flame.visible = false;
    for (const m of [this.arm, this.sleeve, this.item, this.flame]) m.frustumCulled = false;
    this.grip.add(this.arm, this.sleeve, this.item, this.flame);
    this.light = V4(0, 0, 0, 1);
    for (const m of [this.arm, this.sleeve, this.item]) { m.userData.light = this.light; perObjectLight(m); }
  },
  // hand closed around a grip at the origin; the grip axis runs along +Y, the forearm leaves toward the viewer
  _armGeometry() {
    const mb = new ModelBuilder();
    const skin = { layer: LAYER.skin, color: [0.93, 0.86, 0.82], rough: 0.56, metal: 0, uvScale: 2.5 };
    const nail = { color: [0.72, 0.52, 0.46], rough: 0.28, metal: 0 };
    mb.tube([[0.036, -0.05, 0.03], [0.058, -0.082, 0.1], [0.082, -0.118, 0.175]], [0.036, 0.031, 0.035], 16, skin, 0.78);
    mb.ellipsoid([0.034, -0.024, 0.014], [0.038, 0.056, 0.04], 18, 14, skin, (d) => 1 - Math.max(0, -d[0]) * 0.18);
    // four fingers wrap around the front of the grip
    for (let i = 0; i < 4; i++) {
      const y = 0.012 - i * 0.0245, r = 0.0132 - i * 0.0006, reach = i === 3 ? 0.9 : 1;
      const pts = [[0.04, y - 0.006, -0.008], [0.028, y, -0.036 * reach], [-0.003, y + 0.002, -0.042 * reach], [-0.029, y + 0.002, -0.022], [-0.027, y, 0.003]];
      mb.tube(pts, [r * 1.12, r * 1.05, r, r * 0.92, r * 0.78], 10, skin);
      mb.ellipsoid([0.032, y - 0.001, -0.033 * reach], [r * 1.08, r * 0.98, r * 1.08], 10, 8, skin);
      mb.ellipsoid([-0.033, y + 0.001, -0.004], [r * 0.34, r * 0.52, r * 0.62], 8, 6, nail);
    }
    mb.tube([[0.032, -0.012, 0.03], [0.006, 0.018, 0.036], [-0.02, 0.04, 0.018], [-0.024, 0.047, -0.006]], [0.02, 0.016, 0.0135, 0.0105], 12, skin);
    mb.ellipsoid([-0.034, 0.047, -0.001], [0.0045, 0.0075, 0.008], 8, 6, nail);
    return mb.geometry();
  },
  _sleeveGeometry() {
    const mb = new ModelBuilder();
    mb.tube([[0.08, -0.116, 0.17], [0.105, -0.155, 0.25]], [0.043, 0.046], 16, { layer: LAYER.leather, color: [0.82, 0.74, 0.66], rough: 0.58, metal: 0, uvScale: 2.2 }, 0.84);
    for (const f of [0.1, 0.9]) mb.tube([[0.08 + 0.025 * f, -0.116 - 0.039 * f, 0.17 + 0.08 * f], [0.0815 + 0.025 * f, -0.1185 - 0.039 * f, 0.175 + 0.08 * f]], [0.0475, 0.0478], 16, { layer: LAYER.iron, color: [0.62, 0.52, 0.34], metal: 0.9, rough: 0.4 }, 0.84);
    mb.tube([[0.1, -0.147, 0.235], [0.135, -0.2, 0.33], [0.19, -0.27, 0.46], [0.25, -0.35, 0.62]], [0.052, 0.062, 0.074, 0.088], 16, { layer: LAYER.cloth, color: [0.62, 0.66, 0.58], rough: 0.95, metal: 0, uvScale: 2.6 }, 0.9);
    return mb.geometry();
  },
  swing() { if (this.swingT > 0.55) this.swingT = 0; },
  mine() { this.mining = true; if (this.swingT >= 1) this.swingT = 0; },
  stopMine() { this.mining = false; },
  place() { this.placeT = 0; },
  eat(t) { this.eatAmt = Math.min(1, t * 5); },
  setItem(key) {
    if (key === this.currentKey) return;
    if (this.equipT > 0.98) { this.equipT = 0; this.pending = key; }
    else this.pending = key;
  },
  _apply(key) {
    this.currentKey = key;
    const it = ITEMS[key];
    this.item.visible = !!it; this.flame.visible = key === 'torch';
    if (!it) return;
    const kind = it.type === 'block' ? T_KIND[it.block] : -1;
    if (key === 'torch') {
      if (!this.torchGeo) { const mb = new ModelBuilder(); mb.tube([[0, -0.11, 0], [0.004, 0.06, 0], [0, 0.2, 0]], [0.017, 0.019, 0.022], 10, { layer: LAYER.oak_bark, color: [0.95, 0.85, 0.7], metal: 0, uvScale: 3 }); mb.tube([[0, 0.172, 0], [0, 0.226, 0]], [0.026, 0.024], 12, { layer: LAYER.charwood, emissive: 1.6, metal: 0, uvScale: 4 }); mb.tube([[0, 0.14, 0], [0, 0.17, 0]], [0.026, 0.026], 12, { layer: LAYER.cloth, color: [0.4, 0.32, 0.22], uvScale: 6 }); this.torchGeo = mb.geometry(); }
      this.item.geometry = this.torchGeo;
    } else this.item.geometry = itemGeometry(key);
    this.item.position.set(0, 0, 0); this.item.rotation.set(0, 0, 0); this.item.scale.setScalar(1);
    this.flame.position.set(0, 0.218, 0);
    if (it.type === 'tool') {
      this.item.position.set(0, 0.075, 0);
      this.item.rotation.set(0, it.tool === 'blade' ? -1.0 : -1.38, 0);
      if (it.tool === 'blade') this.item.position.set(0, 0.04, 0);
    } else if (it.type === 'block') {
      if (key !== 'torch') {
        const cross = kind === KIND.cross || kind === KIND.crystal || kind === KIND.torch;
        this.item.scale.setScalar(cross ? 0.2 : kind === KIND.door ? 0.25 : 0.135);
        this.item.position.set(-0.035, cross ? 0.13 : 0.105, -0.045);
        this.item.rotation.set(0.12, 0.72, 0.04);
      }
    } else { this.item.scale.setScalar(0.12); this.item.position.set(-0.02, 0.085, -0.03); this.item.rotation.set(0.2, -0.5, 0.15); }
  },
  update(dt, t, player, world, cam) {
    const held = player.held;
    this.setItem(held ? held.k : '');
    if (this.equipT < 1) {
      this.equipT = Math.min(1, this.equipT + dt * 4.6);
      if (this.pending !== undefined && this.equipT >= 0.5) { this._apply(this.pending); this.pending = undefined; }
    } else if (this.pending !== undefined) { if (this.pending !== this.currentKey) this.equipT = 0; else this.pending = undefined; }
    if (this.swingT < 1) { this.swingT += dt * 3.2; if (this.swingT >= 1 && this.mining) this.swingT = 0; }
    this.swingT = Math.min(1, this.swingT);
    this.placeT = Math.min(1, this.placeT + dt * 5);
    this.sway.x = lerp(this.sway.x, clamp(-player.lookDX * 0.0009, -0.06, 0.06), 1 - Math.exp(-dt * 9));
    this.sway.y = lerp(this.sway.y, clamp(player.lookDY * 0.0009, -0.05, 0.05), 1 - Math.exp(-dt * 9));
    player.lookDX = 0; player.lookDY = 0;
    this.eatAmt = Math.max(0, this.eatAmt - dt * 3);
    // a torch goes out under water and relights in the air
    this.flame.visible = this.currentKey === 'torch' && U.uUnderwater.value < 0.5;
    const it = held ? ITEMS[held.k] : null;
    const bob = Settings.bob ? player.bobAmt : 0, ph = player.bobPhase * Math.PI;
    const p = this.swingT < 1 ? this.swingT : 0;
    const s1 = Math.sin(Math.sqrt(p) * Math.PI), s2 = Math.sin(p * Math.PI), s3 = Math.sin(p * p * Math.PI);
    const equip = this.equipT < 0.5 ? this.equipT * 2 : (1 - this.equipT) * 2;
    const empty = !it;
    let x = 0.33, y = -0.275, z = -0.57, rx = -0.3, ry = 0.06, rz = 0.1;
    if (it && it.type === 'tool') { x = 0.34; y = -0.265; z = -0.6; rx = -0.52; rz = 0.1; if (it.tool === 'blade') { x = 0.37; y = -0.3; rx = -0.62; rz = -0.04; ry = -0.12; } }
    if (held && held.k === 'torch') { x = 0.34; y = -0.3; z = -0.6; rx = -0.18; rz = 0.1; }
    if (empty) { x = 0.34; y = -0.31; z = -0.55; rx = -0.1; rz = 0.42; ry = 0.22; }
    x += this.sway.x + Math.cos(ph) * 0.017 * bob + Math.sin(t * 1.1) * 0.0028;
    y += this.sway.y - Math.abs(Math.sin(ph)) * 0.017 * bob + Math.sin(t * 1.7) * 0.0042 - equip * 0.34 - player.landOff * -0.12;
    // strike arc
    const heavy = it && it.type === 'tool' && it.tool !== 'blade';
    x += -s1 * (empty ? 0.15 : 0.1); y += Math.sin(Math.sqrt(p) * Math.PI * 2) * 0.04 + s2 * (empty ? 0.07 : 0.015); z += -s2 * (empty ? 0.13 : 0.07);
    const swingX = -s1 * (heavy ? 0.52 : it && it.type === 'tool' ? 0.4 : empty ? 0.12 : 0.26) + s3 * 0.08;
    rx += -s1 * (heavy ? 0.42 : it && it.type === 'tool' ? 0.3 : empty ? 0.05 : 0.2);
    ry += s1 * (empty ? 0.34 : 0.18); rz += s1 * (it && it.tool === 'blade' ? 0.7 : 0.18);
    this.elbow.rotation.set(swingX, 0, 0);
    const placeK = Math.sin(this.placeT * Math.PI);
    z -= placeK * 0.09; rx -= placeK * 0.35;
    if (this.eatAmt > 0) { x = lerp(x, 0.07, this.eatAmt); y = lerp(y, -0.2 + Math.sin(t * 19) * 0.014, this.eatAmt); z = lerp(z, -0.42, this.eatAmt); rz = lerp(rz, 0.5, this.eatAmt); }
    // follow the camera in view space
    this.root.position.copy(cam.position); this.root.quaternion.copy(cam.quaternion);
    this.hand.position.set(x, y, z); this.hand.rotation.set(rx, ry, rz, 'YXZ'); this.hand.scale.setScalar(0.96);
    this.root.updateMatrixWorld(true);
    const l = world.getLight(Math.floor(cam.position.x), cam.position.y, Math.floor(cam.position.z));
    const k = 1 - Math.exp(-dt * 9);
    this.light.x = lerp(this.light.x, l[0], k); this.light.y = lerp(this.light.y, l[1], k); this.light.z = lerp(this.light.z, l[2], k); this.light.w = lerp(this.light.w, l[3], k);
    // the hand sits right at the eye, where far more daylight reaches than the voxel water falloff suggests
    if (U.uUnderwater.value > 0.5) this.light.w = Math.max(this.light.w, 0.66);
    this.mat.uniforms.uWetness.value = U.uRain.value * 0.5 * l[3]; this.skinMat.uniforms.uWetness.value = this.mat.uniforms.uWetness.value;
  },
  // a carried light source that follows the hand
  heldLight(player, cam) {
    const s = player.held;
    if (!s) return null;
    const it = ITEMS[s.k];
    if (!it || it.type !== 'block') return null;
    const def = BLOCKS[it.block];
    if (!def.emit) return null;
    if (s.k === 'torch' && U.uUnderwater.value > 0.5) return null;
    const p = V3(0.3, -0.04, -0.62).applyQuaternion(cam.quaternion).add(cam.position);
    const m = Math.max(...def.emit);
    return { x: p.x, y: p.y, z: p.z, color: [def.emit[0] / m, def.emit[1] / m * 0.92, def.emit[2] / m * 0.8], power: (m / 15) * 5.2, radius: 5 + m * 0.55, type: s.k === 'torch' ? 0 : 1, held: true, boost: 100 };
  },
};

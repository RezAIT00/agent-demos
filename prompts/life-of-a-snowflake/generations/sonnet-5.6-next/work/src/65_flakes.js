// ---------------------------------------------------------------- neighbours
// Dozens of other crystals, each with its own weather history, resting on the
// wool. A few are columns and needles: crystals that spent their lives near
// -5 °C or below -22 °C, where the Nakaya diagram gives prisms instead.
function layoutNeighbours() {
  // [x, z, radius mm] composed around the final frame, then a seeded scatter
  const placed = [
    [-4.55, -3.05, 1.55], [4.70, 1.65, 1.20], [3.55, -4.70, 1.75], [-4.05, 3.15, 1.05],
    [-0.65, -6.15, 1.45], [-7.05, 0.20, 1.35], [6.65, -1.95, 1.10], [2.15, 4.65, 0.85],
    [-2.60, 5.75, 1.20], [6.10, 4.55, 1.30], [-7.35, -5.85, 1.65], [8.45, -5.75, 1.25],
  ];
  const rnd = makeRng(1717);
  const hero = 2.65;
  const columns = [
    { x: -3.55, z: -0.75, kind: 'needle', a: 1.2 }, { x: 4.0, z: -1.55, kind: 'capped', a: 1.05 },
    { x: 0.55, z: 3.75, kind: 'column', a: -0.4 }, { x: -6.1, z: 4.3, kind: 'capped', a: 2.05 },
    { x: 5.9, z: -8.9, kind: 'needle', a: -0.8 }, { x: -9.8, z: -2.6, kind: 'needle', a: 0.3 },
    { x: -1.4, z: -10.6, kind: 'capped', a: 1.9 },
  ];
  columns[0].x = -3.42; columns[0].z = 0.9;
  let guard = 0;
  while (placed.length < 58 && guard++ < 20000) {
    const k = placed.length;
    const a = rnd() * Math.PI * 2;
    const dist = k < 30 ? 6.0 + 8.5 * rnd() : 12.5 + 15 * rnd();
    const r = 0.55 + 1.45 * Math.pow(rnd(), 1.25);
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist - 2.5;
    if (Math.hypot(x, z) < hero + r + 0.35) continue;
    if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < (p[2] + r) * 0.86)) continue;
    if (columns.some((c) => Math.hypot(c.x - x, c.z - z) < r + 0.9)) continue;
    if (Math.abs(x) > 26 || z < -29 || z > 24) continue;
    placed.push([x, z, r]);
  }
  return { placed, columns };
}

function neighbourJobs(placed) {
  return placed.map((p, i) => {
    const R = p[2] > 1.3 && i < 24 ? 180 : 140;
    // the seed picks the family (seed % 6) and every random detail
    return { layers: SIM.neighbourHistory(101 + i * 7 + (i % 5)), R, maxSteps: 70000, margin: 50 };
  });
}

function restingFrame(heightAt, x, z, r, sink) {
  // fit a gently tilted plane to the highest wool under the footprint
  const pts = [];
  for (let k = 0; k < 40; k++) {
    const rr = r * 0.92 * Math.sqrt((k + 0.5) / 40), a = k * 2.39996;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr, heightAt(x + Math.cos(a) * rr, z + Math.sin(a) * rr)]);
  }
  let sxx = 0, szz = 0, sxy = 0, szy = 0, my = 0;
  for (const p of pts) my += p[2];
  my /= pts.length;
  for (const p of pts) { sxx += p[0] * p[0]; szz += p[1] * p[1]; sxy += p[0] * (p[2] - my); szy += p[1] * (p[2] - my); }
  const gx = clamp(sxy / (sxx || 1), -0.45, 0.45), gz = clamp(szy / (szz || 1), -0.45, 0.45);
  const res = pts.map((p) => p[2] - (my + gx * p[0] + gz * p[1])).sort((a, b) => a - b);
  const y = my + res[Math.floor(res.length * 0.88)] - (sink || 0);
  return { y, normal: new THREE.Vector3(-gx, 1, -gz).normalize() };
}

function flakeQuaternion(normal, spin) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const sp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spin);
  return q.multiply(flat).multiply(sp);
}

function buildColumnCrystal(shared, spec, heightAt, caps) {
  const group = new THREE.Group();
  const add = (halfLen, rad, offset, angle) => {
    const m = makePrismMesh(shared);
    const u = m.material.uniforms;
    u.uRadius.value = rad; u.uHalfH.value = halfLen; u.uMorph.value = 1; u.uSphereR.value = rad; u.uSeed.value = 3;
    u.uFrost.value = 0.34; u.uFront.value = 2.0; u.uBright.value = 0.58;
    const axis = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    m.position.copy(offset);
    group.add(m);
    return axis;
  };
  if (spec.kind === 'needle') {
    add(0.86, 0.062, new THREE.Vector3(0, 0, 0), spec.a);
    add(0.63, 0.050, new THREE.Vector3(0.11, 0.06, 0.09), spec.a + 0.21);
    add(0.43, 0.044, new THREE.Vector3(-0.15, 0.02, -0.08), spec.a - 0.17);
    const rf = restingFrame(heightAt, spec.x, spec.z, 0.9, 0);
    group.position.set(spec.x, rf.y + 0.10, spec.z);
  } else if (spec.kind === 'column') {
    add(0.40, 0.165, new THREE.Vector3(0, 0, 0), spec.a);
    const rf = restingFrame(heightAt, spec.x, spec.z, 0.55, 0);
    group.position.set(spec.x, rf.y + 0.22, spec.z);
  } else {
    // tsuzumi: a column grown cold, then a plate on each end near -15 °C
    const axis = add(0.44, 0.125, new THREE.Vector3(0, 0, 0), spec.a);
    caps.forEach((cap, k) => {
      const mesh = cap.mesh;
      mesh.position.copy(axis).multiplyScalar(k ? 0.46 : -0.46);
      mesh.scale.setScalar(k ? 0.56 : 0.47);
      mesh.material.uniforms.uBright.value = 0.66;
      mesh.material.uniforms.uRimCol = { value: new THREE.Vector3(0.50, 0.44, 0.40) };
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.4));
      group.add(mesh);
    });
    const rf = restingFrame(heightAt, spec.x, spec.z, 0.7, 0);
    group.position.set(spec.x, rf.y + 0.56, spec.z);
  }
  return group;
}

// A static top-down map of where the resting crystals shade the wool.
function renderFlakeShadows(renderer, flakes) {
  const rt = makeRT(1024, 1024, { minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true });
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-40, 40, 40, -40, 0.1, 200);
  const quad = new THREE.PlaneGeometry(2, 2);
  for (const f of flakes) {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uH: { value: f.height }, uK: { value: new THREE.Vector2() } },
      vertexShader: `uniform vec2 uK; out vec2 vUv;
        void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0);
          vec2 p = w.xz + uK*(0.2 - w.y);
          gl_Position = vec4(p.x/40.0, p.y/40.0, 0.0, 1.0); }`,
      fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uH;
        void main(){ vec4 t = textureLod(uH, vUv, 2.2); o = vec4(smoothstep(0.1, 0.9, t.g)*0.85, 0.0, 0.0, 1.0); }`,
    });
    mat.uniforms.uK.value.set(MIT.keyW.x / MIT.keyW.y, MIT.keyW.z / MIT.keyW.y);
    const m = new THREE.Mesh(quad, mat);
    m.position.copy(f.mesh.position); m.quaternion.copy(f.mesh.quaternion); m.scale.copy(f.mesh.scale);
    m.frustumCulled = false;
    scene.add(m);
  }
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.render(scene, cam);
  return rt.texture;
}

// ================================================================ core
const SHARED_SRC = document.getElementById('shared-src').textContent;
const Shared = new Function(SHARED_SRC + '\nreturn {ihash,rand01,mulberry32,clamp,lerp,sstep,smooth01,Simplex,WorldGen,B,BLOCKS,BLOCK_COUNT,T_OPAQUE,T_SOLID,T_LIGHT,T_KIND,T_AXIS,KIND,LAYER,LAYER_DEFS,LAYER_COUNT,FIRST_CUTOUT_LAYER,CHUNK,WORLD_H,SEA,bidx,BIOME,BIOME_NAMES,FLAG,FACES};')();
const { ihash, rand01, mulberry32, clamp, lerp, sstep, smooth01, Simplex, WorldGen, B, BLOCKS, BLOCK_COUNT, T_OPAQUE, T_SOLID, T_LIGHT, T_KIND, KIND, LAYER, LAYER_DEFS, LAYER_COUNT, FIRST_CUTOUT_LAYER, CHUNK, WORLD_H, SEA, bidx, BIOME, BIOME_NAMES, FLAG, FACES } = Shared;

const QS = new URLSearchParams(location.search);
const DEMO = QS.get('demo') === '1';

const PRESETS = {
  low: { name: 'low', renderScale: 0.72, viewDist: 6, lodNear: 100, lodDist: 768, shadowRes: 1024, shadowDist: 90, pcf: 8, cloudSteps: 24, cloudScale: 0.4, volSteps: 12, aoSlices: 1, aoSteps: 4, ssr: 0, leafCards: 4, grass: 0.45, grassDist: 30, texSize: 256, pom: 0, maxLights: 12, taa: 1, contact: 0 },
  medium: { name: 'medium', renderScale: 0.85, viewDist: 9, lodNear: 150, lodDist: 1100, shadowRes: 1536, shadowDist: 130, pcf: 12, cloudSteps: 36, cloudScale: 0.45, volSteps: 18, aoSlices: 2, aoSteps: 4, ssr: 24, leafCards: 5, grass: 0.72, grassDist: 42, texSize: 256, pom: 8, maxLights: 20, taa: 1, contact: 8 },
  high: { name: 'high', renderScale: 1.0, viewDist: 13, lodNear: 230, lodDist: 1700, shadowRes: 2048, shadowDist: 180, pcf: 16, cloudSteps: 48, cloudScale: 0.5, volSteps: 24, aoSlices: 2, aoSteps: 5, ssr: 36, leafCards: 6, grass: 1.0, grassDist: 54, texSize: 512, pom: 14, maxLights: 32, taa: 1, contact: 12 },
  ultra: { name: 'ultra', renderScale: 1.0, viewDist: 18, lodNear: 330, lodDist: 2400, shadowRes: 4096, shadowDist: 250, pcf: 28, cloudSteps: 80, cloudScale: 0.5, volSteps: 44, aoSlices: 3, aoSteps: 8, ssr: 64, leafCards: 8, grass: 1.35, grassDist: 80, texSize: 512, pom: 28, maxLights: 48, taa: 1, contact: 20 },
};

const Settings = {
  preset: 'high', renderDist: 0, shadows: 'preset', fov: 74, sensitivity: 1.0, volume: 0.8, dayLength: 20, bob: true,
  load() { try { Object.assign(this, JSON.parse(localStorage.getItem('ashlar.settings') || '{}')); } catch (e) { /* storage unavailable */ } if (QS.get('preset') && PRESETS[QS.get('preset')]) this.preset = QS.get('preset'); },
  save() { try { localStorage.setItem('ashlar.settings', JSON.stringify({ preset: this.preset, renderDist: this.renderDist, shadows: this.shadows, fov: this.fov, sensitivity: this.sensitivity, volume: this.volume, dayLength: this.dayLength, bob: this.bob })); } catch (e) { /* ignore */ } },
};
Settings.load();
let Q = Object.assign({}, PRESETS[DEMO ? 'ultra' : Settings.preset] || PRESETS.high);
function applyQuality() {
  Q = Object.assign({}, PRESETS[DEMO ? 'ultra' : Settings.preset] || PRESETS.high);
  if (!DEMO && Settings.renderDist) Q.viewDist = Settings.renderDist;
  if (!DEMO && Settings.shadows !== 'preset') {
    Q.shadowRes = { off: 0, low: 1024, medium: 1536, high: 2048, ultra: 4096 }[Settings.shadows];
  }
}
applyQuality();

// ---------------------------------------------------------------- uniforms shared by reference across materials
const V2 = (x = 0, y = 0) => new THREE.Vector2(x, y);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const V4 = (x = 0, y = 0, z = 0, w = 0) => new THREE.Vector4(x, y, z, w);
const U = {
  uTime: { value: 0 }, uFrame: { value: 0 }, uCamPos: { value: V3() }, uWind: { value: V4(0.82, 0.57, 0.5, 0) },
  uSunDir: { value: V3(0.4, 0.7, 0.3).normalize() }, uMoonDir: { value: V3(-0.4, -0.7, -0.3).normalize() }, uLightDir: { value: V3(0.4, 0.7, 0.3).normalize() },
  uLightColor: { value: V3(8, 7.5, 7) }, uSunIllum: { value: 13.0 }, uMoonIllum: { value: V3(0.2, 0.26, 0.4) }, uNight: { value: 0 },
  uSH: { value: Array.from({ length: 9 }, () => V3()) }, uBounce: { value: V3(0.1, 0.08, 0.05) },
  uRain: { value: 0 }, uWetness: { value: 0 }, uPuddle: { value: 0 }, uSnowCover: { value: 0 }, uSnowfall: { value: 0 }, uStorm: { value: 0 }, uFlash: { value: 0 }, uFlashPos: { value: V3() },
  uCloudCover: { value: 0.45 }, uCloudDensity: { value: 1.0 }, uCloudOffset: { value: V2() },
  uFogDensity: { value: 0.0009 }, uFogHeight: { value: 0.045 }, uFogBase: { value: SEA }, uHaze: { value: 1.0 }, uCamSky: { value: 1.0 }, uUnderwater: { value: 0 }, uWaterColor: { value: V3(0.02, 0.12, 0.14) },
  uPlayerPos: { value: V3() }, uGrassDist: { value: Q.grassDist }, uBreak: { value: V4(0, -999, 0, 0) },
  uAlbedoArr: { value: null }, uNormalArr: { value: null }, uExtraArr: { value: null }, uLayerParams: { value: null }, uNoiseTex: { value: null }, uWaterNormals: { value: null },
  uRainMap: { value: null }, uRainMapInfo: { value: V4(0, 0, 256, 0) }, uPomSteps: { value: Q.pom }, uTexSize: { value: Q.texSize },
  uSkyView: { value: null }, uCloudNoise: { value: null }, uCloudDetail: { value: null }, uFarHeight: { value: null }, uFarInfo: { value: V4(0, 0, 1, 0) },
};
const uni = (...names) => { const o = {}; for (const n of names) { if (!U[n]) throw new Error('no uniform ' + n); o[n] = U[n]; } return o; };

// ---------------------------------------------------------------- helpers
let renderer = null;
const quadGeo = new THREE.BufferGeometry();
quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
const fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const FS_VERT = 'out vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function fsMaterial(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial(Object.assign({ glslVersion: THREE.GLSL3, vertexShader: FS_VERT, fragmentShader: 'precision highp float;\nprecision highp sampler2DArray;\nprecision highp sampler3D;\nin vec2 vUv;\n' + frag, uniforms, depthTest: false, depthWrite: false }, extra));
}
class FSPass {
  constructor(frag, uniforms, extra) {
    this.material = fsMaterial(frag, uniforms, extra);
    this.mesh = new THREE.Mesh(quadGeo, this.material); this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.mesh);
  }
  get u() { return this.material.uniforms; }
  render(target, layer) { renderer.setRenderTarget(target, layer || 0); renderer.render(this.scene, fsCamera); }
}
function makeRT(w, h, o = {}) {
  const t = new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), Object.assign({ type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false }, o));
  return t;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function halton(i, base) { let f = 1, r = 0; while (i > 0) { f /= base; r += f * (i % base); i = Math.floor(i / base); } return r; }

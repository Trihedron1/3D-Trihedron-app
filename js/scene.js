/* ==========================================================================
   Trihedron Crystal — a scroll story built around the logo as a 3D object.

   Chapters (one screen each; the scroll position blends between them):
     0 Intro          assembled crystal, centred
     1 Three facets   crystal opens; click a facet for details (directors, focus areas)
     2 Footprint      floating dust morphs into a dotted globe with Trihedron's regions
     3 Track record   counters + testimonial, crystal to the side
     4 Solutions      the four services
     5 Contact        crystal re-centred, call to action

   Rendering: physical glass (transmission, dispersion, attenuation), custom studio
   environment, bloom + chromatic aberration + vignette + grain, glossy floor with a
   mirrored reflection and contact shadow, GPU particle morph (dust → globe).
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 900px), (pointer: coarse)').matches;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/* ==========================================================================
   Content (real Trihedron information)
   ========================================================================== */

const SITE = 'https://www.trihedron.co.za';
const FACET_INFO = {
  top: {
    color: '#48eb12', eyebrow: 'Facet 01', title: 'Metrology',
    intro: 'Industrial metrology and measurement technology for automotive and manufacturing production lines.',
    points: ['Measurement and inspection specialists', 'CMM programming and quality support', 'Training delivered with partners such as ZEISS, via Trihedron Livestream Services'],
    people: [{ name: 'Manuel da Silva', role: 'Founder · Industrial Metrology Solutions Director', photo: 'assets/photos/director-manuel-da-silva.jpg' }],
    link: { label: 'Explore our services', href: `${SITE}/our-services/` },
  },
  left: {
    color: '#ff3b28', eyebrow: 'Facet 02', title: 'Automation',
    intro: 'PLC, robotics and controls specialists for machine installation and commissioning.',
    points: ['PLC programming and commissioning', 'Robotics integration support', 'Contract or permanent, locally and abroad'],
    people: [
      { name: 'Juan Slabbert', role: 'Control Solutions Director', photo: 'assets/photos/director-juan-slabbert.jpg' },
      { name: 'Hardus Viljoen', role: 'Consulting Director', photo: 'assets/photos/director-hardus-viljoen.jpg' },
    ],
    link: { label: 'Explore our services', href: `${SITE}/our-services/` },
  },
  right: {
    color: '#00a7fa', eyebrow: 'Facet 03', title: 'Artisans',
    intro: 'Mechanical and electrical trades: right-fit artisans for factory machine installation support.',
    points: ['Mechanical and electrical artisans', 'Installation crews for production-line projects', 'Vetted, trained and drawn from a growing database'],
    people: [{ name: 'Manuel da Silva', role: 'Oversees the mechanical & electrical trades', photo: 'assets/photos/director-manuel-da-silva.jpg' }],
    link: { label: 'View vacancies', href: `${SITE}/vacancies/` },
  },
  core: {
    color: '#ffffff', eyebrow: 'The core', title: 'People first',
    intro: 'Everything Trihedron does rests on three values.',
    points: ['Integrity: honesty and strong moral principles', 'Competence: projects delivered successfully and efficiently', 'Reliability: consistent quality that lets us grow into new territories'],
    people: [],
    link: { label: 'Request a callback', href: `${SITE}/contact-us/` },
  },
};

// Chapter key-frames for the 3D scene
//   explode: how open the crystal is · focus: horizontal position of the crystal (0.5 = centre)
//   scale: crystal size · globe: dust → globe morph · yaw: extra turn · labels: facet labels on
const CHAPTERS = [
  { explode: 0, focus: 0.6, fy: 0.5, scale: 1, globe: 0, yaw: 0, labels: 0 },
  { explode: 1, focus: 0.56, fy: 0.5, scale: 1, globe: 0, yaw: 0.2, labels: 1 },
  { explode: 0, focus: 0.66, fy: 0.5, scale: 0.36, globe: 1, yaw: 0, labels: 0 },
  { explode: 0.35, focus: 0.68, fy: 0.5, scale: 0.92, globe: 0, yaw: -0.55, labels: 0 },
  { explode: 0, focus: 0.7, fy: 0.5, scale: 0.86, globe: 0, yaw: 0.6, labels: 0 },
  { explode: 0, focus: 0.5, fy: 0.36, scale: 0.72, globe: 0, yaw: Math.PI * 2, labels: 0 },
];

const HQ = { name: 'Gqeberha', lat: -33.96, lon: 25.6, hq: true };
const REGIONS = [
  { name: 'Canada', lat: 45.4, lon: -75.7 },
  { name: 'USA', lat: 30.3, lon: -97.7 },
  { name: 'Mexico', lat: 19.4, lon: -99.1 },
  { name: 'Brazil', lat: -23.5, lon: -46.6 },
  { name: 'United Kingdom', lat: 52.5, lon: -1.9 },
  { name: 'Germany', lat: 48.8, lon: 9.2 },
];

/* ==========================================================================
   Renderer, scene, camera
   ========================================================================== */

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  root.classList.add('no-webgl', 'is-loaded');
  throw err;
}
const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.3;

const scene = new THREE.Scene();
const BG = new THREE.Color(0x03050a);
scene.background = BG;
scene.fog = new THREE.FogExp2(BG, 0.045);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const ISO = new THREE.Vector3(1, 1, 1).normalize();           // looking down the cube diagonal = the logo
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const SCREEN_UP = new THREE.Vector3().crossVectors(RIGHT, ISO.clone().negate()).normalize();

/* ---------- Studio environment for reflections ---------- */

(function buildStudio() {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x020308);
  const panel = (hex, intensity, pos, size) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.scale.set(size[0], size[1], 1); m.lookAt(0, 0, 0);
    studio.add(m);
  };
  panel(0xffffff, 7.0, [0, 7, 0], [9, 9]);
  panel(0xbfe3ff, 9.0, [-6, 1.5, 4], [1.1, 9]);
  panel(0xffffff, 6.0, [5, 1, -5], [1.1, 9]);
  panel(0xffffff, 3.0, [4, 2, 6], [3, 5]);
  panel(0x1d6bff, 3.0, [0, -1, -8], [14, 4]);
  panel(0x48eb12, 0.6, [7, -2, 3], [2, 2]);
  panel(0xff3b28, 0.6, [-3, -2, 7], [2, 2]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio, 0.03).texture;
  pmrem.dispose();
})();

function radialTexture(stops, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Backdrop: glow, hexagon ring, light strips ---------- */

const backdrop = new THREE.Group();
scene.add(backdrop);
const glowDisc = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.MeshBasicMaterial({
    map: radialTexture([[0, '#0f3a8a'], [0.35, '#081a40'], [0.7, '#03050a'], [1, '#03050a']]),
    toneMapped: false, fog: false, depthTest: false, depthWrite: false,
  })
);
glowDisc.position.z = -1.4;
glowDisc.renderOrder = -10;
backdrop.add(glowDisc);

const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2f7bff).multiplyScalar(2.2), toneMapped: false, fog: false, transparent: true });
const ring = new THREE.Group();
for (let k = 0; k < 6; k++) {
  const a1 = Math.PI / 2 + (k * Math.PI) / 3, a2 = a1 + Math.PI / 3, R = 2.85;
  const p1 = new THREE.Vector2(Math.cos(a1) * R, Math.sin(a1) * R);
  const p2 = new THREE.Vector2(Math.cos(a2) * R, Math.sin(a2) * R);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(p1.distanceTo(p2), 0.012, 0.012), ringMat);
  bar.position.set((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 0);
  bar.rotation.z = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  ring.add(bar);
}
backdrop.add(ring);

function stripGeometry(height) {
  const geo = new THREE.PlaneGeometry(0.03, height, 1, 24);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const bright = new THREE.Color(0xcfe8ff).multiplyScalar(1.1);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.pow(1 - Math.abs(pos.getY(i)) / (height / 2), 1.8);
    const c = BG.clone().lerp(bright, k);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const stripMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
const strips = [-1.3, 0.3, 1.5].map((x, i) => {
  const s = new THREE.Mesh(stripGeometry(3.6), stripMat);
  s.position.set(x, 0, -0.8 - i * 0.1);
  s.rotation.z = 0.14;
  s.userData.x = x;
  backdrop.add(s);
  return s;
});

/* ==========================================================================
   The mark: three glass plates + RGB core
   ========================================================================== */

const pivot = new THREE.Group();
const model = new THREE.Group();
pivot.add(model);
scene.add(pivot);

function glassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xa6dcff, emissive: 0x1663f0, emissiveIntensity: 0.34,
    metalness: 0, roughness: 0.03, transmission: 1, thickness: 1.0, ior: 1.62, dispersion: 4,
    iridescence: 0.18, iridescenceIOR: 1.3, iridescenceThicknessRange: [160, 420],
    attenuationColor: new THREE.Color(0x0f74ff), attenuationDistance: 1.3,
    clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMapIntensity: 2.3,
  });
}

function plateGeometry(half, gap, thick, bevel, notch) {
  const h = half - gap - bevel;
  let pts;
  if (notch) {
    const c = notch.c - bevel;
    pts = [[-h, -h], [h, -h], [h, c], [c, c], [c, h], [-h, h]].map(([u, v]) => [u * notch.su, v * notch.sv]);
  } else {
    pts = [[-h, -h], [h, -h], [h, h], [-h, h]];
  }
  const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 1 });
  geo.translate(0, 0, bevel);
  return geo;
}

const HALF = 1, NOTCH = -0.2, T = 0.28;
const FACES = {
  right: { rot: [0, Math.PI / 2, 0], su: -1, sv: 1, normal: new THREE.Vector3(1, 0, 0) },
  top: { rot: [-Math.PI / 2, 0, 0], su: 1, sv: -1, normal: new THREE.Vector3(0, 1, 0) },
  left: { rot: [0, 0, 0], su: 1, sv: 1, normal: new THREE.Vector3(0, 0, 1) },
};

const plates = {};
const pickables = [];
Object.entries(FACES).forEach(([name, f], i) => {
  const mesh = new THREE.Mesh(plateGeometry(HALF, 0.09, T, 0.07, { c: NOTCH, su: f.su, sv: f.sv }), glassMaterial());
  mesh.rotation.set(...f.rot);
  mesh.userData = { facet: name, base: f.normal.clone().multiplyScalar(HALF - T), baseQuat: mesh.quaternion.clone(), hover: 0, focus: 0, index: i };
  mesh.position.copy(mesh.userData.base);
  model.add(mesh);
  plates[name] = mesh;
  pickables.push(mesh);
});

const inner = new THREE.Group();
const K = 0.4, E = 0.8, T2 = 0.12;
inner.position.set(K, K, K);
inner.userData = { base: inner.position.clone(), hover: 0, focus: 0 };
model.add(inner);
inner.add(new THREE.Mesh(new THREE.BoxGeometry(E - 0.1, E - 0.1, E - 0.1), new THREE.MeshStandardMaterial({ color: 0x0a0f1c, metalness: 0.9, roughness: 0.3 })));
const coreFaces = [];
[['top', 0x48eb12], ['left', 0xff3b28], ['right', 0x00a7fa]].forEach(([name, hex]) => {
  const f = FACES[name];
  const mesh = new THREE.Mesh(plateGeometry(E / 2, 0.03, T2, 0.035, null), new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.7, roughness: 0.28, metalness: 0, envMapIntensity: 0.4 }));
  mesh.rotation.set(...f.rot);
  mesh.position.copy(f.normal).multiplyScalar(E / 2 - T2);
  mesh.userData.facet = 'core';
  inner.add(mesh);
  coreFaces.push(mesh);
  pickables.push(mesh);
});

scene.add(new THREE.HemisphereLight(0x9fc8ff, 0x05070d, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(3, 6, 2);
scene.add(key);
const cursorLight = new THREE.PointLight(0x7fc2ff, 14, 9, 1.6);
scene.add(cursorLight);

/* ==========================================================================
   Floor: glossy grid, mirrored reflection, contact shadow
   ========================================================================== */

const FLOOR_Y = -1.55;
function gridTexture() {
  const s = 1024, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#080c16';
  g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(90, 150, 255, 0.10)';
  g.lineWidth = 2;
  for (let i = 0; i <= s; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const FLOOR_OPACITY = 0.86;
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 96),
  new THREE.MeshStandardMaterial({
    map: gridTexture(),
    alphaMap: radialTexture([[0, '#ffffff'], [0.35, '#ffffff'], [1, '#000000']]),
    transparent: true, opacity: FLOOR_OPACITY, roughness: 0.32, metalness: 0.55, envMapIntensity: 0.5, depthWrite: false,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = FLOOR_Y;
floor.renderOrder = 1;
scene.add(floor);

const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(0,0,0,0.9)'], [0.5, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']], 256), transparent: true, depthWrite: false, toneMapped: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = FLOOR_Y + 0.005;
shadow.renderOrder = 2;
scene.add(shadow);

const mirrorRoot = new THREE.Group();
mirrorRoot.scale.y = -1;
mirrorRoot.position.y = 2 * FLOOR_Y;
const mirrorPivot = pivot.clone(true);
mirrorRoot.add(mirrorPivot);
if (!isMobile) scene.add(mirrorRoot);
const mirrorPairs = [];
{
  const src = [], dst = [];
  pivot.traverse((o) => src.push(o));
  mirrorPivot.traverse((o) => dst.push(o));
  src.forEach((o, i) => mirrorPairs.push([o, dst[i]]));
}

/* ==========================================================================
   Particles: floating dust that morphs into a dotted globe (GPU)
   ========================================================================== */

const GLOBE_R = 2.35;
const COUNT = isMobile ? 1400 : 3200;
const globeHolder = new THREE.Group();    // faces the camera
const globeSpin = new THREE.Group();      // spins the globe
globeHolder.add(globeSpin);
scene.add(globeHolder);

function toVec(lat, lon, r) {
  const phi = ((90 - lat) * Math.PI) / 180, theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).multiplyScalar(r);
}
function fibonacciSphere(n, filter) {
  const out = [], golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    if (filter) {
      const lat = (Math.asin(y) * 180) / Math.PI;
      let lon = (Math.atan2(z, -x) * 180) / Math.PI - 180;
      if (lon < -180) lon += 360;
      if (!filter(lat, lon)) continue;
    }
    out.push(x, y, z);
  }
  return out;
}
function fillGlobeAttribute(points) {
  const arr = new Float32Array(COUNT * 3), n = points.length / 3;
  for (let i = 0; i < COUNT; i++) {
    const j = Math.floor((i / COUNT) * n) * 3;
    arr[i * 3] = points[j] * GLOBE_R; arr[i * 3 + 1] = points[j + 1] * GLOBE_R; arr[i * 3 + 2] = points[j + 2] * GLOBE_R;
  }
  return arr;
}

const dustPos = new Float32Array(COUNT * 3), rand = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  const r = 2.6 + Math.random() * 8, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
  dustPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
  dustPos[i * 3 + 1] = r * Math.cos(ph) * 0.6 + 0.6;
  dustPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  rand[i] = Math.random();
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
particleGeo.setAttribute('aGlobe', new THREE.BufferAttribute(fillGlobeAttribute(fibonacciSphere(COUNT)), 3));
particleGeo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
const particleMat = new THREE.ShaderMaterial({
  uniforms: {
    uMorph: { value: 0 }, uTime: { value: 0 }, uSize: { value: 30 * DPR },
    uMap: { value: radialTexture([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']], 64) },
    uDust: { value: new THREE.Color(0x8cc4ff) }, uLand: { value: new THREE.Color(0x3aa8ff) },
  },
  vertexShader: `
    attribute vec3 aGlobe; attribute float aRand;
    uniform float uMorph, uTime, uSize;
    varying float vAlpha, vMix;
    void main() {
      float m = smoothstep(aRand * 0.4, aRand * 0.4 + 0.6, uMorph);              // staggered morph
      vec3 drift = vec3(sin(uTime * 0.3 + aRand * 20.0), cos(uTime * 0.25 + aRand * 15.0), sin(uTime * 0.2 + aRand * 9.0)) * 0.1;
      vec3 p = mix(position + drift, aGlobe, m);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * mix(1.0, 0.8, m) / -mv.z;
      float facing = dot(normalize((modelViewMatrix * vec4(aGlobe, 0.0)).xyz), vec3(0.0, 0.0, 1.0));
      vAlpha = mix(0.55, mix(0.12, 1.0, smoothstep(-0.2, 0.25, facing)), m);  // dim the far side of the globe
      vMix = m;
    }`,
  fragmentShader: `
    uniform sampler2D uMap; uniform vec3 uDust, uLand;
    varying float vAlpha, vMix;
    void main() {
      float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
      gl_FragColor = vec4(mix(uDust, uLand, vMix), a);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const particles = new THREE.Points(particleGeo, particleMat);
particles.frustumCulled = false;
globeSpin.add(particles);

// Land outlines: rasterise world-atlas land polygons and keep only land points (falls back to a full sphere)
Promise.all([
  import('https://cdn.jsdelivr.net/npm/d3-geo@3/+esm'),
  import('https://cdn.jsdelivr.net/npm/topojson-client@3/+esm'),
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json').then((r) => r.json()),
]).then(([d3, topojson, world]) => {
  const W = 1024, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const path = d3.geoPath(d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]), ctx);
  ctx.fillStyle = '#fff'; ctx.beginPath(); path(topojson.feature(world, world.objects.land)); ctx.fill();
  const data = ctx.getImageData(0, 0, W, H).data;
  const isLand = (lat, lon) => data[((Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H))) * W + (Math.floor(((lon + 180) / 360) * W) % W)) * 4)] > 128;
  const land = fibonacciSphere(16000, isLand);
  if (land.length > 300) {
    particleGeo.setAttribute('aGlobe', new THREE.BufferAttribute(fillGlobeAttribute(land), 3));
  }
}).catch(() => { /* keep the full-sphere globe */ });

// Region markers and placement arcs from Gqeberha
const markerGroup = new THREE.Group();
globeSpin.add(markerGroup);
const markers = [HQ, ...REGIONS].map((place) => {
  const color = new THREE.Color(place.hq ? 0x48eb12 : 0x00a7fa).multiplyScalar(2.5);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(place.hq ? 0.055 : 0.04, 16, 16), new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true }));
  mesh.position.copy(toVec(place.lat, place.lon, GLOBE_R * 1.01));
  markerGroup.add(mesh);
  const label = document.createElement('div');
  label.className = 'geo-label' + (place.hq ? ' is-hq' : '');
  label.textContent = place.hq ? 'HQ · Gqeberha' : place.name;
  document.getElementById('labels').appendChild(label);
  return { mesh, label };
});
const arcMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0x5cc6ff).multiplyScalar(1.6), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
const arcs = REGIONS.map((to, i) => {
  const a = toVec(HQ.lat, HQ.lon, 1).normalize(), b = toVec(to.lat, to.lon, 1).normalize(), ang = a.angleTo(b);
  const pts = [];
  for (let s = 0; s <= 80; s++) {
    const f = s / 80;
    const v = a.clone().multiplyScalar(Math.sin((1 - f) * ang)).addScaledVector(b, Math.sin(f * ang)).divideScalar(Math.sin(ang));
    pts.push(v.multiplyScalar(GLOBE_R * (1.01 + Math.sin(f * Math.PI) * Math.min(ang * 0.09, 0.18))));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, arcMat);
  markerGroup.add(line);
  return { geo, count: pts.length, offset: i * 0.45 };
});
const GLOBE_FACE = THREE.MathUtils.degToRad(-90 - -20);   // turn the Atlantic toward the camera

/* ==========================================================================
   Post-processing
   ========================================================================== */

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: isMobile ? 0 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.36, 0.45, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(2, 2) }, uCA: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uCA; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float d = length(c);
      vec2 off = c * d * 0.012 * uCA;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= mix(1.0, 0.55, smoothstep(0.35, 0.95, d));
      col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.028;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(finish);

/* ---------- Layout ---------- */

const viewW = () => Math.max(1, innerWidth || document.documentElement.clientWidth || 1);
const viewH = () => Math.max(1, innerHeight || document.documentElement.clientHeight || 1);
let laidOut = { w: 0, h: 0 };
function layout() {
  const w = viewW(), h = viewH();
  laidOut = { w, h };
  renderer.setSize(w, h, false);
  composer.setPixelRatio(DPR);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  finish.uniforms.uRes.value.set(w, h);
}
addEventListener('resize', layout);
layout();

// Place the optical centre at screen position (focus, fy) and fit a sphere of radius `r` in the free space.
// Phones: the 3D sits in the upper part of the screen, above the chapter text.
function frameCamera(focus, r, focusY = 0.5) {
  const w = laidOut.w, h = laidOut.h;
  const narrow = isMobile || w < 900;
  const fx = narrow ? 0.5 : focus, fy = narrow ? 0.33 : focusY;
  const sx = (fx - 0.5) * w, sy = (fy - 0.5) * h;
  const fullW = w + 2 * Math.abs(sx), fullH = h + 2 * Math.abs(sy);
  camera.aspect = fullW / fullH;
  camera.setViewOffset(fullW, fullH, Math.abs(sx) - sx, Math.abs(sy) - sy, w, h);
  camera.updateProjectionMatrix();
  const t = Math.tan((camera.fov * Math.PI) / 360);
  const availW = narrow ? 0.94 : Math.max(1 - 2 * Math.abs(fx - 0.5), 0.35);
  const availH = narrow ? 0.58 : 0.9 - 2 * Math.abs(fy - 0.5);
  const R = Math.max(r, 2.2) * 1.08;                                   // breathing room around the object
  return Math.max(R * fullH / (t * h * availH), R * fullH / (t * w * availW));
}

/* ==========================================================================
   Interaction
   ========================================================================== */

const rot = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, target = { x: 0, y: 0 };
const pointer = new THREE.Vector2(0, 0), pointerSmooth = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
let dragging = false, dragDist = 0, last = { x: 0, y: 0 }, pointerInside = false;
let hovered = null, focused = null;

addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerInside = true;
  if (!dragging && !reduceMotion && e.pointerType !== 'touch') { target.y = pointer.x * 0.35; target.x = -pointer.y * 0.18; }
}, { passive: true });
addEventListener('mouseout', (e) => { if (!e.relatedTarget) pointerInside = false; });

canvas.addEventListener('pointerdown', (e) => {
  dragging = true; dragDist = 0; last.x = e.clientX; last.y = e.clientY;
  canvas.classList.add('is-dragging');
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = (e.clientX - last.x) * 0.008, dy = (e.clientY - last.y) * 0.008;
  dragDist += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y);
  last.x = e.clientX; last.y = e.clientY;
  rot.y += dx; rot.x += dy; vel.y = dx; vel.x = dy;
});
canvas.addEventListener('pointerup', (e) => {
  if (dragging && dragDist < 6) {
    if (e.pointerType === 'touch') { raycaster.setFromCamera(pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera); const hit = raycaster.intersectObjects(pickables, false)[0]; hovered = hit && canPick() ? hit.object.userData.facet : null; }
    if (hovered) openPanel(hovered); else if (focused) closePanel();
  }
  dragging = false;
  canvas.classList.remove('is-dragging');
});
canvas.addEventListener('pointercancel', () => { dragging = false; canvas.classList.remove('is-dragging'); });
canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(focused ? nextFacet(focused) : 'top'); }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && focused) closePanel(); });

/* ---------- Facet panel ---------- */

const panel = document.getElementById('panel');
const panelBody = document.getElementById('panel-body');
const ORDER = ['top', 'left', 'right', 'core'];
const nextFacet = (f) => ORDER[(ORDER.indexOf(f) + 1) % ORDER.length];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function openPanel(facet) {
  const info = FACET_INFO[facet];
  focused = facet;
  panel.style.setProperty('--c', info.color);
  panelBody.innerHTML = `
    <span class="eyebrow">${esc(info.eyebrow)}</span>
    <h3 id="panel-title">${esc(info.title)}</h3>
    <p>${esc(info.intro)}</p>
    <ul>${info.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    ${info.people.length ? `<div class="panel__people">${info.people.map((p) => `
      <div class="person"><img src="${esc(p.photo)}" alt="" width="44" height="44" loading="lazy"><div><b>${esc(p.name)}</b><small>${esc(p.role)}</small></div></div>`).join('')}</div>` : ''}
    <a class="btn btn--primary" href="${esc(info.link.href)}">${esc(info.link.label)}</a>
    <div class="panel__nav">${ORDER.map((f) => `<button type="button" data-goto="${f}" class="${f === facet ? 'is-current' : ''}">${esc(FACET_INFO[f].title)}</button>`).join('')}</div>`;
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
}
function closePanel() {
  focused = null;
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  canvas.focus({ preventScroll: true });
}
document.getElementById('panel-close').addEventListener('click', closePanel);
panelBody.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) openPanel(b.dataset.goto); });

/* ---------- Chapters: navigator, reveal, counters ---------- */

const sections = [...document.querySelectorAll('.chapter')];
const navButtons = [...document.querySelectorAll('.chapters button')];
navButtons.forEach((b) => b.addEventListener('click', () => {
  sections[+b.dataset.chapter].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
}));

const counted = new Set();
function runCounters(section) {
  if (counted.has(section)) return;
  counted.add(section);
  section.querySelectorAll('[data-count]').forEach((el) => {
    const end = +el.dataset.count, start = performance.now();
    (function tick(now) {
      const k = reduceMotion ? 1 : Math.min(1, (now - start) / 1400);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(tick);
    })(start);
  });
}
const io = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (en.isIntersecting) { en.target.classList.add('is-in'); runCounters(en.target); }
  else en.target.classList.remove('is-in');
}), { threshold: 0.35 });
sections.forEach((s) => io.observe(s));

// Continuous chapter position: 0 at the first section … 5 at the last
function chapterPosition() {
  const tops = sections.map((s) => s.offsetTop);
  const y = scrollY;
  for (let i = 0; i < tops.length - 1; i++) {
    if (y < tops[i + 1]) return i + clamp((y - tops[i]) / Math.max(1, tops[i + 1] - tops[i]), 0, 1);
  }
  return tops.length - 1;
}
function chapterState(c) {
  const i = Math.min(CHAPTERS.length - 2, Math.floor(c));
  const f = smoothstep(0.2, 0.8, c - i);                        // hold each chapter, then blend
  const a = CHAPTERS[i], b = CHAPTERS[i + 1], out = {};
  for (const k in a) out[k] = lerp(a[k], b[k], c >= CHAPTERS.length - 1 ? 1 : f);
  return out;
}
const canPick = () => state.scale > 0.6 && state.globe < 0.3;

/* ==========================================================================
   Labels
   ========================================================================== */

const labels = [...document.querySelectorAll('.label')];
const anchors = {
  top: { p: new THREE.Vector3(-0.6, HALF + 0.12, -0.6), n: FACES.top.normal },
  left: { p: new THREE.Vector3(-0.6, -0.6, HALF + 0.12), n: FACES.left.normal },
  right: { p: new THREE.Vector3(HALF + 0.12, -0.6, -0.6), n: FACES.right.normal },
  core: { p: new THREE.Vector3(K + E / 2, K + E / 2, K + E / 2), n: ISO },
};
const labelOffset = { top: [-50, -120], left: [-105, -10], right: [5, -10], core: [12, -125] };

/* ==========================================================================
   Loop
   ========================================================================== */

const clock = new THREE.Clock();
const qYaw = new THREE.Quaternion(), qPitch = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), qTwist = new THREE.Quaternion();
const tmp = new THREE.Vector3(), camDir = new THREE.Vector3();
const state = { ...CHAPTERS[0] };
let explode = 0, intro = reduceMotion ? 1 : 0, started = false, dist = 10;

function frame() {
  requestAnimationFrame(frame);
  if (laidOut.w !== viewW() || laidOut.h !== viewH()) layout();
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (started && intro < 1) intro = Math.min(1, intro + dt / 2.4);

  // ---- Chapter state (smoothed) ----
  const c = chapterPosition();
  const goal = chapterState(c);
  const k = reduceMotion ? 1 : Math.min(1, dt * 4);
  for (const key in goal) state[key] += (goal[key] - state[key]) * k;
  const p = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
  root.style.setProperty('--scroll', clamp(p, 0, 1).toFixed(4));
  navButtons.forEach((b, i) => b.classList.toggle('is-active', Math.round(c) === i));

  const targetExplode = Math.max(state.explode, focused ? 0.55 : 0);
  explode += (targetExplode - explode) * (reduceMotion ? 1 : Math.min(1, dt * 4.5));
  root.style.setProperty('--open', explode.toFixed(3));

  // ---- Hover ----
  if (pointerInside && !dragging && canPick()) {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    hovered = hit ? hit.object.userData.facet : null;
  } else if (!dragging) hovered = null;
  canvas.classList.toggle('is-hovering', !!hovered && !dragging);

  // ---- Rotation ----
  if (!dragging) {
    vel.x = (vel.x + (target.x - rot.x) * 0.04) * 0.88;
    vel.y = (vel.y + (target.y - rot.y) * 0.04) * 0.88;
    rot.x += vel.x; rot.y += vel.y;
  }
  const idle = reduceMotion ? 0 : Math.sin(t * 0.25) * 0.12;
  qYaw.setFromAxisAngle(UP, rot.y + idle + state.yaw);
  qPitch.setFromAxisAngle(RIGHT, rot.x);
  pivot.quaternion.copy(qPitch).multiply(qYaw);
  pivot.scale.setScalar(state.scale);
  model.position.y = reduceMotion ? 0 : Math.sin(t * 0.8) * 0.06;

  // ---- Plates ----
  Object.values(plates).forEach((m) => {
    const u = m.userData, f = FACES[u.facet];
    u.hover += ((hovered === u.facet ? 1 : 0) - u.hover) * Math.min(1, dt * 8);
    u.focus += ((focused === u.facet ? 1 : 0) - u.focus) * Math.min(1, dt * 6);
    const ki = easeOutExpo(clamp((intro - u.index * 0.1) / 0.75, 0, 1));
    m.position.copy(u.base).addScaledVector(f.normal, explode * 1.05 + u.hover * 0.16 + u.focus * 0.45 + (1 - ki) * 7);
    qTwist.setFromAxisAngle(f.normal, (explode * 0.22 + (1 - ki) * 1.6) * (u.index % 2 ? -1 : 1));
    m.quaternion.copy(qTwist).multiply(u.baseQuat);
    const dim = focused && focused !== u.facet ? -0.2 : 0;
    m.material.emissiveIntensity = Math.max(0.05, 0.34 + u.hover * 0.6 + u.focus * 0.9 + explode * 0.08 + dim);
  });

  // ---- Core ----
  const iu = inner.userData;
  iu.hover += ((hovered === 'core' ? 1 : 0) - iu.hover) * Math.min(1, dt * 8);
  iu.focus += ((focused === 'core' ? 1 : 0) - iu.focus) * Math.min(1, dt * 6);
  const kc = easeOutBack(clamp((intro - 0.35) / 0.5, 0, 1));
  inner.scale.setScalar(Math.max(0.0001, kc) * (1 + explode * 0.14 + iu.hover * 0.08 + iu.focus * 0.2));
  inner.position.copy(iu.base).addScaledVector(ISO, explode * 0.5 + iu.focus * 0.35);
  qSpin.setFromAxisAngle(ISO, explode * Math.PI * 2 + (reduceMotion ? 0 : t * 0.35 * Math.max(explode, iu.focus)));
  inner.quaternion.copy(qSpin);
  coreFaces.forEach((m) => { m.material.emissiveIntensity = 0.7 + iu.hover * 0.7 + iu.focus * 0.8 + explode * 0.25; });

  // ---- Floor & reflection fade out while the globe is up ----
  const g = state.globe;
  floor.material.opacity = FLOOR_OPACITY * (1 - g);
  mirrorRoot.visible = g < 0.5;
  if (!isMobile) mirrorPairs.forEach(([s, d]) => { d.position.copy(s.position); d.quaternion.copy(s.quaternion); d.scale.copy(s.scale); });
  const sh = (3.4 + explode * 1.6) * state.scale;
  shadow.scale.set(sh, sh, 1);
  shadow.material.opacity = (0.85 - explode * 0.35) * easeOutExpo(intro) * (1 - g);

  // ---- Camera ----
  const crystalR = (1.85 + 0.95 * explode) * state.scale;
  const fitDist = frameCamera(state.focus, Math.max(crystalR, GLOBE_R * 1.12 * g, 1.6), state.fy);
  dist += (fitDist - dist) * (reduceMotion ? 1 : Math.min(1, dt * 3));
  pointerSmooth.lerp(pointer, Math.min(1, dt * 3));
  camera.position.copy(ISO).multiplyScalar(dist * (1.25 - 0.25 * easeOutExpo(intro)))
    .addScaledVector(RIGHT, reduceMotion ? 0 : pointerSmooth.x * 0.45)
    .addScaledVector(SCREEN_UP, reduceMotion ? 0 : pointerSmooth.y * 0.3);
  camera.lookAt(0, -0.05, 0);

  // ---- Backdrop ----
  backdrop.position.copy(ISO).multiplyScalar(-3.2);
  backdrop.quaternion.copy(camera.quaternion);
  if (!reduceMotion) {
    strips.forEach((s, i) => { s.position.x = s.userData.x + Math.sin(t * 0.2 + i * 1.9) * 0.4; });
    ring.rotation.z = t * 0.04;
  }
  strips.forEach((s) => { s.scale.y = Math.max(0.0001, 1 - smoothstep(0, 0.5, state.globe)); });   // strips fold away for the globe
  ring.scale.setScalar(1 + explode * 0.12 + g * 0.05);
  ringMat.opacity = 1 - g * 0.6;

  // ---- Globe ----
  globeHolder.quaternion.copy(camera.quaternion);
  globeSpin.rotation.y = GLOBE_FACE + (reduceMotion ? 0 : t * 0.06);
  globeSpin.rotation.x = 0.3;
  particleMat.uniforms.uMorph.value = g;
  particleMat.uniforms.uTime.value = t;
  markerGroup.visible = g > 0.02;
  markers.forEach((m, i) => {
    const pulse = reduceMotion ? 1 : 1 + Math.sin(t * 3 + i) * 0.25;
    m.mesh.scale.setScalar(Math.max(0.0001, smoothstep(0.5, 1, g)) * pulse);
  });
  arcMat.opacity = smoothstep(0.6, 1, g) * 0.9;
  arcs.forEach((a) => {
    const cyc = reduceMotion ? 1 : ((t * 0.3 + a.offset) % 2) / 2;
    const drawn = cyc < 0.5 ? cyc / 0.5 : 1;
    const cut = cyc > 0.8 ? (cyc - 0.8) / 0.2 : 0;
    const from = Math.floor(cut * (a.count - 1)), to = Math.max(from + 1, Math.floor(drawn * (a.count - 1)));
    a.geo.setDrawRange(from, to - from + 1);
  });

  // ---- Cursor light ----
  cursorLight.position.copy(ISO).multiplyScalar(3.2).addScaledVector(RIGHT, pointerSmooth.x * 3).addScaledVector(SCREEN_UP, pointerSmooth.y * 2.2);

  // ---- Render ----
  finish.uniforms.uTime.value = t;
  finish.uniforms.uCA.value = 0.8 + explode * 0.8;
  composer.render(dt);

  // ---- HTML labels ----
  pivot.updateMatrixWorld();
  const W = laidOut.w, H = laidOut.h;
  const showFacets = state.labels > 0.5 && intro >= 1 && !focused;
  labels.forEach((el) => {
    const f = el.dataset.facet, a = anchors[f];
    tmp.copy(a.p).addScaledVector(a.n, f === 'core' ? explode * 0.5 : explode * 1.05);
    model.localToWorld(tmp);
    tmp.project(camera);
    const x = clamp((tmp.x * 0.5 + 0.5) * W, 230, W - 230), y = clamp((-tmp.y * 0.5 + 0.5) * H, 150, H - 110);
    const [ox, oy] = labelOffset[f];
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(${ox}%, ${oy}%)`;
    el.classList.toggle('is-visible', canPick() && (showFacets || (hovered === f && !focused)));
  });
  camera.getWorldDirection(camDir);
  globeSpin.updateMatrixWorld();
  markers.forEach((m) => {
    m.mesh.getWorldPosition(tmp);
    const facing = tmp.clone().normalize().dot(camDir) < -0.1;
    tmp.project(camera);
    const x = Math.min((tmp.x * 0.5 + 0.5) * W + 10, W - m.label.offsetWidth - 40), y = (-tmp.y * 0.5 + 0.5) * H - 26;   // keep on screen
    m.label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    m.label.classList.toggle('is-visible', g > 0.85 && facing);
  });
}

/* ---------- Small public API (handy for future features and testing) ---------- */
window.trihedron = {
  openFacet: (f) => openPanel(f),          // 'top' | 'left' | 'right' | 'core'
  closeFacet: () => closePanel(),
  goToChapter: (i) => sections[i] && sections[i].scrollIntoView({ behavior: 'smooth' }),
};

/* ---------- Start: compile shaders first so the intro is smooth ---------- */

(async () => {
  try {
    if (renderer.compileAsync) await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 3000))]);
  } catch (_) { /* compile on first frame instead */ }
  frame();
  setTimeout(() => { root.classList.add('is-loaded'); started = true; }, 60);
})();

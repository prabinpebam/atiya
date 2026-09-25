// Render the character-selector portraits from the built character GLBs.
//
// Serves the repo on a local port, opens a headless Chromium page that loads each GLB with three.js
// (idle pose, soft key + fill light, transparent background), and saves a head-and-shoulders
// portrait as public/avatars/<id>.webp. Run after `npm run build:character`:
//   npm run build:portraits

import { createServer } from 'node:http';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const SIZE = 256;
const CHARACTERS = [
  { id: 'skater', glb: '/public/models/character.glb' },
  { id: 'sunny', glb: '/public/models/character-female.glb' },
];
const TYPES = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' };

const page = `<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.setClearColor(0x000000, 0);
window.portrait = async (url) => {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x8a9c7a, 2.1));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
  key.position.set(1.5, 5, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.7);
  fill.position.set(-4, 2, 5);
  scene.add(fill);
  const model = gltf.scene;
  // a three-quarter turn, so the face reads and a ponytail shows past the head
  model.rotation.y = -0.75;
  scene.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const idle = gltf.animations.find((a) => a.name === 'idle');
  if (idle) mixer.clipAction(idle).play();
  mixer.setTime(0.2);
  model.traverse((o) => { if (o.isMesh) { o.material.roughness = 0.85; o.material.metalness = 0; } });
  // frame the head and shoulders round the posed head bone (the head's centre is ~0.5 above it)
  model.updateMatrixWorld(true);
  const head = model.getObjectByName('Head').getWorldPosition(new THREE.Vector3());
  const aim = head.clone().add(new THREE.Vector3(-0.08, 0.3, 0));
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  camera.position.copy(aim).add(new THREE.Vector3(0.2, 0.25, 4.25));
  camera.lookAt(aim);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/webp', 0.92);
};
window.ready = true;
</script></body></html>`;

const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(page);
    return;
  }
  const file = normalize(join(ROOT, url));
  try {
    if (!file.startsWith(ROOT) || !statSync(file).isFile()) throw new Error('no');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
try {
  const p = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  p.on('pageerror', (e) => console.error('page error:', e.message));
  await p.goto(base + '/');
  await p.waitForFunction(() => window.ready === true);
  mkdirSync(join(ROOT, 'public', 'avatars'), { recursive: true });
  for (const c of CHARACTERS) {
    const data = await p.evaluate((u) => window.portrait(u), c.glb);
    const out = join(ROOT, 'public', 'avatars', `${c.id}.webp`);
    writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`wrote ${out} (${(statSync(out).size / 1024).toFixed(1)} KB)`);
  }
} finally {
  await browser.close();
  server.close();
}

import './style.css';
import * as THREE from 'three/webgpu';
import { loadFonts } from './pages/fonts.js';
import { createTable } from './scene/table.js';
import { createPipeline } from './scene/postfx.js';
import { CameraRig } from './scene/cameraRig.js';
import { Book } from './book/book.js';
import { spreads } from './content/index.js';
import { Interaction } from './interaction.js';
import { createNavbar } from './ui/navbar.js';

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

await Promise.all([renderer.init(), loadFonts()]);
console.info(`Rendering with ${renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2'}`);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / Math.max(1, window.innerHeight) || 1.5, 0.1, 100);
createTable(scene);
const rig = new CameraRig(camera, renderer.domElement);
const pipeline = createPipeline(renderer, scene, camera);

let navbar;
const book = new Book({
  spreads,
  renderer,
  scene,
  camera,
  onChange: (i) => navbar?.update(i),
});
scene.add(book.group);
navbar = createNavbar({ spreads, book, onReset: () => rig.reset() });
navbar.update(book.target);
new Interaction({ dom: renderer.domElement, camera, controls: rig.controls, book });

window.addEventListener('resize', () => {
  if (!window.innerWidth || !window.innerHeight) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize(camera.aspect);
});

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  rig.update(dt);
  book.update(dt, now / 1000);
  pipeline.render();
});

document.getElementById('loading').classList.add('done');
const params = new URLSearchParams(location.search);
const start = params.has('page') ? Number(params.get('page')) : 0;
setTimeout(() => book.goTo(start), 900);

// Debug handle for the console.
window.__book = book;
window.__rig = rig;
window.__render = () => pipeline.render();

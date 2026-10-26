import * as THREE from 'three/webgpu';
import { color, mix, screenUV } from 'three/tsl';

const flat = (c) => new THREE.MeshLambertNodeMaterial({ color: c, flatShading: true });

// A low-poly wooden table in a warm, dim room, with a mug and a pencil for company.
export function createTable(scene) {
  scene.backgroundNode = mix(color('#1c1614'), color('#3a2d27'), screenUV.y.oneMinus());
  scene.fog = new THREE.Fog('#2a211d', 16, 34);

  const table = new THREE.Group();
  const woods = ['#a8703f', '#b27a47', '#9d6838', '#ad7643'];
  const plankW = 1.7;
  for (let i = 0; i < 14; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(plankW - 0.03, 0.5, 18), flat(woods[i % woods.length]));
    plank.position.set(-11.9 + i * plankW, -0.25, 0);
    plank.receiveShadow = true;
    table.add(plank);
  }
  scene.add(table);

  const mug = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.2, 12, 1, true), flat('#2f6f73'));
  body.material.side = THREE.DoubleSide;
  body.position.y = 0.6;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), flat('#2f6f73'));
  base.position.y = 0.03;
  const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 12), flat('#4a2c1d'));
  coffee.position.y = 1.0;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 10, Math.PI * 1.2), flat('#2f6f73'));
  handle.position.set(0.58, 0.6, 0);
  handle.rotation.z = -Math.PI * 0.6;
  mug.add(body, base, coffee, handle);
  mug.position.set(-6.4, 0, -1.6);
  mug.rotation.y = 0.6;
  scene.add(mug);

  const pencil = new THREE.Group();
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 6), flat('#e9b949'));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 6), flat('#e8cfa2'));
  tip.position.y = 1.76;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), flat('#333333'));
  lead.position.y = 1.97;
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.3, 6), flat('#d9776b'));
  eraser.position.y = -1.75;
  pencil.add(wood, tip, lead, eraser);
  pencil.rotation.set(Math.PI / 2, 0, -0.5);
  pencil.position.set(5.9, 0.09, 1.6);
  scene.add(pencil);

  for (const o of [mug, pencil]) o.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));

  // A dimmer sky fill and a stronger key light, so soft cast shadows read clearly.
  const hemi = new THREE.HemisphereLight('#fff1dc', '#5a4030', 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d6', 3.4);
  sun.position.set(-7, 9, 4.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -9;
  sc.right = 9;
  sc.top = 7;
  sc.bottom = -7;
  sc.near = 2;
  sc.far = 30;
  // VSM: blurred shadow map for wide, soft penumbras.
  sun.shadow.radius = 14;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#cfe0ff', 0.35);
  fill.position.set(6, 5, -4);
  scene.add(fill);
}

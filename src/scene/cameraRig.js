import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const TARGET = new THREE.Vector3(0, 0.2, 0.35);
const DIR = new THREE.Vector3(0, 0.8, 0.6).normalize();

// Orbit controls with gentle limits, plus an animated "reset view".
export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    const c = (this.controls = new OrbitControls(camera, dom));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.rotateSpeed = 0.55;
    c.zoomSpeed = 0.6;
    c.minPolarAngle = 0.12;
    c.maxPolarAngle = 1.1;
    c.minAzimuthAngle = -0.8;
    c.maxAzimuthAngle = 0.8;
    c.target.copy(TARGET);
    this.tween = null;
    this.resize(camera.aspect);
    camera.position.copy(this.home);
    c.update();
  }

  resize(aspect) {
    const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1.5;
    const d = 11.4 * THREE.MathUtils.clamp(1.55 / a, 1, 2.3);
    this.home = TARGET.clone().addScaledVector(DIR, d);
    this.controls.minDistance = d * 0.62;
    this.controls.maxDistance = d * 1.25;
    if (!Number.isFinite(this.camera.position.x)) this.camera.position.copy(this.home);
  }

  reset() {
    this.tween = { t: 0, from: this.camera.position.clone(), fromTarget: this.controls.target.clone() };
  }

  update(dt) {
    const tw = this.tween;
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / 0.9);
      const e = 1 - Math.pow(1 - tw.t, 3);
      this.controls.target.lerpVectors(tw.fromTarget, TARGET, e);
      this.camera.position.lerpVectors(tw.from, this.home, e);
      if (tw.t >= 1) this.tween = null;
    }
    this.controls.update(dt);
  }
}

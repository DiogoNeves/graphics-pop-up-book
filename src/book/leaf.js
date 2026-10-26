import * as THREE from 'three/webgpu';

// A page leaf hinged at the spine (local origin). It lies along +x and spans z in
// [-height/2, height/2], top edge at -z. At angle 0 the front faces up (a right page);
// at angle PI the back faces up (a left page). Materials: [front, back].
export class Leaf {
  constructor(width, height, materials, { segX = 1, segZ = 1, bend = 0 } = {}) {
    Object.assign(this, { width, height, segX, segZ, bend });
    const cols = segX + 1;
    const rows = segZ + 1;
    const n = cols * rows;
    Object.assign(this, { cols, rows, n });

    this.pos = new Float32Array(n * 6);
    const uv = new Float32Array(n * 4);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const u = i / segX;
        const v = 1 - j / segZ;
        uv.set([u, v], k * 2);
        uv.set([1 - u, v], (n + k) * 2); // the back reads left-to-right once the leaf has turned
      }
    }

    const index = [];
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < segZ; j++) {
        for (let i = 0; i < segX; i++) {
          const a = pass * n + j * cols + i;
          const b = a + 1;
          const c = a + cols;
          const d = c + 1;
          if (pass === 0) index.push(a, c, b, b, c, d);
          else index.push(a, b, c, b, d, c);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(index);
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const half = segX * segZ * 6;
    geometry.addGroup(0, half, 0);
    geometry.addGroup(half, half, 1);
    this.geometry = geometry;

    this.mesh = new THREE.Mesh(geometry, materials);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.angle = null;
    this.setAngle(0, 1);
  }

  // Local angle of the page at fraction s of its width. The outer edge leads the motion
  // (dir = 1 turning right-to-left, -1 back), and the bottom corner leads a little more.
  phiAt(theta, dir, s, zt) {
    return theta + this.bend * Math.sin(theta) * dir * (0.75 + 0.5 * zt) * s * s;
  }

  setAngle(theta, dir = 1) {
    if (theta === this.angle && dir === this.dir) return;
    this.angle = theta;
    this.dir = dir;
    const { segX, cols, rows, n, width, height, pos } = this;
    const ds = width / segX;
    for (let j = 0; j < rows; j++) {
      const zt = j / (rows - 1);
      const z = -height / 2 + zt * height;
      let x = 0;
      let y = 0;
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        pos[k * 3] = pos[(n + k) * 3] = x;
        pos[k * 3 + 1] = pos[(n + k) * 3 + 1] = y;
        pos[k * 3 + 2] = pos[(n + k) * 3 + 2] = z;
        const phi = this.phiAt(theta, dir, (i + 0.5) / segX, zt);
        x += Math.cos(phi) * ds;
        y += Math.sin(phi) * ds;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }

  // Position and slope of the page's middle line at fraction s across its width.
  frameAt(s) {
    const steps = 24;
    const ds = (this.width * s) / steps;
    let x = 0;
    let y = 0;
    let phi = this.angle;
    for (let i = 0; i < steps; i++) {
      phi = this.phiAt(this.angle, this.dir, ((i + 0.5) / steps) * s, 0.5);
      x += Math.cos(phi) * ds;
      y += Math.sin(phi) * ds;
    }
    return { x, y, phi };
  }
}

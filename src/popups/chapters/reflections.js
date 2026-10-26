import * as THREE from 'three/webgpu';
import { cubeTexture, reflectVector, uv, texture, mix, vec3, float, normalView, positionViewDirection, clamp } from 'three/tsl';
import { flat, palette, labelCard, button, smooth, FONT } from '../kit.js';

// Reflections with environment mapping: a mirror ball reflects the world through a cube map
// that a CubeCamera re-renders every frame. Shapes orbit the ball; in front of it the same
// cube map lies unfolded on the page as a paper "cross" of six faces.

// Layout (pop-up local coordinates).
const BALL_Z = -0.82; // centre of the pedestal / orbit on the page
const BALL_R = 0.55;
const PED_H = 0.42;
const CUP_H = 0.08;
const BALL_Y = PED_H + CUP_H + 0.5; // sphere centre height (sits slightly sunk in the cup)

const ORBIT_R = 1.05; // initial orbit radius
const R_MIN = 0.85; // keep shapes clear of the ball
const E_A = 1.45; // outer elliptical bound, x semi-axis
const E_B = 1.08; // outer elliptical bound, z semi-axis
const SEP = 0.5; // minimum distance between shapes
const OMEGA = 0.35; // orbit speed (rad/s)

// Unfolded cube cross.
const CARD = 0.38;
const GAP = 0.03;
const PITCH = CARD + GAP;
const THICK = 0.03;
const NET_X = -0.95; // centre card (−Z) position
const NET_Z = 1.26;

// Each face: outward direction F, and the "right" R / "up" U directions seen from inside the
// cube while facing away from the reader (−Z). Adjacent cards in the cross share edges.
const FACES = {
  nz: { label: '−Z', F: [0, 0, -1], R: [1, 0, 0], U: [0, 1, 0] },
  px: { label: '+X', F: [1, 0, 0], R: [0, 0, 1], U: [0, 1, 0] },
  pz: { label: '+Z', F: [0, 0, 1], R: [-1, 0, 0], U: [0, 1, 0] },
  nx: { label: '−X', F: [-1, 0, 0], R: [0, 0, -1], U: [0, 1, 0] },
  py: { label: '+Y', F: [0, 1, 0], R: [1, 0, 0], U: [0, 0, 1] },
  ny: { label: '−Y', F: [0, -1, 0], R: [1, 0, 0], U: [0, 0, -1] },
};

// Small corner tag ("+X") drawn on a transparent canvas, overlaid on a face card.
function faceLabelTexture(text) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.beginPath();
  if (typeof g.roundRect === 'function') g.roundRect(5, 5, 60, 40, 9);
  else g.rect(5, 5, 60, 40);
  g.fillStyle = palette.cream;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = palette.ink;
  g.stroke();
  g.fillStyle = palette.ink;
  g.font = `700 30px ${FONT.title}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 35, 26);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export default function create(ctx) {
  const group = new THREE.Group();

  // ---- cube map + camera ----
  const cubeRT = new THREE.CubeRenderTarget(128, {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  // Not parented: it follows the ball's world position but stays world-aligned, matching
  // the world-space reflection vector used by the materials.
  const cubeCam = new THREE.CubeCamera(0.05, 40, cubeRT);

  // ---- pedestal ----
  const pedestal = new THREE.Group();
  pedestal.position.set(0, 0, BALL_Z);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, PED_H, 10), flat(palette.navy));
  column.position.y = PED_H / 2;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, CUP_H, 10), flat(palette.orange));
  cup.position.y = PED_H + CUP_H / 2;
  pedestal.add(column, cup);
  group.add(ctx.fold.rise(pedestal, { start: 0.05, end: 0.42 }));

  // ---- mirror ball ----
  const env = cubeTexture(cubeRT.texture, reflectVector).rgb;
  const fresnel = float(1).sub(clamp(normalView.dot(positionViewDirection), 0, 1)).pow(3);
  const chrome = new THREE.MeshBasicNodeMaterial();
  chrome.colorNode = env.mul(vec3(0.88, 0.92, 0.98)).add(fresnel.mul(0.2));
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), chrome);
  const sphereGroup = new THREE.Group();
  sphereGroup.position.set(0, PED_H + CUP_H, BALL_Z);
  sphere.position.y = BALL_Y - (PED_H + CUP_H);
  sphereGroup.add(sphere);
  group.add(ctx.fold.rise(sphereGroup, { start: 0.18, end: 0.55 }));

  // ---- orbiting shapes ----
  const shapeDefs = [
    { geo: new THREE.BoxGeometry(0.34, 0.34, 0.34), color: palette.red, h: 0.95, half: 0.29, tilt: [0.6, 0, 0.62] },
    { geo: new THREE.ConeGeometry(0.24, 0.46, 8), color: palette.yellow, h: 1.1, half: 0.23, tilt: [0, 0, 0] },
    { geo: new THREE.TorusGeometry(0.17, 0.07, 8, 18), color: palette.teal, h: 1.0, half: 0.24, tilt: [0, 0, 0] },
    { geo: new THREE.OctahedronGeometry(0.26, 0), color: palette.purple, h: 1.2, half: 0.26, tilt: [0, 0.4, 0] },
  ];
  const postGeo = new THREE.BoxGeometry(0.05, 1, 0.05);
  const postMat = flat(palette.grey);
  const baseGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.025, 12);

  const orbs = shapeDefs.map((def, i) => {
    const mat = flat(def.color);
    const g = new THREE.Group();
    const base = new THREE.Mesh(baseGeo, mat);
    base.position.y = 0.0125;
    const postTop = Math.max(0.1, def.h - def.half * 0.6);
    const post = new THREE.Mesh(postGeo, postMat);
    post.scale.y = postTop;
    post.position.y = postTop / 2;
    const holder = new THREE.Group();
    holder.position.y = def.h;
    const shape = new THREE.Mesh(def.geo, mat);
    shape.rotation.set(def.tilt[0], def.tilt[1], def.tilt[2]);
    holder.add(shape);
    g.add(base, post, holder);

    const a = i * (Math.PI / 2) + 0.5;
    const o = {
      group: g,
      holder,
      h: def.h,
      x: ORBIT_R * Math.cos(a),
      z: BALL_Z + ORBIT_R * Math.sin(a),
      spin: 0.5 + 0.15 * i,
      dragging: false,
      hover: false,
      lift: 0,
      hl: 0,
      gx: 0,
      gz: 0,
    };
    g.position.set(o.x, 0, o.z);
    group.add(ctx.fold.rise(g, { start: 0.3 + 0.06 * i, end: 0.62 + 0.06 * i }));

    ctx.interactive(g, {
      cursor: 'grab',
      onDown(hit, ray) {
        const p = ctx.pagePoint(ray, o.h);
        if (!p) return false;
        o.gx = o.x - p.x;
        o.gz = o.z - p.z;
        o.dragging = true;
        return true;
      },
      onDrag(ray) {
        const p = ctx.pagePoint(ray, o.h);
        if (!p) return;
        o.x = p.x + o.gx;
        o.z = p.z + o.gz;
        clampPos(o);
      },
      onUp() {
        o.dragging = false;
      },
      onHover(hit) {
        o.hover = !!hit;
      },
    });
    return o;
  });

  // Keep a shape inside the ring between the ball and the page edges.
  function clampPos(o) {
    let dx = o.x;
    let dz = o.z - BALL_Z;
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
      dx = ORBIT_R;
      dz = 0;
    }
    const r = Math.hypot(dx, dz);
    if (r < R_MIN) {
      if (r < 1e-5) {
        dx = R_MIN;
        dz = 0;
      } else {
        dx *= R_MIN / r;
        dz *= R_MIN / r;
      }
    }
    const e = (dx / E_A) * (dx / E_A) + (dz / E_B) * (dz / E_B);
    if (e > 1) {
      const s = 1 / Math.sqrt(e);
      dx *= s;
      dz *= s;
    }
    o.x = dx;
    o.z = BALL_Z + dz;
  }

  // ---- unfolded cube map cross ----
  const cardGeo = new THREE.BoxGeometry(CARD, THICK, CARD);
  const cardMat = flat(palette.cream);
  const imageGeo = new THREE.PlaneGeometry(CARD - 0.03, CARD - 0.03).rotateX(-Math.PI / 2); // uv: u → +x, v → −z
  const images = [];

  function faceMaterial(face) {
    const st = uv().mul(2).sub(1);
    const dir = vec3(...face.F).add(vec3(...face.R).mul(st.x)).add(vec3(...face.U).mul(st.y));
    const col = cubeTexture(cubeRT.texture, dir).rgb;
    const tag = texture(faceLabelTexture(face.label), uv());
    const m = new THREE.MeshBasicNodeMaterial();
    m.colorNode = mix(col, tag.rgb, tag.a);
    return m;
  }

  // A card lying flat with its top surface at its parent's origin; the image on top.
  function makeCard(face) {
    const mesh = new THREE.Mesh(cardGeo, cardMat);
    mesh.position.y = -THICK / 2;
    const image = new THREE.Mesh(imageGeo, faceMaterial(face));
    image.position.y = THICK / 2 + 0.003;
    image.userData.noShadow = true;
    mesh.add(image);
    images.push(image);
    return mesh;
  }

  const netRoot = new THREE.Group();
  netRoot.position.set(NET_X, THICK + 0.002, NET_Z);
  netRoot.add(makeCard(FACES.nz));
  group.add(ctx.fold.rise(netRoot, { start: 0.42, end: 0.56 }));

  // A flap hinged on its parent's edge (at the top surface). Folded (t = 0) it lies face-down
  // on its neighbour and is hidden; it flips open over its window. Windows of flaps that fold
  // onto the same card never overlap, so folded cards never z-fight.
  function addFlap(parent, face, { pivot: pp, offset, axis, from, start, end }) {
    const pivot = new THREE.Group();
    pivot.position.set(pp[0], 0, pp[1]);
    const card = makeCard(face);
    card.position.x = offset[0];
    card.position.z = offset[1];
    pivot.add(card);
    pivot.visible = false;
    pivot.rotation[axis] = from;
    parent.add(pivot);
    ctx.fold.custom(
      (e, t) => {
        pivot.rotation[axis] = from * (1 - smooth(t));
        pivot.visible = t > 0;
      },
      { start, end },
    );
    return pivot;
  }

  const half = PITCH / 2;
  addFlap(netRoot, FACES.nx, { pivot: [-half, 0], offset: [-half, 0], axis: 'z', from: -Math.PI, start: 0.56, end: 0.64 });
  const pxFlap = addFlap(netRoot, FACES.px, { pivot: [half, 0], offset: [half, 0], axis: 'z', from: Math.PI, start: 0.64, end: 0.72 });
  addFlap(pxFlap, FACES.pz, { pivot: [PITCH, 0], offset: [half, 0], axis: 'z', from: Math.PI, start: 0.72, end: 0.8 });
  addFlap(netRoot, FACES.py, { pivot: [0, -half], offset: [0, -half], axis: 'x', from: Math.PI, start: 0.78, end: 0.86 });
  addFlap(netRoot, FACES.ny, { pivot: [0, half], offset: [0, half], axis: 'x', from: -Math.PI, start: 0.86, end: 0.94 });

  const caption = labelCard('cube map', { w: 0.74, h: 0.24, color: palette.cream, px: 96, font: `italic 500 58px ${FONT.body}` });
  caption.position.set(NET_X + 1.5 * PITCH, 0.0125, NET_Z - PITCH);
  group.add(ctx.fold.rise(caption, { start: 0.86, end: 1 }));

  // ---- orbit toggle ----
  let orbiting = true;
  let speed = OMEGA;
  const toggle = button(ctx, {
    labels: ['Orbit: on', 'Orbit: off'],
    position: [1.12, 0, 1.3],
    w: 1.15,
    h: 0.34,
    color: palette.orange,
    onChange(i) {
      orbiting = i === 0;
    },
  });
  group.add(toggle.mesh);

  // ---- cube map capture ----
  let shadowLights = null;
  let savedAuto = [];
  let captureFailed = false;

  function capture() {
    if (captureFailed) return;
    if (!shadowLights) {
      shadowLights = [];
      ctx.scene.traverse((o) => {
        if (o.isLight && o.castShadow && o.shadow) shadowLights.push(o);
      });
      savedAuto = shadowLights.map(() => true);
    }
    sphere.getWorldPosition(cubeCam.position);
    // Reuse the shadow maps from the main render instead of re-rendering them per face.
    for (let i = 0; i < shadowLights.length; i++) {
      savedAuto[i] = shadowLights[i].shadow.autoUpdate;
      shadowLights[i].shadow.autoUpdate = false;
    }
    // Hide everything that samples the cube map while rendering into it.
    sphere.visible = false;
    for (let i = 0; i < images.length; i++) images[i].visible = false;
    try {
      cubeCam.update(ctx.renderer, ctx.scene);
    } catch (err) {
      captureFailed = true;
      console.warn('reflections: cube map capture failed', err);
    } finally {
      sphere.visible = true;
      for (let i = 0; i < images.length; i++) images[i].visible = true;
      for (let i = 0; i < shadowLights.length; i++) shadowLights[i].shadow.autoUpdate = savedAuto[i];
      ctx.renderer.setRenderTarget(null);
    }
  }

  return {
    group,
    hint: 'Drag the shapes around the mirror ball',
    update(dt) {
      const step = Math.min(Math.max(dt || 0, 0), 0.1);
      speed += ((orbiting ? OMEGA : 0) - speed) * Math.min(1, step * 3);
      const phi = speed * step;
      const cs = Math.cos(phi);
      const sn = Math.sin(phi);

      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        if (o.dragging || phi === 0) continue;
        const dx = o.x;
        const dz = o.z - BALL_Z;
        o.x = dx * cs + dz * sn;
        o.z = BALL_Z - dx * sn + dz * cs;
      }

      // Gently push overlapping shapes apart (the dragged one stays under the pointer).
      const k = Math.min(1, step * 6);
      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const a = orbs[i];
          const b = orbs[j];
          let dx = b.x - a.x;
          let dz = b.z - a.z;
          let d = Math.hypot(dx, dz);
          if (d >= SEP) continue;
          if (d < 1e-5) {
            dx = 1;
            dz = 0;
            d = 1;
          }
          const push = (SEP - Math.min(d, SEP)) * k;
          const nx = dx / d;
          const nz = dz / d;
          if (a.dragging && b.dragging) continue;
          if (a.dragging) {
            b.x += nx * push;
            b.z += nz * push;
          } else if (b.dragging) {
            a.x -= nx * push;
            a.z -= nz * push;
          } else {
            a.x -= nx * push * 0.5;
            a.z -= nz * push * 0.5;
            b.x += nx * push * 0.5;
            b.z += nz * push * 0.5;
          }
        }
      }

      const ke = Math.min(1, step * 10);
      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        clampPos(o);
        o.lift += ((o.dragging ? 0.07 : 0) - o.lift) * ke;
        o.hl += ((o.dragging || o.hover ? 1 : 0) - o.hl) * ke;
        o.group.position.set(o.x, o.lift, o.z);
        o.holder.rotation.y += step * o.spin;
        o.holder.scale.setScalar(1 + 0.1 * o.hl);
      }

      if (sphereGroup.visible || netRoot.visible) capture();
    },
  };
}

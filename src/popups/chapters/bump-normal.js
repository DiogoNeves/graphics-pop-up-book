import * as THREE from 'three/webgpu';
import { flat, unlit, palette, FONT, clamp01, smooth, labelCard, button } from '../kit.js';

// Bump & normal mapping: a square tile that is really just two flat triangles, made to look
// like bevelled bricks with rivets by a procedurally generated tangent-space normal map.
// A paper sun on a stick carries a small point light, so the fake bumps catch the light as
// the reader drags it around. Buttons fade the normal map out and turn the tile edge-on to
// show that its silhouette is perfectly flat.

const TILE = 1.85; // tile edge length (a square card)
const TILE_TH = 0.03; // tile thickness
const GAP = 0.03; // clearance between the tile and the frame opening
const OPEN = TILE + 2 * GAP;
const BAR = 0.12; // frame bar width (sides and top)
const FOOT = 0.28; // the bottom bar is wider and carries a caption
const FRAME_W = OPEN + 2 * BAR;
const FRAME_H = FOOT + OPEN + BAR;
const TH = 0.04; // frame card thickness
const LEAN = -0.61; // ~35° back from vertical
const HINGE_Z = -0.32; // folded flat (backwards) the frame reaches z = HINGE_Z - FRAME_H ≈ -2.63
const TILE_CY = FOOT + OPEN / 2; // tile centre, along the frame

const SUN_Y = 1.05; // height of the sun's disc
const SUN_R = 0.2;
const RAY_R = 0.36;
const SUN_TILT = -0.55; // the sun's face leans back towards the reader's eye
const SUN_XMAX = 1.42;
const SUN_ZMIN = 0.15;
const SUN_ZMAX = 1.3;
const LIGHT_I = 12;
const LIGHT_COLOR = '#ffdca0';
const TILE_COLOR = '#a2978a';

// Height field (bricks with mortar grooves, plus a few rivets) → finite-difference normals →
// RGB-encoded tangent-space normal map on a canvas.
function makeNormalMap(N = 512) {
  const ROWS = 5;
  const RH = N / ROWS; // brick row height in px
  const BW = N / 2; // brick width in px (two bricks per row, running bond)
  const MORTAR = 7; // half-width of the mortar groove
  const BEVEL = 16; // width of the bevelled brick edge
  const BRICK = 10; // brick height (in px units, so slopes are px/px)
  const RIVET_R = 24;
  const RIVET_H = 14;
  const rivets = [
    [BW * 0.5, RH * 0.5],
    [BW * 1.5, RH * 0.5],
    [BW, RH * 1.5],
    [BW, RH * 3.5],
    [BW * 0.5, RH * 4.5],
    [BW * 1.5, RH * 4.5],
  ];
  const hash = (a, b) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const row = Math.floor(y / RH);
    const ly = y + 0.5 - row * RH;
    const off = row % 2 ? BW / 2 : 0;
    for (let x = 0; x < N; x++) {
      const xx = x + 0.5 + off;
      const bi = Math.floor(xx / BW);
      const lx = xx - bi * BW;
      const d = Math.min(lx, BW - lx, ly, RH - ly) - MORTAR;
      let v = 0;
      if (d > 0) {
        // Bevelled brick with a slight random tilt so each brick catches the light differently.
        const s = smooth(Math.min(1, d / BEVEL));
        const tx = (hash(row, bi) - 0.5) * 0.07;
        const ty = (hash(bi + 7, row + 3) - 0.5) * 0.12;
        v = s * (BRICK + tx * (lx - BW / 2) + ty * (ly - RH / 2));
      }
      h[y * N + x] = v;
    }
  }
  for (const [cx, cy] of rivets) {
    const x0 = Math.max(0, Math.floor(cx - RIVET_R));
    const x1 = Math.min(N - 1, Math.ceil(cx + RIVET_R));
    const y0 = Math.max(0, Math.floor(cy - RIVET_R));
    const y1 = Math.min(N - 1, Math.ceil(cy + RIVET_R));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const r2 = (dx * dx + dy * dy) / (RIVET_R * RIVET_R);
        if (r2 < 1) h[y * N + x] += RIVET_H * Math.sqrt(1 - r2);
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const g = canvas.getContext('2d');
  const img = g.createImageData(N, N);
  const px = img.data;
  // Canvas rows run downwards while texture v runs upwards (flipY), so for a height field
  // h(x, y) the tangent-space normal is normalize(-dh/dx, +dh/dy, 1).
  for (let y = 0; y < N; y++) {
    const yu = (y > 0 ? y - 1 : y) * N;
    const yd = (y < N - 1 ? y + 1 : y) * N;
    for (let x = 0; x < N; x++) {
      const xl = x > 0 ? x - 1 : x;
      const xr = x < N - 1 ? x + 1 : x;
      const nx = -(h[y * N + xr] - h[y * N + xl]) * 0.5;
      const ny = (h[yd + x] - h[yu + x]) * 0.5;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * N + x) * 4;
      px[i] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      px[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      px[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      px[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// A flat star (the sun's rays), centred on the origin and facing +z.
function starGeometry(rIn, rOut, points, depth) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

export default function create(ctx) {
  const group = new THREE.Group();

  // ---- state ----
  let normalK = 1; // current normal-map strength
  let normalTarget = 1;
  let edgeAngle = 0; // current tile tip about its horizontal axle
  let edgeTarget = 0;
  let tileK = 1; // tile tip is scaled back to 0 before the frame folds flat
  const camLocal = new THREE.Vector3();

  // ---- frame: a navy card with a square window, hinged at its bottom edge ----
  const framePivot = new THREE.Group();
  framePivot.position.set(0, 0, HINGE_Z);
  framePivot.rotation.x = LEAN;
  const frameMat = flat(palette.navy);
  const addBar = (w, hgt, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, TH), frameMat);
    m.position.set(x, y, 0);
    framePivot.add(m);
  };
  addBar(FRAME_W, FOOT, 0, FOOT / 2);
  addBar(FRAME_W, BAR, 0, FRAME_H - BAR / 2);
  addBar(BAR, OPEN, -(OPEN / 2 + BAR / 2), FOOT + OPEN / 2);
  addBar(BAR, OPEN, OPEN / 2 + BAR / 2, FOOT + OPEN / 2);

  const caption = labelCard('Only two flat triangles', {
    w: FRAME_W - 0.3,
    h: 0.2,
    standing: true,
    thickness: 0.01,
    color: palette.navy,
    ink: palette.yellow,
    px: 96,
    font: `italic 500 60px ${FONT.body}`,
  });
  caption.position.set(0, FOOT / 2, TH / 2 + 0.006);
  framePivot.add(caption);

  // Axle pins at the left and right of the window: the tile tips about a horizontal axle
  // through its centre, so every point of it stays within TILE/2 of a centre ~1 above the page.
  const pinGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.09, 8);
  pinGeo.rotateZ(Math.PI / 2);
  const pinMat = flat(palette.orange);
  for (const s of [-1, 1]) {
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.set(s * (TILE / 2 + GAP / 2), TILE_CY, 0);
    framePivot.add(pin);
  }

  // ---- the tile: a thin box whose front face carries the normal map ----
  const tileMat = new THREE.MeshStandardNodeMaterial({
    color: TILE_COLOR,
    roughness: 0.8,
    metalness: 0,
    normalMap: makeNormalMap(512),
  });
  const tileEdge = flat(palette.card);
  const tileGeo = new THREE.BoxGeometry(TILE, TILE, TILE_TH);
  tileGeo.computeTangents();
  const tile = new THREE.Mesh(tileGeo, [tileEdge, tileEdge, tileEdge, tileEdge, tileMat, tileEdge]);
  const tilePivot = new THREE.Group();
  tilePivot.position.set(0, TILE_CY, 0);
  tilePivot.add(tile);
  framePivot.add(tilePivot);
  group.add(framePivot);

  const applyTile = () => {
    tilePivot.rotation.x = edgeAngle * tileK;
  };

  // Folds backwards onto the page (it already leans back, so it only travels ~55°).
  ctx.fold.hinge(framePivot, { from: -Math.PI / 2 + 0.03 - LEAN, start: 0, end: 0.6 });
  // An edge-on tile swings back into its frame (u 1 → 0.6) before the frame starts folding.
  ctx.fold.custom(
    (e, t) => {
      tileK = smooth(clamp01(t));
      applyTile();
    },
    { start: 0.6, end: 1 },
  );

  // Glue tab in front of the hinge.
  const tab = new THREE.Mesh(new THREE.BoxGeometry(FRAME_W, 0.006, 0.16), frameMat);
  tab.position.set(0, 0.003, HINGE_Z + 0.08);
  group.add(ctx.fold.rise(tab, { start: 0, end: 0.25 }));

  // ---- paper sun on a stick, carrying a small point light ----
  const sunPivot = new THREE.Group();
  sunPivot.position.set(0.95, 0, 0.7);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.05, 12), flat(palette.red));
  base.position.y = 0.025;
  const stickH = SUN_Y - 0.05;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, stickH, 6), unlit('#5a4636'));
  stick.position.set(0, 0.05 + stickH / 2, -0.03);
  stick.userData.noShadow = true;

  const head = new THREE.Group();
  head.position.set(0, SUN_Y, 0);
  head.rotation.x = SUN_TILT;
  const discGeo = new THREE.CylinderGeometry(SUN_R, SUN_R, 0.035, 24);
  discGeo.rotateX(Math.PI / 2);
  const disc = new THREE.Mesh(discGeo, unlit(palette.yellow));
  disc.position.z = 0.012;
  disc.userData.noShadow = true;
  const rays = new THREE.Mesh(starGeometry(SUN_R * 0.85, RAY_R, 12, 0.025), unlit(palette.orange));
  rays.userData.noShadow = true;
  const light = new THREE.PointLight(LIGHT_COLOR, 0, 6, 2);
  light.position.set(0, 0, -0.12); // just behind the disc, shining towards the tile
  head.add(disc, rays, light);
  sunPivot.add(base, stick, head);
  group.add(ctx.fold.rise(sunPivot, { start: 0.3, end: 0.8 }));
  ctx.fold.custom(
    (e, t) => {
      light.intensity = LIGHT_I * smooth(clamp01(t));
    },
    { start: 0.3, end: 0.8 },
  );

  let grabX = 0;
  let grabZ = 0;
  ctx.interactive(sunPivot, {
    cursor: 'grab',
    onDown(hit, ray) {
      const p = ctx.pagePoint(ray, SUN_Y);
      const ok = p && Number.isFinite(p.x) && Number.isFinite(p.z);
      grabX = ok ? sunPivot.position.x - p.x : 0;
      grabZ = ok ? sunPivot.position.z - p.z : 0;
      return true;
    },
    onDrag(ray) {
      const p = ctx.pagePoint(ray, SUN_Y);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
      sunPivot.position.x = THREE.MathUtils.clamp(p.x + grabX, -SUN_XMAX, SUN_XMAX);
      sunPivot.position.z = THREE.MathUtils.clamp(p.z + grabZ, SUN_ZMIN, SUN_ZMAX);
    },
  });

  // ---- controls ----

  // Angle about the tile's (horizontal) axle at which the tile's plane passes through the
  // camera, so it is seen exactly edge-on from wherever the reader is looking. With
  // rotation.x = a the tile's normal is (0, -sin a, cos a); solve n · (eye - centre) = 0.
  function edgeOnAngle() {
    ctx.camera.getWorldPosition(camLocal);
    framePivot.worldToLocal(camLocal);
    const vy = camLocal.y - tilePivot.position.y;
    const vz = camLocal.z - tilePivot.position.z;
    if (!Number.isFinite(vy) || !Number.isFinite(vz) || Math.abs(vy) + Math.abs(vz) < 1e-6) return Math.PI / 2;
    const a = Math.atan2(vz, vy);
    const b = a > 0 ? a - Math.PI : a + Math.PI;
    return Math.abs(a) <= Math.abs(b) ? a : b;
  }

  const normalBtn = button(ctx, {
    labels: ['Normal map: on', 'Normal map: off'],
    position: [-0.86, 0, 1.72],
    w: 1.6,
    h: 0.34,
    color: palette.teal,
    ink: palette.cream,
    onChange: (i) => {
      normalTarget = i === 0 ? 1 : 0;
    },
  });
  const edgeBtn = button(ctx, {
    labels: ['Turn edge-on', 'Turn face-on'],
    position: [0.86, 0, 1.72],
    w: 1.6,
    h: 0.34,
    color: palette.orange,
    ink: palette.ink,
    onChange: (i) => {
      edgeTarget = i === 1 ? edgeOnAngle() : 0;
    },
  });
  group.add(normalBtn.mesh, edgeBtn.mesh);

  // Clicking the tile itself flips it too.
  ctx.interactive(tile, {
    cursor: 'pointer',
    onClick() {
      edgeBtn.set(edgeBtn.index + 1);
    },
  });

  return {
    group,
    hint: 'Drag the sun · flip the tile',
    update(dt) {
      const kN = 1 - Math.exp(-dt * 6);
      normalK += (normalTarget - normalK) * kN;
      tileMat.normalScale.set(normalK, normalK);

      const kE = 1 - Math.exp(-dt * 3.5);
      edgeAngle += (edgeTarget - edgeAngle) * kE;
      applyTile();

      rays.rotation.z += dt * 0.35;
    },
  };
}

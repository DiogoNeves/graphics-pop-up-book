import * as THREE from 'three/webgpu';
import {
  Fn, Loop, uniform, texture, uv, vec2, vec3, vec4, float,
  positionLocal, cameraPosition, modelWorldMatrixInverse, transformNormalToView,
  max, min, mix, step, clamp,
} from 'three/tsl';
import { flat, palette, labelCard, button, FONT, clamp01, smooth } from '../kit.js';

// Parallax mapping: one flat square of bricks on a swivel stand. The same quad is shaded three
// ways: normals only, classic parallax mapping (a single uv offset) and parallax occlusion
// mapping (ray-marching the height field), so tilting it shows how much depth each one fakes.

const TEX = 512; // brick texture resolution
const TILE = 2.2; // tile size (world units); uv 0..1 spans the whole tile
const DEPTH = 0.055; // groove depth in uv units (≈ 0.12 world units)
const LAYERS = 32; // ray-march layers for parallax occlusion mapping
const NORMAL_BOOST = 0.5; // soften the very steep brick bevels a little

const BASE_H = 0.06; // turntable disc thickness
const ZC = 0.15; // turntable centre (z)
const AXIS = 1.32; // swivel axis height above the turntable
const POST_X = 1.33;
const FOLDED = -(Math.PI / 2 - 0.03); // frame lying back, almost flat

const YAW_MAX = 0.7;
const LEAN_MIN = 0.15;
const LEAN_MAX = 1.35;

const MODES = ['Normal map only', 'Parallax mapping (2001)', 'Parallax occlusion mapping'];

// ---- procedural brick textures (colour + height), seamless ----

// sRGB bytes straight from '#rrggbb' (THREE.Color would convert to linear).
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hash(a, b, s) {
  const h = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

function brickTextures(size = TEX) {
  const rows = 6;
  const cols = 3;
  const mortar = 0.011; // half-width of the flat groove bottom (uv)
  const bevel = 0.02; // width of the rounded brick edge (uv)
  const bricks = ['#c44536', '#b5523b', '#cf5c36', '#a8433a', '#d9693f', '#bf4a30'].map(hexToRgb);
  const mortarRgb = hexToRgb('#e8dcc2');
  const chipRgb = hexToRgb('#e88d68');

  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  };
  const colorCanvas = make();
  const heightCanvas = make();
  const cg = colorCanvas.getContext('2d');
  const hg = heightCanvas.getContext('2d');
  const cimg = cg.createImageData(size, size);
  const himg = hg.createImageData(size, size);
  const cd = cimg.data;
  const hd = himg.data;
  const TAU = Math.PI * 2;

  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    const rv = v * rows;
    const row = Math.floor(rv);
    const fy = rv - row;
    const shift = (row % 2) * 0.5;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const cu = u * cols + shift;
      const colRaw = Math.floor(cu);
      const fx = cu - colRaw;
      const col = colRaw % cols;
      // distance to the brick cell edge, in uv units
      const e = Math.min(Math.min(fx, 1 - fx) / cols, Math.min(fy, 1 - fy) / rows);
      const r1 = hash(row, col, 1);
      const r2 = hash(row, col, 2);
      const r3 = hash(row, col, 3);
      const r4 = hash(row, col, 4);

      // height: mortar 0, bricks ≈ 0.86..0.96 with a gentle wobble and rounded edges
      const face = 0.86 + 0.1 * r1 + 0.035 * Math.sin(TAU * 7 * u + TAU * r2) * Math.sin(TAU * 5 * v + TAU * r3);
      const edge = smooth(clamp01((e - mortar) / bevel));
      let h = e <= mortar ? 0 : face * edge;
      let chip = 0;
      if (r2 > 0.55) {
        const cx = r3 > 0.5 ? 0.12 : 0.88;
        const cy = r1 > 0.5 ? 0.18 : 0.82;
        const d = Math.hypot((fx - cx) / cols, (fy - cy) / rows);
        chip = 1 - smooth(clamp01((d - 0.016) / 0.014));
        h *= 1 - 0.55 * chip;
      }

      // colour: flat brick tones, cream mortar, a soft speckle
      const base = bricks[Math.floor(r4 * bricks.length) % bricks.length];
      const a = clamp01((e - mortar) * size + 0.5);
      const n = 1 + (hash(x, y, 5) - 0.5) * 0.07;
      const shade = 0.9 + 0.1 * edge;
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) {
        const brick = (base[k] * (1 - 0.5 * chip) + chipRgb[k] * 0.5 * chip) * shade * n;
        const m = mortarRgb[k] * (1 + (n - 1) * 0.6);
        cd[i + k] = Math.max(0, Math.min(255, m + (brick - m) * a));
      }
      cd[i + 3] = 255;
      const g = Math.round(clamp01(h) * 255);
      hd[i] = hd[i + 1] = hd[i + 2] = g;
      hd[i + 3] = 255;
    }
  }
  cg.putImageData(cimg, 0, 0);
  hg.putImageData(himg, 0, 0);

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  const heightTex = new THREE.CanvasTexture(heightCanvas);
  heightTex.colorSpace = THREE.NoColorSpace;
  for (const t of [colorTex, heightTex]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { colorTex, heightTex };
}

// ---- the brick material (TSL) ----
// The tile is a PlaneGeometry: tangent = local x (u), bitangent = local y (v), normal = local z.
// All height samples use explicit gradients (textureGrad), so they are legal inside the loop
// and do not mip-pop where the parallax uv jumps between bricks and mortar.

function brickMaterial(colorTex, heightTex, mode, depth) {
  const sampleH = (p, gx, gy) => texture(heightTex, p).grad(gx, gy).r;

  const parallaxUV = Fn(() => {
    const base = vec2(uv()).toVar();
    const gx = base.dFdx().toVar();
    const gy = base.dFdy().toVar();

    // tangent-space view direction: camera position brought into the tile's local space
    const camLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1.0)).xyz;
    const V = camLocal.sub(positionLocal).normalize().toVar();
    const vz = max(V.z, 0.15);
    const slope = V.xy.div(vz).mul(depth).toVar(); // uv shift per unit of depth

    // mode 1: parallax mapping (one offset by the height under the original uv)
    const h0 = sampleH(base, gx, gy).toVar();
    const pm = base.sub(slope.mul(float(1).sub(h0))).toVar();

    // mode 2: parallax occlusion mapping. March down in equal depth layers until the ray is
    // below the height field, then interpolate between the last two layers. Fixed trip count,
    // no break: the "done" flag freezes the state once the surface is found.
    const layer = 1 / LAYERS;
    const stepUV = slope.mul(layer).toVar();
    const curUV = vec2(base).toVar();
    const curDepth = float(0).toVar();
    const curD = float(1).sub(h0).toVar(); // depth-map value under curUV
    const prevUV = vec2(base).toVar();
    const prevDepth = float(0).toVar();
    const prevD = float(curD).toVar();
    const done = step(curD, curDepth).toVar();

    Loop(LAYERS, () => {
      const go = float(1).sub(done).toVar();
      prevUV.assign(mix(prevUV, curUV, go));
      prevDepth.assign(mix(prevDepth, curDepth, go));
      prevD.assign(mix(prevD, curD, go));
      curUV.assign(curUV.sub(stepUV.mul(go)));
      curDepth.assign(curDepth.add(go.mul(layer)));
      const d = float(1).sub(sampleH(curUV, gx, gy)).toVar();
      curD.assign(mix(curD, d, go));
      done.assign(max(done, step(curD, curDepth)));
    });

    const after = curD.sub(curDepth); // ≤ 0: ray is below the surface
    const before = prevD.sub(prevDepth); // ≥ 0: ray was above it
    const w = clamp(after.div(min(after.sub(before), -1e-5)), 0, 1);
    const pom = mix(curUV, prevUV, w).toVar();

    return mode.lessThan(0.5).select(base, mode.lessThan(1.5).select(pm, pom));
  });

  const pUV = parallaxUV();

  const colorNode = Fn(() => {
    const b = vec2(uv()).toVar();
    return texture(colorTex, pUV).grad(b.dFdx(), b.dFdy());
  })();

  // Normal from the height map by central differences, at the (possibly shifted) uv.
  const normalNode = Fn(() => {
    const b = vec2(uv()).toVar();
    const gx = b.dFdx().toVar();
    const gy = b.dFdy().toVar();
    const p = vec2(pUV).toVar();
    const e = 1.5 / TEX;
    const hl = sampleH(p.sub(vec2(e, 0)), gx, gy);
    const hr = sampleH(p.add(vec2(e, 0)), gx, gy);
    const hd = sampleH(p.sub(vec2(0, e)), gx, gy);
    const hu = sampleH(p.add(vec2(0, e)), gx, gy);
    const k = depth.mul(NORMAL_BOOST / (2 * e));
    const n = vec3(hl.sub(hr).mul(k), hd.sub(hu).mul(k), 1.0).normalize();
    return transformNormalToView(n).normalize();
  })();

  const mat = new THREE.MeshLambertNodeMaterial();
  mat.colorNode = colorNode;
  mat.normalNode = normalNode;
  return mat;
}

export default function create(ctx) {
  const group = new THREE.Group();
  const mode = uniform(0);
  const depth = uniform(DEPTH);

  // ---- turntable base (static) with a printed caption ----
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, BASE_H, 40), flat(palette.teal));
  disc.position.set(0, BASE_H / 2, ZC);
  group.add(disc);
  const caption = labelCard('One flat square, two triangles', {
    w: 1.7, h: 0.22, color: palette.cream, px: 96, font: `italic 400 54px ${FONT.body}`,
  });
  caption.position.set(0, BASE_H / 2 + 0.014, 0.95);

  // ---- swivel stand: yaw group → hinge (folds the frame) → swivel (tilts the tile) ----
  const yawGroup = new THREE.Group();
  yawGroup.position.set(0, BASE_H, ZC);
  group.add(yawGroup);

  const hinge = new THREE.Group();
  yawGroup.add(hinge);

  const postMat = flat(palette.navy);
  const postH = AXIS + 0.12;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, postH, 0.07), postMat);
    post.position.set(sx * POST_X, postH / 2, 0);
    hinge.add(post);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 12), flat(palette.yellow));
    axle.rotation.z = Math.PI / 2;
    axle.position.set(sx * 1.25, AXIS, 0);
    hinge.add(axle);
  }
  const foot = new THREE.Mesh(new THREE.BoxGeometry(2 * POST_X + 0.09, 0.08, 0.07), postMat);
  foot.position.set(0, 0.04, 0);
  hinge.add(foot);

  const swivel = new THREE.Group();
  swivel.position.set(0, AXIS, 0);
  hinge.add(swivel);

  const frameMat = flat(palette.cream);
  const board = new THREE.Mesh(new THREE.BoxGeometry(TILE + 0.2, TILE + 0.2, 0.04), flat(palette.card));
  board.position.z = -0.025;
  swivel.add(board);
  const lipH = new THREE.BoxGeometry(TILE + 0.2, 0.1, 0.075);
  const lipV = new THREE.BoxGeometry(0.1, TILE, 0.075);
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(lipH, frameMat);
    a.position.set(0, s * (TILE / 2 + 0.05), -0.0075);
    swivel.add(a);
    const b = new THREE.Mesh(lipV, frameMat);
    b.position.set(s * (TILE / 2 + 0.05), 0, -0.0075);
    swivel.add(b);
  }

  const { colorTex, heightTex } = brickTextures();
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(TILE, TILE), brickMaterial(colorTex, heightTex, mode, depth));
  swivel.add(tile);

  // ---- pose: user base + gentle sway, scaled by the fold so everything lies flat when closed ----
  let baseYaw = 0;
  let baseLean = 0.6;
  let yaw = baseYaw;
  let lean = baseLean;
  let swayK = 1;
  let idle = 10;
  let dragging = false;
  let frameE = 0;
  let poseE = 0;
  let yaw0 = 0;
  let lean0 = 0;
  const grab = new THREE.Vector3();

  const pose = () => {
    hinge.rotation.x = FOLDED * (1 - frameE);
    swivel.rotation.x = -lean * poseE;
    yawGroup.rotation.y = yaw * poseE;
  };

  ctx.fold.custom((e, t) => {
    const s = Math.max(1e-4, e);
    disc.scale.set(s, s, s);
    disc.visible = t > 0;
    yawGroup.position.y = BASE_H * Math.min(1, Math.max(0, e));
  }, { start: 0, end: 0.35 });
  ctx.fold.custom((e, t) => {
    frameE = e;
    hinge.visible = t > 0;
    pose();
  }, { start: 0.3, end: 0.75 });
  ctx.fold.custom((e) => {
    poseE = e;
    pose();
  }, { start: 0.65, end: 0.95 });

  // ---- interaction: drag the tile to turn / tilt it ----
  const dragY = BASE_H + AXIS;
  ctx.interactive(swivel, {
    cursor: 'grab',
    onDown(hit, ray) {
      const p = ctx.pagePoint(ray, dragY);
      if (!p) return false;
      grab.copy(p);
      baseYaw = yaw0 = yaw;
      baseLean = lean0 = lean;
      swayK = 0;
      idle = 0;
      dragging = true;
      return true;
    },
    onDrag(ray) {
      const p = ctx.pagePoint(ray, dragY);
      if (!p) return;
      baseYaw = THREE.MathUtils.clamp(yaw0 + (p.x - grab.x) * 1.0, -YAW_MAX, YAW_MAX);
      baseLean = THREE.MathUtils.clamp(lean0 - (p.z - grab.z) * 0.9, LEAN_MIN, LEAN_MAX);
      idle = 0;
    },
    onUp() {
      dragging = false;
      idle = 0;
    },
  });

  // ---- mode button ----
  const modeButton = button(ctx, {
    labels: MODES,
    position: [0, 0, 1.75],
    w: 3.0,
    h: 0.32,
    color: palette.orange,
    onChange: (i) => {
      mode.value = i;
    },
  });
  group.add(modeButton.mesh);

  return {
    group,
    hint: 'Drag the tile to tilt · press to switch',
    update(dt, time) {
      idle += dt;
      if (dragging) swayK = 0;
      else if (idle > 2.5) swayK = Math.min(1, swayK + dt * 0.3);
      const sy = Math.sin(time * 0.45) * 0.45;
      const sl = Math.sin(time * 0.31 + 1.0) * 0.28;
      yaw = THREE.MathUtils.clamp(baseYaw + swayK * sy, -YAW_MAX, YAW_MAX);
      lean = THREE.MathUtils.clamp(baseLean + swayK * sl, LEAN_MIN, LEAN_MAX);
      pose();
    },
  };
}

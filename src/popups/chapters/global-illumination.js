import * as THREE from 'three/webgpu';
import { flat, unlit, palette, labelCard, pullTab, smooth, FONT } from '../kit.js';

// Radiosity pop-up: a Cornell box whose surfaces are cut into flat patches. A small
// radiosity solver runs once at build time and keeps the solution after every bounce;
// the pull-tab chooses how many bounces are shown, so shadows fill in and the red and
// green walls bleed colour onto the white surfaces.
//
// The box is open at the front (towards the reader) and, apart from a strip at the back
// that holds the light, at the top too: the book is seen from above, so a full ceiling
// would hide the inside. The solver simulates exactly the geometry that is shown.

// ---- box dimensions (pop-up coordinates; the floor is y = 0 of the box group) ----
const BW = 2.6; // width (x)
const BH = 2.2; // height (y)
const BD = 2.0; // depth (z)
const X0 = -BW / 2;
const X1 = BW / 2;
const Z0 = -2.15; // back wall
const Z1 = Z0 + BD; // open front
const CEIL_D = 0.7; // depth of the ceiling strip at the back
const T = 0.03; // card thickness
const LIFT = 0.002; // patches sit this far in front of their card
const LEVELS = 6; // bounces 0..5

// Pivot heights: when folded, the walls stack flat on the floor (red, green, back+ceiling).
const Y_RED = 0.012;
const Y_GREEN = 0.05;
const WALL_BLUE = '#2f6fe0'; // the right wall: red, blue and white room
const Y_BACK = 0.088;

// Two white blocks (centre on the floor, size, rotation about y).
const BLOCKS = [
  { x: -0.45, z: -1.42, hx: 0.36, hy: 1.3, hz: 0.36, ang: THREE.MathUtils.degToRad(15), div: [3, 5] },
  { x: 0.46, z: -0.78, hx: 0.36, hy: 0.62, hz: 0.36, ang: THREE.MathUtils.degToRad(-18), div: [3, 3] },
];

const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

// ---- patch collection ----

// Collects patches (simulation data) and per-surface display geometry.
class Patches {
  constructor() {
    this.c = []; // centre (sim coords)
    this.n = []; // normal
    this.area = [];
    this.rho = [];
    this.emit = [];
    this.owner = []; // block index or -1
    this.surf = []; // surface id
    this.samples = []; // per patch: flat [x,y,z,...] sample points on the patch
    this.display = []; // per patch: { colors (Float32Array), offset }
    this.surfaces = 0;
  }

  // Add a rectangular surface split into cells. Coordinates are in the surface's display
  // frame; toSim maps a point from that frame to simulation coords (identity for walls).
  // u × v must equal the outward (into the room) normal.
  addSurface({ origin, u, v, ue, ve, material, owner = -1, toSim = (p) => p, ns = 2, lift = LIFT, keep = null }) {
    const id = this.surfaces++;
    const n = new THREE.Vector3().crossVectors(u, v).normalize();
    const nSim = toSim(n.clone().add(origin)).sub(toSim(origin.clone())).normalize();
    const cells = (ue.length - 1) * (ve.length - 1);
    const positions = new Float32Array(cells * 18);
    const colors = new Float32Array(cells * 18);
    const at = (a, b, target) => target.copy(origin).addScaledVector(u, a).addScaledVector(v, b);
    const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const tmp = new THREE.Vector3();
    let cell = 0;
    for (let j = 0; j < ve.length - 1; j++) {
      for (let i = 0; i < ue.length - 1; i++) {
        const a0 = ue[i], a1 = ue[i + 1], b0 = ve[j], b1 = ve[j + 1];
        // display quad (two triangles, counter-clockwise seen from the normal side)
        at(a0, b0, p[0]).addScaledVector(n, lift);
        at(a1, b0, p[1]).addScaledVector(n, lift);
        at(a1, b1, p[2]).addScaledVector(n, lift);
        at(a0, b1, p[3]).addScaledVector(n, lift);
        const order = [0, 1, 2, 0, 2, 3];
        for (let k = 0; k < 6; k++) {
          const q = p[order[k]];
          positions.set([q.x, q.y, q.z], cell * 18 + k * 3);
        }
        // simulation data
        const centre = toSim(at((a0 + a1) / 2, (b0 + b1) / 2, tmp).clone());
        const samples = [];
        for (let sb = 0; sb < ns; sb++) {
          for (let sa = 0; sa < ns; sa++) {
            const s = toSim(at(a0 + ((sa + 0.5) / ns) * (a1 - a0), b0 + ((sb + 0.5) / ns) * (b1 - b0), tmp).clone());
            if (!keep || keep(s)) samples.push(s.x, s.y, s.z);
          }
        }
        const m = material(i, j);
        this.c.push(centre.x, centre.y, centre.z);
        this.n.push(nSim.x, nSim.y, nSim.z);
        this.area.push((a1 - a0) * (b1 - b0));
        this.rho.push(...m.rho);
        this.emit.push(...(m.emit ?? [0, 0, 0]));
        this.owner.push(owner);
        this.surf.push(id);
        this.samples.push(samples);
        this.display.push({ colors, offset: cell * 18 });
        cell++;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const colorAttr = new THREE.BufferAttribute(colors, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('color', colorAttr);
    geometry.computeVertexNormals();
    return { geometry, colorAttr };
  }

  get count() {
    return this.area.length;
  }
}

// ---- visibility against the blocks ----

// Is the segment p→q blocked by a block (other than skipA/skipB, the blocks the end points
// sit on)? Slab test in each block's local frame.
function makeOccluder(blocks) {
  return function occluded(px, py, pz, qx, qy, qz, skipA, skipB) {
    const Dx = qx - px, Dy = qy - py, Dz = qz - pz;
    for (let b = 0; b < blocks.length; b++) {
      if (b === skipA || b === skipB) continue;
      const B = blocks[b];
      const dx = px - B.x, dz = pz - B.z;
      const ox = B.c * dx - B.s * dz;
      const oz = B.s * dx + B.c * dz;
      const vx = B.c * Dx - B.s * Dz;
      const vz = B.s * Dx + B.c * Dz;
      let t0 = 1e-4, t1 = 1 - 1e-4;
      // x slab
      if (Math.abs(vx) < 1e-12) {
        if (ox < -B.hx || ox > B.hx) continue;
      } else {
        let a = (-B.hx - ox) / vx, c = (B.hx - ox) / vx;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a;
        if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      // y slab: [0, height]
      if (Math.abs(Dy) < 1e-12) {
        if (py < 0 || py > B.hy) continue;
      } else {
        let a = (0 - py) / Dy, c = (B.hy - py) / Dy;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a;
        if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      // z slab
      if (Math.abs(vz) < 1e-12) {
        if (oz < -B.hz || oz > B.hz) continue;
      } else {
        let a = (-B.hz - oz) / vz, c = (B.hz - oz) / vz;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a;
        if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      return true;
    }
    return false;
  };
}

// ---- the radiosity solver ----

// Returns an array of LEVELS Float32Array(3N): level 0 = emission + direct light,
// level k = E + ρ·F·level(k−1), i.e. k extra bounces of indirect light.
function solveRadiosity(P, blocks) {
  const N = P.count;
  const C = Float32Array.from(P.c);
  const Nn = Float32Array.from(P.n);
  const A = Float32Array.from(P.area);
  const own = Int32Array.from(P.owner);
  const surf = Int32Array.from(P.surf);
  const rho = Float32Array.from(P.rho);
  const E = Float32Array.from(P.emit);
  const occluded = makeOccluder(blocks);
  const F = new Float32Array(N * N);

  // Form factors F_ij ≈ cosθi cosθj A_j / (π r² + A_j), averaged over sample points on
  // patch i (towards the centre of j); the reciprocal F_ji integrates over i's samples.
  for (let i = 0; i < N; i++) {
    const S = P.samples[i];
    const ns = S.length / 3;
    if (ns === 0) continue;
    const nix = Nn[i * 3], niy = Nn[i * 3 + 1], niz = Nn[i * 3 + 2];
    const Ai = A[i];
    const aSub = Ai / ns;
    for (let j = i + 1; j < N; j++) {
      if (surf[j] === surf[i]) continue;
      if (own[i] >= 0 && own[i] === own[j]) continue;
      if (P.samples[j].length === 0) continue;
      const qx = C[j * 3], qy = C[j * 3 + 1], qz = C[j * 3 + 2];
      const njx = Nn[j * 3], njy = Nn[j * 3 + 1], njz = Nn[j * 3 + 2];
      const Aj = A[j];
      let fij = 0, fji = 0;
      for (let s = 0; s < ns; s++) {
        const px = S[s * 3], py = S[s * 3 + 1], pz = S[s * 3 + 2];
        const dx = qx - px, dy = qy - py, dz = qz - pz;
        const ci = nix * dx + niy * dy + niz * dz;
        if (ci <= 1e-9) continue;
        const cj = -(njx * dx + njy * dy + njz * dz);
        if (cj <= 1e-9) continue;
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < 1e-9) continue;
        if (occluded(px, py, pz, qx, qy, qz, own[i], own[j])) continue;
        const g = (ci * cj) / r2; // cosθi · cosθj
        fij += (g * Aj) / (Math.PI * r2 + Aj);
        fji += (g * aSub) / (Math.PI * r2 + aSub);
      }
      F[i * N + j] = fij / ns;
      F[j * N + i] = fji;
    }
  }

  // Keep every row a valid fraction (the point-to-disc approximation can overshoot in corners).
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < N; j++) sum += F[i * N + j];
    if (sum > 0.98) {
      const k = 0.98 / sum;
      for (let j = 0; j < N; j++) F[i * N + j] *= k;
    }
  }

  // Jacobi iterations, keeping every bounce.
  const levels = [];
  let prev = E;
  for (let L = 0; L < LEVELS; L++) {
    const next = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let r = 0, g = 0, b = 0;
      const row = i * N;
      for (let j = 0; j < N; j++) {
        const f = F[row + j];
        if (f === 0) continue;
        r += f * prev[j * 3];
        g += f * prev[j * 3 + 1];
        b += f * prev[j * 3 + 2];
      }
      next[i * 3] = E[i * 3] + rho[i * 3] * r;
      next[i * 3 + 1] = E[i * 3 + 1] + rho[i * 3 + 1] * g;
      next[i * 3 + 2] = E[i * 3 + 2] + rho[i * 3 + 2] * b;
    }
    levels.push(next);
    prev = next;
  }
  return levels;
}

// Simple exposure + soft shoulder, one exposure for every level so added bounces brighten.
// Output stays linear: the renderer applies the sRGB display gamma.
function toDisplay(levels, P) {
  const N = P.count;
  const last = levels[levels.length - 1];
  const lum = [];
  for (let i = 0; i < N; i++) {
    const isEmitter = P.emit[i * 3] + P.emit[i * 3 + 1] + P.emit[i * 3 + 2] > 0;
    if (isEmitter || P.samples[i].length === 0) continue;
    lum.push(0.2126 * last[i * 3] + 0.7152 * last[i * 3 + 1] + 0.0722 * last[i * 3 + 2]);
  }
  lum.sort((a, b) => a - b);
  const ref = Math.max(1e-6, lum[Math.floor(lum.length * 0.9)] ?? 1);
  const exposure = -Math.log(1 - 0.86) / ref;

  // Patches completely hidden under a block borrow the colour of the nearest visible one.
  const borrow = new Int32Array(N).map((_, i) => i);
  for (let i = 0; i < N; i++) {
    if (P.samples[i].length > 0) continue;
    let best = -1, bd = Infinity;
    for (let j = 0; j < N; j++) {
      if (P.samples[j].length === 0 || P.surf[j] !== P.surf[i]) continue;
      const d = (P.c[i * 3] - P.c[j * 3]) ** 2 + (P.c[i * 3 + 2] - P.c[j * 3 + 2]) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    if (best >= 0) borrow[i] = best;
  }

  return levels.map((B) => {
    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const src = borrow[i];
      for (let c = 0; c < 3; c++) {
        const v = 1 - Math.exp(-exposure * Math.max(0, B[src * 3 + c]));
        out[i * 3 + c] = Math.pow(v, 0.8);
      }
    }
    return out;
  });
}

// Linear-space reflectance from a palette colour.
function reflectance(hex, scale) {
  const c = new THREE.Color(hex);
  return [Math.min(0.92, c.r * scale), Math.min(0.92, c.g * scale), Math.min(0.92, c.b * scale)];
}

export default function create(ctx) {
  const group = new THREE.Group();
  const box = new THREE.Group();
  box.position.y = 0.004;
  group.add(box);

  // ---- materials ----
  const RHO_WHITE = [0.76, 0.73, 0.64];
  const RHO_RED = reflectance(palette.red, 1.08);
  const RHO_GREEN = reflectance(WALL_BLUE, 1.3);
  const LIGHT = [16, 15.2, 13.6];
  const white = () => ({ rho: RHO_WHITE });

  const patchMat = new THREE.MeshBasicNodeMaterial({ vertexColors: true });
  const cardWhite = flat(palette.card);
  const cardRed = flat(palette.red);
  const cardGreen = flat(WALL_BLUE);

  const P = new Patches();
  const meshes = [];
  const addPatchMesh = (surface, parent, offset) => {
    const mesh = new THREE.Mesh(surface.geometry, patchMat);
    mesh.position.copy(offset);
    mesh.userData.noShadow = true;
    parent.add(mesh);
    meshes.push(surface);
    return mesh;
  };
  const card = (w, h, d, material, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // Hinge that folds flat (and hides) at the start of its window.
  const hinge = (pivot, axis, from, start, end) => {
    ctx.fold.custom(
      (e, t) => {
        pivot.rotation[axis] = from * (1 - e);
        pivot.visible = t > 0;
      },
      { start, end },
    );
    return pivot;
  };

  // Floor samples inside a block's footprint are dropped (that part of the patch is hidden).
  const insideBlock = (p) =>
    BLOCKS.some((b) => {
      const dx = p.x - b.x, dz = p.z - b.z;
      const c = Math.cos(b.ang), s = Math.sin(b.ang);
      return Math.abs(c * dx - s * dz) < b.hx && Math.abs(s * dx + c * dz) < b.hz;
    });

  // ---- floor: printed on the page ----
  const floorPivot = new THREE.Group();
  box.add(floorPivot);
  const floor = P.addSurface({
    origin: V(X0, 0, Z1), u: V(1, 0, 0), v: V(0, 0, -1),
    ue: range(0, BW, 8), ve: range(0, BD, 8), material: white, ns: 3,
    keep: (p) => !insideBlock(p),
  });
  addPatchMesh(floor, floorPivot, V(0, 0, 0));
  ctx.fold.custom((e, t) => (floorPivot.visible = t > 0), { start: 0, end: 0.05 });

  // ---- back wall (hinges up from the floor's back edge; folds forward over the floor) ----
  const backPivot = new THREE.Group();
  backPivot.position.set(0, Y_BACK, Z0);
  box.add(backPivot);
  const back = P.addSurface({
    origin: V(X0, 0, Z0), u: V(1, 0, 0), v: V(0, 1, 0),
    ue: range(0, BW, 8), ve: range(0, BH, 8), material: white,
  });
  addPatchMesh(back, backPivot, V(0, -Y_BACK, -Z0));
  card(BW + 2 * T, BH, T, cardWhite, 0, BH / 2 - Y_BACK, -T / 2, backPivot);
  hinge(backPivot, 'x', Math.PI / 2, 0.05, 0.4);

  // ---- ceiling strip with the light (hinges from the top of the back wall) ----
  const ceilPivot = new THREE.Group();
  ceilPivot.position.set(0, BH - Y_BACK, 0);
  backPivot.add(ceilPivot);
  const lightU = [1.05, 1.55];
  const lightV = [0.1, 0.6];
  const ceilU = [0, 0.35, 0.7, 1.05, 1.3, 1.55, 1.9, 2.25, 2.6];
  const ceilV = [0, 0.1, 0.35, 0.6, CEIL_D];
  const ceiling = P.addSurface({
    origin: V(X0, BH, Z0), u: V(1, 0, 0), v: V(0, 0, 1), ue: ceilU, ve: ceilV,
    material: (i, j) => {
      const isLight = ceilU[i] >= lightU[0] - 1e-6 && ceilU[i + 1] <= lightU[1] + 1e-6 && ceilV[j] >= lightV[0] - 1e-6 && ceilV[j + 1] <= lightV[1] + 1e-6;
      return isLight ? { rho: [0, 0, 0], emit: LIGHT } : { rho: RHO_WHITE };
    },
  });
  addPatchMesh(ceiling, ceilPivot, V(0, -BH, -Z0));
  card(BW + 2 * T, T, CEIL_D + T, cardWhite, 0, T / 2, (CEIL_D - T) / 2, ceilPivot);
  // the lamp shows through the top of the ceiling card
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.5), unlit('#fff4c8'));
  lamp.position.set(X0 + (lightU[0] + lightU[1]) / 2, T + 0.0175, (lightV[0] + lightV[1]) / 2);
  lamp.userData.noShadow = true;
  ceilPivot.add(lamp);
  ctx.fold.rise(lamp, { start: 0.35, end: 0.6 });
  hinge(ceilPivot, 'x', -Math.PI / 2, 0.08, 0.4);

  // ---- green wall (right; folds inward over the floor) ----
  const greenPivot = new THREE.Group();
  greenPivot.position.set(X1, Y_GREEN, 0);
  box.add(greenPivot);
  const green = P.addSurface({
    origin: V(X1, 0, Z0), u: V(0, 0, 1), v: V(0, 1, 0),
    ue: range(0, BD, 8), ve: range(0, BH, 8), material: () => ({ rho: RHO_GREEN }),
  });
  addPatchMesh(green, greenPivot, V(-X1, -Y_GREEN, 0));
  card(T, BH, BD, cardGreen, T / 2, BH / 2 - Y_GREEN, (Z0 + Z1) / 2, greenPivot);
  hinge(greenPivot, 'z', Math.PI / 2, 0.15, 0.45);

  // ---- red wall (left; folds inward first, lowest in the stack) ----
  const redPivot = new THREE.Group();
  redPivot.position.set(X0, Y_RED, 0);
  box.add(redPivot);
  const red = P.addSurface({
    origin: V(X0, 0, Z1), u: V(0, 0, -1), v: V(0, 1, 0),
    ue: range(0, BD, 8), ve: range(0, BH, 8), material: () => ({ rho: RHO_RED }),
  });
  addPatchMesh(red, redPivot, V(-X0, -Y_RED, 0));
  card(T, BH, BD, cardRed, -T / 2, BH / 2 - Y_RED, (Z0 + Z1) / 2, redPivot);
  hinge(redPivot, 'z', -Math.PI / 2, 0.22, 0.5);

  // ---- blocks (rise out of the floor) ----
  const blocks = BLOCKS.map((b) => ({ ...b, c: Math.cos(b.ang), s: Math.sin(b.ang) }));
  blocks.forEach((b, bi) => {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    g.rotation.y = b.ang;
    box.add(g);
    const toSim = (p) => p.set(b.x + b.c * p.x + b.s * p.z, p.y, b.z - b.s * p.x + b.c * p.z);
    const [dw, dh] = b.div;
    const { hx, hy, hz } = b;
    const faces = [
      { origin: V(-hx, hy, hz), u: V(1, 0, 0), v: V(0, 0, -1), ue: range(0, 2 * hx, dw), ve: range(0, 2 * hz, dw) }, // top
      { origin: V(-hx, 0, hz), u: V(1, 0, 0), v: V(0, 1, 0), ue: range(0, 2 * hx, dw), ve: range(0, hy, dh) }, // +z
      { origin: V(hx, 0, -hz), u: V(-1, 0, 0), v: V(0, 1, 0), ue: range(0, 2 * hx, dw), ve: range(0, hy, dh) }, // -z
      { origin: V(hx, 0, hz), u: V(0, 0, -1), v: V(0, 1, 0), ue: range(0, 2 * hz, dw), ve: range(0, hy, dh) }, // +x
      { origin: V(-hx, 0, -hz), u: V(0, 0, 1), v: V(0, 1, 0), ue: range(0, 2 * hz, dw), ve: range(0, hy, dh) }, // -x
    ];
    for (const f of faces) {
      const surface = P.addSurface({ ...f, material: white, owner: bi, toSim, lift: 0 });
      addPatchMesh(surface, g, V(0, 0, 0));
    }
    ctx.fold.rise(g, { start: 0.4 + bi * 0.05, end: 0.72 + bi * 0.05 });
  });

  // ---- solve once ----
  const levels = solveRadiosity(P, blocks);
  const display = toDisplay(levels, P);
  const N = P.count;

  const shown = new Float32Array(N * 3);
  const from = new Float32Array(N * 3);
  let target = display[0];
  let blend = 1;
  let level = 0;

  // Before the lamp and blocks pop up, the patches show plain card colours; the solution
  // fades in ("lights on") as the page finishes opening.
  const neutral = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const isEmitter = P.emit[i * 3] + P.emit[i * 3 + 1] + P.emit[i * 3 + 2] > 0;
    for (let c = 0; c < 3; c++) neutral[i * 3 + c] = isEmitter ? [0.95, 0.9, 0.75][c] : Math.min(0.9, P.rho[i * 3 + c] * 1.05);
  }
  let lightOn = 1;
  let dirty = false;
  ctx.fold.custom(
    (e, t) => {
      const v = smooth(t);
      if (v !== lightOn) {
        lightOn = v;
        dirty = true;
      }
    },
    { start: 0.5, end: 0.85 },
  );

  const writeColors = () => {
    const k1 = lightOn, k0 = 1 - lightOn;
    for (let i = 0; i < N; i++) {
      const { colors, offset } = P.display[i];
      const r = neutral[i * 3] * k0 + shown[i * 3] * k1;
      const g = neutral[i * 3 + 1] * k0 + shown[i * 3 + 1] * k1;
      const b = neutral[i * 3 + 2] * k0 + shown[i * 3 + 2] * k1;
      for (let k = 0; k < 6; k++) {
        colors[offset + k * 3] = r;
        colors[offset + k * 3 + 1] = g;
        colors[offset + k * 3 + 2] = b;
      }
    }
    for (const s of meshes) s.colorAttr.needsUpdate = true;
  };
  shown.set(target);
  writeColors();

  // ---- controls ----
  const label = labelCard('Bounces: 0', { w: 1.3, h: 0.32, color: palette.cream, px: 128 });
  label.position.set(0, 0.014, 0.68);
  label.visible = false; // no printed text in the pop-ups

  const setLevel = (next) => {
    if (next === level) return;
    level = next;
    from.set(shown);
    target = display[level];
    blend = 0;
    label.userData.setText(`Bounces: ${level}`);
  };

  const TAB_X0 = -1.25;
  const TAB_X1 = 1.25;
  const tab = pullTab(ctx, {
    x0: TAB_X0, x1: TAB_X1, z: 1.3, steps: LEVELS, label: 'PULL', color: palette.blue,
    onChange: (v) => setLevel(Math.round(v * (LEVELS - 1))),
  });
  group.add(tab.group);

  ctx.interactive(label, {
    onClick() {
      tab.set(((level + 1) % LEVELS) / (LEVELS - 1));
    },
  });

  // printed bounce numbers under the tab's ticks
  const stripW = 2.9;
  const stripH = 0.2;
  const canvas = document.createElement('canvas');
  canvas.width = 1160;
  canvas.height = 80;
  const g2 = canvas.getContext('2d');
  g2.fillStyle = palette.paper;
  g2.fillRect(0, 0, canvas.width, canvas.height);
  g2.fillStyle = palette.ink;
  g2.font = `600 56px ${FONT.title}`;
  g2.textAlign = 'center';
  g2.textBaseline = 'middle';
  // One dot per bounce instead of numbers: more dots, more bounces.
  for (let i = 0; i < LEVELS; i++) {
    const x = ((TAB_X0 + ((TAB_X1 - TAB_X0) * i) / (LEVELS - 1) + stripW / 2) / stripW) * canvas.width;
    if (i === 0) {
      g2.lineWidth = 4;
      g2.strokeStyle = palette.ink;
      g2.beginPath();
      g2.arc(x, canvas.height / 2, 12, 0, Math.PI * 2);
      g2.stroke();
    }
    for (let k = 0; k < i; k++) {
      g2.beginPath();
      g2.arc(x + (k - (i - 1) / 2) * 22, canvas.height / 2, 8, 0, Math.PI * 2);
      g2.fill();
    }
  }
  const stripTex = new THREE.CanvasTexture(canvas);
  stripTex.colorSpace = THREE.SRGBColorSpace;
  stripTex.anisotropy = 8;
  const stripSide = flat(palette.paper);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(stripW, 0.01, stripH), [
    stripSide, stripSide, flat('#ffffff', { map: stripTex }), stripSide, stripSide, stripSide,
  ]);
  strip.position.set(0, 0.006, 1.66);
  group.add(ctx.fold.rise(strip, { start: 0.55, end: 0.95 }));

  return {
    group,
    hint: 'Pull the tab to add light bounces',
    update(dt) {
      if (blend < 1) {
        blend = Math.min(1, blend + Math.max(0, dt || 0) / 0.45);
        const e = smooth(blend);
        for (let k = 0; k < shown.length; k++) shown[k] = from[k] + (target[k] - from[k]) * e;
        dirty = true;
      }
      if (dirty) {
        dirty = false;
        writeColors();
      }
    },
  };
}

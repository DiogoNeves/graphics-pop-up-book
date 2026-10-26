import * as THREE from 'three/webgpu';
import { flat, unlit, palette, labelCard, button, clamp01, smooth, FONT } from '../kit.js';

// Ray tracing: an eye looks through a paper "screen" of 12 x 9 pixels at a red ball, a mirror
// ball and a hanging light bulb in front of a backdrop. Clicking a pixel fires a ray from the
// eye through its centre. Everything is computed analytically in pop-up local coordinates
// (ray-sphere, ray-plane): the primary ray grows to its first hit, a shadow ray heads for the
// bulb (yellow if it gets there, red and stopping at the blocker if not), a hit on the mirror
// sends one reflection ray onwards, and the pixel then takes the traced colour.

// ---- layout (pop-up local units) ----
const COLS = 12;
const ROWS = 9;
const N = COLS * ROWS;
const PITCH = 0.14; // pixel spacing on the screen
const TILE = PITCH * 0.88; // visible tile, leaving a thin grid line
const CARD_T = 0.03;

const FRAME_Z = 0; // hinge line of the screen
const LEAN = 0.3; // the screen leans back a little, like an easel (radians)
const COS_L = Math.cos(LEAN);
const SIN_L = Math.sin(LEAN);
const GRID_Y = 0.7; // grid centre, measured up the card from the hinge
const TILE_Z = CARD_T / 2 + 0.004; // tiles sit just in front of the card face
const BORDER = 0.08;
const FRAME_W = COLS * PITCH + 2 * BORDER;
const FRAME_H = GRID_Y + (ROWS / 2) * PITCH + BORDER;

const WALL_Z = -2.15; // backdrop hinge line
const WALL_W = 3.6;
const WALL_H = 1.95;
const WALL_FACE = WALL_Z + CARD_T / 2;

const RED_C = new THREE.Vector3(-0.62, 0.5, -1.3);
const RED_R = 0.5;
const MIR_C = new THREE.Vector3(0.5, 0.56, -1.5);
const MIR_R = 0.56;
const BULB_C = new THREE.Vector3(-0.2, 1.72, -0.7);
const BULB_R = 0.11;
const BOOM_Y = 1.93; // the bulb hangs from a boom that sticks out of the backdrop

const EYE_C = new THREE.Vector3(0, 1.0, 1.7); // eyeball centre
const EYE_R = 0.16;

// The world the rays live in: the pop-up's safe box. Rays that leave it hit nothing (sky).
const BOX_X = 1.8;
const BOX_TOP = 2.6;
const BOX_FRONT = 1.9;

// What a ray can hit.
const SKY = 0;
const RED = 1;
const MIRROR = 2;
const BULB = 3;
const GROUND = 4;
const WALL = 5;
const SCREEN = 6; // the back of the image-plane card (only secondary rays can hit it)

const EPS = 1e-4;
const AMBIENT = 0.28;
const MIRROR_K = 0.82; // how much of the reflected colour the mirror passes on

// Colours (THREE.Color converts the sRGB hex values to linear, so the maths is linear).
const ALBEDO = [];
ALBEDO[RED] = new THREE.Color(palette.red);
ALBEDO[GROUND] = new THREE.Color(palette.paper);
ALBEDO[WALL] = new THREE.Color(palette.green);
ALBEDO[SCREEN] = new THREE.Color(palette.orange);
const SKY_COL = new THREE.Color('#a9d0ea');
const BULB_COL = new THREE.Color('#ffe680');
const SILVER_COL = new THREE.Color('#c5c9cf');
const BLANK_A = new THREE.Color('#3a332d');
const BLANK_B = new THREE.Color('#2e2823');
const WHITE = new THREE.Color('#ffffff');

const RAY_HEX = ['#2fd0ff', '#c77dff', '#ffc21a', '#ff2e4d'];
const MAT_PRIMARY = 0;
const MAT_REFLECT = 1;
const MAT_LIT = 2;
const MAT_BLOCKED = 3;

const RAY_R = 0.017;
const POOL = 27; // ray meshes shared by all traces
const MAX_JOBS = 12;
const SCAN_STEP = 0.075; // seconds between pixels when tracing them all

const UP = new THREE.Vector3(0, 1, 0);

const cellX = (i) => (i - (COLS - 1) / 2) * PITCH;
const cellY = (j) => GRID_Y + ((ROWS - 1) / 2 - j) * PITCH;

// Card-local point (x, y, z) on the leaning screen → pop-up local coordinates.
function onScreen(x, y, z, out) {
  return out.set(x, y * COS_L + z * SIN_L, FRAME_Z - y * SIN_L + z * COS_L);
}

// The eye gazes at the centre of the screen; its pupil is the centre of projection.
const GRID_CENTRE = onScreen(0, GRID_Y, TILE_Z, new THREE.Vector3());
const GAZE = new THREE.Vector3().subVectors(GRID_CENTRE, EYE_C).normalize();
const EYE = EYE_C.clone().addScaledVector(GAZE, EYE_R);
const GAZE_PITCH = Math.atan2(GAZE.y, -GAZE.z);

// ---- analytic intersections (allocation-free) ----
const _oc = new THREE.Vector3();

// Distance along unit direction d to the first entry into a sphere, or Infinity.
function sphereT(o, d, c, r) {
  _oc.subVectors(o, c);
  const b = _oc.dot(d);
  const cc = _oc.lengthSq() - r * r;
  const h = b * b - cc;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t > EPS ? t : Infinity;
}

// Distance at which a ray leaves the safe box (so a missed ray is drawn to the edge).
function boxExit(o, d) {
  let t = 4;
  if (d.x > 1e-6) t = Math.min(t, (BOX_X - o.x) / d.x);
  else if (d.x < -1e-6) t = Math.min(t, (-BOX_X - o.x) / d.x);
  if (d.y > 1e-6) t = Math.min(t, (BOX_TOP - o.y) / d.y);
  else if (d.y < -1e-6) t = Math.min(t, -o.y / d.y);
  if (d.z > 1e-6) t = Math.min(t, (BOX_FRONT - o.z) / d.z);
  else if (d.z < -1e-6) t = Math.min(t, (WALL_FACE - o.z) / d.z);
  return Math.max(0.05, t);
}

// The screen card as an occluder for reflection and shadow rays. Primary rays start at the eye
// and pass through their pixel, so they ignore it.
const BOARD_N = new THREE.Vector3(0, -SIN_L, -COS_L); // outward normal of the card's back face
const BOARD_UP = new THREE.Vector3(0, COS_L, -SIN_L); // up the card from the hinge
const _bq = new THREE.Vector3();
let boardSide = 1; // +1: last hit was on the back face, -1: on the front face

function boardT(o, d) {
  const dn = d.dot(BOARD_N);
  if (Math.abs(dn) < 1e-6) return Infinity;
  const side = dn < 0 ? 1 : -1;
  const t = ((side * CARD_T) / 2 - BOARD_N.dot(_bq.set(o.x, o.y, o.z - FRAME_Z))) / dn;
  if (!(t > EPS)) return Infinity;
  _bq.set(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t - FRAME_Z);
  const v = _bq.dot(BOARD_UP);
  if (Math.abs(_bq.x) > FRAME_W / 2 || v < 0 || v > FRAME_H) return Infinity;
  boardSide = side;
  return t;
}

function makeHit() {
  return { kind: SKY, t: 0, p: new THREE.Vector3(), n: new THREE.Vector3(0, 1, 0) };
}

// Nearest hit of the ray o + t·d (d unit length) with the scene; fills `hit`.
function castRay(o, d, hit, withBoard) {
  let t = Infinity;
  let kind = SKY;
  let side = 1;
  let s = sphereT(o, d, RED_C, RED_R);
  if (s < t) (t = s), (kind = RED);
  s = sphereT(o, d, MIR_C, MIR_R);
  if (s < t) (t = s), (kind = MIRROR);
  s = sphereT(o, d, BULB_C, BULB_R);
  if (s < t) (t = s), (kind = BULB);
  if (d.y < -1e-6) {
    s = -o.y / d.y;
    if (s > EPS && s < t) {
      const x = o.x + d.x * s;
      const z = o.z + d.z * s;
      if (Math.abs(x) <= BOX_X && z >= WALL_FACE && z <= BOX_FRONT) (t = s), (kind = GROUND);
    }
  }
  if (d.z < -1e-6) {
    s = (WALL_FACE - o.z) / d.z;
    if (s > EPS && s < t) {
      const x = o.x + d.x * s;
      const y = o.y + d.y * s;
      if (Math.abs(x) <= WALL_W / 2 && y >= 0 && y <= WALL_H) (t = s), (kind = WALL);
    }
  }
  if (withBoard) {
    s = boardT(o, d);
    if (s < t) (t = s), (kind = SCREEN), (side = boardSide);
  }
  if (kind === SKY) t = boxExit(o, d);
  hit.kind = kind;
  hit.t = t;
  hit.p.copy(o).addScaledVector(d, t);
  if (kind === RED) hit.n.subVectors(hit.p, RED_C).divideScalar(RED_R);
  else if (kind === MIRROR) hit.n.subVectors(hit.p, MIR_C).divideScalar(MIR_R);
  else if (kind === BULB) hit.n.subVectors(hit.p, BULB_C).divideScalar(BULB_R);
  else if (kind === WALL) hit.n.set(0, 0, 1);
  else if (kind === SCREEN) hit.n.copy(BOARD_N).multiplyScalar(side);
  else hit.n.set(0, 1, 0);
  return hit;
}

// ---- small builders ----

function noShadow(obj) {
  obj.traverse((o) => {
    if (o.isMesh) o.userData.noShadow = true;
  });
  return obj;
}

// A square outline (four thin bars) the size of one pixel, facing +z.
function outline(color) {
  const g = new THREE.Group();
  const mat = unlit(color);
  const w = 0.018;
  const hGeo = new THREE.BoxGeometry(PITCH + w, w, 0.006);
  const vGeo = new THREE.BoxGeometry(w, PITCH - w, 0.006);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(hGeo, mat);
    h.position.y = (s * PITCH) / 2;
    const v = new THREE.Mesh(vGeo, mat);
    v.position.x = (s * PITCH) / 2;
    g.add(h, v);
  }
  g.visible = false;
  return noShadow(g);
}

// A flat card on the page explaining the ray colours.
function legendCard(w, h) {
  const px = 512;
  const ph = Math.round((px * h) / w);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = ph;
  const g = canvas.getContext('2d');
  g.fillStyle = palette.cream;
  g.fillRect(0, 0, px, ph);
  const rows = [
    [RAY_HEX[MAT_PRIMARY], null, 'primary ray'],
    [RAY_HEX[MAT_LIT], RAY_HEX[MAT_BLOCKED], 'shadow ray'],
    [RAY_HEX[MAT_REFLECT], null, 'reflection ray'],
  ];
  const rh = ph / rows.length;
  g.font = `600 ${Math.round(rh * 0.7)}px ${FONT.body}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  rows.forEach(([a, b, text], r) => {
    const y = rh * (r + 0.5);
    const sw = 84;
    const sh = Math.max(10, Math.round(rh * 0.24));
    g.fillStyle = a;
    g.fillRect(28, y - sh / 2, b ? sw / 2 : sw, sh);
    if (b) {
      g.fillStyle = b;
      g.fillRect(28 + sw / 2, y - sh / 2, sw / 2, sh);
    }
    g.fillStyle = palette.ink;
    g.fillText(text, 136, y + 2);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const side = flat(palette.cream);
  const face = flat('#ffffff', { map: texture });
  return new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, h), [side, side, face, side, side, side]);
}

export default function create(ctx) {
  const group = new THREE.Group();

  // ---------- backdrop, folding forward onto the scene ----------
  const wallPivot = new THREE.Group();
  wallPivot.position.set(0, 0, WALL_Z);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_W, WALL_H, CARD_T), flat(palette.green));
  wall.position.y = WALL_H / 2;
  wallPivot.add(wall);
  ctx.fold.hinge(wallPivot, { from: Math.PI / 2 - 0.02, start: 0, end: 0.45 });
  group.add(wallPivot);

  // The bulb hangs from a boom that grows out of the backdrop once it stands.
  const boom = new THREE.Group();
  boom.position.set(BULB_C.x, BOOM_Y, CARD_T / 2);
  const reach = BULB_C.z - WALL_FACE;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, reach + 0.04), flat(palette.ink));
  arm.position.z = (reach + 0.04) / 2;
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.08, 10), flat(palette.grey));
  socket.position.set(0, BULB_C.y + BULB_R + 0.03 - BOOM_Y, reach);
  const bulbMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(BULB_R, 2), unlit('#ffe27a'));
  bulbMesh.position.set(0, BULB_C.y - BOOM_Y, reach);
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(BULB_R * 1.9, 2),
    unlit('#ffe27a', { transparent: true, opacity: 0.28, depthWrite: false }),
  );
  halo.position.copy(bulbMesh.position);
  noShadow(bulbMesh);
  noShadow(halo);
  boom.add(arm, socket, bulbMesh, halo);
  wallPivot.add(boom);
  ctx.fold.rise(boom, { start: 0.5, end: 0.85 });

  // ---------- the two balls ----------
  const redPivot = new THREE.Group();
  redPivot.position.set(RED_C.x, 0, RED_C.z);
  const redBall = new THREE.Mesh(new THREE.IcosahedronGeometry(RED_R, 2), flat(palette.red));
  redBall.position.y = RED_C.y;
  redPivot.add(redBall);
  group.add(ctx.fold.rise(redPivot, { start: 0.3, end: 0.7 }));

  const mirPivot = new THREE.Group();
  mirPivot.position.set(MIR_C.x, 0, MIR_C.z);
  const mirBall = new THREE.Mesh(
    new THREE.IcosahedronGeometry(MIR_R, 3),
    new THREE.MeshPhongNodeMaterial({ color: '#c3c8cf', specular: '#ffffff', shininess: 70, flatShading: true }),
  );
  mirBall.position.y = MIR_C.y;
  mirPivot.add(mirBall);
  group.add(ctx.fold.rise(mirPivot, { start: 0.38, end: 0.78 }));

  // ---------- the screen (image plane), folding forward towards the eye ----------
  const framePivot = new THREE.Group();
  framePivot.position.set(0, 0, FRAME_Z);
  framePivot.rotation.x = -LEAN;
  const board = new THREE.Mesh(new THREE.BoxGeometry(FRAME_W, FRAME_H, CARD_T), flat(palette.orange));
  board.position.y = FRAME_H / 2;
  framePivot.add(board);
  // Dark panel behind the pixels, so the gaps between tiles read as a fine grid.
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(COLS * PITCH + 0.03, ROWS * PITCH + 0.03), flat(palette.ink));
  panel.position.set(0, GRID_Y, CARD_T / 2 + 0.0015);
  framePivot.add(noShadow(panel));

  const blank = (k) => ((k % COLS) + Math.floor(k / COLS)) % 2 ? BLANK_B : BLANK_A;
  const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(TILE, TILE), unlit('#ffffff'), N);
  const m4 = new THREE.Matrix4();
  for (let k = 0; k < N; k++) {
    const i = k % COLS;
    const j = (k - i) / COLS;
    m4.makeTranslation(cellX(i), cellY(j), TILE_Z);
    tiles.setMatrixAt(k, m4);
    tiles.setColorAt(k, blank(k));
  }
  tiles.instanceMatrix.needsUpdate = true;
  tiles.instanceColor.setUsage(THREE.DynamicDrawUsage);
  tiles.instanceColor.needsUpdate = true;
  tiles.computeBoundingSphere();
  tiles.userData.noShadow = true;
  framePivot.add(tiles);

  const hoverBox = outline('#fff4c2');
  const scanBox = outline(RAY_HEX[MAT_PRIMARY]);
  framePivot.add(hoverBox, scanBox);

  ctx.fold.hinge(framePivot, { from: Math.PI / 2 - 0.02 + LEAN, start: 0.1, end: 0.55 });
  group.add(framePivot);

  // ---------- the eye ----------
  const eyeRise = new THREE.Group();
  eyeRise.position.set(0, 0, EYE_C.z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 14), flat(palette.navy));
  base.position.y = 0.02;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, EYE_C.y, 0.05), flat(palette.navy));
  post.position.y = EYE_C.y / 2;
  const ball = new THREE.Group();
  ball.position.y = EYE_C.y;
  ball.rotation.x = GAZE_PITCH;
  const white = new THREE.Mesh(new THREE.IcosahedronGeometry(EYE_R, 2), flat('#fbf6ea'));
  const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 16), flat(palette.teal));
  iris.rotation.x = Math.PI / 2;
  iris.position.z = -(EYE_R - 0.01);
  const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.036, 12), flat(palette.black));
  pupil.rotation.x = Math.PI / 2;
  pupil.position.z = -(EYE_R - 0.01);
  ball.add(white, iris, pupil);
  const tag = labelCard('eye', {
    w: 0.36, h: 0.17, standing: true, thickness: 0.012, color: palette.cream, px: 96,
    font: `700 72px ${FONT.hand}`,
  });
  tag.position.set(0, 0.42, 0.04);
  eyeRise.add(base, post, ball, tag);
  group.add(ctx.fold.rise(eyeRise, { start: 0.55, end: 0.9 }));

  // ---------- legend and button on the page ----------
  const legend = legendCard(1.42, 0.46);
  legend.position.set(-1.02, 0.01, 1.66);
  group.add(ctx.fold.rise(legend, { start: 0.6, end: 0.95 }));

  // ---------- ray pool ----------
  const rays = new THREE.Group();
  group.add(rays);
  const rayGeo = new THREE.CylinderGeometry(RAY_R, RAY_R, 1, 6, 1);
  rayGeo.translate(0, 0.5, 0); // base at the origin, growing along +y
  const dotGeo = new THREE.IcosahedronGeometry(0.042, 1);
  const rayMats = RAY_HEX.map((c) => unlit(c));
  const pool = [];
  for (let k = 0; k < POOL; k++) {
    const mesh = new THREE.Mesh(rayGeo, rayMats[0]);
    const dot = new THREE.Mesh(dotGeo, rayMats[0]);
    mesh.visible = dot.visible = false;
    mesh.userData.noShadow = dot.userData.noShadow = true;
    rays.add(mesh, dot);
    pool.push({ mesh, dot, busy: false });
  }

  // Rays and pixel markers only show while the spread is fully open.
  let open = false;
  ctx.fold.custom(
    (e, t) => {
      open = t >= 1;
      rays.visible = open;
    },
    { start: 0.97, end: 1 },
  );

  // ---------- tracing ----------
  const H1 = makeHit();
  const H2 = makeHit();
  const _c = new THREE.Vector3();
  const _d = new THREE.Vector3();
  const _r = new THREE.Vector3();
  const _o = new THREE.Vector3();
  const _e = new THREE.Vector3();
  const _toL = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _col = new THREE.Color();
  const _mix = new THREE.Color();

  const makeJob = () => ({
    active: false,
    serial: 0,
    cell: 0,
    time: 0,
    total: 0,
    hold: 0,
    fade: 1,
    nseg: 0,
    applied: false,
    color: new THREE.Color(),
    segs: [0, 1, 2].map(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), len: 0, mat: 0, t0: 0, dur: 1, vis: null, done: false, dot: true })),
  });
  const jobs = [];
  for (let k = 0; k < MAX_JOBS; k++) jobs.push(makeJob());
  let serial = 0;

  // hasDot: mark the end point (a ray that escapes into the sky gets no hit marker).
  function addSeg(job, a, b, mat, hasDot = true) {
    if (job.nseg >= 3) return;
    const seg = job.segs[job.nseg++];
    seg.a.copy(a);
    seg.b.copy(b);
    seg.len = a.distanceTo(b);
    seg.mat = mat;
    seg.dot = hasDot;
  }

  // Lambert shading with a shadow ray towards the bulb; records the shadow ray segment.
  function shade(hit, albedo, job, out) {
    _toL.subVectors(BULB_C, hit.p);
    const dist = Math.max(1e-3, _toL.length());
    _toL.divideScalar(dist);
    const ndl = hit.n.dot(_toL);
    _o.copy(hit.p).addScaledVector(hit.n, 1e-3);
    let block = 0; // facing away from the light: the surface shadows itself
    if (ndl > 0) {
      block = Math.min(sphereT(_o, _toL, RED_C, RED_R), sphereT(_o, _toL, MIR_C, MIR_R), boardT(_o, _toL));
      if (block >= dist - BULB_R) block = Infinity;
    }
    const lit = block === Infinity;
    _e.copy(_o).addScaledVector(_toL, lit ? Math.max(0, dist - BULB_R) : block);
    addSeg(job, _o, _e, lit ? MAT_LIT : MAT_BLOCKED);
    return out.copy(albedo).multiplyScalar(AMBIENT + (1 - AMBIENT) * (lit ? ndl : 0));
  }

  function surfaceColour(hit, job, out) {
    if (hit.kind === SKY) return out.copy(SKY_COL);
    if (hit.kind === BULB) return out.copy(BULB_COL);
    return shade(hit, ALBEDO[hit.kind], job, out);
  }

  function traceCell(k, job) {
    job.nseg = 0;
    const i = k % COLS;
    const j = (k - i) / COLS;
    onScreen(cellX(i), cellY(j), TILE_Z, _c);
    _d.subVectors(_c, EYE).normalize();
    castRay(EYE, _d, H1, false);
    addSeg(job, EYE, H1.p, MAT_PRIMARY, H1.kind !== SKY);
    if (H1.kind === MIRROR) {
      _r.copy(_d).addScaledVector(H1.n, -2 * _d.dot(H1.n)).normalize();
      _o.copy(H1.p).addScaledVector(H1.n, 1e-3);
      castRay(_o, _r, H2, true);
      addSeg(job, _o, H2.p, MAT_REFLECT, H2.kind !== SKY);
      surfaceColour(H2, job, _mix);
      job.color.copy(_mix).multiplyScalar(MIRROR_K);
      _col.copy(SILVER_COL).multiplyScalar(1 - MIRROR_K);
      job.color.add(_col);
    } else {
      surfaceColour(H1, job, job.color);
    }
  }

  // ---------- pixel colours ----------
  const target = new Float32Array(N * 3);
  const flash = new Float32Array(N);
  let flashing = false;

  function setBlank(k) {
    const c = blank(k);
    target[k * 3] = c.r;
    target[k * 3 + 1] = c.g;
    target[k * 3 + 2] = c.b;
    flash[k] = 0;
    tiles.setColorAt(k, c);
  }
  for (let k = 0; k < N; k++) setBlank(k);

  function applyColour(job) {
    job.applied = true;
    const k = job.cell;
    target[k * 3] = job.color.r;
    target[k * 3 + 1] = job.color.g;
    target[k * 3 + 2] = job.color.b;
    flash[k] = 1;
    flashing = true;
  }

  function updateCells(dt) {
    if (!flashing) return;
    flashing = false;
    for (let k = 0; k < N; k++) {
      if (flash[k] <= 0) continue;
      flash[k] = Math.max(0, flash[k] - dt * 3);
      const f = flash[k] * flash[k];
      _col.setRGB(target[k * 3], target[k * 3 + 1], target[k * 3 + 2]).lerp(WHITE, f * 0.85);
      tiles.setColorAt(k, _col);
      if (flash[k] > 0) flashing = true;
    }
    tiles.instanceColor.needsUpdate = true;
  }

  // ---------- jobs: one traced pixel, its rays growing one after another ----------
  function releaseJob(job) {
    for (let s = 0; s < 3; s++) {
      const v = job.segs[s].vis;
      if (!v) continue;
      v.busy = false;
      v.mesh.visible = false;
      v.dot.visible = false;
      job.segs[s].vis = null;
    }
    job.active = false;
  }

  function finishOldest() {
    let oldest = null;
    for (let k = 0; k < MAX_JOBS; k++) {
      const job = jobs[k];
      if (job.active && (!oldest || job.serial < oldest.serial)) oldest = job;
    }
    if (!oldest) return false;
    if (!oldest.applied) applyColour(oldest);
    releaseJob(oldest);
    return true;
  }

  function freeJob() {
    for (let k = 0; k < MAX_JOBS; k++) if (!jobs[k].active) return jobs[k];
    return null;
  }

  function freeVisCount() {
    let n = 0;
    for (let k = 0; k < POOL; k++) if (!pool[k].busy) n++;
    return n;
  }

  function takeVis() {
    for (let k = 0; k < POOL; k++) if (!pool[k].busy) return pool[k];
    return null;
  }

  function launch(k, fast) {
    if (!(k >= 0 && k < N)) return;
    let job = freeJob();
    if (!job) {
      finishOldest();
      job = freeJob();
      if (!job) return;
    }
    traceCell(k, job);
    while (freeVisCount() < job.nseg && finishOldest());
    job.active = true;
    job.serial = ++serial;
    job.cell = k;
    job.time = 0;
    job.applied = false;
    const speed = fast ? 15 : 4.2;
    let t = 0;
    for (let s = 0; s < job.nseg; s++) {
      const seg = job.segs[s];
      seg.t0 = t;
      seg.dur = Math.max(0.05, seg.len / speed);
      seg.done = false;
      t += seg.dur;
      const v = takeVis();
      seg.vis = v;
      if (!v) continue;
      v.busy = true;
      const mat = rayMats[seg.mat];
      v.mesh.material = mat;
      v.dot.material = mat;
      v.mesh.position.copy(seg.a);
      if (seg.len > 1e-4) {
        _dir.subVectors(seg.b, seg.a).divideScalar(seg.len);
        v.mesh.quaternion.setFromUnitVectors(UP, _dir);
      }
      v.mesh.scale.set(1, 1e-4, 1);
      v.mesh.visible = false;
      v.dot.position.copy(seg.b);
      v.dot.scale.setScalar(1);
      v.dot.visible = false;
    }
    job.total = t;
    job.hold = fast ? 0.06 : 1.8;
    job.fade = fast ? 0.2 : 0.5;
  }

  let bulbFlash = 0;

  function updateJobs(dt) {
    for (let q = 0; q < MAX_JOBS; q++) {
      const job = jobs[q];
      if (!job.active) continue;
      job.time += dt;
      const tau = job.time;
      const fadeT = (tau - job.total - job.hold) / job.fade;
      const thick = fadeT > 0 ? Math.max(1e-3, 1 - smooth(clamp01(fadeT))) : 1;
      for (let s = 0; s < job.nseg; s++) {
        const seg = job.segs[s];
        const v = seg.vis;
        if (!v) continue;
        const g = clamp01((tau - seg.t0) / seg.dur);
        v.mesh.visible = tau >= seg.t0 && seg.len > 1e-3;
        v.mesh.scale.set(thick, Math.max(1e-4, seg.len * g), thick);
        if (g >= 1) {
          if (!seg.done) {
            seg.done = true;
            if (seg.mat === MAT_LIT) bulbFlash = 1;
          }
          const pop = 1 + 0.8 * (1 - clamp01((tau - seg.t0 - seg.dur) / 0.25));
          v.dot.visible = seg.dot;
          v.dot.scale.setScalar(pop * thick);
        }
      }
      if (!job.applied && tau >= job.total) applyColour(job);
      if (fadeT >= 1) releaseJob(job);
    }
  }

  // ---------- scanning all pixels ----------
  let scanning = false;
  let scanNext = 0;
  let scanClock = 0;
  let hoverCell = -1;

  function placeBox(box, k) {
    const i = k % COLS;
    const j = (k - i) / COLS;
    box.position.set(cellX(i), cellY(j), TILE_Z + 0.006);
  }

  function clearImage() {
    scanning = false;
    for (let k = 0; k < MAX_JOBS; k++) if (jobs[k].active) releaseJob(jobs[k]);
    for (let k = 0; k < N; k++) setBlank(k);
    flashing = false;
    tiles.instanceColor.needsUpdate = true;
  }

  // Label shows what the next click does: trace everything, then clear the picture.
  const scanButton = button(ctx, {
    labels: ['Trace all pixels', 'Clear image'],
    position: [1.02, 0, 1.68],
    w: 1.46,
    h: 0.3,
    color: palette.yellow,
    onChange(index) {
      clearImage();
      if (index === 1) {
        scanning = true;
        scanNext = 0;
        scanClock = 0;
      }
    },
  });
  group.add(scanButton.mesh);

  ctx.interactive(tiles, {
    cursor: 'crosshair',
    onClick(hit) {
      const k = hit?.instanceId;
      if (k != null) launch(k, false);
    },
    onHover(hit) {
      const k = hit?.instanceId;
      hoverCell = k != null ? k : -1;
      if (hoverCell >= 0) placeBox(hoverBox, hoverCell);
    },
  });

  return {
    group,
    hint: 'Click a pixel to trace its ray',
    update(dt, time) {
      if (scanning) {
        scanClock -= dt;
        while (scanning && scanClock <= 0) {
          placeBox(scanBox, scanNext);
          launch(scanNext, true);
          scanNext++;
          scanClock += SCAN_STEP;
          if (scanNext >= N) scanning = false;
        }
      }
      updateJobs(dt);
      updateCells(dt);
      hoverBox.visible = open && hoverCell >= 0;
      scanBox.visible = open && scanning;
      bulbFlash = Math.max(0, bulbFlash - dt * 2.5);
      halo.scale.setScalar(1 + 0.06 * Math.sin(time * 2.4) + 0.7 * bulbFlash);
    },
  };
}

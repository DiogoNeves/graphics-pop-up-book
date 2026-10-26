import * as THREE from 'three/webgpu';
import { flat, unlit, palette, labelCard, button, FONT, clamp01, smooth, easeOutBack } from '../kit.js';

// 2D rasterisation pegboard: a 16×12 grid of pixel tiles on a raised board. Two pins mark a
// line; Bresenham's algorithm (integer-only, all octants) picks the tiles that rise. A red
// thread shows the exact line so the staircase is visible. "Triangle" mode adds a third pin
// and raises every tile whose centre passes the three edge-function tests.

const COLS = 16;
const ROWS = 12;
const N = COLS * ROWS;
const PITCH = 0.2;
const TILE = 0.17;
const FLAT_H = 0.035;
const RAISED_H = 0.18;
const BOARD_W = COLS * PITCH + 0.24; // 3.44
const BOARD_D = ROWS * PITCH + 0.24; // 2.64
const SLAB_T = 0.04;
const LEG_H = 0.3; // platform height when open
const CLOSED_Y = 0.02; // platform height when folded flat
const BOARD_Z = -0.55; // platform centre (open)
const WALL_INSET = 0.14;
const PIN_H = 0.56;
const PIN_R = 0.03;
const HEAD_R = 0.085;
const HEAD_Y = PIN_H + 0.03;
const THREAD_Y = SLAB_T + RAISED_H + 0.025;
const THREAD_R = 0.014;
const LIFT = 0.08;

const cellX = (c) => (c - (COLS - 1) / 2) * PITCH;
const cellZ = (r) => (r - (ROWS - 1) / 2) * PITCH;
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const colOf = (x) => clampInt(Math.round(x / PITCH + (COLS - 1) / 2), 0, COLS - 1);
const rowOf = (z) => clampInt(Math.round(z / PITCH + (ROWS - 1) / 2), 0, ROWS - 1);
// Edge function: > 0 when p is on the left of a→b (in grid coordinates).
const edgeFn = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);

export default function create(ctx) {
  const group = new THREE.Group();

  // ---- base: a platform held up by two hinged walls (parallelogram fold) ----
  const wallMat = flat(palette.navy);
  const wallGeo = new THREE.BoxGeometry(BOARD_W - 0.3, LEG_H, 0.03);
  const walls = [BOARD_Z + BOARD_D / 2 - WALL_INSET, BOARD_Z - BOARD_D / 2 + WALL_INSET].map((z) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, z);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = LEG_H / 2;
    pivot.add(wall);
    group.add(pivot);
    return pivot;
  });

  const platform = new THREE.Group();
  platform.position.set(0, LEG_H, BOARD_Z);
  group.add(platform);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, SLAB_T, BOARD_D), flat(palette.blue));
  slab.position.y = SLAB_T / 2;
  platform.add(slab);

  // Walls tilt back about their bottom edges; the board rides on top, staying level.
  ctx.fold.custom(
    (e) => {
      const th = ((1 - e) * Math.PI) / 2;
      walls[0].rotation.x = -th;
      walls[1].rotation.x = -th;
      platform.position.set(0, CLOSED_Y + (LEG_H - CLOSED_Y) * Math.cos(th), BOARD_Z - LEG_H * Math.sin(th));
    },
    { start: 0, end: 0.5 },
  );

  // ---- pixel tiles (one InstancedMesh, per-instance height and colour) ----
  const tilesGroup = new THREE.Group();
  tilesGroup.position.y = SLAB_T;
  platform.add(tilesGroup);
  const tileGeo = new THREE.BoxGeometry(TILE, 1, TILE);
  tileGeo.translate(0, 0.5, 0);
  const tiles = new THREE.InstancedMesh(tileGeo, flat('#ffffff'), N);
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tiles.frustumCulled = false;
  tilesGroup.add(tiles);

  const tx = new Float32Array(N);
  const tz = new Float32Array(N);
  const cur = new Float32Array(N);
  const vel = new Float32Array(N);
  const tgt = new Float32Array(N);
  const wait = new Float32Array(N);
  const sel = new Uint8Array(N);
  const prevSel = new Uint8Array(N);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      tx[i] = cellX(c);
      tz[i] = cellZ(r);
    }
  }

  const m4 = new THREE.Matrix4();
  const creamC = new THREE.Color(palette.cream);
  const inkC = new THREE.Color(palette.ink);
  const tmpC = new THREE.Color();
  function writeTile(i) {
    const h = Math.max(0.005, cur[i]);
    m4.makeScale(1, h, 1);
    m4.setPosition(tx[i], 0, tz[i]);
    tiles.setMatrixAt(i, m4);
    tmpC.copy(creamC).lerp(inkC, clamp01((h - FLAT_H) / (RAISED_H - FLAT_H)));
    tiles.setColorAt(i, tmpC);
  }
  // Bounding sphere sized for fully raised tiles (used for picking), then start flat.
  for (let i = 0; i < N; i++) {
    cur[i] = RAISED_H;
    writeTile(i);
  }
  tiles.computeBoundingSphere();
  for (let i = 0; i < N; i++) {
    cur[i] = tgt[i] = FLAT_H;
    writeTile(i);
  }
  tiles.instanceColor.setUsage(THREE.DynamicDrawUsage);

  // Tiles grow out of the board; each time the page opens, replay the drawing order.
  let tileFolded = true;
  let tilesAnimating = false;
  ctx.fold.custom(
    (e, t) => {
      tilesGroup.scale.y = Math.max(1e-3, e);
      tilesGroup.visible = t > 0;
      if (t <= 0) tileFolded = true;
      else if (tileFolded) {
        tileFolded = false;
        replay();
      }
    },
    { start: 0.3, end: 0.7 },
  );

  // ---- pins ----
  const shaftGeo = new THREE.CylinderGeometry(PIN_R, PIN_R, PIN_H, 8);
  const shaftMat = flat(palette.grey);
  const headGeo = new THREE.IcosahedronGeometry(HEAD_R, 1);
  const proxyGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
  const proxyMat = new THREE.MeshBasicNodeMaterial({ visible: false });

  let drag = null; // { pin, planeY, offX, offZ }
  const pins = [];

  function makePin(color, c, r, active, start, end) {
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    outer.add(inner);
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = PIN_H / 2;
    const head = new THREE.Mesh(headGeo, flat(color));
    head.position.y = HEAD_Y;
    const proxy = new THREE.Mesh(proxyGeo, proxyMat);
    proxy.position.y = 0.4;
    proxy.userData.noShadow = true;
    inner.add(shaft, head, proxy);
    outer.position.set(cellX(c), SLAB_T, cellZ(r));
    platform.add(outer);
    ctx.fold.rise(outer, { start, end });

    const pin = { outer, inner, head, c, r, x: cellX(c), z: cellZ(r), active, p: active ? 1 : 0, lift: 0, hover: false, headScale: 1 };
    inner.visible = active;
    inner.scale.setScalar(active ? 1 : 1e-3);
    pins.push(pin);

    ctx.interactive(outer, {
      cursor: 'grab',
      onDown(hit, ray) {
        if (!pin.active) return false;
        const planeY = platform.position.y + SLAB_T + HEAD_Y;
        const p = ctx.pagePoint(ray, planeY);
        const ok = p && Number.isFinite(p.x) && Number.isFinite(p.z);
        drag = {
          pin,
          planeY,
          offX: ok ? platform.position.x + cellX(pin.c) - p.x : 0,
          offZ: ok ? platform.position.z + cellZ(pin.r) - p.z : 0,
        };
        return true;
      },
      onDrag: dragTo,
      onUp() {
        drag = null;
      },
      onHover(hit) {
        pin.hover = !!hit;
      },
    });
    return pin;
  }

  const A = makePin(palette.orange, 2, 9, true, 0.55, 0.9);
  const B = makePin(palette.teal, 13, 4, true, 0.6, 0.95);
  const C = makePin(palette.purple, 7, 1, false, 0.65, 1);

  function occupied(pin, c, r) {
    for (let k = 0; k < pins.length; k++) {
      const o = pins[k];
      if (o !== pin && o.active && o.c === c && o.r === r) return true;
    }
    return false;
  }

  function movePin(pin, c, r) {
    if (pin.c === c && pin.r === r) return;
    if (occupied(pin, c, r)) return;
    pin.c = c;
    pin.r = r;
    rasterize();
  }

  function dragTo(ray) {
    if (!drag) return;
    const p = ctx.pagePoint(ray, drag.planeY);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
    movePin(drag.pin, colOf(p.x + drag.offX - platform.position.x), rowOf(p.z + drag.offZ - platform.position.z));
  }

  // Grab anywhere on the board: the nearest pin jumps to that tile and follows the pointer.
  const hitLocal = new THREE.Vector3();
  const boardHandlers = {
    cursor: 'pointer',
    onDown(hit, ray) {
      let c;
      let r;
      if (hit.object === tiles && Number.isInteger(hit.instanceId)) {
        c = hit.instanceId % COLS;
        r = Math.floor(hit.instanceId / COLS);
      } else {
        platform.worldToLocal(hitLocal.copy(hit.point));
        if (!Number.isFinite(hitLocal.x) || !Number.isFinite(hitLocal.z)) return false;
        c = colOf(hitLocal.x);
        r = rowOf(hitLocal.z);
      }
      let best = null;
      let bestD = Infinity;
      for (let k = 0; k < pins.length; k++) {
        const pin = pins[k];
        if (!pin.active) continue;
        const d = (pin.c - c) ** 2 + (pin.r - r) ** 2;
        if (d < bestD) {
          bestD = d;
          best = pin;
        }
      }
      if (!best) return false;
      drag = { pin: best, planeY: platform.position.y + SLAB_T + FLAT_H, offX: 0, offZ: 0 };
      movePin(best, c, r);
      return true;
    },
    onDrag: dragTo,
    onUp() {
      drag = null;
    },
  };
  ctx.interactive(tiles, boardHandlers);
  ctx.interactive(slab, boardHandlers);

  // ---- threads: the exact mathematical edges ----
  const threadGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  const threadMat = unlit(palette.red);
  const threads = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(threadGeo, threadMat);
    m.userData.noShadow = true;
    m.visible = false;
    platform.add(m);
    return m;
  });
  let threadFold = 1;
  ctx.fold.custom(
    (e) => {
      threadFold = Math.max(0, e);
    },
    { start: 0.75, end: 1 },
  );
  const UP = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  function setThread(m, ax, az, bx, bz, radius) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (!(radius > 1e-4) || !(len > 1e-3)) {
      m.visible = false;
      return;
    }
    m.visible = true;
    m.position.set((ax + bx) / 2, THREAD_Y, (az + bz) / 2);
    dir.set(dx / len, 0, dz / len);
    m.quaternion.setFromUnitVectors(UP, dir);
    m.scale.set(radius, len, radius);
  }
  function placeThreads() {
    const r = THREAD_R * threadFold;
    setThread(threads[0], A.x, A.z, B.x, B.z, r);
    const rc = r * smooth(clamp01(C.p));
    setThread(threads[1], B.x, B.z, C.x, C.z, rc);
    setThread(threads[2], C.x, C.z, A.x, A.z, rc);
  }

  // ---- caption and mode button ----
  const label = labelCard('', { w: 3.0, h: 0.3, color: palette.paper, px: 96, font: `italic 400 54px ${FONT.body}` });
  label.position.set(0, 0.015, 1.1);
  let labelText = '';
  function setLabel(text) {
    if (text === labelText) return;
    labelText = text;
    label.userData.setText(text);
  }

  let mode = 0; // 0 line, 1 triangle
  const modeButton = button(ctx, {
    labels: ['Line', 'Triangle'],
    position: [0, 0, 1.62],
    w: 1.3,
    color: palette.orange,
    onChange: (i) => setMode(i),
  });
  group.add(modeButton.mesh);

  // ---- rasterisation ----
  const order = []; // selected tile indices in drawing order

  // Bresenham's line algorithm: integer error term, every octant.
  function bresenham(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (let guard = 0; guard < 64; guard++) {
      order.push(y * COLS + x);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // A tile is inside when its centre is on the inner side of all three edges.
  function triangle(a, b, c) {
    const area = edgeFn(a.c, a.r, b.c, b.r, c.c, c.r);
    if (area === 0) return 0;
    const s = area > 0 ? 1 : -1;
    const c0 = Math.min(a.c, b.c, c.c);
    const c1 = Math.max(a.c, b.c, c.c);
    const r0 = Math.min(a.r, b.r, c.r);
    const r1 = Math.max(a.r, b.r, c.r);
    for (let y = r0; y <= r1; y++) {
      for (let x = c0; x <= c1; x++) {
        const w0 = s * edgeFn(b.c, b.r, c.c, c.r, x, y);
        const w1 = s * edgeFn(c.c, c.r, a.c, a.r, x, y);
        const w2 = s * edgeFn(a.c, a.r, b.c, b.r, x, y);
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) order.push(y * COLS + x);
      }
    }
    return area;
  }

  function rasterize() {
    prevSel.set(sel);
    sel.fill(0);
    order.length = 0;
    let area = 1;
    if (mode === 0) bresenham(A.c, A.r, B.c, B.r);
    else area = triangle(A, B, C);

    // New tiles rise in drawing order (quickly while dragging).
    const step = drag ? 0.012 : mode === 0 ? 0.05 : 0.015;
    const cap = mode === 0 ? 0.8 : 0.9;
    let firstNew = -1;
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      sel[i] = 1;
      if (!prevSel[i]) {
        if (firstNew < 0) firstNew = k;
        wait[i] = Math.min(cap, (k - firstNew) * step);
      }
    }
    for (let i = 0; i < N; i++) {
      tgt[i] = sel[i] ? RAISED_H : FLAT_H;
      if (!sel[i]) wait[i] = 0;
    }
    tilesAnimating = true;

    const n = order.length;
    const px = n === 1 ? 'pixel' : 'pixels';
    if (mode === 0) setLabel(`Bresenham’s line: ${n} ${px}`);
    else if (area === 0) setLabel('Edge functions: no area, 0 pixels');
    else setLabel(`Edge functions: ${n} ${px} inside`);
  }

  function replay() {
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      cur[i] = FLAT_H;
      vel[i] = 0;
      wait[i] = 0.15 + Math.min(0.9, k * (mode === 0 ? 0.05 : 0.015));
      writeTile(i);
    }
    tiles.instanceMatrix.needsUpdate = true;
    tiles.instanceColor.needsUpdate = true;
    tilesAnimating = true;
  }

  function nearestFreeCell(pin, c, r) {
    let best = null;
    let bestD = Infinity;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (occupied(pin, x, y)) continue;
        const d = (x - c) ** 2 + (y - r) ** 2;
        if (d < bestD) {
          bestD = d;
          best = [x, y];
        }
      }
    }
    return best;
  }

  function setMode(m) {
    mode = m === 1 ? 1 : 0;
    C.active = mode === 1;
    if (C.active) {
      if (occupied(C, C.c, C.r)) {
        const cell = nearestFreeCell(C, C.c, C.r);
        if (cell) [C.c, C.r] = cell;
      }
      C.x = cellX(C.c);
      C.z = cellZ(C.r);
    }
    rasterize();
  }

  // Initial picture: settle tiles immediately (replay() animates them on page open).
  rasterize();
  for (let i = 0; i < N; i++) {
    cur[i] = tgt[i];
    wait[i] = 0;
    writeTile(i);
  }
  tiles.instanceMatrix.needsUpdate = true;
  tiles.instanceColor.needsUpdate = true;
  tilesAnimating = false;
  placeThreads();

  function updateTiles(dt) {
    if (!tilesAnimating) return;
    const h = Math.min(dt, 1 / 30);
    let moving = false;
    let dirty = false;
    for (let i = 0; i < N; i++) {
      const target = tgt[i];
      if (cur[i] === target && vel[i] === 0) continue;
      moving = true;
      if (wait[i] > 0) {
        wait[i] -= dt;
        continue;
      }
      // Slightly springy rise.
      let v = vel[i] + ((target - cur[i]) * 320 - vel[i] * 24) * h;
      let y = cur[i] + v * h;
      if (Math.abs(target - y) < 2e-4 && Math.abs(v) < 2e-3) {
        y = target;
        v = 0;
      }
      cur[i] = y;
      vel[i] = v;
      writeTile(i);
      dirty = true;
    }
    if (dirty) {
      tiles.instanceMatrix.needsUpdate = true;
      tiles.instanceColor.needsUpdate = true;
    }
    tilesAnimating = moving;
  }

  return {
    group,
    hint: 'Drag pins; tap the button for triangles',
    update(dt) {
      const k = 1 - Math.exp(-Math.max(0, dt) * 18);
      for (let n = 0; n < pins.length; n++) {
        const pin = pins[n];
        pin.x += (cellX(pin.c) - pin.x) * k;
        pin.z += (cellZ(pin.r) - pin.z) * k;
        const dragging = drag !== null && drag.pin === pin;
        pin.lift += ((dragging ? LIFT : 0) - pin.lift) * k;
        pin.outer.position.set(pin.x, SLAB_T + pin.lift, pin.z);

        // Appear / disappear (third pin in triangle mode).
        const pt = pin.active ? 1 : 0;
        if (pin.p !== pt) {
          pin.p = pt > pin.p ? Math.min(1, pin.p + dt * 3.5) : Math.max(0, pin.p - dt * 3.5);
          const s = pin.p >= 1 ? 1 : pin.p <= 0 ? 0 : easeOutBack(pin.p, 1.6);
          pin.inner.scale.setScalar(Math.max(1e-3, s));
          pin.inner.visible = pin.p > 0;
        }

        const hs = pin.hover || dragging ? 1.25 : 1;
        pin.headScale += (hs - pin.headScale) * k;
        pin.head.scale.setScalar(pin.headScale);
      }
      updateTiles(dt);
      placeThreads();
    },
  };
}

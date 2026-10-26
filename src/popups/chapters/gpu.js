import * as THREE from 'three/webgpu';
import { flat, palette, labelCard, screen, pullTab, textTexture, clamp01, smooth, easeOutBack, FONT } from '../kit.js';

// CPU vs GPU race: two monitors draw the same 32×24 pixel picture. The CPU has 4 fast cores
// that each colour one pixel at a time in scanline order; the GPU has 64 slower cores that
// colour a whole 8×8 block of pixels at once. Pull the RACE tab to (re)start.

const COLS = 32;
const ROWS = 24;
const N = COLS * ROWS; // 768 pixels
const TILE = 8; // GPU block edge: 8×8 = 64 cores, one pixel each
const TILES_X = COLS / TILE; // 4
const TILES = TILES_X * (ROWS / TILE); // 12 blocks
const CPU_N = 4;
const GPU_N = TILE * TILE;
const T_CPU = 0.08; // seconds one CPU core spends on one pixel
const T_GPU = 0.42; // seconds one GPU core spends on one pixel (about 5× slower)
const Q_CPU = T_CPU / CPU_N; // CPU cores start staggered, so pixels finish one after another
const CPU_TOTAL = (N - 1) * Q_CPU + T_CPU; // ≈ 15.4 s
const GPU_TOTAL = TILES * T_GPU; // ≈ 5.0 s

// Screen canvas: 8 canvas pixels per picture pixel (7 lit + 1 dark gap).
const CELL = 8;
const CW = COLS * CELL; // 256
const CH = ROWS * CELL; // 192
const TS = TILE * CELL; // one GPU block in canvas pixels
const GAP = '#0b0d10';
const EMPTY = '#1c232b';
const IDLE = '#3d3732';
const RO_FONT = '600 34px ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace';

const READY = 0;
const RACING = 1;
const DONE = 2;

// Layout (pop-up local units).
const SIDE_X = 0.9;
const Z_HINGE = -0.75;
const LEAN = 0.3; // monitors lean back a little so the screens face the reader
const CARD_W = 1.62;
const CARD_H = 1.86;
const CARD_T = 0.03;
const SCR_W = 1.36;
const SCR_H = (SCR_W * ROWS) / COLS; // 1.02
const SCR_Y = 0.93;
const RO_H = 0.24;
const RO_Y = 0.22;
const TITLE_Y = 1.64;
const CHIP_Z = 0.32;
const PLATE = 1.4;
const PLATE_H = 0.06;
const DIE = 1.28;
const DIE_H = 0.014;
const CORE_Y = PLATE_H + DIE_H;

// A retro sunset over two hills, as a 32×24 grid of CSS colours.
const SKY = [palette.navy, palette.purple, palette.red, palette.orange];
const STARS = new Set([[3, 1], [8, 3], [13, 0], [21, 2], [27, 1], [30, 3], [17, 1], [1, 3], [24, 0]].map(([x, y]) => y * COLS + x));
function sunset(x, y) {
  const front = 20.3 + 1.2 * Math.sin(x * 0.4 + 2.0);
  const back = 16.6 + 1.5 * Math.sin(x * 0.27 + 0.3) + 0.5 * Math.sin(x * 0.7 + 1.0);
  if (y >= front) return (x * 7 + y * 3) % 11 === 0 ? '#4f8a6a' : palette.green;
  if (y >= back) return palette.teal;
  const dx = x + 0.5 - 16;
  const dy = y + 0.5 - 12.5;
  if (dx * dx + dy * dy <= 42 && !(dy > 0.5 && y % 2 === 1)) return palette.yellow;
  if (STARS.has(y * COLS + x)) return palette.cream;
  let b = Math.min(3, Math.floor(y / 4));
  if (y % 4 === 3 && b < 3 && (x + y) % 2 === 0) b++;
  return SKY[b];
}

function gridCanvas(fill) {
  const c = document.createElement('canvas');
  c.width = CW;
  c.height = CH;
  const g = c.getContext('2d');
  g.fillStyle = GAP;
  g.fillRect(0, 0, CW, CH);
  for (let i = 0; i < N; i++) {
    g.fillStyle = fill(i);
    g.fillRect((i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL - 1, CELL - 1);
  }
  return c;
}

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const g = c.getContext('2d');
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 6; x++) {
      g.fillStyle = (x + y) % 2 ? palette.ink : palette.cream;
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function create(ctx) {
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4();
  const tmpCol = new THREE.Color();
  const idleCol = new THREE.Color(IDLE);

  // ---- the picture ----
  const pixCss = new Array(N);
  const pixLit = new Array(N); // core colour while working on that pixel (a little brighter)
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < N; i++) {
    pixCss[i] = sunset(i % COLS, Math.floor(i / COLS));
    pixLit[i] = new THREE.Color(pixCss[i]).lerp(white, 0.18);
  }
  const fullCanvas = gridCanvas((i) => pixCss[i]);
  const emptyCanvas = gridCanvas(() => EMPTY);

  // ---- materials and shared geometry ----
  const bezelMat = flat(palette.card);
  const recessMat = flat(palette.black);
  const plateMat = flat('#2f2a26');
  const dieMat = flat(palette.grey);
  const pinMat = flat('#b9b0a2');
  const footGeo = new THREE.BoxGeometry(0.8, 0.05, 0.34);
  footGeo.translate(0, 0.025, 0);
  const plateGeo = new THREE.BoxGeometry(PLATE, PLATE_H, PLATE);
  plateGeo.translate(0, PLATE_H / 2, 0);
  const dieGeo = new THREE.BoxGeometry(DIE, DIE_H, DIE);
  dieGeo.translate(0, PLATE_H + DIE_H / 2, 0);
  const pinGeo = new THREE.BoxGeometry(0.16, 0.024, 0.08);

  // ---- monitors ----
  function monitor(x, title, accent, ink, start, end) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, Z_HINGE);
    pivot.rotation.x = -LEAN;

    const card = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, CARD_H, CARD_T), bezelMat);
    card.position.set(0, CARD_H / 2, CARD_T / 2);
    pivot.add(card);

    const recess = new THREE.Mesh(new THREE.BoxGeometry(SCR_W + 0.1, SCR_H + 0.1, 0.012), recessMat);
    recess.position.set(0, SCR_Y, CARD_T + 0.006);
    pivot.add(recess);
    const img = screen(SCR_W, SCR_H, { px: CW, background: GAP });
    img.texture.magFilter = THREE.NearestFilter;
    img.mesh.position.set(0, SCR_Y, CARD_T + 0.014);
    pivot.add(img.mesh);

    const roRecess = new THREE.Mesh(new THREE.BoxGeometry(SCR_W + 0.06, RO_H + 0.06, 0.012), recessMat);
    roRecess.position.set(0, RO_Y, CARD_T + 0.006);
    pivot.add(roRecess);
    const ro = screen(SCR_W, RO_H, { px: 512, background: GAP });
    ro.mesh.position.set(0, RO_Y, CARD_T + 0.014);
    pivot.add(ro.mesh);

    const label = labelCard(title, {
      w: 0.8, h: 0.28, standing: true, thickness: 0.012, color: accent, ink, px: 128,
      font: `600 80px ${FONT.title}`,
    });
    label.position.set(0, TITLE_Y, CARD_T + 0.006);
    pivot.add(label);

    // A low foot the card slots into, so it reads as a monitor on a stand.
    const foot = new THREE.Mesh(footGeo, bezelMat);
    foot.position.set(x, 0, Z_HINGE + 0.15);
    group.add(ctx.fold.rise(foot, { start, end }));

    // Folds back flat (rest is -LEAN, so swing a little less than 90°).
    ctx.fold.hinge(pivot, { from: -(Math.PI / 2 - 0.02 - LEAN), start, end });
    group.add(pivot);
    return { pivot, img, ro, roState: { done: -1, tenths: -1, mode: -1 } };
  }

  function medal(mon, text, ribbon) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 20), flat(palette.orange));
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
    const tt = textTexture(text, { width: 128, height: 128, font: `600 56px ${FONT.title}`, background: palette.yellow, color: palette.ink });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.145, 20), flat('#ffffff', { map: tt.texture }));
    face.position.z = 0.017;
    g.add(face);
    const ribbonGeo = new THREE.BoxGeometry(0.08, 0.24, 0.012);
    const ribbonMat = flat(ribbon);
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(ribbonGeo, ribbonMat);
      r.position.set(s * 0.06, -0.2, -0.012);
      r.rotation.z = s * 0.3;
      g.add(r);
    }
    g.position.set(0.6, CARD_H - 0.02, CARD_T + 0.03);
    g.scale.setScalar(1e-4);
    g.visible = false;
    mon.pivot.add(g);
    return { group: g, shown: false, age: 0 };
  }

  const cpuMon = monitor(-SIDE_X, 'CPU', palette.orange, palette.ink, 0.05, 0.55);
  const gpuMon = monitor(SIDE_X, 'GPU', palette.teal, palette.cream, 0.12, 0.62);
  const cpuMedal = medal(cpuMon, '2nd', palette.blue);
  const gpuMedal = medal(gpuMon, '1st', palette.red);

  // ---- chips ----
  function chip(x, start, end) {
    const g = new THREE.Group();
    g.position.set(x, 0, CHIP_Z);
    g.add(new THREE.Mesh(plateGeo, plateMat));
    g.add(new THREE.Mesh(dieGeo, dieMat));
    const pins = new THREE.InstancedMesh(pinGeo, pinMat, 12);
    for (let i = 0; i < 12; i++) {
      const side = i < 6 ? -1 : 1;
      m4.makeTranslation(side * (PLATE / 2 + 0.04), 0.02, ((i % 6) - 2.5) * 0.21);
      pins.setMatrixAt(i, m4);
    }
    pins.computeBoundingSphere();
    g.add(pins);
    group.add(ctx.fold.rise(g, { start, end }));
    return g;
  }

  const cpuChip = chip(-SIDE_X, 0.35, 0.7);
  const gpuChip = chip(SIDE_X, 0.4, 0.75);

  // CPU: 4 big cores in a 2×2 block (reading order = consecutive pixels).
  const cpuGeo = new THREE.BoxGeometry(0.48, 0.3, 0.48);
  cpuGeo.translate(0, 0.15, 0);
  const cpuCores = [];
  const cpuMats = [];
  for (let k = 0; k < CPU_N; k++) {
    const mat = flat(IDLE);
    const mesh = new THREE.Mesh(cpuGeo, mat);
    mesh.position.set(((k % 2) - 0.5) * 0.6, CORE_Y, (Math.floor(k / 2) - 0.5) * 0.6);
    cpuChip.add(ctx.fold.rise(mesh, { start: 0.55 + k * 0.05, end: 0.8 + k * 0.05 }));
    cpuCores.push(mesh);
    cpuMats.push(mat);
  }

  // GPU: 8×8 tiny cores, one instanced mesh. Core (c, r) works on pixel (c, r) of the block;
  // row 0 sits at the back so the grid mirrors the block as seen on the screen.
  const gpuGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  gpuGeo.translate(0, 0.06, 0);
  const gpuCores = new THREE.InstancedMesh(gpuGeo, flat('#ffffff'), GPU_N);
  gpuCores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  gpuCores.frustumCulled = false; // instance matrices change, so a cached bounding sphere would go stale
  gpuCores.position.y = CORE_Y;
  const gpuX = new Float32Array(GPU_N);
  const gpuZ = new Float32Array(GPU_N);
  const gpuFold = new Float32Array(GPU_N).fill(1);
  const gpuLift = new Float32Array(GPU_N);
  for (let i = 0; i < GPU_N; i++) {
    gpuX[i] = ((i % TILE) - 3.5) * 0.16;
    gpuZ[i] = (Math.floor(i / TILE) - 3.5) * 0.16;
    gpuCores.setColorAt(i, idleCol);
  }
  gpuCores.instanceColor.setUsage(THREE.DynamicDrawUsage);
  gpuChip.add(gpuCores);

  function writeGpu() {
    for (let i = 0; i < GPU_N; i++) {
      const s = Math.max(1e-4, gpuFold[i]);
      m4.makeScale(s, s, s);
      m4.setPosition(gpuX[i], gpuLift[i], gpuZ[i]);
      gpuCores.setMatrixAt(i, m4);
    }
    gpuCores.instanceMatrix.needsUpdate = true;
  }
  writeGpu();

  // The 64 cores pop up in a diagonal wave.
  let gpuFoldT = -1;
  ctx.fold.custom(
    (e, t) => {
      if (t === gpuFoldT) return;
      gpuFoldT = t;
      for (let i = 0; i < GPU_N; i++) {
        const delay = (((i % TILE) + Math.floor(i / TILE)) / 14) * 0.55;
        const k = clamp01((t - delay) / 0.45);
        gpuFold[i] = k >= 1 ? 1 : Math.max(0, easeOutBack(k, 1.6));
      }
      writeGpu();
    },
    { start: 0.55, end: 0.95 },
  );

  // Printed notes in front of the chips.
  const noteFont = `italic 400 60px ${FONT.body}`;
  const cpuNote = labelCard('4 fast cores', { w: 1.3, h: 0.24, color: palette.paper, px: 96, font: noteFont });
  cpuNote.position.set(-SIDE_X, 0.013, 1.22);
  group.add(ctx.fold.rise(cpuNote, { start: 0.6, end: 0.9 }));
  const gpuNote = labelCard('64 slower cores', { w: 1.3, h: 0.24, color: palette.paper, px: 96, font: noteFont });
  gpuNote.position.set(SIDE_X, 0.013, 1.22);
  group.add(ctx.fold.rise(gpuNote, { start: 0.65, end: 0.95 }));

  // ---- RACE pull-tab (spring-loaded: it slides back when let go) ----
  let state = READY;
  let raceT = 0;
  let armed = true;
  let holding = false;
  let clock = 0;
  let lastPull = -10;
  let gpuFinalDrawn = false;

  const nBefore = ctx.interactives.length;
  const tab = pullTab(ctx, {
    x0: -1.0,
    x1: 1.0,
    z: 1.72,
    label: 'RACE',
    color: palette.red,
    onChange(v) {
      lastPull = clock;
      if (v >= 0.97 && armed) {
        armed = false;
        startRace();
      }
    },
  });
  group.add(tab.group);

  // Learn when the tab is grabbed and released, so it only springs back once let go.
  let hooked = false;
  for (let i = nBefore; i < ctx.interactives.length; i++) {
    const entry = ctx.interactives[i];
    if (entry.object?.parent !== tab.group) continue;
    const h = entry.handlers;
    const down = h.onDown;
    const up = h.onUp;
    h.onDown = (hit, ray) => {
      holding = true;
      return down ? down.call(h, hit, ray) : true;
    };
    h.onUp = () => {
      holding = false;
      up?.call(h);
    };
    hooked = true;
  }

  // Chequered finish mark at the end of the slot.
  const flagSide = flat(palette.cream);
  const flagFace = flat('#ffffff', { map: checkerTexture() });
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.24), [flagSide, flagSide, flagFace, flagSide, flagSide, flagSide]);
  flag.position.set(1.52, 0.01, 1.72);
  group.add(ctx.fold.rise(flag, { start: 0.7, end: 1 }));

  // ---- race state and drawing ----
  const cpuJob = new Int32Array(CPU_N).fill(-1);
  const cpuProg = new Float32Array(CPU_N);

  function showMedal(md) {
    md.shown = true;
    md.age = 0;
    md.group.visible = true;
  }
  function hideMedal(md) {
    md.shown = false;
    md.age = 0;
    md.group.visible = false;
    md.group.scale.setScalar(1e-4);
  }
  // Medals poke above the monitors, so shrink them away early as the page closes.
  let medalFold = 1;
  ctx.fold.custom((e) => (medalFold = Math.max(1e-4, e)), { start: 0.1, end: 0.45 });
  function animMedal(md, dt) {
    if (!md.shown) return;
    md.age += dt;
    const a = clamp01(md.age / 0.5);
    md.group.scale.setScalar((a >= 1 ? 1 : Math.max(1e-4, easeOutBack(a, 1.7))) * medalFold);
    md.group.rotation.y = (1 - smooth(clamp01(md.age / 0.9))) * Math.PI * 2;
  }

  function startRace() {
    state = RACING;
    raceT = 0;
    gpuFinalDrawn = false;
    hideMedal(cpuMedal);
    hideMedal(gpuMedal);
  }

  function cpuDoneAt(t) {
    if (t < T_CPU) return 0;
    return Math.min(N, Math.floor((t - T_CPU) / Q_CPU + 1e-6) + 1);
  }

  function drawReadout(mon, done, tenths, mode) {
    const st = mon.roState;
    if (st.done === done && st.tenths === tenths && st.mode === mode) return;
    st.done = done;
    st.tenths = tenths;
    st.mode = mode;
    const { g, canvas } = mon.ro;
    const w = canvas.width;
    const h = canvas.height;
    g.globalAlpha = 1;
    g.fillStyle = GAP;
    g.fillRect(0, 0, w, h);
    g.font = RO_FONT;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = palette.phosphor;
    g.fillText(`pixels: ${done}/${N}`, 18, h / 2);
    g.textAlign = 'right';
    g.fillStyle = mode === 2 ? palette.yellow : palette.phosphor;
    g.fillText(mode === 0 ? 'READY' : `${(tenths / 10).toFixed(1)} s`, w - 18, h / 2);
    mon.ro.refresh();
  }

  function drawGhost(g) {
    g.globalAlpha = 1;
    g.drawImage(emptyCanvas, 0, 0);
    g.globalAlpha = 0.16;
    g.drawImage(fullCanvas, 0, 0);
    g.globalAlpha = 1;
  }

  function drawCpu(g, done) {
    g.globalAlpha = 1;
    g.drawImage(emptyCanvas, 0, 0);
    const rows = Math.floor(done / COLS);
    const rem = done - rows * COLS;
    if (rows > 0) g.drawImage(fullCanvas, 0, 0, CW, rows * CELL, 0, 0, CW, rows * CELL);
    if (rem > 0) g.drawImage(fullCanvas, 0, rows * CELL, rem * CELL, CELL, 0, rows * CELL, rem * CELL, CELL);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    for (let k = 0; k < CPU_N; k++) {
      const idx = cpuJob[k];
      if (idx < 0) continue;
      const x = (idx % COLS) * CELL;
      const y = Math.floor(idx / COLS) * CELL;
      g.globalAlpha = 0.25 + 0.75 * cpuProg[k];
      g.drawImage(fullCanvas, x, y, CELL, CELL, x, y, CELL, CELL);
      g.globalAlpha = 1;
      g.strokeRect(x + 1, y + 1, CELL - 4, CELL - 4);
    }
  }

  function drawGpu(g, pass, f) {
    g.globalAlpha = 1;
    g.drawImage(emptyCanvas, 0, 0);
    const tilesDone = Math.min(pass, TILES);
    for (let ti = 0; ti < tilesDone; ti++) {
      const x = (ti % TILES_X) * TS;
      const y = Math.floor(ti / TILES_X) * TS;
      g.drawImage(fullCanvas, x, y, TS, TS, x, y, TS, TS);
    }
    if (pass < TILES) {
      const x = (pass % TILES_X) * TS;
      const y = Math.floor(pass / TILES_X) * TS;
      g.globalAlpha = 0.15 + 0.85 * smooth(f);
      g.drawImage(fullCanvas, x, y, TS, TS, x, y, TS, TS);
      g.globalAlpha = 1;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, TS - 3, TS - 3);
    }
  }

  function render() {
    const t = raceT;

    // CPU: core k works on pixels k, k+4, k+8, ... each taking T_CPU, offset by k·Q_CPU.
    for (let k = 0; k < CPU_N; k++) {
      let idx = -1;
      let p = 0;
      if (state === RACING) {
        const local = t - k * Q_CPU;
        if (local >= 0) {
          const m = Math.floor(local / T_CPU);
          const j = m * CPU_N + k;
          if (j < N) {
            idx = j;
            p = clamp01(local / T_CPU - m);
          }
        }
      }
      cpuJob[k] = idx;
      cpuProg[k] = p;
      const mat = cpuMats[k];
      const mesh = cpuCores[k];
      if (idx >= 0) {
        mat.color.copy(idleCol).lerp(pixLit[idx], smooth(Math.min(1, p / 0.3)));
        mesh.position.y = CORE_Y + 0.025 * Math.sin(Math.PI * p);
      } else {
        mat.color.copy(idleCol);
        mesh.position.y = CORE_Y;
      }
    }
    const cpuDone = state === READY ? 0 : state === DONE ? N : cpuDoneAt(t);
    if (state === READY) drawGhost(cpuMon.img.g);
    else drawCpu(cpuMon.img.g, cpuDone);
    cpuMon.img.refresh();
    const cpuMode = state === READY ? 0 : state === DONE ? 2 : 1;
    drawReadout(cpuMon, cpuDone, cpuMode === 2 ? Math.round(CPU_TOTAL * 10) : Math.floor(t * 10), cpuMode);

    // GPU: all 64 cores work in lockstep on one 8×8 block per pass.
    const pass = state === READY ? -1 : state === DONE ? TILES : Math.min(TILES, Math.floor(t / T_GPU));
    const gpuFinished = pass >= TILES;
    if (!(gpuFinished && gpuFinalDrawn)) {
      if (state !== READY && pass >= 0 && pass < TILES) {
        const f = clamp01(t / T_GPU - pass);
        const ramp = smooth(clamp01(f / 0.5));
        const lift = 0.045 * Math.sin(Math.PI * f);
        const ox = (pass % TILES_X) * TILE;
        const oy = Math.floor(pass / TILES_X) * TILE;
        for (let i = 0; i < GPU_N; i++) {
          const idx = (oy + Math.floor(i / TILE)) * COLS + ox + (i % TILE);
          tmpCol.copy(idleCol).lerp(pixLit[idx], ramp);
          gpuCores.setColorAt(i, tmpCol);
          gpuLift[i] = lift;
        }
        drawGpu(gpuMon.img.g, pass, f);
      } else {
        for (let i = 0; i < GPU_N; i++) {
          gpuCores.setColorAt(i, idleCol);
          gpuLift[i] = 0;
        }
        if (state === READY) drawGhost(gpuMon.img.g);
        else drawGpu(gpuMon.img.g, TILES, 0);
        gpuFinalDrawn = gpuFinished;
      }
      gpuCores.instanceColor.needsUpdate = true;
      writeGpu();
      gpuMon.img.refresh();
    }
    const gpuDone = state === READY ? 0 : Math.min(pass, TILES) * GPU_N;
    const gpuMode = state === READY ? 0 : gpuFinished ? 2 : 1;
    drawReadout(gpuMon, gpuDone, gpuMode === 2 ? Math.round(GPU_TOTAL * 10) : Math.floor(t * 10), gpuMode);
  }

  render();

  return {
    group,
    hint: 'Pull the tab to start the race',
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      clock += dt;

      // Spring the tab back once released (fallback: once it stops moving).
      const held = hooked ? holding : clock - lastPull < 0.35;
      if (!held && tab.value > 0) tab.set(Math.max(0, tab.value - dt * 3), true);
      if (tab.value <= 0.05) armed = true;

      if (state === RACING) {
        raceT += dt;
        if (raceT >= GPU_TOTAL && !gpuMedal.shown) showMedal(gpuMedal);
        if (raceT >= CPU_TOTAL) {
          raceT = CPU_TOTAL;
          state = DONE;
          showMedal(cpuMedal);
        }
        render();
      }
      animMedal(gpuMedal, dt);
      animMedal(cpuMedal, dt);
    },
  };
}

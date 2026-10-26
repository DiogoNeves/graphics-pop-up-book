import * as THREE from 'three/webgpu';
import { flat, unlit, palette, screen, button, pullTab, clamp01, lerp, smooth, easeOutBack } from '../kit.js';

// Chapter 1 pop-up, "Pong & Oscilloscopes": an oscilloscope playing a Tennis for Two style
// game (vector display) that morphs into a television playing a Pong style game (raster
// display). The SLOW tab slows the electron beam right down so you can watch it draw lines
// (vector) or scan rows (raster); the phosphor fades behind it.

const TAU = Math.PI * 2;
const SW = 256; // screen canvas in px (the plane is 1.6 x 1.2 units)
const SH = 192;
const SCR = { w: 1.6, h: 1.2, x: -0.35, y: 1.0, z: 0.035 };
const BODY_Y = 0.12; // the body stands on little feet
const SCOPE = { w: 2.5, h: 1.9, d: 1.2 };
const TV = { w: 2.95, h: 1.86, d: 1.15 };
const SWITCH_TIME = 1.3; // seconds for power-off, morph, power-on

// Tennis for Two court in screen px (the round tube is centred at 128,96 with radius 96).
const COURT_Y = 142;
const COURT_X0 = 46;
const COURT_X1 = 210;
const NET_X = 128;
const NET_TOP = 120;
const GRAVITY = 280;
const BALL_R = 3;
const BALL_DWELL = 18; // how long the beam lingers on the ball, in beam-path units

// Pong in screen px. ROWS coarse scan rows of RH px keep the scanlines chunky (no moire).
const ROWS = 24;
const RH = SH / ROWS;
const PAD_W = 6;
const PAD_H = 30;
const PAD_LX = 14;
const PAD_RX = SW - 14 - PAD_W;
const PAD_SPEED = 150;
const BALL_S = 7;
// 3 x 5 blocky digits, row by row.
const DIGITS = [
  '111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111',
];

const FADE = Array.from({ length: 101 }, (_, i) => `rgba(0,0,0,${(i / 100).toFixed(2)})`);
const DASH = [6, 6];
const NO_DASH = [];

const rand = (a, b) => a + Math.random() * (b - a);
const clampAbs = (v, m) => Math.max(-m, Math.min(m, v));

// Canvas rounded-rectangle path (a w = h = 2r rectangle is a circle).
function roundRectPath(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// THREE.Shape / THREE.Path rounded rectangle centred on the origin.
function rrShape(path, w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - r);
  path.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(x + r, y + h);
  path.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + r);
  path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

export default function create(ctx) {
  const group = new THREE.Group();

  // ---------------------------------------------------------------- state
  let target = 0; // 0 = vector (oscilloscope), 1 = raster (television)
  let shown = 0; // what the tube currently displays (switches mid-transition)
  let morph = 0; // 0 scope ... 1 TV body shape
  let morphFrom = 0;
  let switchT = -1; // transition progress 0..1, or -1 when idle
  let partsFold = 0; // fold progress of the knobs, bezels and antenna
  let hovered = false;
  let hoverGlow = 0;
  let beamPhase = 0; // where the beam is in its refresh cycle, 0..1
  let demoPhase = 0; // slow guide marker shown when the beam runs at full speed
  let fadeAcc = 0;

  // ---------------------------------------------------------------- the device
  const device = new THREE.Group();
  device.position.set(0, 0, 0.15); // bottom front edge: the fold hinge
  group.add(device);

  const cream = new THREE.Color(palette.cream);
  const scopeCol = new THREE.Color('#8c9094'); // grey instrument finish
  const tvCol = new THREE.Color(palette.orange).lerp(new THREE.Color(palette.red), 0.3);
  const scopePlateCol = new THREE.Color('#a9adb0');
  const tvPlateCol = tvCol.clone().lerp(cream, 0.3);

  const inkMat = flat(palette.ink);
  const creamMat = flat(palette.cream);
  const bodyMat = flat(scopeCol.clone());
  const plateMat = flat(scopePlateCol.clone());

  // Unit box with its front-bottom-centre at the origin, scaled to the current shape.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, -0.5), bodyMat);
  body.position.y = BODY_Y;
  device.add(body);
  // A slightly lighter face plate, like a second layer of card.
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.02).translate(0, 0, 0.01), plateMat);
  device.add(plate);

  const footGeo = new THREE.BoxGeometry(0.28, BODY_Y + 0.02, 0.22).translate(0, (BODY_Y + 0.02) / 2, 0);
  const feet = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(footGeo, inkMat);
    device.add(f);
    feet.push(f);
  }

  // The tube: one glowing canvas plane; the round / rounded-rect shape is a mask in the canvas.
  const scr = screen(SCR.w, SCR.h, { px: SW });
  scr.mesh.material.alphaTest = 0.5;
  scr.mesh.position.set(SCR.x, SCR.y, SCR.z);
  device.add(scr.mesh);
  const sg = scr.g;

  // Mode-specific parts sit on small pivots so they can retract into the body:
  // 'front' parts sink along z into the face, 'top' parts sink along y into the lid.
  const scopeParts = [];
  const tvParts = [];
  const part = (list, kind, x, y, z) => {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    p.userData.kind = kind;
    device.add(p);
    list.push(p);
    return p;
  };

  // Bezels (extruded from z = 0 to 0.09; their pivots sit 0.02 inside the body).
  const ring = new THREE.Shape();
  ring.absarc(0, 0, 0.7, 0, TAU, false);
  const ringHole = new THREE.Path();
  ringHole.absarc(0, 0, 0.585, 0, TAU, true);
  ring.holes.push(ringHole);
  const ringMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.24, bevelEnabled: false, curveSegments: 24 }), inkMat);
  part(scopeParts, 'front', SCR.x, SCR.y, -0.02).add(ringMesh);

  const frameShape = rrShape(new THREE.Shape(), 1.82, 1.42, 0.26);
  frameShape.holes.push(rrShape(new THREE.Path(), 1.56, 1.16, 0.16));
  const frameMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.09, bevelEnabled: false, curveSegments: 5 }), inkMat);
  part(tvParts, 'front', SCR.x, SCR.y, -0.02).add(frameMesh);

  // Knobs: axis along +z, protruding from the face.
  const knobBigGeo = new THREE.CylinderGeometry(0.12, 0.125, 0.12, 12).rotateX(Math.PI / 2).translate(0, 0, 0.06);
  const knobSmallGeo = new THREE.CylinderGeometry(0.075, 0.08, 0.1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.05);
  const capGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.035, 12).rotateX(Math.PI / 2).translate(0, 0, 0.1375);
  const pointerGeo = new THREE.BoxGeometry(0.035, 0.06, 0.025).translate(0, 0.035, 0.165);
  const makeKnob = (big, mat) => {
    const k = new THREE.Group();
    k.add(new THREE.Mesh(big ? knobBigGeo : knobSmallGeo, mat));
    if (big) {
      k.add(new THREE.Mesh(capGeo, creamMat));
      k.add(new THREE.Mesh(pointerGeo, inkMat));
      k.rotation.z = rand(-2, 2);
    }
    return k;
  };

  // Oscilloscope front panel: a graticule over the tube, a column of control knobs,
  // input jacks and a power lamp, like a 1950s laboratory scope.
  const grat = document.createElement('canvas');
  grat.width = SW;
  grat.height = SH;
  const gg = grat.getContext('2d');
  gg.save();
  gg.beginPath();
  gg.arc(SW / 2, SH / 2, SH * 0.47, 0, TAU);
  gg.clip();
  gg.strokeStyle = 'rgba(190, 235, 210, 0.32)';
  gg.lineWidth = 1;
  for (let i = -5; i <= 5; i++) {
    gg.beginPath();
    gg.moveTo(SW / 2 + i * 17, 0);
    gg.lineTo(SW / 2 + i * 17, SH);
    gg.stroke();
  }
  for (let j = -4; j <= 4; j++) {
    gg.beginPath();
    gg.moveTo(0, SH / 2 + j * 17);
    gg.lineTo(SW, SH / 2 + j * 17);
    gg.stroke();
  }
  gg.restore();
  const gratTex = new THREE.CanvasTexture(grat);
  gratTex.colorSpace = THREE.SRGBColorSpace;
  const gratMesh = new THREE.Mesh(new THREE.PlaneGeometry(SCR.w, SCR.h), unlit('#ffffff', { map: gratTex, transparent: true, depthWrite: false }));
  gratMesh.userData.noShadow = true;
  part(scopeParts, 'front', SCR.x, SCR.y, SCR.z + 0.012).add(gratMesh);

  const knobCol = [0.58, 0.98];
  [1.62, 1.22].forEach((y) => knobCol.forEach((x) => part(scopeParts, 'front', x, y, -0.02).add(makeKnob(true, inkMat))));
  [0.86].forEach((y) => knobCol.forEach((x) => part(scopeParts, 'front', x, y, -0.02).add(makeKnob(false, inkMat))));
  const jackGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.07, 10).rotateX(Math.PI / 2).translate(0, 0, 0.035);
  const jackHoleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8).rotateX(Math.PI / 2).translate(0, 0, 0.075);
  const brassMat = flat('#c9a24a');
  knobCol.forEach((x) => {
    const jack = part(scopeParts, 'front', x, 0.46, -0.02);
    jack.add(new THREE.Mesh(jackGeo, brassMat), new THREE.Mesh(jackHoleGeo, inkMat));
  });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10).rotateX(Math.PI / 2).translate(0, 0, 0.04), unlit(palette.phosphor));
  lamp.userData.noShadow = true;
  part(scopeParts, 'front', 0.78, 1.9, -0.02).add(lamp);
  // Ventilation slots along the top of the face.
  const ventGeo = new THREE.BoxGeometry(0.05, 0.16, 0.03).translate(0, 0, 0.015);
  const vents = part(scopeParts, 'front', -0.35, 1.9, -0.02);
  for (let i = -5; i <= 5; i++) {
    const v = new THREE.Mesh(ventGeo, inkMat);
    v.position.x = i * 0.1;
    vents.add(v);
  }

  // Oscilloscope carry handle on the lid.
  const handle = part(scopeParts, 'top', 0, 0, -0.5);
  const upGeo = new THREE.BoxGeometry(0.08, 0.16, 0.1).translate(0, 0.08, 0);
  for (const sgn of [-1, 1]) {
    const u = new THREE.Mesh(upGeo, inkMat);
    u.position.x = 0.48 * sgn;
    handle.add(u);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.07, 0.12), inkMat);
  bar.position.y = 0.185;
  handle.add(bar);

  // Television controls: channel and volume knobs and a speaker grille.
  part(tvParts, 'front', 1.0, 1.52, -0.02).add(makeKnob(true, inkMat));
  part(tvParts, 'front', 1.0, 1.1, -0.02).add(makeKnob(true, inkMat));
  const grille = part(tvParts, 'front', 1.0, 0.6, -0.02);
  const slatGeo = new THREE.BoxGeometry(0.6, 0.045, 0.08).translate(0, 0, 0.04);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(slatGeo, inkMat);
    s.position.y = (i - 2) * 0.09;
    grille.add(s);
  }

  // Television rabbit-ear antenna on the lid.
  const antenna = part(tvParts, 'top', 0.15, 0, -0.58);
  antenna.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 4, 0, TAU, 0, Math.PI / 2), inkMat));
  const rodGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.44, 6).translate(0, 0.22, 0);
  const tipGeo = new THREE.SphereGeometry(0.045, 8, 6);
  const rodMat = flat(palette.grey);
  for (const sgn of [-1, 1]) {
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(0.03 * sgn, 0.08, 0);
    rod.rotation.z = -0.45 * sgn;
    rod.userData.noShadow = true;
    antenna.add(rod);
    const tip = new THREE.Mesh(tipGeo, rodMat);
    tip.position.set(0.03 * sgn + Math.sin(0.45) * 0.44 * sgn, 0.08 + Math.cos(0.45) * 0.44, 0);
    tip.userData.noShadow = true;
    antenna.add(tip);
  }

  function setParts(list, k) {
    const s = (k >= 1 ? 1 : easeOutBack(k, 1.6)) * partsFold;
    const v = Math.max(1e-3, s);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.userData.kind === 'top') p.scale.set(1, v, 1);
      else p.scale.set(1, 1, v);
      p.visible = s > 0.002;
    }
  }

  function applyParts() {
    setParts(scopeParts, clamp01(1 - 2 * morph));
    setParts(tvParts, clamp01(2 * morph - 1));
  }

  function setMorph(m) {
    const w = lerp(SCOPE.w, TV.w, m);
    const h = lerp(SCOPE.h, TV.h, m);
    const d = lerp(SCOPE.d, TV.d, m);
    body.scale.set(w, h, d);
    plate.scale.set(w - 0.12, h - 0.12, 1);
    plate.position.y = BODY_Y + h / 2;
    bodyMat.color.lerpColors(scopeCol, tvCol, m);
    plateMat.color.lerpColors(scopePlateCol, tvPlateCol, m);
    const fx = w / 2 - 0.3;
    feet[0].position.set(-fx, 0, -0.2);
    feet[1].position.set(fx, 0, -0.2);
    feet[2].position.set(-fx, 0, -(d - 0.2));
    feet[3].position.set(fx, 0, -(d - 0.2));
    const top = BODY_Y + h - 0.03;
    handle.position.y = top;
    antenna.position.y = top;
    applyParts();
  }
  setMorph(0);

  // Folding: the whole device hinges back about its bottom front edge while its depth
  // collapses, so it lies flat (screen up) on the closed page; knobs and bezels pop out after.
  ctx.fold.custom(
    (e) => {
      device.rotation.x = (-Math.PI / 2 + 0.02) * (1 - e);
      device.scale.z = Math.max(0.04, e);
    },
    { start: 0.05, end: 0.7 },
  );
  ctx.fold.custom(
    (e) => {
      partsFold = Math.max(0, e);
      applyParts();
    },
    { start: 0.4, end: 0.9 },
  );

  // ---------------------------------------------------------------- page furniture

  const btn = button(ctx, {
    labels: ['Vector · Tennis for Two (1958)', 'Raster · Pong (1972)'],
    position: [0, 0, 1.12],
    w: 3.4,
    h: 0.34,
    color: palette.teal,
    ink: palette.cream,
    onChange: (i) => requestMode(i),
  });
  group.add(btn.mesh);

  const tab = pullTab(ctx, { x0: -1.15, x1: 1.15, z: 1.7, label: 'SLOW', color: palette.red });
  group.add(tab.group);

  // Tennis for Two's hand controllers: an aluminium box with an angle knob on top and a
  // hit button on the front, each on a coiled cable to the scope. The buttons hit the ball.
  const controllers = new THREE.Group();
  group.add(controllers);
  let ctrlFold = 0;
  ctx.fold.custom((e) => (ctrlFold = Math.max(0, e)), { start: 0.45, end: 0.85 });
  const alu = flat('#c3c8cc');
  const caseGeo = new THREE.BoxGeometry(0.46, 0.2, 0.34).translate(0, 0.1, 0);
  const dialGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.07, 12).translate(0, 0.235, -0.03);
  const dialMarkGeo = new THREE.BoxGeometry(0.025, 0.02, 0.09).translate(0, 0.28, 0.0);
  const hitGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.07, 10).rotateX(Math.PI / 2);
  const hitMat = flat(palette.red);
  const hitButtons = [];
  for (const side of [-1, 1]) {
    const c = new THREE.Group();
    c.position.set(side * 1.28, 0, 0.8);
    c.rotation.y = -side * 0.3;
    c.add(new THREE.Mesh(caseGeo, alu));
    const dial = new THREE.Group();
    dial.position.z = -0.03;
    dial.add(new THREE.Mesh(dialGeo, inkMat), new THREE.Mesh(dialMarkGeo, creamMat));
    dial.children.forEach((m) => (m.position.z = 0.03));
    dial.rotation.y = side * 0.7;
    c.add(dial);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.set(0, 0.1, 0.2);
    hit.userData.press = 0;
    c.add(hit);
    hitButtons.push(hit);
    controllers.add(c);
    ctx.interactive(c, {
      onClick() {
        hit.userData.press = 1;
        hitBall(side);
      },
    });

    // Coiled cable from the back of the box to the bottom corner of the scope's face.
    const pts = [];
    const a = new THREE.Vector3(side * 1.22, 0.07, 0.63);
    const b = new THREE.Vector3(side * 0.98, 0.09, 0.16);
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const p = a.clone().lerp(b, t);
      const coil = Math.sin(t * Math.PI) * 0.045;
      p.x += Math.cos(t * 30) * coil;
      p.y += Math.sin(t * 30) * coil + Math.sin(t * Math.PI) * 0.02;
      pts.push(p);
    }
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.018, 5), inkMat);
    controllers.add(cable);
  }

  // A player's button sends the ball back over the net if it is on their side.
  function hitBall(side) {
    if (shown !== 0 || switchT >= 0) return;
    if ((side < 0 && ball.x >= NET_X) || (side > 0 && ball.x < NET_X)) return;
    ball.vx = -side * rand(80, 100);
    ball.vy = -Math.sqrt(2 * GRAVITY * Math.max(8, ball.y - rand(28, 50)));
  }

  function requestMode(i) {
    if (switchT < 0 && i !== target) {
      target = i;
      morphFrom = morph;
      switchT = 0;
    }
    btn.set(target, true); // keep the button showing the real mode (also when ignored mid-switch)
  }

  ctx.interactive(device, {
    onClick() {
      requestMode(1 - target);
    },
    onHover(hit) {
      hovered = !!hit;
    },
  });

  // ---------------------------------------------------------------- canvases
  const makeCanvas = () => {
    const c = document.createElement('canvas');
    c.width = SW;
    c.height = SH;
    return c;
  };
  const phos = makeCanvas(); // the phosphor: what the beam has lit, fading
  const pg = phos.getContext('2d');
  const frame = makeCanvas(); // raster frame buffer the beam reads row by row
  const fg = frame.getContext('2d');
  pg.fillStyle = '#000000';
  pg.fillRect(0, 0, SW, SH);
  pg.lineCap = 'round';

  const vignette = sg.createRadialGradient(SW / 2, SH / 2, SH * 0.25, SW / 2, SH / 2, SW * 0.62);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  const glare = sg.createLinearGradient(0, 0, SW * 0.55, SH * 0.7);
  glare.addColorStop(0, 'rgba(255,255,255,0.13)');
  glare.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');

  // ---------------------------------------------------------------- Tennis for Two (vector)
  const ball = { x: 70, y: 128, vx: 82, vy: -200 };

  function tennisStep(dt) {
    const px = ball.x;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    // Into the net: bounce back.
    if ((px - NET_X) * (ball.x - NET_X) < 0 && ball.y > NET_TOP - BALL_R) {
      ball.x = px;
      ball.vx *= -0.6;
    }
    // Bounce on the court.
    if (ball.y > COURT_Y - BALL_R) {
      ball.y = COURT_Y - BALL_R;
      ball.vy = -Math.abs(ball.vy) * 0.72;
    }
    // A player hits it back over the net, aiming for an apex height.
    if ((ball.vx < 0 && ball.x < 62) || (ball.vx > 0 && ball.x > 194)) {
      ball.vx = (ball.vx < 0 ? 1 : -1) * rand(72, 92);
      ball.vy = -Math.sqrt(2 * GRAVITY * Math.max(8, ball.y - rand(40, 62)));
    }
    ball.x = Math.min(COURT_X1, Math.max(COURT_X0, ball.x));
    if (ball.y < 12) {
      ball.y = 12;
      if (ball.vy < 0) ball.vy = 0;
    }
  }

  // The display list the beam traces each refresh: court, jump, net, jump, ball, jump back.
  const segs = Array.from({ length: 6 }, () => ({ x0: 0, y0: 0, x1: 0, y1: 0, w: 1, draw: false, ball: false }));
  let pathLen = 1;
  const setSeg = (s, x0, y0, x1, y1, draw, isBall) => {
    s.x0 = x0;
    s.y0 = y0;
    s.x1 = x1;
    s.y1 = y1;
    s.draw = draw;
    s.ball = isBall;
    const len = Math.hypot(x1 - x0, y1 - y0);
    s.w = isBall ? BALL_DWELL : draw ? Math.max(1, len) : Math.max(4, len * 0.3); // blanked jumps are fast
  };
  function layoutSegs() {
    setSeg(segs[0], COURT_X0, COURT_Y, COURT_X1, COURT_Y, true, false);
    setSeg(segs[1], COURT_X1, COURT_Y, NET_X, NET_TOP, false, false);
    setSeg(segs[2], NET_X, NET_TOP, NET_X, COURT_Y, true, false);
    setSeg(segs[3], NET_X, COURT_Y, ball.x, ball.y, false, false);
    setSeg(segs[4], ball.x, ball.y, ball.x, ball.y, true, true);
    setSeg(segs[5], ball.x, ball.y, COURT_X0, COURT_Y, false, false);
    pathLen = 0;
    for (let i = 0; i < segs.length; i++) pathLen += segs[i].w;
  }

  const beam = { x: 0, y: 0, draw: false };
  function beamAt(phase, out) {
    let d = phase * pathLen;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (d <= s.w || i === segs.length - 1) {
        const t = clamp01(d / s.w);
        out.x = lerp(s.x0, s.x1, t);
        out.y = lerp(s.y0, s.y1, t);
        out.draw = s.draw;
        return out;
      }
      d -= s.w;
    }
    return out;
  }

  function drawBall() {
    pg.fillStyle = palette.phosphor;
    pg.beginPath();
    pg.arc(ball.x, ball.y, BALL_R + 1, 0, TAU);
    pg.fill();
    pg.fillStyle = '#eafff2';
    pg.beginPath();
    pg.arc(ball.x, ball.y, BALL_R - 0.8, 0, TAU);
    pg.fill();
  }

  // Light the phosphor along the part of the display list the beam swept over [a, b).
  function drawVector(a, b) {
    const da = a * pathLen;
    const db = b * pathLen;
    pg.strokeStyle = palette.phosphor;
    pg.lineWidth = 2.6;
    let c = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s.draw) {
        const lo = Math.max(da, c);
        const hi = Math.min(db, c + s.w);
        if (hi > lo) {
          if (s.ball) drawBall();
          else {
            const t0 = (lo - c) / s.w;
            const t1 = (hi - c) / s.w;
            pg.beginPath();
            pg.moveTo(lerp(s.x0, s.x1, t0), lerp(s.y0, s.y1, t0));
            pg.lineTo(lerp(s.x0, s.x1, t1), lerp(s.y0, s.y1, t1));
            pg.stroke();
          }
        }
      }
      c += s.w;
    }
  }

  // ---------------------------------------------------------------- Pong (raster)
  const pong = { x: SW / 2, y: SH / 2, vx: 125, vy: 60, lY: SH / 2, rY: SH / 2, errL: 0, errR: 0, sL: 0, sR: 0, wait: 0.5 };

  function aim(dir) {
    // Mostly a good return; sometimes the paddle misjudges and misses.
    const e = Math.random() < 0.3 ? rand(22, 30) * (Math.random() < 0.5 ? -1 : 1) : rand(-9, 9);
    if (dir > 0) pong.errR = e;
    else pong.errL = e;
  }

  function serve(dir) {
    pong.x = SW / 2 - BALL_S / 2;
    pong.y = rand(40, SH - 40);
    pong.vx = dir * 125;
    pong.vy = rand(45, 85) * (Math.random() < 0.5 ? -1 : 1);
    pong.wait = 0.7;
    aim(dir);
  }

  function pongStep(dt) {
    const P = pong;
    const cy = P.y + BALL_S / 2;
    const tL = P.vx < 0 ? cy + P.errL : SH / 2;
    const tR = P.vx > 0 ? cy + P.errR : SH / 2;
    const lim = PAD_SPEED * dt;
    P.lY = Math.max(PAD_H / 2 + 2, Math.min(SH - PAD_H / 2 - 2, P.lY + clampAbs(tL - P.lY, lim)));
    P.rY = Math.max(PAD_H / 2 + 2, Math.min(SH - PAD_H / 2 - 2, P.rY + clampAbs(tR - P.rY, lim)));
    if (P.wait > 0) {
      P.wait -= dt;
      return;
    }
    P.x += P.vx * dt;
    P.y += P.vy * dt;
    if (P.y < 3) {
      P.y = 3;
      P.vy = Math.abs(P.vy);
    }
    if (P.y > SH - 3 - BALL_S) {
      P.y = SH - 3 - BALL_S;
      P.vy = -Math.abs(P.vy);
    }
    const by = P.y + BALL_S / 2;
    const reach = PAD_H / 2 + BALL_S / 2;
    if (P.vx < 0 && P.x <= PAD_LX + PAD_W && P.x >= PAD_LX - BALL_S && Math.abs(by - P.lY) <= reach) {
      P.x = PAD_LX + PAD_W;
      P.vx = Math.min(200, -P.vx * 1.05);
      P.vy = ((by - P.lY) / (PAD_H / 2)) * 110 + rand(-12, 12);
      aim(1);
    } else if (P.vx > 0 && P.x + BALL_S >= PAD_RX && P.x <= PAD_RX + PAD_W && Math.abs(by - P.rY) <= reach) {
      P.x = PAD_RX - BALL_S;
      P.vx = -Math.min(200, P.vx * 1.05);
      P.vy = ((by - P.rY) / (PAD_H / 2)) * 110 + rand(-12, 12);
      aim(-1);
    }
    if (P.x < -BALL_S - 6 || P.x > SW + 6) {
      if (P.x < 0) P.sR++;
      else P.sL++;
      if (P.sL > 9 || P.sR > 9) P.sL = P.sR = 0;
      serve(P.x < 0 ? -1 : 1);
    }
  }

  function drawDigit(n, x, y) {
    const bits = DIGITS[n];
    for (let i = 0; i < 15; i++) if (bits.charCodeAt(i) === 49) fg.fillRect(x + (i % 3) * 5, y + Math.floor(i / 3) * 5, 5, 5);
  }

  function renderPong() {
    fg.fillStyle = '#050605';
    fg.fillRect(0, 0, SW, SH);
    fg.fillStyle = '#f4f4ec';
    for (let y = 4; y < SH; y += 16) fg.fillRect(SW / 2 - 2, y, 4, 8);
    drawDigit(pong.sL % 10, SW / 2 - 36, 12);
    drawDigit(pong.sR % 10, SW / 2 + 21, 12);
    fg.fillRect(PAD_LX, Math.round(pong.lY - PAD_H / 2), PAD_W, PAD_H);
    fg.fillRect(PAD_RX, Math.round(pong.rY - PAD_H / 2), PAD_W, PAD_H);
    if (pong.wait <= 0) fg.fillRect(Math.round(pong.x), Math.round(pong.y), BALL_S, BALL_S);
    // Scanlines: the dark gap between rows.
    fg.fillStyle = 'rgba(0,0,0,0.5)';
    for (let y = 0; y < SH; y += RH) fg.fillRect(0, y + RH - 3, SW, 3);
  }

  // Copy the rows (and part-row) the beam swept over [a, b) from the frame buffer onto the phosphor.
  function copyRows(a, b) {
    if (a <= 0 && b >= 1) {
      pg.drawImage(frame, 0, 0);
      return;
    }
    const pa = a * ROWS;
    const pb = b * ROWS;
    const r0 = Math.floor(pa);
    for (let r = r0; r < ROWS && r < pb; r++) {
      const xa = r === r0 ? (pa - r) * SW : 0;
      const xb = pb >= r + 1 ? SW : (pb - r) * SW;
      if (xb - xa > 0.01) pg.drawImage(frame, xa, r * RH, xb - xa, RH, xa, r * RH, xb - xa, RH);
    }
  }

  function sweep(s0, s1, fn) {
    if (s1 - s0 >= 1) fn(0, 1);
    else if (s1 <= 1) fn(s0, s1);
    else {
      fn(s0, 1);
      fn(0, s1 - 1);
    }
  }

  // ---------------------------------------------------------------- compositing the tube
  function drawBeamGuide(g, phase) {
    if (shown === 0) {
      // Vector: the beam jumps straight between the things it draws (blanked moves dashed).
      g.setLineDash(DASH);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(190,255,215,0.3)';
      g.beginPath();
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (!s.draw) {
          g.moveTo(s.x0, s.y0);
          g.lineTo(s.x1, s.y1);
        }
      }
      g.stroke();
      g.setLineDash(NO_DASH);
      beamAt(phase, beam);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.arc(beam.x, beam.y, 8, 0, TAU);
      g.fill();
      if (beam.draw) {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(beam.x, beam.y, 3.5, 0, TAU);
        g.fill();
      }
    } else {
      // Raster: a bright line sweeps down, row by row, the beam zipping along it.
      const rp = phase * ROWS;
      const row = Math.min(ROWS - 1, Math.floor(rp));
      const fx = (rp - row) * SW;
      const y = row * RH + RH / 2 - 1;
      g.fillStyle = 'rgba(200,235,255,0.35)';
      g.fillRect(0, y - 1, SW, 2);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(fx - 10, y - 3, 20, 6);
      g.fillStyle = '#ffffff';
      g.fillRect(fx - 5, y - 1.5, 10, 3);
    }
  }

  function composite(power, guidePhase) {
    const g = sg;
    g.clearRect(0, 0, SW, SH); // transparent outside the tube: discarded by alphaTest
    g.save();
    const mw = lerp(SH, SW, morph);
    roundRectPath(g, (SW - mw) / 2, 0, mw, SH, lerp(SH / 2, 28, morph));
    g.clip();
    g.fillStyle = shown === 0 ? '#0a1510' : '#0d0e0e';
    g.fillRect(0, 0, SW, SH);
    g.globalCompositeOperation = 'lighter';
    const flash = shown === 0 ? '#d9ffe8' : '#ffffff';
    if (power >= 1) {
      g.drawImage(phos, 0, 0);
      drawBeamGuide(g, guidePhase);
    } else if (power > 0.5) {
      // CRT switching on/off: the picture squashes into a bright line...
      const sy = (power - 0.5) * 2;
      const h = Math.max(2, SH * sy * sy);
      g.drawImage(phos, 0, (SH - h) / 2, SW, h);
      g.globalAlpha = 1 - sy;
      g.fillStyle = flash;
      g.fillRect(0, SH / 2 - 2, SW, 4);
      g.globalAlpha = 1;
    } else if (power > 0) {
      // ...and the line shrinks to a dot.
      const lw = Math.max(6, SW * power * 2);
      g.fillStyle = flash;
      g.fillRect((SW - lw) / 2, SH / 2 - 2, lw, 4);
    }
    g.globalCompositeOperation = 'source-over';
    if (hoverGlow > 0.01) {
      g.globalAlpha = 0.07 * hoverGlow;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, SW, SH);
      g.globalAlpha = 1;
    }
    g.fillStyle = vignette;
    g.fillRect(0, 0, SW, SH);
    g.fillStyle = glare;
    g.fillRect(0, 0, SW, SH);
    g.restore();
    scr.refresh();
  }

  // First picture, so the tube is masked before the first update.
  layoutSegs();
  drawVector(0, 1);
  renderPong();
  composite(1, 0);

  return {
    group,
    hint: 'Click the scope to switch · press to hit',
    update(rawDt) {
      const dt = Math.min(Math.max(rawDt || 0, 0), 0.05);

      // Switching: power off, morph the body, swap the picture, power on.
      let power = 1;
      if (switchT >= 0) {
        switchT = Math.min(1, switchT + dt / SWITCH_TIME);
        if (switchT >= 0.5 && shown !== target) {
          shown = target;
          pg.fillStyle = '#000000';
          pg.fillRect(0, 0, SW, SH);
          beamPhase = 0;
        }
        morph = lerp(morphFrom, target, smooth(clamp01((switchT - 0.2) / 0.6)));
        power = switchT < 0.22 ? 1 - switchT / 0.22 : switchT > 0.78 ? (switchT - 0.78) / 0.22 : 0;
        if (switchT >= 1) {
          switchT = -1;
          morph = target;
          power = 1;
        }
        setMorph(morph);
      }

      hoverGlow += ((hovered ? 1 : 0) - hoverGlow) * Math.min(1, dt * 10);
      // Controllers belong to the oscilloscope: they tuck away while it is a television.
      const ck = Math.max(1e-3, ctrlFold * clamp01(1 - 2 * morph));
      controllers.scale.setScalar(ck);
      controllers.visible = ck > 0.002;
      for (const b of hitButtons) {
        b.userData.press = Math.max(0, b.userData.press - dt * 5);
        b.position.z = 0.2 - 0.04 * Math.sin(b.userData.press * Math.PI);
      }

      // SLOW tab: stretch the beam's refresh period (and slow the game down with it).
      const slow = clamp01(tab.value);
      const period = slow < 0.02 ? 0 : lerp(0.12, 3, slow * slow);
      const gameDt = dt * (1 - 0.9 * slow);

      // Phosphor persistence. Fade in steps of >= 8% so 8-bit rounding leaves no ghosts.
      const tau = shown === 0 ? lerp(0.22, 0.9, slow) : lerp(0.12, 0.9, slow);
      fadeAcc += dt / tau;
      if (fadeAcc >= 0.085) {
        const a = 1 - Math.exp(-fadeAcc);
        pg.fillStyle = FADE[Math.min(100, Math.max(1, Math.round(a * 100)))];
        pg.fillRect(0, 0, SW, SH);
        fadeAcc = 0;
      }

      const dPhase = period > 0 ? dt / period : 1;
      const s0 = beamPhase;
      const s1 = s0 + dPhase;
      if (shown === 0) {
        tennisStep(gameDt);
        layoutSegs();
        sweep(s0, s1, drawVector);
      } else {
        pongStep(gameDt);
        renderPong();
        sweep(s0, s1, copyRows);
      }
      if (dPhase < 1) beamPhase = s1 % 1;
      demoPhase = (demoPhase + dt / (shown === 0 ? 1.8 : 2.4)) % 1;

      composite(power, period > 0 ? beamPhase : demoPhase);
    },
  };
}

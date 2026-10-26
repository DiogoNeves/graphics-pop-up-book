import * as THREE from 'three/webgpu';
import { texture, uv, vec2, vec3, fract, min, max, smoothstep, fwidth, float, positionView, uniform, clamp } from 'three/tsl';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { flat, unlit, palette, button } from '../kit.js';

// 3D rasterisation: an eye looks at a teapot through a standing "screen". Four threads mark the
// viewing frustum; the screen shows what a camera at the eye renders into a 32 x 24 image,
// either in colour or as the depth buffer (near = white, far = dark).

const RES_X = 32;
const RES_Y = 24;
const PLINTH_H = 0.4;
const TEAPOT_SIZE = 0.36; // TeapotGeometry spans y in [-size, size]
const TEAPOT_SEGMENTS = 4;
const IDLE_SPIN = 0.3; // rad/s when nobody is dragging
const BOUNDS = { x0: -1.8, x1: 1.8, y0: 0.03, y1: 2.6, z0: -2.2, z1: 1.9 };

// Utah teapot with one colour per part, as vertex colours. TeapotGeometry emits its 32 Bezier
// patches in order (rim, body, handle, spout, lid knob, lid, bottom), each with its own
// (segments + 1)^2 vertices, so the patch of a vertex is just its index divided by that.
function colourfulTeapot() {
  const geo = new TeapotGeometry(TEAPOT_SIZE, TEAPOT_SEGMENTS);
  const perPatch = (TEAPOT_SEGMENTS + 1) * (TEAPOT_SEGMENTS + 1);
  const partOf = (patch) => {
    if (patch < 12) return palette.red; // rim + body
    if (patch < 16) return palette.blue; // handle
    if (patch < 20) return palette.teal; // spout
    if (patch < 24) return palette.orange; // knob
    if (patch < 28) return palette.yellow; // lid
    return palette.red; // bottom
  };
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    c.set(partOf(Math.floor(i / perPatch)));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// A row of square "pixels" printed on the screen's bezel: palette colours in colour mode, a
// white-to-dark ramp in depth mode. Returns a plane facing +z with userData.draw(depth).
function makeLegend(w, h) {
  const canvas = document.createElement('canvas');
  canvas.height = 64;
  canvas.width = Math.round((64 * w) / h);
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const chips = [palette.red, palette.orange, palette.yellow, palette.green, palette.teal, palette.blue];
  const draw = (depth) => {
    g.fillStyle = palette.navy;
    g.fillRect(0, 0, canvas.width, canvas.height);
    const n = chips.length;
    const s = canvas.height * 0.62;
    const gap = s * 0.35;
    const x0 = (canvas.width - (n * s + (n - 1) * gap)) / 2;
    const y0 = (canvas.height - s) / 2;
    for (let i = 0; i < n; i++) {
      if (depth) {
        const v = Math.round(255 - (230 * i) / (n - 1));
        g.fillStyle = `rgb(${v},${v},${v})`;
      } else g.fillStyle = chips[i];
      g.fillRect(x0 + i * (s + gap), y0, s, s);
    }
    tex.needsUpdate = true;
  };
  draw(false);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flat('#ffffff', { map: tex }));
  mesh.userData.noShadow = true;
  mesh.userData.draw = draw;
  return mesh;
}

// Largest k such that o + k * c stays inside the pop-up bounds.
function maxReach(o, c) {
  let k = Infinity;
  const lim = (oc, cc, lo, hi) => {
    if (cc < -1e-6) k = Math.min(k, (lo - oc) / cc);
    else if (cc > 1e-6) k = Math.min(k, (hi - oc) / cc);
  };
  lim(o.x, c.x, BOUNDS.x0, BOUNDS.x1);
  lim(o.y, c.y, BOUNDS.y0, BOUNDS.y1);
  lim(o.z, c.z, BOUNDS.z0, BOUNDS.z1);
  return k;
}

export default function create(ctx) {
  const group = new THREE.Group();

  // ---- layout: teapot at the back, eye at the front right, screen in between ----
  const O = new THREE.Vector3(-0.35, PLINTH_H + TEAPOT_SIZE, -1.3); // teapot centre
  const E = new THREE.Vector3(0.95, 1.5, 1.1); // eye (centre of projection)
  const aim = new THREE.Vector3(O.x, O.y - 0.1, O.z); // slightly low, so the plinth top is in frame
  const fwd = aim.clone().sub(E);
  const D = fwd.length();
  fwd.normalize();
  const yaw = Math.atan2(-fwd.x, -fwd.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(-fwd.y, -0.99, 0.99)); // > 0: looking down
  // Orientation shared by the eye, the camera and the screen card (camera looks down its -z).
  const viewQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(viewQ);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(viewQ);
  const toEye = new THREE.Vector3(0, 0, 1).applyQuaternion(viewQ);

  // Image plane: SW x SH (4:3), a distance ds from the eye.
  const SW = 1.1;
  const SH = (SW * RES_Y) / RES_X;
  const ds = D * 0.6;
  const S = E.clone().addScaledVector(fwd, ds); // image centre
  const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(SH / 2 / ds));

  // ---- screen card: yaw group on the page, hinge leaning back by the pitch ----
  const TH = 0.03;
  const FACE = TH + 0.003; // image plane sits just in front of the card face
  const hc = (S.y - toEye.y * FACE) / up.y; // image centre height along the leaning card
  const P = S.clone().addScaledVector(up, -hc).addScaledVector(toEye, -FACE); // hinge, on the page
  const yawGroup = new THREE.Group();
  yawGroup.position.set(P.x, 0, P.z);
  yawGroup.rotation.y = yaw;
  const hinge = new THREE.Group();
  hinge.rotation.x = -pitch;
  yawGroup.add(hinge);
  group.add(yawGroup);

  const BEZ = 0.07;
  const BEZ_B = 0.17;
  const panelBottom = Math.max(0.08, hc - SH / 2 - BEZ_B);
  const panelTop = hc + SH / 2 + BEZ;
  const cardMat = flat(palette.navy);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(SW + 2 * BEZ, panelTop - panelBottom, TH), cardMat);
  panel.position.set(0, (panelTop + panelBottom) / 2, TH / 2);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, panelBottom, TH), cardMat);
  leg.position.set(0, panelBottom / 2, TH / 2);
  hinge.add(panel, leg);

  // Low-resolution render target shown unlit, with a faint anti-aliased pixel grid on top.
  const rt = new THREE.RenderTarget(RES_X, RES_Y, {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });
  const cells = uv().mul(vec2(RES_X, RES_Y));
  const f = fract(cells);
  const edge = min(f, f.oneMinus()); // distance to the nearest grid line, in pixels of the image
  const aa = fwidth(cells); // image pixels per screen pixel
  const LW = 0.05;
  const gx = smoothstep(float(LW), aa.x.add(LW + 1e-4), edge.x).oneMinus();
  const gy = smoothstep(float(LW), aa.y.add(LW + 1e-4), edge.y).oneMinus();
  const gridFade = smoothstep(0.12, 0.4, max(aa.x, aa.y)).oneMinus(); // hide the grid when tiny
  const shade = max(gx, gy).mul(gridFade).mul(0.3).oneMinus();
  const screenMat = new THREE.MeshBasicNodeMaterial({ fog: false });
  screenMat.colorNode = texture(rt.texture).rgb.mul(shade);
  const image = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
  image.position.set(0, hc, FACE);
  image.userData.noShadow = true;
  hinge.add(image);

  // Wordless legend printed on the bottom bezel: colour chips, or a near-to-far grey ramp.
  const legend = makeLegend(0.7, 0.1);
  legend.position.set(0, panelBottom + BEZ_B / 2, TH + 0.002);
  hinge.add(legend);

  ctx.fold.hinge(hinge, { from: -Math.PI / 2 + pitch + 0.02, start: 0.05, end: 0.5 });

  // ---- teapot on a plinth ----
  const stage = new THREE.Group();
  stage.position.set(O.x, 0, O.z);
  const baseH = PLINTH_H - 0.03;
  const plinthGeo = new THREE.CylinderGeometry(0.5, 0.56, baseH, 8).translate(0, baseH / 2, 0);
  const capGeo = new THREE.CylinderGeometry(0.53, 0.53, 0.03, 8).translate(0, PLINTH_H - 0.015, 0);
  const plinth = new THREE.Mesh(plinthGeo, flat(palette.green));
  const cap = new THREE.Mesh(capGeo, flat(palette.cream));
  stage.add(plinth, cap);

  const spinner = new THREE.Group();
  spinner.position.y = PLINTH_H;
  const teapotGeo = colourfulTeapot();
  const teapot = new THREE.Mesh(teapotGeo, flat('#ffffff', { vertexColors: true }));
  teapot.position.y = TEAPOT_SIZE + 0.005;
  spinner.add(teapot);
  // Invisible, generous grab volume around the teapot (cheaper and easier to hit than the mesh).
  const grab = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, TEAPOT_SIZE * 2 + 0.12, 12),
    new THREE.MeshBasicNodeMaterial({ visible: false }),
  );
  grab.position.y = TEAPOT_SIZE;
  grab.userData.noShadow = true;
  spinner.add(grab);
  stage.add(spinner);
  group.add(stage);
  ctx.fold.rise(stage, { start: 0.42, end: 0.75 });
  ctx.fold.rise(spinner, { start: 0.58, end: 0.92 });

  // ---- the eye on a stand ----
  const eyeStand = new THREE.Group();
  eyeStand.position.set(E.x, 0, E.z);
  const eyeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.05, 10).translate(0, 0.025, 0), flat(palette.navy));
  const postH = E.y - 0.12;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, postH, 0.06).translate(0, postH / 2, 0), flat(palette.ink));
  const head = new THREE.Group();
  head.position.y = E.y;
  head.quaternion.copy(viewQ); // iris and pupil face -z, i.e. along the view direction
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), flat(palette.cream));
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.205, 16, 3, 0, Math.PI * 2, 0, 0.62).rotateX(-Math.PI / 2), flat(palette.blue));
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.209, 16, 2, 0, Math.PI * 2, 0, 0.3).rotateX(-Math.PI / 2), flat(palette.black));
  head.add(ball, iris, pupil);
  eyeStand.add(eyeBase, post, head);
  group.add(eyeStand);
  ctx.fold.rise(eyeStand, { start: 0.3, end: 0.7 });

  // ---- viewing frustum: four threads from the eye through the image corners ----
  const frustum = new THREE.Group();
  const rodGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1).translate(0, 0.5, 0);
  const rodMat = unlit('#3b322c');
  const cornerDirs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
    S.clone().addScaledVector(right, (sx * SW) / 2).addScaledVector(up, (sy * SH) / 2).sub(E),
  );
  // Just past the screen corners: enough to read as a pyramid without crossing the scene.
  let reach = 1.3;
  for (const c of cornerDirs) reach = Math.min(reach, maxReach(E, c));
  const yAxis = new THREE.Vector3(0, 1, 0);
  const rods = [];
  const rodLen = [];
  for (const c of cornerDirs) {
    const len = c.length() * reach;
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.copy(E);
    rod.quaternion.setFromUnitVectors(yAxis, c.clone().normalize());
    rod.scale.y = len;
    rod.userData.noShadow = true;
    frustum.add(rod);
    rods.push(rod);
    rodLen.push(len);
  }
  group.add(frustum);
  ctx.fold.custom(
    (e, t) => {
      frustum.visible = t > 0;
      const s = Math.min(1, Math.max(0, e));
      for (let i = 0; i < rods.length; i++) rods[i].scale.y = Math.max(1e-4, rodLen[i] * s);
    },
    { start: 0.78, end: 1 },
  );

  // ---- the sub-scene the eye "sees": same teapot, plinth, page and table, own lights ----
  const sub = new THREE.Scene();
  const bgColour = new THREE.Color('#3a2d27');
  const bgDepth = new THREE.Color('#000000');
  sub.background = bgColour;
  const subPage = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.4).rotateX(-Math.PI / 2), flat('#efe5cf'));
  subPage.position.x = -2; // both pages of the open book
  const subTable = new THREE.Mesh(new THREE.PlaneGeometry(30, 20).rotateX(-Math.PI / 2), flat('#8a5a33'));
  subTable.position.y = -0.25;
  const subStage = new THREE.Group();
  subStage.position.copy(stage.position);
  subStage.add(new THREE.Mesh(plinthGeo, flat(palette.green)), new THREE.Mesh(capGeo, flat(palette.cream)));
  const subTeapot = new THREE.Mesh(teapotGeo, flat('#ffffff', { vertexColors: true }));
  subTeapot.position.set(O.x, PLINTH_H + TEAPOT_SIZE + 0.005, O.z);
  sub.add(subPage, subTable, subStage, subTeapot);
  sub.add(new THREE.HemisphereLight('#fff1dc', '#5a4030', 1.5));
  const sun = new THREE.DirectionalLight('#fff0d6', 2.6);
  sun.position.set(-5, 12, 6);
  const fill = new THREE.DirectionalLight('#cfe0ff', 0.35);
  fill.position.set(6, 5, -4);
  sub.add(sun, fill);

  const subCam = new THREE.PerspectiveCamera(vfov, RES_X / RES_Y, 0.1, 30);
  subCam.position.copy(E);
  subCam.quaternion.copy(viewQ);
  subCam.updateProjectionMatrix();
  subCam.updateMatrixWorld();

  // Depth view: greyscale by view-space depth, near = white, far = dark.
  const zNear = uniform(D - 0.85);
  const zFar = uniform(D + 1.9);
  const nearness = clamp(positionView.z.negate().sub(zNear).div(zFar.sub(zNear)), 0, 1).oneMinus();
  const depthMat = new THREE.MeshBasicNodeMaterial({ fog: false });
  depthMat.colorNode = vec3(nearness.mul(nearness)); // squared: reads evenly after sRGB output

  const setMode = (i) => {
    const depth = i === 1;
    sub.overrideMaterial = depth ? depthMat : null;
    sub.background = depth ? bgDepth : bgColour;
    legend.userData.draw(depth);
  };
  const toggle = button(ctx, {
    labels: ['Colour', 'Depth (z-buffer)'],
    position: [-0.45, 0, 1.6],
    h: 0.34,
    color: palette.orange,
    onChange: (i) => setMode(i),
  });
  group.add(toggle.mesh);
  ctx.interactive(image, { onClick: () => toggle.set(toggle.index + 1) });

  // ---- drag to spin the teapot ----
  const spin = { angle: 0.5, vel: IDLE_SPIN, pending: 0, dragging: false, dir: 1 };
  const lastP = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const grabHandlers = {
    cursor: 'grab',
    onDown(hit, ray) {
      const p = ctx.pagePoint(ray, O.y);
      if (!p) return false;
      lastP.copy(p);
      spin.dragging = true;
      spin.pending = 0;
      spin.vel = 0;
      return true;
    },
    onDrag(ray) {
      if (!spin.dragging) return;
      const p = ctx.pagePoint(ray, O.y);
      if (!p) return;
      // Horizontal drag as the reader sees it: project onto the camera's right vector.
      camRight.set(1, 0, 0).applyQuaternion(ctx.camera.quaternion);
      camRight.y = 0;
      if (camRight.lengthSq() < 1e-6) camRight.set(1, 0, 0);
      else camRight.normalize();
      const dx = THREE.MathUtils.clamp(delta.subVectors(p, lastP).dot(camRight), -0.6, 0.6);
      lastP.copy(p);
      if (!Number.isFinite(dx)) return;
      const da = dx * 2.2;
      spin.angle += da;
      spin.pending += da;
    },
    onUp() {
      spin.dragging = false;
      if (Math.abs(spin.vel) > 0.2) spin.dir = Math.sign(spin.vel);
    },
  };
  ctx.interactive(grab, grabHandlers);
  ctx.interactive(plinth, grabHandlers);
  ctx.interactive(cap, grabHandlers);

  let renderOk = true;
  const TAU = Math.PI * 2;

  return {
    group,
    hint: 'Drag the teapot · press for depth',
    update(dt) {
      if (spin.dragging) {
        if (dt > 1e-4) {
          const v = THREE.MathUtils.clamp(spin.pending / dt, -10, 10);
          spin.vel += (v - spin.vel) * 0.4;
        }
        spin.pending = 0;
      } else {
        spin.vel += (IDLE_SPIN * spin.dir - spin.vel) * (1 - Math.exp(-dt * 1.2));
        spin.angle += spin.vel * dt;
      }
      if (spin.angle > TAU) spin.angle -= TAU;
      else if (spin.angle < -TAU) spin.angle += TAU;
      spinner.rotation.y = spin.angle;
      subTeapot.rotation.y = spin.angle;

      if (!renderOk) return;
      const r = ctx.renderer;
      try {
        r.setRenderTarget(rt);
        r.render(sub, subCam);
      } catch (err) {
        renderOk = false;
        console.error('raster-3d: sub-scene render failed', err);
      } finally {
        r.setRenderTarget(null);
      }
    },
  };
}

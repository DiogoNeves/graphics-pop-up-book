// Pop-up kit: shared building blocks for the 3D pop-ups on the right-hand pages.
//
// Pop-up frame: the origin is the centre of the right page, on its surface. +x points to
// the outer edge, +y up out of the page, +z towards the reader. The page spans
// x in [-2, 2] and z in [-2.7, 2.7]; keep content inside about x in [-1.8, 1.8],
// z in [-2.2, 1.9] (the bottom strip holds the printed hint) and under ~2.6 high.
//
// A pop-up module default-exports `create(ctx)` returning { group, hint, update(dt, time) }.
// `ctx` gives you: root (the group the book attaches; your `group` is added to it for you),
// fold (a Folder: register pieces so they fold flat as the page turns), interactive(),
// pagePoint(), localRay(), onUpdate(), renderer, scene, camera, and constants W/H.
// update() only runs while the pop-up is on screen; ctx.root.visible is managed by the book.
import * as THREE from 'three/webgpu';

export const PAGE_W = 4;
export const PAGE_H = 5.4;

export const palette = {
  paper: '#f4ecdb',
  card: '#efe3c9',
  cream: '#fff8e8',
  ink: '#2a2420',
  red: '#d1495b',
  orange: '#edae49',
  yellow: '#f2d16b',
  teal: '#00798c',
  blue: '#30638e',
  navy: '#1f3b57',
  green: '#66a182',
  purple: '#7d5ba6',
  grey: '#8d8478',
  black: '#1d1b1a',
  phosphor: '#7dffb0',
};

export const FONT = {
  title: '"Fraunces", Georgia, serif',
  body: '"Crimson Pro", Georgia, serif',
  hand: '"Caveat", "Comic Sans MS", cursive',
};

export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOutBack = (t, k = 1.4) => 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);

// ---- materials ----

// Lit, flat-shaded material: the book's look. Pass extra MeshLambertNodeMaterial options.
export function flat(color, opts = {}) {
  return new THREE.MeshLambertNodeMaterial({ color, flatShading: true, ...opts });
}

// Unlit material for glowing screens, lines and markers.
export function unlit(color, opts = {}) {
  return new THREE.MeshBasicNodeMaterial({ color, ...opts });
}

// ---- folding ----

// Drives how pieces stand up as the page opens (u = 0 flat/closed, 1 fully open).
// Each piece animates over its own [start, end] window of u, with a slight springy overshoot.
export class Folder {
  constructor() {
    this.items = [];
  }

  // `pivot` rotates about its local `axis` from `from` (radians, relative to its rest
  // rotation) to rest. Put a card's bottom edge at the pivot origin so it folds onto the page.
  hinge(pivot, { from = -Math.PI / 2, axis = 'x', start = 0, end = 1 } = {}) {
    this.items.push({ kind: 'hinge', obj: pivot, axis, from, rest: pivot.rotation[axis], start, end });
    return pivot;
  }

  // `obj` grows out of the page: scale 0 → rest scale.
  rise(obj, { start = 0, end = 1 } = {}) {
    this.items.push({ kind: 'rise', obj, rest: obj.scale.clone(), start, end });
    return obj;
  }

  // Custom: fn(t) receives the eased 0..1 progress of its window.
  custom(fn, { start = 0, end = 1 } = {}) {
    this.items.push({ kind: 'custom', fn, start, end });
  }

  apply(u) {
    for (const it of this.items) {
      const t = clamp01((u - it.start) / (it.end - it.start));
      const e = t >= 1 ? 1 : easeOutBack(t, 1.2);
      if (it.kind === 'hinge') it.obj.rotation[it.axis] = it.rest + it.from * (1 - e);
      else if (it.kind === 'rise') {
        const s = Math.max(1e-4, e);
        it.obj.scale.set(it.rest.x * s, it.rest.y * s, it.rest.z * s);
        it.obj.visible = t > 0;
      } else it.fn(e, t);
    }
  }
}

// ---- text and cards ----

// Canvas texture with centred text. Returns { texture, draw(text) } so labels can change.
export function textTexture(text, { width = 512, height = 128, font = `600 64px ${FONT.title}`, color = palette.ink, background = palette.cream, align = 'center' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const draw = (t) => {
    g.clearRect(0, 0, width, height);
    if (background) {
      g.fillStyle = background;
      g.fillRect(0, 0, width, height);
    }
    g.fillStyle = color;
    g.font = font;
    g.textAlign = align;
    g.textBaseline = 'middle';
    const lines = String(t).split('\n');
    const lh = height / lines.length;
    const x = align === 'center' ? width / 2 : align === 'right' ? width - 16 : 16;
    lines.forEach((line, i) => g.fillText(line, x, lh * (i + 0.5)));
    texture.needsUpdate = true;
  };
  draw(text);
  return { texture, canvas, draw };
}

// A thin card (box) with text on its face. standing=false lies flat (text up, readable from
// the reader); standing=true stands up facing +z. Returns the mesh with mesh.userData.setText.
export function labelCard(text, { w = 1.2, h = 0.34, thickness = 0.025, standing = false, color = palette.cream, ink = palette.ink, font, px = 256 } = {}) {
  const tt = textTexture(text, {
    width: Math.round(px * (w / h)),
    height: px,
    font: font ?? `600 ${Math.round(px * 0.5)}px ${FONT.title}`,
    color: ink,
    background: color,
  });
  const side = flat(color);
  const face = flat('#ffffff', { map: tt.texture });
  const geo = standing ? new THREE.BoxGeometry(w, h, thickness) : new THREE.BoxGeometry(w, thickness, h);
  const mats = standing ? [side, side, side, side, face, side] : [side, side, face, side, side, side];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.userData.setText = tt.draw;
  return mesh;
}

// A flat card whose top face is drawn by draw(g, width, height, state) on a canvas — for
// controls that show state with shapes instead of words. mesh.userData.redraw(state).
export function iconCard(draw, { w = 0.6, h = 0.3, thickness = 0.05, color = palette.cream, px = 128 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(px * (w / h));
  canvas.height = px;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const redraw = (state) => {
    g.fillStyle = color;
    g.fillRect(0, 0, canvas.width, canvas.height);
    draw(g, canvas.width, canvas.height, state);
    texture.needsUpdate = true;
  };
  redraw(0);
  const side = flat(color);
  const face = flat('#ffffff', { map: texture });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, h), [side, side, face, side, side, side]);
  mesh.userData.redraw = redraw;
  return mesh;
}

// Double-headed arrow: "slide me".
function drawSlideIcon(g, w, h) {
  g.strokeStyle = g.fillStyle = palette.cream;
  g.lineWidth = h * 0.09;
  g.lineCap = 'round';
  const y = h / 2;
  const a = w * 0.2;
  const b = w * 0.8;
  const k = h * 0.2;
  g.beginPath();
  g.moveTo(a, y);
  g.lineTo(b, y);
  g.moveTo(a + k, y - k);
  g.lineTo(a, y);
  g.lineTo(a + k, y + k);
  g.moveTo(b - k, y - k);
  g.lineTo(b, y);
  g.lineTo(b - k, y + k);
  g.stroke();
}

// One dot per state, the current one filled.
function drawStateDots(count, ink) {
  return (g, w, h, state) => {
    const r = h * 0.14;
    const gap = r * 3.2;
    const x0 = w / 2 - ((count - 1) * gap) / 2;
    g.lineWidth = h * 0.06;
    g.strokeStyle = g.fillStyle = ink;
    for (let i = 0; i < count; i++) {
      g.beginPath();
      g.arc(x0 + i * gap, h / 2, r, 0, Math.PI * 2);
      if (i === state) g.fill();
      else g.stroke();
    }
  };
}

// A standing card hinged at its bottom edge, registered with the folder so it folds flat
// backwards (away from the reader) when the page closes. Returns the pivot group; the card
// mesh is pivot.userData.card.
export function standingCard(ctx, { w = 1.6, h = 1, thickness = 0.03, material, position = [0, 0, 0], start = 0, end = 1, lean = 0 } = {}) {
  const pivot = new THREE.Group();
  pivot.position.set(...position);
  pivot.rotation.x = lean;
  const card = new THREE.Mesh(new THREE.BoxGeometry(w, h, thickness), material ?? flat(palette.card));
  card.position.y = h / 2;
  pivot.add(card);
  pivot.userData.card = card;
  ctx.fold.hinge(pivot, { from: -Math.PI / 2 + 0.02, start, end });
  return pivot;
}

// A canvas you can draw on every frame, shown as an unlit (glowing) plane facing +z.
// Call refresh() after drawing.
export function screen(w, h, { px = 256, background = '#000000' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.round((px * h) / w);
  const g = canvas.getContext('2d');
  g.fillStyle = background;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), unlit('#ffffff', { map: texture }));
  mesh.userData.noShadow = true;
  return { mesh, canvas, g, texture, refresh: () => (texture.needsUpdate = true) };
}

// ---- controls ----

// A paper pull-tab that slides along x at depth z on the page. value is 0..1 (snapped to
// `steps` positions when steps > 1). It shows an arrow, never text (`label` is ignored).
// Returns { group, get value, set(v) }.
export function pullTab(ctx, { x0 = -1.2, x1 = 1.2, z = 1.75, value = 0, steps = 0, color = palette.red, onChange = () => {} } = {}) {
  const group = new THREE.Group();
  const slot = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.24, 0.006, 0.09), flat('#3b322c'));
  slot.position.set((x0 + x1) / 2, 0.003, z);
  group.add(slot);
  if (steps > 1) {
    for (let i = 0; i < steps; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.006, 0.07), flat('#3b322c'));
      tick.position.set(lerp(x0, x1, i / (steps - 1)), 0.003, z + 0.14);
      group.add(tick);
    }
  }
  const tab = iconCard(drawSlideIcon, { w: 0.62, h: 0.3, thickness: 0.05, color });
  tab.position.set(x0, 0.03, z);
  group.add(tab);

  let v = -1;
  const api = {
    group,
    get value() {
      return v;
    },
    set(next, silent = false) {
      let nv = clamp01(next);
      if (steps > 1) nv = Math.round(nv * (steps - 1)) / (steps - 1);
      tab.position.x = lerp(x0, x1, nv);
      if (nv !== v) {
        v = nv;
        if (!silent) onChange(v);
      }
    },
  };
  api.set(value, true);

  let grabDx = 0;
  ctx.interactive(tab, {
    cursor: 'grab',
    onDown(hit, ray) {
      const p = ctx.pagePoint(ray, 0.05);
      grabDx = p ? tab.position.x - p.x : 0;
      return true;
    },
    onDrag(ray) {
      const p = ctx.pagePoint(ray, 0.05);
      if (p) api.set((p.x + grabDx - x0) / (x1 - x0));
    },
  });
  ctx.fold.rise(group, { start: 0.5, end: 1 });
  return api;
}

// A flat push-button on the page that cycles through states when clicked. `labels` names
// the states (passed to onChange) but is never printed: the button shows one dot per state.
// Returns { mesh, get index, set(i) }.
export function button(ctx, { labels = ['On', 'Off'], position = [0, 0, 1.75], w = 1.3, h = 0.34, color = palette.orange, ink = palette.ink, onChange = () => {} } = {}) {
  const mesh = iconCard(drawStateDots(labels.length, ink), { w: Math.min(w, 0.25 + labels.length * 0.18), h, thickness: 0.07, color });
  mesh.position.set(position[0], 0.035 + (position[1] ?? 0), position[2]);
  let index = 0;
  let pressed = 0;
  const api = {
    mesh,
    get index() {
      return index;
    },
    set(i, silent = false) {
      index = ((i % labels.length) + labels.length) % labels.length;
      mesh.userData.redraw(index);
      if (!silent) onChange(index, labels[index]);
    },
  };
  ctx.onUpdate((dt) => {
    pressed = Math.max(0, pressed - dt * 4);
    mesh.position.y = 0.035 + (position[1] ?? 0) - 0.03 * Math.sin(pressed * Math.PI);
  });
  ctx.interactive(mesh, {
    onClick() {
      pressed = 1;
      api.set(index + 1);
    },
  });
  ctx.fold.rise(mesh, { start: 0.5, end: 1 });
  return api;
}

// ---- context ----

export function createPopupContext({ renderer, scene, camera }) {
  const root = new THREE.Group();
  const inverse = new THREE.Matrix4();
  const localRay = new THREE.Ray();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  return {
    THREE,
    renderer,
    scene,
    camera,
    root,
    W: PAGE_W,
    H: PAGE_H,
    fold: new Folder(),
    interactives: [],
    updaters: [],
    // Run fn(dt, time) every frame while the pop-up is visible (in addition to update()).
    onUpdate(fn) {
      this.updaters.push(fn);
    },
    // Register an object (and its descendants) for pointer input. Handlers:
    // onDown(hit, ray) → return true to capture the pointer for dragging;
    // onDrag(ray); onUp(); onClick(hit); onHover(hit|null); cursor: CSS cursor.
    // `ray` is a world-space THREE.Ray.
    interactive(object, handlers) {
      this.interactives.push({ object, handlers });
      return object;
    },
    // Intersect a world ray with the horizontal plane at height y in pop-up coordinates.
    pagePoint(ray, y = 0) {
      root.updateWorldMatrix(true, false);
      inverse.copy(root.matrixWorld).invert();
      localRay.copy(ray).applyMatrix4(inverse);
      plane.constant = -y;
      return localRay.intersectPlane(plane, new THREE.Vector3());
    },
    // Convert a world-space ray into pop-up local space (for custom intersections).
    localRay(ray) {
      root.updateWorldMatrix(true, false);
      inverse.copy(root.matrixWorld).invert();
      return localRay.copy(ray).applyMatrix4(inverse);
    },
  };
}

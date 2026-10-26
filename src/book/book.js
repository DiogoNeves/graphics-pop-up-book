import * as THREE from 'three/webgpu';
import { Leaf } from './leaf.js';
import { CLOTH, makeCoverTexture, makeEdgeTexture } from './bookTextures.js';
import { makeLeftPage, makeRightPage } from '../pages/pages.js';
import { createPopup } from '../popups/index.js';

// Page width/height, page block thickness, cover thickness and cover size.
export const BOOK = { W: 4, H: 5.4, T: 0.3, C: 0.07, CW: 4.18, CH: 5.62 };
const EPS = 0.003;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Pop-ups are not glued across the gutter like real paper ones, so they must be flat
// before the turning page can reach them: the turning page's pop-up folds away while the
// page is still in its first third, and the revealed pop-up stands up only once the page
// has passed well beyond vertical (its bend makes the edge lead).
const closing = (angle) => 1 - smoothstep(0.02 * Math.PI, 0.38 * Math.PI, angle);
const opening = (angle) => smoothstep(0.62 * Math.PI, 0.98 * Math.PI, angle);

// Spreads are indexed 0..n-1; -1 is the closed book. Leaf k separates spread k and k+1:
// its front is the right page of spread k and its back is the left page of spread k+1.
// The front cover plays the same role between "closed" and spread 0.
export class Book {
  constructor({ spreads, renderer, scene, camera, onChange, onSettle }) {
    Object.assign(this, { spreads, renderer, scene, camera, onChange, onSettle });
    const { W, H, T, C, CW, CH } = BOOK;
    this.dT = T / (spreads.length - 1);
    this.current = -1;
    this.target = -1;
    this.turn = null;
    this.left = new Map();
    this.right = new Map();
    this.popups = new Map();
    this.hidden = new THREE.MeshBasicNodeMaterial({ visible: false });
    this.group = new THREE.Group();

    const cloth = new THREE.MeshLambertNodeMaterial({ color: CLOTH, flatShading: true });
    const edgeTex = makeEdgeTexture();
    const edge = new THREE.MeshLambertNodeMaterial({ map: edgeTex, flatShading: true });
    const paper = new THREE.MeshLambertNodeMaterial({ color: '#efe5cf', flatShading: true });
    const coverArt = new THREE.MeshLambertNodeMaterial({ map: makeCoverTexture(CH / CW), flatShading: true });

    const coverGeo = new THREE.BoxGeometry(CW, C, CH).translate(CW / 2, C / 2, 0);
    const backCover = new THREE.Mesh(coverGeo, cloth);
    this.group.add(backCover);

    this.coverPivot = new THREE.Group();
    const frontCover = new THREE.Mesh(coverGeo, [cloth, cloth, coverArt, paper, cloth, cloth]);
    this.coverPivot.add(frontCover);
    this.coverInside = new Leaf(W, H, [this.hidden, this.hidden]);
    this.coverInside.mesh.position.y = -EPS;
    this.coverPivot.add(this.coverInside.mesh);
    this.group.add(this.coverPivot);

    this.spine = new THREE.Mesh(new THREE.BoxGeometry(C, 1, CH).translate(-C / 2, 0.5, 0), cloth);
    this.group.add(this.spine);

    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    const blockMats = [edge, edge, paper, paper, edge, edge];
    this.rightBlock = new THREE.Mesh(blockGeo, blockMats);
    this.leftBlock = new THREE.Mesh(blockGeo, blockMats);
    this.group.add(this.rightBlock, this.leftBlock);

    this.rightPage = new Leaf(W, H, [this.hidden, this.hidden]);
    this.leftPage = new Leaf(W, H, [this.hidden, this.hidden]);
    this.leftPage.setAngle(Math.PI, 1);
    this.leaf = new Leaf(W, H, [this.hidden, this.hidden], { segX: 24, segZ: 6, bend: 0.5 });
    this.group.add(this.rightPage.mesh, this.leftPage.mesh, this.leaf.mesh);

    this.rightFrame = new THREE.Group();
    this.leafFrame = new THREE.Group();
    this.group.add(this.rightFrame, this.leafFrame);

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.layout();
  }

  get last() {
    return this.spreads.length - 1;
  }

  goTo(index) {
    const i = Math.max(-1, Math.min(this.last, index));
    if (i === this.target) return;
    this.target = i;
    this.onChange?.(i);
  }

  next() {
    this.goTo(this.target + 1);
  }

  prev() {
    this.goTo(this.target - 1);
  }

  get idle() {
    return !this.turn && this.current === this.target;
  }

  // ---- lazily built page surfaces and pop-ups ----

  getPopup(i) {
    if (i < 0 || i > this.last) return null;
    if (!this.popups.has(i)) {
      const popup = createPopup(this.spreads[i], { renderer: this.renderer, scene: this.scene, camera: this.camera });
      this.popups.set(i, popup);
    }
    return this.popups.get(i);
  }

  getLeft(i) {
    if (!this.left.has(i)) this.left.set(i, makeLeftPage(this.spreads[i], i, BOOK));
    return this.left.get(i);
  }

  getRight(i) {
    if (!this.right.has(i)) this.right.set(i, makeRightPage(this.spreads[i], i, BOOK, this.getPopup(i)?.hint));
    return this.right.get(i);
  }

  // Free page canvases far from the current spread; they are rebuilt on demand.
  trim() {
    for (const cache of [this.left, this.right]) {
      for (const [i, page] of cache) {
        if (Math.abs(i - this.current) > 2 && i !== 0) {
          page.dispose();
          cache.delete(i);
        }
      }
    }
  }

  // Prepare the neighbouring spreads while the reader is on this one, one small step per
  // idle moment, so turning a page doesn't build anything. Stops if a turn starts.
  prefetch() {
    const s = this.current;
    const steps = [];
    for (const i of [s + 1, s - 1].filter((n) => n >= 0 && n <= this.last)) {
      steps.push(() => this.getPopup(i), () => this.getLeft(i), () => this.getRight(i), () => this.warm(i));
    }
    const later = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 250 }) : setTimeout(fn, 30));
    const run = () => {
      if (!this.idle || this.current !== s || !steps.length) return;
      steps.shift()();
      later(run);
    };
    later(run);
  }

  // Upload a spread's page textures and draw its pop-up once off screen, in its real place
  // (so its lights and shadows count), so its first appearance mid-turn doesn't stall.
  warm(i) {
    for (const page of [this.getLeft(i), this.getRight(i)]) this.renderer.initTexture(page.texture);
    const popup = this.getPopup(i);
    if (!popup || popup.warmed || !this.warmup || popup.root.parent) return;
    popup.warmed = true;
    this.rightFrame.add(popup.root);
    popup.fold.apply(1);
    popup.update(0, performance.now() / 1000); // pop-ups with their own render targets draw them now
    this.warmup();
    popup.root.removeFromParent();
  }

  // What the pointer may interact with right now.
  activePopup() {
    return this.idle && this.current >= 0 ? this.getPopup(this.current) : null;
  }

  activeLeft() {
    if (!this.idle || this.current < 0) return null;
    const mesh = this.current === 0 ? this.coverInside.mesh : this.leftPage.mesh;
    return { mesh, page: this.getLeft(this.current) };
  }

  // ---- animation ----

  startTurn() {
    const c = this.current;
    const t = this.target;
    const fast = Math.abs(t - c) > 1;
    let turn;
    if (c === -1) turn = { kind: 'cover', from: 0, to: Math.PI, next: 0, dur: 1.9 };
    else if (c === 0 && t === -1) turn = { kind: 'cover', from: Math.PI, to: 0, next: -1, dur: 1.6 };
    else if (t > c) turn = { kind: 'leaf', k: c, from: 0, to: Math.PI, next: c + 1, dur: fast ? 0.75 : 1.5 };
    else turn = { kind: 'leaf', k: c - 1, from: Math.PI, to: 0, next: c - 1, dur: fast ? 0.75 : 1.5 };
    turn.t = 0;
    turn.angle = turn.from;
    turn.dir = Math.sign(turn.to - turn.from);
    this.turn = turn;
  }

  update(dt, time) {
    if (!this.turn && this.target !== this.current) this.startTurn();
    const turn = this.turn;
    if (turn) {
      turn.t = Math.min(1, turn.t + dt / turn.dur);
      turn.angle = turn.from + (turn.to - turn.from) * easeInOut(turn.t);
      if (turn.t >= 1) {
        this.current = turn.next;
        this.turn = null;
        if (this.idle) {
          this.trim();
          this.prefetch();
          this.onSettle?.(this.current);
        }
      }
    }
    this.layout();
    for (const popup of this.popups.values()) {
      if (popup.root.parent) popup.update(dt, time);
    }
  }

  layout() {
    const { W, T, C } = BOOK;
    const { dT, turn } = this;
    let Lt, Rt, leftIdx, rightIdx, rightU;
    let cover = Math.PI;
    let leafK = -1;
    let theta = 0;
    if (turn?.kind === 'cover') {
      cover = turn.angle;
      [Lt, Rt, leftIdx, rightIdx, rightU] = [0, T, 0, 0, opening(cover)];
    } else if (turn?.kind === 'leaf') {
      leafK = turn.k;
      theta = turn.angle;
      [Lt, Rt, leftIdx, rightIdx, rightU] = [leafK * dT, T - (leafK + 1) * dT, leafK, leafK + 1, opening(theta)];
    } else if (this.current < 0) {
      cover = 0;
      [Lt, Rt, leftIdx, rightIdx, rightU] = [0, T, 0, 0, 0];
    } else {
      const s = this.current;
      [Lt, Rt, leftIdx, rightIdx, rightU] = [s * dT, T - s * dT, s, s, 1];
    }

    this.setBlock(this.rightBlock, Rt, 1);
    this.setBlock(this.leftBlock, Lt, -1);

    // The cover swings about the top of the page block, then settles onto the table.
    const pivotY = C + T * (1 - smoothstep(Math.PI * 0.4, Math.PI, cover));
    this.coverPivot.position.y = pivotY;
    this.coverPivot.rotation.z = cover;
    this.spine.scale.y = pivotY + C;
    this.setMats(this.coverInside.mesh, this.hidden, this.getLeft(0).material);

    this.rightPage.mesh.position.y = C + Rt + EPS;
    this.setMats(this.rightPage.mesh, this.getRight(rightIdx).material, this.hidden);

    this.leftPage.mesh.visible = Lt > 1e-4;
    this.leftPage.mesh.position.y = C + Lt + EPS;
    if (this.leftPage.mesh.visible) this.setMats(this.leftPage.mesh, this.hidden, this.getLeft(leftIdx).material);

    this.leaf.mesh.visible = leafK >= 0;
    if (leafK >= 0) {
      const f = theta / Math.PI;
      const pivot = C + dT + (1 - f) * Rt + f * Lt + 2 * EPS;
      this.leaf.setAngle(theta, turn.dir);
      this.leaf.mesh.position.y = pivot;
      this.setMats(this.leaf.mesh, this.getRight(leafK).material, this.getLeft(leafK + 1).material);
      const frame = this.leaf.frameAt(0.5);
      this.leafFrame.position.set(frame.x, pivot + frame.y, 0);
      this.leafFrame.rotation.z = frame.phi;
    }

    this.rightFrame.position.set(W / 2, C + Rt + EPS, 0);
    const shown = new Set();
    this.placePopup(rightIdx, this.rightFrame, rightU, shown);
    if (leafK >= 0) this.placePopup(leafK, this.leafFrame, closing(theta), shown);
    for (const popup of this.popups.values()) {
      if (!shown.has(popup) && popup.root.parent) popup.root.removeFromParent();
    }
  }

  placePopup(i, frame, u, shown) {
    if (u <= 0.002) return;
    const popup = this.getPopup(i);
    if (!popup) return;
    if (popup.root.parent !== frame) frame.add(popup.root);
    popup.fold.apply(u);
    shown.add(popup);
  }

  setBlock(mesh, height, side) {
    const { W, H, C } = BOOK;
    mesh.visible = height > 1e-4;
    mesh.scale.set(W, Math.max(height, 1e-4), H);
    mesh.position.set((side * W) / 2, C + height / 2, 0);
  }

  setMats(mesh, front, back) {
    const m = mesh.material;
    if (m[0] !== front || m[1] !== back) mesh.material = [front, back];
  }
}

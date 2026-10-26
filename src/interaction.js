import * as THREE from 'three/webgpu';
import { BOOK } from './book/book.js';

// Routes pointer input to pop-up controls and the scrollable left page; everything else
// falls through to the orbit controls.
export class Interaction {
  constructor({ dom, camera, controls, book }) {
    Object.assign(this, { dom, camera, controls, book });
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.drag = null;
    this.hoverHandlers = null;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    dom.addEventListener('pointerdown', (e) => this.down(e), { capture: true });
    dom.addEventListener('pointermove', (e) => this.move(e));
    dom.addEventListener('pointerup', (e) => this.up(e));
    dom.addEventListener('pointercancel', (e) => this.up(e));
    dom.addEventListener('wheel', (e) => this.wheel(e), { capture: true, passive: false });
  }

  cast(e) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray;
  }

  pick(e) {
    const ray = this.cast(e);
    const popup = this.book.activePopup();
    if (popup?.interactives.length) {
      const objects = popup.interactives.map((i) => i.object);
      for (const hit of this.raycaster.intersectObjects(objects, true)) {
        if (!isVisible(hit.object)) continue;
        for (let o = hit.object; o; o = o.parent) {
          const entry = popup.interactives.find((i) => i.object === o);
          if (entry) return { kind: 'popup', handlers: entry.handlers, hit, ray };
        }
      }
    }
    const left = this.book.activeLeft();
    if (left) {
      const hit = this.raycaster.intersectObject(left.mesh, false)[0];
      if (hit) return { kind: 'page', page: left.page, hit, ray };
    }
    return { kind: 'none', ray };
  }

  down(e) {
    if (e.button !== 0) return;
    const p = this.pick(e);
    if (p.kind === 'popup') {
      const capture = p.handlers.onDown?.(p.hit, p.ray);
      if (capture || p.handlers.onClick) {
        this.drag = { ...p, x: e.clientX, y: e.clientY, moved: false };
      }
    } else if (p.kind === 'page' && p.page.maxScroll > 0) {
      this.plane.constant = -p.hit.point.y;
      this.drag = { ...p, lastZ: p.hit.point.z, x: e.clientX, y: e.clientY, moved: false };
    }
    if (this.drag) {
      this.controls.enabled = false;
      this.dom.setPointerCapture(e.pointerId);
    }
  }

  move(e) {
    const d = this.drag;
    if (d) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
      const ray = this.cast(e);
      if (d.kind === 'popup') d.handlers.onDrag?.(ray, e);
      else {
        const pt = ray.intersectPlane(this.plane, new THREE.Vector3());
        if (pt) {
          d.page.scrollBy(((pt.z - d.lastZ) * d.page.winH) / BOOK.H);
          d.lastZ = pt.z;
        }
      }
      return;
    }
    const p = this.pick(e);
    const handlers = p.kind === 'popup' ? p.handlers : null;
    if (this.hoverHandlers && this.hoverHandlers !== handlers) this.hoverHandlers.onHover?.(null);
    if (handlers) handlers.onHover?.(p.hit);
    this.hoverHandlers = handlers;
    this.dom.style.cursor = handlers ? handlers.cursor ?? 'pointer' : p.kind === 'page' && p.page.maxScroll > 0 ? 'ns-resize' : '';
    this.overPage = p.kind === 'page';
    this.controls.enableZoom = !this.overPage;
  }

  up(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.controls.enabled = true;
    if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
    if (d.kind === 'popup') {
      if (!d.moved) d.handlers.onClick?.(d.hit);
      d.handlers.onUp?.();
    }
  }

  wheel(e) {
    const p = this.pick(e);
    if (p.kind !== 'page') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const scale = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
    p.page.scrollBy(e.deltaY * scale * 1.5);
  }
}

function isVisible(o) {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

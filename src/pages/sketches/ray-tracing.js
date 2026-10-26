// Sketches for chapter 7, Ray Tracing.

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const unit = (v) => {
  const l = Math.hypot(v.x, v.y);
  return { x: v.x / l, y: v.y / l };
};
const along = (p, d, t) => ({ x: p.x + d.x * t, y: p.y + d.y * t });

// Nearest hit of the ray o + t*d (d unit length, t > 0) with a circle, or null.
function hitCircle(o, d, c, r) {
  const oc = sub(o, c);
  const b = dot(oc, d);
  const disc = b * b - (dot(oc, oc) - r * r);
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? { ...along(o, d, t), t } : null;
}

// Almond eye looking along +x, centred on (x, y).
function eye(rc, ctx, h, x, y) {
  ctx.save();
  ctx.translate(x, y);
  rc.path('M -50 0 Q 0 -46 50 0 Q 0 46 -50 0 Z');
  rc.circle(14, 0, 18, { fill: h.ink, fillStyle: 'solid' });
  ctx.restore();
}

// Sun: hatched disc with short rays; rays within ~25 degrees of `gap` are left out.
function sun(rc, h, cx, cy, r, gap) {
  rc.circle(cx, cy, r * 2, { fill: h.colors.yellow, fillStyle: 'hachure', hachureGap: 7 });
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const diff = Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap)));
    if (diff < 0.44) continue;
    const c = Math.cos(a);
    const s = Math.sin(a);
    rc.line(cx + c * (r + 10), cy + s * (r + 10), cx + c * (r + 28), cy + s * (r + 28), { strokeWidth: 2.2 });
  }
}

export default {
  'ray-tracing-rays': {
    height: 630,
    draw(rc, ctx, h) {
      const E = { x: 88, y: 375 }; // eye
      const C = { x: 690, y: 475 }; // big sphere
      const R = 130;
      const Cs = { x: 645, y: 118 }; // small sphere
      const Rs = 46;
      const S = { x: 815, y: 82 }; // sun
      const Rsun = 32;

      // Screen: 6 x 6 pixel grid, row 2 centred on eye level.
      const g = { x: 240, y: 250, cw: 25, ch: 50, n: 6 };
      const pix = { c: 3, r: 2 };
      rc.rectangle(g.x + pix.c * g.cw, g.y + pix.r * g.ch, g.cw, g.ch, { fill: h.accent, fillStyle: 'solid', stroke: 'none' });
      const thin = { stroke: h.muted, strokeWidth: 1.5, roughness: 0.6 };
      for (let i = 1; i < g.n; i++) {
        rc.line(g.x + i * g.cw, g.y, g.x + i * g.cw, g.y + g.n * g.ch, thin);
        rc.line(g.x, g.y + i * g.ch, g.x + g.n * g.cw, g.y + i * g.ch, thin);
      }
      rc.rectangle(g.x, g.y, g.n * g.cw, g.n * g.ch);

      // Spheres and sun.
      rc.circle(C.x, C.y, R * 2, { fill: h.colors.blue, fillStyle: 'hachure', hachureGap: 13 });
      rc.circle(Cs.x, Cs.y, Rs * 2, { fill: h.colors.green, fillStyle: 'hachure', hachureGap: 10 });

      // Primary ray: from the eye, horizontally through the shaded pixel, to the big sphere.
      const d = { x: 1, y: 0 };
      const P = hitCircle(E, d, C, R);
      const n = unit(sub(P, C));
      // Mirror reflection: r = d - 2 (d.n) n  (comes out almost straight up).
      const k = 2 * dot(d, n);
      const rdir = unit({ x: d.x - k * n.x, y: d.y - k * n.y });
      const Q = hitCircle(P, rdir, Cs, Rs);
      // Shadow ray towards the sun (leaves the surface, so it clears the sphere).
      const toSun = unit(sub(S, P));
      sun(rc, h, S.x, S.y, Rsun, Math.atan2(-toSun.y, -toSun.x));

      h.arrow(E.x + 58, E.y, P.x - 9, P.y, { head: 24 });
      const s0 = along(P, toSun, 14);
      const s1 = along(S, toSun, -(Rsun + 8));
      rc.line(s0.x, s0.y, s1.x, s1.y, { strokeLineDash: [14, 11], disableMultiStroke: true, strokeWidth: 2.6 });
      if (Q) {
        const r0 = along(P, rdir, 12);
        const r1 = along(Q, rdir, -3);
        h.arrow(r0.x, r0.y, r1.x, r1.y, { head: 22, stroke: h.colors.blue, strokeWidth: 2.8 });
      }
      rc.circle(P.x, P.y, 16, { fill: h.ink, fillStyle: 'solid' });

      eye(rc, ctx, h, E.x, E.y);

      // Leader from the "pixel" label to the shaded square.
      const px = g.x + (pix.c + 1) * g.cw;
      const py = g.y + (pix.r + 1) * g.ch;
      h.arrow(404, 442, px + 4, py + 3, { head: 16, strokeWidth: 2, stroke: h.accent });

      h.label('eye', E.x, E.y + 55);
      h.label('pixel', 450, 455, { color: h.accent });
      h.label('primary ray', 498, 340);
      h.label('reflection ray', 618, 205, { size: 38, align: 'right', color: h.colors.blue });
      h.label('shadow ray', 825, 290);
      h.label('light', 930, S.y);
    },
  },

  'soft-shadow-rays': {
    height: 560,
    draw(rc, ctx, h) {
      const floorY = 500;
      const light = { x: 140, y: 85, w: 760, h: 40 };
      const C = { x: 400, y: 290 }; // ball
      const R = 75;
      const D = { x: 520, y: floorY }; // point on the floor

      rc.rectangle(light.x, light.y, light.w, light.h, { fill: h.colors.yellow, fillStyle: 'hachure', hachureGap: 8 });
      rc.circle(C.x, C.y, R * 2, { fill: h.colors.blue, fillStyle: 'hachure', hachureGap: 12 });

      // Floor with ground ticks.
      rc.line(40, floorY, 960, floorY);
      for (let x = 70; x <= 950; x += 40) rc.line(x, floorY + 2, x - 16, floorY + 20, { stroke: h.muted, strokeWidth: 1.6, roughness: 0.6 });

      // Five shadow rays fanning up to points spread along the light.
      const lightY = light.y + light.h;
      for (const tx of [200, 360, 520, 680, 840]) {
        const T = { x: tx, y: lightY };
        const len = Math.hypot(T.x - D.x, T.y - D.y);
        const dir = unit(sub(T, D));
        const hit = hitCircle(D, dir, C, R);
        if (hit && hit.t < len) {
          rc.line(D.x, D.y, hit.x, hit.y);
          const s = 12;
          const xo = { stroke: h.colors.red, strokeWidth: 3.4, roughness: 0.6 };
          rc.line(hit.x - s, hit.y - s, hit.x + s, hit.y + s, xo);
          rc.line(hit.x - s, hit.y + s, hit.x + s, hit.y - s, xo);
        } else {
          rc.line(D.x, D.y, T.x, T.y);
        }
      }
      rc.circle(D.x, D.y, 18, { fill: h.ink, fillStyle: 'solid' });

      h.label('area light', light.x + light.w / 2, 48);
      h.label('ball', 272, C.y);
      h.label('blocked', 310, 410, { color: h.colors.red });
      h.label('reaches light', 850, 330);
    },
  },
};

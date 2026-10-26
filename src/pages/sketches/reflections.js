// Sketches for chapter 8, Reflections.

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const unit = (v) => {
  const l = Math.hypot(v.x, v.y);
  return { x: v.x / l, y: v.y / l };
};
const along = (p, d, t) => ({ x: p.x + d.x * t, y: p.y + d.y * t });

// Where the ray o + t*d (d unit length), starting inside a circle, leaves it.
function exitCircle(o, d, c, r) {
  const oc = sub(o, c);
  const b = dot(oc, d);
  const t = -b + Math.sqrt(b * b - (dot(oc, oc) - r * r));
  return along(o, d, t);
}

// Almond eye looking along `angle`, centred on (x, y).
function eye(rc, ctx, h, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  rc.path('M -50 0 Q 0 -46 50 0 Q 0 46 -50 0 Z');
  rc.circle(14, 0, 18, { fill: h.ink, fillStyle: 'solid' });
  ctx.restore();
}

export default {
  'environment-lookup': {
    height: 680,
    draw(rc, ctx, h) {
      const C = { x: 470, y: 340 }; // centre of the environment and of the ball
      const R = 315; // environment sphere
      const r = 55; // shiny ball
      const L = { x: C.x - r, y: C.y }; // left-most point of the ball
      const E = { x: 265, y: 480 }; // eye

      // Environment and ball.
      rc.circle(C.x, C.y, R * 2, { strokeWidth: 2.8 });
      rc.circle(C.x, C.y, r * 2, { fill: h.colors.blue, fillStyle: 'hachure', hachureGap: 10 });
      rc.arc(C.x + 6, C.y - 6, r * 1.2, r * 1.2, -1.45, -0.35, false, { strokeWidth: 2, roughness: 0.7 });

      // View ray, normal and mirror reflection at L. The normal there points straight left,
      // so the reflection simply flips the horizontal part of the view direction.
      const d = unit(sub(L, E));
      const n = { x: -1, y: 0 };
      const k = 2 * dot(d, n);
      const rr = { x: d.x - k * n.x, y: d.y - k * n.y };
      const T = exitCircle(L, rr, C, R); // where the reflected ray meets the environment

      // Tree painted on the inside edge where the reflected ray lands.
      const tc = along(T, rr, -32);
      rc.line(tc.x, tc.y + 26, tc.x, tc.y + 66, { strokeWidth: 3 });
      rc.circle(tc.x, tc.y, 60, { fill: h.colors.green, fillStyle: 'hachure', hachureGap: 8 });

      // Sun near the top right of the inside edge.
      const sa = -0.84;
      const sc = { x: C.x + 263 * Math.cos(sa), y: C.y + 263 * Math.sin(sa) };
      rc.circle(sc.x, sc.y, 44, { fill: h.colors.yellow, fillStyle: 'hachure', hachureGap: 6 });
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        rc.line(sc.x + 31 * Math.cos(a), sc.y + 31 * Math.sin(a), sc.x + 43 * Math.cos(a), sc.y + 43 * Math.sin(a), { strokeWidth: 2 });
      }

      eye(rc, ctx, h, E.x, E.y, Math.atan2(d.y, d.x));

      const v0 = along(E, d, 58);
      const v1 = along(L, d, -4);
      h.arrow(v0.x, v0.y, v1.x, v1.y, { head: 22 });
      h.arrow(L.x - 4, L.y, L.x - 95, L.y, { head: 18, strokeWidth: 2.2 });
      const r0 = along(L, rr, 5);
      const r1 = along(T, rr, -5);
      h.arrow(r0.x, r0.y, r1.x, r1.y, { head: 22, stroke: h.accent, strokeWidth: 2.8 });
      rc.circle(T.x, T.y, 16, { fill: h.accent, fillStyle: 'solid', stroke: h.accent });

      h.arrow(734, 598, 694, 570, { head: 15, strokeWidth: 2 });

      h.label('eye', 330, 525);
      h.label('view ray', 440, 455);
      h.label('normal', 245, L.y);
      h.label('reflected ray', 448, 205, { color: h.accent });
      h.label('environment map', 842, 625);
    },
  },

  'cube-map-cross': {
    height: 640,
    draw(rc, ctx, h) {
      const s = 200;
      const x0 = 100;
      const y0 = 20;
      // Row of four (left, front, right, back) with up above and down below "front".
      const face = (col, row) => ({ x: x0 + col * s, y: y0 + row * s });
      const faces = [
        ['left', face(0, 1)],
        ['front', face(1, 1)],
        ['right', face(2, 1)],
        ['back', face(3, 1)],
        ['up', face(1, 0)],
        ['down', face(1, 2)],
      ];
      const f = face(1, 1);
      rc.rectangle(f.x, f.y, s, s, { fill: 'rgba(181, 69, 47, 0.14)', fillStyle: 'solid', stroke: 'none' });

      // Dotted fold lines on the five shared edges (round caps turn tiny dashes into dots).
      const fold = { stroke: h.muted, strokeWidth: 4, roughness: 0.4, strokeLineDash: [0.5, 13], disableMultiStroke: true };
      ctx.save();
      ctx.lineCap = 'round';
      rc.line(x0 + s, y0 + s, x0 + s, y0 + 2 * s, fold);
      rc.line(x0 + 2 * s, y0 + s, x0 + 2 * s, y0 + 2 * s, fold);
      rc.line(x0 + 3 * s, y0 + s, x0 + 3 * s, y0 + 2 * s, fold);
      rc.line(x0 + s, y0 + s, x0 + 2 * s, y0 + s, fold);
      rc.line(x0 + s, y0 + 2 * s, x0 + 2 * s, y0 + 2 * s, fold);
      ctx.restore();

      // Outline of the cross.
      rc.polygon(
        [
          [x0 + s, y0],
          [x0 + 2 * s, y0],
          [x0 + 2 * s, y0 + s],
          [x0 + 4 * s, y0 + s],
          [x0 + 4 * s, y0 + 2 * s],
          [x0 + 2 * s, y0 + 2 * s],
          [x0 + 2 * s, y0 + 3 * s],
          [x0 + s, y0 + 3 * s],
          [x0 + s, y0 + 2 * s],
          [x0, y0 + 2 * s],
          [x0, y0 + s],
          [x0 + s, y0 + s],
        ],
        { strokeWidth: 2.8 },
      );

      for (const [name, p] of faces) {
        h.label(name, p.x + s / 2, p.y + s / 2, { size: 44, color: name === 'front' ? h.accent : h.ink });
      }
    },
  },
};

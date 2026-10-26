// Chapter 3 figures: perspective projection through a screen, and colour vs depth buffers.

export default {
  'perspective-projection': {
    height: 580,
    draw(rc, ctx, h) {
      const E = [95, 300]; // eye
      const EYE_R = 26;
      const U = [960, 70]; // far end of the upper view line
      const D = [960, 530]; // far end of the lower view line
      const SX = 380; // the screen sits about a third of the way along
      const lineY = (P, x) => E[1] + ((P[1] - E[1]) * (x - E[0])) / (P[0] - E[0]);
      // Point `d` units from the eye's centre towards P (so lines start at the eye's rim).
      const fromEye = (P, d) => {
        const len = Math.hypot(P[0] - E[0], P[1] - E[1]);
        return [E[0] + ((P[0] - E[0]) * d) / len, E[1] + ((P[1] - E[1]) * d) / len];
      };

      // View wedge.
      for (const P of [U, D]) {
        const [sx, sy] = fromEye(P, EYE_R + 4);
        rc.line(sx, sy, P[0], P[1], { strokeWidth: 2.2, roughness: 0.6 });
      }

      // The object: a triangle standing on one corner.
      const A = [760, 420]; // bottom corner
      const B = [650, 200]; // upper left
      const C = [860, 235]; // upper right
      rc.polygon([A, B, C], {
        fill: h.colors.teal,
        fillStyle: 'hachure',
        hachureGap: 12,
        hachureAngle: -50,
        strokeWidth: 2.8,
      });

      // Sight lines from two corners back to the eye, and where they pierce the screen.
      for (const P of [B, A]) {
        const [ex, ey] = fromEye(P, EYE_R + 4);
        rc.line(P[0], P[1], ex, ey, { strokeWidth: 1.8, roughness: 0.5, strokeLineDash: [10, 9] });
      }

      // The screen spans the wedge exactly.
      rc.line(SX, lineY(U, SX), SX, lineY(D, SX), { stroke: h.colors.blue, strokeWidth: 5, roughness: 0.5 });
      for (const P of [B, A]) {
        rc.circle(SX, lineY(P, SX), 17, { fill: h.accent, fillStyle: 'solid', stroke: h.accent, strokeWidth: 1.5 });
      }

      // The eye.
      rc.circle(E[0], E[1], EYE_R * 2, { strokeWidth: 2.6 });
      rc.circle(E[0] + 8, E[1], 16, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1 });

      // Labels (projected dots at y ~ 249 and ~ 351 on x = 380).
      const ar = { head: 14, strokeWidth: 2 };
      h.label('eye', 90, 397, { size: 40 });
      h.arrow(92, 373, 95, 336, ar);
      h.label('screen', 380, 150, { size: 40 });
      h.arrow(380, 172, 380, 213, ar);
      h.label('object', 905, 446, { size: 40 });
      h.arrow(890, 423, 822, 334, ar);
      h.label('projected', 530, 283, { size: 36 });
      h.label('points', 530, 319, { size: 36 });
      h.arrow(452, 276, 391, 257, { ...ar, stroke: h.accent });
      h.arrow(474, 322, 391, 344, { ...ar, stroke: h.accent });
    },
  },

  'z-buffer-grids': {
    height: 560,
    draw(rc, ctx, h) {
      const N = 5;
      const S = 70;
      const TOP = 120;
      // Triangles in cell units: origin at the grid's top-left, y pointing down.
      const HATCHED = [[0.15, 0.6], [0.15, 4.85], [4.4, 4.85]]; // large, lower left, behind
      const SOLID = [[1.2, 3.05], [4.25, 0.5], [3.65, 4.85]]; // smaller, on the right, in front
      const toPx = (x0, tri) => tri.map(([u, v]) => [x0 + u * S, TOP + v * S]);

      const inside = ([px, py], [a, b, c]) => {
        const side = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
        const d1 = side([px, py], a, b);
        const d2 = side([px, py], b, c);
        const d3 = side([px, py], c, a);
        const neg = d1 < 0 || d2 < 0 || d3 < 0;
        const pos = d1 > 0 || d2 > 0 || d3 > 0;
        return !(neg && pos);
      };

      const grid = (x0) => {
        const gridLine = { stroke: h.muted, strokeWidth: 1.4, roughness: 0.6 };
        for (let k = 1; k < N; k++) {
          rc.line(x0 + k * S, TOP, x0 + k * S, TOP + N * S, gridLine);
          rc.line(x0, TOP + k * S, x0 + N * S, TOP + k * S, gridLine);
        }
        rc.rectangle(x0, TOP, N * S, N * S, { strokeWidth: 2.4, roughness: 0.8 });
      };

      // --- LEFT: the colour picture. The solid triangle is drawn last, so it hides the overlap.
      const LX = 70;
      grid(LX);
      rc.polygon(toPx(LX, HATCHED), {
        fill: h.colors.green,
        fillStyle: 'hachure',
        hachureGap: 11,
        hachureAngle: -45,
        stroke: h.colors.green,
        strokeWidth: 2.6,
      });
      rc.polygon(toPx(LX, SOLID), {
        fill: h.colors.blue,
        fillStyle: 'solid',
        stroke: h.ink,
        strokeWidth: 2.6,
      });

      // --- RIGHT: the depth buffer. A number in every square whose centre is covered.
      const RX = 580;
      grid(RX);
      const faint = { stroke: h.muted, strokeWidth: 1.4, roughness: 0.5, strokeLineDash: [8, 7] };
      rc.polygon(toPx(RX, HATCHED), faint);
      rc.polygon(toPx(RX, SOLID), faint);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const c = [i + 0.5, j + 0.5];
          const x = RX + c[0] * S;
          const y = TOP + c[1] * S;
          const front = inside(c, SOLID);
          if (!front && !inside(c, HATCHED)) continue;
          // Paper-coloured patch so the faint outlines never run through a digit.
          ctx.save();
          ctx.fillStyle = h.paper;
          ctx.beginPath();
          ctx.arc(x, y, 17, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          h.label(front ? '3' : '7', x, y + 2, { size: 40, weight: 700, color: front ? h.colors.blue : h.colors.green });
        }
      }

      h.label('colour', LX + (N * S) / 2, 72, { size: 42 });
      h.label('depth (z)', RX + (N * S) / 2, 72, { size: 42 });
      h.label('smaller = nearer', RX + (N * S) / 2, 520, { size: 38 });
    },
  },
};

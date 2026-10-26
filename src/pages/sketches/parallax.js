// Chapter 6 figures: the parallax shift, and stepping along the view ray (steep parallax / POM).
// Both share one side-view cross-section: a flat polygon line with a brick-and-mortar height
// profile hanging just below it (brick tops touch the line, mortar gaps dip down).

const GAP = 160; // mortar gap width (bricks are ~290 wide)
const DEPTH = 150; // mortar gap depth
const R = 12; // corner rounding
const BAND = 22; // thickness of the hatched "solid" band under the height profile
const XL = 30;
const XR = 970;

// Height profile + flat polygon line. `dips` are [left wall x, right wall x].
function crossSection(rc, h, yp, dips) {
  const yf = yp + DEPTH;

  // Hatched band just inside the solid, so it reads as material.
  const outer = [[XL, yp]];
  const inner = [[XR, yp + BAND]];
  for (const [x0, x1] of dips) outer.push([x0, yp], [x0, yf], [x1, yf], [x1, yp]);
  outer.push([XR, yp]);
  for (const [x0, x1] of [...dips].reverse()) inner.push([x1 + BAND, yp + BAND], [x1 + BAND, yf + BAND], [x0 - BAND, yf + BAND], [x0 - BAND, yp + BAND]);
  inner.push([XL, yp + BAND]);
  rc.polygon([...outer, ...inner], {
    stroke: 'none',
    fill: h.colors.orange,
    fillStyle: 'hachure',
    hachureGap: 9,
    fillWeight: 1.4,
    roughness: 0.8,
  });

  // The bumpy height-map line with rounded corners.
  let d = `M ${XL} ${yp}`;
  for (const [x0, x1] of dips) {
    d +=
      ` L ${x0 - R} ${yp} Q ${x0} ${yp} ${x0} ${yp + R} L ${x0} ${yf - R} Q ${x0} ${yf} ${x0 + R} ${yf}` +
      ` L ${x1 - R} ${yf} Q ${x1} ${yf} ${x1} ${yf - R} L ${x1} ${yp + R} Q ${x1} ${yp} ${x1 + R} ${yp}`;
  }
  d += ` L ${XR} ${yp}`;
  rc.path(d, { strokeWidth: 2.4, roughness: 0.6 });

  // The flat polygon, drawn on top: the brick tops touch it.
  rc.line(XL, yp, XR, yp, { stroke: h.colors.blue, strokeWidth: 3.4, roughness: 0.5 });
}

// A simple eye at (cx, cy) gazing along `angle`.
function eye(rc, ctx, h, cx, cy, angle) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  rc.path('M -40 0 Q 0 -36 40 0 Q 0 36 -40 0 Z', { strokeWidth: 2.6, roughness: 0.6 });
  rc.circle(6, 0, 26, { strokeWidth: 2, roughness: 0.6 });
  rc.circle(9, 0, 12, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1, roughness: 0.4 });
  ctx.restore();
}

// Downward curly brace from x1 to x2 at y (tip at y + depth), in the current transform.
function brace(rc, x1, x2, y, depth, o) {
  const m = (x1 + x2) / 2;
  const r = 14;
  const mid = y + depth / 2;
  rc.path(
    `M ${x1} ${y} Q ${x1} ${mid} ${x1 + r} ${mid} L ${m - r} ${mid} Q ${m} ${mid} ${m} ${y + depth} ` +
      `M ${m} ${y + depth} Q ${m} ${mid} ${m + r} ${mid} L ${x2 - r} ${mid} Q ${x2} ${mid} ${x2} ${y}`,
    o,
  );
}

export default {
  'parallax-shift': {
    height: 520,
    draw(rc, ctx, h) {
      const YP = 270;
      const YF = YP + DEPTH;
      const A = [250, YP]; // above the left edge (wall) of the first mortar gap
      const SLOPE = 1.27;
      const B = [A[0] + DEPTH / SLOPE, YF]; // where the ray first meets the height profile (gap floor)
      const len = Math.hypot(1, SLOPE);
      const dx = 1 / len;
      const dy = SLOPE / len;
      const ang = Math.atan2(SLOPE, 1);

      crossSection(rc, h, YP, [[A[0], A[0] + GAP], [700, 700 + GAP]]);

      // Eye up and to the left (centre at y = 105), on the line through A and B.
      const te = (YP - 105) / dy;
      const E = [A[0] - te * dx, A[1] - te * dy];
      eye(rc, ctx, h, E[0], E[1], ang);
      rc.line(E[0] + 46 * dx, E[1] + 46 * dy, B[0], B[1], {
        strokeWidth: 2.2,
        strokeLineDash: [14, 10],
        roughness: 0.4,
        disableMultiStroke: true,
      });

      // "Directly above B" guide, then the shift along the polygon.
      rc.line(B[0], YF - 10, B[0], YP + 8, {
        stroke: h.muted,
        strokeWidth: 1.6,
        strokeLineDash: [4, 8],
        roughness: 0.3,
        disableMultiStroke: true,
      });
      h.arrow(A[0] + 8, YP, B[0], YP, { head: 18, stroke: h.accent, strokeWidth: 4.2, roughness: 0.5 });
      rc.circle(A[0], A[1], 16, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1.4 });
      rc.circle(B[0], B[1], 16, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1.4 });

      // Labels.
      h.label('A', A[0] + 22, YP - 24, { size: 40, weight: 700 });
      h.label('B', B[0], YF + 50, { size: 40, weight: 700 });
      h.label('shift', 340, YP - 30, { size: 40, color: h.accent });
      // "view ray" written along the ray, just above it, a bit nearer the eye than A.
      const mx = E[0] + 46 * dx + 0.42 * (A[0] - E[0] - 46 * dx);
      const my = E[1] + 46 * dy + 0.42 * (A[1] - E[1] - 46 * dy);
      h.label('view ray', mx + 30 * dy, my - 30 * dx, { size: 36, rotate: ang });
      h.label('flat polygon', 840, YP - 30, { size: 38, color: h.colors.blue });
      h.label('height map', 570, YP + 65, { size: 38 });
    },
  },

  'ray-march-steps': {
    height: 470,
    draw(rc, ctx, h) {
      const YP = 250;
      const A = [310, YP]; // where the ray crosses the flat polygon
      const STEP_X = 35;
      const STEP_Y = 21; // ray slope 0.6
      const len = Math.hypot(STEP_X, STEP_Y);
      const dx = STEP_X / len;
      const dy = STEP_Y / len;
      const ang = Math.atan2(STEP_Y, STEP_X);

      crossSection(rc, h, YP, [[A[0], A[0] + GAP], [760, 760 + GAP]]);

      // Dots k = 1..6 along the ray. 1-4 are in the air of the gap; the ray meets the gap's
      // right wall (x = 470, y = 346) between dots 4 and 5, so dot 5 is inside the brick.
      const dot = (k) => [A[0] + k * STEP_X, YP + k * STEP_Y];
      const hit = dot(5);
      const last = dot(6);

      const E = [A[0] - 272 * dx, A[1] - 272 * dy];
      eye(rc, ctx, h, E[0], E[1], ang);
      const dash = { strokeWidth: 2.2, strokeLineDash: [14, 10], roughness: 0.4, disableMultiStroke: true };
      rc.line(E[0] + 46 * dx, E[1] + 46 * dy, hit[0], hit[1], dash);
      rc.line(hit[0], hit[1], last[0] + 14 * dx, last[1] + 14 * dy, { ...dash, stroke: h.muted, strokeWidth: 1.6 });

      for (let k = 1; k <= 4; k++) {
        const [x, y] = dot(k);
        rc.circle(x, y, 18, { fill: h.paper, fillStyle: 'solid', strokeWidth: 2.2, roughness: 0.5 });
      }
      rc.circle(hit[0], hit[1], 18, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1.4 });
      rc.circle(hit[0], hit[1], 46, { stroke: h.accent, strokeWidth: 2.8, roughness: 0.8 });
      ctx.save();
      ctx.globalAlpha = 0.4;
      rc.circle(last[0], last[1], 18, { stroke: h.muted, fill: h.paper, fillStyle: 'solid', strokeWidth: 1.6, roughness: 0.5 });
      ctx.restore();

      // One bracket under dots 1-4 (parallel to the ray, on its lower side).
      ctx.save();
      ctx.translate(A[0], A[1]);
      ctx.rotate(ang);
      brace(rc, len - 14, 4 * len + 14, 18, 18, { stroke: h.ink, strokeWidth: 2.2, roughness: 0.5 });
      ctx.restore();
      const c = 2.5 * len; // along-ray centre of dots 1-4
      const off = 70; // label offset below the ray
      h.label('steps', A[0] + c * dx - off * dy, A[1] + c * dy + off * dx, { size: 38 });

      h.label('first hit', hit[0] + 32, hit[1] - 23, { size: 38, align: 'left', color: h.accent });
      h.label('flat polygon', 845, YP - 32, { size: 38, color: h.colors.blue });
    },
  },
};

// Sketches for chapter 9, Global Illumination.

// Arrow head only (two strokes at x2, y2 pointing away from x1, y1).
function head(rc, x1, y1, x2, y2, len, opts) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  for (const s of [-1, 1]) rc.line(x2, y2, x2 - len * Math.cos(a + s * 0.45), y2 - len * Math.sin(a + s * 0.45), opts);
}

// Label on a paper-coloured backing so hatching or dots underneath do not cut through it.
function plateLabel(ctx, h, text, x, y, size, color = h.ink) {
  ctx.save();
  ctx.font = `600 ${size}px ${h.fonts.hand}`;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = h.paper;
  ctx.fillRect(x - w / 2 - 5, y - size * 0.5, w + 10, size);
  ctx.restore();
  h.label(text, x, y, { size, color });
}

export default {
  'direct-indirect-light': {
    height: 630,
    draw(rc, ctx, h) {
      const room = { x: 330, y: 30, s: 520 }; // square cross-section
      const floorY = room.y + room.s;
      const bulb = { x: room.x + room.s / 2, y: 92, r: 22 };
      const wallHit = { x: room.x, y: room.y + room.s / 2 }; // middle of the left wall
      const land = { x: 420, y: floorY - 4 }; // where the bounce lands, near the left corner

      // Red left wall (hatched) and the room.
      rc.rectangle(room.x - 36, room.y, 36, room.s, { fill: h.colors.red, fillStyle: 'hachure', hachureGap: 9, strokeWidth: 2 });
      rc.rectangle(room.x, room.y, room.s, room.s, { strokeWidth: 2.8 });

      // Pink tint on the floor where the bounced light lands.
      rc.rectangle(land.x - 52, floorY - 24, 112, 22, { fill: '#e0898a', fillStyle: 'hachure', hachureGap: 7, stroke: 'none' });

      // Hanging bulb.
      rc.line(bulb.x, room.y, bulb.x, bulb.y - bulb.r - 14);
      rc.rectangle(bulb.x - 10, bulb.y - bulb.r - 14, 20, 14, { strokeWidth: 2 });
      rc.circle(bulb.x, bulb.y, bulb.r * 2, { fill: h.colors.yellow, fillStyle: 'hachure', hachureGap: 6 });

      // Direct light straight down to the middle of the floor.
      h.arrow(bulb.x, bulb.y + bulb.r + 8, bulb.x, floorY - 4, { head: 24 });

      // Direct light to the middle of the red wall...
      const dx = wallHit.x - bulb.x;
      const dy = wallHit.y - bulb.y;
      const l = Math.hypot(dx, dy);
      h.arrow(bulb.x + (dx / l) * (bulb.r + 8), bulb.y + (dy / l) * (bulb.r + 8), wallHit.x + 3, wallHit.y - 2, { head: 24 });

      // ...then a dashed bounce down to the floor near the left corner.
      const b0 = { x: wallHit.x + 6, y: wallHit.y + 10 };
      rc.line(b0.x, b0.y, land.x, land.y, { strokeLineDash: [13, 10], disableMultiStroke: true, strokeWidth: 2.6, stroke: h.colors.red });
      head(rc, b0.x, b0.y, land.x, land.y, 22, { stroke: h.colors.red, strokeWidth: 2.6 });

      h.label('light', 675, bulb.y);
      h.label('direct', 665, 330);
      h.label('red wall', 205, wallHit.y, { color: h.colors.red });
      h.label('bounce', 452, 410, { color: h.colors.red });
      h.label('pink tint', 425, 590, { color: '#c4606a' });
    },
  },

  'radiosity-patches': {
    height: 620,
    draw(rc, ctx, h) {
      // One-point perspective: x, y in [-1, 1] (y = 1 is the floor), depth z from 1 (open front) to D (back wall).
      const V = { x: 500, y: 280 };
      const ax = 360;
      const ay = 240;
      const D = 2.4;
      const P = (x, y, z) => [V.x + (ax * x) / z, V.y + (ay * y) / z];
      const zs = [0, 1, 2, 3, 4].map((i) => 1 + (i * (D - 1)) / 4);
      const us = [-1, -0.5, 0, 0.5, 1];

      // Left wall hatched red, right wall dotted green.
      rc.polygon([P(-1, -1, 1), P(-1, -1, D), P(-1, 1, D), P(-1, 1, 1)], {
        fill: h.colors.red, fillStyle: 'hachure', hachureGap: 11, stroke: 'none',
      });
      ctx.save();
      ctx.fillStyle = h.colors.green;
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
          const y = -1 + (i + 0.5) / 6;
          const z = 1 + ((j + 0.5) * (D - 1)) / 12;
          const [px, py] = P(1, y, z);
          ctx.beginPath();
          ctx.arc(px, py, 3.4 / z, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 4 x 4 patch grid on every surface.
      const grid = { stroke: h.muted, strokeWidth: 1.5, roughness: 0.5 };
      const seg = (a, b, o = grid) => rc.line(a[0], a[1], b[0], b[1], o);
      for (const u of us.slice(1, 4)) {
        for (const side of [-1, 1]) {
          seg(P(side, u, 1), P(side, u, D)); // side walls, rows running into depth
          seg(P(u, side, 1), P(u, side, D)); // floor and ceiling, columns running into depth
        }
        seg(P(u, -1, D), P(u, 1, D)); // back wall
        seg(P(-1, u, D), P(1, u, D));
      }
      for (const z of zs.slice(1, 4)) {
        for (const side of [-1, 1]) {
          seg(P(side, -1, z), P(side, 1, z));
          seg(P(-1, side, z), P(1, side, z));
        }
      }

      // Box edges.
      const edge = { strokeWidth: 2.8 };
      rc.rectangle(V.x - ax, V.y - ay, ax * 2, ay * 2, edge);
      rc.rectangle(V.x - ax / D, V.y - ay / D, (ax * 2) / D, (ay * 2) / D, edge);
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) seg(P(x, y, 1), P(x, y, D), edge);

      // Square light in the middle of the ceiling.
      rc.polygon([P(-0.25, -1, 1.45), P(0.25, -1, 1.45), P(0.25, -1, 1.95), P(-0.25, -1, 1.95)], {
        fill: h.colors.yellow, fillStyle: 'solid', strokeWidth: 2.4,
      });

      // Two shaded patches: on the floor by the left wall, and low on the left wall.
      const shade = { fill: h.colors.yellow, fillStyle: 'solid', strokeWidth: 2.6 };
      rc.polygon([P(-1, 1, zs[0]), P(-0.5, 1, zs[0]), P(-0.5, 1, zs[1]), P(-1, 1, zs[1])], shade);
      rc.polygon([P(-1, 0.5, zs[2]), P(-1, 0.5, zs[3]), P(-1, 1, zs[3]), P(-1, 1, zs[2])], shade);

      // Curved double-headed arrow between the patch centres.
      const [sx, sy] = P(-0.75, 1, (zs[0] + zs[1]) / 2);
      const [ex, ey] = P(-1, 0.75, (zs[2] + zs[3]) / 2);
      const cx = 400;
      const cy = 470;
      const ao = { stroke: h.accent, strokeWidth: 2.8 };
      rc.path(`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`, ao);
      head(rc, cx, cy, sx, sy, 18, ao);
      head(rc, cx, cy, ex, ey, 18, ao);

      // Labels.
      const [lx, ly] = P(0.25, -1, 1.175);
      h.label('light', lx, ly);
      const [rx, ry] = P(-1, -0.25, 1.175);
      plateLabel(ctx, h, 'red', rx, ry, 40, h.colors.red);
      const [gx, gy] = P(1, -0.25, 1.175);
      plateLabel(ctx, h, 'green', gx, gy, 36, h.colors.green);
      plateLabel(ctx, h, 'shares light', 455, 488, 36, h.accent);
      h.arrow(214, 561, 244, 499, { head: 16, strokeWidth: 2 });
      h.label('patch', 200, 583);
    },
  },
};

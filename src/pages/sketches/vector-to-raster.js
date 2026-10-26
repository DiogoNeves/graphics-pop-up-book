// Chapter 1 figures: Tennis for Two on an oscilloscope, and vector vs raster beam paths.

function roundRectPath(x, y, w, h, r) {
  return (
    `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} ` +
    `L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} ` +
    `L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`
  );
}

function dot(ctx, x, y, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Two short strokes forming an arrowhead whose tip is at (x, y), pointing along `ang`.
function head(rc, x, y, ang, size, o) {
  for (const s of [-1, 1]) {
    rc.line(x, y, x - size * Math.cos(ang + s * 0.5), y - size * Math.sin(ang + s * 0.5), o);
  }
}

export default {
  'tennis-for-two-scope': {
    height: 570,
    draw(rc, ctx, h) {
      const green = h.colors.green;

      // --- Oscilloscope: a box with a top face, a shaded side face and a round screen.
      rc.polygon([[205, 80], [635, 80], [675, 50], [245, 50]], { strokeWidth: 2.2 });
      rc.polygon([[635, 80], [675, 50], [675, 490], [635, 520]], {
        strokeWidth: 2.2,
        fill: h.muted,
        fillStyle: 'hachure',
        hachureGap: 12,
        hachureAngle: 60,
      });
      rc.rectangle(205, 80, 430, 440, { strokeWidth: 2.6 });
      rc.rectangle(240, 520, 44, 14, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1.6 });
      rc.rectangle(556, 520, 44, 14, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1.6 });

      const cx = 420;
      const cy = 300;
      rc.circle(cx, cy, 392, { strokeWidth: 2.6 });
      rc.circle(cx, cy, 360, { fill: 'rgba(91, 140, 90, 0.14)', fillStyle: 'solid', strokeWidth: 1.6 });

      // Court and net, drawn by the beam in phosphor green.
      const trace = { stroke: green, strokeWidth: 3.6, roughness: 0.7 };
      rc.line(cx - 135, cy + 100, cx + 135, cy + 100, trace);
      rc.line(cx, cy + 100, cx, cy + 25, trace);

      // Ball flight: a parabola from low on the left, over the net, down on the right.
      const k = 150 / 14400;
      const f = (u) => -105 + k * (u + 10) * (u + 10); // local y for local x = u
      const ball = [100, f(100)]; // (100, 21) local
      const trail = [];
      let prev = [-130, f(-130)];
      let acc = 19;
      for (let u = -130; u <= 100; u += 1) {
        const p = [u, f(u)];
        acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        prev = p;
        if (acc >= 19 && Math.hypot(p[0] - ball[0], p[1] - ball[1]) > 28) {
          trail.push(p);
          acc = 0;
        }
      }
      trail.forEach(([u, v], i) => {
        const t = trail.length > 1 ? i / (trail.length - 1) : 1;
        dot(ctx, cx + u, cy + v, 4 + 2 * t, green, 0.45 + 0.5 * t);
      });
      dot(ctx, cx + ball[0], cy + ball[1], 22, green, 0.22);
      dot(ctx, cx + ball[0], cy + ball[1], 11, green, 1);
      dot(ctx, cx + ball[0] - 3, cy + ball[1] - 3, 3.5, '#eaf6dc', 1);

      // --- Hand-held controller: knob on top, push button on its right side.
      rc.path(roundRectPath(800, 300, 110, 150, 18), {
        strokeWidth: 2.6,
        fill: h.muted,
        fillStyle: 'hachure',
        hachureGap: 14,
        hachureAngle: -40,
      });
      rc.line(855, 300, 855, 283, { strokeWidth: 4 });
      rc.circle(855, 262, 44, { fill: h.accent, fillStyle: 'hachure', hachureGap: 6, strokeWidth: 2.4 });
      rc.line(855, 262, 870, 247, { strokeWidth: 3 });
      rc.arc(910, 365, 34, 34, -Math.PI / 2, Math.PI / 2, true, {
        fill: h.accent,
        fillStyle: 'solid',
        strokeWidth: 2.2,
      });

      // Curly cable from the oscilloscope's side to the controller.
      const cable = [];
      const loops = 6;
      const r = 11;
      for (let i = 0; i <= 180; i++) {
        const t = i / 180;
        const th = 2 * Math.PI * loops * t;
        const bx = 660 + 140 * t;
        const by = 420 - 10 * t + 45 * Math.sin(Math.PI * t);
        cable.push([bx + r * Math.sin(th), by + r * (1 - Math.cos(th))]);
      }
      rc.curve(cable, { strokeWidth: 2, roughness: 0.5 });

      // --- Labels.
      const L = { size: 38, align: 'right' };
      h.label('ball trail', 190, 205, L);
      h.arrow(198, 212, 318, 255, { head: 16, strokeWidth: 2 });
      h.label('net', 190, 370, L);
      h.arrow(198, 370, 408, 370, { head: 16, strokeWidth: 2 });
      h.label('court', 190, 455, L);
      h.arrow(198, 448, 296, 409, { head: 16, strokeWidth: 2 });

      h.label('angle knob', 855, 175, { size: 38 });
      h.arrow(855, 196, 855, 235, { head: 14, strokeWidth: 2 });
      h.label('hit button', 880, 515, { size: 38 });
      h.arrow(938, 493, 925, 388, { head: 14, strokeWidth: 2 });
    },
  },

  'vector-vs-raster': {
    height: 520,
    draw(rc, ctx, h) {
      const screen = { strokeWidth: 3 };
      rc.path(roundRectPath(40, 100, 420, 320, 36), screen);
      rc.path(roundRectPath(540, 100, 420, 320, 36), screen);
      h.label('VECTOR', 250, 56, { size: 44, weight: 700 });
      h.label('RASTER', 750, 56, { size: 44, weight: 700 });

      // --- LEFT: the beam goes straight to each part of the picture.
      rc.line(120, 360, 380, 360, { strokeWidth: 4.5 });
      rc.line(250, 360, 250, 270, { strokeWidth: 4.5 });
      rc.circle(370, 170, 20, { fill: h.ink, fillStyle: 'solid' });

      // Beam path, drawn just beside the strokes so it stays visible:
      // from the end of the horizontal line, to the foot of the vertical, up it, then across to the dot.
      const beam = { stroke: h.accent, strokeWidth: 2, roughness: 0.6 };
      const path = [[380, 342], [268, 342], [268, 262], [358, 181]];
      rc.linearPath(path, beam);
      dot(ctx, 380, 342, 5, h.accent);
      for (let i = 0; i < path.length - 1; i++) {
        const [x1, y1] = path[i];
        const [x2, y2] = path[i + 1];
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const mx = (x1 + x2) / 2 + 6 * Math.cos(ang);
        const my = (y1 + y2) / 2 + 6 * Math.sin(ang);
        head(rc, mx, my, ang, 13, beam);
      }
      head(rc, 358, 181, Math.atan2(181 - 262, 358 - 268), 13, beam);

      // --- RIGHT: the beam sweeps every row, left to right, top to bottom.
      const rows = [];
      for (let k = 0; k < 8; k++) rows.push(135 + (k * 250) / 7);
      const row = { strokeWidth: 1.8, roughness: 0.7 };
      rows.forEach((y, k) => {
        rc.line(580, y, 920, y, row);
        head(rc, 920, y, 0, 12, row);
        if (k < rows.length - 1) {
          rc.line(920, y, 580, rows[k + 1], {
            stroke: h.muted,
            strokeWidth: 1.3,
            roughness: 0.4,
            strokeLineDash: [7, 9],
          });
        }
      });
      // A small square ball: the same short stretch brightened on two neighbouring rows.
      for (const y of [rows[3], rows[4]]) {
        rc.rectangle(800, y - 13, 62, 26, {
          fill: h.accent,
          fillStyle: 'solid',
          stroke: h.accent,
          strokeWidth: 1.5,
          roughness: 0.6,
        });
      }

      h.label('scanline', 690, 478, { size: 40 });
      h.arrow(712, 452, 733, 394, { head: 14, strokeWidth: 2 });
    },
  },
};

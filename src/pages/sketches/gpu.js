// Chapter 4 figures: one CPU worker vs sixteen GPU workers, and Clark's 12-chip Geometry System.

export default {
  'cpu-vs-gpu-pixels': {
    height: 585,
    draw(rc, ctx, h) {
      const C = 80; // cell size
      const N = 4;
      const TOP = 175; // top of both grids
      const LX = 70; // left grid x
      const RX = 610; // right grid x
      const WORKER_Y = 112;

      const shade = (x, y) =>
        rc.rectangle(x + 4, y + 4, C - 8, C - 8, {
          stroke: 'none',
          fill: h.accent,
          fillStyle: 'hachure',
          hachureGap: 14,
          fillWeight: 1.3,
          roughness: 0.9,
        });
      const grid = (x0) => {
        for (let i = 0; i <= N; i++) {
          rc.line(x0 + i * C, TOP, x0 + i * C, TOP + N * C, { strokeWidth: 2.2, roughness: 0.7 });
          rc.line(x0, TOP + i * C, x0 + N * C, TOP + i * C, { strokeWidth: 2.2, roughness: 0.7 });
        }
      };

      // LEFT: the first five squares in reading order, numbered.
      for (let k = 0; k < 5; k++) shade(LX + (k % N) * C, TOP + Math.floor(k / N) * C);
      grid(LX);
      for (let k = 0; k < 5; k++) {
        h.label(String(k + 1), LX + (k % N) * C + C / 2, TOP + Math.floor(k / N) * C + C / 2, { size: 42, weight: 700 });
      }
      // One worker above the top-left square.
      const wx = LX + C / 2;
      rc.circle(wx, WORKER_Y, 36, { fill: h.accent, fillStyle: 'solid', strokeWidth: 2 });
      h.arrow(wx, WORKER_Y + 22, wx, TOP - 3, { head: 16, strokeWidth: 2.2, roughness: 0.6 });

      // RIGHT: all sixteen squares shaded.
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) shade(RX + c * C, TOP + r * C);
      grid(RX);
      // Sixteen tiny workers in a row; worker (c, r) sits above column c and drops
      // straight down to the centre height of row r, so every square gets one arrow.
      for (let c = 0; c < N; c++) {
        for (let r = 0; r < N; r++) {
          const x = RX + c * C + 10 + r * 20;
          rc.circle(x, WORKER_Y, 15, { fill: h.accent, fillStyle: 'solid', strokeWidth: 1.4, roughness: 0.6 });
          h.arrow(x, WORKER_Y + 10, x, TOP + r * C + C / 2, { head: 10, strokeWidth: 1.6, roughness: 0.4 });
        }
      }

      // Labels.
      h.label('CPU', wx, 52, { size: 44, weight: 700 });
      h.label('GPU', RX + (N * C) / 2, 52, { size: 44, weight: 700 });
      h.label('one at a time', LX + (N * C) / 2, 540, { size: 40 });
      h.label('all at once', RX + (N * C) / 2, 540, { size: 40 });
    },
  },

  'geometry-engine-pipeline': {
    height: 420,
    draw(rc, ctx, h) {
      const S = 48; // chip size
      const STEP = 72; // chip + gap
      const X0 = 80;
      const Y = 215; // row centre
      const top = Y - S / 2;
      const bx = (i) => X0 + i * STEP; // left edge of chip i (0-based)

      for (let i = 0; i < 12; i++) {
        rc.rectangle(bx(i), top, S, S, {
          fill: h.colors.yellow,
          fillStyle: 'hachure',
          hachureGap: 9,
          strokeWidth: 2.4,
        });
        if (i < 11) h.arrow(bx(i) + S + 3, Y, bx(i + 1) - 3, Y, { head: 9, strokeWidth: 1.8, roughness: 0.5 });
      }

      // In and out arrows, bent so their labels sit clear of the chips.
      rc.line(40, 140, 40, Y, { strokeWidth: 2.2, roughness: 0.6 });
      h.arrow(40, Y, X0 - 4, Y, { head: 14, strokeWidth: 2.2, roughness: 0.6 });
      h.label('3D points in', 22, 112, { size: 40, align: 'left' });
      rc.line(bx(11) + S + 4, Y, 958, Y, { strokeWidth: 2.2, roughness: 0.6 });
      h.arrow(958, Y, 958, 142, { head: 14, strokeWidth: 2.2, roughness: 0.6 });
      h.label('screen coordinates', 980, 112, { size: 40, align: 'right' });

      // Curly brackets under the chip groups: 1-4, 5-10, 11-12.
      const brace = (x1, x2, y, d = 30) => {
        const m = (x1 + x2) / 2;
        const r = 16;
        const mid = y + d / 2;
        rc.path(
          `M ${x1} ${y} Q ${x1} ${mid} ${x1 + r} ${mid} L ${m - r} ${mid} Q ${m} ${mid} ${m} ${y + d} ` +
            `M ${m} ${y + d} Q ${m} ${mid} ${m + r} ${mid} L ${x2 - r} ${mid} Q ${x2} ${mid} ${x2} ${y}`,
          { stroke: h.accent, strokeWidth: 2.6, roughness: 0.7 },
        );
      };
      const by = top + S + 22;
      const groups = [
        [0, 3, 'transform'],
        [4, 9, 'clip'],
        [10, 11, 'scale'],
      ];
      for (const [a, b, name] of groups) {
        const x1 = bx(a) + 2;
        const x2 = bx(b) + S - 2;
        brace(x1, x2, by);
        h.label(name, (x1 + x2) / 2, by + 62, { size: 40 });
      }
    },
  },
};

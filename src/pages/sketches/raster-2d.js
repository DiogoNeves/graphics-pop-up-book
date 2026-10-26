// Chapter 2 figures: Bresenham's pixel choices on a grid, and jaggies vs anti-aliasing.

const PALE_ACCENT = '#e2b4a0';

export default {
  'bresenham-grid': {
    height: 580,
    draw(rc, ctx, h) {
      const X0 = 140;
      const BOTTOM = 470;
      const S = 90; // cell size; grid is 8 columns x 4 rows
      const COLS = 8;
      const ROWS = 4;
      const TOP = BOTTOM - ROWS * S;
      // Column c (1..8, left to right), row r (1..4, bottom to top).
      const cellX = (c) => X0 + (c - 1) * S;
      const cellY = (r) => BOTTOM - r * S;
      const midX = (c) => X0 + (c - 0.5) * S;
      const midY = (r) => BOTTOM - (r - 0.5) * S;

      // Grid.
      const gridLine = { stroke: h.muted, strokeWidth: 1.6, roughness: 0.7 };
      for (let c = 0; c <= COLS; c++) rc.line(X0 + c * S, TOP, X0 + c * S, BOTTOM, gridLine);
      for (let r = 0; r <= ROWS; r++) rc.line(X0, BOTTOM - r * S, X0 + COLS * S, BOTTOM - r * S, gridLine);

      // The eight chosen pixels: one per column.
      const chosen = [[1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [7, 4], [8, 4]];
      for (const [c, r] of chosen) {
        rc.rectangle(cellX(c) + 3, cellY(r) + 3, S - 6, S - 6, {
          fill: PALE_ACCENT,
          fillStyle: 'solid',
          stroke: h.accent,
          strokeWidth: 2.2,
          roughness: 0.9,
        });
      }

      // The ideal line, centre of (1,1) to centre of (8,4).
      const x1 = midX(1);
      const y1 = midY(1);
      const x2 = midX(8);
      const y2 = midY(4);
      rc.line(x1, y1, x2, y2, { strokeWidth: 2.6, roughness: 0.4, bowing: 0.3 });
      rc.circle(x1, y1, 10, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1 });
      rc.circle(x2, y2, 10, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1 });

      // Error in column 2: from the chosen pixel's centre up to the line.
      const ex = midX(2);
      const eBottom = midY(1);
      const eTop = y1 + ((y2 - y1) * (ex - x1)) / (x2 - x1); // where the line crosses x = ex
      const err = { stroke: h.colors.blue, strokeWidth: 2.6, roughness: 0.3 };
      rc.line(ex, eBottom - 1, ex, eTop + 1, err);
      for (const s of [-1, 1]) {
        rc.line(ex, eTop + 1, ex + s * 7, eTop + 11, err);
        rc.line(ex, eBottom - 1, ex + s * 7, eBottom - 11, err);
      }

      // Labels.
      h.label('ideal line', 880, 62, { size: 38 });
      h.arrow(850, 84, 797, 154, { head: 15, strokeWidth: 2 });
      h.label('chosen pixels', 150, 540, { size: 38 });
      h.arrow(175, 518, 185, 480, { head: 14, strokeWidth: 2 });
      h.label('error', 395, 540, { size: 38, color: h.colors.blue });
      h.arrow(378, 518, 285, 412, { head: 15, strokeWidth: 2, stroke: h.colors.blue });
    },
  },

  'jaggies-vs-antialiased': {
    height: 540,
    draw(rc, ctx, h) {
      const N = 6;
      const S = 60;
      const TOP = 70;
      const BOTTOM = TOP + N * S;
      // Edge in cell units, origin at the grid's bottom-left: y = (2/3) x, from (0,0) to (6,4).
      const edgeY = (x) => (2 / 3) * x;

      // Fraction of cell (i, j) lying below the edge (j counts rows from the bottom).
      const coverage = (i, j) => {
        const n = 20;
        let inside = 0;
        for (let a = 0; a < n; a++) {
          for (let b = 0; b < n; b++) {
            const x = i + (a + 0.5) / n;
            const y = j + (b + 0.5) / n;
            if (y < edgeY(x)) inside++;
          }
        }
        return inside / (n * n);
      };

      const drawGrid = (x0, smooth) => {
        const cellX = (i) => x0 + i * S;
        const cellY = (j) => BOTTOM - (j + 1) * S;
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const centreBelow = j + 0.5 < edgeY(i + 0.5);
            if (!smooth) {
              if (centreBelow) {
                rc.rectangle(cellX(i), cellY(j), S, S, { fill: h.ink, fillStyle: 'solid', stroke: 'none', roughness: 0.5 });
              }
              continue;
            }
            const cov = coverage(i, j);
            if (cov > 0.999) {
              rc.rectangle(cellX(i), cellY(j), S, S, { fill: h.ink, fillStyle: 'solid', stroke: 'none', roughness: 0.5 });
            } else if (cov > 0.001) {
              // Edge pixel: grey hatching, denser where more of the cell is covered.
              const gap = Math.max(5, Math.min(30, 5.5 / cov));
              rc.rectangle(cellX(i) + 2, cellY(j) + 2, S - 4, S - 4, {
                fill: '#857b72',
                fillStyle: 'hachure',
                hachureGap: gap,
                hachureAngle: -45,
                fillWeight: 2,
                stroke: 'none',
                roughness: 0.7,
              });
            }
          }
        }
        const gridLine = { stroke: h.muted, strokeWidth: 1.3, roughness: 0.6 };
        for (let k = 1; k < N; k++) {
          rc.line(x0 + k * S, TOP, x0 + k * S, BOTTOM, gridLine);
          rc.line(x0, TOP + k * S, x0 + N * S, TOP + k * S, gridLine);
        }
        rc.rectangle(x0, TOP, N * S, N * S, { strokeWidth: 2.4, roughness: 0.8 });
        rc.line(x0, BOTTOM, x0 + N * S, BOTTOM - edgeY(N) * S, {
          stroke: h.accent,
          strokeWidth: 3.2,
          roughness: 0.4,
          bowing: 0.3,
        });
      };

      drawGrid(80, false);
      drawGrid(560, true);
      h.label('jaggies', 260, 488, { size: 42 });
      h.label('anti-aliased', 740, 488, { size: 42 });
    },
  },
};

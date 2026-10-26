// Chapter 5 figures: normals tilted by a bump map over a flat surface, and a normal-mapped tile edge-on.

export default {
  'tilted-normals': {
    height: 480,
    draw(rc, ctx, h) {
      const YF = 390; // the real, flat surface
      const X0 = 100; // the pretend bumps run from X0 to X0 + 3P
      const P = 800 / 3; // one bump
      const AMP = 40; // bump height
      const YT = YF - 18; // troughs of the pretend bumps
      const waveY = (x) => YT - (AMP * (1 - Math.cos((2 * Math.PI * (x - X0)) / P))) / 2;
      const slope = (x) => -AMP * (Math.PI / P) * Math.sin((2 * Math.PI * (x - X0)) / P);

      // Real surface.
      rc.line(40, YF, 960, YF, { strokeWidth: 3.2, roughness: 0.6 });

      // Pretend bumps (dashed).
      const pts = [];
      for (let x = X0; x <= X0 + 3 * P + 0.1; x += 16) pts.push([x, waveY(x)]);
      rc.curve(pts, { stroke: h.muted, strokeWidth: 2.6, strokeLineDash: [12, 9], roughness: 0.4, disableMultiStroke: true });

      // Seven normals, a third of a bump apart, starting under the first peak:
      // peaks point straight up, slopes lean (up-left on a rise, up-right on a fall).
      const L = 82;
      const tips = [];
      for (let k = 0; k < 7; k++) {
        const x = X0 + P * (0.5 + k / 3);
        const m = slope(x);
        const len = Math.hypot(m, 1);
        const tx = x + (L * m) / len;
        const ty = YF - L / len;
        tips.push([tx, ty]);
        h.arrow(x, YF, tx, ty, { head: 16, stroke: h.accent, strokeWidth: 3.6, roughness: 0.5 });
        rc.circle(x, YF, 9, { fill: h.ink, fillStyle: 'solid', strokeWidth: 1 });
      }

      // Sun and light.
      const SX = 100;
      const SY = 95;
      rc.circle(SX, SY, 70, { fill: h.colors.yellow, fillStyle: 'hachure', hachureGap: 8, strokeWidth: 2.4 });
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        rc.line(SX + 46 * Math.cos(a), SY + 46 * Math.sin(a), SX + 62 * Math.cos(a), SY + 62 * Math.sin(a), {
          strokeWidth: 2.2,
          roughness: 0.6,
        });
      }
      const la = { head: 18, stroke: h.colors.orange, strokeWidth: 2.8, roughness: 0.6 };
      h.arrow(165, 150, 285, 240, la);
      h.arrow(195, 110, 315, 200, la);

      // Labels.
      h.label('light', 350, 145, { size: 40 });
      h.label('real surface: flat', 500, YF + 44, { size: 40 });
      // "pretend bumps": above-right of the last peak, with a short leader to the dashed line.
      h.label('pretend bumps', 978, YF - 118, { size: 38, align: 'right' });
      rc.line(872, YF - 96, 866, waveY(866) - 8, { stroke: h.muted, strokeWidth: 1.6, roughness: 0.4 });
      // "tilted normal": the fifth normal (on a falling slope, leaning right).
      const [nx, ny] = tips[4];
      h.label('tilted normal', 585, YF - 152, { size: 38, color: h.accent });
      rc.line(598, YF - 131, nx - 3, ny - 12, { stroke: h.accent, strokeWidth: 1.6, roughness: 0.4 });
    },
  },

  'edge-on-tile': {
    height: 460,
    draw(rc, ctx, h) {
      // LEFT: the tile face-on, a brick pattern lit from the upper left.
      const TX = 60;
      const TY = 70;
      const T = 300;
      const RH = T / 3;
      const rows = [
        [[0, 150], [150, 300]],
        [[0, 75], [75, 225], [225, 300]],
        [[0, 150], [150, 300]],
      ];
      rows.forEach((bricks, r) => {
        for (const [a, b] of bricks) {
          const x = TX + a + 6;
          const y = TY + r * RH + 6;
          const w = b - a - 12;
          const hh = RH - 12;
          rc.rectangle(x, y, w, hh, {
            fill: h.colors.red,
            fillStyle: 'hachure',
            hachureGap: 10,
            strokeWidth: 1.6,
            roughness: 0.8,
          });
          // Dark shadow edge along the bottom and right: the brick looks raised.
          rc.linearPath([[x + 2, y + hh], [x + w, y + hh], [x + w, y + 2]], { strokeWidth: 5.5, roughness: 0.5 });
        }
      });
      rc.rectangle(TX, TY, T, T, { strokeWidth: 2.6, roughness: 0.7 });
      h.label('face-on: looks bumpy', TX + T / 2, 418, { size: 40 });

      // RIGHT: the same tile edge-on, a long thin strip with a dead-straight top.
      const EX = 640;
      const EY = 213;
      rc.rectangle(EX, EY, T, 14, {
        fill: h.colors.red,
        fillStyle: 'hachure',
        hachureGap: 6,
        strokeWidth: 2.6,
        roughness: 0,
      });
      h.label('edge-on: still flat', EX + T / 2, 268, { size: 40 });

      // Curved "turn" arrow between them.
      const ar = { stroke: h.accent, strokeWidth: 2.8, roughness: 0.6 };
      rc.path('M 385 175 Q 500 60 615 175', ar);
      const a = Math.atan2(175 - 60, 615 - 500);
      for (const s of [-1, 1]) {
        rc.line(615, 175, 615 - 22 * Math.cos(a + s * 0.45), 175 - 22 * Math.sin(a + s * 0.45), ar);
      }
      h.label('turn', 500, 84, { size: 42, color: h.accent });
    },
  },
};

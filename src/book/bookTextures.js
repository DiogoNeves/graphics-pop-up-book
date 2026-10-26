import * as THREE from 'three/webgpu';
import rough from 'roughjs';

export const CLOTH = '#7b2d26';
const GOLD = '#e7c56d';

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function makeCoverTexture(aspect) {
  const w = 1024;
  const h = Math.round(w * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = CLOTH;
  ctx.fillRect(0, 0, w, h);

  const rc = rough.canvas(canvas, { options: { seed: 7, stroke: GOLD, strokeWidth: 3, roughness: 0.8 } });
  rc.rectangle(60, 60, w - 120, h - 120, { roughness: 0.4 });
  rc.rectangle(80, 80, w - 160, h - 160, { strokeWidth: 1.5, roughness: 0.4 });

  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.font = 'italic 400 46px "Crimson Pro", Georgia, serif';
  ctx.fillText('A Pop-up History of', w / 2, h * 0.24);
  ctx.font = '600 104px "Fraunces", Georgia, serif';
  ctx.fillText('Computer', w / 2, h * 0.24 + 130);
  ctx.fillText('Graphics', w / 2, h * 0.24 + 240);

  // Emblem: a wireframe triangle being rasterised into pixels.
  const cx = w / 2;
  const cy = h * 0.66;
  const s = 26;
  for (let gy = -5; gy <= 4; gy++) {
    for (let gx = -6; gx <= 6; gx++) {
      const px = cx + gx * s;
      const py = cy + gy * s;
      const t = (py - (cy - 5 * s)) / (9 * s);
      const half = t * 6 * s;
      if (Math.abs(px - cx) <= half && t >= 0 && t <= 1) {
        ctx.globalAlpha = 0.35 + 0.5 * t;
        ctx.fillRect(px - s / 2 + 2, py - s / 2 + 2, s - 4, s - 4);
      }
    }
  }
  ctx.globalAlpha = 1;
  rc.polygon([[cx, cy - 5.5 * s], [cx + 6.5 * s, cy + 4.5 * s], [cx - 6.5 * s, cy + 4.5 * s]], { strokeWidth: 3 });

  ctx.font = 'italic 400 34px "Crimson Pro", Georgia, serif';
  ctx.fillText('from oscilloscopes to global illumination', w / 2, h - 140);
  return canvasTexture(canvas);
}

export function makeEdgeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#efe5cf';
  ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = '#d9cbb0';
  for (let y = 3; y < 256; y += 7) ctx.fillRect(0, y, 64, 1.5);
  const tex = canvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

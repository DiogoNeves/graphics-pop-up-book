import * as THREE from 'three/webgpu';
import { texture, uniform, uv, vec2, float, mix, smoothstep, step, color } from 'three/tsl';
import { renderTextPage, PAPER, INK, FONTS } from './layout.js';

const PX_W = 1280;

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// A left page: a tall canvas of text seen through a page-sized window that scrolls.
export function makeLeftPage(spread, index, { W, H }) {
  const winH = Math.round((PX_W * H) / W);
  const canvas = renderTextPage(spread, index, PX_W, winH);
  const tex = canvasTexture(canvas);
  const maxScroll = canvas.height - winH;
  const scrollable = maxScroll > 0 ? 1 : 0;

  const uScroll = uniform(0);
  const uWin = uniform(winH / canvas.height);
  const uThumbA = uniform(0);
  const uThumbB = uniform(1);
  const uTopFade = uniform(0);
  const uBotFade = uniform(scrollable);

  const pu = uv().x;
  const pv = uv().y; // 1 at the top edge of the page
  const tv = float(1).sub(uScroll).sub(pv.oneMinus().mul(uWin));
  const ink = texture(tex, vec2(pu, tv)).rgb;
  const fadeTop = smoothstep(0.955, 0.995, pv).mul(uTopFade);
  const fadeBot = smoothstep(0.005, 0.045, pv).oneMinus().mul(uBotFade);
  let col = mix(ink, color(PAPER), fadeTop.max(fadeBot));
  if (scrollable) {
    const fromTop = pv.oneMinus();
    const inBar = step(0.962, pu).mul(step(pu, 0.97)).mul(step(0.06, fromTop)).mul(step(fromTop, 0.94));
    const inThumb = step(uThumbA, fromTop).mul(step(fromTop, uThumbB));
    col = mix(col, color(INK), inBar.mul(mix(float(0.1), float(0.5), inThumb)));
  }

  const material = new THREE.MeshLambertNodeMaterial({ flatShading: true });
  material.colorNode = col;

  const page = {
    material,
    texture: tex,
    winH,
    maxScroll,
    scroll: 0,
    scrollTo(px) {
      page.scroll = Math.max(0, Math.min(maxScroll, px));
      uScroll.value = page.scroll / canvas.height;
      uTopFade.value = page.scroll > 1 ? 1 : 0;
      uBotFade.value = page.scroll < maxScroll - 1 ? 1 : 0;
      const size = winH / canvas.height;
      const a = 0.06 + (maxScroll ? page.scroll / maxScroll : 0) * (1 - size) * 0.88;
      uThumbA.value = a;
      uThumbB.value = a + size * 0.88;
    },
    scrollBy(dpx) {
      page.scrollTo(page.scroll + dpx);
    },
    dispose() {
      tex.dispose();
      material.dispose();
      canvas.width = canvas.height = 0;
    },
  };
  page.scrollTo(0);
  return page;
}

// A right page: the base card a pop-up stands on, with its chapter mark and a hint.
export function makeRightPage(spread, index, { W, H }, hint) {
  const w = 1024;
  const h = Math.round((w * H) / W);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(42,36,32,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, w - 96, h - 96);
  ctx.lineWidth = 1;
  ctx.strokeRect(58, 58, w - 116, h - 116);

  ctx.fillStyle = 'rgba(42,36,32,0.55)';
  ctx.textAlign = 'right';
  ctx.font = `600 30px ${FONTS.title}`;
  const label = spread.number ? `${spread.number} · ${spread.title}` : spread.title;
  ctx.fillText(label.toUpperCase(), w - 96, 110);

  if (hint) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(42,36,32,0.75)';
    ctx.font = `500 44px ${FONTS.hand}`;
    ctx.fillText(`☞ ${hint}`, w / 2, h - 96);
  }
  const tex = canvasTexture(canvas);
  const material = new THREE.MeshLambertNodeMaterial({ map: tex, flatShading: true });
  return {
    material,
    texture: tex,
    dispose() {
      tex.dispose();
      material.dispose();
    },
  };
}

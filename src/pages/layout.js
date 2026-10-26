import rough from 'roughjs';
import { sketches } from './sketches/index.js';

export const PAPER = '#f4ecdb';
export const INK = '#2a2420';
export const ACCENT = '#b5452f';
const MUTED = '#6b5f55';
export const FONTS = {
  body: '"Crimson Pro", Georgia, serif',
  title: '"Fraunces", Georgia, serif',
  hand: '"Caveat", "Comic Sans MS", cursive',
};

const MARGIN_L = 100;
const MARGIN_R = 120;
const PAD_TOP = 120;
const PAD_BOTTOM = 150;
const SKETCH_W = 1000;

const scratch = document.createElement('canvas').getContext('2d');

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h) % 100000;
}

// Split "**bold** and _italic_" into styled runs.
function parseInline(text) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ t: text.slice(last, m.index), s: 'r' });
    const tok = m[0];
    runs.push(tok.startsWith('**') ? { t: tok.slice(2, -2), s: 'b' } : { t: tok.slice(1, -1), s: 'i' });
    last = m.index + tok.length;
  }
  if (last < text.length) runs.push({ t: text.slice(last), s: 'r' });
  return runs;
}

function fontFor(style, { size, family = FONTS.body, italic = false, weight = 400 }) {
  const it = italic || style === 'i' ? 'italic ' : '';
  const wt = style === 'b' ? 700 : weight;
  return `${it}${wt} ${size}px ${family}`;
}

// Word-wrap styled runs into lines of positioned words.
function wrap(runs, maxW, opts) {
  const lines = [];
  let line = [];
  let x = 0;
  scratch.font = fontFor('r', opts);
  const space = scratch.measureText(' ').width;
  const push = () => {
    lines.push(line);
    line = [];
    x = 0;
  };
  for (const run of runs) {
    const font = fontFor(run.s, opts);
    scratch.font = font;
    for (const part of run.t.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        if (line.length) x += space;
        continue;
      }
      let word = part;
      let w = scratch.measureText(word).width;
      // Break words longer than a line (URLs) into chunks.
      while (w > maxW) {
        let n = word.length;
        while (n > 1 && scratch.measureText(word.slice(0, n)).width > maxW - x) n--;
        if (n <= 1 && line.length) {
          push();
          continue;
        }
        line.push({ t: word.slice(0, n), font, x });
        push();
        word = word.slice(n);
        w = scratch.measureText(word).width;
      }
      if (x + w > maxW && line.length) push();
      line.push({ t: word, font, x });
      x += w;
    }
  }
  if (line.length) push();
  return lines;
}

class PageLayout {
  constructor(width) {
    this.width = width;
    this.x = MARGIN_L;
    this.maxW = width - MARGIN_L - MARGIN_R;
    this.y = PAD_TOP;
    this.ops = [];
  }

  draw(fn) {
    this.ops.push(fn);
  }

  text(text, opts, { color = INK, lineHeight = 1.45, x = this.x, maxW = this.maxW, after = 0.7, parse = true, align = 'left' } = {}) {
    const runs = parse ? parseInline(text) : [{ t: text, s: 'r' }];
    const lines = wrap(runs, maxW, opts);
    const lh = opts.size * lineHeight;
    const top = this.y;
    lines.forEach((words, i) => {
      const baseline = top + opts.size + i * lh;
      const last = words[words.length - 1];
      scratch.font = last.font;
      const lineW = last.x + scratch.measureText(last.t).width;
      const dx = align === 'center' ? (maxW - lineW) / 2 : 0;
      this.draw((ctx) => {
        ctx.fillStyle = color;
        for (const w of words) {
          ctx.font = w.font;
          ctx.fillText(w.t, x + dx + w.x, baseline);
        }
      });
    });
    this.y = top + lines.length * lh + opts.size * after;
    return lines.length * lh;
  }

  space(px) {
    this.y += px;
  }
}

function drawSketch(layout, block, ctxRef) {
  const entry = sketches[block.sketch];
  const def = typeof entry === 'function' ? { height: 600, draw: entry } : entry;
  const height = def?.height ?? 520;
  const scale = layout.maxW / SKETCH_W;
  const top = layout.y;
  const x = layout.x;
  layout.draw((ctx, canvas) => {
    const rc = rough.canvas(canvas, {
      options: { seed: hashString(block.sketch) + 1, stroke: INK, strokeWidth: 2.4, roughness: 1.1, bowing: 1 },
    });
    ctx.save();
    ctx.translate(x, top);
    ctx.scale(scale, scale);
    const helpers = sketchHelpers(ctx, rc, height);
    if (def) {
      try {
        def.draw(rc, ctx, helpers);
      } catch (err) {
        console.error(`sketch "${block.sketch}" failed`, err);
      }
    } else {
      rc.rectangle(10, 10, SKETCH_W - 20, height - 20, { strokeLineDash: [14, 12], stroke: MUTED });
      helpers.label(`sketch: ${block.sketch}`, SKETCH_W / 2, height / 2, { size: 44, color: MUTED });
    }
    ctx.restore();
  });
  layout.space(height * scale + 18);
  if (block.caption) {
    layout.text(block.caption, { size: 46, family: FONTS.hand, weight: 500 }, { color: MUTED, lineHeight: 1.2, align: 'center', after: 1.1, parse: false });
  }
  ctxRef.figures++;
}

// Drawing helpers handed to sketch functions. Sketches draw in a 1000 x height space.
function sketchHelpers(ctx, rc, height) {
  const label = (text, x, y, { size = 40, align = 'center', color = INK, weight = 600, rotate = 0, family = FONTS.hand } = {}) => {
    ctx.save();
    ctx.translate(x, y);
    if (rotate) ctx.rotate(rotate);
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  const arrow = (x1, y1, x2, y2, opts = {}) => {
    const { head = 20, ...rest } = opts;
    rc.line(x1, y1, x2, y2, rest);
    const a = Math.atan2(y2 - y1, x2 - x1);
    for (const s of [-1, 1]) {
      rc.line(x2, y2, x2 - head * Math.cos(a + s * 0.45), y2 - head * Math.sin(a + s * 0.45), rest);
    }
  };
  return {
    W: SKETCH_W,
    H: height,
    ink: INK,
    accent: ACCENT,
    muted: MUTED,
    paper: PAPER,
    colors: { red: '#c4473a', blue: '#3c6e9f', green: '#5b8c5a', yellow: '#e2b33c', teal: '#2f8f8a', orange: '#e07b39' },
    fonts: FONTS,
    label,
    arrow,
  };
}

function drawTimeline(layout, items) {
  layout.text('TIMELINE', { size: 30, family: FONTS.title, weight: 600 }, { color: ACCENT, after: 0.6, parse: false });
  const yearW = 150;
  const startY = layout.y;
  const dots = [];
  for (const [year, text] of items) {
    const top = layout.y;
    dots.push(top + 26);
    layout.draw((ctx) => {
      ctx.font = `600 44px ${FONTS.title}`;
      ctx.fillStyle = INK;
      ctx.fillText(year, layout.x, top + 38);
    });
    layout.text(text, { size: 44 }, { x: layout.x + yearW + 30, maxW: layout.maxW - yearW - 30, lineHeight: 1.3, after: 0.5 });
  }
  const endY = dots[dots.length - 1];
  layout.draw((ctx, canvas) => {
    const rc = rough.canvas(canvas, { options: { seed: 3, stroke: ACCENT, strokeWidth: 2, roughness: 0.8 } });
    const lx = layout.x + yearW + 8;
    rc.line(lx, startY + 20, lx, endY + 8);
    for (const y of dots) rc.circle(lx, y, 14, { fill: ACCENT, fillStyle: 'solid' });
  });
  layout.space(30);
}

function drawSources(layout, items) {
  layout.space(10);
  layout.text('SOURCES', { size: 28, family: FONTS.title, weight: 600 }, { color: MUTED, after: 0.6, parse: false });
  items.forEach((item, i) => {
    const top = layout.y;
    layout.draw((ctx) => {
      ctx.font = `600 28px ${FONTS.title}`;
      ctx.fillStyle = MUTED;
      ctx.fillText(`${i + 1}.`, layout.x, top + 30);
    });
    layout.text(item, { size: 34 }, { x: layout.x + 48, maxW: layout.maxW - 48, color: MUTED, lineHeight: 1.3, after: 0.55, parse: false });
  });
}

export function renderTextPage(spread, index, width, winH) {
  const layout = new PageLayout(width);
  const state = { figures: 0 };

  const kicker = spread.number ? `CHAPTER ${spread.number}  ·  ${spread.era}` : spread.era;
  if (kicker) layout.text(kicker.toUpperCase(), { size: 28, family: FONTS.title, weight: 600 }, { color: ACCENT, after: 0.5, parse: false });
  layout.text(spread.title, { size: 96, family: FONTS.title, weight: 600 }, { lineHeight: 1.1, after: 0.15, parse: false });
  const ruleY = layout.y;
  layout.draw((ctx, canvas) => {
    const rc = rough.canvas(canvas, { options: { seed: index + 5, stroke: ACCENT, strokeWidth: 3, roughness: 1.5 } });
    rc.line(layout.x, ruleY + 10, layout.x + 260, ruleY + 6);
  });
  layout.space(60);

  for (const block of spread.blocks ?? []) {
    switch (block.type) {
      case 'lead':
        layout.text(block.text, { size: 54, italic: true }, { lineHeight: 1.35, after: 0.8 });
        break;
      case 'p':
        layout.text(block.text, { size: 50 }, { lineHeight: 1.42, after: 0.7 });
        break;
      case 'h':
        layout.space(10);
        layout.text(block.text, { size: 50, family: FONTS.title, weight: 600 }, { lineHeight: 1.2, after: 0.4, parse: false });
        break;
      case 'figure':
        layout.space(20);
        drawSketch(layout, block, state);
        break;
      case 'timeline':
        layout.space(20);
        drawTimeline(layout, block.items);
        break;
      case 'tryit': {
        // Draw the box first, then the text on top of it.
        const top = layout.y;
        const opsBefore = layout.ops.length;
        drawTryItText(layout, block.text);
        const textOps = layout.ops.splice(opsBefore);
        const bottom = layout.y;
        layout.draw((ctx, canvas) => {
          const rc = rough.canvas(canvas, { options: { seed: 11, roughness: 1.2 } });
          rc.rectangle(layout.x, top, layout.maxW, bottom - top, { fill: '#ead9b5', fillStyle: 'solid', stroke: ACCENT, strokeWidth: 2.5 });
        });
        layout.ops.push(...textOps);
        layout.y = bottom + 50;
        break;
      }
      case 'sources':
        drawSources(layout, block.items);
        break;
      default:
        break;
    }
  }

  const height = Math.max(winH, Math.ceil(layout.y + PAD_BOTTOM));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';
  for (const op of layout.ops) {
    ctx.save();
    op(ctx, canvas);
    ctx.restore();
  }
  return canvas;
}

function drawTryItText(layout, text) {
  const pad = 40;
  const top = layout.y;
  layout.draw((ctx) => {
    ctx.font = `700 52px ${FONTS.hand}`;
    ctx.fillStyle = ACCENT;
    ctx.fillText('Try it ☞', layout.x + pad, top + pad + 40);
  });
  layout.space(pad + 72);
  layout.text(text, { size: 46 }, { x: layout.x + pad, maxW: layout.maxW - pad * 2, lineHeight: 1.35, after: 0 });
  layout.space(pad);
}

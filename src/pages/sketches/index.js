// Sketch registry. Each sibling module default-exports { 'sketch-id': entry }, where an
// entry is either draw(rc, ctx, h) or { height, draw(rc, ctx, h) }. Sketches draw in a
// 1000-unit-wide space (height defaults to 600) with rough.js; `h` holds helpers:
// { W, H, ink, accent, muted, paper, colors, fonts, label(text, x, y, opts), arrow(x1, y1, x2, y2, opts) }.
const modules = import.meta.glob(['./*.js', '!./index.js'], { eager: true });

export const sketches = Object.assign({}, ...Object.values(modules).map((m) => m.default));

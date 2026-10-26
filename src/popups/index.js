import { createPopupContext, standingCard, flat, palette } from './kit.js';

const modules = import.meta.glob('./chapters/*.js', { eager: true });

function placeholder(ctx, spread) {
  const group = new ctx.THREE.Group();
  const card = standingCard(ctx, { w: 2.4, h: 1.4, material: flat(palette.card), position: [0, 0, -0.4] });
  group.add(card);
  return { group, hint: 'Pop-up coming soon', update() {} };
}

// Build the pop-up for a spread, wrapped with its context. Returns null if none.
export function createPopup(spread, env) {
  const factory = modules[`./chapters/${spread.id}.js`]?.default;
  if (spread.popup === false) return null;
  const ctx = createPopupContext(env);
  let api;
  try {
    api = factory ? factory(ctx) : placeholder(ctx, spread);
  } catch (err) {
    console.error(`pop-up "${spread.id}" failed to build`, err);
    api = placeholder(ctx, spread);
  }
  ctx.root.add(api.group);
  ctx.root.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) o.castShadow = o.receiveShadow = true;
  });
  return {
    root: ctx.root,
    fold: ctx.fold,
    hint: api.hint,
    interactives: ctx.interactives,
    update(dt, time) {
      api.update?.(dt, time);
      for (const fn of ctx.updaters) fn(dt, time);
    },
  };
}

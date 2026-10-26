import * as THREE from 'three/webgpu';
import { flat, palette, labelCard, standingCard, FONT } from '../kit.js';

// Closing pop-up: a "The End" card with a few primitives bobbing in front of it.
export default function create(ctx) {
  const group = new THREE.Group();
  const card = standingCard(ctx, { w: 2.8, h: 1.3, position: [0, 0, -1.2], material: flat(palette.teal) });
  const text = labelCard('The End', { w: 2.5, h: 0.9, standing: true, thickness: 0.01, color: palette.teal, ink: palette.cream, px: 256, font: `600 150px ${FONT.title}` });
  text.position.set(0, 0.65, 0.025);
  card.userData.card.parent.add(text);
  group.add(card);

  const shapes = [
    new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), flat(palette.red)),
    new THREE.Mesh(new THREE.IcosahedronGeometry(0.33, 1), flat(palette.yellow)),
    new THREE.Mesh(new THREE.TorusKnotGeometry(0.22, 0.08, 48, 6), flat(palette.blue)),
  ];
  shapes.forEach((m, i) => {
    m.position.set((i - 1) * 1.1, 0.45, 0.5);
    group.add(ctx.fold.rise(m, { start: 0.3 + i * 0.15, end: 0.8 + i * 0.07 }));
  });

  return {
    group,
    hint: 'Thanks for reading',
    update(dt, time) {
      shapes.forEach((m, i) => {
        m.position.y = 0.45 + 0.08 * Math.sin(time * 1.6 + i * 1.3);
        m.rotation.y += dt * (0.4 + i * 0.2);
        m.rotation.x += dt * 0.2;
      });
    },
  };
}

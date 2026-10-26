import * as THREE from 'three/webgpu';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { flat, unlit, palette, labelCard, standingCard, FONT } from '../kit.js';

// Title pop-up: the Utah teapot on a pedestal, drawn three ways.
export default function create(ctx) {
  const group = new THREE.Group();

  const back = standingCard(ctx, { w: 3.2, h: 1.5, position: [0, 0, -1.5], material: flat(palette.navy), end: 0.8 });
  const title = labelCard('A POP-UP HISTORY OF\nCOMPUTER GRAPHICS', {
    w: 2.9, h: 1.1, standing: true, thickness: 0.01, color: palette.navy, ink: palette.yellow, px: 320,
    font: `600 66px ${FONT.title}`,
  });
  title.position.set(0, 0.78, 0.025);
  back.userData.card.parent.add(title);
  group.add(back);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.35, 10), flat(palette.red));
  pedestal.position.set(0, 0.175, 0.2);
  group.add(ctx.fold.rise(pedestal, { start: 0.2, end: 0.8 }));

  const geo = new TeapotGeometry(0.5, 5);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  const looks = [
    { name: 'flat shaded', mat: flat(palette.cream) },
    { name: 'wireframe', mat: unlit(palette.ink, { wireframe: true }) },
    { name: 'smooth shaded', mat: new THREE.MeshLambertNodeMaterial({ color: palette.cream }) },
  ];
  const teapot = new THREE.Mesh(geo, looks[0].mat);
  const spinner = new THREE.Group();
  spinner.position.set(0, 0.35, 0.2);
  spinner.add(teapot);
  group.add(ctx.fold.rise(spinner, { start: 0.35, end: 1 }));

  let look = 0;
  ctx.interactive(teapot, {
    onClick() {
      look = (look + 1) % looks.length;
      teapot.material = looks[look].mat;
    },
  });

  return {
    group,
    hint: 'Click the teapot to change how it is drawn',
    update(dt) {
      spinner.rotation.y += dt * 0.5;
    },
  };
}

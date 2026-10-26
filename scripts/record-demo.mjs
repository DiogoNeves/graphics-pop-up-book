// Records the demo video frame by frame: node scripts/record-demo.mjs <framesDir>
// Needs the dev server running (npm run dev -- --port 5183) and Google Chrome installed.
// Writes <framesDir>/00000.jpg… and <framesDir>/cues.json (turns, clicks) for the soundtrack.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: node scripts/record-demo.mjs <framesDir>');
  process.exit(1);
}
const URL = process.env.DEMO_URL ?? 'http://localhost:5183/?capture';
const FPS = 30;
const W = 1920;
const H = 1080;
const PREVIEW = process.env.PREVIEW === '1'; // only a few frames, to check the setup

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => m.type() === 'error' && console.error('page:', m.text().slice(0, 200)));
await page.goto(URL);
await page.waitForFunction(() => typeof window.__advance === 'function');
console.log('backend:', await page.evaluate(() => (window.__book.renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2')));

let frame = 0;
let lastTurn = null;
const cues = [];
const cursor = { x: W * 0.72, y: H * 0.86, down: false };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const now = () => frame / FPS;

async function tick() {
  const turn = await page.evaluate(
    ([dt, c]) => {
      window.__cursor(c.x, c.y, c.down);
      window.__advance(dt);
      const t = window.__book.turn;
      return t ? `${t.kind}:${t.k ?? 'c'}:${t.dir}` : null;
    },
    [1 / FPS, cursor],
  );
  if (turn && turn !== lastTurn) cues.push({ t: now(), type: turn.startsWith('cover') ? 'cover' : 'turn' });
  lastTurn = turn;
  await page.screenshot({ path: `${OUT}/${String(frame).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  frame++;
  if (frame % 90 === 0) console.log(`${now().toFixed(1)}s`);
}

async function wait(sec) {
  for (let i = 0; i < Math.round(sec * FPS); i++) await tick();
}

// Tick until the book has finished turning (pop-ups ignore input mid-turn).
async function waitIdle(extra = 0.3) {
  for (let n = 0; n < 300 && !(await page.evaluate(() => window.__book.idle)); n++) await tick();
  await wait(extra);
}

async function moveTo([x, y], sec = 0.6) {
  const [x0, y0] = [cursor.x, cursor.y];
  const n = Math.max(1, Math.round(sec * FPS));
  for (let i = 1; i <= n; i++) {
    const e = ease(i / n);
    cursor.x = x0 + (x - x0) * e;
    cursor.y = y0 + (y - y0) * e;
    await page.mouse.move(cursor.x, cursor.y);
    await tick();
  }
}

async function click() {
  cues.push({ t: now(), type: 'click' });
  cursor.down = true;
  await page.mouse.down();
  await tick();
  await tick();
  await page.mouse.up();
  cursor.down = false;
  await tick();
}

async function drag(to, sec) {
  cues.push({ t: now(), type: 'grab' });
  cursor.down = true;
  await page.mouse.down();
  await tick();
  await moveTo(to, sec);
  await page.mouse.up();
  cursor.down = false;
  await tick();
}

async function wheel(dy, sec) {
  const n = Math.max(1, Math.round(sec * FPS));
  for (let i = 0; i < n; i++) {
    await page.mouse.wheel(0, dy / n);
    await tick();
  }
}

const popupPoint = (x, y, z) => page.evaluate(([a, b, c]) => window.__project(a, b, c, true), [x, y, z]);
const worldPoint = (x, y, z) => page.evaluate(([a, b, c]) => window.__project(a, b, c, false), [x, y, z]);
const domPoint = (sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, sel);
const goTo = (i) => page.evaluate((n) => window.__book.goTo(n), i);

if (PREVIEW) {
  await wait(0.5);
  await goTo(1);
  await wait(4);
} else {
  // Closed book, then the cover opens onto the welcome spread.
  await wait(1.0);
  await goTo(0);
  await wait(2.6);

  // Welcome: click the Utah teapot to cycle wireframe and smooth shading.
  await moveTo(await popupPoint(0, 0.62, 0.2), 0.7);
  await click();
  await wait(0.7);
  await click();
  await wait(0.5);

  // Turn to chapter 1 with the bottom bar.
  await moveTo(await domPoint('#next'), 0.6);
  await click();
  await wait(1.7);

  // Tennis for Two: hit the ball with each controller, then switch the scope to a raster TV.
  await moveTo(await popupPoint(1.28, 0.16, 0.82), 0.5);
  await wait(0.2);
  await click();
  await wait(0.8);
  await moveTo(await popupPoint(-1.28, 0.16, 0.82), 0.5);
  await click();
  await wait(0.7);
  await moveTo(await popupPoint(-0.35, 1.0, 0.25), 0.5);
  await click();
  await wait(1.7);

  // Scroll the left page down to its sketches.
  await moveTo(await worldPoint(-2.0, 0.1, 0.4), 0.6);
  await wheel(2100, 2.4);
  await wait(0.6);

  // Chapter 2: drag a pin across the pegboard; Bresenham's pixels rise.
  await moveTo(await domPoint('#next'), 0.6);
  await click();
  await wait(1.7);
  await moveTo(await popupPoint(-1.1, 0.37, -1.05), 0.5);
  await drag(await popupPoint(1.25, 0.37, 0.05), 1.6);
  await wait(0.7);

  // A quick look around and a zoom, then reset the view.
  await moveTo([W * 0.1, H * 0.55], 0.4);
  await drag([W * 0.27, H * 0.47], 1.1);
  await wheel(-700, 0.8);
  await wait(0.3);
  await moveTo(await domPoint('#reset'), 0.5);
  await click();
  await wait(1.0);

  // Jump to chapter 7 from the contents list: the pages flip by quickly.
  await moveTo(await domPoint('#toc'), 0.5);
  await click();
  await wait(0.3);
  await moveTo(await domPoint('#toc-list li:nth-child(9) button'), 0.4);
  await click();
  await waitIdle(0.4);

  // Ray tracing: start the scan and click a pixel.
  await moveTo(await popupPoint(1.02, 0.04, 1.68), 0.5);
  await click();
  await wait(1.0);
  await moveTo(await popupPoint(0.07, 0.78, -0.2), 0.5);
  await click();
  await wait(1.2);

  // On to chapter 9: two quick turns.
  await moveTo(await domPoint('#next'), 0.5);
  await click();
  await wait(0.15);
  await click();
  await waitIdle(0.3);

  // Global illumination: pull the tab through the light bounces.
  await moveTo(await popupPoint(-1.25, 0.05, 1.3), 0.5);
  await drag(await popupPoint(1.25, 0.05, 1.3), 2.6);
  await wait(0.4);
  await moveTo([W * 0.78, H * 0.86], 0.6);
  await wait(1.6);
}

writeFileSync(`${OUT}/cues.json`, JSON.stringify({ fps: FPS, duration: now(), cues }, null, 2));
console.log(`done: ${frame} frames, ${now().toFixed(1)}s, ${cues.length} cues`);
await browser.close();

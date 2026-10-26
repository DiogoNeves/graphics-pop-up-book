# A Pop-up History of Computer Graphics

An interactive 3D pop-up book about how computers learned to draw, rendered live in the browser with WebGPU and three.js.

A flat-shaded book sits on a wooden table. It opens, and each spread tells one chapter of the story: the left page is a short, scrollable text with hand-drawn sketches, and the right page is a pop-up that stands up out of the paper and lets you play with the idea. Turning a page folds one pop-up away and unfolds the next, like a real pop-up book.

**Open it: https://diogoneves.com/graphics-pop-up-book/**

It is a demo of what is possible for education in the browser: no install, real-time 3D, and every technique on the pages running on the reader's own GPU.

## Chapters

1. From oscilloscopes to Pong: vector and raster displays
2. 2D rasterisation: lines and polygons on a pixel grid
3. 3D rasterisation: projection and the z-buffer
4. GPU acceleration: why graphics is massively parallel
5. Bump and normal mapping
6. Parallax mapping
7. Ray tracing
8. Reflections and environment maps
9. Global illumination and radiosity

The text was researched and then fact-checked by a separate pass against primary sources (original papers, institutional and museum pages). Each chapter lists its sources on the page.

## Controls

- **Drag** the table to look around; **scroll** to zoom a little.
- **Scroll or drag** a left page to read it.
- Pop-ups have their own pull-tabs, buttons and draggable pieces.
- The bottom bar resets the view, turns pages, jumps to a chapter and opens the related Wikipedia article. Arrow keys turn pages; `R` resets the view.

## Deploy

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL in a browser with WebGPU (recent Chrome, Edge or Safari). Other browsers fall back to WebGL 2 automatically.

Useful URL parameters:

- `?page=3` opens straight to a spread (0 is the welcome page).
- `?test=<popup-id>` adds a stub page for a pop-up so it can be viewed on its own.

Check a single module for syntax errors and bad imports:

```bash
node scripts/check.mjs src/popups/chapters/raster-2d.js
```

## Demo video

`scripts/make-demo.sh` rebuilds `media/demo.mp4` (about 45 seconds, 1080p, with sound). It needs the dev server on port 5183, Google Chrome and ffmpeg:

```bash
./scripts/make-demo.sh
```

- `scripts/record-demo.mjs` opens the book with `?capture`, where time only moves when the script says so. It plays a scripted timeline of real clicks, drags and scrolls, takes one screenshot per 1/30 s step, and logs when pages turn and buttons are clicked.
- `scripts/make-soundtrack.mjs` synthesises an original soundtrack (pad, music-box arpeggio, bass, soft drums and a bell melody) and adds page-turn, pop-up and click sounds at the logged moments.

## How it works

- `src/book/` builds the book: covers, page blocks and a bendable `Leaf` mesh used for every page. One leaf animates per turn; pop-ups ride on a frame that follows the bending page.
- `src/pages/` renders page textures on canvases: a small layout engine with word wrap and inline bold/italic, rough.js sketches, timelines and source lists. Left pages scroll through a tall texture in a TSL shader.
- `src/popups/` holds one module per chapter plus `kit.js`, the shared toolkit: flat materials, a `Folder` that folds pieces with the page angle, cards, labels, canvas screens, pull-tabs and buttons.
- `src/content/` holds the chapter text as plain data, one file per chapter.
- `src/interaction.js` routes the pointer between pop-up controls, page scrolling and the orbit camera.

## Tech stack

- three.js (WebGPURenderer, TSL node materials) with WebGL 2 fallback
- rough.js for the sketches
- Fraunces, Crimson Pro and Caveat via Fontsource
- Vite, plain JavaScript modules

See [docs/project-index-reference.md](docs/project-index-reference.md) for related projects.

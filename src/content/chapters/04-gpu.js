export default {
  id: 'gpu',
  number: 4,
  title: 'The Rise of the GPU',
  era: '1982 – 2023',
  wikipedia: { label: 'Graphics processing unit', url: 'https://en.wikipedia.org/wiki/Graphics_processing_unit' },
  blocks: [
    {
      type: 'lead',
      text: `A modern screen holds millions of pixels, and a game must colour every one of them many times a second. Colouring them one at a time would be far too slow, so engineers built chips that put thousands of small workers on the job at once.`,
    },
    {
      type: 'p',
      text: `For a long time, 3D pictures were mostly computed in software by a computer's main processor, the **CPU**, working through the pixels largely one after another. But graphics has a lucky property. Each corner of each triangle can be moved into place without looking at the others, and each pixel's colour can usually be worked out on its own. Programmers call such jobs _embarrassingly parallel_: share the work among more workers and it finishes sooner.`,
    },
    {
      type: 'figure',
      sketch: 'cpu-vs-gpu-pixels',
      caption: 'Every pixel can be coloured independently, so many workers can share the job.',
      brief: `Two identical 4×4 grids of empty squares side by side, with a gap between them. LEFT grid: above it draw ONE small circle (a worker) with a single arrow pointing down to the top-left square. Shade only the first five squares in reading order (the whole top row plus the first square of the second row) and write the numbers 1 to 5 inside them; leave the other eleven squares blank. RIGHT grid: above it draw a row of SIXTEEN tiny circles (workers), each with its own short arrow down to a different square, so every square has one arrow; lightly shade all sixteen squares. Labels (handwritten): above the left worker "CPU"; above the right row of workers "GPU"; under the left grid "one at a time"; under the right grid "all at once".`,
    },
    {
      type: 'p',
      text: `The first specialist hardware tackled the geometry. Around 1981 at Stanford University, Jim Clark and Marc Hannah designed the **Geometry Engine**, a chip for the maths of 3D: rotating and moving points with matrices, clipping away whatever falls outside the view, and scaling the rest to fit the screen. Clark's 1982 paper described twelve copies of it chained in a pipeline, and the design powered the workstations of Silicon Graphics, the company he co-founded.`,
    },
    {
      type: 'figure',
      sketch: 'geometry-engine-pipeline',
      caption: `Clark's Geometry System: twelve copies of one chip in a row (1982).`,
      brief: `A single horizontal row of 12 small identical square boxes (the chips), joined left to right by short arrows between neighbouring boxes. An arrow enters box 1 from the left, labelled "3D points in". An arrow leaves box 12 to the right, labelled "screen coordinates". Under boxes 1 to 4 draw a curly bracket labelled "transform"; under boxes 5 to 10 a curly bracket labelled "clip"; under boxes 11 and 12 a curly bracket labelled "scale". No other labels or details.`,
    },
    {
      type: 'p',
      text: `In the 1990s this power reached home computers. Add-in cards such as 3dfx's Voodoo Graphics (1996) drew textured triangles, while the CPU still did the geometry. In 1999 NVIDIA's GeForce 256 moved transform and lighting onto the graphics chip too, and NVIDIA marketed it as the first "graphics processing unit", or **GPU**. The letters were not brand new (Sony had already called the PlayStation's graphics chip a GPU in 1994), but NVIDIA made the name stick.`,
    },
    {
      type: 'p',
      text: `Next, the fixed recipes became programmable. With the GeForce3 (2001), developers could write small programs, called _shaders_, to run on every vertex and, more modestly at first, every pixel. Later chips went _unified_: ATI's Xenos in the Xbox 360 (2005) and NVIDIA's GeForce 8800 (2006) used one pool of identical processors for every kind of shader. Those processors were general enough that NVIDIA's CUDA (2007) opened them to scientific computing, and later to artificial intelligence. Since 2023, WebGPU, switched on by default in Chrome 113, has given web pages a more modern route to the GPU than the older WebGL, general computing included.`,
    },
    {
      type: 'timeline',
      items: [
        ['1982', 'Clark presents the Geometry Engine at SIGGRAPH'],
        ['1996', '3dfx Voodoo Graphics popularises 3D cards for PC games'],
        ['1999', 'NVIDIA GeForce 256 marketed as the first GPU'],
        ['2001', 'GeForce3 brings programmable vertex shaders'],
        ['2006', 'GeForce 8800 unifies shaders; CUDA follows in 2007'],
        ['2023', 'WebGPU switched on by default in Chrome 113'],
      ],
    },
    {
      type: 'tryit',
      text: `Two pop-up screens race to paint the same picture. On the CPU side a single worker colours one pixel at a time; on the GPU side a crowd of workers colours many pixels at once. Pull the tab to restart the race.`,
    },
    {
      type: 'sources',
      items: [
        `James H. Clark, "The Geometry Engine: A VLSI Geometry System for Graphics", Computer Graphics (Proc. SIGGRAPH '82) 16(3), pp. 127–133, ACM, 1982. DOI 10.1145/800064.801272. https://history.siggraph.org/?p=106352`,
        `Jon Peddie, "Is it Time to Rename the GPU?", IEEE Computer Society (Chasing Pixels), 2018. https://computer.org/publications/tech-news/chasing-pixels/is-it-time-to-rename-the-gpu`,
        `NVIDIA, "Nvidia Corporate Timeline" (1999 entries: GeForce 256). https://www.nvidia.com/content/timeline/time_99.html`,
        `Erik Lindholm, Mark J. Kilgard, Henry Moreton, "A User-Programmable Vertex Engine", Proc. SIGGRAPH 2001, ACM, 2001. DOI 10.1145/383259.383274. https://research.nvidia.com/publication/2001-08_user-programmable-vertex-engine`,
        `John Nickolls, Ian Buck, Michael Garland, Kevin Skadron, "Scalable Parallel Programming with CUDA", ACM Queue 6(2), March/April 2008. DOI 10.1145/1365490.1365500. https://grothoff.org/christian/teaching/2008/4704/scalable_cuda.pdf`,
        `François Beaufort, Corentin Wallez, "Chrome ships WebGPU", Chrome for Developers blog, 2023. https://developer.chrome.com/blog/webgpu-release`,
      ],
    },
  ],
}

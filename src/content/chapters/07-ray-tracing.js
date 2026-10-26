export default {
  id: 'ray-tracing',
  number: 7,
  title: 'Ray Tracing',
  era: '1968 – 2018',
  wikipedia: { label: 'Ray tracing (graphics)', url: 'https://en.wikipedia.org/wiki/Ray_tracing_(graphics)' },
  blocks: [
    {
      type: 'lead',
      text: `Ray tracing paints a picture by working backwards. Instead of following light out of the lamp, it follows imaginary rays from your eye into the scene, one pixel at a time.`,
    },
    {
      type: 'p',
      text: `Imagine the screen as a window covered with a fine grid, each square a pixel. For every pixel the computer shoots a straight line, a **ray**, from the eye through that square and finds the first object it strikes. That nearest hit is what the pixel shows. From the hit point it fires a **shadow ray** towards the light: if anything blocks the way, the point is in shadow. If the surface is shiny, a **reflection ray** bounces off like a ball off a wall, and the whole process repeats, so the colour of whatever it hits is mixed into the pixel.`,
    },
    {
      type: 'figure',
      sketch: 'ray-tracing-rays',
      caption: 'One pixel, three rays: primary, shadow and reflection.',
      brief: 'Side view, left to right. At far left draw an eye (almond outline with a dot). A little to its right draw a tall upright rectangle divided into a 6 by 6 grid; shade one square near the middle. On the right draw a large circle (sphere), its centre a little below eye level, and directly above the left half of the large circle draw a smaller circle. At the top right draw a small sun (circle with short rays). Draw a solid arrow from the eye straight through the shaded square to the upper-left part of the large circle; mark the hit point with a dot. From that dot draw a dashed straight line up and to the right to the sun, passing clear of the large circle. From the same dot draw a solid arrow leaving at the mirror angle (angle in equals angle out about the surface), which sends it almost straight up, to the smaller circle, ending on it. Labels: "eye" by the eye, "pixel" by the shaded square, "primary ray" on the first arrow, "shadow ray" on the dashed line, "reflection ray" on the last arrow, "light" by the sun.',
    },
    {
      type: 'p',
      text: `One of the earliest descriptions came from Arthur Appel at IBM's research centre in Yorktown Heights, New York, in 1968. On an IBM 7094 he traced the line of sight from the eye through spots on the picture plane, found the first surface it pierced, then checked whether that point could see the light. His "pixels" were plus signs drawn by a pen plotter, larger where the surface was darker. Meanwhile at MAGI, a New York company whose software traced nuclear radiation through solid shapes, Robert Goldstein's team adapted the same ray idea to make shaded pictures and films, described with Roger Nagel in "3-D Visual Simulation" (1971).`,
    },
    {
      type: 'p',
      text: `In 1979 Turner Whitted of Bell Laboratories presented the full recursive recipe at SIGGRAPH, publishing it in 1980: every hit could spawn reflection, refraction and shadow rays, building a _tree_ of rays for each pixel. Glass balls and mirrored surfaces suddenly looked convincing, though Whitted himself called his algorithm very slow; most of its time went on finding where rays hit objects.`,
    },
    {
      type: 'figure',
      sketch: 'soft-shadow-rays',
      caption: 'Distributed ray tracing: many shadow rays make a soft edge.',
      brief: 'Side view. Across the top draw a long flat rectangle (an area light). Below it, slightly left of centre, draw a circle (a ball) floating in the air. Along the bottom draw a horizontal floor line and put a dot on it just right of the point under the ball. From the dot draw five straight lines fanning upwards to five different points spread along the light rectangle. The two left-most lines stop at the ball, each ending in a small "x"; the three right-most lines reach the light. Labels: "area light" by the rectangle, "ball" by the circle, "blocked" by the x marks, "reaches light" by the three unblocked lines.',
    },
    {
      type: 'p',
      text: `In 1984 Robert Cook, Thomas Porter and Loren Carpenter at Lucasfilm showed that spreading rays out slightly, in direction and in time, gives soft shadows, blurry reflections, depth of field and motion blur. For decades ray tracing was mostly too slow for real-time use, so it lived in films, design and still pictures. Then in 2018 Microsoft announced DirectX Raytracing and NVIDIA unveiled Turing graphics chips with dedicated "RT Cores", opening the way for real-time ray-traced reflections and shadows in games, usually mixed with faster rasterisation.`,
    },
    {
      type: 'timeline',
      items: [
        ['1968', 'Arthur Appel (IBM) casts rays from the eye and tests shadows'],
        ['1971', 'Goldstein & Nagel of MAGI publish "3-D Visual Simulation"'],
        ['1979', 'Turner Whitted shows recursive ray tracing at SIGGRAPH (paper 1980)'],
        ['1984', 'Cook, Porter & Carpenter publish distributed ray tracing'],
        ['2018', 'Microsoft DXR and NVIDIA RTX bring real-time ray tracing to games'],
      ],
    },
    {
      type: 'tryit',
      text: `Click any pixel on the paper screen to fire a ray from the eye: watch it strike a sphere, send a shadow ray to the light and a reflection ray onwards, then colour the pixel. Or press the button to start a scan and watch the whole picture fill in, pixel by pixel.`,
    },
    {
      type: 'sources',
      items: [
        'Arthur Appel, "Some techniques for shading machine renderings of solids", Proceedings of the AFIPS Spring Joint Computer Conference, vol. 32, pp. 37–45, 1968. https://doi.org/10.1145/1468075.1468082',
        'Robert A. Goldstein and Roger Nagel, "3-D Visual Simulation", Simulation 16(1), pp. 25–31, 1971. https://doi.org/10.1177/003754977101600104',
        'Turner Whitted, "An Improved Illumination Model for Shaded Display", Communications of the ACM 23(6), pp. 343–349, 1980. https://doi.org/10.1145/358876.358882',
        'Robert L. Cook, Thomas Porter and Loren Carpenter, "Distributed Ray Tracing", Computer Graphics (SIGGRAPH \'84 Proceedings) 18(3), pp. 137–145, 1984. https://doi.org/10.1145/800031.808590',
        'Microsoft Direct3D Team, "Announcing Microsoft DirectX Raytracing!", DirectX Developer Blog, 19 March 2018. https://devblogs.microsoft.com/directx/announcing-microsoft-directx-raytracing/',
        'NVIDIA, "NVIDIA Reinvents Computer Graphics with Turing Architecture", press release, 13 August 2018. https://nvidianews.nvidia.com/news/nvidia-reinvents-computer-graphics-with-turing-architecture',
      ],
    },
  ],
}

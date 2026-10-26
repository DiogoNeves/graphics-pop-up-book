export default {
  id: 'parallax',
  number: 6,
  title: 'Parallax Mapping',
  era: '2001 – 2006',
  wikipedia: { label: 'Parallax mapping', url: 'https://en.wikipedia.org/wiki/Parallax_mapping' },
  blocks: [
    {
      type: 'lead',
      text: `Normal maps fool the eye about light, but not about depth: walk past a normal-mapped brick wall and the bricks never seem to stick out. Parallax mapping adds the missing clue.`,
    },
    {
      type: 'p',
      text: `_Parallax_ is the way near things seem to slide in front of far things when you move your head. On a real wall the bricks stand proud of the mortar, so from the side they shift across it and hide parts of it. A painted texture cannot do that: every point sits at exactly the same depth.`,
    },
    {
      type: 'p',
      text: `In 2001 Tomomichi Kaneko and six colleagues, most of them from the University of Tokyo, presented **parallax mapping** at the ICAT conference in Tokyo, following earlier Japanese-language papers from the same group. Alongside its colour texture, the surface carries a _height map_, a grey image in which light means high and dark means low. For each pixel, the graphics chip reads the height there and the angle of the viewer's gaze, then slides the texture coordinates a little: the further the bumpy surface lies from the flat polygon, the further the lookup slides. That single nudge costs only a handful of extra instructions per pixel.`,
    },
    {
      type: 'figure',
      sketch: 'parallax-shift',
      caption: 'Parallax mapping slides the texture lookup from where the ray meets the polygon towards where it would meet the bumps.',
      brief: `A side-view cross-section. Draw a long straight horizontal line across the page, labelled "flat polygon". Directly below it draw a bumpy line like a rounded square wave: wide flat-topped bumps (bricks) whose tops touch the polygon line, separated by two narrower dips (mortar gaps); label it "height map". In the upper left draw a simple eye. From the eye draw a straight dashed line going down and to the right, labelled "view ray"; it crosses the flat polygon line at a dot marked "A" placed directly above the left edge of a dip, then continues down into that dip until it first touches the bumpy line, at a second dot marked "B". Along the flat polygon line, draw a short solid arrow from A to the point directly above B, labelled "shift".`,
    },
    {
      type: 'p',
      text: `The simple shift goes wrong at shallow viewing angles, where the texture seems to swim. Terry Welsh's 2004 write-up, which helped popularise the technique, added _offset limiting_ to cap how far it can slide. Others stepped along the line of sight through the height map until it struck a bump: Zoë Brawley and Natalya Tatarchuk's **parallax occlusion mapping** (2004, refined by Tatarchuk in 2006), Morgan and Max McGuire's _steep parallax mapping_, and the _relief mapping_ of Fábio Policarpo, Manuel Oliveira and João Comba (both 2005). Now nearer bumps properly hide the ones behind them, and can even cast shadows.`,
    },
    {
      type: 'figure',
      sketch: 'ray-march-steps',
      caption: 'Steep parallax and parallax occlusion mapping walk along the ray in small steps until it dips below the surface.',
      brief: `The same side-view cross-section as before: a straight horizontal line at the top labelled "flat polygon", with the bumpy brick-and-mortar line just below it. From a simple eye in the upper left, draw a dashed view ray going down and to the right, passing through the flat line. Along the part of the ray below the flat line, draw six evenly spaced small dots. The first four dots lie above the bumpy line and are drawn as hollow circles; label them with one bracket "steps". The fifth dot is the first one that lies below the bumpy line: draw it filled in, circle it, and label it "first hit". The sixth dot is faint. No other labels.`,
    },
    {
      type: 'p',
      text: `Yet all of this happens on a flat polygon: not a single triangle is added. In their basic forms these techniques share bump mapping's weak spot. Look along the surface edge-on and its outline is perfectly straight, although later research found ways to fake bumpy outlines too, at extra cost.`,
    },
    {
      type: 'timeline',
      items: [
        ['2001', 'Kaneko et al. present parallax mapping at ICAT, Tokyo'],
        ['2004', 'Welsh describes offset limiting'],
        ['2004', 'Brawley & Tatarchuk publish parallax occlusion mapping'],
        ['2005', 'Steep parallax mapping and real-time relief mapping at I3D'],
        ['2006', 'Tatarchuk adds soft shadows and level of detail to POM'],
      ],
    },
    {
      type: 'tryit',
      text: `The pop-up brick tile is flat underneath. Press the button to switch between normal mapping, simple parallax and parallax occlusion mapping, then drag to tilt the tile and watch how convincingly the bricks seem to stand out.`,
    },
    {
      type: 'sources',
      items: [
        `Tomomichi Kaneko, Toshiyuki Takahei, Masahiko Inami, Naoki Kawakami, Yasuyuki Yanagida, Taro Maeda, Susumu Tachi, "Detailed Shape Representation with Parallax Mapping", Proceedings of ICAT 2001 (11th International Conference on Artificial Reality and Telexistence), Tokyo, pp. 205–208, 2001. https://web.archive.org/web/20160601214858/https://www.researchgate.net/profile/Susumu_Tachi/publication/228583097_Detailed_shape_representation_with_parallax_mapping/links/02e7e518259abdc882000000.pdf`,
        `Terry Welsh, "Parallax Mapping with Offset Limiting: A Per-Pixel Approximation of Uneven Surfaces", Infiscape Corporation, January 2004. https://web.archive.org/web/20040121022441/http://www.infiscape.com/doc/parallax_mapping.pdf`,
        `Zoë Brawley, Natalya Tatarchuk, "Parallax Occlusion Mapping: Self-Shadowing, Perspective-Correct Bump Mapping Using Reverse Height Map Tracing", in W. Engel (ed.), ShaderX3: Advanced Rendering with DirectX and OpenGL, Charles River Media, pp. 135–154, 2004.`,
        `Fábio Policarpo, Manuel M. Oliveira, João L. D. Comba, "Real-Time Relief Mapping on Arbitrary Polygonal Surfaces", Proc. ACM Symposium on Interactive 3D Graphics and Games (I3D 2005), pp. 155–162, 2005. DOI 10.1145/1053427.1053453. https://www.inf.ufrgs.br/~oliveira/RTM.html`,
        `Natalya Tatarchuk, "Dynamic Parallax Occlusion Mapping with Approximate Soft Shadows", Proc. ACM Symposium on Interactive 3D Graphics and Games (I3D 2006), 2006. DOI 10.1145/1111411.1111423. https://faculty.digipen.edu/~gherron/references/References/SurfaceDetail/Tatarchuk-POM-SI3D06.pdf`,
        `Natalya Tatarchuk, "Practical Parallax Occlusion Mapping with Approximate Soft Shadows for Detailed Surface Rendering", in Advanced Real-Time Rendering in 3D Graphics and Games, SIGGRAPH 2006 Course Notes, ch. 5, 2006. https://advances.realtimerendering.com/s2006/Chapter5-Parallax_Occlusion_Mapping_for_detailed_surface_rendering.pdf`,
      ],
    },
  ],
}

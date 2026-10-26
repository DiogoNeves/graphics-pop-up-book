export default {
  id: 'bump-normal',
  number: 5,
  title: 'Bump & Normal Mapping',
  era: '1978 – 2004',
  wikipedia: { label: 'Bump mapping', url: 'https://en.wikipedia.org/wiki/Bump_mapping' },
  blocks: [
    {
      type: 'lead',
      text: `Real surfaces are covered in tiny bumps, scratches and wrinkles. Building every one from triangles would be hopelessly expensive, so in 1978 James Blinn found a way to fake them using light alone.`,
    },
    {
      type: 'p',
      text: `How bright a point on a surface looks depends mostly on which way it faces. Graphics programmers describe that direction with an imaginary arrow sticking straight out of the surface, called the **normal**. Where the normal points towards a lamp, the surface is lit brightly; where it tilts away, it darkens. Our eyes read these patterns of light and shade as shape.`,
    },
    {
      type: 'p',
      text: `Blinn worked out his idea during his doctoral research at the University of Utah and published it at SIGGRAPH as "Simulation of Wrinkled Surfaces". Instead of moving the surface, he used a texture of tiny heights, a **bump map**, to tilt the normal slightly at every point before the lighting was calculated. The surface stays perfectly smooth, yet it is shaded as if it were wrinkled.`,
    },
    {
      type: 'figure',
      sketch: 'tilted-normals',
      caption: 'The surface stays flat; only the arrows used for lighting are tilted.',
      brief: `Near the bottom, draw a long straight horizontal line, labelled "real surface: flat". A little above it, draw a faint dashed wavy line with three gentle, rounded bumps, labelled "pretend bumps". From seven evenly spaced points on the flat line, draw short arrows pointing upwards; each arrow must be perpendicular to the dashed wavy line directly above its starting point, so arrows under a rising slope lean to the left, arrows under a falling slope lean to the right, and arrows under a peak or a trough point straight up. Label one leaning arrow "tilted normal". In the upper left corner draw a small sun (a circle with short rays) with two parallel arrows pointing down and to the right towards the surface, labelled "light".`,
    },
    {
      type: 'p',
      text: `Later researchers stored the tilted normals themselves. In 1997 Mark Peercy, John Airey and Brian Cabral showed how graphics hardware could read ready-made normals from a texture, recorded relative to the surface (in _tangent space_) so that one map could be wrapped around any shape. In 1998 Jonathan Cohen, Marc Olano and Dinesh Manocha used **normal maps** to keep a detailed model's appearance even after most of its triangles were removed. A normal map stores each arrow's three coordinates as the red, green and blue of a pixel; in a tangent-space map, arrows pointing straight out come out pale blue-violet, which is why such textures look mostly that colour.`,
    },
    {
      type: 'p',
      text: `By 2000, chips such as NVIDIA's GeForce 256 could already light normal-mapped surfaces pixel by pixel in real time, and as programmable chips spread in the early 2000s the technique became standard in games. In id Software's _Doom 3_ (2004), characters of around two thousand triangles wore normal maps baked from detailed models of tens or hundreds of thousands. The trick has one giveaway: only the lighting changes, never the shape. Seen edge-on, a normal-mapped wall's outline is still perfectly flat.`,
    },
    {
      type: 'figure',
      sketch: 'edge-on-tile',
      caption: 'Normal maps change the shading, not the outline.',
      brief: `Two drawings side by side. LEFT: a square tile seen face-on, with a brick pattern on it: three rows of rectangles offset like a brick wall, with a thin dark line along the bottom and right edge of each brick to suggest raised bricks lit from the upper left. Label under it: "face-on: looks bumpy". RIGHT: the same tile turned edge-on, drawn as a long, very thin flat rectangle whose top edge is a perfectly straight line with no bumps. Label under it: "edge-on: still flat". Between the two drawings, a curved arrow from left to right labelled "turn".`,
    },
    {
      type: 'timeline',
      items: [
        ['1978', 'Blinn presents bump mapping at SIGGRAPH'],
        ['1997', 'Peercy, Airey & Cabral: tangent-space normal textures for hardware'],
        ['1998', 'Cohen, Olano & Manocha keep detail with normal maps'],
        ['2004', 'Doom 3 uses normal maps baked from high-detail models'],
      ],
    },
    {
      type: 'tryit',
      text: `The pop-up tile is completely flat, but a normal map makes its bricks look raised. Drag the paper sun to move the light, flip the switch to turn the normal map on and off, and turn the tile edge-on to see that it really is flat.`,
    },
    {
      type: 'sources',
      items: [
        `James F. Blinn, "Simulation of Wrinkled Surfaces", Computer Graphics (Proc. SIGGRAPH '78) 12(3), pp. 286–292, ACM, 1978. DOI 10.1145/800248.507101. https://www.microsoft.com/en-us/research/publication/simulation-of-wrinkled-surfaces/`,
        `ACM SIGGRAPH History Archives, "James (Jim) F. Blinn" (biography). https://history.siggraph.org/?p=17051`,
        `Mark Peercy, John Airey, Brian Cabral, "Efficient Bump Mapping Hardware", Proc. SIGGRAPH '97, ACM, 1997. DOI 10.1145/258734.258873. https://history.siggraph.org/?p=117278`,
        `Jonathan Cohen, Marc Olano, Dinesh Manocha, "Appearance-Preserving Simplification", Proc. SIGGRAPH '98, ACM, 1998. DOI 10.1145/280814.280832. https://history.siggraph.org/?p=116543`,
        `Mark J. Kilgard, "A Practical and Robust Bump-mapping Technique for Today's GPUs", GDC 2000 tutorial, NVIDIA, 2000. https://developer.download.nvidia.com/assets/gamedev/docs/GDC2K_gpu_bump.pdf`,
        `id Software (text mostly from a document by John Carmack), "Making DOOM 3 Mods: Bump Maps", id Software developer documentation, 2004 (community mirror). https://iddevnet.dhewm3.org/doom3/bumpmaps.html`,
        `G. Scott Owen, "Bump Mapping", ACM SIGGRAPH HyperGraph, 1999. https://education.siggraph.org/static/HyperGraph/mapping/bumpmap.htm`,
      ],
    },
  ],
}

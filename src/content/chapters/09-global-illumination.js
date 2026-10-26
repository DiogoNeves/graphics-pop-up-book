export default {
  id: 'global-illumination',
  number: 9,
  title: 'Global Illumination',
  era: '1984 – 2022',
  wikipedia: { label: 'Global illumination', url: 'https://en.wikipedia.org/wiki/Global_illumination' },
  blocks: [
    {
      type: 'lead',
      text: `Light does not stop when it hits something. It bounces, again and again, and every bounce carries a little colour with it. Rendering all that bounced light is called **global illumination**.`,
    },
    {
      type: 'p',
      text: `Shine a lamp at a red wall and the white ceiling beside it turns faintly pink. Light that travels straight from the lamp to a surface is **direct light**; light that arrives after bouncing off other surfaces is **indirect light**, and the pink tint is **colour bleeding**. Most early renderers ignored indirect light and filled shadows with a flat, made-up "ambient" glow.`,
    },
    {
      type: 'figure',
      sketch: 'direct-indirect-light',
      caption: 'Direct light, a bounce, and colour bleeding.',
      brief: 'Draw a room in cross-section as a large square. Shade the left wall with diagonal hatching (it is red). At the top centre draw a small light bulb. Draw a solid arrow straight down from the bulb to the middle of the floor. Draw a second solid arrow from the bulb to the middle of the left wall, then a dashed arrow from that point on the left wall down to the floor near the left corner. Lightly hatch a small patch of floor where the dashed arrow lands. Labels: "light" by the bulb, "direct" on the downward arrow, "red wall" on the hatched wall, "bounce" on the dashed arrow, "pink tint" by the hatched floor patch.',
    },
    {
      type: 'p',
      text: `In 1984 Cindy Goral, Kenneth Torrance, Donald Greenberg and Bennett Battaile at Cornell University borrowed a method from heat-transfer engineering, now called **radiosity**. They split every surface into small flat patches and worked out how much of each patch's light reaches every other patch, then solved the equations that balance all the light in the room. To check, they built a real open-fronted box of painted fibreboard, with one red wall, one blue wall and white panels, and compared photographs with the computer's pictures. This was the start of the famous **Cornell box**, whose blue wall later became green. Their paper even showed the picture brightening as extra bounces were added. In 1985 Michael Cohen and Greenberg's **hemi-cube** let objects inside the box cast shadows.`,
    },
    {
      type: 'figure',
      sketch: 'radiosity-patches',
      caption: 'Radiosity splits the room into patches that trade light.',
      brief: 'Draw an open-fronted box in simple perspective: back wall, left wall, right wall, floor and ceiling. Divide each visible surface into a 4 by 4 grid of square patches. Hatch the left wall (red) and dot-fill the right wall (green). Draw a small square light in the middle of the ceiling. Shade one patch on the floor near the left wall and one patch low on the left wall, and join them with a curved double-headed arrow. Labels: "patch" pointing at the shaded floor patch, "light" by the ceiling square, "red" on the left wall, "green" on the right wall, "shares light" on the double-headed arrow.',
    },
    {
      type: 'p',
      text: `Classic radiosity handles only matt surfaces. In 1986 James Kajiya at Caltech wrote down the **rendering equation**, one formula for how light leaves every point, and described **path tracing**: follow random rays as they bounce around the scene and average many of them. Henrik Wann Jensen's **photon mapping** (1996) works the other way, firing photons from the lights and recording where they land.`,
    },
    {
      type: 'p',
      text: `All of this was far too slow for games, so shortcuts appeared. **Ambient occlusion** simply darkens creases and corners that little surrounding light can reach. Described as "obscurance" by Zhukov, Iones and Kronin in 1998 and used by ILM on Pearl Harbor (2001), it was squeezed into a fast screen-space version by Crytek for Crysis (2007). Today systems such as Lumen in Unreal Engine 5, released in 2022, compute bounced light live as the scene changes.`,
    },
    {
      type: 'timeline',
      items: [
        ['1984', 'Cornell team brings radiosity to graphics; first Cornell box'],
        ['1985', 'Cohen & Greenberg add the hemi-cube, allowing shadows'],
        ['1986', 'Kajiya publishes the rendering equation and path tracing'],
        ['1996', 'Henrik Wann Jensen publishes photon mapping'],
        ['2007', 'Crysis ships with screen-space ambient occlusion'],
        ['2022', 'Unreal Engine 5 launches with Lumen dynamic global illumination'],
      ],
    },
    {
      type: 'tryit',
      text: `A Cornell box, split into flat patches, is lit by a real radiosity solver. Pull the tab to add light bounces one at a time, starting from direct light only, and watch the shadows fill in and this box's red and blue walls tint the white surfaces.`,
    },
    {
      type: 'sources',
      items: [
        'Cindy M. Goral, Kenneth E. Torrance, Donald P. Greenberg and Bennett Battaile, "Modeling the Interaction of Light Between Diffuse Surfaces", Computer Graphics (SIGGRAPH \'84 Proceedings) 18(3), pp. 213–222, 1984. https://doi.org/10.1145/800031.808601',
        'Michael F. Cohen and Donald P. Greenberg, "The Hemi-Cube: A Radiosity Solution for Complex Environments", Computer Graphics (SIGGRAPH \'85 Proceedings) 19(3), pp. 31–40, 1985. https://doi.org/10.1145/325165.325171',
        'James T. Kajiya, "The Rendering Equation", Computer Graphics (SIGGRAPH \'86 Proceedings) 20(4), pp. 143–150, 1986. https://doi.org/10.1145/15922.15902',
        'Henrik Wann Jensen, "Global Illumination using Photon Maps", Rendering Techniques \'96 (Proceedings of the Seventh Eurographics Workshop on Rendering), Springer, pp. 21–30, 1996. https://doi.org/10.1007/978-3-7091-7484-5_3',
        'Cornell University Program of Computer Graphics, "The Cornell Box". https://bowers.cornell.edu/cornell-box',
        'Industrial Light & Magic, "Pearl Harbor" (on ILM\'s development of ambient occlusion). https://www.ilm.com/vfx/pearl-harbor/',
        'Martin Mittring, "Finding Next Gen – CryEngine 2", SIGGRAPH 2007 course: Advanced Real-Time Rendering in 3D Graphics and Games, 2007. https://advances.realtimerendering.com/s2007/Mittring-Finding_NextGen_CryEngine2(Siggraph07).pdf',
      ],
    },
  ],
}

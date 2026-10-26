export default {
  id: 'raster-3d',
  number: 3,
  title: 'Pixels in Perspective',
  era: '1971 – 1975',
  wikipedia: {
    label: 'Z-buffering',
    url: 'https://en.wikipedia.org/wiki/Z-buffering',
  },
  blocks: [
    {
      type: 'lead',
      text: `How does a computer turn a solid object into a flat picture made of pixels? Many of the answers were worked out in the early 1970s, a surprising number of them at one university in Utah.`,
    },
    {
      type: 'p',
      text: `First, the object is built from flat triangles, each defined by three corner points in space. Now imagine an eye looking through a window: the screen. **Perspective projection** finds where the straight line from each corner to the eye passes through that window. In practice you divide a corner's sideways and up-down positions by its depth (how far it lies in front of the eye), so things twice as far away come out half the size. Once all three corners have landed on the screen, the triangle is filled row by row, just like the flat shapes in the last chapter.`,
    },
    {
      type: 'figure',
      sketch: 'perspective-projection',
      caption: 'Each corner is drawn where its line to the eye crosses the screen',
      brief: `A side-view diagram. On the left, a small circle with a dot in it (the eye). From the eye, two straight lines fan out to the right, one angled up and one angled down, forming a wedge (the view). About a third of the way along, draw a vertical line segment that spans the wedge from the upper line to the lower line (the screen). Further right, inside the wedge, draw a simple triangle standing on one corner. Draw dashed straight lines from two of the triangle's corners back to the eye; where each dashed line crosses the screen, mark a small filled dot. Handwritten labels with arrows: 'eye', 'screen', 'object', 'projected points' (to the two dots).`,
    },
    {
      type: 'p',
      text: `But when two triangles overlap, which one should you see? This **hidden surface problem** kept researchers busy for years. The simplest answer is the **z-buffer**, or depth buffer: alongside each pixel's colour, store the depth (z) of the nearest surface drawn there so far. When a new triangle covers that pixel, compare depths, paint it only if it is nearer, and remember its depth. The order you draw things in no longer matters. Two people described the idea independently in 1974: Wolfgang Straßer in his doctoral thesis at the Technical University of Berlin, and Ed Catmull in his PhD work at the University of Utah. Straßer judged that memory chips were still too expensive to make it practical.`,
    },
    {
      type: 'figure',
      sketch: 'z-buffer-grids',
      caption: 'The z-buffer keeps whichever surface is nearest at each pixel',
      brief: `Two square grids side by side, each 5 by 5 squares. LEFT grid: a large triangle drawn with diagonal hatching covering the lower-left part, and a second, smaller triangle drawn with solid shading on the right that overlaps it; where the two overlap, show only the solid shading (it is in front). RIGHT grid: the same outlines drawn faintly, and a small handwritten number in each covered square: '3' in every square covered by the solid triangle (including the overlap) and '7' in squares covered only by the hatched triangle; leave uncovered squares empty. Handwritten labels: 'colour' above the left grid, 'depth (z)' above the right grid, and a short note under the right grid: 'smaller = nearer'.`,
    },
    {
      type: 'p',
      text: `Utah, where David Evans had founded the computer science department in 1965, was a hothouse for such ideas. Henri Gouraud (1971) made faceted objects look smooth by working out the brightness at each corner and blending it across the face. Bui Tuong Phong (thesis 1973, published 1975) blended the surface's direction instead and lit every pixel, giving crisp, shiny highlights. Catmull showed that a picture could be wrapped onto a surface, an early form of **texture mapping**. And in 1974 Martin Newell turned an ordinary Melitta teapot into numbers; the Utah teapot has been a favourite test object ever since.`,
    },
    {
      type: 'timeline',
      items: [
        ['1971', `Gouraud publishes smooth shading of curved surfaces`],
        ['1973', `Phong's Utah thesis adds realistic highlights (published 1975)`],
        ['1974', 'Straßer (Berlin) and Catmull (Utah) independently describe the z-buffer'],
        ['1974', 'Catmull maps pictures onto curved surfaces: early texture mapping'],
        ['1975', `Newell's teapot model appears in his Utah PhD thesis`],
      ],
    },
    {
      type: 'tryit',
      text: `The pop-up shows a chunky, flat-shaded 3D object, an eye with its viewing pyramid, and a little screen card where the object is rasterised into big, visible pixels. Drag to rotate the object, and press the button or click the screen card to switch between the colour picture and the depth buffer, where each pixel's shade shows how far away that bit of surface is.`,
    },
    {
      type: 'sources',
      items: [
        `H. Gouraud, "Continuous shading of curved surfaces", IEEE Transactions on Computers C-20(6), 623–629, 1971. https://doi.org/10.1109/T-C.1971.223313`,
        `B. T. Phong, "Illumination for computer generated pictures", Communications of the ACM 18(6), 311–317, 1975. https://doi.org/10.1145/360825.360839`,
        `W. Straßer, "Schnelle Kurven- und Flächendarstellung auf grafischen Sichtgeräten" (doctoral thesis), Technische Universität Berlin, 1974. https://cgvr.cs.uni-bremen.de/miscellaneous/strasser/Wolfgang_Strasser_Schnelle_Kurven-_und_Flaechendarstellung_auf_grafischen_Sichtgeraeten.pdf`,
        `E. Catmull, "A subdivision algorithm for computer display of curved surfaces" (PhD thesis), University of Utah, UTEC-CSc-74-133, December 1974. https://collections.lib.utah.edu/ark:/87278/s6cg2j21`,
        `M. E. Newell, "The utilization of procedure models in digital image synthesis" (PhD thesis), University of Utah, UTEC-CSc-76-218, summer 1975. https://collections.lib.utah.edu/ark:/87278/s6hh73p6`,
        `Computer History Museum, "The Utah Teapot", catalogue no. X398.84. https://www.computerhistory.org/collections/catalog/X398.84`,
        `University of Utah Kahlert School of Computing, "History". https://www.cs.utah.edu/school/history/`,
      ],
    },
  ],
}

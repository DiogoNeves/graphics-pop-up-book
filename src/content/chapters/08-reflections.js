export default {
  id: 'reflections',
  number: 8,
  title: 'Reflections',
  era: '1976 – 2018',
  wikipedia: { label: 'Reflection mapping', url: 'https://en.wikipedia.org/wiki/Reflection_mapping' },
  blocks: [
    {
      type: 'lead',
      text: `Why does a chrome teapot look like chrome? Because it shows you the room around it. Drawing those mirror images quickly has been one of the great puzzles of computer graphics.`,
    },
    {
      type: 'p',
      text: `In 1976 Jim Blinn and Martin Newell at the University of Utah found a clever shortcut. Instead of working out what every shiny point could really see, they pretended the object sat at the centre of a huge sphere with a picture of its surroundings painted on the inside. For each pixel, the computer bounces the line of sight off the surface, angle in equals angle out, and simply looks up the colour stored in that direction. Their teapot reflected a room that Blinn had painted with his own paint program.`,
    },
    {
      type: 'figure',
      sketch: 'environment-lookup',
      caption: 'Bounce the view ray, then look up that direction in the map.',
      brief: 'Draw a very large circle filling the frame (the environment); along its inside edge sketch a small tree at the upper left and a small sun at the top right. In the centre draw a small circle (the shiny ball). Inside the large circle at lower left draw an eye. Draw a straight arrow from the eye to the left-most point of the small ball. From that point draw a short arrow pointing straight out from the ball surface, to the left (the normal). From the same point draw a second arrow leaving at the mirror angle (same angle to the normal as the incoming arrow, on the other side), so it heads up and to the left, running out to the large circle and ending on the little tree; put a dot where it meets the circle. Labels: "eye", "view ray" on the first arrow, "normal" on the short arrow, "reflected ray" on the outgoing arrow, "environment map" beside the large circle.',
    },
    {
      type: 'p',
      text: `This **environment map** cheats: it assumes everything reflected is far away, so nearby objects come out slightly wrong. But it is fast, and the eye rarely notices. How the surroundings are stored matters. A **sphere map** is like a photo of a polished ball, the whole world squeezed into one circle, most tightly at the rim, and correct from only one viewpoint. In 1986 Ned Greene at the New York Institute of Technology made the case for a **cube map**: place a camera at the object's centre and take six square pictures, up, down, left, right, forwards and back. Any reflected direction points at one spot on one face. NVIDIA's GeForce 256 put cube mapping into consumer graphics chips in 1999, and re-rendering the six views each frame lets reflections move.`,
    },
    {
      type: 'figure',
      sketch: 'cube-map-cross',
      caption: 'A cube map unfolded into a cross of six views.',
      brief: 'Draw six equal squares arranged as an unfolded cube in a cross shape: a horizontal row of four squares side by side, plus one square directly above the second square of the row and one square directly below that same second square. Write one label inside each square: in the row from left to right "left", "front", "right", "back"; in the square above "front" write "up"; in the square below "front" write "down". Lightly draw dotted fold lines on the shared edges.',
    },
    {
      type: 'p',
      text: `Flat mirrors and calm water can be drawn exactly with a **planar reflection**: render the scene a second time from a camera mirrored behind the surface. Games also borrowed **screen-space reflections**, which Crytek added to Crysis 2 in a 2011 update; reflection rays are traced across the finished image itself, so anything off-screen cannot appear.`,
    },
    {
      type: 'p',
      text: `The fully general answer is to trace the reflected ray through the scene, as Turner Whitted did in 1980, but for decades that was far too slow for games. In November 2018 Battlefield V became, by NVIDIA's account, the first big-budget game to ship real-time ray-traced reflections, using Microsoft's DirectX Raytracing on NVIDIA RTX graphics cards.`,
    },
    {
      type: 'timeline',
      items: [
        ['1976', 'Blinn & Newell reflect a painted room in a teapot'],
        ['1986', 'Ned Greene argues for cube-shaped environment maps'],
        ['1999', 'NVIDIA GeForce 256 brings cube mapping to consumer hardware'],
        ['2011', 'Crysis 2 update adds screen-space reflections'],
        ['2018', 'Battlefield V ships real-time ray-traced reflections'],
      ],
    },
    {
      type: 'tryit',
      text: `A chrome sphere sits among colourful objects that circle around it. Each moment, six cameras at its centre photograph the scene to build a cube map, and the card beside it shows those six views unfolded into a cross; drag the shapes around the ball and find each reflection on its face of the cross.`,
    },
    {
      type: 'sources',
      items: [
        'James F. Blinn and Martin E. Newell, "Texture and Reflection in Computer Generated Images", Communications of the ACM 19(10), pp. 542–547, 1976. https://doi.org/10.1145/360349.360353',
        'Ned Greene, "Environment Mapping and Other Applications of World Projections", IEEE Computer Graphics and Applications 6(11), pp. 21–29, 1986. https://doi.org/10.1109/MCG.1986.276658',
        'Paul Debevec, "The Story of Reflection Mapping", pauldebevec.com. https://pauldebevec.com/ReflectionMapping/',
        'NVIDIA, "Cube Environment Mapping" (GeForce 256 technology page). https://www.nvidia.com/en-us/drivers/feature-cube/',
        'Tiago Sousa, Nickolay Kasyan and Nicolas Schulz, "Secrets of CryENGINE 3 Graphics Technology", SIGGRAPH 2011 course: Advances in Real-Time Rendering in 3D Graphics and Games, 2011. https://advances.realtimerendering.com/s2011/index.html',
        'NVIDIA, "Battlefield V DXR Real-Time Ray Tracing Available Now", GeForce News, 14 November 2018. https://www.nvidia.com/en-us/geforce/news/battlefield-v-rtx-ray-tracing-out-now/',
      ],
    },
  ],
}

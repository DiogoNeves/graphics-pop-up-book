export default {
  id: 'vector-to-raster',
  number: 1,
  title: 'Pong & Oscilloscopes',
  era: '1958 – 1972',
  wikipedia: {
    label: 'Early history of video games',
    url: 'https://en.wikipedia.org/wiki/Early_history_of_video_games',
  },
  blocks: [
    {
      type: 'lead',
      text: `Before games had pixels, they had a single glowing dot steered across the face of a glass tube. This chapter follows that dot from a laboratory oscilloscope to the family television.`,
    },
    {
      type: 'p',
      text: `On 18 October 1958, visitors to Brookhaven National Laboratory's open day queued to play the game now known as **Tennis for Two**. The physicist William Higinbotham, head of the lab's Instrumentation Division, wanted an exhibit people could actually play, and technician Robert Dvorak built it in about three weeks. A small analog computer worked out the ball's flight, gravity and all. The picture appeared on an oscilloscope screen only about five inches across: a side view of a court and net, with a bright dot that left a fading trail as it bounced.`,
    },
    {
      type: 'figure',
      sketch: 'tennis-for-two-scope',
      caption: 'Tennis for Two: a side view of tennis on an oscilloscope',
      brief: `Draw an oscilloscope as a boxy instrument with a round screen on its front. Inside the circle: a long horizontal line near the bottom (the court) and a short vertical line rising from its middle (the net). Draw a dotted arc that starts low on the left half, rises over the net and comes down on the right half, ending in a small filled bright dot (the ball). Beside the oscilloscope, draw one small hand-held box with a round knob on top and a push button on its side, joined to the oscilloscope by a curly cable. Handwritten labels with short arrows: 'court' (to the horizontal line), 'net' (to the vertical line), 'ball trail' (to the dotted arc), 'angle knob' (to the knob), 'hit button' (to the button).`,
    },
    {
      type: 'p',
      text: `An oscilloscope is a **vector** (or random-scan) display. Inside its cathode-ray tube, a beam of electrons is steered straight to wherever the picture needs light, in any order, and the phosphor coating glows where the beam lands. Tennis for Two flicked its beam between ball, net and court about 36 times a second, fast enough for the eye to see one picture. In 1962 at MIT, Steve Russell and friends got **Spacewar!** running on a DEC PDP-1, whose Type 30 screen worked the same way: the program named one of 1024 × 1024 positions and the beam lit a dot there, around 20,000 dots a second.`,
    },
    {
      type: 'figure',
      sketch: 'vector-vs-raster',
      caption: 'Vector: the beam goes where the picture is. Raster: it visits every row.',
      brief: `Two identical rounded rectangles side by side, representing two screens. LEFT screen: a short horizontal line near the bottom, a short vertical line standing on its middle, and a small dot up and to the right; join them with one thin continuous arrowed path that jumps straight from the end of the horizontal line to the foot of the vertical line, up it, then directly across to the dot, showing the beam travelling only where the picture is. RIGHT screen: 8 evenly spaced horizontal lines filling the screen, each with a small arrowhead pointing right, and thin dashed diagonal lines running from the right end of each row back to the left end of the row below. On two neighbouring rows, thicken one short segment in the same place so together they form a small square (a ball). Handwritten label above the left screen: 'VECTOR'; above the right screen: 'RASTER'; under the right screen, with an arrow to one row: 'scanline'.`,
    },
    {
      type: 'p',
      text: `A television works differently. It is a **raster** display: the beam sweeps the whole screen in a fixed pattern of hundreds of horizontal rows, called scanlines, from top to bottom about 60 times a second (in North America), and a picture appears by turning the beam up or down as it passes. Between 1966 and 1968, Ralph Baer's team at Sanders Associates built game prototypes that plugged into an ordinary home TV. Licensed to Magnavox, they became the **Odyssey** console in 1972.`,
    },
    {
      type: 'p',
      text: `That same year, Atari's Allan Alcorn built **Pong**, a practice project set by Nolan Bushnell that became an arcade hit. Pong never ran on an oscilloscope, and it had no microprocessor, no program and no picture memory. A single board of off-the-shelf TTL logic chips kept time with the TV's sweep and switched the beam on at just the right moments to draw paddles, ball and score; the prototype's screen was a black-and-white Hitachi television bought for about $75. Raster screens would soon win out, because a picture made of rows can be stored as a grid of numbers: the pixels of the next chapter.`,
    },
    {
      type: 'timeline',
      items: [
        ['1958', `Tennis for Two shown at Brookhaven's visitors' day (18 October)`],
        ['1962', `Spacewar! running on MIT's PDP-1 and its Type 30 point-plotting screen`],
        ['1966–68', `Ralph Baer's team builds TV game prototypes at Sanders Associates`],
        ['1972', 'Magnavox Odyssey brings video games to the home TV'],
        ['1972', `Atari's Pong, built from TTL logic chips, reaches the arcades`],
      ],
    },
    {
      type: 'tryit',
      text: `The pop-up oscilloscope plays a Tennis for Two-style rally: a glowing dot arcs over the net, leaving a phosphor trail. Press a controller's red button to hit the ball back when it is on that side. Click the oscilloscope to turn it into a raster TV showing a Pong-like game, drawn row by row with visible scanlines, and slide the tab to slow the beam down and watch it draw.`,
    },
    {
      type: 'sources',
      items: [
        `Brookhaven National Laboratory, "The First Video Game? Before 'Pong,' There Was 'Tennis for Two'", BNL History, 2008. https://www.bnl.gov/about/history/firstvideo.php`,
        `The Strong National Museum of Play, "Following the Bouncing Ball: Tennis for Two... at The Strong!", 2017. https://www.museumofplay.org/blog/following-the-bouncing-ball-tennis-for-two-at-the-strong/`,
        `J. M. Graetz, "The Origin of Spacewar!", Creative Computing 7(8), August 1981 (annotated reprint). https://www.masswerk.at/spacewar/SpacewarOrigin.html`,
        `Computer History Museum, "Spacewar!", PDP-1 Restoration Project. https://www.computerhistory.org/pdp-1/spacewar/`,
        `IEEE, "Milestones: Interactive Video Games, 1966", Engineering and Technology History Wiki. https://ethw.org/Milestones:Interactive_Video_Games,_1966`,
        `Allan E. Alcorn, oral history interview by Christopher Weaver, Lemelson Center, Smithsonian Institution, 16 March 2018. https://mads.si.edu/mads/id/NMAH-AC1498_Transcript_AllanAlcorn`,
      ],
    },
  ],
}

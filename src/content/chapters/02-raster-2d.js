export default {
  id: 'raster-2d',
  number: 2,
  title: 'Pixels on a Grid',
  era: '1962 – 1977',
  wikipedia: {
    label: 'Rasterisation',
    url: 'https://en.wikipedia.org/wiki/Rasterisation',
  },
  blocks: [
    {
      type: 'lead',
      text: `A raster screen is a grid of tiny squares, each lit or left dark. So how do you draw a smooth, slanted line on what is really a chessboard? Deciding which squares a shape should light is called **rasterisation**.`,
    },
    {
      type: 'p',
      text: `To hold a whole picture you need a **framebuffer**: a memory storing one number for every pixel, read out in step with the TV's sweeping beam. Memory chips big enough only became practical in the early 1970s. At Xerox's Palo Alto Research Center (PARC), Richard Shoup began **SuperPaint** in 1972 and it showed its first picture in April 1973. Its framebuffer held 640 × 486 pixels of 8 bits each, so it could show 256 colours at once, and artists painted with a pen on a tablet. Shoup stressed that it was neither the first framebuffer nor the first paint program, but it showed computing and television merging.`,
    },
    {
      type: 'p',
      text: `For a line, the computer picks one pixel per step. The obvious way, often called a DDA (digital differential analyser), walks along the line a column at a time, adds the slope to the height and rounds to the nearest row. That needs fractions and rounding, which were slow on early machines. In 1962 Jack Bresenham, working in IBM's San Jose lab, found a neater route, written for a pen plotter that could only step to one of the eight neighbouring points on a fine grid (typically 1/100 inch). His method keeps a whole-number running **error**: how far the drawn path has drifted from the true line. Every step moves one square along the line's long direction; whenever the error passes the halfway mark, it also steps one square sideways and the error is corrected. It needs only adding, subtracting and comparing, never multiplying or dividing. He presented it at an ACM conference in 1963, and IBM published it in 1965. A grid of plotter steps is just like a grid of pixels, so it suits screens perfectly.`,
    },
    {
      type: 'figure',
      sketch: 'bresenham-grid',
      caption: 'One pixel per column, chosen to hug the true line',
      brief: `Draw a grid of 8 columns by 4 rows of equal squares. Number the columns 1 to 8 from left to right and the rows 1 to 4 from bottom to top (do not write the numbers). Draw one straight thin line from the centre of the bottom-left square (column 1, row 1) to the centre of the top-right square (column 8, row 4). Shade exactly one square in each column, these eight: column 1 row 1, column 2 row 1, column 3 row 2, column 4 row 2, column 5 row 3, column 6 row 3, column 7 row 4, column 8 row 4. In column 2, draw a tiny vertical double-headed arrow between the centre of the shaded square and the point directly above it where the thin line passes. Handwritten labels with arrows: 'ideal line' (to the thin line), 'chosen pixels' (to a shaded square), 'error' (to the tiny double-headed arrow).`,
    },
    {
      type: 'p',
      text: `Filled shapes work row by row too. **Scanline filling** visits the grid one row at a time, finds where the shape's edges cross that row, and lights the pixels between each pair of crossings. But anything drawn with whole squares gets staircase edges, the **jaggies**. This is **aliasing**: a pixel grid samples a smooth shape only at fixed points, so it misses what falls between them. **Anti-aliasing** softens the staircase by giving edge pixels in-between shades, according to how much of each pixel the shape covers. Shoup wrote a jaggie-removal program for SuperPaint in 1973, and in 1977 Franklin Crow, reporting work done at the University of Utah, explained the defects with the mathematics of sampling and showed that filtering reduces them.`,
    },
    {
      type: 'figure',
      sketch: 'jaggies-vs-antialiased',
      caption: 'The same edge, with and without anti-aliasing',
      brief: `Two small square grids side by side, each 6 by 6 squares. On each, draw the same thin straight diagonal line from the bottom-left corner of the grid to a point on the right edge two-thirds of the way up, and treat everything below the line as the shape. LEFT grid: fill every square whose centre lies below the line solid black and leave the rest empty, giving a clear staircase edge. RIGHT grid: fill the same squares solid black, but draw the squares that the line passes through with light grey hatching instead (denser hatching where more of the square is below the line). Handwritten label under the left grid: 'jaggies'; under the right grid: 'anti-aliased'.`,
    },
    {
      type: 'timeline',
      items: [
        ['1962', `Bresenham's line method in use at IBM San Jose, driving a pen plotter`],
        ['1963', 'Bresenham presents it at the ACM national convention'],
        ['1965', 'The method is published in the IBM Systems Journal'],
        ['1973', 'SuperPaint shows its first picture at Xerox PARC (April)'],
        ['1977', 'Franklin Crow explains aliasing in Communications of the ACM'],
      ],
    },
    {
      type: 'tryit',
      text: `Drag the two pins on the pop-up pegboard to move the ends of a line. The square pegs chosen by Bresenham's algorithm rise up and light, one per step, while a thin thread shows the perfect mathematical line they are approximating. Press the button to add a third pin and fill a triangle instead.`,
    },
    {
      type: 'sources',
      items: [
        `J. E. Bresenham, "Algorithm for computer control of a digital plotter", IBM Systems Journal 4(1), 25–30, 1965. https://doi.org/10.1147/sj.41.0025`,
        `P. E. Black, "Bresenham's algorithm" (with Bresenham's 2001 recollection), Dictionary of Algorithms and Data Structures, NIST. https://xlinux.nist.gov/dads/HTML/bresenham.html`,
        `R. Shoup, "SuperPaint: An Early Frame Buffer Graphics System", IEEE Annals of the History of Computing 23(2), 32–37, 2001. https://doi.org/10.1109/85.929909`,
        `F. C. Crow, "The aliasing problem in computer-generated shaded images", Communications of the ACM 20(11), 799–805, 1977. https://doi.org/10.1145/359863.359869`,
      ],
    },
  ],
}

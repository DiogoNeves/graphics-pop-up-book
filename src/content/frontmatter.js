// The welcome and closing spreads that frame the chapters.
export const intro = {
  id: 'intro',
  title: 'Welcome',
  era: 'A pop-up history of computer graphics',
  wikipedia: { label: 'Computer graphics', url: 'https://en.wikipedia.org/wiki/Computer_graphics' },
  blocks: [
    {
      type: 'lead',
      text: 'Every picture on a screen is light that a computer decided to draw. This little book follows how people taught machines to draw — from a dot bouncing across an oscilloscope to light bouncing around a room.',
    },
    {
      type: 'p',
      text: 'Each spread has two halves. On the **left**, a short story with sketches explains one idea and where it came from. On the **right**, a pop-up turns that idea into something you can poke at.',
    },
    {
      type: 'p',
      text: 'The book itself is drawn live in your browser with **WebGPU** (or WebGL 2 where WebGPU is not available) through the three.js library. It relies on several of the ideas in these pages: rasterisation, a graphics processor, and shading.',
    },
    {
      type: 'tryit',
      text: 'Drag the table to look around and scroll to zoom a little. Scroll or drag this page to read more. Use the arrows in the bar below to turn the pages, and the round arrow to reset the view.',
    },
  ],
};

export const end = {
  id: 'end',
  title: 'Further reading',
  era: 'The end',
  wikipedia: { label: 'Computer graphics (computer science)', url: 'https://en.wikipedia.org/wiki/Computer_graphics_(computer_science)' },
  blocks: [
    {
      type: 'lead',
      text: 'Every chapter lists the sources its facts were checked against. If you want to go further, these are good places to start.',
    },
    { type: 'h', text: 'Books' },
    {
      type: 'p',
      text: '_Computer Graphics: Principles and Practice_ (3rd edition, 2013) by John F. Hughes, Andries van Dam, Morgan McGuire, David F. Sklar, James D. Foley, Steven K. Feiner and Kurt Akeley.',
    },
    {
      type: 'p',
      text: '_Real-Time Rendering_ (4th edition, 2018) by Tomas Akenine-Möller, Eric Haines, Naty Hoffman, Angelo Pesce, Michał Iwanicki and Sébastien Hillaire.',
    },
    {
      type: 'p',
      text: '_Physically Based Rendering: From Theory to Implementation_ (4th edition, 2023) by Matt Pharr, Wenzel Jakob and Greg Humphreys, free to read at pbr-book.org.',
    },
    { type: 'h', text: 'History' },
    {
      type: 'p',
      text: 'Wayne Carlson’s _Computer Graphics and Computer Animation: A Retrospective Overview_ (Ohio State University) and the ACM SIGGRAPH History Archive at history.siggraph.org.',
    },
    { type: 'h', text: 'Made with' },
    {
      type: 'p',
      text: 'three.js and its WebGPU renderer for the 3D scene, rough.js for the hand-drawn sketches, and the typefaces Fraunces, Crimson Pro and Caveat.',
    },
  ],
};

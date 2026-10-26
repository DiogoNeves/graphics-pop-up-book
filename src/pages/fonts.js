import '@fontsource/crimson-pro/400.css';
import '@fontsource/crimson-pro/400-italic.css';
import '@fontsource/crimson-pro/700.css';
import '@fontsource/crimson-pro/700-italic.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';

// Canvas text needs the faces loaded before drawing.
export function loadFonts() {
  const faces = [
    '400 40px "Crimson Pro"',
    'italic 400 40px "Crimson Pro"',
    '700 40px "Crimson Pro"',
    'italic 700 40px "Crimson Pro"',
    '400 40px "Fraunces"',
    '600 40px "Fraunces"',
    '500 40px "Caveat"',
    '700 40px "Caveat"',
  ];
  return Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {});
}

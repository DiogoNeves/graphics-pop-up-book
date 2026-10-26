import { intro, end } from './frontmatter.js';

const modules = import.meta.glob('./chapters/*.js', { eager: true });
const chapters = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.number - b.number);

// ?test=<popup-id> adds a stub chapter so a pop-up can be viewed before its text exists.
const test = new URLSearchParams(location.search).get('test');
if (test && !chapters.some((c) => c.id === test)) {
  chapters.unshift({ id: test, number: 0, title: test, era: 'test', wikipedia: intro.wikipedia, blocks: [{ type: 'p', text: `Test page for the ${test} pop-up.` }] });
}

// Spread 0 is the welcome page, then one spread per chapter, then the closing page.
export const spreads = [intro, ...chapters, end];

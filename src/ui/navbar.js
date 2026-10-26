// Bottom bar: reset view, previous/next, a table of contents and the Wikipedia link.
export function createNavbar({ spreads, book, onReset }) {
  const $ = (id) => document.getElementById(id);
  const prev = $('prev');
  const next = $('next');
  const toc = $('toc');
  const list = $('toc-list');
  const wiki = $('wiki');
  const a11y = $('a11y');

  const entries = [{ title: 'Cover', number: '' }, ...spreads.map((s) => ({ title: s.title, number: s.number ?? '' }))];
  entries.forEach((entry, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.innerHTML = `<span class="n">${entry.number}</span><span></span>`;
    b.lastChild.textContent = entry.title;
    b.addEventListener('click', () => {
      book.goTo(i - 1);
      setOpen(false);
    });
    li.appendChild(b);
    list.appendChild(li);
  });

  const setOpen = (open) => {
    list.hidden = !open;
    toc.setAttribute('aria-expanded', String(open));
  };
  toc.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(list.hidden);
  });
  document.addEventListener('click', (e) => {
    if (!list.hidden && !list.contains(e.target)) setOpen(false);
  });

  prev.addEventListener('click', () => book.prev());
  next.addEventListener('click', () => book.next());
  $('reset').addEventListener('click', onReset);
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowRight') book.next();
    else if (e.key === 'ArrowLeft') book.prev();
    else if (e.key === 'r' || e.key === 'R') onReset();
    else if (e.key === 'Escape') setOpen(false);
  });

  function update(index) {
    const entry = entries[index + 1];
    $('toc-num').textContent = entry.number;
    $('toc-title').textContent = entry.title;
    prev.disabled = index <= -1;
    next.disabled = index >= spreads.length - 1;
    [...list.querySelectorAll('button')].forEach((b, i) => b.setAttribute('aria-current', String(i === index + 1)));
    const spread = spreads[Math.max(0, index)];
    wiki.href = spread.wikipedia.url;
    wiki.title = `Wikipedia: ${spread.wikipedia.label}`;
    a11y.innerHTML = '';
    if (index >= 0) a11y.appendChild(describe(spread));
  }

  return { update };
}

// Plain-HTML copy of the page text for screen readers.
function describe(spread) {
  const frag = document.createDocumentFragment();
  const h = document.createElement('h2');
  h.textContent = spread.title;
  frag.appendChild(h);
  for (const b of spread.blocks ?? []) {
    let text = b.text ?? '';
    if (b.type === 'figure') text = `Figure: ${b.caption ?? ''}`;
    if (b.type === 'timeline') text = b.items.map(([y, t]) => `${y}: ${t}`).join('. ');
    if (b.type === 'sources') text = `Sources: ${b.items.join('; ')}`;
    const p = document.createElement('p');
    p.textContent = text.replace(/\*\*|_/g, '');
    frag.appendChild(p);
  }
  return frag;
}

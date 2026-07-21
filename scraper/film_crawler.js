// Runs inside a criterion.com page (same-origin fetch passes Cloudflare).
// Pulls the pending film queue from the local collector, scrapes each film /
// boxset page, and POSTs results back. Loops until the queue is empty so
// newly discovered related films and boxset members get scraped too.
(() => {
  const S = window.__fc = {done: 0, errors: 0, rounds: 0, running: true, last: null};
  const failed = new Set();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || '').replace(/\s+/g, ' ').trim() || null;

  function parseCreditSections(doc) {
    const out = {cast: [], credits: []};
    doc.querySelectorAll('.film-credits h5').forEach(h5 => {
      const header = clean(h5.textContent);
      const dl = h5.nextElementSibling;
      if (!dl || !dl.matches('dl')) return;
      const kids = [...dl.children];
      for (let i = 0; i < kids.length; i++) {
        if (kids[i].tagName !== 'DT') continue;
        const dt = clean(kids[i].textContent);
        const dds = [];
        let j = i + 1;
        while (kids[j] && kids[j].tagName === 'DD') {
          dds.push(clean(kids[j].textContent));
          j++;
        }
        if (header === 'Cast') {
          out.cast.push({actor: dt, role: dds.join(', ') || null});
        } else {
          out.credits.push({role: dt, names: dds.filter(Boolean)});
        }
      }
    });
    return out;
  }

  async function parseFilm(url) {
    const res = await fetch(url, {credentials: 'same-origin'});
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const {cast, credits} = parseCreditSections(doc);
    const related = [...doc.querySelectorAll('.product-relatedfilms .filmWrap')].map(w => {
      const a = w.querySelector('a[href*="/films/"], a[href*="/boxsets/"]');
      return a ? {
        film_url: a.getAttribute('href'),
        title: clean(w.querySelector('dt')?.textContent) || w.querySelector('img')?.alt || null,
        director: clean(w.querySelector('dd')?.textContent),
        cover_thumb: w.querySelector('img')?.getAttribute('src') || null
      } : null;
    }).filter(Boolean);
    const setFilms = [...doc.querySelectorAll('.film-sets-list a')].map(a => {
      const href = a.getAttribute('href') || '';
      return href.includes('/films/') ? {
        film_url: href,
        title: clean(a.querySelector('.film-set-title')?.textContent),
        year: clean(a.querySelector('.film-set-year')?.textContent),
        cover_thumb: a.querySelector('img')?.getAttribute('src') || null
      } : null;
    }).filter(Boolean);
    return {
      url,
      title: clean(doc.querySelector('h1')?.textContent) ||
             clean(doc.querySelector('meta[property="og:title"]')?.content),
      cover_url: doc.querySelector('.product-box-art img')?.getAttribute('src') ||
                 doc.querySelector('meta[property="og:image"]')?.content || null,
      meta: [...doc.querySelectorAll('.film-meta-list li')].map(li => clean(li.textContent)).filter(Boolean),
      description: doc.querySelector('meta[name="description"]')?.content || null,
      cast,
      credits,
      related,
      set_films: setFilms
    };
  }

  (async () => {
    while (true) {
      const queueRes = await fetch('http://127.0.0.1:8787/films_queue');
      const queue = (await queueRes.json()).filter(u => !failed.has(u));
      if (!queue.length) break;
      S.rounds++;
      for (const url of queue) {
        let record = null;
        for (let attempt = 0; attempt < 3 && !record; attempt++) {
          try {
            record = await parseFilm(url);
          } catch (e) {
            if (attempt === 2) {
              failed.add(url);
              S.errors++;
              fetch('http://127.0.0.1:8787/errors', {method: 'POST',
                body: JSON.stringify({phase: 'film', url, error: e.message})});
            } else {
              await sleep(2000 * (attempt + 1));
            }
          }
        }
        if (record) {
          await fetch('http://127.0.0.1:8787/films', {method: 'POST', body: JSON.stringify(record)});
          S.done++;
          S.last = record.title;
        }
        await sleep(200);
      }
    }
    S.running = false;
  })();

  return 'film crawl started';
})()

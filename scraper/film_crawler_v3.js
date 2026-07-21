// Film crawler v3 — 3 concurrent workers pulling from a shared in-page queue,
// refilled from the local collector. Runs inside a criterion.com page.
(() => {
  if (window.__fc?.running && Date.now() - window.__fc.lastTick < 15000) {
    return 'already running';
  }
  const S = window.__fc = {done: 0, errors: 0, running: true, last: null, lastTick: Date.now()};
  const failed = new Set();
  const inFlight = new Set();
  let localQueue = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || '').replace(/\s+/g, ' ').trim() || null;

  async function post(path, body) {
    for (let i = 0; i < 5; i++) {
      try { await fetch('http://127.0.0.1:8787/' + path, {method: 'POST', body: JSON.stringify(body)}); return true; }
      catch (e) { await sleep(1500); }
    }
    return false;
  }

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
        while (kids[j] && kids[j].tagName === 'DD') { dds.push(clean(kids[j].textContent)); j++; }
        if (header === 'Cast') out.cast.push({actor: dt, role: dds.join(', ') || null});
        else out.credits.push({role: dt, names: dds.filter(Boolean)});
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
      title: clean(doc.querySelector('h1')?.textContent) || clean(doc.querySelector('meta[property="og:title"]')?.content),
      cover_url: doc.querySelector('.product-box-art img')?.getAttribute('src') || doc.querySelector('meta[property="og:image"]')?.content || null,
      meta: [...doc.querySelectorAll('.film-meta-list li')].map(li => clean(li.textContent)).filter(Boolean),
      description: doc.querySelector('meta[name="description"]')?.content || null,
      cast, credits, related, set_films: setFilms
    };
  }

  let refillFailures = 0;
  let drained = false;
  async function refill() {
    try {
      const q = await (await fetch('http://127.0.0.1:8787/films_queue')).json();
      refillFailures = 0;
      localQueue = q.filter(u => !failed.has(u) && !inFlight.has(u));
      if (!localQueue.length && !inFlight.size) drained = true;
    } catch (e) {
      if (++refillFailures > 20) drained = true;
    }
  }

  async function worker(id) {
    await sleep(id * 400);
    while (!drained) {
      if (!localQueue.length) { await refill(); if (drained) break; if (!localQueue.length) { await sleep(1500); continue; } }
      const url = localQueue.shift();
      if (!url) continue;
      inFlight.add(url);
      S.lastTick = Date.now();
      let record = null;
      for (let attempt = 0; attempt < 3 && !record; attempt++) {
        try { record = await parseFilm(url); }
        catch (e) {
          if (attempt === 2) { failed.add(url); S.errors++; await post('errors', {phase: 'film', url, error: e.message}); }
          else await sleep(1500 * (attempt + 1));
        }
      }
      if (record) { await post('films', record); S.done++; S.last = record.title; }
      inFlight.delete(url);
      await sleep(150);
    }
  }

  Promise.all([worker(0), worker(1), worker(2)]).then(() => { S.running = false; });
  return 'film crawl v3 started (3 workers)';
})()

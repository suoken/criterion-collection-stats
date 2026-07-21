// Lookups against IMDb's public search-suggestion endpoint (the same JSON
// their site search box uses). Definitive results — including "no match" —
// are cached in localStorage so each subject is looked up at most once per
// browser. Network failures are NOT cached, so transient outages or rate
// limiting never stick.
const memory = new Map();

function asciiFirstLetter(name) {
  const stripped = name.normalize("NFKD").replace(/[^a-zA-Z]/g, "");
  return (stripped[0] || "x").toLowerCase();
}

async function cachedLookup(key, query, pick) {
  if (memory.has(key)) return memory.get(key);
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const parsed = stored === "" ? null : JSON.parse(stored);
      memory.set(key, parsed);
      return parsed;
    }
  } catch { /* storage unavailable — fall through to network */ }

  let entries;
  try {
    const q = encodeURIComponent(query.toLowerCase());
    const r = await fetch(
      `https://v2.sg.media-imdb.com/suggestion/${asciiFirstLetter(query)}/${q}.json`
    );
    if (!r.ok) return null; // transient server trouble: retry next time
    entries = (await r.json()).d || [];
  } catch {
    return null; // offline / blocked: retry next time
  }

  const result = pick(entries);
  memory.set(key, result);
  try {
    localStorage.setItem(key, result ? JSON.stringify(result) : "");
  } catch { /* storage full — memory cache still applies */ }
  return result;
}

// People: photo + profile id. Entries may have img: null but still carry
// imdbId for profile links.
export function lookupHeadshot(name) {
  return cachedLookup(`imdb2:${name}`, name, (entries) => {
    const people = entries.filter((x) => x.id?.startsWith("nm"));
    const exact = people.find((x) => x.l?.toLowerCase() === name.toLowerCase());
    const hit = exact || people[0];
    return hit
      ? { img: hit.i?.imageUrl || null, imdbId: hit.id, matched: hit.l }
      : null;
  });
}

// Film titles (tt… ids), used to deep-link to Letterboxd via their
// /imdb/{id}/ redirect. Prefers a result matching the film's year.
export function lookupFilmTitle(title, year) {
  return cachedLookup(`imdbT:${title}|${year || ""}`, title, (entries) => {
    const titles = entries.filter((x) => x.id?.startsWith("tt"));
    const yearMatch = year
      ? titles.find((x) => x.y && Math.abs(x.y - year) <= 1)
      : null;
    const hit = yearMatch || titles[0];
    return hit ? { imdbId: hit.id, matched: hit.l, year: hit.y || null } : null;
  });
}

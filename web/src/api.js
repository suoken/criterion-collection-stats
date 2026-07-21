// Data access: static JSON chunks under /data, cached per session.
const cache = new Map();

async function get(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(`${import.meta.env.BASE_URL}data/${path}`).then((r) => {
    if (!r.ok) throw new Error(`missing data: ${path}`);
    return r.json();
  });
  cache.set(path, promise);
  return promise;
}

export const getStats = () => get("stats.json");
export const getFilmsIndex = () => get("films.json");
export const getCelebsIndex = () => get("celebs.json");
export const getPeopleIndex = () => get("people.json");
export const getFilm = (id) => get(`film/${id}.json`);
export const getPerson = (slug) => get(`person/${slug}.json`);
export const getCeleb = (id) => get(`celeb/${id}.json`);

export function celebDisplayName(sessionTitle) {
  return sessionTitle.replace(/[’']s Closet Picks$/, "");
}

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

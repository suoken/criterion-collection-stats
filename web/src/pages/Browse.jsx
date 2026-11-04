import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCelebsIndex, getFilmsIndex, getPeopleIndex } from "../api.js";
import { Section, Loading } from "../components/shared.jsx";

const TITLES = {
  films: { eyebrow: "The Full Program", title: "Every Picked Film" },
  directors: { eyebrow: "Behind the Camera", title: "Directors by Picks" },
  actors: { eyebrow: "The Players", title: "Actors by Picks" },
  visitors: { eyebrow: "The Guest Book", title: "Closet Visitors" },
};

/* Every pick is drawn as one disc spine on the shelf. Colors and heights
   are hashed from the row key so shelves look organic but never reshuffle. */
const SPINE_COLORS = [
  "#1d1c1a", "#3d3a35", "#8b2e22", "#c49a2c",
  "#d8d3c7", "#556769", "#a0582c", "#efece4",
];

function spineSeed(key, i) {
  const s = `${key}:${i}`;
  let h = 2166136261;
  for (let j = 0; j < s.length; j++) {
    h ^= s.charCodeAt(j);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function Spines({ rowKey, count }) {
  return Array.from({ length: count }, (_, i) => {
    const seed = spineSeed(rowKey, i);
    return (
      <i
        key={i}
        className="spine"
        style={{
          height: 38 + (seed % 15),
          backgroundColor: SPINE_COLORS[seed % SPINE_COLORS.length],
        }}
      />
    );
  });
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function indexLetter(name) {
  const first = (name || "").normalize("NFKD")[0]?.toUpperCase() || "#";
  return first >= "A" && first <= "Z" ? first : "#";
}

export default function Browse({ kind }) {
  const [films, setFilms] = useState(null);
  const [people, setPeople] = useState(null);
  const [celebs, setCelebs] = useState(null);
  const [limit, setLimit] = useState(50);
  // the visitors letter and the pick cap live in the URL, so the back
  // button restores them and the home page can link to /films?max=1
  const [searchParams, setSearchParams] = useSearchParams();
  const cap = Number(searchParams.get("max")) || null; // null = no cap
  const setCap = (n) => setSearchParams({ max: n }, { replace: true });
  const letter = searchParams.get("letter"); // null = top-25 view
  const setLetter = (l) =>
    setSearchParams(l ? { letter: l } : {}, { replace: true });
  const navigate = useNavigate();
  const hasControls = kind === "films" || kind === "directors" || kind === "actors";

  useEffect(() => {
    setLimit(50);
    if (kind === "films") getFilmsIndex().then(setFilms).catch(console.error);
    else if (kind === "visitors") getCelebsIndex().then(setCelebs).catch(console.error);
    else getPeopleIndex().then(setPeople).catch(console.error);
  }, [kind]);

  const rows = useMemo(() => {
    if (kind === "films" && films) {
      return Object.entries(films)
        .filter(([, f]) => f.n > 0)
        .sort((a, b) => b[1].n - a[1].n || (a[1].t || "").localeCompare(b[1].t || ""))
        .map(([id, f]) => ({
          key: id, to: `/film/${f.g}`, thumb: f.c,
          name: f.t, sub: [f.d, f.y].filter(Boolean).join(" · "),
          count: f.n,
        }));
    }
    if (kind === "visitors" && celebs) {
      return Object.entries(celebs)
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([id, c]) => ({
          key: id, to: `/celeb/${id}`, thumb: null,
          name: c.name,
          sub: `${c.sessions} ${c.sessions === 1 ? "visit" : "visits"}`,
          count: c.picks,
        }));
    }
    if (people) {
      const field = kind === "directors" ? "directed" : "acted";
      const countField = kind === "directors" ? "directorPicks" : "actorPicks";
      return people
        .filter((p) => p[field] > 0 && p[countField] > 0)
        .sort((a, b) => b[countField] - a[countField] || a.name.localeCompare(b.name))
        .map((p) => ({
          key: p.slug, to: `/person/${p.slug}`, thumb: null,
          name: p.name,
          badge: kind === "actors" && p.directsOwn
            ? { icon: "🎬", label: "Also the director of a film they star in" }
            : null,
          sub: `${p[field]} ${p[field] === 1 ? "film" : "films"} in the collection`,
          count: p[countField],
        }));
    }
    return null;
  }, [kind, films, people, celebs]);

  const maxCount = useMemo(
    () => (rows ? rows.reduce((m, r) => Math.max(m, r.count), 0) : 0),
    [rows]
  );

  const visible = useMemo(() => {
    if (!rows || !hasControls || cap == null) return rows;
    return rows.filter((r) => r.count <= cap);
  }, [rows, hasControls, cap]);

  const { eyebrow, title } = TITLES[kind];
  if (!rows || !visible) return <Loading />;

  const effectiveCap = cap == null ? maxCount : cap;

  // visitors: an A–Z index; top 25 by picks on load, one letter at a time after
  if (kind === "visitors") {
    const present = new Set(visible.map((r) => indexLetter(r.name)));
    const showing = letter
      ? visible.filter((r) => indexLetter(r.name) === letter)
      : [...visible].sort((a, b) => b.count - a.count).slice(0, 25);
    return (
      <div className="page">
        <Section eyebrow={eyebrow} title={title}>
          <nav className="alpha-index" aria-label="Filter by letter">
            <button
              className={`alpha-letter${letter === null ? " active" : ""}`}
              onClick={() => setLetter(null)}
            >
              Top 25
            </button>
            {ALPHABET.map((l) => (
              <button
                key={l}
                className={`alpha-letter${letter === l ? " active" : ""}`}
                disabled={!present.has(l)}
                onClick={() => setLetter(l)}
              >
                {l}
              </button>
            ))}
          </nav>
          <div className="letter-group">
            <h3 className="display letter-head">
              {letter || "The Most Devoted"}
            </h3>
            <div className="ledger">
              {showing.map((r, i) => (
                <div
                  key={r.key}
                  className="ledger-row no-thumb"
                  onClick={() => navigate(r.to)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(r.to)}
                  role="link"
                  tabIndex={0}
                >
                  {letter ? (
                    <span className="rank" style={{ color: "var(--ink-faint)" }}>◆</span>
                  ) : (
                    <span className="rank">{i + 1}</span>
                  )}
                  <span className="who">
                    <span className="item-name">{r.name}</span>
                    {r.sub && <span className="sub"> {r.sub}</span>}
                  </span>
                  <span className="count">{r.count} {r.count === 1 ? "pick" : "picks"}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="page">
      <Section eyebrow={eyebrow} title={title}>
        {hasControls && (
          <div className="control-bar">
            <div className="control">
              <span className="control-label">
                Up to <b>{effectiveCap}</b> {effectiveCap === 1 ? "pick" : "picks"}
              </span>
              <input
                type="range"
                className="pick-slider"
                min={1}
                max={maxCount}
                value={effectiveCap}
                onChange={(e) => { setCap(Number(e.target.value)); setLimit(50); }}
                aria-label="Show only entries with this many picks or fewer"
              />
              <span className="control-hint">
                {visible.length.toLocaleString()} shown
              </span>
            </div>
          </div>
        )}
        <div className="bookcase">
          {visible.slice(0, limit).map((r, i) => (
            <div
              key={r.key}
              className="shelf-row"
              onClick={() => navigate(r.to)}
              onKeyDown={(e) => e.key === "Enter" && navigate(r.to)}
              role="link"
              tabIndex={0}
            >
              <div className="shelf-meta">
                <span className="rank">{i + 1}</span>
                {r.thumb && <img className="thumb" src={r.thumb} alt="" loading="lazy" />}
                <span className="who">
                  <span className="item-name">
                    {r.name}
                    {r.badge && (
                      <span
                        className="badge"
                        title={r.badge.label}
                        role="img"
                        aria-label={r.badge.label}
                      >
                        {" "}{r.badge.icon}
                      </span>
                    )}
                  </span>
                  {r.sub && <span className="sub">{r.sub}</span>}
                </span>
              </div>
              <div
                className="shelf-spines"
                aria-label={`${r.count} ${r.count === 1 ? "pick" : "picks"}`}
              >
                <Spines rowKey={r.key} count={r.count} />
                <span className="shelf-count">
                  {r.count} {r.count === 1 ? "pick" : "picks"}
                </span>
              </div>
            </div>
          ))}
        </div>
        {limit < visible.length && (
          <p className="mt-lg">
            <button className="btn" onClick={() => setLimit(limit + 100)}>
              Show more ({visible.length - limit} remaining)
            </button>
          </p>
        )}
      </Section>
    </div>
  );
}

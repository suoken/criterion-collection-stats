import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getFilmsIndex } from "../api.js";
import { Section, Loading } from "../components/shared.jsx";

const NO_YEAR = "Box Sets";

function decadeOf(film) {
  return film.y ? `${Math.floor(film.y / 10) * 10}s` : NO_YEAR;
}

export default function Decades() {
  const [films, setFilms] = useState(null);
  // selection lives in the URL so the back button restores it
  const [searchParams, setSearchParams] = useSearchParams();
  const decade = searchParams.get("d");
  const setDecade = (d) => setSearchParams({ d }, { replace: true });
  const navigate = useNavigate();

  useEffect(() => {
    getFilmsIndex().then(setFilms).catch(console.error);
  }, []);

  const decades = useMemo(() => {
    if (!films) return null;
    const groups = new Map();
    for (const f of Object.values(films)) {
      if (!f.n) continue; // picked films only
      const d = decadeOf(f);
      if (!groups.has(d)) groups.set(d, { decade: d, films: [], picks: 0 });
      const g = groups.get(d);
      g.films.push(f);
      g.picks += f.n;
    }
    for (const g of groups.values()) {
      g.films.sort((a, b) => b.n - a.n || (a.y || 0) - (b.y || 0) ||
        (a.t || "").localeCompare(b.t || ""));
    }
    return [...groups.values()].sort((a, b) => {
      if (a.decade === NO_YEAR) return 1;
      if (b.decade === NO_YEAR) return -1;
      return a.decade.localeCompare(b.decade);
    });
  }, [films]);

  if (!decades) return <Loading />;

  const selected =
    decades.find((g) => g.decade === decade) ||
    // default to the most-picked-from decade
    [...decades].sort((a, b) => b.films.length - a.films.length)[0];

  return (
    <div className="page">
      <Section eyebrow="Through the Years" title="Picks by Decade">
        <nav className="alpha-index" aria-label="Filter by decade">
          {decades.map((g) => (
            <button
              key={g.decade}
              className={`alpha-letter decade-btn${selected.decade === g.decade ? " active" : ""}`}
              onClick={() => setDecade(g.decade)}
            >
              {g.decade}
              <span className="decade-count">{g.films.length}</span>
            </button>
          ))}
        </nav>
        <div className="letter-group">
          <h3 className="display letter-head">{selected.decade}</h3>
          <p className="center decade-summary">
            <span className="eyebrow">
              <b>{selected.films.length}</b>{" "}
              {selected.films.length === 1 ? "film" : "films"} picked ·{" "}
              <b>{selected.picks}</b> {selected.picks === 1 ? "pick" : "picks"} in total
            </span>
          </p>
          <div className="ledger" style={{ maxWidth: 720, margin: "0 auto" }}>
            {selected.films.map((f, i) => (
              <div
                key={f.g}
                className="ledger-row"
                onClick={() => navigate(`/film/${f.g}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/film/${f.g}`)}
                role="link"
                tabIndex={0}
              >
                <span className="rank">{i + 1}</span>
                {f.c ? (
                  <img className="thumb" src={f.c} alt="" loading="lazy" />
                ) : (
                  <span className="rank" style={{ color: "var(--gold)" }}>◆</span>
                )}
                <span className="who">
                  <span className="smallcaps-name">{f.t}</span>
                  <span className="sub">
                    {" "}{[f.d, f.y].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="count">{f.n} {f.n === 1 ? "pick" : "picks"}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

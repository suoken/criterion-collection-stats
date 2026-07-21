import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getFilmsIndex } from "../api.js";
import { Section, Loading } from "../components/shared.jsx";

const NO_COUNTRY = "Other";

export default function Countries() {
  const [films, setFilms] = useState(null);
  // selection lives in the URL so the back button restores it
  const [searchParams, setSearchParams] = useSearchParams();
  const country = searchParams.get("c");
  const setCountry = (c) => setSearchParams({ c }, { replace: true });
  const navigate = useNavigate();

  useEffect(() => {
    getFilmsIndex().then(setFilms).catch(console.error);
  }, []);

  const countries = useMemo(() => {
    if (!films) return null;
    const groups = new Map();
    for (const f of Object.values(films)) {
      if (!f.n) continue; // picked films only
      // co-productions are stored comma-joined ("United States, Germany"):
      // count the film under each of its countries
      const list = (f.k || "").split(/,\s*/).filter(Boolean);
      for (const c of list.length ? list : [NO_COUNTRY]) {
        if (!groups.has(c)) groups.set(c, { country: c, films: [], picks: 0 });
        const g = groups.get(c);
        g.films.push(f);
        g.picks += f.n;
      }
    }
    for (const g of groups.values()) {
      g.films.sort((a, b) => b.n - a.n || (a.t || "").localeCompare(b.t || ""));
    }
    // alphabetical by name; the no-country bucket last
    return [...groups.values()].sort((a, b) => {
      if (a.country === NO_COUNTRY) return 1;
      if (b.country === NO_COUNTRY) return -1;
      return a.country.localeCompare(b.country);
    });
  }, [films]);

  if (!countries) return <Loading />;

  const selected =
    countries.find((g) => g.country === country) ||
    // default to the most-picked-from country (United States)
    [...countries].sort((a, b) => b.films.length - a.films.length)[0];

  return (
    <div className="page">
      <Section eyebrow="From Around the World" title="Picks by Country">
        <nav className="alpha-index" aria-label="Filter by country">
          {countries.map((g) => (
            <button
              key={g.country}
              className={`alpha-letter decade-btn${selected.country === g.country ? " active" : ""}`}
              onClick={() => setCountry(g.country)}
            >
              {g.country}
              <span className="decade-count">{g.films.length}</span>
            </button>
          ))}
        </nav>
        <div className="letter-group">
          <h3 className="display letter-head">{selected.country}</h3>
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

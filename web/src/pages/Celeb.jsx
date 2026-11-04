import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatDate, getCeleb, getFilmsIndex } from "../api.js";
import { lookupHeadshot } from "../imdb.js";
import { Section, Billed, Loading } from "../components/shared.jsx";

export default function Celeb() {
  const { id } = useParams();
  const [celeb, setCeleb] = useState(null);
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(false);
  const [headshot, setHeadshot] = useState(null);

  useEffect(() => {
    setCeleb(null);
    setError(false);
    Promise.all([getCeleb(id), getFilmsIndex()])
      .then(([c, idx]) => { setCeleb(c); setIndex(idx); })
      .catch(() => setError(true));
  }, [id]);

  useEffect(() => {
    setHeadshot(null);
    if (!celeb?.name) return;
    let live = true;
    lookupHeadshot(celeb.name).then((h) => { if (live) setHeadshot(h); });
    return () => { live = false; };
  }, [celeb?.name]);

  if (!celeb || !index) return <Loading error={error} />;

  const totalPicks = celeb.sessions.reduce((n, s) => n + s.picks.length, 0);

  return (
    <div className="page">
      <section className="section">
        <span className="eyebrow">Closet Visitor</span>
        <h2 className="display" style={{ fontSize: "clamp(34px, 6vw, 64px)", margin: "10px 0" }}>
          {celeb.name}
        </h2>
        {headshot?.img && (
          <a
            className="person-headshot"
            href={`https://www.imdb.com/name/${headshot.imdbId}/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={headshot.img} alt={`Photo of ${celeb.name}`} />
          </a>
        )}
        {headshot?.imdbId && (
          <p className="imdb-link-row">
            <a
              className="imdb-link"
              href={`https://www.imdb.com/name/${headshot.imdbId}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on IMDb ↗
            </a>
          </p>
        )}
        <p className="quote" style={{ fontSize: 19 }}>
          “{totalPicks} {totalPicks === 1 ? "pick" : "picks"} across{" "}
          {celeb.sessions.length} {celeb.sessions.length === 1 ? "visit" : "visits"}.”
        </p>
      </section>

      {celeb.sessions.map((s) => (
        <Section
          key={s.id}
          eyebrow={formatDate(s.date)}
          title={s.with.length ? `With ${s.with.map((w) => w.name).join(" & ")}` : "The Visit"}
        >
          {s.description && (
            <p style={{ maxWidth: 640, margin: "0 0 20px", fontStyle: "italic" }}>
              {s.description}
            </p>
          )}
          <div className="action-row" style={{ marginBottom: 30 }}>
            <a className="btn solid" href={s.url} target="_blank" rel="noopener noreferrer">
              ▶ Watch on Criterion
            </a>
            {s.with.map((w) => (
              <Link key={w.id} className="btn" to={`/celeb/${w.id}`}>
                {w.name}
              </Link>
            ))}
          </div>
          <div className="billing-strip">
            {s.picks
              .map((fid) => ({ fid, f: index[String(fid)] }))
              .filter((x) => x.f)
              .map(({ fid, f }) => (
                <Billed
                  key={fid}
                  name={f.t}
                  image={f.c}
                  to={`/film/${f.g}`}
                  tally={f.n}
                  tallyLabel="picks"
                />
              ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

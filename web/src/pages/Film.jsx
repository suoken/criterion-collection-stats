import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDate, getFilm, getFilmsIndex } from "../api.js";
import { lookupFilmTitle } from "../imdb.js";
import { Section, Billed, Loading } from "../components/shared.jsx";

// Order the classic head credits first, everything else after.
const CREDIT_ORDER = [
  "director", "produced by", "producer", "written by", "writer", "screenplay",
  "story", "director of photography", "cinematograph", "camera", "edited by",
  "editor", "music", "composer", "production design", "art direction",
];
function creditRank(role) {
  // longest matching prefix wins, so "Director of photography" doesn't
  // rank as "Director"
  let best = CREDIT_ORDER.length;
  let bestLen = 0;
  const lower = role.toLowerCase();
  CREDIT_ORDER.forEach((r, i) => {
    if (lower.startsWith(r) && r.length > bestLen) { best = i; bestLen = r.length; }
  });
  return best;
}

export default function Film() {
  const { slug } = useParams();
  const [film, setFilm] = useState(null);
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(false);
  const [imdbTitle, setImdbTitle] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setFilm(null);
    setError(false);
    Promise.all([getFilm(slug), getFilmsIndex()])
      .then(([f, idx]) => { setFilm(f); setIndex(idx); })
      .catch(async () => {
        // legacy numeric URLs: /film/28561 → /film/all-that-jazz
        if (/^\d+$/.test(slug)) {
          try {
            const idx = await getFilmsIndex();
            if (idx[slug]?.g) {
              navigate(`/film/${idx[slug].g}`, { replace: true });
              return;
            }
          } catch { /* fall through to error */ }
        }
        setError(true);
      });
  }, [slug, navigate]);

  useEffect(() => {
    setImdbTitle(null);
    // box sets aren't titles on IMDb/Letterboxd — always use the search link
    if (!film?.title || film.boxset) return;
    let live = true;
    lookupFilmTitle(film.title, film.year).then((t) => { if (live) setImdbTitle(t); });
    return () => { live = false; };
  }, [film?.title, film?.year, film?.boxset]);

  if (!film || !index) return <Loading error={error} />;

  const credits = [...film.credits].sort((a, b) => creditRank(a.role) - creditRank(b.role));
  const groupedCredits = [];
  for (const c of credits) {
    const g = groupedCredits.find((x) => x.role === c.role);
    if (g) g.people.push(c);
    else groupedCredits.push({ role: c.role, people: [c] });
  }

  const filmStrip = (ids) =>
    ids
      .map((fid) => ({ fid, f: index[String(fid)] }))
      .filter((x) => x.f)
      .map(({ fid, f }) => (
        <Billed
          key={fid}
          name={f.t}
          image={f.c}
          to={`/film/${f.g}`}
          tally={f.n || 0}
          tallyLabel={f.n === 1 ? "pick" : "picks"}
        />
      ));

  return (
    <div className="page">
      <section className="section film-hero">
        <div>
          <div className="cover">
            {film.cover && <img src={film.cover} alt={`Cover of ${film.title}`} />}
          </div>
          <div className="action-row">
            <a className="btn solid" href={film.url} target="_blank" rel="noopener noreferrer">
              View on Criterion
            </a>
            <a
              className="btn"
              href={imdbTitle
                ? `https://letterboxd.com/imdb/${imdbTitle.imdbId}/`
                : `https://letterboxd.com/search/films/${encodeURIComponent(film.title || "")}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Letterboxd
            </a>
          </div>
        </div>
        <div>
          <span className="eyebrow">
            {film.boxset ? "A Criterion Box Set" : "A Criterion Picture"}
          </span>
          <h2 className="display" style={{ margin: "8px 0 0" }}>{film.title}</h2>
          <div className="meta-line">
            {film.year && <span className="eyebrow"><b>{film.year}</b></span>}
            {film.country && <span className="eyebrow">{film.country}</span>}
            {film.duration && <span className="eyebrow">{film.duration} min</span>}
            {film.spine && <span className="eyebrow">Spine #{film.spine}</span>}
          </div>
          {film.directors.length > 0 && (
            <p className="byline">
              Directed by{" "}
              {film.directors.map((d, i) => (
                <span key={d.slug}>
                  {i > 0 && " & "}
                  <Link to={`/person/${d.slug}`}>{d.name}</Link>
                </span>
              ))}
            </p>
          )}
          {film.description && <p className="description">{film.description}</p>}

          {film.pickedBy.length > 0 && (
            <>
              <p className="eyebrow" style={{ margin: "26px 0 10px" }}>
                Pulled from the closet {film.pickedBy.length}{" "}
                {film.pickedBy.length === 1 ? "time" : "times"} by
              </p>
              <div className="chip-row">
                {/* one chip per visit — joint visits share a chip so the
                    chip count matches the "pulled N times" figure. The whole
                    pill is tappable (goes to the first visitor); names inside
                    joint pills still link to their own visitor. */}
                {film.pickedBy.map((p) => (
                  <span
                    key={p.session}
                    className="chip"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/celeb/${p.celebs[0].id}`)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/celeb/${p.celebs[0].id}`)}
                  >
                    {p.celebs.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 && " & "}
                        <Link
                          to={`/celeb/${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.name}
                        </Link>
                      </span>
                    ))}
                    <span className="date">{formatDate(p.date)}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {film.cast.length > 0 && (
        <Section eyebrow="Starring" title="The Cast">
          <div className="cast-list">
            {film.cast.map((c, i) => (
              <div className="cast-pair" key={i}>
                {c.slug ? (
                  <Link className="item-name" to={`/person/${c.slug}`}>{c.actor}</Link>
                ) : (
                  <span className="item-name" style={{ color: "var(--ink)" }}>{c.actor}</span>
                )}
                {c.role && <span className="role">{c.role}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {groupedCredits.length > 0 && (
        <Section eyebrow="The Credits" title="Made By">
          <div className="billing-block">
            {groupedCredits.map((g) => (
              <div className="credit-line" key={g.role}>
                <span className="credit-role">{g.role}</span>
                {g.people.map((p, i) => (
                  <span key={i}>
                    {i > 0 && <span className="credit-name"> · </span>}
                    {p.slug ? (
                      <Link className="credit-name" to={`/person/${p.slug}`}>{p.person}</Link>
                    ) : (
                      <span className="credit-name">{p.person}</span>
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      {film.setFilms.length > 0 && (
        <Section eyebrow="In This Box" title="Films in the Set">
          <div className="billing-strip">{filmStrip(film.setFilms)}</div>
        </Section>
      )}

      {film.related.length > 0 && (
        <Section eyebrow="If You Liked This" title="Related Films">
          <div className="billing-strip">{filmStrip(film.related)}</div>
        </Section>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFilmsIndex, getPerson } from "../api.js";
import { lookupHeadshot } from "../imdb.js";
import { Section, Billed, Loading } from "../components/shared.jsx";

export default function Person() {
  const { slug } = useParams();
  const [person, setPerson] = useState(null);
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(false);
  const [headshot, setHeadshot] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setPerson(null);
    setError(false);
    Promise.all([getPerson(slug), getFilmsIndex()])
      .then(([p, idx]) => { setPerson(p); setIndex(idx); })
      .catch(() => setError(true));
  }, [slug]);

  useEffect(() => {
    setHeadshot(null);
    if (!person?.name) return;
    let live = true;
    lookupHeadshot(person.name).then((h) => { if (live) setHeadshot(h); });
    return () => { live = false; };
  }, [person?.name]);

  if (!person || !index) return <Loading error={error} />;

  const strip = (ids) =>
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
          tallyLabel="picks"
        />
      ));

  const roles = [
    person.directed.length && "Director",
    person.acted.length && "Actor",
  ].filter(Boolean).join(" · ");

  return (
    <div className="page">
      <section className="section">
        <span className="eyebrow">{roles} in the Collection</span>
        <h2 className="display" style={{ fontSize: "clamp(34px, 6vw, 64px)", margin: "10px 0" }}>
          {person.name}
        </h2>
        {headshot?.img && (
          <a
            className="person-headshot"
            href={`https://www.imdb.com/name/${headshot.imdbId}/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={headshot.img} alt={`Photo of ${person.name}`} />
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
          {person.directorPicks > 0 && (
            <>“Picked {person.directorPicks} {person.directorPicks === 1 ? "time" : "times"} as director.”</>
          )}
          {person.directorPicks > 0 && person.actorPicks > 0 && <br />}
          {person.actorPicks > 0 && (
            <>“On screen in {person.actorPicks} {person.actorPicks === 1 ? "pick" : "picks"}.”</>
          )}
        </p>
      </section>

      {person.directed.length > 0 && (
        <Section eyebrow="Behind the Camera" title="Films They Directed">
          <div className="billing-strip">{strip(person.directed)}</div>
        </Section>
      )}

      {person.acted.length > 0 && (
        <Section eyebrow="On the Screen" title="Films They Appear In">
          <div className="billing-strip">{strip(person.acted)}</div>
        </Section>
      )}

      {person.pickedBy.length > 0 && (
        <Section eyebrow="Their Admirers" title="Picked By">
          <div className="chip-row">
            {person.pickedBy.map((c) => (
              <button key={c.id} className="chip" onClick={() => navigate(`/celeb/${c.id}`)}>
                {c.name}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStats, formatDate } from "../api.js";
import { Section, Billed, Bars, Loading } from "../components/shared.jsx";

export default function Home() {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) return <Loading />;

  const champion = stats.topFilms[0];
  const { fun } = stats;

  return (
    <div className="page">
      {/* marquee: the most-picked film */}
      <section className="section">
        <div className="marquee">
          <div className="marquee-grid">
            <Billed
              name={`${champion.title}`}
              image={champion.cover}
              to={`/film/${champion.slug}`}
              tall
            />
            <div>
              <span className="eyebrow">Top Billing · The Most-Pulled Film</span>
              <h2 className="display" style={{ margin: "10px 0" }}>
                <Link to={`/film/${champion.slug}`}>{champion.title}</Link>
              </h2>
              <p className="quote">
                “Pulled off the closet shelf {champion.picks} times.”
              </p>
              {(champion.director || champion.year) && (
                <p className="byline">
                  {[champion.director, champion.year].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* the billing strip of most-picked films */}
      <Section eyebrow="Featuring" title="The Most Picked Films">
        <div className="billing-strip">
          {stats.topFilms.slice(0, 12).map((f) => (
            <Billed
              key={f.id}
              name={f.title}
              image={f.cover}
              to={`/film/${f.slug}`}
              tally={f.picks}
              tallyLabel="picks"
              tall
            />
          ))}
        </div>
        <p className="center mt-lg">
          <Link className="btn" to="/films">See the full program</Link>
        </p>
      </Section>

      {/* directors + actors strips */}
      <Section eyebrow="Above the Title" title="House Favorite Directors">
        <div className="billing-strip">
          {stats.topDirectors.slice(0, 6).map((d) => (
            <Billed
              key={d.slug}
              name={d.name}
              image={d.topFilm?.cover}
              to={`/person/${d.slug}`}
              tally={d.picks}
              tallyLabel="picks"
              alt={`${d.name} — cover of ${d.topFilm?.title}`}
            />
          ))}
        </div>
        <p className="center mt-lg">
          <Link className="btn" to="/directors">All directors</Link>
        </p>
      </Section>

      <Section eyebrow="The Familiar Faces" title="Most Picked Actors">
        <div className="billing-strip">
          {stats.topActors.slice(0, 6).map((a) => (
            <Billed
              key={a.slug}
              name={a.name}
              image={a.topFilm?.cover}
              to={`/person/${a.slug}`}
              tally={a.picks}
              tallyLabel="picks"
              alt={`${a.name} — cover of ${a.topFilm?.title}`}
            />
          ))}
        </div>
        <p className="center mt-lg">
          <Link className="btn" to="/actors">All actors</Link>
        </p>
      </Section>

      {/* fun stats cards */}
      <Section eyebrow="Intermission" title="Fun &amp; Facts">
        <div className="card-grid">
          <div className="stat-card">
            <span className="eyebrow">The Marathon Visit</span>
            <div className="big">{fun.marathon.picks}</div>
            <p>
              films pulled in one visit by{" "}
              {fun.marathon.celebs.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && " & "}
                  <Link to={`/celeb/${c.id}`}>{c.name}</Link>
                </span>
              ))}{" "}
              on {formatDate(fun.marathon.date)}.
            </p>
          </div>

          <div className="stat-card">
            <span className="eyebrow">Deep Cuts</span>
            <div className="big">{stats.counts.pickedOnce.toLocaleString()}</div>
            <p>
              films have been picked exactly once — one star’s personal
              treasure, nobody else’s.
            </p>
          </div>

          {fun.oldest && (
            <div className="stat-card">
              <span className="eyebrow">The Oldest Pick</span>
              <div className="big">{fun.oldest.year}</div>
              <p>
                <Link to={`/film/${fun.oldest.slug}`}>{fun.oldest.title}</Link>
                {" "}— still getting pulled off the shelf a century later.
              </p>
            </div>
          )}

          {fun.longest && (
            <div className="stat-card">
              <span className="eyebrow">The Longest Sit</span>
              <div className="big">
                {Math.floor(fun.longest.duration / 60)}h {fun.longest.duration % 60}m
              </div>
              <p>
                <Link to={`/film/${fun.longest.slug}`}>{fun.longest.title}</Link>
                {" "}— somebody picked it, so somebody watched it.
              </p>
            </div>
          )}

          {fun.repeatVisitors.length > 0 && (
            <div className="stat-card">
              <span className="eyebrow">Repeat Customers</span>
              <div className="big">{fun.repeatVisitors.length}</div>
              <p>
                stars came back for another visit — led by{" "}
                <Link to={`/celeb/${fun.repeatVisitors[0].id}`}>
                  {fun.repeatVisitors[0].name}
                </Link>{" "}
                with {fun.repeatVisitors[0].visits} trips to the closet.
              </p>
            </div>
          )}

          {fun.selfPicks.length > 0 && (
            <div className="stat-card">
              <span className="eyebrow">Picked Their Own Picture</span>
              <div className="big">{fun.selfPicks.length}</div>
              <p>
                times a visitor pulled a film they made themselves —{" "}
                {fun.selfPicks.slice(0, 2).map((s, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <Link to={`/celeb/${s.celebId}`}>{s.celeb}</Link> took home{" "}
                    <Link to={`/film/${s.film.slug}`}>{s.film.title}</Link>
                  </span>
                ))}
                .
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* directors' circle */}
      {fun.directorsCircle.length > 0 && (
        <Section eyebrow="Both Sides of the Camera" title="The Directors’ Circle">
          <p className="center" style={{ maxWidth: 620, margin: "0 auto 26px" }}>
            These filmmakers have visited the closet as guests — and had their
            own films picked by other visitors.
          </p>
          <div className="chip-row" style={{ justifyContent: "center" }}>
            {fun.directorsCircle.map((d) => (
              <button
                key={d.slug}
                className="chip"
                onClick={() => navigate(`/person/${d.slug}`)}
              >
                {d.name} <span className="date">{d.picks} picks</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* charts */}
      <Section eyebrow="The Numbers" title="Picks by Decade of Film">
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Bars
            data={stats.decades.map((d) => ({ label: d.decade, value: d.picks }))}
          />
        </div>
      </Section>

      <Section eyebrow="A Growing Tradition" title="Picks per Year of Visit">
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Bars
            alt
            data={stats.timeline.map((t) => ({ label: t.year, value: t.picks }))}
          />
        </div>
      </Section>

      <Section eyebrow="From Around the World" title="Where the Picks Come From">
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Bars
            data={stats.countries.map((c) => ({ label: c.country, value: c.picks }))}
          />
        </div>
      </Section>
    </div>
  );
}

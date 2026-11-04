import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStats } from "../api.js";
import { Section, Billed, Loading } from "../components/shared.jsx";

// Spine heights, as a share of the shelf, so the row reads as real cases.
const SPINE_HEIGHTS = [100, 94, 97, 91, 100, 96, 92, 99, 95, 100, 93, 98];

function Shelf({ films }) {
  return (
    <div className="shelf" aria-hidden="true">
      {films.filter((f) => f.cover).map((f, i) => (
        <span
          key={f.id}
          className="shelf-spine"
          style={{
            height: `${SPINE_HEIGHTS[i % SPINE_HEIGHTS.length]}%`,
            backgroundImage: `url("${f.cover}")`,
          }}
        />
      ))}
    </div>
  );
}

function RankList({ title, people, more }) {
  return (
    <Section title={title} sub="Picks across their films">
      <ol className="rank-list">
        {people.map((p) => (
          <li key={p.slug}>
            <Link to={`/person/${p.slug}`}>
              <span>{p.name}</span>
              <span className="n">{p.picks}</span>
            </Link>
          </li>
        ))}
      </ol>
      <Link className="more" to={more.to}>{more.label} →</Link>
    </Section>
  );
}

export default function Home() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) return <Loading />;

  return (
    <div className="page">
      <section className="hero band">
        <div className="hero-text">
          <span className="eyebrow">Off the beaten path</span>
          <h2 className="hero-title">
            <span>{stats.counts.pickedOnce.toLocaleString()} films.</span>{" "}
            <span>One pick each.</span>
          </h2>
          <p className="hero-sub">
            The personal favorites hiding beyond the most-picked lists.
          </p>
          <Link className="more" to="/films?max=1">Discover films picked just once →</Link>
        </div>
        <Shelf films={stats.topFilms} />
      </section>

      <Section title="The most-picked films" more={{ to: "/films", label: "View all films" }}>
        <div className="billing-strip one-row">
          {stats.topFilms.slice(0, 5).map((f) => (
            <Billed
              key={f.id}
              name={f.title}
              image={f.cover}
              to={`/film/${f.slug}`}
              tally={f.picks}
              tallyLabel="picks"
              cta="See who picked it"
            />
          ))}
        </div>
      </Section>

      <div className="split">
        <RankList
          title="Favorite directors"
          people={stats.topDirectors.slice(0, 5)}
          more={{ to: "/directors", label: "All directors" }}
        />
        <RankList
          title="Most-picked actors"
          people={stats.topActors.slice(0, 5)}
          more={{ to: "/actors", label: "All actors" }}
        />
      </div>

      <section className="curiosity band">
        <div>
          <h2 className="curiosity-title">Follow your curiosity</h2>
          <p className="section-sub">Find the eras and places visitors return to.</p>
        </div>
        <div className="curiosity-links">
          <Link className="more" to="/decades">Explore by decade →</Link>
          <Link className="more" to="/countries">Explore by country →</Link>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { getStats } from "./api.js";
import SearchBox from "./components/SearchBox.jsx";
import Home from "./pages/Home.jsx";
import Countries from "./pages/Countries.jsx";
import Decades from "./pages/Decades.jsx";
import Film from "./pages/Film.jsx";
import Person from "./pages/Person.jsx";
import Celeb from "./pages/Celeb.jsx";
import Browse from "./pages/Browse.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    getStats().then(setStats).catch(console.error);
  }, []);

  return (
    <>
      <ScrollToTop />
      <header className="site-header container">
        <div className="presents">
          <span className="eyebrow">The Criterion Collection Presents</span>
        </div>
        <h1 className="display site-title">
          <NavLink to="/">The Closet Picks</NavLink>
        </h1>
        {stats && (
          <div className="site-sub">
            <span className="stat-bit eyebrow"><b>{stats.counts.sessions}</b> closet visits</span>
            <span className="stat-bit eyebrow"><b>{stats.counts.totalPicks.toLocaleString()}</b> picks</span>
            <span className="stat-bit eyebrow"><b>{stats.counts.filmsPicked.toLocaleString()}</b> films</span>
            <span className="stat-bit eyebrow"><b>{stats.counts.celebrities}</b> stars</span>
          </div>
        )}
        <nav className="site-nav">
          <ul>
            <li><NavLink to="/" end>Marquee</NavLink></li>
            <li><NavLink to="/films">Films</NavLink></li>
            <li><NavLink to="/directors">Directors</NavLink></li>
            <li><NavLink to="/actors">Actors</NavLink></li>
            <li><NavLink to="/decades">Decades</NavLink></li>
            <li><NavLink to="/countries">Countries</NavLink></li>
            <li><NavLink to="/visitors">Visitors</NavLink></li>
          </ul>
        </nav>
        <div className="mt-lg">
          <SearchBox />
        </div>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/films" element={<Browse kind="films" />} />
          <Route path="/directors" element={<Browse kind="directors" />} />
          <Route path="/actors" element={<Browse kind="actors" />} />
          <Route path="/visitors" element={<Browse kind="visitors" />} />
          <Route path="/decades" element={<Decades />} />
          <Route path="/countries" element={<Countries />} />
          <Route path="/film/:slug" element={<Film />} />
          <Route path="/person/:slug" element={<Person />} />
          <Route path="/celeb/:id" element={<Celeb />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <div className="diamond-rule"><span>◆</span></div>
        <p className="eyebrow" style={{ marginTop: 16 }}>A Statistical Picture</p>
        <p>
          Every film links back to its page at criterion.com. Data gathered from
          the Criterion Collection’s Closet Picks archive. This is a fan project,
          not affiliated with the Criterion Collection.
        </p>
      </footer>
    </>
  );
}

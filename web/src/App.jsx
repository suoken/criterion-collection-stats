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
  // Braces matter: an implicit return would hand scrollTo's return value to
  // React as the effect cleanup, which crashes the whole tree ("destroy is
  // not a function") in browsers where an extension patches scrollTo.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
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
        <div className="masthead">
          <NavLink to="/" className="logo">Closet Picks</NavLink>
          <span className="tagline eyebrow">An independent Criterion Closet archive</span>
        </div>
        <div className="navbar">
          <nav className="site-nav">
            <ul>
              <li><NavLink to="/" end>Discover</NavLink></li>
              <li><NavLink to="/films">Films</NavLink></li>
              <li><NavLink to="/directors">Directors</NavLink></li>
              <li><NavLink to="/actors">Actors</NavLink></li>
              <li><NavLink to="/visitors">Visitors</NavLink></li>
            </ul>
          </nav>
          <SearchBox />
        </div>
        {stats && (
          <p className="site-stats">
            {stats.counts.sessions} visits / {stats.counts.totalPicks.toLocaleString()} picks
            {" / "}{stats.counts.filmsPicked.toLocaleString()} films
          </p>
        )}
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

      <footer className="site-footer container">
        <p>A fan-made archive. Not affiliated with the Criterion Collection.</p>
      </footer>
    </>
  );
}

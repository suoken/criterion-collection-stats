import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCelebsIndex, getFilmsIndex, getPeopleIndex } from "../api.js";

// One flat searchable list of films, people, and celebrities.
export default function SearchBox() {
  const [entries, setEntries] = useState(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getFilmsIndex(), getPeopleIndex(), getCelebsIndex()]).then(
      ([films, people, celebs]) => {
        const list = [];
        for (const f of Object.values(films)) {
          list.push({ kind: f.b ? "Box Set" : "Film", label: f.t, sub: f.y,
            weight: f.n, to: `/film/${f.g}` });
        }
        for (const p of people) {
          const kind = p.directed && p.acted ? "Director · Actor"
            : p.directed ? "Director" : "Actor";
          list.push({ kind, label: p.name, sub: null,
            weight: p.directorPicks + p.actorPicks,
            to: `/person/${p.slug}` });
        }
        for (const [id, c] of Object.entries(celebs)) {
          list.push({ kind: "Closet Visitor", label: c.name, sub: null,
            weight: c.picks + 50, to: `/celeb/${id}` });
        }
        setEntries(list);
      }
    );
  }, []);

  useEffect(() => {
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = useMemo(() => {
    if (!entries || q.trim().length < 2) return [];
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => e.label && e.label.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(needle) ? 1 : 0;
        const bStarts = b.label.toLowerCase().startsWith(needle) ? 1 : 0;
        return bStarts - aStarts || (b.weight || 0) - (a.weight || 0);
      })
      .slice(0, 12);
  }, [entries, q]);

  const go = (to) => {
    setQ("");
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="search-wrap" ref={wrapRef}>
      <input
        className="search-input"
        type="search"
        placeholder="Search a film, director, actor, or star…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        aria-label="Search films, directors, actors, and closet visitors"
      />
      {open && results.length > 0 && (
        <div className="search-results" role="listbox">
          {results.map((r) => (
            <button key={r.to + r.label} className="result" onClick={() => go(r.to)}>
              <span>{r.label}{r.sub ? ` (${r.sub})` : ""}</span>
              <span className="kind">{r.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

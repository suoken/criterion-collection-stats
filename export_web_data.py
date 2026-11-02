#!/usr/bin/env python3
"""Export criterion.db into JSON chunks consumed by the web frontend.

Outputs (under web/public/data/):
  stats.json        aggregates + fun stats for the home page
  films.json        light index of every film (search / rendering id lists)
  celebs.json       light index of every celebrity
  people.json       light index of directors + actors with pick counts
  film/{id}.json    full film detail (cast, credits, picked-by, related)
  person/{slug}.json person detail (films as director / actor, who picked)
  celeb/{id}.json   celebrity detail (sessions + picks)
"""
import json
import os
import re
import shutil
import sqlite3
import unicodedata
from collections import Counter, defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "web", "public", "data")


def slugify(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "x"


def dump(path, obj):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def main():
    con = sqlite3.connect(os.path.join(BASE, "criterion.db"))
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    films = {r["id"]: dict(r) for r in cur.execute("SELECT * FROM films")}

    # URL slugs from criterion.com's own paths (/films/28561-all-that-jazz).
    # Criterion reuses trailing slugs across remakes, so collisions get the
    # year (or the numeric id) appended.
    def url_slug(f):
        m = re.search(r"/(?:films|boxsets)/\d+-([^/?#]+)", f["url"] or "")
        return m.group(1) if m else None

    film_slug = {}
    used_slugs = set()
    grouped = defaultdict(list)
    for fid, f in films.items():
        grouped[url_slug(f) or str(fid)].append(fid)
    for slug, ids in grouped.items():
        for fid in sorted(ids):
            candidate = slug
            if candidate in used_slugs and films[fid]["is_boxset"]:
                candidate = f"{slug}-set"
            if candidate in used_slugs and films[fid]["year"]:
                candidate = f"{slug}-{films[fid]['year']}"
            if candidate in used_slugs:
                candidate = f"{slug}-{fid}"
            used_slugs.add(candidate)
            film_slug[fid] = candidate
    sessions = {r["id"]: dict(r) for r in cur.execute("SELECT * FROM sessions")}
    celebs = {r["id"]: dict(r) for r in cur.execute("SELECT * FROM celebrities")}

    sess_celebs = defaultdict(list)   # session -> [celeb ids]
    celeb_sessions = defaultdict(list)
    for r in cur.execute("SELECT * FROM session_celebrities"):
        sess_celebs[r["session_id"]].append(r["celebrity_id"])
        celeb_sessions[r["celebrity_id"]].append(r["session_id"])

    picks_by_film = defaultdict(list)   # film -> [session ids]
    picks_by_session = defaultdict(list)
    for r in cur.execute("SELECT * FROM picks ORDER BY session_id, position"):
        picks_by_film[r["film_id"]].append(r["session_id"])
        picks_by_session[r["session_id"]].append(r["film_id"])

    cast_by_film = defaultdict(list)
    films_by_actor = defaultdict(list)
    for r in cur.execute("SELECT * FROM film_cast ORDER BY film_id, position"):
        cast_by_film[r["film_id"]].append({"actor": r["actor"], "role": r["role"]})
        films_by_actor[r["actor"]].append(r["film_id"])

    credits_by_film = defaultdict(list)
    films_by_director = defaultdict(list)
    for r in cur.execute("SELECT * FROM film_credits ORDER BY film_id, position"):
        credits_by_film[r["film_id"]].append(
            {"role": r["credit_role"], "person": r["person"]})
        if r["credit_role"].lower() == "director":
            films_by_director[r["person"]].append(r["film_id"])

    # Fall back to the director string on films that lack a credits block
    # (e.g. boxsets, films never scraped in detail).
    for fid, f in films.items():
        if fid not in {i for ids in films_by_director.values() for i in ids}:
            pass  # handled below via films.director in person pages only
    director_of = {}
    for name, ids in films_by_director.items():
        for i in ids:
            director_of.setdefault(i, []).append(name)
    for fid, f in films.items():
        if fid not in director_of and f["director"]:
            for name in re.split(r",\s*|\s+and\s+", f["director"]):
                if name.strip():
                    films_by_director[name.strip()].append(fid)
                    director_of.setdefault(fid, []).append(name.strip())

    related = defaultdict(list)
    for r in cur.execute("SELECT * FROM related_films"):
        related[r["film_id"]].append(r["related_film_id"])

    boxset_members = defaultdict(list)
    member_of = defaultdict(list)
    for r in cur.execute("SELECT * FROM boxset_films ORDER BY boxset_id, position"):
        boxset_members[r["boxset_id"]].append(r["film_id"])
        member_of[r["film_id"]].append(r["boxset_id"])

    # ---- derived counts ----
    film_pick_count = {fid: len(s) for fid, s in picks_by_film.items()}

    def picks_of_films(ids):
        """Distinct sessions that picked any of these films."""
        out = set()
        for i in ids:
            out.update(picks_by_film.get(i, []))
        return out

    director_sessions = {name: picks_of_films(ids)
                         for name, ids in films_by_director.items()}
    actor_sessions = {name: picks_of_films(ids)
                      for name, ids in films_by_actor.items()}

    def total_picks(ids):
        """Total times any of these films was picked. A visit that pulls two
        of a director's films counts twice — it must match the sum of the
        per-film tallies shown on screen."""
        return sum(film_pick_count.get(i, 0) for i in ids)

    # ---- light indexes ----
    films_index = {
        str(fid): {
            "t": f["title"], "y": f["year"], "d": f["director"],
            "c": f["cover_url"], "u": f["url"], "n": film_pick_count.get(fid, 0),
            "b": f["is_boxset"], "s": f["spine_number"], "g": film_slug[fid],
            "k": f["country"],
        }
        for fid, f in films.items()
    }
    dump("films.json", films_index)

    celebs_index = {
        str(cid): {
            "name": c["name"],
            "sessions": len(celeb_sessions[cid]),
            "picks": sum(len(picks_by_session[s]) for s in celeb_sessions[cid]),
        }
        for cid, c in celebs.items()
    }
    dump("celebs.json", celebs_index)

    # directorPicks / actorPicks are kept separate: a leaderboard of directors
    # must not inflate someone's count with films they merely acted in.
    people = {}

    def person_entry(name):
        return people.setdefault(name, {
            "name": name, "slug": slugify(name),
            "directed": 0, "acted": 0, "directorPicks": 0, "actorPicks": 0,
        })

    for name, ids in films_by_director.items():
        p = person_entry(name)
        p["directed"] = len(ids)
        p["directorPicks"] = total_picks(ids)
    for name, ids in films_by_actor.items():
        p = person_entry(name)
        p["acted"] = len(ids)
        p["actorPicks"] = total_picks(ids)
    # actor-directors à la Chaplin: they star in a film they also directed
    for name, p in people.items():
        if set(films_by_director.get(name, [])) & set(films_by_actor.get(name, [])):
            p["directsOwn"] = 1
    # resolve slug collisions deterministically
    by_slug = defaultdict(list)
    for p in people.values():
        by_slug[p["slug"]].append(p)
    for slug, plist in by_slug.items():
        if len(plist) > 1:
            for i, p in enumerate(sorted(plist, key=lambda x: x["name"])[1:], 2):
                p["slug"] = f"{slug}-{i}"
    # The index only lists people with at least one pick: the ~3.8k credited
    # solely on unpicked related films are search noise. Their person/ pages
    # are still written below, and slugs above were resolved over everyone.
    dump("people.json", sorted(
        (p for p in people.values() if p["directorPicks"] + p["actorPicks"] > 0),
        key=lambda p: -(p["directorPicks"] + p["actorPicks"])))

    # ---- detail: films ----
    for fid, f in films.items():
        picked_by = []
        for sid in picks_by_film.get(fid, []):
            s = sessions[sid]
            picked_by.append({
                "session": sid,
                "title": s["title"],
                "date": s["date_recorded"],
                "video": s["video_url"],
                "celebs": [{"id": c, "name": celebs[c]["name"]}
                           for c in sess_celebs[sid]],
            })
        picked_by.sort(key=lambda x: x["date"] or "", reverse=True)
        dump(f"film/{film_slug[fid]}.json", {
            "id": fid, "slug": film_slug[fid], "title": f["title"], "year": f["year"],
            "country": f["country"], "duration": f["duration_minutes"],
            "spine": f["spine_number"], "url": f["url"],
            "cover": f["cover_url"], "description": f["description"],
            "boxset": f["is_boxset"], "scraped": f["scraped"],
            "directors": [{"name": n, "slug": people[n]["slug"]}
                          for n in director_of.get(fid, []) if n in people],
            "cast": [{"actor": c["actor"], "role": c["role"],
                      "slug": people.get(c["actor"], {}).get("slug")}
                     for c in cast_by_film.get(fid, [])],
            "credits": [{"role": c["role"], "person": c["person"],
                         "slug": people.get(c["person"], {}).get("slug")}
                        for c in credits_by_film.get(fid, [])],
            "pickedBy": picked_by,
            "related": related.get(fid, []),
            "setFilms": boxset_members.get(fid, []),
            "inSets": member_of.get(fid, []),
        })

    # ---- detail: people ----
    for name, p in people.items():
        directed = films_by_director.get(name, [])
        acted = films_by_actor.get(name, [])
        pickers = set()
        for sid in director_sessions.get(name, set()) | actor_sessions.get(name, set()):
            pickers.update(sess_celebs[sid])
        dump(f"person/{p['slug']}.json", {
            "name": name, "slug": p["slug"],
            "directed": sorted(directed, key=lambda i: -film_pick_count.get(i, 0)),
            "acted": sorted(acted, key=lambda i: -film_pick_count.get(i, 0)),
            "directorPicks": total_picks(directed),
            "actorPicks": total_picks(acted),
            "pickedBy": sorted(
                [{"id": c, "name": celebs[c]["name"]} for c in pickers],
                key=lambda x: x["name"]),
        })

    # ---- detail: celebrities ----
    for cid, c in celebs.items():
        sess = []
        for sid in sorted(celeb_sessions[cid],
                          key=lambda s: sessions[s]["date_recorded"] or "",
                          reverse=True):
            s = sessions[sid]
            sess.append({
                "id": sid, "title": s["title"], "date": s["date_recorded"],
                "video": s["video_url"], "url": s["collection_url"],
                "thumb": s["thumbnail_url"], "description": s["description"],
                "picks": picks_by_session[sid],
                "with": [{"id": x, "name": celebs[x]["name"]}
                         for x in sess_celebs[sid] if x != cid],
            })
        dump(f"celeb/{cid}.json", {"id": cid, "name": c["name"], "sessions": sess})

    # ---- home page stats ----
    def film_brief(fid):
        f = films[fid]
        return {"id": fid, "slug": film_slug[fid], "title": f["title"],
                "year": f["year"], "director": f["director"],
                "cover": f["cover_url"], "picks": film_pick_count.get(fid, 0)}

    top_films = [film_brief(fid) for fid, _ in
                 sorted(film_pick_count.items(), key=lambda x: -x[1])[:24]]

    top_directors = []
    for name, ids in sorted(films_by_director.items(),
                            key=lambda x: -total_picks(x[1]))[:24]:
        top_directors.append({
            "name": name, "slug": people[name]["slug"], "picks": total_picks(ids),
            "films": len(ids),
            "topFilm": film_brief(max(ids, key=lambda i: film_pick_count.get(i, 0))),
        })

    top_actors = []
    for name, ids in sorted(films_by_actor.items(),
                            key=lambda x: -total_picks(x[1]))[:24]:
        top_actors.append({
            "name": name, "slug": people[name]["slug"], "picks": total_picks(ids),
            "films": len(ids),
            "topFilm": film_brief(max(ids, key=lambda i: film_pick_count.get(i, 0))),
        })

    top_celebs = sorted(
        [{"id": cid, **celebs_index[str(cid)]} for cid in celebs],
        key=lambda c: -c["picks"])[:24]

    # picks per year of visit
    per_year = Counter()
    for sid, s in sessions.items():
        if s["date_recorded"]:
            per_year[s["date_recorded"][:4]] += len(picks_by_session[sid])
    timeline = [{"year": y, "picks": n} for y, n in sorted(per_year.items())]

    # decade of picked films (weighted by times picked)
    decades = Counter()
    for fid, n in film_pick_count.items():
        y = films[fid]["year"]
        if y:
            decades[f"{y // 10 * 10}s"] += n
    decade_hist = [{"decade": d, "picks": n} for d, n in sorted(decades.items())]

    # fun stats
    once = [fid for fid, n in film_pick_count.items() if n == 1]
    marathon = max(sessions, key=lambda s: len(picks_by_session[s]))
    repeat_visitors = sorted(
        [{"id": cid, "name": celebs[cid]["name"], "visits": len(set(celeb_sessions[cid]))}
         for cid in celebs if len(set(celeb_sessions[cid])) > 1],
        key=lambda x: -x["visits"])
    celeb_names = {c["name"] for c in celebs.values()}
    directors_circle = sorted(
        [{"name": n, "slug": people[n]["slug"], "picks": total_picks(ids)}
         for n, ids in films_by_director.items()
         if n in celeb_names and total_picks(ids) > 0],
        key=lambda x: -x["picks"])
    # self picks: celebrity picked a film they are credited on
    self_picks = []
    for sid, fids in picks_by_session.items():
        for cid in sess_celebs[sid]:
            nm = celebs[cid]["name"]
            for fid in fids:
                names = {c["person"] for c in credits_by_film.get(fid, [])} | \
                        {c["actor"] for c in cast_by_film.get(fid, [])}
                if nm in names:
                    self_picks.append({"celeb": nm, "celebId": cid,
                                       "film": film_brief(fid)})
    oldest = min((fid for fid in film_pick_count if films[fid]["year"]),
                 key=lambda f: films[f]["year"], default=None)
    longest = max((fid for fid in film_pick_count if films[fid]["duration_minutes"]),
                  key=lambda f: films[f]["duration_minutes"], default=None)

    countries = Counter()
    for fid, n in film_pick_count.items():
        if films[fid]["country"]:
            countries[films[fid]["country"]] += n

    dump("stats.json", {
        "counts": {
            "sessions": len(sessions),
            "celebrities": len(celebs),
            "filmsPicked": len(film_pick_count),
            "totalPicks": sum(film_pick_count.values()),
            "filmsTracked": len(films),
            "actors": len(films_by_actor),
            "directors": len(films_by_director),
            "pickedOnce": len(once),
        },
        "topFilms": top_films,
        "topDirectors": top_directors,
        "topActors": top_actors,
        "topCelebs": top_celebs,
        "timeline": timeline,
        "decades": decade_hist,
        "countries": [{"country": c, "picks": n}
                      for c, n in countries.most_common(12)],
        "fun": {
            "marathon": {
                "session": marathon,
                "title": sessions[marathon]["title"],
                "date": sessions[marathon]["date_recorded"],
                "picks": len(picks_by_session[marathon]),
                "celebs": [{"id": c, "name": celebs[c]["name"]}
                           for c in sess_celebs[marathon]],
            },
            "repeatVisitors": repeat_visitors[:10],
            "directorsCircle": directors_circle[:12],
            "selfPicks": self_picks,
            "oldest": film_brief(oldest) if oldest else None,
            "longest": ({**film_brief(longest),
                         "duration": films[longest]["duration_minutes"]}
                        if longest else None),
        },
    })

    n_files = sum(len(fs) for _, _, fs in os.walk(OUT))
    print(f"exported {n_files} JSON files to {OUT}")


if __name__ == "__main__":
    main()

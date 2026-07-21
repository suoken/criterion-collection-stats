#!/usr/bin/env python3
"""Build criterion.db (SQLite) from the scraped JSONL files in data/."""
import csv
import json
import os
import re
import sqlite3

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
DB_PATH = os.path.join(BASE, "criterion.db")
EXPORT_DIR = os.path.join(BASE, "exports")

SCHEMA = """
DROP TABLE IF EXISTS session_celebrities;
DROP TABLE IF EXISTS picks;
DROP TABLE IF EXISTS film_cast;
DROP TABLE IF EXISTS film_credits;
DROP TABLE IF EXISTS related_films;
DROP TABLE IF EXISTS boxset_films;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS celebrities;
DROP TABLE IF EXISTS films;

CREATE TABLE celebrities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,               -- criterion collection id from URL
    title TEXT NOT NULL,                  -- e.g. "Finneas's Closet Picks"
    date_recorded TEXT,                   -- ISO date
    collection_url TEXT NOT NULL UNIQUE,  -- criterion.com page for the session
    video_url TEXT,                       -- closet video (vimeo)
    thumbnail_url TEXT,
    description TEXT
);

CREATE TABLE session_celebrities (
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    celebrity_id INTEGER NOT NULL REFERENCES celebrities(id),
    PRIMARY KEY (session_id, celebrity_id)
);

CREATE TABLE films (
    id INTEGER PRIMARY KEY,               -- criterion film id from URL
    title TEXT,
    url TEXT NOT NULL UNIQUE,             -- criterion.com film page
    cover_url TEXT,                       -- box cover art image URL
    director TEXT,
    year INTEGER,
    country TEXT,
    duration_minutes INTEGER,
    spine_number INTEGER,
    description TEXT,
    is_boxset INTEGER NOT NULL DEFAULT 0,
    scraped INTEGER NOT NULL DEFAULT 0    -- 1 if film detail page was fetched
);

CREATE TABLE picks (
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    film_id INTEGER NOT NULL REFERENCES films(id),
    position INTEGER NOT NULL,            -- order within the closet video shelf
    PRIMARY KEY (session_id, film_id)
);

CREATE TABLE film_cast (
    film_id INTEGER NOT NULL REFERENCES films(id),
    actor TEXT NOT NULL,
    role TEXT,
    position INTEGER NOT NULL
);

CREATE TABLE film_credits (
    film_id INTEGER NOT NULL REFERENCES films(id),
    credit_role TEXT NOT NULL,            -- Director, Producer, Writer, Director of photography, ...
    person TEXT NOT NULL,
    position INTEGER NOT NULL
);

CREATE TABLE related_films (
    film_id INTEGER NOT NULL REFERENCES films(id),
    related_film_id INTEGER NOT NULL REFERENCES films(id),
    PRIMARY KEY (film_id, related_film_id)
);

CREATE TABLE boxset_films (
    boxset_id INTEGER NOT NULL REFERENCES films(id),
    film_id INTEGER NOT NULL REFERENCES films(id),
    position INTEGER NOT NULL,
    PRIMARY KEY (boxset_id, film_id)
);

CREATE INDEX idx_picks_film ON picks(film_id);
CREATE INDEX idx_cast_film ON film_cast(film_id);
CREATE INDEX idx_credits_film ON film_credits(film_id);
CREATE INDEX idx_credits_person ON film_credits(person);
"""


def load_jsonl(name):
    path = os.path.join(DATA, f"{name}.jsonl")
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def canonical_url(url):
    """Normalize film URLs: strip domain variations and trailing slashes."""
    if not url:
        return None
    url = url.strip().rstrip("/")
    url = re.sub(r"^https?://(www\.)?criterion\.com", "", url)
    return "https://www.criterion.com" + url


BOXSET_ID_OFFSET = 1_000_000  # films and boxsets share numeric ids on criterion.com


def id_from_url(url):
    m = re.search(r"/(films|boxsets|shop/collection)/(\d+)", url or "")
    if not m:
        return None
    n = int(m.group(2))
    return n + BOXSET_ID_OFFSET if m.group(1) == "boxsets" else n


def parse_date(s):
    """'Jun 11, 2026' -> '2026-06-11'"""
    if not s:
        return None
    months = {m: i for i, m in enumerate(
        "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(), 1)}
    m = re.match(r"(\w{3}) (\d{1,2}), (\d{4})", s.strip())
    if not m:
        return s
    return f"{m.group(3)}-{months[m.group(1)]:02d}-{int(m.group(2)):02d}"


def normalize_video_url(url):
    """Site embeds 'https://vimeo.com/videos/videos/{id}'; canonical is vimeo.com/{id}."""
    if not url:
        return None
    m = re.search(r"vimeo\.com/(?:videos/)*(\d+)", url)
    return f"https://vimeo.com/{m.group(1)}" if m else url


def split_celebrities(title):
    """'Sofia Coppola & Marc Jacobs's Closet Picks' -> ['Sofia Coppola', 'Marc Jacobs'].
    Also handles Oxford-comma trios: 'A, B, and C's Closet Picks'."""
    name = re.sub(r"[’']s Closet Picks$", "", title.strip())
    return [p.strip() for p in re.split(r"\s*&\s*|\s*,\s*(?:and\s+)?|\s+and\s+", name)
            if p.strip()]


def is_cast_header(entry):
    """Some cast lists (e.g. The Golden Age of Television) embed section
    titles like 'A WIND FROM THE SOUTH' as roleless all-caps dt entries,
    indistinguishable in markup from actors. Require 3+ letters so short
    real names like 'J.R.' (Streetwise) survive."""
    if entry.get("role"):
        return False
    letters = "".join(ch for ch in entry["actor"] if ch.isalpha())
    return len(letters) >= 3 and letters.isupper()


def parse_meta(meta_items):
    """Parse .film-meta-list items like ['United Kingdom', '1964', '87 minutes',
    'Black & White', '1.75:1', 'English', 'Spine #711']"""
    out: dict = {"year": None, "country": None, "duration_minutes": None, "spine_number": None}
    countries = []
    for item in meta_items or []:
        t = item.strip()
        if re.fullmatch(r"(19|20)\d{2}", t):
            out["year"] = int(t)
        elif m := re.fullmatch(r"(\d+) minutes?", t):
            out["duration_minutes"] = int(m.group(1))
        elif m := re.search(r"Spine #(\d+)", t):
            out["spine_number"] = int(m.group(1))
        elif re.fullmatch(r"[\d.]+:1", t) or t in ("Color", "Black & White", "Black and White"):
            pass
        elif not out["year"] and not countries:
            countries.append(t)
        elif out["year"] is None:
            countries.append(t)
    out["country"] = countries[0] if countries else None
    return out


def main():
    collections = load_jsonl("collections")
    films = load_jsonl("films")
    print(f"loaded {len(collections)} collections, {len(films)} films")

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.executescript(SCHEMA)

    celeb_ids = {}

    def celeb_id(name):
        if name not in celeb_ids:
            cur.execute("INSERT INTO celebrities (name) VALUES (?)", (name,))
            celeb_ids[name] = cur.lastrowid
        return celeb_ids[name]

    def ensure_film(url, title=None, director=None, cover=None):
        url = canonical_url(url)
        fid = id_from_url(url)
        if url is None or fid is None:
            return None
        cur.execute(
            """INSERT INTO films (id, url, title, director, cover_url, is_boxset)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 title = COALESCE(films.title, excluded.title),
                 director = COALESCE(films.director, excluded.director),
                 cover_url = COALESCE(films.cover_url, excluded.cover_url)""",
            (fid, url, title, director, cover, 1 if "/boxsets/" in url else 0),
        )
        return fid

    # --- sessions + picks ---
    for c in collections:
        sid = id_from_url(c["collection_url"])
        cur.execute(
            """INSERT OR IGNORE INTO sessions
               (id, title, date_recorded, collection_url, video_url, thumbnail_url, description)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (sid, c["celebrity_title"], parse_date(c.get("date_recorded")),
             c["collection_url"], normalize_video_url(c.get("video_url")), c.get("thumbnail"),
             c.get("description")),
        )
        for name in split_celebrities(c["celebrity_title"]):
            cur.execute(
                "INSERT OR IGNORE INTO session_celebrities VALUES (?, ?)",
                (sid, celeb_id(name)),
            )
        for pos, p in enumerate(c.get("picks") or [], 1):
            fid = ensure_film(p["film_url"], p.get("title"), p.get("director"),
                              p.get("cover_thumb"))
            if fid:
                cur.execute(
                    "INSERT OR IGNORE INTO picks VALUES (?, ?, ?)", (sid, fid, pos))

    # --- film details ---
    for f in films:
        fid = ensure_film(f["url"], f.get("title"))
        if fid is None:
            continue
        meta = parse_meta(f.get("meta"))
        director = next(
            (", ".join(c["names"]) for c in f.get("credits") or []
             if c["role"].lower() == "director"), None)
        cur.execute(
            """UPDATE films SET title = COALESCE(?, title),
                 cover_url = COALESCE(?, cover_url),
                 director = COALESCE(?, director),
                 year = ?, country = ?, duration_minutes = ?, spine_number = ?,
                 description = ?, scraped = 1
               WHERE id = ?""",
            (f.get("title"), f.get("cover_url"), director, meta["year"],
             meta["country"], meta["duration_minutes"], meta["spine_number"],
             f.get("description"), fid),
        )
        cur.execute("DELETE FROM film_cast WHERE film_id = ?", (fid,))
        for pos, entry in enumerate(f.get("cast") or [], 1):
            if entry.get("actor") and not is_cast_header(entry):
                cur.execute("INSERT INTO film_cast VALUES (?, ?, ?, ?)",
                            (fid, entry["actor"], entry.get("role"), pos))
        cur.execute("DELETE FROM film_credits WHERE film_id = ?", (fid,))
        pos = 0
        for entry in f.get("credits") or []:
            if not entry.get("role"):
                continue
            for name in entry["names"]:
                pos += 1
                cur.execute("INSERT INTO film_credits VALUES (?, ?, ?, ?)",
                            (fid, entry["role"], name, pos))
        for r in f.get("related") or []:
            rid = ensure_film(r["film_url"], r.get("title"), r.get("director"),
                              r.get("cover_thumb"))
            if rid and rid != fid:
                cur.execute("INSERT OR IGNORE INTO related_films VALUES (?, ?)",
                            (fid, rid))
        for pos, sf in enumerate(f.get("set_films") or [], 1):
            sfid = ensure_film(sf["film_url"], sf.get("title"), None,
                               sf.get("cover_thumb"))
            if sfid and sfid != fid:
                cur.execute("INSERT OR IGNORE INTO boxset_films VALUES (?, ?, ?)",
                            (fid, sfid, pos))

    # Collection pages label boxsets "Collector's Set" where a film shows its
    # director — it is a product-type tag, not a person.
    cur.execute("UPDATE films SET director = NULL WHERE director = 'Collector’s Set'")

    con.commit()

    # --- exports ---
    os.makedirs(EXPORT_DIR, exist_ok=True)
    exports = {
        "picks_flat.csv": """
            SELECT s.title AS session, s.date_recorded, c.name AS celebrity,
                   f.title AS film, f.director, f.year, f.spine_number,
                   f.url AS film_url, f.cover_url, s.collection_url, s.video_url
            FROM picks p
            JOIN sessions s ON s.id = p.session_id
            JOIN session_celebrities sc ON sc.session_id = s.id
            JOIN celebrities c ON c.id = sc.celebrity_id
            JOIN films f ON f.id = p.film_id
            ORDER BY s.date_recorded DESC, p.position""",
        "films.csv": "SELECT * FROM films ORDER BY title",
        "film_cast.csv": """
            SELECT f.title AS film, fc.actor, fc.role
            FROM film_cast fc JOIN films f ON f.id = fc.film_id
            ORDER BY f.title, fc.position""",
        "film_credits.csv": """
            SELECT f.title AS film, fc.credit_role, fc.person
            FROM film_credits fc JOIN films f ON f.id = fc.film_id
            ORDER BY f.title, fc.position""",
        "related_films.csv": """
            SELECT f1.title AS film, f1.url AS film_url,
                   f2.title AS related_film, f2.url AS related_film_url
            FROM related_films r
            JOIN films f1 ON f1.id = r.film_id
            JOIN films f2 ON f2.id = r.related_film_id
            ORDER BY f1.title""",
    }
    for fname, query in exports.items():
        cur.execute(query)
        with open(os.path.join(EXPORT_DIR, fname), "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow([d[0] for d in cur.description])
            w.writerows(cur.fetchall())
        print(f"exported {fname}")

    for table in ("sessions", "celebrities", "films", "picks", "film_cast",
                  "film_credits", "related_films"):
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"{table}: {cur.fetchone()[0]} rows")
    con.close()


if __name__ == "__main__":
    main()

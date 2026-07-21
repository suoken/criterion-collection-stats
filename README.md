# Criterion Closet Picks — Database & Stats Site

Every celebrity visit to the Criterion closet, scraped into a relational
database, with an interactive stats site styled after classic-Hollywood
one-sheets.

## What's here

```
data/                  raw scrape output (JSONL, one record per page)
  collections.jsonl    392 closet-picks sessions with their picks
  films.jsonl          1,561 film/boxset pages (cast, credits, related films)
criterion.db           SQLite database built from the raw data
exports/               flat CSV exports of the main queries
scraper/
  collector_server.py  local HTTP collector the in-browser crawler POSTs to
  film_crawler_v3.js   crawler that runs inside a criterion.com browser tab
build_db.py            data/*.jsonl  ->  criterion.db + exports/*.csv
export_web_data.py     criterion.db  ->  web/public/data/*.json (~14k files)
web/                   Vite + React stats site
```

## Database schema (criterion.db)

| table               | contents                                                  |
|---------------------|-----------------------------------------------------------|
| `sessions`          | one closet visit: title, date, page URL, video URL        |
| `celebrities`       | one row per person (joint visits are split)               |
| `session_celebrities` | visit ↔ person                                          |
| `films`             | film or box set: title, year, country, spine, cover URL, criterion.com URL |
| `picks`             | session ↔ film, with shelf position                       |
| `film_cast`         | actor + role per film                                     |
| `film_credits`      | credit role (Director, Producer, …) + person per film     |
| `related_films`     | film ↔ related film (from Criterion's "Related Films")    |
| `boxset_films`      | box set ↔ member films                                    |

Note: criterion.com reuses numeric ids across `/films/` and `/boxsets/`;
box set ids are stored offset by 1,000,000 to keep them distinct.

## Running the site

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in web/dist — deploy anywhere
```

## Refreshing the data

The site sits behind Cloudflare, so the crawl runs *inside a real browser
tab* on criterion.com and streams records to a local collector:

1. `python3 scraper/collector_server.py` (listens on 127.0.0.1:8787)
2. Open https://www.criterion.com/closet-picks/search in a browser and run
   the collections crawler, then `scraper/film_crawler_v3.js`, in the
   devtools console. The film crawler pulls its queue from
   `GET /films_queue` and loops until the queue is empty, so it can be
   re-run safely after interruptions.
3. `python3 build_db.py && python3 export_web_data.py`

Scope of the crawl: every closet pick, plus one hop of Criterion's related
films, plus member films of picked box sets — not the whole catalog.

*A fan project; not affiliated with the Criterion Collection. Cover images
are hotlinked from criterion.com and each film links back to its page there.*

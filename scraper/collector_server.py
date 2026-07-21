#!/usr/bin/env python3
"""Local collector: receives scraped JSON records POSTed from the browser
page context (which can fetch criterion.com past Cloudflare) and appends
them to JSONL files under data/."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

ALLOWED = {"collections", "films", "errors"}

QUEUE_LIMIT = 400


def _read_jsonl(name):
    path = os.path.join(DATA_DIR, f"{name}.jsonl")
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def _canon(url):
    """Normalize product URLs so dedup works across relative/absolute forms."""
    import re
    m = re.search(r"/((?:films|boxsets)/\d+[^/?#]*)", url or "")
    return f"https://www.criterion.com/{m.group(1)}" if m else None


def films_queue():
    """Film/boxset URLs still to scrape, minus pages already in films.jsonl.
    Scope is bounded to one hop from the closet picks: the picked films
    themselves, their related films, and member films of any scraped boxset
    (boxsets carry no credits; their member films do). Related films of
    non-picked films are NOT expanded, so this never crawls the full catalog."""
    picks, wanted, scraped, failed = set(), set(), set(), set()
    for c in _read_jsonl("collections"):
        for p in c.get("picks") or []:
            if u := _canon(p.get("film_url")):
                picks.add(u)
    wanted |= picks
    for f in _read_jsonl("films"):
        u = _canon(f.get("url"))
        if u:
            scraped.add(u)
        expand = list(f.get("set_films") or [])
        if u in picks:
            expand += f.get("related") or []
        for r in expand:
            if ru := _canon(r.get("film_url")):
                wanted.add(ru)
    for e in _read_jsonl("errors"):
        if u := _canon(e.get("url")):
            failed.add(u)
    return sorted(wanted - scraped - failed)[:QUEUE_LIMIT]


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/films_queue"):
            body = json.dumps(films_queue()).encode()
        else:
            # health/progress check: report line counts per file
            counts = {}
            for name in ALLOWED:
                path = os.path.join(DATA_DIR, f"{name}.jsonl")
                counts[name] = sum(1 for _ in open(path)) if os.path.exists(path) else 0
            body = json.dumps(counts).encode()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        kind = self.path.strip("/")
        if kind not in ALLOWED:
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            record = json.loads(raw)
        except json.JSONDecodeError:
            self.send_response(400)
            self._cors()
            self.end_headers()
            return
        records = record if isinstance(record, list) else [record]
        with open(os.path.join(DATA_DIR, f"{kind}.jsonl"), "a") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        self.send_response(200)
        self._cors()
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, format, *args):  # noqa: A002 - silence request logging
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8787), Handler).serve_forever()

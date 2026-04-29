# Just Landed

Intern housing search assistant. A React/Vite frontend (`frontend/`) talks to a Python scraper backend (`backend/`) that pulls live Blueground listings via Playwright. The frontend merges scraper results with other sources (Zillow, Craigslist, Airbnb, InterMBA), ranks them with Claude (Anthropic API, default `claude-sonnet-4-6`), and drafts outreach.

## Layout

```
just-landed/
├── frontend/   # Vite + React + TypeScript + Tailwind UI (was just-landed-ai)
└── backend/    # Python scraper + FastAPI server (was housing-scraper)
```

## Running locally

You need two terminals — one for the scraper API, one for the frontend.

### Terminal 1 — backend

```bash
cd backend
uv sync
uv run playwright install chromium
uv run scrape-server          # serves http://localhost:8000
```

The CLI still works for Excel-only runs:

```bash
uv run scrape run --city Boston --state MA \
  --start 2026-05-15 --end 2026-08-15 \
  --max-price 5000 -o boston.xlsx
```

### Terminal 2 — frontend

```bash
cd frontend
npm install
cp .env.example .env          # optional; synthetic data works out of the box
npm run dev                   # http://localhost:5173
```

In the Settings tab, turn off "use synthetic data" to enable live sources. The Blueground source calls `http://localhost:8000/scrape` by default; override with `VITE_SCRAPER_URL` in `frontend/.env`.

## How the scraper integrates

`POST /scrape` on the backend takes the same parameters as the CLI and returns JSON:

```json
{ "count": 12, "listings": [ { "source": "blueground", "title": "...", "price_monthly_usd": 4200, ... } ] }
```

The frontend's `src/tools/sources/blueground.ts` calls this endpoint in parallel with the other sources from `src/tools/searchListings.ts`. Excel output is preserved as a CLI-only artifact — the API path skips it.

## Known caveats

- A scrape takes ~30–90s (real headless Chromium against Blueground). The frontend sits on the loading state until `/scrape` returns. If that's too slow for demos, switch to a job-queue model (`POST /scrape` returns `job_id`, `GET /scrape/{id}` polls).
- CORS on the backend is currently `allow_origins=["*"]` for local dev — tighten before deploying.
- Blueground's ToS: scrape politely, don't redistribute the data.

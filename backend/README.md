# housing-scraper

Aggregator for short-term furnished housing — pulls listings from **Blueground** and writes them straight to an Excel file. Built for MBA summer-internship housing search.

## Setup

```bash
# 1. Install deps (uv recommended)
uv sync

# 2. Install the headless Chromium that Playwright drives
uv run playwright install chromium

# 3. (Optional) copy the env template — only needed if you want to set
#    a proxy or change the rate limit.
cp .env.example .env
```

No database, no Docker, no Postgres. The scraper opens a real headless Chromium, talks to Blueground's internal API, parses the prices out of each detail page, and writes everything to an `.xlsx` file.

## Usage

```bash
# Boston, summer 2026, under $5k/mo, 1+ bedroom
uv run scrape run \
  --city Boston --state MA \
  --start 2026-05-15 --end 2026-08-15 \
  --bedrooms 1 --max-price 5000 \
  --output boston.xlsx
```

For SF (which has lots of neighborhoods Blueground caps at 50 listings each), use `--exhaustive` to query every neighborhood:

```bash
uv run scrape run \
  --city "San Francisco" --state CA \
  --start 2026-05-15 --end 2026-08-15 \
  --max-price 8000 --max-results 0 \
  --exhaustive \
  --output sf.xlsx
```

## Flags

| Flag | What it does |
| --- | --- |
| `--city`, `--state` | Required. City name and 2-letter state code. |
| `--start`, `--end` | Required. Move-in / move-out (`YYYY-MM-DD`). |
| `--output`, `-o` | Excel path. Default `listings.xlsx`. |
| `--max-price` | Max monthly price. Re-checked client-side against Blueground's actual displayed price. |
| `--bedrooms` | Minimum bedrooms (0 = studio). |
| `--max-results` | Cap per source. Default 20. `0` = no cap. |
| `--max-min-stay` | Skip listings whose minimum stay exceeds N days. Default 60. `0` = no cap. |
| `--exhaustive` | Query every neighborhood placeId, not just the city placeId. Slower but ~10× more coverage. |
| `--source` | Defaults to `blueground` (the only working source). |

## Output

A single Excel workbook with one sheet named `Listings`. Columns:

`Property · Beds · Baths · Sqft · Price ($/mo) · Move-in · Min stay (days) · Address · City · State · Lat · Lon · Source · Link`

Sorted by price ascending (NULLs last). Header row is frozen, auto-filter is on, the Link column is hyperlinked.

Each run **overwrites** its output file. If you want to keep prior runs, change `--output`.

## Tests

```bash
uv run pytest
```

## Notes on legality

Review Blueground's ToS before deploying. Scrape politely (default 1 req/sec), don't redistribute the data, and respect `robots.txt`.

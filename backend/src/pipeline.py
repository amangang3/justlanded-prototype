from __future__ import annotations

import structlog

from src.normalize import normalize
from src.scrapers import SCRAPERS
from src.scrapers.base import SearchParams

log = structlog.get_logger()


async def run_search(
    params: SearchParams,
    sources: list[str] | None = None,
) -> list[dict]:
    """Run a search across the requested sources and return a flat list of rows."""
    sources = sources or list(SCRAPERS.keys())
    rows: list[dict] = []

    for src in sources:
        scraper_cls = SCRAPERS.get(src)
        if not scraper_cls:
            log.warning("pipeline.unknown_source", source=src)
            continue
        scraper = scraper_cls()
        log.info("pipeline.scrape.start", source=src, city=params.city)
        before = len(rows)
        try:
            async for raw in scraper.search(params):
                rows.append(normalize(raw, params))
        except Exception as e:
            log.error("pipeline.scrape.failed", source=src, error=repr(e))
        log.info("pipeline.scrape.done", source=src, found=len(rows) - before)

    return rows

from __future__ import annotations

import logging
from datetime import date

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.config import settings
from src.pipeline import run_search
from src.scrapers import SCRAPERS
from src.scrapers.base import SearchParams


def _setup_logging() -> None:
    logging.basicConfig(level=settings.log_level.upper(), format="%(message)s")
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.dev.ConsoleRenderer(),
        ]
    )


_setup_logging()
log = structlog.get_logger()

app = FastAPI(title="housing-scraper", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScrapeRequest(BaseModel):
    city: str
    state: str = Field(..., min_length=2, max_length=2)
    start_date: date
    end_date: date
    max_price_monthly_usd: int | None = None
    min_bedrooms: int | None = None
    max_results: int | None = 20
    max_min_stay_days: int | None = 60
    exhaustive: bool = False
    sources: list[str] | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/scrape")
async def scrape(req: ScrapeRequest) -> dict:
    src_list = req.sources or ["blueground"]
    for s in src_list:
        if s not in SCRAPERS:
            raise HTTPException(400, f"unknown source: {s}")

    params = SearchParams(
        city=req.city,
        state=req.state.upper(),
        start_date=req.start_date,
        end_date=req.end_date,
        max_price_monthly_usd=req.max_price_monthly_usd,
        min_bedrooms=req.min_bedrooms,
        max_results=req.max_results or None,
        max_min_stay_days=req.max_min_stay_days or None,
        exhaustive=req.exhaustive,
    )

    log.info("server.scrape.start", **params.to_dict(), sources=src_list)
    rows = await run_search(params, src_list)
    log.info("server.scrape.done", count=len(rows))

    return {"count": len(rows), "listings": [_jsonify(r) for r in rows]}


def _jsonify(row: dict) -> dict:
    out = {}
    for k, v in row.items():
        if isinstance(v, date):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def _run() -> None:
    import uvicorn

    uvicorn.run("src.server:app", host="127.0.0.1", port=8000, reload=False)


if __name__ == "__main__":
    _run()

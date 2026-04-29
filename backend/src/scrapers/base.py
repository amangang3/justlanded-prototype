from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import structlog
from aiolimiter import AsyncLimiter

from src.config import settings

log = structlog.get_logger()


@dataclass
class SearchParams:
    city: str
    state: str
    start_date: date
    end_date: date
    max_price_monthly_usd: int | None = None
    min_bedrooms: int | None = None
    max_results: int | None = 20
    max_min_stay_days: int | None = 60
    exhaustive: bool = False
    name: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "city": self.city,
            "state": self.state,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "max_price_monthly_usd": self.max_price_monthly_usd,
            "min_bedrooms": self.min_bedrooms,
            "max_results": self.max_results,
            "max_min_stay_days": self.max_min_stay_days,
            "exhaustive": self.exhaustive,
            "name": self.name,
        }


@dataclass
class RawListing:
    """Source-shaped listing fields. Normalization happens in src.normalize."""

    source: str
    source_id: str
    url: str
    title: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    lat: float | None = None
    lon: float | None = None
    bedrooms: float | None = None
    bathrooms: float | None = None
    sqft: int | None = None
    price_amount: float | None = None
    price_period: str | None = None  # "night" | "month"
    min_stay_days: int | None = None
    max_stay_days: int | None = None
    available_from: date | None = None
    available_to: date | None = None
    amenities: dict[str, Any] = field(default_factory=dict)
    photos: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


class BaseScraper(ABC):
    source: str

    def __init__(self) -> None:
        self.rate_limiter = AsyncLimiter(
            max_rate=max(1, int(settings.scraper_rate_limit_rps)),
            time_period=1.0,
        )

    @abstractmethod
    async def search(self, params: SearchParams) -> AsyncIterator[RawListing]:
        """Yield raw listings for the given search params."""
        if False:  # pragma: no cover — make this an async generator
            yield  # type: ignore[misc]


@asynccontextmanager
async def playwright_context(headless: bool = True):
    """Shared Playwright + stealth context for browser-based scrapers."""
    from playwright.async_api import async_playwright
    from playwright_stealth import Stealth

    proxy = {"server": settings.http_proxy} if settings.http_proxy else None

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless, proxy=proxy)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
            locale="en-US",
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
        )
        await Stealth().apply_stealth_async(context)
        try:
            yield context
        finally:
            await context.close()
            await browser.close()

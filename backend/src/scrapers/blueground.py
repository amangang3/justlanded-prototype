from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from datetime import date, datetime
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

import structlog

from src.scrapers.base import BaseScraper, RawListing, SearchParams, playwright_context

log = structlog.get_logger()

BASE_URL = "https://www.theblueground.com"
LIST_API = f"{BASE_URL}/api/sp"
MAP_API_PATH = "/api/sp/map"
PAGE_SIZE = 50

# Cities we run regularly. URL pattern is /furnished-apartments-<slug>; the
# suffix varies per city (boston-usa, austin-tx, mexico-city, ...). For
# unknown cities we fall back to scraping homepage links.
CITY_SLUGS: dict[str, str] = {
    "Boston": "boston-usa",
    "New York": "new-york-usa",
    "Chicago": "chicago-usa",
    "San Francisco": "san-francisco-bay-area-usa",
    "Los Angeles": "los-angeles-usa",
    "Austin": "austin-tx",
    "Miami": "miami-fl",
    "Washington": "washington-dc-usa",
    "Seattle": "seattle-usa",
    "Denver": "denver-usa",
}


class BluegroundScraper(BaseScraper):
    """Scraper for Blueground.

    Three-step flow:
      1. Load the city page once with Playwright; capture placeId from the
         /api/sp/map XHR.
      2. Paginate /api/sp via ctx.request to collect basic property records.
      3. For each (capped at params.max_results), fetch the detail-page HTML
         and parse Blueground.pageData.property.lowestRent.amount — that's the
         monthly rent the list endpoint hides.
    """

    source = "blueground"

    async def search(self, params: SearchParams) -> AsyncIterator[RawListing]:
        slug = await self._resolve_city_slug(params.city)
        if not slug:
            log.warning("blueground.unknown_city", city=params.city)
            return

        async with playwright_context() as ctx:
            place_ids = await self._discover_place_ids(ctx, slug, params.exhaustive)
            if not place_ids:
                log.warning("blueground.no_place_id", city=params.city, slug=slug)
                return

            cap = params.max_results
            max_stay = params.max_min_stay_days
            collected: list[dict] = []
            seen_ids: set[str] = set()
            scanned = 0

            for pid in place_ids:
                if cap and len(collected) >= cap:
                    break
                offset = 0
                while True:
                    items = await self._fetch_page(ctx, pid, params, offset)
                    if items is None:
                        break
                    if not items:
                        break
                    scanned += len(items)
                    for it in items:
                        sid = str(it.get("id") or it.get("code") or "")
                        if not sid or sid in seen_ids:
                            continue
                        seen_ids.add(sid)
                        if max_stay is not None and _item_min_stay_days(it) > max_stay:
                            continue
                        collected.append(it)
                        if cap and len(collected) >= cap:
                            break
                    if cap and len(collected) >= cap:
                        break
                    if len(items) < PAGE_SIZE:
                        break
                    offset += PAGE_SIZE

            log.info(
                "blueground.collected",
                count=len(collected),
                scanned=scanned,
                placeIds=len(place_ids),
                capped_at=cap,
                max_min_stay=max_stay,
                exhaustive=params.exhaustive,
            )

            max_price = params.max_price_monthly_usd
            for item in collected:
                price = await self._fetch_detail_price(ctx, item.get("path"), params)
                # Blueground's API maxPrice filter operates on an internal
                # baseRent, not the public lowestRent we extract from the
                # detail page — re-check client-side so the user's budget
                # actually applies to the displayed price.
                if max_price is not None and price is not None and price > max_price:
                    continue
                listing = _to_raw_listing(item, price_override=price)
                if listing:
                    yield listing

    async def _fetch_page(
        self, ctx, place_id: str, params: SearchParams, offset: int
    ) -> list[dict] | None:
        query: dict[str, Any] = {
            "offset": offset,
            "items": PAGE_SIZE,
            "isSearchPage": "true",
            "placeId": place_id,
            "currency": "USD",
            "moveIn": params.start_date.isoformat(),
            "moveOut": params.end_date.isoformat(),
        }
        if params.min_bedrooms:
            query["bedrooms"] = ",".join(str(b) for b in range(params.min_bedrooms, 5))
        if params.max_price_monthly_usd:
            query["maxPrice"] = params.max_price_monthly_usd

        url = f"{LIST_API}?{urlencode(query)}"
        async with self.rate_limiter:
            resp = await ctx.request.get(url)
        if resp.status >= 400:
            log.warning("blueground.api_error", status=resp.status, offset=offset)
            return None
        try:
            body = await resp.json()
        except Exception as e:
            log.warning("blueground.bad_json", error=str(e))
            return None

        items = (body.get("properties") or {}).get("main") or []
        log.info("blueground.page", offset=offset, returned=len(items),
                 total=body.get("totalItems") or 0)
        return items

    async def _fetch_detail_price(
        self, ctx, path: str | None, params: SearchParams
    ) -> int | None:
        if not path:
            return None
        url = (
            f"{BASE_URL}/{path.lstrip('/')}"
            f"?moveIn={params.start_date.isoformat()}"
            f"&moveOut={params.end_date.isoformat()}"
        )
        async with self.rate_limiter:
            resp = await ctx.request.get(url)
        if resp.status >= 400:
            return None
        html = await resp.text()
        prop = _extract_property_block(html)
        if not prop:
            return None
        amount = (prop.get("lowestRent") or {}).get("amount")
        if not amount or amount <= 0:
            return None
        return int(amount)

    async def _resolve_city_slug(self, city: str) -> str | None:
        if city in CITY_SLUGS:
            return CITY_SLUGS[city]
        async with playwright_context() as ctx:
            page = await ctx.new_page()
            try:
                await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_timeout(1500)
                hrefs = await page.evaluate(
                    "Array.from(document.querySelectorAll('a'))"
                    ".map(a => a.getAttribute('href') || '')"
                    ".filter(h => h.startsWith('/furnished-apartments-'))"
                )
            finally:
                await page.close()

        target = city.lower().replace(" ", "-")
        for h in hrefs:
            slug_part = h.replace("/furnished-apartments-", "")
            if slug_part.startswith(target):
                return slug_part
        return None

    async def _discover_place_ids(self, ctx, slug: str, exhaustive: bool) -> list[str]:
        """Return placeIds to query against /api/sp.

        The first entry is always the city placeId (captured from the
        /api/sp/map XHR). When `exhaustive` is set, neighborhood placeIds are
        appended — one per `ng-eyJ...` block found in the city page HTML.
        Each one yields its own curated 50-result set, dramatically expanding
        coverage at the cost of more requests.
        """
        city_place_id: str | None = None

        def on_response(response):
            nonlocal city_place_id
            if city_place_id is None and MAP_API_PATH in response.url:
                qs = parse_qs(urlparse(response.url).query)
                if qs.get("placeId"):
                    city_place_id = qs["placeId"][0]

        page = await ctx.new_page()
        page.on("response", on_response)
        html = ""
        try:
            await page.goto(
                f"{BASE_URL}/furnished-apartments-{slug}",
                wait_until="domcontentloaded",
                timeout=60000,
            )
            for _ in range(10):
                if city_place_id:
                    break
                await page.wait_for_timeout(800)
            if exhaustive:
                html = await page.content()
        finally:
            await page.close()

        if not city_place_id:
            return []
        out = [city_place_id]
        if exhaustive and html:
            ng_ids = sorted(set(re.findall(r"ng-eyJ[A-Za-z0-9_=-]+", html)))
            out.extend(ng_ids)
        return out


def _item_min_stay_days(item: dict) -> int:
    """Compute the minimum stay (in days) implied by Blueground's payload."""
    md = (item.get("rent") or {}).get("minDuration") or {}
    return (md.get("months") or 0) * 30 + (md.get("days") or 0)


def _extract_property_block(html: str) -> dict | None:
    """Extract the JSON value of `property:` from `Blueground.pageData = {...}`.

    The outer object uses JS object-literal syntax (unquoted keys), but the
    inner `property:` value is valid JSON. Walk braces (string-aware) from the
    inner opening brace to find its matching close.
    """
    pd_idx = html.find("Blueground.pageData")
    if pd_idx < 0:
        return None
    i = html.find("property: ", pd_idx)
    if i < 0:
        return None
    start = i + len("property: ")
    if start >= len(html) or html[start] != "{":
        return None
    depth = 0
    in_str = False
    esc = False
    for j in range(start, len(html)):
        ch = html[j]
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(html[start:j + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _to_raw_listing(item: dict, price_override: int | None = None) -> RawListing | None:
    sid = str(item.get("id") or item.get("code") or "")
    if not sid:
        return None

    path = item.get("path") or (
        f"p/furnished-apartments/"
        f"{(item.get('cityCode') or '').lower()}-{item.get('code') or ''}"
    )
    url = f"{BASE_URL}/{path.lstrip('/')}"

    addr = item.get("address") or {}
    rent = item.get("rent") or {}
    list_price = rent.get("amount") or item.get("baseRent", {}).get("amount") or None
    if list_price == 0:
        list_price = None

    price = price_override if price_override is not None else (
        float(list_price) if list_price else None
    )

    min_dur = rent.get("minDuration") or {}
    min_stay_days = (min_dur.get("months") or 0) * 30 + (min_dur.get("days") or 0)

    address_str = ", ".join(
        s for s in (addr.get("building"), addr.get("level2"), addr.get("city")) if s
    ) or None

    return RawListing(
        source="blueground",
        source_id=sid,
        url=url,
        title=item.get("name"),
        address=address_str,
        city=addr.get("city"),
        state=None,
        lat=addr.get("lat"),
        lon=addr.get("lng"),
        bedrooms=item.get("bedrooms"),
        bathrooms=item.get("bathrooms"),
        sqft=item.get("lotSize"),
        price_amount=float(price) if price else None,
        price_period="month",
        min_stay_days=min_stay_days or None,
        available_from=_parse_date(item.get("availableFrom")),
        photos=_extract_photos(item),
        raw=item,
    )


def _parse_date(v: Any) -> date | None:
    if not v:
        return None
    if isinstance(v, date):
        return v
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _extract_photos(item: dict) -> list[str]:
    out: list[str] = []
    for p in (item.get("photos") or [])[:30]:
        if isinstance(p, str):
            out.append(p)
        elif isinstance(p, dict):
            url = p.get("url") or p.get("src") or p.get("href")
            if url:
                out.append(url)
    return out

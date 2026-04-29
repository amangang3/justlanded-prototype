from __future__ import annotations

from src.scrapers.base import RawListing, SearchParams


def normalize(raw: RawListing, params: SearchParams | None = None) -> dict:
    """Convert a RawListing to a flat dict suitable for one Excel row."""
    return {
        "source": raw.source,
        "source_id": raw.source_id,
        "title": raw.title,
        "url": raw.url,
        "address": raw.address,
        "city": raw.city or (params.city if params else None),
        "state": raw.state or (params.state if params else None),
        "lat": float(raw.lat) if raw.lat is not None else None,
        "lon": float(raw.lon) if raw.lon is not None else None,
        "bedrooms": float(raw.bedrooms) if raw.bedrooms is not None else None,
        "bathrooms": float(raw.bathrooms) if raw.bathrooms is not None else None,
        "sqft": raw.sqft,
        "price_monthly_usd": _to_monthly(raw.price_amount, raw.price_period),
        "min_stay_days": raw.min_stay_days,
        "max_stay_days": raw.max_stay_days,
        "available_from": raw.available_from,
        "available_to": raw.available_to,
    }


def _to_monthly(amount: float | None, period: str | None) -> int | None:
    if amount is None:
        return None
    if period == "night":
        return int(round(amount * 30))
    return int(round(amount))

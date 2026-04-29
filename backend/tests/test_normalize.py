from datetime import date

from src.normalize import _to_monthly
from src.scrapers.blueground import (
    _extract_property_block,
    _item_min_stay_days,
    _to_raw_listing,
)


def test_nightly_to_monthly_uses_30_day_default():
    assert _to_monthly(100, "night") == 3000


def test_monthly_passthrough():
    assert _to_monthly(2500, "month") == 2500


def test_unknown_period_treated_as_monthly():
    assert _to_monthly(2500, None) == 2500


def test_none_amount_returns_none():
    assert _to_monthly(None, "night") is None


def _sample_blueground_item() -> dict:
    return {
        "id": 36816,
        "code": "931",
        "path": "p/furnished-apartments/bos-931",
        "name": "The Harlo, 1350 Boylston St",
        "bedrooms": 0,
        "bathrooms": 1,
        "lotSize": 448,
        "availableFrom": "2026-05-05",
        "cityCode": "BOS",
        "address": {
            "building": "The Harlo",
            "level2": "Fenway-Kenmore",
            "city": "Boston",
            "lat": 42.3441154,
            "lng": -71.0995393,
        },
        "rent": {
            "amount": 0,
            "currency": "USD",
            "minDuration": {"months": 1, "days": 12},
        },
        "photos": [{"url": "https://example.com/a.jpg"}, {"url": "https://example.com/b.jpg"}],
    }


def test_blueground_to_raw_listing_basic_fields():
    raw = _to_raw_listing(_sample_blueground_item())
    assert raw is not None
    assert raw.source == "blueground"
    assert raw.source_id == "36816"
    assert raw.url == "https://www.theblueground.com/p/furnished-apartments/bos-931"
    assert raw.title == "The Harlo, 1350 Boylston St"
    assert raw.city == "Boston"
    assert raw.lat == 42.3441154
    assert raw.lon == -71.0995393
    assert raw.bedrooms == 0
    assert raw.sqft == 448
    assert raw.available_from == date(2026, 5, 5)
    assert raw.photos == ["https://example.com/a.jpg", "https://example.com/b.jpg"]


def test_blueground_zero_rent_becomes_none():
    raw = _to_raw_listing(_sample_blueground_item())
    assert raw is not None
    assert raw.price_amount is None
    assert raw.min_stay_days == 1 * 30 + 12


def test_blueground_skips_when_no_id():
    assert _to_raw_listing({"name": "no id"}) is None


def test_blueground_extract_property_block_finds_lowest_rent():
    html = (
        'random head\n<script>'
        ' Blueground.pageData = {\n'
        '      property: {"id":36816,"code":"931","lowestRent":{"amount":4970,"currency":"USD"},'
        '"name":"The Harlo"},\n'
        '      other: 1\n'
        '    };\n'
        '</script>tail'
    )
    block = _extract_property_block(html)
    assert block is not None
    assert block["id"] == 36816
    assert block["lowestRent"]["amount"] == 4970


def test_blueground_extract_property_block_no_marker():
    assert _extract_property_block("<html>no pagedata here</html>") is None


def test_blueground_min_stay_days_compute():
    assert _item_min_stay_days({"rent": {"minDuration": {"months": 1, "days": 12}}}) == 42
    assert _item_min_stay_days({"rent": {"minDuration": {"months": 11, "days": 23}}}) == 353
    assert _item_min_stay_days({"rent": {}}) == 0
    assert _item_min_stay_days({}) == 0


def test_blueground_price_override_wins():
    item = {"id": 1, "code": "x", "rent": {"amount": 0}}
    raw = _to_raw_listing(item, price_override=4970)
    assert raw is not None
    assert raw.price_amount == 4970.0

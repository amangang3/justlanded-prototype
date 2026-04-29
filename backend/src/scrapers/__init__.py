from src.scrapers.base import BaseScraper, RawListing, SearchParams
from src.scrapers.blueground import BluegroundScraper

SCRAPERS: dict[str, type[BaseScraper]] = {
    "blueground": BluegroundScraper,
}

__all__ = [
    "BaseScraper",
    "RawListing",
    "SearchParams",
    "BluegroundScraper",
    "SCRAPERS",
]

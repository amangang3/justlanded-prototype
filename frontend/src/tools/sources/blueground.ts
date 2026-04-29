import type { UserPreferences, Listing } from "../../types";
import { useAppStore } from "../../state";

interface ScraperRow {
  source: string;
  source_id: string;
  title: string | null;
  url: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lon: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  price_monthly_usd: number | null;
  min_stay_days: number | null;
  max_stay_days: number | null;
  available_from: string | null;
  available_to: string | null;
}

interface ScrapeResponse {
  count: number;
  listings: ScraperRow[];
}

const STATE_BY_CITY: Record<string, string> = {
  "San Francisco": "CA",
  "New York": "NY",
};

export async function fetchBluegroundListings(
  prefs: UserPreferences,
): Promise<Listing[]> {
  const { scraperUrl } = useAppStore.getState().settings;
  if (!scraperUrl) {
    console.warn("Blueground: no scraperUrl configured.");
    return [];
  }

  const state = STATE_BY_CITY[prefs.city];
  if (!state) {
    console.warn(`Blueground: no state mapping for city ${prefs.city}`);
    return [];
  }

  const body = {
    city: prefs.city,
    state,
    start_date: prefs.start_date,
    end_date: prefs.end_date,
    max_price_monthly_usd: Math.round(prefs.budget_max_usd * 1.5),
    min_bedrooms: null,
    max_results: 25,
    max_min_stay_days: 60,
    exhaustive: prefs.city === "San Francisco",
    sources: ["blueground"],
  };

  try {
    const res = await fetch(`${scraperUrl.replace(/\/$/, "")}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Blueground scraper failed: HTTP ${res.status}`, text.slice(0, 300));
      return [];
    }

    const data: ScrapeResponse = await res.json();
    console.log(`Blueground: got ${data.count} listings from scraper`);

    return data.listings.map((r): Listing => {
      const addressParts = [r.address, r.city, r.state].filter(Boolean);
      return {
        id: `blueground-${r.source_id}`,
        source: "Blueground",
        title: r.title ?? `${r.bedrooms ?? 0}BR at ${r.address ?? "Unknown"}`,
        url: r.url,
        price_usd_per_month: r.price_monthly_usd ?? 0,
        bedrooms: r.bedrooms ?? 0,
        bathrooms: r.bathrooms ?? 1,
        furnished: true, // Blueground is furnished-only
        available_from: r.available_from ?? prefs.start_date,
        available_to: r.available_to,
        address: addressParts.join(", "),
        lat: r.lat ?? 0,
        lng: r.lon ?? 0,
        amenities: [],
        description:
          `Furnished Blueground apartment` +
          (r.sqft ? `, ${r.sqft} sqft` : "") +
          (r.min_stay_days ? `, ${r.min_stay_days}-day min stay` : ""),
        posted_at: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error("Blueground scraper error:", err);
    return [];
  }
}

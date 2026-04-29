import type { UserPreferences, Listing } from "../types";
import { useAppStore } from "../state";
import syntheticData from "../data/synthetic_listings.json";
import {
  fetchInterMbaListings,
  fetchBluegroundListings,
} from "./sources";

// ---------------------------------------------------------------------------
// City alias sets for loose matching
// ---------------------------------------------------------------------------
const CITY_ALIASES: Record<string, string[]> = {
  "San Francisco": ["san francisco", "sf", "bay area", "berkeley", "palo alto", "menlo park", "stanford", "california", "ca 94"],
  "New York": ["new york", "nyc", "manhattan", "brooklyn", "queens", "bronx", "ny 1"],
};

function matchesCity(address: string, prefsCity: string): boolean {
  if (!address) return true; // empty address = can't filter, keep it
  const lower = address.toLowerCase();
  const aliases = CITY_ALIASES[prefsCity] ?? [prefsCity.toLowerCase()];
  return aliases.some((alias) => lower.includes(alias));
}

// ---------------------------------------------------------------------------
// Loosened filters for real-world data
// ---------------------------------------------------------------------------
function applyLooseFilters(
  listings: Listing[],
  prefs: UserPreferences,
  sourceLabel?: string,
): Listing[] {
  const maxPrice = prefs.budget_max_usd * 1.5; // 50% headroom for real listings
  const drops = { city: 0, furnished: 0, price: 0, available_from: 0, available_to: 0 };

  const kept = listings.filter((l) => {
    if (l.address && !matchesCity(l.address, prefs.city)) {
      drops.city++;
      return false;
    }
    if (prefs.furnished && l.furnished === false) {
      drops.furnished++;
      return false;
    }
    if (l.price_usd_per_month > 0 && l.price_usd_per_month > maxPrice) {
      drops.price++;
      return false;
    }
    if (l.available_from && l.available_from > prefs.start_date) {
      drops.available_from++;
      return false;
    }
    if (l.available_to !== null && l.available_to && l.available_to < prefs.end_date) {
      drops.available_to++;
      return false;
    }
    return true;
  });

  if (sourceLabel && kept.length < listings.length) {
    console.log(
      `${sourceLabel}: kept ${kept.length}/${listings.length} after loose filter; ` +
        `dropped — price>${maxPrice}: ${drops.price}, ` +
        `available_from>${prefs.start_date}: ${drops.available_from}, ` +
        `available_to<${prefs.end_date}: ${drops.available_to}, ` +
        `city mismatch: ${drops.city}, ` +
        `unfurnished: ${drops.furnished}`,
    );
  }

  return kept;
}

// ---------------------------------------------------------------------------
// Round-robin merge of two source lists so each gets fair slot allocation.
// ---------------------------------------------------------------------------
function interleave(a: Listing[], b: Listing[]): Listing[] {
  const out: Listing[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dedup by normalized address. First seen wins.
// ---------------------------------------------------------------------------
function dedup(listings: Listing[]): Listing[] {
  const seen = new Set<string>();
  const result: Listing[] = [];
  for (const l of listings) {
    const key = l.address.toLowerCase().trim();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    result.push(l);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Synthetic data path (for demos)
// ---------------------------------------------------------------------------
function filterSynthetic(prefs: UserPreferences): Listing[] {
  const cityName = prefs.city;
  const maxPrice = prefs.budget_max_usd * 1.1;

  const matches = (syntheticData as Listing[]).filter((listing) => {
    if (!listing.address.includes(cityName)) return false;
    if (prefs.furnished && !listing.furnished) return false;
    if (listing.price_usd_per_month > maxPrice) return false;
    if (listing.available_from > prefs.start_date) return false;
    if (listing.available_to !== null && listing.available_to < prefs.end_date)
      return false;
    return true;
  });

  if (matches.length < 3) {
    console.warn(
      `searchListings: only ${matches.length} synthetic listings survived filtering for ${cityName}`,
    );
  }

  return matches.slice(0, 15);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function searchListings(
  prefs: UserPreferences,
): Promise<Listing[]> {
  const { useSyntheticData } = useAppStore.getState().settings;

  // Synthetic-only mode for demos
  if (useSyntheticData) {
    const results = filterSynthetic(prefs);
    console.log("searchListings: using synthetic data,", results.length, "listings");
    return results;
  }

  // Live sources: InterMBA Google Sheet + Blueground (via local scraper API).
  const [intermbaResult, bluegroundResult] = await Promise.allSettled([
    fetchInterMbaListings(prefs),
    fetchBluegroundListings(prefs),
  ]);

  const intermba =
    intermbaResult.status === "fulfilled" ? intermbaResult.value : [];
  const blueground =
    bluegroundResult.status === "fulfilled" ? bluegroundResult.value : [];

  if (intermbaResult.status === "rejected")
    console.warn("InterMBA source failed:", intermbaResult.reason);
  if (bluegroundResult.status === "rejected")
    console.warn("Blueground source failed:", bluegroundResult.reason);

  console.log("searchListings RAW counts:", {
    InterMBA: intermba.length,
    Blueground: blueground.length,
  });

  // Interleave the two source lists so each gets fair representation when we
  // later slice(0, 25). Without this, a long list (e.g. 30 InterMBA) would
  // hog every slot and the second source (e.g. 7 Blueground) would be sliced
  // off entirely before reaching the ranker.
  const merged = dedup(
    interleave(
      applyLooseFilters(intermba, prefs, "InterMBA"),
      applyLooseFilters(blueground, prefs, "Blueground"),
    ),
  );

  const finalCounts: Record<string, number> = {};
  for (const l of merged) {
    finalCounts[l.source] = (finalCounts[l.source] ?? 0) + 1;
  }
  console.log("searchListings FINAL counts:", finalCounts);

  if (merged.length === 0) {
    console.error(
      "Both InterMBA and Blueground returned zero listings. Check the per-source warnings above.",
    );
  }

  // Cap at 50 candidates so Claude has meaningful room to pick the top 20
  // while keeping per-call input tokens bounded (~25K tokens at 50 listings).
  return merged.slice(0, 50);
}

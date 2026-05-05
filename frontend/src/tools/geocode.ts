import type { Listing } from "../types";

// Nominatim (OpenStreetMap) geocoder. Free, no API key, but rate-limited to
// ~1 req/sec per the OSM usage policy. We cache aggressively in localStorage
// so repeat searches don't re-hit the network.

const CACHE_KEY = "geocode_cache_v1";
const REQUEST_INTERVAL_MS = 1100;

type CacheEntry = [number, number] | null;

function loadCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

let cache = loadCache();
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function persist(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // quota exceeded — drop oldest half and retry once
      const keys = Object.keys(cache);
      for (const k of keys.slice(0, Math.floor(keys.length / 2))) delete cache[k];
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch { /* give up */ }
    }
  }, 500);
}

function normalizeKey(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

// Single-flight queue: each call waits for the previous to resolve + the
// rate-limit interval. This serializes outgoing requests across all callers.
let queue: Promise<unknown> = Promise.resolve();

async function fetchOne(address: string): Promise<CacheEntry> {
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(address);
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<CacheEntry> {
  if (!address) return null;
  const key = normalizeKey(address);
  if (key in cache) return cache[key];

  const job = queue.then(async () => {
    if (key in cache) return cache[key]; // re-check; another caller may have filled it
    const result = await fetchOne(address);
    cache[key] = result;
    persist();
    await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));
    return result;
  });
  queue = job.catch(() => null);
  return job;
}

/**
 * Geocode all listings missing coordinates, mutating each listing in place.
 * Resolves once every lookup has settled. Failures leave lat/lng at 0 so
 * downstream consumers (map filter, commute fallback) can ignore them.
 */
export async function geocodeListings(listings: Listing[]): Promise<void> {
  const needsGeocoding = listings.filter(
    (l) => l.address && l.lat === 0 && l.lng === 0,
  );
  if (needsGeocoding.length === 0) return;

  await Promise.all(
    needsGeocoding.map(async (listing) => {
      const coords = await geocodeAddress(listing.address);
      if (coords) {
        listing.lat = coords[0];
        listing.lng = coords[1];
      }
    }),
  );
}

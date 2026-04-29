import type { CommuteResult, Listing } from "../types";
import { useAppStore } from "../state";
import syntheticListings from "../data/synthetic_listings.json";

function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getNextMonday9amUnix(): number {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 0, 0, 0);
  return Math.floor(nextMonday.getTime() / 1000);
}

function getDestinationCoords(destination: string): { lat: number; lng: number } {
  if (destination.toLowerCase().includes("new york")) {
    return { lat: 40.7128, lng: -74.006 };
  }
  return { lat: 37.7749, lng: -122.4194 };
}

function findOriginCoords(
  origin: string,
  listings: Listing[],
): { lat: number; lng: number } | null {
  const exact = listings.find((l) => l.address === origin);
  if (exact && (exact.lat !== 0 || exact.lng !== 0)) {
    return { lat: exact.lat, lng: exact.lng };
  }

  const partial = listings.find(
    (l) =>
      (l.lat !== 0 || l.lng !== 0) &&
      (l.address.includes(origin) || origin.includes(l.address)),
  );
  if (partial) return { lat: partial.lat, lng: partial.lng };

  return null;
}

function haversineFallback(
  origin: string,
  destination: string,
): CommuteResult {
  // Use store listings + synthetic data for coordinate lookup
  const storeListings = useAppStore.getState().listings;
  const allListings = [...storeListings, ...(syntheticListings as Listing[])];
  const originCoords = findOriginCoords(origin, allListings);
  const destCoords = getDestinationCoords(destination);

  if (!originCoords) {
    // No coordinates available — return a city-level rough estimate
    const duration_min = 25; // assume ~25 min average urban commute
    return {
      duration_min,
      route_summary: `~${duration_min} min (estimated, no coords available)`,
    };
  }

  const distance_km = haversineDistanceKm(
    originCoords.lat,
    originCoords.lng,
    destCoords.lat,
    destCoords.lng,
  );
  const duration_min = Math.ceil((distance_km / 30) * 60 * 1.8);

  return {
    duration_min,
    route_summary: `~${duration_min} min (estimated, no Maps key)`,
  };
}

export async function getCommute(
  origin: string,
  destination: string,
): Promise<CommuteResult> {
  const { settings } = useAppStore.getState();
  const mapsApiKey = settings.mapsApiKey;

  if (mapsApiKey && mapsApiKey.trim() !== "") {
    try {
      const NEXT_MONDAY_9AM_UNIX = getNextMonday9amUnix();
      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${encodeURIComponent(origin)}` +
        `&destinations=${encodeURIComponent(destination)}` +
        `&mode=transit` +
        `&departure_time=${NEXT_MONDAY_9AM_UNIX}` +
        `&key=${mapsApiKey}`;

      const res = await fetch(url);
      if (!res.ok) {
        return haversineFallback(origin, destination);
      }

      const data = await res.json();
      const element = data?.rows?.[0]?.elements?.[0];

      if (!element || element.status !== "OK") {
        return haversineFallback(origin, destination);
      }

      const duration_min = Math.round(element.duration.value / 60);
      const route_summary = `${element.duration.text} (transit)`;

      return { duration_min, route_summary };
    } catch {
      return haversineFallback(origin, destination);
    }
  }

  return haversineFallback(origin, destination);
}

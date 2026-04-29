import type { UserPreferences, Listing } from "../../types";
import { useAppStore } from "../../state";

const SHEET_ID = "1FTmM_7uccmK_MVCzomoyaIgR_BnPXp_dIFNpiPSWwNU";

/**
 * Hardcoded city → gid map for the Inter-MBA sublease sheet.
 * Each gid points to a city-specific tab of real sublease listings.
 * Multiple gids per city = multiple years/tabs of data; all are fetched.
 */
const CITY_TO_GIDS: Record<string, string[]> = {
  // Bay Area / San Francisco
  "san francisco": ["154145507", "1593614950", "1994086329", "1125121695"],
  "sf":            ["154145507", "1593614950", "1994086329", "1125121695"],
  "bay area":      ["154145507", "1593614950", "1994086329", "1125121695"],
  "berkeley":      ["154145507", "1994086329", "1125121695"],
  "stanford":      ["154145507", "1593614950"],
  "palo alto":     ["154145507", "1593614950"],
  // New York City
  "new york":      ["1154898271", "1393032160", "1768840835", "693545920"],
  "nyc":           ["1154898271", "1393032160", "1768840835", "693545920"],
  "manhattan":     ["1154898271", "1393032160", "1768840835", "693545920"],
  "brooklyn":      ["1154898271", "1393032160", "1768840835", "693545920"],
  // Boston
  "boston":         ["2046750096", "1638013343", "1349004877"],
  // Chicago
  "chicago":       ["1535231268", "1112043888", "1990768521", "2128555219"],
  "evanston":      ["1535231268", "1112043888", "1990768521", "2128555219"],
  // Los Angeles
  "los angeles":   ["754509944", "578026907"],
  "la":            ["754509944", "578026907"],
  // Washington DC
  "dc":            ["1265041179", "1890995240", "69397121"],
  "washington":    ["1265041179", "1890995240", "69397121"],
  "washington dc": ["1265041179", "1890995240", "69397121"],
  // Seattle
  "seattle":       ["1796583271", "505750381"],
  // Philadelphia
  "philadelphia":  ["1051876481", "1011650046"],
  "philly":        ["1051876481", "1011650046"],
  // Austin
  "austin":        ["1090768780", "1752509323", "1428517486"],
  // Atlanta
  "atlanta":       ["1481432080", "885697202", "1877754118"],
  // Michigan / Ann Arbor
  "michigan":      ["129524418", "544760799", "2000047662"],
  "ann arbor":     ["129524418", "544760799", "295660595"],
  // Durham
  "durham":        ["225707816", "1836775974"],
  "raleigh":       ["225707816", "1836775974"],
  // Nashville
  "nashville":     ["1745998669", "219105125"],
  // New Haven (Yale)
  "new haven":     ["1548819868", "479225293"],
  "yale":          ["1548819868", "479225293"],
  // Pittsburgh
  "pittsburgh":    ["295646624", "1547969847"],
  // Charlotte
  "charlotte":     ["2105287752"],
  // Miami
  "miami":         ["1225162463"],
  // Houston
  "houston":       ["529275074", "1112226891"],
};

/** Minimal CSV parser that handles quoted fields with commas/newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
      row.push(field.trim());
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      if (ch === "\r") i++;
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** Normalize a string to lowercase, strip non-alphanumeric. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Find the real header row by scanning for rows that contain
 * housing-related column names like "price", "address", "neighborhood".
 */
function findHeaderRowIndex(rows: string[][]): number {
  const markers = ["price", "address", "neighborhood", "subletter", "name", "dates"];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const joined = rows[i].join(" ").toLowerCase();
    if (markers.filter((m) => joined.includes(m)).length >= 2) {
      return i;
    }
  }
  return 0; // fallback to first row
}

/** Try multiple column name variants to find a value. */
function findCol(
  headers: Map<string, number>,
  row: string[],
  ...names: string[]
): string {
  for (const name of names) {
    const norm = normalize(name);
    for (const [key, idx] of headers) {
      if (key.includes(norm) || norm.includes(key)) {
        if (idx < row.length && row[idx]) return row[idx];
      }
    }
  }
  return "";
}

/** Extract price from freetext like "$1,700 / month" or "2500 per month" */
function extractPrice(raw: string): number {
  const match = raw.replace(/,/g, "").match(/\$?\s*(\d{3,5})/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Extract bedrooms from strings like "2bd/1ba" or "1B1B" or "Studio" */
function extractBedrooms(raw: string): number {
  if (/studio/i.test(raw)) return 0;
  const match = raw.match(/(\d+)\s*(?:bd|bed|br|b(?=\d*(?:ba|b\b)))/i);
  return match ? parseInt(match[1], 10) : 1;
}

/** Extract bathrooms from strings like "2bd/1ba" or "2B2B" */
function extractBathrooms(raw: string): number {
  const match = raw.match(/(\d+)\s*(?:ba(?:th)?|b\s*$)/i);
  return match ? parseInt(match[1], 10) : 1;
}

function buildCsvUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
}

async function fetchAndParseSingleTab(
  gid: string,
  cityLabel: string,
): Promise<Listing[]> {
  const url = buildCsvUrl(gid);
  let text: string;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`InterMBA[${cityLabel}] gid=${gid}: HTTP ${res.status}`);
      return [];
    }
    text = await res.text();
  } catch (err) {
    console.warn(`InterMBA[${cityLabel}] gid=${gid}: fetch error`, err);
    return [];
  }

  const allRows = parseCsv(text);
  if (allRows.length < 2) return [];

  const headerIdx = findHeaderRowIndex(allRows);
  const headerRow = allRows[headerIdx];
  const headers = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const norm = normalize(h);
    if (norm) headers.set(norm, i);
  });

  const listings: Listing[] = [];

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (row.length < 3) continue;

    // Check status — skip if explicitly "Taken"
    const status = findCol(headers, row, "status");
    if (/taken|rented|filled|unavailable/i.test(status)) continue;

    const address = findCol(headers, row, "address");
    const neighborhood = findCol(headers, row, "neighborhood", "area", "location");
    const name = findCol(headers, row, "subletter_name", "name", "owner");
    const priceRaw = findCol(headers, row, "price", "price_range");
    const dimensions = findCol(headers, row, "full_place", "dimensions", "br_ba");
    const dates = findCol(headers, row, "dates", "sublet_availability", "availability");
    const details = findCol(headers, row, "details", "description", "notes");
    const link = findCol(headers, row, "link", "images", "url");
    const contact = findCol(headers, row, "contact", "contact_information", "email");
    const dateUpdated = findCol(headers, row, "date_last_updated", "posting_date");

    // Be maximally permissive — include row if it has at least one useful field
    if (!priceRaw && !address && !neighborhood && !contact && !name) continue;

    const price = extractPrice(priceRaw);

    // Ensure city name is in the address for downstream filtering
    let fullAddress = address || neighborhood || cityLabel;
    const cityLower = cityLabel.toLowerCase();
    if (!fullAddress.toLowerCase().includes(cityLower)) {
      fullAddress = `${fullAddress}, ${cityLabel}`;
    }

    const listing: Listing = {
      id: `intermba-${gid}-${i}`,
      source: "InterMBA",
      title: name
        ? `${name}'s sublet in ${neighborhood || cityLabel}`
        : `InterMBA listing in ${neighborhood || cityLabel}`,
      url: link || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${gid}`,
      price_usd_per_month: price,
      bedrooms: extractBedrooms(dimensions),
      bathrooms: extractBathrooms(dimensions),
      furnished: true, // Inter-MBA sublets are typically furnished
      available_from: dates.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)?.[0] ?? "",
      available_to: null,
      address: fullAddress,
      lat: 0,
      lng: 0,
      amenities: [],
      description: details || `${dimensions}. ${dates}. Contact: ${contact}`.trim(),
      posted_at: dateUpdated || new Date().toISOString(),
    };

    listings.push(listing);
  }

  return listings;
}

export async function fetchInterMbaListings(
  prefs: UserPreferences,
): Promise<Listing[]> {
  const cityKey = prefs.city.toLowerCase().replace(/[^a-z ]/g, "").trim();

  // Check user-provided extra gids first
  const { interMbaExtraGids } = useAppStore.getState().settings;
  let gids = CITY_TO_GIDS[cityKey];

  if (!gids && interMbaExtraGids[cityKey]) {
    gids = [interMbaExtraGids[cityKey]];
  }

  if (!gids) {
    // Try partial match
    for (const [key, value] of Object.entries(CITY_TO_GIDS)) {
      if (cityKey.includes(key) || key.includes(cityKey)) {
        gids = value;
        break;
      }
    }
  }

  if (!gids) {
    // Check extra gids map
    for (const [key, value] of Object.entries(interMbaExtraGids)) {
      if (cityKey.includes(key) || key.includes(cityKey)) {
        gids = [value];
        break;
      }
    }
  }

  if (!gids || gids.length === 0) {
    console.warn(
      `InterMBA: no tab found for city "${prefs.city}". Add a gid via Settings > Inter-MBA city gid map.`,
    );
    return [];
  }

  // Fetch the most recent tab (first in list) — skip older tabs to reduce latency
  // For the primary tab we always fetch; additional tabs only if first returns < 5 listings
  const primary = await fetchAndParseSingleTab(gids[0], prefs.city);
  console.log(
    `InterMBA[${prefs.city}]: parsed ${primary.length} rows from primary tab gid=${gids[0]}`,
  );
  if (primary.length > 0) {
    console.log(
      "InterMBA first 3 listings:",
      JSON.stringify(primary.slice(0, 3), null, 2),
    );
  }

  if (primary.length >= 5 || gids.length === 1) {
    return primary;
  }

  // Fetch additional tabs in parallel if primary was thin
  const additionalResults = await Promise.allSettled(
    gids.slice(1).map((gid) => fetchAndParseSingleTab(gid, prefs.city)),
  );
  const additional = additionalResults.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );

  const all = [...primary, ...additional];
  console.log(
    `InterMBA[${prefs.city}]: ${all.length} total listings across ${gids.length} tabs`,
  );
  return all;
}

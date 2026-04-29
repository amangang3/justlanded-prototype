export type City = "San Francisco" | "New York";

export interface UserPreferences {
  city: City;
  office_address: string;
  start_date: string;       // ISO date YYYY-MM-DD
  end_date: string;         // ISO date YYYY-MM-DD
  budget_max_usd: number;
  commute_max_min: number;
  furnished: boolean;
  requirements: string[];   // e.g., ["in_unit_laundry", "pets_ok"]
  preferences_freetext: string;
}

export interface Listing {
  id: string;
  source: "RentCast" | "Synthetic" | "Zillow" | "Craigslist" | "InterMBA" | "Airbnb" | "Blueground";
  title: string;
  url: string;
  price_usd_per_month: number;
  bedrooms: number;
  bathrooms: number;
  furnished: boolean;
  available_from: string;
  available_to: string | null;
  address: string;
  lat: number;
  lng: number;
  amenities: string[];
  description: string;
  posted_at: string;
}

export interface CommuteResult {
  duration_min: number;
  route_summary: string;
}

export interface RankedListing {
  listing_id: string;
  fit_score: number;
  binding_constraint: string | null;
  rationale_one_liner: string;
  commute_min: number;
  commute_route: string;
}

export interface QALogEntry {
  ts: string;
  direction: "user_to_llm" | "llm_to_user";
  text: string;
}

export type ClaudeModel =
  | "claude-opus-4-7"
  | "claude-opus-4-6"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

export interface AppSettings {
  anthropicApiKey: string;
  mapsApiKey: string;
  model: ClaudeModel;
  useSyntheticData: boolean;
  interMbaExtraGids: Record<string, string>;
  scraperUrl: string;
}

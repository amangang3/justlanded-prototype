import type { Listing, UserPreferences } from "../types";

export async function draftOutreach(
  _listing: Listing,
  _prefs: UserPreferences
): Promise<string> {
  throw new Error("not implemented");
}

import { useState } from "react";
import { useAppStore } from "../state";
import type { Listing } from "../types";
import ListingCard from "./ListingCard";
import ListingDetailModal from "./ListingDetailModal";

interface ResultsListProps {
  onDraftOutreach: (listing: Listing) => Promise<string>;
  onRefineMessage: (
    listingId: string,
    instruction: string,
    current: string,
  ) => Promise<string>;
  onRefineSearch?: (text: string) => void;
}

export default function ResultsList({
  onDraftOutreach,
  onRefineMessage,
  onRefineSearch,
}: ResultsListProps) {
  const listings = useAppStore((s) => s.listings);
  const rankedListings = useAppStore((s) => s.rankedListings);

  const [openListingId, setOpenListingId] = useState<string | null>(null);
  const [autoDraft, setAutoDraft] = useState(false);
  const [refineSearchText, setRefineSearchText] = useState("");

  // Empty state
  if (rankedListings.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-12">
        Submit your preferences to see matches.
      </p>
    );
  }

  // Build lookup map
  const listingMap = new Map(listings.map((l) => [l.id, l]));

  // Find the currently-open listing + ranked pair
  const openListing = openListingId ? listingMap.get(openListingId) : undefined;
  const openRanked = openListingId
    ? rankedListings.find((r) => r.listing_id === openListingId)
    : undefined;

  const handleRefineSearchSubmit = () => {
    const text = refineSearchText.trim();
    if (!text || !onRefineSearch) return;
    onRefineSearch(text);
    setRefineSearchText("");
  };

  return (
    <div className="space-y-6">
      {/* Auto-draft toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={autoDraft}
          onChange={(e) => setAutoDraft(e.target.checked)}
          className="rounded border-gray-300"
        />
        Auto-draft outreach when opening a listing
      </label>

      {/* Listing cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rankedListings.map((ranked) => {
          const listing = listingMap.get(ranked.listing_id);
          if (!listing) return null;
          return (
            <ListingCard
              key={ranked.listing_id}
              listing={listing}
              ranked={ranked}
              onClick={() => setOpenListingId(ranked.listing_id)}
              onDraftOutreachClick={() => {
                setAutoDraft(true);
                setOpenListingId(ranked.listing_id);
              }}
            />
          );
        })}
      </div>

      {/* Refine search input */}
      {onRefineSearch && (
        <div className="flex gap-2">
          <input
            type="text"
            value={refineSearchText}
            onChange={(e) => setRefineSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRefineSearchSubmit();
            }}
            placeholder="Refine search..."
            className="flex-1 text-sm rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleRefineSearchSubmit}
            disabled={!refineSearchText.trim()}
            className="text-sm font-medium px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Refine
          </button>
        </div>
      )}

      {/* Detail modal */}
      {openListing && openRanked && (
        <ListingDetailModal
          listing={openListing}
          ranked={openRanked}
          isOpen={!!openListingId}
          onClose={() => setOpenListingId(null)}
          autoDraft={autoDraft}
          onDraftOutreach={onDraftOutreach}
          onRefineMessage={onRefineMessage}
        />
      )}
    </div>
  );
}

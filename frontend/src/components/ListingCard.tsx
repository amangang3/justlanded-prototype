import type { Listing, RankedListing } from "../types";

interface ListingCardProps {
  listing: Listing;
  ranked: RankedListing;
  onClick: () => void;
  onDraftOutreachClick: () => void;
}

function fitScoreColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800 border-green-300";
  if (score >= 60) return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-red-100 text-red-800 border-red-300";
}

function sourceBadgeColor(source: Listing["source"]): string {
  switch (source) {
    case "RentCast":
      return "bg-blue-100 text-blue-700";
    case "Zillow":
      return "bg-green-100 text-green-700";
    case "Craigslist":
      return "bg-orange-100 text-orange-700";
    case "InterMBA":
      return "bg-purple-100 text-purple-700";
    case "Airbnb":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function ListingCard({
  listing,
  ranked,
  onClick,
  onDraftOutreachClick,
}: ListingCardProps) {
  const commuteText = ranked.commute_min
    ? `${ranked.commute_min} min via ${ranked.commute_route}`
    : ranked.commute_route || "N/A";

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail placeholder */}
      <div className="relative w-full h-40 bg-gray-300 flex items-center justify-center">
        <span className="text-gray-500 text-sm">No image</span>
        <span
          className={`absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded ${sourceBadgeColor(listing.source)}`}
        >
          {listing.source}
        </span>
      </div>

      <div className="p-4 space-y-2">
        {/* Price + fit score */}
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-gray-900">
            ${listing.price_usd_per_month.toLocaleString()}
            <span className="text-sm font-normal text-gray-500">/mo</span>
          </span>
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full border ${fitScoreColor(ranked.fit_score)}`}
          >
            {ranked.fit_score}% fit
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-800 truncate">
          {listing.title}
        </h3>

        {/* Beds / Baths */}
        <p className="text-xs text-gray-500">
          {listing.bedrooms} bed{listing.bedrooms !== 1 ? "s" : ""} &middot;{" "}
          {listing.bathrooms} bath{listing.bathrooms !== 1 ? "s" : ""}
        </p>

        {/* Commute */}
        <p className="text-xs text-gray-500">{commuteText}</p>

        {/* Rationale */}
        <p className="text-xs text-gray-600 italic">
          {ranked.rationale_one_liner}
        </p>

        {/* Binding constraint warning */}
        {ranked.binding_constraint && (
          <span className="inline-block text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-300 rounded px-2 py-0.5">
            {ranked.binding_constraint}
          </span>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClick}
            className="flex-1 text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View
          </button>
          <button
            onClick={onDraftOutreachClick}
            className="flex-1 text-sm font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Draft outreach
          </button>
        </div>
      </div>
    </div>
  );
}

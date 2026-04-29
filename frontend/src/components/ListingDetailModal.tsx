import { useState, useEffect, useCallback } from "react";
import type { Listing, RankedListing } from "../types";

interface ListingDetailModalProps {
  listing: Listing;
  ranked: RankedListing;
  isOpen: boolean;
  onClose: () => void;
  autoDraft: boolean;
  onDraftOutreach: (listing: Listing) => Promise<string>;
  onRefineMessage: (
    listingId: string,
    instruction: string,
    current: string,
  ) => Promise<string>;
  onCopy?: (listingId: string) => void;
}

export default function ListingDetailModal({
  listing,
  ranked,
  isOpen,
  onClose,
  autoDraft,
  onDraftOutreach,
  onRefineMessage,
  onCopy,
}: ListingDetailModalProps) {
  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [hasAutoFired, setHasAutoFired] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    try {
      const draft = await onDraftOutreach(listing);
      setMessageText(draft);
    } finally {
      setIsLoading(false);
    }
  }, [listing, onDraftOutreach]);

  // Auto-draft on open
  useEffect(() => {
    if (isOpen && autoDraft && !hasAutoFired) {
      setHasAutoFired(true);
      handleGenerate();
    }
  }, [isOpen, autoDraft, hasAutoFired, handleGenerate]);

  // Reset state when modal opens with a different listing
  useEffect(() => {
    if (isOpen) {
      setMessageText("");
      setRefineInput("");
      setCopied(false);
      setHasAutoFired(false);
    }
  }, [isOpen, listing.id]);

  if (!isOpen) return null;

  const handleRefine = async () => {
    if (!refineInput.trim() || !messageText) return;
    setIsLoading(true);
    try {
      const refined = await onRefineMessage(
        listing.id,
        refineInput.trim(),
        messageText,
      );
      setMessageText(refined);
      setRefineInput("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(messageText);
    setCopied(true);
    onCopy?.(listing.id);
    setTimeout(() => setCopied(false), 2000);
  };

  const commuteText = ranked.commute_min
    ? `${ranked.commute_min} min via ${ranked.commute_route}`
    : ranked.commute_route || "N/A";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 truncate">
            {listing.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Split panel body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: listing details */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200 space-y-4">
            {/* Price + score row */}
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900">
                ${listing.price_usd_per_month.toLocaleString()}/mo
              </span>
              <span className="text-sm font-semibold text-gray-500">
                {ranked.fit_score}% fit
              </span>
            </div>

            <p className="text-sm text-gray-600">
              {listing.bedrooms} bed{listing.bedrooms !== 1 ? "s" : ""} &middot;{" "}
              {listing.bathrooms} bath{listing.bathrooms !== 1 ? "s" : ""}
              {listing.furnished && " \u00b7 Furnished"}
            </p>

            <p className="text-sm text-gray-500">{commuteText}</p>

            {ranked.binding_constraint && (
              <span className="inline-block text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-300 rounded px-2 py-0.5">
                {ranked.binding_constraint}
              </span>
            )}

            <p className="text-xs italic text-gray-500">
              {ranked.rationale_one_liner}
            </p>

            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                Address
              </h4>
              <p className="text-sm text-gray-700">{listing.address}</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                Description
              </h4>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {listing.description}
              </p>
            </div>

            {listing.amenities.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                  Amenities
                </h4>
                <div className="flex flex-wrap gap-1">
                  {listing.amenities.map((a) => (
                    <span
                      key={a}
                      className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
                Availability
              </h4>
              <p className="text-sm text-gray-700">
                From {listing.available_from}
                {listing.available_to ? ` to ${listing.available_to}` : ""}
              </p>
            </div>

            <p className="text-xs text-gray-400">
              Posted {listing.posted_at}
            </p>

            {listing.url && (
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View source listing
              </a>
            )}
          </div>

          {/* Right: outreach workspace */}
          <div className="flex-1 flex flex-col p-6 space-y-3 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Outreach Message
            </h3>

            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Click Generate to draft a message..."
              className="flex-1 min-h-[160px] w-full resize-none rounded-md border border-gray-300 p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full text-sm font-medium px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Generating..." : "Generate"}
            </button>

            {/* Refine input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRefine();
                }}
                placeholder="e.g., make it less corporate"
                disabled={isLoading || !messageText}
                className="flex-1 text-sm rounded-md border border-gray-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={handleRefine}
                disabled={isLoading || !messageText || !refineInput.trim()}
                className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Refine
              </button>
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              disabled={!messageText}
              className="w-full text-sm font-medium px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {copied ? "Copied \u2713" : "Copy message"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

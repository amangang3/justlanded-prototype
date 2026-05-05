import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Listing, RankedListing } from "../types";

// Inline SVG pin avoids the Leaflet default-icon bundler dance entirely.
const pinSvg = (color: string, scale = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${24 * scale}" height="${36 * scale}">
  <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z"
        fill="${color}" stroke="#7a1717" stroke-width="1"/>
  <circle cx="12" cy="12" r="4.5" fill="white"/>
</svg>`;

const redPinIcon = L.divIcon({
  className: "listing-pin",
  html: pinSvg("#dc2626"),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -34],
});

const selectedPinIcon = L.divIcon({
  className: "listing-pin listing-pin--selected",
  html: pinSvg("#b91c1c", 1.2),
  iconSize: [29, 43],
  iconAnchor: [14, 43],
  popupAnchor: [0, -41],
});

interface ListingsMapProps {
  listings: Listing[];
  rankedListings: RankedListing[];
  onMarkerClick: (listingId: string) => void;
  selectedListingId?: string | null;
}

export default function ListingsMap({
  listings,
  rankedListings,
  onMarkerClick,
  selectedListingId,
}: ListingsMapProps) {
  // Build ranked lookup
  const rankedMap = new Map(rankedListings.map((r) => [r.listing_id, r]));

  // Filter listings that have valid coordinates
  const mappable = listings.filter(
    (l) => l.lat && l.lng && rankedMap.has(l.id),
  );

  if (mappable.length === 0) return null;

  // Compute map center from average of all points
  const center: [number, number] = [
    mappable.reduce((sum, l) => sum + l.lat, 0) / mappable.length,
    mappable.reduce((sum, l) => sum + l.lng, 0) / mappable.length,
  ];

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="w-full h-full rounded-lg"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mappable.map((listing) => {
        const ranked = rankedMap.get(listing.id)!;
        const isSelected = listing.id === selectedListingId;

        return (
          <Marker
            key={listing.id}
            position={[listing.lat, listing.lng]}
            icon={isSelected ? selectedPinIcon : redPinIcon}
            eventHandlers={{
              click: () => onMarkerClick(listing.id),
            }}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-[160px]">
                <p className="font-semibold">{listing.title}</p>
                <p>${listing.price_usd_per_month.toLocaleString()}/mo</p>
                <p>{ranked.fit_score}% fit</p>
                {listing.image_url && (
                  <img
                    src={listing.image_url}
                    alt={listing.title}
                    className="w-full h-20 object-cover rounded"
                  />
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

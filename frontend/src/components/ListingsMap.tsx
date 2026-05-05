import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Listing, RankedListing } from "../types";

// Fix default marker icons (Leaflet + bundler issue)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
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
            opacity={isSelected ? 1 : 0.8}
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

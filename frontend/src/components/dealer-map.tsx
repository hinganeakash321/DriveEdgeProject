"use client";

import { useEffect } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Dealer } from "@/lib/types";

// Fix Leaflet's default marker icon paths (broken under bundlers) by using the
// openly-licensed marker assets from the Leaflet CDN.
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
}

export default function DealerMap({
  dealers,
  height = 460,
  zoom = 5,
}: {
  dealers: Dealer[];
  height?: number;
  zoom?: number;
}) {
  const located = dealers.filter(
    (d) => typeof d.latitude === "number" && typeof d.longitude === "number"
  );
  const points = located.map((d) => [d.latitude as number, d.longitude as number] as [number, number]);
  const center: [number, number] = points[0] ?? [22.9734, 78.6569]; // India centroid fallback

  return (
    <div
      className="h-[300px] overflow-hidden rounded-xl border border-line sm:h-[var(--map-h)]"
      style={{ "--map-h": `${height}px` } as React.CSSProperties}
    >
      {/* scrollWheelZoom disabled so the map never traps page scrolling on touch
          devices; users pinch-zoom or use the +/- controls instead. */}
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {located.map((d) => (
          <Marker key={d.id} position={[d.latitude as number, d.longitude as number]} icon={icon}>
            <Popup>
              <div className="min-w-[180px]">
                <p className="font-semibold text-navy">{d.dealer_name}</p>
                <p className="text-xs text-muted">
                  {d.city}
                  {d.state ? `, ${d.state}` : ""}
                </p>
                {d.manufacturer_names.length > 0 && (
                  <p className="mt-1 text-xs text-muted">{d.manufacturer_names.slice(0, 4).join(", ")}</p>
                )}
                <Link href={`/dealers/${d.id}`} className="mt-2 inline-block text-xs font-semibold text-brand">
                  View dealer &rarr;
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

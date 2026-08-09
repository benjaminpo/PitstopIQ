"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { BrandLogo } from "@/app/components/BrandLogo";
import { stationHref } from "@/app/lib/stationPath";
import type { FuelStation, GeoPoint } from "@/app/lib/types";

/** Same pin language as the planner map (`makePinIcon`). */
function pinIcon(primary: boolean) {
  const size = primary ? 34 : 26;
  const color = primary ? "#2dd4bf" : "#94a3b8";
  const ring = primary ? "3px solid #2dd4bf" : "2px solid #0f172a";
  const fill = primary ? "#0d9488" : color;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${fill};border:${ring};
      box-shadow:0 0 0 4px ${color}33, 0 8px 16px rgba(0,0,0,.45);
    "></div>`,
  });
}

function FitBounds({ points }: Readonly<{ points: GeoPoint[] }>) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
  }, [map, points]);
  return null;
}

/**
 * Same SafeZoomControl pattern as MapView — avoids HMR crashes when Leaflet
 * control corners are torn down during fast refresh.
 */
function SafeZoomControl({ position }: Readonly<{ position: L.ControlPosition }>) {
  const map = useMap();

  useEffect(() => {
    const corners = (map as unknown as { _controlCorners?: unknown })
      ._controlCorners;
    if (!corners) return;
    const control = L.control.zoom({ position });
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map, position]);

  return null;
}

export interface StationMapMarker {
  station: FuelStation;
  /** Highlight the detail-page forecourt */
  primary?: boolean;
}

interface StationLocationMapProps {
  markers: StationMapMarker[];
  className?: string;
}

let nextMapInstanceId = 0;

export default function StationLocationMap({
  markers,
  className,
}: Readonly<StationLocationMapProps>) {
  const [ready, setReady] = useState(false);
  const [mapInstanceKey] = useState(() => `station-map-${nextMapInstanceId++}`);
  const points = useMemo(
    () => markers.map((m) => m.station.location),
    [markers]
  );
  const centre = points[0] ?? { lat: 54.5, lng: -2.5 };

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || markers.length === 0) {
    return (
      <div
        className={
          className ??
          "flex h-56 w-full items-center justify-center rounded-xl bg-slate-950 text-sm text-slate-500 ring-1 ring-slate-700/60"
        }
      >
        Loading map…
      </div>
    );
  }

  return (
    <div
      className={
        className ??
        "h-56 w-full overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-700/60"
      }
    >
      <MapContainer
        key={mapInstanceKey}
        center={[centre.lat, centre.lng]}
        zoom={14}
        className="h-full w-full"
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl
      >
        <SafeZoomControl position="topright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={points} />
        {markers.map(({ station, primary }) => (
          <Marker
            key={station.id}
            position={[station.location.lat, station.location.lng]}
            icon={pinIcon(Boolean(primary))}
            zIndexOffset={primary ? 500 : 0}
          >
            <Popup>
              <div className="min-w-[160px] space-y-1 text-slate-900">
                <div className="flex items-start gap-2">
                  <BrandLogo brand={station.brand} size="md" className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{station.name}</p>
                    <p className="text-xs text-slate-600">{station.brand}</p>
                  </div>
                </div>
                {!primary && (
                  <Link
                    href={stationHref(station)}
                    className="inline-block text-xs font-medium text-teal-700 hover:underline"
                  >
                    View station
                  </Link>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePitstopStore } from "@/app/lib/store";
import { formatGbp } from "@/app/lib/detourCalculator";
import {
  formatPriceAge,
  stationPriceAgeTitle,
  stationPriceTone,
  STATION_AGE_TEXT_CLASSES_LIGHT,
} from "@/app/lib/freshness";
import type { DetourStatus, GeoPoint } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
import { NavigateHere } from "./NavigateHere";
import { StatusBadge } from "./StatusBadge";

function statusColor(status: DetourStatus): string {
  switch (status) {
    case "worth":
      return "#34d399";
    case "neutral":
      return "#fbbf24";
    case "false_economy":
      return "#fb7185";
  }
}

function makePinIcon(status: DetourStatus, selected: boolean) {
  const color = statusColor(status);
  const size = selected ? 34 : 26;
  const ring = selected ? "3px solid #2dd4bf" : "2px solid #0f172a";

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${color};border:${ring};
      box-shadow:0 0 0 4px ${color}33, 0 8px 16px rgba(0,0,0,.45);
    "></div>`,
  });
}

function endpointIcon(label: string, hue: string) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="
      width:28px;height:28px;border-radius:8px;background:${hue};
      border:2px solid #0f172a;display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 10px/1 ui-sans-serif,system-ui;box-shadow:0 4px 12px rgba(0,0,0,.4);
    ">${label}</div>`,
  });
}

function toLatLngs(coords: GeoPoint[]): [number, number][] {
  return coords.map((p) => [p.lat, p.lng]);
}

function sampleRoute(coords: GeoPoint[], maxSamples = 40): GeoPoint[] {
  if (coords.length <= maxSamples) return coords;
  const step = Math.max(1, Math.floor(coords.length / maxSamples));
  return coords.filter((_, i) => i % step === 0);
}

/** Roughly centres the UK before any trip is entered */
const FALLBACK_CENTER: GeoPoint = { lat: 53.0, lng: -1.8 };
const FALLBACK_ZOOM = 6;

function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.12));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

export default function MapView() {
  const {
    origin,
    destination,
    originCoords,
    destinationCoords,
    route,
    detourRoute,
    getEnrichedStations,
    selectedStationId,
    setSelectedStationId,
  } = usePitstopStore();

  const enriched = getEnrichedStations();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const selected = enriched.find((e) => e.station.id === selectedStationId);
  const showingDetour = Boolean(
    selected && detourRoute && detourRoute.coordinates.length > 1
  );

  const baseLine = useMemo(() => {
    if (route?.coordinates?.length && route.coordinates.length > 1) {
      return toLatLngs(route.coordinates);
    }
    if (originCoords && destinationCoords) {
      return toLatLngs([originCoords, destinationCoords]);
    }
    return null;
  }, [route, originCoords, destinationCoords]);

  const detourLine = useMemo(() => {
    if (!detourRoute?.coordinates?.length) return null;
    return toLatLngs(detourRoute.coordinates);
  }, [detourRoute]);

  const isDrivingRoute = Boolean(route && route.coordinates.length > 2);

  const fitPoints = useMemo(() => {
    const pts: GeoPoint[] = [];
    if (originCoords) pts.push(originCoords);
    if (destinationCoords) pts.push(destinationCoords);
    if (showingDetour && detourRoute?.coordinates?.length) {
      pts.push(...sampleRoute(detourRoute.coordinates));
      if (selected) pts.push(selected.station.location);
      return pts;
    }
    if (route?.coordinates?.length) {
      pts.push(...sampleRoute(route.coordinates));
      return pts;
    }
    for (const item of enriched) {
      pts.push(item.station.location);
    }
    return pts;
  }, [
    route,
    detourRoute,
    showingDetour,
    selected,
    enriched,
    originCoords,
    destinationCoords,
  ]);

  return (
    <MapContainer
      center={
        originCoords
          ? [originCoords.lat, originCoords.lng]
          : [FALLBACK_CENTER.lat, FALLBACK_CENTER.lng]
      }
      zoom={originCoords ? 10 : FALLBACK_ZOOM}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Routing © <a href="http://project-osrm.org">OSRM</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Direct route — muted when a detour is active */}
      {baseLine && (
        <>
          <Polyline
            positions={baseLine}
            pathOptions={{
              color: showingDetour ? "#0f172a" : "#042f2e",
              weight: showingDetour ? 5 : 8,
              opacity: showingDetour ? 0.35 : 0.55,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <Polyline
            positions={baseLine}
            pathOptions={{
              color: showingDetour ? "#64748b" : "#2dd4bf",
              weight: showingDetour ? 2.5 : 4,
              opacity: showingDetour ? 0.55 : 0.95,
              dashArray: showingDetour
                ? "6 10"
                : isDrivingRoute
                  ? undefined
                  : "10 8",
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </>
      )}

      {/* Selected station detour: A → pit stop → B */}
      {detourLine && (
        <>
          <Polyline
            positions={detourLine}
            pathOptions={{
              color: "#422006",
              weight: 9,
              opacity: 0.5,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <Polyline
            positions={detourLine}
            pathOptions={{
              color: "#fbbf24",
              weight: 4.5,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </>
      )}

      {originCoords && (
        <>
          <CircleMarker
            center={[originCoords.lat, originCoords.lng]}
            radius={10}
            pathOptions={{
              color: "#5eead4",
              fillColor: "#14b8a6",
              fillOpacity: 0.85,
              weight: 3,
            }}
          >
            <Popup>You / origin · {origin}</Popup>
          </CircleMarker>

          <Marker
            position={[originCoords.lat, originCoords.lng]}
            icon={endpointIcon("A", "#0d9488")}
          >
            <Popup>Origin · {origin}</Popup>
          </Marker>
        </>
      )}
      {destinationCoords && (
        <Marker
          position={[destinationCoords.lat, destinationCoords.lng]}
          icon={endpointIcon("B", "#0369a1")}
        >
          <Popup>Destination · {destination}</Popup>
        </Marker>
      )}

      {enriched.map((item) => {
        const isSelected = selectedStationId === item.station.id;
        const priceUpdatedAt = item.station.pricesLastUpdatedAt;
        const priceTone = stationPriceTone(priceUpdatedAt, now);
        return (
          <Marker
            key={item.station.id}
            position={[item.station.location.lat, item.station.location.lng]}
            icon={makePinIcon(item.calculation.status, isSelected)}
            eventHandlers={{
              click: () => setSelectedStationId(item.station.id),
            }}
            zIndexOffset={isSelected ? 1000 : 0}
          >
            <Popup>
              <div className="min-w-[180px] space-y-1.5 text-slate-900">
                <p className="font-semibold">{item.station.name}</p>
                <p className="text-xs text-slate-600">{item.station.brand}</p>
                <StatusBadge status={item.calculation.status} />
                <p className="font-mono text-sm">
                  £{item.pricePerLitre.toFixed(3)}/L ·{" "}
                  {item.station.distanceOffRouteMiles.toFixed(1)} mi ·{" "}
                  {item.calculation.detourExtraMinutes < 0.5
                    ? "<1 min"
                    : `+${Math.round(item.calculation.detourExtraMinutes)} min`}
                </p>
                <p
                  className={cn(
                    "font-mono text-xs",
                    STATION_AGE_TEXT_CLASSES_LIGHT[priceTone]
                  )}
                  title={stationPriceAgeTitle(priceUpdatedAt, priceTone)}
                >
                  {priceUpdatedAt != null
                    ? `Price updated ${formatPriceAge(priceUpdatedAt, now)}`
                    : "Price update time unknown"}
                </p>
                <p className="font-mono text-sm font-bold">
                  Net {formatGbp(item.calculation.netAfterTime)}
                </p>
                <NavigateHere
                  className="mt-2"
                  primary
                  tone="light"
                  target={{
                    location: item.station.location,
                    name: item.station.name,
                    origin: originCoords,
                  }}
                />
              </div>
            </Popup>
          </Marker>
        );
      })}

      <FitBounds points={fitPoints} />
    </MapContainer>
  );
}

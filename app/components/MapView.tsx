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
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import { usePitstopStore } from "@/app/lib/store";
import { formatGbp } from "@/app/lib/detourCalculator";
import {
  formatPriceAge,
  stationPriceAgeTitle,
  stationPriceTone,
  STATION_AGE_TEXT_CLASSES_LIGHT,
} from "@/app/lib/freshness";
import type {
  DetourStatus,
  GeoPoint,
  StationWithCalculation,
} from "@/app/lib/types";
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

function makePinIcon(status: DetourStatus, selected: boolean, best = false) {
  const color = statusColor(status);
  const size = selected ? 34 : best ? 30 : 26;
  const ring = selected
    ? "3px solid #2dd4bf"
    : best
      ? "2.5px solid #2dd4bf"
      : "2px solid #0f172a";
  // Star marks the highest net-after-time forecourt, matching the "Best" card
  const star = best
    ? `<span style="color:#042f2e;font:700 ${Math.round(size * 0.55)}px/1 ui-sans-serif,system-ui;">★</span>`
    : "";

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${color};border:${ring};
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 0 4px ${color}33, 0 8px 16px rgba(0,0,0,.45);
    ">${star}</div>`,
  });
}

function makeClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  const size = count >= 50 ? 46 : count >= 20 ? 40 : 34;

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:#0f172a;border:2px solid #2dd4bf;
      display:flex;align-items:center;justify-content:center;
      color:#5eead4;font:700 ${count >= 100 ? 12 : 13}px/1 ui-sans-serif,system-ui;
      box-shadow:0 0 0 5px #2dd4bf26, 0 8px 16px rgba(0,0,0,.45);
    ">${count}</div>`,
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

/**
 * Leaflet only measures its container on mount, so when the sidebar is
 * toggled the map keeps its stale size and leaves blank space. Watch the
 * container and tell Leaflet to re-measure whenever it resizes.
 */
function InvalidateOnResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/**
 * react-leaflet's <ZoomControl> attaches during render commit and crashes with
 * "Cannot read properties of undefined (reading 'topright')" when fast refresh
 * hands it a torn-down map whose control corners are gone. Attach the control
 * in an effect and bail out if the map has already been destroyed.
 */
function SafeZoomControl({ position }: { position: L.ControlPosition }) {
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

  // Fresh key per component instance: fast refresh can leave the previous
  // Leaflet map attached to the old DOM node, and Leaflet throws "Map
  // container is being reused by another instance" if it re-initialises on
  // that node. A per-mount key guarantees a brand-new container element.
  const [mapInstanceKey] = useState(
    () => `map-${Math.random().toString(36).slice(2)}`
  );

  const selected = enriched.find((e) => e.station.id === selectedStationId);

  // Same rule as the sidebar's "Best" badge: highest net after time
  let best: StationWithCalculation | undefined;
  for (const item of enriched) {
    if (!best || item.calculation.netAfterTime > best.calculation.netAfterTime) {
      best = item;
    }
  }
  const bestId = best?.station.id ?? null;
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

  const renderStationMarker = (item: StationWithCalculation) => {
    const isSelected = selectedStationId === item.station.id;
    const isBest = bestId === item.station.id;
    const priceUpdatedAt = item.station.pricesLastUpdatedAt;
    const priceTone = stationPriceTone(priceUpdatedAt, now);
    return (
      <Marker
        key={item.station.id}
        position={[item.station.location.lat, item.station.location.lng]}
        icon={makePinIcon(item.calculation.status, isSelected, isBest)}
        eventHandlers={{
          click: () => setSelectedStationId(item.station.id),
        }}
        zIndexOffset={isSelected ? 1000 : isBest ? 500 : 0}
      >
        <Popup>
          <div className="min-w-[180px] space-y-1.5 text-slate-900">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold">{item.station.name}</p>
              {isBest && (
                <span className="inline-flex shrink-0 items-center rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 ring-1 ring-teal-500/35">
                  ★ Best
                </span>
              )}
            </div>
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
  };

  return (
    <MapContainer
      key={mapInstanceKey}
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
      <InvalidateOnResize />
      <SafeZoomControl position="topright" />
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

      {/* Cluster the rest of the pins so long corridors (100+ stations) stay
          readable. The selected and best stations render outside the cluster
          group below, so they never collapse into a cluster bubble. */}
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        maxClusterRadius={55}
        disableClusteringAtZoom={12}
        iconCreateFunction={makeClusterIcon}
      >
        {enriched
          .filter(
            (item) =>
              item.station.id !== selectedStationId &&
              item.station.id !== bestId
          )
          .map((item) => renderStationMarker(item))}
      </MarkerClusterGroup>
      {best && best.station.id !== selectedStationId && renderStationMarker(best)}
      {selected && renderStationMarker(selected)}

      <FitBounds points={fitPoints} />
    </MapContainer>
  );
}

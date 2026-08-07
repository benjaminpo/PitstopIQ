"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
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
  FUEL_TYPE_SHORT,
  fuelGradesForVehicle,
} from "@/app/lib/fuelConstants";
import {
  formatPriceAge,
  stationPriceAgeTitle,
  stationPriceTone,
  STATION_AGE_TEXT_CLASSES_LIGHT,
} from "@/app/lib/freshness";
import type {
  DetourStatus,
  FuelType,
  GeoPoint,
  StationWithCalculation,
} from "@/app/lib/types";
import { cn } from "@/app/lib/utils";
import { BrandLogo } from "./BrandLogo";
import { NavigateHere } from "./NavigateHere";
import { StatusBadge } from "./StatusBadge";

function popupGradePrices(
  item: StationWithCalculation,
  fuelType: FuelType
): Array<{
  fuel: FuelType;
  price: number;
  fromCommunity: boolean;
  updatedAt: number | null;
}> {
  const rows: Array<{
    fuel: FuelType;
    price: number;
    fromCommunity: boolean;
    updatedAt: number | null;
  }> = [];
  for (const fuel of fuelGradesForVehicle(fuelType)) {
    const communityPrice = item.community?.communityPrices[fuel];
    const fromCommunity =
      communityPrice != null && Number.isFinite(communityPrice);
    const price = fromCommunity
      ? communityPrice
      : item.station.prices[fuel];
    if (price == null || !Number.isFinite(price)) continue;
    rows.push({
      fuel,
      price,
      fromCommunity,
      updatedAt: fromCommunity
        ? item.community?.communityPriceUpdatedAt[fuel] ?? null
        : item.station.pricesUpdatedAt?.[fuel] ??
          item.station.pricesLastUpdatedAt ??
          null,
    });
  }
  if (rows.length === 0) {
    rows.push({
      fuel: fuelType,
      price: item.pricePerLitre,
      fromCommunity: Boolean(item.priceFromCommunity),
      updatedAt: item.priceFromCommunity
        ? item.community?.communityPriceUpdatedAt[fuelType] ?? null
        : item.station.pricesUpdatedAt?.[fuelType] ??
          item.station.pricesLastUpdatedAt ??
          null,
    });
  }
  return rows;
}

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
  let size = 26;
  if (selected) size = 34;
  else if (best) size = 30;
  let ring = "2px solid #0f172a";
  if (selected) ring = "3px solid #2dd4bf";
  else if (best) ring = "2.5px solid #2dd4bf";
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

/**
 * Cluster icons are per rating: each status gets its own cluster group, so a
 * bubble only ever counts stations sharing that verdict and wears its color.
 */
function makeClusterIconFor(status: DetourStatus) {
  const color = statusColor(status);
  return (cluster: { getChildCount: () => number }) => {
    const count = cluster.getChildCount();
    let size = 34;
    if (count >= 50) size = 46;
    else if (count >= 20) size = 40;

    return L.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:#0f172a;border:2px solid ${color};
        display:flex;align-items:center;justify-content:center;
        color:${color};font:700 ${count >= 100 ? 12 : 13}px/1 ui-sans-serif,system-ui;
        box-shadow:0 0 0 5px ${color}26, 0 8px 16px rgba(0,0,0,.45);
      ">${count}</div>`,
    });
  };
}

const CLUSTER_STATUSES: DetourStatus[] = ["worth", "neutral", "false_economy"];

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

interface FitPointsInputs {
  originCoords: GeoPoint | null;
  destinationCoords: GeoPoint | null;
  stopCoords: GeoPoint[];
  showingDetour: boolean;
  detourRoute: { coordinates: GeoPoint[] } | null;
  selected: StationWithCalculation | undefined;
  route: { coordinates: GeoPoint[] } | null;
  enriched: StationWithCalculation[];
}

function computeFitPoints(args: FitPointsInputs): GeoPoint[] {
  const {
    originCoords,
    destinationCoords,
    stopCoords,
    showingDetour,
    detourRoute,
    selected,
    route,
    enriched,
  } = args;
  const pts: GeoPoint[] = [];
  if (originCoords) pts.push(originCoords);
  pts.push(...stopCoords);
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
}

/**
 * Memoized in its own hook: inside MapView the compiler lint refuses a
 * useMemo on `enriched`/`selected` because they later flow into marker
 * rendering, but scoped here nothing touches the deps after the memo.
 * The store keeps `enriched` referentially stable, so this actually caches.
 */
function useFitPoints(args: FitPointsInputs): GeoPoint[] {
  const {
    originCoords,
    destinationCoords,
    stopCoords,
    showingDetour,
    detourRoute,
    selected,
    route,
    enriched,
  } = args;

  return useMemo(
    () =>
      computeFitPoints({
        originCoords,
        destinationCoords,
        stopCoords,
        showingDetour,
        detourRoute,
        selected,
        route,
        enriched,
      }),
    [
      originCoords,
      destinationCoords,
      stopCoords,
      showingDetour,
      detourRoute,
      selected,
      route,
      enriched,
    ]
  );
}

/** Roughly centres the UK before any trip is entered */
const FALLBACK_CENTER: GeoPoint = { lat: 53.0, lng: -1.8 };
const FALLBACK_ZOOM = 6;

/** Monotonic id so each MapView mount gets a unique container key. */
let nextMapInstanceId = 0;

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
    stops,
    route,
    detourRoute,
    getEnrichedStations,
    selectedStationId,
    setSelectedStationId,
    vehicle,
  } = usePitstopStore();

  const enriched = getEnrichedStations();
  const stopCoords = stops
    .map((s) => s.coords)
    .filter((c): c is NonNullable<typeof c> => c != null);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Fresh key per component instance: fast refresh can leave the previous
  // Leaflet map attached to the old DOM node, and Leaflet throws "Map
  // container is being reused by another instance" if it re-initialises on
  // that node. A per-mount key guarantees a brand-new container element.
  const [mapInstanceKey] = useState(() => `map-${nextMapInstanceId++}`);

  const selected = enriched.find((e) => e.station.id === selectedStationId);

  // Same rule as the sidebar's "Best" badge: highest net after time
  const best = enriched.reduce<StationWithCalculation | undefined>(
    (top, item) =>
      !top || item.calculation.netAfterTime > top.calculation.netAfterTime
        ? item
        : top,
    undefined
  );
  const bestId = best?.station.id ?? null;
  const showingDetour = Boolean(
    selected && detourRoute && detourRoute.coordinates.length > 1
  );

  const baseLine = useMemo(() => {
    if (route?.coordinates?.length && route.coordinates.length > 1) {
      return toLatLngs(route.coordinates);
    }
    if (originCoords && destinationCoords) {
      return toLatLngs([originCoords, ...stopCoords, destinationCoords]);
    }
    return null;
  }, [route, originCoords, destinationCoords, stopCoords]);

  const detourLine = useMemo(() => {
    if (!detourRoute?.coordinates?.length) return null;
    return toLatLngs(detourRoute.coordinates);
  }, [detourRoute]);

  const isDrivingRoute = Boolean(route && route.coordinates.length > 2);

  // Dashed when muted behind a detour, or when it's just a straight
  // A→B line rather than a real driving route.
  let baseLineDashArray: string | undefined;
  if (showingDetour) baseLineDashArray = "6 10";
  else if (!isDrivingRoute) baseLineDashArray = "10 8";

  const fitPoints = useFitPoints({
    originCoords,
    destinationCoords,
    stopCoords,
    showingDetour,
    detourRoute,
    selected,
    route,
    enriched,
  });

  const renderStationMarker = (item: StationWithCalculation) => {
    const isSelected = selectedStationId === item.station.id;
    const isBest = bestId === item.station.id;
    const gradeRows = popupGradePrices(item, vehicle.fuelType);
    let zIndexOffset = 0;
    if (isSelected) zIndexOffset = 1000;
    else if (isBest) zIndexOffset = 500;
    return (
      <Marker
        key={item.station.id}
        position={[item.station.location.lat, item.station.location.lng]}
        icon={makePinIcon(item.calculation.status, isSelected, isBest)}
        eventHandlers={{
          click: () => setSelectedStationId(item.station.id),
        }}
        zIndexOffset={zIndexOffset}
      >
        <Popup>
          <div className="min-w-[180px] space-y-1.5 text-slate-900">
            <div className="flex items-start gap-2">
              <BrandLogo brand={item.station.brand} size="md" className="mt-0.5" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold">{item.station.name}</p>
                  {isBest && (
                    <span className="inline-flex shrink-0 items-center rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 ring-1 ring-teal-500/35">
                      ★ Best
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">{item.station.brand}</p>
                {(item.station.address || item.station.postcode) && (
                  <p className="text-[11px] leading-snug text-slate-500">
                    {[item.station.address, item.station.postcode]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <StatusBadge status={item.calculation.status} />
            <ul className="space-y-1 font-mono text-sm">
              {gradeRows.map((row) => {
                const rowTone = stationPriceTone(row.updatedAt, now);
                return (
                  <li key={row.fuel} className="space-y-0.5">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-600">
                        {FUEL_TYPE_SHORT[row.fuel]}
                        {row.fromCommunity ? " · members" : ""}
                      </span>
                      <span>£{row.price.toFixed(3)}/L</span>
                    </div>
                    <p
                      className={cn(
                        "text-[10px]",
                        STATION_AGE_TEXT_CLASSES_LIGHT[rowTone]
                      )}
                      title={stationPriceAgeTitle(row.updatedAt, rowTone)}
                    >
                      {row.updatedAt != null
                        ? `Updated ${formatPriceAge(row.updatedAt, now)}`
                        : "Update time unknown"}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="font-mono text-sm text-slate-700">
              {item.station.distanceOffRouteMiles.toFixed(1)} mi ·{" "}
              {item.calculation.detourExtraMinutes < 0.5
                ? "<1 min"
                : `+${Math.round(item.calculation.detourExtraMinutes)} min`}
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Routing © <a href="http://project-osrm.org">OSRM</a> / <a href="https://github.com/valhalla/valhalla">Valhalla</a>'
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
              dashArray: baseLineDashArray,
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
        <Marker
          position={[originCoords.lat, originCoords.lng]}
          icon={endpointIcon("A", "#0d9488")}
        >
          <Popup>Origin · {origin}</Popup>
        </Marker>
      )}
      {stops.map((stop, index) =>
        stop.coords ? (
          <Marker
            key={stop.id}
            position={[stop.coords.lat, stop.coords.lng]}
            icon={endpointIcon(String(index + 1), "#d97706")}
          >
            <Popup>
              Stop {index + 1} · {stop.label || "Stop"}
            </Popup>
          </Marker>
        ) : null
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
          readable. One cluster group per rating, so pins only merge with
          others sharing the same verdict and the bubble wears that color.
          The selected and best stations render outside the cluster groups
          below, so they never collapse into a cluster bubble. */}
      {CLUSTER_STATUSES.map((status) => (
        <MarkerClusterGroup
          key={status}
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          maxClusterRadius={55}
          disableClusteringAtZoom={12}
          iconCreateFunction={makeClusterIconFor(status)}
        >
          {enriched
            .filter(
              (item) =>
                item.calculation.status === status &&
                item.station.id !== selectedStationId &&
                item.station.id !== bestId
            )
            .map((item) => renderStationMarker(item))}
        </MarkerClusterGroup>
      ))}
      {best && best.station.id !== selectedStationId && renderStationMarker(best)}
      {selected && renderStationMarker(selected)}

      <FitBounds points={fitPoints} />
    </MapContainer>
  );
}

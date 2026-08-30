"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import { BasemapLayer } from "@/app/components/BasemapLayer";
import {
  MAP_MAX_ZOOM,
  PLANNER_BASEMAP_ATTRIBUTION,
} from "@/app/lib/mapTiles";
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
  formatOfficialPriceAgeLine,
  formatPriceAge,
  stationPriceAgeTitle,
  stationPriceTone,
  STATION_AGE_TEXT_CLASSES_LIGHT,
  type PriceFreshnessFilter,
} from "@/app/lib/freshness";
import type {
  DetourStatus,
  FuelType,
  GeoPoint,
  StationWithCalculation,
} from "@/app/lib/types";
import { isSameLocation } from "@/app/lib/routing";
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

function communityPriceAgeLabel(
  updatedAt: number | null,
  now: number
): string {
  if (updatedAt == null) return "Update time unknown";
  return `Updated ${formatPriceAge(updatedAt, now)}`;
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
  if (maxSamples < 2) return [coords[0]!];
  // Even spacing that always keeps both endpoints — dropping the last
  // vertex used to clip fitBounds short of the full driving polyline.
  const last = coords.length - 1;
  const out: GeoPoint[] = new Array(maxSamples);
  const step = last / (maxSamples - 1);
  for (let i = 0; i < maxSamples; i++) {
    out[i] = coords[Math.min(last, Math.round(i * step))]!;
  }
  out[maxSamples - 1] = coords[last]!;
  return out;
}

function isNearbySearch(
  originCoords: GeoPoint | null,
  destinationCoords: GeoPoint | null,
  stopCoords: GeoPoint[]
): boolean {
  if (!originCoords || !destinationCoords || stopCoords.length > 0) return false;
  return isSameLocation(originCoords, destinationCoords);
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
    if (route?.coordinates?.length) {
      pts.push(...sampleRoute(route.coordinates));
    }
    return pts;
  }
  if (
    isNearbySearch(originCoords, destinationCoords, stopCoords) &&
    enriched.length > 0 &&
    originCoords
  ) {
    // Frame the whole nearby search area — origin + best alone zooms in so
    // tightly that other forecourts (and later detours) sit off-screen.
    return [
      originCoords,
      ...enriched.map((item) => item.station.location),
    ];
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

function SafeLocationControl({
  locating,
  onLocate,
}: {
  locating: boolean;
  onLocate: () => void;
}) {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const corners = (map as unknown as { _controlCorners?: unknown })
      ._controlCorners;
    if (!corners) return;

    const control = new L.Control({ position: "topright" });
    control.onAdd = () => {
      const container = L.DomUtil.create(
        "div",
        "leaflet-bar pitstop-location-control"
      );
      const button = L.DomUtil.create(
        "button",
        "pitstop-location-control__button",
        container
      ) as HTMLButtonElement;
      button.type = "button";
      button.title = "Use my location";
      button.setAttribute("aria-label", "Use current location as origin");
      button.addEventListener("click", onLocate);
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      buttonRef.current = button;
      return container;
    };
    control.addTo(map);

    return () => {
      const button = buttonRef.current;
      if (button) button.removeEventListener("click", onLocate);
      buttonRef.current = null;
      control.remove();
    };
  }, [map, onLocate]);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    button.disabled = locating;
    button.setAttribute("aria-busy", String(locating));
    button.innerHTML = locating
      ? '<svg class="animate-spin" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.94 3A9 9 0 0 0 13 3.06V1h-2v2.06A9 9 0 0 0 3.06 11H1v2h2.06A9 9 0 0 0 11 20.94V23h2v-2.06A9 9 0 0 0 20.94 13H23v-2h-2.06ZM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"/></svg>';
  }, [locating]);

  return null;
}

function mapChromePad(options?: {
  selectedStationId?: string | null;
  sidebarOpen?: boolean;
}): { top: number; right: number; bottom: number; left: number; maxZoom: number } {
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;
  const selected = Boolean(options?.selectedStationId);
  const showMobileBar =
    isMobile && selected && !options?.sidebarOpen;
  let bottom = 48;
  if (showMobileBar) bottom = 210;
  else if (selected) bottom = 88;
  return {
    top: selected ? 80 : 72,
    left: 40,
    right: 36,
    bottom,
    maxZoom: selected ? 13 : 15,
  };
}

/** Pixel padding so fitBounds clears map chrome (locate/zoom + mobile CTA). */
function mapFitPadding(options?: {
  selectedStationId?: string | null;
  sidebarOpen?: boolean;
}): L.FitBoundsOptions {
  const pad = mapChromePad(options);
  return {
    paddingTopLeft: [pad.left, pad.top],
    paddingBottomRight: [pad.right, pad.bottom],
    maxZoom: pad.maxZoom,
  };
}

function pixelUnion(
  map: L.Map,
  points: GeoPoint[],
  popupEl: HTMLElement | null
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  if (points.length > 0) {
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    const sw = map.latLngToContainerPoint(bounds.getSouthWest());
    const ne = map.latLngToContainerPoint(bounds.getNorthEast());
    minX = Math.min(sw.x, ne.x);
    maxX = Math.max(sw.x, ne.x);
    minY = Math.min(sw.y, ne.y);
    maxY = Math.max(sw.y, ne.y);
  }
  if (popupEl) {
    const mapRect = map.getContainer().getBoundingClientRect();
    const rect = popupEl.getBoundingClientRect();
    minX = Math.min(minX, rect.left - mapRect.left);
    maxX = Math.max(maxX, rect.right - mapRect.left);
    minY = Math.min(minY, rect.top - mapRect.top);
    maxY = Math.max(maxY, rect.bottom - mapRect.top);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxY)) return null;
  return { minX, maxX, minY, maxY };
}

/** Pan so the route and the open station popup sit as one group in the map. */
function frameRouteAndPopup(
  map: L.Map,
  points: GeoPoint[],
  marker: L.Marker,
  pad: { top: number; right: number; bottom: number; left: number }
): void {
  const size = map.getSize();
  const viewX = pad.left + (size.x - pad.left - pad.right) / 2;
  const viewY = pad.top + (size.y - pad.top - pad.bottom) / 2;
  const union = pixelUnion(
    map,
    points,
    marker.getPopup()?.getElement() ?? null
  );
  if (!union) return;
  const dx = (union.minX + union.maxX) / 2 - viewX;
  const dy = (union.minY + union.maxY) / 2 - viewY;
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
  map.panBy([dx, dy], { animate: true });
}

function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  const selectedStationId = usePitstopStore((s) => s.selectedStationId);
  const sidebarOpen = usePitstopStore((s) => s.sidebarOpen);
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    const selected = Boolean(selectedStationId);
    map.fitBounds(
      bounds.pad(selected ? 0.06 : 0.08),
      mapFitPadding({ selectedStationId, sidebarOpen })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, selectedStationId, sidebarOpen]);

  return null;
}

function FocusBestStations({
  freshnessFilter,
  openNowFilter,
  enriched,
  originCoords,
  destinationCoords,
  stopCoords,
  detourRoute,
}: {
  freshnessFilter: PriceFreshnessFilter;
  openNowFilter: boolean;
  enriched: StationWithCalculation[];
  originCoords: GeoPoint | null;
  destinationCoords: GeoPoint | null;
  stopCoords: GeoPoint[];
  detourRoute: { coordinates: GeoPoint[] } | null;
}) {
  const map = useMap();
  const selectedStationId = usePitstopStore((s) => s.selectedStationId);
  const sidebarOpen = usePitstopStore((s) => s.sidebarOpen);
  const previousFreshness = useRef(freshnessFilter);
  const previousOpenNow = useRef(openNowFilter);
  /** Keep focusing until a nearby-search detour route arrives after a filter flip. */
  const pendingNearbyRouteFocus = useRef(false);

  useEffect(() => {
    const freshnessChanged = previousFreshness.current !== freshnessFilter;
    const openNowChanged = previousOpenNow.current !== openNowFilter;
    previousFreshness.current = freshnessFilter;
    previousOpenNow.current = openNowFilter;

    const nearby = isNearbySearch(
      originCoords,
      destinationCoords,
      stopCoords
    );

    if (freshnessChanged || openNowChanged) {
      if (nearby) pendingNearbyRouteFocus.current = true;
      else pendingNearbyRouteFocus.current = false;
    }

    if (!freshnessChanged && !openNowChanged && !pendingNearbyRouteFocus.current) {
      return;
    }
    if (enriched.length === 0) return;

    const best = enriched.reduce(
      (top, item) =>
        item.calculation.netAfterTime > top.calculation.netAfterTime
          ? item
          : top,
      enriched[0]!
    );

    const pad = mapFitPadding({ selectedStationId, sidebarOpen });

    if (nearby && originCoords) {
      // Prefer the drawn A→station route once it lands; otherwise frame the
      // full nearby station set so nothing important is clipped off-map.
      if (detourRoute?.coordinates?.length) {
        pendingNearbyRouteFocus.current = false;
        const bounds = L.latLngBounds(
          sampleRoute(detourRoute.coordinates).map((p) => [p.lat, p.lng])
        );
        bounds.extend([best.station.location.lat, best.station.location.lng]);
        bounds.extend([originCoords.lat, originCoords.lng]);
        map.fitBounds(bounds.pad(0.12), { ...pad, maxZoom: 14 });
        return;
      }

      const bounds = L.latLngBounds([
        [originCoords.lat, originCoords.lng],
        [best.station.location.lat, best.station.location.lng],
      ]);
      for (const item of enriched) {
        bounds.extend([
          item.station.location.lat,
          item.station.location.lng,
        ]);
      }
      map.fitBounds(bounds.pad(0.12), { ...pad, maxZoom: 14 });
      return;
    }

    if (!freshnessChanged && !openNowChanged) return;

    const top = [...enriched]
      .sort(
        (a, b) =>
          b.calculation.netAfterTime - a.calculation.netAfterTime
      )
      .slice(0, 3);
    const bounds = L.latLngBounds(
      top.map((item) => [
        item.station.location.lat,
        item.station.location.lng,
      ])
    );
    map.fitBounds(bounds.pad(0.12), { ...pad, maxZoom: 12 });
  }, [
    map,
    freshnessFilter,
    openNowFilter,
    enriched,
    originCoords,
    destinationCoords,
    stopCoords,
    detourRoute,
    selectedStationId,
    sidebarOpen,
  ]);

  return null;
}

function StationMarker({
  item,
  isSelected,
  isBest,
  now,
}: {
  item: StationWithCalculation;
  isSelected: boolean;
  isBest: boolean;
  now: number;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const setSelectedStationId = usePitstopStore((s) => s.setSelectedStationId);
  const vehicle = usePitstopStore((s) => s.vehicle);
  const pricesFetchedAt = usePitstopStore((s) => s.pricesFetchedAt);
  const originCoords = usePitstopStore((s) => s.originCoords);
  const destinationCoords = usePitstopStore((s) => s.destinationCoords);
  const route = usePitstopStore((s) => s.route);
  const detourRoute = usePitstopStore((s) => s.detourRoute);
  const detourRouting = usePitstopStore((s) => s.detourRouting);
  const sidebarOpen = usePitstopStore((s) => s.sidebarOpen);
  const gradeRows = popupGradePrices(item, vehicle.fuelType);
  let zIndexOffset = 0;
  if (isSelected) zIndexOffset = 1000;
  else if (isBest) zIndexOffset = 500;

  useEffect(() => {
    if (!isSelected) return;

    let cancelled = false;
    let opened = false;
    let panTimer: ReturnType<typeof window.setTimeout> | undefined;
    const open = () => {
      if (cancelled || opened) return;
      const marker = markerRef.current;
      if (!marker) return;
      opened = true;
      marker.openPopup();
      const pad = mapChromePad({
        selectedStationId: item.station.id,
        sidebarOpen,
      });
      panTimer = window.setTimeout(() => {
        if (cancelled) return;
        const framePoints: GeoPoint[] = [item.station.location];
        if (originCoords) framePoints.push(originCoords);
        if (destinationCoords) framePoints.push(destinationCoords);
        if (route?.coordinates?.length) {
          framePoints.push(...sampleRoute(route.coordinates));
        }
        if (detourRoute?.coordinates?.length) {
          framePoints.push(...sampleRoute(detourRoute.coordinates));
        }
        frameRouteAndPopup(map, framePoints, marker, pad);
      }, 80);
    };
    map.once("moveend", open);
    const fallback = window.setTimeout(open, 400);
    return () => {
      cancelled = true;
      map.off("moveend", open);
      window.clearTimeout(fallback);
      if (panTimer) window.clearTimeout(panTimer);
    };
  }, [
    isSelected,
    item.station.id,
    item.station.location,
    map,
    detourRouting,
    sidebarOpen,
    originCoords,
    destinationCoords,
    route,
    detourRoute,
  ]);

  return (
    <Marker
      ref={markerRef}
      position={[item.station.location.lat, item.station.location.lng]}
      icon={makePinIcon(item.calculation.status, isSelected, isBest)}
      eventHandlers={{
        click: () => setSelectedStationId(item.station.id),
      }}
      zIndexOffset={zIndexOffset}
    >
      <Popup autoPan={false}>
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
                    title={stationPriceAgeTitle(
                      row.updatedAt,
                      rowTone,
                      row.fromCommunity ? undefined : pricesFetchedAt
                    )}
                  >
                    {row.fromCommunity
                      ? communityPriceAgeLabel(row.updatedAt, now)
                      : formatOfficialPriceAgeLine(
                          row.updatedAt,
                          pricesFetchedAt,
                          now
                        )}
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
    priceFreshnessFilter,
    openNowFilter,
    locateCurrentPosition,
    locating,
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
  const handleLocate = useCallback(() => {
    void locateCurrentPosition("origin");
  }, [locateCurrentPosition]);

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

  return (
    <MapContainer
      key={mapInstanceKey}
      center={
        originCoords
          ? [originCoords.lat, originCoords.lng]
          : [FALLBACK_CENTER.lat, FALLBACK_CENTER.lng]
      }
      zoom={originCoords ? 10 : FALLBACK_ZOOM}
      maxZoom={MAP_MAX_ZOOM}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <InvalidateOnResize />
      <SafeLocationControl
        locating={locating}
        onLocate={handleLocate}
      />
      <SafeZoomControl position="topright" />
      <BasemapLayer attribution={PLANNER_BASEMAP_ATTRIBUTION} />

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
      {showingDetour && detourLine && (
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
            .map((item) => (
              <StationMarker
                key={item.station.id}
                item={item}
                isSelected={false}
                isBest={false}
                now={now}
              />
            ))}
        </MarkerClusterGroup>
      ))}
      {best && best.station.id !== selectedStationId && (
        <StationMarker
          key={best.station.id}
          item={best}
          isSelected={false}
          isBest
          now={now}
        />
      )}
      {selected && (
        <StationMarker
          key={selected.station.id}
          item={selected}
          isSelected
          isBest={bestId === selected.station.id}
          now={now}
        />
      )}

      <FitBounds points={fitPoints} />
      <FocusBestStations
        freshnessFilter={priceFreshnessFilter}
        openNowFilter={openNowFilter}
        enriched={enriched}
        originCoords={originCoords}
        destinationCoords={destinationCoords}
        stopCoords={stopCoords}
        detourRoute={detourRoute}
      />
    </MapContainer>
  );
}

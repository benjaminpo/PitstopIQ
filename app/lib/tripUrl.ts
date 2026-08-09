import type { FuelType, GeoPoint, TripStop, VehicleProfile } from "./types";
import { MAX_TRIP_STOPS } from "./types";
import { ALL_FUEL_TYPES } from "./fuelConstants";
import {
  DEFAULT_ROUTE_AVOID,
  parseRouteAvoidParam,
  routeAvoidEqual,
  serializeRouteAvoid,
  type RouteAvoidOptions,
} from "./routeAvoid";
import { emptyTripStop } from "./tripPath";

const FUEL_TYPES = new Set<FuelType>(ALL_FUEL_TYPES);

export interface TripSnapshot {
  origin: string;
  destination: string;
  /** Null when the user hasn't picked that end of the trip yet */
  originCoords: GeoPoint | null;
  destinationCoords: GeoPoint | null;
  /** Intermediate stops between origin and destination */
  stops: TripStop[];
  routeAvoid: RouteAvoidOptions;
  vehicle: VehicleProfile;
  litresToRefill: number;
  valueOfTimeGbpPerHour: number;
  baseRouteAvgPricePerLitre?: number;
  basePriceManual?: boolean;
}

function parseCoordPair(raw: string | null): GeoPoint | null {
  if (!raw) return null;
  const [latStr, lngStr] = raw.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parseNumber(
  raw: string | null,
  min: number,
  max: number
): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

function isFuelType(v: string): v is FuelType {
  return FUEL_TYPES.has(v as FuelType);
}

function parseViaStops(
  viaRaw: string | null,
  labelsRaw: string | null
): TripStop[] {
  if (!viaRaw?.trim()) return [];
  const labels = labelsRaw?.split("|") ?? [];
  const stops: TripStop[] = [];
  for (const part of viaRaw.split("|")) {
    if (stops.length >= MAX_TRIP_STOPS) break;
    const coords = parseCoordPair(part.trim());
    if (!coords) continue;
    const label =
      labels[stops.length]?.trim() ||
      `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    stops.push({
      id: emptyTripStop().id,
      label,
      coords,
    });
  }
  return stops;
}

/**
 * Read a shareable trip from the URL query string.
 * Returns null when there are no trip coordinates (normal first visit).
 */
export function parseTripSearchParams(
  search: string
): Partial<TripSnapshot> | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );

  const originCoords = parseCoordPair(params.get("from"));
  const destinationCoords = parseCoordPair(params.get("to"));
  const stops = parseViaStops(params.get("via"), params.get("viaLabel"));

  const hasVehicleHints =
    params.has("fuel") ||
    params.has("mpg") ||
    params.has("tank") ||
    params.has("fill") ||
    params.has("refill") ||
    params.has("vot") ||
    params.has("base") ||
    params.has("avoid") ||
    params.has("via");

  if (!originCoords && !destinationCoords && !hasVehicleHints) {
    return null;
  }

  const snap: Partial<TripSnapshot> = {};

  if (originCoords) {
    snap.originCoords = originCoords;
    snap.origin =
      params.get("fromLabel")?.trim() ||
      `${originCoords.lat.toFixed(4)}, ${originCoords.lng.toFixed(4)}`;
  }
  if (destinationCoords) {
    snap.destinationCoords = destinationCoords;
    snap.destination =
      params.get("toLabel")?.trim() ||
      `${destinationCoords.lat.toFixed(4)}, ${destinationCoords.lng.toFixed(4)}`;
  }
  if (stops.length > 0) snap.stops = stops;

  const avoid = parseRouteAvoidParam(params.get("avoid"));
  if (avoid) snap.routeAvoid = avoid;

  const fuel = params.get("fuel");
  const mpg = parseNumber(params.get("mpg"), 1, 150);
  const tank = parseNumber(params.get("tank"), 10, 150);
  const fill = parseNumber(params.get("fill"), 0, 100);
  if (fuel || mpg != null || tank != null || fill != null) {
    snap.vehicle = {
      fuelType: fuel && isFuelType(fuel) ? fuel : "E10",
      mpg: mpg ?? 45,
      tankCapacityLitres: tank ?? 40,
      fillPercentage: fill ?? 25,
    };
  }

  const refill = parseNumber(params.get("refill"), 1, 150);
  if (refill != null) snap.litresToRefill = refill;

  const vot = parseNumber(params.get("vot"), 0, 200);
  if (vot != null) snap.valueOfTimeGbpPerHour = vot;

  const base = parseNumber(params.get("base"), 0.5, 3);
  if (base != null) {
    snap.baseRouteAvgPricePerLitre = base;
    snap.basePriceManual = true;
  }

  return snap;
}

/** Serialize a trip into compact query params for bookmarks / sharing. */
export function buildTripSearchParams(trip: TripSnapshot): URLSearchParams {
  const params = new URLSearchParams();

  if (trip.originCoords) {
    params.set(
      "from",
      `${trip.originCoords.lat.toFixed(5)},${trip.originCoords.lng.toFixed(5)}`
    );
    if (trip.origin.trim()) params.set("fromLabel", trip.origin.trim());
  }
  if (trip.destinationCoords) {
    params.set(
      "to",
      `${trip.destinationCoords.lat.toFixed(5)},${trip.destinationCoords.lng.toFixed(5)}`
    );
    if (trip.destination.trim()) params.set("toLabel", trip.destination.trim());
  }

  const resolvedStops = (trip.stops ?? []).filter((s) => s.coords != null);
  if (resolvedStops.length > 0) {
    params.set(
      "via",
      resolvedStops
        .map(
          (s) =>
            `${s.coords!.lat.toFixed(5)},${s.coords!.lng.toFixed(5)}`
        )
        .join("|")
    );
    const labels = resolvedStops.map((s) => s.label.trim()).filter(Boolean);
    if (labels.length > 0) params.set("viaLabel", labels.join("|"));
  }

  params.set("fuel", trip.vehicle.fuelType);
  params.set("mpg", String(Number(trip.vehicle.mpg.toFixed(1))));
  params.set("tank", String(Math.round(trip.vehicle.tankCapacityLitres)));
  params.set("fill", String(Math.round(trip.vehicle.fillPercentage)));
  params.set("refill", String(Math.round(trip.litresToRefill)));
  params.set("vot", String(Math.round(trip.valueOfTimeGbpPerHour)));

  const avoidToken = serializeRouteAvoid(
    trip.routeAvoid ?? DEFAULT_ROUTE_AVOID
  );
  if (avoidToken) params.set("avoid", avoidToken);

  if (
    trip.basePriceManual &&
    trip.baseRouteAvgPricePerLitre != null &&
    Number.isFinite(trip.baseRouteAvgPricePerLitre)
  ) {
    params.set("base", trip.baseRouteAvgPricePerLitre.toFixed(3));
  }

  return params;
}

export function tripToShareUrl(
  trip: TripSnapshot,
  baseHref = typeof window !== "undefined" ? window.location.href : ""
): string {
  const url = new URL(baseHref || "http://localhost/");
  url.search = buildTripSearchParams(trip).toString();
  return url.toString();
}

function coordsEqual(a: GeoPoint | null, b: GeoPoint | null): boolean {
  if (a === null || b === null) return a === b;
  return a.lat === b.lat && a.lng === b.lng;
}

function stopsEqual(a: TripStop[] | undefined, b: TripStop[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every(
    (s, i) =>
      s.label === right[i].label && coordsEqual(s.coords, right[i].coords)
  );
}

export function tripFieldsEqual(a: TripSnapshot, b: TripSnapshot): boolean {
  return (
    a.origin === b.origin &&
    a.destination === b.destination &&
    coordsEqual(a.originCoords, b.originCoords) &&
    coordsEqual(a.destinationCoords, b.destinationCoords) &&
    stopsEqual(a.stops, b.stops) &&
    routeAvoidEqual(
      a.routeAvoid ?? DEFAULT_ROUTE_AVOID,
      b.routeAvoid ?? DEFAULT_ROUTE_AVOID
    ) &&
    a.vehicle.fuelType === b.vehicle.fuelType &&
    a.vehicle.mpg === b.vehicle.mpg &&
    a.vehicle.tankCapacityLitres === b.vehicle.tankCapacityLitres &&
    a.vehicle.fillPercentage === b.vehicle.fillPercentage &&
    a.litresToRefill === b.litresToRefill &&
    a.valueOfTimeGbpPerHour === b.valueOfTimeGbpPerHour &&
    Boolean(a.basePriceManual) === Boolean(b.basePriceManual) &&
    (a.basePriceManual
      ? a.baseRouteAvgPricePerLitre === b.baseRouteAvgPricePerLitre
      : true)
  );
}

import type { GeoPoint, MapBounds } from "./types";

export interface DrivingRoute {
  distanceMiles: number;
  durationSeconds: number;
  coordinates: GeoPoint[];
  bounds: MapBounds;
}

const METERS_PER_MILE = 1609.344;
/** Approximate miles per degree of latitude (UK). */
const MILES_PER_DEGREE_LAT = 69;

/**
 * Max perpendicular distance from the OSRM route polyline for a station to
 * be scored. Stations outside this corridor are discarded (bbox corners go).
 */
export const CORRIDOR_MAX_DISTANCE_MILES = 3;

/** Degrees of lat/lng padding so the fetch bbox covers the corridor. */
export function corridorPadDegrees(
  miles = CORRIDOR_MAX_DISTANCE_MILES
): number {
  return miles / MILES_PER_DEGREE_LAT + 0.015;
}

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.7613;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bounding box of a path, padded to cover the scoring corridor. */
export function boundsFromCoordinates(
  points: GeoPoint[],
  padDegrees = corridorPadDegrees()
): MapBounds {
  if (points.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  return {
    north: north + padDegrees,
    south: south - padDegrees,
    east: east + padDegrees,
    west: west - padDegrees,
  };
}

/**
 * Thin a dense OSRM polyline for faster distance-to-route checks while
 * keeping endpoints and roughly even spacing.
 */
export function downsampleRoute(
  route: GeoPoint[],
  maxPoints = 250
): GeoPoint[] {
  if (route.length <= maxPoints) return route;
  if (maxPoints < 2) return [route[0]];

  const last = route.length - 1;
  const out: GeoPoint[] = new Array(maxPoints);
  const step = last / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    // Clamp: floating-point round(i * step) can theoretically land on
    // route.length for some (n, m) pairs; always stay in [0, last].
    const idx = Math.min(last, Math.round(i * step));
    out[i] = route[idx];
  }
  // Guarantee the final vertex is the true endpoint (not a rounded neighbour).
  out[maxPoints - 1] = route[last];
  return out;
}

/** Shortest haversine distance from a point to a polyline (miles). */
export function distanceToRouteMiles(
  point: GeoPoint,
  route: GeoPoint[]
): number {
  return nearestOnRoute(point, route).distToRoute;
}

/**
 * Nearest point on a route polyline: perpendicular distance plus miles
 * along the polyline from the start to that closest point.
 */
export function nearestOnRoute(
  point: GeoPoint,
  route: GeoPoint[]
): { distToRoute: number; alongRouteMiles: number } {
  if (route.length === 0) {
    return { distToRoute: Infinity, alongRouteMiles: 0 };
  }
  if (route.length === 1) {
    return {
      distToRoute: haversineMiles(point, route[0]),
      alongRouteMiles: 0,
    };
  }

  let bestDist = Infinity;
  let bestAlong = 0;
  let walked = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const segLen = haversineMiles(a, b);
    const { dist, t } = pointToSegmentProjection(point, a, b);
    if (dist < bestDist) {
      bestDist = dist;
      bestAlong = walked + t * segLen;
    }
    walked += segLen;
  }

  return { distToRoute: bestDist, alongRouteMiles: bestAlong };
}

/**
 * Estimated driving miles from trip origin to a station: distance along the
 * route to the nearest point, plus the spur off the route to the forecourt.
 */
export function milesFromOriginToStation(
  station: GeoPoint,
  route: GeoPoint[],
  origin?: GeoPoint | null
): number {
  if (route.length >= 2) {
    const { distToRoute, alongRouteMiles } = nearestOnRoute(station, route);
    return alongRouteMiles + distToRoute;
  }
  if (origin) return haversineMiles(origin, station);
  return Infinity;
}

/**
 * Keep only stations within the corridor half-width of the route polyline,
 * nearest-first.
 */
export function filterToRouteCorridor<T extends { location: GeoPoint }>(
  stations: T[],
  route: GeoPoint[],
  maxDistanceMiles = CORRIDOR_MAX_DISTANCE_MILES
): Array<{ station: T; distToRoute: number }> {
  const polyline = downsampleRoute(route);
  return stations
    .map((station) => ({
      station,
      distToRoute: distanceToRouteMiles(station.location, polyline),
    }))
    .filter(({ distToRoute }) => distToRoute <= maxDistanceMiles)
    .sort((a, b) => a.distToRoute - b.distToRoute);
}

function pointToSegmentProjection(
  p: GeoPoint,
  a: GeoPoint,
  b: GeoPoint
): { dist: number; t: number } {
  // Equirectangular projection around segment for a local planar estimate
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(midLat);
  const ax = a.lng * cosLat;
  const ay = a.lat;
  const bx = b.lng * cosLat;
  const by = b.lat;
  const px = p.lng * cosLat;
  const py = p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const dist = haversineMiles(p, {
    lat: cy,
    lng: cosLat === 0 ? a.lng : cx / cosLat,
  });
  return { dist, t };
}

/**
 * Approximate extra miles to leave the route, visit a station, and rejoin:
 * ~2 × perpendicular distance to the route polyline.
 */
export function approximateDetourMiles(
  station: GeoPoint,
  route: GeoPoint[]
): number {
  const d = distanceToRouteMiles(station, route);
  if (!Number.isFinite(d)) return 0;
  return Number((d * 2).toFixed(2));
}

/** Fallback UK mixed-road average when no route timing is available. */
const FALLBACK_AVG_MPH = 35;

/**
 * Estimate extra driving seconds from extra miles using the main route's
 * average speed (or a UK mixed-road fallback).
 */
export function approximateDetourSeconds(
  extraMiles: number,
  route?: Pick<DrivingRoute, "distanceMiles" | "durationSeconds"> | null
): number {
  if (extraMiles <= 0) return 0;
  let avgMph = FALLBACK_AVG_MPH;
  if (
    route &&
    route.distanceMiles > 0 &&
    route.durationSeconds > 0
  ) {
    avgMph = route.distanceMiles / (route.durationSeconds / 3600);
  }
  avgMph = Math.max(5, avgMph);
  return Math.round((extraMiles / avgMph) * 3600);
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}

/** Client helper: fetch driving route from our OSRM proxy. */
export async function fetchDrivingRoute(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<DrivingRoute> {
  const params = new URLSearchParams({
    fromLat: String(origin.lat),
    fromLng: String(origin.lng),
    toLat: String(destination.lat),
    toLng: String(destination.lng),
  });
  const res = await fetch(`/api/osrm/route?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? "Could not calculate driving route"
    );
  }
  return (await res.json()) as DrivingRoute;
}

export interface StationDetourMetrics {
  miles: number;
  extraSeconds: number;
}

/**
 * Ask the server to compute OSRM A→station→B extra miles + time vs the direct route.
 * Falls back to approximateDetourMiles / approximateDetourSeconds for gaps.
 */
export async function fetchStationDetours(
  origin: GeoPoint,
  destination: GeoPoint,
  stations: Array<{ id: string; location: GeoPoint }>,
  routeCoords: GeoPoint[],
  routeTiming?: Pick<DrivingRoute, "distanceMiles" | "durationSeconds"> | null
): Promise<Record<string, StationDetourMetrics>> {
  if (stations.length === 0) return {};

  try {
    const res = await fetch("/api/osrm/detours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        stations: stations.map((s) => ({
          id: s.id,
          lat: s.location.lat,
          lng: s.location.lng,
        })),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        detours: Record<string, StationDetourMetrics | number>;
      };
      const out: Record<string, StationDetourMetrics> = {};
      for (const [id, value] of Object.entries(data.detours ?? {})) {
        // Support legacy `{ id: miles }` shape if an old deploy is hit
        if (typeof value === "number") {
          out[id] = {
            miles: value,
            extraSeconds: approximateDetourSeconds(value, routeTiming),
          };
        } else if (
          value &&
          typeof value.miles === "number" &&
          typeof value.extraSeconds === "number"
        ) {
          out[id] = value;
        }
      }
      if (Object.keys(out).length > 0) return out;
    }
  } catch {
    // fall through to approximation
  }

  const approx: Record<string, StationDetourMetrics> = {};
  for (const s of stations) {
    const miles = approximateDetourMiles(s.location, routeCoords);
    approx[s.id] = {
      miles,
      extraSeconds: approximateDetourSeconds(miles, routeTiming),
    };
  }
  return approx;
}

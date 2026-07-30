import type { GeoPoint, MapBounds } from "./types";

export interface DrivingRoute {
  distanceMiles: number;
  durationSeconds: number;
  coordinates: GeoPoint[];
  bounds: MapBounds;
}

const METERS_PER_MILE = 1609.344;

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

/** Bounding box of a path, padded in degrees (~0.05° ≈ 3–4 miles). */
export function boundsFromCoordinates(
  points: GeoPoint[],
  padDegrees = 0.08
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

/** Shortest haversine distance from a point to a polyline (miles). */
export function distanceToRouteMiles(
  point: GeoPoint,
  route: GeoPoint[]
): number {
  if (route.length === 0) return Infinity;
  if (route.length === 1) return haversineMiles(point, route[0]);

  let min = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const d = pointToSegmentMiles(point, route[i], route[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

function pointToSegmentMiles(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
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
  return haversineMiles(p, { lat: cy, lng: cosLat === 0 ? a.lng : cx / cosLat });
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

/**
 * Ask the server to compute OSRM A→station→B extra miles vs the direct route.
 * Falls back to approximateDetourMiles for any station missing from the response.
 */
export async function fetchStationDetours(
  origin: GeoPoint,
  destination: GeoPoint,
  stations: Array<{ id: string; location: GeoPoint }>,
  routeCoords: GeoPoint[]
): Promise<Record<string, number>> {
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
      const data = (await res.json()) as { detours: Record<string, number> };
      return data.detours ?? {};
    }
  } catch {
    // fall through to approximation
  }

  const approx: Record<string, number> = {};
  for (const s of stations) {
    approx[s.id] = approximateDetourMiles(s.location, routeCoords);
  }
  return approx;
}

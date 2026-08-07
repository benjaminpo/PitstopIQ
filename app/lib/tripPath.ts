import type { GeoPoint, TripStop } from "./types";

/** Build ordered trip points: origin → resolved stops → destination. */
export function tripWaypointCoords(
  origin: GeoPoint | null,
  stops: TripStop[],
  destination: GeoPoint | null
): GeoPoint[] | null {
  if (!origin || !destination) return null;
  const mids: GeoPoint[] = [];
  for (const stop of stops) {
    if (stop.coords) mids.push(stop.coords);
  }
  return [origin, ...mids, destination];
}

/** Intermediate vias only (excludes origin & destination). */
export function tripViaCoords(stops: TripStop[]): GeoPoint[] {
  return stops
    .map((s) => s.coords)
    .filter((c): c is GeoPoint => c != null);
}

export function newTripStopId(): string {
  return crypto.randomUUID();
}

export function emptyTripStop(): TripStop {
  return { id: newTripStopId(), label: "", coords: null };
}

/**
 * Insert `point` between the path segment it lies closest to
 * (haversine / equirectangular projection). Used so a pit stop is scored
 * against the multi-stop itinerary, not only A→B.
 */
export function insertPointOnNearestSegment(
  path: GeoPoint[],
  point: GeoPoint
): GeoPoint[] {
  if (path.length < 2) return [...path, point];

  let bestI = 0;
  let bestDist = Infinity;

  for (let i = 0; i < path.length - 1; i++) {
    const dist = pointToSegmentDistanceMiles(point, path[i], path[i + 1]);
    if (dist < bestDist) {
      bestDist = dist;
      bestI = i;
    }
  }

  return [...path.slice(0, bestI + 1), point, ...path.slice(bestI + 1)];
}

function pointToSegmentDistanceMiles(
  p: GeoPoint,
  a: GeoPoint,
  b: GeoPoint
): number {
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
  return haversineMiles(p, {
    lat: cy,
    lng: cosLat === 0 ? a.lng : cx / cosLat,
  });
}

function haversineMiles(a: GeoPoint, b: GeoPoint): number {
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

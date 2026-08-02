import {
  boundsFromCoordinates,
  metersToMiles,
  type DrivingRoute,
} from "./routing";
import {
  hasRouteAvoid,
  osrmExcludeClasses,
  type RouteAvoidOptions,
} from "./routeAvoid";
import { decodePolyline } from "./polyline6";
import type { GeoPoint } from "./types";

const OSRM_BASE =
  process.env.OSRM_BASE_URL?.replace(/\/$/, "") ||
  "https://router.project-osrm.org";

const VALHALLA_BASE =
  process.env.VALHALLA_BASE_URL?.replace(/\/$/, "") ||
  "https://valhalla1.openstreetmap.de";

/** Public demo OSRM dropped exclude support; self-hosted instances may still have it. */
function osrmLikelySupportsExclude(base: string): boolean {
  if (process.env.OSRM_SUPPORTS_EXCLUDE === "1") return true;
  if (process.env.OSRM_SUPPORTS_EXCLUDE === "0") return false;
  return !base.includes("router.project-osrm.org");
}

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates: [number, number][] };
  }>;
}

interface ValhallaRouteResponse {
  trip?: {
    summary: { length: number; time: number };
    legs: Array<{ shape: string }>;
  };
}

export interface RouteLegMetrics {
  distanceMeters: number;
  durationSeconds: number;
}

interface ResolvedLeg {
  metrics: RouteLegMetrics;
  coordinates?: GeoPoint[];
}

async function fetchOsrmRoute(
  points: GeoPoint[],
  avoid: RouteAvoidOptions,
  overview: "full" | "false"
): Promise<ResolvedLeg | null> {
  if (hasRouteAvoid(avoid) && !osrmLikelySupportsExclude(OSRM_BASE)) {
    return null;
  }

  const path = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = new URL(`${OSRM_BASE}/route/v1/driving/${path}`);
  url.searchParams.set("overview", overview);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  if (hasRouteAvoid(avoid)) {
    url.searchParams.set("exclude", osrmExcludeClasses(avoid).join(","));
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as OsrmRouteResponse;
  if (data.code !== "Ok" || !data.routes?.[0]) return null;

  const route = data.routes[0];
  const metrics: RouteLegMetrics = {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };

  if (overview === "false" || !route.geometry?.coordinates) {
    return { metrics };
  }

  return {
    metrics,
    coordinates: route.geometry.coordinates.map(([lng, lat]) => ({
      lat,
      lng,
    })),
  };
}

async function fetchValhallaRoute(
  points: GeoPoint[],
  avoid: RouteAvoidOptions,
  wantGeometry: boolean
): Promise<ResolvedLeg | null> {
  const costingOptions: Record<string, number> = {};
  if (avoid.motorways) costingOptions.use_highways = 0;
  if (avoid.tolls) costingOptions.use_tolls = 0;
  if (avoid.ferries) costingOptions.use_ferry = 0;

  const body: Record<string, unknown> = {
    locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
    costing: "auto",
    directions_options: { units: "kilometers" },
    shape_format: "polyline6",
  };
  if (Object.keys(costingOptions).length > 0) {
    body.costing_options = { auto: costingOptions };
  }
  if (!wantGeometry) {
    body.directions_type = "none";
  }

  const res = await fetch(`${VALHALLA_BASE}/route`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as ValhallaRouteResponse;
  if (!data.trip?.legs?.length) return null;

  const metrics: RouteLegMetrics = {
    distanceMeters: data.trip.summary.length * 1000,
    durationSeconds: data.trip.summary.time,
  };

  if (!wantGeometry) return { metrics };

  const coordinates: GeoPoint[] = [];
  for (const leg of data.trip.legs) {
    if (!leg.shape) continue;
    const decoded = decodePolyline(leg.shape, 1e6);
    if (coordinates.length > 0 && decoded.length > 0) {
      coordinates.push(...decoded.slice(1));
    } else {
      coordinates.push(...decoded);
    }
  }
  if (coordinates.length === 0) return { metrics };
  return { metrics, coordinates };
}

async function resolveLeg(
  points: GeoPoint[],
  avoid: RouteAvoidOptions,
  wantGeometry: boolean
): Promise<ResolvedLeg | null> {
  if (points.length < 2) return null;

  const overview = wantGeometry ? "full" : "false";
  const osrm = await fetchOsrmRoute(points, avoid, overview);
  if (osrm) return osrm;

  return fetchValhallaRoute(points, avoid, wantGeometry);
}

function toDrivingRoute(
  leg: ResolvedLeg,
  fallbackPoints: GeoPoint[],
  wantGeometry: boolean
): DrivingRoute {
  const coordinates =
    wantGeometry && leg.coordinates && leg.coordinates.length > 0
      ? leg.coordinates
      : fallbackPoints;

  return {
    distanceMiles: Number(metersToMiles(leg.metrics.distanceMeters).toFixed(2)),
    durationSeconds: Math.round(leg.metrics.durationSeconds),
    coordinates: wantGeometry ? coordinates : [],
    bounds: boundsFromCoordinates(coordinates),
  };
}

/**
 * Driving route for 2+ waypoints. Uses OSRM by default; when avoid options
 * are set and public OSRM cannot exclude, falls back to Valhalla.
 */
export async function resolveDrivingRoute(
  points: GeoPoint[],
  avoid: RouteAvoidOptions = {
    motorways: false,
    tolls: false,
    ferries: false,
  },
  options: { geometry?: boolean } = {}
): Promise<DrivingRoute | null> {
  const wantGeometry = options.geometry !== false;
  const leg = await resolveLeg(points, avoid, wantGeometry);
  if (!leg) return null;
  return toDrivingRoute(leg, points, wantGeometry);
}

/** Lightweight A→…→B metrics for detour scoring (no geometry). */
export async function resolveRouteLeg(
  points: GeoPoint[],
  avoid: RouteAvoidOptions
): Promise<RouteLegMetrics | null> {
  const leg = await resolveLeg(points, avoid, false);
  return leg?.metrics ?? null;
}

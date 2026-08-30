import {
  allSameLocation,
  boundsFromCoordinates,
  metersToMiles,
  type DrivingRoute,
} from "./routing";
import {
  DEFAULT_ROUTE_AVOID,
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

/** Public demo routers can stall for minutes; fail fast instead of hanging. */
const ROUTING_FETCH_TIMEOUT_MS = 8_000;
const VALHALLA_HEALTH_TIMEOUT_MS = 4_000;
const VALHALLA_HEALTH_TTL_MS = 60_000;

let valhallaHealth: { ok: boolean; checkedAt: number } | null = null;

function rememberValhallaHealth(ok: boolean): void {
  valhallaHealth = { ok, checkedAt: Date.now() };
}

function shouldTryValhalla(): boolean {
  if (!valhallaHealth) return true;
  if (Date.now() - valhallaHealth.checkedAt > VALHALLA_HEALTH_TTL_MS) {
    return true;
  }
  return valhallaHealth.ok;
}

async function fetchRouting(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(ROUTING_FETCH_TIMEOUT_MS),
    });
  } catch {
    return new Response(null, { status: 504 });
  }
}

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

interface OsrmTableResponse {
  code: string;
  distances?: Array<Array<number | null>>;
  durations?: Array<Array<number | null>>;
}

interface ValhallaMatrixCell {
  distance: number | null;
  time: number | null;
  from_index: number;
  to_index: number;
}

interface ValhallaMatrixResponse {
  sources_to_targets?: ValhallaMatrixCell[][];
}

export interface RouteLegMetrics {
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteMatrix {
  distanceMeters: Array<Array<number | null>>;
  durationSeconds: Array<Array<number | null>>;
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

  const res = await fetchRouting(url.toString(), {
    headers: { Accept: "application/json" },
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
  const costingOptions = valhallaCostingOptions(avoid);

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

  const res = await fetchRouting(`${VALHALLA_BASE}/route`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    rememberValhallaHealth(false);
    return null;
  }

  const data = (await res.json()) as ValhallaRouteResponse;
  if (!data.trip?.legs?.length) {
    rememberValhallaHealth(false);
    return null;
  }
  rememberValhallaHealth(true);

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

function valhallaCostingOptions(
  avoid: RouteAvoidOptions
): Record<string, number> {
  const costingOptions: Record<string, number> = {};
  if (avoid.motorways) costingOptions.use_highways = 0;
  if (avoid.tolls) costingOptions.use_tolls = 0;
  if (avoid.ferries) costingOptions.use_ferry = 0;
  return costingOptions;
}

async function fetchValhallaMatrix(
  sources: GeoPoint[],
  targets: GeoPoint[],
  avoid: RouteAvoidOptions
): Promise<RouteMatrix | null> {
  const body: Record<string, unknown> = {
    sources: sources.map((p) => ({ lat: p.lat, lon: p.lng })),
    targets: targets.map((p) => ({ lat: p.lat, lon: p.lng })),
    costing: "auto",
    units: "kilometers",
    // Verbose cells include from/to indexes, which lets us safely map sparse
    // source and target sets without relying on provider-specific compact keys.
    verbose: true,
  };
  const costingOptions = valhallaCostingOptions(avoid);
  if (Object.keys(costingOptions).length > 0) {
    body.costing_options = { auto: costingOptions };
  }

  const res = await fetchRouting(`${VALHALLA_BASE}/sources_to_targets`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    rememberValhallaHealth(false);
    return null;
  }

  const data = (await res.json()) as ValhallaMatrixResponse;
  if (!Array.isArray(data.sources_to_targets)) {
    rememberValhallaHealth(false);
    return null;
  }
  rememberValhallaHealth(true);
  const distanceMeters = Array.from({ length: sources.length }, () =>
    new Array<number | null>(targets.length).fill(null)
  );
  const durationSeconds = Array.from({ length: sources.length }, () =>
    new Array<number | null>(targets.length).fill(null)
  );
  for (const row of data.sources_to_targets) {
    for (const cell of row) {
      if (
        cell.from_index < 0 ||
        cell.from_index >= sources.length ||
        cell.to_index < 0 ||
        cell.to_index >= targets.length
      ) {
        continue;
      }
      if (typeof cell.distance === "number") {
        distanceMeters[cell.from_index][cell.to_index] =
          cell.distance * 1000;
      }
      if (typeof cell.time === "number") {
        durationSeconds[cell.from_index][cell.to_index] = cell.time;
      }
    }
  }
  return { distanceMeters, durationSeconds };
}

async function fetchOsrmMatrix(
  sources: GeoPoint[],
  targets: GeoPoint[],
  avoid: RouteAvoidOptions
): Promise<RouteMatrix | null> {
  if (hasRouteAvoid(avoid) && !osrmLikelySupportsExclude(OSRM_BASE)) {
    return null;
  }
  const points = [...sources, ...targets];
  const path = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = new URL(`${OSRM_BASE}/table/v1/driving/${path}`);
  url.searchParams.set("annotations", "distance,duration");
  url.searchParams.set(
    "sources",
    sources.map((_, index) => String(index)).join(";")
  );
  url.searchParams.set(
    "destinations",
    targets
      .map((_, index) => String(sources.length + index))
      .join(";")
  );
  if (hasRouteAvoid(avoid)) {
    url.searchParams.set("exclude", osrmExcludeClasses(avoid).join(","));
  }
  const res = await fetchRouting(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as OsrmTableResponse;
  if (
    data.code !== "Ok" ||
    !Array.isArray(data.distances) ||
    !Array.isArray(data.durations)
  ) {
    return null;
  }
  return {
    distanceMeters: data.distances,
    durationSeconds: data.durations,
  };
}

async function resolveLeg(
  points: GeoPoint[],
  avoid: RouteAvoidOptions,
  wantGeometry: boolean
): Promise<ResolvedLeg | null> {
  if (points.length < 2) return null;
  if (allSameLocation(points)) {
    return {
      metrics: { distanceMeters: 0, durationSeconds: 0 },
      coordinates: [points[0]],
    };
  }

  const overview = wantGeometry ? "full" : "false";
  const osrm = await fetchOsrmRoute(points, avoid, overview);
  if (osrm) return osrm;

  if (hasRouteAvoid(avoid)) {
    if (shouldTryValhalla()) {
      const valhalla = await fetchValhallaRoute(points, avoid, wantGeometry);
      if (valhalla) return valhalla;
    }
    // Public OSRM cannot apply exclude, and Valhalla is down: still return a
    // driving route, including motorways, tolls, and ferries.
    return fetchOsrmRoute(points, DEFAULT_ROUTE_AVOID, overview);
  }

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
 * are set and public OSRM cannot exclude, tries Valhalla, then unconstrained
 * OSRM so a route is still returned (motorways / tolls / ferries allowed).
 */
export async function resolveDrivingRoute(
  points: GeoPoint[],
  avoid: RouteAvoidOptions = DEFAULT_ROUTE_AVOID,
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

/** One provider request for all pairwise route distances and durations. */
export async function resolveRouteMatrix(
  sources: GeoPoint[],
  avoid: RouteAvoidOptions,
  targets: GeoPoint[] = sources
): Promise<RouteMatrix | null> {
  if (sources.length === 0 || targets.length === 0) return null;
  const osrm = await fetchOsrmMatrix(sources, targets, avoid);
  if (osrm) return osrm;
  if (hasRouteAvoid(avoid)) {
    if (shouldTryValhalla()) {
      const valhalla = await fetchValhallaMatrix(sources, targets, avoid);
      if (valhalla) return valhalla;
    }
    return fetchOsrmMatrix(sources, targets, DEFAULT_ROUTE_AVOID);
  }
  return fetchValhallaMatrix(sources, targets, avoid);
}

/**
 * Lightweight check used on planner load. Avoid options need Valhalla when
 * public OSRM cannot exclude motorways / tolls / ferries.
 */
export async function probeValhallaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${VALHALLA_BASE}/status`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(VALHALLA_HEALTH_TIMEOUT_MS),
    });
    const ok = res.ok;
    rememberValhallaHealth(ok);
    return ok;
  } catch {
    rememberValhallaHealth(false);
    return false;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { metersToMiles } from "@/app/lib/routing";
import {
  normalizeRouteAvoid,
  type RouteAvoidOptions,
} from "@/app/lib/routeAvoid";
import { resolveRouteLeg } from "@/app/lib/serverRouting";
import { insertPointOnNearestSegment } from "@/app/lib/tripPath";
import type { GeoPoint } from "@/app/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONCURRENCY = 3;
const MAX_STATIONS = 25;
const MAX_WAYPOINTS = 5;

interface DetourBody {
  origin: GeoPoint;
  destination: GeoPoint;
  /** Intermediate trip stops between origin and destination */
  waypoints?: GeoPoint[];
  stations: Array<{ id: string; lat: number; lng: number }>;
  avoid?: Partial<RouteAvoidOptions>;
}

export interface StationDetourMetrics {
  miles: number;
  extraSeconds: number;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  );
  return results;
}

function parseWaypoints(raw: unknown): GeoPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: GeoPoint[] = [];
  for (const p of raw.slice(0, MAX_WAYPOINTS)) {
    if (
      p &&
      typeof p === "object" &&
      Number.isFinite((p as GeoPoint).lat) &&
      Number.isFinite((p as GeoPoint).lng)
    ) {
      out.push({ lat: (p as GeoPoint).lat, lng: (p as GeoPoint).lng });
    }
  }
  return out;
}

/**
 * POST /api/osrm/detours
 * Body: { origin, destination, waypoints?, stations: [{id,lat,lng}], avoid? }
 * Returns extra driving miles + seconds when inserting a station on the
 * planned path (origin → waypoints → destination) vs that direct path.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DetourBody;
    const { origin, destination, stations } = body;
    const avoid = normalizeRouteAvoid(body.avoid);
    const waypoints = parseWaypoints(body.waypoints);

    if (
      !origin ||
      !destination ||
      !Array.isArray(stations) ||
      ![origin.lat, origin.lng, destination.lat, destination.lng].every(
        Number.isFinite
      )
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const plannedPath = [origin, ...waypoints, destination];
    const direct = await resolveRouteLeg(plannedPath, avoid);
    if (direct == null) {
      return NextResponse.json(
        { error: "Could not resolve direct route" },
        { status: 502 }
      );
    }

    const limited = stations
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .slice(0, MAX_STATIONS);

    const extras = await mapPool(limited, CONCURRENCY, async (s) => {
      const stationPoint = { lat: s.lat, lng: s.lng };
      const viaPath = insertPointOnNearestSegment(plannedPath, stationPoint);
      const via = await resolveRouteLeg(viaPath, avoid);
      if (via == null) {
        return {
          id: s.id,
          metrics: null as StationDetourMetrics | null,
        };
      }
      const extraMeters = Math.max(0, via.distanceMeters - direct.distanceMeters);
      const extraSeconds = Math.max(
        0,
        Math.round(via.durationSeconds - direct.durationSeconds)
      );
      return {
        id: s.id,
        metrics: {
          miles: Number(metersToMiles(extraMeters).toFixed(2)),
          extraSeconds,
        },
      };
    });

    const detours: Record<string, StationDetourMetrics> = {};
    for (const row of extras) {
      if (row.metrics != null) detours[row.id] = row.metrics;
    }

    return NextResponse.json({
      directDistanceMiles: Number(
        metersToMiles(direct.distanceMeters).toFixed(2)
      ),
      directDurationSeconds: Math.round(direct.durationSeconds),
      detours,
    });
  } catch (error) {
    console.error("[osrm/detours]", error);
    return NextResponse.json(
      { error: "Detour calculation failed" },
      { status: 500 }
    );
  }
}

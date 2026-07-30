import { NextRequest, NextResponse } from "next/server";
import { metersToMiles } from "@/app/lib/routing";
import type { GeoPoint } from "@/app/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OSRM_BASE =
  process.env.OSRM_BASE_URL?.replace(/\/$/, "") ||
  "https://router.project-osrm.org";

const CONCURRENCY = 3;
const MAX_STATIONS = 25;

interface DetourBody {
  origin: GeoPoint;
  destination: GeoPoint;
  stations: Array<{ id: string; lat: number; lng: number }>;
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{ distance: number; duration: number }>;
}

interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

async function routeLeg(points: GeoPoint[]): Promise<RouteLeg | null> {
  const path = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = new URL(`${OSRM_BASE}/route/v1/driving/${path}`);
  url.searchParams.set("overview", "false");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as OsrmRouteResponse;
  if (data.code !== "Ok" || !data.routes?.[0]) return null;
  return {
    distanceMeters: data.routes[0].distance,
    durationSeconds: data.routes[0].duration,
  };
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

export interface StationDetourMetrics {
  miles: number;
  extraSeconds: number;
}

/**
 * POST /api/osrm/detours
 * Body: { origin, destination, stations: [{id,lat,lng}] }
 * Returns extra driving miles + seconds for A→station→B vs direct A→B (OSRM).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DetourBody;
    const { origin, destination, stations } = body;

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

    const direct = await routeLeg([origin, destination]);
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
      const via = await routeLeg([
        origin,
        { lat: s.lat, lng: s.lng },
        destination,
      ]);
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

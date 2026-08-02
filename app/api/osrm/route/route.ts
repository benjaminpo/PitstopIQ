import { NextRequest, NextResponse } from "next/server";
import type { DrivingRoute } from "@/app/lib/routing";
import {
  normalizeRouteAvoid,
  type RouteAvoidOptions,
} from "@/app/lib/routeAvoid";
import { resolveDrivingRoute } from "@/app/lib/serverRouting";
import type { GeoPoint } from "@/app/lib/types";

export const dynamic = "force-dynamic";

function parseAvoid(sp: URLSearchParams): RouteAvoidOptions {
  return normalizeRouteAvoid({
    motorways: sp.get("avoidMotorways") === "1",
    tolls: sp.get("avoidTolls") === "1",
    ferries: sp.get("avoidFerries") === "1",
  });
}

/**
 * GET /api/osrm/route?fromLat&fromLng&toLat&toLng[&viaLat&viaLng]
 *   [&avoidMotorways=1][&avoidTolls=1][&avoidFerries=1]
 * Proxies driving directions (OSRM, with Valhalla fallback for avoid options).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const fromLat = Number(sp.get("fromLat"));
  const fromLng = Number(sp.get("fromLng"));
  const toLat = Number(sp.get("toLat"));
  const toLng = Number(sp.get("toLng"));
  const viaLat = sp.get("viaLat");
  const viaLng = sp.get("viaLng");
  const avoid = parseAvoid(sp);

  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const points: GeoPoint[] = [{ lat: fromLat, lng: fromLng }];
  if (viaLat != null && viaLng != null) {
    const vLat = Number(viaLat);
    const vLng = Number(viaLng);
    if (Number.isFinite(vLat) && Number.isFinite(vLng)) {
      points.push({ lat: vLat, lng: vLng });
    }
  }
  points.push({ lat: toLat, lng: toLng });

  try {
    const payload: DrivingRoute | null = await resolveDrivingRoute(
      points,
      avoid
    );
    if (!payload || payload.coordinates.length === 0) {
      return NextResponse.json(
        { error: "No driving route found" },
        { status: 404 }
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[osrm/route]", error);
    return NextResponse.json(
      { error: "Routing service unavailable" },
      { status: 502 }
    );
  }
}

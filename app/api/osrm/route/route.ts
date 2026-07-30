import { NextRequest, NextResponse } from "next/server";
import {
  boundsFromCoordinates,
  metersToMiles,
  type DrivingRoute,
} from "@/app/lib/routing";
import type { GeoPoint } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const OSRM_BASE =
  process.env.OSRM_BASE_URL?.replace(/\/$/, "") ||
  "https://router.project-osrm.org";

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
  }>;
}

/**
 * GET /api/osrm/route?fromLat&fromLng&toLat&toLng[&viaLat&viaLng]
 * Proxies OSRM driving directions (OpenStreetMap road network).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const fromLat = Number(sp.get("fromLat"));
  const fromLng = Number(sp.get("fromLng"));
  const toLat = Number(sp.get("toLat"));
  const toLng = Number(sp.get("toLng"));
  const viaLat = sp.get("viaLat");
  const viaLng = sp.get("viaLng");

  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const coords: string[] = [`${fromLng},${fromLat}`];
  if (viaLat != null && viaLng != null) {
    const vLat = Number(viaLat);
    const vLng = Number(viaLng);
    if (Number.isFinite(vLat) && Number.isFinite(vLng)) {
      coords.push(`${vLng},${vLat}`);
    }
  }
  coords.push(`${toLng},${toLat}`);

  try {
    const url = new URL(
      `${OSRM_BASE}/route/v1/driving/${coords.join(";")}`
    );
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "false");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `OSRM returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as OsrmRouteResponse;
    if (data.code !== "Ok" || !data.routes?.[0]) {
      return NextResponse.json(
        { error: data.message || "No driving route found" },
        { status: 404 }
      );
    }

    const route = data.routes[0];
    const coordinates: GeoPoint[] = route.geometry.coordinates.map(
      ([lng, lat]) => ({ lat, lng })
    );

    const payload: DrivingRoute = {
      distanceMiles: Number(metersToMiles(route.distance).toFixed(2)),
      durationSeconds: Math.round(route.duration),
      coordinates,
      bounds: boundsFromCoordinates(coordinates),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[osrm/route]", error);
    return NextResponse.json(
      { error: "Routing service unavailable" },
      { status: 502 }
    );
  }
}

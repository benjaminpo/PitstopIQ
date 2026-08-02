import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_BOUNDS,
  fetchNearbyFuelStations,
  FuelDataUnavailableError,
} from "@/app/lib/fuelApiAdapter";
import { isFuelFinderConfigured } from "@/app/lib/fuelFinderClient";
import type { MapBounds } from "@/app/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseBounds(searchParams: URLSearchParams): MapBounds {
  const raw = ["north", "south", "east", "west"].map((key) =>
    searchParams.get(key)
  );

  if (raw.some((v) => v === null || v === "")) {
    return DEFAULT_BOUNDS;
  }

  const [north, south, east, west] = raw.map(Number);

  if ([north, south, east, west].every((n) => Number.isFinite(n))) {
    return { north, south, east, west };
  }
  return DEFAULT_BOUNDS;
}

/**
 * GET /api/fuel-finder
 * Query: north, south, east, west (optional — defaults to M4 corridor)
 *
 * Uses UK Fuel Finder: national CSV first (fast), JSON batch API as backup.
 * First live load is usually a few seconds once the CSV presign succeeds.
 */
export async function GET(request: NextRequest) {
  try {
    const bounds = parseBounds(request.nextUrl.searchParams);
    const { stations, source, pricesFetchedAt } =
      await fetchNearbyFuelStations(bounds);

    return NextResponse.json({
      source,
      configured: isFuelFinderConfigured(),
      count: stations.length,
      pricesFetchedAt,
      stations,
    });
  } catch (error) {
    console.error("[fuel-finder]", error);
    if (error instanceof FuelDataUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "Failed to fetch fuel stations" },
      { status: 500 }
    );
  }
}

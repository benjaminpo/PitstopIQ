import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_BOUNDS,
  fetchNearbyFuelStations,
  FuelDataUnavailableError,
} from "@/app/lib/fuelApiAdapter";
import { isFuelFinderConfigured } from "@/app/lib/fuelFinderClient";
import {
  applyConfirmedStationPrices,
  listConfirmedStationMatches,
  type ConfirmedStationMatch,
} from "@/app/lib/stationPriceMatches";
import {
  applyStationAdminOverrides,
  listStationAdminOverrides,
  type StationAdminOverride,
} from "@/app/lib/stationAdminOverrides";
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

    // Fuel dataset + admin overlays are independent — run in parallel so a
    // cold Neon round-trip doesn't stack three deep.
    const [fuelResult, confirmed, adminOverrides] = await Promise.all([
      fetchNearbyFuelStations(bounds),
      listConfirmedStationMatches().catch((overrideError) => {
        console.warn(
          "[fuel-finder] Could not load admin price overrides",
          overrideError
        );
        return [] as ConfirmedStationMatch[];
      }),
      listStationAdminOverrides().catch((overrideError) => {
        console.warn(
          "[fuel-finder] Could not load admin station overrides",
          overrideError
        );
        return [] as StationAdminOverride[];
      }),
    ]);

    const { stations: officialStations, source, pricesFetchedAt } = fuelResult;
    const withPrices = applyConfirmedStationPrices(officialStations, confirmed);
    const stations = applyStationAdminOverrides(withPrices, adminOverrides);

    return NextResponse.json(
      {
        source,
        configured: isFuelFinderConfigured(),
        count: stations.length,
        pricesFetchedAt,
        stations,
      },
      {
        headers: {
          // Admin brand/closed overrides and confirmed prices are applied in
          // this payload. CDN-caching the finished JSON left public clients on
          // stale brands for up to s-maxage + stale-while-revalidate after an
          // admin edit. The Fuel Finder dataset itself is already cached
          // server-side, so skipping CDN here stays cheap.
          "Cache-Control":
            confirmed.length > 0 || adminOverrides.length > 0
              ? "private, no-store"
              : source === "live"
                ? "public, s-maxage=60, stale-while-revalidate=600"
                : "no-store",
        },
      }
    );
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

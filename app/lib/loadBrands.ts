import {
  fetchAllFuelStations,
  FuelDataUnavailableError,
} from "@/app/lib/fuelApiAdapter";
import {
  buildBrandDetail,
  buildBrandSummaries,
  type BrandDetail,
  type BrandSummary,
} from "@/app/lib/brandsDirectory";
import {
  applyStationAdminOverrides,
  listStationAdminOverrides,
} from "@/app/lib/stationAdminOverrides";
import type { FuelType } from "@/app/lib/types";

async function loadStationsForBrands(): Promise<
  | {
      ok: true;
      stations: Awaited<ReturnType<typeof fetchAllFuelStations>>["stations"];
      source: "live" | "mock";
      pricesFetchedAt: number | null;
    }
  | { ok: false; reason: "unavailable" }
> {
  try {
    const result = await fetchAllFuelStations();
    let stations = result.stations;
    try {
      const overrides = await listStationAdminOverrides();
      stations = applyStationAdminOverrides(stations, overrides);
    } catch (error) {
      console.warn("[brands] Could not load admin overrides", error);
    }
    return {
      ok: true,
      stations,
      source: result.source,
      pricesFetchedAt: result.pricesFetchedAt,
    };
  } catch (error) {
    if (error instanceof FuelDataUnavailableError) {
      return { ok: false, reason: "unavailable" };
    }
    throw error;
  }
}

export async function loadBrandSummaries(): Promise<
  | {
      ok: true;
      brands: BrandSummary[];
      source: "live" | "mock";
      pricesFetchedAt: number | null;
      stationCount: number;
    }
  | { ok: false; reason: "unavailable" }
> {
  const loaded = await loadStationsForBrands();
  if (!loaded.ok) return loaded;
  return {
    ok: true,
    brands: buildBrandSummaries(loaded.stations),
    source: loaded.source,
    pricesFetchedAt: loaded.pricesFetchedAt,
    stationCount: loaded.stations.length,
  };
}

export async function loadBrandDetail(
  brandKey: string,
  sortFuel: FuelType = "E10"
): Promise<
  | {
      ok: true;
      detail: BrandDetail;
      source: "live" | "mock";
      pricesFetchedAt: number | null;
    }
  | { ok: false; reason: "unavailable" | "not_found" }
> {
  const loaded = await loadStationsForBrands();
  if (!loaded.ok) return loaded;
  const detail = buildBrandDetail(loaded.stations, brandKey, sortFuel);
  if (!detail) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    detail,
    source: loaded.source,
    pricesFetchedAt: loaded.pricesFetchedAt,
  };
}

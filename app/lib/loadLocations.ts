import {
  fetchAllFuelStations,
  FuelDataUnavailableError,
} from "@/app/lib/fuelApiAdapter";
import {
  buildLocationAreaDetail,
  buildLocationAreaSummaries,
  type LocationAreaDetail,
  type LocationAreaSummary,
} from "@/app/lib/locationsDirectory";
import {
  applyStationAdminOverrides,
  listStationAdminOverrides,
} from "@/app/lib/stationAdminOverrides";
import type { FuelStation, FuelType } from "@/app/lib/types";

export type LocationsLoadResult =
  | {
      ok: true;
      stations: FuelStation[];
      source: "live" | "mock";
      pricesFetchedAt: number | null;
    }
  | { ok: false; reason: "unavailable" };

async function loadStationsForLocations(): Promise<LocationsLoadResult> {
  try {
    const result = await fetchAllFuelStations();
    let stations = result.stations;
    try {
      const overrides = await listStationAdminOverrides();
      stations = applyStationAdminOverrides(stations, overrides);
    } catch (error) {
      console.warn("[locations] Could not load admin overrides", error);
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

export async function loadLocationAreaSummaries(
  highlightFuel: FuelType = "E10"
): Promise<
  | {
      ok: true;
      areas: LocationAreaSummary[];
      source: "live" | "mock";
      pricesFetchedAt: number | null;
      stationCount: number;
    }
  | { ok: false; reason: "unavailable" }
> {
  const loaded = await loadStationsForLocations();
  if (!loaded.ok) return loaded;
  return {
    ok: true,
    areas: buildLocationAreaSummaries(loaded.stations, highlightFuel),
    source: loaded.source,
    pricesFetchedAt: loaded.pricesFetchedAt,
    stationCount: loaded.stations.length,
  };
}

export async function loadLocationAreaDetail(
  areaKey: string,
  sortFuel: FuelType = "E10"
): Promise<
  | {
      ok: true;
      detail: LocationAreaDetail;
      source: "live" | "mock";
      pricesFetchedAt: number | null;
    }
  | { ok: false; reason: "unavailable" | "not_found" }
> {
  const loaded = await loadStationsForLocations();
  if (!loaded.ok) return loaded;
  const detail = buildLocationAreaDetail(
    loaded.stations,
    areaKey,
    sortFuel
  );
  if (!detail) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    detail,
    source: loaded.source,
    pricesFetchedAt: loaded.pricesFetchedAt,
  };
}

import {
  fetchFuelStationByPathKey,
  FuelDataUnavailableError,
} from "@/app/lib/fuelApiAdapter";
import { getCommunitySummaries } from "@/app/lib/stationContributions";
import {
  applyConfirmedStationPrices,
  listConfirmedStationMatches,
} from "@/app/lib/stationPriceMatches";
import {
  applyStationAdminOverrides,
  listStationAdminOverrides,
} from "@/app/lib/stationAdminOverrides";
import type { FuelStation, StationCommunitySummary } from "@/app/lib/types";

export type StationPageLoadResult =
  | {
      ok: true;
      station: FuelStation;
      source: "live" | "mock";
      pricesFetchedAt: number | null;
      community: StationCommunitySummary | null;
    }
  | { ok: false; reason: "not_found" | "unavailable" };

/**
 * Load a single station for the SEO detail page, including admin overlays
 * used by `/api/fuel-finder`.
 */
export async function loadStationForPage(
  pathKey: string
): Promise<StationPageLoadResult> {
  try {
    const result = await fetchFuelStationByPathKey(pathKey);
    if (!result) return { ok: false, reason: "not_found" };

    let stations = [result.station];
    try {
      const confirmed = await listConfirmedStationMatches();
      stations = applyConfirmedStationPrices(stations, confirmed);
    } catch (error) {
      console.warn("[station-page] Could not load price overrides", error);
    }
    try {
      const overrides = await listStationAdminOverrides();
      stations = applyStationAdminOverrides(stations, overrides);
    } catch (error) {
      console.warn("[station-page] Could not load admin overrides", error);
    }

    const station = stations[0];
    if (!station) return { ok: false, reason: "not_found" };

    let community: StationCommunitySummary | null = null;
    try {
      const summaries = await getCommunitySummaries([station.id]);
      community = summaries[station.id] ?? null;
    } catch (error) {
      console.warn("[station-page] Could not load community summary", error);
    }

    return {
      ok: true,
      station,
      source: result.source,
      pricesFetchedAt: result.pricesFetchedAt,
      community,
    };
  } catch (error) {
    if (error instanceof FuelDataUnavailableError) {
      return { ok: false, reason: "unavailable" };
    }
    throw error;
  }
}

import {
  stationBrandKey,
  stationMatchesBrandFilter,
  type BrandFilter,
} from "@/app/lib/brandCategory";
import {
  matchesPriceFreshness,
  type PriceFreshnessFilter,
} from "@/app/lib/freshness";
import { isStationOpenNow } from "@/app/lib/stationFacilities";
import type { FuelStation, FuelType } from "@/app/lib/types";

export type StationsDirectorySortKey =
  | "name"
  | "location"
  | "price"
  | "updated";

export type SortDirection = "asc" | "desc";

export interface StationsDirectoryFilters {
  query: string;
  brandFilter: BrandFilter;
  excludedBrands: string[];
  fuelType: FuelType;
  priceFreshnessFilter: PriceFreshnessFilter;
  openNowFilter: boolean;
  /** Only stations that list a price for the selected fuel */
  requireSelectedFuel: boolean;
}

export const DEFAULT_STATIONS_DIRECTORY_FILTERS: StationsDirectoryFilters = {
  query: "",
  brandFilter: "all",
  excludedBrands: [],
  fuelType: "E10",
  priceFreshnessFilter: "any",
  openNowFilter: false,
  requireSelectedFuel: false,
};

export const STATIONS_DIRECTORY_PAGE_SIZE = 50;

export function stationMatchesDirectoryQuery(
  station: FuelStation,
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [station.name, station.brand, station.postcode, station.address].some(
    (value) => value?.toLowerCase().includes(needle)
  );
}

export function filterStationsDirectory(
  stations: FuelStation[],
  filters: StationsDirectoryFilters,
  now: Date = new Date()
): FuelStation[] {
  const excluded = new Set(filters.excludedBrands);
  const nowMs = now.getTime();

  return stations.filter((station) => {
    if (!stationMatchesDirectoryQuery(station, filters.query)) return false;
    if (!stationMatchesBrandFilter(station, filters.brandFilter)) return false;
    if (excluded.has(stationBrandKey(station))) return false;

    const price = station.prices[filters.fuelType];
    if (filters.requireSelectedFuel && (price == null || !Number.isFinite(price))) {
      return false;
    }

    if (
      !matchesPriceFreshness(
        station.pricesUpdatedAt?.[filters.fuelType] ??
          station.pricesLastUpdatedAt,
        filters.priceFreshnessFilter,
        nowMs
      )
    ) {
      return false;
    }

    if (filters.openNowFilter && !isStationOpenNow(station, now)) {
      return false;
    }

    return true;
  });
}

function sortValue(
  station: FuelStation,
  sortKey: StationsDirectorySortKey,
  fuelType: FuelType
): string | number | null {
  switch (sortKey) {
    case "name":
      return station.name.toLowerCase();
    case "location":
      return (
        (station.postcode || station.address || "").toLowerCase() || null
      );
    case "price": {
      const price = station.prices[fuelType];
      return price != null && Number.isFinite(price) ? price : null;
    }
    case "updated":
      return (
        station.pricesUpdatedAt?.[fuelType] ??
        station.pricesLastUpdatedAt ??
        null
      );
  }
}

export function sortStationsDirectory(
  stations: FuelStation[],
  sortKey: StationsDirectorySortKey,
  direction: SortDirection,
  fuelType: FuelType
): FuelStation[] {
  return [...stations].sort((left, right) => {
    const a = sortValue(left, sortKey, fuelType);
    const b = sortValue(right, sortKey, fuelType);
    if (a === null && b === null) return left.name.localeCompare(right.name);
    if (a === null) return 1;
    if (b === null) return -1;
    const comparison =
      typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b));
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginateStationsDirectory<T>(
  items: T[],
  page: number,
  pageSize = STATIONS_DIRECTORY_PAGE_SIZE
): { page: number; pageCount: number; items: T[] } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageCount,
    items: items.slice(start, start + pageSize),
  };
}

/** Deep-link the home planner to a nearby search at this forecourt. */
export function stationNearbySearchHref(station: FuelStation): string {
  const coords = `${station.location.lat.toFixed(5)},${station.location.lng.toFixed(5)}`;
  const label = station.name.trim() || "Fuel station";
  const params = new URLSearchParams({
    from: coords,
    fromLabel: label,
    to: coords,
    toLabel: label,
  });
  return `/?${params.toString()}`;
}

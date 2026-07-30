import type { FuelStation, FuelType } from "./types";

/** Stations within this extra-mile budget count as “on-corridor” baselines. */
export const ON_ROUTE_DETOUR_MILES = 2;

/**
 * Typical £/L you’d pay without hunting for a bargain — median price of
 * low-detour stations for the selected fuel, falling back to all stations.
 */
export function computeBaselineRoutePrice(
  stations: FuelStation[],
  fuelType: FuelType,
  onRouteMaxMiles = ON_ROUTE_DETOUR_MILES
): number | null {
  const pricesFor = (list: FuelStation[]) =>
    list
      .map((s) => s.prices[fuelType])
      .filter((p): p is number => typeof p === "number" && p > 0);

  const onRoute = stations.filter(
    (s) => s.distanceOffRouteMiles <= onRouteMaxMiles
  );
  const prices = pricesFor(onRoute);
  const pool = prices.length >= 3 ? prices : pricesFor(stations);
  if (pool.length === 0) return null;

  const sorted = [...pool].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  return Number(median.toFixed(3));
}

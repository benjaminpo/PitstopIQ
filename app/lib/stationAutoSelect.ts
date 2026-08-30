import type { GeoPoint } from "./types";
import type { PriceFreshnessFilter } from "./freshness";

/** Stable identity for a corridor load: origin, vias, then destination. */
export function tripStationsKey(
  origin: GeoPoint,
  destination: GeoPoint,
  vias: GeoPoint[]
): string {
  return [origin, ...vias, destination]
    .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
    .join("|");
}

/**
 * Whether to pick the best station when none is selected after a load.
 *
 * Same-trip price refreshes (including admin edits) must not steal or
 * restore a selection. A new trip still auto-selects once so a shared URL
 * opens the best station even with default filters.
 */
export function shouldAutoSelectBestStation(args: {
  silent: boolean;
  isNewTrip: boolean;
  nearbySearch: boolean;
  priceFreshnessFilter: PriceFreshnessFilter;
  openNowFilter: boolean;
}): boolean {
  if (args.silent) return false;
  return (
    args.isNewTrip ||
    args.nearbySearch ||
    args.priceFreshnessFilter !== "any" ||
    args.openNowFilter
  );
}

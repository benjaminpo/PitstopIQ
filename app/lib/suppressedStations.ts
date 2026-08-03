/**
 * Fuel Finder still publishes prices for some forecourts that community
 * reports show are closed (renovation, permanent shutdown, etc.). Until
 * the official temporary/permanent_closure flags catch up, keep them out
 * of recommendations.
 *
 * Keys are Fuel Finder `node_id` values.
 */
const SUPPRESSED_STATION_IDS = new Set<string>([
  // Harvest Energy Classic, Old Watford Road, AL2 3RS — barriered building
  // site / renovation (petrolprices.com reviews, Aug 2026).
  "c086c59f3ee206d895373cab7bb592e608921b1729df3802b8c58735395ac2a8",
]);

export function isSuppressedStationId(id: string): boolean {
  return SUPPRESSED_STATION_IDS.has(id);
}

export function withoutSuppressedStations<T extends { id: string }>(
  stations: T[]
): T[] {
  return stations.filter((s) => !isSuppressedStationId(s.id));
}

import type { FuelStation } from "@/app/lib/types";

/** URL-safe slug from a forecourt name (cosmetic; ID is authoritative). */
export function slugifyStationName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "station";
}

/** Path segment: `{id}-{slug}` — resolve by ID prefix so slug drift still works. */
export function stationPathKey(
  station: Pick<FuelStation, "id" | "name">
): string {
  return `${station.id}-${slugifyStationName(station.name)}`;
}

/** Public SEO URL for a station detail page. */
export function stationHref(
  station: Pick<FuelStation, "id" | "name">
): string {
  return `/stations/${stationPathKey(station)}`;
}

export function stationKeyMatchesId(key: string, id: string): boolean {
  return key === id || key.startsWith(`${id}-`);
}

/**
 * Find a station for a `/stations/[stationKey]` param.
 * Prefers the longest matching `id` so mock ids like `mock-tesco-slough`
 * win over a hypothetical shorter prefix.
 */
export function findStationByPathKey<T extends { id: string }>(
  stations: readonly T[],
  key: string
): T | undefined {
  const decoded = safeDecode(key).trim();
  if (!decoded) return undefined;

  let best: T | undefined;
  for (const station of stations) {
    if (!station.id || !stationKeyMatchesId(decoded, station.id)) continue;
    if (!best || station.id.length > best.id.length) {
      best = station;
    }
  }
  return best;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

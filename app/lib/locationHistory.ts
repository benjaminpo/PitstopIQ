import type { PlaceSuggestion } from "./placeSearch";

/** Most-recent-first cap for the saved search history */
export const MAX_RECENT_PLACES = 8;

/**
 * Two saved places are "the same" when Nominatim gave them the same id, or
 * they sit on (almost) the same coordinates — repeated searches for one
 * place can return different place_ids for the same location.
 */
function samePlace(a: PlaceSuggestion, b: PlaceSuggestion): boolean {
  if (a.id === b.id) return true;
  return (
    Math.abs(a.location.lat - b.location.lat) < 1e-4 &&
    Math.abs(a.location.lng - b.location.lng) < 1e-4
  );
}

/** Prepend a selection, dropping duplicates and keeping the list capped. */
export function addToRecentPlaces(
  history: PlaceSuggestion[],
  place: PlaceSuggestion
): PlaceSuggestion[] {
  const rest = history.filter((p) => !samePlace(p, place));
  return [place, ...rest].slice(0, MAX_RECENT_PLACES);
}

/** Validate persisted history (localStorage can contain anything). */
export function sanitizeRecentPlaces(raw: unknown): PlaceSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: PlaceSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Partial<PlaceSuggestion>;
    if (
      typeof p.id !== "string" ||
      typeof p.label !== "string" ||
      p.label.length === 0 ||
      !p.location ||
      typeof p.location.lat !== "number" ||
      typeof p.location.lng !== "number" ||
      !Number.isFinite(p.location.lat) ||
      !Number.isFinite(p.location.lng)
    ) {
      continue;
    }
    out.push({
      id: p.id,
      label: p.label,
      secondary: typeof p.secondary === "string" ? p.secondary : undefined,
      postcode: typeof p.postcode === "string" ? p.postcode : undefined,
      location: { lat: p.location.lat, lng: p.location.lng },
    });
    if (out.length >= MAX_RECENT_PLACES) break;
  }
  return out;
}

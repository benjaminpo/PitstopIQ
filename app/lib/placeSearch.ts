import type { GeoPoint } from "./types";

export interface PlaceSuggestion {
  id: string;
  label: string;
  secondary?: string;
  postcode?: string;
  location: GeoPoint;
}

interface NominatimAddress {
  road?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  address?: NominatimAddress;
}

/** Forward-geocode place search via our API proxy (Nominatim). */
export async function searchPlaces(
  query: string,
  options: { limit?: number; signal?: AbortSignal } = {}
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    limit: String(options.limit ?? 6),
  });

  const res = await fetch(`/api/geocode/search?${params}`, {
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error("Place search failed");
  }

  const data = (await res.json()) as { results: PlaceSuggestion[] };
  return data.results ?? [];
}

/** Full label shown in the input after selecting a suggestion */
export function formatPlaceSelection(place: PlaceSuggestion): string {
  const parts = [place.label];
  if (place.secondary) parts.push(place.secondary);
  if (place.postcode && !parts.some((p) => p.includes(place.postcode!))) {
    parts.push(place.postcode);
  }
  return parts.join(", ");
}

export function formatNominatimResult(item: NominatimResult): PlaceSuggestion {
  const a = item.address;
  const postcode = a?.postcode?.trim() || undefined;

  const primary =
    a?.road ||
    a?.suburb ||
    a?.village ||
    a?.town ||
    a?.city ||
    item.display_name.split(",")[0]?.trim() ||
    item.display_name;

  const secondaryParts = [
    a?.suburb && a.suburb !== primary ? a.suburb : null,
    a?.town && a.town !== primary ? a.town : null,
    a?.city && a.city !== primary ? a.city : null,
    a?.county,
    postcode,
    a?.country,
  ].filter(Boolean) as string[];

  // Prefer a shorter display_name slice when address details are thin
  let secondary =
    secondaryParts.length > 0
      ? secondaryParts.slice(0, 4).join(", ")
      : item.display_name
          .split(",")
          .slice(1, 4)
          .map((s) => s.trim())
          .join(", ");

  // Ensure postcode appears even when falling back to display_name
  if (postcode && secondary && !secondary.includes(postcode)) {
    secondary = `${secondary}, ${postcode}`;
  } else if (postcode && !secondary) {
    secondary = postcode;
  }

  return {
    id: String(item.place_id),
    label: primary,
    secondary: secondary || undefined,
    postcode,
    location: {
      lat: Number(item.lat),
      lng: Number(item.lon),
    },
  };
}

export type { NominatimResult };

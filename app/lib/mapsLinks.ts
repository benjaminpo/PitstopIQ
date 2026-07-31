import type { GeoPoint } from "./types";

export interface NavigateTarget {
  location: GeoPoint;
  name?: string;
  /** Optional trip origin so Maps can plan A → station */
  origin?: GeoPoint | null;
}

/**
 * Google Maps driving directions to the forecourt.
 * Opens the Maps app on mobile when available.
 */
export function googleMapsNavigateUrl(target: NavigateTarget): string {
  const { location, origin } = target;
  const params = new URLSearchParams({
    api: "1",
    destination: `${location.lat},${location.lng}`,
    travelmode: "driving",
  });
  if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Apple Maps driving directions to the forecourt.
 * On iOS/macOS this opens Apple Maps; elsewhere it falls back to maps.apple.com.
 *
 * Uses Apple's unified Maps URL format (/directions?destination=…&mode=driving).
 * The legacy `?daddr=…&q=…` scheme is deprecated and the native Maps app no
 * longer routes reliably to raw coordinates with it, so avoid that form.
 * https://developer.apple.com/documentation/mapkit/unified-map-urls
 */
export function appleMapsNavigateUrl(target: NavigateTarget): string {
  const { location, name, origin } = target;
  const params = new URLSearchParams({
    destination: `${location.lat},${location.lng}`,
    mode: "driving",
  });
  if (name) {
    // Labels the destination pin without overriding the coordinates
    params.set("name", name);
  }
  if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    params.set("source", `${origin.lat},${origin.lng}`);
  }
  return `https://maps.apple.com/directions?${params.toString()}`;
}

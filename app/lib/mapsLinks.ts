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

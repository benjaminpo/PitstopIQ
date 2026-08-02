import type { GeoPoint, MapBounds } from "./types";

export class GeolocationError extends Error {
  constructor(
    message: string,
    public readonly code?: number
  ) {
    super(message);
    this.name = "GeolocationError";
  }
}

const DEFAULT_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 60_000,
};

/** Read the device GPS position via the browser Geolocation API. */
export function getBrowserPosition(
  options?: PositionOptions
): Promise<GeoPoint> {
  const opts = options ?? DEFAULT_GEO_OPTIONS;
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(
        new GeolocationError("Geolocation is not supported in this browser")
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Location permission denied — allow access in browser settings",
          2: "Location unavailable — try again outdoors or check GPS",
          3: "Location request timed out — try again",
        };
        reject(
          new GeolocationError(
            messages[err.code] ?? err.message ?? "Failed to get location",
            err.code
          )
        );
      },
      opts
    );
  });
}

/** Reverse-geocode via OpenStreetMap Nominatim (no API key). */
export async function reverseGeocode(point: GeoPoint): Promise<string> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(point.lat));
    url.searchParams.set("lon", String(point.lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "16");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return formatCoords(point);
    }

    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        suburb?: string;
        village?: string;
        town?: string;
        city?: string;
        county?: string;
        postcode?: string;
      };
    };

    const a = data.address;
    if (a) {
      const place =
        a.suburb || a.village || a.town || a.city || a.county || "";
      const postcode = a.postcode?.trim();
      const parts: string[] = [];
      if (a.road) parts.push(a.road);
      else if (place) parts.push(place);
      if (place && a.road) parts.push(place);
      if (postcode) parts.push(postcode);
      if (parts.length > 0) return parts.join(", ");
    }

    if (data.display_name) {
      return data.display_name.split(",").slice(0, 4).join(",").trim();
    }

    return formatCoords(point);
  } catch {
    return formatCoords(point);
  }
}

export function formatCoords(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

/** ~±delta degrees bounding box around a point (~11 km at mid-latitudes for 0.1°) */
export function boundsAround(
  point: GeoPoint,
  deltaDegrees = 0.12
): MapBounds {
  return {
    north: point.lat + deltaDegrees,
    south: point.lat - deltaDegrees,
    east: point.lng + deltaDegrees,
    west: point.lng - deltaDegrees,
  };
}

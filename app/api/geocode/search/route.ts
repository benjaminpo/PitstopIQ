import { NextRequest, NextResponse } from "next/server";
import {
  formatNominatimResult,
  isPostcodeResult,
  type NominatimResult,
} from "@/app/lib/placeSearch";

export const dynamic = "force-dynamic";

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "PitstopIQ/1.0 (smart route fuel calculator)",
};

/**
 * Postcode hits are bare centroids with no street name. Reverse geocode the
 * centroid so the suggestion also shows the road/locality (like Google Maps,
 * e.g. "SM2 6RG" → "Chanctonbury Gardens, Sutton").
 */
async function enrichPostcodeResult(
  item: NominatimResult
): Promise<NominatimResult> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", item.lat);
    url.searchParams.set("lon", item.lon);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "16");

    const res = await fetch(url.toString(), {
      headers: NOMINATIM_HEADERS,
      next: { revalidate: 0 },
    });
    if (!res.ok) return item;

    const reverse = (await res.json()) as NominatimResult;
    if (!reverse?.address) return item;

    // Keep the postcode result's own fields; add street/locality from reverse.
    return {
      ...item,
      address: { ...reverse.address, ...item.address },
    };
  } catch {
    return item;
  }
}

/**
 * GET /api/geocode/search?q=...&limit=6
 * Proxies OpenStreetMap Nominatim forward geocoding (UK-biased).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 6) || 6,
    10
  );

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("countrycodes", "gb");

    const res = await fetch(url.toString(), {
      headers: NOMINATIM_HEADERS,
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream geocoder unavailable", results: [] },
        { status: 502 }
      );
    }

    const raw = (await res.json()) as NominatimResult[];

    // Cap reverse lookups to stay friendly to Nominatim's rate limits;
    // postcode queries return at most a couple of centroid hits anyway.
    let reverseLookups = 0;
    const enriched = await Promise.all(
      raw.map((item) => {
        if (isPostcodeResult(item) && reverseLookups < 3) {
          reverseLookups += 1;
          return enrichPostcodeResult(item);
        }
        return Promise.resolve(item);
      })
    );

    const results = enriched.map(formatNominatimResult);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[geocode/search]", error);
    return NextResponse.json(
      { error: "Place search failed", results: [] },
      { status: 500 }
    );
  }
}

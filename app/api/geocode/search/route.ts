import { NextRequest, NextResponse } from "next/server";
import {
  formatNominatimResult,
  type NominatimResult,
} from "@/app/lib/placeSearch";

export const dynamic = "force-dynamic";

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
      headers: {
        Accept: "application/json",
        "User-Agent": "PitstopIQ/1.0 (smart route fuel calculator)",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream geocoder unavailable", results: [] },
        { status: 502 }
      );
    }

    const raw = (await res.json()) as NominatimResult[];
    const results = raw.map(formatNominatimResult);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[geocode/search]", error);
    return NextResponse.json(
      { error: "Place search failed", results: [] },
      { status: 500 }
    );
  }
}

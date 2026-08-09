import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/adminAuth";
import { fetchNearbyFuelStations } from "@/app/lib/fuelApiAdapter";
import {
  applyConfirmedStationPrices,
  confirmStationMatch,
  listConfirmedStationMatches,
} from "@/app/lib/stationPriceMatches";
import type { FuelStation, FuelType } from "@/app/lib/types";
import type { PetrolPricesStation } from "@/app/lib/stationMatching";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UK_BOUNDS = { north: 61, south: 49, east: 2.5, west: -9 };
const FUEL_TYPES = new Set<FuelType>(["E10", "E5", "B7_Diesel", "B7_Premium"]);

function validPrices(value: unknown): value is Partial<Record<FuelType, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([fuel, price]) =>
      FUEL_TYPES.has(fuel as FuelType) &&
      typeof price === "number" &&
      Number.isFinite(price) &&
      price >= 0.8 &&
      price <= 5
  );
}

function validPetrolPricesUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "petrolprices.com" ||
        url.hostname.endsWith(".petrolprices.com"))
    );
  } catch {
    return false;
  }
}

function validSource(value: unknown): value is PetrolPricesStation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as Partial<PetrolPricesStation>;
  return (
    typeof source.sourceId === "string" &&
    source.sourceId.length > 0 &&
    validPetrolPricesUrl(source.sourceUrl) &&
    typeof source.name === "string" &&
    source.name.length > 0 &&
    typeof source.brand === "string" &&
    typeof source.address === "string" &&
    typeof source.postcode === "string" &&
    validPrices(source.prices)
  );
}

function validStation(value: unknown): value is FuelStation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const station = value as Partial<FuelStation>;
  return (
    typeof station.id === "string" &&
    station.id.length > 0 &&
    typeof station.name === "string" &&
    station.name.length > 0 &&
    validPrices(station.prices)
  );
}

async function authorize(request: NextRequest) {
  const session = await getAdminSession(request.headers);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { session, response: null };
}

export async function GET(request: NextRequest) {
  const { response } = await authorize(request);
  if (response) return response;
  try {
    const [{ stations: officialStations, source, pricesFetchedAt }, confirmed] = await Promise.all([
      fetchNearbyFuelStations(UK_BOUNDS),
      listConfirmedStationMatches(),
    ]);
    const stations = applyConfirmedStationPrices(officialStations, confirmed);
    return NextResponse.json({
      stations,
      confirmed,
      source,
      pricesFetchedAt,
    });
  } catch (error) {
    console.error("[admin/station-matches GET]", error);
    return NextResponse.json(
      { error: "Could not load station comparison data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { session, response } = await authorize(request);
  if (response || !session) return response;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { source, station, score } = body as {
      source?: unknown;
      station?: unknown;
      score?: unknown;
    };
    if (
      !validSource(source) ||
      !validStation(station) ||
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      return NextResponse.json({ error: "Invalid station match" }, { status: 400 });
    }
    const match = await confirmStationMatch({
      source,
      station,
      score: Math.round(score),
      confirmedBy: session.user.id,
    });
    return NextResponse.json({ match }, { status: 201 });
  } catch (error) {
    console.error("[admin/station-matches POST]", error);
    return NextResponse.json(
      { error: "Could not confirm station match" },
      { status: 500 }
    );
  }
}

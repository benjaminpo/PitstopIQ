import { NextRequest, NextResponse } from "next/server";
import { calculateDetourSavings } from "@/app/lib/detourCalculator";
import type { DetourCalculationInput, VehicleProfile } from "@/app/lib/types";

export const dynamic = "force-dynamic";

interface CalculateDetourBody {
  vehicle: VehicleProfile;
  stationPricePerLitre: number;
  baseRouteAvgPricePerLitre: number;
  distanceOffRouteMiles: number;
  litresToRefill?: number;
}

function isValidBody(body: unknown): body is CalculateDetourBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  const vehicle = b.vehicle as Record<string, unknown> | undefined;

  return (
    !!vehicle &&
    typeof vehicle.mpg === "number" &&
    typeof vehicle.tankCapacityLitres === "number" &&
    typeof vehicle.fillPercentage === "number" &&
    typeof vehicle.fuelType === "string" &&
    typeof b.stationPricePerLitre === "number" &&
    typeof b.baseRouteAvgPricePerLitre === "number" &&
    typeof b.distanceOffRouteMiles === "number"
  );
}

/**
 * POST /api/calculate-detour
 * Body: DetourCalculationInput fields — returns DetourCalculationResult
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!isValidBody(body)) {
      return NextResponse.json(
        { error: "Invalid calculation payload" },
        { status: 400 }
      );
    }

    const input: DetourCalculationInput = {
      vehicle: body.vehicle,
      stationPricePerLitre: body.stationPricePerLitre,
      baseRouteAvgPricePerLitre: body.baseRouteAvgPricePerLitre,
      distanceOffRouteMiles: body.distanceOffRouteMiles,
      litresToRefill: body.litresToRefill,
    };

    const result = calculateDetourSavings(input);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calculation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

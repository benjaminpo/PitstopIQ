import { NextRequest, NextResponse } from "next/server";
import { lookupVehicle } from "@/app/lib/vehicleLookup";

export const dynamic = "force-dynamic";

/**
 * GET /api/vehicle-lookup?registration=AB12CDE
 * Looks up UK vehicle details by registration plate (DVLA + optional MOT History).
 */
export async function GET(request: NextRequest) {
  const registration =
    request.nextUrl.searchParams.get("registration")?.trim() ?? "";

  if (!registration) {
    return NextResponse.json(
      { error: "Missing registration query parameter" },
      { status: 400 }
    );
  }

  const result = await lookupVehicle(registration);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ vehicle: result.vehicle });
}

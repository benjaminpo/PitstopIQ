import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import {
  getUserVehiclePresets,
  parseReplaceBody,
  replaceUserVehiclePresets,
} from "@/app/lib/vehiclePresets";

export const dynamic = "force-dynamic";

/**
 * GET /api/vehicle-presets
 * Returns the signed-in user's cloud-saved vehicle presets.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const data = await getUserVehiclePresets(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load vehicle presets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/vehicle-presets
 * Replace the signed-in user's full preset list + active selection.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = parseReplaceBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data = await replaceUserVehiclePresets(
      session.user.id,
      parsed.value
    );
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save vehicle presets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

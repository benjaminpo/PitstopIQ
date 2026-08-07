import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import {
  createMissingStationReport,
  parseMissingStationBody,
} from "@/app/lib/missingStationReports";

export const dynamic = "force-dynamic";

/**
 * POST /api/missing-station-reports
 * Body: { name, lat, lng, brand?, address?, notes?, placeLabel? }
 * Authenticated — stores a member report of a forecourt missing from Fuel Finder.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = parseMissingStationBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const report = await createMissingStationReport(
      session.user.id,
      parsed.value
    );
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit report";
    const status = message.includes("wait a moment") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

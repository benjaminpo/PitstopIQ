import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import {
  deleteContribution,
  getCommunitySummaries,
  getMyContribution,
} from "@/app/lib/stationContributions";

export const dynamic = "force-dynamic";

/**
 * GET /api/station-contributions/:stationId
 * Summary + the caller's own contribution when signed in.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId: raw } = await context.params;
    const stationId = decodeURIComponent(raw ?? "").trim();
    if (!stationId) {
      return NextResponse.json({ error: "stationId required" }, { status: 400 });
    }

    const summaries = await getCommunitySummaries([stationId]);
    const session = await auth.api.getSession({ headers: request.headers });
    const mine = session?.user
      ? await getMyContribution(session.user.id, stationId)
      : null;

    return NextResponse.json({
      summary: summaries[stationId] ?? null,
      mine,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load contribution";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/station-contributions/:stationId
 * Remove the signed-in member's contribution for this station.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ stationId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { stationId: raw } = await context.params;
    const stationId = decodeURIComponent(raw ?? "").trim();
    if (!stationId) {
      return NextResponse.json({ error: "stationId required" }, { status: 400 });
    }

    const deleted = await deleteContribution(session.user.id, stationId);
    const summaries = await getCommunitySummaries([stationId]);
    return NextResponse.json({
      deleted,
      summary: summaries[stationId] ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete contribution";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

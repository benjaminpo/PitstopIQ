import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import {
  getCommunitySummaries,
  getMyContribution,
  parseUpsertBody,
  upsertContribution,
} from "@/app/lib/stationContributions";

export const dynamic = "force-dynamic";

/**
 * GET /api/station-contributions?ids=a,b,c
 * Public aggregates for the given station IDs (max 100).
 */
export async function GET(request: NextRequest) {
  try {
    const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const summaries = await getCommunitySummaries(ids);
    return NextResponse.json({ summaries });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load contributions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/station-contributions
 * Partial upsert: `{ kind: "price" | "review", … }` updates only that side
 * so a rating/comment never overwrites a reported pump price (and vice versa).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = parseUpsertBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const contribution = await upsertContribution(
      session.user.id,
      parsed.value
    );
    const summaries = await getCommunitySummaries([parsed.value.stationId]);
    const mine = await getMyContribution(
      session.user.id,
      parsed.value.stationId
    );

    return NextResponse.json({
      contribution,
      mine,
      summary: summaries[parsed.value.stationId] ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save contribution";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

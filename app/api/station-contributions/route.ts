import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import {
  getCommunitySummaries,
  getMyContribution,
  parseUpsertBody,
  upsertContribution,
} from "@/app/lib/stationContributions";

export const dynamic = "force-dynamic";

function parseIdsBody(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  // Upsert payloads use `kind` — leave those for the auth-required path.
  if ("kind" in record) return null;
  if (!Array.isArray(record.ids)) return null;
  return record.ids
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * GET /api/station-contributions?ids=a,b,c
 * Public aggregates for the given station IDs (max 100). Prefer POST for large lists.
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
 * - `{ ids: string[] }` — public community summaries (avoids URI length limits)
 * - `{ kind: "price" | "review", … }` — authenticated partial upsert
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    const lookupIds = parseIdsBody(body);
    if (lookupIds) {
      const summaries = await getCommunitySummaries(lookupIds);
      return NextResponse.json({ summaries });
    }

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import {
  getUserRecentPlaces,
  parseReplaceBody,
  replaceUserRecentPlaces,
} from "@/app/lib/recentPlaces";

export const dynamic = "force-dynamic";

/**
 * GET /api/recent-places
 * Returns the signed-in user's cloud-saved place search history.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const data = await getUserRecentPlaces(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load recent places";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/recent-places
 * Replace the signed-in user's full recent-places list.
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

    const data = await replaceUserRecentPlaces(session.user.id, parsed.value);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save recent places";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import {
  countUnreadPriceAlerts,
  evaluatePriceWatchesFromCache,
  listPriceAlerts,
  markPriceAlertsRead,
} from "@/app/lib/priceWatches";

export const dynamic = "force-dynamic";

/**
 * GET /api/price-alerts?unread=1&evaluate=1
 * In-app price drop events for the signed-in user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const unreadOnly =
      request.nextUrl.searchParams.get("unread") === "1";
    const evaluate =
      request.nextUrl.searchParams.get("evaluate") !== "0";

    if (evaluate) {
      await evaluatePriceWatchesFromCache(session.user.id);
    }

    const [alerts, unreadCount] = await Promise.all([
      listPriceAlerts(session.user.id, {
        unreadOnly,
        limit: 50,
      }),
      countUnreadPriceAlerts(session.user.id),
    ]);

    return NextResponse.json({ alerts, unreadCount });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load price alerts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/price-alerts
 * Mark alerts read: `{ all: true }` or `{ ids: string[] }`.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const all = record.all === true;
    const ids = Array.isArray(record.ids)
      ? record.ids.filter((id): id is string => typeof id === "string")
      : undefined;

    if (!all && (!ids || ids.length === 0)) {
      return NextResponse.json(
        { error: "Provide { all: true } or { ids: string[] }" },
        { status: 400 }
      );
    }

    const marked = await markPriceAlertsRead(session.user.id, { all, ids });
    const unreadCount = await countUnreadPriceAlerts(session.user.id);
    return NextResponse.json({ marked, unreadCount });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to mark alerts read";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

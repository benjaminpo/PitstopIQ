import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import {
  createStationWatch,
  evaluatePriceWatchesFromCache,
  listPriceWatches,
  parseCreateStationWatchBody,
} from "@/app/lib/priceWatches";

export const dynamic = "force-dynamic";

/**
 * GET /api/price-watches?evaluate=1
 * List the signed-in user's station watches (evaluates drops against cache).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const evaluate =
      request.nextUrl.searchParams.get("evaluate") !== "0";
    let evaluation: {
      checked: number;
      fired: number;
      pricesFetchedAt: number | null;
    } | null = null;
    if (evaluate) {
      evaluation = await evaluatePriceWatchesFromCache(session.user.id);
    }

    const watches = await listPriceWatches(session.user.id);
    return NextResponse.json({ watches, evaluation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load price watches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/price-watches
 * Watch a station fuel grade; baseline is the price at watch time.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = parseCreateStationWatchBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const watch = await createStationWatch(session.user.id, parsed.value);
      return NextResponse.json({ watch });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create watch";
      if (message.includes("up to")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create price watch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

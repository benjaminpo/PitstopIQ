import { NextResponse } from "next/server";
import { probeValhallaHealth } from "@/app/lib/serverRouting";

export const dynamic = "force-dynamic";

/**
 * GET /api/osrm/valhalla
 * Planner probes this on load so Avoid can tell the user whether Valhalla
 * (needed for motorway / toll / ferry exclusions) is reachable.
 */
export async function GET() {
  const ok = await probeValhallaHealth();
  return NextResponse.json(
    { ok },
    { headers: { "Cache-Control": "no-store" } }
  );
}

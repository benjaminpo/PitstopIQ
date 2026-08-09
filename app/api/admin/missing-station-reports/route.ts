import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/adminAuth";
import { listMissingStationReports } from "@/app/lib/missingStationReports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request.headers);
  if (!session) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const reports = await listMissingStationReports();
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("[admin/missing-station-reports GET]", error);
    return NextResponse.json(
      { error: "Could not load missing station reports" },
      { status: 500 }
    );
  }
}

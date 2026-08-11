import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/app/lib/adminAuth";
import { brandHref } from "@/app/lib/brandsDirectory";
import {
  listStationAdminOverrides,
  upsertStationAdminOverride,
} from "@/app/lib/stationAdminOverrides";

export const dynamic = "force-dynamic";

async function authorize(request: NextRequest) {
  const session = await getAdminSession(request.headers);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { session, response: null };
}

/** ISR directory pages that list stations by brand / area. */
function revalidatePublicStationViews(
  brands: Array<string | null | undefined>
) {
  revalidatePath("/stations");
  revalidatePath("/brands");
  revalidatePath("/locations");
  revalidatePath("/");
  const seen = new Set<string>();
  for (const brand of brands) {
    const trimmed = brand?.trim();
    if (!trimmed) continue;
    const href = brandHref(trimmed);
    if (seen.has(href)) continue;
    seen.add(href);
    revalidatePath(href);
  }
}

export async function GET(request: NextRequest) {
  const { response } = await authorize(request);
  if (response) return response;
  try {
    const overrides = await listStationAdminOverrides();
    return NextResponse.json({ overrides });
  } catch (error) {
    console.error("[admin/station-overrides GET]", error);
    return NextResponse.json(
      { error: "Could not load station overrides" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const { session, response } = await authorize(request);
  if (response || !session) return response;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { stationId, brand, closed, note } = body as {
      stationId?: unknown;
      brand?: unknown;
      closed?: unknown;
      note?: unknown;
    };
    if (typeof stationId !== "string" || !stationId.trim()) {
      return NextResponse.json({ error: "Station id is required" }, { status: 400 });
    }
    if (brand !== undefined && brand !== null && typeof brand !== "string") {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }
    if (typeof closed !== "boolean") {
      return NextResponse.json({ error: "Closed must be a boolean" }, { status: 400 });
    }
    if (note !== undefined && note !== null && typeof note !== "string") {
      return NextResponse.json({ error: "Invalid note" }, { status: 400 });
    }
    if (typeof brand === "string" && brand.trim().length > 80) {
      return NextResponse.json({ error: "Brand is too long" }, { status: 400 });
    }

    const previous = (await listStationAdminOverrides()).find(
      (row) => row.stationId === stationId.trim()
    );

    const override = await upsertStationAdminOverride({
      stationId: stationId.trim(),
      brand: typeof brand === "string" ? brand : null,
      closed,
      note: typeof note === "string" ? note : null,
      updatedBy: session.user.id,
    });

    revalidatePublicStationViews([override.brand, previous?.brand]);

    return NextResponse.json({ override });
  } catch (error) {
    console.error("[admin/station-overrides PUT]", error);
    return NextResponse.json(
      { error: "Could not save station override" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { deletePriceWatch } from "@/app/lib/priceWatches";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/price-watches/:id
 * Remove a watch (and its alert events) for the signed-in user.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { id: raw } = await context.params;
    const id = decodeURIComponent(raw ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const deleted = await deletePriceWatch(session.user.id, id);
    return NextResponse.json({ deleted });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete price watch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

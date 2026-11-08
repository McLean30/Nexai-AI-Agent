import { NextRequest, NextResponse } from "next/server";
import { logActivity, mutateStore, readStore } from "@/lib/nexai/store";
import type { ServiceCatalogue } from "@/lib/nexai/types";

export const runtime = "nodejs";

export async function GET() {
  const data = await readStore();
  return NextResponse.json({ catalogue: data.catalogue });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<ServiceCatalogue> & {
    approve?: boolean;
  };

  const catalogue = await mutateStore(async (store) => {
    const prev = store.catalogue;
    const next: ServiceCatalogue = { ...prev };

    if (Array.isArray(body.offeredServices)) next.offeredServices = body.offeredServices;
    if (Array.isArray(body.excludedServices)) next.excludedServices = body.excludedServices;
    if (Array.isArray(body.approvedClaims)) next.approvedClaims = body.approvedClaims;
    if (Array.isArray(body.reviewItems)) next.reviewItems = body.reviewItems;
    if (typeof body.provisionalNote === "string") next.provisionalNote = body.provisionalNote;

    // Status: explicit approve / revert to provisional.
    if (body.approve === true || body.status === "approved") {
      next.status = "approved";
      next.provisionalNote = undefined;
    } else if (body.approve === false || body.status === "provisional") {
      next.status = "provisional";
    }

    next.updatedAt = new Date().toISOString();
    store.catalogue = next;

    if (next.status !== prev.status) {
      await logActivity(store, {
        level: next.status === "approved" ? "success" : "warning",
        kind: "catalogue_status",
        message:
          next.status === "approved"
            ? "Service catalogue approved — drafts can now be checked for live sending."
            : "Service catalogue set back to provisional.",
        simulated: true,
      });
    }
    return next;
  });

  return NextResponse.json({ catalogue });
}

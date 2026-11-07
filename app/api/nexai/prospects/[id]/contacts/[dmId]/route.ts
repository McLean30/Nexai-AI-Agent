import { NextRequest, NextResponse } from "next/server";
import { logActivity, mutateStore } from "@/lib/nexai/store";
import type { EmailVerification } from "@/lib/nexai/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; dmId: string }> };

// PATCH: review actions on a single contact — approve (clear review),
// or update the verification status.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, dmId } = await params;
  const body = await request.json().catch(() => ({}));

  const updated = await mutateStore(async (store) => {
    const p = store.prospects.find((x) => x.id === id);
    if (!p) return null;
    const dm = p.decisionMakers.find((d) => d.id === dmId);
    if (!dm) return null;

    if (body.approve === true) {
      dm.reviewStatus = "ok";
      dm.reviewReason = undefined;
    }
    if (typeof body.emailVerification === "string") {
      dm.emailVerification = body.emailVerification as EmailVerification;
      dm.checkedAt = new Date().toISOString();
    }
    if (typeof body.companyMatch === "string") {
      dm.companyMatch = body.companyMatch as "match" | "mismatch" | "uncertain";
    }

    p.updatedAt = new Date().toISOString();
    if (body.approve === true) {
      await logActivity(store, {
        level: "info",
        kind: "contact_reviewed",
        message: `Contact ${dm.name} approved for ${p.companyName}.`,
        simulated: true,
        prospectId: p.id,
      });
    }
    return dm;
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ contact: updated });
}

// DELETE: dismiss/remove a contact (e.g. rejected in review).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, dmId } = await params;
  const ok = await mutateStore(async (store) => {
    const p = store.prospects.find((x) => x.id === id);
    if (!p) return false;
    const idx = p.decisionMakers.findIndex((d) => d.id === dmId);
    if (idx === -1) return false;
    const [removed] = p.decisionMakers.splice(idx, 1);
    p.updatedAt = new Date().toISOString();
    await logActivity(store, {
      level: "info",
      kind: "contact_dismissed",
      message: `Contact ${removed.name} dismissed from ${p.companyName}.`,
      simulated: true,
      prospectId: p.id,
    });
    return true;
  });
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

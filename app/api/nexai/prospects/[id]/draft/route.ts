import { NextRequest, NextResponse } from "next/server";
import { logActivity, mutateStore, newId, readStore } from "@/lib/nexai/store";
import { aiWritingProvider } from "@/lib/nexai/providers";
import { validateOffer } from "@/lib/nexai/catalogue";
import type { EmailMessage } from "@/lib/nexai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// POST: generate (or regenerate) a draft. If the current draft has been edited
// or approved, regeneration is refused with 409 unless `force: true` — so a
// saved edit is never silently overwritten.
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const stepType = (body.stepType as EmailMessage["stepType"]) || "initial";
  const decisionMakerId = body.decisionMakerId as string | undefined;
  const force = body.force === true;

  const prospect = await mutateStore(async (store) => store.prospects.find((p) => p.id === id) ?? null);
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = prospect.draftEmail;
  if (current && (current.edited || current.approved) && !force) {
    return NextResponse.json(
      {
        error: current.approved
          ? "This draft has been approved. Regenerating will replace it."
          : "This draft has unsaved-in-place edits. Regenerating will replace your edited version.",
        guard: true,
        reason: current.approved ? "approved" : "edited",
      },
      { status: 409 },
    );
  }

  const decisionMaker =
    prospect.decisionMakers.find((d) => d.id === decisionMakerId) ??
    prospect.decisionMakers.find((d) => d.reviewStatus !== "needs_review") ??
    prospect.decisionMakers[0];

  const store0 = await readStore();
  const { subject, body: draftBody } = await aiWritingProvider.draftEmail({
    prospect,
    decisionMaker,
    stepType,
    catalogue: store0.catalogue,
  });
  const providerStatus = aiWritingProvider.status();

  const nowIso = new Date().toISOString();
  const draft: EmailMessage = {
    id: newId("em"),
    prospectId: prospect.id,
    decisionMakerId: decisionMaker?.id,
    direction: "outbound",
    stepType,
    subject,
    body: draftBody,
    status: "draft",
    simulated: providerStatus.mode === "mock",
    edited: false,
    approved: false,
    createdAt: nowIso,
    updatedAt: nowIso,
    // Validate the generated offer against the catalogue.
    offerCheck: validateOffer({ subject, body: draftBody }, store0.catalogue),
  };

  const saved = await mutateStore(async (store) => {
    const p = store.prospects.find((x) => x.id === id);
    if (!p) return null;
    p.draftEmail = draft;
    p.updatedAt = nowIso;
    p.lastActivityAt = nowIso;
    await logActivity(store, {
      level: "info",
      kind: "draft_generated",
      message: `${draft.simulated ? "Simulated" : "Live"} email draft ${force ? "regenerated" : "generated"} for ${p.companyName}.`,
      simulated: draft.simulated,
      prospectId: p.id,
    });
    return p;
  });

  return NextResponse.json({ prospect: saved, draft, provider: providerStatus });
}

// PATCH: save in-place edits to subject/body, and/or approve the draft.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const saved = await mutateStore(async (store) => {
    const p = store.prospects.find((x) => x.id === id);
    if (!p || !p.draftEmail) return null;
    const d = p.draftEmail;

    if (typeof body.subject === "string") d.subject = body.subject;
    if (typeof body.body === "string") d.body = body.body;
    if (typeof body.subject === "string" || typeof body.body === "string") {
      d.edited = true;
      // Re-validate the edited offer against the catalogue.
      d.offerCheck = validateOffer({ subject: d.subject, body: d.body }, store.catalogue);
    }
    if (body.approved === true) d.approved = true;
    if (body.approved === false) d.approved = false;
    d.updatedAt = new Date().toISOString();
    p.updatedAt = d.updatedAt;

    await logActivity(store, {
      level: body.approved === true ? "success" : "info",
      kind: body.approved === true ? "draft_approved" : "draft_saved",
      message: body.approved === true
        ? `Email draft approved for ${p.companyName} (not sent — sending disabled).`
        : `Email draft saved for ${p.companyName}.`,
      simulated: d.simulated,
      prospectId: p.id,
    });
    return d;
  });

  if (!saved) return NextResponse.json({ error: "No draft to update" }, { status: 404 });
  return NextResponse.json({ draft: saved });
}

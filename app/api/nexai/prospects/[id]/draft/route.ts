import { NextRequest, NextResponse } from "next/server";
import { logActivity, mutateStore, newId } from "@/lib/nexai/store";
import { aiWritingProvider } from "@/lib/nexai/providers";
import type { EmailMessage } from "@/lib/nexai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const stepType = (body.stepType as EmailMessage["stepType"]) || "initial";
  const decisionMakerId = body.decisionMakerId as string | undefined;

  const prospect = await mutateStore(async (store) => {
    return store.prospects.find((p) => p.id === id) ?? null;
  });
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const decisionMaker =
    prospect.decisionMakers.find((d) => d.id === decisionMakerId) ??
    prospect.decisionMakers[0];

  const { subject, body: draftBody } = await aiWritingProvider.draftEmail({
    prospect,
    decisionMaker,
    stepType,
  });
  const providerStatus = aiWritingProvider.status();

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
    createdAt: new Date().toISOString(),
  };

  const saved = await mutateStore(async (store) => {
    const p = store.prospects.find((x) => x.id === id);
    if (!p) return null;
    p.draftEmail = draft;
    p.updatedAt = new Date().toISOString();
    p.lastActivityAt = p.updatedAt;
    await logActivity(store, {
      level: "info",
      kind: "draft_generated",
      message: `${draft.simulated ? "Simulated" : "Live"} email draft generated for ${p.companyName}.`,
      simulated: draft.simulated,
      prospectId: p.id,
    });
    return p;
  });

  return NextResponse.json({ prospect: saved, draft, provider: providerStatus });
}

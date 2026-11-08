import { NextRequest, NextResponse } from "next/server";
import { mutateStore, newId } from "@/lib/nexai/store";
import { processMailboxEvent } from "@/lib/nexai/automation";
import type { MailboxEvent, MailboxEventType } from "@/lib/nexai/types";

export const runtime = "nodejs";

const VALID: MailboxEventType[] = ["reply", "bounce", "opt_out", "out_of_office", "auto_reply"];

// Inject a SIMULATED inbound mailbox event. This stands in for a Microsoft 365
// webhook/poll during development. Processing is idempotent on `id`.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const type = body.type as MailboxEventType;
  const prospectId = body.prospectId as string;

  if (!VALID.includes(type)) {
    return NextResponse.json({ error: `type must be one of ${VALID.join(", ")}` }, { status: 400 });
  }
  if (!prospectId) {
    return NextResponse.json({ error: "prospectId is required" }, { status: 400 });
  }

  const event: MailboxEvent = {
    // Caller may pass an explicit id to test idempotency; otherwise generate one.
    id: typeof body.id === "string" && body.id ? body.id : newId("evt"),
    type,
    prospectId,
    fromEmail: body.fromEmail,
    subject: body.subject,
    body: body.body,
    receivedAt: new Date().toISOString(),
    simulated: true,
  };

  const result = await mutateStore(async (store) => processMailboxEvent(store, event));

  return NextResponse.json({ event: { id: event.id, type }, ...result });
}

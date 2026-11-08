import { NextRequest, NextResponse } from "next/server";
import { mutateStore } from "@/lib/nexai/store";
import { resumeAutomation, stopAutomationManual, markHandled } from "@/lib/nexai/automation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Manual automation controls. Resuming a stopped/paused sequence REQUIRES this
// explicit action — the agent never auto-resumes after a reply.
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as "resume" | "stop" | "mark_handled";

  const ok = await mutateStore(async (store) => {
    if (action === "resume") return resumeAutomation(store, id);
    if (action === "stop") return stopAutomationManual(store, id);
    if (action === "mark_handled") return markHandled(store, id);
    return false;
  });

  if (!ok) return NextResponse.json({ error: "Invalid action or prospect not found" }, { status: 400 });
  return NextResponse.json({ ok: true, action });
}

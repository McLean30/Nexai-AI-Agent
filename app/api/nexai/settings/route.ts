import { NextRequest, NextResponse } from "next/server";
import { logActivity, mutateStore, readStore } from "@/lib/nexai/store";
import type { Settings } from "@/lib/nexai/types";

export const runtime = "nodejs";

export async function GET() {
  const data = await readStore();
  return NextResponse.json({ settings: data.settings });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<Settings>;

  const settings = await mutateStore(async (store) => {
    const prev = store.settings;
    const next: Settings = { ...prev };

    if (typeof body.sendingEnabled === "boolean") next.sendingEnabled = body.sendingEnabled;
    if (typeof body.dailyProspectTarget === "number") next.dailyProspectTarget = body.dailyProspectTarget;
    if (typeof body.totalEmailLimit === "number") next.totalEmailLimit = body.totalEmailLimit;
    if (typeof body.timezone === "string") next.timezone = body.timezone;
    if (body.sendWindow) next.sendWindow = { ...prev.sendWindow, ...body.sendWindow };
    if (Array.isArray(body.suppressionList)) next.suppressionList = body.suppressionList;

    store.settings = next;

    if (typeof body.sendingEnabled === "boolean" && body.sendingEnabled !== prev.sendingEnabled) {
      await logActivity(store, {
        level: body.sendingEnabled ? "warning" : "info",
        kind: "sending_toggled",
        message: body.sendingEnabled
          ? "Outbound sending ENABLED in Settings."
          : "Outbound sending disabled in Settings.",
        simulated: true,
      });
    }
    return next;
  });

  return NextResponse.json({ settings });
}

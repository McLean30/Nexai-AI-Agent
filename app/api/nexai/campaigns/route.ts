import { NextResponse } from "next/server";
import { readStore } from "@/lib/nexai/store";

export const runtime = "nodejs";

export async function GET() {
  const data = await readStore();
  // Attach lightweight prospect summaries for each campaign.
  const campaigns = data.campaigns.map((c) => ({
    ...c,
    prospects: c.prospectIds
      .map((pid) => data.prospects.find((p) => p.id === pid))
      .filter(Boolean)
      .map((p) => {
        const auto = p!.automation;
        const nextQueued = auto?.steps
          .filter((s) => s.status === "queued")
          .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];
        return {
          id: p!.id,
          companyName: p!.companyName,
          domain: p!.domain,
          qualification: p!.qualification,
          draftEmail: p!.draftEmail ?? null,
          automationStatus: auto?.status ?? null,
          automationReason: auto?.statusReason ?? null,
          nextStep: nextQueued ? { stepType: nextQueued.stepType, scheduledFor: nextQueued.scheduledFor } : null,
          sentCount: auto?.steps.filter((s) => s.status === "sent").length ?? 0,
        };
      }),
  }));
  return NextResponse.json({ campaigns, settings: data.settings });
}

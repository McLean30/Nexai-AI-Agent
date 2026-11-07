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
      .map((p) => ({
        id: p!.id,
        companyName: p!.companyName,
        domain: p!.domain,
        qualification: p!.qualification,
        draftEmail: p!.draftEmail ?? null,
      })),
  }));
  return NextResponse.json({ campaigns, settings: data.settings });
}

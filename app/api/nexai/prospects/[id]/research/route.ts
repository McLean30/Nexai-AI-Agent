import { NextRequest, NextResponse } from "next/server";
import { logActivity, mutateStore } from "@/lib/nexai/store";
import { researchProvider } from "@/lib/nexai/providers";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  // Read the prospect first (outside the write lock) to run research.
  const result = await mutateStore(async (store) => {
    const prospect = store.prospects.find((p) => p.id === id);
    return prospect ?? null;
  });
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const report = await researchProvider.research(result);
  const providerStatus = researchProvider.status();

  const saved = await mutateStore(async (store) => {
    const prospect = store.prospects.find((p) => p.id === id);
    if (!prospect) return null;
    prospect.research = report;
    prospect.updatedAt = new Date().toISOString();
    prospect.lastActivityAt = prospect.updatedAt;
    if (prospect.qualification === "new") prospect.qualification = "researching";
    await logActivity(store, {
      level: report.simulated ? "info" : "success",
      kind: "research_generated",
      message: `${report.simulated ? "Simulated" : "Live"} research report generated for ${prospect.companyName}.`,
      simulated: report.simulated,
      prospectId: prospect.id,
    });
    return prospect;
  });

  return NextResponse.json({ prospect: saved, report, provider: providerStatus });
}

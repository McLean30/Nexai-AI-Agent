import { NextResponse } from "next/server";
import { readStore } from "@/lib/nexai/store";

export const runtime = "nodejs";

export async function GET() {
  const data = await readStore();
  const conversations = [...data.conversations]
    .sort((a, b) => {
      // Needs-human first, then most recent.
      if (!!a.needsHuman !== !!b.needsHuman) return a.needsHuman ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .map((c) => {
      const prospect = data.prospects.find((p) => p.id === c.prospectId);
      const dm = prospect?.decisionMakers.find((d) => d.id === c.decisionMakerId) ?? prospect?.decisionMakers[0];
      return {
        ...c,
        companyName: prospect?.companyName ?? "Unknown",
        contactName: dm?.name,
        contactTitle: dm?.title,
        contactEmail: dm?.email,
        researchSummary: prospect?.research?.summary,
        automationStatus: prospect?.automation?.status,
        automationReason: prospect?.automation?.statusReason,
      };
    });
  const needsHuman = conversations.filter((c) => c.needsHuman).length;
  return NextResponse.json({ conversations, needsHuman });
}

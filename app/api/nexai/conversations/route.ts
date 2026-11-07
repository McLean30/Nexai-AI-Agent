import { NextResponse } from "next/server";
import { readStore } from "@/lib/nexai/store";

export const runtime = "nodejs";

export async function GET() {
  const data = await readStore();
  const conversations = [...data.conversations]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((c) => {
      const prospect = data.prospects.find((p) => p.id === c.prospectId);
      const dm = prospect?.decisionMakers.find((d) => d.id === c.decisionMakerId);
      return {
        ...c,
        companyName: prospect?.companyName ?? "Unknown",
        contactName: dm?.name,
        contactTitle: dm?.title,
      };
    });
  return NextResponse.json({ conversations });
}

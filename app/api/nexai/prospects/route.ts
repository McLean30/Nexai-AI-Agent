import { NextRequest, NextResponse } from "next/server";
import { logActivity, mutateStore, newId, readStore } from "@/lib/nexai/store";
import type { Prospect, QualificationStatus } from "@/lib/nexai/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const data = await readStore();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const origin = searchParams.get("origin");
  const q = searchParams.get("q")?.toLowerCase().trim();

  let prospects = data.prospects;
  if (status && status !== "all") prospects = prospects.filter((p) => p.qualification === status);
  if (origin && origin !== "all") prospects = prospects.filter((p) => p.origin === origin);
  if (q) {
    prospects = prospects.filter(
      (p) =>
        p.companyName.toLowerCase().includes(q) ||
        p.domain.toLowerCase().includes(q) ||
        (p.industry ?? "").toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // Newest first
  prospects = [...prospects].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({ prospects });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const companyName = (body.companyName ?? "").trim();
  const domain = (body.domain ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  if (!companyName || !domain) {
    return NextResponse.json({ error: "companyName and domain are required" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const prospect: Prospect = {
    id: newId("p"),
    origin: "demo", // created in demo mode until live providers are connected
    companyName,
    domain,
    website: body.website || `https://${domain}`,
    industry: body.industry || undefined,
    location: body.location || undefined,
    employeeRange: body.employeeRange || undefined,
    qualification: (body.qualification as QualificationStatus) || "new",
    qualificationNotes: body.qualificationNotes || undefined,
    fitScore: typeof body.fitScore === "number" ? body.fitScore : undefined,
    tags: Array.isArray(body.tags) ? body.tags : [],
    decisionMakers: [],
    createdAt: nowIso,
    updatedAt: nowIso,
    lastActivityAt: nowIso,
  };

  await mutateStore(async (store) => {
    store.prospects.push(prospect);
    await logActivity(store, {
      level: "info",
      kind: "prospect_added",
      message: `Prospect added: ${companyName}.`,
      simulated: true,
      prospectId: prospect.id,
    });
  });

  return NextResponse.json({ prospect }, { status: 201 });
}

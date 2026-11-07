import { NextRequest, NextResponse } from "next/server";
import { logActivity, mutateStore } from "@/lib/nexai/store";
import { enrichmentProvider } from "@/lib/nexai/providers";
import { normalizeDomain } from "@/lib/nexai/domain";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

function emailKey(email?: string): string {
  return (email ?? "").trim().toLowerCase();
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const prospect = await mutateStore(async (store) => store.prospects.find((p) => p.id === id) ?? null);
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await enrichmentProvider.enrich(prospect);
  const providerStatus = enrichmentProvider.status();

  const saved = await mutateStore(async (store) => {
    const p = store.prospects.find((x) => x.id === id);
    if (!p) return null;

    // Merge: append contacts not already present (dedupe by email, else name+title).
    const existingEmails = new Set(p.decisionMakers.map((d) => emailKey(d.email)));
    const existingKeys = new Set(p.decisionMakers.map((d) => `${d.name}|${d.title}`.toLowerCase()));
    let added = 0;
    for (const c of result.contacts) {
      const ek = emailKey(c.email);
      const nk = `${c.name}|${c.title}`.toLowerCase();
      if ((ek && existingEmails.has(ek)) || existingKeys.has(nk)) continue;
      p.decisionMakers.push(c);
      if (ek) existingEmails.add(ek);
      existingKeys.add(nk);
      added++;
    }

    p.updatedAt = new Date().toISOString();
    p.lastActivityAt = p.updatedAt;

    const needsReview = p.decisionMakers.filter((d) => d.reviewStatus === "needs_review").length;
    await logActivity(store, {
      level: result.outcome === "no_contacts" ? "warning" : result.outcome === "needs_review" ? "warning" : "success",
      kind: "contacts_enriched",
      message:
        result.outcome === "no_contacts"
          ? `Enrichment found no contacts for ${p.companyName} (simulated).`
          : `Enrichment added ${added} contact${added === 1 ? "" : "s"} for ${p.companyName}${
              needsReview ? ` · ${needsReview} need review` : ""
            } (simulated).`,
      simulated: true,
      prospectId: p.id,
    });
    return { prospect: p, added, needsReview };
  });

  return NextResponse.json({
    prospect: saved?.prospect ?? null,
    added: saved?.added ?? 0,
    needsReview: saved?.needsReview ?? 0,
    result: { outcome: result.outcome, note: result.note, simulated: result.simulated },
    provider: providerStatus,
    domainChecked: normalizeDomain(prospect.domain),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { logActivity, mutateStore, newId } from "@/lib/nexai/store";
import { researchProvider } from "@/lib/nexai/providers";
import { normalizeDomain, looksLikeDomain } from "@/lib/nexai/domain";
import type { CandidateSource, Prospect } from "@/lib/nexai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IncomingCandidate {
  companyName?: string;
  domain?: string;
  website?: string;
  sector?: string;
  location?: string;
  employeeRange?: string;
  buyerHint?: string;
  rationale?: string;
  candidateSource?: CandidateSource;
}

interface SkipInfo {
  companyName: string;
  domain: string;
  reason: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const incoming: IncomingCandidate[] = Array.isArray(body.candidates) ? body.candidates : [];
  const generateResearch: boolean = body.generateResearch === true;

  if (incoming.length === 0) {
    return NextResponse.json({ error: "No candidates provided" }, { status: 400 });
  }

  const created: Prospect[] = [];
  const skipped: SkipInfo[] = [];

  // Pre-compute research outside the write lock (mock is fast but keep it clean).
  // We must dedupe first, so do a read to know existing domains.
  const result = await mutateStore(async (store) => {
    const existing = new Set(store.prospects.map((p) => normalizeDomain(p.domain)));
    const batchSeen = new Set<string>();
    const nowIso = new Date().toISOString();

    for (const c of incoming) {
      const domain = normalizeDomain(c.domain || c.website || "");
      const name = (c.companyName || domain || "").trim();

      if (!domain || !looksLikeDomain(domain)) {
        skipped.push({ companyName: name || "(unknown)", domain, reason: "Invalid or missing domain" });
        continue;
      }
      if (existing.has(domain)) {
        skipped.push({ companyName: name, domain, reason: "Already a prospect" });
        continue;
      }
      if (batchSeen.has(domain)) {
        skipped.push({ companyName: name, domain, reason: "Duplicate in this batch" });
        continue;
      }
      batchSeen.add(domain);

      const src: CandidateSource = c.candidateSource ?? "manual";
      // Discovered (simulated) companies are demo records; manual/CSV entries
      // are the user's real companies, so they are live records.
      const origin = src === "discovery" ? "demo" : "live";

      const prospect: Prospect = {
        id: newId("p"),
        origin,
        companyName: name || domain,
        domain,
        website: c.website || `https://${domain}`,
        industry: c.sector || undefined,
        location: c.location || undefined,
        employeeRange: c.employeeRange || undefined,
        qualification: "new",
        qualificationNotes: c.rationale || undefined,
        tags: [src, ...(c.sector ? [c.sector] : [])],
        decisionMakers: [],
        createdAt: nowIso,
        updatedAt: nowIso,
        lastActivityAt: nowIso,
      };

      if (generateResearch) {
        const report = await researchProvider.research(prospect);
        prospect.research = report;
        prospect.qualification = "researching";
      }

      store.prospects.push(prospect);
      existing.add(domain);
      created.push(prospect);
    }

    if (created.length > 0) {
      await logActivity(store, {
        level: "success",
        kind: "prospects_imported",
        message: `Imported ${created.length} ${created.length === 1 ? "prospect" : "prospects"}${
          generateResearch ? " with simulated research" : ""
        }${skipped.length ? ` (${skipped.length} skipped as duplicates/invalid)` : ""}.`,
        simulated: true,
      });
    }

    return { created, skipped };
  });

  return NextResponse.json(
    {
      created: result.created,
      createdCount: result.created.length,
      skipped: result.skipped,
      skippedCount: result.skipped.length,
    },
    { status: result.created.length > 0 ? 201 : 200 },
  );
}

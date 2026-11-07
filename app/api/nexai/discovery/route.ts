import { NextRequest, NextResponse } from "next/server";
import { discoveryProvider } from "@/lib/nexai/providers";
import { readStore } from "@/lib/nexai/store";
import { normalizeDomain } from "@/lib/nexai/domain";
import { DEFAULT_TARGETING, type DiscoveryCandidate, type TargetingCriteria } from "@/lib/nexai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const criteria: TargetingCriteria = {
    sectors: Array.isArray(body.sectors) ? body.sectors : DEFAULT_TARGETING.sectors,
    location: typeof body.location === "string" && body.location.trim() ? body.location : DEFAULT_TARGETING.location,
    minStaff: Number.isFinite(body.minStaff) ? body.minStaff : DEFAULT_TARGETING.minStaff,
    maxStaff: Number.isFinite(body.maxStaff) ? body.maxStaff : DEFAULT_TARGETING.maxStaff,
    buyerRoles: Array.isArray(body.buyerRoles) ? body.buyerRoles : DEFAULT_TARGETING.buyerRoles,
    keywords: typeof body.keywords === "string" ? body.keywords : "",
    limit: Number.isFinite(body.limit) ? body.limit : DEFAULT_TARGETING.limit,
  };

  try {
    const candidates = await discoveryProvider.discover(criteria);

    // Annotate duplicates against existing prospects (normalised domain).
    const store = await readStore();
    const byDomain = new Map<string, string>();
    for (const p of store.prospects) byDomain.set(normalizeDomain(p.domain), p.id);

    const annotated: DiscoveryCandidate[] = candidates.map((c) => {
      const dup = byDomain.get(normalizeDomain(c.domain));
      return dup ? { ...c, duplicateOfProspectId: dup } : c;
    });

    return NextResponse.json({
      candidates: annotated,
      provider: discoveryProvider.status(),
      criteria,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

import type { Prospect, ResearchReport, Source } from "../types";
import type { CSVRow, EnrichmentField, EnrichmentResult } from "../../types";

// LIVE research — reuses the existing Fire Enrich multi-agent pipeline.
// Only imported (and only runs) when FIRECRAWL_API_KEY + OPENAI_API_KEY exist.

const FIELDS: EnrichmentField[] = [
  { name: "industry", displayName: "Industry", description: "Primary industry / sector", type: "string", required: false },
  { name: "employeeCount", displayName: "Employee Count", description: "Approximate number of employees", type: "string", required: false },
  { name: "fundingStage", displayName: "Funding Stage", description: "Latest funding stage", type: "string", required: false },
  { name: "totalRaised", displayName: "Total Raised", description: "Total funding raised", type: "string", required: false },
  { name: "techStack", displayName: "Tech Stack", description: "Key technologies used", type: "array", required: false },
  { name: "summary", displayName: "Summary", description: "Short company summary and buying signals", type: "string", required: false },
];

function asString(v: EnrichmentResult | undefined): string | undefined {
  if (!v) return undefined;
  const val = v.value;
  if (Array.isArray(val)) return val.join(", ");
  return val != null ? String(val) : undefined;
}

function collectSources(enrichments: Record<string, EnrichmentResult>): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const r of Object.values(enrichments)) {
    for (const ctx of r.sourceContext ?? []) {
      if (ctx.url && !seen.has(ctx.url)) {
        seen.add(ctx.url);
        out.push({ title: ctx.url, url: ctx.url });
      }
    }
    if (r.source && !seen.has(r.source)) {
      seen.add(r.source);
      out.push({ title: r.source, url: r.source });
    }
  }
  return out.slice(0, 12);
}

export async function runLiveResearch(prospect: Prospect): Promise<ResearchReport> {
  const openaiApiKey = process.env.OPENAI_API_KEY as string;
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY as string;

  const { AgentEnrichmentStrategy } = await import("../../strategies/agent-enrichment-strategy");
  const strategy = new AgentEnrichmentStrategy(openaiApiKey, firecrawlApiKey);

  // The existing pipeline is keyed off an email domain; use the best contact
  // email, or synthesise one from the prospect domain.
  const email =
    prospect.decisionMakers.find((d) => d.email)?.email ?? `info@${prospect.domain}`;
  const row: CSVRow = { email, company: prospect.companyName };

  const result = await strategy.enrichRow(row, FIELDS, "email");
  const e = result.enrichments ?? {};

  const techStackRaw = e.techStack?.value;
  const techStack = Array.isArray(techStackRaw)
    ? techStackRaw.map(String)
    : techStackRaw
      ? String(techStackRaw).split(/,\s*/)
      : undefined;

  return {
    generatedAt: new Date().toISOString(),
    simulated: false,
    summary:
      asString(e.summary) ??
      `Live research completed for ${prospect.companyName}. See fields and sources below.`,
    industry: asString(e.industry) ?? prospect.industry,
    employeeRange: asString(e.employeeCount) ?? prospect.employeeRange,
    revenueRange: undefined,
    fundingStage: asString(e.fundingStage),
    totalRaised: asString(e.totalRaised),
    techStack,
    signals: [],
    sources: collectSources(e),
  };
}

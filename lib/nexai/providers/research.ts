import type { Prospect, ResearchReport } from "../types";
import type { ProviderStatus, ResearchProvider } from "./types";
import { hasAllEnv, missingEnv, PROVIDER_ENV } from "./env";

// Research provider.
//
// LIVE mode reuses the existing Fire Enrich multi-agent research pipeline
// (lib/agent-architecture). It is only invoked when FIRECRAWL_API_KEY and
// OPENAI_API_KEY are present on the server. Until then we run a deterministic
// MOCK that returns a clearly-simulated report.

const REQUIRED = PROVIDER_ENV.research;

function status(): ProviderStatus {
  const connected = hasAllEnv(REQUIRED);
  return {
    kind: "research",
    id: "firecrawl-openai",
    name: "Company Research (Firecrawl + OpenAI)",
    description:
      "Multi-agent web research: company profile, funding, tech stack and buying signals.",
    connected,
    mode: connected ? "live" : "mock",
    requiredEnv: [...REQUIRED],
    missingEnv: missingEnv(REQUIRED),
    docsUrl: "https://www.firecrawl.dev/app/api-keys",
  };
}

const INDUSTRIES_SIGNALS: Record<string, string[]> = {
  default: [
    "Recent senior hire in a go-to-market role",
    "Open roles suggest a scaling phase",
    "Published new product or pricing tier",
  ],
};

function mockResearch(prospect: Prospect): ResearchReport {
  const industry = prospect.industry ?? "B2B Services";
  const signals = INDUSTRIES_SIGNALS.default;
  return {
    generatedAt: new Date().toISOString(),
    simulated: true,
    summary:
      `[SIMULATED] ${prospect.companyName} (${prospect.domain}) is a ${industry.toLowerCase()} ` +
      `company based in ${prospect.location ?? "the UK"}. This is a mock report generated without ` +
      `live research credentials — connect Firecrawl + OpenAI to run real web research. The company ` +
      `appears to be a plausible fit for outsourced demand generation based on size and sector.`,
    industry,
    employeeRange: prospect.employeeRange ?? "51-200",
    revenueRange: "£5M-£20M (estimated)",
    fundingStage: "Unknown (mock)",
    totalRaised: "n/a",
    techStack: ["HubSpot", "Google Analytics", "LinkedIn Ads"],
    signals,
    sources: [
      { title: `${prospect.companyName} website (mock)`, url: prospect.website ?? `https://${prospect.domain}` },
      { title: "Simulated source — no live crawl performed", url: `https://${prospect.domain}/about` },
    ],
  };
}

export const researchProvider: ResearchProvider = {
  status,
  async research(prospect: Prospect): Promise<ResearchReport> {
    if (!hasAllEnv(REQUIRED)) {
      // Deterministic mock — fast, safe, clearly simulated.
      return mockResearch(prospect);
    }
    // LIVE path: delegate to the existing Fire Enrich pipeline. Imported lazily
    // so the heavy dependency only loads when credentials exist.
    try {
      const { runLiveResearch } = await import("./research-live");
      return await runLiveResearch(prospect);
    } catch (err) {
      // Fall back to a clearly-labelled mock rather than failing the request.
      const fallback = mockResearch(prospect);
      fallback.summary = `[LIVE RESEARCH FAILED — showing mock] ${(err as Error).message}`;
      return fallback;
    }
  },
};

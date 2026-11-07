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


// Custom-app ideas Nexai could build for a trade / field-service business.
// These are inferences, never presented as facts.
function appIdeasFor(sector: string): import("../types").CustomAppIdea[] {
  const generic = [
    {
      title: "Job scheduling & dispatch board",
      problem: "Engineers booked via phone calls and a spreadsheet; double-bookings and idle travel time.",
      idea: "A drag-and-drop scheduling board with engineer availability, postcode routing and SMS confirmations.",
      value: "Fewer wasted journeys, more jobs per engineer per day.",
    },
    {
      title: "Quote-to-invoice automation",
      problem: "Quotes written up manually in Word; slow follow-up and leakage between quote and invoice.",
      idea: "Templated quotes with e-sign, automatic job creation on acceptance, and one-click invoicing.",
      value: "Faster cash collection and fewer unbilled jobs.",
    },
    {
      title: "Field engineer mobile app",
      problem: "Paper job sheets and certificates re-keyed back at the office.",
      idea: "A mobile app for job notes, photos, parts used and digital sign-off synced to the office.",
      value: "Less admin, faster certification, tidier records.",
    },
  ];
  const bySector: Record<string, import("../types").CustomAppIdea> = {
    "Security & Fire": {
      title: "Asset & maintenance register",
      problem: "Alarm/fire assets tracked in spreadsheets; service dates missed.",
      idea: "An asset register with automated PPM reminders and compliance certificates per site.",
      value: "Recurring maintenance revenue captured, compliance evidenced.",
    },
    HVAC: {
      title: "Planned maintenance (PPM) scheduler",
      problem: "Recurring servicing scheduled manually and slipping.",
      idea: "Contract-driven PPM scheduling that auto-generates visits and reminders.",
      value: "Protected recurring revenue and SLA adherence.",
    },
    "Pest Control": {
      title: "Recurring visit & route planner",
      problem: "Regular treatment rounds planned on a whiteboard.",
      idea: "Recurring-visit planner with optimised routes and customer visit logs.",
      value: "Denser routes, reliable recurring visits.",
    },
  };
  const extra = bySector[sector];
  return extra ? [extra, ...generic.slice(0, 2)] : generic;
}

function mockResearch(prospect: Prospect): ResearchReport {
  const sector = prospect.industry ?? "Trade / Field Service";
  const staff = prospect.employeeRange ?? "11-50";
  const location = prospect.location ?? "United Kingdom";

  return {
    generatedAt: new Date().toISOString(),
    simulated: true,
    summary:
      `Simulated research for ${prospect.companyName} (${prospect.domain}). This is an ` +
      `illustrative report generated without live research credentials — figures and sources ` +
      `below are placeholders, not verified data. It shows the structure a live report will take: ` +
      `facts, qualification evidence, unknowns, questions for the owner, and custom-app ideas.`,

    // legacy flat fields (kept populated for compatibility)
    industry: sector,
    employeeRange: staff,
    signals: [],

    // --- structured report ---
    facts: [
      { label: "Sector", value: sector },
      { label: "Location", value: location },
      { label: "Estimated team size", value: `${staff} staff` },
      { label: "Buyer", value: "Owner / Managing Director (typical for this size)" },
      { label: "Service model", value: "Field-based jobs across a regional service area" },
    ],
    qualificationEvidence: [
      { point: `Team size ~${staff} sits inside the 10–50 staff target band.`, assessment: "fit" },
      { point: "Owner/MD-led decision making — short path to the buyer.", assessment: "fit" },
      { point: `${sector} is a core trade/field-service vertical for Nexai.`, assessment: "fit" },
      { point: "Likely reliant on spreadsheets/paper for scheduling and job records.", assessment: "fit" },
      { point: "Website gives no sign of an existing custom system — unverified.", assessment: "watch" },
    ],
    unknowns: [
      "Exact headcount and number of field engineers (estimate only).",
      "Current software in use (job management, accounting) — not confirmed.",
      "Decision-maker name, email and contact details — not yet enriched.",
      "Annual revenue and growth trajectory.",
      "Whether they have tried and rejected off-the-shelf tools before.",
    ],
    operationalQuestions: [
      "How are jobs currently scheduled and dispatched to engineers?",
      "How do engineers capture job notes, photos and sign-off on site?",
      "How long does it take to turn a completed job into an invoice?",
      "Where do things most often fall through the cracks day to day?",
      "What does the office team spend the most time re-keying?",
    ],
    customAppIdeas: appIdeasFor(sector),

    // Sources are illustrative placeholders — explicitly NOT real/verified.
    sourcesSimulated: true,
    sources: [
      { title: "Illustrative placeholder — not a real page", url: prospect.website ?? `https://${prospect.domain}` },
      { title: "Illustrative placeholder — no live crawl performed", url: `https://${prospect.domain}/about` },
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

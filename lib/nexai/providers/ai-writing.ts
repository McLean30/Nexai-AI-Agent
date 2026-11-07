import type { DecisionMaker, EmailMessage, Prospect, ResearchReport } from "../types";
import type { AiWritingProvider, ProviderStatus } from "./types";
import { hasAllEnv, missingEnv, PROVIDER_ENV } from "./env";

// AI writing provider (personalised outreach drafts).
//
// MOCK composes a deterministic, clearly-simulated draft from the prospect's
// structured research and Nexai's offer. It personalises only from sourced
// facts, phrases inferred operational problems as questions, and leaves
// unknowns unknown. LIVE would call OpenAI via OPENAI_API_KEY.

const REQUIRED = PROVIDER_ENV.aiWriting;

function status(): ProviderStatus {
  const connected = hasAllEnv(REQUIRED);
  return {
    kind: "aiWriting",
    id: "openai-writer",
    name: "AI Email Writing (OpenAI)",
    description: "Drafts personalised outreach and follow-up emails from research.",
    connected,
    mode: connected ? "live" : "mock",
    requiredEnv: [...REQUIRED],
    missingEnv: missingEnv(REQUIRED),
    docsUrl: "https://platform.openai.com/api-keys",
    plan: {
      liveService: "OpenAI",
      apiName: "OpenAI Responses API (gpt-class model)",
      reusesFirecrawl: false,
      implemented: false,
      envPlaceholder: false,
      note: "OPENAI_API_KEY is concrete; the live generation call is not wired yet.",
    },
  };
}

function firstName(name?: string): string {
  if (!name) return "there";
  return name.split(" ")[0];
}

function factValue(report: ResearchReport | undefined, label: string): string | undefined {
  return report?.facts?.find((f) => f.label.toLowerCase() === label.toLowerCase())?.value;
}

const NEXAI_OFFER =
  "We build custom software for trade & field-service businesses — things like job scheduling and dispatch, quote-to-invoice automation, and field-engineer mobile apps.";

function mockDraft(input: {
  prospect: Prospect;
  decisionMaker?: DecisionMaker;
  stepType?: EmailMessage["stepType"];
}): { subject: string; body: string } {
  const { prospect, decisionMaker } = input;
  const step = input.stepType ?? "initial";
  const name = firstName(decisionMaker?.name);
  const report = prospect.research;

  // Personalise ONLY from sourced facts. Anything not known stays out.
  const sector = factValue(report, "Sector") ?? prospect.industry;
  const location = factValue(report, "Location") ?? prospect.location;

  // Build an opener from whatever facts we actually have; omit unknowns.
  const facts: string[] = [];
  if (sector) facts.push(sector.toLowerCase());
  if (location) facts.push(`based in ${location}`);
  const opener = facts.length
    ? `I came across ${prospect.companyName} — ${facts.join(", ")}.`
    : `I came across ${prospect.companyName}.`;

  // Phrase an inferred operational problem as a question (never as a claim).
  const question =
    report?.operationalQuestions?.[0] ??
    (report?.customAppIdeas?.[0]
      ? `How are you currently handling ${report.customAppIdeas[0].title.toLowerCase()}?`
      : "How are you currently handling job scheduling and getting completed work invoiced?");

  const footer =
    "\n\n— Simulated draft. Personalised only from known facts; the operational point above is a question, not an assumption. Connect OpenAI to generate live copy.";

  if (step === "follow_up_1") {
    return {
      subject: `Re: A quick idea for ${prospect.companyName}`,
      body:
        `Hi ${name},\n\nJust following up. ${NEXAI_OFFER}\n\n` +
        `${question}\n\nIf it's useful I can share a couple of examples from similar ${sector ? sector.toLowerCase() + " " : ""}firms. ` +
        `Worth a short call?\n\nBest,\nNexai Digital${footer}`,
    };
  }

  return {
    subject: sector ? `Custom apps for ${sector.toLowerCase()} teams` : `A quick idea for ${prospect.companyName}`,
    body:
      `Hi ${name},\n\n${opener} ${NEXAI_OFFER}\n\n` +
      `A question rather than an assumption: ${question}\n\n` +
      `If reducing admin or double-handling is on your mind this year, would you be open to a 15-minute call to see if a small custom tool would pay for itself?\n\n` +
      `Best,\nNexai Digital${footer}`,
  };
}

export const aiWritingProvider: AiWritingProvider = {
  status,
  async draftEmail(input): Promise<{ subject: string; body: string }> {
    // LIVE generation would go here when OPENAI_API_KEY is configured.
    return mockDraft(input);
  },
};

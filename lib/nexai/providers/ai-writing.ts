import type { DecisionMaker, EmailMessage, Prospect } from "../types";
import type { AiWritingProvider, ProviderStatus } from "./types";
import { hasAllEnv, missingEnv, PROVIDER_ENV } from "./env";

// AI writing provider (personalised outreach drafts).
// MOCK composes a deterministic, clearly-simulated draft from known prospect
// facts. LIVE would call OpenAI (or another LLM) via OPENAI_API_KEY.

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
  };
}

function firstName(name?: string): string {
  if (!name) return "there";
  return name.split(" ")[0];
}

function mockDraft(input: {
  prospect: Prospect;
  decisionMaker?: DecisionMaker;
  stepType?: EmailMessage["stepType"];
}): { subject: string; body: string } {
  const { prospect, decisionMaker } = input;
  const step = input.stepType ?? "initial";
  const signal =
    prospect.research?.signals?.[0] ??
    `your work at ${prospect.companyName}`;
  const industry = (prospect.industry ?? "your sector").toLowerCase();
  const name = firstName(decisionMaker?.name);

  if (step === "follow_up_1") {
    return {
      subject: `Re: Demand gen for ${prospect.companyName}`,
      body:
        `Hi ${name},\n\n[SIMULATED DRAFT] Looping back on my note. Given ${signal.toLowerCase()}, ` +
        `I put together a short outline of how we'd approach outbound for a ${industry} company at ` +
        `your stage. Worth 15 minutes next week?\n\nBest,\nNexai Digital`,
    };
  }

  return {
    subject: `Pipeline for ${prospect.companyName}`,
    body:
      `Hi ${name},\n\n[SIMULATED DRAFT — generated without live AI credentials]\n\n` +
      `I noticed ${signal.toLowerCase()}. We help ${industry} companies add a predictable outbound ` +
      `channel without hiring an in-house SDR team.\n\n` +
      `If growing qualified pipeline is on the roadmap this quarter, would you be open to a short call?\n\n` +
      `Best,\nNexai Digital\n\n— This is a mock draft. Connect OpenAI to generate real copy.`,
  };
}

export const aiWritingProvider: AiWritingProvider = {
  status,
  async draftEmail(input): Promise<{ subject: string; body: string }> {
    // LIVE generation would go here when OPENAI_API_KEY is configured.
    return mockDraft(input);
  },
};

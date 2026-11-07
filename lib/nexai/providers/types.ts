import type {
  DecisionMaker,
  EmailMessage,
  Prospect,
  ProviderKind,
  ResearchReport,
} from "../types";

// Provider interfaces. Each capability is defined behind an interface so a mock
// implementation can be swapped for a live one once server-side credentials are
// supplied, without touching the UI or API routes.

export interface ProviderStatus {
  kind: ProviderKind;
  id: string;
  name: string;
  description: string;
  connected: boolean;
  mode: "mock" | "live";
  requiredEnv: string[];
  missingEnv: string[];
  docsUrl?: string;
}

export interface ResearchProvider {
  status(): ProviderStatus;
  /** Produce a company research report for a prospect. */
  research(prospect: Prospect): Promise<ResearchReport>;
}

export interface EnrichmentProvider {
  status(): ProviderStatus;
  /** Find/verify decision-maker contact details for a prospect. */
  enrich(prospect: Prospect): Promise<DecisionMaker[]>;
}

export interface AiWritingProvider {
  status(): ProviderStatus;
  /** Draft a personalised outreach email for a prospect + decision maker. */
  draftEmail(input: {
    prospect: Prospect;
    decisionMaker?: DecisionMaker;
    stepType?: EmailMessage["stepType"];
  }): Promise<{ subject: string; body: string }>;
}

export interface EmailSendResult {
  accepted: boolean;
  simulated: boolean;
  providerMessageId?: string;
  reason?: string;
}

export interface EmailProvider {
  status(): ProviderStatus;
  /** Send (or simulate sending) an email. Honours the sending-enabled flag. */
  send(input: {
    to: string;
    subject: string;
    body: string;
    sendingEnabled: boolean;
  }): Promise<EmailSendResult>;
}

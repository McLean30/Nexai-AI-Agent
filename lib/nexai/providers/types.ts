import type {
  DecisionMaker,
  DiscoveryCandidate,
  EmailMessage,
  OfferCheck,
  Prospect,
  ProviderKind,
  ResearchReport,
  ServiceCatalogue,
  TargetingCriteria,
} from "../types";

// Provider interfaces. Each capability is defined behind an interface so a mock
// implementation can be swapped for a live one once server-side credentials are
// supplied, without touching the UI or API routes.

/** How a provider will connect to a real service in the final integration. */
export interface ProviderPlan {
  liveService: string; // e.g. "Firecrawl + OpenAI"
  apiName: string; // the specific API(s) that will be called
  reusesFirecrawl: boolean;
  implemented: boolean; // true if a live code path exists today
  // True when `requiredEnv` is a generic placeholder with no real
  // implementation behind it yet.
  envPlaceholder: boolean;
  note?: string;
}

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
  plan?: ProviderPlan;
}

/** Result of a contact-enrichment run. */
export interface ContactEnrichmentResult {
  contacts: DecisionMaker[];
  outcome: "found" | "no_contacts" | "needs_review";
  note: string;
  simulated: boolean;
}

export interface DiscoveryProvider {
  status(): ProviderStatus;
  /** Surface candidate companies matching the targeting criteria. */
  discover(criteria: TargetingCriteria): Promise<DiscoveryCandidate[]>;
}

export interface ResearchProvider {
  status(): ProviderStatus;
  /** Produce a company research report. Recommendations are drawn from the
   *  approved/provisional service catalogue when provided. */
  research(prospect: Prospect, catalogue?: ServiceCatalogue): Promise<ResearchReport>;
}

export interface EnrichmentProvider {
  status(): ProviderStatus;
  /** Find/verify decision-maker contact details for a prospect. */
  enrich(prospect: Prospect): Promise<ContactEnrichmentResult>;
}

export interface AiWritingProvider {
  status(): ProviderStatus;
  /** Draft a personalised outreach email for a prospect + decision maker.
   *  The offer is built from the catalogue's offered services when provided. */
  draftEmail(input: {
    prospect: Prospect;
    decisionMaker?: DecisionMaker;
    stepType?: EmailMessage["stepType"];
    catalogue?: ServiceCatalogue;
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
  /** Send (or simulate sending) an email. Honours the sending-enabled flag,
   *  and — before live sending — requires an approved catalogue and a draft
   *  whose offers the catalogue supports. */
  send(input: {
    to: string;
    subject: string;
    body: string;
    sendingEnabled: boolean;
    catalogue?: ServiceCatalogue;
    offerCheck?: OfferCheck;
  }): Promise<EmailSendResult>;
}

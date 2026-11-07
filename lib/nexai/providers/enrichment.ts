import type { DecisionMaker, Prospect } from "../types";
import type { EnrichmentProvider, ProviderStatus } from "./types";
import { hasAllEnv, missingEnv, PROVIDER_ENV } from "./env";

// Contact enrichment provider (decision-maker discovery + email verification).
// MOCK generates plausible, clearly-simulated contacts. LIVE would call a
// contact-data API (e.g. Clearbit/Apollo/Hunter) via ENRICHMENT_API_KEY.

const REQUIRED = PROVIDER_ENV.enrichment;

function status(): ProviderStatus {
  const connected = hasAllEnv(REQUIRED);
  return {
    kind: "enrichment",
    id: "contact-enrichment",
    name: "Contact Enrichment",
    description: "Finds decision-maker names, titles, emails and verifies deliverability.",
    connected,
    mode: connected ? "live" : "mock",
    requiredEnv: [...REQUIRED],
    missingEnv: missingEnv(REQUIRED),
    docsUrl: undefined,
  };
}

const MOCK_ROLES = [
  { title: "VP Marketing", seniority: "VP" },
  { title: "Head of Growth", seniority: "Director" },
  { title: "Chief Operating Officer", seniority: "C-Suite" },
];

function mockEnrich(prospect: Prospect): DecisionMaker[] {
  const firstNames = ["Alex", "Sam", "Jordan", "Robin", "Casey"];
  const lastNames = ["Carter", "Bennett", "Osei", "Kaur", "Novak"];
  const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
  return MOCK_ROLES.slice(0, 2).map((role, i) => {
    const first = pick(firstNames, prospect.domain.length + i);
    const last = pick(lastNames, prospect.companyName.length + i);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@${prospect.domain}`;
    return {
      id: `dm_mock_${Date.now().toString(36)}_${i}`,
      name: `${first} ${last}`,
      title: role.title,
      email,
      emailVerification: i === 0 ? "verified" : "accept_all",
      seniority: role.seniority,
      sources: [
        { title: "Simulated — no live lookup performed", url: `https://${prospect.domain}/team` },
      ],
    } satisfies DecisionMaker;
  });
}

export const enrichmentProvider: EnrichmentProvider = {
  status,
  async enrich(prospect: Prospect): Promise<DecisionMaker[]> {
    // LIVE lookups would go here when ENRICHMENT_API_KEY is configured.
    return mockEnrich(prospect);
  },
};

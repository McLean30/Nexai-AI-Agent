import type { DecisionMaker, Prospect } from "../types";
import type { ContactEnrichmentResult, EnrichmentProvider, ProviderStatus } from "./types";
import { hasAllEnv, missingEnv, PROVIDER_ENV } from "./env";
import { normalizeDomain } from "../domain";

// Contact enrichment provider (decision-maker discovery + email verification).
//
// MOCK produces deterministic, clearly-simulated contacts covering the real
// outcomes a live service returns: a clean verified contact, accept-all
// catch-all domains, invalid addresses, conflicting identities, a
// company/domain mismatch, and "no contacts found". Uncertain results are
// routed to review. LIVE would call a contact-data + verification API
// (e.g. Hunter.io / Apollo) and could reuse Firecrawl to read team pages.

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
    docsUrl: "https://hunter.io/api",
    plan: {
      liveService: "Hunter.io (verification) + Firecrawl (team-page discovery)",
      apiName: "Hunter Email Finder/Verifier; Firecrawl scrape of /about & /team",
      reusesFirecrawl: true,
      implemented: false,
      envPlaceholder: true,
      note: "ENRICHMENT_API_KEY is a placeholder — no live lookup is wired yet.",
    },
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FIRST = ["James", "Sarah", "David", "Emma", "Michael", "Laura", "Paul", "Rachel", "Mark", "Claire"];
const LAST = ["Harding", "Whitfield", "Brennan", "Coyle", "Marsh", "Dalton", "Pryce", "Sefton", "Oakes", "Rhodes"];

function mkContact(
  seed: number,
  i: number,
  title: string,
  domain: string,
  partial: Partial<DecisionMaker>,
): DecisionMaker {
  const first = FIRST[(seed + i) % FIRST.length];
  const last = LAST[(seed * 7 + i * 3) % LAST.length];
  const name = `${first} ${last}`;
  const email = partial.email ?? `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
  return {
    id: `dm_mock_${seed.toString(36)}_${i}_${Date.now().toString(36)}`,
    name,
    title,
    email,
    emailVerification: "unknown",
    seniority: /owner|managing director|ceo/i.test(title) ? "C-Suite" : "Director",
    companyMatch: "match",
    checkedAt: new Date().toISOString(),
    simulated: true,
    reviewStatus: "ok",
    sources: [{ title: "Simulated — no live lookup performed", url: `https://${domain}/about` }],
    ...partial,
  };
}

function mockEnrich(prospect: Prospect): ContactEnrichmentResult {
  const domain = normalizeDomain(prospect.domain || prospect.website || "example.co.uk");
  const seed = hash(domain);
  const scenario = seed % 5;

  // Scenario 4 → no contacts found.
  if (scenario === 4) {
    return {
      contacts: [],
      outcome: "no_contacts",
      simulated: true,
      note: "No decision-maker contacts found for this domain (simulated).",
    };
  }

  const contacts: DecisionMaker[] = [];

  if (scenario === 0) {
    // Clean: one verified owner + one accept-all ops contact routed to review.
    contacts.push(
      mkContact(seed, 0, "Owner / Managing Director", domain, {
        emailVerification: "verified",
        companyMatch: "match",
        reviewStatus: "ok",
      }),
    );
    contacts.push(
      mkContact(seed, 1, "Operations Manager", domain, {
        emailVerification: "accept_all",
        companyMatch: "match",
        reviewStatus: "needs_review",
        reviewReason: "Domain is accept-all (catch-all) — deliverability unconfirmed.",
      }),
    );
  } else if (scenario === 1) {
    // Invalid address → review.
    contacts.push(
      mkContact(seed, 0, "Managing Director", domain, {
        emailVerification: "invalid",
        companyMatch: "match",
        reviewStatus: "needs_review",
        reviewReason: "Email failed verification (mailbox does not exist).",
      }),
    );
  } else if (scenario === 2) {
    // Conflicting identities: two people both claimed as MD.
    contacts.push(
      mkContact(seed, 0, "Managing Director", domain, {
        emailVerification: "unverified",
        companyMatch: "uncertain",
        reviewStatus: "needs_review",
        reviewReason: "Conflicting identity — two people listed as Managing Director.",
      }),
    );
    contacts.push(
      mkContact(seed, 1, "Managing Director", domain, {
        emailVerification: "unverified",
        companyMatch: "uncertain",
        reviewStatus: "needs_review",
        reviewReason: "Conflicting identity — two people listed as Managing Director.",
      }),
    );
  } else {
    // scenario 3 — company/domain mismatch.
    const owner = mkContact(seed, 0, "Director", domain, {
      email: `${FIRST[seed % FIRST.length].toLowerCase()}@gmail.com`,
      emailVerification: "unverified",
      companyMatch: "mismatch",
      reviewStatus: "needs_review",
      reviewReason: "Email domain does not match company domain — identity unconfirmed.",
    });
    contacts.push(owner);
  }

  const anyReview = contacts.some((c) => c.reviewStatus === "needs_review");
  return {
    contacts,
    outcome: anyReview ? "needs_review" : "found",
    simulated: true,
    note: anyReview
      ? "Some contacts need review (simulated)."
      : "Contacts found and verified (simulated).",
  };
}

export const enrichmentProvider: EnrichmentProvider = {
  status,
  async enrich(prospect: Prospect): Promise<ContactEnrichmentResult> {
    // LIVE lookups would go here when ENRICHMENT_API_KEY is configured.
    return mockEnrich(prospect);
  },
};

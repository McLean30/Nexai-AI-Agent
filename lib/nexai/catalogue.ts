import type {
  EmailMessage,
  OfferCheck,
  ServiceCatalogue,
} from "./types";

// The central Nexai service catalogue. It is the single source of truth for
// what Nexai offers and may claim. Research recommendations and email drafts
// draw from it, and before live sending a draft's offers must be supported by
// an APPROVED catalogue.
//
// This default is PROVISIONAL — the real business details are supplied later.

export const DEFAULT_CATALOGUE: ServiceCatalogue = {
  status: "provisional",
  provisionalNote:
    "Provisional catalogue — placeholder content pending the owner's final business details. Must be approved before live sending.",
  updatedAt: new Date(0).toISOString(),
  offeredServices: [
    {
      id: "svc_scheduling",
      name: "Job scheduling & dispatch",
      description: "Drag-and-drop scheduling, engineer availability, postcode routing, SMS confirmations.",
      keywords: ["scheduling", "dispatch", "job board", "routing"],
    },
    {
      id: "svc_quote_invoice",
      name: "Quote-to-invoice automation",
      description: "Templated quotes, e-sign, automatic job creation and one-click invoicing.",
      keywords: ["quote", "invoice", "invoicing", "quote-to-invoice", "billing"],
    },
    {
      id: "svc_field_app",
      name: "Field engineer mobile app",
      description: "On-site job notes, photos, parts used and digital sign-off synced to the office.",
      keywords: ["mobile app", "field engineer", "job sheet", "sign-off", "certificates"],
    },
    {
      id: "svc_customer_portal",
      name: "Customer portal",
      description: "Self-service bookings, job status and documents for the client's customers.",
      keywords: ["customer portal", "self-service", "booking portal"],
    },
    {
      id: "svc_asset_ppm",
      name: "Asset & maintenance (PPM) register",
      description: "Asset registers with planned-maintenance reminders and compliance certificates.",
      keywords: ["asset register", "ppm", "planned maintenance", "compliance", "maintenance register"],
    },
  ],
  excludedServices: [
    { id: "exc_seo", name: "SEO services", reason: "Not offered — Nexai builds custom software, not marketing.", keywords: ["seo", "search engine optimisation", "search engine optimization"] },
    { id: "exc_ads", name: "Paid ads management", reason: "Not offered.", keywords: ["paid ads", "google ads", "ppc", "meta ads", "ad management"] },
    { id: "exc_web", name: "Generic website design", reason: "Not a standalone offering.", keywords: ["website design", "web design", "brochure site"] },
    { id: "exc_retainer", name: "Ongoing marketing retainers", reason: "Not offered.", keywords: ["marketing retainer", "social media management", "content marketing"] },
  ],
  approvedClaims: [
    "We build bespoke software for trade & field-service businesses.",
    "UK-based team.",
    "Fixed-scope projects.",
  ],
  reviewItems: [
    "Specific ROI or savings figures (need owner sign-off).",
    "Named client references or case studies.",
    "Delivery timescales / guarantees.",
    "Pricing.",
  ],
};

// Keywords that indicate a review-item topic appearing in a draft.
const REVIEW_TRIGGERS: { topic: string; patterns: RegExp[] }[] = [
  { topic: "ROI / savings figures", patterns: [/\broi\b/i, /\d+\s*%/, /\bsave[sd]?\b.*\d/i, /guarantee/i] },
  { topic: "Client references / case studies", patterns: [/case stud/i, /our client[s]?\b/i, /reference customer/i] },
  { topic: "Delivery timescales", patterns: [/\bin \d+\s*(day|week|month)/i, /\bby next (week|month)/i] },
  { topic: "Pricing", patterns: [/£\s?\d/, /\bprice[sd]?\b/i, /\bcost[s]?\b.*\d/i] },
];

/**
 * Validate a draft's offers against the catalogue.
 * - Any excluded service the draft appears to offer → unsupported.
 * - Review-item topics mentioned, or a provisional catalogue → ambiguous/review.
 * - Otherwise supported.
 */
export function validateOffer(
  draft: Pick<EmailMessage, "subject" | "body">,
  catalogue: ServiceCatalogue,
): OfferCheck {
  const text = `${draft.subject}\n${draft.body}`.toLowerCase();

  const unsupported: string[] = [];
  for (const exc of catalogue.excludedServices) {
    if (exc.keywords.some((k) => text.includes(k.toLowerCase()))) {
      unsupported.push(exc.name);
    }
  }

  const matchedOfferings: string[] = [];
  for (const off of catalogue.offeredServices) {
    if (
      text.includes(off.name.toLowerCase()) ||
      off.keywords.some((k) => text.includes(k.toLowerCase()))
    ) {
      matchedOfferings.push(off.name);
    }
  }

  const ambiguous: string[] = [];
  for (const t of REVIEW_TRIGGERS) {
    if (t.patterns.some((re) => re.test(text))) ambiguous.push(t.topic);
  }
  if (catalogue.status !== "approved") {
    ambiguous.push("Catalogue is provisional — not yet approved for sending.");
  }

  let status: OfferCheck["status"] = "supported";
  if (unsupported.length > 0) status = "unsupported";
  else if (ambiguous.length > 0) status = "review";

  return {
    status,
    checkedAt: new Date().toISOString(),
    catalogueStatus: catalogue.status,
    unsupported,
    ambiguous,
    matchedOfferings,
  };
}

/** Whether a draft may be sent live: approved catalogue AND supported offer. */
export function canSendDraft(
  draft: Pick<EmailMessage, "offerCheck">,
  catalogue: ServiceCatalogue,
): { ok: boolean; reason?: string } {
  if (catalogue.status !== "approved") {
    return { ok: false, reason: "The service catalogue is provisional. Approve it before sending." };
  }
  if (!draft.offerCheck) {
    return { ok: false, reason: "Draft has not been checked against the catalogue." };
  }
  if (draft.offerCheck.status === "unsupported") {
    return { ok: false, reason: `Draft offers are not supported by the catalogue: ${draft.offerCheck.unsupported.join(", ")}.` };
  }
  if (draft.offerCheck.status === "review") {
    return { ok: false, reason: "Draft offers need owner review before sending." };
  }
  return { ok: true };
}

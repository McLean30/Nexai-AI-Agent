import type { DiscoveryCandidate, TargetingCriteria } from "../types";
import type { DiscoveryProvider, ProviderStatus } from "./types";
import { hasAllEnv, missingEnv, PROVIDER_ENV } from "./env";
import { normalizeDomain } from "../domain";

// Prospect discovery provider.
//
// LIVE mode would call a real company-search service (Companies House +
// web search, or a B2B data provider) via DISCOVERY_API_KEY. Until then we
// run a deterministic MOCK that invents plausible UK trade / field-service
// companies matching the targeting criteria. Everything it returns is clearly
// flagged simulated — no real companies, domains, or verification.

const REQUIRED = PROVIDER_ENV.discovery;

function status(): ProviderStatus {
  const connected = hasAllEnv(REQUIRED);
  return {
    kind: "discovery",
    id: "company-discovery",
    name: "Prospect Discovery",
    description:
      "Finds candidate companies matching targeting criteria (sector, size, region, buyer).",
    connected,
    mode: connected ? "live" : "mock",
    requiredEnv: [...REQUIRED],
    missingEnv: missingEnv(REQUIRED),
    docsUrl: undefined,
    plan: {
      liveService: "Firecrawl Search + Companies House",
      apiName: "Firecrawl /search for web discovery; Companies House API for registry data",
      reusesFirecrawl: true,
      implemented: false,
      envPlaceholder: true,
      note: "DISCOVERY_API_KEY is a placeholder — the live search is not wired yet. Firecrawl can be reused for discovery.",
    },
  };
}

// --- Mock data pools (all fictional) ---
const REGION_PREFIXES = [
  "Pennine", "Thames Valley", "Clyde", "Wessex", "Anglian", "Mersey", "Tyne",
  "Chiltern", "Severn", "Peak", "Solent", "Fenland", "Border", "Highland",
];
const SURNAMES = [
  "Hartley", "Whitcombe", "Beswick", "Oakley", "Rowntree", "Marsden", "Pennington",
  "Carrick", "Holloway", "Ashworth", "Fairbrother", "Dunmore",
];
const SECTOR_META: Record<string, { word: string; suffix: string; tech: string[] }> = {
  Electrical: { word: "Electrical", suffix: "Services", tech: ["job sheets on paper", "spreadsheet scheduling"] },
  "Plumbing & Heating": { word: "Plumbing & Heating", suffix: "Ltd", tech: ["phone-based booking", "paper certificates"] },
  HVAC: { word: "Climate", suffix: "Solutions", tech: ["manual PPM scheduling"] },
  Roofing: { word: "Roofing", suffix: "Contractors", tech: ["paper quotes"] },
  "Landscaping & Grounds": { word: "Grounds", suffix: "Maintenance", tech: ["whiteboard rounds"] },
  "Security & Fire": { word: "Fire & Security", suffix: "Systems", tech: ["spreadsheet asset registers"] },
  "Facilities Management": { word: "Facilities", suffix: "Group", tech: ["email-based work orders"] },
  "Pest Control": { word: "Pest", suffix: "Control", tech: ["paper visit logs"] },
  Drainage: { word: "Drainage", suffix: "Services", tech: ["phone dispatch"] },
  "Renewables & Solar": { word: "Renewables", suffix: "Ltd", tech: ["spreadsheet pipeline"] },
  "Building & Construction": { word: "Build", suffix: "Group", tech: ["paper timesheets"] },
  "Field Service": { word: "Field Service", suffix: "Co", tech: ["spreadsheet scheduling"] },
};

// Small deterministic PRNG so the same criteria yields a stable-ish set.
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function staffToRange(n: number): string {
  if (n <= 10) return "1-10";
  if (n <= 25) return "11-25";
  if (n <= 50) return "26-50";
  return "51-100";
}

function buildCandidate(
  rand: () => number,
  sector: string,
  criteria: TargetingCriteria,
): DiscoveryCandidate {
  const meta = SECTOR_META[sector] ?? { word: sector, suffix: "Ltd", tech: ["manual processes"] };
  const useSurname = rand() > 0.5;
  const base = useSurname
    ? SURNAMES[Math.floor(rand() * SURNAMES.length)]
    : REGION_PREFIXES[Math.floor(rand() * REGION_PREFIXES.length)];
  const companyName = `${base} ${meta.word} ${meta.suffix}`;
  const slug = companyName.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const domain = normalizeDomain(`${slug}.co.uk`);
  const staff = criteria.minStaff + Math.floor(rand() * (criteria.maxStaff - criteria.minStaff + 1));
  const buyer = criteria.buyerRoles[Math.floor(rand() * Math.max(1, criteria.buyerRoles.length))] ?? "Owner";
  const painHint = meta.tech[Math.floor(rand() * meta.tech.length)];

  return {
    companyName,
    domain,
    website: `https://${domain}`,
    sector,
    location: criteria.location,
    employeeRange: staffToRange(staff),
    buyerHint: `${buyer}-led (~${staff} staff)`,
    rationale: `Matches target: ${sector.toLowerCase()} · ~${staff} staff · ${criteria.location} · likely ${painHint}.`,
    simulated: true,
    candidateSource: "discovery",
  };
}

function mockDiscover(criteria: TargetingCriteria): DiscoveryCandidate[] {
  const sectors = criteria.sectors.length ? criteria.sectors : ["Field Service"];
  const limit = Math.min(Math.max(criteria.limit ?? 12, 1), 40);
  const seedStr = JSON.stringify({ ...criteria, limit });
  const rand = mulberry32(hashSeed(seedStr));

  const out: DiscoveryCandidate[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < limit && guard < limit * 12) {
    guard++;
    const sector = sectors[Math.floor(rand() * sectors.length)];
    const c = buildCandidate(rand, sector, criteria);
    if (seen.has(c.domain)) continue; // dedupe within the batch
    seen.add(c.domain);
    out.push(c);
  }
  return out;
}

export const discoveryProvider: DiscoveryProvider = {
  status,
  async discover(criteria: TargetingCriteria): Promise<DiscoveryCandidate[]> {
    if (!criteria.sectors || criteria.sectors.length === 0) {
      throw new Error("Select at least one sector to run discovery.");
    }
    // LIVE search would go here when DISCOVERY_API_KEY is configured.
    return mockDiscover(criteria);
  },
};

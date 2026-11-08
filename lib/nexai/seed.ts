import { DEFAULT_CATALOGUE } from "./catalogue";
import type {
  ActivityEvent,
  Campaign,
  Conversation,
  DecisionMaker,
  EmailMessage,
  Prospect,
  ResearchReport,
  Settings,
  StoreData,
} from "./types";

// One coherent, fully-simulated dataset shared across every screen.
// Every record is origin:"demo" / simulated:true so it is always clearly
// distinguishable from future live data.

const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number, hour = 10) =>
  new Date(now - offsetDays * day + hour * 60 * 60 * 1000 - 12 * 60 * 60 * 1000).toISOString();

function dm(partial: Omit<DecisionMaker, "sources"> & { sources?: DecisionMaker["sources"] }): DecisionMaker {
  return { sources: [], ...partial };
}

function report(r: Omit<ResearchReport, "simulated" | "generatedAt"> & { generatedAt?: string }): ResearchReport {
  return { simulated: true, generatedAt: r.generatedAt ?? iso(5), ...r };
}

const prospects: Prospect[] = [
  {
    id: "p_northwind",
    origin: "demo",
    companyName: "Northwind Logistics",
    domain: "northwind-logistics.com",
    website: "https://northwind-logistics.com",
    industry: "Freight & Logistics",
    location: "Manchester, UK",
    employeeRange: "201-500",
    qualification: "in_conversation",
    qualificationNotes: "Strong fit — expanding cross-border fulfilment, actively hiring ops.",
    fitScore: 88,
    tags: ["ICP", "EU expansion", "warm"],
    createdAt: iso(18),
    updatedAt: iso(1),
    lastActivityAt: iso(1),
    decisionMakers: [
      dm({
        id: "dm_nw_1",
        name: "Priya Shah",
        title: "Chief Operating Officer",
        email: "priya.shah@northwind-logistics.com",
        emailVerification: "verified",
        seniority: "C-Suite",
        linkedinUrl: "https://www.linkedin.com/in/priya-shah-ops",
        sources: [
          { title: "Northwind leadership page", url: "https://northwind-logistics.com/about/leadership" },
          { title: "LinkedIn profile", url: "https://www.linkedin.com/in/priya-shah-ops" },
        ],
      }),
      dm({
        id: "dm_nw_2",
        name: "Tom Ellison",
        title: "Head of Supply Chain",
        email: "t.ellison@northwind-logistics.com",
        emailVerification: "accept_all",
        seniority: "Director",
        sources: [{ title: "Press release, Jun 2025", url: "https://northwind-logistics.com/press/expansion" }],
      }),
    ],
    research: report({
      summary:
        "Northwind Logistics is a mid-market 3PL expanding from UK-only into EU cross-border fulfilment. Recent warehouse lease in Rotterdam and a run of operations hires point to a scaling phase where outsourced demand-gen is a fit.",
      industry: "Freight & Logistics",
      employeeRange: "201-500",
      revenueRange: "£40M-£60M",
      fundingStage: "Bootstrapped / PE-backed",
      totalRaised: "n/a",
      techStack: ["SAP", "Shopify Plus", "HubSpot", "Snowflake"],
      signals: [
        "Leased a Rotterdam distribution centre (Jun 2025)",
        "7 open operations & sales roles",
        "New VP Sales hire from a competitor",
      ],
      sources: [
        { title: "Rotterdam expansion press release", url: "https://northwind-logistics.com/press/expansion" },
        { title: "Careers page", url: "https://northwind-logistics.com/careers" },
      ],
    }),
  },
  {
    id: "p_brightloom",
    origin: "demo",
    companyName: "Brightloom Retail Group",
    domain: "brightloom.io",
    website: "https://brightloom.io",
    industry: "Retail / eCommerce",
    location: "London, UK",
    employeeRange: "51-200",
    qualification: "qualified",
    qualificationNotes: "Omnichannel retailer, strong digital spend. Good fit for paid + lifecycle.",
    fitScore: 82,
    tags: ["ICP", "retail"],
    createdAt: iso(14),
    updatedAt: iso(3),
    lastActivityAt: iso(3),
    decisionMakers: [
      dm({
        id: "dm_bl_1",
        name: "Marcus Reilly",
        title: "VP Marketing",
        email: "marcus@brightloom.io",
        emailVerification: "verified",
        seniority: "VP",
        linkedinUrl: "https://www.linkedin.com/in/marcus-reilly",
        sources: [{ title: "Brightloom team page", url: "https://brightloom.io/team" }],
      }),
    ],
    research: report({
      summary:
        "Brightloom runs 12 retail locations plus a growing DTC channel. They recently replatformed to Shopify Plus and are investing in lifecycle marketing — an opening for managed retention and paid social.",
      industry: "Retail / eCommerce",
      employeeRange: "51-200",
      revenueRange: "£15M-£25M",
      techStack: ["Shopify Plus", "Klaviyo", "Meta Ads", "GA4"],
      signals: ["Replatformed to Shopify Plus", "Hiring a lifecycle marketing manager"],
      sources: [{ title: "Shopify case study", url: "https://brightloom.io/blog/shopify-plus" }],
    }),
  },
  {
    id: "p_vant_health",
    origin: "demo",
    companyName: "Vanta Health",
    domain: "vantahealth.co",
    website: "https://vantahealth.co",
    industry: "Healthtech / SaaS",
    location: "Bristol, UK",
    employeeRange: "51-200",
    qualification: "contacted",
    qualificationNotes: "Series A healthtech. Awaiting reply to first touch.",
    fitScore: 76,
    tags: ["ICP", "SaaS", "Series A"],
    createdAt: iso(11),
    updatedAt: iso(2),
    lastActivityAt: iso(2),
    decisionMakers: [
      dm({
        id: "dm_vh_1",
        name: "Dr. Elena Markova",
        title: "Co-founder & CEO",
        email: "elena@vantahealth.co",
        emailVerification: "verified",
        seniority: "C-Suite",
        linkedinUrl: "https://www.linkedin.com/in/elena-markova",
        sources: [{ title: "TechCrunch funding article", url: "https://techcrunch.com/vanta-health-series-a" }],
      }),
      dm({
        id: "dm_vh_2",
        name: "Jordan Pike",
        title: "Head of Growth",
        email: "jordan.pike@vantahealth.co",
        emailVerification: "unverified",
        seniority: "Director",
        sources: [],
      }),
    ],
    research: report({
      summary:
        "Vanta Health raised a £9M Series A to scale their clinician scheduling platform across the NHS and private providers. Growth team is small and under pressure to build pipeline — a fit for outsourced outbound.",
      industry: "Healthtech / SaaS",
      employeeRange: "51-200",
      revenueRange: "£3M-£6M ARR",
      fundingStage: "Series A",
      totalRaised: "£12.5M",
      techStack: ["AWS", "React", "HubSpot", "Segment"],
      signals: ["Closed £9M Series A (Sep 2025)", "First Head of Growth hire", "NHS framework listing"],
      sources: [
        { title: "TechCrunch funding article", url: "https://techcrunch.com/vanta-health-series-a" },
        { title: "Crunchbase profile", url: "https://www.crunchbase.com/organization/vanta-health" },
      ],
    }),
  },
  {
    id: "p_orbital",
    origin: "demo",
    companyName: "Orbital Fintech",
    domain: "orbitalpay.com",
    website: "https://orbitalpay.com",
    industry: "Fintech / Payments",
    location: "Edinburgh, UK",
    employeeRange: "201-500",
    qualification: "booked",
    qualificationNotes: "Discovery call booked for next week. Replied positively to follow-up 1.",
    fitScore: 91,
    tags: ["ICP", "fintech", "hot"],
    createdAt: iso(21),
    updatedAt: iso(0),
    lastActivityAt: iso(0),
    decisionMakers: [
      dm({
        id: "dm_or_1",
        name: "Sofia Almeida",
        title: "Chief Marketing Officer",
        email: "sofia.almeida@orbitalpay.com",
        emailVerification: "verified",
        seniority: "C-Suite",
        linkedinUrl: "https://www.linkedin.com/in/sofia-almeida-cmo",
        sources: [{ title: "Orbital leadership", url: "https://orbitalpay.com/company/leadership" }],
      }),
    ],
    research: report({
      summary:
        "Orbital is a payments infrastructure provider moving upmarket into enterprise. They are standing up a new demand-gen function and evaluating agency partners to accelerate SQL volume ahead of a Series C.",
      industry: "Fintech / Payments",
      employeeRange: "201-500",
      revenueRange: "£30M-£50M",
      fundingStage: "Series B",
      totalRaised: "£78M",
      techStack: ["Kubernetes", "Go", "Marketo", "Salesforce"],
      signals: ["Hiring VP Demand Gen", "Enterprise pricing tier launched", "Pre-Series-C press"],
      sources: [{ title: "Sifted profile", url: "https://sifted.eu/orbital-fintech" }],
    }),
  },
  {
    id: "p_greenfield",
    origin: "demo",
    companyName: "Greenfield Energy",
    domain: "greenfield-energy.co.uk",
    website: "https://greenfield-energy.co.uk",
    industry: "Renewables / CleanTech",
    location: "Leeds, UK",
    employeeRange: "501-1000",
    qualification: "researching",
    qualificationNotes: "Enterprise renewables. Still confirming the right buying unit.",
    fitScore: 69,
    tags: ["enterprise", "cleantech"],
    createdAt: iso(7),
    updatedAt: iso(4),
    lastActivityAt: iso(4),
    decisionMakers: [
      dm({
        id: "dm_gf_1",
        name: "Alan Whitfield",
        title: "Marketing Director",
        emailVerification: "unknown",
        seniority: "Director",
        sources: [],
      }),
    ],
  },
  {
    id: "p_lumen",
    origin: "demo",
    companyName: "Lumen Studios",
    domain: "lumenstudios.design",
    website: "https://lumenstudios.design",
    industry: "Creative Agency",
    location: "Brighton, UK",
    employeeRange: "11-50",
    qualification: "disqualified",
    qualificationNotes: "Direct competitor (also an agency). Disqualified.",
    fitScore: 18,
    tags: ["competitor"],
    createdAt: iso(9),
    updatedAt: iso(6),
    lastActivityAt: iso(6),
    decisionMakers: [],
  },
  {
    id: "p_quadrant",
    origin: "demo",
    companyName: "Quadrant Manufacturing",
    domain: "quadrant-mfg.com",
    website: "https://quadrant-mfg.com",
    industry: "Industrial Manufacturing",
    location: "Birmingham, UK",
    employeeRange: "501-1000",
    qualification: "new",
    tags: ["ICP", "industrial"],
    fitScore: 64,
    createdAt: iso(1),
    updatedAt: iso(1),
    lastActivityAt: iso(1),
    decisionMakers: [
      dm({
        id: "dm_qd_1",
        name: "Rachel Nguyen",
        title: "Head of Marketing",
        email: "rachel.nguyen@quadrant-mfg.com",
        emailVerification: "accept_all",
        seniority: "Director",
        sources: [],
      }),
    ],
  },
  {
    id: "p_meridian",
    origin: "demo",
    companyName: "Meridian Legal",
    domain: "meridianlegal.co.uk",
    website: "https://meridianlegal.co.uk",
    industry: "Professional Services",
    location: "London, UK",
    employeeRange: "51-200",
    qualification: "new",
    tags: ["ICP", "prof-services"],
    fitScore: 58,
    createdAt: iso(0),
    updatedAt: iso(0),
    lastActivityAt: iso(0),
    decisionMakers: [],
  },
  {
    id: "p_castor",
    origin: "demo",
    companyName: "Castor Robotics",
    domain: "castorrobotics.ai",
    website: "https://castorrobotics.ai",
    industry: "Deep Tech / Robotics",
    location: "Cambridge, UK",
    employeeRange: "11-50",
    qualification: "contacted",
    qualificationNotes: "Bounced on first send — email invalid, needs re-enrichment.",
    fitScore: 72,
    tags: ["ICP", "deeptech"],
    createdAt: iso(13),
    updatedAt: iso(5),
    lastActivityAt: iso(5),
    decisionMakers: [
      dm({
        id: "dm_ca_1",
        name: "Henrik Vossen",
        title: "CEO",
        email: "henrik@castorrobotics.ai",
        emailVerification: "invalid",
        seniority: "C-Suite",
        sources: [],
      }),
    ],
  },
  {
    id: "p_fathom",
    origin: "demo",
    companyName: "Fathom Analytics Ltd",
    domain: "fathom-analytics.co",
    website: "https://fathom-analytics.co",
    industry: "Data / SaaS",
    location: "Remote (UK)",
    employeeRange: "11-50",
    qualification: "qualified",
    qualificationNotes: "Product-led SaaS wanting to add outbound motion.",
    fitScore: 79,
    tags: ["ICP", "SaaS", "PLG"],
    createdAt: iso(10),
    updatedAt: iso(4),
    lastActivityAt: iso(4),
    decisionMakers: [
      dm({
        id: "dm_fa_1",
        name: "Beatrice Lind",
        title: "Founder",
        email: "bea@fathom-analytics.co",
        emailVerification: "verified",
        seniority: "C-Suite",
        linkedinUrl: "https://www.linkedin.com/in/beatrice-lind",
        sources: [{ title: "Company about page", url: "https://fathom-analytics.co/about" }],
      }),
    ],
    research: report({
      summary:
        "Fathom is a bootstrapped product analytics tool with strong inbound but no outbound motion. The founder wants to test agency-led outbound into mid-market product teams.",
      industry: "Data / SaaS",
      employeeRange: "11-50",
      revenueRange: "£2M-£4M ARR",
      fundingStage: "Bootstrapped",
      techStack: ["Vercel", "Next.js", "Stripe", "PostgreSQL"],
      signals: ["Founder posted about trying outbound", "Launched a sales tier"],
      sources: [{ title: "Founder blog post", url: "https://fathom-analytics.co/blog/outbound-experiment" }],
    }),
  },
];

// ---- Emails & conversations (coherent with the prospects above) ----

function email(e: Partial<EmailMessage> & Pick<EmailMessage, "id" | "prospectId" | "subject" | "body" | "stepType" | "status">): EmailMessage {
  return {
    direction: e.direction ?? "outbound",
    simulated: true,
    createdAt: e.createdAt ?? iso(3),
    ...e,
  };
}

const orbitalThread: EmailMessage[] = [
  email({
    id: "em_or_1",
    prospectId: "p_orbital",
    decisionMakerId: "dm_or_1",
    stepType: "initial",
    subject: "Scaling SQLs ahead of your Series C",
    body: "Hi Sofia,\n\nCongrats on the enterprise tier launch. As Orbital stands up demand gen ahead of the next raise, we help payments scale-ups add a predictable outbound channel...\n\nWorth a quick 15 minutes?\n\nBest,\nNexai Digital",
    status: "sent",
    sentAt: iso(9),
    createdAt: iso(9),
  }),
  email({
    id: "em_or_2",
    prospectId: "p_orbital",
    decisionMakerId: "dm_or_1",
    stepType: "follow_up_1",
    subject: "Re: Scaling SQLs ahead of your Series C",
    body: "Hi Sofia,\n\nLooping back — I put together a short teardown of three outbound plays other payments scale-ups are using. Happy to share.\n\nBest,\nNexai Digital",
    status: "sent",
    sentAt: iso(4),
    createdAt: iso(4),
  }),
  email({
    id: "em_or_3",
    prospectId: "p_orbital",
    decisionMakerId: "dm_or_1",
    stepType: "reply",
    direction: "inbound",
    subject: "Re: Scaling SQLs ahead of your Series C",
    body: "This is timely — we're reviewing agency partners this quarter. Can you do Thursday at 2pm? — Sofia",
    status: "replied",
    sentAt: iso(0),
    createdAt: iso(0),
  }),
];

const vantaThread: EmailMessage[] = [
  email({
    id: "em_vh_1",
    prospectId: "p_vant_health",
    decisionMakerId: "dm_vh_1",
    stepType: "initial",
    subject: "Pipeline for Vanta's NHS push",
    body: "Hi Elena,\n\nSaw the Series A — nice work. With a new Head of Growth and NHS framework listing, building repeatable pipeline is probably top of mind...\n\nOpen to a short call?\n\nBest,\nNexai Digital",
    status: "sent",
    sentAt: iso(2),
    createdAt: iso(2),
  }),
];

const castorThread: EmailMessage[] = [
  email({
    id: "em_ca_1",
    prospectId: "p_castor",
    decisionMakerId: "dm_ca_1",
    stepType: "initial",
    subject: "Outbound for Castor's commercial launch",
    body: "Hi Henrik,\n\nAs Castor moves from R&D into commercial...\n\nBest,\nNexai Digital",
    status: "bounced",
    sentAt: iso(5),
    createdAt: iso(5),
  }),
];

const northwindThread: EmailMessage[] = [
  email({
    id: "em_nw_1",
    prospectId: "p_northwind",
    decisionMakerId: "dm_nw_1",
    stepType: "initial",
    subject: "Demand gen for your EU expansion",
    body: "Hi Priya,\n\nWith the Rotterdam DC and the ops hiring, it looks like Northwind is scaling cross-border fulfilment...\n\nBest,\nNexai Digital",
    status: "sent",
    sentAt: iso(8),
    createdAt: iso(8),
  }),
  email({
    id: "em_nw_2",
    prospectId: "p_northwind",
    decisionMakerId: "dm_nw_1",
    stepType: "reply",
    direction: "inbound",
    subject: "Re: Demand gen for your EU expansion",
    body: "Interesting timing. Send me a bit more on how you'd approach the Benelux market. — Priya",
    status: "replied",
    sentAt: iso(1),
    createdAt: iso(1),
  }),
];

const conversations: Conversation[] = [
  {
    id: "c_orbital",
    prospectId: "p_orbital",
    decisionMakerId: "dm_or_1",
    subject: "Scaling SQLs ahead of your Series C",
    status: "booked",
    simulated: true,
    messages: orbitalThread,
    updatedAt: iso(0),
  },
  {
    id: "c_northwind",
    prospectId: "p_northwind",
    decisionMakerId: "dm_nw_1",
    subject: "Demand gen for your EU expansion",
    status: "replied",
    simulated: true,
    messages: northwindThread,
    updatedAt: iso(1),
  },
  {
    id: "c_vanta",
    prospectId: "p_vant_health",
    decisionMakerId: "dm_vh_1",
    subject: "Pipeline for Vanta's NHS push",
    status: "awaiting_reply",
    simulated: true,
    messages: vantaThread,
    updatedAt: iso(2),
  },
  {
    id: "c_castor",
    prospectId: "p_castor",
    decisionMakerId: "dm_ca_1",
    subject: "Outbound for Castor's commercial launch",
    status: "bounced",
    simulated: true,
    messages: castorThread,
    updatedAt: iso(5),
  },
];

const campaigns: Campaign[] = [
  {
    id: "camp_q4_uk_scaleups",
    name: "Q4 — UK Scale-ups",
    origin: "demo",
    status: "active",
    dailyProspectTarget: 20,
    totalEmailLimit: 60,
    timezone: "Europe/London",
    sendWindow: { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
    prospectIds: [
      "p_northwind",
      "p_brightloom",
      "p_vant_health",
      "p_orbital",
      "p_quadrant",
      "p_fathom",
    ],
    createdAt: iso(21),
  },
];

const activity: ActivityEvent[] = [
  { id: "a1", at: iso(0, 14), level: "success", kind: "reply_received", message: "Reply received from Sofia Almeida (Orbital Fintech) — discovery call booked.", simulated: true, prospectId: "p_orbital" },
  { id: "a2", at: iso(0, 11), level: "info", kind: "prospect_added", message: "Prospect added: Meridian Legal.", simulated: true, prospectId: "p_meridian" },
  { id: "a3", at: iso(1, 16), level: "success", kind: "reply_received", message: "Reply received from Priya Shah (Northwind Logistics).", simulated: true, prospectId: "p_northwind" },
  { id: "a4", at: iso(1, 9), level: "info", kind: "prospect_added", message: "Prospect added: Quadrant Manufacturing.", simulated: true, prospectId: "p_quadrant" },
  { id: "a5", at: iso(2, 10), level: "info", kind: "email_sent", message: "Initial email queued to Dr. Elena Markova (Vanta Health).", simulated: true, prospectId: "p_vant_health" },
  { id: "a6", at: iso(4, 10), level: "info", kind: "email_sent", message: "Follow-up 1 sent to Sofia Almeida (Orbital Fintech).", simulated: true, prospectId: "p_orbital" },
  { id: "a7", at: iso(5, 13), level: "error", kind: "bounce", message: "Email to henrik@castorrobotics.ai bounced (invalid address). Follow-ups stopped.", simulated: true, prospectId: "p_castor" },
  { id: "a8", at: iso(5, 12), level: "warning", kind: "research_low_confidence", message: "Research for Greenfield Energy returned low-confidence buying unit — manual review suggested.", simulated: true, prospectId: "p_greenfield" },
  { id: "a9", at: iso(6, 15), level: "info", kind: "qualification_changed", message: "Lumen Studios marked Disqualified (competitor).", simulated: true, prospectId: "p_lumen" },
  { id: "a10", at: iso(8, 10), level: "info", kind: "email_sent", message: "Initial email sent to Priya Shah (Northwind Logistics).", simulated: true, prospectId: "p_northwind" },
];

export const DEFAULT_SETTINGS: Settings = {
  sendingEnabled: false, // hard default — outbound is off until explicitly enabled
  dailyProspectTarget: 20,
  totalEmailLimit: 60,
  timezone: "Europe/London",
  sendWindow: { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
  suppressionList: ["lumenstudios.design"],
};

// ---- Automation sequences (enrolment) ----
import type { ProspectAutomation, SequenceStep, Notification } from "./types";

function step(id: string, stepType: SequenceStep["stepType"], status: SequenceStep["status"], scheduledFor: string, sentOffset?: number): SequenceStep {
  const s: SequenceStep = { id, stepType, status, scheduledFor };
  if (status === "sent" && sentOffset != null) s.sentAt = iso(sentOffset);
  return s;
}

const AUTOMATION: Record<string, ProspectAutomation> = {
  // Active; a follow-up is DUE now → demonstrates the send-guard + queue tick.
  p_vant_health: {
    enrolled: true, status: "active", updatedAt: iso(2),
    steps: [
      step("sq_vh_1", "initial", "sent", iso(2), 2),
      step("sq_vh_2", "follow_up_1", "queued", iso(0)),
      step("sq_vh_3", "follow_up_2", "queued", iso(-3)),
    ],
  },
  // Active; next follow-up scheduled in the future.
  p_brightloom: {
    enrolled: true, status: "active", updatedAt: iso(3),
    steps: [
      step("sq_bl_1", "initial", "sent", iso(3), 3),
      step("sq_bl_2", "follow_up_1", "queued", iso(-2)),
    ],
  },
  // Active; initial not yet sent and due now.
  p_quadrant: {
    enrolled: true, status: "active", updatedAt: iso(1),
    steps: [
      step("sq_qd_1", "initial", "queued", iso(0)),
      step("sq_qd_2", "follow_up_1", "queued", iso(-3)),
    ],
  },
  // Replied → stopped, handed to Kieran.
  p_northwind: {
    enrolled: true, status: "stopped_reply", statusReason: "Inbound reply — handed to Kieran.", updatedAt: iso(1),
    steps: [
      step("sq_nw_1", "initial", "sent", iso(8), 8),
      step("sq_nw_2", "follow_up_1", "stopped", iso(1)),
    ],
  },
  // Replied & booked → completed/stopped.
  p_orbital: {
    enrolled: true, status: "stopped_reply", statusReason: "Replied — call booked.", updatedAt: iso(0),
    steps: [
      step("sq_or_1", "initial", "sent", iso(9), 9),
      step("sq_or_2", "follow_up_1", "sent", iso(4), 4),
    ],
  },
  // Bounced → suppressed, stopped.
  p_castor: {
    enrolled: true, status: "stopped_bounce", statusReason: "Email bounced — address suppressed.", updatedAt: iso(5),
    steps: [
      step("sq_ca_1", "initial", "sent", iso(5), 5),
      step("sq_ca_2", "follow_up_1", "stopped", iso(-1)),
    ],
  },
};

const seedNotifications: Notification[] = [
  { id: "ntf_nw", kind: "reply_needs_human", message: "Reply from Northwind Logistics — needs your response.", prospectId: "p_northwind", conversationId: "c_northwind", read: false, createdAt: iso(1, 16) },
];

export function buildSeedData(): StoreData {
  return {
    version: 1,
    prospects: prospects.map((p) => (AUTOMATION[p.id] ? { ...p, automation: AUTOMATION[p.id] } : p)),
    campaigns,
    conversations: conversations.map((c) =>
      c.id === "c_northwind" ? { ...c, needsHuman: true, handling: "kieran", lastInboundAt: iso(1) } : c,
    ),
    activity,
    settings: { ...DEFAULT_SETTINGS },
    catalogue: { ...DEFAULT_CATALOGUE },
    notifications: seedNotifications,
    processedEventIds: [],
  };
}

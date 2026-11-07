// Core domain types for the Nexai Digital prospect research & outreach app.
// Every record carries an `origin` so demo and live data stay distinguishable.

export type ISODate = string;

export type RecordOrigin = "demo" | "live";

export type ProviderKind = "research" | "enrichment" | "aiWriting" | "email";

export type QualificationStatus =
  | "new"
  | "researching"
  | "qualified"
  | "disqualified"
  | "contacted"
  | "in_conversation"
  | "booked";

export const QUALIFICATION_STATUSES: QualificationStatus[] = [
  "new",
  "researching",
  "qualified",
  "disqualified",
  "contacted",
  "in_conversation",
  "booked",
];

export const QUALIFICATION_LABELS: Record<QualificationStatus, string> = {
  new: "New",
  researching: "Researching",
  qualified: "Qualified",
  disqualified: "Disqualified",
  contacted: "Contacted",
  in_conversation: "In conversation",
  booked: "Call booked",
};

export type EmailVerification =
  | "verified"
  | "accept_all"
  | "unverified"
  | "invalid"
  | "unknown";

export const EMAIL_VERIFICATION_LABELS: Record<EmailVerification, string> = {
  verified: "Verified",
  accept_all: "Accept-all",
  unverified: "Unverified",
  invalid: "Invalid",
  unknown: "Unknown",
};

export interface Source {
  title: string;
  url: string;
}

export interface DecisionMaker {
  id: string;
  name: string;
  title: string;
  email?: string;
  emailVerification: EmailVerification;
  linkedinUrl?: string;
  seniority?: string;
  sources: Source[];
}

export interface ResearchReport {
  generatedAt: ISODate;
  simulated: boolean;
  summary: string;
  industry?: string;
  employeeRange?: string;
  revenueRange?: string;
  fundingStage?: string;
  totalRaised?: string;
  techStack?: string[];
  signals: string[];
  sources: Source[];
}

export type EmailStepType =
  | "initial"
  | "follow_up_1"
  | "follow_up_2"
  | "reply"
  | "bounce";

export type EmailStatus =
  | "draft"
  | "scheduled"
  | "sent"
  | "delivered"
  | "replied"
  | "bounced"
  | "opted_out";

export interface EmailMessage {
  id: string;
  prospectId: string;
  decisionMakerId?: string;
  direction: "outbound" | "inbound";
  stepType: EmailStepType;
  subject: string;
  body: string;
  status: EmailStatus;
  simulated: boolean;
  scheduledFor?: ISODate;
  sentAt?: ISODate;
  createdAt: ISODate;
}

export interface Prospect {
  id: string;
  origin: RecordOrigin;
  companyName: string;
  domain: string;
  website?: string;
  industry?: string;
  location?: string;
  employeeRange?: string;
  qualification: QualificationStatus;
  qualificationNotes?: string;
  fitScore?: number; // 0-100
  tags: string[];
  decisionMakers: DecisionMaker[];
  research?: ResearchReport;
  draftEmail?: EmailMessage;
  createdAt: ISODate;
  updatedAt: ISODate;
  lastActivityAt?: ISODate;
}

export interface Campaign {
  id: string;
  name: string;
  origin: RecordOrigin;
  status: "draft" | "active" | "paused";
  dailyProspectTarget: number;
  totalEmailLimit: number;
  timezone: string;
  sendWindow: SendWindow;
  prospectIds: string[];
  createdAt: ISODate;
}

export interface SendWindow {
  start: string; // "09:00"
  end: string; // "17:00"
  days: number[]; // 1=Mon ... 7=Sun
}

export interface Conversation {
  id: string;
  prospectId: string;
  decisionMakerId?: string;
  subject: string;
  status: "awaiting_reply" | "replied" | "bounced" | "opted_out" | "booked";
  simulated: boolean;
  messages: EmailMessage[];
  updatedAt: ISODate;
}

export interface ActivityEvent {
  id: string;
  at: ISODate;
  level: "info" | "success" | "warning" | "error";
  kind: string;
  message: string;
  simulated: boolean;
  prospectId?: string;
}

export interface Settings {
  // Explicit kill-switch for outbound email. Defaults to false and is NOT
  // derived from whether research keys exist — missing research keys must
  // never be the thing that keeps email from sending.
  sendingEnabled: boolean;
  dailyProspectTarget: number; // new prospects per working day (default 20)
  totalEmailLimit: number; // total emails incl. follow-ups (separate limit)
  timezone: string; // scheduling timezone (default Europe/London)
  sendWindow: SendWindow;
  suppressionList: string[]; // emails/domains never to contact
}

export interface StoreData {
  version: number;
  prospects: Prospect[];
  campaigns: Campaign[];
  conversations: Conversation[];
  activity: ActivityEvent[];
  settings: Settings;
}

export interface OverviewMetrics {
  totalProspects: number;
  newThisWeek: number;
  qualified: number;
  emailsSent: number;
  replies: number;
  replyRate: number; // 0-1
  bookedCalls: number;
  bounces: number;
  optOuts: number;
  byStatus: Record<QualificationStatus, number>;
  demoMode: boolean;
}

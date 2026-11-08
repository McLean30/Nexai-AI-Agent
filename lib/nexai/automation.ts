import type {
  AutomationStatus,
  Conversation,
  EmailMessage,
  MailboxEvent,
  MailboxEventType,
  Notification,
  Prospect,
  StoreData,
} from "./types";
import { newId, logActivity } from "./store";
import { normalizeDomain } from "./domain";

// Campaign automation & inbound-reply handling.
//
// Design principles for this milestone:
//  - The agent only sends initial outreach + scheduled follow-ups. It NEVER
//    auto-replies to inbound mail — every genuine reply is handed to Kieran.
//  - Any inbound reply stops queued/future automated messages for that
//    prospect and requires an explicit manual action to resume.
//  - Processing is idempotent (mailbox events carry an id that is recorded)
//    and concurrency-safe (all mutations run inside the store's serialized
//    write chain, and steps are claimed by an atomic status transition).

// ---------- helpers ----------

export function mainConversation(store: StoreData, prospectId: string): Conversation | undefined {
  const convos = store.conversations.filter((c) => c.prospectId === prospectId);
  if (convos.length === 0) return undefined;
  return convos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

/** Find the prospect's conversation, creating one if outreach has begun but no
 *  thread exists yet (e.g. an automated initial was sent without a seeded convo). */
export function ensureConversation(store: StoreData, prospectId: string): Conversation {
  const existing = mainConversation(store, prospectId);
  if (existing) return existing;
  const p = store.prospects.find((x) => x.id === prospectId);
  const dm = p?.decisionMakers.find((d) => d.email) ?? p?.decisionMakers[0];
  const convo: Conversation = {
    id: newId("c"),
    prospectId,
    decisionMakerId: dm?.id,
    subject: `Outreach — ${p?.companyName ?? prospectId}`,
    status: "awaiting_reply",
    simulated: true,
    messages: [],
    handling: "agent",
    updatedAt: new Date().toISOString(),
  };
  store.conversations.push(convo);
  return convo;
}

function contactEmail(store: StoreData, prospectId: string): string | undefined {
  const p = store.prospects.find((x) => x.id === prospectId);
  return p?.decisionMakers.find((d) => d.email)?.email;
}

export function isSuppressed(store: StoreData, email?: string): boolean {
  if (!email) return false;
  const list = store.settings.suppressionList.map((s) => s.toLowerCase());
  const e = email.toLowerCase();
  const domain = normalizeDomain(e);
  return list.includes(e) || list.includes(domain);
}

function suppress(store: StoreData, email?: string) {
  if (!email) return;
  const e = email.toLowerCase();
  if (!store.settings.suppressionList.map((s) => s.toLowerCase()).includes(e)) {
    store.settings.suppressionList.push(e);
  }
}

/** Add a notification, de-duplicating against an existing UNREAD one of the
 *  same kind for the same prospect — so duplicate events don't double-notify. */
function addNotification(store: StoreData, n: Omit<Notification, "id" | "createdAt" | "read">) {
  const dupe = store.notifications.find(
    (x) => !x.read && x.kind === n.kind && x.prospectId === n.prospectId,
  );
  if (dupe) return;
  store.notifications.unshift({
    id: newId("ntf"),
    read: false,
    createdAt: new Date().toISOString(),
    ...n,
  });
  if (store.notifications.length > 300) store.notifications.length = 300;
}

function appendInbound(
  convo: Conversation,
  prospectId: string,
  event: MailboxEvent,
  subject: string,
  body: string,
): void {
  const msg: EmailMessage = {
    id: newId("em"),
    prospectId,
    decisionMakerId: convo.decisionMakerId,
    direction: "inbound",
    stepType: event.type === "bounce" ? "bounce" : "reply",
    subject,
    body,
    status: event.type === "bounce" ? "bounced" : "replied",
    simulated: true,
    createdAt: event.receivedAt,
    sentAt: event.receivedAt,
  };
  convo.messages.push(msg);
  convo.lastInboundAt = event.receivedAt;
  convo.updatedAt = event.receivedAt;
}

/** Stop queued/sending steps and set the automation status. */
export function stopSequence(prospect: Prospect, status: AutomationStatus, reason: string): number {
  if (!prospect.automation) return 0;
  let stopped = 0;
  for (const s of prospect.automation.steps) {
    if (s.status === "queued" || s.status === "sending") {
      s.status = "stopped";
      s.skipReason = reason;
      stopped++;
    }
  }
  prospect.automation.status = status;
  prospect.automation.statusReason = reason;
  prospect.automation.updatedAt = new Date().toISOString();
  return stopped;
}

// ---------- reply classification ----------

const OOO_PATTERNS = [
  /out of (the )?office/i,
  /automatic reply/i,
  /auto[- ]?reply/i,
  /annual leave/i,
  /on holiday/i,
  /away from my desk/i,
  /on vacation/i,
  /currently away/i,
];
const OPTOUT_PATTERNS = [
  /unsubscribe/i,
  /opt[- ]?out/i,
  /remove me/i,
  /take me off/i,
  /stop emailing/i,
  /do not contact/i,
];

/** Refine a generic 'reply' into out_of_office / opt_out when the body says so. */
export function classifyReply(event: MailboxEvent): MailboxEventType {
  if (event.type !== "reply" && event.type !== "auto_reply") return event.type;
  const text = `${event.subject ?? ""}\n${event.body ?? ""}`;
  if (event.type === "auto_reply") return "out_of_office";
  if (OPTOUT_PATTERNS.some((re) => re.test(text))) return "opt_out";
  if (OOO_PATTERNS.some((re) => re.test(text))) return "out_of_office";
  return "reply";
}

// ---------- event processing (idempotent) ----------

export interface ProcessResult {
  processed: boolean;
  outcome: string;
  effectiveType?: MailboxEventType;
}

export function processMailboxEvent(store: StoreData, event: MailboxEvent): ProcessResult {
  // Idempotency — a repeated event id is a no-op.
  if (store.processedEventIds.includes(event.id)) {
    return { processed: false, outcome: "duplicate" };
  }
  store.processedEventIds.push(event.id);
  if (store.processedEventIds.length > 2000) store.processedEventIds.splice(0, 1000);

  const prospect = store.prospects.find((p) => p.id === event.prospectId);
  if (!prospect) return { processed: true, outcome: "unknown_prospect" };

  const convo = ensureConversation(store, event.prospectId);

  const effective = classifyReply(event);
  const email = event.fromEmail ?? contactEmail(store, event.prospectId);

  if (effective === "bounce") {
    appendInbound(convo, prospect.id, event, event.subject ?? "Delivery failure", event.body ?? "The message bounced (mailbox unavailable).");
    suppress(store, email);
    convo.status = "bounced";
    stopSequence(prospect, "stopped_bounce", "Email bounced — address suppressed.");
    addNotification(store, { kind: "bounce", message: `Bounce from ${prospect.companyName} — address suppressed.`, prospectId: prospect.id, conversationId: convo.id });
    logActivity(store, { level: "error", kind: "bounce", message: `Email to ${email ?? prospect.companyName} bounced. Address suppressed, follow-ups stopped.`, simulated: true, prospectId: prospect.id });
    return { processed: true, outcome: "bounce", effectiveType: effective };
  }

  if (effective === "opt_out") {
    appendInbound(convo, prospect.id, event, event.subject ?? "Unsubscribe", event.body ?? "Please remove me.");
    suppress(store, email);
    convo.status = "opted_out";
    stopSequence(prospect, "stopped_optout", "Recipient opted out — suppressed.");
    addNotification(store, { kind: "opt_out", message: `${prospect.companyName} opted out — suppressed.`, prospectId: prospect.id, conversationId: convo.id });
    logActivity(store, { level: "warning", kind: "opt_out", message: `${prospect.companyName} opted out. Address suppressed, follow-ups stopped.`, simulated: true, prospectId: prospect.id });
    return { processed: true, outcome: "opt_out", effectiveType: effective };
  }

  if (effective === "out_of_office") {
    // Pause for review — do NOT treat as a genuine reply, do NOT auto-resume.
    appendInbound(convo, prospect.id, event, event.subject ?? "Automatic reply: Out of office", event.body ?? "I am currently out of the office.");
    stopSequence(prospect, "paused_review", "Out-of-office auto-reply — paused for review.");
    convo.reviewFlag = "out_of_office";
    convo.needsHuman = true;
    convo.handling = "kieran";
    addNotification(store, { kind: "out_of_office_review", message: `Out-of-office from ${prospect.companyName} — sequence paused for review.`, prospectId: prospect.id, conversationId: convo.id });
    logActivity(store, { level: "warning", kind: "out_of_office", message: `Out-of-office reply from ${prospect.companyName}. Sequence paused for Kieran's review.`, simulated: true, prospectId: prospect.id });
    return { processed: true, outcome: "out_of_office", effectiveType: effective };
  }

  // Genuine reply → hand to Kieran, stop automation.
  appendInbound(convo, prospect.id, event, event.subject ?? `Re: outreach`, event.body ?? "Thanks for reaching out.");
  convo.status = "replied";
  convo.needsHuman = true;
  convo.handling = "kieran";
  stopSequence(prospect, "stopped_reply", "Inbound reply — handed to Kieran.");
  addNotification(store, { kind: "reply_needs_human", message: `Reply from ${prospect.companyName} — needs your response.`, prospectId: prospect.id, conversationId: convo.id });
  logActivity(store, { level: "success", kind: "reply_received", message: `Reply received from ${prospect.companyName}. Automation stopped; handed to Kieran.`, simulated: true, prospectId: prospect.id });
  return { processed: true, outcome: "reply", effectiveType: effective };
}

// ---------- queue processing (send-guard + claim) ----------

export interface QueueResult {
  sent: { prospectId: string; company: string; stepType: string }[];
  skipped: { prospectId: string; company: string; reason: string }[];
  rechecked: number;
}

/**
 * Process due follow-ups. For each enrolled, active prospect, the earliest due
 * queued step is sent — but ONLY after re-checking for replies/suppression
 * immediately beforehand. The step is claimed with an atomic status transition
 * so concurrent ticks can never double-send.
 */
export function processQueue(store: StoreData, nowMs: number = Date.now()): QueueResult {
  const sent: QueueResult["sent"] = [];
  const skipped: QueueResult["skipped"] = [];
  let rechecked = 0;

  for (const prospect of store.prospects) {
    const auto = prospect.automation;
    if (!auto || !auto.enrolled) continue;

    const due = auto.steps
      .filter((s) => s.status === "queued" && new Date(s.scheduledFor).getTime() <= nowMs)
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];
    if (!due) continue;

    // --- RE-CHECK immediately before sending ---
    rechecked++;
    const convo = ensureConversation(store, prospect.id);
    const email = contactEmail(store, prospect.id);

    // 1. Automation no longer active (a reply/bounce/opt-out/OOO stopped it).
    if (auto.status !== "active") {
      due.status = "skipped";
      due.skipReason = `Automation ${auto.status} — not sent.`;
      skipped.push({ prospectId: prospect.id, company: prospect.companyName, reason: due.skipReason });
      continue;
    }
    // 2. A fresh inbound reply is awaiting human handling.
    if (convo?.needsHuman) {
      stopSequence(prospect, "stopped_reply", "Reply detected at send time — handed to Kieran.");
      due.status = "stopped";
      due.skipReason = "Reply detected at send-time re-check.";
      skipped.push({ prospectId: prospect.id, company: prospect.companyName, reason: due.skipReason });
      continue;
    }
    // 3. Contact suppressed (bounce/opt-out).
    if (isSuppressed(store, email)) {
      stopSequence(prospect, "stopped_optout", "Contact suppressed — not sent.");
      due.status = "stopped";
      due.skipReason = "Contact on suppression list.";
      skipped.push({ prospectId: prospect.id, company: prospect.companyName, reason: due.skipReason });
      continue;
    }

    // --- CLAIM the step (atomic within the serialized write chain) ---
    due.status = "sending";

    // --- SEND (simulated — no real email; M365 is wired at final integration) ---
    const nowIso = new Date(nowMs).toISOString();
    const dm = prospect.decisionMakers.find((d) => d.email) ?? prospect.decisionMakers[0];
    const stepLabel = due.stepType.replace(/_/g, " ");
    const email_: EmailMessage = {
      id: newId("em"),
      prospectId: prospect.id,
      decisionMakerId: dm?.id,
      direction: "outbound",
      stepType: due.stepType,
      subject: `Re: A quick idea for ${prospect.companyName}`,
      body: `Hi ${dm?.name?.split(" ")[0] ?? "there"},\n\n[Simulated ${stepLabel}] Following up on my previous note.\n\nBest,\nNexai Digital`,
      status: "sent",
      simulated: true,
      sentAt: nowIso,
      createdAt: nowIso,
    };
    convo.messages.push(email_);
    convo.updatedAt = nowIso;
    due.status = "sent";
    due.sentAt = nowIso;
    due.emailId = email_.id;

    // Mark automation completed if no queued steps remain.
    if (!auto.steps.some((s) => s.status === "queued")) {
      auto.status = "completed";
      auto.statusReason = "All scheduled steps sent.";
    }
    auto.updatedAt = nowIso;

    logActivity(store, { level: "info", kind: "follow_up_sent", message: `Simulated ${stepLabel} sent to ${prospect.companyName} (re-checked for replies first).`, simulated: true, prospectId: prospect.id });
    sent.push({ prospectId: prospect.id, company: prospect.companyName, stepType: due.stepType });
  }

  return { sent, skipped, rechecked };
}

// ---------- manual controls ----------

/** Explicit manual resume — required to restart any stopped/paused sequence. */
export function resumeAutomation(store: StoreData, prospectId: string, nowMs = Date.now()): boolean {
  const p = store.prospects.find((x) => x.id === prospectId);
  if (!p || !p.automation) return false;

  // Re-queue the next not-yet-sent step a short delay from now.
  const nextStopped = p.automation.steps.find((s) => s.status === "stopped" || s.status === "skipped");
  if (nextStopped) {
    nextStopped.status = "queued";
    nextStopped.skipReason = undefined;
    nextStopped.scheduledFor = new Date(nowMs + 60_000).toISOString();
  }
  p.automation.status = "active";
  p.automation.statusReason = "Manually resumed by Kieran.";
  p.automation.updatedAt = new Date(nowMs).toISOString();

  const convo = mainConversation(store, prospectId);
  if (convo) {
    convo.needsHuman = false;
    convo.humanHandledAt = new Date(nowMs).toISOString();
    convo.handling = "agent";
    convo.reviewFlag = undefined;
  }
  // Clear related unread notifications.
  for (const n of store.notifications) {
    if (n.prospectId === prospectId && !n.read) n.read = true;
  }
  logActivity(store, { level: "info", kind: "automation_resumed", message: `Automation manually resumed for ${p.companyName}.`, simulated: true, prospectId });
  return true;
}

export function stopAutomationManual(store: StoreData, prospectId: string): boolean {
  const p = store.prospects.find((x) => x.id === prospectId);
  if (!p || !p.automation) return false;
  stopSequence(p, "completed", "Manually stopped by Kieran.");
  logActivity(store, { level: "info", kind: "automation_stopped", message: `Automation manually stopped for ${p.companyName}.`, simulated: true, prospectId });
  return true;
}

/** Kieran marks a reply as personally handled (without resuming automation). */
export function markHandled(store: StoreData, prospectId: string): boolean {
  const convo = mainConversation(store, prospectId);
  if (!convo) return false;
  convo.needsHuman = false;
  convo.humanHandledAt = new Date().toISOString();
  for (const n of store.notifications) {
    if (n.prospectId === prospectId && !n.read) n.read = true;
  }
  const p = store.prospects.find((x) => x.id === prospectId);
  logActivity(store, { level: "info", kind: "reply_handled", message: `Reply from ${p?.companyName ?? prospectId} marked handled by Kieran.`, simulated: true, prospectId });
  return true;
}

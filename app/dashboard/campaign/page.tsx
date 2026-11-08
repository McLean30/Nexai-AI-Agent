"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, apiSend } from "../_components/useApi";
import { Card, Spinner, ErrorState, EmptyState, StatusPill, OriginBadge } from "../_components/primitives";
import { relativeTime } from "../_components/format";
import { emitAgent } from "../_components/agent-bus";
import type { Campaign, EmailMessage, MailboxEventType, QualificationStatus, Settings } from "@/lib/nexai/types";

type ProspectRow = {
  id: string;
  companyName: string;
  domain: string;
  qualification: QualificationStatus;
  draftEmail: EmailMessage | null;
  automationStatus: string | null;
  automationReason: string | null;
  nextStep: { stepType: string; scheduledFor: string } | null;
  sentCount: number;
};
type CampaignView = Campaign & { prospects: ProspectRow[] };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const AUTO_BADGE: Record<string, string> = {
  active: "nx-badge-green",
  stopped_reply: "nx-badge-blue",
  stopped_bounce: "nx-badge-red",
  stopped_optout: "nx-badge-gray",
  paused_review: "nx-badge-amber",
  completed: "nx-badge-gray",
};
const AUTO_LABEL: Record<string, string> = {
  active: "Active",
  stopped_reply: "Stopped · reply",
  stopped_bounce: "Stopped · bounce",
  stopped_optout: "Stopped · opt-out",
  paused_review: "Paused · review",
  completed: "Completed",
};

export default function CampaignPage() {
  const { data, loading, error, reload } = useApi<{ campaigns: CampaignView[]; settings: Settings }>("/api/nexai/campaigns");
  const [preview, setPreview] = useState<EmailMessage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState<string | null>(null);
  const [simFor, setSimFor] = useState<ProspectRow | null>(null);

  if (loading) return <div className="nx-content"><Spinner label="Loading campaign…" /></div>;
  if (error || !data) return <div className="nx-content"><ErrorState message={error ?? "No data"} onRetry={reload} /></div>;

  const campaign = data.campaigns[0];
  const s = data.settings;

  const processQueue = async () => {
    setBusy("queue");
    setTick(null);
    emitAgent("awake", "Processing queue", { simulated: true });
    try {
      const res = await apiSend<{ sent: { company: string }[]; skipped: { company: string; reason: string }[]; rechecked: number }>("/api/nexai/mailbox/process-queue", "POST");
      setTick(`Tick: re-checked ${res.rechecked}, sent ${res.sent.length}${res.skipped.length ? `, skipped ${res.skipped.length}` : ""}.`);
      emitAgent("completed", `Sent ${res.sent.length} follow-up${res.sent.length === 1 ? "" : "s"}`, { simulated: true });
      reload();
    } catch {
      emitAgent("error", "Queue tick failed");
    } finally {
      setBusy(null);
    }
  };

  const simulate = async (prospectId: string, type: MailboxEventType) => {
    setBusy(`sim-${type}`);
    try {
      await apiSend("/api/nexai/mailbox/simulate", "POST", { prospectId, type, body: type === "opt_out" ? "Please unsubscribe me." : type === "out_of_office" ? "Automatic reply: I am out of the office." : "Thanks, tell me more." });
      if (type === "reply") emitAgent("reply", "Reply received — hand to Kieran", { simulated: true });
      else if (type === "out_of_office") emitAgent("review", "Out-of-office — review", { simulated: true });
      else emitAgent("completed", `${type.replace(/_/g, " ")} handled`, { simulated: true });
      setSimFor(null);
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="nx-content">
      <div className="nx-page-head">
        <div>
          <h1 className="nx-h1">Campaign</h1>
          <p className="nx-sub">Outreach sequencing, scheduling and sending controls.</p>
        </div>
      </div>

      {/* sending safeguard banner */}
      <Card style={{ marginBottom: 16, borderColor: s.sendingEnabled ? "rgba(251,191,36,0.4)" : "rgba(52,211,153,0.3)" }}>
        <div className="nx-spread" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="nx-row" style={{ gap: 10 }}>
            <span className={`nx-badge ${s.sendingEnabled ? "nx-badge-amber" : "nx-badge-green"}`}>
              Sending {s.sendingEnabled ? "ENABLED" : "disabled"}
            </span>
            <span className="nx-dim" style={{ fontSize: 13 }}>
              {s.sendingEnabled
                ? "Live sending is on. Emails would be sent when a mailbox is connected."
                : "Outbound email is off (safe default). All previews below are drafts — nothing is sent."}
            </span>
          </div>
          <Link href="/dashboard/connections" className="nx-btn nx-btn-sm">Sending settings →</Link>
        </div>
      </Card>

      {!campaign ? (
        <Card><EmptyState title="No campaigns yet" hint="Create a campaign to start sequencing outreach." /></Card>
      ) : (
        <>
          {/* config */}
          <div className="nx-stats" style={{ marginBottom: 16 }}>
            <Card className="nx-stat">
              <div className="nx-stat-label">Daily new prospects</div>
              <div className="nx-stat-value nx-stat-accent">{s.dailyProspectTarget}</div>
              <div className="nx-stat-meta">target per working day</div>
            </Card>
            <Card className="nx-stat">
              <div className="nx-stat-label">Total email limit</div>
              <div className="nx-stat-value">{s.totalEmailLimit}</div>
              <div className="nx-stat-meta">incl. follow-ups</div>
            </Card>
            <Card className="nx-stat">
              <div className="nx-stat-label">Timezone</div>
              <div className="nx-stat-value" style={{ fontSize: 18, marginTop: 14 }}>{s.timezone}</div>
              <div className="nx-stat-meta">scheduling clock</div>
            </Card>
            <Card className="nx-stat">
              <div className="nx-stat-label">Send window</div>
              <div className="nx-stat-value" style={{ fontSize: 18, marginTop: 14 }}>{s.sendWindow.start}–{s.sendWindow.end}</div>
              <div className="nx-stat-meta">{s.sendWindow.days.map((d) => DAYS[d - 1]).join(", ")}</div>
            </Card>
          </div>

          <Card style={{ marginBottom: 16 }}>
            <div className="nx-spread" style={{ flexWrap: "wrap", gap: 10 }}>
              <div className="nx-row" style={{ gap: 12 }}>
                <strong>{campaign.name}</strong>
                <span className={`nx-badge ${campaign.status === "active" ? "nx-badge-green" : campaign.status === "paused" ? "nx-badge-amber" : "nx-badge-gray"}`}>
                  {campaign.status}
                </span>
                <OriginBadge origin={campaign.origin} />
              </div>
              <span className="nx-muted" style={{ fontSize: 12 }}>{campaign.prospects.length} prospects enrolled</span>
            </div>
            <div className="nx-muted" style={{ fontSize: 12, marginTop: 8 }}>
              The agent sends the initial email and scheduled follow-ups. Replies, bounces, opt-outs and out-of-office
              auto-replies stop the sequence automatically; replies are handed to Kieran. Every follow-up is re-checked
              for replies immediately before sending. No automated replies are ever generated.
            </div>
          </Card>

          {/* Simulated mailbox controls (dev) */}
          <Card style={{ marginBottom: 16 }}>
            <div className="nx-spread" style={{ flexWrap: "wrap", gap: 10 }}>
              <div>
                <strong style={{ fontSize: 14 }}>Simulated mailbox</strong>
                <div className="nx-muted" style={{ fontSize: 12, marginTop: 3 }}>
                  Microsoft 365 connects at the final integration stage. For now, inject inbound events and run the scheduler tick.
                </div>
              </div>
              <button className="nx-btn nx-btn-primary" disabled={busy === "queue"} onClick={processQueue}>
                {busy === "queue" ? "Processing…" : "Process due queue"}
              </button>
            </div>
            {tick && <div className="nx-badge nx-badge-blue" style={{ marginTop: 10 }}>{tick}</div>}
          </Card>

          {/* prospect queue with automation state */}
          <div className="nx-table-wrap">
            <table className="nx-table">
              <thead>
                <tr><th>Company</th><th className="nx-hide-sm">Stage</th><th>Automation</th><th className="nx-hide-sm">Next follow-up</th><th>Simulate reply</th></tr>
              </thead>
              <tbody>
                {campaign.prospects.map((p) => (
                  <tr key={p.id} style={{ cursor: "default" }}>
                    <td>
                      <Link href={`/dashboard/prospects/${p.id}`} className="nx-link nx-company">{p.companyName}</Link>
                      <div className="nx-domain">{p.domain}</div>
                    </td>
                    <td className="nx-hide-sm"><StatusPill status={p.qualification} /></td>
                    <td>
                      {p.automationStatus ? (
                        <span className={`nx-badge ${AUTO_BADGE[p.automationStatus] ?? "nx-badge-gray"}`}>{AUTO_LABEL[p.automationStatus] ?? p.automationStatus}</span>
                      ) : (
                        <span className="nx-muted" style={{ fontSize: 12 }}>Not enrolled</span>
                      )}
                      <div className="nx-muted" style={{ fontSize: 10.5, marginTop: 3 }}>{p.sentCount} sent</div>
                    </td>
                    <td className="nx-hide-sm nx-dim" style={{ fontSize: 12 }}>
                      {p.nextStep ? `${p.nextStep.stepType.replace(/_/g, " ")} · ${relativeTime(p.nextStep.scheduledFor)}` : "—"}
                    </td>
                    <td>
                      {p.automationStatus === "active" ? (
                        <button className="nx-btn nx-btn-sm" onClick={() => setSimFor(p)}>Simulate…</button>
                      ) : (
                        <span className="nx-muted" style={{ fontSize: 11 }}>stopped</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {simFor && (
        <div className="nx-overlay" onClick={() => setSimFor(null)}>
          <div className="nx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nx-modal-head">
              <strong>Simulate inbound event</strong>
              <div className="nx-muted" style={{ fontSize: 12, marginTop: 3 }}>{simFor.companyName} — stands in for a Microsoft 365 webhook.</div>
            </div>
            <div className="nx-modal-body">
              <div className="nx-grid cols-2" style={{ gap: 10 }}>
                <button className="nx-btn" disabled={!!busy} onClick={() => simulate(simFor.id, "reply")}>Genuine reply</button>
                <button className="nx-btn" disabled={!!busy} onClick={() => simulate(simFor.id, "out_of_office")}>Out-of-office</button>
                <button className="nx-btn nx-btn-danger" disabled={!!busy} onClick={() => simulate(simFor.id, "bounce")}>Bounce</button>
                <button className="nx-btn nx-btn-danger" disabled={!!busy} onClick={() => simulate(simFor.id, "opt_out")}>Opt-out</button>
              </div>
              <div className="nx-muted" style={{ fontSize: 11.5, marginTop: 12 }}>
                A genuine reply stops the sequence and is handed to Kieran. Bounce/opt-out suppress the address. Out-of-office pauses for review.
              </div>
            </div>
            <div className="nx-modal-foot">
              <button className="nx-btn" onClick={() => setSimFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="nx-overlay" onClick={() => setPreview(null)}>
          <div className="nx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nx-modal-head">
              <div className="nx-spread">
                <strong>Email preview</strong>
                <span className="nx-badge nx-badge-purple">{preview.simulated ? "Simulated" : "Live"} draft</span>
              </div>
            </div>
            <div className="nx-modal-body">
              <div className="nx-label">Subject</div>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>{preview.subject}</div>
              <div className="nx-label">Body</div>
              <div className="nx-dim" style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{preview.body}</div>
            </div>
            <div className="nx-modal-foot">
              <span className="nx-muted" style={{ fontSize: 12, marginRight: "auto" }}>Draft only — not sent.</span>
              <button className="nx-btn" onClick={() => setPreview(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

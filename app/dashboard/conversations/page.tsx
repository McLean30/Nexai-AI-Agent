"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi, apiSend } from "../_components/useApi";
import { Card, Spinner, ErrorState, EmptyState } from "../_components/primitives";
import { relativeTime } from "../_components/format";
import type { Conversation } from "@/lib/nexai/types";

type ConversationView = Conversation & {
  companyName: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  researchSummary?: string;
  automationStatus?: string;
  automationReason?: string;
};

const STATUS_BADGE: Record<string, string> = {
  awaiting_reply: "nx-badge-amber",
  replied: "nx-badge-green",
  booked: "nx-badge-green",
  bounced: "nx-badge-red",
  opted_out: "nx-badge-gray",
};
const STATUS_LABEL: Record<string, string> = {
  awaiting_reply: "Awaiting reply",
  replied: "Replied",
  booked: "Call booked",
  bounced: "Bounced",
  opted_out: "Opted out",
};

function outlookCompose(email?: string, subject?: string): string {
  const to = encodeURIComponent(email ?? "");
  const su = encodeURIComponent(subject ? `Re: ${subject}` : "");
  return `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${su}`;
}

export default function ConversationsPage() {
  const { data, loading, error, reload } = useApi<{ conversations: ConversationView[]; needsHuman: number }>("/api/nexai/conversations");
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Deep-link: /dashboard/conversations?prospect=<id> pre-selects that thread
  // (used when the agent character is clicked).
  useEffect(() => {
    try {
      const pid = new URLSearchParams(window.location.search).get("prospect");
      if (pid && data?.conversations) {
        const match = data.conversations.find((c) => c.prospectId === pid);
        if (match) setActive(match.id);
      }
    } catch {
      /* ignore */
    }
  }, [data]);

  if (loading) return <div className="nx-content"><Spinner label="Loading conversations…" /></div>;
  if (error || !data) return <div className="nx-content"><ErrorState message={error ?? "No data"} onRetry={reload} /></div>;

  const selected = data.conversations.find((c) => c.id === active) ?? data.conversations[0];

  const act = async (prospectId: string, action: "resume" | "mark_handled") => {
    if (action === "resume" && !confirm("Resume the automated sequence for this prospect? (Use only after you've handled the reply.)")) return;
    setBusy(action);
    try {
      await apiSend(`/api/nexai/prospects/${prospectId}/automation`, "POST", { action });
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="nx-content">
      <div className="nx-page-head">
        <div>
          <h1 className="nx-h1">Conversations</h1>
          <p className="nx-sub">Replies are handed to Kieran for personal handling — the agent never auto-replies.</p>
        </div>
        {data.needsHuman > 0 && <span className="nx-badge nx-badge-amber">{data.needsHuman} need your response</span>}
      </div>

      {data.conversations.length === 0 ? (
        <Card><EmptyState title="No conversations yet" hint="Once prospects reply, their threads appear here." /></Card>
      ) : (
        <div className="nx-grid convo" style={{ alignItems: "start" }}>
          <div className="nx-grid" style={{ gap: 10 }}>
            {data.conversations.map((c) => (
              <Card key={c.id} className={selected?.id === c.id ? "nx-card-glow" : ""} style={{ cursor: "pointer", padding: 14 }}>
                <div onClick={() => setActive(c.id)}>
                  <div className="nx-spread">
                    <strong style={{ fontSize: 13.5 }}>{c.companyName}</strong>
                    {c.needsHuman ? (
                      <span className="nx-badge nx-badge-amber">Needs you</span>
                    ) : (
                      <span className={`nx-badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    )}
                  </div>
                  <div className="nx-muted" style={{ fontSize: 12, marginTop: 4 }}>{c.contactName}{c.contactTitle ? ` · ${c.contactTitle}` : ""}</div>
                  {c.reviewFlag === "out_of_office" && <div className="nx-badge nx-badge-purple" style={{ marginTop: 6 }}>Out-of-office — review</div>}
                  <div className="nx-muted" style={{ fontSize: 11, marginTop: 6 }}>{c.messages.length} messages · {relativeTime(c.updatedAt)}</div>
                </div>
              </Card>
            ))}
          </div>

          {selected && (
            <div className="nx-grid" style={{ gap: 12 }}>
              {/* Action bar when Kieran's attention is needed */}
              {selected.needsHuman && (
                <Card glow style={{ borderColor: "rgba(251,191,36,0.4)" }}>
                  <div className="nx-spread" style={{ flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>
                        {selected.reviewFlag === "out_of_office" ? "Out-of-office — review needed" : "Reply needs your personal response"}
                      </strong>
                      <div className="nx-dim" style={{ fontSize: 12.5, marginTop: 3 }}>
                        Automation is stopped for {selected.companyName}. {selected.reviewFlag === "out_of_office" ? "Decide whether to resume later." : "Respond personally in Outlook — no automated reply is sent."}
                      </div>
                    </div>
                  </div>
                  <div className="nx-row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <a className="nx-btn nx-btn-primary" href={outlookCompose(selected.contactEmail, selected.subject)} target="_blank" rel="noreferrer">
                      Respond in Outlook ↗
                    </a>
                    <button className="nx-btn" disabled={busy === "mark_handled"} onClick={() => act(selected.prospectId, "mark_handled")}>
                      {busy === "mark_handled" ? "…" : "Mark handled"}
                    </button>
                    <button className="nx-btn nx-btn-ghost" disabled={busy === "resume"} onClick={() => act(selected.prospectId, "resume")}>
                      {busy === "resume" ? "…" : "Resume automation"}
                    </button>
                    <Link className="nx-btn nx-btn-ghost" href={`/dashboard/prospects/${selected.prospectId}`}>Company report →</Link>
                  </div>
                </Card>
              )}

              {/* Company report summary + original outreach context */}
              <Card>
                <div className="nx-spread" style={{ marginBottom: 6 }}>
                  <div>
                    <strong>{selected.subject}</strong>
                    <div className="nx-muted" style={{ fontSize: 12, marginTop: 3 }}>
                      <Link href={`/dashboard/prospects/${selected.prospectId}`} className="nx-link">{selected.companyName}</Link>
                      {selected.contactName ? ` · ${selected.contactName}` : ""}
                      {selected.contactEmail ? ` · ${selected.contactEmail}` : ""}
                    </div>
                  </div>
                  <span className="nx-badge nx-badge-purple">Simulated thread</span>
                </div>
                {selected.researchSummary && (
                  <div className="nx-dim" style={{ fontSize: 12.5, lineHeight: 1.5, background: "var(--nx-bg-2)", border: "1px solid var(--nx-border)", borderRadius: 8, padding: 10, marginTop: 6 }}>
                    <span className="nx-label" style={{ margin: "0 0 4px" }}>Company report (summary)</span>
                    {selected.researchSummary}
                  </div>
                )}
                {selected.automationStatus && (
                  <div className="nx-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                    Automation: <strong className="nx-dim">{selected.automationStatus.replace(/_/g, " ")}</strong>
                    {selected.automationReason ? ` — ${selected.automationReason}` : ""}
                  </div>
                )}
              </Card>

              {/* Thread */}
              <Card>
                <div className="nx-label" style={{ marginBottom: 10 }}>Thread</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {selected.messages.map((m) => {
                    const inbound = m.direction === "inbound";
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: inbound ? "flex-start" : "flex-end",
                          maxWidth: "88%",
                          background: inbound ? "var(--nx-surface-2)" : "linear-gradient(135deg, rgba(37,99,235,0.22), rgba(56,189,248,0.1))",
                          border: "1px solid var(--nx-border)",
                          borderRadius: 12,
                          padding: "10px 13px",
                        }}
                      >
                        <div className="nx-muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                          {inbound ? "Prospect" : "Nexai (agent)"} · {m.stepType.replace(/_/g, " ")} · {relativeTime(m.sentAt ?? m.createdAt)}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4 }}>{m.subject}</div>
                        <div className="nx-dim" style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.body}</div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

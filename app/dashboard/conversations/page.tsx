"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "../_components/useApi";
import { Card, Spinner, ErrorState, EmptyState } from "../_components/primitives";
import { relativeTime } from "../_components/format";
import type { Conversation } from "@/lib/nexai/types";

type ConversationView = Conversation & { companyName: string; contactName?: string; contactTitle?: string };

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

export default function ConversationsPage() {
  const { data, loading, error, reload } = useApi<{ conversations: ConversationView[] }>("/api/nexai/conversations");
  const [active, setActive] = useState<string | null>(null);

  if (loading) return <div className="nx-content"><Spinner label="Loading conversations…" /></div>;
  if (error || !data) return <div className="nx-content"><ErrorState message={error ?? "No data"} onRetry={reload} /></div>;

  const selected = data.conversations.find((c) => c.id === active) ?? data.conversations[0];

  return (
    <div className="nx-content">
      <div className="nx-page-head">
        <div>
          <h1 className="nx-h1">Conversations</h1>
          <p className="nx-sub">Replies, bounces and booked calls across outreach threads.</p>
        </div>
      </div>

      {data.conversations.length === 0 ? (
        <Card><EmptyState title="No conversations yet" hint="Once prospects reply, their threads appear here." /></Card>
      ) : (
        <div className="nx-grid convo" style={{ alignItems: "start" }}>
          <div className="nx-grid" style={{ gap: 10 }}>
            {data.conversations.map((c) => (
              <Card
                key={c.id}
                className={selected?.id === c.id ? "nx-card-glow" : ""}
                style={{ cursor: "pointer", padding: 14 }}
              >
                <div onClick={() => setActive(c.id)}>
                  <div className="nx-spread">
                    <strong style={{ fontSize: 13.5 }}>{c.companyName}</strong>
                    <span className={`nx-badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                  </div>
                  <div className="nx-muted" style={{ fontSize: 12, marginTop: 4 }}>{c.contactName}{c.contactTitle ? ` · ${c.contactTitle}` : ""}</div>
                  <div className="nx-dim" style={{ fontSize: 12.5, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</div>
                  <div className="nx-muted" style={{ fontSize: 11, marginTop: 6 }}>{c.messages.length} messages · {relativeTime(c.updatedAt)}</div>
                </div>
              </Card>
            ))}
          </div>

          {selected && (
            <Card>
              <div className="nx-spread" style={{ marginBottom: 6 }}>
                <div>
                  <strong>{selected.subject}</strong>
                  <div className="nx-muted" style={{ fontSize: 12, marginTop: 3 }}>
                    <Link href={`/dashboard/prospects/${selected.prospectId}`} className="nx-link">{selected.companyName}</Link>
                    {selected.contactName ? ` · ${selected.contactName}` : ""}
                  </div>
                </div>
                <span className="nx-badge nx-badge-purple">Simulated thread</span>
              </div>
              <hr className="nx-divider" />
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selected.messages.map((m) => {
                  const inbound = m.direction === "inbound";
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: inbound ? "flex-start" : "flex-end",
                        maxWidth: "82%",
                        background: inbound ? "var(--nx-surface-2)" : "linear-gradient(135deg, rgba(37,99,235,0.22), rgba(56,189,248,0.1))",
                        border: "1px solid var(--nx-border)",
                        borderRadius: 12,
                        padding: "10px 13px",
                      }}
                    >
                      <div className="nx-muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                        {inbound ? "Prospect" : "Nexai"} · {m.stepType.replace(/_/g, " ")} · {relativeTime(m.sentAt ?? m.createdAt)}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4 }}>{m.subject}</div>
                      <div className="nx-dim" style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.body}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

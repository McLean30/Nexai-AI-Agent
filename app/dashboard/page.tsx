"use client";

import Link from "next/link";
import { useApi } from "./_components/useApi";
import { Card, Spinner, ErrorState, StatusPill, LevelDot } from "./_components/primitives";
import { relativeTime, pct } from "./_components/format";
import {
  QUALIFICATION_LABELS,
  type ActivityEvent,
  type OverviewMetrics,
  type QualificationStatus,
} from "@/lib/nexai/types";

function StatTile({ label, value, meta, accent }: { label: string; value: string | number; meta?: string; accent?: boolean }) {
  return (
    <Card className="nx-stat" glow={accent}>
      <div className="nx-stat-label">{label}</div>
      <div className={`nx-stat-value ${accent ? "nx-stat-accent" : ""}`}>{value}</div>
      {meta && <div className="nx-stat-meta">{meta}</div>}
    </Card>
  );
}

export default function OverviewPage() {
  const { data, loading, error, reload } = useApi<{ metrics: OverviewMetrics }>("/api/nexai/overview");
  const act = useApi<{ activity: ActivityEvent[] }>("/api/nexai/activity?limit=6");

  if (loading) return <div className="nx-content"><Spinner label="Loading overview…" /></div>;
  if (error || !data) return <div className="nx-content"><ErrorState message={error ?? "No data"} onRetry={reload} /></div>;

  const m = data.metrics;
  const statuses = Object.keys(m.byStatus) as QualificationStatus[];
  const maxCount = Math.max(1, ...statuses.map((s) => m.byStatus[s]));

  return (
    <div className="nx-content">
      <div className="nx-page-head">
        <div>
          <h1 className="nx-h1">Overview</h1>
          <p className="nx-sub">Pipeline health across research, outreach and conversations.</p>
        </div>
        <Link href="/dashboard/prospects" className="nx-btn nx-btn-primary">
          View prospects
        </Link>
      </div>

      <div className="nx-stats" style={{ marginBottom: 16 }}>
        <StatTile label="Prospects" value={m.totalProspects} meta={`+${m.newThisWeek} new this week`} accent />
        <StatTile label="Emails sent" value={m.emailsSent} meta={`${m.bounces} bounced`} />
        <StatTile label="Replies" value={m.replies} meta={`${pct(m.replyRate)} reply rate`} />
        <StatTile label="Calls booked" value={m.bookedCalls} meta={`${m.qualified} qualified`} />
      </div>

      <div className="nx-grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <Card>
          <div className="nx-spread" style={{ marginBottom: 14 }}>
            <strong>Pipeline by stage</strong>
            <Link href="/dashboard/prospects" className="nx-link" style={{ fontSize: 12 }}>
              Open list →
            </Link>
          </div>
          {statuses.map((s) => (
            <Link
              key={s}
              href={`/dashboard/prospects?status=${s}`}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ width: 120, flexShrink: 0 }}>
                <StatusPill status={s} />
              </div>
              <div style={{ flex: 1, height: 8, background: "var(--nx-surface-3)", borderRadius: 5, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(m.byStatus[s] / maxCount) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, var(--nx-accent-strong), var(--nx-accent))",
                    borderRadius: 5,
                  }}
                />
              </div>
              <div className="nx-dim" style={{ width: 24, textAlign: "right" }}>
                {m.byStatus[s]}
              </div>
            </Link>
          ))}
        </Card>

        <Card>
          <div className="nx-spread" style={{ marginBottom: 14 }}>
            <strong>Recent activity</strong>
            <Link href="/dashboard/activity" className="nx-link" style={{ fontSize: 12 }}>
              All →
            </Link>
          </div>
          {act.loading ? (
            <Spinner />
          ) : act.data?.activity.length ? (
            act.data.activity.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(30,43,71,0.5)" }}>
                <div style={{ marginTop: 5 }}>
                  <LevelDot level={a.level} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>{a.message}</div>
                  <div className="nx-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {relativeTime(a.at)} {a.simulated && "· simulated"}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="nx-muted" style={{ fontSize: 13 }}>No activity yet.</div>
          )}
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="nx-row" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="nx-badge nx-badge-purple">Demo dataset</span>
          <span className="nx-muted" style={{ fontSize: 12.5 }}>
            Every figure above is computed from one coherent set of simulated prospects. Connect providers on the{" "}
            <Link href="/dashboard/connections" className="nx-link">Connections</Link> screen to start working with live data.
          </span>
        </div>
      </Card>
    </div>
  );
}

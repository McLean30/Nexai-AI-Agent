"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "../_components/useApi";
import { Card, Spinner, ErrorState, EmptyState, LevelDot } from "../_components/primitives";
import { dateTime } from "../_components/format";
import type { ActivityEvent } from "@/lib/nexai/types";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "info", label: "Info" },
  { key: "success", label: "Success" },
  { key: "warning", label: "Warnings" },
  { key: "error", label: "Errors" },
];

export default function ActivityPage() {
  const [level, setLevel] = useState("all");
  const { data, loading, error, reload } = useApi<{ activity: ActivityEvent[] }>(
    `/api/nexai/activity?level=${level}&limit=200`,
  );

  return (
    <div className="nx-content">
      <div className="nx-page-head">
        <div>
          <h1 className="nx-h1">Activity &amp; Errors</h1>
          <p className="nx-sub">A single timeline of everything the engine has done.</p>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="nx-row" style={{ gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`nx-btn nx-btn-sm ${level === f.key ? "nx-btn-primary" : "nx-btn-ghost"}`}
              onClick={() => setLevel(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <Spinner label="Loading activity…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.activity.length === 0 ? (
        <Card><EmptyState title="Nothing here yet" hint={level === "error" ? "No errors recorded — good news." : "Activity will appear as you work."} /></Card>
      ) : (
        <Card style={{ padding: 0 }}>
          {data.activity.map((a) => (
            <div
              key={a.id}
              style={{ display: "flex", gap: 12, padding: "13px 18px", borderBottom: "1px solid rgba(30,43,71,0.5)" }}
            >
              <div style={{ marginTop: 5 }}><LevelDot level={a.level} /></div>
              <div style={{ flex: 1 }}>
                <div className="nx-spread" style={{ alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {a.message}
                    {a.prospectId && (
                      <> <Link href={`/dashboard/prospects/${a.prospectId}`} className="nx-link" style={{ fontSize: 12 }}>view →</Link></>
                    )}
                  </div>
                  <span className={`nx-badge ${a.level === "error" ? "nx-badge-red" : a.level === "warning" ? "nx-badge-amber" : a.level === "success" ? "nx-badge-green" : "nx-badge-blue"}`}>
                    {a.kind.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="nx-muted" style={{ fontSize: 11, marginTop: 3 }}>
                  {dateTime(a.at)} {a.simulated && "· simulated"}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

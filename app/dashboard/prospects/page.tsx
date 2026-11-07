"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi, apiSend } from "../_components/useApi";
import { Card, Spinner, ErrorState, EmptyState, StatusPill, OriginBadge, ScoreBar, VerifyBadge } from "../_components/primitives";
import { relativeTime } from "../_components/format";
import {
  QUALIFICATION_LABELS,
  QUALIFICATION_STATUSES,
  type Prospect,
  type QualificationStatus,
} from "@/lib/nexai/types";

function AddProspectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ companyName: "", domain: "", industry: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      await apiSend("/api/nexai/prospects", "POST", form);
      onCreated();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="nx-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nx-modal-head">
          <strong>Add prospect</strong>
          <div className="nx-muted" style={{ fontSize: 12, marginTop: 3 }}>
            New records are created in demo mode until live providers are connected.
          </div>
        </div>
        <div className="nx-modal-body">
          <div className="nx-field">
            <label className="nx-label">Company name *</label>
            <input className="nx-input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Acme Industries" />
          </div>
          <div className="nx-field">
            <label className="nx-label">Domain *</label>
            <input className="nx-input" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="acme.com" />
          </div>
          <div className="nx-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="nx-field">
              <label className="nx-label">Industry</label>
              <input className="nx-input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="SaaS" />
            </div>
            <div className="nx-field">
              <label className="nx-label">Location</label>
              <input className="nx-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="London, UK" />
            </div>
          </div>
          {err && <div className="nx-badge nx-badge-red" style={{ marginTop: 4 }}>{err}</div>}
        </div>
        <div className="nx-modal-foot">
          <button className="nx-btn" onClick={onClose}>Cancel</button>
          <button className="nx-btn nx-btn-primary" disabled={saving || !form.companyName || !form.domain} onClick={submit}>
            {saving ? "Adding…" : "Add prospect"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProspectsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<string>(params.get("status") ?? "all");
  const [origin, setOrigin] = useState<string>("all");
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const url = useMemo(() => {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    if (origin !== "all") sp.set("origin", origin);
    if (q.trim()) sp.set("q", q.trim());
    return `/api/nexai/prospects?${sp.toString()}`;
  }, [status, origin, q]);

  const { data, loading, error, reload } = useApi<{ prospects: Prospect[] }>(url);

  return (
    <div className="nx-content">
      <div className="nx-page-head">
        <div>
          <h1 className="nx-h1">Prospects</h1>
          <p className="nx-sub">Research, qualify and track every target company.</p>
        </div>
        <button className="nx-btn nx-btn-primary" onClick={() => setShowAdd(true)}>
          + Add prospect
        </button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="nx-row" style={{ gap: 10, flexWrap: "wrap" }}>
          <input className="nx-input" style={{ maxWidth: 280 }} placeholder="Search company, domain, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="nx-select" style={{ maxWidth: 190 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All stages</option>
            {QUALIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{QUALIFICATION_LABELS[s]}</option>
            ))}
          </select>
          <select className="nx-select" style={{ maxWidth: 150 }} value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value="all">All records</option>
            <option value="demo">Demo only</option>
            <option value="live">Live only</option>
          </select>
          {(status !== "all" || origin !== "all" || q) && (
            <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => { setStatus("all"); setOrigin("all"); setQ(""); }}>
              Clear
            </button>
          )}
          <span className="nx-muted" style={{ fontSize: 12, marginLeft: "auto" }}>
            {data ? `${data.prospects.length} shown` : ""}
          </span>
        </div>
      </Card>

      {loading ? (
        <Spinner label="Loading prospects…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.prospects.length === 0 ? (
        <Card>
          <EmptyState
            title="No prospects match these filters"
            hint="Try clearing filters, or add a new prospect to get started."
            action={<button className="nx-btn nx-btn-primary" onClick={() => setShowAdd(true)}>+ Add prospect</button>}
          />
        </Card>
      ) : (
        <div className="nx-table-wrap">
          <table className="nx-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Stage</th>
                <th>Fit</th>
                <th>Industry</th>
                <th>Contacts</th>
                <th>Record</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.prospects.map((p) => {
                const best = p.decisionMakers[0];
                return (
                  <tr key={p.id} onClick={() => router.push(`/dashboard/prospects/${p.id}`)}>
                    <td>
                      <div className="nx-company">{p.companyName}</div>
                      <div className="nx-domain">{p.domain}</div>
                    </td>
                    <td><StatusPill status={p.qualification as QualificationStatus} /></td>
                    <td><ScoreBar score={p.fitScore} /></td>
                    <td className="nx-dim">{p.industry ?? "—"}</td>
                    <td>
                      {best ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: 12.5 }}>{best.name}</span>
                          <VerifyBadge status={best.emailVerification} />
                        </div>
                      ) : (
                        <span className="nx-muted">None</span>
                      )}
                    </td>
                    <td><OriginBadge origin={p.origin} /></td>
                    <td className="nx-muted" style={{ fontSize: 12 }}>{relativeTime(p.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddProspectModal onClose={() => setShowAdd(false)} onCreated={reload} />}
    </div>
  );
}

export default function ProspectsPage() {
  return (
    <Suspense fallback={<div className="nx-content"><Spinner label="Loading…" /></div>}>
      <ProspectsInner />
    </Suspense>
  );
}

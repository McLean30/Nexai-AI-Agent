"use client";

import { useEffect, useState } from "react";
import { useApi, apiSend } from "../_components/useApi";
import { Card, Spinner, ErrorState } from "../_components/primitives";
import { relativeTime } from "../_components/format";
import type { ServiceCatalogue } from "@/lib/nexai/types";

function linesToOfferings(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const [name, description] = l.split("—").map((s) => s.trim());
      return {
        id: `svc_${i}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20)}`,
        name,
        description: description || undefined,
        keywords: name.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
      };
    });
}
function linesToExclusions(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const [name, reason] = l.split("—").map((s) => s.trim());
      return {
        id: `exc_${i}`,
        name,
        reason: reason || undefined,
        keywords: name.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
      };
    });
}
const toLines = (arr: string[]) => arr.join("\n");

export default function CataloguePage() {
  const { data, loading, error, reload } = useApi<{ catalogue: ServiceCatalogue }>("/api/nexai/catalogue");
  const [form, setForm] = useState({ offered: "", excluded: "", claims: "", review: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data?.catalogue) return;
    const c = data.catalogue;
    setForm({
      offered: c.offeredServices.map((s) => (s.description ? `${s.name} — ${s.description}` : s.name)).join("\n"),
      excluded: c.excludedServices.map((s) => (s.reason ? `${s.name} — ${s.reason}` : s.name)).join("\n"),
      claims: toLines(c.approvedClaims),
      review: toLines(c.reviewItems),
    });
  }, [data]);

  if (loading) return <div className="nx-content"><Spinner label="Loading catalogue…" /></div>;
  if (error || !data) return <div className="nx-content"><ErrorState message={error ?? "No data"} onRetry={reload} /></div>;

  const c = data.catalogue;
  const approved = c.status === "approved";

  const save = async (opts?: { approve?: boolean; provisional?: boolean }) => {
    setSaving(true);
    setSaved(false);
    try {
      const payload: Partial<ServiceCatalogue> & { approve?: boolean } = {
        offeredServices: linesToOfferings(form.offered),
        excludedServices: linesToExclusions(form.excluded),
        approvedClaims: form.claims.split("\n").map((l) => l.trim()).filter(Boolean),
        reviewItems: form.review.split("\n").map((l) => l.trim()).filter(Boolean),
      };
      if (opts?.approve) payload.approve = true;
      if (opts?.provisional) payload.status = "provisional";
      const res = await apiSend<{ catalogue: ServiceCatalogue }>("/api/nexai/catalogue", "PATCH", payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      reload();
      return res;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nx-content">
      <div className="nx-page-head">
        <div>
          <h1 className="nx-h1">Service Catalogue</h1>
          <p className="nx-sub">The approved source of truth for what Nexai offers and may claim.</p>
        </div>
        <span className={`nx-badge ${approved ? "nx-badge-green" : "nx-badge-amber"}`}>
          {approved ? "Approved" : "Provisional"}
        </span>
      </div>

      {!approved && (
        <Card style={{ marginBottom: 16, borderColor: "rgba(251,191,36,0.4)" }}>
          <div className="nx-row" style={{ gap: 10, flexWrap: "wrap" }}>
            <span className="nx-badge nx-badge-amber">Provisional</span>
            <span className="nx-dim" style={{ fontSize: 13 }}>
              {c.provisionalNote ?? "Placeholder content pending final business details."} Research and drafts use it, but
              an <strong>approved</strong> catalogue is required before any live email is sent.
            </span>
          </div>
        </Card>
      )}

      <div className="nx-grid cols-2">
        <Card>
          <strong style={{ fontSize: 14 }}>Offered services</strong>
          <p className="nx-muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }}>One per line. Optionally <code className="nx-mono">Name — description</code>. Research recommendations and email offers come from here.</p>
          <textarea className="nx-textarea" style={{ minHeight: 160 }} value={form.offered} onChange={(e) => setForm({ ...form, offered: e.target.value })} />
        </Card>
        <Card>
          <strong style={{ fontSize: 14 }}>Excluded services</strong>
          <p className="nx-muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }}>Things Nexai does <em>not</em> offer. A draft that offers these is flagged unsupported.</p>
          <textarea className="nx-textarea" style={{ minHeight: 160 }} value={form.excluded} onChange={(e) => setForm({ ...form, excluded: e.target.value })} />
        </Card>
        <Card>
          <strong style={{ fontSize: 14 }}>Approved claims</strong>
          <p className="nx-muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }}>Statements safe to make in outreach. One per line.</p>
          <textarea className="nx-textarea" style={{ minHeight: 130 }} value={form.claims} onChange={(e) => setForm({ ...form, claims: e.target.value })} />
        </Card>
        <Card>
          <strong style={{ fontSize: 14 }}>Needs owner review</strong>
          <p className="nx-muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 8 }}>Topics requiring sign-off (ROI, references, timescales, pricing). Mentions flag a draft for review.</p>
          <textarea className="nx-textarea" style={{ minHeight: 130 }} value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} />
        </Card>
      </div>

      <div className="nx-row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button className="nx-btn nx-btn-primary" disabled={saving} onClick={() => save()}>
          {saving ? "Saving…" : "Save catalogue"}
        </button>
        {approved ? (
          <button className="nx-btn" disabled={saving} onClick={() => save({ provisional: true })}>Revert to provisional</button>
        ) : (
          <button className="nx-btn" disabled={saving} onClick={() => { if (confirm("Mark this catalogue as approved? Drafts can then pass the pre-send check.")) save({ approve: true }); }}>
            Save &amp; mark approved
          </button>
        )}
        {saved && <span className="nx-badge nx-badge-green">Saved</span>}
        <span className="nx-muted" style={{ fontSize: 11.5, marginLeft: "auto" }}>Updated {relativeTime(c.updatedAt)}</span>
      </div>
    </div>
  );
}

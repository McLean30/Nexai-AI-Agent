"use client";

import { useEffect, useState } from "react";
import { useApi, apiSend } from "../_components/useApi";
import { Card, Spinner, ErrorState } from "../_components/primitives";
import type { ProviderStatus } from "@/lib/nexai/providers/types";
import type { Settings } from "@/lib/nexai/types";

const KIND_LABEL: Record<string, string> = {
  discovery: "Discovery",
  research: "Research",
  enrichment: "Contact enrichment",
  aiWriting: "AI writing",
  email: "Email (Microsoft 365)",
};

function ProviderCard({ p }: { p: ProviderStatus }) {
  return (
    <Card>
      <div className="nx-spread" style={{ marginBottom: 8 }}>
        <div>
          <div className="nx-label" style={{ marginBottom: 4 }}>{KIND_LABEL[p.kind] ?? p.kind}</div>
          <strong style={{ fontSize: 14 }}>{p.name}</strong>
        </div>
        {p.connected ? (
          <span className="nx-badge nx-badge-green"><span className="nx-badge-dot" style={{ background: "#34d399" }} /> Connected</span>
        ) : (
          <span className="nx-badge nx-badge-gray"><span className="nx-badge-dot" style={{ background: "#7e8cab" }} /> Not connected</span>
        )}
      </div>
      <p className="nx-dim" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 10 }}>{p.description}</p>
      <div className="nx-row" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className={`nx-badge ${p.mode === "live" ? "nx-badge-green" : "nx-badge-purple"}`}>{p.mode === "live" ? "Live mode" : "Mock mode"}</span>
        {!p.connected && p.missingEnv.length > 0 && (
          <span className="nx-muted" style={{ fontSize: 11.5 }}>
            Needs: {p.missingEnv.map((e) => <code key={e} className="nx-mono" style={{ color: "#9ad8f6" }}>{e} </code>)}
          </span>
        )}
      </div>
      {!p.connected && (
        <div className="nx-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
          Add these as server-side environment variables. Keys are never entered in the browser.
          {p.docsUrl && <> · <a href={p.docsUrl} target="_blank" rel="noreferrer" className="nx-link">Get key ↗</a></>}
        </div>
      )}

      {p.plan && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--nx-border)" }}>
          <div className="nx-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <span className="nx-label" style={{ margin: 0 }}>Live integration plan</span>
            {p.plan.reusesFirecrawl && <span className="nx-badge nx-badge-blue">Reuses Firecrawl</span>}
            {p.plan.implemented ? (
              <span className="nx-badge nx-badge-green">Live path ready</span>
            ) : (
              <span className="nx-badge nx-badge-amber">Not implemented yet</span>
            )}
            {p.plan.envPlaceholder && <span className="nx-badge nx-badge-red">Placeholder env</span>}
          </div>
          <div className="nx-dim" style={{ fontSize: 12, lineHeight: 1.5 }}>
            <div><strong className="nx-dim">Service:</strong> {p.plan.liveService}</div>
            <div><strong className="nx-dim">API:</strong> {p.plan.apiName}</div>
            {p.plan.note && <div className="nx-muted" style={{ marginTop: 4 }}>{p.plan.note}</div>}
          </div>
        </div>
      )}
    </Card>
  );
}

interface StorageStatus {
  adapter: string;
  durable: boolean;
  note: string;
}

export default function ConnectionsPage() {
  const { data, loading, error, reload } = useApi<{ providers: ProviderStatus[]; settings: Settings; storage: StorageStatus }>("/api/nexai/connections");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.settings) setSettings(data.settings);
  }, [data]);

  if (loading || !settings) return <div className="nx-content"><Spinner label="Loading connections…" /></div>;
  if (error || !data) return <div className="nx-content"><ErrorState message={error ?? "No data"} onRetry={reload} /></div>;

  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiSend<{ settings: Settings }>("/api/nexai/settings", "PATCH", settings);
      setSettings(res.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nx-content">
      <div className="nx-page-head">
        <div>
          <h1 className="nx-h1">Connections &amp; Settings</h1>
          <p className="nx-sub">Server-side credentials and campaign safeguards.</p>
        </div>
      </div>

      <div className="nx-label" style={{ marginBottom: 10 }}>Storage</div>
      <Card style={{ marginBottom: 24, borderColor: data.storage.durable ? "rgba(52,211,153,0.3)" : "rgba(251,191,36,0.35)" }}>
        <div className="nx-spread" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <strong style={{ fontSize: 14 }}>
              {data.storage.adapter === "upstash-redis" ? "Upstash Redis (hosted)" : "Local file store"}
            </strong>
            <p className="nx-dim" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 4, maxWidth: 620 }}>
              {data.storage.note}
            </p>
          </div>
          <span className={`nx-badge ${data.storage.durable ? "nx-badge-green" : "nx-badge-amber"}`}>
            {data.storage.durable ? "Durable" : "Not durable on Vercel"}
          </span>
        </div>
        {!data.storage.durable && (
          <div className="nx-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
            For hosted deployments, set <code className="nx-mono" style={{ color: "#9ad8f6" }}>UPSTASH_REDIS_REST_URL</code> and{" "}
            <code className="nx-mono" style={{ color: "#9ad8f6" }}>UPSTASH_REDIS_REST_TOKEN</code> to switch to the hosted database automatically.
          </div>
        )}
      </Card>

      <div className="nx-label" style={{ marginBottom: 10 }}>Providers</div>
      <div className="nx-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginBottom: 24 }}>
        {data.providers.map((p) => <ProviderCard key={p.id} p={p} />)}
      </div>

      <div className="nx-label" style={{ marginBottom: 10 }}>Sending safeguards</div>
      <Card style={{ marginBottom: 16 }}>
        <div className="nx-spread" style={{ flexWrap: "wrap", gap: 12 }}>
          <div style={{ maxWidth: 560 }}>
            <strong style={{ fontSize: 14 }}>Enable outbound sending</strong>
            <p className="nx-dim" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 4 }}>
              Master switch for sending real emails. Defaults to <strong>off</strong>. This is independent of research
              credentials — turning it on never sends anything until a Microsoft 365 mailbox is also connected, but it is
              the single safeguard that governs sending.
            </p>
          </div>
          <div
            className={`nx-toggle ${settings.sendingEnabled ? "on" : ""}`}
            role="switch"
            aria-checked={settings.sendingEnabled}
            onClick={() => update({ sendingEnabled: !settings.sendingEnabled })}
          >
            <span className="nx-toggle-knob" />
          </div>
        </div>
        {settings.sendingEnabled && (
          <div className="nx-badge nx-badge-amber" style={{ marginTop: 12 }}>
            Sending is ON — keep this off during development.
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div className="nx-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="nx-field">
            <label className="nx-label">New prospects / working day</label>
            <input className="nx-input" type="number" min={0} value={settings.dailyProspectTarget} onChange={(e) => update({ dailyProspectTarget: Number(e.target.value) })} />
          </div>
          <div className="nx-field">
            <label className="nx-label">Total email limit (incl. follow-ups)</label>
            <input className="nx-input" type="number" min={0} value={settings.totalEmailLimit} onChange={(e) => update({ totalEmailLimit: Number(e.target.value) })} />
          </div>
          <div className="nx-field">
            <label className="nx-label">Timezone</label>
            <input className="nx-input" value={settings.timezone} onChange={(e) => update({ timezone: e.target.value })} />
          </div>
          <div className="nx-field">
            <label className="nx-label">Send window</label>
            <div className="nx-row" style={{ gap: 8 }}>
              <input className="nx-input" type="time" value={settings.sendWindow.start} onChange={(e) => update({ sendWindow: { ...settings.sendWindow, start: e.target.value } })} />
              <span className="nx-muted">to</span>
              <input className="nx-input" type="time" value={settings.sendWindow.end} onChange={(e) => update({ sendWindow: { ...settings.sendWindow, end: e.target.value } })} />
            </div>
          </div>
        </div>
        <div className="nx-field" style={{ marginBottom: 0 }}>
          <label className="nx-label">Suppression list (one domain or email per line — never contacted)</label>
          <textarea
            className="nx-textarea"
            style={{ minHeight: 70 }}
            value={settings.suppressionList.join("\n")}
            onChange={(e) => update({ suppressionList: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
          />
        </div>
      </Card>

      <div className="nx-row" style={{ gap: 12 }}>
        <button className="nx-btn nx-btn-primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="nx-badge nx-badge-green">Saved · persists across restarts</span>}
      </div>
    </div>
  );
}

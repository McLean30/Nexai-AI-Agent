"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { useApi, apiSend } from "../_components/useApi";
import { Card, Spinner, ErrorState, EmptyState } from "../_components/primitives";
import { normalizeDomain, looksLikeDomain } from "@/lib/nexai/domain";
import {
  DEFAULT_TARGETING,
  TRADE_SECTORS,
  type DiscoveryCandidate,
  type Prospect,
  type TargetingCriteria,
} from "@/lib/nexai/types";

const BUYER_ROLES = ["Owner", "Managing Director", "Operations Manager", "Director"];

type UICandidate = DiscoveryCandidate & { key: string; selected: boolean };

function toUI(c: DiscoveryCandidate): UICandidate {
  const domain = normalizeDomain(c.domain || c.website);
  return { ...c, domain, key: domain, selected: true };
}

export default function DiscoveryPage() {
  const [criteria, setCriteria] = useState<TargetingCriteria>({ ...DEFAULT_TARGETING });
  const [candidates, setCandidates] = useState<UICandidate[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{ createdCount: number; skippedCount: number } | null>(null);
  const [generateResearch, setGenerateResearch] = useState(true);
  const [manualWebsite, setManualWebsite] = useState("");
  const [manualName, setManualName] = useState("");
  const [csvNote, setCsvNote] = useState<string | null>(null);

  // Existing prospect domains → mark duplicates in the UI (server re-checks on save).
  const existing = useApi<{ prospects: Prospect[] }>("/api/nexai/prospects");
  const existingDomains = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of existing.data?.prospects ?? []) m.set(normalizeDomain(p.domain), p.id);
    return m;
  }, [existing.data]);

  // Recompute duplicate status whenever existing prospects load.
  useEffect(() => {
    if (!existing.data) return;
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        duplicateOfProspectId: existingDomains.get(c.domain) ?? c.duplicateOfProspectId,
      })),
    );
  }, [existing.data, existingDomains]);

  const dupInfo = (c: UICandidate): string | null => existingDomains.get(c.domain) ?? c.duplicateOfProspectId ?? null;

  const mergeCandidates = (incoming: DiscoveryCandidate[]) => {
    setSaveResult(null);
    setCandidates((prev) => {
      const seen = new Set(prev.map((c) => c.key));
      const additions = incoming
        .map(toUI)
        .filter((c) => c.domain && looksLikeDomain(c.domain) && !seen.has(c.key));
      return [...prev, ...additions];
    });
  };

  const toggleSector = (s: string) => {
    setCriteria((c) => ({
      ...c,
      sectors: c.sectors.includes(s) ? c.sectors.filter((x) => x !== s) : [...c.sectors, s],
    }));
  };
  const toggleBuyer = (r: string) => {
    setCriteria((c) => ({
      ...c,
      buyerRoles: c.buyerRoles.includes(r) ? c.buyerRoles.filter((x) => x !== r) : [...c.buyerRoles, r],
    }));
  };

  const runDiscovery = async () => {
    setRunning(true);
    setRunError(null);
    setSaveResult(null);
    try {
      const res = await apiSend<{ candidates: DiscoveryCandidate[] }>("/api/nexai/discovery", "POST", criteria);
      mergeCandidates(res.candidates);
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const addManual = () => {
    const domain = normalizeDomain(manualWebsite);
    if (!looksLikeDomain(domain)) {
      setRunError("Enter a valid company website, e.g. acme.co.uk");
      return;
    }
    setRunError(null);
    mergeCandidates([
      {
        companyName: manualName.trim() || domain,
        domain,
        website: `https://${domain}`,
        rationale: "Added manually.",
        simulated: false,
        candidateSource: "manual",
      },
    ]);
    setManualWebsite("");
    setManualName("");
  };

  const importCsv = (file: File) => {
    setCsvNote(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        const pick = (row: Record<string, string>, keys: string[]) => {
          for (const k of Object.keys(row)) {
            if (keys.some((want) => k.toLowerCase().trim() === want)) return row[k];
          }
          return "";
        };
        const found: DiscoveryCandidate[] = [];
        for (const row of rows) {
          const website = pick(row, ["website", "domain", "url", "web"]);
          const name = pick(row, ["company", "companyname", "company name", "name", "business"]);
          const domain = normalizeDomain(website || name);
          if (!looksLikeDomain(domain)) continue;
          found.push({
            companyName: (name || domain).trim(),
            domain,
            website: `https://${domain}`,
            sector: pick(row, ["sector", "industry", "trade"]) || undefined,
            location: pick(row, ["location", "town", "city", "region"]) || undefined,
            rationale: "Imported from CSV.",
            simulated: false,
            candidateSource: "csv",
          });
        }
        if (found.length === 0) {
          setCsvNote("No valid website/domain column found. Expected a column like 'website' or 'domain'.");
        } else {
          mergeCandidates(found);
          setCsvNote(`Parsed ${found.length} row${found.length === 1 ? "" : "s"} with a usable domain.`);
        }
      },
      error: () => setCsvNote("Could not parse that CSV file."),
    });
  };

  const selectable = candidates.filter((c) => !dupInfo(c));
  const selectedCount = candidates.filter((c) => c.selected && !dupInfo(c)).length;
  const dupCount = candidates.filter((c) => dupInfo(c)).length;

  const setAll = (val: boolean) =>
    setCandidates((prev) => prev.map((c) => (dupInfo(c) ? c : { ...c, selected: val })));

  const saveSelected = async () => {
    const toSave = candidates.filter((c) => c.selected && !dupInfo(c));
    if (toSave.length === 0) return;
    setSaving(true);
    setSaveError(null);
    setSaveResult(null);
    try {
      const res = await apiSend<{ createdCount: number; skippedCount: number }>(
        "/api/nexai/prospects/import",
        "POST",
        {
          generateResearch,
          candidates: toSave.map((c) => ({
            companyName: c.companyName,
            domain: c.domain,
            website: c.website,
            sector: c.sector,
            location: c.location,
            employeeRange: c.employeeRange,
            buyerHint: c.buyerHint,
            rationale: c.rationale,
            candidateSource: c.candidateSource,
          })),
        },
      );
      setSaveResult(res);
      // Remove saved ones from the list, refresh existing domains.
      const savedKeys = new Set(toSave.map((c) => c.key));
      setCandidates((prev) => prev.filter((c) => !savedKeys.has(c.key)));
      existing.reload();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nx-content">
      <div className="nx-page-head">
        <div>
          <h1 className="nx-h1">Discovery</h1>
          <p className="nx-sub">Find UK trade &amp; field-service businesses that fit the Nexai ICP.</p>
        </div>
        <Link href="/dashboard/prospects" className="nx-btn">View prospects →</Link>
      </div>

      <div className="nx-row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span className="nx-badge nx-badge-purple">Simulated discovery</span>
        <span className="nx-muted" style={{ fontSize: 12.5 }}>
          Results are generated by a mock engine — fictional companies and domains, clearly flagged. The same flow
          connects to a live search service later.
        </span>
      </div>

      {/* Targeting criteria */}
      <Card style={{ marginBottom: 16 }}>
        <div className="nx-spread" style={{ marginBottom: 12 }}>
          <strong>Targeting criteria</strong>
          <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => setCriteria({ ...DEFAULT_TARGETING })}>
            Reset to Nexai ICP
          </button>
        </div>

        <div className="nx-label">Sectors</div>
        <div className="nx-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {TRADE_SECTORS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSector(s)}
              className={`nx-badge ${criteria.sectors.includes(s) ? "nx-badge-blue" : "nx-badge-gray"}`}
              style={{ cursor: "pointer", border: "1px solid var(--nx-border)" }}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="nx-grid cols-3" style={{ gap: 12 }}>
          <div className="nx-field">
            <label className="nx-label">Location</label>
            <input className="nx-input" value={criteria.location} onChange={(e) => setCriteria({ ...criteria, location: e.target.value })} />
          </div>
          <div className="nx-field">
            <label className="nx-label">Min staff</label>
            <input className="nx-input" type="number" min={1} value={criteria.minStaff} onChange={(e) => setCriteria({ ...criteria, minStaff: Number(e.target.value) })} />
          </div>
          <div className="nx-field">
            <label className="nx-label">Max staff</label>
            <input className="nx-input" type="number" min={1} value={criteria.maxStaff} onChange={(e) => setCriteria({ ...criteria, maxStaff: Number(e.target.value) })} />
          </div>
        </div>

        <div className="nx-label">Buyer role</div>
        <div className="nx-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {BUYER_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => toggleBuyer(r)}
              className={`nx-badge ${criteria.buyerRoles.includes(r) ? "nx-badge-blue" : "nx-badge-gray"}`}
              style={{ cursor: "pointer", border: "1px solid var(--nx-border)" }}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="nx-grid cols-2w" style={{ gap: 12 }}>
          <div className="nx-field" style={{ marginBottom: 0 }}>
            <label className="nx-label">Keywords (optional)</label>
            <input className="nx-input" placeholder="e.g. commercial, maintenance contracts" value={criteria.keywords} onChange={(e) => setCriteria({ ...criteria, keywords: e.target.value })} />
          </div>
          <div className="nx-field" style={{ marginBottom: 0 }}>
            <label className="nx-label">How many</label>
            <input className="nx-input" type="number" min={1} max={40} value={criteria.limit} onChange={(e) => setCriteria({ ...criteria, limit: Number(e.target.value) })} />
          </div>
        </div>

        <hr className="nx-divider" />
        <div className="nx-row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button className="nx-btn nx-btn-primary" disabled={running} onClick={runDiscovery}>
            {running ? "Running discovery…" : "Run discovery"}
          </button>
          {criteria.sectors.length === 0 && <span className="nx-badge nx-badge-amber">Select at least one sector</span>}
        </div>
      </Card>

      {/* Manual + CSV */}
      <div className="nx-grid cols-2" style={{ marginBottom: 16 }}>
        <Card>
          <strong style={{ fontSize: 14 }}>Add a company manually</strong>
          <div className="nx-field" style={{ marginTop: 10 }}>
            <label className="nx-label">Website</label>
            <input className="nx-input" placeholder="acme-electrical.co.uk" value={manualWebsite}
              onChange={(e) => setManualWebsite(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addManual()} />
          </div>
          <div className="nx-field">
            <label className="nx-label">Company name (optional)</label>
            <input className="nx-input" placeholder="Acme Electrical" value={manualName} onChange={(e) => setManualName(e.target.value)} />
          </div>
          <button className="nx-btn" onClick={addManual}>+ Add to results</button>
        </Card>

        <Card>
          <strong style={{ fontSize: 14 }}>Import from CSV</strong>
          <p className="nx-dim" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}>
            Upload a CSV with a <code className="nx-mono">website</code> or <code className="nx-mono">domain</code> column
            (optionally <code className="nx-mono">company</code>, <code className="nx-mono">sector</code>).
          </p>
          <label className="nx-btn" style={{ marginTop: 10, display: "inline-flex", cursor: "pointer" }}>
            Choose CSV file
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.currentTarget.value = ""; }} />
          </label>
          {csvNote && <div className="nx-muted" style={{ fontSize: 12, marginTop: 10 }}>{csvNote}</div>}
        </Card>
      </div>

      {runError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={runError} onRetry={runDiscovery} />
        </div>
      )}

      {/* Persistent save confirmation (stays visible even after the list empties) */}
      {saveResult && (
        <Card style={{ marginBottom: 16, borderColor: "rgba(52,211,153,0.35)" }}>
          <div className="nx-spread" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="nx-row" style={{ gap: 10 }}>
              <span className="nx-badge nx-badge-green">Saved to Upstash</span>
              <span className="nx-dim" style={{ fontSize: 13 }}>
                Created {saveResult.createdCount} prospect{saveResult.createdCount === 1 ? "" : "s"}
                {saveResult.skippedCount ? ` · ${saveResult.skippedCount} skipped as duplicates/invalid` : ""}
                {generateResearch ? " · simulated research generated" : ""}.
              </span>
            </div>
            <Link href="/dashboard/prospects" className="nx-btn nx-btn-sm">View prospects →</Link>
          </div>
        </Card>
      )}

      {/* Candidate results */}
      <Card>
        <div className="nx-spread" style={{ marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div className="nx-row" style={{ gap: 10 }}>
            <strong>Candidates</strong>
            <span className="nx-muted" style={{ fontSize: 12 }}>
              {candidates.length} found · {selectedCount} selected{dupCount ? ` · ${dupCount} already prospects` : ""}
            </span>
          </div>
          {candidates.length > 0 && (
            <div className="nx-row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => setAll(true)}>Select all</button>
              <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => setAll(false)}>Clear</button>
              <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => { setCandidates([]); setSaveResult(null); }}>Remove all</button>
            </div>
          )}
        </div>

        {running ? (
          <Spinner label="Finding companies…" />
        ) : candidates.length === 0 ? (
          <EmptyState
            title="No candidates yet"
            hint="Run discovery, add a company manually, or import a CSV to get started."
          />
        ) : (
          <>
            <div className="nx-table-wrap">
              <table className="nx-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Company</th>
                    <th className="nx-hide-sm">Sector</th>
                    <th className="nx-hide-sm">Size</th>
                    <th className="nx-hide-sm">Why</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const dup = dupInfo(c);
                    return (
                      <tr key={c.key} style={{ cursor: "default", opacity: dup ? 0.6 : 1 }}>
                        <td>
                          <input type="checkbox" disabled={!!dup} checked={c.selected && !dup}
                            onChange={(e) => setCandidates((prev) => prev.map((x) => x.key === c.key ? { ...x, selected: e.target.checked } : x))} />
                        </td>
                        <td>
                          <div className="nx-company">{c.companyName}</div>
                          <div className="nx-domain">{c.domain}</div>
                        </td>
                        <td className="nx-hide-sm nx-dim">{c.sector ?? "—"}</td>
                        <td className="nx-hide-sm nx-dim">{c.employeeRange ?? "—"}</td>
                        <td className="nx-hide-sm nx-dim" style={{ fontSize: 12, maxWidth: 320 }}>{c.rationale}</td>
                        <td>
                          {dup ? (
                            <Link href={`/dashboard/prospects/${dup}`} className="nx-badge nx-badge-gray">Already a prospect</Link>
                          ) : c.candidateSource === "discovery" ? (
                            <span className="nx-badge nx-badge-purple">Discovered</span>
                          ) : (
                            <span className="nx-badge nx-badge-blue">{c.candidateSource === "csv" ? "CSV" : "Manual"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <hr className="nx-divider" />
            <div className="nx-spread" style={{ flexWrap: "wrap", gap: 12 }}>
              <label className="nx-row" style={{ gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={generateResearch} onChange={(e) => setGenerateResearch(e.target.checked)} />
                Generate a research report on save
              </label>
              <div className="nx-row" style={{ gap: 10 }}>
                {saveResult && (
                  <span className="nx-badge nx-badge-green">
                    Saved {saveResult.createdCount}{saveResult.skippedCount ? ` · ${saveResult.skippedCount} skipped` : ""}
                  </span>
                )}
                <button className="nx-btn nx-btn-primary" disabled={saving || selectedCount === 0} onClick={saveSelected}>
                  {saving ? "Saving…" : `Save ${selectedCount} as prospect${selectedCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
            {saveError && (
              <div style={{ marginTop: 12 }}>
                <ErrorState message={saveError} onRetry={saveSelected} />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

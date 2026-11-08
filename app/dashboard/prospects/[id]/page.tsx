"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useApi, apiSend } from "../../_components/useApi";
import {
  Card,
  Spinner,
  ErrorState,
  EmptyState,
  StatusPill,
  OriginBadge,
  ScoreBar,
  VerifyBadge,
  SimBadge,
} from "../../_components/primitives";
import { relativeTime, dateTime } from "../../_components/format";
import { emitAgent } from "../../_components/agent-bus";
import {
  QUALIFICATION_LABELS,
  QUALIFICATION_STATUSES,
  type OfferCheck,
  type Prospect,
  type QualificationStatus,
  type Source,
} from "@/lib/nexai/types";

function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return <span className="nx-muted" style={{ fontSize: 12 }}>No sources</span>;
  return (
    <div>
      {sources.map((s, i) => (
        <div key={i} className="nx-source">
          <span className="nx-source-num">{i + 1}</span>
          <a href={s.url} target="_blank" rel="noreferrer" className="nx-link" style={{ wordBreak: "break-all" }}>
            {s.title}
          </a>
        </div>
      ))}
    </div>
  );
}

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, reload } = useApi<{ prospect: Prospect }>(`/api/nexai/prospects/${id}`);

  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<Partial<Prospect>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [draftEdit, setDraftEdit] = useState<{ subject: string; body: string } | null>(null);

  if (loading) return <div className="nx-content"><Spinner label="Loading prospect…" /></div>;
  if (error || !data?.prospect)
    return (
      <div className="nx-content">
        <ErrorState message={error ?? "Prospect not found"} onRetry={reload} />
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link href="/dashboard/prospects" className="nx-link">← Back to prospects</Link>
        </div>
      </div>
    );

  const p = data.prospect;
  const reviewCount = p.decisionMakers.filter((d) => d.reviewStatus === "needs_review").length;

  const patch = async (body: Partial<Prospect>) => {
    await apiSend(`/api/nexai/prospects/${id}`, "PATCH", body);
    reload();
  };

  const changeStatus = async (status: QualificationStatus) => {
    setBusy("status");
    try {
      await patch({ qualification: status });
    } finally {
      setBusy(null);
    }
  };

  const runResearch = async () => {
    setBusy("research");
    setNotice(null);
    emitAgent("researching", `Researching ${p.companyName}`, { simulated: true });
    try {
      const res = await apiSend<{ provider: { mode: string } }>(`/api/nexai/prospects/${id}/research`, "POST");
      const sim = res.provider.mode === "mock";
      setNotice(sim ? "Generated a simulated research report (no live research credentials)." : "Live research report generated.");
      emitAgent("completed", "Research ready", { simulated: sim });
      reload();
    } catch (e) {
      setNotice(`Research failed: ${(e as Error).message}`);
      emitAgent("error", "Research failed");
    } finally {
      setBusy(null);
    }
  };

  const enrichContacts = async () => {
    setBusy("enrich");
    setNotice(null);
    emitAgent("enriching", `Enriching ${p.companyName}`, { simulated: true });
    try {
      const res = await apiSend<{ added: number; needsReview: number; result: { outcome: string }; provider: { mode: string } }>(
        `/api/nexai/prospects/${id}/enrich`,
        "POST",
      );
      const sim = res.provider.mode === "mock" ? " (simulated)" : "";
      setNotice(
        res.result.outcome === "no_contacts"
          ? `Enrichment found no contacts${sim}.`
          : `Enrichment added ${res.added} contact${res.added === 1 ? "" : "s"}${res.needsReview ? ` · ${res.needsReview} need review` : ""}${sim}.`,
      );
      if (res.needsReview > 0) emitAgent("review", `${res.needsReview} contact${res.needsReview === 1 ? "" : "s"} need review`, { simulated: true, href: `/dashboard/prospects/${id}` });
      else emitAgent("completed", "Contacts enriched", { simulated: true });
      reload();
    } catch (e) {
      setNotice(`Enrichment failed: ${(e as Error).message}`);
      emitAgent("error", "Enrichment failed");
    } finally {
      setBusy(null);
    }
  };

  const generateDraft = async (force = false) => {
    setBusy("draft");
    setNotice(null);
    emitAgent("writing", `Writing to ${p.companyName}`, { simulated: true });
    try {
      const res = await apiSend<{ draft: { simulated: boolean } }>(`/api/nexai/prospects/${id}/draft`, "POST", { stepType: "initial", force });
      setDraftEdit(null);
      setNotice(res.draft.simulated ? "Generated a simulated email draft (no live AI credentials)." : "Live email draft generated.");
      emitAgent("completed", "Draft ready", { simulated: res.draft.simulated });
      reload();
    } catch (e) {
      // Overwrite guard — ask for explicit confirmation, never overwrite silently.
      const msg = (e as Error).message;
      if (/replace|approved|edited/i.test(msg)) {
        if (confirm(`${msg}\n\nRegenerate anyway?`)) {
          await generateDraft(true);
          return;
        }
        setNotice("Regeneration cancelled — your saved draft is unchanged.");
        emitAgent("idle");
      } else {
        setNotice(`Draft failed: ${msg}`);
        emitAgent("error", "Draft failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const saveDraftEdit = async () => {
    if (!draftEdit) return;
    setBusy("draft-save");
    try {
      await apiSend(`/api/nexai/prospects/${id}/draft`, "PATCH", draftEdit);
      setDraftEdit(null);
      setNotice("Draft edits saved.");
      reload();
    } finally {
      setBusy(null);
    }
  };

  const approveDraft = async () => {
    setBusy("draft-approve");
    try {
      await apiSend(`/api/nexai/prospects/${id}/draft`, "PATCH", { approved: true });
      setNotice("Draft approved — not sent (sending is disabled).");
      reload();
    } finally {
      setBusy(null);
    }
  };

  const reviewContact = async (dmId: string, action: "approve" | "dismiss") => {
    setBusy(`dm-${dmId}`);
    try {
      if (action === "approve") {
        await apiSend(`/api/nexai/prospects/${id}/contacts/${dmId}`, "PATCH", { approve: true });
      } else {
        await apiSend(`/api/nexai/prospects/${id}/contacts/${dmId}`, "DELETE");
      }
      reload();
    } finally {
      setBusy(null);
    }
  };

  const startEdit = () => {
    setEdit({
      companyName: p.companyName,
      industry: p.industry,
      location: p.location,
      employeeRange: p.employeeRange,
      qualificationNotes: p.qualificationNotes,
      fitScore: p.fitScore,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setBusy("edit");
    try {
      await patch(edit);
      setEditing(false);
    } finally {
      setBusy(null);
    }
  };

  const deleteProspect = async () => {
    if (!confirm(`Delete ${p.companyName}? This cannot be undone.`)) return;
    await apiSend(`/api/nexai/prospects/${id}`, "DELETE");
    router.push("/dashboard/prospects");
  };

  return (
    <div className="nx-content">
      <div style={{ marginBottom: 14 }}>
        <Link href="/dashboard/prospects" className="nx-link" style={{ fontSize: 13 }}>← Prospects</Link>
      </div>

      <div className="nx-page-head">
        <div>
          <div className="nx-row" style={{ gap: 12 }}>
            <h1 className="nx-h1">{p.companyName}</h1>
            <OriginBadge origin={p.origin} />
          </div>
          <p className="nx-sub">
            <a href={p.website ?? `https://${p.domain}`} target="_blank" rel="noreferrer" className="nx-link">{p.domain}</a>
            {p.industry && <> · {p.industry}</>}
            {p.location && <> · {p.location}</>}
          </p>
        </div>
        <div className="nx-row" style={{ gap: 8 }}>
          <button className="nx-btn nx-btn-sm" onClick={startEdit}>Edit</button>
          <button className="nx-btn nx-btn-sm nx-btn-danger" onClick={deleteProspect}>Delete</button>
        </div>
      </div>

      {notice && (
        <Card style={{ marginBottom: 16, borderColor: "rgba(56,189,248,0.3)" }}>
          <span className="nx-dim" style={{ fontSize: 13 }}>{notice}</span>
        </Card>
      )}

      {/* qualification controls */}
      <Card style={{ marginBottom: 16 }}>
        <div className="nx-spread" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="nx-row" style={{ gap: 14, flexWrap: "wrap" }}>
            <div>
              <div className="nx-label">Qualification</div>
              <div className="nx-row" style={{ gap: 8 }}>
                <select
                  className="nx-select"
                  style={{ width: 180 }}
                  value={p.qualification}
                  disabled={busy === "status"}
                  onChange={(e) => changeStatus(e.target.value as QualificationStatus)}
                >
                  {QUALIFICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>{QUALIFICATION_LABELS[s]}</option>
                  ))}
                </select>
                <StatusPill status={p.qualification} />
              </div>
            </div>
            <div>
              <div className="nx-label">Fit score</div>
              <ScoreBar score={p.fitScore} />
            </div>
          </div>
          <div className="nx-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="nx-btn" disabled={busy === "research"} onClick={runResearch}>
              {busy === "research" ? "Researching…" : p.research ? "Re-run research" : "Generate research"}
            </button>
            <button className="nx-btn" disabled={busy === "enrich"} onClick={enrichContacts}>
              {busy === "enrich" ? "Enriching…" : "Enrich contacts"}
            </button>
            <button className="nx-btn nx-btn-primary" disabled={busy === "draft"} onClick={() => generateDraft(false)}>
              {busy === "draft" ? "Drafting…" : p.draftEmail ? "Regenerate draft" : "Generate email draft"}
            </button>
          </div>
        </div>
        {p.qualificationNotes && (
          <p className="nx-dim" style={{ fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>{p.qualificationNotes}</p>
        )}
        {p.tags.length > 0 && (
          <div className="nx-row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {p.tags.map((t) => <span key={t} className="nx-tag">{t}</span>)}
          </div>
        )}
      </Card>

      <div className="nx-grid split-detail" >
        {/* research report */}
        <Card>
          <div className="nx-spread" style={{ marginBottom: 12 }}>
            <strong>Company research report</strong>
            {p.research && <SimBadge simulated={p.research.simulated} />}
          </div>
          {!p.research ? (
            <EmptyState
              title="No research yet"
              hint="Generate a research report to populate company profile, signals and sources."
              action={<button className="nx-btn nx-btn-primary" disabled={busy === "research"} onClick={runResearch}>{busy === "research" ? "Researching…" : "Generate research"}</button>}
            />
          ) : (
            <div>
              {p.research.simulated && (
                <div className="nx-badge nx-badge-purple" style={{ marginBottom: 10 }}>
                  Simulated report — figures &amp; sources are illustrative, not verified
                </div>
              )}
              <p className="nx-dim" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{p.research.summary}</p>

              {/* Company facts */}
              {p.research.facts && p.research.facts.length > 0 ? (
                <>
                  <hr className="nx-divider" />
                  <div className="nx-label">Company facts</div>
                  <div className="nx-grid cols-2" style={{ gap: 10 }}>
                    {p.research.facts.map((f, i) => <Field key={i} label={f.label} value={f.value} />)}
                  </div>
                </>
              ) : (
                <>
                  <hr className="nx-divider" />
                  <div className="nx-grid cols-2" style={{ gap: 10 }}>
                    <Field label="Industry" value={p.research.industry} />
                    <Field label="Employees" value={p.research.employeeRange} />
                    <Field label="Revenue" value={p.research.revenueRange} />
                    <Field label="Funding" value={p.research.fundingStage} />
                  </div>
                </>
              )}

              {/* Qualification evidence */}
              {p.research.qualificationEvidence && p.research.qualificationEvidence.length > 0 && (
                <>
                  <div className="nx-label" style={{ marginTop: 14 }}>Qualification evidence</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {p.research.qualificationEvidence.map((e, i) => (
                      <div key={i} className="nx-row" style={{ gap: 8, alignItems: "flex-start" }}>
                        <span className={`nx-badge ${e.assessment === "fit" ? "nx-badge-green" : e.assessment === "against" ? "nx-badge-red" : "nx-badge-amber"}`} style={{ flexShrink: 0 }}>
                          {e.assessment === "fit" ? "Fit" : e.assessment === "against" ? "Against" : "Watch"}
                        </span>
                        <span className="nx-dim" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{e.point}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Unknowns */}
              {p.research.unknowns && p.research.unknowns.length > 0 && (
                <>
                  <div className="nx-label" style={{ marginTop: 14 }}>Unknowns (not yet determined)</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }} className="nx-muted">
                    {p.research.unknowns.map((u, i) => <li key={i}>{u}</li>)}
                  </ul>
                </>
              )}

              {/* Operational questions */}
              {p.research.operationalQuestions && p.research.operationalQuestions.length > 0 && (
                <>
                  <div className="nx-label" style={{ marginTop: 14 }}>Questions for the owner / MD</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }} className="nx-dim">
                    {p.research.operationalQuestions.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </>
              )}

              {/* Custom-app ideas (inferred) */}
              {p.research.customAppIdeas && p.research.customAppIdeas.length > 0 && (
                <>
                  <div className="nx-row" style={{ gap: 8, marginTop: 16 }}>
                    <div className="nx-label" style={{ margin: 0 }}>Custom-app opportunities</div>
                    <span className="nx-badge nx-badge-blue">Inferred — not fact</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                    {p.research.customAppIdeas.map((idea, i) => (
                      <div key={i} style={{ background: "var(--nx-bg-2)", border: "1px solid var(--nx-border)", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{idea.title}</div>
                        <div className="nx-muted" style={{ fontSize: 12, marginTop: 5 }}><strong className="nx-dim">Problem:</strong> {idea.problem}</div>
                        <div className="nx-muted" style={{ fontSize: 12, marginTop: 3 }}><strong className="nx-dim">Idea:</strong> {idea.idea}</div>
                        <div className="nx-muted" style={{ fontSize: 12, marginTop: 3 }}><strong className="nx-dim">Value:</strong> {idea.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Legacy fields (older seed records) */}
              {p.research.techStack && p.research.techStack.length > 0 && (
                <>
                  <div className="nx-label" style={{ marginTop: 14 }}>Tech stack</div>
                  <div className="nx-row" style={{ gap: 6, flexWrap: "wrap" }}>
                    {p.research.techStack.map((t) => <span key={t} className="nx-tag">{t}</span>)}
                  </div>
                </>
              )}
              {p.research.signals && p.research.signals.length > 0 && (
                <>
                  <div className="nx-label" style={{ marginTop: 14 }}>Buying signals</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }} className="nx-dim">
                    {p.research.signals.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </>
              )}

              {/* Sources */}
              <div className="nx-label" style={{ marginTop: 16 }}>
                {p.research.sourcesSimulated ? "Sources (illustrative — not real pages)" : "Sources"}
              </div>
              <Sources sources={p.research.sources} />
              <div className="nx-muted" style={{ fontSize: 11, marginTop: 12 }}>
                Generated {relativeTime(p.research.generatedAt)}
                {p.research.simulated && " · simulated"}
              </div>
            </div>
          )}
        </Card>

        {/* decision makers + draft */}
        <div className="nx-grid">
          <Card>
            <div className="nx-spread" style={{ marginBottom: 12 }}>
              <div className="nx-row" style={{ gap: 10 }}>
                <strong>Decision makers</strong>
                {reviewCount > 0 && <span className="nx-badge nx-badge-amber">{reviewCount} need review</span>}
              </div>
              <button className="nx-btn nx-btn-sm" disabled={busy === "enrich"} onClick={enrichContacts}>
                {busy === "enrich" ? "Enriching…" : "Enrich"}
              </button>
            </div>
            {p.decisionMakers.length === 0 ? (
              <EmptyState
                title="No contacts yet"
                hint="Run enrichment to find decision-makers and verify their emails."
                action={<button className="nx-btn nx-btn-primary" disabled={busy === "enrich"} onClick={enrichContacts}>{busy === "enrich" ? "Enriching…" : "Enrich contacts"}</button>}
              />
            ) : (
              p.decisionMakers.map((dm) => {
                const needsReview = dm.reviewStatus === "needs_review";
                return (
                  <div key={dm.id} style={{ padding: "11px 0", borderBottom: "1px solid rgba(30,43,71,0.5)" }}>
                    <div className="nx-spread">
                      <div>
                        <div className="nx-row" style={{ gap: 7 }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{dm.name}</span>
                          {dm.simulated && <span className="nx-badge nx-badge-purple">Simulated</span>}
                        </div>
                        <div className="nx-muted" style={{ fontSize: 12 }}>{dm.title}{dm.seniority ? ` · ${dm.seniority}` : ""}</div>
                      </div>
                      <VerifyBadge status={dm.emailVerification} />
                    </div>
                    {dm.email && <div className="nx-mono nx-dim" style={{ fontSize: 12, marginTop: 5 }}>{dm.email}</div>}
                    <div className="nx-row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      {dm.companyMatch && (
                        <span className={`nx-badge ${dm.companyMatch === "match" ? "nx-badge-green" : dm.companyMatch === "mismatch" ? "nx-badge-red" : "nx-badge-amber"}`}>
                          {dm.companyMatch === "match" ? "Company match" : dm.companyMatch === "mismatch" ? "Domain mismatch" : "Match uncertain"}
                        </span>
                      )}
                      {dm.checkedAt && <span className="nx-muted" style={{ fontSize: 11 }}>Checked {relativeTime(dm.checkedAt)}</span>}
                      {dm.linkedinUrl && <a href={dm.linkedinUrl} target="_blank" rel="noreferrer" className="nx-link" style={{ fontSize: 12 }}>LinkedIn ↗</a>}
                      {dm.sources.length > 0 && <span className="nx-muted" style={{ fontSize: 11 }}>{dm.sources.length} source{dm.sources.length > 1 ? "s" : ""}</span>}
                    </div>
                    {needsReview && (
                      <div style={{ marginTop: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "8px 10px" }}>
                        <div className="nx-row" style={{ gap: 6 }}>
                          <span className="nx-badge nx-badge-amber">Needs review</span>
                          <span className="nx-dim" style={{ fontSize: 12 }}>{dm.reviewReason}</span>
                        </div>
                        <div className="nx-row" style={{ gap: 8, marginTop: 8 }}>
                          <button className="nx-btn nx-btn-sm" disabled={busy === `dm-${dm.id}`} onClick={() => reviewContact(dm.id, "approve")}>Approve</button>
                          <button className="nx-btn nx-btn-sm nx-btn-danger" disabled={busy === `dm-${dm.id}`} onClick={() => reviewContact(dm.id, "dismiss")}>Dismiss</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </Card>

          <Card>
            <div className="nx-spread" style={{ marginBottom: 12 }}>
              <strong>Email draft</strong>
              <div className="nx-row" style={{ gap: 6 }}>
                {p.draftEmail?.approved && <span className="nx-badge nx-badge-green">Approved</span>}
                {p.draftEmail?.edited && !p.draftEmail?.approved && <span className="nx-badge nx-badge-blue">Edited</span>}
                {p.draftEmail && <SimBadge simulated={p.draftEmail.simulated} />}
              </div>
            </div>
            {!p.draftEmail ? (
              <EmptyState
                title="No draft yet"
                hint="Generate a personalised intro from the research report and Nexai's offer."
                action={<button className="nx-btn nx-btn-primary" disabled={busy === "draft"} onClick={() => generateDraft(false)}>{busy === "draft" ? "Drafting…" : "Generate draft"}</button>}
              />
            ) : draftEdit ? (
              <div>
                <div className="nx-field">
                  <label className="nx-label">Subject</label>
                  <input className="nx-input" value={draftEdit.subject} onChange={(e) => setDraftEdit({ ...draftEdit, subject: e.target.value })} />
                </div>
                <div className="nx-field">
                  <label className="nx-label">Body</label>
                  <textarea className="nx-textarea" style={{ minHeight: 200 }} value={draftEdit.body} onChange={(e) => setDraftEdit({ ...draftEdit, body: e.target.value })} />
                </div>
                <div className="nx-row" style={{ gap: 8 }}>
                  <button className="nx-btn nx-btn-primary" disabled={busy === "draft-save"} onClick={saveDraftEdit}>{busy === "draft-save" ? "Saving…" : "Save edits"}</button>
                  <button className="nx-btn" onClick={() => setDraftEdit(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="nx-label">Subject</div>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10 }}>{p.draftEmail.subject}</div>
                <div className="nx-label">Body</div>
                <div className="nx-dim" style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", background: "var(--nx-bg-2)", border: "1px solid var(--nx-border)", borderRadius: 9, padding: 12 }}>
                  {p.draftEmail.body}
                </div>
                {p.draftEmail.offerCheck && (
                  <OfferCheckBanner check={p.draftEmail.offerCheck} />
                )}
                <div className="nx-row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="nx-btn nx-btn-sm" onClick={() => setDraftEdit({ subject: p.draftEmail!.subject, body: p.draftEmail!.body })}>Edit</button>
                  {!p.draftEmail.approved && (
                    <button className="nx-btn nx-btn-sm nx-btn-primary" disabled={busy === "draft-approve"} onClick={approveDraft}>{busy === "draft-approve" ? "Approving…" : "Approve"}</button>
                  )}
                  <button className="nx-btn nx-btn-sm nx-btn-ghost" disabled={busy === "draft"} onClick={() => generateDraft(false)}>Regenerate</button>
                </div>
                <div className="nx-muted" style={{ fontSize: 11, marginTop: 10 }}>
                  Draft · not sent · sending is disabled during development
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="nx-muted" style={{ fontSize: 11.5, marginTop: 18 }}>
        Created {dateTime(p.createdAt)} · Last updated {relativeTime(p.updatedAt)}
      </div>

      {editing && (
        <div className="nx-overlay" onClick={() => setEditing(false)}>
          <div className="nx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nx-modal-head"><strong>Edit prospect</strong></div>
            <div className="nx-modal-body">
              <div className="nx-field">
                <label className="nx-label">Company name</label>
                <input className="nx-input" value={edit.companyName ?? ""} onChange={(e) => setEdit({ ...edit, companyName: e.target.value })} />
              </div>
              <div className="nx-grid cols-2" >
                <div className="nx-field">
                  <label className="nx-label">Industry</label>
                  <input className="nx-input" value={edit.industry ?? ""} onChange={(e) => setEdit({ ...edit, industry: e.target.value })} />
                </div>
                <div className="nx-field">
                  <label className="nx-label">Location</label>
                  <input className="nx-input" value={edit.location ?? ""} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
                </div>
              </div>
              <div className="nx-grid cols-2" >
                <div className="nx-field">
                  <label className="nx-label">Employee range</label>
                  <input className="nx-input" value={edit.employeeRange ?? ""} onChange={(e) => setEdit({ ...edit, employeeRange: e.target.value })} />
                </div>
                <div className="nx-field">
                  <label className="nx-label">Fit score (0-100)</label>
                  <input className="nx-input" type="number" min={0} max={100} value={edit.fitScore ?? ""} onChange={(e) => setEdit({ ...edit, fitScore: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </div>
              </div>
              <div className="nx-field">
                <label className="nx-label">Notes</label>
                <textarea className="nx-textarea" style={{ minHeight: 80 }} value={edit.qualificationNotes ?? ""} onChange={(e) => setEdit({ ...edit, qualificationNotes: e.target.value })} />
              </div>
            </div>
            <div className="nx-modal-foot">
              <button className="nx-btn" onClick={() => setEditing(false)}>Cancel</button>
              <button className="nx-btn nx-btn-primary" disabled={busy === "edit"} onClick={saveEdit}>{busy === "edit" ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OfferCheckBanner({ check }: { check: OfferCheck }) {
  const cls = check.status === "supported" ? "nx-badge-green" : check.status === "unsupported" ? "nx-badge-red" : "nx-badge-amber";
  const label = check.status === "supported" ? "Offer supported" : check.status === "unsupported" ? "Unsupported offer" : "Needs review";
  return (
    <div style={{ marginTop: 10, background: "var(--nx-bg-2)", border: "1px solid var(--nx-border)", borderRadius: 8, padding: "9px 11px" }}>
      <div className="nx-row" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="nx-label" style={{ margin: 0 }}>Catalogue check</span>
        <span className={`nx-badge ${cls}`}>{label}</span>
        {check.matchedOfferings.length > 0 && (
          <span className="nx-muted" style={{ fontSize: 11 }}>Offers: {check.matchedOfferings.join(", ")}</span>
        )}
      </div>
      {check.unsupported.length > 0 && (
        <div className="nx-dim" style={{ fontSize: 12, marginTop: 6 }}>
          <strong style={{ color: "#f5a3a3" }}>Not offered:</strong> {check.unsupported.join(", ")}
        </div>
      )}
      {check.ambiguous.length > 0 && (
        <div className="nx-dim" style={{ fontSize: 12, marginTop: 4 }}>
          <strong style={{ color: "#f3cf7a" }}>Review:</strong> {check.ambiguous.join("; ")}
        </div>
      )}
      <div className="nx-muted" style={{ fontSize: 11, marginTop: 6 }}>
        {check.status === "supported"
          ? "Offer is backed by the approved catalogue."
          : "This draft cannot be sent live until the issues above are resolved and the catalogue is approved."}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="nx-label">{label}</div>
      <div style={{ fontSize: 13.5 }}>{value ?? <span className="nx-muted">—</span>}</div>
    </div>
  );
}

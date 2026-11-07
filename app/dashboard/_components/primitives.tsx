"use client";

import type { ReactNode } from "react";
import {
  QUALIFICATION_LABELS,
  EMAIL_VERIFICATION_LABELS,
  type EmailVerification,
  type QualificationStatus,
  type RecordOrigin,
} from "@/lib/nexai/types";

export function OriginBadge({ origin }: { origin: RecordOrigin }) {
  return origin === "demo" ? (
    <span className="nx-badge nx-badge-demo" title="Simulated sample record">
      <span className="nx-badge-dot" style={{ background: "#a78bfa" }} /> Demo
    </span>
  ) : (
    <span className="nx-badge nx-badge-live" title="Live record">
      <span className="nx-badge-dot" style={{ background: "#34d399" }} /> Live
    </span>
  );
}

export function SimBadge({ simulated }: { simulated: boolean }) {
  return simulated ? (
    <span className="nx-badge nx-badge-purple">Simulated</span>
  ) : (
    <span className="nx-badge nx-badge-green">Live</span>
  );
}

const STATUS_CLASS: Record<QualificationStatus, string> = {
  new: "nx-badge-gray",
  researching: "nx-badge-blue",
  qualified: "nx-badge-green",
  disqualified: "nx-badge-red",
  contacted: "nx-badge-amber",
  in_conversation: "nx-badge-blue",
  booked: "nx-badge-green",
};

export function StatusPill({ status }: { status: QualificationStatus }) {
  return <span className={`nx-badge ${STATUS_CLASS[status]}`}>{QUALIFICATION_LABELS[status]}</span>;
}

const VERIFY_CLASS: Record<EmailVerification, string> = {
  verified: "nx-badge-green",
  accept_all: "nx-badge-amber",
  unverified: "nx-badge-gray",
  invalid: "nx-badge-red",
  unknown: "nx-badge-gray",
};

export function VerifyBadge({ status }: { status: EmailVerification }) {
  return <span className={`nx-badge ${VERIFY_CLASS[status]}`}>{EMAIL_VERIFICATION_LABELS[status]}</span>;
}

export function ScoreBar({ score }: { score?: number }) {
  if (score == null) return <span className="nx-muted">—</span>;
  return (
    <span className="nx-score" title={`Fit score ${score}/100`}>
      <span className="nx-score-track">
        <span className="nx-score-fill" style={{ width: `${score}%` }} />
      </span>
      <span className="nx-dim" style={{ fontSize: 12 }}>
        {score}
      </span>
    </span>
  );
}

export function Card({ children, glow, className, style }: { children: ReactNode; glow?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`nx-card ${glow ? "nx-card-glow" : ""} ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="nx-state">
      <div className="nx-spinner" />
      {label && <div className="nx-dim">{label}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="nx-state">
      <svg className="nx-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 14h8" />
      </svg>
      <div className="nx-state-title">{title}</div>
      {hint && <div style={{ marginBottom: action ? 16 : 0 }}>{hint}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="nx-state">
      <svg className="nx-state-icon" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <div className="nx-state-title" style={{ color: "#f5a3a3" }}>
        Something went wrong
      </div>
      <div style={{ marginBottom: onRetry ? 16 : 0 }}>{message}</div>
      {onRetry && (
        <button className="nx-btn nx-btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function LevelDot({ level }: { level: "info" | "success" | "warning" | "error" }) {
  const color =
    level === "error" ? "#f87171" : level === "warning" ? "#fbbf24" : level === "success" ? "#34d399" : "#38bdf8";
  return <span className="nx-badge-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />;
}

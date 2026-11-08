"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AGENT_EVENT, type AgentSignal, type AgentState } from "./agent-bus";

const LABELS: Record<AgentState, string> = {
  idle: "Monitoring",
  awake: "On it…",
  researching: "Researching…",
  enriching: "Enriching contacts…",
  writing: "Writing…",
  completed: "Done",
  error: "Something went wrong",
  review: "Needs review",
  reply: "Reply for Kieran",
};
const SUBS: Partial<Record<AgentState, string>> = {
  idle: "Agent idle",
  awake: "Focusing",
  researching: "Scanning the web",
  enriching: "Inspecting contacts",
  writing: "Drafting outreach",
  completed: "Back to idle shortly",
  error: "Please check",
  review: "Your attention needed",
  reply: "Hand over to you",
};
const DOT: Record<AgentState, string> = {
  idle: "#38bdf8",
  awake: "#7dd3fc",
  researching: "#38bdf8",
  enriching: "#22d3ee",
  writing: "#818cf8",
  completed: "#34d399",
  error: "#f87171",
  review: "#fbbf24",
  reply: "#38bdf8",
};

const ALERT_STATES: AgentState[] = ["error", "review", "reply"];
const BUSY_STATES: AgentState[] = ["awake", "researching", "enriching", "writing"];

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, val: string) {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

export default function AgentCharacter() {
  const router = useRouter();
  const [task, setTask] = useState<AgentSignal | null>(null);
  const [ambient, setAmbient] = useState<AgentSignal | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [min, setMin] = useState(false);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore prefs
  useEffect(() => {
    setHidden(readLS("nx_agent_hidden") === "1");
    setMin(readLS("nx_agent_min") === "1");
  }, []);

  // Subscribe to task events
  useEffect(() => {
    const onEvt = (e: Event) => {
      const sig = (e as CustomEvent<AgentSignal>).detail;
      if (!sig) return;
      if (completeTimer.current) clearTimeout(completeTimer.current);
      if (busyTimer.current) clearTimeout(busyTimer.current);

      if (sig.state === "idle") {
        setTask(null);
        return;
      }
      setTask(sig);

      if (sig.state === "completed") {
        completeTimer.current = setTimeout(() => setTask(null), 2600);
      } else if (BUSY_STATES.includes(sig.state)) {
        // Watchdog: if a caller forgets to finish, fall back to idle.
        busyTimer.current = setTimeout(() => setTask(null), 25000);
      }
    };
    window.addEventListener(AGENT_EVENT, onEvt as EventListener);
    return () => window.removeEventListener(AGENT_EVENT, onEvt as EventListener);
  }, []);

  // Poll REAL app state for ambient alerts (replies / review).
  const poll = useCallback(async () => {
    try {
      const [nRes, oRes] = await Promise.all([
        fetch("/api/nexai/notifications").then((r) => r.json()),
        fetch("/api/nexai/overview").then((r) => r.json()),
      ]);
      setDemoMode(oRes?.metrics?.demoMode ?? true);
      const notifs: { kind: string; read: boolean; prospectId?: string }[] = nRes?.notifications ?? [];
      const unread = notifs.filter((n) => !n.read);
      const reply = unread.find((n) => n.kind === "reply_needs_human");
      const ooo = unread.find((n) => n.kind === "out_of_office_review");
      if (reply) {
        setAmbient({ state: "reply", label: LABELS.reply, simulated: true, href: `/dashboard/conversations${reply.prospectId ? `?prospect=${reply.prospectId}` : ""}` });
      } else if (ooo) {
        setAmbient({ state: "review", label: "Out-of-office — review", simulated: true, href: `/dashboard/conversations${ooo.prospectId ? `?prospect=${ooo.prospectId}` : ""}` });
      } else {
        setAmbient(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 18000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll]);

  if (hidden) {
    return (
      <button
        className="nx-agent-launcher"
        title="Show Nexai agent"
        onClick={() => {
          setHidden(false);
          writeLS("nx_agent_hidden", "0");
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nexai-mark.webp" alt="Show agent" />
      </button>
    );
  }

  // Displayed = active task takes priority, else ambient alert, else idle.
  const signal: AgentSignal = task ?? ambient ?? { state: "idle" };
  const state = signal.state;
  const label = signal.label ?? LABELS[state];
  const sub = SUBS[state];
  const isDemo = signal.simulated ?? (ambient != null && demoMode);
  const dismissable = ALERT_STATES.includes(state) && task != null;
  const href = signal.href;
  const navigable = Boolean(href);

  const go = () => {
    if (href) {
      router.push(href);
      // Clear the transient alert after navigating (ambient re-shows if still unhandled).
      if (task) setTask(null);
    } else if (dismissable) {
      setTask(null);
    }
  };

  return (
    <div className="nx-agent-wrap" aria-live="polite">
      <div
        className={`nx-agent-chip ${navigable ? "clickable" : ""}`}
        role={navigable ? "button" : "status"}
        tabIndex={navigable ? 0 : undefined}
        onClick={navigable ? go : undefined}
        onKeyDown={navigable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } } : undefined}
        title={navigable ? "Click to review" : undefined}
      >
        <div className="nx-agent-chip-label">
          <span className="nx-agent-chip-dot" style={{ background: DOT[state], boxShadow: `0 0 6px ${DOT[state]}` }} />
          {label}
        </div>
        <div className="nx-agent-chip-sub">
          {sub}
          {isDemo && <span className="nx-badge nx-badge-purple" style={{ marginLeft: 6, padding: "0 6px", fontSize: 9 }}>demo</span>}
          {navigable && <span className="nx-agent-chip-cta">Review →</span>}
        </div>
      </div>

      <div
        className={`nx-agent ${min ? "min" : ""} ${navigable ? "clickable" : ""}`}
        data-state={state}
        role={navigable ? "button" : "img"}
        tabIndex={navigable ? 0 : undefined}
        aria-label={navigable ? `Nexai agent: ${label}. Click to review.` : `Nexai agent: ${label}`}
        onClick={go}
        onKeyDown={navigable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } } : undefined}
      >
        <AgentSvg />
        <div className="nx-agent-ctrls">
          <span
            className="nx-agent-ctrl"
            title={min ? "Expand" : "Minimise"}
            onClick={(e) => {
              e.stopPropagation();
              const v = !min;
              setMin(v);
              writeLS("nx_agent_min", v ? "1" : "0");
            }}
          >
            {min ? "+" : "–"}
          </span>
          <span
            className="nx-agent-ctrl"
            title="Hide"
            onClick={(e) => {
              e.stopPropagation();
              setHidden(true);
              writeLS("nx_agent_hidden", "1");
            }}
          >
            ×
          </span>
        </div>
      </div>
    </div>
  );
}

function AgentSvg() {
  return (
    <svg className="nx-agent-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nxShell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#13233f" />
          <stop offset="1" stopColor="#0a1324" />
        </linearGradient>
        <linearGradient id="nxEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      <g className="nx-body">
        {/* antenna with a glowing tip */}
        <g className="nx-tail">
          <line x1="50" y1="29" x2="50" y2="17" stroke="url(#nxEdge)" strokeWidth="2.4" strokeLinecap="round" />
          <circle className="nx-stinger" cx="50" cy="14" r="3.2" />
        </g>

        {/* shoulders / body base */}
        <path d="M33 74 L29 88 L71 88 L67 74 Z" fill="url(#nxShell)" stroke="url(#nxEdge)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="42" cy="84" r="1.4" fill="#38bdf8" opacity="0.8" />
        <circle cx="58" cy="84" r="1.4" fill="#38bdf8" opacity="0.8" />

        {/* side ear pods */}
        <rect x="20" y="46" width="6" height="14" rx="3" fill="url(#nxShell)" stroke="url(#nxEdge)" strokeWidth="1.8" />
        <rect x="74" y="46" width="6" height="14" rx="3" fill="url(#nxShell)" stroke="url(#nxEdge)" strokeWidth="1.8" />

        {/* head */}
        <rect x="27" y="29" width="46" height="46" rx="13" fill="url(#nxShell)" stroke="url(#nxEdge)" strokeWidth="2.2" />
        {/* forehead sensor */}
        <circle cx="50" cy="36" r="1.6" fill="#38bdf8" />

        {/* face screen */}
        <rect x="31" y="41" width="38" height="25" rx="8" fill="#071020" stroke="rgba(56,189,248,0.3)" strokeWidth="1.2" />

        {/* eyes */}
        <g className="nx-eyes">
          <ellipse className="nx-eye-glow" cx="41" cy="51" rx="5.2" ry="4.6" />
          <ellipse className="nx-eye-glow" cx="59" cy="51" rx="5.2" ry="4.6" />
          <g className="nx-pupils">
            <circle className="nx-pupil" cx="41" cy="51" r="1.9" />
            <circle className="nx-pupil" cx="59" cy="51" r="1.9" />
          </g>
        </g>
        {/* friendly mouth */}
        <path className="nx-visor" d="M44 61 Q50 64 56 61" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.8" />

        {/* success sparkles */}
        <g className="nx-spark">
          <path d="M76 34 l1.6 3.2 3.2 1.6 -3.2 1.6 -1.6 3.2 -1.6 -3.2 -3.2 -1.6 3.2 -1.6 Z" fill="#34d399" />
          <circle cx="24" cy="38" r="2" fill="#34d399" />
        </g>

        {/* reply mail icon */}
        <g className="nx-mail" transform="translate(68 22)">
          <rect x="-9" y="-6" width="18" height="13" rx="2.5" fill="#0a1324" stroke="#38bdf8" strokeWidth="1.6" />
          <path d="M-9 -4 L0 2 L9 -4" stroke="#38bdf8" strokeWidth="1.6" fill="none" />
        </g>

        {/* attention badge */}
        <g className="nx-badge-mark" transform="translate(71 31)">
          <circle r="8" fill="#f87171" />
          <rect x="-1" y="-4.4" width="2" height="5.4" rx="1" fill="#1a0b0b" />
          <circle cx="0" cy="3.2" r="1.2" fill="#1a0b0b" />
        </g>
      </g>
    </svg>
  );
}

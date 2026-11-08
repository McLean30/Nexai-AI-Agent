"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
      const notifs: { kind: string; read: boolean }[] = nRes?.notifications ?? [];
      const unread = notifs.filter((n) => !n.read);
      if (unread.some((n) => n.kind === "reply_needs_human")) {
        setAmbient({ state: "reply", label: LABELS.reply, simulated: true });
      } else if (unread.some((n) => n.kind === "out_of_office_review")) {
        setAmbient({ state: "review", label: "Out-of-office — review", simulated: true });
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

  return (
    <div className="nx-agent-wrap" aria-live="polite">
      <div className="nx-agent-chip" role="status">
        <div className="nx-agent-chip-label">
          <span className="nx-agent-chip-dot" style={{ background: DOT[state], boxShadow: `0 0 6px ${DOT[state]}` }} />
          {label}
        </div>
        <div className="nx-agent-chip-sub">
          {sub}
          {isDemo && <span className="nx-badge nx-badge-purple" style={{ marginLeft: 6, padding: "0 6px", fontSize: 9 }}>demo</span>}
        </div>
      </div>

      <div
        className={`nx-agent ${min ? "min" : ""}`}
        data-state={state}
        role="img"
        aria-label={`Nexai agent: ${label}`}
        onClick={() => {
          if (dismissable) setTask(null);
        }}
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
        {/* tail arcing over the top with a glowing stinger */}
        <g className="nx-tail">
          <path d="M34 34 C 20 24, 22 10, 34 8 C 44 6, 50 12, 48 18"
            stroke="url(#nxEdge)" strokeWidth="3.4" strokeLinecap="round" opacity="0.85" />
          <circle className="nx-stinger" cx="48" cy="18" r="3.4" />
        </g>

        {/* claws */}
        <path d="M28 70 C 20 72, 18 80, 24 84" stroke="url(#nxEdge)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <path d="M72 70 C 80 72, 82 80, 76 84" stroke="url(#nxEdge)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />

        {/* head shield */}
        <path d="M50 34 L72 44 L70 68 L50 80 L30 68 L28 44 Z"
          fill="url(#nxShell)" stroke="url(#nxEdge)" strokeWidth="2.2" />
        {/* circuit lines */}
        <path d="M50 80 L50 60 M50 60 L41 54 M50 60 L59 54 M41 54 L41 48 M59 54 L59 48"
          stroke="#2b5fb0" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
        <circle cx="50" cy="60" r="1.6" fill="#38bdf8" />

        {/* eyes */}
        <g className="nx-eyes">
          <ellipse className="nx-eye-glow" cx="41" cy="49" rx="5.4" ry="4" />
          <ellipse className="nx-eye-glow" cx="59" cy="49" rx="5.4" ry="4" />
          <g className="nx-pupils">
            <circle className="nx-pupil" cx="41" cy="49" r="1.9" />
            <circle className="nx-pupil" cx="59" cy="49" r="1.9" />
          </g>
        </g>
        {/* visor line */}
        <path className="nx-visor" d="M36 66 L64 66" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />

        {/* success sparkles */}
        <g className="nx-spark">
          <path d="M74 36 l1.6 3.2 3.2 1.6 -3.2 1.6 -1.6 3.2 -1.6 -3.2 -3.2 -1.6 3.2 -1.6 Z" fill="#34d399" />
          <circle cx="26" cy="40" r="2" fill="#34d399" />
        </g>

        {/* reply mail icon */}
        <g className="nx-mail" transform="translate(66 24)">
          <rect x="-9" y="-6" width="18" height="13" rx="2.5" fill="#0a1324" stroke="#38bdf8" strokeWidth="1.6" />
          <path d="M-9 -4 L0 2 L9 -4" stroke="#38bdf8" strokeWidth="1.6" fill="none" />
        </g>

        {/* attention badge */}
        <g className="nx-badge-mark" transform="translate(70 32)">
          <circle r="8" fill="#f87171" />
          <rect x="-1" y="-4.4" width="2" height="5.4" rx="1" fill="#1a0b0b" />
          <circle cx="0" cy="3.2" r="1.2" fill="#1a0b0b" />
        </g>
      </g>
    </svg>
  );
}

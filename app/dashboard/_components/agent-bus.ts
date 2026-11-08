"use client";

// Tiny event bus so any screen can tell the Nexai agent character what the app
// is doing right now. Uses a plain DOM CustomEvent — no extra dependencies.

export type AgentState =
  | "idle"
  | "awake"
  | "researching"
  | "enriching"
  | "writing"
  | "completed"
  | "error"
  | "review"
  | "reply";

export interface AgentSignal {
  state: AgentState;
  label?: string;
  simulated?: boolean;
}

export const AGENT_EVENT = "nexai:agent";

/** Publish a task state to the agent character. */
export function emitAgent(state: AgentState, label?: string, opts?: { simulated?: boolean }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AgentSignal>(AGENT_EVENT, {
      detail: { state, label, simulated: opts?.simulated },
    }),
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: string; external?: boolean };

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Pipeline",
    items: [
      { href: "/dashboard", label: "Overview", icon: icon("M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z") },
      { href: "/dashboard/prospects", label: "Prospects", icon: icon("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75") },
      { href: "/dashboard/campaign", label: "Campaign", icon: icon("M3 11l19-9-9 19-2-8-8-2z") },
      { href: "/dashboard/conversations", label: "Conversations", icon: icon("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z") },
    ],
  },
  {
    section: "Insight",
    items: [
      { href: "/dashboard/activity", label: "Activity & Errors", icon: icon("M22 12h-4l-3 9L9 3l-3 9H2") },
      { href: "/fire-enrich", label: "Research (CSV)", icon: icon("M4 4h16v16H4zM4 9h16M9 4v16"), external: true },
    ],
  },
  {
    section: "Setup",
    items: [
      { href: "/dashboard/connections", label: "Connections & Settings", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z") },
    ],
  },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/nexai/connections")
      .then((r) => r.json())
      .then((d) => {
        const live = (d.providers ?? []).filter((p: { connected: boolean }) => p.connected).length;
        setLiveCount(live);
      })
      .catch(() => {});
    fetch("/api/nexai/overview")
      .then((r) => r.json())
      .then((d) => setDemoMode(d.metrics?.demoMode ?? true))
      .catch(() => {});
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="nx-root">
      <div className="nx-layout">
        <aside className={`nx-sidebar ${open ? "open" : ""}`}>
          <div className="nx-wordmark">
            <div className="nx-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/nexai-mark.webp" alt="Nexai Digital" width={34} height={34} />
            </div>
            <div>
              <div className="nx-wordmark-text">
                Nex<span>ai</span>
              </div>
              <div className="nx-wordmark-sub">Digital</div>
            </div>
          </div>

          {NAV.map((group) => (
            <div key={group.section}>
              <div className="nx-nav-section">{group.section}</div>
              {group.items.map((item) =>
                item.external ? (
                  <a key={item.href} href={item.href} className="nx-nav-link" target="_blank" rel="noreferrer">
                    {item.icon}
                    {item.label}
                    <span className="nx-nav-badge">↗</span>
                  </a>
                ) : (
                  <Link key={item.href} href={item.href} className={`nx-nav-link ${isActive(item.href) ? "active" : ""}`}>
                    {item.icon}
                    {item.label}
                    {item.href === "/dashboard/connections" && (
                      <span className="nx-nav-badge">{liveCount}/4</span>
                    )}
                  </Link>
                ),
              )}
            </div>
          ))}

          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <div className="nx-tag" style={{ display: "block", textAlign: "center" }}>
              {liveCount === 0 ? "All providers in mock mode" : `${liveCount}/4 live`}
            </div>
          </div>
        </aside>

        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 35 }}
          />
        )}

        <div className="nx-main">
          <div className="nx-topbar">
            <button className="nx-btn nx-btn-sm" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <div className="nx-row" style={{ gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/nexai-mark.webp" alt="Nexai Digital" width={22} height={26} style={{ objectFit: "contain" }} />
              <div className="nx-wordmark-text" style={{ fontSize: 16 }}>
                Nex<span style={{ color: "#38bdf8" }}>ai</span> Digital
              </div>
            </div>
          </div>

          {demoMode && (
            <div className="nx-demo-banner">
              <span className="nx-demo-dot" />
              <strong>Demo mode</strong>
              <span>— all records and activity below are simulated sample data. No real emails are sent.</span>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

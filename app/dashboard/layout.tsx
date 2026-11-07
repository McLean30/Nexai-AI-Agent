import type { Metadata } from "next";
import "./nexai.css";
import Shell from "./_components/shell";

export const metadata: Metadata = {
  title: "Nexai Digital — Prospect Engine",
  description: "Prospect research and outreach dashboard for Nexai Digital.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}

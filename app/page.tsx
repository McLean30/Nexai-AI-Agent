import { redirect } from "next/navigation";

// Nexai Digital — the dashboard is the primary surface.
// The original Fire Enrich research tool remains available at /fire-enrich.
export default function Home() {
  redirect("/dashboard");
}

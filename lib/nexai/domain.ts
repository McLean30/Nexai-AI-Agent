// Domain normalization — the single source of truth for deduplicating
// companies. Strips protocol, "www.", path, query, fragment and port, and
// lower-cases the result so "https://WWW.Acme.co.uk/contact" and "acme.co.uk"
// resolve to the same key.

export function normalizeDomain(input: string | undefined | null): string {
  let s = (input ?? "").trim().toLowerCase();
  if (!s) return "";
  // If it looks like an email, take the domain part.
  if (s.includes("@")) s = s.split("@").pop() ?? s;
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.split("/")[0];
  s = s.split("?")[0];
  s = s.split("#")[0];
  s = s.replace(/:\d+$/, ""); // strip port
  s = s.replace(/\.$/, ""); // trailing dot
  return s.trim();
}

/** A canonical https:// website URL from any domain/URL-ish input. */
export function websiteFromDomain(input: string): string {
  const d = normalizeDomain(input);
  return d ? `https://${d}` : "";
}

/** True when the input normalizes to a plausible domain (has a dot, no spaces). */
export function looksLikeDomain(input: string): boolean {
  const d = normalizeDomain(input);
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !d.includes(" ");
}

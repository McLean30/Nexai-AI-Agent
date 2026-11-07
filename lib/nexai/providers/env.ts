// Server-side credential detection. A provider is "connected" only when all of
// its required environment variables are present on the server. We never read
// keys from the browser, request headers, or localStorage.

export function missingEnv(required: readonly string[]): string[] {
  return required.filter((k) => {
    const v = process.env[k];
    return !v || v.trim() === "";
  });
}

export function hasAllEnv(required: readonly string[]): boolean {
  return missingEnv(required).length === 0;
}

// Required env for each provider. These are the live-mode credentials; until
// they exist the provider stays in mock mode and reports "Not connected".
export const PROVIDER_ENV = {
  discovery: ["DISCOVERY_API_KEY"],
  research: ["FIRECRAWL_API_KEY", "OPENAI_API_KEY"],
  enrichment: ["ENRICHMENT_API_KEY"],
  aiWriting: ["OPENAI_API_KEY"],
  email: ["MS365_TENANT_ID", "MS365_CLIENT_ID", "MS365_CLIENT_SECRET", "MS365_SENDER"],
} as const;

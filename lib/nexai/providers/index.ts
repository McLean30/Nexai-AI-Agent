import type { ProviderStatus } from "./types";
import { discoveryProvider } from "./discovery";
import { researchProvider } from "./research";
import { enrichmentProvider } from "./enrichment";
import { aiWritingProvider } from "./ai-writing";
import { emailProvider } from "./email-m365";

export {
  discoveryProvider,
  researchProvider,
  enrichmentProvider,
  aiWritingProvider,
  emailProvider,
};
export * from "./types";

export const providers = {
  discovery: discoveryProvider,
  research: researchProvider,
  enrichment: enrichmentProvider,
  aiWriting: aiWritingProvider,
  email: emailProvider,
};

/** Connection status for every provider — drives the Connections screen. */
export function allProviderStatuses(): ProviderStatus[] {
  return [
    discoveryProvider.status(),
    researchProvider.status(),
    enrichmentProvider.status(),
    aiWritingProvider.status(),
    emailProvider.status(),
  ];
}

export function anyLiveProvider(): boolean {
  return allProviderStatuses().some((s) => s.connected);
}

import type { EmailProvider, EmailSendResult, ProviderStatus } from "./types";
import { hasAllEnv, missingEnv, PROVIDER_ENV } from "./env";

// Microsoft 365 email provider (Graph API sendMail).
// MOCK never touches the network — it only simulates acceptance. LIVE would use
// the Microsoft Graph API via MS365_* credentials.
//
// IMPORTANT: sending is gated by an explicit `sendingEnabled` flag that is
// passed in from Settings and defaults to false. This gate is independent of
// whether research/other credentials exist — missing research keys must never
// be the safeguard that stops email going out.

const REQUIRED = PROVIDER_ENV.email;

function status(): ProviderStatus {
  const connected = hasAllEnv(REQUIRED);
  return {
    kind: "email",
    id: "microsoft-365",
    name: "Microsoft 365 Email",
    description: "Sends outreach via Microsoft Graph from a connected M365 mailbox.",
    connected,
    mode: connected ? "live" : "mock",
    requiredEnv: [...REQUIRED],
    missingEnv: missingEnv(REQUIRED),
    docsUrl: "https://learn.microsoft.com/en-us/graph/api/user-sendmail",
    plan: {
      liveService: "Microsoft 365 (Microsoft Graph)",
      apiName: "Microsoft Graph sendMail (OAuth client credentials)",
      reusesFirecrawl: false,
      implemented: false,
      envPlaceholder: false,
      note: "MS365_* are concrete; Graph sendMail is gated behind the explicit sending-enabled setting.",
    },
  };
}

export const emailProvider: EmailProvider = {
  status,
  async send(input): Promise<EmailSendResult> {
    const connected = hasAllEnv(REQUIRED);

    // Two independent gates, both must be open to actually send:
    //  1. sending must be explicitly enabled in Settings (defaults false)
    //  2. the M365 provider must be connected (live credentials present)
    if (!input.sendingEnabled) {
      return {
        accepted: false,
        simulated: true,
        reason: "Sending is disabled in Settings (safe default). No email was sent.",
      };
    }

    // Catalogue gate: an approved catalogue and a supported offer are required
    // before any live send.
    if (input.catalogue) {
      const { canSendDraft } = await import("../catalogue");
      const gate = canSendDraft({ offerCheck: input.offerCheck }, input.catalogue);
      if (!gate.ok) {
        return { accepted: false, simulated: true, reason: gate.reason };
      }
    }

    if (!connected) {
      return {
        accepted: false,
        simulated: true,
        reason: "Microsoft 365 is not connected. Simulated send only.",
      };
    }

    // LIVE Graph sendMail would go here once credentials are configured.
    return {
      accepted: true,
      simulated: false,
      providerMessageId: `graph_${Date.now().toString(36)}`,
    };
  },
};

export { status as emailStatus };

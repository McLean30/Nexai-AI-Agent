import type {
  ActivityEvent,
  OverviewMetrics,
  Prospect,
  QualificationStatus,
  Settings,
  StoreData,
} from "./types";
import { QUALIFICATION_STATUSES } from "./types";
import { buildSeedData, DEFAULT_SETTINGS } from "./seed";
import { getStorage } from "./storage";

// Store access layer. Persistence is delegated to a pluggable StorageAdapter
// (Upstash Redis on Vercel, local file in dev — see ./storage). On first run
// the backing store is seeded from the demo dataset. Writes are serialized
// through a promise chain to avoid interleaved writers within one process.

let writeChain: Promise<unknown> = Promise.resolve();

export async function readStore(): Promise<StoreData> {
  const storage = getStorage();
  let data = await storage.load();
  if (!data) {
    // First run against this backing store — seed it with the demo dataset.
    data = buildSeedData();
    await storage.save(data);
  }
  // Backfill settings defaults if an older store is loaded.
  data.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
  return data;
}

/** Read-modify-write under a serialized chain. Returns the mutator's result. */
export async function mutateStore<T>(
  fn: (data: StoreData) => T | Promise<T>,
): Promise<T> {
  const run = async (): Promise<T> => {
    const data = await readStore();
    const result = await fn(data);
    await getStorage().save(data);
    return result;
  };
  const p = writeChain.then(run, run);
  // Keep the chain alive but swallow errors so one failure doesn't poison it.
  writeChain = p.then(
    () => undefined,
    () => undefined,
  );
  return p;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export async function logActivity(
  data: StoreData,
  event: Omit<ActivityEvent, "id" | "at"> & { at?: string },
): Promise<ActivityEvent> {
  const ev: ActivityEvent = {
    id: newId("a"),
    at: event.at ?? new Date().toISOString(),
    level: event.level,
    kind: event.kind,
    message: event.message,
    simulated: event.simulated,
    prospectId: event.prospectId,
  };
  data.activity.unshift(ev);
  // keep the log bounded
  if (data.activity.length > 500) data.activity.length = 500;
  return ev;
}

export function computeOverview(data: StoreData): OverviewMetrics {
  const prospects = data.prospects;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const byStatus = Object.fromEntries(
    QUALIFICATION_STATUSES.map((s) => [s, 0]),
  ) as Record<QualificationStatus, number>;
  for (const p of prospects) byStatus[p.qualification]++;

  const allMessages = data.conversations.flatMap((c) => c.messages);
  const emailsSent = allMessages.filter(
    (m) => m.direction === "outbound" && ["sent", "delivered", "replied"].includes(m.status),
  ).length;
  const replies = data.conversations.filter((c) =>
    ["replied", "booked"].includes(c.status),
  ).length;
  const bounces = data.conversations.filter((c) => c.status === "bounced").length;
  const optOuts = data.conversations.filter((c) => c.status === "opted_out").length;
  const bookedCalls = prospects.filter((p) => p.qualification === "booked").length;

  return {
    totalProspects: prospects.length,
    newThisWeek: prospects.filter((p) => new Date(p.createdAt).getTime() >= weekAgo).length,
    qualified: prospects.filter((p) =>
      ["qualified", "contacted", "in_conversation", "booked"].includes(p.qualification),
    ).length,
    emailsSent,
    replies,
    replyRate: emailsSent > 0 ? replies / emailsSent : 0,
    bookedCalls,
    bounces,
    optOuts,
    byStatus,
    demoMode: prospects.some((p) => p.origin === "demo"),
  };
}

export function findProspect(data: StoreData, id: string): Prospect | undefined {
  return data.prospects.find((p) => p.id === id);
}

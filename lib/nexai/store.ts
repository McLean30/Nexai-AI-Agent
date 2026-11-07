import { promises as fs } from "fs";
import path from "path";
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

// Simple JSON file store. Persists to .data/store.json (git-ignored) so edits
// survive application restarts. On first run it is seeded from the demo dataset.
// Writes are atomic (temp file + rename) and serialized through a promise chain
// to avoid interleaved writers within a single dev process.

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

let writeChain: Promise<unknown> = Promise.resolve();

async function ensureStore(): Promise<void> {
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const seed = buildSeedData();
    await fs.writeFile(STORE_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
}

export async function readStore(): Promise<StoreData> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const data = JSON.parse(raw) as StoreData;
  // Backfill settings defaults if an older store is loaded.
  data.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
  return data;
}

async function atomicWrite(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, STORE_PATH);
}

/** Read-modify-write under a serialized chain. Returns the mutator's result. */
export async function mutateStore<T>(
  fn: (data: StoreData) => T | Promise<T>,
): Promise<T> {
  const run = async (): Promise<T> => {
    const data = await readStore();
    const result = await fn(data);
    await atomicWrite(data);
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

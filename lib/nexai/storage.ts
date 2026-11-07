import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Redis } from "@upstash/redis";
import type { StoreData } from "./types";

// Pluggable persistence for the Nexai store.
//
// - On Vercel (and any serverless host) the filesystem is ephemeral/read-only,
//   so the local JSON file cannot provide durable storage. When Upstash Redis
//   credentials are present we use Redis — a serverless-native, HTTP-based
//   store the project already depends on (@upstash/redis, used by rate-limit).
// - Locally, with no Redis configured, we fall back to a JSON file so dev works
//   with zero setup. Both adapters store the whole StoreData document.

export interface StorageAdapter {
  readonly name: string;
  readonly durable: boolean;
  load(): Promise<StoreData | null>;
  save(data: StoreData): Promise<void>;
}

const REDIS_KEY = "nexai:store:v1";

function createRedisAdapter(): StorageAdapter {
  const redis = Redis.fromEnv();
  return {
    name: "upstash-redis",
    durable: true,
    async load() {
      const data = await redis.get<StoreData>(REDIS_KEY);
      return data ?? null;
    },
    async save(data: StoreData) {
      await redis.set(REDIS_KEY, data);
    },
  };
}

function createFileAdapter(): StorageAdapter {
  // On a serverless host the project dir is read-only; only the temp dir is
  // writable (and only per-invocation). Prefer the project's .data dir locally,
  // fall back to the OS temp dir so a misconfigured deploy degrades to an
  // ephemeral demo rather than crashing.
  const DATA_DIR = process.env.VERCEL
    ? path.join(os.tmpdir(), "nexai-data")
    : path.join(process.cwd(), ".data");
  const STORE_PATH = path.join(DATA_DIR, "store.json");
  return {
    name: "local-file",
    durable: false,
    async load() {
      try {
        const raw = await fs.readFile(STORE_PATH, "utf8");
        return JSON.parse(raw) as StoreData;
      } catch {
        return null;
      }
    },
    async save(data: StoreData) {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(tmp, STORE_PATH);
    },
  };
}

let cached: StorageAdapter | null = null;

export function hasRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

export function getStorage(): StorageAdapter {
  if (cached) return cached;
  cached = hasRedisConfigured() ? createRedisAdapter() : createFileAdapter();
  return cached;
}

export interface StorageStatus {
  adapter: string;
  durable: boolean;
  note: string;
}

export function storageStatus(): StorageStatus {
  const redis = hasRedisConfigured();
  return {
    adapter: redis ? "upstash-redis" : "local-file",
    durable: redis,
    note: redis
      ? "Durable hosted database (Upstash Redis)."
      : "Local file store — fine for development, not durable on serverless hosts like Vercel.",
  };
}

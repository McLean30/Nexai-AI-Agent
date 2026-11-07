# Deploying Nexai Digital to Vercel

This app is a standard Next.js 15 project and deploys to Vercel with no extra
build configuration. The one thing it needs in production is a **durable
database**, because Vercel's filesystem is ephemeral and read-only — the local
JSON file store used in development will not persist there.

Storage is pluggable (`lib/nexai/storage.ts`):

- **Upstash Redis** is used automatically when its two env vars are present
  (recommended for Vercel — serverless-native, already a project dependency).
- **Local file store** is used otherwise (development only).

## 1. Create a hosted database (Upstash Redis)

1. Sign up at <https://upstash.com> (free tier is enough for review).
2. Create a **Redis** database (any region; pick one near your Vercel region).
3. Open the database → **REST API** section → copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

The store seeds itself with the demo dataset on first use, so there is nothing
to import.

## 2. Import the repo into Vercel

1. Go to <https://vercel.com/new> and import `McLean30/Nexai-AI-Agent`.
2. Framework preset: **Next.js** (auto-detected). Leave build & output settings
   at their defaults (`next build`).
3. Before the first deploy, add the environment variables below.

## 3. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**
(Production + Preview):

| Variable | Required | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | **Yes** | Durable storage |
| `UPSTASH_REDIS_REST_TOKEN` | **Yes** | Durable storage |
| `FIRECRAWL_API_KEY` | No | Live research (demo/mock when unset) |
| `OPENAI_API_KEY` | No | Live research + AI writing (mock when unset) |
| `ENRICHMENT_API_KEY` | No | Live contact enrichment (mock when unset) |
| `MS365_TENANT_ID` | No | Microsoft 365 email |
| `MS365_CLIENT_ID` | No | Microsoft 365 email |
| `MS365_CLIENT_SECRET` | No | Microsoft 365 email |
| `MS365_SENDER` | No | Microsoft 365 email |

For this milestone, only the two Upstash variables are needed. The research,
enrichment, AI-writing and email providers stay in **demo/mock mode**, and live
email sending stays **disabled** (an explicit in-app setting that defaults off).

## 4. Deploy & verify

1. Deploy. Open the Vercel URL → it redirects to `/dashboard`.
2. Go to **Connections & Settings** → the **Storage** card should read
   *Upstash Redis (hosted) · Durable*.
3. Edit a prospect, reload the page — the change persists (now backed by Redis).

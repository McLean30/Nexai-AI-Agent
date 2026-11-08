import { NextResponse } from "next/server";
import { mutateStore } from "@/lib/nexai/store";
import { processQueue } from "@/lib/nexai/automation";

export const runtime = "nodejs";

// Process due follow-ups — the scheduler "tick". Each due step is re-checked
// for replies/suppression immediately before sending, and claimed atomically.
// Runs inside the serialized write chain, so concurrent ticks are safe.
export async function POST() {
  const result = await mutateStore(async (store) => processQueue(store));
  return NextResponse.json(result);
}

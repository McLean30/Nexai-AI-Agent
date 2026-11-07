import { NextResponse } from "next/server";
import { computeOverview, readStore } from "@/lib/nexai/store";

export const runtime = "nodejs";

export async function GET() {
  const data = await readStore();
  return NextResponse.json({ metrics: computeOverview(data) });
}

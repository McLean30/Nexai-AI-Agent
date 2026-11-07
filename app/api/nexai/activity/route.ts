import { NextRequest, NextResponse } from "next/server";
import { readStore } from "@/lib/nexai/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const data = await readStore();
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level"); // e.g. "error"
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  let activity = [...data.activity].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  if (level && level !== "all") activity = activity.filter((a) => a.level === level);

  return NextResponse.json({ activity: activity.slice(0, limit) });
}

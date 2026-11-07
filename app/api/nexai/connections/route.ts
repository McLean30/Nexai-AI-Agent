import { NextResponse } from "next/server";
import { allProviderStatuses } from "@/lib/nexai/providers";
import { readStore } from "@/lib/nexai/store";
import { storageStatus } from "@/lib/nexai/storage";

export const runtime = "nodejs";

export async function GET() {
  const data = await readStore();
  return NextResponse.json({
    providers: allProviderStatuses(),
    settings: data.settings,
    storage: storageStatus(),
  });
}

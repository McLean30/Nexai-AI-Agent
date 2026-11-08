import { NextRequest, NextResponse } from "next/server";
import { mutateStore, readStore } from "@/lib/nexai/store";

export const runtime = "nodejs";

export async function GET() {
  const data = await readStore();
  const notifications = [...data.notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const unread = notifications.filter((n) => !n.read).length;
  return NextResponse.json({ notifications, unread });
}

// Mark one (id) or all (all:true) notifications read.
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const updated = await mutateStore(async (store) => {
    if (body.all === true) {
      store.notifications.forEach((n) => (n.read = true));
      return store.notifications.length;
    }
    if (typeof body.id === "string") {
      const n = store.notifications.find((x) => x.id === body.id);
      if (n) n.read = true;
      return n ? 1 : 0;
    }
    return 0;
  });
  return NextResponse.json({ updated });
}

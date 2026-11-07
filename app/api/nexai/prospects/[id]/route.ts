import { NextRequest, NextResponse } from "next/server";
import { findProspect, logActivity, mutateStore, readStore } from "@/lib/nexai/store";
import {
  QUALIFICATION_LABELS,
  type Prospect,
  type QualificationStatus,
} from "@/lib/nexai/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const data = await readStore();
  const prospect = findProspect(data, id);
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ prospect });
}

// Fields a client may edit directly.
const EDITABLE: (keyof Prospect)[] = [
  "companyName",
  "domain",
  "website",
  "industry",
  "location",
  "employeeRange",
  "qualification",
  "qualificationNotes",
  "fitScore",
  "tags",
  "decisionMakers",
];

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await mutateStore(async (store) => {
    const prospect = store.prospects.find((p) => p.id === id);
    if (!prospect) return null;

    const prevStatus = prospect.qualification;
    for (const key of EDITABLE) {
      if (key in body && body[key] !== undefined) {
        // @ts-expect-error controlled assignment over a known key allowlist
        prospect[key] = body[key];
      }
    }
    prospect.updatedAt = new Date().toISOString();
    prospect.lastActivityAt = prospect.updatedAt;

    if (body.qualification && body.qualification !== prevStatus) {
      const label = QUALIFICATION_LABELS[body.qualification as QualificationStatus] ?? body.qualification;
      await logActivity(store, {
        level: "info",
        kind: "qualification_changed",
        message: `${prospect.companyName} moved to ${label}.`,
        simulated: prospect.origin === "demo",
        prospectId: prospect.id,
      });
    }
    return prospect;
  });

  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ prospect: result });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ok = await mutateStore((store) => {
    const idx = store.prospects.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    store.prospects.splice(idx, 1);
    return true;
  });
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

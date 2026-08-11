import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Shared state for the /timeline tool. One row (id "default").
// GET  → { role, plan: { data, version, updatedAt, updatedBy } | null }
// PUT  → body { version, data }; writers only. Optimistic concurrency:
//        version must match the stored row, otherwise 409 with the
//        latest plan so the client can catch up (last write wins,
//        but never silently — the loser is told and refreshed).

const PLAN_ID = "default";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const plan = await prisma.timelinePlan.findUnique({ where: { id: PLAN_ID } });
  return Response.json(
    {
      role: session.role ?? "reader",
      plan: plan
        ? { data: plan.data, version: plan.version, updatedAt: plan.updatedAt, updatedBy: plan.updatedBy }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "writer") return Response.json({ error: "read-only" }, { status: 403 });

  let body: { version?: unknown; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const data = body.data as { lanes?: unknown; tasks?: unknown } | null | undefined;
  if (!data || !Array.isArray(data.lanes) || !Array.isArray(data.tasks)) {
    return Response.json({ error: "invalid plan: expected { lanes: [], tasks: [] }" }, { status: 400 });
  }
  const json = data as unknown as Prisma.InputJsonValue;
  const updatedBy = session.user?.name ?? session.user?.email ?? null;

  const existing = await prisma.timelinePlan.findUnique({ where: { id: PLAN_ID } });
  if (!existing) {
    const created = await prisma.timelinePlan.create({
      data: { id: PLAN_ID, data: json, version: 1, updatedBy },
    });
    return Response.json({ version: created.version, updatedAt: created.updatedAt });
  }

  const expected = typeof body.version === "number" ? body.version : -1;
  const updated = await prisma.timelinePlan.updateMany({
    where: { id: PLAN_ID, version: expected },
    data: { data: json, version: { increment: 1 }, updatedBy },
  });
  if (updated.count === 0) {
    const latest = await prisma.timelinePlan.findUnique({ where: { id: PLAN_ID } });
    return Response.json(
      {
        error: "conflict",
        version: latest?.version,
        data: latest?.data,
        updatedBy: latest?.updatedBy,
        updatedAt: latest?.updatedAt,
      },
      { status: 409 },
    );
  }
  const fresh = await prisma.timelinePlan.findUnique({ where: { id: PLAN_ID } });
  return Response.json({ version: fresh?.version, updatedAt: fresh?.updatedAt });
}

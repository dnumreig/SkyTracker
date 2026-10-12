import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdoClient } from "@/features/ado/client";
import { adoErrorResponse, NO_STORE } from "@/features/ado/http";
import { removeEpic } from "@/features/ado/push";
import { adoAuthFor, defaultTokenDeps } from "@/features/ado/token";
import { commitPlan, readPlan } from "@/features/timeline/plan-store";

// Delete an epic (GO 12.10): its features go to the shelf; when the epic lives in ADO, the features are unlinked
// from it there and the epic is deleted (recycle bin, restorable). POST (writers) { key } → { version, data,
// removedAdoId, unlinked, changesetId }

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "writer") return Response.json({ error: "read-only" }, { status: 403 });
  let body: { key?: unknown } = {};
  try { body = (await req.json()) as typeof body; } catch { /* no key */ }
  const key = typeof body.key === "string" ? body.key : "";
  const stored = await readPlan(prisma);
  if (!stored) return Response.json({ error: "no-plan", message: "Ingen delt plan ennå." }, { status: 404, ...NO_STORE });
  const lane = stored.data.lanes.find((l) => l.key === key);
  if (!lane) return Response.json({ error: "no-lane", message: "Epicen finnes ikke lenger." }, { status: 404, ...NO_STORE });
  const editor = session.user?.name ?? session.user?.email ?? null;
  try {
    const client = lane.adoId ? createAdoClient(await adoAuthFor(session, defaultTokenDeps(prisma))) : null;
    const r = await removeEpic(stored.data, key, client, new Date());
    const c = await commitPlan(prisma, { stored, after: r.plan, editor, note: { source: "bruker" }, extraEvents: r.events });
    if (!c) return Response.json({ error: "contention", message: "Noen andre lagret samtidig. Prøv igjen." }, { status: 409, ...NO_STORE });
    return Response.json({ version: c.version, data: r.plan, removedAdoId: r.removedAdoId, unlinked: r.unlinked, changesetId: c.changesetId }, NO_STORE);
  } catch (e) {
    return adoErrorResponse(e);
  }
}

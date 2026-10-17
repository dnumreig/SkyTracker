import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdoClient } from "@/features/ado/client";
import { adoErrorResponse, NO_STORE } from "@/features/ado/http";
import { refreshSprints } from "@/features/ado/push";
import { readSprintCheck } from "@/features/ado/sprint-check";
import { adoAuthFor, defaultTokenDeps } from "@/features/ado/token";
import { commitPlan, readPlan } from "@/features/timeline/plan-store";

// The Sprint tab's data (R19): a read of ADO on the signed-in person's own token (open bugs and issues, their trend, the next
// sprint's bug budget, the due features' stories), never written there, cached in the plan as `sprintCheck` so the tab and later
// loads draw it without a token. Open to readers, like the sprint ruler (D1); the sprints are refreshed on the way.
// POST (any signed-in person) → { version, data } when it committed · { unchanged: true } without a plan or when someone saved
// first (the next refresh retries) · 401 ado-login when ADO rejects the token.

export async function POST() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const stored = await readPlan(prisma);
  if (!stored) return Response.json({ unchanged: true }, NO_STORE);
  const editor = session.user?.name ?? session.user?.email ?? null;
  try {
    const client = createAdoClient(await adoAuthFor(session, defaultTokenDeps(prisma)));
    const now = new Date();
    const s = await refreshSprints(stored.data, client, now);
    const check = await readSprintCheck(s.plan, client, now);
    const after = { ...s.plan, sprintCheck: check };
    const c = await commitPlan(prisma, { stored, after, editor, note: { source: "ado" } });
    if (!c) return Response.json({ unchanged: true }, NO_STORE);   // someone saved first: the next refresh retries
    return Response.json({ version: c.version, data: after }, NO_STORE);
  } catch (e) {
    return adoErrorResponse(e);
  }
}

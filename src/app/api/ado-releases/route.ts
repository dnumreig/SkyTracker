import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAdoClient } from "@/features/ado/client";
import { adoErrorResponse, NO_STORE } from "@/features/ado/http";
import { refreshReleases } from "@/features/ado/releases";
import { adoAuthFor, defaultTokenDeps } from "@/features/ado/token";
import { commitPlan, readPlan } from "@/features/timeline/plan-store";

// Re-read only the release labels (R11): the page calls it on load when a release's last read is older than six
// hours, so the band, the tempo colour and the burndown stay fresh without anyone pressing «Oppdater fra ADO».
// POST (writers) → { version, data, read: { releases, items } } · { unchanged: true } when there is nothing to read
// or someone saved first (the next load retries). Body { release: key } (R14) reads that release alone: the drawer's button.

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "writer") return Response.json({ error: "read-only" }, { status: 403 });
  let only: string | undefined;   // R14: the release drawer asks for its own release; the six-hour auto-read sends no body
  try { const b = await req.json(); if (b && typeof b.release === "string" && b.release) only = b.release; } catch { /* no body: every release */ }
  const stored = await readPlan(prisma);
  if (!stored || !(stored.data.releases ?? []).length) return Response.json({ unchanged: true }, NO_STORE);
  if (only && !(stored.data.releases ?? []).some((r) => r.key === only)) return Response.json({ unchanged: true }, NO_STORE);
  const editor = session.user?.name ?? session.user?.email ?? null;
  try {
    const client = createAdoClient(await adoAuthFor(session, defaultTokenDeps(prisma)));
    const rr = await refreshReleases(stored.data, client, new Date(), { only });
    const c = await commitPlan(prisma, { stored, after: rr.plan, editor, note: { source: "ado" }, extraEvents: rr.events });
    if (!c) return Response.json({ unchanged: true }, NO_STORE);
    return Response.json({ version: c.version, data: rr.plan, read: rr.read }, NO_STORE);
  } catch (e) {
    return adoErrorResponse(e);
  }
}

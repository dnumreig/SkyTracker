import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NO_STORE } from "@/features/ado/http";
import { cardsToImport, importCards, type OldCard } from "@/features/board/import";
import { commitPlan, readPlan } from "@/features/timeline/plan-store";

// The old card board's cards as features, once (spec R9). POST (writers)
//   { list: true }            → { cards: [{ id, title, similar }] } — the cards not imported yet (gaps left out); `similar` names a feature with the same title
//   { import: true, ids? }    → { version, data, imported, changesetId } — the chosen cards (all when `ids` is left out)

async function oldCards(): Promise<OldCard[]> {
  const cards = await prisma.card.findMany({ include: { column: { select: { title: true, position: true } } }, orderBy: [{ columnId: "asc" }, { position: "asc" }] });
  return cards.map((c) => ({
    id: c.id, title: c.title, description: c.description, taskType: c.taskType, estimateType: c.estimateType, estimateDate: c.estimateDate, estimateWeeks: c.estimateWeeks,
    isGap: c.isGap, tags: c.tags, adoWorkItemId: c.adoWorkItemId, completedAt: c.completedAt, columnTitle: c.column.title, columnPosition: c.column.position, position: c.position,
  }));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "writer") return Response.json({ error: "read-only" }, { status: 403 });
  let body: { list?: boolean; import?: boolean; ids?: unknown } = {};
  try { body = (await req.json()) as typeof body; } catch { /* lists */ }
  const stored = await readPlan(prisma);
  const plan = stored?.data ?? { lanes: [], tasks: [] };
  const cards = await oldCards();
  const todo = cardsToImport(plan, cards);
  if (!body.import) return Response.json({ cards: todo.map((c) => ({ id: c.id, title: c.title, similar: c.similar })) }, NO_STORE);
  if (!stored) return Response.json({ error: "no-plan", message: "Ingen delt plan ennå. Lag en epic eller last inn eksempel-epics først." }, { status: 404, ...NO_STORE });
  if (!todo.length) return Response.json({ error: "nothing", message: "Ingenting å importere: kortene er allerede hentet." }, { status: 400, ...NO_STORE });
  const deps = await prisma.dependency.findMany({ select: { blockerCardId: true, blockedCardId: true } });
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : undefined;
  const r = importCards(stored.data, cards, deps, { now: new Date(), ids });
  if (!r.imported.length) return Response.json({ error: "nothing", message: "Ingen kort valgt." }, { status: 400, ...NO_STORE });
  const editor = session.user?.name ?? session.user?.email ?? null;
  const c = await commitPlan(prisma, { stored, after: r.plan, editor, note: { source: "import" } });
  if (!c) return Response.json({ error: "contention", message: "Noen andre lagret samtidig. Prøv igjen." }, { status: 409, ...NO_STORE });
  return Response.json({ version: c.version, data: r.plan, imported: r.imported, changesetId: c.changesetId }, NO_STORE);
}

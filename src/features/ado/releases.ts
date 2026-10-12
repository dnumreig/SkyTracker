// The release band's ADO read-back (R10 + R11): the bugs and stories carrying a release label (`Custom.Release`), read as
// the signed-in person and never written. The label is set on the items by the dev lead with produktforum and sprint
// planning (GO 12.10: QA never decides what ships when); here it only defines what a release contains. Every read also
// leaves one point per day on the release (the burndown and the tempo) and counts, per sprint the items sit in, the
// open bugs and stories that carry no label at all (what sprint planning still has to stamp).
import type { Plan, ReleaseAdo, ReleaseHistoryPoint, ReleaseItem } from "@/features/timeline/merge";
import type { PlanEvent } from "@/features/timeline/events";
import { currentSprint, dayKey, releaseProgress, releaseQueryUrl, releaseScope, releaseWiql, sprintUnlabelledWiql, RELEASE_HISTORY_MAX } from "@/features/timeline/epic-tools.js";
import type { AdoClient, AdoWorkItem } from "./client";

export { releaseQueryUrl, releaseWiql, sprintUnlabelledWiql };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const leaf = (path: string) => path.split("\\").pop() ?? path;
/** A work item as the release keeps it: enough for the drawer's list, nothing that changes every hour. */
export function releaseItemOf(w: AdoWorkItem): ReleaseItem {
  const who = w.fields["System.AssignedTo"] as { displayName?: string } | string | undefined;
  const assignee = typeof who === "string" ? who : who?.displayName ?? null;
  const iteration = leaf(str(w.fields["System.IterationPath"]));
  return {
    id: w.id,
    type: w.fields["System.WorkItemType"] === "Bug" ? "Bug" : "User Story",
    title: str(w.fields["System.Title"]).slice(0, 200),
    state: str(w.fields["System.State"]) || "New",
    points: Number(w.fields["Microsoft.VSTS.Scheduling.StoryPoints"] ?? 0) || 0,
    assignee: assignee || null,
    ...(iteration ? { iteration } : {}),
  };
}

/** One point per day on the release: the day's last read wins, the latest RELEASE_HISTORY_MAX are kept. */
export function historyWith(history: ReleaseHistoryPoint[] | undefined, point: ReleaseHistoryPoint): ReleaseHistoryPoint[] {
  return [...(history ?? []).filter((h) => h.day !== point.day), point].sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-RELEASE_HISTORY_MAX);
}

export type ReleaseRefreshResult = { plan: Plan; events: PlanEvent[]; read: { releases: number; items: number } };

/** One query per release (plus one per sprint the items sit in); the release keeps the items (bugs first, then by id), the day's
 *  point and the sprint counts; `at` is always the last read, `v` bumps when the data changed, `release.lest` is logged when the items did. */
export async function refreshReleases(plan: Plan, client: Pick<AdoClient, "wiql" | "batch">, now: Date): Promise<ReleaseRefreshResult> {
  const p: Plan = JSON.parse(JSON.stringify(plan));
  const events: PlanEvent[] = [];
  let items = 0;
  const unlabelled = new Map<string, Promise<number>>();   // one query per sprint path, shared by the releases
  const countUnlabelled = (path: string) => {
    let q = unlabelled.get(path);
    if (!q) { q = client.wiql(sprintUnlabelledWiql(path)).then((ids) => ids.length); unlabelled.set(path, q); }
    return q;
  };
  const current = currentSprint(p.sprints?.items, now);
  for (const r of p.releases ?? []) {
    const label = releaseScope(r);
    const ids = await client.wiql(releaseWiql(label));
    const found: AdoWorkItem[] = [];
    for (let i = 0; i < ids.length; i += 200) found.push(...(await client.batch(ids.slice(i, i + 200))));
    const list = found.map(releaseItemOf).sort((a, b) => (a.type === b.type ? a.id - b.id : a.type === "Bug" ? -1 : 1));
    items += list.length;
    const paths = [...new Set([...found.map((w) => str(w.fields["System.IterationPath"])).filter(Boolean), ...(current ? [current.path] : [])])].sort();
    const sprints: { name: string; unlabelled: number }[] = [];
    for (const path of paths) sprints.push({ name: leaf(path), unlabelled: await countUnlabelled(path) });
    const pr = releaseProgress({ ...r, ado: { at: "", label, items: list } });
    const history = historyWith(r.ado?.history, { day: dayKey(now), pointsDone: pr.pointsDone, pointsTotal: pr.pointsTotal, done: pr.done, total: pr.total });
    const next: ReleaseAdo = { at: now.toISOString(), label, items: list, history, ...(sprints.length ? { sprints } : {}) };
    const itemsKey = (a?: ReleaseAdo) => JSON.stringify(a ? { label: a.label, items: a.items } : null);
    const dataKey = (a?: ReleaseAdo) => JSON.stringify(a ? { label: a.label, items: a.items, history: a.history ?? [], sprints: a.sprints ?? [] } : null);
    const itemsChanged = itemsKey(next) !== itemsKey(r.ado), changed = dataKey(next) !== dataKey(r.ado);
    r.ado = next;                                   // `at` is always the last read: the drawer says it, and the page's six-hour rule needs it
    if (changed) r.v = (r.v ?? 0) + 1;              // new items, a new day's point or new sprint counts: the read must win over an older copy of the release
    if (itemsChanged) events.push({ targetType: "release", targetId: r.key, targetLabel: "Release " + r.version, laneKey: null, code: "release.lest", cause: "ado", summary: "Lest fra ADO: " + pr.text, after: { label, items: list.length } });
  }
  return { plan: p, events, read: { releases: (p.releases ?? []).length, items } };
}

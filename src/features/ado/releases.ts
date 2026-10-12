// The release band's ADO read-back (R10): the bugs and stories carrying a release label (`Custom.Release`), read as the
// signed-in person and never written. The label is set on the items by the dev lead with produktforum and sprint
// planning (GO 12.10: QA never decides what ships when); here it only defines what a release contains.
import type { Plan, ReleaseItem } from "@/features/timeline/merge";
import type { PlanEvent } from "@/features/timeline/events";
import { releaseProgress, releaseQueryUrl, releaseScope, releaseWiql } from "@/features/timeline/epic-tools.js";
import type { AdoClient, AdoWorkItem } from "./client";

export { releaseQueryUrl, releaseWiql };

const str = (v: unknown) => (typeof v === "string" ? v : "");
/** A work item as the release keeps it: enough for the drawer's list, nothing that changes every hour. */
export function releaseItemOf(w: AdoWorkItem): ReleaseItem {
  const who = w.fields["System.AssignedTo"] as { displayName?: string } | string | undefined;
  const assignee = typeof who === "string" ? who : who?.displayName ?? null;
  return {
    id: w.id,
    type: w.fields["System.WorkItemType"] === "Bug" ? "Bug" : "User Story",
    title: str(w.fields["System.Title"]).slice(0, 200),
    state: str(w.fields["System.State"]) || "New",
    points: Number(w.fields["Microsoft.VSTS.Scheduling.StoryPoints"] ?? 0) || 0,
    assignee: assignee || null,
  };
}

export type ReleaseRefreshResult = { plan: Plan; events: PlanEvent[]; read: { releases: number; items: number } };

/** One query per release; the release keeps the items (bugs first, then by id) and bumps its version only when the read changed. */
export async function refreshReleases(plan: Plan, client: Pick<AdoClient, "wiql" | "batch">, now: Date): Promise<ReleaseRefreshResult> {
  const p: Plan = JSON.parse(JSON.stringify(plan));
  const events: PlanEvent[] = [];
  let items = 0;
  for (const r of p.releases ?? []) {
    const label = releaseScope(r);
    const ids = await client.wiql(releaseWiql(label));
    const found: AdoWorkItem[] = [];
    for (let i = 0; i < ids.length; i += 200) found.push(...(await client.batch(ids.slice(i, i + 200))));
    const list = found.map(releaseItemOf).sort((a, b) => (a.type === b.type ? a.id - b.id : a.type === "Bug" ? -1 : 1));
    items += list.length;
    const next = { at: now.toISOString(), label, items: list };
    const key = (a?: { label: string; items: ReleaseItem[] }) => JSON.stringify(a ? { label: a.label, items: a.items } : null);
    if (key(next) === key(r.ado)) continue; // the same read as last time: nothing to log, the first read's time stays
    r.ado = next;
    r.v = (r.v ?? 0) + 1;
    events.push({ targetType: "release", targetId: r.key, targetLabel: "Release " + r.version, laneKey: null, code: "release.lest", cause: "ado", summary: "Lest fra ADO: " + releaseProgress(r).text, after: { label, items: list.length } });
  }
  return { plan: p, events, read: { releases: (p.releases ?? []).length, items } };
}

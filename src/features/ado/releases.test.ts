import { describe, expect, it } from "vitest";
import type { AdoClient, AdoWorkItem } from "./client";
import { refreshReleases, releaseQueryUrl, releaseWiql } from "./releases";
import { normalizePlan } from "@/features/timeline/epic-tools.js";
import type { Plan } from "@/features/timeline/merge";

const NOW = new Date("2026-10-12T20:40:00.000Z");
const wi = (id: number, type: string, title: string, state: string, points: number, release: string, assignee?: string): AdoWorkItem => ({
  id,
  fields: {
    "System.WorkItemType": type, "System.Title": title, "System.State": state, "Microsoft.VSTS.Scheduling.StoryPoints": points, "Custom.Release": release,
    ...(assignee ? { "System.AssignedTo": { displayName: assignee, uniqueName: assignee.toLowerCase().replace(/ /g, ".") + "@skytale.no" } } : {}),
  },
});
// Sprint 71 on the evening of 12.10: bugs and stories stamped 2.0.1, one for 2.0.2, one removed
const ITEMS: AdoWorkItem[] = [
  wi(4804, "User Story", "Receipts", "New", 3, "2.0.1"),
  wi(4536, "Bug", "Nav bar", "New", 8, "2.0.1", "Tor Håkon Moen"),
  wi(4817, "User Story", "Otel", "Closed", 3, "2.0.1"),
  wi(4769, "Bug", "Group call drop", "Resolved", 5, "2.0.1"),
  wi(4999, "Bug", "Other", "New", 2, "2.0.2"),
  wi(4998, "Bug", "Removed one", "Removed", 1, "2.0.1"),
];
function fake() {
  const calls: string[] = [];
  const client: Pick<AdoClient, "wiql" | "batch"> = {
    wiql: async (q) => {
      calls.push(q);
      const label = /\[Custom\.Release\] = '([^']*)'/.exec(q)?.[1];
      return ITEMS.filter((w) => w.fields["Custom.Release"] === label && w.fields["System.State"] !== "Removed").map((w) => w.id);
    },
    batch: async (ids) => { calls.push("batch " + ids.join(",")); return ids.map((id) => ITEMS.find((w) => w.id === id)).filter((w): w is AdoWorkItem => !!w); },
  };
  return { client, calls };
}
const plan = (): Plan => normalizePlan({ lanes: [], tasks: [], releases: [
  { key: "r1", v: 1, version: "2.0.1", targetDate: "2026-10-22" },
  { key: "r2", v: 1, version: "2.0.2", targetDate: "2026-11-12" },
] });

describe("refreshReleases (R10)", () => {
  it("reads every bug and story carrying the label, keeps them on the release (bugs first, then by id), bumps its version and logs the read", async () => {
    const { client, calls } = fake();
    const r = await refreshReleases(plan(), client, NOW);
    const a = r.plan.releases![0];
    expect(a.ado).toEqual({ at: NOW.toISOString(), label: "2.0.1", items: [
      { id: 4536, type: "Bug", title: "Nav bar", state: "New", points: 8, assignee: "Tor Håkon Moen" },
      { id: 4769, type: "Bug", title: "Group call drop", state: "Resolved", points: 5, assignee: null },
      { id: 4804, type: "User Story", title: "Receipts", state: "New", points: 3, assignee: null },
      { id: 4817, type: "User Story", title: "Otel", state: "Closed", points: 3, assignee: null },
    ] });
    expect(a.v).toBe(2);
    expect(r.plan.releases![1].ado!.items.map((i) => i.id)).toEqual([4999]);
    expect(r.read).toEqual({ releases: 2, items: 5 });
    expect(r.events.map((e) => [e.code, e.targetType, e.targetId, e.targetLabel, e.cause, e.summary])).toEqual([
      ["release.lest", "release", "r1", "Release 2.0.1", "ado", "Lest fra ADO: 2 bugs, 2 stories · 8/19 SP levert"],
      ["release.lest", "release", "r2", "Release 2.0.2", "ado", "Lest fra ADO: 1 bug, 0 stories · 0/2 SP levert"],
    ]);
    expect(calls.filter((c) => c.startsWith("SELECT")).length).toBe(2);
  });
  it("a second read with nothing changed bumps nothing, logs nothing and keeps the first read's time", async () => {
    const { client } = fake();
    const first = await refreshReleases(plan(), client, NOW);
    const again = await refreshReleases(first.plan, client, new Date("2026-10-13T08:00:00.000Z"));
    expect(again.events).toEqual([]);
    expect(again.plan.releases![0].v).toBe(2);
    expect(again.plan.releases![0].ado!.at).toBe(NOW.toISOString());
  });
  it("the WIQL names the label (quotes doubled), bugs and stories, not Removed; the query URL opens it in ADO", () => {
    expect(releaseWiql("2.0.1+ota.1")).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [Custom.Release] = '2.0.1+ota.1' AND [System.WorkItemType] IN ('Bug', 'User Story') AND [System.State] <> 'Removed' ORDER BY [System.WorkItemType], [System.Id]");
    expect(releaseWiql("it's")).toContain("'it''s'");
    expect(releaseQueryUrl("2.0.1")).toBe("https://dev.azure.com/SkytaleAS/Skytale/_workitems?_a=query&wiql=" + encodeURIComponent(releaseWiql("2.0.1")));
  });
});

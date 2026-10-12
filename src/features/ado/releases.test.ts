import { describe, expect, it } from "vitest";
import type { AdoClient, AdoWorkItem } from "./client";
import { historyWith, refreshReleases, releaseQueryUrl, releaseWiql, sprintUnlabelledWiql } from "./releases";
import { normalizePlan } from "@/features/timeline/epic-tools.js";
import type { Plan } from "@/features/timeline/merge";

const NOW = new Date("2026-10-12T10:40:00.000Z");
const DAY = "2026-10-12";
const S71 = "Skytale\\Sprint 71", S72 = "Skytale\\Sprint 72";
const wi = (id: number, type: string, title: string, state: string, points: number, release: string, path: string | null, assignee?: string): AdoWorkItem => ({
  id,
  fields: {
    "System.WorkItemType": type, "System.Title": title, "System.State": state, "Microsoft.VSTS.Scheduling.StoryPoints": points, "Custom.Release": release,
    ...(path ? { "System.IterationPath": path } : {}),
    ...(assignee ? { "System.AssignedTo": { displayName: assignee, uniqueName: assignee.toLowerCase().replace(/ /g, ".") + "@skytale.no" } } : {}),
  },
});
// Sprint 71 on 12.10: bugs and stories stamped 2.0.1 (one of them in Sprint 72), one for 2.0.2 without a sprint, one removed, two without any label
const ITEMS: AdoWorkItem[] = [
  wi(4804, "User Story", "Receipts", "New", 3, "2.0.1", S71),
  wi(4536, "Bug", "Nav bar", "New", 8, "2.0.1", S71, "Tor Håkon Moen"),
  wi(4817, "User Story", "Otel", "Closed", 3, "2.0.1", S71),
  wi(4769, "Bug", "Group call drop", "Resolved", 5, "2.0.1", S72),
  wi(4999, "Bug", "Other", "New", 2, "2.0.2", null),
  wi(4998, "Bug", "Removed one", "Removed", 1, "2.0.1", S71),
  wi(4777, "Bug", "No label yet", "Active", 2, "", S71),
  wi(4700, "Bug", "Closed, no label", "Closed", 1, "", S71),
];
function fake() {
  const calls: string[] = [];
  const client: Pick<AdoClient, "wiql" | "batch"> = {
    wiql: async (q) => {
      calls.push(q);
      const path = /\[System\.IterationPath\] = '([^']*)'/.exec(q)?.[1];
      if (path) return ITEMS.filter((w) => w.fields["System.IterationPath"] === path && !w.fields["Custom.Release"] && ["Bug", "User Story"].includes(String(w.fields["System.WorkItemType"])) && !["Closed", "Removed"].includes(String(w.fields["System.State"]))).map((w) => w.id);
      const label = /\[Custom\.Release\] = '([^']*)'/.exec(q)?.[1];
      return ITEMS.filter((w) => w.fields["Custom.Release"] === label && w.fields["System.State"] !== "Removed").map((w) => w.id);
    },
    batch: async (ids) => { calls.push("batch " + ids.join(",")); return ids.map((id) => ITEMS.find((w) => w.id === id)).filter((w): w is AdoWorkItem => !!w); },
  };
  return { client, calls };
}
const plan = (): Plan => normalizePlan({ lanes: [], tasks: [], sprints: { at: NOW.toISOString(), items: [{ name: "Sprint 71", path: S71, start: "2026-10-05", finish: "2026-10-23" }] }, releases: [
  { key: "r1", v: 1, version: "2.0.1", targetDate: "2026-10-22" },
  { key: "r2", v: 1, version: "2.0.2", targetDate: "2026-11-12" },
] });

describe("refreshReleases (R10 + R11)", () => {
  it("reads every bug and story carrying the label with its sprint, keeps them on the release (bugs first, then by id), stores the day's point and the sprints' unlabelled counts, bumps the version and logs the read", async () => {
    const { client, calls } = fake();
    const r = await refreshReleases(plan(), client, NOW);
    const a = r.plan.releases![0];
    expect(a.ado).toEqual({ at: NOW.toISOString(), label: "2.0.1", items: [
      { id: 4536, type: "Bug", title: "Nav bar", state: "New", points: 8, assignee: "Tor Håkon Moen", iteration: "Sprint 71" },
      { id: 4769, type: "Bug", title: "Group call drop", state: "Resolved", points: 5, assignee: null, iteration: "Sprint 72" },
      { id: 4804, type: "User Story", title: "Receipts", state: "New", points: 3, assignee: null, iteration: "Sprint 71" },
      { id: 4817, type: "User Story", title: "Otel", state: "Closed", points: 3, assignee: null, iteration: "Sprint 71" },
    ], history: [{ day: DAY, pointsDone: 8, pointsTotal: 19, done: 2, total: 4 }], sprints: [{ name: "Sprint 71", unlabelled: 1 }, { name: "Sprint 72", unlabelled: 0 }] });
    expect(a.v).toBe(2);
    expect(r.plan.releases![1].ado).toEqual({ at: NOW.toISOString(), label: "2.0.2", items: [{ id: 4999, type: "Bug", title: "Other", state: "New", points: 2, assignee: null }], history: [{ day: DAY, pointsDone: 0, pointsTotal: 2, done: 0, total: 1 }], sprints: [{ name: "Sprint 71", unlabelled: 1 }] });
    expect(r.read).toEqual({ releases: 2, items: 5 });
    expect(r.events.map((e) => [e.code, e.targetType, e.targetId, e.targetLabel, e.cause, e.summary])).toEqual([
      ["release.lest", "release", "r1", "Release 2.0.1", "ado", "Lest fra ADO: 2 bugs, 2 stories · 8/19 SP levert"],
      ["release.lest", "release", "r2", "Release 2.0.2", "ado", "Lest fra ADO: 1 bug, 0 stories · 0/2 SP levert"],
    ]);
    expect(calls.filter((c) => c.startsWith("SELECT")).length).toBe(4);   // two labels, two sprint paths (the current sprint's count is shared by both releases)
  });
  it("a second read the same day with nothing changed bumps nothing and logs nothing but moves the read time; a new day adds a point and bumps", async () => {
    const { client } = fake();
    const first = await refreshReleases(plan(), client, NOW);
    const later = new Date("2026-10-12T15:00:00.000Z");
    const again = await refreshReleases(first.plan, client, later);
    expect(again.events).toEqual([]);
    expect(again.plan.releases![0].v).toBe(2);
    expect(again.plan.releases![0].ado!.at).toBe(later.toISOString());
    expect(again.plan.releases![0].ado!.history!.length).toBe(1);
    const nextDay = await refreshReleases(again.plan, client, new Date("2026-10-13T08:00:00.000Z"));
    expect(nextDay.events).toEqual([]);
    expect(nextDay.plan.releases![0].v).toBe(3);
    expect(nextDay.plan.releases![0].ado!.history!.map((h) => h.day)).toEqual([DAY, "2026-10-13"]);
  });
  it("the WIQL names the label (quotes doubled), bugs and stories, not Removed; the sprint query asks for open items without any label; the query URL opens it in ADO", () => {
    expect(releaseWiql("2.0.1+ota.1")).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [Custom.Release] = '2.0.1+ota.1' AND [System.WorkItemType] IN ('Bug', 'User Story') AND [System.State] <> 'Removed' ORDER BY [System.WorkItemType], [System.Id]");
    expect(releaseWiql("it's")).toContain("'it''s'");
    expect(sprintUnlabelledWiql("Skytale\\Sprint 71")).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.IterationPath] = 'Skytale\\Sprint 71' AND [Custom.Release] = '' AND [System.WorkItemType] IN ('Bug', 'User Story') AND [System.State] NOT IN ('Closed', 'Removed')");
    expect(releaseQueryUrl("2.0.1")).toBe("https://dev.azure.com/SkytaleAS/Skytale/_workitems?_a=query&wiql=" + encodeURIComponent(releaseWiql("2.0.1")));
  });
  it("historyWith replaces the same day, keeps the days sorted and the latest 120", () => {
    const pt = (day: string, pointsDone: number) => ({ day, pointsDone, pointsTotal: 79, done: 0, total: 0 });
    expect(historyWith([pt("2026-10-12", 4), pt("2026-10-09", 2)], pt("2026-10-12", 10))).toEqual([pt("2026-10-09", 2), pt("2026-10-12", 10)]);
    expect(historyWith(undefined, pt("2026-10-12", 1))).toEqual([pt("2026-10-12", 1)]);
    const many = Array.from({ length: 125 }, (_, i) => pt("2026-" + String(1 + Math.floor(i / 28)).padStart(2, "0") + "-" + String(1 + (i % 28)).padStart(2, "0"), i));
    const h = historyWith(many, pt("2026-12-31", 0));
    expect(h.length).toBe(120);
    expect(h[h.length - 1].day).toBe("2026-12-31");
  });
});

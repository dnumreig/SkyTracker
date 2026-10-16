import { describe, expect, it } from "vitest";
import type { AdoCapacity, AdoClient, AdoWorkItem } from "./client";
import { AdoRequestError } from "./client";
import { historyWith, refreshReleases, releaseItemOf, releaseQueryUrl, releaseWiql, sprintUnlabelledWiql } from "./releases";
import { normalizePlan } from "@/features/timeline/epic-tools.js";
import type { Plan } from "@/features/timeline/merge";

const NOW = new Date("2026-10-12T10:40:00.000Z");
const DAY = "2026-10-12";
const S71 = "Skytale\\Sprint 71", S72 = "Skytale\\Sprint 72";
const wi = (id: number, type: string, title: string, state: string, points: number, release: string, path: string | null, assignee?: string, dates: Record<string, string> = {}): AdoWorkItem => ({
  id,
  fields: {
    ...dates,
    "System.WorkItemType": type, "System.Title": title, "System.State": state, "Microsoft.VSTS.Scheduling.StoryPoints": points, "Custom.Release": release,
    ...(path ? { "System.IterationPath": path } : {}),
    ...(assignee ? { "System.AssignedTo": { displayName: assignee, uniqueName: assignee.toLowerCase().replace(/ /g, ".") + "@skytale.no" } } : {}),
  },
});
// Sprint 71 on 12.10: bugs and stories stamped 2.0.1 (one of them in Sprint 72), one for 2.0.2 without a sprint, one removed, two without any label
const ITEMS: AdoWorkItem[] = [
  wi(4804, "User Story", "Receipts", "New", 3, "2.0.1", S71),
  wi(4536, "Bug", "Nav bar", "New", 8, "2.0.1", S71, "Tor Håkon Moen"),
  wi(4817, "User Story", "Otel", "Closed", 3, "2.0.1", S71, undefined, { "Microsoft.VSTS.Common.ResolvedDate": "2026-10-09T13:00:00Z", "Microsoft.VSTS.Common.ClosedDate": "2026-10-12T09:00:00Z" }),
  wi(4769, "Bug", "Group call drop", "Resolved", 5, "2.0.1", S72, undefined, { "Microsoft.VSTS.Common.ResolvedDate": "2026-10-11T08:00:00Z" }),
  wi(4999, "Bug", "Other", "New", 2, "2.0.2", null),
  wi(4998, "Bug", "Removed one", "Removed", 1, "2.0.1", S71),
  wi(4777, "Bug", "No label yet", "Active", 2, "", S71),
  wi(4700, "Bug", "Closed, no label", "Closed", 1, "", S71),
];
// R12: Sprint 70 finished with GO resolving 2 points every working day; Sprint 71's Capacity is whatever the test passes
const PAST: AdoWorkItem[] = [];
for (const c = new Date("2026-09-21T12:00:00Z"); c.toISOString() < "2026-10-03"; c.setUTCDate(c.getUTCDate() + 1)) {
  if (c.getUTCDay() % 6) PAST.push({ id: 9000 + PAST.length, fields: { "System.WorkItemType": "Bug", "System.State": "Closed", "Microsoft.VSTS.Scheduling.StoryPoints": 2, "Microsoft.VSTS.Common.ResolvedDate": c.toISOString(), "Microsoft.VSTS.Common.ResolvedReason": "Fixed", "System.AssignedTo": { displayName: "Gjermund Østby", uniqueName: "GO@Skytale.no" } } });
}
const GO_FULL: AdoCapacity = { teamMember: { displayName: "Gjermund Østby", uniqueName: "GO@Skytale.no" }, activities: [{ name: "Development", capacityPerDay: 7.5 }], daysOff: [] };
// R18: the process's own states and their categories, and two items in them
const STATES_OF: Record<string, { name: string; category: string }[]> = {
  Bug: [{ name: "New", category: "Proposed" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }, { name: "Removed", category: "Removed" }],
  "User Story": [{ name: "New", category: "Proposed" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }],
};
const R18_ITEMS: AdoWorkItem[] = [
  wi(4870, "User Story", "Merged", "Develop", 2, "2.0.1", S71, undefined, { "Microsoft.VSTS.Common.ResolvedDate": "2026-10-10T12:00:00Z" }),
  wi(4871, "Bug", "In review", "Codereview", 1, "2.0.1", S71),
];
function fake(capacity: AdoCapacity[] = [], failCapacity?: Error, opts: { extra?: AdoWorkItem[]; states?: Record<string, { name: string; category: string }[]> } = {}) {
  const calls: string[] = [];
  const items = [...ITEMS, ...(opts.extra ?? [])];
  const client: Pick<AdoClient, "wiql" | "batch" | "capacities" | "iterations" | "states"> = {
    states: async (t) => opts.states?.[t] ?? [],
    capacities: async (id) => { calls.push("capacities " + id); if (failCapacity) throw failCapacity; return { members: id === "s71" ? capacity : [], teamDaysOff: [] }; },
    iterations: async () => { calls.push("iterations"); return { name: "Skytale", children: [
      { name: "Sprint 70", identifier: "s70", attributes: { startDate: "2026-09-21T00:00:00Z", finishDate: "2026-10-02T00:00:00Z" } },
      { name: "Sprint 71", identifier: "s71", attributes: { startDate: "2026-10-05T00:00:00Z", finishDate: "2026-10-23T00:00:00Z" } },
    ] }; },
    wiql: async (q) => {
      calls.push(q);
      if (/ResolvedDate/.test(q)) return PAST.map((w) => w.id);
      const path = /\[System\.IterationPath\] = '([^']*)'/.exec(q)?.[1];
      if (path) return items.filter((w) => w.fields["System.IterationPath"] === path && !w.fields["Custom.Release"] && ["Bug", "User Story"].includes(String(w.fields["System.WorkItemType"])) && !["Closed", "Removed"].includes(String(w.fields["System.State"]))).map((w) => w.id);
      const label = /\[Custom\.Release\] = '([^']*)'/.exec(q)?.[1];
      return items.filter((w) => w.fields["Custom.Release"] === label && w.fields["System.State"] !== "Removed").map((w) => w.id);
    },
    batch: async (ids) => { calls.push("batch " + ids.join(",")); return ids.map((id) => items.find((w) => w.id === id) ?? PAST.find((w) => w.id === id)).filter((w): w is AdoWorkItem => !!w); },
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
      { id: 4769, type: "Bug", title: "Group call drop", state: "Resolved", points: 5, assignee: null, iteration: "Sprint 72", delivered: "2026-10-11" },
      { id: 4804, type: "User Story", title: "Receipts", state: "New", points: 3, assignee: null, iteration: "Sprint 71" },
      { id: 4817, type: "User Story", title: "Otel", state: "Closed", points: 3, assignee: null, iteration: "Sprint 71", delivered: "2026-10-09", closed: "2026-10-12" },   // delivered is the resolved day, when the work was done; closed is the closed day (R18)
    ], history: [{ day: DAY, pointsDone: 8, pointsTotal: 19, done: 2, total: 4, closedPoints: 3, closed: 1 }], sprints: [{ name: "Sprint 71", unlabelled: 1 }, { name: "Sprint 72", unlabelled: 0 }],
      forecast: { day: DAY, missing: "capacity", sprints: ["Sprint 71"], unplanned: 0 } });   // R12: Sprint 71 has no Capacity in this fake
    expect(a.v).toBe(2);
    expect(r.plan.releases![1].ado).toEqual({ at: NOW.toISOString(), label: "2.0.2", items: [{ id: 4999, type: "Bug", title: "Other", state: "New", points: 2, assignee: null }], history: [{ day: DAY, pointsDone: 0, pointsTotal: 2, done: 0, total: 1, closedPoints: 0, closed: 0 }], sprints: [{ name: "Sprint 71", unlabelled: 1 }],
      forecast: { day: DAY, missing: "capacity", sprints: ["Sprint 71"], unplanned: 13 } });   // 26.10–11.11 lies in no sprint
    expect(r.read).toEqual({ releases: 2, items: 5 });
    expect(r.events.map((e) => [e.code, e.targetType, e.targetId, e.targetLabel, e.cause, e.summary])).toEqual([
      ["release.lest", "release", "r1", "Release 2.0.1", "ado", "Lest fra ADO: 2 bugs, 2 stories · 8/19 SP utviklet"],
      ["release.lest", "release", "r2", "Release 2.0.2", "ado", "Lest fra ADO: 1 bug, 0 stories · 0/2 SP utviklet"],
    ]);
    expect(calls.filter((c) => c.startsWith("SELECT")).length).toBe(4);   // two labels, two sprint paths (the current sprint's count is shared by both releases)
  });
  it("R14: asked for one release, it reads that one and leaves the other untouched", async () => {
    const { client, calls } = fake();
    const r = await refreshReleases(plan(), client, NOW, { only: "r2" });
    expect(r.plan.releases![0].ado).toBeUndefined();
    expect(r.plan.releases![0].v).toBe(1);
    expect(r.plan.releases![1].ado?.items.map((i) => i.id)).toEqual([4999]);
    expect(calls.filter((c) => /\[Custom\.Release\] = '2\.0\.1'/.test(c))).toEqual([]);
    expect(r.read).toEqual({ releases: 1, items: 1 });
    expect(r.events.map((e) => e.targetId)).toEqual(["r2"]);
  });

  it("R12: with Capacity the release keeps the chance it is done by its target day, and the day's point keeps the chance and the mean", async () => {
    const { client, calls } = fake([GO_FULL]);
    const r = await refreshReleases(plan(), client, NOW);
    const a = r.plan.releases![0].ado!;   // 11 SP left; GO does 2 a day and has eight days (12.–21.10)
    expect(a.forecast).toEqual({ day: DAY, need: 11, days: 8, p: 1, mean: 16, p10: 16, p90: 16, people: [{ name: "Gjermund Østby", days: 8, pace: 2, expected: 16 }], basis: ["Sprint 70"], capacity: ["Sprint 71"] });
    expect(a.history).toEqual([{ day: DAY, pointsDone: 8, pointsTotal: 19, done: 2, total: 4, closedPoints: 3, closed: 1, forecast: { p: 1, mean: 16 } }]);
    expect(calls.filter((c) => /ResolvedDate/.test(c)).length).toBe(1);   // the past is read once for both releases
    const again = await refreshReleases(r.plan, client, new Date("2026-10-12T15:00:00.000Z"));
    expect(again.plan.releases![0].v).toBe(r.plan.releases![0].v);   // the same data gives the same number: nothing to bump
  });
  it("R12: a failing Capacity read leaves the release read intact, without a forecast; a rejected token still stops it", async () => {
    const r = await refreshReleases(plan(), fake([GO_FULL], new AdoRequestError(403, "no access to the team")).client, NOW);
    expect(r.plan.releases![0].ado!.items.length).toBe(4);
    expect(r.plan.releases![0].ado!).not.toHaveProperty("forecast");
    await expect(refreshReleases(plan(), fake([GO_FULL], new AdoRequestError(401, "token")).client, NOW)).rejects.toMatchObject({ status: 401 });
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
  it("releaseItemOf: delivered is the resolved day, the closed day for an item closed without resolving, nothing while open", () => {
    const closedOnly = wi(1, "Bug", "Cut", "Closed", 2, "2.0.1", S71, undefined, { "Microsoft.VSTS.Common.ClosedDate": "2026-10-08T10:00:00Z" });
    expect(releaseItemOf(closedOnly).delivered).toBe("2026-10-08");
    const reopened = wi(2, "Bug", "Reopened", "Active", 2, "2.0.1", S71, undefined, { "Microsoft.VSTS.Common.ResolvedDate": "2026-10-08T10:00:00Z" });
    expect(releaseItemOf(reopened)).not.toHaveProperty("delivered");
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
  it("R18: a story in Develop or QA counts as developed by its category, with the resolved day; Closed is closed with its closed day", async () => {
    const { client } = fake([], undefined, { extra: R18_ITEMS, states: STATES_OF });
    const p = (await refreshReleases(plan(), client, NOW)).plan;
    const items = p.releases!.find((r) => r.key === "r1")!.ado!.items;
    expect(items.find((i) => i.id === 4870)).toMatchObject({ state: "Develop", category: "Resolved", delivered: "2026-10-10" });
    expect(items.find((i) => i.id === 4871)).toMatchObject({ state: "Codereview", category: "InProgress" });
    expect(items.find((i) => i.id === 4871)!.delivered).toBeUndefined();
    expect(items.find((i) => i.id === 4817)).toMatchObject({ category: "Completed", closed: "2026-10-12" });
  });
  it("R18: when the states call fails the release is still read by the names, and says so", async () => {
    const { client } = fake([], undefined, { states: STATES_OF });
    const p = (await refreshReleases(plan(), { ...client, states: async () => { throw new Error("no access"); } }, NOW)).plan;
    expect(p.releases![0].ado!.statesMissing).toBe(true);
    expect(p.releases![0].ado!.items.every((i) => i.category === undefined)).toBe(true);
  });
});

describe("the day of a reading is the Oslo day (minor after R16)", () => {
  it("a read at 22:30 UTC lands on the next calendar day in Oslo, on the history point and the forecast", async () => {
    const r = await refreshReleases(plan(), fake().client, new Date("2026-10-12T22:30:00.000Z"));
    const ado = r.plan.releases![0].ado!;
    expect(ado.history![0].day).toBe("2026-10-13");
    expect(ado.forecast!.day).toBe("2026-10-13");
  });
});

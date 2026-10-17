import { describe, expect, it } from "vitest";
import type { AdoCapacity, AdoClient, AdoWorkItem, IterationNode } from "./client";
import { AdoRequestError } from "./client";
import { ADO_CHILD_REL, ADO_PARENT_REL, adoWorkItemApiUrl } from "./config";
import { isClosed, isOpen, openWiql, readSprintCheck, severityOf, trendWiql } from "./sprint-check";
import type { StateCategory, StateMap } from "./states";
import { dayToUnit, normalizePlan } from "@/features/timeline/epic-tools.js";
import type { Plan, Sprint } from "@/features/timeline/merge";

const NOW = new Date("2026-10-16T08:00:00Z");   // Sprint 71, day 5
const S = (n: number) => "Skytale\\Sprint " + n;
// Sprints 66–72, two weeks each; Sprint 66 is the fifth-last finished one and falls outside the trend
const SPRINTS: [number, string, string][] = [
  [66, "2026-08-03", "2026-08-14"], [67, "2026-08-17", "2026-08-28"], [68, "2026-08-31", "2026-09-11"], [69, "2026-09-14", "2026-09-25"],
  [70, "2026-09-28", "2026-10-09"], [71, "2026-10-12", "2026-10-23"], [72, "2026-10-26", "2026-11-06"],
];
const ITERATIONS: IterationNode = { name: "Skytale", children: SPRINTS.map(([n, start, finish]) => ({ name: "Sprint " + n, identifier: "s" + n, attributes: { startDate: start + "T00:00:00Z", finishDate: finish + "T00:00:00Z" } })) };
const SPRINT_ITEMS: Sprint[] = SPRINTS.map(([n, start, finish]) => ({ name: "Sprint " + n, path: S(n), start, finish, id: "s" + n }));

// ADO's states and their categories, per type (R18)
const STATES_OF: Record<string, { name: string; category: StateCategory }[]> = {
  Bug: [{ name: "New", category: "Proposed" }, { name: "Active", category: "InProgress" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }, { name: "Removed", category: "Removed" }],
  Issue: [{ name: "New", category: "Proposed" }, { name: "Active", category: "InProgress" }, { name: "Closed", category: "Completed" }],
  "User Story": [{ name: "New", category: "Proposed" }, { name: "Active", category: "InProgress" }, { name: "Resolved", category: "InProgress" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }, { name: "Removed", category: "Removed" }],
};
const MAP: StateMap = new Map(Object.entries(STATES_OF).flatMap(([type, list]) => list.map((s): [string, StateCategory] => [type + "/" + s.name, s.category])));

type Over = { severity?: string; release?: string; path?: string; points?: number; created?: string; closed?: string };
const stamp = (day: string) => day + "T09:00:00Z";
const wi = (id: number, type: string, state: string, o: Over = {}): AdoWorkItem => ({
  id,
  fields: {
    "System.WorkItemType": type, "System.State": state,
    ...(o.severity ? { "Microsoft.VSTS.Common.Severity": o.severity } : {}),
    ...(o.release !== undefined ? { "Custom.Release": o.release } : {}),
    ...(o.path ? { "System.IterationPath": o.path } : {}),
    ...(o.points !== undefined ? { "Microsoft.VSTS.Scheduling.StoryPoints": o.points } : {}),
    ...(o.created ? { "System.CreatedDate": stamp(o.created) } : {}),
    ...(o.closed ? { "Microsoft.VSTS.Common.ClosedDate": stamp(o.closed) } : {}),
  },
});
// the open bugs and issues today
const OPEN: AdoWorkItem[] = [
  wi(1, "Bug", "New", { severity: "1 - Critical", release: "2.0.1", path: S(72), points: 3, created: "2026-10-01" }),
  wi(2, "Bug", "QA", { severity: "2 - High", release: "2.0.1", path: S(71), points: 2, created: "2026-09-15" }),
  wi(3, "Bug", "Active", { severity: "3 - Medium", release: "", path: S(72), points: 5, created: "2026-07-01" }),
  wi(4, "Bug", "Codereview", { release: "2.0.2", path: S(71), points: 0, created: "2026-07-02" }),
  wi(5, "Issue", "Active", { created: "2026-07-03" }),
  wi(6, "Issue", "New", { created: "2026-07-04" }),
];
// created or closed since Sprint 67's start: the open ones created since then, and these
const TREND_ONLY: AdoWorkItem[] = [
  wi(10, "Bug", "Closed", { points: 2, created: "2026-08-20", closed: "2026-09-02" }),
  wi(11, "Bug", "Closed", { points: 3, created: "2026-09-01", closed: "2026-10-14" }),
  wi(12, "Bug", "Closed", { points: 0, created: "2026-09-30", closed: "2026-10-07" }),
  wi(13, "Bug", "Removed", { created: "2026-09-16" }),
  wi(20, "Issue", "Closed", { created: "2026-10-02", closed: "2026-10-05" }),
];
const TREND: AdoWorkItem[] = [...OPEN.filter((w) => String(w.fields["System.CreatedDate"]) >= "2026-08-17"), ...TREND_ONLY];
// the pace: GO resolved 2 points every working day of Sprint 70
const GO = { displayName: "Gjermund Østby", uniqueName: "GO@Skytale.no" };
const PACE: AdoWorkItem[] = [];
for (const c = new Date("2026-09-28T12:00:00Z"); c.toISOString() < "2026-10-10"; c.setUTCDate(c.getUTCDate() + 1)) {
  if (c.getUTCDay() % 6) PACE.push({ id: 9000 + PACE.length, fields: { "System.WorkItemType": "Bug", "System.State": "Closed", "Microsoft.VSTS.Scheduling.StoryPoints": 2, "Microsoft.VSTS.Common.ResolvedDate": c.toISOString(), "Microsoft.VSTS.Common.ResolvedReason": "Fixed", "System.AssignedTo": GO } });
}
const GO_FULL: AdoCapacity = { teamMember: GO, activities: [{ name: "Development", capacityPerDay: 7.5 }], daysOff: [] };
// the due feature in ADO: six children, the discovery story and a parent link
const link = (rel: string, id: number) => ({ rel, url: adoWorkItemApiUrl(id) });
const FEATURE: AdoWorkItem = { id: 500, fields: { "System.WorkItemType": "Feature", "System.State": "Active" }, relations: [...[501, 502, 503, 504, 505, 506, 599].map((id) => link(ADO_CHILD_REL, id)), link(ADO_PARENT_REL, 400)] };
const CHILDREN: AdoWorkItem[] = [
  wi(501, "User Story", "Active", { path: S(72), points: 3 }),
  wi(502, "User Story", "New", { path: S(71), points: 2 }),
  wi(503, "User Story", "Develop", { path: S(72), points: 5 }),
  wi(504, "Bug", "Active", { path: S(72) }),
  wi(505, "User Story", "Removed", { path: S(72) }),
  wi(506, "User Story", "New", { path: "Skytale\\Backlog", points: 1 }),
  wi(599, "User Story", "Active", { path: S(72) }),
];

type FakeOpts = { capacity?: AdoCapacity[]; capacityError?: Error; pace?: AdoWorkItem[]; statesError?: Error; wiqlError?: Error };
function fake(o: FakeOpts = {}) {
  const queries: string[] = [];
  const batches: number[][] = [];
  const pace = o.pace ?? PACE;
  const all = [...OPEN, ...TREND_ONLY, ...pace, FEATURE, ...CHILDREN];
  const client: Pick<AdoClient, "wiql" | "batch" | "capacities" | "iterations" | "states"> = {
    iterations: async () => ITERATIONS,
    states: async (type) => { if (o.statesError) throw o.statesError; return STATES_OF[type] ?? []; },
    wiql: async (q) => {
      queries.push(q);
      if (o.wiqlError) throw o.wiqlError;
      if (/\[System\.State\] (NOT )?IN/.test(q)) return OPEN.map((w) => w.id);
      if (/CreatedDate/.test(q)) return TREND.map((w) => w.id);
      if (/ResolvedDate/.test(q)) return pace.map((w) => w.id);
      return [];
    },
    batch: async (ids) => { batches.push([...ids]); return ids.map((id) => all.find((w) => w.id === id)).filter((w): w is AdoWorkItem => !!w); },
    capacities: async (id) => { if (o.capacityError) throw o.capacityError; return { members: id === "s72" ? o.capacity ?? [GO_FULL] : [], teamDaysOff: [] }; },
  };
  return { client, queries, batches };
}

const PLAN: Plan = normalizePlan({
  lanes: [{ key: "a", name: "Epic A" }],
  sprints: { at: NOW.toISOString(), items: SPRINT_ITEMS },
  tasks: [{ id: "F", lane: "a", label: "Feature F", kind: "estimate", state: "aktiv", adoId: 500, start: dayToUnit("2026-10-26"), endLikely: dayToUnit("2026-11-23"), end: dayToUnit("2026-12-07"), deps: [], fv: {}, ado: { storyId: 599, pushedAt: "x", snapshot: {} } }],
});

describe("the Sprint tab's read of ADO (R19)", () => {
  it("openWiql and trendWiql", () => {
    expect(openWiql(MAP)).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Bug', 'Issue') AND [System.State] IN ('Active', 'Codereview', 'Develop', 'New', 'QA')");
    expect(openWiql(null)).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Bug', 'Issue') AND [System.State] NOT IN ('Closed', 'Removed')");
    expect(trendWiql("2026-08-17")).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Bug', 'Issue') AND ([System.CreatedDate] >= '2026-08-17' OR [Microsoft.VSTS.Common.ClosedDate] >= '2026-08-17')");
  });
  it("openWiql falls back to the names when the map knows no states of Bug or Issue", () => {
    expect(openWiql(new Map([["Bug/New", "Proposed"]]))).toBe(openWiql(null));
  });
  it("severityOf, isOpen and isClosed", () => {
    expect(["1 - Critical", "2 - High", "3 - Medium", "4 - Low", "", undefined].map(severityOf)).toEqual(["A", "B", "C", "D", "none", "none"]);
    expect(isOpen(MAP, "Bug", "QA")).toBe(true);
    expect(isOpen(MAP, "Bug", "Closed")).toBe(false);
    expect(isOpen(null, "Bug", "QA")).toBe(true);
    expect(isClosed(null, "Issue", "Closed")).toBe(true);
  });
  it("reads the open bugs and issues by category, severity, label and the next sprint", async () => {
    const c = await readSprintCheck(PLAN, fake().client, NOW);
    expect(c).toMatchObject({ current: "Sprint 71", next: "Sprint 72", at: NOW.toISOString() });
    expect(c.bugs).toEqual({ open: 4, A: 1, B: 1, C: 1, D: 0, none: 1, inRelease: { "2.0.1": 2, "2.0.2": 1 }, inNext: 2, inNextPoints: 8, closedCurrent: 1 });
    expect(c.issues).toEqual({ open: 2 });
    expect("statesMissing" in c).toBe(false);
  });
  it("reconstructs the open counts at the end of the last four finished sprints", async () => {
    const f = fake(); const c = await readSprintCheck(PLAN, f.client, NOW);
    expect(f.queries).toContain(trendWiql("2026-08-17"));   // Sprint 67's start: Sprint 66 is not among the last four
    expect(c.sprints).toEqual([
      { name: "Sprint 67", end: "2026-08-28", openBugs: 3, openIssues: 2, created: 1, closed: 0, closedPoints: 0 },
      { name: "Sprint 68", end: "2026-09-11", openBugs: 3, openIssues: 2, created: 1, closed: 1, closedPoints: 2 },
      { name: "Sprint 69", end: "2026-09-25", openBugs: 4, openIssues: 2, created: 1, closed: 0, closedPoints: 0 },
      { name: "Sprint 70", end: "2026-10-09", openBugs: 5, openIssues: 2, created: 2, closed: 1, closedPoints: 0 },
    ]);
  });
  it("the budget: the next sprint's expected points from Capacity and pace, or what is missing", async () => {
    expect((await readSprintCheck(PLAN, fake().client, NOW)).budget).toEqual({ points: 10, share: 0.45 });
    expect((await readSprintCheck(PLAN, fake({ capacity: [] }).client, NOW)).budget).toEqual({ points: null, share: 0.45, missing: "capacity" });
    expect((await readSprintCheck(PLAN, fake({ pace: [] }).client, NOW)).budget).toEqual({ points: null, share: 0.45, missing: "history" });
    expect((await readSprintCheck(PLAN, fake({ capacityError: new AdoRequestError(403, "no") }).client, NOW)).budget.missing).toBe("capacity");
  });
  it("only live user stories count, the discovery story and the parent link left out", async () => {
    const f = fake(); const c = await readSprintCheck(PLAN, f.client, NOW);
    expect(c.features).toEqual({ F: { stories: 4, open: 3, inNext: 1, inNextPoints: 3, inCurrent: 1 } });
    expect(f.batches).toContainEqual([500]);
    expect(f.batches.flat()).not.toContain(599);   // the discovery story is not asked for
    expect(f.batches.flat()).not.toContain(400);   // nor the parent
  });
  it("without ADO's states, counts by the names and says so", async () => {
    const f = fake({ statesError: new AdoRequestError(500, "down") }); const c = await readSprintCheck(PLAN, f.client, NOW);
    expect(c.statesMissing).toBe(true);
    expect(f.queries).toContain(openWiql(null));
    expect(c.bugs.open).toBe(4);
  });
  it("a rejected token stops the read", async () => {
    await expect(readSprintCheck(PLAN, fake({ wiqlError: new AdoRequestError(401, "token") }).client, NOW)).rejects.toMatchObject({ status: 401 });
    await expect(readSprintCheck(PLAN, fake({ capacityError: new AdoRequestError(401, "token") }).client, NOW)).rejects.toMatchObject({ status: 401 });
  });
  it("reads ADO's sprints when the cached ones lack identifiers, and the plan is left as it was", async () => {
    const before = normalizePlan({ ...structuredClone(PLAN), sprints: { at: NOW.toISOString(), items: SPRINT_ITEMS.map((s) => ({ name: s.name, path: s.path, start: s.start, finish: s.finish })) } });
    const copy = structuredClone(before);
    const c = await readSprintCheck(before, fake().client, NOW);
    expect(c.budget).toEqual({ points: 10, share: 0.45 });   // Sprint 72's Capacity found by the identifier ADO gave
    expect(before).toEqual(copy);
  });
});

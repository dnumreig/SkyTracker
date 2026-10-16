import { describe, expect, it } from "vitest";
import type { AdoCapacity, AdoClient, AdoWorkItem, IterationNode } from "./client";
import { availabilityFrom, forecastWindow, pacePool, paceWiql, readForecast, simulate } from "./forecast";
import { readStateMap } from "./states";
import { normalizePlan, workDays } from "@/features/timeline/epic-tools.js";
import type { Plan, ReleaseItem, Sprint } from "@/features/timeline/merge";

const S68: Sprint = { name: "Sprint 68", path: "Skytale\\Sprint 68", start: "2026-08-24", finish: "2026-09-04", id: "s68" };
const S69: Sprint = { name: "Sprint 69", path: "Skytale\\Sprint 69", start: "2026-09-07", finish: "2026-09-18", id: "s69" };
const S70: Sprint = { name: "Sprint 70", path: "Skytale\\Sprint 70", start: "2026-09-21", finish: "2026-10-02", id: "s70" };
const S71: Sprint = { name: "Sprint 71", path: "Skytale\\Sprint 71", start: "2026-10-05", finish: "2026-10-23", id: "s71" };
const S72: Sprint = { name: "Sprint 72", path: "Skytale\\Sprint 72", start: "2026-10-26", finish: "2026-11-06", id: "s72" };
const GO = ["Gjermund Østby", "GO@Skytale.no"] as const, THM = ["Tor Håkon Moen", "thm@skytale.no"] as const, KSO = ["Kristoffer Scherman Olsen", "kso@skytale.no"] as const;
const member = (who: readonly [string, string], activities: [string, number][], daysOff: [string, string][] = []): AdoCapacity => ({
  teamMember: { displayName: who[0], uniqueName: who[1] },
  activities: activities.map(([name, capacityPerDay]) => ({ name, capacityPerDay })),
  daysOff: daysOff.map(([s, e]) => ({ start: s + "T00:00:00Z", end: e + "T00:00:00Z" })),
});
const WINDOW = ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-19", "2026-10-20", "2026-10-21"];

describe("forecastWindow", () => {
  it("the working days from today through the day before the target (the target day is the hand-over)", () => {
    expect(forecastWindow("2026-10-13", "2026-10-22")).toEqual(WINDOW);
    expect(forecastWindow("2026-10-11", "2026-10-14")).toEqual(["2026-10-12", "2026-10-13"]);   // from a Sunday
    expect(forecastWindow("2026-10-22", "2026-10-22")).toEqual([]);
    expect(forecastWindow("2026-10-23", "2026-10-22")).toEqual([]);
  });
});

describe("availabilityFrom", () => {
  it("each person's share of each day: Development (or unnamed) hours / 7.5, at most a whole day, nothing on their days off; Testing and Deployment deliver no points", () => {
    const a = availabilityFrom([{ sprint: S71, members: [
      member(GO, [["Development", 7.5]], [["2026-10-14", "2026-10-15"]]),
      member(THM, [["Development", 3.75], ["Design", 2]]),
      member(KSO, [["", 9]]),
      member(["Lars Berglund", "LB@Skytale.no"], [["Deployment", 4]]),
      member(["Christian Aasen", "ca@skytale.no"], [["Testing", 7]]),
    ], teamDaysOff: [] }], WINDOW);
    expect(a.missing).toEqual([]);
    expect(a.unplanned).toBe(0);
    expect(a.people.get("go@skytale.no")).toEqual({ name: "Gjermund Østby", shares: [1, 0, 0, 1, 1, 1, 1] });
    expect(a.people.get("thm@skytale.no")!.shares).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(a.people.get("kso@skytale.no")!.shares).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect([...a.people.keys()].sort()).toEqual(["go@skytale.no", "kso@skytale.no", "thm@skytale.no"]);
  });
  it("the team's days off take everyone; each day takes its own sprint's capacity", () => {
    const w = forecastWindow("2026-10-22", "2026-10-28");   // Thu 22, Fri 23 (Sprint 71), Mon 26, Tue 27 (Sprint 72)
    const a = availabilityFrom([
      { sprint: S71, members: [member(GO, [["Development", 7.5]])], teamDaysOff: [{ start: "2026-10-23T00:00:00Z", end: "2026-10-23T00:00:00Z" }] },
      { sprint: S72, members: [member(GO, [["Development", 3.75]]), member(THM, [["Development", 7.5]])], teamDaysOff: [] },
    ], w);
    expect(a.people.get("go@skytale.no")!.shares).toEqual([1, 0, 0.5, 0.5]);
    expect(a.people.get("thm@skytale.no")!.shares).toEqual([0, 0, 1, 1]);
  });
  it("names the sprints in the window without any capacity, and counts the days in no sprint at all", () => {
    const w = forecastWindow("2026-10-22", "2026-11-11");
    const a = availabilityFrom([{ sprint: S71, members: [member(GO, [["Development", 7.5]])], teamDaysOff: [] }, { sprint: S72, members: [], teamDaysOff: [] }], w);
    expect(a.missing).toEqual(["Sprint 72"]);
    expect(a.unplanned).toBe(2);   // Mon 9 and Tue 10 Nov: Sprint 72 ends on Friday 6 Nov
  });
});

const wi = (id: number, points: number | null, resolved: string, assignee: readonly [string, string] | null, resolvedBy: readonly [string, string] | null = null, reason = "Fixed", state = "Closed"): AdoWorkItem => ({
  id,
  fields: {
    "System.WorkItemType": "Bug", "System.State": state, "Microsoft.VSTS.Common.ResolvedDate": resolved, "Microsoft.VSTS.Common.ResolvedReason": reason,
    ...(points !== null ? { "Microsoft.VSTS.Scheduling.StoryPoints": points } : {}),
    ...(assignee ? { "System.AssignedTo": { displayName: assignee[0], uniqueName: assignee[1] } } : {}),
    ...(resolvedBy ? { "Microsoft.VSTS.Common.ResolvedBy": { displayName: resolvedBy[0], uniqueName: resolvedBy[1] } } : {}),
  },
});

describe("pacePool", () => {
  it("one row per working day of the sprints: each person's points resolved that day, credited to the assignee, else the one who resolved it", () => {
    const pool = pacePool([
      wi(1, 3, "2026-09-07T10:00:00Z", THM),
      wi(2, 5, "2026-09-07T15:00:00Z", null, GO),
      wi(3, 2, "2026-09-08T09:00:00Z", THM, GO),
      wi(4, 8, "2026-09-12T10:00:00Z", THM),                              // a Saturday: not a working day
      wi(5, 5, "2026-09-09T10:00:00Z", THM, null, "Copied to Backlog"),   // moved, not delivered
      wi(6, null, "2026-09-09T10:00:00Z", THM),                           // no points: nothing
      wi(7, 3, "2026-08-30T10:00:00Z", THM),                              // before the sprint
    ], [S69]);
    expect(pool.days.length).toBe(10);
    expect(pool.days[0]).toEqual({ "thm@skytale.no": 3, "go@skytale.no": 5 });
    expect(pool.days[1]).toEqual({ "thm@skytale.no": 2 });
    expect(pool.days.slice(2).every((d) => Object.keys(d).length === 0)).toBe(true);
    expect(pool.names.get("thm@skytale.no")).toBe("Tor Håkon Moen");
  });
  it("the query asks for the bugs and stories resolved from the first sprint's start through the last one's finish", () => {
    expect(paceWiql([S69, S70])).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Bug', 'User Story') AND [Microsoft.VSTS.Common.ResolvedDate] >= '2026-09-07' AND [Microsoft.VSTS.Common.ResolvedDate] <= '2026-10-02'");
  });
  it("R18: with ADO's categories a bug in QA counts and one back in Codereview does not; the query names no states", async () => {
    const states = await readStateMap({ states: async () => [{ name: "Codereview", category: "InProgress" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }] }, ["Bug"]);
    const pool = pacePool([wi(1, 3, "2026-09-07T10:00:00Z", THM, null, "Fixed", "QA"), wi(2, 5, "2026-09-07T15:00:00Z", THM, null, "Fixed", "Codereview")], [S69], states);
    expect(pool.days[0]).toEqual({ "thm@skytale.no": 3 });
    expect(paceWiql([S69, S70])).not.toMatch(/System\.State/);
  });
});

describe("simulate", () => {
  const all = (n: number, v = 1) => Array.from({ length: n }, () => v);
  it("a past where every day is the same gives a certain total", () => {
    const people = new Map([["a", all(7)]]);
    expect(simulate([{ a: 3 }], people, 21)).toMatchObject({ p: 1, mean: 21, p10: 21, p90: 21 });
    expect(simulate([{ a: 3 }], people, 22).p).toBe(0);
  });
  it("a share scales the person's points that day, and a day off adds nothing", () => {
    expect(simulate([{ a: 4, b: 2 }], new Map([["a", [1, 0.5]], ["b", [0, 1]]]), 8)).toMatchObject({ p: 1, mean: 8 });   // a 4 + 2, b 0 + 2
  });
  it("whole past days are drawn: half the days 10 and half 0 over two days reach 20 a quarter of the time", () => {
    const r = simulate([{ a: 10 }, {}], new Map([["a", all(2)]]), 20);
    expect(r.p).toBeGreaterThan(0.23);
    expect(r.p).toBeLessThan(0.27);
    expect(r.mean).toBeGreaterThan(9.5);
    expect(r.mean).toBeLessThan(10.5);
  });
  it("the same input gives the same answer (a fixed seed)", () => {
    const pool: Record<string, number>[] = [{ a: 10, b: 1 }, { a: 2 }, {}, { b: 7 }];
    const people = new Map([["a", all(7)], ["b", all(7, 0.5)]]);
    expect(simulate(pool, people, 30)).toEqual(simulate(pool, people, 30));
  });
});

/* readForecast: Sprint 71 on 13.10 with GO, THM and KSO in Capacity, and a past where GO did 2 points and THM 1 point every working day */
const pastItems = (() => {
  const out: AdoWorkItem[] = [];
  let id = 1;
  for (const s of [S69, S70]) for (const c = new Date(s.start + "T12:00:00Z"); c.toISOString().slice(0, 10) <= s.finish; c.setUTCDate(c.getUTCDate() + 1)) {
    if (c.getUTCDay() === 0 || c.getUTCDay() === 6) continue;
    out.push(wi(id++, 2, c.toISOString(), GO), wi(id++, 1, c.toISOString(), THM));
  }
  return out;
})();
const item = (id: number, state: string, points: number): ReleaseItem => ({ id, type: "Bug", title: "x" + id, state, points, assignee: null, iteration: "Sprint 71" });
function fakeClient(caps: Record<string, AdoCapacity[]>, past = pastItems) {
  const calls: string[] = [];
  const client: Pick<AdoClient, "wiql" | "batch" | "capacities" | "iterations"> = {
    wiql: async (q) => { calls.push("wiql"); return /ResolvedDate/.test(q) ? past.map((w) => w.id) : []; },
    batch: async (ids) => { calls.push("batch"); return past.filter((w) => ids.includes(w.id)); },
    capacities: async (id) => { calls.push("capacities " + id); return { members: caps[id] ?? [], teamDaysOff: [] }; },
    iterations: async (): Promise<IterationNode> => { calls.push("iterations"); return { name: "Skytale", children: [S68, S69, S70, S71, S72].map((s) => ({ name: s.name, identifier: s.id, attributes: { startDate: s.start + "T00:00:00Z", finishDate: s.finish + "T00:00:00Z" } })) }; },
  };
  return { client, calls };
}
const planWith = (sprints: Sprint[], over: Record<string, unknown> = {}): Plan => normalizePlan({ lanes: [], tasks: [], sprints: { at: "x", items: sprints }, releases: [{ key: "r1", version: "2.0.1", targetDate: "2026-10-22", ...over }] });
const NOW = new Date(2026, 9, 13, 9, 0);
const CAP = { s71: [member(GO, [["Development", 7.5]], [["2026-10-14", "2026-10-15"]]), member(THM, [["Development", 7.5]]), member(KSO, [["Development", 7.5]]), member(["Lars Berglund", "LB@Skytale.no"], [["Deployment", 4]])] };

describe("readForecast", () => {
  const items = [item(1, "Closed", 5), item(2, "New", 12), item(3, "Active", 5)];   // 17 left
  it("the chance, the mean and the range, each person's days, pace and expected points, and what it rests on", async () => {
    const plan = planWith([S68, S69, S70, S71, S72]);
    const { client } = fakeClient(CAP);
    const f = await readForecast(plan, plan.releases![0], items, client, NOW, {});
    expect(f).toEqual({ day: "2026-10-13", need: 17, days: 7, p: 1, mean: 17, p10: 17, p90: 17,
      people: [{ name: "Gjermund Østby", days: 5, pace: 2, expected: 10 }, { name: "Tor Håkon Moen", days: 7, pace: 1, expected: 7 }, { name: "Kristoffer Scherman Olsen", days: 7, pace: 0, expected: 0 }],
      basis: ["Sprint 69", "Sprint 70"], capacity: ["Sprint 71"] });
    const more = [...items, item(4, "New", 1)];   // 18 left: one more than the certain 17
    expect((await readForecast(plan, plan.releases![0], more, client, NOW, {}))!).toMatchObject({ need: 18, p: 0 });
  });
  it("says which sprint lacks Capacity, and when there is nothing in the last two sprints to measure a pace from", async () => {
    const plan = planWith([S68, S69, S70, S71, S72]);
    expect(await readForecast(plan, plan.releases![0], items, fakeClient({}).client, NOW, {})).toEqual({ day: "2026-10-13", missing: "capacity", sprints: ["Sprint 71"], unplanned: 0 });
    expect(await readForecast(plan, plan.releases![0], items, fakeClient(CAP, []).client, NOW, {})).toEqual({ day: "2026-10-13", missing: "history" });
  });
  it("nothing for a shipped release, nothing left, no points, or a target day reached", async () => {
    const { client } = fakeClient(CAP);
    const shipped = planWith([S69, S70, S71], { shippedDate: "2026-10-12" });
    expect(await readForecast(shipped, shipped.releases![0], items, client, NOW, {})).toBeNull();
    const plan = planWith([S69, S70, S71]);
    expect(await readForecast(plan, plan.releases![0], [item(1, "Closed", 5)], client, NOW, {})).toBeNull();
    expect(await readForecast(plan, plan.releases![0], [item(1, "New", 0)], client, NOW, {})).toBeNull();
    expect(await readForecast(plan, plan.releases![0], items, client, new Date(2026, 9, 22, 9, 0), {})).toBeNull();
  });
  it("reads the past once and each sprint's Capacity once per refresh, and the iterations once when a cached sprint lacks its id", async () => {
    const bare = [S68, S69, S70, S71, S72].map((s) => ({ name: s.name, path: s.path, start: s.start, finish: s.finish }));
    const plan = normalizePlan({ lanes: [], tasks: [], sprints: { at: "x", items: bare }, releases: [{ key: "r1", version: "2.0.1", targetDate: "2026-10-22" }, { key: "r2", version: "2.0.2", targetDate: "2026-10-21" }] });
    const { client, calls } = fakeClient(CAP);
    const memo = {};
    const byKey = (k: string) => plan.releases!.find((r) => r.key === k)!;   // the normaliser sorts by target day
    await readForecast(plan, byKey("r1"), items, client, NOW, memo);
    const f2 = await readForecast(plan, byKey("r2"), items, client, NOW, memo);
    expect(f2).toMatchObject({ days: 6 });
    expect(calls.filter((c) => c === "iterations").length).toBe(1);
    expect(calls.filter((c) => c === "wiql").length).toBe(1);
    expect(calls.filter((c) => c.startsWith("capacities")).length).toBe(1);
    expect(workDays("2026-10-13", "2026-10-20")).toBe(6);
  });
});

// R19: the Sprint tab's read of ADO, as the signed-in person and never written. Today's open bugs and issues (by severity,
// release label and the next sprint), their trend over the last four finished sprints (rebuilt back from today's counts),
// the next sprint's expected points for bugs (Capacity × the pace of the two last finished sprints, R12's pieces) and,
// for the features the timeline expects in the next sprint, their stories. Cached in the plan as `sprintCheck`.
// Design: docs/superpowers/specs/2026-10-16-planning-system-r19-sprint-tab-design.md §2.
import type { Plan, Sprint, SprintCheck, SprintCheckFeature, SprintCheckSprint } from "@/features/timeline/merge";
import { budgetShare, currentSprint, dayKey, dueFeatureIds, nextSprint, osloDate, osloDay } from "@/features/timeline/epic-tools.js";
import { AdoRequestError, type AdoClient, type AdoWorkItem } from "./client";
import { ADO_CHILD_REL } from "./config";
import { availabilityFrom, forecastWindow, pacePool, paceWiql } from "./forecast";
import { relTarget } from "./plan-mappers";
import { categoryOf, isDeveloped, readStateMap, type StateCategory, type StateMap } from "./states";
import { parseSprints } from "./sync";

export type SprintCheckClient = Pick<AdoClient, "wiql" | "batch" | "capacities" | "iterations" | "states">;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const typeOf = (w: AdoWorkItem) => str(w.fields["System.WorkItemType"]);
const stateOf = (w: AdoWorkItem) => str(w.fields["System.State"]);
const pathOf = (w: AdoWorkItem) => str(w.fields["System.IterationPath"]);
const pointsOf = (w: AdoWorkItem) => Math.max(0, Number(w.fields["Microsoft.VSTS.Scheduling.StoryPoints"] ?? 0) || 0);
/** ADO's stamp is UTC; the day is the Oslo day it happened. */
const dayOfStamp = (v: unknown) => { const t = Date.parse(str(v)); return Number.isNaN(t) ? null : osloDay(new Date(t)); };
const dayAfter = (day: string) => { const [y, m, d] = day.split("-").map(Number); return dayKey(new Date(y, m - 1, d + 1)); };
const read = (client: SprintCheckClient, ids: number[]) => (ids.length ? client.batch(ids) : Promise.resolve([]));

const SEVERITY: Record<string, "A" | "B" | "C" | "D"> = { "1": "A", "2": "B", "3": "C", "4": "D" };
/** ADO's severity as the tab's letter: «1 - Critical» A, «2 - High» B, «3 - Medium» C, «4 - Low» D; anything else none. */
export function severityOf(v: unknown): "A" | "B" | "C" | "D" | "none" {
  const m = /^\s*([1-4])\b/.exec(str(v));
  return m ? SEVERITY[m[1]] : "none";
}

const OPEN_CATEGORIES: readonly StateCategory[] = ["Proposed", "InProgress", "Resolved"];
/** Open by D2: category Proposed, InProgress or Resolved; without the map or for an unknown state, anything but Closed and Removed. */
export function isOpen(states: StateMap | null, type: string, state: string): boolean {
  const c = categoryOf(states, type, state);
  return c ? OPEN_CATEGORIES.includes(c) : state !== "Closed" && state !== "Removed";
}
/** Closed: category Completed; without the map or for an unknown state, the name Closed. */
export function isClosed(states: StateMap | null, type: string, state: string): boolean {
  const c = categoryOf(states, type, state);
  return c ? c === "Completed" : state === "Closed";
}
function isRemoved(states: StateMap | null, type: string, state: string): boolean {
  const c = categoryOf(states, type, state);
  return c ? c === "Removed" : state === "Removed";
}

const COUNTED = ["Bug", "Issue"];
const BASE = "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Bug', 'Issue')";
const quote = (s: string) => "'" + s.replace(/'/g, "''") + "'";
/** Bugs and issues in an open state: the states the map puts in an open category; by the names when the map knows no states of a type. */
export function openWiql(states: StateMap | null): string {
  const byType = COUNTED.map((type) => [...(states ?? [])].filter(([k]) => k.startsWith(type + "/")));
  const open = [...new Set(byType.flat().filter(([, c]) => OPEN_CATEGORIES.includes(c)).map(([k]) => k.slice(k.indexOf("/") + 1)))].sort();
  if (!states || byType.some((list) => !list.length) || !open.length) return BASE + " AND [System.State] NOT IN ('Closed', 'Removed')";
  return BASE + " AND [System.State] IN (" + open.map(quote).join(", ") + ")";
}
/** Bugs and issues created or closed on or after the day. */
export function trendWiql(sinceDay: string): string {
  return BASE + " AND ([System.CreatedDate] >= '" + sinceDay + "' OR [Microsoft.VSTS.Common.ClosedDate] >= '" + sinceDay + "')";
}

type Fact = { bug: boolean; created: string | null; closed: string | null; points: number };
/** The bugs and issues as days: created, closed (only while closed), points. A removed item never counts. */
function factsOf(items: AdoWorkItem[], states: StateMap | null): Fact[] {
  return items.filter((w) => COUNTED.includes(typeOf(w)) && !isRemoved(states, typeOf(w), stateOf(w))).map((w) => ({
    bug: typeOf(w) === "Bug",
    created: dayOfStamp(w.fields["System.CreatedDate"]),
    closed: isClosed(states, typeOf(w), stateOf(w)) ? dayOfStamp(w.fields["Microsoft.VSTS.Common.ClosedDate"]) : null,
    points: pointsOf(w),
  }));
}

/** The last finished sprints' rows (oldest first), reconstructed back from today's open counts: open at the end of day T =
 *  open now − created after T + closed after T; per sprint the bugs created and closed inside it and the closed bugs' points. */
export function trendOf(openNow: { bugs: number; issues: number }, items: AdoWorkItem[], finished: Sprint[], states: StateMap | null): SprintCheckSprint[] {
  const facts = factsOf(items, states);
  return finished.map((s) => {
    const end = s.finish;
    let bugs = openNow.bugs, issues = openNow.issues, created = 0, closed = 0, closedPoints = 0;
    for (const f of facts) {
      const back = (f.created && f.created > end ? -1 : 0) + (f.closed && f.closed > end ? 1 : 0);
      if (f.bug) bugs += back; else issues += back;
      if (!f.bug) continue;
      if (f.created && s.start <= f.created && f.created <= end) created++;
      if (f.closed && s.start <= f.closed && f.closed <= end) { closed++; closedPoints += f.points; }
    }
    return { name: s.name, end, openBugs: Math.max(0, bugs), openIssues: Math.max(0, issues), created, closed, closedPoints };
  });
}

/** The next sprint's expected points: each person's pace over the two last finished sprints × their share of the next sprint's
 *  working days (Capacity). What is missing when it cannot be computed; a failed read counts as missing Capacity. */
async function readBudget(plan: Plan, client: SprintCheckClient, next: Sprint | null, finished: Sprint[], states: StateMap | null): Promise<SprintCheck["budget"]> {
  const share = budgetShare(plan);
  if (!next) return { points: null, share };
  try {
    const caps = next.id ? await client.capacities(next.id) : { members: [], teamDaysOff: [] };
    const avail = availabilityFrom([{ sprint: next, ...caps }], forecastWindow(next.start, dayAfter(next.finish)));
    if (avail.missing.length || avail.unplanned || !avail.people.size) return { points: null, share, missing: "capacity" };
    const last2 = finished.slice(-2);
    const pool = last2.length ? pacePool(await read(client, await client.wiql(paceWiql(last2))), last2, states) : null;
    if (!pool || !pool.days.some((d) => Object.keys(d).length)) return { points: null, share, missing: "history" };
    let points = 0;
    for (const [key, p] of avail.people) points += (pool.days.reduce((s, d) => s + (d[key] ?? 0), 0) / pool.days.length) * p.shares.reduce((a, b) => a + b, 0);
    return { points: Math.round(points), share };
  } catch (e) {
    if (e instanceof AdoRequestError && e.status === 401) throw e;   // a rejected token stops the read
    console.warn("sprint budget skipped:", e instanceof Error ? e.message : e);   // e.g. no access to the team's Capacity
    return { points: null, share, missing: "capacity" };
  }
}

/** The due features' user stories (the discovery story and anything not a live user story left out), keyed by the task id. */
async function readFeatures(plan: Plan, client: SprintCheckClient, today: string, current: Sprint | null, next: Sprint | null, states: StateMap | null): Promise<Record<string, SprintCheckFeature>> {
  const due = new Set(dueFeatureIds(plan, today));
  const tasks = plan.tasks.filter((t) => due.has(t.id) && typeof t.adoId === "number");
  if (!tasks.length) return {};
  const byId = new Map((await read(client, [...new Set(tasks.map((t) => t.adoId as number))])).map((w) => [w.id, w]));
  const children = new Map<string, number[]>();
  for (const t of tasks) {
    const w = byId.get(t.adoId as number);
    if (!w) continue;
    const ids = (w.relations ?? []).filter((r) => r.rel === ADO_CHILD_REL).map(relTarget).filter((id) => Number.isInteger(id) && id !== t.ado?.storyId);
    children.set(t.id, [...new Set(ids)]);
  }
  const stories = new Map((await read(client, [...new Set([...children.values()].flat())])).map((w) => [w.id, w]));
  const out: Record<string, SprintCheckFeature> = {};
  for (const [taskId, ids] of children) {
    const live = ids.map((id) => stories.get(id)).filter((w): w is AdoWorkItem => !!w && typeOf(w) === "User Story" && !isRemoved(states, "User Story", stateOf(w)));
    const open = live.filter((w) => !isDeveloped(states, "User Story", stateOf(w)));
    const inNext = next ? open.filter((w) => pathOf(w) === next.path) : [];
    out[taskId] = {
      stories: live.length,
      open: open.length,
      inNext: inNext.length,
      inNextPoints: inNext.reduce((s, w) => s + pointsOf(w), 0),
      inCurrent: current ? open.filter((w) => pathOf(w) === current.path).length : 0,
    };
  }
  return out;
}

/** The whole read, in the spec's order: sprints, states, open bugs and issues, the trend, the budget, the due features' stories. */
export async function readSprintCheck(plan: Plan, client: SprintCheckClient, now: Date): Promise<SprintCheck> {
  const cached = plan.sprints?.items ?? [];
  const sprints = [...(cached.length && cached.every((s) => s.id) ? cached : parseSprints(await client.iterations()))].sort((a, b) => a.start.localeCompare(b.start));
  const today = osloDay(now), date = osloDate(now);
  const current = currentSprint(sprints, date), next = nextSprint(sprints, date);
  const finished = sprints.filter((s) => s.finish < today).slice(-4);
  const states = await readStateMap(client, ["Bug", "Issue", "User Story"]);   // null = counted by the names

  const open = (await read(client, await client.wiql(openWiql(states)))).filter((w) => COUNTED.includes(typeOf(w)) && isOpen(states, typeOf(w), stateOf(w)));
  const bugs: SprintCheck["bugs"] = { open: 0, A: 0, B: 0, C: 0, D: 0, none: 0, inRelease: {}, inNext: 0, inNextPoints: 0, closedCurrent: 0 };
  let issues = 0;
  for (const w of open) {
    if (typeOf(w) === "Issue") { issues++; continue; }
    bugs.open++;
    bugs[severityOf(w.fields["Microsoft.VSTS.Common.Severity"])]++;
    const label = str(w.fields["Custom.Release"]).trim();
    if (label) bugs.inRelease[label] = (bugs.inRelease[label] ?? 0) + 1;
    if (next && pathOf(w) === next.path) { bugs.inNext++; bugs.inNextPoints += pointsOf(w); }
  }

  let trend: SprintCheckSprint[] = [];
  const since = finished[0]?.start ?? current?.start;
  if (since) {
    const items = await read(client, await client.wiql(trendWiql(since)));
    trend = trendOf({ bugs: bugs.open, issues }, items, finished, states);
    if (current) bugs.closedCurrent = factsOf(items, states).filter((f) => f.bug && f.closed && f.closed >= current.start).length;
  }

  const budget = await readBudget(plan, client, next, finished, states);
  const features = await readFeatures(plan, client, today, current, next, states);
  return { at: now.toISOString(), current: current?.name ?? null, next: next?.name ?? null, ...(states ? {} : { statesMissing: true as const }), bugs, issues: { open: issues }, sprints: trend, budget, features };
}

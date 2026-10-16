// R12: the chance a release is done by its target day, from who is there (ADO's Capacity, filled in per sprint) and how
// fast each person has been (the bugs and stories they resolved in the two last finished sprints). Read only, never
// written to ADO. Design: docs/superpowers/specs/2026-10-12-planning-system-r12-release-forecast-design.md.
import type { Plan, Release, ReleaseForecast, ReleaseItem, Sprint } from "@/features/timeline/merge";
import { dayKey, osloDay, releaseItemDone } from "@/features/timeline/epic-tools.js";
import type { AdoCapacity, AdoClient, AdoWorkItem } from "./client";
import { isDeveloped, type StateMap } from "./states";
import { parseSprints } from "./sync";

/** A full working day on the Capacity tab (GO filled Sprint 71 with 7.5). */
export const FULL_DAY_HOURS = 7.5;
/** The activities whose hours deliver story points; Testing, Deployment, Design and Documentation do not. "" is ADO's unnamed activity. */
export const POINT_ACTIVITIES = ["Development", ""];
/** Resolved without delivering anything. */
export const NOT_DELIVERED = ["Copied to Backlog", "Duplicate", "As Designed", "Cannot Reproduce", "Deferred", "Obsolete", "Won't Fix"];
export const FORECAST_SIMS = 20000;
const SEED = 71;   // a fixed seed: the same data gives the same number, so a re-read the same day changes nothing

const dayOf = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd); };
const isWorkDay = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
function workingDays(from: string, through: string): string[] {
  const out: string[] = [];
  for (const c = dayOf(from); dayKey(c) <= through; c.setDate(c.getDate() + 1)) if (isWorkDay(c)) out.push(dayKey(c));
  return out;
}
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
type Who = { displayName?: string; uniqueName?: string } | string | undefined | null;
const whoOf = (w: Who): { key: string; name: string } | null => {
  if (!w) return null;
  if (typeof w === "string") return { key: w.toLowerCase(), name: w };
  const key = (w.uniqueName || w.displayName || "").toLowerCase();
  return key ? { key, name: w.displayName || key } : null;
};
const inRanges = (day: string, ranges: { start: string; end: string }[]) => ranges.some((r) => r.start.slice(0, 10) <= day && day <= r.end.slice(0, 10));

/** The working days from today through the day before the target day: the target day is the hand-over (2.0.1 goes to QA on 22.10). */
export function forecastWindow(todayDay: string, targetDay: string): string[] {
  const last = dayOf(targetDay);
  last.setDate(last.getDate() - 1);
  return workingDays(todayDay, dayKey(last));
}

export type SprintCapacity = { sprint: Sprint; members: AdoCapacity[]; teamDaysOff: { start: string; end: string }[] };
/** Each person's share of each window day (the point-delivering hours / 7.5, at most 1; 0 on their or the team's days off),
 *  from the sprint the day falls in; the sprints in the window with no Capacity at all, and the days in no sprint. */
export function availabilityFrom(caps: SprintCapacity[], days: string[]): { people: Map<string, { name: string; shares: number[] }>; missing: string[]; unplanned: number } {
  const people = new Map<string, { name: string; shares: number[] }>();
  const missing = new Set<string>();
  let unplanned = 0;
  days.forEach((day, i) => {
    const c = caps.find((x) => x.sprint.start <= day && day <= x.sprint.finish);
    if (!c) { unplanned++; return; }
    if (!c.members.length) { missing.add(c.sprint.name); return; }
    const teamOff = inRanges(day, c.teamDaysOff);
    for (const m of c.members) {
      const hours = (m.activities ?? []).filter((a) => POINT_ACTIVITIES.includes(a.name ?? "")).reduce((s, a) => s + (Number(a.capacityPerDay) || 0), 0);
      const who = whoOf(m.teamMember);
      if (hours <= 0 || !who) continue;
      let p = people.get(who.key);
      if (!p) { p = { name: who.name, shares: days.map(() => 0) }; people.set(who.key, p); }
      p.shares[i] = teamOff || inRanges(day, m.daysOff ?? []) ? 0 : Math.min(1, hours / FULL_DAY_HOURS);
    }
  });
  return { people, missing: [...missing], unplanned };
}

/** The bugs and stories resolved from the first sprint's start through the last one's finish. R18: the resolved day selects them, no
 *  state names (the pool keeps those still developed, by their state's category). */
export function paceWiql(sprints: Sprint[]): string {
  return "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Bug', 'User Story') AND [Microsoft.VSTS.Common.ResolvedDate] >= '" + sprints[0].start + "' AND [Microsoft.VSTS.Common.ResolvedDate] <= '" + sprints[sprints.length - 1].finish + "'";
}

/** One row per working day of the sprints: each person's points resolved that day, credited to the assignee, else the one who
 *  resolved it. Weekend work, items without points, items resolved without delivering and (R18) items not developed by their state's
 *  category (one back in Codereview) are left out. */
export function pacePool(items: AdoWorkItem[], sprints: Sprint[], states: StateMap | null = null): { days: Record<string, number>[]; names: Map<string, string> } {
  const list = sprints.flatMap((s) => workingDays(s.start, s.finish));
  const index = new Map(list.map((d, i) => [d, i]));
  const days = list.map(() => ({}) as Record<string, number>);
  const names = new Map<string, string>();
  for (const w of items) {
    const f = w.fields;
    if (!isDeveloped(states, String(f["System.WorkItemType"] ?? ""), String(f["System.State"] ?? ""))) continue;
    if (NOT_DELIVERED.includes(String(f["Microsoft.VSTS.Common.ResolvedReason"] ?? ""))) continue;
    const points = Number(f["Microsoft.VSTS.Scheduling.StoryPoints"] ?? 0) || 0;
    const i = index.get(String(f["Microsoft.VSTS.Common.ResolvedDate"] ?? "").slice(0, 10));
    const who = whoOf((f["System.AssignedTo"] || f["Microsoft.VSTS.Common.ResolvedBy"]) as Who);
    if (points <= 0 || i === undefined || !who) continue;
    names.set(who.key, who.name);
    days[i][who.key] = (days[i][who.key] ?? 0) + points;
  }
  return { days, names };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Monte Carlo over whole past days (a team's good and bad days come together): for every window day draw one past day and add
 *  each person's points that day × their share of the window day; the share of runs that reach `need`, the mean, p10 and p90. */
export function simulate(pool: Record<string, number>[], people: Map<string, number[]>, need: number, sims = FORECAST_SIMS, seed = SEED): { p: number; mean: number; p10: number; p90: number } {
  const entries = [...people.entries()];
  const n = entries.length ? entries[0][1].length : 0;
  if (!pool.length || !n) return { p: need <= 0 ? 1 : 0, mean: 0, p10: 0, p90: 0 };
  const rand = mulberry32(seed);
  const totals = new Float64Array(sims);
  let hits = 0, sum = 0;
  for (let s = 0; s < sims; s++) {
    let t = 0;
    for (let d = 0; d < n; d++) {
      const day = pool[Math.floor(rand() * pool.length)];
      for (const [k, shares] of entries) t += (day[k] ?? 0) * shares[d];
    }
    totals[s] = t; sum += t;
    if (t >= need - 1e-9) hits++;
  }
  totals.sort();
  return { p: hits / sims, mean: sum / sims, p10: totals[Math.floor(sims * 0.1)], p90: totals[Math.floor(sims * 0.9)] };
}

/** What one refresh reads once and shares between its releases. */
export type ForecastMemo = {
  sprints?: Promise<Sprint[]>;
  pool?: Promise<{ days: Record<string, number>[]; basis: string[] }>;
  caps?: Map<string, Promise<SprintCapacity>>;
};
type Client = Pick<AdoClient, "wiql" | "batch" | "capacities" | "iterations">;

/** The release's forecast for today, or null when there is nothing to forecast: shipped, nothing left, no points, or the target day reached.
 *  R18: `states` (ADO's state categories, read once per refresh) decides which past items count for the pace. */
export async function readForecast(plan: Plan, r: Release, items: ReleaseItem[], client: Client, now: Date, memo: ForecastMemo, states: StateMap | null = null): Promise<ReleaseForecast | null> {
  if (r.shippedDate) return null;
  const need = items.filter((i) => !releaseItemDone(i)).reduce((s, i) => s + (i.points || 0), 0);
  if (need <= 0 || !items.some((i) => i.points > 0)) return null;
  const today = osloDay(now);
  const window = forecastWindow(today, r.targetDate);
  if (!window.length) return null;
  const cached = plan.sprints?.items ?? [];
  const sprints = await (memo.sprints ??= cached.length && cached.every((s) => s.id) ? Promise.resolve(cached) : client.iterations().then(parseSprints));
  memo.caps ??= new Map();
  const caps = await Promise.all(sprints.filter((s) => window.some((d) => s.start <= d && d <= s.finish)).map((s) => {
    let c = memo.caps!.get(s.name);
    if (!c) { c = s.id ? client.capacities(s.id).then((x) => ({ sprint: s, ...x })) : Promise.resolve({ sprint: s, members: [], teamDaysOff: [] }); memo.caps!.set(s.name, c); }
    return c;
  }));
  const avail = availabilityFrom(caps, window);
  if (avail.missing.length || avail.unplanned || !avail.people.size) return { day: today, missing: "capacity", sprints: avail.missing.length || avail.unplanned ? avail.missing : caps.map((c) => c.sprint.name), unplanned: avail.unplanned };
  const finished = sprints.filter((s) => s.finish < today).slice(-2);
  memo.pool ??= finished.length
    ? client.wiql(paceWiql(finished)).then((ids) => client.batch(ids)).then((ws) => ({ days: pacePool(ws, finished, states).days, basis: finished.map((s) => s.name) }))
    : Promise.resolve({ days: [], basis: [] });
  const pool = await memo.pool;
  if (!pool.days.some((d) => Object.keys(d).length)) return { day: today, missing: "history" };
  const sim = simulate(pool.days, new Map([...avail.people].map(([k, v]) => [k, v.shares])), need);
  const people = [...avail.people].map(([k, v]) => {
    const pace = pool.days.reduce((s, d) => s + (d[k] ?? 0), 0) / pool.days.length, days = v.shares.reduce((a, b) => a + b, 0);
    return { name: v.name, days: round(days, 2), pace: round(pace, 1), expected: round(pace * days, 1) };
  }).sort((a, b) => b.expected - a.expected || a.name.localeCompare(b.name, "nb"));
  return { day: today, need, days: window.length, p: round(sim.p, 2), mean: Math.round(sim.mean), p10: Math.round(sim.p10), p90: Math.round(sim.p90), people, basis: pool.basis, capacity: caps.map((c) => c.sprint.name) };
}

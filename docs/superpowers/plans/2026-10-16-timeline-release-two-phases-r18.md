# Tidslinjen R18: a release in two phases — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count ADO states by their category (so Codereview, Develop and QA count right), give a release two estimated
dates («Klar for QA» from the development lead, «Release» from Operations) and a manual «Sluppet», and show the
release in two phases (development, then QA) in the drawer, the band, the strip and on deliveries.

**Architecture:** A new `src/features/ado/states.ts` reads each work item type's states and categories once per refresh;
`releases.ts`, `forecast.ts`, `sync.ts`/`push.ts` count by category, with the old names as the fallback. The rules stay pure
in `epic-tools.js` (category-aware done and closed, the dev target, the phase, the expected release, the QA text, the
burndown's second series); `events.ts` logs the new date; `timeline.html` draws it.

**Tech Stack:** TypeScript modules (Next 16 server side), `epic-tools.js` (CommonJS + browser globals, must equal
`epic-tools.d.ts`), vitest 4, Playwright smokes behind a mock API.

**Spec:** `docs/superpowers/specs/2026-10-16-planning-system-r18-release-two-phases-design.md` (commit bce7a9e).

## Global Constraints

- Norwegian in the UI and stored text, English in code and commits. No Claude attribution in commits.
- Same branch and PR as R17 (`feat/r17-delivery-view-ux`, worktree `/Users/dnumreig/Skytale/SkyTracker-wt-epics`). Never
  `master`; never push.
- `module.exports` of `epic-tools.js` must equal `epic-tools.d.ts`.
- Nothing is written to ADO. The states call is read-only (`GET …/workitemtypes/{type}/states`).
- Items stored before R18 have no `category`: every rule falls back to the names Resolved and Closed.
- R17's rules hold: 12 px floor (chips 11 px), AA contrast, green/amber/red for health only.
- D7: once a release has «Klar for QA», its two dates are named «klar for QA» and «release» everywhere it is shown (drawer
  head and sections, band, strip, burndown). Without one, every view reads as today; only D4's «Sluppet» (for «Skippet»)
  and D9's «utviklet» (for «levert» where it means developed) change words.

## Review Focus

1. The states call fails (no access, network): the release is still read and counted by the old names, and the drawer says
   so. (Task 1: `readStateMap` returns null on a non-401 error; Task 4 smoke R18-6 shows the note.)
2. A release whose «Klar for QA» has passed while items are still in development: the phase stays «utvikling», the
   expected release moves by the slip, and a delivery on it turns yellow or red. (Task 2: `releaseExpected` slip test;
   Task 4 smoke R18-7.)
3. «Klar for QA» set after «Release»: the editor refuses it with the reason in the field. (Task 4 smoke R18-2.)
4. «Marker sluppet» on a release with open items: the open ids are kept and shown as «åpne ved release»; without «Sluppet»
   the normaliser drops them. (Task 2 normaliser test; Task 4 smoke R18-4.)
5. A story that moves back from QA to Codereview: it is no longer developed, and the tempo counts only what is developed.
   (Task 1: `releaseItemOf` with an InProgress category gives no delivered day.)
   - **Amended after the final review (16.10):** the story counts as never developed, and the burndown is redrawn from
     today's states. R11 builds every day's point from each item's delivered day, so the line does not rise on the day the
     story went back. Drawing from the stored readings instead would change R11's design and jump at the first R18 read.
     The help card «Releaser» says so: «Sendes en story tilbake fra QA, teller den som ikke utviklet, og burndownen tegnes
     på nytt etter dagens tilstander.»

## Where the plan departs from the spec

The spec is unchanged. The plan departs from it in three places, on purpose:

1. **§9, the smoke.**
   - The spec: R18-1…R18-6 go in `hosted-release-smoke.mjs`, and the deliveries smoke checks a late handover.
   - The plan: one new file, `hosted-release-r18-smoke.mjs`, with R18-1…R18-8 on the design review's harness. The late
     handover is R18-7, on Kunder. R18-8 checks the one-phase release (D7).
   - The read-back that counts by category is pinned in vitest (`releases.test.ts`), not behind a mock ADO in a smoke.
   - Why: the harness sets the plan directly, so each part starts from a known release.
2. **§7, the burndown.**
   - The spec: one chart per section.
   - The plan: one chart in the development section, with a second, dashed line for what is not closed, plus the
     «klar for QA» and «release» ticks.
   - Why: the two lines share one axis, and a second chart would repeat it.
3. **§4, the words without a QA date.**
   - A release without «Klar for QA» keeps today's «mål» on the band, in the strip and in the drawer head (D7).
   - «Release» names the date only in the editor (D3) and wherever a QA date is set.

---

### Task 1: ADO state categories (spec §2)

**Files:**
- Create: `src/features/ado/states.ts`, `src/features/ado/states.test.ts`
- Modify: `src/features/ado/client.ts` (`states`), `src/features/ado/releases.ts` (`refreshReleases`, `releaseItemOf`),
  `src/features/ado/forecast.ts` (`paceWiql`, `pacePool`, `readForecast`), `src/features/ado/sync.ts` (`readStories`),
  `src/features/ado/push.ts` (`refreshPlan`), `src/features/timeline/merge.ts` (types),
  `src/features/timeline/epic-tools.js` + `.d.ts` (`releaseItemDone`, `releaseItemClosed`, `releaseStateCounts`, the
  normaliser's items and `statesMissing`)
- Test: `releases.test.ts`, `forecast.test.ts`, `sync.test.ts`, `epic-tools.test.ts`

**Interfaces:**
- Produces: `client.states(type) → Promise<{ name: string; category: string }[]>`; `readStateMap(client, types) → Promise<StateMap | null>`;
  `categoryOf(map, type, state)`; `isDeveloped(map, type, state)`; `ReleaseItem.category?` and `ReleaseItem.closed?` (day);
  `ReleaseAdo.statesMissing?: true`; `releaseItemDone(i)` (developed), `releaseItemClosed(i)` and
  `releaseStateCounts(r) → { state, count, category? }[]` (in category order) in `epic-tools.js`.

- [ ] **Step 1: Write the failing tests.** `src/features/ado/states.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AdoRequestError } from "./client";
import { categoryOf, isDeveloped, readStateMap } from "./states";

const STATES: Record<string, { name: string; category: string }[]> = {
  Bug: [{ name: "New", category: "Proposed" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }, { name: "Removed", category: "Removed" }],
  "User Story": [{ name: "New", category: "Proposed" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }],
};
const client = (fail?: Error) => ({ states: async (t: string) => { if (fail) throw fail; return STATES[t] ?? []; } });

describe("R18: ADO's state categories", () => {
  it("maps every state of every type to its category, so a custom state counts as its category says", async () => {
    const m = await readStateMap(client(), ["Bug", "User Story"]);
    expect(categoryOf(m, "Bug", "Develop")).toBe("Resolved");
    expect(categoryOf(m, "User Story", "Codereview")).toBe("InProgress");
    expect(isDeveloped(m, "Bug", "QA")).toBe(true);
    expect(isDeveloped(m, "Bug", "Closed")).toBe(true);
    expect(isDeveloped(m, "User Story", "Codereview")).toBe(false);
  });
  it("without a map it falls back to the names Resolved and Closed; a failed call gives null, a rejected token still throws", async () => {
    expect(isDeveloped(null, "Bug", "Resolved")).toBe(true);
    expect(isDeveloped(null, "Bug", "Develop")).toBe(false);
    expect(await readStateMap(client(new Error("network")), ["Bug"])).toBeNull();
    await expect(readStateMap(client(new AdoRequestError(401, "ADO rejected the token")), ["Bug"])).rejects.toThrow(/rejected/);
  });
});
```

In `releases.test.ts`, `fake` gains a third parameter, so the shared fixture and the existing counts stay as they are:
`opts: { extra?: AdoWorkItem[]; states?: Record<string, { name: string; category: string }[]> } = {}`.
- `wiql` and `batch` serve `[...ITEMS, ...(opts.extra ?? [])]` where they serve `ITEMS` today.
- The client is typed `Pick<AdoClient, "wiql" | "batch" | "capacities" | "iterations" | "states">` and gets
  `states: async (t) => opts.states?.[t] ?? []`.

The existing tests pass no `states`, so their items get no category. One expected value changes: in the first test,
4817's item gains `closed: "2026-10-12"`, because the name fallback stamps the closed day. Then add:

```ts
const STATES_OF: Record<string, { name: string; category: string }[]> = {
  Bug: [{ name: "New", category: "Proposed" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }, { name: "Removed", category: "Removed" }],
  "User Story": [{ name: "New", category: "Proposed" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }],
};
const R18_ITEMS: AdoWorkItem[] = [
  wi(4870, "User Story", "Merged", "Develop", 2, "2.0.1", S71, undefined, { "Microsoft.VSTS.Common.ResolvedDate": "2026-10-10T12:00:00Z" }),
  wi(4871, "Bug", "In review", "Codereview", 1, "2.0.1", S71),
];
```
and in `describe("refreshReleases (R10 + R11)")`:

```ts
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
```
Add to `epic-tools.test.ts`:

```ts
describe("R18: developed and closed by category", () => {
  it("category first, the old names without one", () => {
    const i = (state: string, category?: string) => ({ id: 1, type: "Bug", title: "", state, points: 1, assignee: null, ...(category ? { category } : {}) }) as never;
    expect(releaseItemDone(i("QA", "Resolved"))).toBe(true);
    expect(releaseItemDone(i("Codereview", "InProgress"))).toBe(false);
    expect(releaseItemClosed(i("QA", "Resolved"))).toBe(false);
    expect(releaseItemClosed(i("Closed", "Completed"))).toBe(true);
    expect(releaseItemDone(i("Resolved"))).toBe(true);
    expect(releaseItemClosed(i("Resolved"))).toBe(false);
  });
  it("the state counts carry the category and come in its order; the normaliser keeps the fallback flag", () => {
    const it2 = (id: number, state: string, category: string) => ({ id, type: "Bug", title: "", state, category, points: 1, assignee: null });
    const r = normalizePlan({ lanes: [], tasks: [], releases: [{ key: "r1", version: "2.0.1", targetDate: "2026-10-27", ado: { at: "x", label: "2.0.1", statesMissing: true,
      items: [it2(1, "Closed", "Completed"), it2(2, "QA", "Resolved"), it2(3, "Codereview", "InProgress"), it2(4, "Develop", "Resolved"), it2(5, "New", "Proposed"), it2(6, "QA", "Resolved")] } }] }).releases![0];
    expect(releaseStateCounts(r)).toEqual([
      { state: "New", category: "Proposed", count: 1 }, { state: "Codereview", category: "InProgress", count: 1 },
      { state: "Develop", category: "Resolved", count: 1 }, { state: "QA", category: "Resolved", count: 2 }, { state: "Closed", category: "Completed", count: 1 },
    ]);
    expect(r.ado!.statesMissing).toBe(true);
  });
});
```
(`releaseItemDone`, `releaseItemClosed` join the import list. The existing `releaseStateCounts` test keeps passing: without a
category the old order holds.)

In `forecast.test.ts`'s `describe("pacePool")` (import `readStateMap` from `./states`):

```ts
  it("R18: with ADO's categories a bug in QA counts and one back in Codereview does not; the query names no states", async () => {
    const states = await readStateMap({ states: async () => [{ name: "Codereview", category: "InProgress" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }] }, ["Bug"]);
    const pool = pacePool([wi(1, 3, "2026-09-07T10:00:00Z", THM, null, "Fixed", "QA"), wi(2, 5, "2026-09-07T15:00:00Z", THM, null, "Fixed", "Codereview")], [S69], states);
    expect(pool.days[0]).toEqual({ "thm@skytale.no": 3 });
    expect(paceWiql([S69, S70])).not.toMatch(/System\.State/);
  });
```
The existing `paceWiql` expectation drops ` AND [System.State] IN ('Resolved', 'Closed')`; the rest of the query is unchanged.

In `sync.test.ts`'s `describe("readStories and deliveredDay")` (import `ADO_CHILD_REL` from `./config` and the type
`StateMap` from `./states`):

```ts
  it("R18: with ADO's categories a story in Develop or QA counts as done; without them only Resolved and Closed do", () => {
    const story = (id: number, state: string, points: number): AdoWorkItem => ({ id, fields: { "System.WorkItemType": "User Story", "System.State": state, "Microsoft.VSTS.Scheduling.StoryPoints": points } });
    const feat: AdoWorkItem = { id: 1, fields: { "System.WorkItemType": "Feature" }, relations: [10, 11, 12].map((id) => ({ rel: ADO_CHILD_REL, url: "https://dev.azure.com/SkytaleAS/_apis/wit/workItems/" + id })) };
    const byId = new Map([story(10, "Develop", 3), story(11, "QA", 2), story(12, "Codereview", 5)].map((w) => [w.id, w]));
    const map: StateMap = new Map([["User Story/Develop", "Resolved"], ["User Story/QA", "Resolved"], ["User Story/Codereview", "InProgress"]]);
    expect(readStories(feat, byId, undefined, map)).toMatchObject({ count: 3, pointsTotal: 10, pointsDone: 5 });
    expect(readStories(feat, byId).pointsDone).toBe(0);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/features/ado src/features/timeline/epic-tools.test.ts`
Expected: FAIL (`Cannot find module './states'`, `releaseItemClosed is not a function`, the pace pool and the stories
count only the old names).

- [ ] **Step 3: Implement.**
  - `client.ts`: in `AdoClient` add `/** R18: a work item type's states and their categories. */ states(type: string): Promise<{ name: string; category: string }[]>;`
    and in `createAdoClient`:
    `states: async (type) => ((await request<{ value: { name: string; category: string }[] }>("GET", \`${adoProjectUrl()}/_apis/wit/workitemtypes/${encodeURIComponent(type)}/states?${v}\`))?.value ?? []),`
  - `states.ts`:
    ```ts
    // R18: ADO puts every work item state in a category (Proposed, InProgress, Resolved, Completed, Removed). Read per type once
    // per refresh, so a custom state (Codereview, Develop, QA) counts as its category says, never by its name.
    import { AdoRequestError, type AdoClient } from "./client";

    export type StateCategory = "Proposed" | "InProgress" | "Resolved" | "Completed" | "Removed";
    export type StateMap = Map<string, StateCategory>;   // key: «<type>/<state>»
    const CATEGORIES: readonly string[] = ["Proposed", "InProgress", "Resolved", "Completed", "Removed"];

    /** The categories of the given types' states; null when ADO did not answer (the callers fall back to the names). */
    export async function readStateMap(client: Pick<AdoClient, "states">, types: string[]): Promise<StateMap | null> {
      try {
        const map: StateMap = new Map();
        for (const type of types) for (const s of await client.states(type)) if (CATEGORIES.includes(s.category)) map.set(type + "/" + s.name, s.category as StateCategory);
        return map;
      } catch (e) {
        if (e instanceof AdoRequestError && e.status === 401) throw e;   // a rejected token stops the read as before
        console.warn("ADO states skipped:", e instanceof Error ? e.message : e);
        return null;
      }
    }
    export function categoryOf(map: StateMap | null, type: string, state: string): StateCategory | undefined {
      return map ? map.get(type + "/" + state) : undefined;
    }
    /** Developed: category Resolved or Completed; without a map (or an unknown state), the names Resolved and Closed. */
    export function isDeveloped(map: StateMap | null, type: string, state: string): boolean {
      const c = categoryOf(map, type, state);
      return c ? c === "Resolved" || c === "Completed" : state === "Resolved" || state === "Closed";
    }
    ```
  - `merge.ts`: `ReleaseItem` gains `category?: "Proposed" | "InProgress" | "Resolved" | "Completed"; closed?: string;`,
    `ReleaseAdo` gains `statesMissing?: true`.
  - `releases.ts`: `releaseItemOf(w, states: StateMap | null = null)`; `delivered` = the Oslo day of `ResolvedDate` (else
    `ClosedDate`) when `isDeveloped(states, type, state)`; `category` from `categoryOf` when not Removed; `closed` = the Oslo
    day of `ClosedDate` when the category is Completed (or, without a category, the state is Closed). `refreshReleases`
    takes `client: Pick<AdoClient, "wiql" | "batch" | "capacities" | "iterations" | "states">`, reads
    `const states = await readStateMap(client, ["Bug", "User Story"]);` once before the loop, maps
    `found.map((w) => releaseItemOf(w, states))`, sets `statesMissing: true` on `next` when `states` is null, and passes
    `states` to `readForecast(…, memo, states)`.
  - `forecast.ts`: `paceWiql` drops `AND [System.State] IN ('Resolved', 'Closed')` (the `ResolvedDate` range selects what
    was resolved); `pacePool(items, sprints, states: StateMap | null = null)` keeps an item when
    `isDeveloped(states, String(f["System.WorkItemType"] ?? ""), String(f["System.State"] ?? ""))`; `readForecast(…, memo, states = null)`
    passes it on.
  - `sync.ts`: `readStories(feature, byId, discoveryStoryId?, states: StateMap | null = null)`; points done =
    `isDeveloped(states, "User Story", String(w.fields["System.State"]))`. `push.ts` `refreshPlan` reads
    `const states = await readStateMap(client, ["User Story"]);` once and passes it to `readStories`. The ado-refresh and
    ado-releases routes pass the real client (it has `states` now); the other test fakes add `states: async () => []`.
  - `epic-tools.js`:
    ```js
    const releaseItemDone = (i) => (i.category ? i.category === "Resolved" || i.category === "Completed" : RELEASE_DONE_STATES.includes(i.state));   // R18: developed
    const releaseItemClosed = (i) => (i.category ? i.category === "Completed" : i.state === "Closed");   // R18: through QA
    ```
    The normaliser's item map keeps `category` when it is one of the four and `closed` when it is a valid day, and the
    ado block keeps the flag: `if (r.ado.statesMissing === true) out.ado.statesMissing = true;`. `releaseStateCounts`
    carries the category and sorts by it, so the drawer shows Ny · Codereview · Develop · QA · Closed:
    ```js
    const CATEGORY_ORDER = ["Proposed", "InProgress", "Resolved", "Completed"];
    /** The items by state in ADO's category order (Ny · Codereview · Develop · QA · Closed); without a category, ADO's old order. */
    function releaseStateCounts(r) {
      const counts = new Map();
      ((r && r.ado && r.ado.items) || []).forEach((i) => {
        const c = counts.get(i.state) || { state: i.state, count: 0 };
        c.count++;
        if (i.category && !c.category) c.category = i.category;
        counts.set(i.state, c);
      });
      const rank = (s) => { const k = STATE_ORDER.indexOf(s); return k < 0 ? STATE_ORDER.length : k; };
      const cat = (c) => (c.category ? CATEGORY_ORDER.indexOf(c.category) : rank(c.state));   // New ~ Proposed, Active ~ InProgress, …
      return [...counts.values()].sort((a, b) => cat(a) - cat(b) || rank(a.state) - rank(b.state) || a.state.localeCompare(b.state));
    }
    ```
    `releaseItemClosed` joins `module.exports`; in the d.ts both rules take what the drawer's state counts carry too:
    `export declare function releaseItemDone(item: { state: string; category?: string }): boolean;` and
    `export declare function releaseItemClosed(item: { state: string; category?: string }): boolean;`;
    the d.ts's `releaseStateCounts` returns `{ state: string; count: number; category?: ReleaseItem["category"] }[]`, and
    `ReleaseAdo` gains `statesMissing?: true`. The drawer's chips keep `releaseItemDone(s)` for their green: the count
    carries the category now.

- [ ] **Step 4: Run them to verify they pass**, then the whole suite and the types

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: PASS. Without a map the names decide, so the earlier release, forecast and sync tests pass unchanged, apart from
the two expected values this task changes on purpose: 4817's `closed` day and the `paceWiql` string.

- [ ] **Step 5: Commit**

```bash
git add src/features/ado src/features/timeline/merge.ts src/features/timeline/epic-tools.js src/features/timeline/epic-tools.d.ts src/features/timeline/epic-tools.test.ts
git commit -m "ADO: stories and bugs count by their state's category, so Develop and QA count as developed (R18)"
```

### Task 2: two dates, the phase, the expected release, the events (spec §3, §4, §6)

**Files:**
- Modify: `src/features/timeline/merge.ts`, `src/features/timeline/epic-tools.js` + `.d.ts`, `src/features/timeline/events.ts`,
  `src/features/timeline/report.ts` (the sprint report's release line), `src/features/ado/releases.ts` (the history
  point's closed counts)
- Test: `epic-tools.test.ts`, `events.test.ts`, `report.test.ts`, `releases.test.ts`

**Interfaces:**
- Consumes: `releaseItemDone`, `releaseItemClosed` (Task 1).
- Produces: `Release.qaDate?`, `Release.openAtShip?`; `ReleaseHistoryPoint.closedPoints?`, `.closed?`;
  `releaseDevTarget(r) → string`; `releaseProgress(r)` + `closed`, `pointsClosed`, `closedFraction`;
  `releasePhase(r) → "utvikling" | "qa" | "sluppet"`; `releaseExpected(plan, r, todayDay) → string`;
  `releaseQaText(r, todayDay) → string`; `releaseBurndownData(…)`: `targetDay` = the dev target, + `releaseDay`, `qaDay`,
  `closedActual: { day, remaining }[]`;
  `nextReleaseText(…)` + `phase`; event `release.qa`.

- [ ] **Step 1: Write the failing tests** in `epic-tools.test.ts` (import the new names):

```ts
describe("R18: a release in two phases", () => {
  const TODAY = "2026-10-16";
  const it_ = (id: number, state: string, category: string, points: number, delivered?: string, closed?: string) =>
    ({ id, type: "User Story", title: "s" + id, state, category, points, assignee: null, ...(delivered ? { delivered } : {}), ...(closed ? { closed } : {}) });
  const rel = (over: Record<string, unknown> = {}, items = [it_(1, "Develop", "Resolved", 3, "2026-10-12"), it_(2, "Codereview", "InProgress", 5), it_(3, "Closed", "Completed", 2, "2026-10-08", "2026-10-14")]) =>
    normalizePlan({ lanes: [], tasks: [], sprints: { at: "", items: [{ name: "Sprint 71", path: "Skytale\\Sprint 71", start: "2026-10-05", finish: "2026-10-23" }] },
      releases: [{ key: "r1", version: "2.0.1", targetDate: "2026-10-27", qaDate: "2026-10-20", ado: { at: TODAY + "T08:00:00Z", label: "2.0.1", items, history: [] }, ...over }] }).releases![0];

  it("the normaliser keeps «Klar for QA» as a valid day and the open ids only while «Sluppet» is set", () => {
    expect(rel().qaDate).toBe("2026-10-20");
    expect(rel({ qaDate: "2026-02-30" }).qaDate).toBeUndefined();
    expect(rel({ shippedDate: "2026-10-27", openAtShip: [2, 2, -1, "x"] }).openAtShip).toEqual([2]);
    expect(rel({ openAtShip: [2] }).openAtShip).toBeUndefined();
  });
  it("progress counts developed and closed apart; the dev target is «Klar for QA», else «Release»", () => {
    const pr = releaseProgress(rel());
    expect(pr).toMatchObject({ pointsDone: 5, pointsTotal: 10, pointsClosed: 2 });
    expect(pr.closedFraction).toBeCloseTo(0.2, 9);
    expect(releaseDevTarget(rel())).toBe("2026-10-20");
    expect(releaseDevTarget(rel({ qaDate: undefined }))).toBe("2026-10-27");
  });
  it("the phase: development while something is not developed, QA when all is, sluppet once out", () => {
    expect(releasePhase(rel())).toBe("utvikling");
    expect(releasePhase(rel({}, [it_(1, "QA", "Resolved", 3, "2026-10-12"), it_(2, "Closed", "Completed", 5, "2026-10-13", "2026-10-15")]))).toBe("qa");
    expect(releasePhase(rel({ shippedDate: "2026-10-27" }))).toBe("sluppet");
  });
  it("a late handover pushes the expected release by the same working days; on time it is the release date", () => {
    const p = (r: unknown) => normalizePlan({ lanes: [], tasks: [], releases: [r] });
    const onTime = rel({}, [it_(1, "QA", "Resolved", 3, "2026-10-12")]);
    expect(releaseExpected(p(onTime), onTime, TODAY)).toBe("2026-10-27");
    // «Klar for QA» passed, a story in review, no tempo (nothing developed since the clock started 12.10):
    // development runs at least to today, two working days late (15, 16) → 27.10 + 2
    const stalled = rel({ qaDate: "2026-10-14" }, [it_(2, "Codereview", "InProgress", 5), it_(3, "Closed", "Completed", 2, "2026-10-08", "2026-10-09")]);
    expect(releaseExpected(p(stalled), stalled, TODAY)).toBe("2026-10-29");
    // with a tempo (3 SP in the five working days since 12.10) development ends on the tempo's day 29.10,
    // eleven working days after 14.10 → 27.10 + 11
    const late = rel({ qaDate: "2026-10-14" });
    expect(releaseExpected(p(late), late, TODAY)).toBe("2026-11-11");
  });
  it("the tempo aims at «Klar for QA» and says «utviklet»", () => {
    const late = rel({ qaDate: "2026-10-14" });
    expect(releasePace(normalizePlan({ lanes: [], tasks: [], releases: [late] }), late, TODAY)!.text)
      .toBe("50 % utviklet · 100 % av tiden brukt · med dagens tempo klar for QA 29. okt, elleve arbeidsdager etter");
  });
  it("the QA sentence per phase", () => {
    expect(releaseQaText(rel(), TODAY)).toBe("Klar for QA 20. okt · release 27. okt");
    expect(releaseQaText(rel({}, [it_(1, "QA", "Resolved", 3, "2026-10-12"), it_(2, "Closed", "Completed", 5, "2026-10-13", "2026-10-15")]), TODAY)).toBe("I QA: 1 av 2 lukket · release 27. okt");
    expect(releaseQaText(rel({ shippedDate: "2026-10-27", openAtShip: [2] }), TODAY)).toBe("Sluppet 27. okt · 1 åpen ved release");
  });
  it("the burndown carries a second series (not closed yet) and the QA day", () => {
    const d = releaseBurndownData(normalizePlan({ lanes: [], tasks: [], releases: [rel()] }), rel(), TODAY)!;
    expect(d).toMatchObject({ qaDay: "2026-10-20", targetDay: "2026-10-20", releaseDay: "2026-10-27" });   // the ideal line ends at «Klar for QA»
    expect(d.closedActual.at(-1)).toEqual({ day: TODAY, remaining: 8 });   // 10 SP, 2 closed
  });
});
```

In `events.test.ts` (with the file's own plan/diff helpers):

```ts
it("R18: «Klar for QA» is logged; moved later it asks why; the release date and «Sluppet» read in the new words", () => {
  const planWith = (releases: unknown[]) => normalizePlan({ lanes: [], tasks: [], releases });
  const a = { key: "r1", v: 1, version: "2.0.1", targetDate: "2026-10-27", qaDate: "2026-10-20" };
  const evs = diffPlans(planWith([a]), planWith([{ ...a, qaDate: "2026-10-23", targetDate: "2026-10-29", shippedDate: "2026-10-29", openAtShip: [7, 8] }]));
  expect(evs.find((e) => e.code === "release.qa")!.summary).toBe("Klar for QA: 20. okt → 23. okt");
  expect(needsReason(evs.find((e) => e.code === "release.qa")!)).toBe(true);
  const earlier = diffPlans(planWith([a]), planWith([{ ...a, qaDate: "2026-10-19" }])).find((e) => e.code === "release.qa")!;
  expect(needsReason(earlier)).toBe(false);   // earlier is good news: no reason asked
  expect(evs.find((e) => e.code === "release.maldato")!.summary).toBe("Release: 27. okt → 29. okt");
  expect(evs.find((e) => e.code === "release.skippet")!.summary).toBe("Sluppet 29. okt · 2 åpne ved release");
});
```
(`normalizePlan` is imported in `events.test.ts` already.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/features/timeline`
Expected: FAIL (`releaseDevTarget is not a function`, the event summaries differ).

- [ ] **Step 3: Implement.**
  - `merge.ts`: `Release` gains `qaDate?: string; openAtShip?: number[];`; `ReleaseHistoryPoint` gains `closedPoints?: number; closed?: number;`.
    `events.ts`'s event code list gains `"release.qa"`.
  - Normaliser (the releases block): `if (validDay(r.qaDate)) out.qaDate = r.qaDate;` and, after `shippedDate`,
    `if (out.shippedDate && Array.isArray(r.openAtShip)) { const ids = [...new Set(r.openAtShip.filter((n) => Number.isInteger(n) && n > 0))]; if (ids.length) out.openAtShip = ids; }`;
    the history point keeps `closedPoints` and `closed` when finite and ≥ 0.
  - Rules:
    ```js
    function releaseDevTarget(r) { return r.qaDate || r.targetDate; }   // R18: development aims at «Klar for QA»
    function releaseClosedBy(r, day, usePoints) {
      return ((r.ado && r.ado.items) || []).filter((i) => releaseItemClosed(i) && (!i.closed || i.closed <= day)).reduce((s, i) => s + (usePoints ? i.points || 0 : 1), 0);
    }
    function releasePhase(r) {
      if (r.shippedDate) return "sluppet";
      const items = (r.ado && r.ado.items) || [];
      return items.length && items.every(releaseItemDone) ? "qa" : "utvikling";
    }
    function releaseExpected(plan, r, todayDay) {   // the expected release day: «Release» plus the working days development runs past «Klar for QA»
      if (r.shippedDate) return r.shippedDate;
      const pace = releasePace(plan, r, todayDay);
      if (!r.qaDate) return laterDay((pace && pace.forecastDay) || r.targetDate, todayDay);
      const items = (r.ado && r.ado.items) || [];
      const finished = releasePhase(r) === "qa" ? items.map((i) => i.delivered).filter(Boolean).sort().pop() || todayDay : null;
      const devEnd = finished || (pace && pace.forecastDay) || laterDay(todayDay, r.qaDate);
      const slip = devEnd > r.qaDate ? workDaysBetween(r.qaDate, devEnd) : 0;
      return laterDay(addWorkDays(r.targetDate, slip), todayDay);
    }
    function releaseQaText(r, todayDay) {
      const phase = releasePhase(r), items = (r.ado && r.ado.items) || [];
      if (phase === "sluppet") { const n = (r.openAtShip || []).length; return "Sluppet " + dayWords(r.shippedDate) + (n ? " · " + n + (n === 1 ? " åpen" : " åpne") + " ved release" : ""); }
      if (phase === "qa") return "I QA: " + items.filter(releaseItemClosed).length + " av " + items.length + " lukket · release " + dayWords(r.targetDate);
      const s = (r.qaDate ? "Klar for QA " + dayWords(r.qaDate) + " · " : "") + "release " + dayWords(r.targetDate);
      return s[0].toUpperCase() + s.slice(1);   // «Release 27. okt» without a QA date
    }
    ```
    (`laterDay` is R16's helper, already in the file.) `releaseProgress` adds
    `closed = items.filter(releaseItemClosed).length`, `pointsClosed`, `closedFraction` (by points when any, else by count;
    the branch without a read-back returns `closed: 0, pointsClosed: 0, closedFraction: null`).
    `releasePace` measures against `releaseDevTarget(r)` wherever it read `r.targetDate` (`totalDays`, `elapsed`, `past`,
    `deltaDays`; the clock's start still comes from the segment, which ends at «Release»). Its words follow D9 and aim at
    «Klar for QA» when it is set:
    ```js
    const qa = !!r.qaDate, ref = qa ? "" : " målet";   // R18: with a QA date the sentence aims at it
    const head = pct(done) + " utviklet · " + pct(elapsed) + " av tiden brukt";
    const tail = done >= 1 ? (qa ? "alt utviklet · QA tar over" : "alt utviklet · sett «Sluppet» når den er ute")
      : forecastDay ? "med dagens tempo " + (qa ? "klar for QA " : "ferdig ") + dayWords(forecastDay) +
        (deltaDays === 0 ? (qa ? ", på dagen" : ", på målet") : deltaDays > 0 ? ", " + daysWords(deltaDays) + " etter" + ref : ", " + daysWords(-deltaDays) + " før" + ref)
      : startDay > todayDay ? "tempo regnes fra " + dayWords(startDay)   // the clock has not started: the items sit in a coming sprint
      : units.done === 0 ? "ingenting utviklet ennå" : "ingenting utviklet siden " + dayWords(startDay);
    ```
    `releaseProgress`'s text says «utviklet» too («2 bugs, 1 story · 7/10 SP utviklet», «2 av 3 utviklet»).
    `releaseBurndownData` returns `targetDay: releaseDevTarget(r)` (the ideal line ends there), `releaseDay: r.targetDate`,
    `qaDay: r.qaDate || null` and `closedActual` built like `actual` with `releaseClosedBy`; `endDay` still includes
    `r.targetDate`. `nextReleaseText` adds `phase: releasePhase(r)`. In R16, `deliveryComputed`'s release line becomes
    `take(releaseExpected(plan, r, todayDay), { kind: "release", key: r.key, name: r.version })` and `deliveryBugsLeft`
    counts `!releaseItemClosed(i)`.
  - `events.ts`: after the `release.maldato` line:
    ```ts
    if ((b.qaDate ?? null) !== (r.qaDate ?? null)) ev.push({ ...rbase(r), code: "release.qa", before: b.qaDate ? { date: b.qaDate } : null, after: r.qaDate ? { date: r.qaDate } : null,
      summary: !b.qaDate ? "Klar for QA satt: " + dayWords(r.qaDate!) : !r.qaDate ? "Klar for QA fjernet" : "Klar for QA: " + dayWords(b.qaDate) + " → " + dayWords(r.qaDate) });
    ```
    the `release.maldato` summary reads `"Release: " + …`, `release.skippet` reads
    `"Sluppet " + dayWords(r.shippedDate) + (n ? " · " + n + (n === 1 ? " åpen" : " åpne") + " ved release" : "")` (`n = r.openAtShip?.length ?? 0`)
    and `"Sluppet-dato fjernet"`. In `needsReason`, a later «Klar for QA» asks why (D8); setting it the first time,
    removing it or moving it earlier does not:
    `case "release.qa": { const b = e.before as { date: string } | null, a = e.after as { date: string } | null; return !!b && !!a && a.date > b.date; }`
  - `report.ts`, the release line: `(r.shippedDate ? "sluppet " + dayWords(r.shippedDate) : (r.qaDate ? "klar for QA " + dayWords(r.qaDate) + " · release " : "mål ") + dayWords(r.targetDate))`.
  - `releases.ts`: the day's history point adds `closedPoints: pr.pointsClosed, closed: pr.closed`.
  - d.ts:
    ```ts
    export declare function releaseDevTarget(r: Release): string;
    export declare function releasePhase(r: Release): "utvikling" | "qa" | "sluppet";
    export declare function releaseExpected(plan: Plan, r: Release, todayDay: string): string;
    export declare function releaseQaText(r: Release, todayDay: string): string;
    ```
    `releaseProgress`'s return type gains `closed: number; pointsClosed: number; closedFraction: number | null`,
    `releaseBurndownData`'s gains `releaseDay: string; qaDay: string | null; closedActual: { day: string; remaining: number }[]`,
    `nextReleaseText`'s gains `phase: "utvikling" | "qa" | "sluppet"`. The four functions join `module.exports`
    (`releaseClosedBy` stays inside).

- [ ] **Step 4: Run them to verify they pass**, then the whole suite

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: PASS. Earlier assertions on these sentences change to the new words, and only those (spec §6, D4, D9):
- `events.test.ts`: release summaries «Måldato: …» → «Release: …» and «Skippet …» → «Sluppet …». An epic's «Måldato» is
  not a release, so it stays.
- `epic-tools.test.ts`:
  - `releaseProgress` «7/10 SP levert», «2 av 3 levert» → «utviklet»;
  - `releasePace` «0 % utviklet … ingenting utviklet ennå», «38 % utviklet … ingenting utviklet siden 5. okt», «100 %
    utviklet … alt utviklet · sett «Sluppet» når den er ute».
- `releases.test.ts`:
  - «Lest fra ADO: 2 bugs, 2 stories · 8/19 SP utviklet»;
  - the history points in the first test and in the forecast test gain `closedPoints: 3, closed: 1` for 2.0.1 (4817) and
    `closedPoints: 0, closed: 0` for 2.0.2.
- `report.test.ts`: «- 2.0.1: mål 22. okt · 1 bug, 1 story · 10/79 SP utviklet · 13 % utviklet · …».

Delivery and investor sentences («alt levert», «levert innenfor lovet spenn») mean shipped to customers, and they stay.

- [ ] **Step 5: Commit**

```bash
git add src/features/timeline src/features/ado/releases.ts src/features/ado/releases.test.ts
git commit -m "Tidslinjen: a release has «Klar for QA» and «Release», a phase, an expected release day and «Sluppet» with what was open (R18)"
```

### Task 3: the chance against «Klar for QA» (spec §5)

**Files:** Modify `src/features/ado/forecast.ts` (`readForecast`'s window), `src/features/timeline/epic-tools.js`
(`releaseForecastText`); Test `forecast.test.ts`, `epic-tools.test.ts`.

**Interfaces:** Consumes `releaseDevTarget`, `releasePhase` (Task 2). Produces the forecast aimed at the dev target.

- [ ] **Step 1: Write the failing tests.** In `forecast.test.ts`'s `describe("readForecast")` (its `planWith`, `fakeClient`,
  `CAP`, `items` and `NOW` = 13.10):

```ts
  it("R18: with «Klar for QA» the window runs to the QA day, not the release day", async () => {
    const plan = planWith([S68, S69, S70, S71, S72]);
    plan.releases![0].qaDate = "2026-10-20";
    const { client } = fakeClient(CAP);
    expect(await readForecast(plan, plan.releases![0], items, client, NOW, {})).toMatchObject({ days: 5 });   // 13–19 Oct
  });
```
  In `epic-tools.test.ts`:

```ts
  it("R18: the chance's sentence aims at «Klar for QA» when it is set", () => {
    const fc = { day: "2026-10-16", need: 8, days: 3, p: 0.44, mean: 7, p10: 4, p90: 9, people: [], basis: [], capacity: [] };
    const r = { key: "r1", version: "2.0.1", targetDate: "2026-10-27", qaDate: "2026-10-20", ado: { at: "x", label: "2.0.1", items: [], forecast: fc } };
    expect(releaseForecastText(r as never, "2026-10-16")!.text).toBe("44 % sjanse for at alt er utviklet til klar for QA 20. okt");
    expect(releaseForecastText({ ...r, qaDate: undefined } as never, "2026-10-16")!.text).toBe("44 % sjanse for at alt er utviklet til 27. okt");   // D9
    const developed = { ...r, ado: { ...r.ado, items: [{ id: 1, type: "Bug", title: "", state: "QA", category: "Resolved", points: 3, assignee: null }] } };
    expect(releaseForecastText(developed as never, "2026-10-16")).toBeNull();   // in QA there is no chance (spec §5)
    expect(releaseForecastText({ ...developed, qaDate: undefined } as never, "2026-10-16")).not.toBeNull();   // one phase reads as today (D7)
  });
```
- [ ] **Step 2: Run them to verify they fail** — `npx vitest run src/features/ado/forecast.test.ts src/features/timeline/epic-tools.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `readForecast`: `const window = forecastWindow(today, releaseDevTarget(r));` (import from
  epic-tools). `releaseForecastText`: `if (!f || (r.qaDate && releasePhase(r) === "qa")) return null;`, and the text's tail is `(r.qaDate ? " for at alt er utviklet til klar for QA " + fmtDate(dayOf(r.qaDate)) : " for at alt er utviklet til " + fmtDate(dayOf(r.targetDate)))`.
  The two existing `releaseForecastText` assertions in `epic-tools.test.ts` («44 % sjanse for at alt er levert til 22. okt»,
  «… · regnet 13. okt») read «utviklet» (D9).
- [ ] **Step 4: Run them to verify they pass** — `npx vitest run && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Tidslinjen: the chance is for development, aimed at «Klar for QA» (R18)"`

### Task 4: Tidslinjen — the editor, the drawer, the band, the strip, the help (spec §7)

**Files:** Modify `src/app/timeline/timeline.html`; Create `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-release-r18-smoke.mjs`
(R18-1…R18-8, behind the design review's mock API); Modify any smoke that reads «Måldato», «Skippet» or the strip's «levert».

**Interfaces:** Consumes everything from Tasks 1–3.

- [ ] **Step 1: Write the failing smoke** `hosted-release-r18-smoke.mjs`:

```js
// hosted-release-r18-smoke.mjs: R18, a release in two phases, on Tidslinjen and Kunder behind the design review's mock API
// (its sample plan, with release 2.0.1's items set as the server's read-back would after R18). R18-1…R18-8.
// Run from the worktree:  NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-release-r18-smoke.mjs
import { createRequire } from "node:module";
import { startServer, richPlan } from "/Users/dnumreig/Skytale/ClaudeReports/planning/ux-review-2026-10/harness.mjs";
import tools from "/Users/dnumreig/Skytale/SkyTracker-wt-epics/src/features/timeline/epic-tools.js";
const require = createRequire("/Users/dnumreig/ptt-e2e/package.json");
const { chromium } = require("playwright");
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); };
const TODAY = new Date(2026, 9, 16, 10);
const item = (id, state, category, points, delivered, closed) => ({ id, type: "User Story", title: "Sak " + id, state, category, points, assignee: null, iteration: "Sprint 71", ...(delivered ? { delivered } : {}), ...(closed ? { closed } : {}) });
function planWith(items, over = {}) {
  const p = richPlan(), r = p.releases.find((x) => x.key === "r201");
  Object.assign(r, { targetDate: "2026-10-27", qaDate: "2026-10-20", ...over });
  r.ado = { at: "2026-10-16T08:00:00Z", label: "2.0.1", items, history: [] };
  return tools.normalizePlan(p);
}
const DEV = [item(1, "Develop", "Resolved", 3, "2026-10-12"), item(2, "Codereview", "InProgress", 5), item(3, "Closed", "Completed", 2, "2026-10-08", "2026-10-14")];
const QA = [item(1, "QA", "Resolved", 3, "2026-10-12"), item(3, "Closed", "Completed", 2, "2026-10-08", "2026-10-14")];
const rel = () => srv.api.stored().data.releases.find((r) => r.key === "r201");
const browser = await chromium.launch();
const srv = await startServer({ scenario: "rich" });
async function open(plan, path = "/timeline") {
  srv.api.set(plan); srv.api.role("writer");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "nb-NO", timezoneId: "Europe/Oslo" });
  const page = await ctx.newPage(); await page.clock.setFixedTime(TODAY);
  await page.goto(srv.base + path); await page.waitForSelector(path === "/kunder" ? "table.lines" : ".lane-label"); await page.waitForTimeout(600);
  return { ctx, page };
}
const drawer = async (page) => { await page.click('.axis .release[data-key="r201"]'); await page.waitForSelector("#relDrawer:not([hidden])"); };

{ // R18-1: in development: the head, the two sections, the states by category with their real names
  const { ctx, page } = await open(planWith(DEV)); await drawer(page);
  assert(/^I utvikling · klar for QA 20\. okt · release 27\. okt · /.test(await page.textContent("#relSub")), "R18-1: the head says the phase");
  const h = await page.$$eval("#relBody .rel-phase h3", (hs) => hs.map((x) => x.textContent));
  assert(JSON.stringify(h) === JSON.stringify(["Utvikling — til klar for QA 20. okt", "QA — til release 27. okt"]), "R18-1: two sections: " + h);
  const chips = await page.$$eval("#relBody .rel-states .chip", (cs) => cs.map((c) => c.textContent.split(" ")[0]));
  assert(JSON.stringify(chips) === JSON.stringify(["Codereview", "Develop", "Closed"]), "R18-1: the states: " + chips);
  await ctx.close();
}
{ // R18-2: the editor: who sets «Klar for QA»; after «Release» it is refused; moved later it asks why and saves
  const { ctx, page } = await open(planWith(DEV)); await drawer(page); await page.click("#relEdit"); await page.waitForSelector("#relBack.open");
  assert(/settes av utviklingsleder/.test(await page.textContent("#relBack")) && /settes av Operations/.test(await page.textContent("#relBack")), "R18-2: who sets which date");
  await page.fill("#relQa", "2026-10-30"); await page.click("#relSave"); await page.waitForSelector("#dlgBack.open");
  assert(/Klar for QA kan ikke være etter release-datoen/.test(await page.textContent("#dlgMsg")) && (await page.getAttribute("#relQa", "aria-invalid")) === "true", "R18-2: refused after the release"); await page.click("#dlgYes");
  await page.fill("#relQa", "2026-10-22"); await page.click("#relSave"); await page.waitForSelector("#reasonBack.open");
  await page.click('#reasonCodes button[data-code="kapasitet"]'); await page.click("#reasonSave");
  for (let i = 0; i < 40 && rel().qaDate !== "2026-10-22"; i++) await page.waitForTimeout(150);
  assert(rel().qaDate === "2026-10-22", "R18-2: saved");
  await ctx.close();
}
{ // R18-3: in QA: the strip and the head
  const { ctx, page } = await open(planWith(QA));
  const s = await page.textContent("#stRelease");
  assert(s === "Neste release 2.0.1 i QA · 1 av 2 lukket · release 27. okt", "R18-3: the strip in QA: " + s);
  await drawer(page); assert(/^I QA · release 27\. okt · /.test(await page.textContent("#relSub")), "R18-3: the head says QA");
  await ctx.close();
}
{ // R18-4: «Marker sluppet …» keeps what is open and the drawer lists it
  const { ctx, page } = await open(planWith(QA)); await drawer(page);
  await page.click("#relShip"); await page.waitForSelector("#dlgBack.open");
  assert(/1 åpen sak huskes/.test(await page.textContent("#dlgMsg")) && (await page.inputValue("#dlgInput")) === "2026-10-16", "R18-4: the dialog names the open item and today");
  await page.click("#dlgYes");
  for (let i = 0; i < 40 && !rel().shippedDate; i++) await page.waitForTimeout(150);
  assert(rel().shippedDate === "2026-10-16" && JSON.stringify(rel().openAtShip) === "[1]", "R18-4: stored: " + JSON.stringify([rel().shippedDate, rel().openAtShip]));
  await page.waitForSelector("#relBody .rel-open");   // the drawer re-renders after the save
  const left = await page.$$eval("#relBody .rel-open .id", (s) => s.map((x) => x.textContent));
  assert(JSON.stringify(left) === '["#1"]' && (await page.isHidden("#relShip")), "R18-4: listed in the drawer, the button gone: " + left);
  await ctx.close();
}
{ // R18-5: the band: the QA part and a tooltip with both dates and the expected release
  const { ctx, page } = await open(planWith(DEV));
  assert(await page.$('.axis .release[data-key="r201"] .qa-part'), "R18-5: the QA part");
  assert(/Klar for QA 20\. okt · forventet release /.test(await page.$eval('.axis .release[data-key="r201"]', (e) => e.title)), "R18-5: the tooltip");
  await ctx.close();
}
{ // R18-6: the fallback note when ADO's states were not found
  const p = planWith(DEV); p.releases.find((r) => r.key === "r201").ado.statesMissing = true;
  const { ctx, page } = await open(p); await drawer(page);
  assert(/Fant ikke ADO-tilstandene: teller Resolved og Closed/.test(await page.textContent("#relBody")), "R18-6: the note");
  await ctx.close();
}
{ // R18-7: «Klar for QA» passed with a story still in review: the expected release moves and the delivery on it is red
  const p = planWith(DEV, { qaDate: "2026-10-14", targetDate: "2026-10-16" });
  p.deliveries.find((d) => d.key === "d-skytale2").promisedDate = "2026-10-14";
  const { ctx, page } = await open(p, "/kunder");
  const row = await page.$eval('table.lines tr[data-key="d-skytale2"]', (tr) => [tr.querySelector(".pill").className, tr.querySelector(".pill + .why").textContent]);   // the status cell's line, not the owner's
  assert(/st-rod/.test(row[0]) && /dratt av release 2\.0\.1/.test(row[1]), "R18-7: red, pulled by the release: " + row);
  await ctx.close();
}
{ // R18-8: without «Klar for QA» the release reads as before (D7), in the new words (D9)
  const p = planWith(DEV); delete p.releases.find((r) => r.key === "r201").qaDate;
  const { ctx, page } = await open(p);
  const s = await page.textContent("#stRelease");
  assert(s === "Neste release 2.0.1 · mål 27. okt · 50 % utviklet · om 11 dager", "R18-8: the strip as before: " + s);
  assert(!(await page.$('.axis .release[data-key="r201"] .qa-part')), "R18-8: no QA part on the band");
  await drawer(page);
  assert(/^Mål 27\. okt · /.test(await page.textContent("#relSub")) && !(await page.$("#relBody .rel-phase")), "R18-8: the drawer as before");
  await ctx.close();
}
await browser.close(); await srv.close();
console.log("R18-1…R18-8 OK");
```

- [ ] **Step 2: Run it to verify it fails** — `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-release-r18-smoke.mjs` → FAIL at R18-1 («the head says the phase»).
- [ ] **Step 3: Implement.** The rule for every view is D7 (Global Constraints): with `r.qaDate` both dates are named;
  without it the view reads as today, in D4's and D9's words.
  - **Editor** (`#relBack`). The «Måldato» field becomes two fields, «Klar for QA» first:
    ```html
    <label class="ed-field"><span>Klar for QA</span><input id="relQa" type="date"><small class="md">settes av utviklingsleder</small></label>
    <label class="ed-field"><span>Release</span><input id="relTarget" type="date"><small class="md">settes av Operations</small></label>
    ```
    - «Skippet (dato, når den er ute)» reads «Sluppet (dato)».
    - `#relEdit`'s title reads «Versjon, klar for QA, release, sluppet, ADO-label og notat».
    - `openReleaseEditor` adds `$('relQa').value = (r && r.qaDate) || ''; $('relQa').removeAttribute('aria-invalid');`.
    - The `relSave` handler:
    ```js
    const qa = $('relQa').value;   // R18: «Klar for QA», on or before «Release»
    if(!version || !target){ askDialog('Release', 'Versjon og release-dato må fylles ut.', {confirmText:'OK', noCancel:true}); return; }
    if(qa && qa > target){ $('relQa').setAttribute('aria-invalid', 'true'); askDialog('Release', 'Klar for QA kan ikke være etter release-datoen.', {confirmText:'OK', noCancel:true}); return; }
    $('relQa').removeAttribute('aria-invalid');
    // …, for an existing release, before its dates are overwritten:
    else if(r.targetDate !== target){ lines.push('Release ' + r.version + ': release ' + relDay(r.targetDate) + ' → ' + relDay(target)); if(target > r.targetDate) pendingNote.reasonCode = 'ekstern'; }   // was «måldato»
    if(r.qaDate && qa && qa > r.qaDate) lines.push('Release ' + r.version + ': klar for QA ' + relDay(r.qaDate) + ' → ' + relDay(qa));
    // …, after r.targetDate = target:
    if(qa) r.qaDate = qa; else delete r.qaDate;
    if(shipped) r.shippedDate = shipped; else { delete r.shippedDate; delete r.openAtShip; }
    ```
  - **Drawer head.** `releaseSubText`:
    ```js
    function releaseSubText(r){   // R18: with «Klar for QA» the head says the phase and both dates; without it, as before (D7)
      const pr = releaseProgress(r), ph = releasePhase(r);
      const head = r.shippedDate ? 'Sluppet ' + relDay(r.shippedDate) + (r.shippedDate !== r.targetDate ? ' · målet var ' + relDay(r.targetDate) : '')
        : !r.qaDate ? 'Mål ' + relDay(r.targetDate)
        : (ph === 'qa' ? 'I QA' : 'I utvikling · klar for QA ' + relDay(r.qaDate)) + ' · release ' + relDay(r.targetDate);
      return head + ' · ' + pr.text + (r.ado ? ' · lest fra ADO ' + whenText(r.ado.at) : '');
    }
    ```
  - **Drawer body.** `renderReleaseDrawer` keeps the note and the scope line. Today's lines from `if(pace)` to
    `burndownSvg(bd) + burndownTable(bd)` (tempo, `forecastBlock`, state chips, sprint text, scope note, chart and table)
    are written to `dev` instead of `html`. The bug and story lists stay under them, as today.
    ```js
    const ph = releasePhase(r);
    let dev = '';   // today's lines from the tempo to the chart, unchanged
    if(r.qaDate){
      html += '<section class="rel-phase"><h3>Utvikling — til klar for QA ' + esc(relDay(r.qaDate)) + '</h3>' + dev + '</section>';
      const qaBody = '<p class="rel-pace"><span>' + esc(releaseQaText(r, todayDay)) + '</span></p>' +
        group('Utviklet, ikke lukket', items.filter(i => releaseItemDone(i) && !releaseItemClosed(i)));
      html += '<section class="rel-phase"><h3>QA — til release ' + esc(relDay(r.targetDate)) + '</h3>' + qaBody + '</section>';
    } else html += dev;
    const openIds = r.openAtShip || [];
    if(openIds.length) html += '<div class="rel-open">' + group('Åpne ved release', openIds.map(id => items.find(i => i.id === id) || { id, title: '', state: '', points: 0, assignee: '' })) + '</div>';
    if(r.ado && r.ado.statesMissing) html += '<p class="md rel-note">Fant ikke ADO-tilstandene: teller Resolved og Closed</p>';
    $('relShip').hidden = (HOSTED && !canWrite) || !!r.shippedDate;
    ```
    CSS: `.rel-phase{margin-top:14px}`, `.rel-phase h3{font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px}`.
  - **The chart.** One chart serves both phases. Spec §7 asks for a burndown per section; this is a deliberate
    simplification, because the two lines share one axis and a second chart would repeat it. `burndownSvg`:
    - With `d.qaDay`, it draws `d.closedActual` as a second line: `<polyline class="closed" …><title>Ikke lukket ennå</title></polyline>`,
      with CSS `.burn .closed{fill:none;stroke:var(--text-3);stroke-width:1.5;stroke-dasharray:4 3}`.
    - The ideal line's end is labelled «klar for QA <dag>».
    - A tick (`<line class="rel-day" …>`) and the label «release <dag>» go at `d.releaseDay`.
    - The ideal line's title reads «Ideallinjen: alt utviklet til klar for QA».
    - The projection's title reads «Med dagens tempo: klar for QA <dag>».
    - Without `d.qaDay`, the labels and titles read as today, in D9's words: «mål <dag>», «Ideallinjen: alt utviklet på
      måldatoen».

    `burndownTable` gains the column «Ikke lukket» when `d.qaDay` is set. The chance chip's title reads «Andelen av 20 000
    simuleringer der alt blir utviklet».
  - **«Marker sluppet …».** Add `<button id="relShip" hidden>Marker sluppet …</button>` to the drawer foot, after `#relEdit`:
    ```js
    $('relShip').addEventListener('click', async () => {   // R18: the release process ships it; what is still open is remembered
      const r = getRelease(releaseKey); if(!r || r.shippedDate) return;
      const open = ((r.ado && r.ado.items) || []).filter(i => !releaseItemClosed(i)).map(i => i.id);
      const msg = 'Marker ' + r.version + ' som sluppet. ' + (open.length ? open.length + (open.length === 1 ? ' åpen sak huskes' : ' åpne saker huskes') + ' som åpne ved release.' : 'Alt er lukket.');
      const day = await askDialog('Marker sluppet', msg, { input: 'date', value: dayKey(new Date()), confirmText: 'Marker sluppet' });
      if(typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
      r.shippedDate = day; if(open.length) r.openAtShip = open; else delete r.openAtShip;
      r.v = (r.v || 0) + 1;
      save(); render(); renderReleaseDrawer();
    });
    ```
  - **Band** (the release segment in `render`):
    ```js
    const qaOn = !!r.qaDate && !sg.shipped;   // R18: the QA part and both dates once «Klar for QA» is set (D7)
    if(qaOn){ const q = dayToUnit(r.qaDate); if(q > a && q < b){ const qp = el('span', 'qa-part'); qp.style.left = (x(q) - x(a)) + 'px'; d.appendChild(qp); } }
    const word = sg.shipped ? 'sluppet ' : qaOn ? 'release ' : 'mål ', end = fmtDate(unitToDate(sg.end));
    t.innerHTML = (sg.shipped ? '✓ ' : '') + esc(r.version) + (wide ? ' <b>· ' + word + esc(end) + '</b>' : '');
    const exp = qaOn ? releaseExpected(state, r, dayKey(new Date())) : null;
    d.title = 'Release ' + r.version + ' · ' + word + end + ' · ' + pr.text +
      (exp ? '\nKlar for QA ' + fmtDate(unitToDate(dayToUnit(r.qaDate))) + ' · forventet release ' + fmtDate(unitToDate(dayToUnit(exp))) : '') +
      (pace ? '\n' + pace.text : '') + (fcs && fcs.short ? '\n' + fcs.text : '');
    ```
    CSS: `.release .qa-part{position:absolute;top:0;bottom:0;right:0;background:rgba(255,255,255,.35);border-left:1px dashed currentColor;pointer-events:none}`.
  - **Strip** (`updateTlSummary`, in place of the R17 sentence):
    ```js
    const r = nx.release, pr = releaseProgress(r), today = dayKey(new Date()), ph = r.qaDate ? releasePhase(r) : null;   // R18: by phase (D7)
    if(ph === 'qa') rel.textContent = 'Neste release ' + r.version + ' i QA · ' + releaseQaText(r, today).replace(/^I QA: /, '');
    else {
      const dev = releaseDevTarget(r), n = calendarDays(today, dev), day = fmtDate(unitToDate(dayToUnit(dev)));
      const when = n > 0 ? 'om ' + n + (n === 1 ? ' dag' : ' dager') : n === 0 ? 'i dag' : -n + (n === -1 ? ' dag' : ' dager') + ' på overtid';
      const goal = r.qaDate ? 'klar for QA ' + day : null;
      rel.textContent = 'Neste release ' + r.version + ' · ' + (nfc && nfc.short ? nfc.short + ' til ' + (goal || day) : (goal || 'mål ' + day)) + ' · ' +
        (pr.fraction === null ? 'ikke lest fra ADO' : Math.round(pr.fraction * 100) + ' % utviklet') + ' · ' + when;
    }
    rel.title = 'Neste release: sjansen for at alt er utviklet til ' + (r.qaDate ? 'klar for QA' : 'målet') + '; tempo-fargen står i skuffen';
    ```
  - **Help.** In the card «Releaser»:
    - «poeng levert» reads «poeng utviklet».
    - «Sett «Skippet» når den er ute.» reads «Trykk «Marker sluppet …» når den er ute; det som fortsatt er åpent, huskes.»
    - After that paragraph, add: «En release kan ha to datoer: <b>Klar for QA</b> (settes av utviklingsleder) og
      <b>Release</b> (settes av Operations). Utviklingen er ferdig når alt er i Develop, QA eller lukket, og da tar QA over
      til releasen slippes. Blir utviklingen ferdig etter «Klar for QA», flyttes forventet release like mange arbeidsdager.»
  - **Existing smokes.** Only the words R18 changes, nothing else:
    - `hosted-release-smoke.mjs`:
      - «Måldato: » → «Release: » (R2);
      - «SP levert» → «SP utviklet» (R3);
      - «% levert» → «% utviklet» (R8, R11);
      - «for at alt er levert» → «for at alt er utviklet» (R12);
      - «Skippet» → «Sluppet» in the drawer and the event (R4).
    - Any other smoke that fails on one of these words gets the same change. An epic's «Måldato» (history smoke) is not a
      release, so it stays.
- [ ] **Step 4: Run the smokes and the gates** — the R18 smoke, then the release, deliveries, history, delivery-view and ux-r17 smokes, then
  `npx vitest run && npx tsc --noEmit && npx eslint src && npx next build` → all OK.
- [ ] **Step 5: Commit** — `git add src/app/timeline/timeline.html && git commit -m "Tidslinjen: the release drawer in two phases, «Klar for QA» and «Marker sluppet», the band and the strip by phase (R18)"`

# R19: the Sprint tab (app health and the plan against the sprint) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fifth tab «Sprint» that shows the development lead, for produktforum, the open bugs and issues with two forecasts, the bug budget of the next sprint, and what the timeline expects to start in it, with what a slip costs.

**Architecture:** One read-only ADO read (`sprint-check.ts`) behind `POST /api/ado-sprint-check` caches its result in the plan as `sprintCheck` (merged by its `at`, like `sprints`). Pure rules in `epic-tools.js` turn the plan and that cache into the tab's lists and texts, so the page, Tidslinjen's strip and the tests share them. The page is plain HTML/JS like Kunder.

**Tech Stack:** Next.js 16 route handlers, plain HTML/JS pages, `epic-tools.js` (+ `epic-tools.d.ts`), vitest, Playwright smokes on the design review's harness.

**Spec:** `docs/superpowers/specs/2026-10-16-planning-system-r19-sprint-tab-design.md` (D1–D10, §2–§7). Read it with this plan.

**Base:** branch `feat/r19-sprint-tab` in `~/Skytale/SkyTracker-wt-epics`, stacked on `feat/r17-delivery-view-ux` (PR #23, head 3a9c694). Baseline 17.10: vitest 328 passing, `tsc --noEmit` clean.

## Global Constraints

- UI copy and stored text in Norwegian (bokmål), code, comments and commit messages in English; copy below is exact.
- `epic-tools.js`'s `module.exports` must equal the declarations in `epic-tools.d.ts`; every new export goes in both.
- Pages are plain HTML/JS served by a route handler behind the Entra login; `timeline/sky.css` first, then the page's own rules. No React.
- ADO is read as the signed-in person (`adoAuthFor`), never written. No PAT.
- Text meets WCAG 2.2 AA with sky.css's tokens (`--text-2` on `--raised`, `--text-4` floor); no text under 12 px.
- Colours: green and amber mean health only (R17 §6). Severity chips and counts are neutral (`--badge-bg`/`--text`).
- No `Co-Authored-By` or any Claude mention in commits or PR text (SkyTracker is a shared repo).
- Never diff or merge against `master`; the base is `feat/r17-delivery-view-ux`.
- Implementers do not run git. The controller commits each task by path.

## Where this plan departs from the spec

1. **`bugs.closedCurrent`** is added to `sprintCheck` (§3): §5's «Bugs closed so far this sprint» needs a number the spec's shape lacks.
2. **The budget share** is `budgetShare(plan) = 1 − MIX[mode]` (transition 0.45, normal 0.4), not `1 − capacityFactor(plan)`: `capacityFactor` is the inverse factor (1.82), and the spec's own example «45 %» is the share.
3. **`budgetText(check)`** takes no plan: the share is stored with the read; a mix change shows on the next read (at most an hour, or «Oppdater fra ADO»).
4. **Features «klar or aktiv»** (D6) reads as aktiv: the normaliser makes every estimate in an epic aktiv; klar is the shelf, which has no slot in the timeline.
5. **Discoveries** include registered tasks (state `ny`) as «ikke startet» or «sent»: they are discoveries not yet started.
6. **Two smoke files:** `hosted-sprint-smoke.mjs` (the tab, S1–S6 and S8) and `hosted-sprint-timeline-smoke.mjs` (S7, Tidslinjen), so the page and Tidslinjen can be built at the same time.

## Review Focus

1. **A reader with no ADO token** opens the tab with a cached check older than an hour: the refresh gets 401, and the page must still draw everything from the cache and say «Logg inn på nytt for å koble til ADO.», never blank out. Test: Task 4 S6c.
2. **Between two sprints** (Christmas: Sprint 75 ends 18 Dec, Sprint 76 starts 4 Jan): no current sprint, the next is the first after today, and section 3 says «Ingen sprint pågår». Test: Task 2 `nextSprint` gap case and Task 4 S6d.
3. **Children that are not stories:** a feature's children can be Bugs, Tasks or Removed stories, or stories in a path outside every sprint (`Skytale\Backlog`); only live User Stories count, and only the two sprints' paths fill `inNext`/`inCurrent`. Test: Task 3 «only live user stories count».
4. **Bugs without points** in the two last sprints: the forecast closes by count, and a share that rounds (45 % of 53 = 23.85) prints «≈ 24». Test: Task 2 `healthForecast` by-count case and `budgetText` rounding.
5. **A stale cache:** `check.features` has ids no longer in the plan, or a feature added after the read has no entry; stale ids are ignored and a missing entry counts as no stories. Test: Task 2 `sprintDue` stale-cache case.

## File structure

| File | Task | Responsibility |
|---|---|---|
| `src/features/timeline/merge.ts` | 1 | `SprintCheck` types on `Plan`; the merge keeps the newer `at` |
| `src/features/timeline/epic-tools.js` (+ `.d.ts`) | 1, 2, 4 | the normaliser (1); the R19 rules (2); `NAV_TABS` gains Sprint (4) |
| `src/features/timeline/merge.test.ts`, `epic-tools.test.ts` | 1, 2, 4 | their tests |
| `src/features/ado/sprint-check.ts` (+ `.test.ts`) | 3 | the ADO read |
| `src/app/api/ado-sprint-check/route.ts` | 3 | the route, for anyone signed in |
| `src/app/sprint/route.ts`, `src/app/sprint/sprint.html` | 4 | the tab |
| `~/Skytale/ClaudeReports/planning/ux-review-2026-10/harness.mjs` | 4 | `/sprint` and the mock `/api/ado-sprint-check` |
| `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-sprint-smoke.mjs` | 4 | S1–S6, S8 |
| `src/app/timeline/timeline.html` | 5 | the strip's health link; `#feature=<id>` |
| `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-sprint-timeline-smoke.mjs` | 5 | S7 |
| `…/build/all-smokes.sh`, `hosted-deliveries-smoke.mjs`, `hosted-r17-fixes-smoke.mjs` | 4, 6 | the fifth tab in the existing smokes; the new smokes in the runner |

## Execution order

- Task 1, then Task 2, one implementer at a time.
- Tasks 3, 4 and 5 in parallel: their files do not overlap. Only Task 4 touches `epic-tools.js` in that wave (the tab list).
- Task 6 by the controller: the runner, every smoke, `eslint`, `next build`, the whole-branch review.
- A `tsc` error in a file outside your task's list is another implementer's work in progress: check your own files with `npx tsc --noEmit 2>&1 | grep -E '<your paths>'`.

---

### Task 1: `sprintCheck` in the plan: type, normaliser, merge

**Files:**
- Modify: `src/features/timeline/merge.ts` (types after `Delivery`; `Plan` gains `sprintCheck?`; `mergePlans`' plan-level caches)
- Modify: `src/features/timeline/epic-tools.js` (`normalizePlan`, after the `sprintGoals` block)
- Test: `src/features/timeline/merge.test.ts`, `src/features/timeline/epic-tools.test.ts`

**Interfaces:**
- Produces (in `merge.ts`, exported):

```ts
/** R19: the Sprint tab's read of ADO (sprint-check.ts), cached in the plan; written by the server, merged by `at`. */
export type SprintCheckSprint = { name: string; end: string; openBugs: number; openIssues: number; created: number; closed: number; closedPoints: number };
export type SprintCheckFeature = { stories: number; open: number; inNext: number; inNextPoints: number; inCurrent: number };
export type SprintCheck = {
  at: string;
  current: string | null;
  next: string | null;
  statesMissing?: true;
  bugs: { open: number; A: number; B: number; C: number; D: number; none: number; inRelease: Record<string, number>; inNext: number; inNextPoints: number; closedCurrent: number };
  issues: { open: number };
  /** The last four finished sprints, oldest first. */
  sprints: SprintCheckSprint[];
  /** `points`: the next sprint's expected points (null when it could not be computed); `share`: the part for bugs and issues. */
  budget: { points: number | null; share: number; missing?: "capacity" | "history" };
  features: Record<string, SprintCheckFeature>;
};
```

`Plan` gains `sprintCheck?: SprintCheck;`.

- [ ] **Step 1: Write the failing tests**

In `merge.test.ts`, a `describe("sprintCheck (R19)")` with a helper `check(at: string, open: number): SprintCheck` filling every field (zeros, `{}` for `inRelease` and `features`, `[]` for `sprints`, `budget: { points: 53, share: 0.45 }`):

```ts
it("keeps the newer sprintCheck by its read time, the incoming one on a tie", () => {
  const base = { lanes: [], tasks: [] } as Plan;
  expect(mergePlans({ ...base, sprintCheck: check("2026-10-17T10:00:00Z", 40) }, { ...base, sprintCheck: check("2026-10-17T09:00:00Z", 30) }).sprintCheck!.bugs.open).toBe(40);
  expect(mergePlans({ ...base, sprintCheck: check("2026-10-17T09:00:00Z", 40) }, { ...base, sprintCheck: check("2026-10-17T10:00:00Z", 30) }).sprintCheck!.bugs.open).toBe(30);
  expect(mergePlans({ ...base, sprintCheck: check("2026-10-17T10:00:00Z", 40) }, { ...base, sprintCheck: check("2026-10-17T10:00:00Z", 30) }).sprintCheck!.bugs.open).toBe(30);
});
it("keeps a sprintCheck only one side has", () => {
  const base = { lanes: [], tasks: [] } as Plan;
  expect(mergePlans({ ...base, sprintCheck: check("2026-10-17T10:00:00Z", 40) }, base).sprintCheck!.bugs.open).toBe(40);
  expect(mergePlans(base, { ...base, sprintCheck: check("2026-10-17T10:00:00Z", 40) }).sprintCheck!.bugs.open).toBe(40);
  expect("sprintCheck" in mergePlans(base, base)).toBe(false);
});
```

In `epic-tools.test.ts`, a `describe("normalizePlan: sprintCheck (R19)")` with a full valid fixture `VALID` (two sprints, one feature `"f1"`, `inRelease: { "2.0.1": 11 }`, `statesMissing: true`, `budget: { points: null, share: 0.45, missing: "capacity" }`):

```ts
it("keeps a valid sprintCheck as it is", () => {
  expect(normalizePlan({ lanes: [], tasks: [], sprintCheck: structuredClone(VALID) }).sprintCheck).toEqual(VALID);
});
it.each([
  ["no read time", (c: any) => { delete c.at; }],
  ["a negative count", (c: any) => { c.bugs.C = -1; }],
  ["a count that is not a number", (c: any) => { c.issues.open = "17"; }],
  ["a label count that is not finite", (c: any) => { c.bugs.inRelease["2.0.1"] = Infinity; }],
  ["a sprint without a name", (c: any) => { c.sprints[0].name = 7; }],
  ["a sprint end that is not a day", (c: any) => { c.sprints[0].end = "17.10"; }],
  ["a share above 1", (c: any) => { c.budget.share = 1.2; }],
  ["an unknown missing reason", (c: any) => { c.budget.missing = "tid"; }],
  ["a feature count missing", (c: any) => { delete c.features.f1.inCurrent; }],
  ["a next sprint that is not a string", (c: any) => { c.next = 72; }],
])("drops the whole sprintCheck on %s", (_, spoil) => {
  const c = structuredClone(VALID); spoil(c);
  expect("sprintCheck" in normalizePlan({ lanes: [], tasks: [], sprintCheck: c })).toBe(false);
});
it("keeps only the known fields", () => {
  const c = { ...structuredClone(VALID), extra: 1, bugs: { ...structuredClone(VALID).bugs, extra: 2 } };
  expect(normalizePlan({ lanes: [], tasks: [], sprintCheck: c }).sprintCheck).toEqual(VALID);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/features/timeline/merge.test.ts src/features/timeline/epic-tools.test.ts`
Expected: FAIL in the new cases (the merge drops nothing yet, the normaliser keeps everything).

- [ ] **Step 3: Implement**

- `merge.ts`: the types above; in `mergePlans`, `const sprintCheck = newer(stored.sprintCheck, incoming.sprintCheck);`, `delete out.sprintCheck;` and `if (sprintCheck) out.sprintCheck = sprintCheck;` next to `sprints`.
- `epic-tools.js` `normalizePlan`: replace `p.sprintCheck` by a rebuilt object with exactly the fields of the type when every check passes, else `delete p.sprintCheck`. Counts: `Number.isFinite(n) && n >= 0`. `share`: finite, 0 ≤ share ≤ 1. `points`: null or a count. `missing`: absent, "capacity" or "history". `current`/`next`: string or null. `sprints[].end`: `isDay`. `statesMissing`: kept only when `=== true`. `inRelease` and `features`: plain objects (not arrays) whose keys are strings.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: all pass (328 + the new ones), tsc clean.

- [ ] **Step 5: Commit (controller)**

```bash
git add src/features/timeline/merge.ts src/features/timeline/merge.test.ts src/features/timeline/epic-tools.js src/features/timeline/epic-tools.test.ts
git commit -m "Sprint: the plan keeps the Sprint tab's ADO read as sprintCheck, normalised and merged by its read time (R19)"
```

### Task 2: the rules (`epic-tools.js`)

**Files:**
- Modify: `src/features/timeline/epic-tools.js` (a new block `/* ---------- R19: the Sprint tab ---------- */` after the R17 delivery rows; `module.exports`)
- Modify: `src/features/timeline/epic-tools.d.ts` (a `/* R19 */` block; import `SprintCheck` from `./merge`)
- Test: `src/features/timeline/epic-tools.test.ts` (a `describe("R19: the Sprint tab")`)

**Interfaces:**
- Consumes: `SprintCheck` (Task 1); the module's own `currentSprint`, `sprintDay`, `dayKey`, `dayToUnit`, `unitToDate`, `fmtDate`, `osloDay`, `normalizePlan`, `resolveQueue`, `shiftTask`, `epicStatus`, `releaseScope`, `MIX`, `WEEK`, `BACKLOG`.
- Produces (both files, exported):

```ts
export declare function nextSprint(sprints: Sprint[] | undefined | null, date: Date): Sprint | null;
/** The part of a sprint for bugs and issues: 1 − the mix's feature share (transition 0.45, normal 0.4). */
export declare function budgetShare(plan: Partial<Plan> | null | undefined): number;
/** «26. okt – 6. nov» */
export declare function sprintRangeText(s: Sprint): string;
/** The features the read asks ADO about: in an epic, aktiv, with an ADO id, the bar starting on or before the next sprint's last day. */
export declare function dueFeatureIds(plan: Plan, todayDay: string): string[];
export type DueStatus = "i gang" | "ikke startet" | "sent" | "planlagt" | "uten stories" | "ikke i ADO";
export type Due = { task: PlanTask; epic: PlanLane | null; start: string; status: DueStatus; inNext?: number; open?: number; inNextPoints?: number; inCurrent?: number };
export declare function sprintDue(plan: Plan, check: SprintCheck | null | undefined, todayDay: string): { sprint: Sprint | null; discoveries: Due[]; features: Due[] };
/** The features in work today: in an epic, aktiv, today inside the bar; by epic, then start. */
export declare function sprintInWork(plan: Plan, todayDay: string): PlanTask[];
export type SlipCost = { weeks: number; sprint: string; epic: { key: string; name: string; before: EpicStatusCode; after: EpicStatusCode; goalDate: number | null } | null };
export declare function slipCost(plan: Plan, taskId: string, todayDay: string): SlipCost | null;
export declare function slipCostText(cost: SlipCost): string;
export type HealthForecast = { now: number; afterRelease: { label: string; value: number } | null; endOfNext: { value: number; closed: number; created: number } | null };
export declare function healthForecast(check: SprintCheck, release: Release | null | undefined): HealthForecast;
export declare function budgetText(check: SprintCheck): string;
/** «43 åpne bugs · 17 issues»; "" without a check. */
export declare function healthStripText(check: SprintCheck | null | undefined): string;
export declare function sprintCheckMarkdown(plan: Plan, check: SprintCheck, todayDay: string): string;
```

The rules, from D3–D7 (the tests pin them):
- `nextSprint`: sprints sorted by start; with a current sprint (`currentSprint`), the first starting after its finish; else the first starting after `dayKey(date)`; null when none.
- `sprintDue`: the sprint is `nextSprint(plan.sprints?.items, <today as a local Date>)`; none → both lists empty. A task is due when not delivered and `t.start <= dayToUnit(next.finish) + 1e-9`. «Late» means `t.start < dayToUnit(next.start) - 1e-9`.
  - Discoveries are the tasks in state `utredes` or `ny`, on the shelf or in an epic: `utredes` → «i gang»; `ny` → «sent» when late, else «ikke startet».
  - Features are estimates in an epic in state `aktiv`. Counts come from `check.features[t.id]`, all 0 when the entry is missing. «planlagt» when `inNext > 0`, or `inCurrent > 0` and the bar has started (`t.start <= today`); else «sent» when late; else «ikke i ADO» without an `adoId`; else «uten stories».
  - Both lists sorted by start, then the epic's order in `plan.lanes` (the shelf last), then label. `epic` is the lane, null on the shelf. `start` is `dayKey(unitToDate(t.start))`.
- `slipCost`: the sprint after next is `nextSprint(sprints, <next.start as a Date>)`; none → null. Before: a normalised clone with `resolveQueue` run, the task's `end` and its epic's `epicStatus`. After: on a second clone, shift the task (`shiftTask`) so it starts at the sprint after next's start, when it starts earlier, then `resolveQueue`. `weeks = Math.round((endAfter − endBefore) / WEEK)`. The epic is the task's lane, null on the shelf.
- `slipCostText`, exact copy. `W` is «1 uke» or «N uker». The word for a status comes from `{ gronn: "grønn", gul: "gul", rod: "rød", venter: "venter på utredning", "ingen-mal": "uten måldato", tom: "tom" }`, and «(mål D)» appears only with a goal date:
  - `weeks === 0`: «starter tidligst Sprint 73 → slutten flytter seg ikke»
  - no epic: «starter tidligst Sprint 73 → slutt +W»
  - the colour changes: «starter tidligst Sprint 73 → slutt +W → «Epic» blir <after> (mål 15. des)»
  - it stays: «starter tidligst Sprint 73 → slutt +W · «Epic» er fortsatt <after> (mål 15. des)»
- `healthForecast`: `now = bugs.open`. `afterRelease`: with a release, label `releaseScope(release)` and value `max(0, open − (inRelease[label] ?? 0))`. `endOfNext`: null when `budget.points` is null or `sprints` is empty. Over the last two sprints, `avg = Σ closedPoints ÷ Σ closed`. With `Σ closedPoints > 0`, `closed = round(points × share ÷ avg)`; otherwise, by count, `closed = round(Σ closed ÷ n)`. Then `created = round(Σ created ÷ n)` and `value = max(0, open − closed + created)`.
- `budgetText`, exact copy:
  - «45 % ≈ 24 SP av ~53 · 18 SP planlagt på bugs», with `round(share × 100)`, `round(points × share)`, `round(points)` and `bugs.inNextPoints`;
  - when that last count is 0, «… · ingen SP planlagt på bugs ennå»;
  - missing capacity: «Ingen budsjett: fyll inn Capacity i ADO for <next> (Development-timer per dag og fridager)»;
  - missing history: «Ingen budsjett: ingen utviklede poeng i de to siste sprintene å regne tempo fra»;
  - points null and nothing missing: «Ingen budsjett: ingen neste sprint i ADO».
- `healthStripText`: «N åpne bugs · M issues», or «1 åpen bug» and «1 issue» for one.
- `sprintCheckMarkdown`: the lines below, then «### Utredninger som skal i gang» and «### Features som skal ha stories i <next>». Each list is one bullet per row, «- <epic or Hylla> › <label> · <assignee or «uten eier»> · <bar start> – <bar end> · <status>»; a «sent» row adds « · » + `slipCostText(slipCost(...))`; an empty list is «- Ingen». It ends with «_Lest fra ADO 17. okt 12:40_» (Oslo time, `HH:MM`), plus, when `statesMissing`, «_ADOs tilstander ble ikke funnet: alt unntatt Closed og Removed er telt som åpent._».

```
## Sprint 72 · 26. okt – 6. nov

**App-helse:** 43 åpne bugs (A 1 · B 12 · C 21 · D 9) · 17 issues
- Etter 2.0.1: ≈ 32
- Ved slutten av Sprint 72: ≈ 35 (lukker ~12, ~4 nye)

**Budsjett for bugs og issues:** 45 % ≈ 24 SP av ~53 · 18 SP planlagt på bugs
```

(«· uten grad N» follows «D 9» when `bugs.none > 0`; a forecast line that is null is left out.)

- [ ] **Step 1: Write the failing tests**

Fixtures at the top of the `describe`: `U = (y, m, d) => dateToUnit(new Date(y, m - 1, d))`; `SPR` = Sprint 70 (2026-09-28–10-09), 71 (10-12–10-23), 72 (10-26–11-06), 73 (11-09–11-20), each with `path: "Skytale\\Sprint N"`; `TODAY = "2026-10-16"`.

```ts
it("nextSprint: the sprint after the current one, the first after a gap, none after the last", () => {
  expect(nextSprint(SPR, new Date(2026, 9, 16))!.name).toBe("Sprint 72");
  expect(nextSprint(SPR, new Date(2026, 9, 24))!.name).toBe("Sprint 72");   // the weekend between 71 and 72
  expect(nextSprint([...SPR].reverse(), new Date(2026, 9, 16))!.name).toBe("Sprint 72");
  const xmas = [{ name: "Sprint 75", path: "p", start: "2026-12-07", finish: "2026-12-18" }, { name: "Sprint 76", path: "p", start: "2027-01-04", finish: "2027-01-15" }];
  expect(nextSprint(xmas, new Date(2026, 11, 28))!.name).toBe("Sprint 76");
  expect(nextSprint(SPR, new Date(2026, 10, 12))).toBeNull();
  expect(nextSprint(undefined, new Date(2026, 9, 16))).toBeNull();
});
it("budgetShare and sprintRangeText", () => {
  expect(budgetShare({ capacity: { mode: "transition", at: "x" } })).toBe(0.45);
  expect(budgetShare({ capacity: { mode: "normal", at: "x" } })).toBe(0.4);
  expect(budgetShare(null)).toBe(0.45);
  expect(sprintRangeText(SPR[2])).toBe("26. okt – 6. nov");
});
```

`sprintDue`: one plan, lanes `a` («Epic A») then `b` («Epic B»), `sprints: { at, items: SPR }`, tasks (estimates get `endLikely`/`end` four and six weeks after start):
- `d1` discovery `utredes` on the shelf, start 12.10; `d2` `ny` on the shelf, start 19.10; `d3` `ny`, start 28.10; `d4` `utredes`, start 16.11;
- `f1` in `a`, adoId 101, start 26.10; `f2` in `a`, adoId 102, start 30.10; `f3` in `b`, adoId 103, start 5.10; `f4` in `b`, adoId 104, start 19.10; `f5` in `a`, no adoId, start 2.11; `f8` in `b`, adoId 108, start 2.11;
- `f6` in `a`, `levert`; `f7` on the shelf (`klar`), start 26.10.

The check's features: `f1 { stories: 4, open: 3, inNext: 3, inNextPoints: 8, inCurrent: 0 }`, `f2 { 2, 2, 0, 0, 0 }`, `f3 { 5, 2, 0, 0, 2 }`, `f4 { 1, 1, 0, 0, 0 }` and a stale `gone { 1, 1, 1, 1, 0 }`.

```ts
it("sprintDue: discoveries and features by D6, in start order, a stale cache ignored", () => {
  const due = sprintDue(PLAN, CHECK, TODAY);
  expect(due.sprint!.name).toBe("Sprint 72");
  expect(due.discoveries.map((d) => [d.task.id, d.status])).toEqual([["d1", "i gang"], ["d2", "sent"], ["d3", "ikke startet"]]);
  expect(due.features.map((d) => [d.task.id, d.status])).toEqual([["f3", "planlagt"], ["f4", "sent"], ["f1", "planlagt"], ["f2", "uten stories"], ["f5", "ikke i ADO"], ["f8", "uten stories"]]);
  expect(due.features[2]).toMatchObject({ start: "2026-10-26", inNext: 3, inNextPoints: 8, open: 3 });
  expect(due.discoveries[0].epic).toBeNull();
  expect(due.features[0].epic!.key).toBe("b");
  expect(dueFeatureIds(PLAN, TODAY).sort()).toEqual(["f1", "f2", "f3", "f4", "f8"]);
});
it("sprintDue without sprints or without a check", () => {
  expect(sprintDue({ ...PLAN, sprints: undefined }, CHECK, TODAY)).toEqual({ sprint: null, discoveries: [], features: [] });
  expect(sprintDue(PLAN, null, TODAY).features.map((d) => d.status)).toEqual(["sent", "sent", "uten stories", "uten stories", "ikke i ADO", "uten stories"]);
});
it("sprintInWork: the features whose bar holds today", () => {
  expect(sprintInWork(PLAN, TODAY).map((t) => t.id)).toEqual(["f3"]);
});
```

`slipCost`: lane `t` («Telenor kan bygge på oss», goal 15.12), feature `x` start 26.10, `endLikely` 27.11, `end` 11.12; same sprints.

```ts
it("slipCost: one sprint later moves the end two weeks and turns the epic amber", () => {
  const c = slipCost(SLIP, "x", TODAY)!;
  expect(c).toMatchObject({ weeks: 2, sprint: "Sprint 73", epic: { key: "t", before: "gronn", after: "gul", goalDate: U(2026, 12, 15) } });
  expect(slipCostText(c)).toBe("starter tidligst Sprint 73 → slutt +2 uker → «Telenor kan bygge på oss» blir gul (mål 15. des)");
});
it("slipCost: nothing moves for a feature already after the next sprint, none without a sprint after next", () => {
  const late = normalizePlan(structuredClone(SLIP)); const x = late.tasks[0]; x.start = U(2026, 11, 9); x.endLikely = U(2026, 11, 27); x.end = U(2026, 12, 11);
  expect(slipCostText(slipCost(late, "x", TODAY)!)).toBe("starter tidligst Sprint 73 → slutten flytter seg ikke");
  expect(slipCost({ ...SLIP, sprints: { at: "x", items: SPR.slice(0, 3) } }, "x", TODAY)).toBeNull();
});
it("slipCostText: no epic, and a colour that stays", () => {
  expect(slipCostText({ weeks: 1, sprint: "Sprint 73", epic: null })).toBe("starter tidligst Sprint 73 → slutt +1 uke");
  expect(slipCostText({ weeks: 2, sprint: "Sprint 73", epic: { key: "a", name: "A", before: "gronn", after: "gronn", goalDate: null } })).toBe("starter tidligst Sprint 73 → slutt +2 uker · «A» er fortsatt grønn");
});
```

`healthForecast`/`budgetText`: `HC` = bugs `{ open: 43, A: 1, B: 12, C: 21, D: 9, none: 0, inRelease: { "2.0.1": 11 }, inNext: 6, inNextPoints: 18, closedCurrent: 7 }`, issues 17, sprints 67–70 with the last two `{ created: 5, closed: 8, closedPoints: 16 }` and `{ created: 3, closed: 12, closedPoints: 24 }`, budget `{ points: 53, share: 0.45 }`, `next: "Sprint 72"`.

```ts
it("healthForecast: after the release and at the end of the next sprint (D3, D4)", () => {
  const r = { key: "r", version: "2.0.1", targetDate: "2026-10-22" };
  expect(healthForecast(HC, r)).toEqual({ now: 43, afterRelease: { label: "2.0.1", value: 32 }, endOfNext: { value: 35, closed: 12, created: 4 } });
  expect(healthForecast(HC, { ...r, label: "2.0.1+ota.2" }).afterRelease).toEqual({ label: "2.0.1+ota.2", value: 43 });
  expect(healthForecast(HC, null).afterRelease).toBeNull();
});
it("healthForecast: by count when the bugs had no points; none without a budget or history", () => {
  const noPts = { ...HC, sprints: HC.sprints.map((s) => ({ ...s, closedPoints: 0 })) };
  expect(healthForecast(noPts, null).endOfNext).toEqual({ value: 37, closed: 10, created: 4 });
  expect(healthForecast({ ...HC, budget: { points: null, share: 0.45, missing: "capacity" } }, null).endOfNext).toBeNull();
  expect(healthForecast({ ...HC, sprints: [] }, null).endOfNext).toBeNull();
});
it("budgetText and healthStripText", () => {
  expect(budgetText(HC)).toBe("45 % ≈ 24 SP av ~53 · 18 SP planlagt på bugs");
  expect(budgetText({ ...HC, bugs: { ...HC.bugs, inNextPoints: 0 } })).toBe("45 % ≈ 24 SP av ~53 · ingen SP planlagt på bugs ennå");
  expect(budgetText({ ...HC, budget: { points: null, share: 0.45, missing: "capacity" } })).toBe("Ingen budsjett: fyll inn Capacity i ADO for Sprint 72 (Development-timer per dag og fridager)");
  expect(budgetText({ ...HC, budget: { points: null, share: 0.45, missing: "history" } })).toBe("Ingen budsjett: ingen utviklede poeng i de to siste sprintene å regne tempo fra");
  expect(budgetText({ ...HC, next: null, budget: { points: null, share: 0.45 } })).toBe("Ingen budsjett: ingen neste sprint i ADO");
  expect(healthStripText(HC)).toBe("43 åpne bugs · 17 issues");
  expect(healthStripText({ ...HC, bugs: { ...HC.bugs, open: 1 }, issues: { open: 1 } })).toBe("1 åpen bug · 1 issue");
  expect(healthStripText(null)).toBe("");
});
it("sprintCheckMarkdown: the head, the lists, a flagged row's cost and the read time", () => {
  const md = sprintCheckMarkdown({ ...PLAN, releases: [{ key: "r", version: "2.0.1", targetDate: "2026-10-22" }] } as Plan, { ...HC, features: CHECK.features, at: "2026-10-17T10:40:00Z" }, TODAY);
  expect(md.split("\n").slice(0, 8).join("\n")).toBe("## Sprint 72 · 26. okt – 6. nov\n\n**App-helse:** 43 åpne bugs (A 1 · B 12 · C 21 · D 9) · 17 issues\n- Etter 2.0.1: ≈ 32\n- Ved slutten av Sprint 72: ≈ 35 (lukker ~12, ~4 nye)\n\n**Budsjett for bugs og issues:** 45 % ≈ 24 SP av ~53 · 18 SP planlagt på bugs\n");
  expect(md).toContain("### Utredninger som skal i gang\n- Hylla › ");
  expect(md).toMatch(/- Epic B › .+ · sent · starter tidligst Sprint 73 → /);
  expect(md.trim().endsWith("_Lest fra ADO 17. okt 12:40_")).toBe(true);
  expect(sprintCheckMarkdown(PLAN, { ...HC, statesMissing: true, at: "2026-10-17T10:40:00Z" }, TODAY)).toContain("_ADOs tilstander ble ikke funnet: alt unntatt Closed og Removed er telt som åpent._");
});
```

Adjust only fixture details the rules force (a label's exact wording); never an expected status, number or copy above.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/features/timeline/epic-tools.test.ts`
Expected: FAIL: the new functions are not exported.

- [ ] **Step 3: Implement** the functions in the new block, the exports in `module.exports`, the declarations in `epic-tools.d.ts`. Keep each function next to its doc comment; reuse `releaseScope`, `epicStatus`, `resolveQueue`, `shiftTask`, `sprintDay`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit (controller)**

Message: «Sprint: the rules for the Sprint tab: the next sprint, what the timeline expects in it, what a slip costs, the forecasts, the budget and the text for produktforum (R19)». Paths: `epic-tools.js`, `epic-tools.d.ts`, `epic-tools.test.ts`.

### Task 3: the ADO read (`sprint-check.ts`) and its route

**Files:**
- Create: `src/features/ado/sprint-check.ts`
- Create: `src/features/ado/sprint-check.test.ts`
- Create: `src/app/api/ado-sprint-check/route.ts`

**Interfaces:**
- Consumes: `SprintCheck`, `SprintCheckSprint` (Task 1); `nextSprint`, `dueFeatureIds`, `budgetShare` (Task 2); `readStateMap`, `categoryOf`, `isDeveloped`, `StateMap` (`states.ts`); `parseSprints` (`sync.ts`); `forecastWindow`, `availabilityFrom`, `paceWiql`, `pacePool` (`forecast.ts`); `relTarget` (`plan-mappers.ts`); `ADO_CHILD_REL` (`config.ts`); `refreshSprints` (`push.ts`); `currentSprint`, `osloDay`, `osloDate`, `dayKey` (`epic-tools.js`).
- Produces (`sprint-check.ts`, exported):

```ts
export type SprintCheckClient = Pick<AdoClient, "wiql" | "batch" | "capacities" | "iterations" | "states">;
export function severityOf(v: unknown): "A" | "B" | "C" | "D" | "none";      // "1 - Critical" A · "2 - High" B · "3 - Medium" C · "4 - Low" D
/** Open by D2: category Proposed, InProgress or Resolved; without the map or for an unknown state, anything but Closed and Removed. */
export function isOpen(states: StateMap | null, type: string, state: string): boolean;
/** Closed: category Completed; without the map or for an unknown state, the name Closed. */
export function isClosed(states: StateMap | null, type: string, state: string): boolean;
export function openWiql(states: StateMap | null): string;
export function trendWiql(sinceDay: string): string;
/** The last finished sprints' rows (oldest first), reconstructed back from today's open counts. */
export function trendOf(openNow: { bugs: number; issues: number }, items: AdoWorkItem[], finished: Sprint[], states: StateMap | null): SprintCheckSprint[];
export async function readSprintCheck(plan: Plan, client: SprintCheckClient, now: Date): Promise<SprintCheck>;
```

- Produces (the route): `POST /api/ado-sprint-check` for anyone signed in. It answers `{ version, data }` when it committed, `{ unchanged: true }` without a plan or when someone saved first, and `adoErrorResponse(e)` on an ADO error, so a 401 becomes «ado-login».

The read, in order (spec §2):
1. **Sprints:** `plan.sprints.items` when present and every one has an `id`, else `parseSprints(await client.iterations())`. Then `today = osloDay(now)`, `current = currentSprint(sprints, osloDate(now))`, `next = nextSprint(sprints, osloDate(now))`, and `finished` = the sprints with `finish < today`, the last four.
2. **States:** `readStateMap(client, ["Bug", "Issue", "User Story"])`; null sets `statesMissing: true`.
3. **Open bugs and issues:** `batch(await wiql(openWiql(states)))`, kept by `isOpen` on type and state. For bugs: `open`, the severity counts from `Microsoft.VSTS.Common.Severity`, and `inRelease[label]` from the trimmed `Custom.Release` when it is not empty. `inNext` counts the bugs whose `System.IterationPath === next.path`, and `inNextPoints` sums their `Microsoft.VSTS.Scheduling.StoryPoints`. For issues: `open`.
4. **The trend:** `since = finished[0]?.start ?? current?.start`. With a `since`, read `batch(await wiql(trendWiql(since)))`, then `sprints = trendOf(...)` and `bugs.closedCurrent` = the closed bugs whose closed day is on or after `current.start` (0 without a current sprint).
   - In `trendOf`, days are `osloDay(new Date(stamp))` of `System.CreatedDate` and `Microsoft.VSTS.Common.ClosedDate`, and a Removed item never counts.
   - For a sprint ending on day T: `openBugs = max(0, open now − bugs created after T + bugs closed after T)`, and `openIssues` the same way.
   - `created` counts the bugs created inside the sprint, `closed` the bugs closed inside it, and `closedPoints` sums those closed bugs' points.
5. **The budget:** `share = budgetShare(plan)`. Without a next sprint, `{ points: null, share }`.
   - Otherwise read `client.capacities(next.id)`, or no members without an id. Take `availabilityFrom([{ sprint: next, ...caps }], forecastWindow(next.start, <day after next.finish>))`.
   - When it reports missing or unplanned days, or nobody, the budget is `{ points: null, share, missing: "capacity" }`.
   - Otherwise, over the last two finished sprints, build `pacePool(await batch(await wiql(paceWiql(last2))), last2, states)`. With no sprint, or no day holding any entry, the budget is `missing: "history"`.
   - Otherwise `points = Math.round(Σ over people of (their pool total ÷ pool.days.length) × Σ their shares)`.
   - An `AdoRequestError` with status 401 rethrows; any other error in this step gives `missing: "capacity"` and a `console.warn`.
6. **The due features' stories:** take the tasks of `dueFeatureIds(plan, today)` that have an `adoId`. Read `batch(adoIds)`; each feature's children are the `ADO_CHILD_REL` relations via `relTarget`, without `task.ado?.storyId` (the discovery story). Read `batch(<unique child ids>)`.
   - Per returned feature, its stories are the children of type User Story whose state is not Removed.
   - `stories` counts them, and `open` counts those that are `!isDeveloped(states, "User Story", state)`.
   - `inNext` counts the open stories with `IterationPath === next.path`, and `inNextPoints` sums their points.
   - `inCurrent` counts the open stories with `IterationPath === current.path`.
   - The entry is keyed by the task id.
7. **The result:** `{ at: now.toISOString(), current: current?.name ?? null, next: next?.name ?? null, ...(states ? {} : { statesMissing: true }), bugs, issues: { open }, sprints, budget, features }`.

The route mirrors `src/app/api/ado-sprints/route.ts`:
- `auth()`, with 401 without a session and no role check;
- `readPlan`, and `{ unchanged: true }` without a plan;
- `createAdoClient(await adoAuthFor(session, defaultTokenDeps(prisma)))`;
- `const s = await refreshSprints(stored.data, client, now)`, then `const check = await readSprintCheck(s.plan, client, now)`;
- `commitPlan(prisma, { stored, after: { ...s.plan, sprintCheck: check }, editor, note: { source: "ado" } })`;
- null → `{ unchanged: true }`, else `{ version, data: after }`, all with `NO_STORE`;
- `catch (e) { return adoErrorResponse(e); }`.

The header comment says it is a read, cached in the plan, open to readers like the sprint ruler (D1).

- [ ] **Step 1: Write the failing tests** in `sprint-check.test.ts`.

The fake client follows `releases.test.ts`'s `fake()`:
- `iterations()` returns Sprints 66–72: 66 08-03–08-14, 67 08-17–08-28, 68 08-31–09-11, 69 09-14–09-25, 70 09-28–10-09, 71 10-12–10-23 and 72 10-26–11-06, with identifiers `s66`…`s72`.
- `states(type)` returns, for Bug: New Proposed, Active and Codereview InProgress, Develop and QA Resolved, Closed Completed, Removed Removed. For Issue: New Proposed, Active InProgress, Closed Completed. For User Story: New Proposed; Active, Resolved and Codereview InProgress; Develop and QA Resolved; Closed Completed; Removed Removed.
- `wiql(q)` returns the open set for a query matching `/\[System\.State\] (NOT )?IN/`, the trend set for `/CreatedDate/`, and the pace items for `/ResolvedDate/`. It records every query.
- `batch(ids)` returns the fixtures with those ids and records the ids.
- `capacities(id)` returns, for `s72`, GO at 7.5 Development hours a day.
- `NOW = new Date("2026-10-16T08:00:00Z")`.

The open set (also inside the trend set where created after 17.08):

| id | type | state | severity | release | path | SP | created |
|---|---|---|---|---|---|---|---|
| 1 | Bug | New | 1 - Critical | 2.0.1 | Sprint 72 | 3 | 2026-10-01 |
| 2 | Bug | QA | 2 - High | 2.0.1 | Sprint 71 | 2 | 2026-09-15 |
| 3 | Bug | Active | 3 - Medium | (empty) | Sprint 72 | 5 | 2026-07-01 |
| 4 | Bug | Codereview | (none) | 2.0.2 | Sprint 71 | 0 | 2026-07-02 |
| 5 | Issue | Active | | | | | 2026-07-03 |
| 6 | Issue | New | | | | | 2026-07-04 |

The trend set adds: bug 10 created 08-20, Closed 09-02, 2 SP; bug 11 created 09-01, Closed 10-14, 3 SP; bug 12 created 09-30, Closed 10-07, 0 SP; bug 13 created 09-16, Removed; issue 20 created 10-02, Closed 10-05. The stamps are 09:00Z.

The pace items: GO resolved 2 SP every working day of Sprint 70 (bugs, `ResolvedReason` Fixed, state Closed).

The plan: lane `a`; feature `F` in `a`, aktiv, `adoId` 500, start 26.10, `ado: { storyId: 599, pushedAt: "x", snapshot: {} }`; `sprints: { at, items }` from the same seven with ids.

Work item 500 has children 501, 502, 503, 504, 505, 506 and 599, and a parent link (Hierarchy-Reverse) to 400:
- 501 is a User Story, Active, in Sprint 72, 3 SP;
- 502 is a User Story, New, in Sprint 71, 2 SP;
- 503 is a User Story, Develop, in Sprint 72, 5 SP;
- 504 is a Bug, Active, in Sprint 72;
- 505 is a User Story, Removed, in Sprint 72;
- 506 is a User Story, New, in `Skytale\Backlog`, 1 SP;
- 599 is a User Story, Active, in Sprint 72.

```ts
it("openWiql and trendWiql", () => {
  expect(openWiql(MAP)).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Bug', 'Issue') AND [System.State] IN ('Active', 'Codereview', 'Develop', 'New', 'QA')");
  expect(openWiql(null)).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Bug', 'Issue') AND [System.State] NOT IN ('Closed', 'Removed')");
  expect(trendWiql("2026-08-17")).toBe("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Bug', 'Issue') AND ([System.CreatedDate] >= '2026-08-17' OR [Microsoft.VSTS.Common.ClosedDate] >= '2026-08-17')");
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
```

`MAP` is the state map built from the same `states` fixture. The fake's options are `capacity`, `capacityError`, `pace`, `statesError` and `wiqlError`. Adjust only fixture plumbing; never an expected number above.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/features/ado/sprint-check.test.ts`
Expected: FAIL: the module does not exist.

- [ ] **Step 3: Implement** `sprint-check.ts` and the route as above.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run` and `npx tsc --noEmit 2>&1 | grep -E 'sprint-check|ado-sprint-check'`
Expected: all pass, no tsc errors in these files.

- [ ] **Step 5: Commit (controller)**

Message: «Sprint: the read behind the Sprint tab: open bugs and issues, their trend over four sprints, the next sprint's bug budget and the due features' stories, for anyone signed in (R19)». Paths: the three files.

### Task 4: the tab «Sprint» (page, route, tab list, harness, smoke)

**Files:**
- Create: `src/app/sprint/route.ts` (a copy of `src/app/kunder/route.ts` serving `src/app/sprint/sprint.html`)
- Create: `src/app/sprint/sprint.html`
- Modify: `src/features/timeline/epic-tools.js` (`NAV_TABS` gains `["sprint", "Sprint", "/sprint"]` last), `epic-tools.d.ts` (`navTabsHtml`'s `active` adds `"sprint"`), `epic-tools.test.ts` (the two `navTabsHtml` tests: five tabs, hrefs `/inntak,/timeline,/,/kunder,/sprint`)
- Modify: `~/Skytale/ClaudeReports/planning/ux-review-2026-10/harness.mjs`
- Modify: `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-deliveries-smoke.mjs` (D1: five tabs, the hrefs above), `hosted-r17-fixes-smoke.mjs` (T: add `/sprint` to the pages, `READY["/sprint"] = "#hHealth"`, «five pages» in the log line)
- Create: `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-sprint-smoke.mjs`

**Interfaces:**
- Consumes: Task 2's `sprintDue`, `sprintInWork`, `slipCost`, `slipCostText`, `healthForecast`, `budgetText`, `healthStripText`, `sprintCheckMarkdown`, `sprintRangeText`, `nextSprint`; the module's `currentSprint`, `sprintDay`, `nextReleaseText`, `progressSignal`, `progressText`, `forumDefault`, `navTabsHtml`, `wireDialogs`, `fmtDate`, `unitToDate`, `dayToUnit`, `dateToUnit`, `normalizePlan`, `focusKey`, `restoreFocus`. Task 3's route answers (`{ version, data }`, `{ unchanged: true }`, 401 `{ error: "ado-login" }`).
- Produces: the page's ids, which Task 5's smoke and Task 6 rely on: `#hHealth`, `#healthHead`, `#sevChips`, `#trend`, `#fcRelease`, `#fcNext`, `#hNext`, `#budget`, `#listDisc`, `#listFeat`, `li.due-row[data-id]` with `a.to-tl`, `.st`, `.detail`, `.cost`, `#hCur`, `#curList`, `#curClosed`, `#missing p.miss[data-missing]`, `#readAt`, `#refreshBtn`, `#copyBtn`, `#adoLogin`, `#note`. The harness also gains `api.sprintCheck(check)`, `api.sprintFail(status)` and `api.sprintCalls()`.

The page follows `kunder.html`: the same head, top bar and boot script that loads `timeline/epic-tools.js`. The GET of `api/timeline-plan` and the 10-second poll work the same way, and the page never PUTs.
- `<title>Sprint – SkyTracker</title>`, `<h1 class="sr-only">Sprint</h1>`, «Logg ut», `#roTag` «Lesetilgang» for readers.
- A hint that closes, stored as `sk.hint.sprint`: «Planen mot sprinten: åpne bugs og issues, budsjettet for neste sprint og det Tidslinjen venter skal starte. Lest fra ADO; ingenting skrives dit.»

The page's sections, top to bottom (spec §5):

1. **`<section aria-labelledby="hHealth">`, «App-helse»:**
   - `#healthHead` is `healthStripText(check)`.
   - `#sevChips` holds neutral chips «A 1», «B 12», «C 21», «D 9», plus «uten grad N» when `none > 0`.
   - `#trend` is an `<ol aria-label="Åpne bugs ved slutten av de siste sprintene">`, one `<li>` per `check.sprints`. Each holds a bar with a height in proportion to `openBugs`, the number and the sprint name.
   - `#fcRelease` reads «etter 2.0.1 ≈ 32» and is left out without a next release. Its class is `fc-down` (ok colours) when the value is below `now`, `fc-up` (warn colours) above it, and `fc-flat` when equal.
   - `#fcNext` reads «ved slutten av Sprint 72 ≈ 35 (lukker ~12, ~4 nye)», with the same classes. When `endOfNext` is null it reads «ved slutten av Sprint 72: ingen prognose uten budsjett», or «… uten historikk» when the budget exists but `sprints` is empty. It is left out without a next sprint.
2. **`<section aria-labelledby="hNext">`:**
   - `#hNext` is «Sprint 72 · 26. okt – 6. nov», or «Neste sprint» without one.
   - `#budget` is «Budsjett for bugs og issues: » + `budgetText(check)`.
   - Under `<h3>Utredninger som skal i gang</h3>` comes `#listDisc`, and under `<h3>Features som skal ha stories i Sprint 72</h3>` comes `#listFeat`. Both are `<ul>`, with `<li class="none">Ingen</li>` when empty.
   - Each row is `<li class="due-row" data-id>`. `a.to-tl` holds «Epic › Feature», or «Hylla › …» on the shelf, and links to `/timeline#feature=<id>`. Then come the assignee or «uten eier» and the bar's dates «26. okt – 11. des».
   - The chip `.st` holds the status word, neutral except «sent», which uses warn. `.detail` holds:
     - for a «planlagt» feature with `inNext > 0`: «3 stories i Sprint 72 · 8 SP»;
     - for one «planlagt» through the current sprint: «2 stories i Sprint 71»;
     - «uten stories»: «ingen åpne stories i Sprint 72»;
     - «ikke i ADO»: «ikke koblet til ADO»;
     - a «sent» feature: «ingen stories i Sprint 71 eller Sprint 72»;
     - a discovery: «utredes», «starter 28. okt» or «skulle startet 19. okt».
   - A «sent» row adds `.cost` = `slipCostText(slipCost(plan, id, today))`.
3. **`<section aria-labelledby="hCur">`:**
   - `#hCur` is «Sprint 71 · dag 5 av 10», from `sprintDay(current, today)` and `sprintDay(current, <its finish>)`, or «Ingen sprint pågår».
   - `#curList` has one row per `sprintInWork(plan, today)`. Each row shows «Epic › Feature», a dot coloured by `progressSignal(...).code` and `progressText`, or «ingen fremdrift registrert».
   - `#curClosed` reads «7 bugs lukket så langt i sprinten», or «1 bug lukket …» for one. The list and the closed count are hidden without a current sprint.
4. **Foot:** `#readAt` «Lest fra ADO 16. okt 09:40» (Oslo time), `#refreshBtn` «Oppdater fra ADO», `#copyBtn` «Kopier som tekst», and `#adoLogin` (hidden): «Logg inn på nytt for å koble til ADO.» with a link «Logg inn» to `/api/auth/signin?callbackUrl=%2Fsprint`.

The empty and missing notes in `#missing`, each a `p.miss` with its `data-missing`:
- `unread`: «Ikke lest fra ADO ennå.», followed by « Leser nå …» while the read runs;
- `sprints`: «Ingen sprinter fra ADO: lag sprintene i ADO for å se neste sprint.»;
- `states`: «Fant ikke ADOs tilstander: alt unntatt Closed og Removed er telt som åpent.»;
- `history`: «Ingen avsluttede sprinter å regne trend og prognose fra.»

The budget line already says when Capacity is missing. Without a check, sections 1 and 2's numbers are left out, but the lists still draw from the plan by `sprintDue(plan, null, today)`.

Behaviour:
- **Refreshing:** `readAdo(manual)` POSTs `api/ado-sprint-check`.
  - With `data`, the page applies the remote plan.
  - A 401 with `error: "ado-login"` shows `#adoLogin` and keeps every number drawn from the cache.
  - Any other failure sets `#note` to «ADO svarte ikke – prøv igjen».
  - `{ unchanged: true }` from a click sets «ingen endring i ADO».
  - Opened hosted, the page calls it once after the first load when there is no check or the check's `at` is more than an hour old (`SPRINT_MAX_AGE_MS = 3600000`).
- **Copying:** `#copyBtn` writes `sprintCheckMarkdown(state, check, today)` to `navigator.clipboard` and sets `#note` to «kopiert». Without a check the button is disabled.
- **Forum mode (D10):** once the role is known, the page sets `document.documentElement.classList.toggle("forum", forumDefault(<localStorage "sk.forum">, canWrite))`. In `html.forum`, body text is 18 px, `#healthHead` 40 px and h2 24 px. The page has no write controls, and refreshing and copying stay.
- **Styles:** the page's own CSS uses only sky.css tokens. Chips use `--badge-bg` and `--text`; `fc-down` uses `--ok-bg`/`--ok-fg`, `fc-up` `--warn-bg`/`--warn-fg`, and `.st.sent` warn. Each row wraps at 360 px, with no horizontal scroll.

The harness (`startServer`) gains:
- `GET /sprint`, serving `src/app/sprint/sprint.html`;
- `POST /api/ado-sprint-check`, placed before the read-only guard (readers may refresh). It counts the call. With `api.sprintFail(status)` set, it answers that status: a 401 carries `{ error: "ado-login", message: "Logg inn på nytt for å koble til ADO." }`, any other status `{ error: "ado", message }`. With `api.sprintCheck(check)` set, it stores the check on the plan, bumps the version, clears the reply and answers `{ version, data }`. Otherwise it answers `{ unchanged: true }`.

- [ ] **Step 1: The tab list**

Update the two `navTabsHtml` tests in `epic-tools.test.ts` (five tabs, `/sprint` last, `id="tab-sprint"`), and run `npx vitest run src/features/timeline/epic-tools.test.ts`. Expected: FAIL. Then add the tab and run again. Expected: PASS.

- [ ] **Step 2: Write the smoke** `hosted-sprint-smoke.mjs`, structured as `hosted-release-r18-smoke.mjs` is: `ONLY` parts, `TODAY = new Date(2026, 9, 16, 10)`, `page.clock.setFixedTime(TODAY)`, a fresh context per part, and `locale: "nb-NO"` with `timezoneId: "Europe/Oslo"`.

Its plan is `richPlan()` plus a check:
- bugs as Task 2's `HC`, with `closedCurrent: 7`;
- the sprints Sprint 67–70 with `openBugs` 41, 44, 39 and 43, and the last two as in `HC`;
- `budget { points: 53, share: 0.45 }`, `current: "Sprint 71"`, `next: "Sprint 72"`, `at: "2026-10-16T07:40:00Z"`;
- `features`: the first id of `tools.dueFeatureIds(plan, "2026-10-16")` gets `{ stories: 4, open: 3, inNext: 3, inNextPoints: 8, inCurrent: 0 }`.

When no due feature starts before 26.10 without stories, move one due feature's bar to start 19.10 so a «sent» row exists. Expected rows and texts are computed in Node with the real `tools` on `tools.normalizePlan(structuredClone(plan))`.

- **S1 (writer, then reader):**
  - `#tab-sprint` has class `on`, `aria-current="page"` and the text «Sprint»;
  - the title is «Sprint – SkyTracker», there is one `h1` «Sprint», and «Logg ut» shows;
  - a reader sees `#roTag`, `#refreshBtn` and `#copyBtn`.
- **S2:**
  - `#healthHead` reads «43 åpne bugs · 17 issues» and the chips «A 1», «B 12», «C 21», «D 9»;
  - `#trend` has four items reading 41, 44, 39 and 43;
  - `#fcRelease` reads «etter 2.0.1 ≈ 32» with class `fc-down`, and `#fcNext` «ved slutten av Sprint 72 ≈ 35 (lukker ~12, ~4 nye)» with `fc-down`;
  - with the last sprint's `created` set to 20, `#fcNext` reads «ved slutten av Sprint 72 ≈ 44 (lukker ~12, ~13 nye)» with `fc-up`.
- **S3:**
  - `#hNext` reads «Sprint 72 · 26. okt – 6. nov» and `#budget` «Budsjett for bugs og issues: 45 % ≈ 24 SP av ~53 · 18 SP planlagt på bugs»;
  - each list's `[data-id]` order and `.st` texts equal `tools.sprintDue(...)`'s, and each `a.to-tl` links to `/timeline#feature=<id>`;
  - each «sent» row's `.cost` equals `tools.slipCostText(tools.slipCost(...))`, and at least one such row exists;
  - `#hCur` reads «Sprint 71 · dag 5 av 10», `#curList`'s ids equal `tools.sprintInWork(...)`'s, and `#curClosed` reads «7 bugs lukket så langt i sprinten».
- **S4:**
  - a reader with no stored choice gets `html.forum`, and `#healthHead`'s font size there is larger than in a writer's default view;
  - a writer with `sk.forum = "1"` (set by `addInitScript`) also gets `html.forum`;
  - `#refreshBtn` stays visible in forum mode.
- **S5:** the context gets `clipboard-read` and `clipboard-write`. A click on `#copyBtn` puts exactly `tools.sprintCheckMarkdown(<normalised plan>, check, "2026-10-16")` on the clipboard.
- **S6:**
  - (a) with no check and `api.sprintCheck(check)` set before load, `api.sprintCalls()` becomes 1, `[data-missing=unread]` goes away and `#healthHead` shows the numbers;
  - (b) with a fresh check, the page makes no call on load; then `api.sprintCheck({ ...check, bugs: { ...check.bugs, open: 44 } })` and a click on `#refreshBtn` turn `#healthHead` into «44 åpne bugs · 17 issues»;
  - (c) a reader with a check three hours old and `api.sprintFail(401)` sees `#adoLogin`, while `#healthHead` still reads «43 åpne bugs · 17 issues»;
  - (d) plan sprints without Sprint 71 make `#hCur` read «Ingen sprint pågår» and hide `#curList`;
  - (e) a plan with no sprints shows `[data-missing=sprints]` and `#hNext` «Neste sprint»;
  - (f) a check with `statesMissing: true` and `budget { points: null, share: 0.45, missing: "capacity" }` shows `[data-missing=states]`, and `#budget` contains «Ingen budsjett: fyll inn Capacity i ADO for Sprint 72».
- **S8:** axe 4 (`node_modules/axe-core/axe.min.js`) runs with `runOnly: ["color-contrast", "heading-order", "landmark-one-main", "page-has-heading-one", "list", "listitem", "link-name", "button-name"]`. It finds zero violations in light and in dark (`emulateMedia({ colorScheme: "dark" })`), for a writer and in forum mode.

- [ ] **Step 3: Run the smoke to see it fail**

Run (from the worktree): `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-sprint-smoke.mjs`
Expected: FAIL at S1 (no `/sprint` page).

- [ ] **Step 4: Implement** the route, the page and the harness routes.

- [ ] **Step 5: Run it to see it pass**, and the two updated smokes:

```bash
NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-sprint-smoke.mjs
NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-deliveries-smoke.mjs
NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-r17-fixes-smoke.mjs
npx vitest run
```

Expected: every part prints its OK line; vitest passes.

- [ ] **Step 6: Commit (controller)**

Message: «Sprint: the tab «Sprint»: app health with its trend and forecasts, the next sprint's budget, what the timeline expects to start in it and what a slip costs, the current sprint, and the text for produktforum (R19)». Paths: `src/app/sprint/`, `epic-tools.js`, `epic-tools.d.ts`, `epic-tools.test.ts`. The harness and smokes live in the workspace folder and are not part of the SkyTracker commit.

### Task 5: Tidslinjen: the health link in the strip and `#feature=<id>`

**Files:**
- Modify: `src/app/timeline/timeline.html` (the strip markup near `#stRelease`; its CSS near `.status`; `updateTlSummary`; `openFromHash`; a `hashchange` listener)
- Create: `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-sprint-timeline-smoke.mjs`

**Interfaces:**
- Consumes: `healthStripText` (Task 2); the plan's `sprintCheck` (Task 1).
- Produces: `#stHealth`, an `<a>` to `/sprint`; and `/timeline#feature=<id>`, which opens that feature's editor (Task 4's rows link to it).

- In the strip, after `#stRelease`, add `<a id="stHealth" href="/sprint" hidden title="Åpne bugs og issues, fra Sprint-fanen"></a>`. `updateTlSummary` sets its text to `healthStripText(state.sprintCheck)`. It stays hidden when that is empty or the page is opened from a file, and a hidden link keeps no text. Its colour is `--accent-text`, underlined on hover; it inherits the strip's 12 px.
- `openFromHash` also matches `^#feature=(.+)$`; the id is decoded with `decodeURIComponent`.
  - An unknown id sets the save note «fant ikke featuren fra lenken» and opens nothing.
  - Otherwise the view goes to «Per epic» (`setView('epic', false)`) when another view is on, and a collapsed epic holding the task is opened.
  - The task's row, or its shelf row, is scrolled into view (`scrollIntoView({ block: "center" })`), and `openEditor(id)` is called. Readers get the editor read-only, as since R17.
  - Find the label row's element where `render` builds it (the one whose click calls `openEditor(t.id)`). Add `data-id` to it if it lacks one.
- Add `window.addEventListener("hashchange", openFromHash)`, so a second link on an open page works.

- [ ] **Step 1: Write the smoke** `hosted-sprint-timeline-smoke.mjs`, S7a–S7f, on `richPlan()` with Task 4's check:
  - **S7a:** a writer sees `#stHealth` with the text «43 åpne bugs · 17 issues» and `href="/sprint"`; without a check it is hidden and empty.
  - **S7b:** a writer opening `/timeline#feature=<a due feature in an epic>` sees `#editorBack.open`, `#edName` holding the task's label, and the row inside the viewport.
  - **S7c:** a reader opening the same link gets the editor read-only, as R17's reader rule makes it; assert the same control that `hosted-ux-r17-smoke.mjs` checks for readers.
  - **S7d:** setting `location.hash` to another feature shows that one in the editor.
  - **S7e:** an unknown id opens no editor, and the save note contains «fant ikke featuren».
  - **S7f:** a discovery on the shelf (`proxy2`) opens in the editor.
- [ ] **Step 2: Run it to see it fail**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-sprint-timeline-smoke.mjs`
Expected: FAIL at S7a.

- [ ] **Step 3: Implement**, then **Step 4: run it** and `hosted-ux-r17-smoke.mjs` and `hosted-smoke.mjs` (the strip and the editor are theirs too). Expected: every part OK.

- [ ] **Step 5: Commit (controller)**

Message: «Tidslinjen: the strip says the open bugs and issues and links to Sprint; /timeline#feature=<id> opens the feature (R19)». Path: `src/app/timeline/timeline.html`.

### Task 6: integration (controller)

- [ ] Add `hosted-sprint-smoke hosted-sprint-timeline-smoke` to the first places of the list in `all-smokes.sh`.
- [ ] Run `npx vitest run`, `npx tsc --noEmit` and `npx eslint src`. Expected: all pass, with no errors beyond the known `GapCard.tsx` lint error, if it is still there.
- [ ] Run `bash ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/all-smokes.sh`. Expected: «OK» for every smoke and «OK next build».
- [ ] Do the whole-branch review inline with `/review-branch` from this worktree. The base is `feat/r17-delivery-view-ux`, merge-base 3a9c694, and the diff is `3a9c694..HEAD`. Fix what it finds and run the checks again.
- [ ] Write the PR text in `~/Skytale/ClaudeReports/planning/roadmap-2.0/pr-body-r19.md`, without any Claude mention, and push the branch to `fork`. The PR is stacked: base `feat/r17-delivery-view-ux` in `dnumreig/SkyTracker`, so merging it adds R19 to PR #23. GO runs `gh pr create`.

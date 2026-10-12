# Tidslinjen R11: progress towards a release (tempo colour, daily history and burndown, sprint vs release, strip and report) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The release segment wears a tempo colour computed like the epics' signal, every ADO read leaves one point per day that the drawer draws as a burndown, writers' page loads re-read stale labels through a light route, the drawer sets the sprint against the release, and the status strip and the sprint report say where the next release stands.

**Architecture:** All rules are pure functions in `epic-tools.js` (shared by the page, the server and vitest): working-day arithmetic, `releasePace`, `nextReleaseText`, `releaseStateCounts`, `releaseSprintText`, `releaseBurndownData`, the unlabelled-sprint WIQL and the normaliser's validation of the new fields. `features/ado/releases.ts` reads the iteration per item, upserts the day's history point, counts the unlabelled items per sprint and keeps `ado.at` as the last read. A new route `api/ado-releases` runs only that read. The page colours the segment, extends the drawer (pace line, state chips, sprint line, inline-SVG burndown with a table twin), calls the light route on load when stale, and extends the summary strip; `report.ts` gains a «Releaser» section.

**Tech Stack:** as R10 (Next.js 16 route handlers, Prisma 7 via `plan-store`, vitest 4, the plain-JS page, Playwright smokes behind a mock API run with `npx tsx`).

**Spec:** `docs/superpowers/specs/2026-10-12-planning-system-r11-release-progress-design.md` (amends the R10 design beside it).

## Global Constraints

- Additive data only: `ReleaseItem.iteration?`, `Release.ado.history?`, `Release.ado.sprints?`. No schema change, no migration. Releases keep whole-object versioning (`v`).
- `module.exports` of `epic-tools.js` must equal `epic-tools.d.ts` (CLAUDE.md). Every new export is declared in both.
- Nothing is written to ADO. The light route is for writers (`session.role === "writer"`), like `api/ado-refresh`; readers draw from the cache.
- Norwegian in everything a person reads, English in code and commits, no em dashes. Status colours always come with their word (chip text, tooltip, strip text), never colour alone.
- Working days are Mon–Fri; days are `YYYY-MM-DD` strings compared as strings; «today» is the local day (`dayKey(new Date())`).
- TDD per task: the failing test first, then the code; `NODE_OPTIONS=` in front of every `npx`/`npm` (the shell's NODE_OPTIONS points at a deleted file). One commit per task with `git commit` (no signing configured), no Claude attribution, no push (GO pushes to `fork`).
- Never the shared database; the route is untested against Postgres like its siblings; the pure functions carry the tests.

## Review Focus

1. A release whose items sit in a sprint the cached sprint list does not know (or with no sprint at all): expected the clock starts at the segment's start, never a crash (Task 1 `releaseStartDay` test with «Sprint 99»).
2. The target day before the computed start, or today before the start: expected `elapsed` clamps to 1 or 0, no division by zero, green before the start (Task 1 test «today before the start»).
3. Two readings on the same day (a writer refreshes twice): expected one history point (the last wins), no version bump and no event on the second read, `at` moved (Task 2 test).
4. A reader's page load with stale releases: expected no call to `api/ado-releases` (403 would show as an error bar) — the page checks `canWrite` first (Task 3; smoke R10 counts the mock's calls under a reader).
5. The sprint report when there are releases but none was read from ADO: expected the line still lists the release with «ikke lest fra ADO» and no pace text, never `undefined` (Task 4 test with release 2.0.2).

---

### Task 1: The rules in `epic-tools.js` (working days, pace, strip text, state counts, sprint line, burndown data, normaliser)

**Files:**
- Modify: `src/features/timeline/epic-tools.js` (after the R10 release block, before the sprints block; the normaliser's `ado` branch; `module.exports`)
- Modify: `src/features/timeline/epic-tools.d.ts`
- Modify: `src/features/timeline/merge.ts` (types `ReleaseItem`, `ReleaseHistoryPoint`, `ReleaseAdo`)
- Test: `src/features/timeline/epic-tools.test.ts`

**Interfaces:**
- Produces: `workDays(a, b)`, `workDaysBetween(a, b)`, `addWorkDays(day, n)`, `calendarDays(a, b)`, `releaseStartDay(plan, r)`, `releasePace(plan, r, todayDay)`, `nextReleaseText(plan, todayDay)`, `releaseStateCounts(r)`, `releaseSprintText(r)`, `releaseBurndownData(plan, r, todayDay)`, `sprintUnlabelledWiql(path)`, `PACE_WORD`, `RELEASE_HISTORY_MAX = 120`, `RELEASE_MAX_AGE_MS = 21600000` (signatures in the spec and in the `.d.ts` below).
- Types: `ReleaseItem.iteration?: string`; `ReleaseHistoryPoint = { day; pointsDone; pointsTotal; done; total }`; `ReleaseAdo = { at; label; items; history?; sprints?: { name; unlabelled }[] }`; `Release.ado?: ReleaseAdo`.

- [ ] **Step 1: Write the failing tests** (append to `epic-tools.test.ts`; extend the import with `workDays, workDaysBetween, addWorkDays, calendarDays, releaseStartDay, releasePace, nextReleaseText, releaseStateCounts, releaseSprintText, releaseBurndownData, dayKey`)

```ts
describe("R11: working days", () => {
  it("counts Mon–Fri inclusive, skips weekends, steps forward over them, and counts calendar days signed", () => {
    expect(workDays("2026-10-05", "2026-10-12")).toBe(6);        // Mon 5 … Mon 12
    expect(workDays("2026-10-10", "2026-10-11")).toBe(0);        // a weekend
    expect(workDays("2026-10-12", "2026-10-05")).toBe(0);
    expect(workDaysBetween("2026-10-22", "2026-10-27")).toBe(3); // Thu → Fri, Mon, Tue
    expect(workDaysBetween("2026-10-22", "2026-10-22")).toBe(0);
    expect(workDaysBetween("2026-10-24", "2026-10-27")).toBe(2); // from a Saturday: Mon, Tue
    expect(addWorkDays("2026-10-22", 3)).toBe("2026-10-27");
    expect(addWorkDays("2026-10-09", 1)).toBe("2026-10-12");     // Friday + 1 = Monday
    expect(addWorkDays("2026-10-09", 0)).toBe("2026-10-09");
    expect(calendarDays("2026-10-12", "2026-10-22")).toBe(10);
    expect(calendarDays("2026-10-22", "2026-10-12")).toBe(-10);
  });
});

describe("R11: the tempo of a release", () => {
  const items = (done: number[], open: number[]) => [
    ...done.map((p, i) => ({ id: 100 + i, type: "Bug", title: "d" + i, state: "Closed", points: p, assignee: null, iteration: "Sprint 71" })),
    ...open.map((p, i) => ({ id: 200 + i, type: "User Story", title: "o" + i, state: "Active", points: p, assignee: null, iteration: "Sprint 71" })),
  ];
  const sprints = { at: "2026-10-12T00:00:00.000Z", items: [{ name: "Sprint 71", path: "Skytale\\Sprint 71", start: "2026-10-05", finish: "2026-10-23" }] };
  const hist = (days: string[]) => days.map((day) => ({ day, pointsDone: 10, pointsTotal: 79, done: 1, total: 2 }));
  const mk = (ado: Record<string, unknown> | undefined, over: Record<string, unknown> = {}) => {
    const p = normalizePlan({ lanes: [], tasks: [], sprints, releases: [{ key: "r1", version: "2.0.1", targetDate: "2026-10-22", ...(ado ? { ado: { at: "2026-10-12T10:00:00.000Z", label: "2.0.1", ...ado } } : {}), ...over }] });
    return { p, r: p.releases![0] };
  };
  it("the clock starts at the oldest sprint among the items, else two weeks before the target", () => {
    const a = mk({ items: items([10], [69]) });
    expect(releaseStartDay(a.p, a.r)).toBe("2026-10-05");
    const b = mk({ items: items([10], [69]).map((i) => ({ ...i, iteration: "Sprint 99" })) }, { targetDate: "2026-11-12" });
    expect(releaseStartDay(b.p, b.r)).toBe("2026-10-28");
  });
  it("the straight line until two readings exist: green when delivered keeps up with the time used, yellow behind, red past the target", () => {
    const today = "2026-10-12";   // 6 of 14 working days from 5.10 to 22.10
    const g = mk({ items: items([30], [49]), history: hist([today]) });   // 38 % delivered, 43 % of the time
    expect(releasePace(g.p, g.r, today)).toMatchObject({ code: "gronn", readings: 1, tempo: null, forecastDay: null, elapsedDays: 6, totalDays: 14, startDay: "2026-10-05" });
    expect(releasePace(g.p, g.r, today)!.text).toBe("38 % levert · 43 % av tiden brukt · tempo etter neste lesing");
    const y = mk({ items: items([10], [69]), history: hist([today]) });   // 13 % delivered
    expect(releasePace(y.p, y.r, today)!.code).toBe("gul");
    expect(releasePace(y.p, y.r, "2026-10-23")!.code).toBe("rod");   // the target day is past
    expect(releasePace(y.p, y.r, "2026-10-01")).toMatchObject({ code: "gronn", elapsed: 0, elapsedDays: 0 });   // today before the start
  });
  it("with two readings the tempo decides: units per working day since the start, the finish in working days, three days of yellow", () => {
    const today = "2026-10-12";
    const two = hist(["2026-10-09", today]);
    const late = mk({ items: items([10], [69]), history: two });   // 10 SP in 6 days: 69 left needs 42 more → 9 Dec
    const lp = releasePace(late.p, late.r, today)!;
    expect(lp).toMatchObject({ code: "rod", readings: 2, forecastDay: "2026-12-09", deltaDays: 34 });
    expect(lp.tempo).toBeCloseTo(10 / 6);
    expect(lp.text).toBe("13 % levert · 43 % av tiden brukt · med dagens tempo ferdig 9. des, 34 arbeidsdager etter målet");
    const ok = mk({ items: items([42], [37]), history: two });   // 7/day: 37 left → 6 more → 20 Oct, two days before
    expect(releasePace(ok.p, ok.r, today)).toMatchObject({ code: "gronn", forecastDay: "2026-10-20", deltaDays: -2 });
    expect(releasePace(ok.p, ok.r, today)!.text).toBe("53 % levert · 43 % av tiden brukt · med dagens tempo ferdig 20. okt, to arbeidsdager før målet");
    const yel = mk({ items: items([30], [49]), history: two });   // 5/day: 49 left → 10 more → 26 Oct, two days after
    expect(releasePace(yel.p, yel.r, today)).toMatchObject({ code: "gul", forecastDay: "2026-10-26", deltaDays: 2 });
    const three = mk({ items: items([28], [51]), history: two }); // 4.67/day: 51 left → 11 more → 27 Oct, three days after: still yellow
    expect(releasePace(three.p, three.r, today)).toMatchObject({ code: "gul", forecastDay: "2026-10-27", deltaDays: 3 });
    const four = mk({ items: items([27], [52]), history: two });  // 4.5/day: 52 left → 12 more → 28 Oct, four days after: red
    expect(releasePace(four.p, four.r, today)).toMatchObject({ code: "rod", forecastDay: "2026-10-28", deltaDays: 4 });
    const onIt = mk({ items: items([34], [45]), history: two });  // 5.67/day: 45 left → 8 more → 22 Oct, on the target
    expect(releasePace(onIt.p, onIt.r, today)!.text).toContain("ferdig 22. okt, på målet");
  });
  it("no pace when shipped, unread or empty; everything delivered is green and says so; two readings with nothing delivered say so", () => {
    const shipped = mk({ items: items([10], [69]), history: hist(["2026-10-12"]) }, { shippedDate: "2026-10-22" });
    expect(releasePace(shipped.p, shipped.r, "2026-10-23")).toBeNull();
    const unread = mk(undefined);
    expect(releasePace(unread.p, unread.r, "2026-10-12")).toBeNull();
    const empty = mk({ items: [] });
    expect(releasePace(empty.p, empty.r, "2026-10-12")).toBeNull();
    const all = mk({ items: items([79], []), history: hist(["2026-10-09", "2026-10-12"]) });
    expect(releasePace(all.p, all.r, "2026-10-12")).toMatchObject({ code: "gronn", forecastDay: null });
    expect(releasePace(all.p, all.r, "2026-10-12")!.text).toBe("100 % levert · 43 % av tiden brukt · alt levert · sett «Skippet» når den er ute");
    const none = mk({ items: items([], [79]), history: hist(["2026-10-09", "2026-10-12"]) });
    expect(releasePace(none.p, none.r, "2026-10-12")!.text).toBe("0 % levert · 43 % av tiden brukt · ingenting levert ennå");
  });
  it("nextReleaseText: the first unshipped release by target day, calendar days away, the share delivered and the colour in words", () => {
    const p = normalizePlan({ lanes: [], tasks: [], sprints, releases: [
      { key: "a", version: "2.0.0", targetDate: "2026-10-01", shippedDate: "2026-10-07" },
      { key: "b", version: "2.0.1", targetDate: "2026-10-22", ado: { at: "x", label: "2.0.1", items: items([30], [49]), history: hist(["2026-10-12"]) } },
      { key: "c", version: "2.0.2", targetDate: "2026-11-12" },
    ] });
    expect(nextReleaseText(p, "2026-10-12")).toMatchObject({ code: "gronn", text: "Neste release 2.0.1 om 10 dager · 38 % · grønn" });
    expect(nextReleaseText(p, "2026-10-22")!.text).toBe("Neste release 2.0.1 i dag · 38 % · gul");
    expect(nextReleaseText(p, "2026-10-25")!.text).toBe("Neste release 2.0.1 3 dager på overtid · 38 % · rød");
    const unread = normalizePlan({ lanes: [], tasks: [], releases: [{ key: "c", version: "2.0.2", targetDate: "2026-11-13" }] });
    expect(nextReleaseText(unread, "2026-11-12")).toEqual({ text: "Neste release 2.0.2 om 1 dag · ikke lest fra ADO", code: null, release: unread.releases![0] });
    expect(nextReleaseText(normalizePlan({ lanes: [], tasks: [] }), "2026-10-12")).toBeNull();
  });
  it("releaseStateCounts and releaseSprintText: ADO's states in order, the items per sprint and the sprint's unlabelled items", () => {
    const { r } = mk({ items: [
      { id: 1, type: "Bug", title: "a", state: "Closed", points: 5, assignee: null, iteration: "Sprint 71" },
      { id: 2, type: "Bug", title: "b", state: "New", points: 3, assignee: null, iteration: "Sprint 71" },
      { id: 3, type: "User Story", title: "c", state: "Active", points: 2, assignee: null, iteration: "Sprint 72" },
      { id: 4, type: "User Story", title: "d", state: "Weird", points: 2, assignee: null },
      { id: 5, type: "User Story", title: "e", state: "New", points: 2, assignee: null, iteration: "Sprint 71" },
    ], sprints: [{ name: "Sprint 71", unlabelled: 3 }, { name: "Sprint 72", unlabelled: 0 }] });
    expect(releaseStateCounts(r)).toEqual([{ state: "New", count: 2 }, { state: "Active", count: 1 }, { state: "Closed", count: 1 }, { state: "Weird", count: 1 }]);
    expect(releaseSprintText(r)).toBe("5 items i 2.0.1: 3 i Sprint 71, 1 i Sprint 72, 1 uten sprint · Sprint 71 har 3 items uten release-label");
    expect(releaseSprintText(mk(undefined).r)).toBe("");
  });
  it("releaseBurndownData: remaining per reading day, the axis from the start to the latest of target, today and the readings, the forecast day", () => {
    const today = "2026-10-12";
    const h = [{ day: "2026-10-09", pointsDone: 4, pointsTotal: 70, done: 1, total: 2 }, { day: today, pointsDone: 10, pointsTotal: 79, done: 1, total: 2 }];
    const a = mk({ items: items([10], [69]), history: h });
    expect(releaseBurndownData(a.p, a.r, today)).toEqual({ startDay: "2026-10-05", targetDay: "2026-10-22", endDay: "2026-10-22", todayDay: today, total: 79, unit: "SP", actual: [{ day: "2026-10-09", remaining: 66 }, { day: today, remaining: 69 }], forecastDay: "2026-12-09" });
    expect(releaseBurndownData(a.p, a.r, "2026-10-30")!.endDay).toBe("2026-10-30");
    const shipped = mk({ items: items([10], [69]), history: h }, { shippedDate: "2026-10-20" });
    expect(releaseBurndownData(shipped.p, shipped.r, "2026-11-30")).toMatchObject({ endDay: "2026-10-22", forecastDay: null });
    expect(releaseBurndownData(mk(undefined).p, mk(undefined).r, today)).toBeNull();
  });
  it("normalizePlan keeps the history one per day, sorted, the latest 120, the sprint counts, and the iteration only as text", () => {
    const rel = (over: Record<string, unknown>) => ({ key: "r1", version: "2.0.1", targetDate: "2026-10-22", ...over });
    const history = [{ day: "2026-10-12", pointsDone: 10, pointsTotal: 79, done: 1, total: 2 }, { day: "2026-10-09", pointsDone: 4, pointsTotal: 70, done: 1, total: 2 }, { day: "2026-10-12", pointsDone: 12, pointsTotal: 79, done: 2, total: 2 }, { day: "nope", pointsDone: 1, pointsTotal: 1, done: 1, total: 1 }, "junk"];
    const p = normalizePlan({ lanes: [], tasks: [], releases: [rel({ ado: { at: "x", label: "2.0.1", items: [{ id: 1, type: "Bug", title: "a", state: "New", points: 1, assignee: null, iteration: "Sprint 71" }, { id: 2, type: "Bug", title: "b", state: "New", points: 1, assignee: null, iteration: "" }], history, sprints: [{ name: "Sprint 71", unlabelled: 3 }, { unlabelled: 1 }, { name: "Sprint 72", unlabelled: -2 }, "x"] } })] });
    const a = p.releases![0].ado!;
    expect(a.history).toEqual([{ day: "2026-10-09", pointsDone: 4, pointsTotal: 70, done: 1, total: 2 }, { day: "2026-10-12", pointsDone: 12, pointsTotal: 79, done: 2, total: 2 }]);
    expect(a.sprints).toEqual([{ name: "Sprint 71", unlabelled: 3 }, { name: "Sprint 72", unlabelled: 0 }]);
    expect(a.items[0].iteration).toBe("Sprint 71");
    expect(a.items[1]).not.toHaveProperty("iteration");
    const many = Array.from({ length: 130 }, (_, i) => ({ day: dayKey(new Date(2026, 0, 1 + i)), pointsDone: i, pointsTotal: 200, done: 0, total: 0 }));
    const kept = normalizePlan({ lanes: [], tasks: [], releases: [rel({ ado: { at: "x", label: "2.0.1", items: [], history: many } })] }).releases![0].ado!.history!;
    expect(kept.length).toBe(120);
    expect(kept[0].day).toBe(dayKey(new Date(2026, 0, 11)));
    expect(normalizePlan({ lanes: [], tasks: [], releases: [rel({ ado: { at: "x", label: "2.0.1", items: [], history: [], sprints: [] } })] }).releases![0].ado).toEqual({ at: "x", label: "2.0.1", items: [] });
  });
});
```

- [ ] **Step 2: Run the tests, expect failures on the missing exports**

Run: `NODE_OPTIONS= npx vitest run src/features/timeline/epic-tools.test.ts`
Expected: FAIL («workDays is not a function» or the import of an undefined export).

- [ ] **Step 3: Implement** — in `epic-tools.js`, after `releaseProgress` (before the sprints block). `dayKey` is defined later in the file; function declarations hoist, and these run only when called.

```js
/* ---------- R11: progress towards a release: working days, tempo, history, sprint vs release ---------- */
const RELEASE_HISTORY_MAX = 120;              // one point per day: four months of readings
const RELEASE_MAX_AGE_MS = 6 * 3600 * 1000;   // the page re-reads the labels on load when the last read is older (writers)
const PACE_SLACK = 0.1;                       // the feature signal's slack, reused for the straight line
const PACE_LATE_DAYS = 3;                     // working days after the target that still count as yellow
const PACE_WORD = { gronn: "grønn", gul: "gul", rod: "rød" };
const dayOf = (day) => { const q = String(day).split("-").map(Number); return new Date(q[0], q[1] - 1, q[2]); };
const isWorkDay = (d) => d.getDay() !== 0 && d.getDay() !== 6;
/** Working days (Mon–Fri) from day a through day b, both inclusive; 0 when b is before a. */
function workDays(a, b) {
  if (!a || !b || b < a) return 0;
  let n = 0;
  for (const c = dayOf(a); dayKey(c) <= b; c.setDate(c.getDate() + 1)) if (isWorkDay(c)) n++;
  return n;
}
/** Working days after day a up to and including day b (a's own day never counts). */
function workDaysBetween(a, b) { return workDays(a, b) - (b >= a && isWorkDay(dayOf(a)) ? 1 : 0); }
/** The day n working days after `day` (n = 0: the day itself). */
function addWorkDays(day, n) {
  const c = dayOf(day);
  for (let left = Math.max(0, Math.ceil(n)); left > 0; ) { c.setDate(c.getDate() + 1); if (isWorkDay(c)) left--; }
  return dayKey(c);
}
/** Calendar days from a to b, negative when b is before a. */
function calendarDays(a, b) { const A = dayOf(a), B = dayOf(b); return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000); }
/** Where the release's clock starts: the sprint start of the oldest iteration among its items, else the segment's start. */
function releaseStartDay(plan, r) {
  const sprints = (plan && plan.sprints && plan.sprints.items) || [];
  const starts = ((r.ado && r.ado.items) || []).map((i) => { const s = i.iteration && sprints.find((sp) => sp.name === i.iteration); return s ? s.start : null; }).filter(Boolean).sort();
  if (starts.length) return starts[0];
  const seg = releaseSegments(plan).find((s) => s.release.key === r.key);
  return dayKey(unitToDate(seg ? seg.start : releaseEnd(r) - 2 * WEEK));
}
const PACE_WORDS = ["null", "én", "to", "tre", "fire", "fem", "seks", "sju", "åtte", "ni", "ti", "elleve", "tolv"];
const daysWords = (n) => (n <= 12 ? PACE_WORDS[n] : String(n)) + " arbeidsdag" + (n === 1 ? "" : "er");
const dayWords = (day) => fmtDate(dayOf(day));
const pct = (f) => Math.round(f * 100) + " %";
/** The tempo signal of a release that is not out yet: the colour its segment wears and the sentence the drawer, the strip and the report say. */
function releasePace(plan, r, todayDay) {
  if (!r || r.shippedDate || !r.ado) return null;
  const pr = releaseProgress(r);
  if (!pr.total) return null;
  const units = pr.pointsTotal > 0 ? { done: pr.pointsDone, total: pr.pointsTotal } : { done: pr.done, total: pr.total };
  const startDay = releaseStartDay(plan, r);
  const elapsedDays = workDays(startDay, todayDay), totalDays = workDays(startDay, r.targetDate);
  const elapsed = totalDays > 0 ? Math.max(0, Math.min(1, elapsedDays / totalDays)) : todayDay >= r.targetDate ? 1 : 0;
  const done = pr.fraction;
  const readings = new Set((r.ado.history || []).map((h) => h.day)).size;
  const tempo = readings >= 2 && elapsedDays > 0 && units.done > 0 ? units.done / elapsedDays : null;
  const forecastDay = tempo !== null && done < 1 ? addWorkDays(todayDay, Math.ceil((units.total - units.done) / tempo)) : null;
  const deltaDays = forecastDay ? (forecastDay > r.targetDate ? workDaysBetween(r.targetDate, forecastDay) : -workDaysBetween(forecastDay, r.targetDate)) : null;
  const past = todayDay > r.targetDate;
  let code;
  if (done >= 1) code = "gronn";
  else if (deltaDays !== null) code = deltaDays <= 0 ? "gronn" : deltaDays <= PACE_LATE_DAYS ? "gul" : "rod";
  else code = past ? "rod" : done + PACE_SLACK >= elapsed ? "gronn" : "gul";
  const head = pct(done) + " levert · " + pct(elapsed) + " av tiden brukt";
  const tail = done >= 1 ? "alt levert · sett «Skippet» når den er ute"
    : forecastDay ? "med dagens tempo ferdig " + dayWords(forecastDay) + (deltaDays === 0 ? ", på målet" : deltaDays > 0 ? ", " + daysWords(deltaDays) + " etter målet" : ", " + daysWords(-deltaDays) + " før målet")
    : readings < 2 ? "tempo etter neste lesing" : "ingenting levert ennå";
  return { code, text: head + " · " + tail, done, elapsed, startDay, elapsedDays, totalDays, tempo, forecastDay, deltaDays, readings };
}
/** The legend's status strip: the next release not yet out, how far away it is, the share delivered and the tempo colour in words. */
function nextReleaseText(plan, todayDay) {
  const r = ((plan && plan.releases) || []).filter((x) => !x.shippedDate).sort((a, b) => (a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : 0))[0];
  if (!r) return null;
  const n = calendarDays(todayDay, r.targetDate);
  const when = n > 0 ? "om " + n + (n === 1 ? " dag" : " dager") : n === 0 ? "i dag" : -n + (n === -1 ? " dag" : " dager") + " på overtid";
  const pr = releaseProgress(r), pace = releasePace(plan, r, todayDay);
  return { text: "Neste release " + r.version + " " + when + " · " + (pr.fraction === null ? "ikke lest fra ADO" : pct(pr.fraction)) + (pace ? " · " + PACE_WORD[pace.code] : ""), code: pace ? pace.code : null, release: r };
}
const STATE_ORDER = ["New", "Active", "Resolved", "Closed"];
/** The items by state, ADO's order first, then whatever else the process has. */
function releaseStateCounts(r) {
  const counts = new Map();
  ((r && r.ado && r.ado.items) || []).forEach((i) => counts.set(i.state, (counts.get(i.state) || 0) + 1));
  const rank = (s) => { const k = STATE_ORDER.indexOf(s); return k < 0 ? STATE_ORDER.length : k; };
  return [...counts.entries()].map(([state, count]) => ({ state, count })).sort((a, b) => rank(a.state) - rank(b.state) || a.state.localeCompare(b.state));
}
/** «16 items i 2.0.1: 15 i Sprint 71, 1 i Sprint 72 · Sprint 71 har 3 items uten release-label» */
function releaseSprintText(r) {
  const items = (r && r.ado && r.ado.items) || [];
  if (!items.length) return "";
  const by = new Map();
  let none = 0;
  items.forEach((i) => { if (i.iteration) by.set(i.iteration, (by.get(i.iteration) || 0) + 1); else none++; });
  const n = (c, one, many) => c + " " + (c === 1 ? one : many);
  const parts = [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], "nb")).map(([k, c]) => c + " i " + k);
  if (none) parts.push(none + " uten sprint");
  const extra = (r.ado.sprints || []).filter((s) => s.unlabelled > 0).map((s) => s.name + " har " + n(s.unlabelled, "item", "items") + " uten release-label");
  return n(items.length, "item", "items") + " i " + releaseScope(r) + ": " + parts.join(", ") + (extra.length ? " · " + extra.join(" · ") : "");
}
/** The burndown's numbers: remaining units per reading day, the ideal line's ends and the day the tempo points at. */
function releaseBurndownData(plan, r, todayDay) {
  const a = r && r.ado;
  if (!a || !Array.isArray(a.items) || !a.items.length) return null;
  const pr = releaseProgress(r);
  const unit = pr.pointsTotal > 0 ? "SP" : "items";
  const actual = (a.history || []).map((h) => ({ day: h.day, remaining: h.pointsTotal > 0 ? h.pointsTotal - h.pointsDone : h.total - h.done }));
  const pace = releasePace(plan, r, todayDay);
  const endDay = [r.targetDate, r.shippedDate || todayDay, ...actual.map((p) => p.day)].sort().pop();
  return { startDay: pace ? pace.startDay : releaseStartDay(plan, r), targetDay: r.targetDate, endDay, todayDay, total: unit === "SP" ? pr.pointsTotal : pr.total, unit, actual, forecastDay: pace ? pace.forecastDay : null };
}
/** The sprint's open bugs and stories that carry no release label at all: what sprint planning still has to stamp. */
function sprintUnlabelledWiql(iterationPath) {
  return "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.IterationPath] = '" + String(iterationPath).replace(/'/g, "''") + "' AND [Custom.Release] = '' AND [System.WorkItemType] IN ('Bug', 'User Story') AND [System.State] NOT IN ('Closed', 'Removed')";
}
```

Normaliser (inside the `if (r.ado && …)` branch, after `out.ado = { … }`):

```js
      const hist = new Map();
      (Array.isArray(r.ado.history) ? r.ado.history : []).forEach((h) => { if (h && typeof h === "object" && validDay(h.day)) hist.set(h.day, { day: h.day, pointsDone: Math.max(0, num(h.pointsDone, 0)), pointsTotal: Math.max(0, num(h.pointsTotal, 0)), done: Math.max(0, num(h.done, 0)), total: Math.max(0, num(h.total, 0)) }); });
      if (hist.size) out.ado.history = [...hist.values()].sort((x, y) => (x.day < y.day ? -1 : 1)).slice(-RELEASE_HISTORY_MAX);
      const sprints = (Array.isArray(r.ado.sprints) ? r.ado.sprints : []).filter((s) => s && typeof s === "object" && typeof s.name === "string" && s.name).map((s) => ({ name: s.name, unlabelled: Math.max(0, num(s.unlabelled, 0)) }));
      if (sprints.length) out.ado.sprints = sprints;
```
and in the item map: `...(typeof i.iteration === "string" && i.iteration ? { iteration: i.iteration } : {})`.

`module.exports` adds: `workDays, workDaysBetween, addWorkDays, calendarDays, releaseStartDay, releasePace, nextReleaseText, releaseStateCounts, releaseSprintText, releaseBurndownData, sprintUnlabelledWiql, PACE_WORD, RELEASE_HISTORY_MAX, RELEASE_MAX_AGE_MS`.

`epic-tools.d.ts` adds:

```ts
export type PaceCode = "gronn" | "gul" | "rod";
export declare const PACE_WORD: Record<PaceCode, string>;
export declare const RELEASE_HISTORY_MAX: number;
export declare const RELEASE_MAX_AGE_MS: number;
export declare function workDays(a: string, b: string): number;
export declare function workDaysBetween(a: string, b: string): number;
export declare function addWorkDays(day: string, n: number): string;
export declare function calendarDays(a: string, b: string): number;
export declare function releaseStartDay(plan: Plan, r: Release): string;
export type ReleasePace = { code: PaceCode; text: string; done: number; elapsed: number; startDay: string; elapsedDays: number; totalDays: number; tempo: number | null; forecastDay: string | null; deltaDays: number | null; readings: number };
export declare function releasePace(plan: Plan, r: Release, todayDay: string): ReleasePace | null;
export declare function nextReleaseText(plan: Plan, todayDay: string): { text: string; code: PaceCode | null; release: Release } | null;
export declare function releaseStateCounts(r: Release): { state: string; count: number }[];
export declare function releaseSprintText(r: Release): string;
export declare function releaseBurndownData(plan: Plan, r: Release, todayDay: string): { startDay: string; targetDay: string; endDay: string; todayDay: string; total: number; unit: "SP" | "items"; actual: { day: string; remaining: number }[]; forecastDay: string | null } | null;
export declare function sprintUnlabelledWiql(iterationPath: string): string;
```

`merge.ts`:

```ts
export type ReleaseItem = { id: number; type: "Bug" | "User Story"; title: string; state: string; points: number; assignee: string | null; iteration?: string };
/** One reading per day (R11): what the label held and how much of it was done, for the burndown and the tempo. */
export type ReleaseHistoryPoint = { day: string; pointsDone: number; pointsTotal: number; done: number; total: number };
export type ReleaseAdo = { at: string; label: string; items: ReleaseItem[]; history?: ReleaseHistoryPoint[]; sprints?: { name: string; unlabelled: number }[] };
// Release.ado?: ReleaseAdo
```

- [ ] **Step 4: Run the tests, expect green** — `NODE_OPTIONS= npx vitest run src/features/timeline` then the whole suite.

- [ ] **Step 5: Commit**

```bash
git add src/features/timeline/epic-tools.js src/features/timeline/epic-tools.d.ts src/features/timeline/epic-tools.test.ts src/features/timeline/merge.ts docs/superpowers/specs/2026-10-12-planning-system-r11-release-progress-design.md docs/superpowers/plans/2026-10-12-timeline-release-progress-r11.md
git commit -m "timeline: the rules behind a release's progress (R11): working days, the tempo signal, the next-release line, state counts, the sprint line, the burndown numbers and the normaliser's daily history"
```

---

### Task 2: The ADO read keeps the iteration, one point per day and the sprint counts; the light route

**Files:**
- Modify: `src/features/ado/releases.ts`
- Create: `src/app/api/ado-releases/route.ts`
- Test: `src/features/ado/releases.test.ts`

**Interfaces:**
- Consumes: `sprintUnlabelledWiql`, `currentSprint`, `dayKey`, `RELEASE_HISTORY_MAX` (Task 1); `Sprint.path` («Skytale\Sprint 71»).
- Produces: `releaseItemOf(w)` with `iteration` (the last path segment, only when present); `historyWith(history, point)`; `refreshReleases` unchanged in signature; `POST /api/ado-releases` → `{ version, data, read: { releases, items } }` | `{ unchanged: true }` (no releases, or someone saved first).

- [ ] **Step 1: Rewrite the tests** — fixture items get `"System.IterationPath"` (4804, 4536, 4817 → `Skytale\Sprint 71`; 4769 → `Skytale\Sprint 72`; 4999 none), plus `wi(4777, "Bug", "No label yet", "Active", 2, "", "Skytale\\Sprint 71")` and `wi(4700, "Bug", "Closed, no label", "Closed", 1, "", "Skytale\\Sprint 71")`; the plan gets `sprints: { at, items: [{ name: "Sprint 71", path: "Skytale\\Sprint 71", start: "2026-10-05", finish: "2026-10-23" }] }`; `NOW = 2026-10-12T10:40Z`. The fake `wiql` also answers the unlabelled query:

```ts
const path = /\[System\.IterationPath\] = '([^']*)'/.exec(q)?.[1];
if (path) return ITEMS.filter((w) => w.fields["System.IterationPath"] === path && !w.fields["Custom.Release"] && ["Bug", "User Story"].includes(String(w.fields["System.WorkItemType"])) && !["Closed", "Removed"].includes(String(w.fields["System.State"]))).map((w) => w.id);
```

Assertions: r1 `ado` equals `{ at: NOW, label: "2.0.1", items: [4536 (iteration "Sprint 71"), 4769 ("Sprint 72"), 4804 ("Sprint 71"), 4817 ("Sprint 71")], history: [{ day: "2026-10-12", pointsDone: 8, pointsTotal: 19, done: 2, total: 4 }], sprints: [{ name: "Sprint 71", unlabelled: 1 }, { name: "Sprint 72", unlabelled: 0 }] }`; r2 `ado` equals `{ at, label: "2.0.2", items: [4999 without iteration], history: [{ day, pointsDone: 0, pointsTotal: 2, done: 0, total: 1 }], sprints: [{ name: "Sprint 71", unlabelled: 1 }] }`; events as before; `SELECT` calls = 4 (two labels, two sprint paths, memoised). Second test: a second read the same day (`NOW + 1h`) → no events, `v` stays 2, `at` moves, one history point; a read the next day (`2026-10-13T08:00Z`) → no events, `v` 3, history days `["2026-10-12", "2026-10-13"]`. Third test adds `sprintUnlabelledWiql("Skytale\\Sprint 71")`'s exact text. Fourth: `historyWith` replaces the same day, sorts, caps at 120.

- [ ] **Step 2: Run, expect failures** — `NODE_OPTIONS= npx vitest run src/features/ado/releases.test.ts` (iteration missing, history missing, `sprintUnlabelledWiql`/`historyWith` not exported).

- [ ] **Step 3: Implement `releases.ts`**

```ts
import type { Plan, Release, ReleaseAdo, ReleaseHistoryPoint, ReleaseItem } from "@/features/timeline/merge";
import type { PlanEvent } from "@/features/timeline/events";
import { currentSprint, dayKey, releaseProgress, releaseQueryUrl, releaseScope, releaseWiql, sprintUnlabelledWiql, RELEASE_HISTORY_MAX } from "@/features/timeline/epic-tools.js";
import type { AdoClient, AdoWorkItem } from "./client";

export { releaseQueryUrl, releaseWiql, sprintUnlabelledWiql };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const leaf = (path: string) => path.split("\\").pop() ?? path;
export function releaseItemOf(w: AdoWorkItem): ReleaseItem {
  … as before …
  const iteration = leaf(str(w.fields["System.IterationPath"]));
  return { id: w.id, type, title, state, points, assignee: assignee || null, ...(iteration ? { iteration } : {}) };
}
/** One point per day on the release: the day's last read wins, the latest RELEASE_HISTORY_MAX are kept. */
export function historyWith(history: ReleaseHistoryPoint[] | undefined, point: ReleaseHistoryPoint): ReleaseHistoryPoint[] {
  return [...(history ?? []).filter((h) => h.day !== point.day), point].sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-RELEASE_HISTORY_MAX);
}
export async function refreshReleases(plan, client, now) {
  const p: Plan = JSON.parse(JSON.stringify(plan));
  const events: PlanEvent[] = [];
  let items = 0;
  const unlabelled = new Map<string, Promise<number>>();   // one query per sprint path, shared by the releases
  const countUnlabelled = (path: string) => { let q = unlabelled.get(path); if (!q) { q = client.wiql(sprintUnlabelledWiql(path)).then((ids) => ids.length); unlabelled.set(path, q); } return q; };
  const current = currentSprint(p.sprints?.items, now);
  for (const r of p.releases ?? []) {
    const label = releaseScope(r);
    const ids = await client.wiql(releaseWiql(label));
    const found: AdoWorkItem[] = [];
    for (let i = 0; i < ids.length; i += 200) found.push(...(await client.batch(ids.slice(i, i + 200))));
    const list = found.map(releaseItemOf).sort((a, b) => (a.type === b.type ? a.id - b.id : a.type === "Bug" ? -1 : 1));
    items += list.length;
    const paths = [...new Set([...found.map((w) => str(w.fields["System.IterationPath"])).filter(Boolean), ...(current ? [current.path] : [])])].sort();
    const sprints: { name: string; unlabelled: number }[] = [];
    for (const path of paths) sprints.push({ name: leaf(path), unlabelled: await countUnlabelled(path) });
    const pr = releaseProgress({ ...r, ado: { at: "", label, items: list } });
    const history = historyWith(r.ado?.history, { day: dayKey(now), pointsDone: pr.pointsDone, pointsTotal: pr.pointsTotal, done: pr.done, total: pr.total });
    const next: ReleaseAdo = { at: now.toISOString(), label, items: list, history, ...(sprints.length ? { sprints } : {}) };
    const itemsKey = (a?: ReleaseAdo) => JSON.stringify(a ? { label: a.label, items: a.items } : null);
    const dataKey = (a?: ReleaseAdo) => JSON.stringify(a ? { label: a.label, items: a.items, history: a.history ?? [], sprints: a.sprints ?? [] } : null);
    const itemsChanged = itemsKey(next) !== itemsKey(r.ado), changed = dataKey(next) !== dataKey(r.ado);
    r.ado = next;                                      // `at` is always the last read: the drawer says it, the page's six-hour rule needs it
    if (changed) r.v = (r.v ?? 0) + 1;                 // new items, a new day's point or new sprint counts: the read must win over an older copy of the release
    if (itemsChanged) events.push({ targetType: "release", targetId: r.key, targetLabel: "Release " + r.version, laneKey: null, code: "release.lest", cause: "ado", summary: "Lest fra ADO: " + pr.text, after: { label, items: list.length } });
  }
  return { plan: p, events, read: { releases: (p.releases ?? []).length, items } };
}
```

Route `src/app/api/ado-releases/route.ts` (mirrors `ado-refresh`, writers only):

```ts
// Re-read only the release labels (R11): the page calls it on load when a release's last read is older than six
// hours, so the band and the burndown stay fresh without anyone pressing «Oppdater fra ADO». POST (writers)
//   → { version, data, read: { releases, items } } · { unchanged: true } when there is nothing to read or someone saved first
export async function POST() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "writer") return Response.json({ error: "read-only" }, { status: 403 });
  const stored = await readPlan(prisma);
  if (!stored || !(stored.data.releases ?? []).length) return Response.json({ unchanged: true }, NO_STORE);
  const editor = session.user?.name ?? session.user?.email ?? null;
  try {
    const client = createAdoClient(await adoAuthFor(session, defaultTokenDeps(prisma)));
    const rr = await refreshReleases(stored.data, client, new Date());
    const c = await commitPlan(prisma, { stored, after: rr.plan, editor, note: { source: "ado" }, extraEvents: rr.events });
    if (!c) return Response.json({ unchanged: true }, NO_STORE);   // someone saved first: the next load retries
    return Response.json({ version: c.version, data: rr.plan, read: rr.read }, NO_STORE);
  } catch (e) {
    return adoErrorResponse(e);
  }
}
```

- [ ] **Step 4: Run, expect green** — `NODE_OPTIONS= npx vitest run src/features/ado` then the suite; `NODE_OPTIONS= npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/features/ado/releases.ts src/features/ado/releases.test.ts src/app/api/ado-releases/route.ts
git commit -m "ado: a release read keeps each item's sprint, one history point per day and the sprint's unlabelled count; a light route re-reads only the labels"
```

---

### Task 3: The page: tempo colour on the segment, the drawer (pace, states, sprint line, burndown), the auto-read, the strip, the help card

**Files:**
- Modify: `src/app/timeline/timeline.html` (CSS tokens and rules; `render()` segment; `renderReleaseDrawer`; new `burndownSvg`/`burndownTable`/`loadReleases`; `updateTlSummary`; `initServerPlan`; the «Releaser» help card)

**Interfaces:**
- Consumes: `releasePace`, `nextReleaseText`, `releaseStateCounts`, `releaseSprintText`, `releaseBurndownData`, `calendarDays`, `PACE_WORD`, `RELEASE_MAX_AGE_MS`, `dayKey`, `releaseItemDone` (globals from `epic-tools.js`); `POST api/ado-releases`.

- [ ] **Step 1: CSS** — tokens in `:root` (after `--release…`): `--pace-gronn:rgba(22,163,74,.38); --pace-gul:rgba(217,119,6,.42); --pace-rod:rgba(220,38,38,.38);` and in dark mode `--pace-gronn:rgba(74,222,128,.42); --pace-gul:rgba(251,191,36,.42); --pace-rod:rgba(248,113,113,.42);`. Rules after `.axis .release.overdue{…}`:

```css
  .axis .release.pace-gronn .fill{background:var(--pace-gronn)}
  .axis .release.pace-gul .fill{background:var(--pace-gul)}
  .axis .release.pace-rod .fill{background:var(--pace-rod)}
```
and after `.rel-scope code{…}`:
```css
  /* R11: the drawer's progress block: the tempo line, the items by state, sprint against release, the burndown */
  .rel-pace{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--text-2);margin:8px 0 2px;line-height:1.4}
  .rel-pace .chip{margin-top:1px}
  .rel-states{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 2px}
  .rel-sprints{font-size:12px;color:var(--text-3);margin:4px 0 2px}
  .burn{display:block;width:100%;height:auto;margin:10px 0 2px}
  .burn .gl{stroke:var(--line-soft);stroke-width:1}
  .burn .ideal{stroke:var(--text-4);stroke-width:1.5;fill:none}
  .burn .actual{stroke:var(--release);stroke-width:2;fill:none;stroke-linejoin:round;stroke-linecap:round}
  .burn .pt{fill:var(--release);stroke:var(--surface);stroke-width:2}
  .burn .fc{stroke:var(--release);stroke-width:1.5;stroke-dasharray:4 4;fill:none;opacity:.7}
  .burn .now{stroke:var(--today);stroke-width:1}
  .burn text{font-size:10px;fill:var(--text-3);font-variant-numeric:tabular-nums}
  .burn .ttl{font-size:11px;fill:var(--text-2);font-weight:600}
  .rel-table{font-size:12px;color:var(--text-3);margin:2px 0 8px}
  .rel-table summary{cursor:pointer}
  .rel-table table{border-collapse:collapse;margin-top:4px;font-variant-numeric:tabular-nums}
  .rel-table td,.rel-table th{padding:2px 12px 2px 0;text-align:right;font-weight:400}
  .rel-table th{color:var(--text-4)}
  .rel-table td:first-child,.rel-table th:first-child{text-align:left}
```

- [ ] **Step 2: The segment** (in `render()`): compute `const pace = sg.shipped ? null : releasePace(state, r, dayKey(new Date()));`, add `' pace-' + pace.code` to the class when `pace`, and append `'\n' + pace.text` to `d.title`.

- [ ] **Step 3: The drawer** — after the scope paragraph in `renderReleaseDrawer`:

```js
    const todayDay = dayKey(new Date()), pace = releasePace(state, r, todayDay);
    if(pace) html += '<p class="rel-pace"><span class="chip st-' + pace.code + '">' + PACE_LABEL[pace.code] + '</span><span>' + esc(pace.text) + '</span></p>';
    const states = releaseStateCounts(r);
    if(states.length) html += '<div class="rel-states" title="Itemene etter tilstand i ADO">' + states.map(s => '<span class="chip' + (releaseItemDone(s) ? ' st-gronn' : '') + '">' + esc(s.state) + ' ' + s.count + '</span>').join('') + '</div>';
    const spt = releaseSprintText(r);
    if(spt) html += '<p class="rel-sprints">' + esc(spt) + '</p>';
    const bd = releaseBurndownData(state, r, todayDay);
    if(bd && bd.actual.length) html += burndownSvg(bd) + burndownTable(bd);
```
with `const PACE_LABEL = { gronn: 'Grønn', gul: 'Gul', rod: 'Rød' };` and, after `releaseSubText`:

```js
  function burndownSvg(d){   // R11: remaining units per reading day, the ideal line start → target, the tempo's projection, today
    const W = 480, H = 160, L = 34, R = 14, T = 16, B = 26;
    const span = Math.max(1, calendarDays(d.startDay, d.endDay));
    const maxY = Math.max(1, d.total, ...d.actual.map(p => p.remaining));
    const f = n => Math.round(n * 10) / 10;
    const xOf = day => L + (W - L - R) * Math.max(0, Math.min(1, calendarDays(d.startDay, day) / span));
    const yOf = v => T + (H - T - B) * (1 - v / maxY);
    let s = '<svg class="burn" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Burndown: ' + d.unit + ' igjen per dag">';
    s += '<text class="ttl" x="' + L + '" y="10">Igjen (' + d.unit + ')</text>';
    [0, maxY].forEach(v => { s += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + f(yOf(v)) + '" y2="' + f(yOf(v)) + '"/><text x="' + (L - 6) + '" y="' + f(yOf(v) + 3) + '" text-anchor="end">' + v + '</text>'; });
    s += '<line class="ideal" x1="' + f(xOf(d.startDay)) + '" y1="' + f(yOf(d.total)) + '" x2="' + f(xOf(d.targetDay)) + '" y2="' + f(yOf(0)) + '"><title>Ideallinjen: alt levert på måldatoen</title></line>';
    if(d.todayDay >= d.startDay && d.todayDay <= d.endDay) s += '<line class="now" x1="' + f(xOf(d.todayDay)) + '" x2="' + f(xOf(d.todayDay)) + '" y1="' + T + '" y2="' + f(yOf(0)) + '"/>';
    const pts = d.actual.map(p => [xOf(p.day), yOf(p.remaining)]);
    if(pts.length > 1) s += '<polyline class="actual" points="' + pts.map(p => f(p[0]) + ',' + f(p[1])).join(' ') + '"/>';
    if(d.forecastDay && pts.length){   // the projection, clipped at the axis end but with the right slope
      const last = pts[pts.length - 1], fx = L + (W - L - R) * calendarDays(d.startDay, d.forecastDay) / span, fy = yOf(0);
      const t = fx > W - R ? (W - R - last[0]) / (fx - last[0]) : 1;
      s += '<line class="fc" x1="' + f(last[0]) + '" y1="' + f(last[1]) + '" x2="' + f(last[0] + t * (fx - last[0])) + '" y2="' + f(last[1] + t * (fy - last[1])) + '"><title>' + esc('Med dagens tempo: ferdig ' + relDay(d.forecastDay)) + '</title></line>';
    }
    d.actual.forEach((p, i) => { s += '<circle class="pt" cx="' + f(pts[i][0]) + '" cy="' + f(pts[i][1]) + '" r="4"><title>' + esc(relDay(p.day) + ': ' + p.remaining + ' ' + d.unit + ' igjen') + '</title></circle>'; });
    s += '<text x="' + f(xOf(d.startDay)) + '" y="' + (H - 8) + '">' + esc(relDay(d.startDay)) + '</text>';
    s += '<text x="' + f(xOf(d.targetDay)) + '" y="' + (H - 8) + '" text-anchor="' + (d.targetDay === d.endDay ? 'end' : 'middle') + '">' + esc('mål ' + relDay(d.targetDay)) + '</text>';
    if(d.endDay !== d.targetDay) s += '<text x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end">' + esc(relDay(d.endDay)) + '</text>';
    return s + '</svg>';
  }
  function burndownTable(d){
    return '<details class="rel-table"><summary>Tall per dag</summary><table><tr><th>Dag</th><th>Igjen</th></tr>' + d.actual.map(p => '<tr><td>' + esc(relDay(p.day)) + '</td><td>' + p.remaining + ' ' + d.unit + '</td></tr>').join('') + '</table></details>';
  }
```

- [ ] **Step 4: The auto-read** — next to `loadSprints`:

```js
  const releasesStale = () => (state.releases || []).some(r => !r.shippedDate && (!r.ado || Date.now() - new Date(r.ado.at).getTime() > RELEASE_MAX_AGE_MS));
  async function loadReleases(){   // release-båndet (R11): les labelene på nytt når siste lesing er eldre enn seks timer; lesere tegner fra cachen
    if(!HOSTED || !canWrite || !releasesStale()) return;
    try{
      const j = await adoCall('api/ado-releases');
      if(j.data && !pendingSave && !drag){ applyRemote(j.data, j.version); if(!relDrawer.hidden) renderReleaseDrawer(); }
    }catch(e){ /* stille: «Oppdater fra ADO» finnes, og adoCall viser innloggingslinjen når tokenet er borte */ }
  }
```
and `loadReleases();` right after `loadSprints();` in `initServerPlan`.

- [ ] **Step 5: The strip** — in `updateTlSummary`, build the epic part as before into a variable and append `nx` when present:
```js
    const nx = nextReleaseText(state, dayKey(new Date()));
    const relPart = nx ? '<span title="Neste release: hvor langt unna, andel levert og tempo-fargen">' + (nx.code ? '<i class="st-' + nx.code + '"></i>' : '') + esc(nx.text) + '</span>' : '';
    tlSummary.innerHTML = (state.lanes.length ? … : '') + relPart;
```

- [ ] **Step 6: The help card** — append to the «Releaser» card: «Fargen i segmentet er tempoet: grønn når dagens tempo (poeng levert per arbeidsdag siden start) rekker måldatoen, gul inntil tre arbeidsdager etter, rød senere; før to lesinger på ulike dager gjelder den rette linjen fra start til mål. Skuffen viser burndown per dag, itemene per tilstand og sprint mot release. For skrivere leses labelene på nytt ved innlasting når siste lesing er eldre enn seks timer.»

- [ ] **Step 7: Verify in the browser** — the smoke in Task 5 (R8–R11); meanwhile `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-release-smoke.mjs` must still pass R1–R7 (the mock lacks `api/ado-releases`; the page's call fails silently for a fresh read).

- [ ] **Step 8: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "timeline: the release segment wears the tempo colour; the drawer gets the tempo line, the items by state, sprint against release and a burndown; stale labels are re-read on load; the legend names the next release"
```

---

### Task 4: The sprint report's «Releaser» section

**Files:**
- Modify: `src/features/timeline/report.ts`, `src/app/api/timeline-compare/route.ts`
- Test: `src/features/timeline/report.test.ts`

**Interfaces:**
- Consumes: `releasePace`, `releaseProgress`, `dayKey`, `dayToUnit`, `unitToDate` (Task 1).
- Produces: `ReportArgs.todayDay?: string` (defaults to the day of `todayUnit`); section «## Releaser» after «Fremdrift per feature».

- [ ] **Step 1: The failing test** (in `describe("sprintReportMarkdown")`):

```ts
  it("lists the releases the sprint works towards: target or shipped day, the progress text, the tempo and the colour", () => {
    const p = plan();
    p.sprints = { at: "x", items: [{ name: "Sprint 71", path: "Skytale\\Sprint 71", start: "2026-10-05", finish: "2026-10-23" }] };
    p.releases = normalizePlan({ lanes: [], tasks: [], releases: [
      { key: "r0", version: "2.0.0", targetDate: "2026-10-01", shippedDate: "2026-10-07" },
      { key: "r1", version: "2.0.1", targetDate: "2026-10-22", ado: { at: "x", label: "2.0.1", items: [
        { id: 1, type: "Bug", title: "a", state: "Closed", points: 10, assignee: null, iteration: "Sprint 71" }, { id: 2, type: "User Story", title: "b", state: "Active", points: 69, assignee: null, iteration: "Sprint 71" },
      ], history: [{ day: "2026-10-09", pointsDone: 4, pointsTotal: 79, done: 1, total: 2 }, { day: "2026-10-12", pointsDone: 10, pointsTotal: 79, done: 1, total: 2 }] } },
      { key: "r2", version: "2.0.2", targetDate: "2026-11-12" },
    ] }).releases;
    const md = sprintReportMarkdown({ title: "Sprintrapport Sprint 71", strip: STRIP, path: path(), plan: p, laneName, todayUnit: TODAY, todayDay: "2026-10-12" });
    expect(md).toContain("## Releaser\n- 2.0.1: mål 22. okt · 1 bug, 1 story · 10/79 SP levert · 13 % levert · 43 % av tiden brukt · med dagens tempo ferdig 9. des, 34 arbeidsdager etter målet · rød\n- 2.0.2: mål 12. nov · ikke lest fra ADO\n");
    expect(md).not.toContain("2.0.0");   // out before the period
    const order = ["## Fremdrift per feature", "## Releaser", "## Utredninger som kom videre"].map((h) => md.indexOf(h));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
```

- [ ] **Step 2: Run, expect failure** — `NODE_OPTIONS= npx vitest run src/features/timeline/report.test.ts` (no «## Releaser»).

- [ ] **Step 3: Implement**

```ts
import { dayKey, dayToUnit, releasePace, releaseProgress, unitToDate, … } from "./epic-tools.js";
const dayWords = (day: string) => fmtDate(unitToDate(dayToUnit(day)));
/** The releases the sprint works towards: not out yet, or out since the period's first event. */
function releaseLines(plan: Plan, path: PathEvent[], todayDay: string): string[] {
  const since = path.length ? path.map((e) => e.at.slice(0, 10)).sort()[0] : null;
  return (plan.releases ?? []).filter((r) => !r.shippedDate || (since !== null && r.shippedDate >= since)).map((r) => {
    const pace = releasePace(plan, r, todayDay);
    return "- " + r.version + ": " + (r.shippedDate ? "skippet " + dayWords(r.shippedDate) : "mål " + dayWords(r.targetDate)) + " · " + releaseProgress(r).text + (pace ? " · " + pace.text + " · " + COLOUR[pace.code] : "");
  });
}
// ReportArgs += todayDay?: string; in sprintReportMarkdown after the progress section:
  const rel = releaseLines(a.plan, a.path, a.todayDay ?? dayKey(unitToDate(a.todayUnit)));
  if (rel.length) sections.push("\n## Releaser\n" + rel.join("\n") + "\n");
```
Route: add `todayDay: dayKey(new Date())` to the `sprintReportMarkdown` call (import `dayKey`).

- [ ] **Step 4: Run, expect green**; `tsc`.

- [ ] **Step 5: Commit**

```bash
git add src/features/timeline/report.ts src/features/timeline/report.test.ts src/app/api/timeline-compare/route.ts
git commit -m "report: the sprint report lists the releases the sprint works towards, with the tempo and the colour"
```

---

### Task 5: Smokes R8–R11, the gates, the PR text

**Files:**
- Modify: `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-release-smoke.mjs` (worked on as a scratchpad copy, copied back when green)
- Create: `~/Skytale/ClaudeReports/planning/roadmap-2.0/pr-body-release-progress.md`
- Ledger: `.superpowers/sdd/2026-10-12-timeline-release-progress-r11/progress.md`

- [ ] **Step 1: The mock** — items get `"System.IterationPath": "Skytale\\Sprint 71"` (4804, 4536, 4769) and a new unlabelled open bug `wi(4777, "Bug", "Not stamped yet", "Active", 2, "", null)` in Sprint 71; `wiql` answers the unlabelled query; a clock offset (`/__clock/<ms>` sets `clockMs`, `now()` = `new Date(Date.now() + clockMs)` used in every refresh handler); `/__age/<hours>` moves every release's `ado.at` back; `POST /api/ado-releases` mirrors the route and counts `releaseReads`.

- [ ] **Step 2: The steps** (after R3, before R4, so the release is not shipped yet):
- R8: the segment has class `pace-gul` or `pace-rod` (13 %: 5/16 with one reading → the straight line) — assert `/pace-(gul|rod|gronn)/` on the class and `/% levert/` in the title; open the drawer: `.rel-pace .chip` text is Gul/Rød/Grønn, `.rel-pace` contains «levert · », `.rel-states .chip` texts include «New 2» and «Resolved 1», `.rel-sprints` reads «3 items i 2.0.1: 3 i Sprint 71 · Sprint 71 har 1 item uten release-label», one `circle.pt` in `.burn`, the table has one row.
- R9: `/__clock/` + 1 day, `#relRefresh` again → two circles, a `polyline.actual`, `.rel-pace` contains «med dagens tempo ferdig» or «ingenting levert ennå», history length 2 in the stored plan, no second `release.lest` event; screenshot.
- R10: `/__age/7`, writer reload → `releaseReads` becomes 1 and the stored `ado.at` is fresh; `/__age/7`, reader reload → `releaseReads` stays 1.
- R11: `#tlSummary` text matches `/Neste release 2\.0\.1 om \d+ dager · \d+ % · (grønn|gul|rød)/`.
Then R4–R7 as before (R4 ships the release: the segment loses its pace class, the strip has no next release → assert both).

- [ ] **Step 3: Gates** — `NODE_OPTIONS= npx vitest run`, `NODE_OPTIONS= npx tsc --noEmit`, `NODE_OPTIONS= npm run lint`, `NODE_OPTIONS= npx next build` (the new route in the manifest), the release smoke, then `hosted-smoke.mjs`, `hosted-polish-smoke.mjs`, `ui-smoke.mjs` from the build folder.

- [ ] **Step 4: PR text** `pr-body-release-progress.md` in the style of `pr-body-releases.md`: title «Tidslinjen: fremdrift mot release (R11)», what changed (the four parts), verification, after merge (prod: the first «Oppdater fra ADO» starts the history; the colour is the straight line until the second day).

- [ ] **Step 5: Commit the smoke in the workspace repo** is GO's (ClaudeReports is in `~/Skytale`, uncommitted work there is left as is); in SkyTracker nothing more to commit unless the review found something.

# Tidslinjen R13: the lifecycle's missing transitions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delivered features leave the shelf; an unlinked feature can be marked delivered by hand; an estimated feature can go back to discovery; a discovery can be placed in an epic from the shelf, from «Start utredning» and from the board's editor.

**Architecture:** The rules are pure functions in `src/features/timeline/epic-tools.js` (globals on both plain-JS pages, imported by vitest), declared in `epic-tools.d.ts`. `events.ts` gets two wordings. The pages (`timeline.html`, `board.html`) call the shared rules from buttons, drops and dialogs that already exist, plus one date dialog built on the pages' `askDialog`. Playwright smokes in `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/` drive the pages behind the mock API.

**Tech Stack:** plain JS pages, vitest 4, TypeScript for `events.ts`, Playwright (from `~/ptt-e2e`) via `NODE_OPTIONS= npx tsx <smoke>`.

**Spec:** `docs/superpowers/specs/2026-10-13-planning-system-r13-lifecycle-transitions-design.md`

## Global Constraints

- `epic-tools.js` `module.exports` must equal the declarations in `epic-tools.d.ts` (the existing test checks it).
- Norwegian in UI text, English in code and commits. No Claude attribution in commits.
- Run node/npx with `NODE_OPTIONS=` prefixed (the shell's NODE_OPTIONS points at a deleted file).
- Delivery of a feature with an ADO id stays ADO's: no page offers «Marker levert» for it.
- Never a future day as the delivery day.
- The timeline's `moveTask` keeps its order renumbering and queue push; only its state rule moves into `applyLaneChange`.

## Review Focus

1. A delivered feature on the shelf that a page still holds in memory after the deploy: `renderShelf` must not list it, and nothing else may read `shelfTasks` expecting delivered rows (test: shelfTasks excludes `levert`).
2. «Marker levert» on a discovery: the kind flips to estimate; the bar must not keep a discovery end (test: `markDelivered` sets `endLikely = end`).
3. Back to discovery from «Aktiv» inside an epic: the queue (`pushQueue`) and the epic colour must see a discovery, and `committedRange` must be gone (test: normaliser via `applyLaneChange`/restart in the smoke P13 and B12).
4. The board's «Epic» field on a `ny` feature: the normaliser forces the shelf for `ny`; the editor must not pretend it moved (plan: `setLane` leaves `ny` alone and the select is disabled for `ny`).
5. The date dialog returns strings: a cancelled dialog (`false`) and an empty value must change nothing (test in smoke P12: cancel leaves the state).

---

### Task 1: The rules in epic-tools (shelf, delivery, restart, lane change, board matrix)

**Files:**
- Modify: `src/features/timeline/epic-tools.js` (after `shelfTasks`, line ~202; `module.exports` at the end)
- Modify: `src/features/timeline/epic-tools.d.ts` (after `shelfTasks`)
- Test: `src/features/timeline/epic-tools.test.ts` (append a describe; extend the import list)

**Interfaces:**
- Produces: `canMarkDelivered(t): boolean`, `markDelivered(t, day): TaskFieldGroup[]`, `canRestartDiscovery(t): boolean`, `applyLaneChange(t, laneKey, todayDay): TaskFieldGroup[]`, `boardColumn(t): "ny"|"utredes"|"klar"|"aktiv"|"levert"`, `featureTransition(t, to): boolean`; `shelfTasks` excludes delivered.

- [ ] **Step 1: Write the failing tests** (append to `epic-tools.test.ts`; add `BACKLOG, canMarkDelivered, markDelivered, canRestartDiscovery, applyLaneChange, boardColumn, featureTransition` to the import)

```ts
describe("R13: the transitions the lifecycle lacked", () => {
  const est = (over: Record<string, unknown> = {}) => ({ id: "e", lane: BACKLOG, label: "Est", kind: "estimate", start: 4, endLikely: 5, end: 6, deps: [], fv: {}, state: "klar", ...over });
  const disc = (over: Record<string, unknown> = {}) => ({ id: "d", lane: BACKLOG, label: "Disc", kind: "discovery", start: 2, end: 3, deps: [], fv: {}, state: "utredes", ...over });

  it("shelfTasks leaves delivered features out", () => {
    const plan = normalizePlan({ lanes: [{ key: "x", name: "X" }], tasks: [est({ id: "k" }), est({ id: "l", state: "levert", deliveredAt: "2026-10-07" }), disc({ id: "d", lane: "x" })] });
    expect(shelfTasks(plan).map((t) => t.id)).toEqual(["k"]);
  });
  it("canMarkDelivered: only without an ADO id and not yet delivered", () => {
    expect(canMarkDelivered(est())).toBe(true);
    expect(canMarkDelivered(disc({ state: "ny" }))).toBe(true);
    expect(canMarkDelivered(est({ adoId: 4486 }))).toBe(false);
    expect(canMarkDelivered(est({ state: "levert", deliveredAt: "2026-10-07" }))).toBe(false);
  });
  it("markDelivered sets the day; a discovery becomes an estimate whose end is its span", () => {
    const e = est({ lane: "x", state: "aktiv" });
    expect(markDelivered(e, "2026-10-07")).toEqual(["state"]);
    expect([e.state, e.deliveredAt, e.kind]).toEqual(["levert", "2026-10-07", "estimate"]);
    const d = disc();
    expect(markDelivered(d, "2026-10-01")).toEqual(["state", "meta", "tid"]);
    expect([d.state, d.deliveredAt, d.kind, d.endLikely]).toEqual(["levert", "2026-10-01", "estimate", 3]);
  });
  it("canRestartDiscovery: an estimated feature on the shelf or in an epic, nothing else", () => {
    expect(canRestartDiscovery(est())).toBe(true);
    expect(canRestartDiscovery(est({ lane: "x", state: "aktiv" }))).toBe(true);
    expect(canRestartDiscovery(disc())).toBe(false);
    expect(canRestartDiscovery(est({ state: "levert", deliveredAt: "2026-10-07" }))).toBe(false);
    expect(canRestartDiscovery(disc({ state: "ny" }))).toBe(false);
  });
  it("applyLaneChange: an estimate from the shelf into an epic becomes aktiv with the promised span", () => {
    const e = est();
    expect(applyLaneChange(e, "x", "2026-10-13")).toEqual(["meta", "state"]);
    expect([e.lane, e.state, e.activatedAt]).toEqual(["x", "aktiv", "2026-10-13"]);
    expect(e.committedRange).toEqual({ likely: 4, late: 8, start: 4 });
  });
  it("applyLaneChange: back to the shelf makes it klar again and drops the span", () => {
    const e = est({ lane: "x", state: "aktiv", committedRange: { likely: 4, late: 8, start: 4 }, activatedAt: "2026-10-13" });
    expect(applyLaneChange(e, BACKLOG, "2026-10-14")).toEqual(["meta", "state"]);
    expect([e.lane, e.state, e.committedRange, e.activatedAt]).toEqual([BACKLOG, "klar", undefined, undefined]);
  });
  it("applyLaneChange: a discovery, a delivered or a registered feature keeps its state; the same lane changes nothing", () => {
    const d = disc();
    expect(applyLaneChange(d, "x", "2026-10-13")).toEqual(["meta"]);
    expect([d.lane, d.state]).toEqual(["x", "utredes"]);
    const l = est({ state: "levert", deliveredAt: "2026-10-07" });
    expect(applyLaneChange(l, "x", "2026-10-13")).toEqual(["meta"]);
    expect(l.state).toBe("levert");
    const n = disc({ state: "ny" });
    expect(applyLaneChange(n, "x", "2026-10-13")).toEqual(["meta"]);
    expect(n.state).toBe("ny");
    const same = est({ lane: "x", state: "aktiv" });
    expect(applyLaneChange(same, "x", "2026-10-13")).toEqual([]);
  });
  it("boardColumn and featureTransition: one step forward, back to the shelf or to discovery, delivered only without ADO", () => {
    const cols = (t: unknown) => ["ny", "utredes", "klar", "aktiv", "levert"].filter((to) => featureTransition(t, to));
    expect(boardColumn(disc({ state: "ny" }))).toBe("ny");
    expect(cols(disc({ state: "ny" }))).toEqual(["utredes", "levert"]);
    expect(boardColumn(disc())).toBe("utredes");
    expect(cols(disc())).toEqual(["klar", "levert"]);
    expect(cols(disc({ lane: "x" }))).toEqual(["aktiv", "levert"]);
    expect(boardColumn(est())).toBe("klar");
    expect(cols(est())).toEqual(["utredes", "aktiv", "levert"]);
    expect(cols(est({ adoId: 4486 }))).toEqual(["utredes", "aktiv"]);
    expect(boardColumn(est({ lane: "x", state: "aktiv" }))).toBe("aktiv");
    expect(cols(est({ lane: "x", state: "aktiv" }))).toEqual(["utredes", "klar", "levert"]);
    expect(boardColumn(est({ state: "levert", deliveredAt: "2026-10-07" }))).toBe("levert");
    expect(cols(est({ state: "levert", deliveredAt: "2026-10-07" }))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx vitest run src/features/timeline/epic-tools.test.ts -t "R13" 2>&1 | tail -15`
Expected: FAIL — `canMarkDelivered is not a function` (or the import fails), and the shelf test fails because the delivered feature is listed.

- [ ] **Step 3: Implement** (in `epic-tools.js`, replace `shelfTasks` and add the block right after it)

```js
/** The shelf: features on the backlog lane that still wait for a place in an epic (delivered ones are on the board's «Levert»). */
function shelfTasks(plan) { return plan.tasks.filter((t) => t.lane === BACKLOG && t.state !== "levert"); }

/* ---------- R13: the transitions the lifecycle lacked ---------- */
/** Delivery of a feature with an ADO id is ADO's; one without can be marked delivered by hand. */
function canMarkDelivered(t) { return !!t && !t.adoId && t.state !== "levert"; }
/** Marks it delivered on `day` (YYYY-MM-DD). A discovery becomes an estimate whose end is its span. Returns the field groups touched. */
function markDelivered(t, day) {
  const groups = ["state"];
  if (t.kind === "discovery") { t.kind = "estimate"; t.endLikely = t.end; groups.push("meta", "tid"); }
  t.state = "levert"; t.deliveredAt = day;
  return groups;
}
/** An estimated feature on the shelf or in an epic can go back to discovery. */
function canRestartDiscovery(t) { return !!t && t.kind === "estimate" && (t.state === "klar" || t.state === "aktiv"); }
/** The lane rule both pages share: an estimate from the shelf into an epic becomes aktiv with the promised span, back on the
 *  shelf it is klar again; a discovery, a registered or a delivered feature keeps its state. Returns the groups touched. */
function applyLaneChange(t, laneKey, todayDay) {
  if (t.lane === laneKey) return [];
  const from = t.lane;
  t.lane = laneKey;
  const groups = ["meta"];
  if (t.kind !== "estimate" || t.state === "levert" || t.state === "ny") return groups;
  if (laneKey === BACKLOG && t.state === "aktiv") { t.state = "klar"; delete t.committedRange; delete t.activatedAt; groups.push("state"); }
  else if (from === BACKLOG && laneKey !== BACKLOG) {
    const r = rangeWeeks(t);
    t.state = "aktiv";
    if (r) t.committedRange = { likely: r.likely, late: r.late, start: t.start };
    t.activatedAt = todayDay;
    groups.push("state");
  }
  return groups;
}
/** The board's column: the lifecycle state, «Aktiv» meaning an estimate inside an epic. */
function boardColumn(t) { return t.state === "levert" ? "levert" : t.state === "ny" ? "ny" : t.state === "utredes" ? "utredes" : t.lane === BACKLOG ? "klar" : "aktiv"; }
/** Whether the board may move a feature to a column: one step forward, back to the shelf or to discovery, delivered by hand only without ADO. */
function featureTransition(t, to) {
  const from = boardColumn(t);
  if (from === to || to === "ny" || from === "levert") return false;
  if (to === "levert") return canMarkDelivered(t);
  if (from === "ny") return to === "utredes";
  if (from === "utredes") return to === (t.lane === BACKLOG ? "klar" : "aktiv");
  if (from === "klar") return to === "aktiv" || to === "utredes";
  if (from === "aktiv") return to === "klar" || to === "utredes";
  return false;
}
```

Add to `module.exports` (next to `shelfTasks`): `canMarkDelivered, markDelivered, canRestartDiscovery, applyLaneChange, boardColumn, featureTransition,`.

Add to `epic-tools.d.ts` after `shelfTasks`:

```ts
/** R13: delivery of a linked feature is ADO's; an unlinked one can be marked delivered by hand. */
export declare function canMarkDelivered(task: PlanTask): boolean;
/** R13: marks it delivered on `day` (YYYY-MM-DD); a discovery becomes an estimate. Returns the field groups touched. */
export declare function markDelivered(task: PlanTask, day: string): TaskFieldGroup[];
/** R13: an estimated feature on the shelf or in an epic can go back to discovery. */
export declare function canRestartDiscovery(task: PlanTask): boolean;
/** R13: the lane rule both pages share; returns the field groups touched (empty when the lane is unchanged). */
export declare function applyLaneChange(task: PlanTask, laneKey: string, todayDay: string): TaskFieldGroup[];
/** R13: the board's column for a feature. */
export declare function boardColumn(task: PlanTask): "ny" | "utredes" | "klar" | "aktiv" | "levert";
/** R13: whether the board may move the feature to that column. */
export declare function featureTransition(task: PlanTask, to: string): boolean;
```

(`TaskFieldGroup` is imported from `./merge` at the top of the d.ts already, or add it to that import.)

- [ ] **Step 4: Run the tests to verify they pass, then the whole file**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx vitest run src/features/timeline/epic-tools.test.ts 2>&1 | tail -6`
Expected: all pass, including the exports-equal-d.ts test.

- [ ] **Step 5: Commit**

```bash
git add src/features/timeline/epic-tools.js src/features/timeline/epic-tools.d.ts src/features/timeline/epic-tools.test.ts
git commit -m "timeline: the rules for R13 — delivered features leave the shelf, delivery by hand without ADO, back to discovery, the shared lane rule and the board's transition matrix"
```

---

### Task 2: The two event wordings

**Files:**
- Modify: `src/features/timeline/events.ts` (`stateSummary`, line ~106)
- Test: `src/features/timeline/events.test.ts` (append a describe)

**Interfaces:**
- Consumes: nothing new. Produces: summaries «Tilbake til utredning (til <day>)» and «Levert <day> · uten ADO».

- [ ] **Step 1: Write the failing tests**

```ts
describe("R13 wordings", () => {
  const plan = (tasks: PlanTask[]): Plan => normalizePlan({ lanes: [{ key: "x", name: "X" }], tasks } as unknown as Plan);
  it("a feature going back to discovery reads «Tilbake til utredning»", () => {
    const before = plan([est({ id: "e", lane: "x", state: "aktiv", committedRange: { likely: 4, late: 8, start: 4 }, activatedAt: "2026-10-01" })]);
    const after = plan([disc({ id: "e", lane: "x", start: 4, end: 5, fv: { state: 1, meta: 1, tid: 1 } })]);
    const ev = diffPlans(before, after).find((e) => e.code === "feature.tilstand");
    expect(ev?.summary).toMatch(/^Tilbake til utredning \(til /);
  });
  it("a feature delivered without ADO says so; one with an ADO id does not", () => {
    const before = plan([est({ id: "e", lane: "x", state: "aktiv" })]);
    const after = plan([est({ id: "e", lane: "x", state: "levert", deliveredAt: "2026-10-07", fv: { state: 1 } })]);
    expect(diffPlans(before, after).find((e) => e.code === "feature.tilstand")?.summary).toBe("Levert 7. okt · uten ADO");
    const linkedBefore = plan([est({ id: "e", lane: "x", state: "aktiv", adoId: 4486 })]);
    const linkedAfter = plan([est({ id: "e", lane: "x", state: "levert", deliveredAt: "2026-10-07", adoId: 4486, fv: { state: 1 } })]);
    expect(diffPlans(linkedBefore, linkedAfter).find((e) => e.code === "feature.tilstand")?.summary).toBe("Levert 7. okt");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx vitest run src/features/timeline/events.test.ts -t "R13" 2>&1 | tail -12`
Expected: FAIL — «Utredning startet (til …)» and «Levert 7. okt» instead.

- [ ] **Step 3: Implement** (in `stateSummary`)

```ts
    case "utredes": return ((b.state === "klar" || b.state === "aktiv") ? "Tilbake til utredning" : "Utredning startet") + " (til " + date(t.end) + ")";
    case "levert": return "Levert" + (t.deliveredAt ? " " + fmtDate(new Date(t.deliveredAt)) : "") + (t.adoId ? "" : " · uten ADO");
```

- [ ] **Step 4: Run the whole events file and the suite**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx vitest run 2>&1 | tail -6`
Expected: all pass. If an older test asserted «Levert 7. okt» on an unlinked feature, update that expectation to the new wording and ledger it.

- [ ] **Step 5: Commit**

```bash
git add src/features/timeline/events.ts src/features/timeline/events.test.ts
git commit -m "timeline: the history says «Tilbake til utredning» and «Levert … · uten ADO»"
```

---

### Task 3: Tidslinjen — the shelf's buttons, the editor's footer, the epic in «Start utredning», the date dialog

**Files:**
- Modify: `src/app/timeline/timeline.html` (`moveTask` ~1061; `renderShelf` ~1955; `startDiscovery`/`startSave` ~2005; `askDialog`; the editor footer markup ~783 and `openEditor` ~2108; the start dialog markup ~872; the help card ~594)
- Test: `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-polish-smoke.mjs` (P12–P14, before the final assert)

**Interfaces:**
- Consumes: Task 1's globals. Produces: `markDeliveredDialog(id)`, `startDiscovery(id)` with the epic select `#startLane`, buttons `.act-restart`, `.act-deliver`, `#edDeliver`, `#edRestart`, dialog title `#startTitle`.

- [ ] **Step 1: Write the failing smoke steps** (append before `assert(errors.length === 0 …)` in `hosted-polish-smoke.mjs`; reuse the file's helpers `saved`, `evs`, `page`)

```js
// P12 (R13): a «Klar for veikart» row without ADO offers «Levert …»; the day is asked (never ahead), the feature leaves the shelf, the history says «uten ADO»
await page.click("#registerBtn"); await page.waitForSelector("#dlgBack.open"); await page.fill("#dlgInput", "Levertsak"); await page.click("#dlgYes"); await saved();
await (await page.$('.shelf-row:has(.nm:text-is("Levertsak")) .act-start')).click(); await page.waitForSelector("#startBack.open");
await page.fill("#startOwner", "THM"); await page.click("#startSave"); await saved();
await (await page.$('.shelf-row:has(.nm:text-is("Levertsak")) .act-ready')).click(); await page.waitForSelector("#readyBack.open");
await page.fill("#readyLikely", "2"); await page.fill("#readyLate", "3"); await page.click("#readySave"); await saved();
assert(await page.$('.shelf-row:has(.nm:text-is("Levertsak")) .act-deliver'), "P12: the klar row offers «Levert …»");
await (await page.$('.shelf-row:has(.nm:text-is("Levertsak")) .act-deliver')).click(); await page.waitForSelector("#dlgBack.open");
const today = new Date().toISOString().slice(0, 10);
assert((await page.inputValue("#dlgInput")) === today && (await page.$eval("#dlgInput", (e) => e.type)) === "date", "P12: the day defaults to today");
await page.click("#dlgNo"); await page.waitForFunction(() => !document.getElementById("dlgBack").classList.contains("open"));
let ev = await evs(); let lv = ev.stored.data.tasks.find((t) => t.label === "Levertsak");
assert(lv.state === "klar", "P12: cancel changes nothing");
await (await page.$('.shelf-row:has(.nm:text-is("Levertsak")) .act-deliver')).click(); await page.waitForSelector("#dlgBack.open");
await page.fill("#dlgInput", "2099-01-01"); await page.click("#dlgYes");
await page.waitForFunction(() => /frem i tid/.test(document.getElementById("dlgMsg").textContent));
await page.fill("#dlgInput", "2026-10-07"); await page.click("#dlgYes"); await page.waitForSelector("#reasonBack.open"); await page.click("#reasonSkip"); await reasonClosed(); await saved();
ev = await evs(); lv = ev.stored.data.tasks.find((t) => t.label === "Levertsak");
assert(lv.state === "levert" && lv.deliveredAt === "2026-10-07" && lv.lane === "_backlog", "P12: delivered on the day: " + JSON.stringify({ state: lv.state, day: lv.deliveredAt }));
assert(!(await page.$('.shelf-row:has(.nm:text-is("Levertsak"))')), "P12: a delivered feature leaves the shelf");
assert(ev.events.some((e) => e.targetLabel === "Levertsak" && e.summary === "Levert 7. okt · uten ADO"), "P12: logged: " + ev.events.filter((e) => e.targetLabel === "Levertsak").map((e) => e.summary).join(" | "));
console.log("P12 ok");

// P13 (R13): «Tilbake til utredning» on a klar row reopens «Start utredning» with the epic; the feature lands as a discovery in the epic, the span is gone, the raw estimate stays
await page.click("#registerBtn"); await page.waitForSelector("#dlgBack.open"); await page.fill("#dlgInput", "Omsak"); await page.click("#dlgYes"); await saved();
await (await page.$('.shelf-row:has(.nm:text-is("Omsak")) .act-start')).click(); await page.waitForSelector("#startBack.open"); await page.fill("#startOwner", "KSO"); await page.click("#startSave"); await saved();
await (await page.$('.shelf-row:has(.nm:text-is("Omsak")) .act-ready')).click(); await page.waitForSelector("#readyBack.open"); await page.fill("#readyLikely", "3"); await page.fill("#readyLate", "5"); await page.click("#readySave"); await saved();
await (await page.$('.shelf-row:has(.nm:text-is("Omsak")) .act-restart')).click(); await page.waitForSelector("#startBack.open");
assert((await page.textContent("#startTitle")) === "Tilbake til utredning" && (await page.inputValue("#startLane")) === "_backlog", "P13: the restart dialog, shelf preselected");
await page.selectOption("#startLane", "kanaler"); await page.click('#startClass button[data-c="M"]'); await page.click("#startSave"); await page.waitForSelector("#reasonBack.open"); await page.click("#reasonSkip"); await reasonClosed(); await saved();
ev = await evs(); const om = ev.stored.data.tasks.find((t) => t.label === "Omsak");
assert(om.kind === "discovery" && om.state === "utredes" && om.lane === "kanaler" && !om.committedRange && om.raw && om.raw.likely === 3 && om.sizeClass === "M" && om.startedAt, "P13: back in discovery inside the epic: " + JSON.stringify(om));
assert(!(await page.$('.shelf-row:has(.nm:text-is("Omsak"))')) && (await page.$('.task-label[data-id="' + om.id + '"]')), "P13: off the shelf, on the epic's row");
assert(ev.events.some((e) => e.targetLabel === "Omsak" && /^Tilbake til utredning \(til /.test(e.summary)), "P13: logged: " + ev.events.filter((e) => e.targetLabel === "Omsak").map((e) => e.summary).join(" | "));
console.log("P13 ok");

// P14 (R13): «Legg i epic …» on an «Utredes» row places the discovery in the epic as a discovery; the editor offers «Marker levert …» only without ADO
await page.click("#registerBtn"); await page.waitForSelector("#dlgBack.open"); await page.fill("#dlgInput", "Utredsak"); await page.click("#dlgYes"); await saved();
await (await page.$('.shelf-row:has(.nm:text-is("Utredsak")) .act-start')).click(); await page.waitForSelector("#startBack.open"); await page.fill("#startOwner", "THM"); await page.click('#startClass button[data-c="L"]'); await page.click("#startSave"); await saved();
await (await page.$('.shelf-row:has(.nm:text-is("Utredsak")) .act-place')).click(); await page.waitForSelector("#placeBack.open");
await page.selectOption("#placeLane", "org"); await page.waitForFunction(() => /blir/.test(document.getElementById("placePreview").textContent));
assert(/venter på utredning/.test(await page.textContent("#placePreview")), "P14: the preview names the epic's colour: " + (await page.textContent("#placePreview")));
await page.click("#placeSave"); await page.waitForSelector("#reasonBack.open"); await page.click("#reasonSkip"); await reasonClosed(); await saved();
ev = await evs(); const us = ev.stored.data.tasks.find((t) => t.label === "Utredsak");
assert(us.kind === "discovery" && us.state === "utredes" && us.lane === "org", "P14: a discovery in the epic: " + JSON.stringify({ kind: us.kind, state: us.state, lane: us.lane }));
await page.click('.task-label[data-id="f24"] .t'); await page.waitForSelector("#editorBack.open");
assert(!(await page.$eval("#edDeliver", (e) => e.hidden)) && !(await page.$eval("#edRestart", (e) => e.hidden)), "P14: an unlinked aktiv feature offers «Marker levert …» and «Tilbake til utredning …»");
await page.click("#edCancel");
await page.click('.task-label[data-id="kapasitet"] .t'); await page.waitForSelector("#editorBack.open");
assert(await page.$eval("#edDeliver", (e) => e.hidden), "P14: a linked feature has no «Marker levert …»");
await page.click("#edCancel");
console.log("P14 ok");
```

(`reasonClosed` exists in the board smoke; if the polish smoke lacks it, define `const reasonClosed = () => page.waitForFunction(() => !document.getElementById("reasonBack").classList.contains("open"));` next to `saved`.)

- [ ] **Step 2: Run the smoke to verify it fails at P12**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-polish-smoke.mjs 2>&1 | tail -5`
Expected: `ASSERT: P12: the klar row offers «Levert …»` after P11 ok.

- [ ] **Step 3: Implement the page**

1. `moveTask`: replace the lifecycle block (`if(laneKey === BACKLOG && t.state === 'aktiv'){…} else if(fromLane === BACKLOG && …){…}`) and the preceding `t.lane = laneKey; touch(t, 'meta');` with
   `applyLaneChange(t, laneKey, new Date().toISOString().slice(0, 10)).forEach(g => touch(t, g));` (keep `if(fromLane !== laneKey){ … }` around it).
2. `renderShelf` actions:
   ```js
   if(t.state === 'ny') acts.innerHTML = '<button class="act-start">Start utredning</button>';
   else if(t.state === 'utredes') acts.innerHTML = '<button class="act-ready">Klar for veikart</button><button class="act-place">Legg i epic …</button>';
   else acts.innerHTML = '<button class="act-place primary">Legg i epic …</button><button class="act-restart" title="Utredes på nytt: spennet slippes, det rå estimatet beholdes">Tilbake til utredning</button>' + (canMarkDelivered(t) ? '<button class="act-deliver" title="Uten ADO-kobling settes leveringen her">Levert …</button>' : '');
   ```
   and the listeners: `.act-restart` → `startDiscovery(t.id)`, `.act-deliver` → `markDeliveredDialog(t.id)`.
3. Start dialog markup: give the `<h2>` the id `startTitle` and the md div the id `startSub`; add after the owner field
   `<label class="ed-field"><span>Epic</span><select id="startLane"></select></label>`.
   `startDiscovery(id)`: fill `#startLane` with `<option value="_backlog">Hylla (ingen epic)</option>` + every lane whose state is not `avsluttet`, `selected` on `t.lane`; set `#startTitle` to `canRestartDiscovery(t) ? 'Tilbake til utredning' : 'Start utredning'` and `#startSub` to `canRestartDiscovery(t) ? 'Spennet slippes og featuren utredes på nytt. Det rå estimatet beholdes til neste «Klar for veikart».' : 'Én eier og sluttdatoen vi lover nå.'`.
   `startSave`: after the existing field writes and before `normalizePlan(state)`, add
   ```js
   const lane = $('startLane').value;
   if(lane && lane !== t.lane && (getLane(lane) || lane === BACKLOG)){ const from = t.lane; moveTask(t.id, lane, laneTasks(lane).length); if(from === BACKLOG && lane !== BACKLOG) pendingNote.reasonCode = 'prioritering'; askReason([t.label + ': lagt i «' + laneDisplayName(lane) + '»']); }
   ```
   (`laneDisplayName` exists at ~1756.) `moveTask` must not re-touch `state` for a discovery; it calls `applyLaneChange`, which returns `["meta"]` for a discovery.
4. `askDialog`: `inp.type = opts.input === 'date' ? 'date' : 'text';` right after `inp.hidden = !opts.input;`.
5. Add after `placeInEpic`:
   ```js
   async function markDeliveredDialog(id){   // R13: delivery by hand, only for a feature without an ADO id
     const t = getTask(id); if(!t || !canMarkDelivered(t)) return;
     const today = dayKey(new Date());
     let msg = 'Når ble «' + t.label + '» levert? Uten ADO-kobling settes leveringen her, og dagen logges.';
     for(;;){
       const v = await askDialog('Marker levert', msg, {input:'date', value: today, confirmText:'Marker levert'});
       if(typeof v !== 'string' || !v) return;
       if(v > today){ msg = 'Leveringsdagen kan ikke være frem i tid. Når ble «' + t.label + '» levert?'; continue; }
       markDelivered(t, v).forEach(g => touch(t, g));
       state.example = false;
       askReason([t.label + ': markert levert ' + fmtDate(new Date(v)) + ' uten ADO']);
       normalizePlan(state); pushQueue(); save(); render();
       return;
     }
   }
   ```
6. Editor footer: in the left `btns` span add `<button class="ghost" id="edDeliver" hidden>Marker levert …</button><button class="ghost" id="edRestart" hidden>Tilbake til utredning …</button>` after `edHistory`.
   `openEditor`: `$('edDeliver').hidden = !(canWrite && canMarkDelivered(t)); $('edRestart').hidden = !(canWrite && canRestartDiscovery(t));`
   Listeners next to `edHistory`'s: `$('edDeliver').addEventListener('click', () => { const id = editorTaskId; closeEditor(); markDeliveredDialog(id); });` and `$('edRestart').addEventListener('click', () => { const id = editorTaskId; closeEditor(); startDiscovery(id); });`
7. Help card «Hylla og livssyklusen»: append `En utredning kan <b>legges i en epic</b> med én gang, en estimert feature kan gå <b>tilbake til utredning</b>, og en feature uten ADO-kobling <b>markeres levert</b> for hånd («Levert» kommer ellers fra ADO). Leverte features ligger på Brettet, ikke på hylla.`

- [ ] **Step 4: Run the smoke, then the whole file**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-polish-smoke.mjs 2>&1 | tail -6`
Expected: `P12 ok`, `P13 ok`, `P14 ok`, `POLISH SMOKE OK` (or the file's final line).

- [ ] **Step 5: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "timeline: delivered features leave the shelf; «Levert …» and «Tilbake til utredning» on the shelf and in the editor; a discovery can be placed in an epic from its row and from «Start utredning»"
```
(the smoke lives outside the repo; commit it in the workspace repo at the end)

---

### Task 4: Brettet — the matrix, the drop on «Levert», back to «Utredes», the epic in the start dialog and the card editor

**Files:**
- Modify: `src/app/board.html` (hint ~138; start dialog markup ~143; editor markup ~168; `colOf`/`allowed`/`dropOn` ~240–300; `openStart`/`startSave` ~306; `placeSave`/`backToShelf` ~340; `openEdit`/`edSave` ~380–430; `askDialog`)
- Test: `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-board-smoke.mjs` (B11–B13, before B7)

**Interfaces:**
- Consumes: Task 1's globals. Produces: `setLane(t, key)`, `markDeliveredDialog(id)`, `#startLane`, `#startTitle`, `#edLane`.

- [ ] **Step 1: Write the failing smoke steps** (insert before `// B7`)

```js
// B11 (R13): a drop on «Levert» asks the day for an unlinked card and refuses a linked one
await page.click("#registerBtn"); await page.waitForSelector("#dlgBack.open"); await page.fill("#dlgInput", "Levertkort"); await page.click("#dlgYes"); await saved();
ev = await evs(); const lkId = ev.stored.data.tasks.find((t) => t.label === "Levertkort").id;
await dragTo(lkId, "utredes"); await page.waitForSelector("#startBack.open"); await page.fill("#startOwner", "THM"); await page.click("#startSave"); await saved();
await dragTo(lkId, "klar"); await page.waitForSelector("#readyBack.open"); await page.fill("#readyLikely", "2"); await page.fill("#readyLate", "3"); await page.click("#readySave"); await saved();
await dragTo(lkId, "levert"); await page.waitForSelector("#dlgBack.open");
assert((await page.$eval("#dlgInput", (e) => e.type)) === "date" && (await page.inputValue("#dlgInput")) === new Date().toISOString().slice(0, 10), "B11: the day defaults to today");
await page.fill("#dlgInput", "2026-10-07"); await page.click("#dlgYes"); await page.waitForSelector("#reasonBack.open"); await page.click("#reasonSkip"); await reasonClosed(); await saved();
ev = await evs(); let lk = ev.stored.data.tasks.find((t) => t.id === lkId);
assert(lk.state === "levert" && lk.deliveredAt === "2026-10-07" && (await colOfCard(lkId)) === "levert", "B11: delivered by hand: " + JSON.stringify({ state: lk.state, day: lk.deliveredAt }));
assert((await page.$eval('.card[data-id="' + lkId + '"]', (c) => [...c.querySelectorAll(".chip")].map((x) => x.textContent))).includes("Levert 7. okt"), "B11: the chip");
assert(ev.events.some((e) => e.targetId === lkId && e.summary === "Levert 7. okt · uten ADO"), "B11: logged");
await dragTo("fildeling", "levert");
await page.waitForFunction(() => /koblet til ADO/.test(document.getElementById("note").textContent));
assert((await colOfCard("fildeling")) === "aktiv", "B11: a linked card stays");
console.log("B11 ok");

// B12 (R13): back to «Utredes» from «Klar for veikart» (with an epic chosen) and from «Aktiv» (inside its epic)
await page.click("#registerBtn"); await page.waitForSelector("#dlgBack.open"); await page.fill("#dlgInput", "Omkort"); await page.click("#dlgYes"); await saved();
ev = await evs(); const okId = ev.stored.data.tasks.find((t) => t.label === "Omkort").id;
await dragTo(okId, "utredes"); await page.waitForSelector("#startBack.open"); await page.fill("#startOwner", "KSO"); await page.click("#startSave"); await saved();
await dragTo(okId, "klar"); await page.waitForSelector("#readyBack.open"); await page.fill("#readyLikely", "3"); await page.fill("#readyLate", "5"); await page.click("#readySave"); await saved();
await dragTo(okId, "utredes"); await page.waitForSelector("#startBack.open");
assert((await page.textContent("#startTitle")) === "Tilbake til utredning" && (await page.inputValue("#startLane")) === "_backlog", "B12: the restart dialog");
await page.selectOption("#startLane", "org"); await page.click("#startSave"); await page.waitForSelector("#reasonBack.open"); await page.click("#reasonSkip"); await reasonClosed(); await saved();
ev = await evs(); let ok = ev.stored.data.tasks.find((t) => t.id === okId);
assert(ok.kind === "discovery" && ok.state === "utredes" && ok.lane === "org" && ok.raw && ok.raw.likely === 3 && !ok.committedRange, "B12: a discovery in the epic: " + JSON.stringify(ok));
assert((await colOfCard(okId)) === "utredes" && (await page.$eval('.card[data-id="' + okId + '"] .epic', (e) => e.textContent)) === "En ny organisasjon er i gang fra dag én", "B12: the card shows the epic");
assert(ev.events.some((e) => e.targetId === okId && /^Tilbake til utredning/.test(e.summary)), "B12: logged");
await dragTo("kapasitet", "utredes"); await page.waitForSelector("#startBack.open");
assert((await page.inputValue("#startLane")) === "telenor", "B12: the current epic is preselected");
await page.fill("#startOwner", "THM"); await page.click("#startSave"); await saved();
ev = await evs(); const kp = ev.stored.data.tasks.find((t) => t.id === "kapasitet");
assert(kp.kind === "discovery" && kp.state === "utredes" && kp.lane === "telenor" && !kp.committedRange && !kp.activatedAt, "B12: aktiv back to discovery inside its epic: " + JSON.stringify(kp));
assert((await colOfCard("kapasitet")) === "utredes", "B12: in Utredes");
console.log("B12 ok");

// B13 (R13): the card editor's «Epic» moves a discovery into an epic and an estimate in and out with the span rule; a shelf discovery dropped on Aktiv is refused with a hint
await page.click("#registerBtn"); await page.waitForSelector("#dlgBack.open"); await page.fill("#dlgInput", "Epikort"); await page.click("#dlgYes"); await saved();
ev = await evs(); const epId = ev.stored.data.tasks.find((t) => t.label === "Epikort").id;
await dragTo(epId, "utredes"); await page.waitForSelector("#startBack.open"); await page.fill("#startOwner", "THM"); await page.click("#startSave"); await saved();
await dragTo(epId, "aktiv");
await page.waitForFunction(() => /ligger på hylla/.test(document.getElementById("note").textContent));
await page.click('.card[data-id="' + epId + '"] .ttl'); await page.waitForSelector("#editBack.open");
assert((await page.inputValue("#edLane")) === "_backlog", "B13: the editor shows the shelf");
await page.selectOption("#edLane", "kanaler"); await page.click("#edSave"); await page.waitForSelector("#reasonBack.open"); await page.click("#reasonSkip"); await reasonClosed(); await saved();
ev = await evs(); let ep = ev.stored.data.tasks.find((t) => t.id === epId);
assert(ep.lane === "kanaler" && ep.state === "utredes" && ep.kind === "discovery" && (await colOfCard(epId)) === "utredes", "B13: the discovery moved: " + JSON.stringify({ lane: ep.lane, state: ep.state }));
assert(ev.events.some((e) => e.targetId === epId && e.code === "feature.epic"), "B13: logged as an epic change");
await page.click("#registerBtn"); await page.waitForSelector("#dlgBack.open"); await page.fill("#dlgInput", "Estkort"); await page.click("#dlgYes"); await saved();
ev = await evs(); const ekId = ev.stored.data.tasks.find((t) => t.label === "Estkort").id;
await dragTo(ekId, "utredes"); await page.waitForSelector("#startBack.open"); await page.fill("#startOwner", "KSO"); await page.click("#startSave"); await saved();
await dragTo(ekId, "klar"); await page.waitForSelector("#readyBack.open"); await page.fill("#readyLikely", "2"); await page.fill("#readyLate", "4"); await page.click("#readySave"); await saved();
await page.click('.card[data-id="' + ekId + '"] .ttl'); await page.waitForSelector("#editBack.open");
await page.selectOption("#edLane", "filer"); await page.click("#edSave"); await page.waitForSelector("#reasonBack.open");
assert(await page.$('#reasonCodes button.on[data-code="prioritering"]'), "B13: prioritering preselected when placed from the shelf");
await page.click("#reasonSkip"); await reasonClosed(); await saved();
ev = await evs(); let ek = ev.stored.data.tasks.find((t) => t.id === ekId);
assert(ek.lane === "filer" && ek.state === "aktiv" && ek.committedRange && ek.activatedAt && (await colOfCard(ekId)) === "aktiv", "B13: the estimate became aktiv with the span: " + JSON.stringify(ek));
await page.click('.card[data-id="' + ekId + '"] .ttl'); await page.waitForSelector("#editBack.open");
await page.selectOption("#edLane", "_backlog"); await page.click("#edSave"); await page.waitForSelector("#reasonBack.open"); await page.click("#reasonSkip"); await reasonClosed(); await saved();
ev = await evs(); ek = ev.stored.data.tasks.find((t) => t.id === ekId);
assert(ek.lane === "_backlog" && ek.state === "klar" && !ek.committedRange && (await colOfCard(ekId)) === "klar", "B13: back on the shelf as klar");
console.log("B13 ok");
```

- [ ] **Step 2: Run the board smoke to verify it fails at B11**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-board-smoke.mjs 2>&1 | tail -5`
Expected: after `B10 ok`, B11 times out waiting for `#dlgBack.open` (the drop on Levert is refused today) or asserts the input type.

- [ ] **Step 3: Implement the page**

1. `colOf` → `const colOf = boardColumn;`. `allowed(t, to)` → `return !!t && canWrite && featureTransition(t, to);`.
2. `dropOn` refusals:
   ```js
   if(!allowed(t, to)){
     const from = colOf(t);
     toast(to === 'levert' ? (t.adoId ? '#' + t.adoId + ' er koblet til ADO: lukk den der, så henter «Oppdater fra ADO» leveringen.' : 'Den er alt levert.')
       : to === 'ny' ? 'Et ønske går ikke tilbake til Registrert. Slett det i Tidslinjen om det var feil.'
       : from === 'utredes' && t.lane !== BACKLOG && to === 'klar' ? 'Utredningen ligger i en epic: dra den rett til Aktiv.'
       : from === 'utredes' && t.lane === BACKLOG && to === 'aktiv' ? 'Utredningen ligger på hylla: velg epic i «Rediger kort», eller gjør den klar for veikart først.'
       : 'Den overgangen finnes ikke.');
     return;
   }
   if(to === 'utredes') openStart(t.id);
   else if(to === 'levert') markDeliveredDialog(t.id);
   else if(to === 'klar' && colOf(t) === 'utredes') openReady(t.id);
   else if(to === 'aktiv' && colOf(t) === 'utredes') openReady(t.id);
   else if(to === 'aktiv') openPlace(t.id);
   else if(to === 'klar' && colOf(t) === 'aktiv') backToShelf(t);
   ```
3. Start dialog markup: `<h2 id="startTitle">Start utredning</h2>`; add `<label class="ed-field"><span>Epic</span><select id="startLane"></select></label>` in the `ed-row` after the owner. `openStart`: fill `#startLane` (Hylla + lanes not avsluttet, `t.lane` selected), set `#startTitle`/`#startSub` as on Tidslinjen (restart wording when `canRestartDiscovery(t)`), `setStartClass(t.sizeClass || 'M')`.
   `startSave`: after the field writes, before `commit()`: `if(setLane(t, $('startLane').value)) askReason([t.label + ': lagt i «' + laneName(t.lane) + '»']);` where `const laneName = key => key === BACKLOG ? 'hylla' : (getLane(key) || {name: key}).name;`.
4. The shared lane helper, next to `backToShelf`:
   ```js
   function setLane(t, key){   // R13: the same rule as Tidslinjen (applyLaneChange); returns true when it moved
     if(!key || key === t.lane || !(getLane(key) || key === BACKLOG) || t.state === 'ny') return false;
     const from = t.lane;
     applyLaneChange(t, key, new Date().toISOString().slice(0, 10)).forEach(g => touch(t, g));
     t.order = Math.max(0, ...state.tasks.filter(v => v.lane === key && v.id !== t.id).map(v => v.order || 0)) + 1;
     if(from === BACKLOG && key !== BACKLOG) pendingNote.reasonCode = 'prioritering';
     return true;
   }
   ```
   `placeSave`: replace its inline lane/state block with `if(!setLane(t, key)) return;` then `askReason([…])` + `commit()`. `backToShelf`: replace its inline block with `setLane(t, BACKLOG);` (keep the confirm and the reason line).
5. Card editor: add `<label class="ed-field" style="max-width:260px"><span>Epic</span><select id="edLane"></select></label>` to the first `ed-row`. `openEdit`: fill it (Hylla + lanes not avsluttet, `t.lane` selected), `$('edLane').disabled = !canWrite || t.state === 'ny' || t.state === 'levert'`.
   `edSave`: before `const depsNow = …`: `if(setLane(t, $('edLane').value)) lines.push(t.label + ': flyttet til «' + laneName(t.lane) + '»');`.
6. `markDeliveredDialog(id)`: as on Tidslinjen with `commit()` instead of `normalizePlan/pushQueue/save/render` and `new Date().toISOString().slice(0, 10)` for today; `askDialog` gets `inp.type = opts.input === 'date' ? 'date' : 'text'; inp.value = opts.value || '';`.
7. Hint (line ~138): `… <b>Levert</b> settes fra ADO; en feature uten ADO-kobling dras til Levert og får dagen. Fra Klar for veikart og Aktiv kan et kort dras tilbake til <b>Utredes</b>. Klikk et kort for å redigere … og epicen den ligger i; …`.

- [ ] **Step 4: Run the board smoke**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-board-smoke.mjs 2>&1 | tail -6`
Expected: `B11 ok`, `B12 ok`, `B13 ok`, `B7 ok`, `B8 ok`, `BOARD SMOKE OK`.

- [ ] **Step 5: Commit**

```bash
git add src/app/board.html
git commit -m "board: a card can be delivered by hand without ADO, go back to Utredes, and get its epic from the card editor; the column rule and the lane rule are the shared ones"
```

---

### Task 5: Whole-branch verification, review, PR text

**Files:**
- Create: `~/Skytale/ClaudeReports/planning/roadmap-2.0/pr-body-lifecycle-r13.md`

- [ ] **Step 1: Run everything**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx vitest run 2>&1 | tail -4 && NODE_OPTIONS= npx tsc --noEmit && NODE_OPTIONS= npx eslint src && NODE_OPTIONS= npx next build 2>&1 | tail -3`
Expected: all green.
Run each smoke: `hosted-smoke.mjs`, `hosted-polish-smoke.mjs`, `ui-smoke.mjs`, `hosted-history-smoke.mjs`, `hosted-board-smoke.mjs`, `hosted-intake-smoke.mjs`, `hosted-release-smoke.mjs` with `NODE_OPTIONS= npx tsx <path>`; Expected: each prints its OK line.

- [ ] **Step 2: Review** — `/review-branch` inline from the worktree (base `origin/main`, merge-base 61f2e9e); Critical/Important → one fix pass with TDD; minors → ledger.

- [ ] **Step 3: PR text** — write `pr-body-lifecycle-r13.md` in the style of `pr-body-release-progress.md` (what changed, verification, after merge: the four delivered features vanish from the shelf on the next load; «Fildeling i chat» → «Tilbake til utredning»). No Claude mention.

- [ ] **Step 4: Commit the smokes in the workspace repo** (`~/Skytale`: `git add ClaudeReports/planning/roadmap-2.0/build/hosted-polish-smoke.mjs ClaudeReports/planning/roadmap-2.0/build/hosted-board-smoke.mjs ClaudeReports/planning/roadmap-2.0/pr-body-lifecycle-r13.md`), then hand over: GO pushes `feat/lifecycle-r13` to the fork, I open the PR.

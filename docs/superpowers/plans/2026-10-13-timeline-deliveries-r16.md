# Tidslinjen R16: Leveranser (the COO layer) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** COO's deliveries over epics and releases: the data, the rules (computed date, status, lines, customers per epic), the events, the compare and investor sections, the page «Kunder» with the editor, and the band + chip on Tidslinjen.

**Architecture:** `deliveries[]` in the plan JSON with whole-object versioning like releases (merge.ts). Pure rules in `epic-tools.js` (shared by the pages, the investor route and vitest). `events.ts` diffs deliveries into `leveranse.*` events; `compare.ts` counts and exports them; `investor.ts` adds the section. A new plain-JS page `kunder.html` (modelled on `inntak.html`) with the editor and the two views; `timeline.html` gets the band in the axis, the customers chip on the epic row, the investor block and the import rule. A Playwright smoke drives both pages behind the mock API.

**Tech Stack:** plain HTML/JS pages served by Next route handlers, `epic-tools.js` (CommonJS + browser globals), TypeScript modules, vitest 4, Playwright smokes (`NODE_OPTIONS= npx tsx <smoke>` from the worktree).

**Spec:** `docs/superpowers/specs/2026-10-13-planning-system-r16-deliveries-design.md`

## Global Constraints

- Norwegian in the UI and stored text, English in code and commits. No Claude attribution anywhere.
- `module.exports` of `epic-tools.js` must equal `epic-tools.d.ts` (the existing test checks it). The pages call the helpers as bare globals.
- Nothing is read from or written to ADO for deliveries. No notification.
- Keys of since-deleted epics or releases stay in a delivery's data and are ignored when read (never rewritten by the normaliser).
- Branch `feat/deliveries-r16` is cut from `feat/ux-forum-r15` (PR #22 open); rebased onto `origin/main` after #22 lands, before its PR.
- Smokes live in `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/` and run with `NODE_OPTIONS= npx tsx <path>` from the worktree.

## Review Focus

1. A delivery whose epic was deleted after the delivery was saved: the key stays, the row and the band ignore it, nothing throws. (Task 1: `deliveryParts` test with an unknown key.)
2. An epic whose features all ended in the past but are not delivered: the computed day is today, never a day in the past. (Task 1: the floor test.)
3. A delivery with no customers and «Alle kunder» off: one row «Ingen kunder», the chip stays off the epic. (Task 1: `deliveryLines` test; Task 3 renders it.)
4. A reader on Kunder: no «＋ Leveranse», no «Rediger…», the rows and both views still render. (Task 3: smoke D6.)
5. A plan without `deliveries` at all (every plan saved before R16): the investor route, the band and the page treat it as empty. (Task 1: normaliser gives `[]`; Task 2: investor markdown of a plan without the field.)

---

### Task 1: the data and the rules (merge.ts, epic-tools.js, d.ts, tests)

**Files:**
- Modify: `src/features/timeline/merge.ts` (types after `Release`, `Plan` fields after `deletedReleases`, the union in `mergePlans` after the releases block, `out`)
- Modify: `src/features/timeline/epic-tools.js` (the normaliser after the releases block; the rules after `forumDefault`; `NAV_TABS`; the export list)
- Modify: `src/features/timeline/epic-tools.d.ts` (import `Delivery`; `navTabsHtml` active union; the R16 block at the end)
- Test: `src/features/timeline/merge.test.ts` (end), `src/features/timeline/epic-tools.test.ts` (import list, the R14 navTabs tests, a new describe at the end)

**Interfaces:**
- Produces: `Delivery` type; `plan.deliveries`, `plan.deletedDeliveries`; the rules named in the spec §3 with these signatures:
  `deliveryOwner(d)`, `deliveryCustomersText(d)`, `deliveryParts(plan, d)`, `deliveryComputed(plan, d, todayDay)`, `deliveryStatus(plan, d, todayDay)` → `{ code, computed, by, pending, deltaDays, weeks, deviation, text }`, `deliveryUnlabelled(plan, d)`, `deliveryBugsLeft(plan, d)`, `deliveryPartsText(plan, d)`, `deliveryLines(plan, todayDay)`, `epicCustomers(plan, laneKey)`, `epicCustomersText(c)`, `epicWeight(c)`, `deliverySegments(plan, todayDay)`, `deliveryInvestor(plan, d, todayDay)`, `DELIVERY_OWNER`, `DELIVERY_WORD`; `navTabsHtml` with the tab `kunder`.

- [ ] **Step 1: Write the failing merge test**

Append to `merge.test.ts`:

```ts
describe("mergePlans - deliveries (R16)", () => {
  const d = (key: string, v: number, promisedDate: string) => ({ key, v, name: "L " + key, customers: [], epics: [], releases: [], promisedDate });
  it("unions deliveries by key like releases: higher version wins, incoming wins ties, tombstones remove unless bumped past", () => {
    const stored = plan([], { deliveries: [d("a", 2, "2026-11-30"), d("b", 1, "2026-12-15"), d("c", 1, "2027-01-15")] });
    const incoming = plan([], { deliveries: [d("a", 1, "2026-12-07"), d("b", 1, "2026-12-22"), d("d", 1, "2027-02-01")], deletedDeliveries: { c: 1 } });
    const m = mergePlans(stored, incoming);
    expect(m.deliveries!.map((x) => [x.key, x.promisedDate])).toEqual([["a", "2026-11-30"], ["b", "2026-12-22"], ["d", "2027-02-01"]]);
    expect(m.deletedDeliveries).toEqual({ c: 1 });
    const revived = mergePlans(m, plan([], { deliveries: [d("c", 2, "2027-01-15")] }));
    expect(revived.deliveries!.some((x) => x.key === "c")).toBe(true);
    expect(mergePlans(plan([]), plan([])).deliveries).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `NODE_OPTIONS= npx vitest run src/features/timeline/merge.test.ts 2>&1 | tail -12`
Expected: FAIL — `deliveries` is undefined / a type error on `Plan` (vitest strips types; the assertion on `m.deliveries` fails).

- [ ] **Step 3: Implement the type and the merge**

In `merge.ts` after the `Release` type:

```ts
/** A delivery (R16): COO's promise to customers, hanging on epics and releases. Versioned like a release (`v`). Keys of since-deleted parts stay and are ignored when read. */
export type Delivery = {
  key: string;
  v?: number;
  name: string;
  /** Named customers; empty when `allCustomers`. */
  customers: string[];
  allCustomers?: true;
  /** YYYY-MM-DD, COO's. */
  promisedDate: string;
  owner?: string;
  note?: string;
  /** Lane keys. */
  epics: string[];
  /** Release keys. */
  releases: string[];
};
```

In `Plan` after `deletedReleases?: ...`:

```ts
  deliveries?: Delivery[];
  deletedDeliveries?: Record<string, number>;
```

In `mergePlans` after `const deletedReleases = ...`: `const deletedDeliveries = mergeTombstones(stored.deletedDeliveries, incoming.deletedDeliveries);` and after the releases block:

```ts
  // deliveries (R16): like releases, by key and version
  const deliveries: Delivery[] = [];
  const delByKey = new Map((incoming.deliveries ?? []).map((d) => [d.key, d]));
  for (const s of stored.deliveries ?? []) {
    const i = delByKey.get(s.key);
    deliveries.push(i && (i.v ?? 0) >= (s.v ?? 0) ? { ...i } : { ...s });
    delByKey.delete(s.key);
  }
  for (const i of delByKey.values()) deliveries.push({ ...i });
  const liveDeliveries = deliveries.filter((d) => { const tomb = deletedDeliveries[d.key]; return tomb === undefined || (d.v ?? 0) > tomb; });
```

and in `out`: `..., releases: liveReleases, deletedReleases, deliveries: liveDeliveries, deletedDeliveries };`

- [ ] **Step 4: Run the merge test to see it pass**

Run: `NODE_OPTIONS= npx vitest run src/features/timeline/merge.test.ts 2>&1 | tail -6`
Expected: all pass.

- [ ] **Step 5: Write the failing epic-tools tests**

In `epic-tools.test.ts` add to the import list (after `forumBaseline, forumDefault,`):
`DELIVERY_WORD, deliveryOwner, deliveryCustomersText, deliveryParts, deliveryComputed, deliveryStatus, deliveryUnlabelled, deliveryBugsLeft, deliveryPartsText, deliveryLines, epicCustomers, epicCustomersText, epicWeight, deliverySegments, deliveryInvestor,`

Change the two R14 navTabs tests: the hrefs become `["/inntak", "/timeline", "/", "/kunder"]`; add to the file:// test `expect(html).toContain('id="tab-kunder" data-tab="kunder" href="/kunder" hidden>');`.

Append:

```ts
describe("R16: Leveranser, the COO layer", () => {
  const D = (y: number, m: number, d: number) => dateToUnit(new Date(y, m - 1, d));
  const TODAY = "2026-10-13";
  const del = (over: Record<string, unknown> = {}) => ({ key: "d1", name: "Skytale 2.0", customers: [], allCustomers: true, promisedDate: "2026-11-30", epics: ["x"], releases: ["r1"], ...over });
  const base = (over: Record<string, unknown> = {}) => normalizePlan({
    lanes: [{ key: "x", name: "Epic X", priority: 1 }, { key: "y", name: "Epic Y", state: "avsluttet", outcome: "nådd", priority: 2 }, { key: "z", name: "Epic Z", priority: 3 }],
    tasks: [
      { id: "x1", lane: "x", label: "X1", kind: "estimate", start: D(2026, 11, 2), endLikely: D(2026, 12, 4), end: D(2026, 12, 11), deps: [], fv: {}, state: "aktiv" },
      { id: "y1", lane: "y", label: "Y1", kind: "estimate", start: D(2026, 9, 1), endLikely: D(2026, 9, 20), end: D(2026, 9, 30), deps: [], fv: {}, state: "levert", deliveredAt: "2026-09-30" },
    ],
    releases: [{ key: "r1", version: "2.0.1", targetDate: "2026-11-20", ado: { at: "2026-10-13T08:00:00.000Z", label: "2.0.1", items: [
      { id: 1, type: "Bug", title: "a", state: "New", points: 3, assignee: null }, { id: 2, type: "Bug", title: "b", state: "Closed", points: 2, assignee: null }, { id: 3, type: "User Story", title: "c", state: "New", points: 5, assignee: null },
    ], sprints: [{ name: "Sprint 71", unlabelled: 3 }] } }, { key: "r0", version: "2.0.0", targetDate: "2026-10-07", shippedDate: "2026-10-07" }],
    deliveries: [del()],
    ...over,
  });

  it("the normaliser keeps a delivery with key, name and a valid promised day, cleans customers and keys, sorts by promised day", () => {
    const p = normalizePlan({ lanes: [], tasks: [], deliveries: [
      del({ key: "b", name: "  B ", promisedDate: "2026-12-01", allCustomers: false, customers: [" Telenor ", "NSR", "Telenor", "", 7], epics: ["x", "x", ""], releases: 5, owner: " COO ", note: " n " }),
      del({ key: "a", promisedDate: "2026-11-01", epics: [], releases: [] }),
      del({ key: "", promisedDate: "2026-11-01" }), del({ key: "c", name: "" }), del({ key: "e", promisedDate: "2026-02-30" }), null,
    ], deletedDeliveries: { gone: 1 } });
    expect(p.deliveries!.map((d) => d.key)).toEqual(["a", "b"]);
    expect(p.deliveries![0]).toEqual({ key: "a", v: 0, name: "Skytale 2.0", customers: [], allCustomers: true, promisedDate: "2026-11-01", epics: [], releases: [] });
    expect(p.deliveries![1]).toEqual({ key: "b", v: 0, name: "B", customers: ["Telenor", "NSR"], promisedDate: "2026-12-01", epics: ["x"], releases: [], owner: "COO", note: "n" });
    expect(p.deletedDeliveries).toEqual({ gone: 1 });
    expect(normalizePlan({ lanes: [], tasks: [] }).deliveries).toEqual([]);
  });

  it("words: owner, customers", () => {
    expect(deliveryOwner(del())).toBe("COO");
    expect(deliveryOwner(del({ owner: "GO" }))).toBe("GO");
    expect(deliveryCustomersText(del())).toBe("alle kunder");
    expect(deliveryCustomersText(del({ allCustomers: undefined, customers: ["Telenor", "NSR"] }))).toBe("Telenor, NSR");
    expect(deliveryCustomersText(del({ allCustomers: undefined, customers: [] }))).toBe("ingen kunder");
  });

  it("the parts are the existing epics and releases; an unknown key is ignored", () => {
    const p = base({ deliveries: [del({ epics: ["x", "gone"], releases: ["r1", "nope"] })] });
    const parts = deliveryParts(p, p.deliveries![0]);
    expect(parts.epics.map((l) => l.key)).toEqual(["x"]);
    expect(parts.releases.map((r) => r.key)).toEqual(["r1"]);
  });

  it("the computed date is the latest of the open epic's late end and the release's expected finish, with who gives it", () => {
    const p = base();
    const c = deliveryComputed(p, p.deliveries![0], TODAY);
    expect(c).toEqual({ day: "2026-12-11", by: { kind: "epic", key: "x", name: "Epic X" }, pending: false, open: 2, parts: 2 });
    const s = deliveryStatus(p, p.deliveries![0], TODAY);
    expect(s.code).toBe("rod");
    expect(s.deltaDays).toBe(9);
    expect(s.weeks).toBe(1.6);
    expect(s.text).toBe("utregnet 11. des · 1,6 uker etter lovet · dratt av «Epic X»");
    expect(deliveryStatus(p, { ...p.deliveries![0], promisedDate: "2026-12-11" }, TODAY)).toMatchObject({ code: "gronn", deltaDays: 0, text: "utregnet 11. des · på lovet dato · dratt av «Epic X»" });
    expect(deliveryStatus(p, { ...p.deliveries![0], promisedDate: "2026-12-09" }, TODAY)).toMatchObject({ code: "gul", deltaDays: 2, text: "utregnet 11. des · to arbeidsdager etter lovet · dratt av «Epic X»" });
    expect(deliveryStatus(p, { ...p.deliveries![0], promisedDate: "2026-12-18" }, TODAY)).toMatchObject({ code: "gronn", deltaDays: -5, text: "utregnet 11. des · 1 uke før lovet · dratt av «Epic X»" });
  });

  it("a release without a tempo gives its target day; a shipped release and a closed epic give nothing; nothing open is «alt levert»; no parts is «ingen»", () => {
    const p = base();
    const onlyRel = deliveryStatus(p, { ...p.deliveries![0], epics: [] }, TODAY);
    expect(onlyRel).toMatchObject({ code: "gronn", computed: "2026-11-20", text: "utregnet 20. nov · 1,4 uker før lovet · dratt av release 2.0.1" });
    expect(deliveryStatus(p, { ...p.deliveries![0], epics: ["y"], releases: ["r0"] }, TODAY)).toMatchObject({ code: "gronn", computed: null, text: "alt levert" });
    expect(deliveryStatus(p, { ...p.deliveries![0], epics: [], releases: [] }, TODAY)).toMatchObject({ code: "ingen", computed: null, text: "henger ikke på noe ennå" });
    expect(DELIVERY_WORD).toEqual({ gronn: "grønn", gul: "gul", rod: "rød", ingen: "uten dato" });
  });

  it("a discovery makes the date a floor («minst … · venter på utredning»); an end in the past is floored at today", () => {
    const p = base({ tasks: [
      { id: "x1", lane: "x", label: "X1", kind: "discovery", start: D(2026, 10, 5), end: D(2026, 10, 26), deps: [], fv: {}, state: "utredes" },
      { id: "z1", lane: "z", label: "Z1", kind: "estimate", start: D(2026, 8, 3), endLikely: D(2026, 9, 1), end: D(2026, 9, 15), deps: [], fv: {}, state: "aktiv" },
    ], deliveries: [del({ releases: [] }), del({ key: "d2", name: "Z", epics: ["z"], releases: [] })] });
    expect(deliveryStatus(p, p.deliveries![0], TODAY)).toMatchObject({ pending: true, computed: "2026-10-26", code: "gronn", text: "minst 26. okt · 5 uker før lovet · venter på utredning · dratt av «Epic X»" });
    expect(deliveryStatus(p, p.deliveries![1], TODAY)).toMatchObject({ computed: TODAY, by: { kind: "epic", key: "z" } });
  });

  it("bugs left, items without a label, the parts text and the lines", () => {
    const p = base();
    const d = p.deliveries![0];
    expect(deliveryBugsLeft(p, d)).toBe(1);
    expect(deliveryUnlabelled(p, d)).toBe(3);
    expect(deliveryPartsText(p, d)).toBe("Release 2.0.1 · Epic X · 3 uten release-label");
    expect(deliveryPartsText(p, { ...d, epics: [], releases: [] })).toBe("ingenting ennå");
    const lines = deliveryLines(p, TODAY);
    expect(lines.map((l) => [l.key, l.customer, l.all, l.none])).toEqual([["d1", "Alle kunder", true, false]]);
    expect(lines[0].status.code).toBe("rod");
    const named = deliveryLines(base({ deliveries: [del({ allCustomers: undefined, customers: ["Telenor", "NSR"] }), del({ key: "d2", name: "Tom", allCustomers: undefined, customers: [] })] }), TODAY);
    expect(named.map((l) => [l.key, l.customer, l.none])).toEqual([["d1", "Telenor", false], ["d1", "NSR", false], ["d2", "Ingen kunder", true]]);
  });

  it("customers per epic: all wins, names are distinct, the weight follows the count", () => {
    const p = base({ deliveries: [
      del({ key: "d1", allCustomers: true, epics: ["x"] }),
      del({ key: "d2", name: "Video", allCustomers: undefined, customers: ["Kunde B", "Kunde C"], epics: ["z"], releases: [] }),
      del({ key: "d3", name: "Proxy i drift", allCustomers: undefined, customers: ["Kunde B"], epics: ["z", "y"], releases: [] }),
    ] });
    const x = epicCustomers(p, "x"), z = epicCustomers(p, "z"), y = epicCustomers(p, "y"), none = epicCustomers(p, "nope");
    expect([x.all, x.names, x.deliveries.map((d) => d.key)]).toEqual([true, [], ["d1"]]);
    expect([z.all, z.names, z.count]).toEqual([false, ["Kunde B", "Kunde C"], 2]);
    expect([epicCustomersText(x), epicCustomersText(z), epicCustomersText(y), epicCustomersText(none)]).toEqual(["alle kunder", "2 kunder", "1 kunde", ""]);
    expect([epicWeight(x), epicWeight(z), epicWeight(y), epicWeight(none)]).toEqual([
      { code: "tyngst", label: "Tyngst" }, { code: "flere", label: "Flere interessenter" }, { code: "lett", label: "Lett å prioritere" }, { code: "ingen", label: "Ingen kunder venter" },
    ]);
  });

  it("segments: from the earliest feature start (else the release's segment, else today) to the computed day, the promise as a unit", () => {
    const p = base();
    const sg = deliverySegments(p, TODAY);
    expect(sg.length).toBe(1);
    expect(sg[0].start).toBeCloseTo(D(2026, 11, 2), 5);
    expect(sg[0].end).toBeCloseTo(D(2026, 12, 11), 5);
    expect(sg[0].promised).toBeCloseTo(D(2026, 11, 30), 5);
    expect(sg[0].status.code).toBe("rod");
    const rel = deliverySegments(base({ deliveries: [del({ epics: [] })] }), TODAY)[0];
    expect(rel.start).toBeCloseTo(D(2026, 11, 20) - 2 * WEEK, 5);
    const bare = deliverySegments(base({ deliveries: [del({ epics: [], releases: [] })] }), TODAY)[0];
    expect(bare.start).toBeCloseTo(D(2026, 10, 13), 5);
    expect(bare.end).toBeCloseTo(D(2026, 11, 30), 5);
  });

  it("the investor numbers per delivery", () => {
    const p = base({ deliveries: [del({ epics: ["x", "y"] })] });
    expect(deliveryInvestor(p, p.deliveries![0], TODAY)).toEqual({
      key: "d1", name: "Skytale 2.0", customers: "alle kunder", owner: "COO", promised: "2026-11-30", computed: "2026-12-11", weeks: 1.6, colour: "rød", code: "rod",
      by: "«Epic X»", pending: false, epicsDone: 1, epicsTotal: 2, bugsLeft: 1, text: "utregnet 11. des · 1,6 uker etter lovet · dratt av «Epic X»",
    });
  });
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `NODE_OPTIONS= npx vitest run src/features/timeline/epic-tools.test.ts 2>&1 | tail -12`
Expected: FAIL — `deliveryOwner is not a function` (and the exports/d.ts equality test).

- [ ] **Step 7: Implement in epic-tools.js**

In `normalizePlan`, after the releases block (`}).sort((a, b) => releaseEnd(a) - releaseEnd(b) || ...);`), before `p.lanes.forEach`:

```js
  // deliveries (R16): COO's promise to customers, hanging on epics and releases; a key of a since-deleted part stays and is ignored when read
  p.deletedDeliveries = p.deletedDeliveries && typeof p.deletedDeliveries === "object" ? p.deletedDeliveries : {};
  const strList = (v, max, n) => { const out = []; (Array.isArray(v) ? v : []).forEach((s) => { const t = text(s, max); if (t && !out.includes(t) && out.length < n) out.push(t); }); return out; };
  p.deliveries = (Array.isArray(p.deliveries) ? p.deliveries : []).filter((d) => d && typeof d === "object" && typeof d.key === "string" && d.key && text(d.name, 120) && validDay(d.promisedDate)).map((d) => {
    const out = { key: d.key, v: num(d.v, 0), name: text(d.name, 120), customers: d.allCustomers ? [] : strList(d.customers, 60, 50), promisedDate: d.promisedDate, epics: strList(d.epics, 80, 200), releases: strList(d.releases, 80, 200) };
    if (d.allCustomers) out.allCustomers = true;
    const owner = text(d.owner, 60); if (owner) out.owner = owner;
    const note = text(d.note, 2000); if (note) out.note = note;
    return out;
  }).sort((a, b) => (a.promisedDate < b.promisedDate ? -1 : a.promisedDate > b.promisedDate ? 1 : a.name.localeCompare(b.name, "nb")));
```

Note: `text(s, max)` returns null for a non-string, so a number in `customers` is dropped. (`text` returns the trimmed string; `allCustomers: false` is falsy, so customers are kept.)

`NAV_TABS`: `[["inntak", "Inntak", "/inntak"], ["timeline", "Tidslinjen", "/timeline"], ["board", "Brettet", "/"], ["kunder", "Kunder", "/kunder"]]`.

After `forumDefault`:

```js
/* ---------- R16: Leveranser, the COO layer over epics and releases ---------- */
const DELIVERY_OWNER = "COO";
const DELIVERY_LATE_DAYS = 3;   // the release rule: working days after the promise that still count as yellow
const DELIVERY_WORD = { gronn: "grønn", gul: "gul", rod: "rød", ingen: "uten dato" };
function deliveryOwner(d) { return (d && d.owner) || DELIVERY_OWNER; }
/** «alle kunder», the names, or «ingen kunder». */
function deliveryCustomersText(d) { return d.allCustomers ? "alle kunder" : d.customers && d.customers.length ? d.customers.join(", ") : "ingen kunder"; }
/** The epics and releases a delivery hangs on, existing ones only, in the plan's order. */
function deliveryParts(plan, d) {
  const e = new Set(d.epics || []), r = new Set(d.releases || []);
  return { epics: (plan.lanes || []).filter((l) => e.has(l.key)), releases: (plan.releases || []).filter((x) => r.has(x.key)) };
}
const partName = (p) => (p.kind === "epic" ? "«" + p.name + "»" : "release " + p.name);
const laterDay = (a, b) => (a > b ? a : b);
/** The computed date: the latest of the open epics' late ends and the open releases' expected finish (never before today); who gives it; whether a discovery still runs. */
function deliveryComputed(plan, d, todayDay) {
  const parts = deliveryParts(plan, d);
  let day = null, by = null, pending = false, open = 0;
  const take = (cand, who) => { if (cand && (day === null || cand > day)) { day = cand; by = who; } };
  parts.epics.forEach((l) => {
    if (l.state === "avsluttet") return;
    const tasks = plan.tasks.filter((t) => t.lane === l.key && t.state !== "levert");
    if (!tasks.length) return;
    open++;
    if (tasks.some((t) => t.kind === "discovery")) pending = true;
    take(laterDay(dayKey(unitToDate(Math.max(...tasks.map((t) => t.end)))), todayDay), { kind: "epic", key: l.key, name: l.name });
  });
  parts.releases.forEach((r) => {
    if (r.shippedDate) return;
    open++;
    const pace = releasePace(plan, r, todayDay);
    take(laterDay((pace && pace.forecastDay) || r.targetDate, todayDay), { kind: "release", key: r.key, name: r.version });
  });
  return { day, by, pending, open, parts: parts.epics.length + parts.releases.length };
}
const dec = (n) => String(n).replace(".", ",");
const weeksWords = (w) => (w === 1 ? "1 uke" : dec(w) + " uker");
/** The status against the promise: the colour, the working days and weeks after (+) or before (−) it, the sentence that says what pulls the date. */
function deliveryStatus(plan, d, todayDay) {
  const c = deliveryComputed(plan, d, todayDay);
  if (!c.parts) return { code: "ingen", computed: null, by: null, pending: false, deltaDays: null, weeks: null, deviation: "", text: "henger ikke på noe ennå" };
  if (!c.open) return { code: "gronn", computed: null, by: null, pending: false, deltaDays: 0, weeks: 0, deviation: "", text: "alt levert" };
  const deltaDays = c.day > d.promisedDate ? workDaysBetween(d.promisedDate, c.day) : -workDaysBetween(c.day, d.promisedDate);
  const weeks = Math.round((calendarDays(d.promisedDate, c.day) / 7) * 10) / 10;
  const code = deltaDays <= 0 ? "gronn" : deltaDays <= DELIVERY_LATE_DAYS ? "gul" : "rod";
  const side = deltaDays > 0 ? " etter lovet" : " før lovet";
  const deviation = deltaDays === 0 ? "på lovet dato" : (Math.abs(weeks) < 1 ? daysWords(Math.abs(deltaDays)) : weeksWords(Math.abs(weeks))) + side;
  const text = (c.pending ? "minst " : "utregnet ") + dayWords(c.day) + " · " + deviation + (c.pending ? " · venter på utredning" : "") + " · dratt av " + partName(c.by);
  return { code, computed: c.day, by: c.by, pending: c.pending, deltaDays, weeks, deviation, text };
}
/** The open bugs and stories without a release label in the sprints of the delivery's releases (the highest count any release reports per sprint). */
function deliveryUnlabelled(plan, d) {
  const per = new Map();
  deliveryParts(plan, d).releases.forEach((r) => ((r.ado && r.ado.sprints) || []).forEach((s) => per.set(s.name, Math.max(per.get(s.name) || 0, s.unlabelled || 0))));
  let n = 0; per.forEach((v) => { n += v; }); return n;
}
/** Distinct open bugs across the delivery's releases. */
function deliveryBugsLeft(plan, d) {
  const ids = new Set();
  deliveryParts(plan, d).releases.forEach((r) => ((r.ado && r.ado.items) || []).forEach((i) => { if (i.type === "Bug" && !releaseItemDone(i)) ids.add(i.id); }));
  return ids.size;
}
/** «Release 2.0.1 · release 2.0.2 · FileVault · 3 uten release-label», or «ingenting ennå». */
function deliveryPartsText(plan, d) {
  const parts = deliveryParts(plan, d);
  const list = parts.releases.map((r, i) => (i ? "release " : "Release ") + r.version).concat(parts.epics.map((l) => l.name));
  if (!list.length) return "ingenting ennå";
  const u = deliveryUnlabelled(plan, d);
  if (u) list.push(u + " uten release-label");
  return list.join(" · ");
}
/** One row per customer of each delivery («Alle kunder» as one row, «Ingen kunder» when none). */
function deliveryLines(plan, todayDay) {
  const rows = [];
  (plan.deliveries || []).forEach((d) => {
    const status = deliveryStatus(plan, d, todayDay), hangsOn = deliveryPartsText(plan, d);
    const customers = d.allCustomers ? ["Alle kunder"] : d.customers.length ? d.customers : ["Ingen kunder"];
    customers.forEach((customer) => rows.push({ key: d.key, customer, all: !!d.allCustomers, none: !d.allCustomers && !d.customers.length, delivery: d, hangsOn, promisedDate: d.promisedDate, status }));
  });
  return rows;
}
/** The customers waiting on an epic through any delivery; `all` when one of them is for all customers. */
function epicCustomers(plan, laneKey) {
  const deliveries = (plan.deliveries || []).filter((d) => (d.epics || []).includes(laneKey));
  const all = deliveries.some((d) => d.allCustomers);
  const names = [];
  deliveries.forEach((d) => (d.customers || []).forEach((c) => { if (!names.includes(c)) names.push(c); }));
  return { all, names, count: names.length, deliveries };
}
function epicCustomersText(c) { return c.all ? "alle kunder" : c.count === 1 ? "1 kunde" : c.count > 1 ? c.count + " kunder" : ""; }
/** The priority signal: one line is light, several are many stakeholders, all customers is the heaviest. */
function epicWeight(c) {
  if (c.all) return { code: "tyngst", label: "Tyngst" };
  if (c.count >= 2) return { code: "flere", label: "Flere interessenter" };
  if (c.count === 1) return { code: "lett", label: "Lett å prioritere" };
  return { code: "ingen", label: "Ingen kunder venter" };
}
/** One segment per delivery for the band: from the earliest feature start (else the release's segment, else today) to the computed day (else the promise). */
function deliverySegments(plan, todayDay) {
  const today = dayToUnit(todayDay);
  return (plan.deliveries || []).map((d) => {
    const parts = deliveryParts(plan, d), status = deliveryStatus(plan, d, todayDay);
    const epicKeys = new Set(parts.epics.map((l) => l.key));
    const starts = plan.tasks.filter((t) => epicKeys.has(t.lane)).map((t) => t.start);
    if (!starts.length && parts.releases.length) {
      const segs = releaseSegments(plan, today);
      parts.releases.forEach((r) => { const s = segs.find((x) => x.release.key === r.key); if (s) starts.push(s.start); });
    }
    const start = starts.length ? Math.min(...starts) : today;
    const promised = dayToUnit(d.promisedDate);
    const end = Math.max(start + WEEK / 2, status.computed ? dayToUnit(status.computed) : promised);
    return { delivery: d, start, end, promised, status };
  });
}
/** The five numbers for the investor page, with the colour and what pulls the date. */
function deliveryInvestor(plan, d, todayDay) {
  const parts = deliveryParts(plan, d), s = deliveryStatus(plan, d, todayDay);
  return { key: d.key, name: d.name, customers: deliveryCustomersText(d), owner: deliveryOwner(d), promised: d.promisedDate, computed: s.computed, weeks: s.weeks, colour: DELIVERY_WORD[s.code], code: s.code,
    by: s.by ? partName(s.by) : null, pending: s.pending, epicsDone: parts.epics.filter((l) => l.state === "avsluttet").length, epicsTotal: parts.epics.length, bugsLeft: deliveryBugsLeft(plan, d), text: s.text };
}
```

Export list: after `dayToUnit, releaseScope, ...` lines add a line:
`DELIVERY_OWNER, DELIVERY_WORD, deliveryOwner, deliveryCustomersText, deliveryParts, deliveryComputed, deliveryStatus, deliveryUnlabelled, deliveryBugsLeft, deliveryPartsText, deliveryLines, epicCustomers, epicCustomersText, epicWeight, deliverySegments, deliveryInvestor,`

`epic-tools.d.ts`: the import gets `Delivery`; `navTabsHtml(active: "inntak" | "timeline" | "board" | "kunder", hosted: boolean)`; append:

```ts

/* R16: Leveranser, the COO layer over epics and releases */
export type DeliveryCode = "gronn" | "gul" | "rod" | "ingen";
export declare const DELIVERY_OWNER: string;
export declare const DELIVERY_WORD: Record<DeliveryCode, string>;
export type DeliveryBy = { kind: "epic" | "release"; key: string; name: string };
export type DeliveryStatus = { code: DeliveryCode; computed: string | null; by: DeliveryBy | null; pending: boolean; deltaDays: number | null; weeks: number | null; deviation: string; text: string };
export declare function deliveryOwner(d: Delivery): string;
export declare function deliveryCustomersText(d: Delivery): string;
export declare function deliveryParts(plan: Plan, d: Delivery): { epics: PlanLane[]; releases: Release[] };
export declare function deliveryComputed(plan: Plan, d: Delivery, todayDay: string): { day: string | null; by: DeliveryBy | null; pending: boolean; open: number; parts: number };
export declare function deliveryStatus(plan: Plan, d: Delivery, todayDay: string): DeliveryStatus;
export declare function deliveryUnlabelled(plan: Plan, d: Delivery): number;
export declare function deliveryBugsLeft(plan: Plan, d: Delivery): number;
export declare function deliveryPartsText(plan: Plan, d: Delivery): string;
export type DeliveryLine = { key: string; customer: string; all: boolean; none: boolean; delivery: Delivery; hangsOn: string; promisedDate: string; status: DeliveryStatus };
export declare function deliveryLines(plan: Plan, todayDay: string): DeliveryLine[];
export type EpicCustomers = { all: boolean; names: string[]; count: number; deliveries: Delivery[] };
export declare function epicCustomers(plan: Plan, laneKey: string): EpicCustomers;
export declare function epicCustomersText(c: EpicCustomers): string;
export declare function epicWeight(c: EpicCustomers): { code: "tyngst" | "flere" | "lett" | "ingen"; label: string };
export declare function deliverySegments(plan: Plan, todayDay: string): { delivery: Delivery; start: number; end: number; promised: number; status: DeliveryStatus }[];
export type DeliveryInvestor = { key: string; name: string; customers: string; owner: string; promised: string; computed: string | null; weeks: number | null; colour: string; code: DeliveryCode; by: string | null; pending: boolean; epicsDone: number; epicsTotal: number; bugsLeft: number; text: string };
export declare function deliveryInvestor(plan: Plan, d: Delivery, todayDay: string): DeliveryInvestor;
```

- [ ] **Step 8: Run the tests to see them pass**

Run: `NODE_OPTIONS= npx vitest run src/features/timeline 2>&1 | tail -8`
Expected: all pass. Then `NODE_OPTIONS= npx tsc --noEmit` → no output.

- [ ] **Step 9: Commit**

```bash
git add src/features/timeline/merge.ts src/features/timeline/merge.test.ts src/features/timeline/epic-tools.js src/features/timeline/epic-tools.d.ts src/features/timeline/epic-tools.test.ts
git commit -m "epic-tools, merge: deliveries, the COO layer: the data, the computed date and the status, the lines, the customers per epic, the band's segments, the investor numbers (R16)"
```

---

### Task 2: events, compare and the investor section

**Files:**
- Modify: `src/features/timeline/events.ts` (`EVENT_CODES`, `PlanEvent.targetType`, the import, a block after the releases diff, `needsReason`)
- Modify: `src/features/timeline/compare.ts` (`CompareSummary`, `summarizeNet`, `summaryLine`, `SECTIONS`)
- Modify: `src/features/timeline/investor.ts` (`InvestorData`, `deliveriesNow`, `investorData(..., todayDay?)`, the markdown and the slide)
- Test: `events.test.ts`, `compare.test.ts` (every summary literal gets `leveranser: 0`; a new describe), `investor.test.ts`

**Interfaces:**
- Consumes: `Delivery`, `deliveryCustomersText`, `deliveryInvestor`, `DeliveryInvestor`, `dayKey` (Task 1).
- Produces: codes `leveranse.ny | slettet | navn | lovet | kunder | epics | releaser | eier | notat`, target type `leveranse`; `CompareSummary.leveranser`; `InvestorData.deliveries: DeliveryInvestor[]`; `investorData(plan, events, window, todayDay = dayKey(new Date()))`.

- [ ] **Step 1: Write the failing tests**

`events.test.ts`, append:

```ts
describe("deliveries (R16): one event per change COO would name", () => {
  const dl = (over: Record<string, unknown> = {}) => ({ key: "d1", name: "Skytale 2.0", allCustomers: true, customers: [], promisedDate: "2026-11-30", epics: ["x"], releases: ["r1"], ...over });
  const withDl = (deliveries: unknown[]) => normalizePlan({ lanes: [lane("x"), lane("y")], tasks: [], releases: [{ key: "r1", version: "2.0.1", targetDate: "2026-11-20" }, { key: "r2", version: "2.0.2", targetDate: "2026-12-18" }], deliveries });
  it("new, name, promised day (asks for a reason), customers, epics and releases one by one, owner, note, deleted", () => {
    const a = withDl([]), b = withDl([dl()]);
    expect(diffPlans(a, b).map((e) => [e.code, e.targetType, e.targetId, e.targetLabel, e.summary])).toEqual([["leveranse.ny", "leveranse", "d1", "Leveranse Skytale 2.0", "Ny leveranse «Skytale 2.0» · lovet 30. nov · alle kunder"]]);
    const c = withDl([dl({ name: "Skytale 2.0 i drift", promisedDate: "2026-12-11", allCustomers: undefined, customers: ["Telenor", "NSR"], epics: ["y"], releases: ["r1", "r2"], owner: "GO", note: "ryddingen" })]);
    const ev = diffPlans(b, c);
    expect(ev.map((e) => [e.code, e.summary])).toEqual([
      ["leveranse.navn", "Navn: «Skytale 2.0» → «Skytale 2.0 i drift»"],
      ["leveranse.lovet", "Lovet dato: 30. nov → 11. des"],
      ["leveranse.kunder", "Kunder: alle kunder → Telenor, NSR"],
      ["leveranse.epics", "Henger på epic «Epic Y»"],
      ["leveranse.epics", "Epic «Epic X» tatt av"],
      ["leveranse.releaser", "Henger på release 2.0.2"],
      ["leveranse.eier", "Eier satt: GO"],
      ["leveranse.notat", "Notat satt: ryddingen"],
    ]);
    expect(ev.find((e) => e.code === "leveranse.lovet")).toMatchObject({ before: { date: "2026-11-30" }, after: { date: "2026-12-11" }, laneKey: null });
    expect(ev.filter(needsReason).map((e) => e.code)).toEqual(["leveranse.lovet"]);
    expect(diffPlans(c, b).map((e) => e.code)).toEqual(["leveranse.navn", "leveranse.lovet", "leveranse.kunder", "leveranse.epics", "leveranse.epics", "leveranse.releaser", "leveranse.eier", "leveranse.notat"]);
    expect(diffPlans(c, b).find((e) => e.code === "leveranse.releaser")!.summary).toBe("Release 2.0.2 tatt av");
    expect(diffPlans(b, a).map((e) => [e.code, e.targetLabel, e.summary])).toEqual([["leveranse.slettet", "Leveranse Skytale 2.0", "Leveranse slettet: «Skytale 2.0»"]]);
    expect(diffPlans(b, withDl([dl()]))).toEqual([]);
  });
});
```

`compare.test.ts`: in every summary object literal add `leveranser: 0` before `mangler` (the `toEqual` in «summarizeNet» and the three `summaryLine` calls in «summaryLine and sinceLabel», the two in «releases (R10)»). Append:

```ts
describe("deliveries (R16) in the summary strip and the export", () => {
  it("counts every leveranse.* event and words it; the export has a «Leveranser» section", () => {
    const ev = (code: string) => ({ targetType: "leveranse", targetId: "d1", targetLabel: "Leveranse Skytale 2.0", laneKey: null, code, cause: "bruker", summary: "" }) as unknown as PlanEvent;
    expect(summarizeNet([ev("leveranse.ny"), ev("leveranse.lovet"), ev("leveranse.epics")], []).leveranser).toBe(3);
    const zero = { maldatoer: 0, spenn: 0, byttetEpic: 0, prioriteringer: 0, flyttet: 0, nye: 0, fjernet: 0, onsker: 0, releaser: 0, mangler: 0 };
    expect(summaryLine("5. nov", { ...zero, releaser: 1, leveranser: 2 })).toBe("Siden 5. nov: 1 release endret · 2 leveranser endret");
    expect(summaryLine("5. nov", { ...zero, leveranser: 1 })).toBe("Siden 5. nov: 1 leveranse endret");
    const path = { ...ev("leveranse.lovet"), summary: "Lovet dato: 30. nov → 11. des", at: "2026-11-06T10:00:00.000Z", editor: "COO", changeset: { id: "c", at: "2026-11-06T10:00:00.000Z", editor: "COO", reason: "Mindre scope", reasonCode: "omfang", source: "bruker" } } as PathEvent;
    expect(exportMarkdown("Siden 5. nov", "x", [path], () => "")).toContain("\n## Leveranser\n- Leveranse Skytale 2.0: Lovet dato: 30. nov → 11. des — Omfanget endret: Mindre scope (COO, 6. nov)\n");
  });
});
```

`investor.test.ts`, append:

```ts
describe("deliveries (R16) on the investor page", () => {
  it("one line per delivery with the five numbers; a plan without the field has none", () => {
    const p = normalizePlan({ ...plan(), deliveries: [{ key: "d1", name: "Skytale 2.0", allCustomers: true, customers: [], promisedDate: "2026-11-30", epics: ["telenor", "pilot"], releases: [] }] }) as Plan;
    const data = investorData(p, events(), WINDOW, "2026-10-13");
    expect(data.deliveries.length).toBe(1);
    const md = investorMarkdown(data);
    expect(md).toContain("## Leveranser\n- Skytale 2.0 (alle kunder): lovet 30. nov · " + data.deliveries[0].text + " · " + data.deliveries[0].colour + " · 1 av 2 epics levert · 0 bugs igjen\n");
    expect(md.indexOf("## Leveranser")).toBeLessThan(md.indexOf("## Gjennomføringsevne"));
    expect(investorHtml(data)).toContain("Skytale 2.0");
    expect(investorMarkdown(investorData({ lanes: [], tasks: [] }, [], WINDOW))).toContain("## Leveranser\n- ingen leveranser\n");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `NODE_OPTIONS= npx vitest run src/features/timeline/events.test.ts src/features/timeline/compare.test.ts src/features/timeline/investor.test.ts 2>&1 | tail -15`
Expected: FAIL — no `leveranse.*` events, `leveranser` undefined, `deliveries` undefined.

- [ ] **Step 3: Implement**

`events.ts`: `EVENT_CODES` gets `"leveranse.ny", "leveranse.slettet", "leveranse.navn", "leveranse.lovet", "leveranse.kunder", "leveranse.epics", "leveranse.releaser", "leveranse.eier", "leveranse.notat",`; `targetType` union gets `"leveranse"`; the type import gets `Delivery`, the epic-tools import gets `deliveryCustomersText`. After the releases loop (before `return ev;`):

```ts
  // ----- deliveries (R16): COO's promise; the promised day asks for a reason; the parts are logged one by one -----
  const bdl = new Map((before.deliveries ?? []).map((d) => [d.key, d])), adl = new Map((after.deliveries ?? []).map((d) => [d.key, d]));
  const dbase = (d: Delivery) => ({ targetType: "leveranse" as const, targetId: d.key, targetLabel: "Leveranse " + d.name, laneKey: null, cause: dc });
  const relName = (key: string) => ((after.releases ?? []).find((x) => x.key === key) ?? (before.releases ?? []).find((x) => x.key === key))?.version ?? key;
  for (const d of after.deliveries ?? []) {
    const b = bdl.get(d.key);
    if (!b) { ev.push({ ...dbase(d), code: "leveranse.ny", after: { name: d.name, promisedDate: d.promisedDate, customers: deliveryCustomersText(d) }, summary: "Ny leveranse " + q(d.name) + " · lovet " + dayWords(d.promisedDate) + " · " + deliveryCustomersText(d) }); continue; }
    if (b.name !== d.name) ev.push({ ...dbase(d), code: "leveranse.navn", before: b.name, after: d.name, summary: "Navn: " + q(b.name) + " → " + q(d.name) });
    if (b.promisedDate !== d.promisedDate) ev.push({ ...dbase(d), code: "leveranse.lovet", before: { date: b.promisedDate }, after: { date: d.promisedDate }, summary: "Lovet dato: " + dayWords(b.promisedDate) + " → " + dayWords(d.promisedDate) });
    if (deliveryCustomersText(b) !== deliveryCustomersText(d)) ev.push({ ...dbase(d), code: "leveranse.kunder", before: deliveryCustomersText(b), after: deliveryCustomersText(d), summary: "Kunder: " + deliveryCustomersText(b) + " → " + deliveryCustomersText(d) });
    const be = b.epics ?? [], ae = d.epics ?? [], br = b.releases ?? [], ar = d.releases ?? [];
    for (const k of ae) if (!be.includes(k)) ev.push({ ...dbase(d), code: "leveranse.epics", after: k, summary: "Henger på epic " + q(laneName(k)) });
    for (const k of be) if (!ae.includes(k)) ev.push({ ...dbase(d), code: "leveranse.epics", before: k, summary: "Epic " + q(laneName(k)) + " tatt av" });
    for (const k of ar) if (!br.includes(k)) ev.push({ ...dbase(d), code: "leveranse.releaser", after: k, summary: "Henger på release " + relName(k) });
    for (const k of br) if (!ar.includes(k)) ev.push({ ...dbase(d), code: "leveranse.releaser", before: k, summary: "Release " + relName(k) + " tatt av" });
    if ((b.owner ?? "") !== (d.owner ?? "")) ev.push({ ...dbase(d), code: "leveranse.eier", before: b.owner ?? null, after: d.owner ?? null, summary: textChange("Eier", b.owner, d.owner) });
    if ((b.note ?? "") !== (d.note ?? "")) ev.push({ ...dbase(d), code: "leveranse.notat", before: b.note ?? null, after: d.note ?? null, summary: textChange("Notat", b.note, d.note) });
  }
  for (const b of before.deliveries ?? []) if (!adl.has(b.key)) ev.push({ ...dbase(b), code: "leveranse.slettet", before: { name: b.name, promisedDate: b.promisedDate }, summary: "Leveranse slettet: " + q(b.name) });
```

`needsReason`: add `case "leveranse.lovet":` next to `case "release.maldato":`.

`compare.ts`: `CompareSummary` gets `leveranser: number`; `summarizeNet` gets `leveranser: count((e) => e.code.startsWith("leveranse."))`; `summaryLine` after the releaser line: `if (s.leveranser) parts.push(n(s.leveranser, "leveranse endret", "leveranser endret"));`; `SECTIONS` gets `["Leveranser", ["leveranse.ny", "leveranse.slettet", "leveranse.navn", "leveranse.lovet", "leveranse.kunder", "leveranse.epics", "leveranse.releaser", "leveranse.eier", "leveranse.notat"]]` after Releaser.

`investor.ts`: import `deliveryInvestor, type DeliveryInvestor` from epic-tools (and `dayKey` is already imported); `InvestorData` gets `deliveries: DeliveryInvestor[]`;

```ts
/** R16: every delivery with its five numbers, as the plan stands today. */
export function deliveriesNow(plan: Plan, todayDay: string): DeliveryInvestor[] {
  return (plan.deliveries ?? []).map((d) => deliveryInvestor(plan, d, todayDay));
}
export function investorData(plan: Plan, events: PathEvent[], window: InvestorWindow, todayDay: string = dayKey(new Date())): InvestorData {
  return { window, plan: planNow(plan), deliveries: deliveriesNow(plan, todayDay), delivery: deliveryAbility(plan, window), goals: goalAttainment(plan, events), generatedAt: new Date().toISOString() };
}
const deliveryLineMd = (d: DeliveryInvestor) => d.name + " (" + d.customers + "): lovet " + dayText(d.promised) + " · " + d.text + " · " + d.colour + " · " + d.epicsDone + " av " + d.epicsTotal + " epics levert · " + d.bugsLeft + " bugs igjen";
```

Markdown: after «Planen nå»: `md += "## Leveranser\n" + (d.deliveries.length ? d.deliveries.map((x) => "- " + deliveryLineMd(x)).join("\n") : "- ingen leveranser") + "\n\n";`. Slide: `.slide` grid rows `auto 1fr auto`, a `.wide{grid-column:1/-1}` rule, and after the three sections:
`"<section class=\"wide\"><h2>Leveranser</h2><ul>" + (d.deliveries.length ? d.deliveries.map((x) => "<li>" + dot(x.colour) + "<b>" + esc(x.name) + "</b> (" + esc(x.customers) + ")<span class=\"s\">" + esc("lovet " + dayText(x.promised) + " · " + x.text + " · " + x.epicsDone + " av " + x.epicsTotal + " epics levert · " + x.bugsLeft + " bugs igjen") + "</span></li>").join("") : "<li>ingen leveranser</li>") + "</ul></section>"`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `NODE_OPTIONS= npx vitest run 2>&1 | tail -8` then `NODE_OPTIONS= npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/timeline/events.ts src/features/timeline/events.test.ts src/features/timeline/compare.ts src/features/timeline/compare.test.ts src/features/timeline/investor.ts src/features/timeline/investor.test.ts
git commit -m "events, compare, investor: the leveranse.* events, their count and section in the compare, the «Leveranser» section on the investor page (R16)"
```

---

### Task 3: the page «Kunder»

**Files:**
- Create: `src/app/kunder/route.ts` (a copy of `src/app/inntak/route.ts` serving `src/app/kunder/kunder.html`)
- Create: `src/app/kunder/kunder.html`
- Test: `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-deliveries-smoke.mjs` (new; D1–D4, D6, D7 here; Task 4 adds D5)

**Interfaces:**
- Consumes: the Task 1 globals, `EPIC_STATE_LABEL`, `navTabsHtml('kunder', hosted)`, `SCHEMA`, `normalizePlan`, `dayKey`, `fmtDate`, `unitToDate`, `dayToUnit`, `epicWindowText`.
- Produces: the page at `/kunder` with ids `navTabs, dirtyNote, whoami, roTag, newBtn, hint, hintClose, views, list, dlBack, dlTitle, dlX, dlName, dlPromised, dlOwner, dlAll, dlCustomersField, dlCustomers, dlEpics, dlReleases, dlNote, dlReasonRow, dlReasonCode, dlReasonText, dlDelete, dlCancel, dlSave, dlgBack, dlgTitle, dlgMsg, dlgYes, dlgNo`; rows `tr[data-key]`, class `hl` for the hash's key; `button[data-edit]`; the per-epic table `table.epics`.

- [ ] **Step 1: Write the failing smoke (D1–D4, D6, D7)**

Create `hosted-deliveries-smoke.mjs` with the mock from `hosted-smoke.mjs` extended: `GET /kunder` serves `src/app/kunder/kunder.html`; `GET /api/timeline-changes` returns the recorded events (the `record` helper from `hosted-release-smoke.mjs` with `diffPlans`/`needsReason`); `POST /api/ado-sprints` → `{ unchanged: true, sprints: [] }`; `GET /api/timeline-snapshots` → `{ snapshots: [] }`; `POST /api/ado-releases` → `{ unchanged: true }`; `POST /__role/<role>`; `GET /__events` → `{ events, stored }`. Readers get 403 on PUT. Steps:

```js
const plus = (n) => dayKey(new Date(Date.now() + n * 86400000));
const P1 = plus(20), P2 = plus(5), T1 = plus(10);
/* D0: seed the plan on Tidslinjen and add release 2.0.1 */
await page.goto(BASE + "/timeline"); await page.waitForFunction(() => !document.getElementById("emptyState").hidden);
await page.click("#seedBtn"); await page.waitForSelector("#dlgBack.open"); await page.click("#dlgYes"); await page.waitForSelector(".lane-label"); await savedNote();
await page.click("#addReleaseBtn"); await page.waitForSelector("#relBack.open"); await page.fill("#relVersion", "2.0.1"); await page.fill("#relTarget", T1); await page.click("#relSave"); await savedNote();
/* D1: Kunder is the fourth tab; empty; a writer creates the first delivery */
await page.goto(BASE + "/kunder"); await page.waitForFunction(() => /lagret|kun lesetilgang|^$/.test(document.getElementById("dirtyNote").textContent) && document.getElementById("list").textContent.length > 0);
assert(await page.$eval("#tab-kunder", (e) => e.classList.contains("on") && e.getAttribute("aria-current") === "page" && e.textContent === "Kunder"), "D1: Kunder is the active tab");
assert((await page.$$eval("#navTabs .tab", (ts) => ts.map((t) => t.getAttribute("href")))).join(",") === "/inntak,/timeline,/,/kunder", "D1: four tabs");
assert(/Ingen leveranser ennå\. Opprett den første med «＋ Leveranse»/.test(await page.textContent("#list")), "D1: the writer's empty state");
assert(await page.$eval("#views", (e) => e.hidden), "D1: no view switch without deliveries");
await page.click("#newBtn"); await page.waitForSelector("#dlBack.open");
assert((await page.textContent("#dlTitle")) === "Ny leveranse", "D1: the editor's title");
assert((await page.$$("#dlEpics input[data-epic]")).length >= 4 && (await page.$$("#dlReleases input[data-release]")).length === 1, "D1: every epic and the release are offered");
await page.fill("#dlName", "Skytale 2.0"); await page.check("#dlAll"); await page.fill("#dlPromised", P1);
assert(await page.$eval("#dlCustomersField", (e) => e.hidden), "D1: «Alle kunder» hides the names");
const epicKey = await page.$eval("#dlEpics input[data-epic]", (i) => i.dataset.epic), epicName = await page.$eval("#dlEpics label", (l) => l.textContent.trim().replace(/\s+\S+$/, ""));
await page.check('#dlEpics input[data-epic="' + epicKey + '"]'); await page.check("#dlReleases input[data-release]");
await page.click("#dlSave"); await kSaved();
let rows = await page.$$eval("table.lines tbody tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim())));
assert(rows.length === 1 && rows[0][0] === "Alle kunder" && rows[0][1].startsWith("Skytale 2.0") && /Release 2\.0\.1/.test(rows[0][2]) && rows[0][2].includes(epicName), "D1: one row for all customers: " + JSON.stringify(rows));
assert(await page.$("table.lines .pill.st-gronn, table.lines .pill.st-gul, table.lines .pill.st-rod"), "D1: the status pill has a colour");
let ev = await evs(); const d = ev.stored.data.deliveries[0];
assert(d && d.name === "Skytale 2.0" && d.allCustomers === true && d.customers.length === 0 && d.promisedDate === P1 && d.epics[0] === epicKey && d.releases.length === 1 && d.v === 1, "D1: stored: " + JSON.stringify(d));
assert(ev.events.some((e) => e.code === "leveranse.ny" && e.targetType === "leveranse" && e.targetId === d.key && /^Ny leveranse «Skytale 2\.0» · lovet .* · alle kunder$/.test(e.summary)), "D1: leveranse.ny logged");
console.log("D1 ok");
/* D2: moving the promised day asks why; the reason rides on the save */
await page.click("button[data-edit]"); await page.waitForSelector("#dlBack.open");
assert((await page.textContent("#dlTitle")) === "Leveranse Skytale 2.0" && (await page.inputValue("#dlPromised")) === P1 && (await page.isChecked("#dlAll")), "D2: the editor opens on the delivery");
assert(await page.$eval("#dlReasonRow", (e) => e.hidden), "D2: no reason row before the date moves");
await page.fill("#dlPromised", P2);
await page.waitForFunction(() => !document.getElementById("dlReasonRow").hidden);
await page.selectOption("#dlReasonCode", "omfang"); await page.fill("#dlReasonText", "Mindre scope");
await page.click("#dlSave"); await kSaved();
ev = await evs(); const lv = ev.events.find((e) => e.code === "leveranse.lovet");
assert(lv && lv.changeset.reasonCode === "omfang" && lv.changeset.reason === "Mindre scope" && /^Lovet dato: /.test(lv.summary), "D2: leveranse.lovet with its reason: " + JSON.stringify(lv && [lv.summary, lv.changeset.reasonCode]));
console.log("D2 ok");
/* D3: named customers give one row each */
await page.click("button[data-edit]"); await page.waitForSelector("#dlBack.open");
await page.uncheck("#dlAll"); await page.waitForFunction(() => !document.getElementById("dlCustomersField").hidden);
await page.fill("#dlCustomers", "Telenor\nNSR"); await page.click("#dlSave"); await kSaved();
rows = await page.$$eval("table.lines tbody tr", (trs) => trs.map((tr) => tr.querySelector("td").textContent.trim()));
assert(rows.join(",") === "Telenor,NSR", "D3: one row per customer: " + rows.join(","));
ev = await evs();
assert(ev.events.some((e) => e.code === "leveranse.kunder" && e.summary === "Kunder: alle kunder → Telenor, NSR"), "D3: leveranse.kunder logged");
console.log("D3 ok");
/* D4: per epic */
await page.click('#views button[data-v="epic"]'); await page.waitForSelector("table.epics");
const erows = await page.$$eval("table.epics tbody tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim())));
assert(erows[0][0] === epicName && erows[0][1] === "2" && erows[0][2].startsWith("Telenor, NSR") && erows[0][3] === "Flere interessenter", "D4: the epic's row: " + JSON.stringify(erows[0]));
assert(erows.slice(1).every((r) => r[3] === "Ingen kunder venter"), "D4: the other epics wait for nobody");
await page.screenshot({ path: DIR + "/10-kunder-per-epic.png" });
await page.click('#views button[data-v="kunde"]'); await page.waitForSelector("table.lines");
await page.screenshot({ path: DIR + "/10-kunder.png" });
console.log("D4 ok");
```

(D5 is Task 4's.) Then:

```js
/* D6: a reader sees the rows, no buttons */
await fetch(BASE + "/__role/reader", { method: "POST" });
await page.reload(); await page.waitForSelector("table.lines");
assert(await page.$eval("#newBtn", (e) => e.hidden) && !(await page.$("button[data-edit]")) && !(await page.$eval("#roTag", (e) => e.hidden)), "D6: reader: no buttons, the tag shows");
await page.click('#views button[data-v="epic"]'); await page.waitForSelector("table.epics");
await fetch(BASE + "/__role/writer", { method: "POST" });
console.log("D6 ok");
/* D7: delete */
await page.reload(); await page.waitForSelector("button[data-edit]");
await page.click("button[data-edit]"); await page.waitForSelector("#dlBack.open"); await page.click("#dlDelete"); await page.waitForSelector("#dlgBack.open");
assert(/Slette «Skytale 2\.0»/.test(await page.textContent("#dlgMsg")), "D7: the confirm names the delivery");
await page.click("#dlgYes"); await kSaved();
assert(/Ingen leveranser ennå/.test(await page.textContent("#list")), "D7: empty again");
ev = await evs();
assert(ev.stored.data.deliveries.length === 0 && ev.stored.data.deletedDeliveries[d.key] >= 2 && ev.events.some((e) => e.code === "leveranse.slettet"), "D7: tombstoned and logged");
console.log("D7 ok");
```

with `const kSaved = () => page.waitForFunction(() => /^☁ lagret/.test(document.getElementById("dirtyNote").textContent), null, { timeout: 15000 });`. End: `assert(errors.length === 0, ...)`, close, `console.log("ALL OK")`.

- [ ] **Step 2: Run it to see it fail**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-deliveries-smoke.mjs 2>&1 | tail -5`
Expected: FAIL at D1 (the page is a 404: `#tab-kunder` never appears).

- [ ] **Step 3: Create the route and the page**

`src/app/kunder/route.ts`: as `inntak/route.ts` with the comment «Serves the page «Kunder» (R16): COO's deliveries, one row per customer waiting; same plan API» and the path `src/app/kunder/kunder.html`.

`src/app/kunder/kunder.html`: `<head>` with the title «Kunder – SkyTracker» and the CSS of `inntak.html` (the palette, the top bar, the tabs, the hint, the buttons, the modal, the `ed-*` fields; drop the intake-only rules `.forum`, `#forumLabel`, `.filters`, `.wish`, `.chip.st-*`) plus:

```css
  .views{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}
  .views button.on{background:var(--accent);border-color:var(--accent);color:#fff}
  .tblwrap{overflow-x:auto;border:1px solid var(--line);border-radius:6px;background:var(--surface)}
  table.lines,table.epics{border-collapse:collapse;width:100%;min-width:760px;font-size:13px}
  .lines th,.lines td,.epics th,.epics td{padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line-soft)}
  .lines thead th,.epics thead th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-4);font-weight:500;background:var(--raised)}
  .lines td.nm,.epics td.nm{font-weight:600;color:var(--text)}
  .lines td.dt,.epics td.dt{white-space:nowrap;font-variant-numeric:tabular-nums}
  .lines td.hang{color:var(--text-2)}
  .lines tbody tr:last-child td,.epics tbody tr:last-child td{border-bottom:0}
  .lines tr.hl td{background:var(--accent-soft)}
  .why{display:block;font-size:12px;color:var(--text-3);margin-top:2px}
  .pill{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;border-radius:999px;padding:1px 8px;background:var(--badge-bg);color:var(--badge-fg);white-space:nowrap}
  .pill::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;flex:none}
  .pill.st-gronn,.pill.w-lett{background:var(--ok-bg);color:var(--ok-fg)}
  .pill.st-gul,.pill.w-flere{background:var(--warn-bg);color:var(--warn-fg)}
  .pill.st-rod,.pill.w-tyngst{background:var(--bad-bg);color:var(--bad-fg)}
  .checks{display:grid;gap:4px;max-height:180px;overflow:auto;border:1px solid var(--line);border-radius:4px;padding:8px 10px;background:var(--input-bg)}
  .checks label{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--text)}
  .checks small{color:var(--text-4)}
  .ed-check{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--text-2)}
  .reason{display:grid;gap:8px;padding:10px 12px;border:1px solid var(--warn);border-radius:4px;background:var(--warn-bg)}
  .reason > span{font-size:12px;font-weight:600;color:var(--warn-fg)}
  .reason select,.reason input{width:100%;font:inherit;font-size:14px;padding:6px 12px;border:1px solid var(--line);border-radius:4px;background:var(--input-bg);color:var(--text)}
  button.danger-ghost{color:var(--danger);border-color:transparent;background:transparent}
  button.danger-ghost:hover{background:var(--bad-bg);border-color:transparent;color:var(--danger-hover)}
```

Body: the top bar (tabs; `dirtyNote`, `whoami`, `roTag`, `newBtn` «＋ Leveranse» hidden), the hint («Én rad per kunde som venter på en leveranse. <b>Lovet dato</b> er COOs; <b>utregnet dato</b> er det seneste av epicenes sene ende og releasenes forventede ferdig. Grønn til og med lovet dato, gul inntil tre arbeidsdager etter, rød senere. Raden sier hva som drar. Ingen varsel: dette er stedet å sjekke.» with the ✕, key `sk.hint.kunder`), `<div class="views" id="views" hidden><button data-v="kunde" class="on">Per kunde</button><button data-v="epic">Per epic</button></div>`, `<div id="list"></div>`; the editor modal `#dlBack` (fields as in the spec §5: `dlName`, `dlPromised`, `dlOwner`, `dlAll`, `dlCustomersField` + `dlCustomers` (textarea, «én per linje»), `dlEpics` + `dlReleases` (`.checks`), `dlNote`, `dlReasonRow` (`.reason`, hidden: «Hvorfor flyttes lovet dato?», `dlReasonCode` select, `dlReasonText`), foot: `dlDelete` «Slett leveranse …» hidden, `dlCancel`, `dlSave`; head ✕ `dlX`), the confirm dialog `#dlgBack` as in `inntak.html`.

Script `window.__bootKunder` (the loader at the end is the intake's with `__bootKunder`):

```js
window.__bootKunder = function(){
  const HOSTED = location.protocol !== 'file:';
  document.getElementById('navTabs').innerHTML = navTabsHtml('kunder', HOSTED);
  try{ if(localStorage.getItem('sk.hint.kunder') === '1') document.getElementById('hint').hidden = true; }catch(e){}
  document.getElementById('hintClose').addEventListener('click', () => { document.getElementById('hint').hidden = true; try{ localStorage.setItem('sk.hint.kunder', '1'); }catch(e){} });
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const REASON_CODES = [['utredning', 'Utredningen viste mer/mindre arbeid'], ['avhengighet', 'En avhengighet flyttet seg'], ['kapasitet', 'Kapasitet: annet gikk foran'], ['prioritering', 'Prioritert om i produktforum'], ['ekstern', 'Ekstern dato endret'], ['omfang', 'Omfanget endret'], ['rydding', 'Retting / rydding'], ['annet', 'Annet']];
  const POLL_MS = 10000;
  let state = emptyPlan(), serverVersion = null, canWrite = false, myName = null, serverReady = false;
  let pendingSave = false, pushing = false, saveTimer = null, dlgResolve = null, view = 'kunde', editKey = null, pendingNote = null;
  function emptyPlan(){ return normalizePlan({ schema: SCHEMA, lanes: [], tasks: [], deleted: {}, deletedLanes: {} }); }
  const anyModalOpen = () => ['dlBack', 'dlgBack'].some(id => $(id).classList.contains('open'));
  const setNote = m => { $('dirtyNote').textContent = m ? '☁ ' + m : ''; };
  const today = () => dayKey(new Date());
  const dayText = d => fmtDate(unitToDate(dayToUnit(d)));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const getDelivery = key => (state.deliveries || []).find(d => d.key === key);
  const hlKey = () => { try{ return decodeURIComponent((location.hash || '').slice(1)); }catch(e){ return ''; } };
  const pillText = s => s.code === 'ingen' ? 'Ingen dato' : cap(DELIVERY_WORD[s.code]) + (s.deltaDays ? ' · ' + s.deviation : '');

  /* ---------- the two views ---------- */
  function render(){
    const list = $('list'), ds = state.deliveries || [];
    $('views').hidden = !ds.length;
    if(!ds.length){ list.innerHTML = '<div class="empty">Ingen leveranser ennå.' + (canWrite ? ' Opprett den første med «＋ Leveranse»: navn, kunder, lovet dato og det den henger på.' : '') + '</div>'; return; }
    if(view === 'epic'){ renderPerEpic(); return; }
    const rows = deliveryLines(state, today()), hl = hlKey();
    list.innerHTML = '<div class="tblwrap"><table class="lines"><thead><tr><th>Kunde</th><th>Leveranse</th><th>Henger på</th><th>Lovet</th><th>Utregnet</th><th>Status</th>' + (canWrite ? '<th></th>' : '') + '</tr></thead><tbody>' +
      rows.map(r => '<tr data-key="' + esc(r.key) + '"' + (r.key === hl ? ' class="hl"' : '') + '><td class="nm">' + esc(r.customer) + '</td><td>' + esc(r.delivery.name) + '<span class="why">eier ' + esc(deliveryOwner(r.delivery)) + (r.delivery.note ? ' · ' + esc(r.delivery.note) : '') + '</span></td><td class="hang">' + esc(r.hangsOn) + '</td><td class="dt">' + esc(dayText(r.promisedDate)) + '</td><td class="dt">' + (r.status.computed ? (r.status.pending ? 'minst ' : '') + esc(dayText(r.status.computed)) : '–') + '</td><td><span class="pill st-' + r.status.code + '">' + esc(pillText(r.status)) + '</span><span class="why">' + esc(r.status.text) + '</span></td>' + (canWrite ? '<td><button data-edit="' + esc(r.key) + '">Rediger…</button></td>' : '') + '</tr>').join('') +
      '</tbody></table></div>';
  }
  function renderPerEpic(){
    const rows = state.lanes.map(l => ({ l, c: epicCustomers(state, l.key) })).sort((a, b) => (b.c.deliveries.length ? 1 : 0) - (a.c.deliveries.length ? 1 : 0));
    $('list').innerHTML = '<div class="tblwrap"><table class="epics"><thead><tr><th>Epic</th><th>Linjer</th><th>Kunder som venter</th><th>Tyngde</th><th>Leveres</th></tr></thead><tbody>' +
      rows.map(({l, c}) => { const w = epicWeight(c), via = c.deliveries.map(d => d.name).join(', ');
        return '<tr><td class="nm">' + esc(l.name) + '</td><td class="dt">' + (c.all ? 'alle' : c.count || '–') + '</td><td>' + esc((c.all ? 'Alle kunder' + (c.names.length ? ' (' + c.names.join(', ') + ')' : '') : c.names.join(', ')) || '–') + (via ? '<span class="why">via ' + esc(via) + '</span>' : '') + '</td><td><span class="pill w-' + w.code + '">' + esc(w.label) + '</span></td><td class="dt">' + esc(epicWindowText(state, l.key) || (l.state === 'avsluttet' ? 'avsluttet' : '–')) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }
  $('views').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if(!b) return; view = b.dataset.v; [...$('views').querySelectorAll('button')].forEach(x => x.classList.toggle('on', x === b)); render(); });
  $('list').addEventListener('click', e => { const b = e.target.closest('button[data-edit]'); if(b) openEditor(b.dataset.edit); });
  window.addEventListener('hashchange', render);
```

The editor (`openEditor`, `closeEditor`, the `dlAll`/`dlPromised` listeners, `dlSave`, `dlDelete`, `dlCancel`/`dlX`/backdrop), the confirm dialog, `applyRemote`, `init` (sets `$('newBtn').hidden = !canWrite`), `save`/`push` (the note is `Object.assign({ source: 'bruker' }, note || {})` where `note` is `pendingNote` taken at the start of `push` and restored on failure), `poll`, `setInterval(poll, POLL_MS)`, `render(); init();` — as described in the spec §5 and written in the style of `inntak.html`. `dlSave` builds the delivery exactly as in the spec: a new one gets `{ key: uid('d'), v: 0, name, promisedDate, customers: [], epics: [], releases: [] }`; the promised-day reason is taken from `dlReasonCode`/`dlReasonText` only for a saved delivery whose day changed; `allCustomers` on → `allCustomers = true, customers = []`, off → the textarea split on newlines/commas/semicolons; owner and note set or deleted; `epics`/`releases` from the checked boxes; `d.v++`, `state.example = false`, `state = normalizePlan(state)`, `save(); render();`.

- [ ] **Step 4: Run the smoke to see it pass**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-deliveries-smoke.mjs 2>&1 | tail -10`
Expected: D1 ok … D4 ok, D6 ok, D7 ok, ALL OK. Look at `10-kunder.png` and `10-kunder-per-epic.png`.

- [ ] **Step 5: Commit**

```bash
git add src/app/kunder/route.ts src/app/kunder/kunder.html
git commit -m "kunder: the page «Kunder»: one row per customer waiting, per epic, the delivery editor with the reason for a moved promise (R16)"
```

---

### Task 4: Tidslinjen: the band, the chip, the investor block, the import, the help

**Files:**
- Modify: `src/app/timeline/timeline.html` (CSS: `.gantt` gets `--axis-h`; `.axis`, `.labels .corner`, `.chart .release-line`, `.grid`, `.chart .today` use it; the band rules; `.chip.cust`; `.sw.delivery`. Markup: the legend, a help card. JS: `render()` after the releases layer; the lane label; `renderInvestor`; the import.)
- Test: `hosted-deliveries-smoke.mjs` D5 (between D4 and D6)

**Interfaces:**
- Consumes: `deliverySegments`, `deliveryCustomersText`, `epicCustomers`, `epicCustomersText`, `dayToUnit`, `unitToDate`, `fmtDate`, `dayKey` (Task 1); the investor JSON's `deliveries` (Task 2).
- Produces: `.axis .deliveries > .delivery > .seg[data-key]` + `.promise`; `--axis-h` on `#gantt`; `.lane-label .chip.cust`; the drawer's «Leveranser» heading.

- [ ] **Step 1: Write the failing smoke step D5**

Insert after D4 (the page is on `/kunder`, the delivery has Telenor + NSR and hangs on the first epic and release 2.0.1):

```js
/* D5: Tidslinjen: the band above the releases, the chip on the epic, the link to Kunder; the investor section */
await page.goto(BASE + "/timeline"); await page.waitForSelector(".lane-label");
await page.waitForSelector(".axis .delivery .seg");
assert((await page.$$(".axis .delivery")).length === 1, "D5: one row on the band");
assert(/Skytale 2\.0 · Telenor, NSR/.test(await page.textContent(".axis .delivery .seg")), "D5: the segment names the delivery and its customers: " + (await page.textContent(".axis .delivery .seg")));
assert(/dratt av/.test(await page.$eval(".axis .delivery .seg", (e) => e.title)), "D5: the tooltip says what pulls the date");
assert(await page.$eval("#gantt", (g) => g.style.getPropertyValue("--axis-h") === "94px" && getComputedStyle(g.querySelector(".axis")).height === "94px" && getComputedStyle(g.querySelector(".corner")).height === "94px"), "D5: the axis grew one row");
assert(await page.$eval(".axis .delivery .promise", (e) => /^Lovet /.test(e.title)), "D5: the promise marker");
assert(await page.$eval(".axis .delivery .seg", (e) => e.getBoundingClientRect().top < e.closest(".axis").querySelector(".releases").getBoundingClientRect().top), "D5: the band sits above the releases");
const chip = await page.$eval('.lane-label[data-key="' + epicKey + '"] .chip.cust', (c) => [c.textContent, c.title]);
assert(chip[0] === "2 kunder" && /Telenor, NSR · via Skytale 2\.0/.test(chip[1]), "D5: the epic's chip: " + JSON.stringify(chip));
assert((await page.$$(".lane-label .chip.cust")).length === 1, "D5: only the epic a delivery hangs on gets a chip");
await page.screenshot({ path: DIR + "/10-timeline-band.png" });
await page.click("#investorBtn"); await page.waitForFunction(() => /Leveranser/.test(document.getElementById("invBody").textContent));
assert(/Skytale 2\.0.*Telenor, NSR.*lovet .* · utregnet .* epics levert · 0 bugs igjen/.test(await page.textContent("#invBody")), "D5: the drawer's section: " + (await page.textContent("#invBody")));
await page.click("#invClose");
await page.click(".axis .delivery .seg");
await page.waitForFunction((k) => location.pathname === "/kunder" && location.hash === "#" + k, d.key);
await page.waitForSelector("table.lines tr.hl");
assert((await page.$$("table.lines tr.hl")).length === 2, "D5: both rows highlighted from the band's link");
console.log("D5 ok");
```

The mock needs `GET /api/timeline-investor` → `investorData(normalizePlan(clone(stored.data)), [], defaultWindow(new Date()))` with `markdown` (import `investorData`, `investorMarkdown`, `defaultWindow` from the worktree as the history smoke does).

- [ ] **Step 2: Run it to see it fail**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-deliveries-smoke.mjs 2>&1 | tail -5`
Expected: FAIL at D5 — no `.axis .delivery .seg`.

- [ ] **Step 3: Implement in timeline.html**

CSS: add `--axis-h:76px;` to `.gantt{...}`; replace `height:76px` in `.axis` and `.labels .corner` with `height:var(--axis-h)`, and `top:76px` in `.chart .release-line`, `.grid` and `.chart .today` with `top:var(--axis-h)`. After the `.axis .release.pace-rod` rule:

```css
  /* R16: the delivery band, one row per delivery above the release band; the axis grows 18 px per row */
  .axis .deliveries{position:absolute;left:0;right:0;top:40px;height:calc(var(--axis-h) - 76px);pointer-events:none}
  .axis .delivery{position:absolute;left:0;right:0;height:18px}
  .axis .delivery .seg{position:absolute;top:1px;height:15px;box-sizing:border-box;font-size:10px;line-height:13px;padding:0 5px;border:1px solid var(--neutral);border-radius:3px;background:var(--badge-bg);color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:pointer}
  .axis .delivery .seg:hover{filter:brightness(.96)}
  .axis .delivery .seg b{font-weight:600;color:var(--text)}
  .axis .delivery .seg.st-gronn{border-color:var(--ok);background:var(--ok-bg)}
  .axis .delivery .seg.st-gul{border-color:var(--warn-dot);background:var(--warn-bg)}
  .axis .delivery .seg.st-rod{border-color:var(--bad);background:var(--bad-bg)}
  .axis .delivery .promise{position:absolute;top:0;width:2px;height:17px;background:var(--text);opacity:.7;pointer-events:auto;z-index:1}
  .sw.delivery{width:16px;height:10px;border:1px solid var(--ok);background:var(--ok-bg);border-radius:3px}
  .lane-label .chip.cust{background:var(--accent-soft);color:var(--text)}
```

Legend: `<span><i class="sw delivery"></i>Leveranse</span>` after the release swatch. Help card after «Releaser»: «Leveranser» (the spec's text). JS in `render()` after the releases layer and before `chart.appendChild(axis)`:

```js
    // leveranser (R16): COO's band above the releases, one row per delivery; click → Kunder
    const dsegs = deliverySegments(state, dayKey(new Date()));
    gantt.style.setProperty('--axis-h', (76 + 18 * dsegs.length) + 'px');
    if(dsegs.length){
      const layer = el('div', 'deliveries');
      dsegs.forEach((sg, i) => {
        const row = el('div', 'delivery'); row.style.top = (18 * i) + 'px';
        const a = Math.max(VIEW_FROM, sg.start), b = Math.min(N_MONTHS, sg.end), d = sg.delivery, st = sg.status;
        if(b > a){
          const seg = el('div', 'seg st-' + st.code);
          seg.dataset.key = d.key;
          seg.style.left = x(a) + 'px'; seg.style.width = (x(b) - x(a)) + 'px';
          const wide = (x(b) - x(a)) >= 260;
          seg.innerHTML = '<b>' + esc(d.name) + '</b> · ' + esc(deliveryCustomersText(d)) + (wide && st.computed ? ' · ' + esc((st.pending ? 'minst ' : 'utregnet ') + fmtDate(unitToDate(dayToUnit(st.computed)))) : '');
          seg.title = 'Leveranse ' + d.name + ' · ' + deliveryCustomersText(d) + ' · lovet ' + fmtDate(unitToDate(sg.promised)) + '\n' + st.text + (HOSTED ? '\nKlikk for fanen Kunder' : '');
          if(HOSTED) seg.addEventListener('click', () => { location.href = '/kunder#' + encodeURIComponent(d.key); });
          row.appendChild(seg);
        }
        if(sg.promised >= VIEW_FROM && sg.promised <= N_MONTHS){ const pm = el('i', 'promise'); pm.style.left = x(sg.promised) + 'px'; pm.title = 'Lovet ' + fmtDate(unitToDate(sg.promised)) + ' · ' + d.name; row.appendChild(pm); }
        layer.appendChild(row);
      });
      axis.appendChild(layer);
    }
```

The lane label: before `lm.innerHTML = ...` add `const cust = lane.virtual ? null : epicCustomers(state, lane.key);` and `const custChip = cust && (cust.all || cust.count) ? '<span class="chip cust" title="' + esc('Kunder som venter: ' + (cust.all ? 'alle kunder' + (cust.names.length ? ' (' + cust.names.join(', ') + ')' : '') : cust.names.join(', ')) + ' · via ' + cust.deliveries.map(d => d.name).join(', ')) + '">' + esc(epicCustomersText(cust)) + '</span>' : '';` and put `custChip` right after `stateChip` in the concatenation.

`renderInvestor`: build `dv` from `d.deliveries` (empty → `<div class="empty">Ingen leveranser.</div>`), one `<li>` per delivery: `<b>name</b> (customers): lovet … · text · colour · N av M epics levert · K bugs igjen`; the body becomes `'<h3>Planen nå</h3>' + plan + '<h3>Leveranser</h3>' + dv + '<h3>Gjennomføringsevne</h3>' + delivery + '<h3>Målopnåelse</h3>' + goals`.

The import: `curDel`/`inDel`/`removedDel` like the releases, `(incoming.deliveries || []).forEach(d => { const c = curDel.get(d.key); d.v = ((c && c.v) || 0) + 1; });`, `incoming.deletedDeliveries = Object.assign({}, state.deletedDeliveries || {}, incoming.deletedDeliveries || {}); removedDel.forEach(d => { incoming.deletedDeliveries[d.key] = (d.v || 0) + 1; });`, and in the message `(removedDel.length ? ', ' + n(removedDel.length, 'leveranse fjernes', 'leveranser fjernes') : '')`.

- [ ] **Step 4: Run the smoke and the suite**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-deliveries-smoke.mjs 2>&1 | tail -10`
Expected: D1–D7 ok, ALL OK. Look at `10-timeline-band.png`. Then the eight existing smokes, `vitest`, `tsc`, `eslint src`, `next build`.

- [ ] **Step 5: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "timeline: the band «Leveranser» above the releases, the customers chip on the epic row, the investor block, the import rule and the help card (R16)"
```

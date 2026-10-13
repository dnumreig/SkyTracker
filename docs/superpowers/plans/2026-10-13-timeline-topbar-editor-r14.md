# Tidslinjen R14: one top bar, the status strip in words, the editor in two tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the three pages one top bar with tabs and two menus, replace the legend's counters with a status strip in words, the yellow ADO bar with a link, put the feature editor in two tabs, label the release line at the bottom and let the release drawer refresh only its own release.

**Architecture:** Pure helpers (`navTabsHtml`, `epicStatusWords`) in `epic-tools.js`, unit-tested, used by all three plain-JS pages. `refreshReleases` gains an `only` option, the `ado-releases` route reads it from the body. The pages change markup + CSS + a little JS; the Playwright smokes in `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/` move their selectors with the buttons and gain asserts for the tabs, the strip, the menus and the editor's tabs.

**Tech Stack:** plain HTML/JS pages served by Next route handlers, `epic-tools.js` (CommonJS + browser global), vitest 4, Playwright smokes (`NODE_OPTIONS= npx tsx <smoke>` from the worktree).

**Spec:** `docs/superpowers/specs/2026-10-13-planning-system-r14-topbar-editor-design.md`

## Global Constraints

- Norwegian in the UI, English in code and commits. No Claude attribution anywhere.
- `module.exports` of `epic-tools.js` must equal `epic-tools.d.ts` (the existing test checks it).
- Every existing button keeps its id and its role rule (readers: no baseline, import, mix, ADO menu).
- No plan JSON change, no ADO write, no change to the board's card editor.
- Branch `feat/ux-topbar-r14` is cut from `feat/lifecycle-r13` (PR #20 still open); it is rebased onto `origin/main` after #20 lands, before its PR.

## Review Focus

1. A reader on Tidslinjen: the ADO menu hidden, Mer shows Per person, Eksporter, Investorer, Hjelp only, no ADO link in the strip; the strip renders for an empty plan («Ingen epics ennå») without throwing. (Task 3 smoke: the history smoke's reader section.)
2. A narrow laptop (1100 px): the top bar wraps, and an open menu list is not clipped and not under the sticky axis (z-index above `.axis`'s 5). (Task 3: screenshot at 1100 px.)
3. `localStorage` throwing (private window): the hint still shows and the page boots. (Task 3/5: the read and write are inside try/catch; the theme shots run from `file://`.)
4. The editor opens on Plan every time, also after a close from Om; the push row is visible under both tabs; the label says «Art» but `edType`'s values and the `type` field are unchanged. (Task 4 smoke: the history smoke's spec/pull step switches tabs and saves.)
5. `POST /api/ado-releases` with an unknown key answers `unchanged` without an ADO call; with no body it reads all releases (the six-hour auto-read). (Task 2 unit test + the release smoke's mock honouring the body.)

---

### Task 1: `navTabsHtml` and `epicStatusWords` in epic-tools

**Files:**
- Modify: `src/features/timeline/epic-tools.js` (after `sprintLabel`, before the export block; export block)
- Modify: `src/features/timeline/epic-tools.d.ts` (end)
- Test: `src/features/timeline/epic-tools.test.ts`

**Interfaces:**
- Produces: `navTabsHtml(active: "inntak"|"timeline"|"board", hosted: boolean): string` — anchors `<a class="tab[ on]" id="tab-<key>" data-tab="<key>" href="…"[ aria-current="page"][ hidden]>Name</a>` in the order Inntak, Tidslinjen, Brettet with hrefs `/inntak`, `/timeline`, `/`; the inactive two get `hidden` when `hosted` is false.
- Produces: `epicStatusWords(plan): string` — «N aktive epics · a grønne · b gul · c røde · d venter på utredning · e forslag», zero parts left out, «Ingen epics ennå» when `plan.lanes` is empty.

- [ ] **Step 1: Write the failing tests**

Append to the import list in `epic-tools.test.ts`: `navTabsHtml, epicStatusWords,` and add at the end of the file:

```ts
describe("R14: the top bar's words", () => {
  const lane = (key: string, state: string, goalDate?: number) => ({ key, name: key, owner: "GO", v: 1, state, ...(goalDate !== undefined ? { goalDate } : {}) });
  const est = (id: string, lane: string, endLikely: number, end: number): PlanTask => ({ id, label: id, lane, kind: "estimate", start: 0, endLikely, end, state: "aktiv" } as PlanTask);
  const disc = (id: string, lane: string, end: number): PlanTask => ({ id, label: id, lane, kind: "discovery", start: 0, endLikely: end, end, state: "utredes" } as PlanTask);

  it("navTabsHtml keeps the process order, marks the active tab and shows all three when hosted", () => {
    const html = navTabsHtml("timeline", true);
    expect([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual(["/inntak", "/timeline", "/"]);
    expect(html).toContain('<a class="tab on" id="tab-timeline" data-tab="timeline" href="/timeline" aria-current="page">Tidslinjen</a>');
    expect(html).toContain('<a class="tab" id="tab-board" data-tab="board" href="/">Brettet</a>');
    expect(html).not.toContain("hidden");
  });

  it("navTabsHtml hides the other tabs when the page is opened from a file", () => {
    const html = navTabsHtml("board", false);
    expect(html).toContain('id="tab-board" data-tab="board" href="/" aria-current="page">');
    expect(html).toContain('id="tab-inntak" data-tab="inntak" href="/inntak" hidden>');
    expect(html).toContain('id="tab-timeline" data-tab="timeline" href="/timeline" hidden>');
  });

  it("epicStatusWords counts the active epics by colour, in Norwegian words", () => {
    const plan = {
      lanes: [lane("a", "aktiv", 10), lane("b", "aktiv", 5), lane("c", "aktiv", 2), lane("d", "aktiv", 8), lane("e", "forslag", 9), lane("f", "aktiv", 4)],
      tasks: [est("a1", "a", 6, 8), est("b1", "b", 3, 7), est("c1", "c", 4, 6), disc("d1", "d", 3)],
    } as unknown as Plan;
    expect(epicStatusWords(plan)).toBe("5 aktive epics · 1 grønn · 1 gul · 1 rød · 1 venter på utredning · 1 forslag");
  });

  it("epicStatusWords uses the plural forms and leaves zero parts out", () => {
    const plan = { lanes: [lane("a", "aktiv", 10), lane("b", "aktiv", 10)], tasks: [est("a1", "a", 6, 8), est("b1", "b", 6, 8)] } as unknown as Plan;
    expect(epicStatusWords(plan)).toBe("2 aktive epics · 2 grønne");
    expect(epicStatusWords({ lanes: [lane("a", "aktiv", 1)], tasks: [est("a1", "a", 4, 6)] } as unknown as Plan)).toBe("1 aktiv epic · 1 rød");
    expect(epicStatusWords({ lanes: [], tasks: [] } as unknown as Plan)).toBe("Ingen epics ennå");
  });
});
```

(`PlanTask` and `Plan` are already imported as types in this file; add `import type { Plan } from "./merge";` if `Plan` is not.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd ~/Skytale/SkyTracker-wt-epics && NODE_OPTIONS= npx vitest run src/features/timeline/epic-tools.test.ts 2>&1 | tail -15`
Expected: FAIL — `navTabsHtml is not a function` (or the export-equality test fails on the missing names).

- [ ] **Step 3: Implement**

In `epic-tools.js`, after `sprintLabel`:

```js
/* ---------- R14: the shared top bar and the status strip in words ---------- */
const NAV_TABS = [["inntak", "Inntak", "/inntak"], ["timeline", "Tidslinjen", "/timeline"], ["board", "Brettet", "/"]];
/** The three pages' tabs in the process order; opened from a file, only the active one shows (the others would point nowhere). */
function navTabsHtml(active, hosted) {
  return NAV_TABS.map(([key, name, href]) => {
    const on = key === active;
    return '<a class="tab' + (on ? " on" : "") + '" id="tab-' + key + '" data-tab="' + key + '" href="' + href + '"' + (on ? ' aria-current="page"' : hosted ? "" : " hidden") + ">" + name + "</a>";
  }).join("");
}
/** The status strip's first part: the active epics by colour, in words; zero parts are left out. */
function epicStatusWords(plan) {
  if (!plan.lanes.length) return "Ingen epics ennå";
  const active = plan.lanes.filter((l) => (l.state || "aktiv") === "aktiv");
  const n = { gronn: 0, gul: 0, rod: 0, venter: 0 };
  active.forEach((l) => { const c = epicStatus(plan, l.key).code; if (n[c] !== undefined) n[c]++; });
  const parts = [active.length + (active.length === 1 ? " aktiv epic" : " aktive epics")];
  if (n.gronn) parts.push(n.gronn + (n.gronn === 1 ? " grønn" : " grønne"));
  if (n.gul) parts.push(n.gul + (n.gul === 1 ? " gul" : " gule"));
  if (n.rod) parts.push(n.rod + (n.rod === 1 ? " rød" : " røde"));
  if (n.venter) parts.push(n.venter + " venter på utredning");
  const forslag = plan.lanes.filter((l) => l.state === "forslag").length;
  if (forslag) parts.push(forslag + " forslag");
  return parts.join(" · ");
}
```

Add `navTabsHtml, epicStatusWords,` to `module.exports` (after `dayKey, currentSprint, sprintDay, sprintLabel,`). In `epic-tools.d.ts` append:

```ts
/* R14: the shared top bar and the status strip in words */
export declare function navTabsHtml(active: "inntak" | "timeline" | "board", hosted: boolean): string;
export declare function epicStatusWords(plan: Plan): string;
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `NODE_OPTIONS= npx vitest run src/features/timeline/epic-tools.test.ts 2>&1 | tail -6`
Expected: all pass (the file's count grows by 4).

- [ ] **Step 5: Commit**

```bash
git add src/features/timeline/epic-tools.js src/features/timeline/epic-tools.d.ts src/features/timeline/epic-tools.test.ts
git commit -m "epic-tools: the three pages' tabs from one builder, and the active epics' status in words for the strip (R14)"
```

---

### Task 2: `refreshReleases` reads one release when asked

**Files:**
- Modify: `src/features/ado/releases.ts` (`refreshReleases` signature and loop)
- Modify: `src/app/api/ado-releases/route.ts`
- Test: `src/features/ado/releases.test.ts`

**Interfaces:**
- Produces: `refreshReleases(plan, client, now, opts?: { only?: string })` — with `only`, just that release is queried and rewritten; `read.releases` counts the refreshed ones. `POST /api/ado-releases` with body `{ release: key }` passes it on; an unknown key → `{ unchanged: true }`; no body → all.

- [ ] **Step 1: Write the failing test**

In `releases.test.ts`, inside the existing `describe` for `refreshReleases` (model the plan and the fake client on the first test there: a plan with releases `2.0.1` and `2.0.2`, a client whose `wiql` records its queries):

```ts
it("reads only the asked release and leaves the other untouched", async () => {
  const queries: string[] = [];
  const client = { ...fakeClient(), wiql: async (q: string) => { queries.push(q); return q.includes("'2.0.2'") ? [4999] : []; } };
  const plan = planWithReleases();   // 2.0.1 (key r1) with an older ado read, 2.0.2 (key r2) never read
  const before = JSON.stringify(plan.releases![0].ado);
  const rr = await refreshReleases(plan, client, NOW, { only: "r2" });
  expect(JSON.stringify(rr.plan.releases![0].ado)).toBe(before);
  expect(rr.plan.releases![1].ado?.items.map((i) => i.id)).toEqual([4999]);
  expect(queries.filter((q) => q.includes("[Custom.Release] = '2.0.1'"))).toEqual([]);
  expect(rr.read.releases).toBe(1);
});
```

Use the file's existing helpers for the client and the plan; if they are inline in the first test, extract `fakeClient()` and `planWithReleases()` there first (a refactor that keeps the first test green).

- [ ] **Step 2: Run the test to see it fail**

Run: `NODE_OPTIONS= npx vitest run src/features/ado/releases.test.ts 2>&1 | tail -12`
Expected: FAIL — `rr.plan.releases[0].ado` was rewritten (the `before` string differs) or `read.releases` is 2.

- [ ] **Step 3: Implement**

`releases.ts`:

```ts
export async function refreshReleases(plan: Plan, client: Pick<AdoClient, "wiql" | "batch" | "capacities" | "iterations">, now: Date, opts: { only?: string } = {}): Promise<ReleaseRefreshResult> {
  ...
  const wanted = (p.releases ?? []).filter((r) => !opts.only || r.key === opts.only);   // R14: the drawer reads only its own release
  for (const r of wanted) {
  ...
  return { plan: p, events, read: { releases: wanted.length, items } };
```

`route.ts`:

```ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "writer") return Response.json({ error: "read-only" }, { status: 403 });
  let only: string | undefined;   // R14: the release drawer asks for its own release; the six-hour auto-read sends no body
  try { const b = await req.json(); if (b && typeof b.release === "string" && b.release) only = b.release; } catch { /* no body */ }
  const stored = await readPlan(prisma);
  if (!stored || !(stored.data.releases ?? []).length) return Response.json({ unchanged: true }, NO_STORE);
  if (only && !(stored.data.releases ?? []).some((r) => r.key === only)) return Response.json({ unchanged: true }, NO_STORE);
  ...
    const rr = await refreshReleases(stored.data, client, new Date(), { only });
```

- [ ] **Step 4: Run the tests**

Run: `NODE_OPTIONS= npx vitest run src/features/ado/releases.test.ts 2>&1 | tail -6 && NODE_OPTIONS= npx tsc --noEmit 2>&1 | tail -3`
Expected: all pass; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/ado/releases.ts src/app/api/ado-releases/route.ts src/features/ado/releases.test.ts
git commit -m "ado-releases: the release drawer can read only its own release; the six-hour auto-read still reads all (R14)"
```

---

### Task 3: Tidslinjen's top bar, menus, status strip, ADO link, legend, hint

**Files:**
- Modify: `src/app/timeline/timeline.html` (CSS ~86–100, 155–170, 212–213, 451; markup 523–560, 656–668; JS `updateTlSummary` ~1485, `initServerPlan` ~2622, `renderAdoBar` ~2786, `renderSprintGoal` ~2854, boot)
- Modify smokes: `hosted-smoke.mjs` (H), `hosted-history-smoke.mjs` (S-steps using baselineBtn, adoRefreshBtn, adoBar, mixSelect, investorBtn), `hosted-polish-smoke.mjs` (adoImportBtn), `theme-shots.mjs`, `ui-smoke.mjs` (h1)

**Interfaces:**
- Consumes: `navTabsHtml`, `epicStatusWords` (Task 1).
- Produces: ids `navTabs`, `adoMenu`, `moreMenu`, `adoDot`, `adoConflictsBtn`, `statusStrip`, `stEpics`, `stRelease`, `adoStatus`, `hintClose`; the removed ids `backLink`, `adoBar`, `adoText`, `adoLogin`, `adoBarClose`, `tlSummary`; the `<h1>` is gone.

- [ ] **Step 1: Write the failing smoke asserts**

In `hosted-smoke.mjs` replace the H block's `#backLink` assert with:

```js
assert(await page.$eval("#tab-board", (e) => !e.hidden && e.getAttribute("href") === "/" && e.textContent === "Brettet"), "the board tab is the way back when hosted");
assert(await page.$eval("#tab-timeline", (e) => e.classList.contains("on") && e.getAttribute("aria-current") === "page"), "Tidslinjen is the active tab");
assert(await page.$("h1") === null, "no h1: the active tab is the page's name");
assert(await page.$eval("#statusStrip", (e) => /Ingen epics ennå|aktiv/.test(e.textContent)), "the status strip speaks in words");
```

In `hosted-history-smoke.mjs` add near the top: `const openMenu = async (id) => { await page.click("#" + id + " > summary"); await page.waitForSelector("#" + id + "[open]"); };` and: before each `#baselineBtn` click → `await openMenu("moreMenu");`; before `#adoRefreshBtn` → `await openMenu("adoMenu");`; replace `await page.waitForSelector("#adoBar:not([hidden])");` with `await page.waitForSelector("#adoStatus:not([hidden])"); assert(/ADO: 1 konflikt/.test(await page.$eval("#adoStatus", (e) => e.textContent)), "the ADO link counts the conflict"); await page.click("#adoStatus"); await page.waitForSelector("#adoList:not([hidden])");`; before `#mixSelect` → `await openMenu("moreMenu");`; before `#investorBtn` → `await openMenu("moreMenu");`. Where the reader section asserts what a reader sees, add: `assert(await page.$eval("#adoMenu", (e) => e.hidden), "no ADO menu for a reader"); assert(await page.$eval("#adoStatus", (e) => e.hidden), "no ADO link for a reader");`.

In `hosted-polish-smoke.mjs` add the same `openMenu` helper and `await openMenu("adoMenu");` before each `#adoImportBtn` click. In `theme-shots.mjs` replace the `#backLink` hidden assert with `assert(await page.$eval("#tab-board", (e) => e.hidden) && await page.$eval("#tab-timeline", (e) => !e.hidden), "file://: only the active tab");` and open `#moreMenu` before `#helpBtn`. In `ui-smoke.mjs` replace the `h1` heading assert with `assert((await page.$eval("#tab-timeline", (e) => e.textContent)) === "Tidslinjen", "the active tab is the heading");`.

- [ ] **Step 2: Run one smoke to see it fail**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-smoke.mjs 2>&1 | tail -3`
Expected: `ASSERT: the board tab is the way back when hosted` (no `#tab-board` yet).

- [ ] **Step 3: Implement the markup**

Replace the `<header class="topbar">…</header>` with:

```html
<header class="topbar">
  <div class="tb-left">
    <nav class="tabs" id="navTabs" aria-label="Sider"></nav>
    <span class="badge warn" id="exampleBadge" hidden>Eksempel, ikke en plan</span>
  </div>
  <div class="tb-right">
    <span class="save-note" id="dirtyNote"></span>
    <span class="whoami" id="whoami"></span>
    <span class="ro-tag" id="roTag" hidden>Lesetilgang</span>
    <select id="cmpSelect" title="Sammenlign planen med et tidligere punkt"><option value="">Sammenlign med …</option></select>
    <input id="cmpDate" type="date" hidden title="Planen slik den var om morgenen denne dagen">
    <button id="histBtn" title="Hva har flyttet seg, og hvorfor">Historikk<span class="count" id="histBadge" hidden></span></button>
    <details class="menu" id="adoMenu" hidden>
      <summary title="Alt som leser fra eller skriver til Azure DevOps">ADO ▾<i class="dot" id="adoDot" hidden></i></summary>
      <div class="menu-list">
        <button id="adoImportBtn" hidden title="Epics og features som allerede ligger i ADO, inn i planen. Skriver ingenting til ADO.">Hent fra ADO</button>
        <button id="adoRefreshBtn" hidden title="Les tilbake fra ADO: stories, poeng, sprint og det som er lukket">Oppdater fra ADO</button>
        <button id="adoConflictsBtn" title="Endret i ADO etter siste push. Ingenting overskrives uten at du ber om det.">Konflikter (0)</button>
      </div>
    </details>
    <details class="menu" id="moreMenu">
      <summary>Mer ▾</summary>
      <div class="menu-list">
        <button id="personBtn" title="Én rad per eier: utredninger og features i rekkefølge. Lesevisning; rediger i epic-visningen.">Per person</button>
        <button id="baselineBtn" title="Lagre planen slik den er nå, som et punkt å sammenligne med">Merk baseline…</button>
        <button id="exportBtn">Eksporter (JSON)</button>
        <button id="importBtn" hidden title="Erstatt planen med en eksportert JSON-fil: det filen mangler fjernes, det filen endrer vinner. Alt logges.">Importer (JSON)</button>
        <input id="importFile" type="file" accept="application/json,.json" hidden>
        <label class="menu-field" id="mixField" hidden title="Hvor stor del av en sprint som går til planlagte features: faktoren fra rå uker til uker på tidslinjen">Sprintmiks <select id="mixSelect"><option value="transition">overgang (55 % til features)</option><option value="normal">normal (60 %)</option></select></label>
        <button id="investorBtn" hidden title="Planen nå, gjennomføringsevne og målopnåelse – tallene investorene spør om">Investorer</button>
        <button id="helpBtn">Hjelp</button>
      </div>
    </details>
    <button id="addReleaseBtn" title="En versjon med måldato. Det som har release-labelen i ADO (bugs og stories), er innholdet.">＋ Release</button>
    <button class="primary" id="addEpicBtn">＋ Epic</button>
  </div>
</header>
```

Under `<main class="wrap">`, replace the hint, keep `roBanner`, replace the `ado-bar` block (keep `adoList`):

```html
  <div class="status" id="statusStrip">
    <span id="stEpics">Ingen epics ennå</span>
    <span id="stRelease" hidden></span>
    <span class="sprint-goal" id="sprintGoal" hidden></span>
    <a class="ado-link" id="adoStatus" hidden href="#"></a>
  </div>
  <p class="hint" id="hint">
    Én rad per epic. Utredning er stripet med en sluttdato, estimater er et spenn: mørk del = sannsynlig,
    lys del = usikker. Statusen regnes ut fra spennet mot måldatoen. Trykk <b>Mer › Hjelp</b> for bruk.
    <button class="x" id="hintClose" title="Lukk hintet; det kommer ikke tilbake i denne nettleseren">✕</button>
  </p>
  <div class="ro-banner" id="roBanner" hidden>…unchanged…</div>
  <div class="ado-list" id="adoList" hidden></div>
```

The legend keeps only its seven swatch spans (remove `mixField`, `sprintGoal`, `tlSummary` from it).

- [ ] **Step 4: CSS**

Add after `.topbar h1 .sub` (and delete the two `h1` rules):

```css
  .tabs{display:flex;gap:2px;align-items:center}
  .tabs .tab{font-size:14px;font-weight:500;color:var(--text-3);text-decoration:none;padding:6px 10px;border-radius:6px;white-space:nowrap}
  .tabs .tab:hover{color:var(--text);background:var(--raised)}
  .tabs .tab.on{color:var(--text);font-weight:600;font-size:18px;letter-spacing:-.01em;padding:4px 10px 4px 0;background:none}
  .tabs .tab[hidden]{display:none}
  .menu{position:relative}
  .menu > summary{list-style:none;cursor:pointer;font-size:13px;padding:6px 12px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text-2);white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
  .menu > summary::-webkit-details-marker{display:none}
  .menu > summary:hover{color:var(--text-hover);border-color:var(--text-4)}
  .menu[open] > summary{color:var(--text);border-color:var(--text-4)}
  .menu .dot{width:7px;height:7px;border-radius:50%;background:var(--warn-dot);display:inline-block}
  .menu .dot[hidden]{display:none}
  .menu-list{position:absolute;right:0;top:calc(100% + 4px);z-index:70;min-width:220px;display:flex;flex-direction:column;gap:2px;padding:6px;background:var(--surface);border:1px solid var(--line);border-radius:6px;box-shadow:var(--shadow)}
  .menu-list button,.menu-list .menu-field{text-align:left;border-color:transparent;background:transparent;width:100%;display:flex;gap:8px;align-items:center;justify-content:space-between;font-size:13px;padding:6px 10px;border-radius:4px;color:var(--text)}
  .menu-list button:hover{background:var(--raised);border-color:transparent}
  .menu-list button[hidden],.menu-list .menu-field[hidden]{display:none}
  .menu-list .menu-field select{font-size:12px;padding:2px 4px}
  .status{display:flex;flex-wrap:wrap;gap:4px 0;margin:12px 0 0;font-size:12px;color:var(--text-2);align-items:center}
  .status > *{padding:0 12px;border-left:1px solid var(--line-soft);display:inline-flex;align-items:center;gap:6px}
  .status > *:first-child{padding-left:0;border-left:none}
  .status > [hidden]{display:none}
  .status i{width:9px;height:9px;border-radius:50%;display:inline-block;background:var(--neutral)}
  .status i.st-gronn{background:var(--ok)} .status i.st-gul{background:var(--warn-dot)} .status i.st-rod{background:var(--bad)}
  .status .sprint-goal{cursor:pointer}
  .status .ado-link{color:var(--warn-fg);font-weight:500;text-decoration:none}
  .status .ado-link:hover{text-decoration:underline}
  .hint{position:relative;padding-right:26px;margin-top:8px}
  .hint .x{position:absolute;right:0;top:-2px}
```

Delete the `.tl-summary` rules, the `.legend .mix` rules and the `.ado-bar` rule (keep `.ado-list`, `.ado-row`).

- [ ] **Step 5: JS**

At boot (right after `const HOSTED = …`'s neighbours where `$` exists, before `initServerPlan` is called):

```js
  $('navTabs').innerHTML = navTabsHtml('timeline', HOSTED);   // R14: the three pages share the tabs; from a file only this one
  const HINT_KEY = 'sk.hint.timeline';
  try{ if(localStorage.getItem(HINT_KEY) === '1') $('hint').hidden = true; }catch(e){}
  $('hintClose').addEventListener('click', () => { $('hint').hidden = true; try{ localStorage.setItem(HINT_KEY, '1'); }catch(e){} });
  document.querySelectorAll('details.menu').forEach(m => {   // a click on an item, outside, or Escape closes the menu
    m.querySelector('.menu-list').addEventListener('click', e => { if(e.target.closest('button')) m.open = false; });
  });
  document.addEventListener('click', e => { document.querySelectorAll('details.menu[open]').forEach(m => { if(!m.contains(e.target)) m.open = false; }); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') document.querySelectorAll('details.menu[open]').forEach(m => { m.open = false; }); });
  $('adoConflictsBtn').addEventListener('click', () => { const l = $('adoList'); l.hidden = !l.hidden || !adoConflictRows().length; });
```

`updateTlSummary` → keep the name, new body:

```js
  function updateTlSummary(){   // R14: the status strip in words
    $('stEpics').textContent = epicStatusWords(state);
    const nx = nextReleaseText(state, dayKey(new Date()));
    const nfc = nx ? releaseForecastText(nx.release, dayKey(new Date())) : null;
    const rel = $('stRelease');
    rel.hidden = !nx;
    if(nx){ rel.title = 'Neste release: hvor langt unna, andel levert, tempo-fargen og sjansen for å bli ferdig til målet'; rel.innerHTML = (nx.code ? '<i class="st-' + nx.code + '"></i>' : '') + esc(nx.text + (nfc && nfc.short ? ' · ' + nfc.short : '')); }
    $('mixSelect').value = (state.capacity && state.capacity.mode) || 'transition';
    renderSprintGoal();
  }
```

`renderAdoBar` → `renderAdoStatus` (keep the old name as an alias so every caller still works):

```js
  function renderAdoBar(){   // R14: a link in the strip and a dot on the ADO menu, never a yellow row
    const link = $('adoStatus'), list = $('adoList');
    const rows = HOSTED ? adoConflictRows() : [];
    $('adoConflictsBtn').textContent = 'Konflikter (' + rows.length + ')';
    $('adoDot').hidden = !(rows.length || adoLoginNeeded);
    if(!canWrite || (!rows.length && !adoLoginNeeded)){ link.hidden = true; list.hidden = true; return; }
    link.hidden = false;
    if(adoLoginNeeded){ link.textContent = 'ADO: logg inn på nytt'; link.href = '/login?callbackUrl=/timeline'; link.title = 'Tokenet er utløpt: logg inn på nytt for å lese og skrive til ADO'; }
    else { link.textContent = 'ADO: ' + rows.length + (rows.length === 1 ? ' konflikt' : ' konflikter'); link.href = '#'; link.title = 'Endret i ADO etter siste push. Klikk for listen; ingenting overskrives uten at du ber om det.'; }
    if(!rows.length) list.hidden = true;
    list.innerHTML = rows.map(r => …unchanged row markup…).join('');
  }
  $('adoStatus').addEventListener('click', e => { if(adoLoginNeeded) return; e.preventDefault(); const l = $('adoList'); l.hidden = !l.hidden; });
```

Delete `adoBarDismissed`, `adoBarKey` and the `adoBarClose` listener. In `initServerPlan` add `$('adoMenu').hidden = !canWrite;` beside the other role toggles, and `$('adoMenu').hidden = true;` in the 403 branch of `pushPlan`. `renderSprintGoal` is unchanged (same id, now inside the strip).

- [ ] **Step 6: Run the smokes**

Run, each from the worktree with `NODE_OPTIONS= npx tsx …`: `hosted-smoke.mjs`, `hosted-history-smoke.mjs`, `hosted-polish-smoke.mjs`, `ui-smoke.mjs`, `theme-shots.mjs`; read each tail.
Expected: hosted «OK», history «OK», polish «TRINN 1 SMOKE OK», ui «OK», theme shots written.

- [ ] **Step 7: Look at it**

Screenshot the hosted page at 1280 and 1100 px with the Mer menu open (a scratch Playwright script on the hosted-smoke server pattern, or add two `page.screenshot` lines to a copy of the smoke); check the menu is not clipped and the strip reads as one line.

- [ ] **Step 8: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "timeline: one top bar with the three tabs, the ADO and Mer menus, the status strip in words, the ADO notice as a link, the legend as explanation only, the hint closed once (R14)"
```

---

### Task 4: the editor in two tabs, the release line's label, the drawer's own refresh

**Files:**
- Modify: `src/app/timeline/timeline.html` (editor markup ~730–790, CSS near `.ed-body`, JS `openEditor`, the `relRefresh` listener ~2550, the release-line drawing ~1205, CSS `.chart .release-line`)
- Modify smokes: `hosted-history-smoke.mjs` (the spec/pull step), `hosted-release-smoke.mjs` (the `ado-releases` mock reads the body; asserts)

**Interfaces:**
- Consumes: `POST /api/ado-releases` with `{ release }` (Task 2).
- Produces: ids `edTabs`, `edTabPlan`, `edTabOm`; `.release-line[data-v]`.

- [ ] **Step 1: Failing smoke asserts**

`hosted-history-smoke.mjs`, the step that fills `#edSpec` then clicks `#edPull`: before the fill `await page.click('#edTabs [data-tab="om"]'); await page.waitForSelector('#edTabOm:not([hidden])');`, before the click `await page.click('#edTabs [data-tab="plan"]');`. Where an editor is opened the first time, add `assert(await page.$eval("#edTabPlan", (e) => !e.hidden) && await page.$eval("#edTabOm", (e) => e.hidden), "the editor opens on Plan");` and `assert((await page.$eval('#edType', (e) => e.closest(".ed-field").querySelector("span").textContent)) === "Art", "the second Type is called Art");`.

`hosted-release-smoke.mjs`: the `/api/ado-releases` mock reads the body and passes `{ only }`: `const b = await body(); const rr = await refreshReleases(stored.data, fakeAdo.client, now(), { only: typeof b.release === "string" ? b.release : undefined });` and records the keys asked: `releaseAsked.push(b.release || "*")`. After the first `#relRefresh` click add `assert(releaseAsked.at(-1) === <that release's key>, "the drawer asked for its own release only");` and the note assert `/lest fra ADO: release 2\.0\.1/`. After the band is drawn: `assert(await page.$eval('.release-line', (e) => e.dataset.v === "2.0.1" && getComputedStyle(e, "::after").content === '"2.0.1"'), "the release line carries its version at the bottom");`.

- [ ] **Step 2: Run the release smoke to see it fail**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-release-smoke.mjs 2>&1 | tail -3`
Expected: `ASSERT: the release line carries its version at the bottom` or the `asked` assert.

- [ ] **Step 3: Implement**

Editor markup: keep `Navn` and `Epic`, then

```html
        <div class="ed-tabs" id="edTabs" role="tablist">
          <button type="button" class="on" data-tab="plan" role="tab" aria-selected="true">Plan</button>
          <button type="button" data-tab="om" role="tab" aria-selected="false">Om featuren</button>
        </div>
        <div class="ed-panel" id="edTabPlan" role="tabpanel">
          …Type (edKind) · the Start/class/end/likely/late row · the Eier/Buffer row · edFixed · edQueue · edPullRow · edProgRow + edProgNote · Venter på (edDeps) · Koble avhengighet · edLifecycleRow…
        </div>
        <div class="ed-panel" id="edTabOm" role="tabpanel" hidden>
          …Beskrivelse · the Art (edType, label «Art») / Flater row · the ADO-id / Spec-mappe row…
        </div>
        <div class="ed-row" id="edPushRow" hidden>…unchanged…</div>
```

CSS: `.ed-tabs{display:flex;gap:2px;border-bottom:1px solid var(--line-soft)} .ed-tabs button{border:none;border-bottom:2px solid transparent;border-radius:0;background:none;padding:6px 12px;margin-bottom:-1px;color:var(--text-3)} .ed-tabs button.on{color:var(--text);border-bottom-color:var(--accent)} .ed-panel{display:grid;gap:14px} .ed-panel[hidden]{display:none}`.

JS: 

```js
  function showEdTab(k){ $('edTabs').querySelectorAll('button').forEach(b => { const on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); $('edTabPlan').hidden = k !== 'plan'; $('edTabOm').hidden = k !== 'om'; }
  $('edTabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if(b) showEdTab(b.dataset.tab); });
```

and `showEdTab('plan');` first thing in `openEditor`.

Release line: in the drawing loop `ln.dataset.v = sg.release.version;` and CSS `.chart .release-line::after{content:attr(data-v);position:absolute;bottom:2px;left:4px;font-size:10px;line-height:14px;color:var(--text-3);background:var(--surface);padding:0 4px;border-radius:3px;white-space:nowrap}`.

Drawer refresh:

```js
  $('relRefresh').addEventListener('click', async () => {   // R14: only this release's label, not the whole plan
    const r = (state.releases || []).find(x => x.key === releaseKey); if(!r) return;
    try{
      setSaveNote('leser fra ADO…');
      const j = await adoCall('api/ado-releases', { release: r.key });
      if(j.data && !pendingSave && !drag) applyRemote(j.data, j.version);
      setSaveNote(j.unchanged ? 'lest fra ADO: release ' + r.version + ' uendret' : 'lest fra ADO: release ' + r.version + ' · ' + ((j.read && j.read.items) || 0) + ' items');
      renderReleaseDrawer(); refreshHistoryBadge();
    }catch(e){
      if(e.message === 'ado-login') setSaveNote('ADO: logg inn på nytt');
      else { setSaveNote(''); askDialog('Oppdater fra ADO', e.message, {confirmText:'OK', noCancel:true}); }
    }
  });
```

Update the button's title: «Les bugs og stories med denne releasens label fra ADO».

- [ ] **Step 4: Run the smokes**

Run: release, history, polish (it opens editors), ui, theme shots. Expected: all green.

- [ ] **Step 5: Look at it**

Screenshot the editor on both tabs (the polish smoke's editor screenshot step, or a scratch script).

- [ ] **Step 6: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "timeline: the feature editor in two tabs, Plan and Om featuren, with «Art» for the second Type; the release line carries its version at the bottom; the drawer's «Oppdater fra ADO» reads only its release (R14)"
```

---

### Task 5: Brettet and Inntak get the tabs and the closable hint

**Files:**
- Modify: `src/app/board.html` (header ~122–137, hint 138, CSS ~36–44, boot)
- Modify: `src/app/inntak/inntak.html` (header ~99–111, hint 113, CSS ~36–44, boot)
- Modify smokes: `hosted-board-smoke.mjs`, `hosted-intake-smoke.mjs` (I4)

- [ ] **Step 1: Failing smoke asserts**

`hosted-board-smoke.mjs`, after the page loads: `assert(await page.$eval("#tab-board", (e) => e.classList.contains("on")) && await page.$eval("#tab-timeline", (e) => e.getAttribute("href") === "/timeline"), "the board shows the tabs with Brettet active"); await page.click("#hintClose"); assert(await page.$eval("#hint", (e) => e.hidden), "the hint closes"); await page.reload(); await page.waitForSelector("#cols"); assert(await page.$eval("#hint", (e) => e.hidden), "…and stays closed");`.
`hosted-intake-smoke.mjs` I4: replace `#intakeLink[href="/inntak"]` with `#tab-inntak[href="/inntak"]`, and on the intake page itself assert `#tab-inntak.on`.

- [ ] **Step 2: Run the board smoke to see it fail**

Expected: `ASSERT: the board shows the tabs with Brettet active`.

- [ ] **Step 3: Implement**

Both pages: `.tb-left` becomes `<nav class="tabs" id="navTabs" aria-label="Sider"></nav>` (the `<h1>` and the two links go; the right side stays). The hint gets `id="hint"` and the `✕` button `id="hintClose"`. CSS: the `.tabs` rules from Task 3 (the intake's existing `.tabs` rules for its status filter are renamed `.filters` with its `#tabs` div → `class="filters"` and the JS selector updated, so the two do not collide). Boot: `$('navTabs').innerHTML = navTabsHtml('board' | 'inntak', location.protocol !== 'file:');` plus the hint's `localStorage` lines with keys `sk.hint.board` / `sk.hint.inntak`.

- [ ] **Step 4: Run the smokes**

Run: board, intake. Expected: «BOARD SMOKE OK», «INNTAK SMOKE OK».

- [ ] **Step 5: Commit**

```bash
git add src/app/board.html src/app/inntak/inntak.html
git commit -m "board, inntak: the same tabs as Tidslinjen, Brettet and Inntak as the active one, and the hint closes once (R14)"
```

---

### Task 6: help text, the whole suite, PR text

**Files:**
- Modify: `src/app/timeline/timeline.html` (help card «ADO og sprinter»: «sprintmålet i statusstripen»; card «Kø og kapasitet»: «Sprintmiksen under Mer»)
- Create: `~/Skytale/ClaudeReports/planning/roadmap-2.0/pr-body-topbar-r14.md`

- [ ] **Step 1: Help text** — two sentences updated as above.
- [ ] **Step 2: Full verification**

Run: `NODE_OPTIONS= npx vitest run 2>&1 | tail -4; NODE_OPTIONS= npx tsc --noEmit 2>&1 | tail -2; NODE_OPTIONS= npx eslint src 2>&1 | tail -2; NODE_OPTIONS= npx next build 2>&1 | grep -E "Compiled|error" | head -3`, then all eight smokes (hosted, history, polish, release, board, intake, ui, theme shots).
Expected: vitest all green (+5), tsc/eslint clean, build compiled, every smoke's last line OK.

- [ ] **Step 3: PR text** — what changed (A and D), verification, after merge (nothing to do; the hint closes per browser), the Vercel note.
- [ ] **Step 4: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "timeline: the help names where the sprint goal and the mix now live (R14)"
```

(The smokes and the PR text are committed in the workspace repo, as for R13.)

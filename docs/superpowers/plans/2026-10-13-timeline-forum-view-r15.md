# Tidslinjen R15: the forum view — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One switch «Forum» on Tidslinjen that hides the development lead's tools, puts the compare bar («Siden sist») on top against the last forum's baseline, and stands the shelf beside the chart, remembered per browser and the readers' default.

**Architecture:** Two pure helpers in `epic-tools.js` (`forumBaseline`, `forumDefault`), unit-tested. The page gets a `body.forum` class (CSS hides the tools, never the `hidden` attribute, so the role rules stay), a DOM move of `#cmpBar`/`#cmpList` above the status strip, an auto-compare against the newest `baseline` snapshot, a `div.stage` wrapper around `#gantt` + `#shelf` that becomes a two-column grid in the forum view. The Playwright history smoke proves the reader default, the writer's switch, the layout, the persistence and the way back.

**Tech Stack:** plain HTML/JS page served by a Next route handler, `epic-tools.js` (CommonJS + browser globals), vitest 4, Playwright smokes (`NODE_OPTIONS= npx tsx <smoke>` from the worktree).

**Spec:** `docs/superpowers/specs/2026-10-13-planning-system-r15-forum-view-design.md`

## Global Constraints

- Norwegian in the UI, English in code and commits. No Claude attribution anywhere.
- `module.exports` of `epic-tools.js` must equal `epic-tools.d.ts` (the existing test checks it). The page calls the helpers as bare globals (classic script).
- Every existing button keeps its id and its role rule; the forum view hides with CSS on `body.forum`, never with `hidden`.
- No plan JSON change, no route change, no ADO write, no change to `board.html` or `inntak.html`.
- Branch `feat/ux-forum-r15` is cut from `feat/ux-topbar-r14` (PR #21 open); rebased onto `origin/main` after #21 lands, before its PR.
- Smokes live in `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/` and run with `NODE_OPTIONS= npx tsx <path>` from the worktree.

## Review Focus

1. A reader with an empty shelf in the forum view: the stage is a single column (no `with-shelf`), nothing else breaks. (Task 3: S11 assert on `#stage`.)
2. `localStorage` throwing (private window): the switch works for the session, nothing is stored, the page boots. (Task 2: `readForumPref` and the write are in try/catch.)
3. A compare the person started before switching on stays when the switch goes off; one the switch started ends. (Task 3: S22's tail.)
4. A plan without any baseline: the note shows for writers with the «Merk baseline…» hint, for readers the first sentence, and goes when the switch goes off. (Task 2: the hosted smoke's H block, `snapshots: []`.)
5. Opened from `file://`: the switch lays the page out, no fetch, no error. (Task 3: ui smoke toggles it.)

---

### Task 1: `forumBaseline` and `forumDefault` in epic-tools

**Files:**
- Modify: `src/features/timeline/epic-tools.js` (after `epicStatusWords`, before `if (typeof module !== "undefined")`; the export list after `epicStatusWords,`)
- Modify: `src/features/timeline/epic-tools.d.ts` (end)
- Test: `src/features/timeline/epic-tools.test.ts` (import list + end of file)

**Interfaces:**
- Produces: `forumBaseline(snapshots: {id, at, kind, label?}[] | null | undefined) → snapshot | null` — the newest (`at` as ISO string, compared as strings) of `kind === "baseline"`; sprint snapshots ignored.
- Produces: `forumDefault(stored: string | null | undefined, canWrite: boolean) → boolean` — `"1"` → true, `"0"` → false, otherwise `!canWrite`.

- [ ] **Step 1: Write the failing tests**

Add `forumBaseline, forumDefault,` to the import list in `epic-tools.test.ts` (after `navTabsHtml, epicStatusWords,`) and append at the end of the file:

```ts
describe("R15: the forum view", () => {
  const snap = (id: string, kind: string, at: string) => ({ id, kind, at, label: id });
  it("takes the newest baseline and ignores sprint starts", () => {
    const s = [snap("a", "baseline", "2026-10-05T10:00:00.000Z"), snap("b", "sprint", "2026-11-01T08:00:00.000Z"), snap("c", "baseline", "2026-11-05T09:10:00.000Z"), snap("d", "baseline", "2026-09-01T09:00:00.000Z")];
    expect(forumBaseline(s)?.id).toBe("c");
  });
  it("is null without a baseline", () => {
    expect(forumBaseline([snap("b", "sprint", "2026-11-01T08:00:00.000Z")])).toBeNull();
    expect(forumBaseline([])).toBeNull();
    expect(forumBaseline(undefined)).toBeNull();
  });
  it("a stored choice wins; readers land in the forum view by default", () => {
    expect(forumDefault("1", true)).toBe(true);
    expect(forumDefault("0", false)).toBe(false);
    expect(forumDefault(null, false)).toBe(true);
    expect(forumDefault(null, true)).toBe(false);
    expect(forumDefault(undefined, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `NODE_OPTIONS= npx vitest run src/features/timeline/epic-tools.test.ts 2>&1 | tail -15`
Expected: FAIL — `forumBaseline is not a function` (the d.ts/exports equality test may fail too until Step 3).

- [ ] **Step 3: Implement**

In `epic-tools.js`, after `epicStatusWords`'s closing brace:

```js
/* R15: the forum view */
function forumBaseline(snapshots) {   // the last product forum: the newest snapshot of kind «baseline»; sprint starts are not forums
  let best = null;
  (snapshots || []).forEach((s) => { if (s && s.kind === "baseline" && (!best || String(s.at) > String(best.at))) best = s; });
  return best;
}
function forumDefault(stored, canWrite) {   // a stored choice wins; without one the forum view is the readers' default
  if (stored === "1") return true;
  if (stored === "0") return false;
  return !canWrite;
}
```

In the export list replace `navTabsHtml, epicStatusWords,` with `navTabsHtml, epicStatusWords, forumBaseline, forumDefault,`.

Append to `epic-tools.d.ts`:

```ts

/* R15: the forum view */
export interface ForumSnapshot { id: string; at: string; kind: string; label?: string }
export declare function forumBaseline(snapshots: ForumSnapshot[] | null | undefined): ForumSnapshot | null;
export declare function forumDefault(stored: string | null | undefined, canWrite: boolean): boolean;
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `NODE_OPTIONS= npx vitest run src/features/timeline/epic-tools.test.ts 2>&1 | tail -6`
Expected: all pass (3 new).

- [ ] **Step 5: Commit**

```bash
git add src/features/timeline/epic-tools.js src/features/timeline/epic-tools.d.ts src/features/timeline/epic-tools.test.ts
git commit -m "epic-tools: the forum view's baseline and its default by role (R15)"
```

---

### Task 2: the switch «Forum»: the tools hidden, the bar on top, the readers' default

**Files:**
- Modify: `src/app/timeline/timeline.html` (top bar after `#moreMenu`'s `</details>`; `main` before `#statusStrip`; CSS after `#personBtn.on`; the help card «Hylla og livssyklusen»; `render()`; `loadSnapshots`; `endCompare`; after the `cmpExport` listener; `initServerPlan`; the start section)
- Test: `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-history-smoke.mjs` (S11), `hosted-smoke.mjs` (H block, no baseline)

**Interfaces:**
- Consumes: `forumBaseline`, `forumDefault` (Task 1, bare globals in the page).
- Produces: `forumMode` (boolean), `setForum(on, remember)`, `body.forum`, `#forumBtn[aria-pressed]`, `#forumNote`; `#cmpBar` + `#cmpList` precede `#statusStrip` while on, follow `#linkBanner` while off. Task 3 reads `forumMode`.

- [ ] **Step 1: Write the failing smoke steps**

In `hosted-history-smoke.mjs`, S11, replace the line `assert(!(await page.$eval("#cmpSelect", (e) => e.hidden)), "reader: can still compare");` with:

```js
assert(!(await page.$eval("#cmpSelect", (e) => e.hidden)), "reader: can still compare");
// R15: without a stored choice a reader lands in the forum view: the bar on top against the last forum's baseline, JSON and Per person gone, Hjelp and Investorer kept
await page.waitForFunction(() => document.body.classList.contains("forum"));
assert((await page.getAttribute("#forumBtn", "aria-pressed")) === "true", "reader: the forum view is the default");
await page.waitForSelector("#cmpBar:not([hidden])");
assert(/^Siden produktforum 5\. nov:/.test(await page.$eval("#cmpStrip", (e) => e.textContent)), "reader: the strip on top names the last forum");
assert(await page.$eval("#cmpBar", (e) => !!(e.compareDocumentPosition(document.getElementById("statusStrip")) & Node.DOCUMENT_POSITION_FOLLOWING)), "reader: the bar sits above the status strip");
assert(await page.$eval("#forumNote", (e) => e.hidden), "reader: no note when a baseline exists");
await openMenu("moreMenu");
assert(!(await page.isVisible("#exportBtn")) && !(await page.isVisible("#personBtn")) && (await page.isVisible("#helpBtn")) && (await page.isVisible("#investorBtn")), "reader in the forum view: Mer keeps Investorer and Hjelp, not JSON or Per person");
await page.evaluate(() => { document.getElementById("moreMenu").open = false; });
await page.click("#forumBtn");
await page.waitForFunction(() => !document.body.classList.contains("forum"));
await page.waitForSelector("#cmpBar", { state: "hidden" });   // the compare the switch started ends with it
assert((await page.evaluate(() => localStorage.getItem("sk.forum"))) === "0", "reader: the choice is stored");
assert(await page.$eval("#linkBanner", (e) => e.nextElementSibling && e.nextElementSibling.id === "cmpBar"), "reader: off, the bar is back under the help panel");
await openMenu("moreMenu"); assert(await page.isVisible("#exportBtn"), "reader: off, Eksporter is back"); await page.evaluate(() => { document.getElementById("moreMenu").open = false; });
await page.reload(); await page.waitForSelector(".lane-label"); await page.waitForFunction(() => !document.getElementById("roTag").hidden);
await page.waitForTimeout(300);
assert(!(await page.$eval("body", (e) => e.classList.contains("forum"))), "reader: the stored choice wins over the default");
```

In `hosted-smoke.mjs`, find the H block's last assert (grep `H block` / `statusStrip`) and append after it:

```js
// R15: no baseline yet → the forum view shows the note for a writer, and the switch goes off again
await page.click("#forumBtn");
await page.waitForFunction(() => document.body.classList.contains("forum") && !document.getElementById("forumNote").hidden);
assert(/^Ingen baseline fra et produktforum ennå\. Merk én under Mer › Merk baseline…/.test(await page.$eval("#forumNote", (e) => e.textContent)), "H: the note without a baseline");
assert(await page.$eval("#cmpBar", (e) => e.hidden), "H: no compare without a baseline");
await page.click("#forumBtn");
await page.waitForFunction(() => !document.body.classList.contains("forum") && document.getElementById("forumNote").hidden);
```

- [ ] **Step 2: Run the smokes to see them fail**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-history-smoke.mjs 2>&1 | tail -5`
Expected: FAIL in S11 — timeout waiting for `body.forum` (no switch yet). Same for `hosted-smoke.mjs`: `#forumBtn` not found.

- [ ] **Step 3: Markup**

In the top bar, after `#moreMenu`'s `</details>` and before `<button id="addReleaseBtn"`:

```html
    <button id="forumBtn" aria-pressed="false" title="Skjermen på veggen i produktforum: hylla ved siden av diagrammet, «Siden sist» øverst, uten ADO og JSON. Valget huskes i nettleseren.">Forum</button>
```

In `main`, before `<div class="status" id="statusStrip"`:

```html
  <div class="cmp-bar forum-note" id="forumNote" hidden></div>
```

In the help card «Hylla og livssyklusen», after «Leverte features ligger på Brettet, ikke på hylla.» add:

```html
 <b>Forum</b> øverst gjør siden til skjermen på veggen: hylla ved siden av diagrammet, «Siden sist» øverst, uten ADO og JSON. Valget huskes i nettleseren; for lesere er det standard.
```

- [ ] **Step 4: CSS**

After the line `#personBtn.on{background:var(--accent);border-color:var(--accent);color:#fff}`:

```css
  /* R15: the forum view: the development lead's tools go, the compare bar goes on top (a class on body, never the hidden attribute: the role rules stay) */
  #forumBtn.on{background:var(--accent);border-color:var(--accent);color:#fff}
  body.forum #adoMenu,body.forum #adoStatus,body.forum #personBtn,body.forum #exportBtn,body.forum #importBtn,body.forum #mixField{display:none}
```

- [ ] **Step 5: JS**

In `render()`, after `renderAdoBar();` add `renderForumNote();`.

Next to `let cmp = null;` add: `let snapshots = [], snapshotsLoaded = false;   // R15: the list, kept for the forum view's baseline`.

In `loadSnapshots`, replace `const list = (await r.json()).snapshots.filter(` with:

```js
      snapshots = (await r.json()).snapshots; snapshotsLoaded = true;
      const list = snapshots.filter(
```

In `endCompare`, after `cmp = null;` nothing else changes (`render()` already calls `renderForumNote()`).

After the `$('cmpExport').addEventListener(...)` block and before `/* ================== hylla: klar for veikart ================== */`:

```js
  /* ================== forum-visningen (R15): skjermen på veggen ================== */
  const FORUM_KEY = 'sk.forum';
  let forumMode = false, forumStartedCompare = false;
  function readForumPref(){ try{ return localStorage.getItem(FORUM_KEY); }catch(e){ return null; } }
  function placeCompareBar(){   // on top in the forum view, under the help panel otherwise
    if(forumMode) $('statusStrip').before(cmpBar, cmpList); else $('linkBanner').after(cmpBar, cmpList);
  }
  function renderForumNote(){   // only when no forum has marked a baseline yet
    const note = $('forumNote');
    note.hidden = !(forumMode && HOSTED && snapshotsLoaded && !cmp && !forumBaseline(snapshots));
    note.textContent = 'Ingen baseline fra et produktforum ennå.' + (canWrite ? ' Merk én under Mer › Merk baseline… når forumet er ferdig; neste gang viser denne stripen hva som har flyttet seg.' : '');
  }
  async function ensureForumCompare(){   // «Siden sist» on top: the last forum's baseline, unless a compare is already running
    if(!HOSTED || cmp) return;
    if(!snapshotsLoaded) await loadSnapshots();
    const b = forumBaseline(snapshots);
    if(!b || cmp || !forumMode){ renderForumNote(); return; }
    forumStartedCompare = true;
    await startCompare(b.id);
    cmpSelect.value = b.id; cmpDate.hidden = true;
    renderForumNote();
  }
  function setForum(on, remember){
    forumMode = !!on;
    document.body.classList.toggle('forum', forumMode);
    const b = $('forumBtn'); b.classList.toggle('on', forumMode); b.setAttribute('aria-pressed', forumMode ? 'true' : 'false');
    if(remember){ try{ localStorage.setItem(FORUM_KEY, forumMode ? '1' : '0'); }catch(e){} }
    if(forumMode && personMode){ personMode = false; $('personBtn').classList.remove('on'); }   // a read view the forum does not use
    placeCompareBar();
    if(forumMode) ensureForumCompare();
    else if(forumStartedCompare){ forumStartedCompare = false; if(cmp) endCompare(); }
    render();
  }
  $('forumBtn').addEventListener('click', () => setForum(!forumMode, true));
```

In `initServerPlan`, after `loadSnapshots();` add:

```js
      if(!forumMode && forumDefault(readForumPref(), canWrite)) setForum(true, false);   // R15: readers land in the forum view unless they chose otherwise
```

In the start section, between `render();` and `initServerPlan();`:

```js
  if(readForumPref() === '1') setForum(true, false);   // R15: the stored choice, before the plan arrives
```

- [ ] **Step 6: Run the smokes to see them pass**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-history-smoke.mjs 2>&1 | tail -4` and the same for `hosted-smoke.mjs`.
Expected: `OK` for both.

- [ ] **Step 7: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "timeline: the switch «Forum»: the compare with the last forum's baseline on top, the development lead's tools hidden, remembered per browser, the readers' default (R15)"
```

---

### Task 3: the shelf as a side panel

**Files:**
- Modify: `src/app/timeline/timeline.html` (`#gantt` + `#shelf` markup; CSS after the shelf rules; `renderShelf`)
- Test: `hosted-history-smoke.mjs` (S22 at `// __LATER_SCENARIOS__`, S11 one assert), `ui-smoke.mjs` (toggle from `file://`)

**Interfaces:**
- Consumes: `forumMode` (Task 2).
- Produces: `div.stage#stage` around `#gantt` and `#shelf`, class `with-shelf` when the shelf shows; `#shelfTip`.

- [ ] **Step 1: Write the failing smoke steps**

In S11 (history smoke), after the `"reader: no note when a baseline exists"` assert add:

```js
assert(await page.$eval("#stage", (e) => !e.classList.contains("with-shelf") && getComputedStyle(e).display === "block"), "reader with an empty shelf: a single column");
```

Replace `// __LATER_SCENARIOS__` with:

```js
// S22 (R15): the forum view for a writer with rows on the shelf: the shelf beside the chart with the tip, «Per person» off, the bar on top, remembered across a reload, off again; a compare the person started stays
await page.evaluate(() => { try{ localStorage.removeItem("sk.forum"); }catch(e){} });
await openMenu("moreMenu"); await page.click("#personBtn"); await page.waitForFunction(() => document.getElementById("personBtn").classList.contains("on"));
await page.click("#forumBtn");
await page.waitForFunction(() => document.body.classList.contains("forum") && !document.getElementById("cmpBar").hidden);
assert(!(await page.$eval("#personBtn", (e) => e.classList.contains("on"))), "S22: «Per person» goes off in the forum view");
assert((await page.$eval("#stage", (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length)) === 2, "S22: the stage is a two-column grid");
const ganttBox = await (await page.$("#gantt")).boundingBox(), shelfBox = await (await page.$("#shelf")).boundingBox();
assert(shelfBox.x >= ganttBox.x + ganttBox.width - 1 && Math.abs(shelfBox.y - ganttBox.y) < 2, "S22: the shelf stands beside the chart: " + JSON.stringify({ ganttBox, shelfBox }));
assert(await page.isVisible("#shelfTip"), "S22: the tip under the shelf");
assert(await page.$eval("#cmpBar", (e) => !!(e.compareDocumentPosition(document.getElementById("statusStrip")) & Node.DOCUMENT_POSITION_FOLLOWING)), "S22: the bar is above the status strip");
assert(/^Siden produktforum 5\. nov:/.test(await page.$eval("#cmpStrip", (e) => e.textContent)), "S22: the strip names the last forum");
assert((await page.$eval("#cmpSelect", (e) => e.selectedOptions[0].textContent)).startsWith("Produktforum 5. nov"), "S22: the select shows the baseline");
await page.click("#cmpSince"); await page.waitForSelector("#cmpList:not([hidden])");
assert(await page.$eval("#cmpList", (e) => !!(e.compareDocumentPosition(document.getElementById("statusStrip")) & Node.DOCUMENT_POSITION_FOLLOWING)), "S22: the list opens under the bar, above the strip");
assert(!(await page.isVisible("#adoMenu")) && !(await page.isVisible("#adoStatus")), "S22: no ADO in the forum view");
await page.setViewportSize({ width: 1600, height: 1000 });
await page.screenshot({ path: DIR + "/09-forum-view.png", fullPage: false });
await page.reload(); await page.waitForSelector(".lane-label");
await page.waitForFunction(() => document.body.classList.contains("forum") && !document.getElementById("cmpBar").hidden);
assert((await page.evaluate(() => localStorage.getItem("sk.forum"))) === "1", "S22: the choice is stored");
await page.click("#forumBtn");
await page.waitForFunction(() => !document.body.classList.contains("forum"));
await page.waitForSelector("#cmpBar", { state: "hidden" });
assert(await page.$eval("#linkBanner", (e) => e.nextElementSibling && e.nextElementSibling.id === "cmpBar"), "S22: off, the bar is back under the help panel");
assert((await page.$eval("#stage", (e) => getComputedStyle(e).display)) === "block", "S22: off, the stage is a block again");
assert((await page.isVisible("#shelf")) && !(await page.isVisible("#shelfTip")), "S22: off, the shelf is under the chart without the tip");
// a compare the person started stays across the switch
const forumBaselineId = (await (await fetch(BASE + "/api/timeline-snapshots")).json()).snapshots.find((s) => s.kind === "baseline").id;
await page.selectOption("#cmpSelect", forumBaselineId); await page.waitForSelector("#cmpBar:not([hidden])");
await page.click("#forumBtn"); await page.waitForFunction(() => document.body.classList.contains("forum"));
await page.click("#forumBtn"); await page.waitForFunction(() => !document.body.classList.contains("forum"));
await page.waitForTimeout(200);
assert(!(await page.$eval("#cmpBar", (e) => e.hidden)), "S22: the person's own compare stays when the switch goes off");
await page.click("#cmpClose"); await page.waitForSelector("#cmpBar", { state: "hidden" });
console.log("S22 ok");
```

In `ui-smoke.mjs`, after the tab assert (grep `tab-timeline`), add:

```js
await page.click("#forumBtn"); await page.waitForFunction(() => document.body.classList.contains("forum") && getComputedStyle(document.getElementById("stage")).display === "grid");
await page.click("#forumBtn"); await page.waitForFunction(() => !document.body.classList.contains("forum"));
```

- [ ] **Step 2: Run the history smoke to see it fail**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-history-smoke.mjs 2>&1 | tail -4`
Expected: FAIL in S11 — `#stage` not found (null `$eval`).

- [ ] **Step 3: Markup**

Wrap the gantt and the shelf: before `<div class="gantt" id="gantt">` add `<div class="stage" id="stage">`; after the shelf's `</section>` add `</div>`. Inside the shelf, after `<div class="shelf-body" id="shelfList"></div>` add:

```html
    <div class="shelf-tip" id="shelfTip" hidden>Dra inn i en epic. Prisen vises først.</div>
```

- [ ] **Step 4: CSS**

After `.shelf-empty{...}`:

```css
  /* R15: in the forum view the shelf stands beside the chart, sticky, with the rows on two lines and the actions always shown */
  .shelf-tip{display:none;padding:4px 14px 12px;font-size:12px;color:var(--text-4)}
  body.forum .stage.with-shelf{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
  body.forum .stage.with-shelf .shelf{margin-top:0;position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto}
  body.forum .stage.with-shelf .shelf-head{position:sticky;top:0;background:var(--surface);z-index:1}
  body.forum .stage.with-shelf .shelf-row{flex-wrap:wrap;gap:3px 8px;padding:6px 8px 8px 12px}
  body.forum .stage.with-shelf .shelf-row .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  body.forum .stage.with-shelf .shelf-row .st{flex-basis:100%;white-space:normal;padding-left:22px}
  body.forum .stage.with-shelf .shelf-row .acts{opacity:1;flex-basis:100%;flex-wrap:wrap;padding-left:22px}
  body.forum .stage.with-shelf .shelf-row .acts button{font-size:11px;padding:3px 7px}
  body.forum .shelf-tip:not([hidden]){display:block}
```

- [ ] **Step 5: renderShelf**

After `shelf.hidden = !items.length && !(HOSTED && canWrite);` add:

```js
    $('stage').classList.toggle('with-shelf', !shelf.hidden);   // R15: the forum view's second column only when the shelf shows
    $('shelfTip').hidden = !(forumMode && canWrite && items.length);
```

- [ ] **Step 6: Run the smokes to see them pass, look at the screenshot**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-history-smoke.mjs 2>&1 | tail -4`; then `ui-smoke.mjs`, `hosted-smoke.mjs`, `hosted-polish-smoke.mjs`, `hosted-release-smoke.mjs`, `hosted-board-smoke.mjs`, `hosted-intake-smoke.mjs`, `theme-shots.mjs`.
Expected: `OK` for all. Read `09-forum-view.png`: the bar on top, the shelf beside the chart with the tip, no ADO, the Forum button filled.

- [ ] **Step 7: tsc, eslint, build**

Run: `NODE_OPTIONS= npx tsc --noEmit && NODE_OPTIONS= npx eslint src && NODE_OPTIONS= npx next build 2>&1 | tail -3`
Expected: clean, `Compiled successfully`.

- [ ] **Step 8: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "timeline: in the forum view the shelf stands beside the chart with its tip; the stage wrapper (R15)"
```

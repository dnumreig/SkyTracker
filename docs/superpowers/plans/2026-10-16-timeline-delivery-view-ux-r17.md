# Tidslinjen R17: «Per leveranse», the tree in the list, and the design review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** COO's business cases in Tidslinjen's list («Mer › Per leveranse»), children indented under their parent with a line,
and every proposal of the design review of 15.10 (five fixes, one shared stylesheet, one meaning per colour, a quieter chart,
wall mode, the feature editor, the notes for Brettet, Inntak, Kunder and the login page) — in one PR, one commit per task.

**Architecture:** One shared stylesheet `src/features/timeline/sky.css`, served at `/timeline/sky.css` like `epic-tools.js`,
carries the tokens, the reset with the `[hidden]` rule, the top bar, the tabs, buttons, inputs and the modal base; each page
links it and keeps only its own rules. The new view's rule is one pure function `deliveryRows` in `epic-tools.js` (vitest);
the page draws its result as virtual lanes, the way «Per person» does. Dialog accessibility is one browser helper
`wireDialogs(document)` in `epic-tools.js`, called by every page. The page work is plain HTML/CSS/JS, exercised by Playwright
smokes behind a mock API.

**Tech Stack:** plain HTML/JS pages served by Next 16 route handlers; `epic-tools.js` (CommonJS + browser globals, must equal
`epic-tools.d.ts`); vitest 4; Playwright smokes run with `NODE_OPTIONS= npx tsx <smoke>` from the worktree; axe-core from
`node_modules/axe-core/axe.min.js`; the login page is React + Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-16-planning-system-r17-delivery-view-and-design-review-design.md` (commit 2bfc4b3).

## Global Constraints

- Norwegian in the UI and stored text, English in code and commits. No Claude attribution in commits or PR text (no
  `Co-Authored-By`, no «Generated with»).
- Branch `feat/r17-delivery-view-ux` in `/Users/dnumreig/Skytale/SkyTracker-wt-epics`, cut from `origin/main` 2886287. Never
  `master`; never push (GO pushes to the fork).
- `module.exports` of `epic-tools.js` must equal `epic-tools.d.ts` (the existing test checks it); the pages call helpers as
  bare globals.
- Text a person reads is never below 12 px; chips and the sprint ruler are the only 11 px text (spec D7).
- Text contrast meets WCAG 2.2 AA 4.5:1 (light `--text-4` `#64748b`, dark `--text-4` `#5fa8d3`, amber text `#b45309`,
  primary hover `#2f5f8f`, text on `--raised` uses `--text-2`).
- Green, amber and red mean the plan's health only (spec §6).
- No change to the plan data, merge, events, history, ADO or the investor numbers.
- Smokes live in `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/`; after Task 1 every smoke reads its pages from
  `process.env.SKY_SRC || "/Users/dnumreig/Skytale/SkyTracker-wt-epics"` and serves `/timeline/sky.css`.
- The gates after every task: `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`; after Tasks 1, 7 and 12 also
  `npx next build` and every smoke.

## Review Focus

1. A reader in the forum view presses Tab: focus never lands on a write control, and Enter on a bar opens the editor
   read-only instead of moving the bar. (Task 1 smoke U3 adds the reader Tab walk; Task 7 smoke U12 the read-only editor.)
2. A delivery whose only epic was deleted after it was saved: «Per leveranse» shows the group with «henger ikke på noe
   ennå» and no parts, and nothing throws. (Task 3 vitest «a deleted key».)
3. An epic two deliveries hang on: it shows under both, each naming the other with «også i …». (Task 3 vitest «shared».)
4. Tidslinjen opened from `file://`: `sky.css` loads from next to the file, the modals stay closed, and «Per leveranse» on
   the example plan (no deliveries) shows only «Ingen leveranse». (Task 1 ui-smoke step; Task 3 ui-smoke step.)
5. A keyboard move one week to the right asks for a reason like a drag does (`startLaterWeeks: 1`), and a move in front of
   the queue marks the feature «overstyrt». (Task 1 smoke U2.)

## Execution

- Tasks 1–7 and 12 are built here, inline, in order.
- Tasks 8–11 (Brettet, Inntak, Kunder, the login page) are built by four subagents (GO 16.10: up to five at a time, on Opus 5.5)
  started after Task 1's commit (a ledgered ruling; first planned after Task 4), while Tasks 2–7 run here. Each subagent gets its own worktree and branch:
  `git -C /Users/dnumreig/Skytale/SkyTracker-wt-epics worktree add ../SkyTracker-wt-r17-<page> -b r17-<page> <task-1-sha>`,
  `ln -s ../SkyTracker-wt-epics/node_modules node_modules` inside it, runs its smoke with `SKY_SRC=<its worktree>`, touches
  only its page, its route or component, and its own smoke file, never `sky.css`, `timeline.html` or `epic-tools.js`, and
  commits once on its branch. The commits are read and cherry-picked onto `feat/r17-delivery-view-ux` here.
- The fifth subagent, if used, is one fresh reviewer of the whole branch at the end.

## Files

| File | Responsibility | Tasks |
|---|---|---|
| `src/features/timeline/sky.css` (new) | Shared tokens, reset, top bar, tabs, buttons, inputs, modal base | 1, 4, 5 |
| `src/app/timeline/sky.css/route.ts` (new) | Serves `sky.css` behind the login | 1 |
| `src/features/timeline/sky.test.ts` (new) | Static checks: every page links sky.css, has no own token block, one h1, a main, a title | 1 |
| `src/features/timeline/epic-tools.js` / `.d.ts` | `deliveryRows`, `wireDialogs` | 1, 3 |
| `src/features/timeline/epic-tools.test.ts` | `deliveryRows` cases | 3 |
| `src/app/timeline/timeline.html` | Tidslinjen | 1–7, 12 |
| `src/app/board.html` | Brettet | 1, 8 |
| `src/app/inntak/inntak.html` | Inntak | 1, 9 |
| `src/app/kunder/kunder.html` | Kunder | 1, 4, 10 |
| `src/app/login/page.tsx`, `src/app/layout.tsx`, `src/app/icon.svg` | The login page, the fonts, the favicon | 1, 11 |
| `ClaudeReports/…/build/hosted-ux-r17-smoke.mjs` (new) | U1–U14: the fixes, the tree, colour, chart, wall, editor | 1–7, 12 |
| `ClaudeReports/…/build/hosted-delivery-view-smoke.mjs` (new) | V1–V8: «Per leveranse» | 3 |
| the existing smokes | `SKY_SRC`, the sky.css route, selectors that change | 1, 3, 5, 8–10, 12 |

---

### Task 1: one shared stylesheet, the frame and the five fixes (spec §4, §5)

**Files:**
- Create: `src/features/timeline/sky.css`, `src/app/timeline/sky.css/route.ts`, `src/features/timeline/sky.test.ts`
- Modify: `src/app/timeline/timeline.html`, `src/app/board.html`, `src/app/inntak/inntak.html`, `src/app/kunder/kunder.html`
  (head, the shared rules removed, title, h1, main, «Logg ut»), `src/app/icon.svg`
- Modify: `src/features/timeline/epic-tools.js` + `epic-tools.d.ts` (`wireDialogs`)
- Modify: every smoke in `ClaudeReports/planning/roadmap-2.0/build/` and `ClaudeReports/planning/ux-review-2026-10/harness.mjs`
  (`SKY_SRC`, the sky.css route); `ui-smoke.mjs` copies `sky.css` next to `timeline.html`
- Create: `ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs` (U1–U3 here; later tasks add parts)

**Interfaces:**
- Produces: `/timeline/sky.css`; the classes `.sr-only` (visually hidden), `button.as-text` (a button that looks like text);
  `--tree` and the AA tokens; `wireDialogs(doc: Document): void` (bare global on every page); in timeline.html the bar is
  a focus stop (`tabindex=0`, `role=button`, `aria-label`) and `mayEdit()` = `!HOSTED || canWrite`.

- [ ] **Step 1: Write the failing static test** `src/features/timeline/sky.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const PAGES: [string, string][] = [
  ["src/app/timeline/timeline.html", "Tidslinjen"], ["src/app/board.html", "Brettet"],
  ["src/app/inntak/inntak.html", "Inntak"], ["src/app/kunder/kunder.html", "Kunder"],
];
const css = read("src/features/timeline/sky.css");

describe("R17: one shared stylesheet", () => {
  it("carries the hidden rule, the note style, the focus ring and the AA tokens", () => {
    expect(css).toContain("[hidden]{display:none !important}");
    expect(css).toContain(".md{font-size:12px;color:var(--text-3)}");
    expect(css).toMatch(/--text-4:#64748b;/);
    expect(css).toMatch(/--text-4:#5fa8d3;/);
    expect(css).toMatch(/--warn:#b45309;/);
    expect(css).toMatch(/--accent-hover:#2f5f8f;/);
    expect(css).toContain(".sr-only{");
    expect(css).toContain("button.as-text{");
  });
  for (const [file, name] of PAGES) {
    it(`${name}: links sky.css, keeps no token block of its own, one h1, a main, the title, Logg ut, the icon`, () => {
      const html = read(file);
      expect(html).toMatch(/timeline\/sky\.css/);
      expect(html).not.toMatch(/--bg:#f8fafc/);                       // the tokens live in sky.css only
      expect(html).not.toMatch(/\*\{margin:0;padding:0;box-sizing:border-box\}/);
      expect(html.match(/<h1[\s>]/g) || []).toHaveLength(1);
      expect(html).toMatch(/<main[\s>]/);
      expect(html).toContain(`<title>${name} – SkyTracker</title>`);
      expect(html).toMatch(/href="\/api\/auth\/signout"/);
      expect(html).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml">');
    });
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/timeline/sky.test.ts`
Expected: FAIL (`ENOENT … sky.css`).

- [ ] **Step 3: Create `src/features/timeline/sky.css`.** The rules below are the four pages' common rules (they are
identical in all four today, `timeline.html:12–137` and the copies «kept in step by hand»), with the R17 changes marked.

```css
/* sky.css: the tokens and controls the four plain pages share (Tidslinjen, Brettet, Inntak, Kunder). Served at
   /timeline/sky.css behind the login (src/app/timeline/sky.css/route.ts); a page links it first and keeps only its own
   rules. Text colours meet WCAG 2.2 AA (4.5:1); see the R17 spec §4. */
:root{
  color-scheme:light;
  --bg:#f8fafc; --surface:#ffffff; --raised:#f1f5f9; --input-bg:#ffffff;
  --line:#cbd5e1; --line-soft:#e2e8f0;
  --text:#0d123e; --text-hover:#0d123e; --text-2:#475569; --text-3:#64748b;
  --text-4:#64748b;          /* R17: slate-500, 4.76:1 on white (was slate-400, 2.56:1) */
  --accent:#3b76b0;
  --accent-hover:#2f5f8f;    /* R17: the primary button darkens on hover, 6.66:1 with white (was ocean-6, 3.30:1) */
  --accent-text:#3b76b0; --accent-soft:rgba(59,118,176,.2);
  --danger:#ef4444; --danger-hover:#b91c1c;
  --warn:#b45309;            /* R17: amber-700 for amber text and badges, 5.02:1 both ways (was amber-500, 2.15:1) */
  --ok-bg:#dcfce7; --ok-fg:#15803d; --warn-bg:#fef3c7; --warn-fg:#b45309; --bad-bg:#fee2e2; --bad-fg:#b91c1c;
  --badge-bg:#f1f5f9; --badge-fg:#475569; --ado-bg:#e0f2fe; --ado-fg:#0369a1;
  --tree:#94a3b8;            /* R17: the line from a parent into its children in the list */
  --backdrop:rgba(0,0,0,.4);
  --shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1);
}
@media (prefers-color-scheme: dark){
  :root{
    color-scheme:dark;
    --bg:#0d123e; --surface:#1e2455; --raised:#212d63; --input-bg:#212d63;
    --line:#294285; --line-soft:#294285;
    --text:#ffffff; --text-hover:#71c4df; --text-2:#a5d6e6; --text-3:#a5d6e6;
    --text-4:#5fa8d3;        /* R17: 5.58:1 on --surface, 4.96:1 on --raised (was 4.42:1) */
    --accent-text:#71c4df; --accent-soft:rgba(59,118,176,.35);
    --danger:#f87171; --danger-hover:#fca5a5; --warn:#fbbf24;
    --ok-bg:rgba(34,197,94,.2); --ok-fg:#86efac; --warn-bg:rgba(245,158,11,.2); --warn-fg:#fcd34d; --bad-bg:rgba(239,68,68,.2); --bad-fg:#fca5a5;
    --badge-bg:#294285; --badge-fg:#cbd5e1; --ado-bg:#294285; --ado-fg:#a5d6e6;
    --tree:#4e94c4;
    --backdrop:rgba(0,0,0,.6);
  }
}
*{margin:0;padding:0;box-sizing:border-box}
[hidden]{display:none !important}   /* R17: an author display rule (button, .ed-row) never beats the hidden attribute */
body{background:var(--bg);color:var(--text);font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* the top bar; the tabs have one size and the active one is underlined, so nothing moves between pages (R17) */
.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 24px;background:var(--surface);border-bottom:1px solid var(--line-soft)}
.tb-left,.tb-right{display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-width:0}
.tabs{display:flex;gap:2px;align-items:center}
.tabs .tab{font-size:15px;font-weight:500;color:var(--text-3);text-decoration:none;padding:6px 12px;white-space:nowrap;box-shadow:inset 0 -2px 0 transparent}
.tabs .tab:hover{color:var(--text);box-shadow:inset 0 -2px 0 var(--line)}
.tabs .tab.on{color:var(--text);font-weight:600;box-shadow:inset 0 -2px 0 var(--accent)}
.whoami{font-size:12px;color:var(--text-3)}
.ro-tag{font-size:12px;font-weight:500;color:var(--warn)}
.save-note{font-size:12px;color:var(--text-3);min-width:120px;text-align:right}
.wrap{padding:16px 24px 40px}
.hint{font-size:12px;color:var(--text-3);max-width:90ch}
.hint b{color:var(--text);font-weight:600}
p.hint{position:relative;padding-right:26px}
p.hint .x{position:absolute;right:0;top:-2px}
.md{font-size:12px;color:var(--text-3)}

/* buttons */
button,.btn{font:inherit;font-size:12px;font-weight:500;line-height:1.3;padding:5px 9px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text-3);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;transition:color .15s ease,background-color .15s ease,border-color .15s ease}
button:hover,.btn:hover{color:var(--text-hover);border-color:var(--text-4)}
button:disabled{opacity:.5;cursor:default;pointer-events:none}
button.primary,#dlgYes{background:var(--accent);border-color:var(--accent);color:#fff}
button.primary:hover,#dlgYes:hover{background:var(--accent-hover);border-color:var(--accent-hover);color:#fff}
button.ghost{background:var(--surface)}
button.text{border-color:transparent;background:transparent}
button.text:hover{border-color:transparent;background:var(--raised)}
button.danger-ghost{border-color:transparent;background:transparent;color:var(--danger)}
button.danger-ghost:hover{color:var(--danger-hover);background:var(--bad-bg);border-color:transparent}
button.x{border:none;background:none;padding:0 2px;font-size:16px;line-height:1;color:var(--text-4)}
button.x:hover{color:var(--text-2);background:none}
button.as-text{display:block;border:0;background:none;padding:0;margin:0;border-radius:0;color:inherit;font:inherit;text-align:left;line-height:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}   /* R17: a name that is a real button */
button.as-text:hover{background:none;color:inherit;text-decoration:underline}
#dlgYes.danger{background:var(--danger);border-color:var(--danger)}
#dlgYes.danger:hover{filter:brightness(1.1)}
.btn.logout{font-size:12px}

/* modals */
.modal-back{display:none;position:fixed;inset:0;z-index:60;background:var(--backdrop);align-items:center;justify-content:center;padding:24px}
.modal-back.open{display:flex}
#dlgBack{z-index:80}
#reasonBack{z-index:70}
.modal{background:var(--surface);border:1px solid var(--line);border-radius:8px;width:min(600px,100%);max-height:90vh;display:flex;flex-direction:column;box-shadow:var(--shadow)}
.modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 20px 12px}
.modal-head h2{font-size:16px;font-weight:600;color:var(--text)}
.modal-head .md{margin-top:2px}
.modal-body{overflow:auto;padding:0}
.modal-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 20px;border-top:1px solid var(--line-soft);flex-wrap:wrap}
.modal-foot .btns{display:flex;gap:8px;align-items:center}
.modal-foot button{font-size:13px;padding:6px 12px}
.ed-body{padding:4px 20px 16px;display:grid;gap:14px}
.ed-field > span{display:block;font-size:12px;font-weight:500;color:var(--text-2);margin-bottom:4px}
.ed-field input[type=text],.ed-field input[type=number],.ed-field input[type=date],.ed-field select,.ed-field textarea,.dlg-body input{width:100%;font:inherit;font-size:14px;padding:6px 12px;border:1px solid var(--line);border-radius:4px;background:var(--input-bg);color:var(--text)}
.ed-field input:focus,.ed-field select:focus,.ed-field textarea:focus,.dlg-body input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.ed-row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.ed-row .ed-field{flex:1;min-width:140px}
.ed-check{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--text);cursor:pointer}
.ed-check input{accent-color:var(--accent)}
```

- [ ] **Step 4: Create the route** `src/app/timeline/sky.css/route.ts` (the same shape as `src/app/timeline/epic-tools.js/route.ts`):

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Serves the shared stylesheet of the four plain pages (R17). The pages link it as timeline/sky.css, next to
// epic-tools.js, so one copy of the tokens and controls exists instead of four kept in step by hand.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) redirect("/login");
  const css = readFileSync(path.join(process.cwd(), "src/features/timeline/sky.css"), "utf8");
  return new Response(css, { headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" } });
}
```

- [ ] **Step 5: Link it from the four pages and remove what it now carries.**
  - Each `<head>`: after the viewport meta, `<title>X – SkyTracker</title>` (Tidslinjen, Brettet, Inntak, Kunder) and
    `<link rel="icon" href="/icon.svg" type="image/svg+xml">`. Brettet, Inntak, Kunder: `<link rel="stylesheet" href="timeline/sky.css">`.
    Tidslinjen (also opened from `file://`):

    ```html
    <link rel="stylesheet" href="timeline/sky.css">
    <script>if(location.protocol === 'file:') document.write('<link rel="stylesheet" href="sky.css">');</script>
    ```
  - In each page's `<style>`, delete every rule that is in `sky.css` (the `:root` token blocks for the shared tokens, the
    reset, `body`, `.topbar`, `.tb-left`, `.tabs …`, `.whoami`, `.ro-tag`, `.save-note`, `.wrap`, `.hint`, `p.hint`, `.md`,
    the button rules, `.modal-back`, `.modal-back.open`, `#dlgBack`, `#reasonBack`, `.modal-head …`, `.modal-body`,
    `.modal-foot …`, `.ed-body`, `.ed-field …` inputs and focus, `.ed-row …`, `.ed-check …`, `[hidden]`). Keep a page's
    differences as overrides right after the comment `/* this page */`:
    - timeline.html: its own tokens stay in a `:root{…}` and its dark block (`--ok --warn-dot --bad --neutral --likely --late
      --disc-* --goal --today --release* --pace-* --dep --tip-* --month-w --row-h --lane-h --label-w`); `.modal{width:min(560px,100%)}`;
      `.hint{max-width:90ch;position:relative;padding-right:26px;margin-top:8px}`, `.hint .x{position:absolute;right:0;top:-2px}`;
      `.ed-check{padding-bottom:8px}`; `.count{…;background:var(--warn);color:var(--surface);…}` (white on amber-700 in light,
      ink on amber-400 in dark).
    - board.html: `.modal{width:min(620px,100%)}`, `.hint{max-width:100ch;margin-bottom:12px}`, `p.hint .x{border:none;background:none;padding:0 2px;font-size:14px;line-height:1;color:var(--text-4);cursor:pointer}`.
    - inntak.html: `.modal{width:min(620px,100%)}`, `.wrap{max-width:1240px}` (R17: the width Kunder has), `#forumLabel` keeps its
      own input rule.
    - kunder.html: `.modal{width:min(640px,100%)}`, `.wrap{max-width:1240px}`, `.hint{max-width:100ch}`, `.ed-check{color:var(--text-2);cursor:default}`.
  - Contrast on text over the raised grey (spec §4.4): timeline.html `.lane-label .lm{…;color:var(--text-2)}`;
    board.html `.col h2{…;color:var(--text-2)}`; kunder.html `.lines thead th,.epics thead th{…;color:var(--text-2)}`.
  - Landmarks and the heading: Brettet, Inntak, Kunder change `<div class="wrap">…</div>` (the element right after
    `</header>` and its matching close) to `<main class="wrap">…</main>`. Every page puts `<h1 class="sr-only">Tidslinjen</h1>`
    (Brettet, Inntak, Kunder) as the first child of its `main`.
  - «Logg ut» at the right end of every top bar: `<a class="btn logout" id="logoutLink" href="/api/auth/signout" title="Logg ut av SkyTracker">Logg ut</a>`
    as the last child of `.tb-right` (Brettet's existing link moves there and gets the class and id). Tidslinjen hides it from
    `file://` in its boot: `if(!HOSTED) $('logoutLink').hidden = true;`.
  - `src/app/icon.svg`: the mark in ink, white in dark:

    ```svg
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <style>.m{stroke:#0d123e;fill:#0d123e}@media (prefers-color-scheme:dark){.m{stroke:#ffffff;fill:#ffffff}}</style>
      <rect class="m" x="3" y="3" width="26" height="26" fill="none" style="fill:none" stroke-width="2.5"/>
      <path class="m" d="M 10 22 L 22 22 L 22 10 Z" style="stroke:none"/>
    </svg>
    ```

- [ ] **Step 6: Run the static test**

Run: `npx vitest run src/features/timeline/sky.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Let every smoke read pages from `SKY_SRC` and serve the stylesheet.** One-off script run from the worktree:

```bash
node -e '
const fs = require("fs"), path = require("path");
const dir = process.env.HOME + "/Skytale/ClaudeReports/planning/roadmap-2.0/build";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs")).map((f) => path.join(dir, f))
  .concat([process.env.HOME + "/Skytale/ClaudeReports/planning/ux-review-2026-10/harness.mjs"]);
for (const f of files) {
  let s = fs.readFileSync(f, "utf8"), n = s;
  n = n.replace(/const SRC = "\/Users\/dnumreig\/Skytale\/SkyTracker-wt-epics";/, "const SRC = process.env.SKY_SRC || \"/Users/dnumreig/Skytale/SkyTracker-wt-epics\";");
  n = n.replace(/(\n([ \t]*)if \(req\.method === "GET" && url\.pathname === "\/timeline\/epic-tools\.js"\)[^\n]*)/, (m, line, ind) =>
    line + "\n" + ind + "if (req.method === \"GET\" && url.pathname === \"/timeline/sky.css\") return send(200, src(\"src/features/timeline/sky.css\"), \"text/css; charset=utf-8\");");
  if (n !== s) { fs.writeFileSync(f, n); console.log("patched", path.basename(f)); }
}'
```

Then `ui-smoke.mjs` copies the stylesheet next to the page: after the `copyFileSync(… "/epic-tools.js")` line add
`copyFileSync(SRC + "/src/features/timeline/sky.css", DIR + "/sky.css");`. Check each patched file once with
`grep -n "sky.css\|SKY_SRC" <file>`; `harness.mjs` uses its own `send`/path helpers — make its sky.css line match the line
that serves epic-tools.js there.

- [ ] **Step 8: Write the failing smoke** `hosted-ux-r17-smoke.mjs` (U1–U3):

```js
// hosted-ux-r17-smoke.mjs: R17's fixes and design moves on the four pages, behind the design review's mock API (the app's
// own merge, history, compare and investor modules over the review's sample plan). U1–U14; ONLY=U1,U4 runs some parts.
// Run from the worktree:  NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { startServer } from "/Users/dnumreig/Skytale/ClaudeReports/planning/ux-review-2026-10/harness.mjs";
const require = createRequire("/Users/dnumreig/ptt-e2e/package.json");
const { chromium } = require("playwright");
const SRC = process.env.SKY_SRC || "/Users/dnumreig/Skytale/SkyTracker-wt-epics";
const AXE = readFileSync("/Users/dnumreig/Skytale/SkyTracker-wt-epics/node_modules/axe-core/axe.min.js", "utf8");
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); };
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const part = (id) => !ONLY.length || ONLY.includes(id);
const READY = { "/timeline": ".lane-label", "/": ".card", "/inntak": ".wish", "/kunder": "table.lines" };
const browser = await chromium.launch();
const srv = await startServer({ scenario: "rich" });
async function open(path, o = {}) {
  srv.api.role(o.role || "writer");
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1440, height: 900 }, colorScheme: o.scheme || "light", locale: "nb-NO", timezoneId: "Europe/Oslo" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(srv.base + path); await page.waitForSelector(o.ready || READY[path] || "body"); await page.waitForTimeout(700);
  return { ctx, page, errors };
}
function hiddenButShown() {   // elements with the hidden attribute that still render (the review's probe)
  return [...document.querySelectorAll("[hidden]")].filter((e) => {
    if (getComputedStyle(e).display === "none") return false;
    for (let p = e.parentElement; p; p = p.parentElement) if (getComputedStyle(p).display === "none") return false;
    const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }).map((e) => "#" + (e.id || "?") + "." + e.className);
}

if (part("U1")) {
  for (const role of ["reader", "writer"]) for (const path of Object.keys(READY)) {
    const { ctx, page } = await open(path, { role });
    const shown = await page.evaluate(hiddenButShown);
    assert(!shown.length, `U1: ${role} ${path}: nothing hidden still renders: ${shown.join(" | ")}`);
    if (path === "/timeline") {
      await page.click('.task-label[data-id="kapasitet"] .t'); await page.waitForSelector("#editorBack.open");
      const inEditor = await page.evaluate(hiddenButShown);
      assert(!inEditor.length, `U1: ${role}: the editor shows no hidden row: ${inEditor.join(" | ")}`);
      const md = await page.$eval("#edProgNote", (e) => { const s = getComputedStyle(e); return s.fontSize + " " + s.color; });
      assert(md === "12px rgb(100, 116, 139)", "U1: a note is 12 px in --text-3: " + md);
      await page.keyboard.press("Escape");
      if (role === "reader") {
        const adds = await page.evaluate(() => ["addEpicBtn", "addReleaseBtn"].filter((id) => document.getElementById(id).offsetParent).concat([...document.querySelectorAll(".lane-label .add-feature")].filter((b) => b.offsetParent).map(() => "＋")));
        assert(!adds.length, "U1: a reader gets no add buttons: " + adds);
      }
    }
    await ctx.close();
  }
  console.log("U1 OK: the hidden rule on every page, readers without add buttons, notes at 12 px");
}

if (part("U2")) {
  for (const path of Object.keys(READY)) {
    const { ctx, page } = await open(path);
    const v = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return ["--text-4", "--warn", "--accent-hover"].map((k) => s.getPropertyValue(k).trim()).join(); });
    assert(v === "#64748b,#b45309,#2f5f8f", `U2: ${path} resolves the AA tokens: ${v}`);
    await ctx.close();
  }
  const { ctx, page } = await open("/timeline");
  let reached = false;
  for (let i = 0; i < 90 && !reached; i++) { await page.keyboard.press("Tab"); reached = await page.evaluate(() => document.activeElement.matches(".task-label button.t")); }
  assert(reached, "U2: Tab reaches a feature name");
  await page.keyboard.press("Enter"); await page.waitForSelector("#editorBack.open");
  await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("#editorBack.open"));
  assert(await page.evaluate(() => document.activeElement.matches(".task-label button.t")), "U2: focus returns to the name");
  const id = "kapasitet", sel = `.bar[data-id="${id}"]`;
  const start0 = srv.api.stored().data.tasks.find((t) => t.id === id).start;
  const left0 = await page.$eval(sel, (b) => b.offsetLeft);
  await page.focus(sel); await page.keyboard.press("ArrowRight");
  await page.waitForSelector("#reasonBack.open");                     // one week later asks why, like a drag (startLaterWeeks: 1)
  await page.click('#reasonCodes button[data-code="kapasitet"]'); await page.click("#reasonSave");
  await page.waitForFunction((s) => document.querySelector(s).offsetLeft > 0, sel);
  const left1 = await page.$eval(sel, (b) => b.offsetLeft);
  assert(Math.abs(left1 - left0 - 24) < 2, `U2: → moves the bar one week (24 px): ${left0} → ${left1}`);
  assert(await page.evaluate((i) => document.activeElement.dataset.id === i, id), "U2: the bar keeps focus after the move");
  for (let i = 0; i < 40 && srv.api.stored().data.tasks.find((t) => t.id === id).start === start0; i++) await page.waitForTimeout(150);
  assert(Math.abs(srv.api.stored().data.tasks.find((t) => t.id === id).start - start0 - 0.25) < 1e-9, "U2: the move is saved, one week later");
  const r = await open("/timeline", { role: "reader" });
  const rl0 = await r.page.$eval(sel, (b) => b.offsetLeft);
  await r.page.focus(sel); await r.page.keyboard.press("ArrowRight"); await r.page.waitForTimeout(300);
  assert((await r.page.$eval(sel, (b) => b.offsetLeft)) === rl0 && !(await r.page.$("#reasonBack.open")), "U2: a reader's arrow key moves nothing");
  await r.ctx.close(); await ctx.close();
  console.log("U2 OK: the AA tokens on every page, Tab to a feature, Enter opens it, → moves a week and asks why");
}

if (part("U3")) {
  const { ctx, page } = await open("/timeline");
  await page.click("#addReleaseBtn"); await page.waitForSelector("#relBack.open");
  const d = await page.$eval("#relBack .modal", (m) => [m.getAttribute("role"), m.getAttribute("aria-modal"), !!document.getElementById(m.getAttribute("aria-labelledby") || "-")].join());
  assert(d === "dialog,true,true", "U3: a modal is a labelled dialog: " + d);
  for (let i = 0; i < 25; i++) { await page.keyboard.press("Tab"); assert(await page.evaluate(() => document.querySelector("#relBack .modal").contains(document.activeElement)), "U3: Tab stays in the modal (" + i + ")"); }
  await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("#relBack.open"));
  assert(await page.evaluate(() => document.activeElement.id === "addReleaseBtn"), "U3: focus returns to «＋ Release»");
  await ctx.close();
  const r = await open("/timeline", { role: "reader", vp: { width: 1920, height: 1080 } });   // readers land in the forum view
  const seen = new Set();
  for (let i = 0; i < 140; i++) { await r.page.keyboard.press("Tab"); seen.add(await r.page.evaluate(() => document.activeElement.id)); }
  for (const id of ["addEpicBtn", "addReleaseBtn", "registerBtn", "baselineBtn", "importBtn"]) assert(!seen.has(id), "U3: a reader never tabs to #" + id);
  await r.ctx.close();
  for (const scheme of ["light", "dark"]) for (const path of Object.keys(READY)) {
    const { ctx, page } = await open(path, { scheme });
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await axe.run({ exclude: [[".today .tl"]] }, { runOnly: ["color-contrast", "landmark-one-main", "page-has-heading-one", "select-name", "label", "scrollable-region-focusable", "aria-dialog-name"] }))
      .violations.map((x) => x.id + "×" + x.nodes.length + " " + x.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")));
    assert(!v.length, `U3: axe ${scheme} ${path}: ${v.join(" ;; ")}`);
    await ctx.close();
  }
  console.log("U3 OK: dialogs hold and return focus, a reader never tabs to a write control, axe is clean (today's label waits for Task 4)");
}

await browser.close(); await srv.close();
console.log("ALL OK");
```

(The reason dialog is `#reasonBack` with its codes as `#reasonCodes button[data-code]` and the save button `#reasonSave`.)

- [ ] **Step 9: Run it to verify it fails**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs`
Expected: FAIL at U1 (a reader still gets «＋ Epic» and «＋ Release»; the hidden rule itself already holds once sky.css is linked).

- [ ] **Step 10: Readers' add buttons (fix 2).** In `initServerPlan`'s role block (after `$('mixField').hidden = !canWrite;`)
and in `pushPlan`'s 403 branch (after `$('importBtn').hidden = true;`):

```js
      $('addEpicBtn').hidden = !canWrite;      // R17: a reader's main button created nothing that lasts
      $('addReleaseBtn').hidden = !canWrite;
```

(the 403 branch sets both to `true`). In `render()`, the epic row's «＋»: `add.hidden = !!lane.virtual || !mayEdit();`, with
`const mayEdit = () => !HOSTED || canWrite;` declared next to `canWrite`'s `let`.

- [ ] **Step 11: Names and bars from the keyboard (fix 5).** In `render()`:

```js
      const ln = el('button', 'ln as-text', lane.name);   // R17: a real button, so Tab reaches it and Enter opens it
      ln.type = 'button';
```
```js
        const tt = el('button', 't as-text', t.label);
        tt.type = 'button';
```
and on the bar, after `bar.dataset.id = t.id;`:
```js
        bar.tabIndex = 0; bar.setAttribute('role', 'button');
```
In `position(t)`, after `bar.title = …`: `bar.setAttribute('aria-label', t.label + ', ' + rangeText(t));`.
CSS (timeline.html): `.lane-label .ln{…}` and `.task-label .t{…}` keep their size and weight; add
`.lane-label .ln,.task-label .t{color:var(--text)} .task-label .t{max-width:calc(100% - 60px)}` (the `padding-right:60px`
on `.t` becomes this max-width, since a block button's padding would grow its hit area).
The release segments in the axis and the delivery segments: `d.tabIndex = 0; d.setAttribute('role', 'button');` and
`seg.tabIndex = 0; seg.setAttribute('role', 'button');`.

One keydown handler for the chart, after `chart.addEventListener('pointercancel', endDrag);`:

```js
  function applyQueuePin(t, floor){   // in front of the queue = overstyrt with intent (a drag and a key do the same)
    if(t.kind !== 'estimate' || t.lane === BACKLOG || t.state === 'levert' || floor === null) return false;
    if(t.start < floor - 1e-9 && !t.pinned){ t.pinned = true; touch(t, 'meta'); return true; }
    return false;
  }
  chart.addEventListener('keydown', e => {   // R17: a bar from the keyboard: Enter opens it, ← / → moves it a week (writers, epic view)
    const seg = e.target.closest && e.target.closest('.axis .release, .axis .delivery .seg');
    if(seg && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); seg.click(); return; }
    const bar = e.target.closest && e.target.closest('.bar');
    if(!bar || bar.classList.contains('ghost')) return;
    const t = getTask(bar.dataset.id);
    if(!t) return;
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); if(linkSource){ completeLink(t.id); return; } openEditor(t.id); return; }
    if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if(!mayEdit() || viewMode !== 'epic' || t.state === 'levert') return;
    e.preventDefault();
    const d = (e.key === 'ArrowRight' ? 1 : -1) * WEEK;
    const s = Math.max(VIEW_FROM, Math.min(N_MONTHS - (t.end - t.start), t.start + d));
    if(Math.abs(s - t.start) < 1e-9) return;
    const before = { t, start0: t.start, likely0: t.endLikely, end0: t.end, moved: true };
    const floor = queueFloor(state, t.id).floor;
    shiftTask(t, s - t.start); touch(t, 'tid');
    applyQueuePin(t, floor);
    pushQueue();
    const lines = dragReasonLines(before);
    if(lines.length) askReason(lines);
    save(); render();
    const nb = chart.querySelector('.bar[data-id="' + CSS.escape(t.id) + '"]');
    if(nb) nb.focus();
  });
```
In the drag's `pointermove`, replace the pin block's first condition with the same rule (`drag.pinnedByDrag` stays, since a
drag can be pulled back behind the floor before it ends). `viewMode` is introduced in Task 3; until then use
`!personMode` in place of `viewMode === 'epic'` (Task 3 renames it).

The chart scroller and the compare control: `<div class="chart-scroll" id="chartScroll" tabindex="0" aria-label="Tidslinjen, rull sideveis">`
and `<select id="cmpSelect" aria-label="Sammenlign med et tidligere punkt" …>`.

- [ ] **Step 12: Dialogs (fix 5).** In `epic-tools.js`, before the export block:

```js
/* ---------- R17: modals and drawers as dialogs (browser only; every page calls it once at boot) ---------- */
/** Role, aria-modal and a label on every `.modal-back .modal` and `aside.drawer`; focus moves in when one opens, Tab stays
 *  inside a modal, focus returns to what opened it when it closes. A modal opens with the class «open», a drawer by losing «hidden». */
function wireDialogs(doc) {
  const SEL = ".modal-back, aside.drawer";
  const isModal = (b) => b.classList.contains("modal-back");
  const isOpen = (b) => (isModal(b) ? b.classList.contains("open") : !b.hidden);
  const box = (b) => (isModal(b) ? b.querySelector(".modal") || b : b);
  const focusables = (b) => [...box(b).querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled && x.offsetParent !== null);
  const z = (b) => parseInt(getComputedStyle(b).zIndex, 10) || 0;
  const topModal = () => [...doc.querySelectorAll(".modal-back.open")].sort((a, b) => z(b) - z(a))[0] || null;
  doc.querySelectorAll(SEL).forEach((b, i) => {
    const d = box(b), h = d.querySelector("h2");
    d.setAttribute("role", "dialog");
    if (isModal(b)) d.setAttribute("aria-modal", "true");
    if (h) { if (!h.id) h.id = (b.id || "dialog" + i) + "Title"; d.setAttribute("aria-labelledby", h.id); }
  });
  const openers = new Map();
  new MutationObserver((list) => list.forEach((m) => {
    const b = m.target;
    if (!b.matches || !b.matches(SEL)) return;
    if (isOpen(b) && !openers.has(b)) {
      openers.set(b, doc.activeElement);
      setTimeout(() => { if (isOpen(b) && !box(b).contains(doc.activeElement)) { const f = focusables(b)[0]; if (f) f.focus(); } }, 30);
    } else if (!isOpen(b) && openers.has(b)) {
      let o = openers.get(b); openers.delete(b);
      if (o && !o.isConnected && o.dataset && o.dataset.id) o = doc.querySelector("[data-id=\"" + CSS.escape(o.dataset.id) + "\"]." + o.classList[0]);
      if (o && o.isConnected && typeof o.focus === "function" && !topModal()) o.focus();
    }
  })).observe(doc.body, { subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  doc.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const b = topModal();
    if (!b) return;
    const f = focusables(b);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], at = doc.activeElement;
    if (!box(b).contains(at)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  });
}
```

Add `wireDialogs` to `module.exports` and `export declare function wireDialogs(doc: Document): void;` to `epic-tools.d.ts`.
Call it once at boot on each page: timeline.html right after `$('navTabs').innerHTML = …`; board.html, inntak.html and
kunder.html right after their own `navTabsHtml(...)` line: `wireDialogs(document);`.

- [ ] **Step 13: Run the smoke, then every smoke and the gates**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs`
Expected: `U1 OK`, `U2 OK`, `U3 OK`, `ALL OK`. When U3's axe lists `color-contrast` nodes, fix each at its rule (the
token, or `--text-2` on raised grey) and run again — that list is fix 4's remainder.
Then: `npx vitest run && npx tsc --noEmit && npx eslint src && npx next build`, and each existing smoke
(`for s in hosted-smoke hosted-history-smoke hosted-polish-smoke hosted-release-smoke hosted-board-smoke hosted-intake-smoke hosted-deliveries-smoke ui-smoke; do NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/$s.mjs || break; done`).
Expected: all pass. The R14 tab assertions that read `font-size:18px` (if any) change to the underline.

- [ ] **Step 14: Commit**

```bash
git add src/features/timeline/sky.css src/app/timeline/sky.css/route.ts src/features/timeline/sky.test.ts src/features/timeline/epic-tools.js src/features/timeline/epic-tools.d.ts src/app/timeline/timeline.html src/app/board.html src/app/inntak/inntak.html src/app/kunder/kunder.html src/app/icon.svg
git commit -m "Tidslinjen, Brettet, Inntak, Kunder: one shared stylesheet and the five fixes from the design review (R17)"
```

### Task 2: the tree in the list (spec §3)

**Files:**
- Modify: `src/app/timeline/timeline.html` (CSS after the `.grip` block; `markTree()` and its call in `render()`)
- Test: `hosted-ux-r17-smoke.mjs` (U4)

**Interfaces:**
- Consumes: `--tree` from sky.css (Task 1).
- Produces: classes `has-kids` (a parent with children) and `kid-last` (a group's last child) on the list rows; every later
  view that appends `.lane-label` / `.task-label` rows gets the tree by calling `markTree()` at the end of `render()`.

- [ ] **Step 1: Write the failing smoke part** (append to `hosted-ux-r17-smoke.mjs` before the final `await browser.close()`):

```js
if (part("U4")) {
  for (const person of [false, true]) {
    const { ctx, page } = await open("/timeline");
    if (person) { await page.evaluate(() => { document.getElementById("moreMenu").open = true; }); await page.click("#personBtn"); await page.waitForTimeout(300); }
    const t = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#labels > .lane-label, #labels > .task-label")], bad = [];
      rows.forEach((r, i) => {
        const kid = r.classList.contains("task-label"), next = rows[i + 1], nextKid = !!next && next.classList.contains("task-label");
        if (!kid && nextKid !== r.classList.contains("has-kids")) bad.push("has-kids " + r.dataset.key);
        if (kid && !nextKid !== r.classList.contains("kid-last")) bad.push("kid-last " + r.dataset.id);
      });
      const k = document.querySelector("#labels > .task-label");
      return { bad, pad: getComputedStyle(k).paddingLeft, trunk: getComputedStyle(k, "::before").borderLeftWidth, elbow: getComputedStyle(k, "::after").width };
    });
    assert(!t.bad.length, "U4: the tree classes: " + t.bad.join(", "));
    assert(t.pad === "44px" && t.trunk === "1px" && t.elbow === "12px", "U4: indent 44 px, a 1 px trunk, a 12 px elbow: " + JSON.stringify(t));
    await ctx.close();
  }
  console.log("U4 OK: children indented under their parent with a line, in the epic view and per person");
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `ONLY=U4 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs`
Expected: FAIL «U4: the tree classes: has-kids samtaler, …».

- [ ] **Step 3: The CSS.** Replace `.task-label{padding-left:24px}` (after the `.grip` rules) with:

```css
  /* R17: the tree: a child sits one step in from its parent, with a line from the parent into each child (GO 16.10) */
  .task-label{padding-left:44px}
  .task-label::before{content:"";position:absolute;left:25px;top:0;bottom:0;border-left:1px solid var(--tree);pointer-events:none}
  .task-label::after{content:"";position:absolute;left:25px;top:calc(50% - 8px);width:12px;border-top:1px solid var(--tree);pointer-events:none}
  .task-label.kid-last::before{bottom:auto;height:calc(50% - 8px)}
  .lane-label.has-kids::after{content:"";position:absolute;left:25px;bottom:0;height:7px;border-left:1px solid var(--tree);pointer-events:none}
```

- [ ] **Step 4: The class pass.** After `render()`'s rows are appended (right before `// piler (sist = tegnes øverst)`):

```js
    markTree();
```
and the function next to `render()`:
```js
  function markTree(){   // R17: a parent with children gets the stub under its name; each group's last child stops the trunk
    const rows = [...labels.children].filter(r => r.classList.contains('lane-label') || r.classList.contains('task-label'));
    rows.forEach((r, i) => {
      const kid = r.classList.contains('task-label'), next = rows[i + 1], nextKid = !!next && next.classList.contains('task-label');
      r.classList.toggle('has-kids', !kid && nextKid);
      r.classList.toggle('kid-last', kid && !nextKid);
    });
  }
```

- [ ] **Step 5: Run U4, then U1–U3 again**

Run: `ONLY=U1,U2,U3,U4 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs`
Expected: `U1 OK` … `U4 OK`, `ALL OK`.

- [ ] **Step 6: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "Tidslinjen: children indented under their parent with a line from the parent, in every view of the list (R17)"
```

### Task 3: «Per leveranse» (spec §2)

**Files:**
- Modify: `src/features/timeline/epic-tools.js` (`deliveryRows` after `deliveryInvestor`; the export list), `epic-tools.d.ts`
- Test: `src/features/timeline/epic-tools.test.ts` (import list; a new describe at the end)
- Modify: `src/app/timeline/timeline.html` (the Mer button, CSS, `viewMode` replacing `personMode`, the corner,
  `renderDeliveryView()`, the band skipped in this view, the forum rule, the help sentence)
- Create: `ClaudeReports/planning/roadmap-2.0/build/hosted-delivery-view-smoke.mjs` (V1–V8); modify `ui-smoke.mjs` (one step)

**Interfaces:**
- Consumes: `deliverySegments`, `deliveryParts`, `deliveryStatus`, `releaseSegments`, `epicStatus`, `epicWindowText` (R16, R10).
- Produces: `deliveryRows(plan, todayDay) → { groups: DeliveryGroup[], loose: DeliveryEpicPart[] }` (types below);
  in the page `viewMode` (`'epic' | 'person' | 'leveranse'`), `setView(v, remember)`, `#deliveryViewBtn`, `sk.view`.

- [ ] **Step 1: Write the failing tests.** Add `deliveryRows` to the import list of `epic-tools.test.ts`, then append:

```ts
describe("R17: «Per leveranse», the deliveries with what they hang on", () => {
  const D = (y: number, m: number, d: number) => dateToUnit(new Date(y, m - 1, d));
  const TODAY = "2026-10-16";
  const del = (over: Record<string, unknown>): Delivery => ({ key: "d1", name: "Skytale 2.0", customers: [], allCustomers: true, promisedDate: "2026-11-30", epics: [], releases: [], ...over }) as unknown as Delivery;
  const f = (id: string, lane: string, start: number, likely: number, end: number, over: Partial<PlanTask> = {}): PlanTask =>
    ({ id, lane, label: id.toUpperCase(), kind: "estimate", start, endLikely: likely, end, deps: [], fv: {}, state: "aktiv", ...over }) as PlanTask;
  const base = (deliveries: Delivery[]) => normalizePlan({
    lanes: [
      { key: "a", name: "Epic A", priority: 1, goalDate: D(2026, 12, 18) }, { key: "b", name: "Epic B", priority: 2 },
      { key: "c", name: "Epic C", priority: 3, state: "avsluttet", outcome: "nådd" }, { key: "p", name: "Epic P", priority: 4, state: "forslag" },
      { key: "e", name: "Epic E", priority: 5 },
    ],
    tasks: [
      f("a1", "a", D(2026, 11, 2), D(2026, 11, 30), D(2026, 12, 11)),
      f("a2", "a", D(2026, 10, 12), D(2026, 10, 26), D(2026, 11, 2), { state: "levert", deliveredAt: "2026-11-02" }),
      { id: "b1", lane: "b", label: "B1", kind: "discovery", start: D(2026, 10, 19), end: D(2026, 11, 13), deps: [], fv: {}, state: "utredes" } as PlanTask,
      f("c1", "c", D(2026, 9, 1), D(2026, 9, 20), D(2026, 9, 30), { state: "levert", deliveredAt: "2026-09-30" }),
      f("p1", "p", D(2027, 1, 4), D(2027, 2, 1), D(2027, 2, 15)),
    ],
    releases: [{ key: "r1", version: "2.0.1", targetDate: "2026-10-22" }, { key: "r0", version: "2.0.0", targetDate: "2026-10-07", shippedDate: "2026-10-07" }],
    deliveries,
  });

  it("one group per delivery in the plan's order; its parts by end, so the last one is what pulls the date", () => {
    const p = base([del({ key: "d1", epics: ["a", "b"], releases: ["r1"] }), del({ key: "d0", name: "Proxy", allCustomers: false, customers: ["Telenor"], promisedDate: "2026-11-15", epics: ["b"] })]);
    const { groups } = deliveryRows(p, TODAY);
    expect(groups.map((g) => g.delivery.key)).toEqual(["d0", "d1"]);
    expect(groups[1].parts.map((x) => x.key)).toEqual(["r1", "b", "a"]);
    expect(groups[1].status.by).toEqual({ kind: "epic", key: "a", name: "Epic A" });
    expect(groups[1].segment.promised).toBeCloseTo(dayToUnit("2026-11-30"), 9);
  });
  it("an epic part spans its open features, darker to the latest likely end, striped while a discovery runs", () => {
    const g = deliveryRows(base([del({ epics: ["a", "b"] })]), TODAY).groups[0];
    const a = g.parts.find((x) => x.key === "a")!, b = g.parts.find((x) => x.key === "b")!;
    expect(a).toMatchObject({ kind: "epic", code: "gronn", start: D(2026, 11, 2), likelyEnd: D(2026, 11, 30), end: D(2026, 12, 11), pending: false });
    expect(a.kind === "epic" && a.window).toMatch(/^Leveres uke /);
    expect(b).toMatchObject({ kind: "epic", code: "venter", start: D(2026, 10, 19), end: D(2026, 11, 13), pending: true });
  });
  it("shared: an epic two deliveries hang on shows under both, each naming the other", () => {
    const [g1, g2] = deliveryRows(base([del({ key: "d1", epics: ["b"] }), del({ key: "d2", name: "Proxy", promisedDate: "2026-12-15", epics: ["b"] })]), TODAY).groups;
    expect(g1.parts[0].kind === "epic" && g1.parts[0].shared).toEqual(["Proxy"]);
    expect(g2.parts[0].kind === "epic" && g2.parts[0].shared).toEqual(["Skytale 2.0"]);
  });
  it("a closed epic spans its delivered features; a release part is its segment, a shipped one marked", () => {
    const parts = deliveryRows(base([del({ epics: ["c"], releases: ["r0", "r1"] })]), TODAY).groups[0].parts;
    expect(parts.map((x) => x.key)).toEqual(["c", "r0", "r1"]);
    expect(parts[0]).toMatchObject({ start: D(2026, 9, 1), end: D(2026, 9, 30) });
    expect(parts[1]).toMatchObject({ kind: "release", shipped: true, end: dayToUnit("2026-10-07") });
    expect(parts[2]).toMatchObject({ kind: "release", shipped: false, end: dayToUnit("2026-10-22") });
  });
  it("a deleted key: the group stays, with no parts and «henger ikke på noe ennå»", () => {
    const [g] = deliveryRows(base([del({ epics: ["gone"], releases: ["gone-too"] })]), TODAY).groups;
    expect(g.parts).toEqual([]);
    expect(g.status).toMatchObject({ code: "ingen", text: "henger ikke på noe ennå" });
  });
  it("loose: the open epics no delivery hangs on, in the plan's order; one without features has no span", () => {
    const { loose } = deliveryRows(base([del({ epics: ["a"] })]), TODAY);
    expect(loose.map((x) => x.key)).toEqual(["b", "p", "e"]);
    expect(loose[2]).toMatchObject({ start: null, end: null, likelyEnd: null, pending: false, shared: [] });
    expect(deliveryRows(normalizePlan({ lanes: [], tasks: [] }), TODAY)).toEqual({ groups: [], loose: [] });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/features/timeline/epic-tools.test.ts -t "Per leveranse"`
Expected: FAIL «deliveryRows is not a function» (and the d.ts export test fails until Step 3 adds both).

- [ ] **Step 3: Implement.** In `epic-tools.js` after `deliveryInvestor`:

```js
/* ---------- R17: «Per leveranse»: COO's business cases with what they hang on ---------- */
/** One epic as a part: the span of its open features (all of them when none is open), darker to the latest likely end. */
function deliveryEpicPart(plan, lane, deliveryKey) {
  const all = plan.tasks.filter((t) => t.lane === lane.key), open = all.filter((t) => t.state !== "levert"), use = open.length ? open : all;
  const shared = (plan.deliveries || []).filter((d) => d.key !== deliveryKey && (d.epics || []).includes(lane.key)).map((d) => d.name);
  const part = { kind: "epic", key: lane.key, lane, code: epicStatus(plan, lane.key).code, window: epicWindowText(plan, lane.key), shared };
  if (!use.length) return Object.assign(part, { start: null, likelyEnd: null, end: null, pending: false });
  return Object.assign(part, {
    start: Math.min(...use.map((t) => t.start)),
    likelyEnd: Math.max(...use.map((t) => (t.kind === "estimate" ? t.endLikely : t.end))),
    end: Math.max(...use.map((t) => t.end)),
    pending: open.some((t) => t.kind === "discovery"),
  });
}
/** Each delivery (the plan's order) with its parts ordered by end — the last one pulls the date — and the open epics no
 *  delivery hangs on («Ingen leveranse»). Keys of since-deleted epics or releases are ignored. Units are the time unit. */
function deliveryRows(plan, todayDay) {
  const segs = releaseSegments(plan, dayToUnit(todayDay));
  const nameOf = (p) => (p.kind === "epic" ? p.lane.name : p.release.version);
  const byEnd = (a, b) => (a.end === null ? 0 : 1) - (b.end === null ? 0 : 1) || (a.end || 0) - (b.end || 0) || nameOf(a).localeCompare(nameOf(b), "nb");
  const groups = deliverySegments(plan, todayDay).map((sg) => {
    const d = sg.delivery, parts = deliveryParts(plan, d);
    const list = parts.epics.map((l) => deliveryEpicPart(plan, l, d.key)).concat(parts.releases.map((r) => {
      const s = segs.find((x) => x.release.key === r.key);
      return { kind: "release", key: r.key, release: r, start: s ? s.start : null, end: s ? s.end : null, shipped: !!r.shippedDate };
    }));
    return { delivery: d, status: sg.status, segment: { start: sg.start, end: sg.end, promised: sg.promised }, parts: list.sort(byEnd) };
  });
  const used = new Set();
  (plan.deliveries || []).forEach((d) => (d.epics || []).forEach((k) => used.add(k)));
  const loose = (plan.lanes || []).filter((l) => !used.has(l.key) && l.state !== "avsluttet").map((l) => deliveryEpicPart(plan, l, null));
  return { groups, loose };
}
```

Add `deliveryRows` to `module.exports` (after `deliveryInvestor`). In `epic-tools.d.ts` after the R16 block:

```ts
/* R17: «Per leveranse» */
export type DeliveryEpicPart = { kind: "epic"; key: string; lane: PlanLane; code: string; window: string; shared: string[]; start: number | null; likelyEnd: number | null; end: number | null; pending: boolean };
export type DeliveryReleasePart = { kind: "release"; key: string; release: Release; start: number | null; end: number | null; shipped: boolean };
export type DeliveryPart = DeliveryEpicPart | DeliveryReleasePart;
export type DeliveryGroup = { delivery: Delivery; status: DeliveryStatus; segment: { start: number; end: number; promised: number }; parts: DeliveryPart[] };
export declare function deliveryRows(plan: Plan, todayDay: string): { groups: DeliveryGroup[]; loose: DeliveryEpicPart[] };
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/features/timeline/epic-tools.test.ts && npx tsc --noEmit`
Expected: PASS (the six new cases and the exports test).

- [ ] **Step 5: Write the failing smoke** `hosted-delivery-view-smoke.mjs`:

```js
// hosted-delivery-view-smoke.mjs: «Mer › Per leveranse» (R17) on Tidslinjen behind the design review's mock API and its
// sample plan (four deliveries). V1–V8. Run from the worktree:
//   NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-delivery-view-smoke.mjs
import { createRequire } from "node:module";
import { startServer } from "/Users/dnumreig/Skytale/ClaudeReports/planning/ux-review-2026-10/harness.mjs";
const require = createRequire("/Users/dnumreig/ptt-e2e/package.json");
const { chromium } = require("playwright");
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); };
const browser = await chromium.launch();
const srv = await startServer({ scenario: "rich" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "nb-NO", timezoneId: "Europe/Oslo" });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(2026, 9, 16, 10));   // the statuses below are the sample plan's on 16 Oct 2026
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
const ready = async () => { await page.waitForSelector(".lane-label"); await page.waitForTimeout(600); };
const menu = async () => page.evaluate(() => { document.getElementById("moreMenu").open = true; });
const groups = () => page.$$eval("#labels > .lane-label", (ls) => ls.map((l) => l.querySelector(".ln").textContent));
await page.goto(srv.base + "/timeline"); await ready();

// V1: the button in Mer, the corner names the view
await menu(); await page.click("#deliveryViewBtn"); await page.waitForSelector(".lane-label.delivery-group");
assert(await page.$eval("#deliveryViewBtn", (b) => b.classList.contains("on") && b.getAttribute("aria-pressed") === "true"), "V1: the button is on");
assert(/Leveranse \/ det den henger på/i.test(await page.textContent("#labels .corner")) && (await page.$("#viewBack")), "V1: the corner names the view and offers «Vis epics»");
// V2: one group per delivery by promised day, «Ingen leveranse» last; the band in the axis is gone
const g = await groups();
assert(JSON.stringify(g) === JSON.stringify(["Skytale 2.0 stabil", "FileVault for alle", "Telenor API-pilot", "Video for store møter", "Ingen leveranse"]), "V2: groups " + g);
assert(!(await page.$(".axis .deliveries")), "V2: no delivery band in the axis in this view");
// V3: FileVault's parts by end, the pill and what pulls the date, the tree
const fv = await page.evaluate(() => { const ls = [...document.querySelectorAll("#labels > *")]; const i = ls.findIndex((l) => l.dataset.key === "lev:d-filer"); const out = []; for (let j = i + 1; j < ls.length && ls[j].classList.contains("task-label"); j++) out.push(ls[j].querySelector(".t").textContent + (ls[j].classList.contains("kid-last") ? " (last)" : "")); return { parts: out, meta: ls[i].querySelector(".lm").textContent, kids: ls[i].classList.contains("has-kids") }; });
assert(JSON.stringify(fv.parts) === JSON.stringify(["Filene dine er trygge i Skytale", "Release 2.1.0 (last)"]) && fv.kids, "V3: FileVault's parts " + JSON.stringify(fv));
assert(/alle kunder · lovet 27\. nov/.test(fv.meta) && /Rød · 1,9 uker etter lovet/.test(fv.meta) && /dratt av release 2\.1\.0/.test(fv.meta), "V3: the group's line " + fv.meta);
// V4: read-only: no grips, no ＋, no arrows; the loose epics
assert(!(await page.$$eval("#labels .grip, #labels .add-feature", (xs) => xs.filter((x) => x.offsetParent).length)) && !(await page.$("svg.deps g")), "V4: no grips, no ＋, no arrows");
const loose = await page.evaluate(() => { const ls = [...document.querySelectorAll("#labels > *")]; const i = ls.findIndex((l) => l.dataset.key === "lev:"); return ls.slice(i + 1).filter((l) => l.classList.contains("task-label")).map((l) => l.querySelector(".t").textContent); });
assert(loose.length === 4 && loose.includes("Samarbeid i travle kanaler"), "V4: the loose epics " + loose);
// V5: a click opens what the row is: the epic editor, the release drawer, Kunder
await page.click('#labels .task-label[data-id="epic:filer"] .t'); await page.waitForSelector("#epicBack.open");
assert(/Filene dine/.test(await page.inputValue("#epName")), "V5: the epic editor opens on the epic"); await page.keyboard.press("Escape");
await page.click('#labels .task-label[data-id="rel:r210"] .t'); await page.waitForSelector("#relDrawer:not([hidden])");
assert(/2\.1\.0/.test(await page.textContent("#relTitle")), "V5: the release drawer opens on 2.1.0"); await page.keyboard.press("Escape");
await Promise.all([page.waitForURL(/\/kunder#d-filer$/), page.click('#labels .lane-label[data-key="lev:d-filer"] .ln')]);
// V6: remembered per browser; «Vis epics» goes back and is remembered too
await page.goto(srv.base + "/timeline"); await ready();
assert(await page.$(".lane-label.delivery-group"), "V6: the view is remembered");
await page.click("#viewBack"); await page.waitForFunction(() => !document.querySelector(".lane-label.delivery-group"));
await page.reload(); await ready();
assert(!(await page.$(".lane-label.delivery-group")) && /Epic \/ feature/i.test(await page.textContent("#labels .corner")), "V6: back to the epics, remembered");
// V7: the forum view turns it off and hides the button
await menu(); await page.click("#deliveryViewBtn"); await page.waitForSelector(".lane-label.delivery-group");
await page.click("#forumBtn"); await page.waitForFunction(() => !document.querySelector(".lane-label.delivery-group"));
assert(!(await page.isVisible("#deliveryViewBtn")), "V7: no «Per leveranse» in the forum view"); await page.click("#forumBtn");
// V8: a reader (who lands in the forum view) turns it off and sees the same groups
await page.evaluate(() => localStorage.clear());
srv.api.role("reader"); await page.goto(srv.base + "/timeline"); await ready();
assert(await page.$eval("#forumBtn", (b) => b.classList.contains("on")), "V8: a reader lands in the forum view");
await page.click("#forumBtn");
await menu(); await page.click("#deliveryViewBtn"); await page.waitForSelector(".lane-label.delivery-group");
assert((await groups()).length === 5, "V8: a reader sees the five groups");
assert(!errors.length, "no page errors: " + errors.join(" | "));
await browser.close(); await srv.close();
console.log("V1–V8 OK: Per leveranse");
```

- [ ] **Step 6: Run it to verify it fails**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-delivery-view-smoke.mjs`
Expected: FAIL «waiting for locator('#deliveryViewBtn')».

- [ ] **Step 7: The page.**
  - Mer: after `#personBtn` add
    `<button id="deliveryViewBtn" aria-pressed="false" title="Én gruppe per leveranse fra fanen Kunder, med epicene og releasene den henger på, i den rekkefølgen de blir ferdige. Lesevisning; leveransene redigeres på Kunder.">Per leveranse</button>`;
    `#personBtn` gets `aria-pressed="false"`.
  - CSS: `#personBtn.on` becomes `#personBtn.on,#deliveryViewBtn.on{…}`; the forum hide list gets `body.forum #deliveryViewBtn`;
    add
    ```css
  /* R17: «Per leveranse»: the group's segment in its band, the parts' bars */
  .labels .corner .back{display:inline;color:var(--accent-text);font-weight:600;text-decoration:underline;letter-spacing:0;text-transform:none}
  .lane-band .group-seg{position:absolute;top:17px;height:18px;border-radius:4px;border:1px solid var(--neutral);background:var(--badge-bg);z-index:2}
  .lane-band .group-seg.st-gronn{border-color:var(--ok);background:var(--ok-bg)}
  .lane-band .group-seg.st-gul{border-color:var(--warn-dot);background:var(--warn-bg)}
  .lane-band .group-seg.st-rod{border-color:var(--bad);background:var(--bad-bg)}
  .lane-band .promise{position:absolute;top:12px;width:2px;height:28px;margin-left:-1px;background:var(--text);opacity:.8;z-index:3}
  .row.part .part-epic{position:absolute;top:12px;height:22px;border-radius:4px;overflow:hidden;z-index:2;background:var(--badge-bg)}
  .row.part .part-epic .likely{position:absolute;left:0;top:0;bottom:0;background:var(--neutral)}
  .row.part .part-epic.st-gronn{background:var(--ok-bg)} .row.part .part-epic.st-gronn .likely{background:var(--ok)}
  .row.part .part-epic.st-gul{background:var(--warn-bg)} .row.part .part-epic.st-gul .likely{background:var(--warn-dot)}
  .row.part .part-epic.st-rod{background:var(--bad-bg)} .row.part .part-epic.st-rod .likely{background:var(--bad)}
  .row.part .part-epic.pending{background:repeating-linear-gradient(45deg,var(--disc-a) 0 6px,var(--disc-b) 6px 12px);box-shadow:inset 0 0 0 1px var(--disc-edge)}
  .row.part .part-epic.pending .likely{display:none}
  .row.part .part-rel{position:absolute;top:13px;height:20px;border:1px solid var(--release);border-left-style:dashed;border-radius:3px 0 0 3px;background:var(--release-bg);overflow:hidden;z-index:2}
  .row.part .part-rel .fill{position:absolute;left:0;top:0;bottom:0;background:var(--release-fill)}
  .row.part .part-rel.pace-gronn .fill{background:var(--pace-gronn)} .row.part .part-rel.pace-gul .fill{background:var(--pace-gul)} .row.part .part-rel.pace-rod .fill{background:var(--pace-rod)}
  .row.part .part-rel.shipped{border-style:solid;opacity:.7}
    ```
  - Replace `let personMode = false;` and the `$('personBtn').addEventListener(…)` line with:
    ```js
  const VIEW_KEY = 'sk.view';
  let viewMode = 'epic';   // R17: 'epic' · 'person' (R8) · 'leveranse' — one at a time, remembered per browser
  try{ const v = localStorage.getItem(VIEW_KEY); if(v === 'person' || v === 'leveranse') viewMode = v; }catch(e){}
  function paintViewButtons(){
    [['personBtn', 'person'], ['deliveryViewBtn', 'leveranse']].forEach(([id, v]) => { $(id).classList.toggle('on', viewMode === v); $(id).setAttribute('aria-pressed', viewMode === v ? 'true' : 'false'); });
  }
  function setView(v, remember){
    viewMode = v === 'person' || v === 'leveranse' ? v : 'epic';
    paintViewButtons();
    if(remember !== false){ try{ localStorage.setItem(VIEW_KEY, viewMode); }catch(e){} }
    render();
  }
  paintViewButtons();
  $('personBtn').addEventListener('click', () => setView(viewMode === 'person' ? 'epic' : 'person'));
  $('deliveryViewBtn').addEventListener('click', () => setView(viewMode === 'leveranse' ? 'epic' : 'leveranse'));
    ```
    and every other `personMode` becomes `viewMode === 'person'` (in `viewLanes`, the task row's `acts.hidden`/grip, `position`'s
    `where`, the `pointerdown` guard — which becomes `if(!bar || viewMode !== 'epic') return;` — and `setForum`, whose line becomes
    `if(forumMode && viewMode !== 'epic') setView('epic', false);`). Task 1's keyboard guard becomes `viewMode !== 'epic'`.
  - The corner: replace `const corner = el('div', 'corner', 'Epic / feature');` with
    ```js
    const corner = el('div', 'corner');
    corner.innerHTML = viewMode === 'epic' ? 'Epic / feature'
      : esc(viewMode === 'person' ? 'Person / utredninger og features' : 'Leveranse / det den henger på') + ' · <button type="button" class="as-text back" id="viewBack">Vis epics</button>';
    if(viewMode !== 'epic') corner.querySelector('#viewBack').addEventListener('click', () => setView('epic'));
    ```
  - The band: `const dsegs = viewMode === 'leveranse' ? [] : deliverySegments(state, dayKey(new Date()));` (the groups say it).
  - The rows: wrap the existing `viewLanes().forEach(lane => { … });` as
    `if(viewMode === 'leveranse') renderDeliveryView(); else viewLanes().forEach(lane => { … });` and add next to `markTree`:
    ```js
  const DELIVERY_PILL = { gronn: 'Grønn', gul: 'Gul', rod: 'Rød', ingen: 'Uten dato' };
  function partBar(p){   // one part's chart row: an epic's span coloured by its status, or a release's segment with its progress
    if(p.start === null) return null;
    const a = Math.max(VIEW_FROM, p.start), b = Math.min(N_MONTHS, Math.max(p.end, p.start + WEEK / 2));
    if(b <= a) return null;
    let d;
    if(p.kind === 'release'){
      const pr = releaseProgress(p.release), pace = p.shipped ? null : releasePace(state, p.release, dayKey(new Date()));
      d = el('div', 'part-rel' + (p.shipped ? ' shipped' : '') + (pace ? ' pace-' + pace.code : ''));
      if(pr.fraction !== null){ const f = el('span', 'fill'); f.style.width = Math.round(pr.fraction * 100) + '%'; d.appendChild(f); }
    } else {
      d = el('div', 'part-epic st-' + (['gronn', 'gul', 'rod'].includes(p.code) ? p.code : 'grey') + (p.pending ? ' pending' : ''));
      const lk = el('i', 'likely'); lk.style.width = (p.end > p.start ? Math.round(Math.max(0, Math.min(1, (p.likelyEnd - p.start) / (p.end - p.start))) * 100) : 100) + '%';
      d.appendChild(lk);
    }
    d.style.left = x(a) + 'px'; d.style.width = (x(b) - x(a)) + 'px';
    return d;
  }
  function partLabel(p){
    const tl = el('div', 'task-label part');
    tl.dataset.id = (p.kind === 'epic' ? 'epic:' : 'rel:') + p.key;
    const nm = el('button', 't as-text', p.kind === 'epic' ? p.lane.name : 'Release ' + p.release.version);
    nm.type = 'button';
    const dd = el('span', 'd');
    if(p.kind === 'epic'){
      const l = p.lane;
      dd.innerHTML = (l.state === 'forslag' ? '<span class="chip st-forslag">Forslag</span>' : '') +
        (l.state === 'avsluttet' ? '<span class="chip">Avsluttet: ' + esc(l.outcome || 'uten utfall') + '</span>' : '<span class="chip st-' + esc(p.code) + '">' + esc(STATUS_LABEL[p.code]) + '</span>') +
        esc(p.window || (p.start === null ? 'Ingen features ennå' : '')) + (p.shared.length ? esc(' · også i ' + p.shared.map(n => '«' + n + '»').join(', ')) : '');
      nm.title = 'Klikk for å redigere epicen';
      nm.addEventListener('click', e => { e.stopPropagation(); openEpicEditor(l.key); });
    } else {
      const r = p.release, pr = releaseProgress(r), fc = p.shipped ? null : releaseForecastText(r, dayKey(new Date()));
      dd.textContent = p.shipped ? 'skippet ' + fmtDate(unitToDate(p.end))
        : 'mål ' + fmtDate(unitToDate(p.end)) + (pr.fraction !== null ? ' · ' + Math.round(pr.fraction * 100) + ' % levert' : '') + (fc && fc.short ? ' · ' + fc.short : '');
      nm.title = 'Åpne releasen';
      nm.addEventListener('click', e => { e.stopPropagation(); openRelease(r.key); });
    }
    tl.addEventListener('click', () => nm.click());
    tl.append(nm, dd);
    return tl;
  }
  function renderDeliveryView(){   // R17: COO's business cases in the list, each with what it hangs on (a read view, like Per person)
    const rows = deliveryRows(state, dayKey(new Date()));
    rows.groups.map(g => [g, g.parts]).concat([[null, rows.loose]]).forEach(([g, parts]) => {
      const ll = el('div', 'lane-label virtual delivery-group');
      ll.dataset.key = g ? 'lev:' + g.delivery.key : 'lev:';
      const ln = g ? el('button', 'ln as-text', g.delivery.name) : el('span', 'ln', 'Ingen leveranse');
      const lm = el('div', 'lm');
      if(g){
        const st = g.status, d = g.delivery;
        const pill = DELIVERY_PILL[st.code] + (st.deviation ? ' · ' + st.deviation : st.code === 'gronn' && !st.computed ? ' · alt levert' : '');
        const pulls = st.by ? (st.pending ? 'minst ' + fmtDate(unitToDate(dayToUnit(st.computed))) + ' · venter på utredning · ' : '') + 'dratt av ' + (st.by.kind === 'epic' ? '«' + st.by.name + '»' : 'release ' + st.by.name) : st.text;
        lm.innerHTML = '<span class="goal">' + esc(deliveryCustomersText(d) + ' · lovet ' + fmtDate(unitToDate(g.segment.promised))) + '</span>' +
          '<span class="chip st-' + esc(st.code) + '">' + esc(pill) + '</span><span class="goal">' + esc(pulls) + '</span>';
        ln.type = 'button'; ln.title = 'Åpne leveransen på fanen Kunder';
        if(HOSTED) ln.addEventListener('click', () => { location.href = '/kunder#' + encodeURIComponent(d.key); });
      } else {
        lm.innerHTML = '<span class="goal">' + esc((state.deliveries || []).length ? 'Epics ingen leveranse henger på' : 'Ingen leveranser ennå. De lages på fanen Kunder.') + '</span>';
      }
      ll.append(ln, lm);
      labels.appendChild(ll);
      const lb = el('div', 'lane-band');
      lb.style.width = CHART_W + 'px';
      if(g){
        const a = Math.max(VIEW_FROM, g.segment.start), b = Math.min(N_MONTHS, g.segment.end);
        if(b > a){ const sg = el('div', 'group-seg st-' + g.status.code); sg.style.left = x(a) + 'px'; sg.style.width = (x(b) - x(a)) + 'px'; sg.title = g.delivery.name + ' · ' + g.status.text; lb.appendChild(sg); }
        const pm = g.segment.promised;
        if(pm >= VIEW_FROM && pm <= N_MONTHS){ const m = el('i', 'promise'); m.style.left = x(pm) + 'px'; m.title = 'Lovet ' + fmtDate(unitToDate(pm)); lb.appendChild(m); }
      }
      chart.appendChild(lb);
      parts.forEach(p => {
        labels.appendChild(partLabel(p));
        const row = el('div', 'row part');
        row.style.width = CHART_W + 'px';
        if(p.kind === 'epic' && typeof p.lane.goalDate === 'number'){ const gl = el('div', 'goal-line'); gl.style.left = x(p.lane.goalDate) + 'px'; row.appendChild(gl); }
        const bar = partBar(p);
        if(bar) row.appendChild(bar);
        chart.appendChild(row);
      });
    });
  }
    ```
  - Help: the card «Leveranser» gets the sentence «<b>Mer › Per leveranse</b> viser hver leveranse som en gruppe med det den henger
    på under, i den rekkefølgen delene blir ferdige: den siste drar datoen.»; the Per person card's sentence ends «… Nålen overstyrer.
    <b>Vis epics</b> øverst i lista går tilbake.».

- [ ] **Step 8: The file:// case.** In `ui-smoke.mjs`, after its first render assertions, add:

```js
await page.evaluate(() => { document.getElementById("moreMenu").open = true; }); await page.click("#deliveryViewBtn");
await page.waitForSelector('.lane-label[data-key="lev:"]');
assert((await page.$$(".lane-label.delivery-group")).length === 1 && /Ingen leveranser ennå/.test(await page.textContent('.lane-label[data-key="lev:"] .lm')), "R17: from file://, only «Ingen leveranse» with the note");
assert(!(await page.isVisible("#editorBack")) && !(await page.isVisible("#dlgBack")), "R17: from file://, sky.css loads and the modals stay closed");
await page.click("#viewBack");
```
(use the smoke's own assert helper name).

- [ ] **Step 9: Run the smokes and the gates**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-delivery-view-smoke.mjs && NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/ui-smoke.mjs && ONLY=U1,U2,U3,U4 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs && npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: `V1–V8 OK`, the ui smoke's lines, `U1 OK`…`U4 OK`, vitest green. The two smokes that toggle «Per person»
(`hosted-history-smoke` S22, `hosted-polish-smoke`) still pass: the button and its `on` class are unchanged.

- [ ] **Step 10: Commit**

```bash
git add src/features/timeline/epic-tools.js src/features/timeline/epic-tools.d.ts src/features/timeline/epic-tools.test.ts src/app/timeline/timeline.html
git commit -m "Tidslinjen: «Mer › Per leveranse», COO's deliveries in the list with what each hangs on (R17)"
```

### Task 4: one meaning per colour (spec §6)

**Files:**
- Modify: `src/app/timeline/timeline.html` (its tokens and dark block; the today, discovery, goal and chip rules; the today label's text)
- Modify: `src/app/kunder/kunder.html` (the weight pills)
- Modify: `hosted-ux-r17-smoke.mjs` (U5; U3 drops its `.today .tl` exclusion), `hosted-history-smoke.mjs` (the today label)

**Interfaces:**
- Produces: `--today` is ink (white in dark); `--disc-a/-b/-edge` are slate; the today element has a `::before` wash; the
  label reads «I dag · 16. okt · Sprint 71 · dag 4». Tasks 8–11 start from this commit.

- [ ] **Step 1: Write the failing smoke part** (U5) and remove `{ exclude: [[".today .tl"]] }` from U3's `axe.run` (pass
  `document` instead):

```js
if (part("U5")) {
  const { ctx, page } = await open("/timeline");
  const c = await page.evaluate(() => {
    const cs = (sel, pseudo) => { const e = document.querySelector(sel); return e ? getComputedStyle(e, pseudo) : null; };
    return {
      today: cs(".chart .today").backgroundColor, wash: cs(".chart .today", "::before").backgroundColor, label: document.querySelector(".chart .today .tl").textContent,
      disc: cs(".bar.discovery").backgroundImage, goal: cs(".goal-line") && cs(".goal-line").borderLeftStyle, ext: cs(".chip.ext-chip") && cs(".chip.ext-chip").backgroundColor,
    };
  });
  assert(c.today === "rgb(13, 18, 62)" && /rgba\(13, 18, 62, 0\.0\d+\)/.test(c.wash), "U5: today is ink over a washed past: " + c.today + " " + c.wash);
  assert(/^I dag · \d+\. [a-zæøå]+ · Sprint \d+ · dag \d+$/.test(c.label), "U5: the today label in sentence case: " + c.label);
  assert(/203, 213, 225/.test(c.disc) && !/252, 211, 77/.test(c.disc), "U5: discovery is a slate hatch, not amber: " + c.disc);
  assert(c.goal === "dashed", "U5: a goal is dashed ink");
  assert(c.ext === "rgba(0, 0, 0, 0)", "U5: «Ekstern dato» is an outline chip: " + c.ext);
  await ctx.close();
  console.log("U5 OK: today is ink, discovery a slate hatch, goals dashed, attributes outlined (Kunder's weight: Task 10)");
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `ONLY=U5 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs`
Expected: FAIL «U5: today is ink … rgb(239, 68, 68)».

- [ ] **Step 3: Tokens.** In timeline.html's own `:root`: `--disc-a:#cbd5e1; --disc-b:#f8fafc; --disc-edge:rgba(71,85,105,.45);`
(slate-300 / slate-50 / a slate edge) and `--today:#0d123e;`. In its dark block: `--disc-a:rgba(148,163,184,.38);
--disc-b:rgba(148,163,184,.08); --disc-edge:rgba(148,163,184,.5); --today:#ffffff;`. The discovery button in the editor
(`.ed-kind button.on[data-k=discovery]`) becomes `background:var(--badge-bg);border-color:var(--text-3);color:var(--text)`.

- [ ] **Step 4: Rules.** Replace the today, goal and chip rules:

```css
  /* R17: one meaning per colour: today is ink over a washed past and its label sits in the axis, never the red of «late» */
  .chart .today{position:absolute;top:var(--axis-h);bottom:0;width:2px;background:var(--today);opacity:.85;z-index:6;pointer-events:none}
  .chart .today::before{content:"";position:absolute;top:0;bottom:0;right:2px;width:4000px;background:rgba(13,18,62,.045);pointer-events:none}
  .chart .today .tl{position:absolute;top:-18px;left:-1px;background:var(--today);color:var(--surface);font-size:11px;font-weight:600;padding:1px 7px;border-radius:3px 3px 3px 0;white-space:nowrap;letter-spacing:.02em}
  /* a goal is a target: dashed ink in its own epic; today is the only solid line through the chart */
  .goal-line{position:absolute;top:0;bottom:0;width:0;margin-left:-1px;border-left:2px dashed var(--goal);z-index:3;pointer-events:none}
  .goal-line.ghost{border-left:2px dotted var(--text-3);opacity:.7;z-index:2}
  .sw.goal{width:0;height:16px;border-left:3px dashed var(--goal);background:none}
  /* attributes whisper, status speaks: «Ekstern dato», «fast dato», «overstyrt» and the queue are outlines */
  .chip.ext-chip,.task-label .chip.fixed,.chip.fixed,.chip.pinned{background:transparent;color:var(--text-2);box-shadow:inset 0 0 0 1px var(--line)}
  .chip.sig,.task-label .chip.queue{outline:none;border:none;box-shadow:inset 0 0 0 1px var(--line)}
```
and in the dark block `.chart .today::before{background:rgba(255,255,255,.045)}` (as a rule inside the `@media`). The sprint
ruler's `.axis .sprint.now{border-left-color:var(--today)}` and the burndown's `.burn .now` follow the token.

- [ ] **Step 5: The label's words.** In `render()`:
`today.innerHTML = '<span class="tl">I dag · ' + tn.getDate() + '. ' + MND_S[tn.getMonth()] + (spl ? ' · ' + spl : '') + '</span>';`
(`MND_UP` is then unused: delete it). `hosted-history-smoke.mjs:485` keeps its regex (it reads the end of the label).

- [ ] **Step 7: Run U1–U5, the history smoke and the gates**

Run: `ONLY=U1,U2,U3,U4,U5 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs && NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-history-smoke.mjs && NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-deliveries-smoke.mjs && npx vitest run && npx eslint src`
Expected: all OK (U3's axe now covers the today label: white on ink, ink on white in dark).

- [ ] **Step 8: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "Tidslinjen: one meaning per colour: today in ink, discovery a slate hatch, dashed goals, outlined attributes (R17)"
```

### Task 5: a quieter chart (spec §7)

**Files:**
- Modify: `src/app/timeline/timeline.html`
- Modify: `hosted-ux-r17-smoke.mjs` (U6–U9), `hosted-deliveries-smoke.mjs` (D0, D5 for the marker row), `theme-shots.mjs` (the help drawer)

**Interfaces:**
- Consumes: Task 3's `viewMode` (the band is hidden in «Per leveranse»).
- Produces: `#helpPanel` is an `aside.drawer` (open = not `hidden`); the delivery band is one row of `.pmark` markers;
  `--axis-h` = 76 px, or 94 px when any delivery exists.

- [ ] **Step 1: Write the failing smoke parts**

```js
const TYPE_EXEMPT = ".chip,.badge,.count,.axis .sprint,.axis .release,.axis .delivery,.release-line,.goal-lbl,.burn,.sr-only";
function smallText(exempt) {   // visible text nodes below 12 px that are not chips or in-chart labels
  const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const e = n.parentElement; if (!n.textContent.trim() || !e || e.closest(exempt)) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === "hidden") continue;
    if (parseFloat(getComputedStyle(e).fontSize) < 12) out.push(e.tagName + "." + e.className + " «" + n.textContent.trim().slice(0, 24) + "»");
  }
  return out;
}
if (part("U6")) {   // no text in bars, dates once, the 12 px floor
  const { ctx, page } = await open("/timeline");
  assert(!(await page.$(".bar .bl")), "U6: bars carry no text");
  const d = await page.$eval('.task-label[data-id="kapasitet"] .d', (e) => e.textContent);
  assert(!/\d+\. [a-zæøå]+ → /.test(d), "U6: the list's second line has no dates: " + d);
  const rl = await page.$eval('.row:has(.bar[data-id="kapasitet"]) .range-lbl', (e) => e.textContent);
  assert(/^\d+\. [a-zæøå]+ → \d+\. [a-zæøå]+ · senest \d+\. [a-zæøå]+$/.test(rl), "U6: the dates after the bar: " + rl);
  const small = await page.evaluate(smallText, TYPE_EXEMPT);
  assert(!small.length, "U6: no text below 12 px: " + small.slice(0, 8).join(" | "));
  await ctx.close();
  console.log("U6 OK: bars without text, dates once after the bar, a 12 px floor");
}
if (part("U7")) {   // the shorter header: one row of markers; none in «Per leveranse»
  const { ctx, page } = await open("/timeline");
  const h = await page.$eval(".axis", (a) => getComputedStyle(a).height);
  assert(h === "94px" && (await page.$$(".axis .delivery")).length === 1 && (await page.$$(".axis .delivery .pmark")).length === 4, "U7: one marker row, four markers, axis 94 px: " + h);
  assert(/dratt av/.test(await page.$eval(".axis .delivery .pmark", (m) => m.title)), "U7: a marker's tooltip says what pulls the date");
  await Promise.all([page.waitForURL(/\/kunder#/), page.click(".axis .delivery .pmark")]);
  await ctx.close();
  console.log("U7 OK: the delivery band is one row of markers");
}
if (part("U8")) {   // help in a drawer, the hint on one line
  const { ctx, page } = await open("/timeline");
  await page.evaluate(() => { localStorage.removeItem("sk.hint.timeline"); }); await page.reload(); await page.waitForSelector(".lane-label");
  const hintLines = await page.$eval("#hint", (e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
  assert(hintLines === 1, "U8: the hint is one line: " + hintLines);
  await page.evaluate(() => { document.getElementById("moreMenu").open = true; }); await page.click("#helpBtn");
  await page.waitForSelector("#helpPanel:not([hidden])");
  assert(await page.$eval("#helpPanel", (e) => e.tagName === "ASIDE" && e.getAttribute("role") === "dialog" && e.getBoundingClientRect().left > 700), "U8: help is a drawer on the right");
  assert(await page.$eval("#gantt", (g) => g.getBoundingClientRect().top < 400), "U8: the chart does not move down");
  await page.keyboard.press("Escape"); await page.waitForSelector("#helpPanel[hidden]", { state: "attached" });
  await ctx.close();
  console.log("U8 OK: help in a drawer, the hint on one line");
}
if (part("U9")) {   // the strip leads with the chance; proposals upright; the history reason a sentence; ＋ on hover; compare quiet
  const { ctx, page } = await open("/timeline");
  const s = await page.textContent("#stRelease");
  assert(/^Neste release 2\.0\.1 · (\d+ %|over 99 %|under 1 %) sjanse til 22\. okt · /.test(s) && !(await page.$("#stRelease i")), "U9: the strip leads with the chance: " + s);
  assert(await page.$$eval(".lane-label.proposal .ln", (ls) => ls.every((l) => getComputedStyle(l).fontStyle === "normal")), "U9: proposals are not italic");
  assert(await page.$eval(".lane-label .add-feature", (b) => getComputedStyle(b).opacity === "0"), "U9: the row's ＋ waits for hover");
  await page.hover(".lane-label"); assert(await page.$eval(".lane-label:hover .add-feature", (b) => getComputedStyle(b).opacity === "1"), "U9: ＋ on hover");
  await page.click("#histBtn"); await page.waitForSelector(".hist-cs");
  assert(!(await page.$(".hist-cs .chip.reason")) && (await page.$(".hist-cs .reason-line")), "U9: the reason is a sentence, not a chip");
  await ctx.close();
  console.log("U9 OK: the strip, proposals, the history reason, ＋ on hover");
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `ONLY=U6,U7,U8,U9 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs`
Expected: FAIL «U6: bars carry no text».

- [ ] **Step 3: No text in bars, dates once.** In `render()` the bar's innerHTML drops `'<span class="bl">' + esc(t.label) + '</span>'`;
in `position()` delete the `.bl` max-width line; the after-bar label and the list line become:

```js
    rl.textContent = t.kind === 'estimate'
      ? fmtDate(unitToDate(t.start)) + ' → ' + fmtDate(unitToDate(t.endLikely)) + ' · senest ' + fmtDate(unitToDate(t.end))
      : 'til ' + fmtDate(unitToDate(t.end));
```
```js
    const size = sizeClassText(t), lead = viewMode === 'person' ? (t.lane === BACKLOG ? 'Hylla' : (getLane(t.lane) || {name: t.lane}).name) : '';
    labelDateRefs[t.id].innerHTML = esc([lead, t.kind === 'discovery' ? 'Utredning' : '', size, t.kind === 'estimate' ? rawLabel(t) : ''].filter(Boolean).join(' · ')) + chips.join('');
    bar.title = t.label + ' · ' + rangeText(t) + (t.kind === 'estimate' ? ' · ' + bufferLabel(t) : '');
```
CSS: delete `.bar .bl{…}`; `.range-lbl{…;font-size:12px}` and `.range-lbl.date{color:var(--text-2);font-weight:500}`.

- [ ] **Step 4: The type floor.** In timeline.html: `.lane-label .lm{font-size:12px}`, `.task-label .d{font-size:12px}`,
`.chip,.badge{font-size:11px;padding:1px 6px}`, `.labels .corner{font-size:12px;letter-spacing:0;text-transform:none;color:var(--text-3)}`,
`.axis .mth{padding-top:6px}`, `.axis .mth .mm{font-size:12px}`, `.axis .mth .yy{font-size:12px;color:var(--text-3)}`,
`.axis .sprint{font-size:11px;color:var(--text-3)}`, `.axis .release,.axis .delivery .seg,.chart .release-line::after,.lane-band .goal-lbl{font-size:11px}`,
`.legend,.status,.hint{font-size:12px}`, `.empty .note,footer{font-size:12px}`, `.hist-ev .where,.rel-row .id,.rel-row .st,.rel-row .pt,.rel-row .who,.rel-basis,.shelf-row .st{font-size:12px}`,
`.shelf-group{font-size:12px;letter-spacing:0;text-transform:none}`, `.drag-tip{font-size:12px}`, `.burn text{font-size:11px}`,
`.cmp-list .row .who{font-size:12px}`, `.import-row .typ,.import-row .map{font-size:12px}`, `#dlgMsg.pre{font-size:12px}`,
`.release-line::after{color:var(--text-2)}`. Then run U6; for every node it lists, raise that rule to 12 px.

- [ ] **Step 5: The shorter header.** Replace the delivery band block in `render()`:

```js
    // leveranser (R16 → R17): one row of promised-date markers; the full rows live in «Mer › Per leveranse»
    const dsegs = viewMode === 'leveranse' ? [] : deliverySegments(state, dayKey(new Date()));
    gantt.style.setProperty('--axis-h', (76 + (dsegs.length ? 18 : 0)) + 'px');
    if(dsegs.length){
      const layer = el('div', 'deliveries'), row = el('div', 'delivery');
      let last = -Infinity;
      dsegs.slice().sort((a, b) => a.promised - b.promised).forEach(sg => {
        if(sg.promised < VIEW_FROM || sg.promised > N_MONTHS) return;
        const d = sg.delivery, st = sg.status, left = Math.max(x(sg.promised), last + 14);
        last = left;
        const m = el('i', 'pmark st-' + st.code);
        m.style.left = left + 'px'; m.tabIndex = 0; m.setAttribute('role', 'button');
        m.title = 'Leveranse ' + d.name + ' · ' + deliveryCustomersText(d) + ' · lovet ' + fmtDate(unitToDate(sg.promised)) + '\n' + st.text + (HOSTED ? '\nKlikk for fanen Kunder' : '');
        m.setAttribute('aria-label', d.name + ', lovet ' + fmtDate(unitToDate(sg.promised)) + ', ' + st.text);
        if(HOSTED) m.addEventListener('click', () => { location.href = '/kunder#' + encodeURIComponent(d.key); });
        row.appendChild(m);
      });
      layer.appendChild(row);
      axis.appendChild(layer);
    }
```
CSS: replace the `.axis .delivery .seg…` and `.axis .delivery .promise` rules with

```css
  .axis .delivery .pmark{position:absolute;top:3px;width:11px;height:11px;margin-left:-5px;transform:rotate(45deg);border-radius:2px;border:1px solid var(--neutral);background:var(--badge-bg);pointer-events:auto;cursor:pointer}
  .axis .delivery .pmark.st-gronn{border-color:var(--ok);background:var(--ok-bg)}
  .axis .delivery .pmark.st-gul{border-color:var(--warn-dot);background:var(--warn-bg)}
  .axis .delivery .pmark.st-rod{border-color:var(--bad);background:var(--bad)}
  .sw.delivery{width:10px;height:10px;transform:rotate(45deg);border:1px solid var(--ok);background:var(--ok-bg);border-radius:2px}
```
The keyboard handler from Task 1 opens `.axis .delivery .pmark` on Enter (change its selector from `.seg`).
`hosted-deliveries-smoke.mjs`: D0 keeps «no band, 76 px»; D5 now asserts one `.axis .delivery` row with one `.pmark`, the
title with «dratt av» and «Lovet» → «lovet», the axis at 94 px, and the click → `/kunder#<key>` (the segment-text and
«above the release band» lines go; the band no longer carries text).

- [ ] **Step 6: Help in a drawer, the hint on one line.** Replace `<div class="help" id="helpPanel"> <h3>…</h3> <button class="x close-help" id="helpClose" …> <div class="help-grid">…</div> </div>` with

```html
  <aside class="drawer help-drawer" id="helpPanel" hidden>
    <div class="drawer-head"><h2>Slik bruker du tidslinjen</h2><button class="x" id="helpClose" title="Lukk">✕</button></div>
    <div class="drawer-body"><div class="help-grid"> … the same help cards … </div></div>
  </aside>
```
(moved next to the other drawers, after `#relDrawer`). CSS: delete `.help{…}`, `.help.open`, `.help h3`, `.help .close-help`,
the 900-px media rule; `.help-grid{display:grid;grid-template-columns:1fr;gap:10px;padding-top:10px}`. JS:
`$('helpBtn').addEventListener('click', () => { helpPanel.hidden = !helpPanel.hidden; });`,
`$('helpClose').addEventListener('click', () => { helpPanel.hidden = true; });`, and the Escape chain's last line becomes
`else if(!helpPanel.hidden) helpPanel.hidden = true;`. The hint's text:
`Stripet = utredning · mørk del = sannsynlig · lys del = usikker. <b>Mer › Hjelp</b> forklarer resten.`
`theme-shots.mjs:25` waits for `#helpPanel:not([hidden])` instead of `.help.open`.

- [ ] **Step 7: The page's notes.**
  - The strip, in `updateTlSummary()` (the tempo colour stays in the drawer):
    ```js
    if(nx){
      const r = nx.release, pr = releaseProgress(r), n = calendarDays(dayKey(new Date()), r.targetDate);
      const when = n > 0 ? 'om ' + n + (n === 1 ? ' dag' : ' dager') : n === 0 ? 'i dag' : -n + (n === -1 ? ' dag' : ' dager') + ' på overtid';
      const target = fmtDate(unitToDate(dayToUnit(r.targetDate)));
      rel.title = 'Neste release: sjansen for å bli ferdig til målet; tempo-fargen står i skuffen';
      rel.textContent = 'Neste release ' + r.version + ' · ' + (nfc && nfc.short ? nfc.short + ' til ' + target : 'mål ' + target) + ' · ' +
        (pr.fraction === null ? 'ikke lest fra ADO' : Math.round(pr.fraction * 100) + ' % levert') + ' · ' + when;
    }
    ```
  - Proposals: delete `.lane-label.proposal .ln{font-style:italic}`.
  - The epic row's «＋»: `.lane-label .add-feature{opacity:0;transition:opacity .12s}` and
    `.lane-label:hover .add-feature,.lane-label:focus-within .add-feature{opacity:1}` and `@media (hover:none){.lane-label .add-feature{opacity:1}}`.
  - The compare control looks like the menus: `#cmpSelect{appearance:none;-webkit-appearance:none;font-size:13px;padding:6px 26px 6px 12px;border-color:var(--line);color:var(--text-2);max-width:200px;background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E") no-repeat right 10px center}` and its first option reads «Sammenlign»
    (in `loadSnapshots()` and the markup). The select stays (smokes and the keyboard keep working).
  - The history reason as a sentence, in `appendEvent()`: the `reason` variable becomes
    ```js
      const reason = cs.reasonCode && cs.reasonCode !== 'ingen'
        ? '<span class="reason-line">' + esc(REASON_LABEL[cs.reasonCode] || cs.reasonCode) + (cs.reason ? ': ' + esc(cs.reason) : '') + '</span>'
        : cs.reasonCode === 'ingen'
          ? '<span class="reason-line missing">Begrunnelse mangler' + (canWrite ? ' – <button class="text add-reason" data-cs="' + esc(cs.id) + '" data-when="' + esc(fmtWhen(cs.at || e.at)) + '">legg til</button>' : '') + '</span>'
          : '';
    ```
    and CSS `.hist-cs .reason-line{flex-basis:100%;font-size:13px;color:var(--text)}`, `.hist-cs .reason-line.missing{color:var(--warn)}`,
    `.hist-cs .reason-line .add-reason{padding:0 2px;font-size:13px;color:var(--accent-text)}` (the old `.hist-cs .reason` rules go).
    `renderCompareList()` keeps its chips (the compare list is a list of changes, not the history).

- [ ] **Step 8: Run U1–U9, the deliveries, history and theme smokes, and the gates**

Run: `ONLY=U1,U2,U3,U4,U5,U6,U7,U8,U9 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs && for s in hosted-deliveries-smoke hosted-history-smoke hosted-polish-smoke hosted-release-smoke hosted-smoke ui-smoke; do NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/$s.mjs || break; done && npx vitest run && npx eslint src`
Expected: all OK. A history-smoke assertion that read `.chip.reason` text in the drawer reads `.reason-line` instead.

- [ ] **Step 9: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "Tidslinjen: a quieter chart: no text in bars, dates once, a 12 px floor, one row of delivery markers, help in a drawer (R17)"
```

### Task 6: wall mode (spec §8)

**Files:**
- Modify: `src/app/timeline/timeline.html` (the forum CSS; `MONTH_W`/`ROW_H`/`LANE_H` re-read on the toggle)
- Modify: `hosted-ux-r17-smoke.mjs` (U10–U11)

**Interfaces:**
- Consumes: `setForum(on, remember)` (R15).
- Produces: in forum mode the size tokens grow (`--row-h:54px; --lane-h:62px; --month-w:112px`) and the type follows;
  `readMetrics()` re-reads them, so drags stay exact. The shelf's placing actions stay for writers (R15's forum decides
  placements); every other write control is hidden for everyone.

- [ ] **Step 1: Write the failing smoke parts**

```js
if (part("U10")) {   // a writer at the wall
  const { ctx, page } = await open("/timeline", { vp: { width: 1920, height: 1080 } });
  await page.click("#forumBtn"); await page.waitForFunction(() => document.body.classList.contains("forum"));
  const v = await page.evaluate(() => ({
    hidden: ["addEpicBtn", "addReleaseBtn", "registerBtn", "hint", "dirtyNote", "roBanner"].filter((id) => { const e = document.getElementById(id); return e && e.offsetParent; }),
    plus: [...document.querySelectorAll(".lane-label .add-feature, .lane-label .grip")].filter((e) => getComputedStyle(e).display !== "none").length,
    row: getComputedStyle(document.querySelector(".row")).height, name: getComputedStyle(document.querySelector(".task-label .t")).fontSize,
    shelfActs: [...document.querySelectorAll(".shelf-row .acts")].some((a) => getComputedStyle(a).opacity === "1"),
    cmpSize: getComputedStyle(document.getElementById("cmpBar")).fontSize,
  }));
  assert(!v.hidden.length && !v.plus, "U10: no write chrome at the wall: " + v.hidden + " ＋/grips " + v.plus);
  assert(v.row === "54px" && parseFloat(v.name) >= 15, "U10: the wall is larger: row " + v.row + ", name " + v.name);
  assert(v.shelfActs, "U10: the shelf keeps its placing actions for a writer (R15)");
  assert(v.cmpSize === "16px", "U10: «Siden sist» is the headline: " + v.cmpSize);
  // a drag at the wall still moves by the pointer: one week = 28 px at 112 px a month
  const sel = '.bar[data-id="kapasitet"]', b = await page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2, left: e.offsetLeft }; });
  await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.mouse.move(b.x + 28, b.y, { steps: 4 }); await page.mouse.up();
  if (await page.$("#reasonBack.open")) await page.keyboard.press("Escape");
  const left = await page.$eval(sel, (e) => e.offsetLeft);
  assert(Math.abs(left - b.left - 28) < 2, "U10: a drag at the wall moves one week: " + b.left + " → " + left);
  await ctx.close();
  console.log("U10 OK: the wall is larger, without write chrome, «Siden sist» first, drags exact");
}
if (part("U11")) {   // a reader at the wall: one quiet «Lesetilgang»
  const { ctx, page } = await open("/timeline", { role: "reader", vp: { width: 1280, height: 800 } });
  await page.waitForFunction(() => document.body.classList.contains("forum"));
  const v = await page.evaluate(() => ({ tag: !!document.getElementById("roTag").offsetParent, tagColour: getComputedStyle(document.getElementById("roTag")).color,
    banner: !!document.getElementById("roBanner").offsetParent, note: !!document.getElementById("dirtyNote").offsetParent,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
  assert(v.tag && v.tagColour === "rgb(100, 116, 139)" && !v.banner && !v.note, "U11: one quiet «Lesetilgang»: " + JSON.stringify(v));
  assert(!v.overflow, "U11: no sideways scroll on a 1280 px laptop");
  await ctx.close();
  console.log("U11 OK: a reader at the wall sees one quiet «Lesetilgang»");
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `ONLY=U10,U11 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs`
Expected: FAIL «U10: no write chrome at the wall: addEpicBtn,addReleaseBtn…».

- [ ] **Step 3: The size tokens.** `const MONTH_W = …, ROW_H = …, LANE_H = …;` becomes
`let MONTH_W = cssNum('--month-w'), ROW_H = cssNum('--row-h'), LANE_H = cssNum('--lane-h');` with
```js
  function readMetrics(){ MONTH_W = cssNum('--month-w'); ROW_H = cssNum('--row-h'); LANE_H = cssNum('--lane-h'); }   // R17: the wall changes them
```
and `setForum()` calls `readMetrics();` right after `document.body.classList.toggle('forum', forumMode);`.

- [ ] **Step 4: The wall's CSS** (after the R15 forum rules):

```css
  /* R17: wall mode: the plan, larger, without the desk's write chrome; the shelf keeps its placing actions (R15) */
  body.forum{--row-h:54px;--lane-h:62px;--month-w:112px}
  body.forum #addEpicBtn,body.forum #addReleaseBtn,body.forum #registerBtn,body.forum .lane-label .add-feature,body.forum .lane-label .grip,body.forum .task-label .grip,body.forum #hint,body.forum #dirtyNote,body.forum #roBanner{display:none !important}
  body.forum .lane-label .ln{font-size:17px}
  body.forum .task-label .t{font-size:15px}
  body.forum .lane-label .lm,body.forum .task-label .d,body.forum .range-lbl,body.forum .status,body.forum .legend{font-size:14px}
  body.forum .chip,body.forum .badge{font-size:12.5px}
  body.forum .axis .mth .mm,body.forum .axis .mth .yy{font-size:13px}
  body.forum .bar{top:10px;height:34px}
  body.forum #roTag{color:var(--text-3);font-weight:500}
  body.forum .cmp-bar{font-size:16px;background:var(--surface);border-color:var(--line);border-left:4px solid var(--accent)}
  body.forum .bar.ghost{opacity:.55;outline:1px dashed var(--text-3);outline-offset:-1px}
```
`placeCompareBar()` already moves `#cmpBar` above the status strip in the forum (R15), so «Siden sist» stays first.

- [ ] **Step 5: Run U10–U11, the forum smoke parts and the gates**

Run: `ONLY=U10,U11 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs && NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-history-smoke.mjs && npx eslint src`
Expected: OK; the history smoke's S11/S22 (the forum view) still pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "Tidslinjen: wall mode: larger, no write chrome, one quiet «Lesetilgang», «Siden sist» first (R17)"
```

### Task 7: the feature editor, and editors read-only for readers (spec §9, D9)

**Files:**
- Modify: `src/app/timeline/timeline.html` (the `#edTabPlan` markup, CSS, `openEditor`, `openEpicEditor`, `openReleaseEditor`, `setReadOnly`)
- Modify: `hosted-ux-r17-smoke.mjs` (U12–U13)

**Interfaces:**
- Produces: `#edTabPlan` holds `fieldset.ed-group` blocks with legends «Når», «Hvem», «Hvor sikkert», «Venter på»,
  «Fremdrift» and `details#edAdv` «Avansert»; every id is unchanged. `setReadOnly(back, ro)`.

- [ ] **Step 1: Write the failing smoke parts**

```js
if (part("U12")) {   // the plan tab grouped by question, the advanced part collapsed
  const { ctx, page } = await open("/timeline");
  await page.click('.task-label[data-id="kapasitet"] .t'); await page.waitForSelector("#editorBack.open");
  const g = await page.$$eval("#edTabPlan > fieldset.ed-group > legend", (ls) => ls.map((l) => l.textContent));
  assert(JSON.stringify(g) === JSON.stringify(["Når", "Hvem", "Hvor sikkert", "Venter på", "Fremdrift"]), "U12: the groups: " + g);
  assert(await page.$eval("#edAdv", (d) => !d.open && d.contains(document.getElementById("edFixed")) && d.contains(document.getElementById("edQueue"))), "U12: «Fast dato» and «Følger køen» under a closed «Avansert»");
  await page.keyboard.press("Escape");
  await ctx.close();
  console.log("U12 OK: the feature editor grouped by question");
}
if (part("U13")) {   // a reader's editors are read-only
  const { ctx, page } = await open("/timeline", { role: "reader" });
  if (await page.$eval("#forumBtn", (b) => b.classList.contains("on"))) await page.click("#forumBtn");
  await page.click('.task-label[data-id="kapasitet"] .t'); await page.waitForSelector("#editorBack.open");
  const v = await page.evaluate(() => ({
    editable: [...document.querySelectorAll("#editorBack .modal-body input, #editorBack .modal-body select, #editorBack .modal-body textarea")].filter((x) => !x.disabled).length,
    save: !!document.getElementById("edSave").offsetParent, del: !!document.getElementById("edDelete").offsetParent, close: document.getElementById("edCancel").textContent,
  }));
  assert(!v.editable && !v.save && !v.del && v.close === "Lukk", "U13: the feature editor is read-only: " + JSON.stringify(v));
  await page.click('#edTabs button[data-tab="om"]'); assert(await page.isVisible("#edTabOm"), "U13: a reader still switches tabs");
  await page.click("#edCancel"); await page.waitForFunction(() => !document.querySelector("#editorBack.open"));
  await page.click(".lane-label .ln"); await page.waitForSelector("#epicBack.open");
  assert(await page.$$eval("#epicBack .modal-body input, #epicBack .modal-body select, #epicBack .modal-body textarea", (xs) => xs.every((x) => x.disabled)), "U13: the epic editor is read-only");
  await ctx.close();
  console.log("U13 OK: readers read, they do not edit");
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `ONLY=U12,U13 NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs`
Expected: FAIL «U12: the groups: ».

- [ ] **Step 3: The markup.** Rebuild `#edTabPlan` with the same elements and ids, in this order:

```html
        <div class="ed-panel" id="edTabPlan" role="tabpanel">
          <fieldset class="ed-group"><legend>Når</legend>
            <div class="ed-row"> [#edStart's label] [#edEndField] [#edLikelyField] [#edLateField] </div>
            [#edBufferField]
          </fieldset>
          <fieldset class="ed-group"><legend>Hvem</legend> [#edOwner's label] </fieldset>
          <fieldset class="ed-group"><legend>Hvor sikkert</legend> [the «Type» field with #edKind] [#edClassRow] [#edPullRow] </fieldset>
          <fieldset class="ed-group"><legend>Venter på</legend> [#edDeps's field, without its «Venter på (blokkere)» span] [the row with #edLink] </fieldset>
          <fieldset class="ed-group" id="edGrpProg"><legend>Fremdrift</legend> [#edProgRow] [#edProgNote] </fieldset>
          <details class="ed-adv" id="edAdv"><summary>Avansert</summary> [the #edFixed label] [#edQueueField] </details>
          [#edLifecycleRow]
        </div>
```
(each `[...]` is the existing element moved as it is). CSS:

```css
  .ed-group{border:0;padding:0;margin:0;min-width:0;display:grid;gap:10px}
  .ed-group > legend{font-size:13px;font-weight:600;color:var(--text);padding:0;margin-bottom:6px}
  .ed-group[hidden]{display:none}
  .ed-adv > summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--text-2)}
  .ed-adv[open] > summary{margin-bottom:8px}
```
In `openEditor()`: `$('edGrpProg').hidden = t.kind !== 'estimate';` next to `$('edProgRow').hidden = …`, and
`$('edAdv').open = !!t.fixedEnd || !!t.pinned;`; wherever `paintEdKind()` toggles `#edProgRow`, toggle `#edGrpProg` the same way.

- [ ] **Step 4: Read-only for readers.** Next to `openEditor`:

```js
  function setReadOnly(back, ro){   // R17: a reader's editor: every field disabled (tabs still switch), only «Lukk» and «Historikk»
    back.classList.toggle('ro', ro);
    back.querySelectorAll('.modal-body input, .modal-body select, .modal-body textarea, .modal-body button:not([role=tab])').forEach(f => {
      if(ro && !f.disabled){ f.disabled = true; f.dataset.ro = '1'; }
      else if(!ro && f.dataset.ro === '1'){ f.disabled = false; delete f.dataset.ro; }
    });
  }
```
At the end of `openEditor()` (before `editorBack.classList.add('open')`):
```js
    const ro = HOSTED && !canWrite;
    setReadOnly(editorBack, ro);
    $('edSave').hidden = ro; $('edDelete').hidden = ro; $('edCancel').textContent = ro ? 'Lukk' : 'Avbryt';
    if(ro) $('edTitle').textContent = t.kind === 'discovery' ? 'Utredning' : 'Feature';
```
The same in `openEpicEditor()` (`setReadOnly(epicBack, ro); $('epSave').hidden = ro; $('epDelete').hidden = ro; $('epCancel').textContent = ro ? 'Lukk' : 'Avbryt';`)
and in `openReleaseEditor()` (`setReadOnly(relBack, ro); $('relSave').hidden = ro; $('relDelete').hidden = ro; $('relCancel').textContent = ro ? 'Lukk' : 'Avbryt';`;
`relDelete`'s own rule for a new release still applies after it: hide it when `ro` or when the release is new).
`setTimeout(() => $('edName').focus(), 0)` becomes `setTimeout(() => (ro ? $('edCancel') : $('edName')).focus(), 0)`.

- [ ] **Step 5: Run U1–U13 and the gates**

Run: `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-ux-r17-smoke.mjs && for s in hosted-smoke hosted-history-smoke hosted-polish-smoke hosted-release-smoke hosted-deliveries-smoke ui-smoke; do NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/$s.mjs || break; done && npx vitest run && npx tsc --noEmit && npx eslint src && npx next build`
Expected: all OK.

- [ ] **Step 6: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "Tidslinjen: the feature editor grouped by question with an advanced part; editors read-only for readers (R17)"
```

---

## Tasks 8–11: the four pages (subagents, in parallel with Tasks 5–7)

Each of these tasks is self-contained. The context every subagent needs:

- SkyTracker is Skytale's planning tool. Its four pages are plain HTML/JS served by Next route handlers: Tidslinjen
  (`/timeline`), Brettet (`/`, `src/app/board.html`), Inntak (`/inntak`), Kunder (`/kunder`); the login page is React.
  The pages load the shared rules `epic-tools.js` (bare globals such as `fmtDate`, `deliveryStatus`, `wireDialogs`) and the
  shared stylesheet `timeline/sky.css` (tokens, buttons, inputs, modals, `[hidden]`, `.sr-only`, `button.as-text`).
  Norwegian in the UI, English in code and commits. Text a person reads is never below 12 px (chips may be 11 px).
  Green, amber and red mean the plan's health only.
- Work only in your worktree `/Users/dnumreig/Skytale/SkyTracker-wt-r17-<page>` on branch `r17-<page>` (cut from the
  Task 1 commit). Change only the files your task lists. Never edit `sky.css`, `timeline.html`, `epic-tools.js`; never
  push; never use `master`; no Claude attribution in the commit. Commit once at the end with the given message.
- Run the gates from your worktree: `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`; and your page's smoke with
  `SKY_SRC=$PWD NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/<smoke>.mjs`.
- Report: the commit sha, the smoke's output, anything you could not do and why.

### Task 8: Brettet (spec §10)

**Files:** Modify `src/app/board.html`; test `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-board-smoke.mjs` (append B-R17 before its final close).

- [ ] **Step 1: Write the failing smoke part** (use the smoke's own `page`, `BASE` and `assert`; load `/` as a writer):

```js
// B-R17: one line of hint, empty columns that teach, the owner as initials, the ADO id as a link, headers in sentence case
await page.goto(BASE + "/"); await page.waitForSelector(".col");
const b = await page.evaluate(() => ({
  hintLines: (() => { const h = document.getElementById("hint"); return h.hidden ? 1 : Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)); })(),
  empties: [...document.querySelectorAll(".col .empty")].map((e) => e.textContent),
  dot: !!document.querySelector(".card .who-dot"), adoLink: !!document.querySelector(".card a.ado-link"), oldChip: !!document.querySelector(".card .chip.who, .card .chip.ado"),
  h2: (() => { const s = getComputedStyle(document.querySelector(".col h2")); return s.fontSize + " " + s.textTransform; })(),
}));
assert(b.hintLines === 1, "B-R17: the hint is one line: " + b.hintLines);
assert(b.empties.every((t) => t.length > 12), "B-R17: an empty column says what goes there: " + b.empties);
assert(!b.oldChip && (b.dot || b.adoLink), "B-R17: owner as initials, ADO as a link");
assert(b.h2 === "13px none", "B-R17: column headers in sentence case at 13 px: " + b.h2);
console.log("B-R17 OK");
```
If the smoke's plan has no card with an owner or an ADO id, add one to its fixture so both show.

- [ ] **Step 2: Run it to verify it fails** — `SKY_SRC=$PWD NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-board-smoke.mjs` → FAIL «B-R17: the hint is one line».

- [ ] **Step 3: Implement.**
  - The hint becomes one line: `Kolonnene er livssyklusen: dra et kort til neste kolonne, og klikk et kort for å redigere det.`
    (keep the ✕ button and its `sk.hint.board` storage).
  - Empty columns teach (in `render()`, instead of `'<div class="empty">Ingen</div>'`):
    ```js
  const EMPTY_TEXT = { ny: 'Nye features havner her når produktforum har sagt ja.', utredes: 'Dra hit for å starte en utredning med eier og størrelse.',
    klar: 'Utredet, med byggetid: venter på en epic.', aktiv: 'Dra hit for å legge featuren i en epic.', levert: 'Settes fra ADO; et kort uten ADO-kobling dras hit.' };
    ```
    → `'<div class="empty">' + EMPTY_TEXT[k] + '</div>'`, CSS `.empty{padding:12px 10px;font-size:12px;color:var(--text-3);border:1px dashed var(--line);border-radius:6px;background:var(--surface)}`.
  - Chips are for state; the owner is an initials circle and the ADO id a small link, both at the card's foot:
    ```js
    const foot = (t.assignee ? '<span class="who-dot" title="Eier: ' + esc(t.assignee) + '">' + esc(String(t.assignee).slice(0, 3)) + '</span>' : '') +
      (t.adoId ? '<a class="ado-link" target="_blank" rel="noopener" href="' + ADO_URL(t.adoId) + '" title="Åpne i Azure DevOps">#' + t.adoId + '</a>' : '');
    ```
    (remove the two `chips.push` lines for the owner and the ADO id; append `'<div class="foot">' + foot + '</div>'` after the
    chips when `foot` is not empty). CSS:
    ```css
  .card .foot{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .who-dot{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:var(--accent-soft);color:var(--text);font-size:11px;font-weight:700}
  .ado-link{font-size:12px;color:var(--ado-fg);text-decoration:none}
  .ado-link:hover{text-decoration:underline}
    ```
  - Type and headers: `.col h2{font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--text-2)}`,
    `.card .epic{font-size:12px}`, `.chip{font-size:11px}`, `.import-row .map{font-size:12px}`.

- [ ] **Step 4: Run the board smoke and the gates** → `B-R17 OK` and the smoke's earlier parts unchanged.

- [ ] **Step 5: Commit** — `git add src/app/board.html && git commit -m "Brettet: one line of hint, empty columns that teach, the owner as initials and the ADO id as a link (R17)"`

### Task 9: Inntak (spec §11)

**Files:** Modify `src/app/inntak/inntak.html`; test `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-intake-smoke.mjs` (append I-R17).

- [ ] **Step 1: Write the failing smoke part** (writer, a fresh `/inntak` with at least two «ubehandlet» wishes in the fixture):

```js
// I-R17: a segmented filter, one primary button, the forum field filled, «Senere» with undo, delete behind «⋯»
await page.evaluate(() => sessionStorage.clear()); await page.goto(BASE + "/inntak"); await page.waitForSelector(".wish");
const i = await page.evaluate(() => ({
  seg: getComputedStyle(document.getElementById("tabs")).display, onBg: getComputedStyle(document.querySelector(".filters button.on")).backgroundColor,
  pressed: document.querySelector(".filters button.on").getAttribute("aria-pressed"),
  primaries: [...document.querySelectorAll("button.primary")].filter((x) => x.offsetParent).map((x) => x.id || x.textContent),
  forum: document.getElementById("forumLabel").value, ph: document.getElementById("forumLabel").getAttribute("placeholder"),
}));
assert(i.seg === "inline-flex" && i.onBg !== "rgb(59, 118, 176)" && i.pressed === "true", "I-R17: the filter is a segmented control: " + JSON.stringify(i));
assert(i.primaries.length === 1 && i.primaries[0] === "newBtn", "I-R17: one primary button, «＋ Nytt ønske»: " + i.primaries);
assert(/^Produktforum \d+\. [a-zæøå]+$/.test(i.forum) && !i.ph, "I-R17: the forum field starts filled: " + i.forum);
const first = await page.$eval(".wish", (w) => w.dataset.id);
await page.click(`.wish[data-id="${first}"] button[data-act="senere"]`); await page.waitForSelector("#undo:not([hidden])");
await page.click("#undo button"); await page.waitForSelector(`.wish[data-id="${first}"]`);
assert((await getPlan()).wishes.find((w) => w.id === first).status === "ubehandlet", "I-R17: «Angre» puts the wish back");
assert(!(await page.$('.wish .acts > button[data-act="slett"]')), "I-R17: delete is not next to «Nei»");
await page.click(`.wish[data-id="${first}"] .row-menu > summary`); await page.click(`.wish[data-id="${first}"] .row-menu button[data-act="slett"]`);
await page.waitForSelector("#dlgBack.open"); await page.click("#dlgYes");
await page.waitForFunction((id) => !document.querySelector(`.wish[data-id="${id}"]`), first);
console.log("I-R17 OK");
```
(`getPlan()` = the smoke's own way to read the stored plan; use its helper name.)

- [ ] **Step 2: Run it to verify it fails** → FAIL «I-R17: the filter is a segmented control».

- [ ] **Step 3: Implement.**
  - The filter: in `render()` the filter buttons get `aria-pressed="true|false"`; CSS
    ```css
  .filters{display:inline-flex;gap:0;border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:12px 0}
  .filters button{border:0;border-radius:0;border-right:1px solid var(--line);background:var(--surface);color:var(--text-2);font-size:13px;padding:6px 12px}
  .filters button:last-child{border-right:0}
  .filters button.on{background:var(--raised);color:var(--text);font-weight:600}
    ```
    (replacing `.filters{…}` and `.filters button.on{…}`).
  - «Utred nå» on a row loses `class="primary"`; «＋ Nytt ønske» (`#newBtn`) stays the one primary button.
  - The forum field: `$('forumLabel').value = sessionStorage.getItem('skytracker-inntak-forum') || ('Produktforum ' + fmtDate(new Date()));`
    and the `placeholder` attribute goes from the markup.
  - «Senere» with undo: markup before `</main>`: `<div class="undo" id="undo" role="status" aria-live="polite" hidden><span id="undoText"></span> <button class="text" type="button">Angre</button></div>`;
    CSS `.undo{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:var(--text);color:var(--surface);padding:8px 14px;border-radius:6px;font-size:13px;box-shadow:var(--shadow);z-index:90} .undo button{color:var(--surface);text-decoration:underline}`;
    JS:
    ```js
  let undoTimer = null, undoId = null;
  function offerUndo(id){   // R17: «Senere» decides in one click; ten seconds to take it back
    const w = getWish(id); if(!w) return;
    undoId = id; $('undoText').textContent = '«' + w.title + '» satt til Senere.'; $('undo').hidden = false;
    clearTimeout(undoTimer); undoTimer = setTimeout(() => { $('undo').hidden = true; undoId = null; }, 10000);
  }
  $('undo').querySelector('button').addEventListener('click', () => {
    const w = undoId && getWish(undoId); $('undo').hidden = true; clearTimeout(undoTimer); undoId = null;
    if(w && w.status === 'senere' && !w.featureId){ w.status = 'ubehandlet'; ['decidedAt', 'decidedBy', 'forum', 'reason', 'owner', 'sizeClass'].forEach(k => delete w[k]); bump(w); save(); render(); }
  });
    ```
    and the list handler's `else if(act === 'senere') decide(id, 'senere', {});` becomes `else if(act === 'senere'){ decide(id, 'senere', {}); offerUndo(id); }`.
  - Delete behind «⋯»: the row's `<button class="x" data-act="slett" title="Slett ønsket">×</button>` becomes
    `<details class="row-menu"><summary title="Flere valg" aria-label="Flere valg">⋯</summary><div class="row-menu-list"><button type="button" class="danger-ghost" data-act="slett">Slett ønske …</button></div></details>`
    (the list handler already routes `data-act="slett"` to `removeWish`, which asks first); CSS
    `.row-menu{position:relative} .row-menu > summary{list-style:none;cursor:pointer;padding:4px 8px;border-radius:4px;color:var(--text-3)} .row-menu > summary::-webkit-details-marker{display:none} .row-menu-list{position:absolute;right:0;top:calc(100% + 4px);z-index:20;padding:6px;background:var(--surface);border:1px solid var(--line);border-radius:6px;box-shadow:var(--shadow)}`.
  - Type: `.chip{font-size:11px}`.

- [ ] **Step 4: Run the intake smoke and the gates** → `I-R17 OK` and the earlier parts unchanged.

- [ ] **Step 5: Commit** — `git add src/app/inntak/inntak.html && git commit -m "Inntak: a segmented filter, the forum field filled, undo after «Senere», delete behind «⋯» (R17)"`

### Task 10: Kunder (spec §12)

**Files:** Modify `src/app/kunder/kunder.html`; test `~/Skytale/ClaudeReports/planning/roadmap-2.0/build/hosted-deliveries-smoke.mjs`
(append K-R17 after D7's writer part, with two deliveries in different colours in its fixture).

- [ ] **Step 1: Write the failing smoke part:**

```js
// K-R17: attention first, the status cell says only what pulls the date, a click on the row edits, the reason under the date
await page.goto(BASE + "/kunder"); await kReady();
const k = await page.evaluate(() => ({
  order: [...document.querySelectorAll("table.lines tbody tr")].map((tr) => (tr.querySelector(".pill.st-rod") ? 0 : tr.querySelector(".pill.st-gul") ? 1 : tr.querySelector(".pill.st-gronn") ? 2 : 3)),
  why: [...document.querySelectorAll("table.lines tbody td:nth-child(6) .why")].map((e) => e.textContent),
  editButtons: [...document.querySelectorAll("table.lines button")].filter((b) => /Rediger/.test(b.textContent)).length,
  hist: [...document.querySelectorAll("table.lines a[data-hist]")].every((a) => !a.classList.contains("btn")),
  head: getComputedStyle(document.querySelector("table.lines thead th")).textTransform,
}));
assert(k.order.every((v, i, a) => !i || a[i - 1] <= v), "K-R17: red, then yellow, then green: " + k.order);
assert(k.why.every((t) => !/^(minst )?utregnet /.test(t) && !/ (før|etter) lovet/.test(t)), "K-R17: the status cell says what pulls the date: " + k.why);
assert(!k.editButtons && k.hist && k.head === "none", "K-R17: no «Rediger…», «Historikk» a link, headers in sentence case");
await page.click("table.lines tbody tr td:nth-child(3)"); await page.waitForSelector("#dlBack.open");
await page.fill("#dlPromised", "2027-03-01"); await page.waitForSelector("#dlReasonRow:not([hidden])");
assert(await page.$eval("#dlReasonRow", (r) => r.previousElementSibling.contains(document.getElementById("dlPromised"))), "K-R17: the reason sits right under the date");
await page.click("#dlCancel");
await page.click('#views button[data-v="epic"]'); await page.waitForSelector("table.epics");
const w = await page.$eval(".pill.w-tyngst, .pill.w-flere, .pill.w-lett", (e) => [getComputedStyle(e).backgroundColor, parseFloat(getComputedStyle(e, "::before").width) > 0].join());
assert(w === "rgb(241, 245, 249),true", "K-R17: weight is a neutral meter, not a status colour: " + w);
console.log("K-R17 OK");
```

- [ ] **Step 2: Run it to verify it fails** → FAIL «K-R17: red, then yellow, then green».

- [ ] **Step 3: Implement.**
  - Order: in `render()`, after `const rows = deliveryLines(state, today())`:
    ```js
    const RANK = { rod: 0, gul: 1, gronn: 2, ingen: 3 };   // R17: what needs attention first
    rows.sort((a, b) => RANK[a.status.code] - RANK[b.status.code] || (a.promisedDate < b.promisedDate ? -1 : a.promisedDate > b.promisedDate ? 1 : 0) || a.customer.localeCompare(b.customer, 'nb'));
    ```
  - The status cell's sentence is what pulls the date:
    ```js
  function pullsText(st){   // R17: the date and the deviation are in their own columns
    if(!st.by) return st.text;
    return (st.pending ? 'venter på utredning · ' : '') + 'dratt av ' + (st.by.kind === 'epic' ? '«' + st.by.name + '»' : 'release ' + st.by.name);
  }
    ```
    → `'<span class="why">' + esc(pullsText(r.status)) + '</span>'` in place of `esc(r.status.text)`.
  - A click on the row edits (writers): the customer cell becomes
    `'<td class="nm">' + (canWrite ? '<button type="button" class="as-text" data-edit="' + esc(r.key) + '">' + esc(r.customer) + '</button>' : esc(r.customer)) + '</td>'`;
    the acts cell drops `Rediger…` and its «Historikk» loses `class="btn"` (a text link, `class="hist-link"`); the list
    handler becomes
    ```js
  $('list').addEventListener('click', e => {
    if(e.target.closest('a')) return;
    const tr = e.target.closest('table.lines tbody tr[data-key]');
    if(canWrite && tr) openEditor(tr.dataset.key);
  });
    ```
    CSS `.lines tbody tr{cursor:pointer} .lines tbody tr:hover td{background:var(--raised)} .hist-link{font-size:12px;color:var(--accent-text)}`
    (readers: `.lines tbody tr{cursor:default}` via `body.ro` or by setting the cursor only when `canWrite` — add class
    `writable` to the table when `canWrite` and scope both rules to `table.lines.writable`).
  - The reason under the date: move `<div class="reason" id="dlReasonRow" hidden>…</div>` from the end of `.ed-body` to right
    after the `.ed-row` that holds `#dlPromised`.
  - The customer column keeps «Alle kunder» on one line: `.lines td.nm{min-width:120px;white-space:nowrap}`; headers
    `.lines thead th,.epics thead th{font-size:12px;letter-spacing:0;text-transform:none;font-weight:600}`.
  - Weight is an amount, not a status (spec §6, moved here from Task 4 by a ledgered ruling): replace the three weight selectors in the
    pill rules so only the status codes keep the colours, then add the meter:
    ```css
  .pill.st-gronn{background:var(--ok-bg);color:var(--ok-fg)}
  .pill.st-gul{background:var(--warn-bg);color:var(--warn-fg)}
  .pill.st-rod{background:var(--bad-bg);color:var(--bad-fg)}
  .pill.w-lett,.pill.w-flere,.pill.w-tyngst,.pill.w-ingen{background:var(--badge-bg);color:var(--text)}
  .pill.w-lett::before,.pill.w-flere::before,.pill.w-tyngst::before{height:6px;border-radius:3px;background:var(--accent)}
  .pill.w-lett::before{width:8px} .pill.w-flere::before{width:16px} .pill.w-tyngst::before{width:26px}
  .pill.w-ingen::before{width:0}
    ```

- [ ] **Step 4: Run the deliveries smoke and the gates** → `K-R17 OK`; D1–D7 still pass (they click `button[data-edit]`, which
  is now the customer's name).

- [ ] **Step 5: Commit** — `git add src/app/kunder/kunder.html && git commit -m "Kunder: attention first, the status says what pulls the date, a click on the row edits, the reason under the date (R17)"`

### Task 11: the login page (spec §13)

**Files:** Modify `src/app/login/page.tsx`, `src/app/layout.tsx`; create `src/app/login/login-copy.test.ts`.

- [ ] **Step 1: Write the failing test** `src/app/login/login-copy.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("R17: the login page speaks Norwegian and loads no unused fonts", () => {
  const page = readFileSync("src/app/login/page.tsx", "utf8"), layout = readFileSync("src/app/layout.tsx", "utf8");
  it("Norwegian copy", () => {
    expect(page).toContain("Logg inn på SkyTracker");
    expect(page).toContain("Logg inn med Skytale-kontoen din");
    expect(page).not.toMatch(/Sign in/);
  });
  it("lang nb, no Geist", () => {
    expect(layout).toMatch(/lang="nb"/);
    expect(layout).not.toMatch(/Geist/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — `npx vitest run src/app/login/login-copy.test.ts` → FAIL.

- [ ] **Step 3: Implement.** In `page.tsx` the heading stays «SkyTracker»; the line under it becomes «Logg inn på SkyTracker»
  and the button «Logg inn med Skytale-kontoen din». In `layout.tsx` remove the `next/font/google` import and the two font
  constants, set `lang="nb"` and `className="h-full antialiased"`, and set `metadata.description` to «Skytales planleggingsverktøy».

- [ ] **Step 4: Run the test, `npx tsc --noEmit`, `npx eslint src`, `npx next build`** → PASS, build OK.

- [ ] **Step 5: Commit** — `git add src/app/login/page.tsx src/app/layout.tsx src/app/login/login-copy.test.ts && git commit -m "Login: Norwegian copy, lang nb, no unused fonts (R17)"`

---

### Task 12: bring the four pages in, help texts, every smoke, screenshots

**Files:**
- Cherry-pick: the commits from `r17-brettet`, `r17-inntak`, `r17-kunder`, `r17-login`
- Modify: `src/app/timeline/timeline.html` (help cards)
- Create: `~/Skytale/ClaudeReports/planning/roadmap-2.0/pr-body-r17.md`

- [ ] **Step 1: Read and bring in each page.** For each branch: `git log --oneline feat/r17-delivery-view-ux..r17-<page>`
  (exactly one commit), `git show --stat r17-<page>` (only its files), read the diff, then
  `git cherry-pick r17-<page>` onto `feat/r17-delivery-view-ux`. A conflict means a file outside the task was touched:
  stop and redo that part here.
- [ ] **Step 2: Help texts that the design changed.** In the help cards: «Epic, måltall og måldato» — «Måldatoen tegnes som
  en stiplet loddrett strek i raden»; «Utredning og estimat» — «Utredning er grått stripet med en sluttdato»; «Status» —
  add «I dag er den mørke streken; fortiden er tonet»; «Leveranser» — «Båndet øverst har én markør per leveranse på lovet
  dato, farget etter status; <b>Mer › Per leveranse</b> viser hele leveransen.»
- [ ] **Step 3: Every smoke and every gate.**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src && npx next build
for s in hosted-ux-r17-smoke hosted-delivery-view-smoke hosted-smoke hosted-history-smoke hosted-polish-smoke hosted-release-smoke hosted-board-smoke hosted-intake-smoke hosted-deliveries-smoke ui-smoke; do
  NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/roadmap-2.0/build/$s.mjs || { echo "FAILED: $s"; break; }; done
```
Expected: every line OK, `ALL OK`.
- [ ] **Step 4: Screenshots for the PR.** Re-run the review's captures against the branch:
  `NODE_OPTIONS= npx tsx ~/Skytale/ClaudeReports/planning/ux-review-2026-10/shots-all.mjs` (writes `shots/v1/`) and compare
  with the review's «before» images; keep 1440 px Tidslinjen (epic view, «Per leveranse», forum), Kunder, Brettet, Inntak,
  the login page, light and dark.
- [ ] **Step 5: The whole-branch review** with `/review-branch` from this worktree (inline), base `origin/main`; fix what it
  finds, re-run Step 3.
- [ ] **Step 6: The PR text** `pr-body-r17.md` (Norwegian/English as earlier PR texts, no Claude mention): what changed per
  page, «Per leveranse», the tree, how it was tested, the screenshots, what waits for the product owner (the renames, one
  shared feature editor).
- [ ] **Step 7: Commit**

```bash
git add src/app/timeline/timeline.html
git commit -m "Tidslinjen: the help cards follow the new design (R17)"
git log --oneline origin/main..HEAD
```
GO pushes the branch to the fork and opens the PR.

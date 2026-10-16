# Planning system, R17: «Per leveranse», the tree in the list, and the design review

Date: 16 October 2026 · Status: for GO's review. GO 16.10 in chat: one PR, built in steps; the business case is a delivery
from Kunder; children indented under their parent with a line; up to five subagents on Opus 5.5. Sources: the design review of main 2886287
(https://claude.ai/artifact/CLqrVFGw4S6kGsaiMqE256, 15.10), GO's chat of 16.10, and R16's deliveries
(`2026-10-13-planning-system-r16-deliveries-design.md`). Branch `feat/r17-delivery-view-ux`, cut from `origin/main` 2886287.

## 0. Why

COO (EPB) plans deliveries on Kunder and reads Tidslinjen to see whether the plan keeps them. Today Tidslinjen lists
epics with their features; «Mer › Per person» lists owners with their work. COO needs the same list per business case:
each delivery with what it hangs on underneath, so the date that pulls a promise is one row away from the promise.

The design review found five bugs and proposed three design moves (one meaning per colour, a quieter chart, a real wall
mode) plus notes per page. GO 16.10: build all of it in one PR, in steps, together with the new view. GO also asked
that children in the list are indented under their parent with a line from the parent into each child, in every view.

## 1. Decided and defaults

Decided by GO 16.10: one PR, one commit per step (§15); the business case is a delivery from Kunder (no new data); the
tree in the list for every child row. Everything else below is the default unless GO says otherwise.

| ID | Choice | How |
|---|---|---|
| D1 | «Per leveranse» is a read view, like «Per person» | Editing stays on Kunder (deliveries) and in the epic view (epics) |
| D2 | One view at a time | `viewMode` = `epic` · `person` · `leveranse`; the two buttons in Mer toggle it |
| D3 | The choice is remembered per browser | `localStorage` `sk.view`, try/catch, like `sk.forum` |
| D4 | The forum view turns «Per person» and «Per leveranse» off | As R15 does for «Per person»; both buttons hidden in forum mode |
| D5 | Renames wait for the product owner | The review's word table and one shared feature editor are not in R17 |
| D6 | One shared stylesheet for the four plain pages | `src/features/timeline/sky.css`, served at `/timeline/sky.css` like epic-tools.js |
| D7 | 12 px is the floor for text a person reads | Chips and the sprint ruler stay at 11 px, the only exceptions |
| D8 | Inntak's forum field starts filled | «Produktforum 16. okt» (today) when empty; editable; no placeholder |
| D9 | Readers open editors read-only | Fields disabled, only «Lukk» and «Historikk» in the foot |

## 2. «Per leveranse»

### Rules (epic-tools.js, pure, tested)

`deliveryRows(plan, todayDay)` → `{ groups, loose }`:

- `groups`: one per delivery in the plan's order (promised day, then name — the normaliser's order). Each is
  `{ delivery, status, segment: { start, end, promised }, parts }` where `status` is `deliveryStatus` and `segment` is the
  delivery's entry from `deliverySegments`.
- `parts`: the epics and releases from `deliveryParts`, ordered by the day each is expected to finish, as the computed
  date reads it (`deliveryPartDay`): an epic's open features' latest end, the tempo forecast for a release (else its
  target), never before today. The parts that no longer pull (a closed epic, one with nothing open, a shipped release)
  come first, then by that day, then by name, so the last row is the one that pulls the date:
  - epic: `{ kind: "epic", lane, code, start, likelyEnd, end, pending, window, shared }` — `start`/`end` = the earliest
    start and latest end of the epic's features (open ones when any are open, else all), `likelyEnd` = the latest likely
    end of its estimates (else `end`), `pending` = an open discovery runs, `code` = `epicStatus(...).code`, `window` =
    `epicWindowText`, `shared` = the names of the other deliveries that hang on the same epic. No features → `start`,
    `end` null.
  - release: `{ kind: "release", release, start, end, shipped }` from the release's `releaseSegments` entry.
- `loose`: the epics no delivery hangs on, state `forslag` or `aktiv`, in the plan's order, as epic parts (`shared` empty).
  Closed epics without a delivery are left out; releases without a delivery are left out (the axis band shows them).
- Keys of since-deleted epics or releases are ignored (as `deliveryParts` does).

### Page (timeline.html)

- **Where:** «Mer › Per leveranse» (`#deliveryViewBtn`), next to «Per person». The active button is marked like
  `#personBtn.on`. The list's corner names the view and offers the way back: «Leveranse / det den henger på · Vis epics»
  (and «Person / utredninger og features · Vis epics» for Per person).
- **Group row** (the lane row): the delivery's name as a button → `/kunder#<key>`; line two: the status pill («Gul · 0,6
  uke etter», «Grønn · alt levert», «Uten dato · henger ikke på noe ennå») · «dratt av «FileVault»» (with «minst …» and
  «venter på utredning» when pending) · customers · «lovet 30. nov», so what pulls the date is in sight at the default
  width; the tooltip holds the whole line. The lane band draws the delivery's segment from
  start to computed day, coloured by status, with the promised marker — the same look as the band in the axis.
- **Part rows** (the feature rows):
  - Epic: the name as a button → the epic editor (as in the epic view). Line two: the status chip, the window («Leveres
    uke 49–51») or «Avsluttet: nådd» / «Ingen features ennå», and «også i «Proxy del 2»» when `shared` is not empty.
    The chart row draws one bar from `start` to `end`, the part to `likelyEnd` darker, coloured by the epic's status
    (grønn/gul/rød; grey for `venter`, `ingen-mal`), striped while `pending`; the epic's goal line when it has one.
  - Release: «Release 2.0.1» as a button → the release drawer. Line two: «mål 22. okt · 62 % levert · 44 % sjanse» or
    «skippet 7. okt». The chart row draws the release segment with its progress fill and tempo colour, as in the band.
- **«Ingen leveranse»** is the last group (a virtual lane without a segment), listing `loose`. With no deliveries at all it
  is the only group, and its second line reads «Ingen leveranser ennå. De lages på fanen Kunder.»
- **Read-only:** no drag, no grips, no «＋», no dependency arrows. In this view the delivery band in the axis is hidden
  (the groups show the same), so the header is one band shorter. Compare mode keeps its bar; no ghost bars in this view.
- **Help:** one sentence in the help cards «Leveranser» and the Per person card.

## 3. The tree in the list

Every child row in the list (the label column) is indented one step under its parent, and a line runs from the parent
down into each child: features under epics, work under a person, parts under a delivery, the struck-through rows of
compare mode. Sketched on the live page 16.10 (epic view, Per person, dark) before this spec was written.

- The child's text starts 44 px from the edge (the parent's at 20 px).
- A 1 px trunk at 25 px runs through the children; each child gets a 12 px elbow at its title line; the last child's
  trunk stops at its elbow. The parent gets a 7 px stub under its second line, so the line starts at the parent.
- Colour `--tree` (slate-400 light, `#4e94c4` dark); `pointer-events: none`; drop markers, hover and the grip keep working.
- The render pass sets `has-kids` on a parent with children and `kid-last` on each group's last child.

## 4. The five fixes

1. **The hidden rule:** `[hidden]{display:none !important}` in Tidslinjen's reset (comes with `sky.css`, §5). The probe
   from the review finds no element with `hidden` that still renders, for a reader or a writer, on any page.
2. **Readers' add buttons:** «＋ Epic», «＋ Release» and the «＋» on epic rows are hidden for readers, in the role block
   of `initServerPlan`.
3. **Notes:** `.md{font-size:12px;color:var(--text-3)}` once, for every helper note.
4. **Contrast (WCAG 2.2 AA, 4.5:1):** `--text-4` = slate-500 `#64748b` in light (4.76:1 on white) and `#5fa8d3` in dark
   (5.58:1 on `--surface`, 4.96:1 on `--raised`); text on the raised grey (the epic row's meta, Kunder's and Brettet's
   headers) uses `--text-2` (6.92:1), since slate-500 gives 4.34:1 there; amber text and badges (the «Lesetilgang» tag,
   the history count, «Begrunnelse mangler») use amber-700 `#b45309` (5.02:1 both ways); the primary button darkens on
   hover (`#2f5f8f`, 6.66:1). «I DAG» is fixed by §6 (today becomes ink).
5. **Keyboard and structure:**
   - Epic, feature, delivery and part names are real `<button>`s styled as text; the row click stays.
   - A bar takes focus (`tabindex=0`, `role="button"`, `aria-label` «<navn>, <datoer>»): Enter or Space opens the editor;
     for writers in the epic view ← / → moves it one week, the same change and save as a drag. Release and delivery
     segments take focus and open on Enter.
   - Modals and drawers get `role="dialog"`, `aria-modal="true"` and `aria-labelledby` (their h2); focus moves in on
     open, Tab wraps inside, Escape closes (as today), focus returns to what opened it.
   - One `<h1>` per page (visually hidden on Tidslinjen, Brettet, Inntak, Kunder: the tabs name the page), a `<main>` on
     the pages that lack it, the chart scroller takes focus (`tabindex=0`, «Tidslinjen, rull sideveis»), and the compare
     control gets a label.

## 5. One shared stylesheet and the frame

- **`sky.css`:** tokens (light and dark), the reset with `[hidden]`, body type and the type scale (12 · 13 · 14 · 16),
  buttons, inputs, chips and pills, the top bar and the tabs, the hint, modal and drawer bases, the focus ring, `.md`,
  `.sr-only`, `--tree`. Each page links it first and keeps only its own rules. Served by
  `src/app/timeline/sky.css/route.ts` (behind the login, `no-store`) from `src/features/timeline/sky.css`; the pages link
  `timeline/sky.css` (relative, as they load epic-tools.js); Tidslinjen opened from `file://` loads `sky.css` next to the
  file (a two-line loader in the head).
- **Tabs that stay put:** one size (15 px) on every page; the active tab is weight 600 with an accent underline; nothing
  moves when the page changes.
- **Titles:** «Tidslinjen – SkyTracker», «Brettet – SkyTracker», «Inntak – SkyTracker», «Kunder – SkyTracker».
- **The person and «Logg ut» on every page,** at the right end of the top bar (`/api/auth/signout`, as Brettet has it).
- **Widths:** Inntak and Kunder share 1240 px; Brettet and Tidslinjen stay full width.
- **The favicon** is ink (`#0d123e`, white in dark) instead of coral, and all four pages link it.

## 6. One meaning per colour

Green, amber and red describe the plan's health only.

- **Today** is a 2 px ink line, the past is washed (a light ink tint left of the line), and its label sits in the axis
  above the first epic: «I dag · 16. okt · Sprint 71 · dag 4».
- **Discovery** is a neutral grey hatch (slate-300 on slate-50, a slate edge); the stripes say «not estimated yet».
- **Goals** are dashed ink inside their own epic; a baseline goal is dotted.
- **Customer weight** (Kunder › Per epic) is a neutral meter: one pill, a short bar 8 / 16 / 26 px for Lett / Flere /
  Tyngst, never green/amber/red.
- **Attribute chips** («Ekstern dato», «fast dato», «i kø bak …», the progress signal) are outlines; state chips keep
  their fills, so status is the loudest thing on a row.
- Dark mode gets the same meanings with its own values.

## 7. A quieter chart (Tidslinjen)

- **No text in bars.** The name is in the list.
- **Dates once, after the bar:** estimates «9. nov → 9. des · senest 25. des», discoveries «til 6. nov». The list's
  second line drops the dates and keeps the size and the chips (in Per person: the epic, the size, the chips). Weeks
  («4–6 uker») move to the tooltip and the editor.
- **The type floor** (D7) across the chart, the list, the strip and the drawers.
- **A shorter header:** in the epic view the delivery band is one row of promised-date markers (coloured by status,
  name and sentence on hover, click → Kunder); the full rows live in «Per leveranse».
- **Help in a drawer:** «Mer › Hjelp» opens a right-side drawer (like Historikk) with the cards in one column; the hint
  above the chart is one line: «Stripet = utredning · mørk del = sannsynlig · lys del = usikker. Mer › Hjelp forklarer
  resten.»
- **The release strip leads with the chance:** «2.0.1 · 44 % sjanse til 22. okt · 62 % levert»; the tempo colour stays in
  the drawer.
- **Compare looks like the menus:** the select stays (it is keyboard-native and the smokes drive it), styled as a quiet
  menu button «Sammenlign» like ADO and Mer; its options are the baselines, the snapshots and «Dato …».
- **Proposals are not italic;** the dashed «Forslag» chip says it.
- **The history reason is a sentence** under the time, not a 10 px chip; a missing one reads «Begrunnelse mangler – legg
  til».
- **The «＋» on an epic row** shows on hover and focus (always on touch screens).

## 8. Wall mode (the forum view)

- The wall is about 1.2× larger through the size tokens (row height, lane height, month width) and the type; the page
  re-reads the tokens when the forum view toggles, so a drag still follows the pointer exactly (CSS `zoom` would not).
- The desk's write chrome is hidden for everyone: «＋ Epic», «＋ Release», «＋», grips, «Registrer ønske», the save note,
  the hint and the amber banner. The shelf keeps its placing actions for writers, because the forum decides placements
  there (R15). Readers keep one quiet «Lesetilgang» label.
- The comparison with the last forum is the headline: «Siden sist …» at 16 px, on the surface colour, with an accent
  edge, first on the page.
- Ghost bars are stronger (opacity .55 and a dashed edge) so they survive a projector.

## 9. The feature editor

- The Plan tab is grouped by question: **Når** (start; «Utredning ferdig», or «Sannsynlig» and «Senest»; buffer) ·
  **Hvem** (owner) · **Hvor sikkert** (type, discovery class, «Hent estimat fra utredningen») · **Venter på** (blockers,
  «Koble avhengighet …») · **Fremdrift** (estimates) · **Avansert** (collapsed: «Fast dato», «Følger køen»). The lifecycle
  buttons stay last.
- Readers (D9) get it read-only, and so do the epic editor and the release editor.

## 10. Brettet

- The five lines of instructions become one line, and each empty column says what goes there in its own words
  (dashed, inside the column).
- The owner is an initials circle, the ADO id a small link «#4742»; chips are for state.
- Column headers: sentence case, 13 px, the darker text token.

## 11. Inntak

- The status filter is a segmented control; primary blue is kept for the page's main action («＋ Nytt ønske»); «Utred nå»
  on a row is a normal button.
- The forum field starts filled (D8).
- «Senere» shows an undo notice for 10 seconds («Satt til Senere · Angre», `aria-live`).
- Delete moves into a «⋯» menu at the row's end («Slett ønske …», with the existing confirmation).

## 12. Kunder

- Rows that need attention come first: red, yellow, green, then «uten dato»; then promised day, then customer.
- The status cell keeps the pill and what pulls the date («dratt av «FileVault»», «minst … · venter på utredning»); the
  date and the deviation are already in their columns.
- A click on the row opens the editor (writers; the name is the keyboard target); «Historikk» is a link; the «Rediger…»
  button goes.
- «Hvorfor flyttes lovet dato?» appears directly under the date field.
- The customer column has a minimum width, so «Alle kunder» stays on one line; headers in sentence case.

## 13. The login page

- Norwegian: «Logg inn på SkyTracker» and «Logg inn med Skytale-kontoen din»; `<html lang="nb">`.
- The unused Geist fonts are no longer loaded (`layout.tsx`); the body keeps Arial.

## 14. What does not change

The plan data, merge, history, events, ADO, the investor numbers, the deliveries' rules and Kunder's editor fields. The
renames from the review's word table and one shared feature editor wait for the product owner (D5).

## 15. Steps (one commit each, in order)

1. Docs: this spec and the plan.
2. The five fixes (§4) and `sky.css` with the frame (§5) — the shared stylesheet carries the hidden rule, the tokens and
   the tabs, so it lands first.
3. The tree in the list (§3).
4. «Per leveranse» (§2).
5. One meaning per colour (§6).
6. A quieter chart (§7).
7. Wall mode (§8).
8. The feature editor (§9).
9. Brettet (§10), Inntak (§11), Kunder (§12), the login page (§13): each page on its own, built by up to four subagents
   (GO 16.10: up to five, on Opus 5.5) in their own worktrees cut from step 5, while steps 6–8 (Tidslinjen only) are built
   here; each touches only its page and its smoke, never `sky.css`; reviewed and cherry-picked here.
10. Help texts, smokes, screenshots.

## 16. Verification

- `npx vitest run` (`deliveryRows` and any new pure helper), `npx tsc --noEmit`, `npx eslint src`, `npx next build`.
- New Playwright smokes in `ClaudeReports/planning/roadmap-2.0/build/`: `hosted-delivery-view-smoke.mjs` (the toggle,
  groups and parts, order, «Ingen leveranse», shared epic, links to Kunder, the epic editor and the release drawer,
  remembered on reload, forum turns it off, reader) and `hosted-ux-r17-smoke.mjs` (the hidden probe is empty for a reader
  and a writer on all four pages; Tab reaches a feature and Enter opens its editor; focus stays in a modal and returns;
  axe finds no contrast, landmark, heading or label violations; the tree classes; the tabs don't move; the forum shows no
  write controls).
- Every existing smoke passes, updated where a selector changes (help drawer, compare menu, editor groups, Brettet's
  chips, Inntak's row menu, Kunder's row click).
- Before/after captures with the review's scripts for the PR text.

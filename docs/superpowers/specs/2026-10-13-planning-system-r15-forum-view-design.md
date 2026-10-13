# Tidslinjen: the forum view, the shelf as a side panel and «Siden sist» on top (R15)

Date: 13 October 2026 · Status: approved for building (GO, 13.10: «Vi kan bygg UX trinn 2», after the order agreed the same
morning: R13 → UX steps 1 + 3 → COO draft → UX step 2 before the November forum → the COO layer).
Source: the UX review of 12 October (section 13 of «Tidslinjen som planleggingssystem», part B: «Forum-visning: skjermen
på veggen i produktforum»). Builds on `2026-10-13-planning-system-r14-topbar-editor-design.md` (branch `feat/ux-topbar-r14`,
PR #21).

## 0. Why

The product forum works on one screen on the wall. Today that screen is the development lead's screen: the shelf «Klar
for veikart» lies under the chart, a screen away from the epics the forum drags its features into; what moved since the
last forum is hidden behind «Sammenlign med …»; and the ADO and JSON actions, «Per person» and the sprint mix are the
development lead's tools, not the forum's. Section 13 B asks for one switch that turns the page into the forum's screen
and back, without changing what the page can do.

## 1. Scope

Step 2 (B) of the review's order: the switch «Forum», the shelf as a side panel, the «Siden sist» strip on top. Nothing
from C (the layers over the plan, the COO layer). No data model change. No ADO write. No change to Brettet or Inntak.

## 2. One switch, «Forum»

- **The button** `Forum` sits in the top bar between the «Mer» menu and «＋ Release», for everyone (readers too: it is a
  view, not an edit). It is a toggle (`aria-pressed`), filled with the accent colour when on, like «Per person» was.
- **Remembered in the browser:** `localStorage` key `sk.forum`, `"1"` on, `"0"` off, guarded by try/catch like the hint.
  Without a stored choice the default follows the role once the plan has loaded: **on for readers**, off for writers.
  A stored choice wins over the default. Opened from `file://` the switch still lays the page out; there is no plan
  server, so no compare.
- **On, the page hides the development lead's tools:** the ADO menu and the ADO link in the status strip; in «Mer»:
  «Per person», «Eksporter (JSON)», «Importer (JSON)» and «Sprintmiks». «Merk baseline…», «Investorer» and «Hjelp» stay.
  The hiding is a class on `<body>` (`forum`) and CSS, never the `hidden` attribute, so the role rules (which set `hidden`)
  are untouched and come back unchanged when the switch goes off. «Per person» is a read view the forum does not use: if
  it is on when the switch turns on, it is turned off.
- **On, «Siden sist» goes on top:** the compare bar (`#cmpBar`, with the strip, «Siden sist», «Eksporter», «Sprintrapport»
  and «Avslutt sammenligning») and its list (`#cmpList`) move above the status strip, under the top bar; off, they move back
  to their place under the help panel. If no compare is running when the switch turns on, the page starts one against the
  **newest baseline of kind `baseline`** (the last product forum's «Merk baseline…»), so the strip reads «Siden produktforum
  5. nov: 2 måldatoer flyttet · 1 spenn utvidet · 1 feature byttet epic» and the ghost bars show where things stood. The
  select «Sammenlign med …» shows that baseline. A compare the switch started ends when the switch goes off; a compare the
  person started before stays. «Avslutt sammenligning» works as before and does not restart.
- **No baseline yet:** a note in the bar's place, `#forumNote`: for writers «Ingen baseline fra et produktforum ennå. Merk
  én under Mer › Merk baseline… når forumet er ferdig; neste gang viser denne stripen hva som har flyttet seg.», for readers
  the first sentence only. Hidden as soon as a baseline exists or the switch is off.
- **Outside the forum everything is as today.** The board stays the developers' view.

## 3. The shelf as a side panel

- `#gantt` and `#shelf` get one wrapper, `div.stage#stage`. Off, the wrapper is a plain block and nothing moves. On, and
  when the shelf is shown (class `with-shelf` set by `renderShelf` from the shelf's own `hidden`), the wrapper is a grid:
  the chart on the left (`minmax(0, 1fr)`, so the month scroll keeps working), the shelf on the right, 300 px, sticky under
  the top bar with its own scroll, so the forum drags from the shelf into an epic without scrolling the page.
- **In the panel the shelf is the same shelf:** the three groups (Registrert, Utredes, Klar for veikart) with their counts,
  the rows with grip, name, state text and the actions, the price preview on «Legg i epic …», «＋ Registrer ønske». The
  rows stack name and state text on two lines so they fit 300 px; the actions sit under the state text on hover. The head's
  collapse click works as before.
- **A tip at the bottom of the panel** for writers when the shelf has rows: «Dra inn i en epic. Prisen vises først.»
  (`#shelfTip`, forum only).
- Light and dark mode as today. At 1100 px the chart keeps the label column and scrolls; the forum wall is wide.

## 4. What does not change

Plan JSON, events, routes, the status strip's words (R14), the compare's strip and export (the server's), the shelf's
actions and dialogs, the board's and intake's pages, the help panel's content except one sentence in «Hylla og
livssyklusen» (the switch exists and what it does).

## 5. Verification

- vitest: `forumBaseline(snapshots)` (the newest `baseline` by `at`, sprint snapshots ignored, `null` when none);
  `forumDefault(stored, canWrite)` (`"1"` → on, `"0"` → off, else on for readers, off for writers).
- Smokes (ClaudeReports/planning/roadmap-2.0/build): history: a reader without a stored choice lands in the forum view
  (body class, the bar on top with the baseline from S9, Eksporter hidden by CSS while Hjelp shows), switches it off and the
  choice sticks across a reload; a writer switches it on with rows on the shelf: the stage is a two-column grid, the shelf
  stands beside the chart with the tip, «Per person» went off, the bar is above the status strip and «Siden sist» opens
  the list, a reload keeps it on and restarts the compare, off puts the bar back under the help panel and ends the compare.
  Screenshot of the forum view. The other smokes run unchanged (writers without a stored choice).
- `tsc --noEmit`, `eslint src`, `next build`.

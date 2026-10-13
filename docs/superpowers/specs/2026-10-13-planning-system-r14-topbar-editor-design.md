# Tidslinjen, Brettet, Inntak: one top bar, a status strip in words, the editor in two tabs (R14)

Date: 13 October 2026 · Status: approved for building (GO, 13.10: «bra la oss bygge», after the order agreed the same
morning: R13 → UX steps 1 + 3 → COO draft → UX step 2 before the November forum → the COO layer).
Source: the UX review of 12 October (section 13 of «Tidslinjen som planleggingssystem», parts A and D). Builds on
`2026-10-13-planning-system-r13-lifecycle-transitions-design.md` (branch `feat/lifecycle-r13`, PR #20).

## 0. Why

The first product forum (12.10) showed three things about the screens: three entrances with no common navigation
(«← SkyTracker», «Inntak», «Tidslinjen» change place and name from page to page); a top bar of twelve buttons that
breaks on a laptop, where the forum needs three of them; and a status that is numbers without words («● 0 ● 1 ● 0 ·
6 venter»), hidden to the right in the legend, with the next release in no summary. Smaller: the yellow ADO bar takes a
whole row for everyone; the feature editor has seventeen fields in one column and two of them are called «Type»; the
hint under the title shows on every load; the release line down through the chart has no label at the bottom.

## 1. Scope

Step 1 (A) and step 3 (D) of the review's order. Nothing from B (the forum view, the shelf as a side panel) or C (the
layers over the plan, the COO layer). No data model change. No ADO write.

## 2. One top bar on three pages (A)

- **Tabs in the process order:** `Inntak · Tidslinjen · Brettet` on the left of the top bar on all three pages, the
  active one marked (`class="on"`, `aria-current="page"`). The page's name is the active tab, so the `<h1>` goes.
  Hrefs: `/inntak`, `/timeline`, `/` (the board is served at `/`). The tabs come from one shared builder,
  `navTabsHtml(active, hosted)` in `epic-tools.js`, so the three pages cannot drift. Opened from `file://` (the ui smoke,
  the theme shots), only the active tab shows: the others would point nowhere.
- **The right side, Tidslinjen:** visible: `Sammenlign med …` (select + date), `Historikk` (with its badge), `＋ Release`,
  `＋ Epic`. Two menus: **ADO ▾** (writers only) with `Hent fra ADO`, `Oppdater fra ADO`, `Konflikter (N)`; **Mer ▾**
  with `Per person`, `Merk baseline…`, `Eksporter (JSON)`, `Importer (JSON)`, `Sprintmiks` (the select), `Investorer`,
  `Hjelp`. Every button keeps its id and its role rule (readers do not get baseline, import, the mix or the ADO menu);
  no button disappears, it gets an address. The menus are `<details>` elements: keyboard-reachable without script;
  a click on an item, a click outside or Escape closes them. The ADO menu's summary carries a dot when a login is needed
  or conflicts exist.
- **The right side, Brettet and Inntak:** unchanged (the board: card import, «＋ Registrer ønske», «Logg ut»; the intake:
  «＋ Nytt ønske»), plus the shared tabs on the left. The three pages share the same `.topbar` CSS already.
- **The status strip in words** replaces the counters and the sprint goal in the legend. One row under the top bar:
  1. epics: `epicStatusWords(plan)` → «6 aktive epics · 2 grønne · 1 gul · 1 rød · 3 venter på utredning · 2 forslag»
     (counts over the active epics; zero parts left out; singular/plural in Norwegian: grønn/grønne, gul/gule, rød/røde;
     «Ingen epics ennå» for an empty plan);
  2. the next release, as R11/R12 already word it («Neste release 2.0.1 om 10 dager · 31 % · 44 % sjanse», tempo dot);
  3. the sprint and its goal («Sprint 71 · dag 1 · mål: Tråder i beta»), clickable for writers as before (`#sprintGoal`);
  4. ADO, writers only, as a link, never a bar: «ADO: logg inn på nytt» (to `/login?callbackUrl=/timeline`) when the
     token is gone, «ADO: 2 konflikter» when something changed in ADO after the last push. The link toggles the existing
     conflict list under the strip; the ADO menu's «Konflikter (N)» does the same. The yellow `#adoBar` and its
     «Skjul» go.
- **The legend** keeps only the swatches (Utredning, Sannsynlig, Usikker del, Måldato, I dag, Release, Avhengighet).
- **The hint** under the title (all three pages) gets a close «✕»; closed once, it stays closed in that browser
  (`localStorage` key `sk.hint.<page>`; a storage error just shows it). Tidslinjen's hint says «Trykk Mer › Hjelp for bruk».
- Light and dark mode as today.

## 3. The editor in two tabs and the small things (D)

- **The feature editor (Tidslinjen):** name and epic stay on top. Then two tabs, **Plan** and **Om featuren**.
  Plan: utredning/estimat (`#edKind`), start, class or span, owner, buffer, fast dato, følger køen, «Hent estimat fra
  utredningen», fremdrift, blokkere («Koble avhengighet …») and the lifecycle row from R13. Om featuren: description,
  **Art** (the second «Type»: feature, teknisk, vedlikehold; ids unchanged), flater, ADO-id, spec-mappe. The push row
  («Lagre og push til ADO», «Lagre og tørrkjør») sits under both tabs, always visible when it applies. The editor opens on
  Plan. The board's card editor is not changed (it has nine fields).
- **The release band:** the segment shows version and date when there is room, else the version alone with the date in
  the tooltip and the drawer, as today. The **release line** down through the chart gets the version as a label at the
  bottom of the chart (`data-v` on the line, drawn by CSS), so far down the plan the dashed line has a name.
- **The drawer's «Oppdater fra ADO» reads only this release:** `POST /api/ado-releases` with `{ "release": "<key>" }`
  refreshes that release's label and nothing else (`refreshReleases(plan, client, now, { only: key })`); without a body
  it reads all, as the six-hour auto-read does. The page's top-level «Oppdater fra ADO» still reads the whole plan.

## 4. What does not change

Plan JSON, events, routes other than the `ado-releases` body, the board's and intake's own actions, the help panel's
content (one sentence updated: Hjelp lives under Mer, the status in the strip), the smokes' coverage (their selectors
move with the buttons).

## 5. Verification

- vitest: `navTabsHtml` (order, active, hrefs, `file://`), `epicStatusWords` (plural forms, zero parts, empty plan,
  forslag), `refreshReleases` with `only` (the other release untouched, one query).
- Smokes (ClaudeReports/planning/roadmap-2.0/build): hosted (the tabs instead of the back link), history (the menus
  before baseline, refresh, mix, investors; the ADO link instead of the bar; the editor's tabs before spec/pull),
  polish (the ADO menu before import), release (the drawer's refresh posts to `ado-releases` with the key; the line's
  bottom label), intake (the tab instead of the link), board (the tabs), ui + theme shots (`file://`: only the active
  tab; Hjelp under Mer). Screenshots of the top bar at 1280 px and the editor's two tabs.
- `tsc --noEmit`, `eslint src`, `next build`.

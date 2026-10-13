# Planning system, R16: Leveranser (the COO layer over epics and releases)

Date: 13 October 2026 · Status: approved for building (GO, 13.10: «yes da er det bare å bygge», after GO answered the
draft's questions on COO's behalf the same evening). Source: COO's two messages of 13.10 (via GO), the draft
`ClaudeReports/planning/roadmap-2.0/coo-leveranser-spec-utkast.md` and the page «Leveranser i Tidslinjen»
(https://claude.ai/artifact/SeVuPXTttkKRfz3KKGNxzT). Builds on R10–R12 (releases), R14 (the top bar) and R15 (the
forum view). Branch `feat/deliveries-r16`, cut from `feat/ux-forum-r15` because PR #22 is in review; rebased onto
`origin/main` after #22 lands.

## 0. Why

COO plans deliveries to customers: «Skytale 2.0» is one because it hits every customer; proxy has one customer waiting,
video 1 → many has several. COO wants to bind epics and bugs to one or more deliveries, set a deadline per delivery and
see whether the plan keeps it. Tidslinjen has the epics (with windows) and the releases (with target days, tempo and
chance); what is missing is the layer above them: customers as stakeholders and a promised date per delivery, with the
computed date read from what the delivery hangs on.

## 1. What a delivery is

- **A delivery** has a name, stakeholders (named customers, or all customers), a promised date (COO's), an owner
  (COO by default), the epics and the releases it hangs on, and a note. COO's word «leveranse»; a release stays a
  version we ship.
- **A delivery line** is one customer waiting for one epic through a delivery. Lines are not stored: they follow from
  the delivery's customers × its epics. «Alle kunder» is one line that counts as all. The number of lines on an epic is
  the priority signal: one is light, several are many stakeholders, all customers is the heaviest.
- **Bugs come in through the releases** (the release label in ADO), never one by one. The open bugs and stories in the
  releases' sprints that carry no label yet count as «uten release-label» on the delivery, so the deadline covers the
  whole backlog. Skytale.QA stays the bug truth.
- **Epics stay PM's and CTO's.** COO picks which epics a delivery hangs on: proposals, active ones and closed ones
  («Proxy del 1» was part of Skytale 2.0 and is delivered). Dependencies between epics are derived from the features as
  today; «binding with a dependency» is hanging epics and releases on the delivery. No new dependency type.
- **No alert** (GO 13.10). Management checks the status themselves: the colour on the band and the row in «Kunder» say
  what pulls the date.
- **Nothing is written to ADO.** Deliveries exist only in Tidslinjen, with history like everything else.
- **Outside:** meetings, documents and tasks per customer live in Teams and HubSpot; bug lists per customer in
  Skytale.QA.

## 2. Data (plan JSON, `TimelinePlan.data`)

```
Delivery = { key, v, name, customers: string[], allCustomers?: true, promisedDate (YYYY-MM-DD), owner?, note?,
             epics: string[] (lane keys), releases: string[] (release keys) }
plan.deliveries: Delivery[]            whole-object versioning like releases (`v`)
plan.deletedDeliveries: { key: v }     tombstones like `deletedReleases`
```

The normaliser (`epic-tools.js`) drops a delivery without a key, a name (≤ 120 chars) or a valid promised day; keeps
`customers` as trimmed, distinct, non-empty strings (≤ 60 chars each, at most 50; empty when `allCustomers`); keeps
`epics` and `releases` as distinct non-empty strings (a key of a since-deleted epic or release stays in the data and is
ignored when read, so another person's delete never rewrites COO's delivery); keeps `owner` (≤ 60) and `note` (≤ 2000)
only when non-empty; sorts by promised day, then name. `mergePlans` unions deliveries by key like releases (higher
version wins, incoming wins ties, tombstones remove unless bumped past). The export and the import (JSON) treat
deliveries like releases.

## 3. Rules (epic-tools.js, pure, tested)

- `DELIVERY_OWNER = "COO"`; `deliveryOwner(d)`; `deliveryCustomersText(d)` → «alle kunder» · «Kunde A, Kunde B» ·
  «ingen kunder».
- `deliveryParts(plan, d)` → `{ epics: PlanLane[], releases: Release[] }`, existing ones only, in the plan's order.
- `deliveryComputed(plan, d, todayDay)` → `{ day, by, pending, open }`: the **computed date** is the latest of the
  epics' late ends (the latest `end` of each open epic's features, as a day; a closed epic or one without features gives
  nothing) and the releases' expected finish (`releasePace(...).forecastDay` when the release has a tempo, else its
  target day; a shipped release gives nothing). `by` names the part that gives the date (`{ kind: "epic" | "release",
  key, name }`); `pending` is true when an open epic still has a discovery (the date is a floor, not an estimate);
  `open` counts the parts still open. `day` is null when nothing is open.
- `deliveryStatus(plan, d, todayDay)` → `{ code, computed, by, pending, deltaDays, weeks, text }`. `code`: `ingen` when
  the delivery hangs on nothing (text «henger ikke på noe ennå»); `gronn` when everything it hangs on is closed or
  shipped («alt levert»); otherwise the release rule against the promised day: `gronn` when the computed day is on or
  before it, `gul` up to three working days after, `rod` later. `deltaDays` = working days after (+) or before (−) the
  promise; `weeks` = calendar days / 7, one decimal. `text` reads «utregnet 11. des · 1,5 uke etter lovet · dratt av
  «FileVault»» / «utregnet 13. nov · 1 uke før lovet · dratt av release 2.0.2» / «utregnet 30. nov · på lovet dato · …»;
  with `pending`: «minst 11. des · venter på utredning · …».
- `deliveryUnlabelled(plan, d)` → the open bugs and stories without a release label in the sprints of its releases
  (the highest `unlabelled` any of its releases reports per sprint name, summed over sprints).
- `deliveryBugsLeft(plan, d)` → distinct open Bug items (not Resolved/Closed) across its releases.
- `deliveryLines(plan, todayDay)` → one row per customer of each delivery (one row «Alle kunder» when `allCustomers`,
  one row «ingen kunder» when none), with the delivery, the parts text («Release 2.0.1 · release 2.0.2 · FileVault»),
  the promised day and the status.
- `epicCustomers(plan, laneKey)` → `{ all, names, count, deliveries }`: the customers waiting on the epic through any
  delivery; `all` when any of them is for all customers. `epicCustomersText(c)` → «alle kunder» · «3 kunder» · «1 kunde»
  · «». `epicWeight(c)` → `{ code: "tyngst" | "flere" | "lett" | "ingen", label }` = «Tyngst» · «Flere interessenter» ·
  «Lett å prioritere» · «Ingen kunder venter».
- `deliverySegments(plan, todayDay)` → one segment per delivery for the band: `start` = the earliest feature start
  among its epics, else the earliest segment start of its releases, else today; `end` = the computed day, else the
  promised day; at least half a week wide; `promised` as a unit; the status.
- `deliveryInvestor(plan, d, todayDay)` → the five numbers: promised, computed, deviation in weeks, epics closed of
  total, bugs left in scope, plus the colour and what pulls the date.
- `navTabsHtml` gets a fourth tab «Kunder» (`/kunder`) after Brettet.

## 4. Events (events.ts, history.ts) and compare

Target type `leveranse`, label «Leveranse Skytale 2.0»: `leveranse.ny` «Ny leveranse «Skytale 2.0» · lovet 30. nov ·
alle kunder» · `leveranse.slettet` «Leveranse slettet: «Skytale 2.0»» · `leveranse.navn` · `leveranse.lovet` «Lovet dato:
30. nov → 11. des» (asks for a reason, like a release's target day) · `leveranse.kunder` «Kunder: Kunde A → Kunde A,
Kunde B» · `leveranse.epics` «Henger på epic «FileVault»» / «Epic «FileVault» tatt av» (one per change) ·
`leveranse.releaser` «Henger på release 2.0.1» / «Release 2.0.1 tatt av» · `leveranse.eier` · `leveranse.notat`. Compare
mode counts them as «N leveranse(r) endret» and exports them under «Leveranser». The history drawer shows them as any
other target.

## 5. Pages

### «Kunder» (`/kunder`, `src/app/kunder/kunder.html`, a route like Inntak's)

COO's own page: the fourth tab. The same plan API, merged on the server; readers see everything, writers edit.

- **Per kunde** (default): one row per delivery line: Kunde · Leveranse · Henger på (the epics and releases, «· 3 uten
  release-label» when any) · Lovet · Utregnet · Status (a coloured pill «Rød · 1,5 uke etter» and the sentence: what
  pulls the date) · «Rediger…» for writers. A delivery's rows are highlighted when the page opens on `#<key>` (the band's
  link).
- **Per epic**: one row per epic that any delivery hangs on: Epic · Linjer (count or «alle») · Kunder som venter ·
  Tyngde (the pill) · Leveres (the epic's window). Epics no delivery hangs on are listed last with «Ingen kunder venter».
- **The editor** (writers, «＋ Leveranse» and «Rediger…»): Navn · Kunder (one per line or comma-separated) · «Alle
  kunder» · Lovet dato · Eier · Henger på: epics (checkboxes, every epic with its state; closed ones marked «avsluttet»)
  · releaser (checkboxes, shipped ones marked «skippet») · Notat · «Slett leveranse…» (confirm). Moving the promised day
  of a saved delivery shows «Hvorfor flyttes lovet dato?» with the reason codes and a text; the reason rides on the
  save (`note.reason`, `note.reasonCode`); without one the history marks it as missing, as everywhere else.
- **Empty:** «Ingen leveranser ennå.» and for writers «Opprett den første med ＋ Leveranse: navn, kunder, lovet dato og
  det den henger på.»
- The hint (closes once per browser, `sk.hint.kunder`): what the page is, the colour rule, and that there is no alert.

### Tidslinjen

- **The band «Leveranser»** in the axis above the release band: one row per delivery (the axis grows 18 px per row,
  `--axis-h` on the chart; the corner, the grid, the today line and the release lines follow). A segment from the
  delivery's start to its computed day (the promised day when there is nothing to compute), coloured by status, with
  the name, the customers and «utregnet 11. des» when wide enough; a marker at the promised day; the status sentence in
  the tooltip. Click → `/kunder#<key>`. Legend swatch «Leveranse». Visible in the forum view.
- **The epic row** gets the chip «alle kunder» / «3 kunder» / «1 kunde» after the state chip, with the deliveries in the
  tooltip, only when a delivery hangs on it.
- **The investor drawer** gets «Leveranser» between «Planen nå» and «Gjennomføringsevne»; the route's markdown and slide
  get the same section (one line per delivery with the five numbers).
- **Importer (JSON)** treats deliveries like releases. A help card «Leveranser».

## 6. What does not change

Epics, features, releases, the shelf, Brettet, Inntak, ADO (nothing read or written for deliveries), notifications
(none for deliveries), the status strip, the sprint report.

## 7. Verification

vitest (epic-tools, merge, events, compare, investor), `tsc --noEmit`, `eslint src`, `next build`; a new Playwright smoke
`hosted-deliveries-smoke.mjs` (the Kunder page: create, edit with a reason, per-epic view, reader, delete; Tidslinjen:
the band, the chip, the link, the investor section) plus the existing smokes unchanged (the tabs now count four).

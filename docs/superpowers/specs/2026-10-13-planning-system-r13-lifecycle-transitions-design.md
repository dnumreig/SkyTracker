# Planning system, R13: the transitions the lifecycle lacked

Amendment to `2026-10-09-planning-system-r7-r9-design.md` (the lifecycle and the shelf) and the board (R9). Ordered by GO on
13.10.2026 after the first week of use: delivered features sat on the shelf as «Klar for veikart» and could not be closed, a
feature that needs a new discovery could not go back to «Utredes», and a discovery could not be placed in an epic from the
shelf's buttons or from the board.

## What R13 fixes

1. **Delivered features never sit on the shelf.** The shelf holds what waits for a place in an epic. A delivered feature
   without an epic (the old board's completed cards) was listed under «Klar for veikart» because the shelf took every task
   on the backlog lane. `shelfTasks` leaves delivered features out; the board's «Levert» column still shows them.
2. **Delivery by hand, only without ADO.** Delivery of a feature with an ADO id stays ADO's («Oppdater fra ADO» reads
   Resolved/Closed; the push never writes a state for a delivered feature). A feature without an ADO id that is not yet
   delivered can be marked delivered by a writer, with the day it was delivered: today by default, never a day ahead. A
   discovery marked delivered becomes an estimate whose end is its span, as the card import does. The change is logged as the
   state event «Levert 7. okt · uten ADO», and the note line «<feature>: markert levert 7. okt uten ADO» goes to the
   changeset's reason dialog, as placing in an epic does.
   - Tidslinjen: the editor's footer gets «Marker levert …» (writers, unlinked, not delivered); a «Klar for veikart» row on
     the shelf gets «Levert …» when the feature is unlinked.
   - Brettet: dropping a card on «Levert» opens the same dialog when the feature is unlinked; a linked card gets the toast
     «#4486 er koblet til ADO: lukk den der, så henter «Oppdater fra ADO» leveringen.»
3. **Back to discovery.** An estimated feature in «Klar for veikart» or «Aktiv» can go back to discovery. It reopens the
   «Start utredning» dialog (owner, class, end day, and from R13 the epic). The feature becomes a discovery in «Utredes», in
   its epic if it had one (the epic then shows «Venter på utredning»); the promised span is dropped (the normaliser clears
   `committedRange` and `activatedAt`); the raw estimate stays for the next «Klar for veikart». Logged as «Tilbake til
   utredning (til 6. nov)».
   - Tidslinjen: the shelf's «Klar for veikart» row gets «Tilbake til utredning»; the editor's footer gets «Tilbake til
     utredning …» for an estimated feature in «Klar for veikart» or «Aktiv».
   - Brettet: a card is dragged from «Klar for veikart» or «Aktiv» to «Utredes».
4. **Discoveries in epics.** The data model always allowed it (an epic with a discovery shows «Venter på utredning»; «Hent fra
   ADO» places a Discovery feature under its parent); only the buttons were missing.
   - The shelf's «Utredes» row gets «Legg i epic …» beside «Klar for veikart»: the same dialog and price preview; the
     discovery stays «Utredes» inside the epic.
   - «Start utredning» (both pages) gets an «Epic» choice: «Hylla» by default, or any epic that is not closed; the current
     epic is preselected when the feature already sits in one. The feature moves there when the discovery starts.
   - Brettet's card editor gets an «Epic» field with the same rule as Tidslinjen's editor: an estimated feature from the
     shelf into an epic becomes «Aktiv» with the promised span; into the shelf it becomes «Klar for veikart»; a discovery
     keeps «Utredes». The columns stay as they are: a shelf discovery dropped on «Aktiv» gets the toast «Utredningen ligger
     på hylla: velg epic i «Rediger kort», eller gjør den klar for veikart først.»

## Data

No new fields. `deliveredAt` (state group) carries the day; `lane` (meta) the epic.

## Rules (epic-tools.js, pure, tested; globals on both pages)

- `canMarkDelivered(t)`: `!t.adoId && t.state !== "levert"`.
- `markDelivered(t, day)`: `state = "levert"`, `deliveredAt = day`; a discovery becomes an estimate with `endLikely = end`.
  Returns the field groups touched (`["state"]`, or `["state", "meta", "tid"]` for a discovery).
- `canRestartDiscovery(t)`: `t.kind === "estimate" && (t.state === "klar" || t.state === "aktiv")`.
- `applyLaneChange(t, laneKey, todayDay)`: the lane rule both pages share. Sets `lane`. An estimated feature (not `ny`, not
  delivered) entering an epic from the shelf becomes `aktiv` with `committedRange = { likely, late, start }` from
  `rangeWeeks(t)` and `activatedAt = todayDay`; an `aktiv` feature moved to the shelf becomes `klar` and drops both; any
  other case keeps its state. Returns the groups touched (`[]` when the lane is unchanged, else `["meta"]` or
  `["meta", "state"]`). Order inside the lane is the page's (`moveTask` on Tidslinjen, `setLane` on the board).
- `boardColumn(t)`: `levert` · `ny` · `utredes` · `klar` (estimate on the shelf) · `aktiv` (estimate in an epic).
- `featureTransition(t, to)`: never to `ny`, never from `levert`, never to the same column; to `levert` = `canMarkDelivered`;
  `ny → utredes`; `utredes → klar` on the shelf, `utredes → aktiv` in an epic; `klar → aktiv | utredes`;
  `aktiv → klar | utredes`.
- `shelfTasks(plan)`: tasks on the backlog lane whose state is not `levert`.
- `events.ts` `stateSummary`: `utredes` reached from `klar` or `aktiv` reads «Tilbake til utredning (til <day>)»; `levert`
  without an ADO id reads «Levert <day> · uten ADO».

## Verification

vitest (epic-tools: the rules above and the shelf; events: the two wordings), `tsc --noEmit`, `eslint src`, `next build`;
Playwright `hosted-polish-smoke.mjs` P12–P14 (the shelf's «Levert …», «Tilbake til utredning» with the epic choice,
«Legg i epic …» on a discovery; the editor's «Marker levert …» with a refused future day and a linked feature without the
button) and `hosted-board-smoke.mjs` B11–B13 (the drop on «Levert» for an unlinked and a linked card, back to «Utredes» from
«Klar for veikart» and «Aktiv», the editor's «Epic» field for a discovery and an estimate, the toast for a shelf discovery
dropped on «Aktiv»), plus the existing smokes.

# Planning system, R18: a release in two phases (development, then QA)

Date: 16 October 2026 · Status: for GO's review. GO 16.10 in chat: ADO now has the states Codereview (in progress),
Develop and QA (both resolved) for stories and bugs; a release has two estimated dates, the handover to QA (set by the
development lead) and the release (set by Operations); releasing is a manual decision after QA's approval, with possibly
several prod builds, so «sluppet» is a manual tick; «Ja, skriv spec for R18 i samme PR». Builds on R10 (releases), R11
(progress and tempo), R12 (the chance) and R16 (deliveries). Same branch and PR as R17 (`feat/r17-delivery-view-ux`).

## 0. Why

The release drawer is imprecise since the new ADO states. SkyTracker counts a story or bug as done only when its state is
named «Resolved» or «Closed» (`releases.ts`, `forecast.ts`, `sync.ts`, `epic-tools.js`). Items in Develop or QA count as
not done, so the share delivered, the burndown, the tempo, the chance and feature progress from stories are all too low.

And a release is two steps, not one. Development ends when everything is merged to develop and the build is ready for
QA; QA ends when QA approves and the release process ships it. Each step has its own estimated date and its own owner.
The drawer shows one line toward one date.

## 1. Decided and defaults

Decided by GO 16.10: two estimated dates per release, «Klar for QA» (development lead) and «Release» (Operations);
«Sluppet» is set by hand. The rest is the default unless GO says otherwise.

| ID | Choice | How |
|---|---|---|
| D1 | State categories, never state names | Each read asks ADO which category every Bug and User Story state is in |
| D2 | «Utviklet» = category Resolved or Completed; «Lukket» = Completed | Develop, QA, Resolved and Closed are developed; Closed is closed |
| D3 | «Klar for QA» is a new date; «Release» is today's target date | `qaDate` on the release; `targetDate` keeps its meaning and gets the label «Release» |
| D4 | «Sluppet» is today's `shippedDate`, set by a button | «Marker sluppet …» in the drawer (writers), the day defaults to today; the items not closed then are kept as «åpne ved release» |
| D5 | The chance (R12) is for the development phase | The probability that everything is developed by «Klar for QA» (by «Release» when no QA date is set) |
| D6 | A late handover pushes the expected release by as much | Expected release = «Release» + the working days development runs past «Klar for QA»; deliveries and the band use it |
| D7 | Releases without «Klar for QA» stay one phase | Everything reads as today until someone sets the date |
| D8 | Moving «Klar for QA» later asks why, like the release date | Event `release.qa`, the same reason codes |
| D9 | «levert» becomes «utviklet» or «lukket» where it means one of them | The strip, the drawer and the band say which |

## 2. ADO state categories

- **Client:** `states(type)` → `GET {project}/_apis/wit/workitemtypes/{type}/states?api-version=7.1` → `[{ name, category }]`
  (category: Proposed · InProgress · Resolved · Completed · Removed).
- **The read-back** (`releases.ts`, every refresh) asks for «Bug» and «User Story» once, builds `name → category`, and
  stores `category` on each `ReleaseItem`. `releaseDelivered` (the day an item was developed) takes `ResolvedDate` for an
  item in Resolved or Completed (ADO stamps it on entering a Resolved-category state), else `ClosedDate`.
- **The forecast** (`forecast.ts`): the pace query selects bugs and stories with a `ResolvedDate` in the two last sprints
  (no state names), and the pace pool keeps those whose state is Resolved or Completed by the same map.
- **Feature progress from stories** (`sync.ts`): points done = stories in Resolved or Completed, by the map, fetched once per
  sync.
- **Fallback:** when the states call fails, the names Resolved and Closed count as before, and the drawer says «Fant ikke
  ADO-tilstandene: teller Resolved og Closed». Items stored before R18 have no `category` and fall back the same way.

## 3. Data (plan JSON)

```
Release     += qaDate?: string (YYYY-MM-DD, «Klar for QA»)
               openAtShip?: number[] (the ids not closed when «Sluppet» was set; written with shippedDate)
ReleaseItem += category?: "Proposed" | "InProgress" | "Resolved" | "Completed"
ReleaseHistoryPoint += closedPoints?: number, closed?: number (the daily reading also counts what is closed)
```

The normaliser keeps `qaDate` when it is a valid day (the editor keeps it on or before «Release»), `openAtShip` as distinct
positive integers only while `shippedDate` is set, and `category` only when it is one of the four. Merge is unchanged
(whole-object versioning by `v`, as R10).

## 4. Rules (`epic-tools.js`, pure, tested)

- `releaseItemDone(i)` → developed: category Resolved or Completed; without a category, state Resolved or Closed (as today).
  `releaseItemClosed(i)` → category Completed; without a category, state Closed.
- `releaseProgress(r)` keeps its fields (now meaning developed) and adds `closed`, `pointsClosed`, `closedFraction`.
- `releaseDevTarget(r)` = `r.qaDate || r.targetDate`.
- `releasePace(plan, r, todayDay)` measures against `releaseDevTarget(r)` instead of `targetDate`; its sentence says «klar for
  QA» when a QA date is set: «med dagens tempo klar for QA 22. okt, to arbeidsdager etter».
- `releasePhase(r)` → `utvikling` while some item is not developed, `qa` when everything is developed and the release is not
  out, `sluppet` when `shippedDate` is set. A release with no items in ADO is `utvikling`.
- `releaseExpected(plan, r, todayDay)` → the expected release day. Without a QA date: today's rule (the tempo's forecast day,
  else the release date). With one: development's finish = the day everything was developed in phase QA, else the
  tempo's forecast day, else the later of today and «Klar for QA»; the slip = working days from «Klar for QA» to that
  finish (0 when not past it); expected = «Release» + the slip. Never before today while not out.
- `releaseQaText(r, todayDay)` → «I QA: 5 av 9 lukket · release 24. okt» · «Klar for QA 22. okt · release 24. okt» ·
  «Sluppet 24. okt · 2 åpne ved release».
- `nextReleaseText` and the strip (R17's composition): in development «Neste release 2.0.1 · 44 % sjanse til klar for QA
  20. okt · 38 % utviklet · om 6 dager»; in QA «Neste release 2.0.1 i QA · 5 av 9 lukket · release 24. okt».
- `releaseBurndownData` returns a second series (what is not closed yet) and both target days.
- R16: `deliveryComputed` uses `releaseExpected` for a release part (instead of the tempo's day or the target), so a late
  handover turns a delivery yellow or red in time; `deliveryBugsLeft` counts bugs not closed.

## 5. The chance (R12)

The simulation is unchanged except its target and its «done»: the need is the points not developed (by category), the days
run to `releaseDevTarget(r)`. The sentence: «44 % sjanse for at alt er utviklet til klar for QA 20. okt». In phase QA there
is no chance (no QA throughput history yet): the QA section shows counts and the date.

## 6. Events (`events.ts`, `history.ts`)

- `release.qa`: «Klar for QA satt: 20. okt» · «Klar for QA: 20. okt → 23. okt» · «Klar for QA fjernet». Moving it later asks
  for a reason (`needsReason`, as `release.maldato`).
- `release.maldato` reads «Release: 24. okt → 27. okt» (was «Måldato: …»).
- `release.skippet` reads «Sluppet 24. okt · 2 åpne ved release» / «Sluppet-dato fjernet».

## 7. Tidslinjen

- **The release editor:** «Klar for QA» (date, under it «settes av utviklingsleder»), «Release» (date, «settes av
  Operations»; was «Måldato»), «Sluppet» (date; was «Skippet»). «Klar for QA» after «Release» is refused with the reason
  in the field.
- **The drawer:**
  - The head says the phase: «2.0.1 · i utvikling» · «2.0.1 · i QA» · «2.0.1 · sluppet 24. okt».
  - **Utvikling — til klar for QA 20. okt:** the tempo sentence, the chance, the burndown of what is not developed (with the
    QA date's line), the items counted by their real state names grouped by category (Ny · Codereview · Develop · QA ·
    Closed).
  - **QA — til release 24. okt:** what is developed but not closed, what is closed, the burndown of what is not closed
    (with the release date's line); after «Sluppet», the open ids as «åpne ved release».
  - «Marker sluppet …» (writers, not out yet): a dialog with the day (default today) and the open count; saves
    `shippedDate` and `openAtShip`.
  - The fallback note from §2 when the states were not found.
- **The band:** the release segment in two parts, development (start → «Klar for QA») and QA («Klar for QA» → «Release»),
  the QA part lighter; the tooltip names both dates and the expected release.
- **The strip:** §4.
- **Help:** the card «Releaser» says the two phases, who sets which date, and «Marker sluppet».

## 8. What does not change

The release label scope (`Custom.Release`), the unlabelled counts per sprint, the merge, the plan's epics and features,
Brettet, Inntak, the investor page apart from «bugs igjen» counting bugs not closed.

## 9. Verification

- vitest: the category map and both done rules with and without `category`; `releaseProgress`; the pace against «Klar for
  QA»; `releasePhase`; `releaseExpected` with and without a slip; `releaseQaText`; the burndown's two series; the events
  `release.qa` with its reason and the new summaries; the normaliser's new fields; `deliveryComputed` with a late handover.
- `tsc --noEmit`, `eslint src`, `next build`.
- `hosted-release-smoke.mjs` gains R18-1 to R18-6 behind its mock ADO (which answers the states call): the read-back counts
  Develop and QA as developed; the editor's two dates, refused when out of order, and a reason when «Klar for QA» moves
  later; the drawer's two sections in each phase; «Marker sluppet …» with the open ids; the band in two parts; the strip in
  QA. The deliveries smoke checks a late handover turns a delivery red. Existing smokes are updated where a label changes
  («Måldato» → «Release», «Skippet» → «Sluppet», «levert» → «utviklet»).

# Planning system, R11: progress towards a release (tempo, history, sprint vs release)

Amendment to `2026-10-12-planning-system-r10-releases-design.md`. Ordered by GO late on 12.10.2026, after the release band
(R10, PR #16) was merged: «the last thing we need for the overview of progress on bugs and stories towards a release». The
release is the unit. There is no bar per bug on the timeline and no sprint burndown here (ADO has one).

## What R11 adds

1. **A tempo colour on the release segment, computed the way the epics are.** Tempo = points delivered per working day
   since the release's start, counting only points delivered on or after the start (each item's delivered day, see 2).
   Expected finish = today + remaining / tempo, in working days. Green when the expected finish is on or before the
   target day; yellow up to three working days after it; red later. Until something is delivered after the start the
   straight line from start to target decides: expected share delivered = share of the time used, with a slack of one
   working day and at least 10 % (so day one of a short release is not yellow), red once the target day is past. The
   tooltip and the drawer say it in words: «31 % levert · 55 % av tiden brukt · med dagens tempo ferdig 27. okt, tre
   arbeidsdager etter målet».
   - Start = the sprint start of the oldest iteration among the release's items (the item's `System.IterationPath`
     matched against the cached sprint list), else the segment's start — **never before the first reading that found
     anything carrying the label** (amended 12.10: 2.0.1 was stamped a week into Sprint 71, and a clock from the
     sprint start showed it yellow on its first day and halved its tempo).
   - A shipped release has no tempo; a release with nothing read, or nothing carrying the label, has none either.
2. **One point per day.** Every read stores `{ day, pointsDone, pointsTotal, done, total }` on the release
   (`ado.history`), one entry per day (the day's last read wins), at most 120 kept. The drawer draws a burndown
   as inline SVG: the ideal line from the start to the target day, the actual line, a dashed projection to the
   expected finish, today as a hairline, and a table with the same numbers.
   - **The actual line comes from ADO's dates, not from the readings** (amended 12.10): every item carries the day it
     was delivered (`delivered`: the resolved day, else the closed day for an item closed without resolving; QA
     closing it later is not delivery), and the line has one point per working day from the axis start to today (or
     the shipped day) with today's scope left. A day nobody opened the page leaves no hole. A done item read before
     this change has no day and counts as done from the axis start until the next read fills it in.
   - The readings still give the scope over time: when the first reading's total differs from today's, the drawer
     says «Innhold nå 82 SP · 79 SP ved første lesing 12. okt».
   - **Auto-read.** A light route `POST /api/ado-releases` (writers) runs only `refreshReleases` and commits. The page
     calls it on load when any release lacks a read or its last read is older than six hours (like the sprint cache).
     Readers draw from the cache. No cron (no service principal, no PAT).
   - `ado.at` is now the time of the **last** read (the drawer's «lest fra ADO» and the six-hour rule need it); the
     release's `v` is bumped when the items, the history or the sprint counts changed, and `release.lest` is logged
     only when the items changed (as before).
3. **Sprint against release in the drawer.** The items grouped by state with counts (New · Active · Resolved · Closed,
   then any other state), and the line «16 items i 2.0.1: 15 i Sprint 71, 1 i Sprint 72 · Sprint 71 har 3 items uten
   release-label». Needs the iteration on every item (`ReleaseItem.iteration`, the last segment of
   `System.IterationPath`) and one WIQL per sprint the items sit in (plus the current sprint): open bugs and stories in
   that sprint whose `Custom.Release` is empty (`ado.sprints: [{ name, unlabelled }]`).
4. **Status strip and sprint report.** The legend's summary (`tlSummary`) gets «Neste release 2.0.1 om 10 dager · 31 % ·
   gul» with the tempo colour as a dot; the sprint report (`report.ts`) gets a «Releaser» section with one line per
   release not yet shipped (and those shipped in the period): target or shipped day, the progress text, the tempo text
   and the colour.

## Data (plan JSON, additive)

```
ReleaseItem  += iteration?: string                       // «Sprint 71», only when ADO has one
ReleaseItem  += delivered?: string                       // the day it was resolved (else closed), only while Resolved/Closed
Release.ado  += history?: { day, pointsDone, pointsTotal, done, total }[]   // one per day, sorted, max 120
Release.ado  += sprints?: { name: string; unlabelled: number }[]            // the items' sprints + the current one
```

The normaliser keeps `history` entries with a real day and non-negative numbers (one per day, the last wins, sorted,
the latest 120), keeps `sprints` entries with a name, and keeps `iteration` only as a non-empty string.

## Rules (epic-tools.js, pure, tested)

- `workDays(a, b)`: working days (Mon–Fri) from day `a` through day `b` inclusive, 0 when `b < a`.
  `workDaysBetween(a, b)`: working days after `a` up to and including `b`. `addWorkDays(day, n)`: the day `n` working
  days after `day`.
- `releaseStartDay(plan, r)`: the rule in 1.
- `releasePace(plan, r, todayDay)` → `{ code, text, done, elapsed, startDay, elapsedDays, totalDays, tempo,
  forecastDay, deltaDays, readings } | null`. `tempo` = units delivered on or after the start / elapsed working days,
  only when something was; `forecastDay` = `addWorkDays(todayDay, ceil(remaining / tempo))`; `deltaDays` =
  working days after (+) or before (−) the target. `code`: with a tempo, 0 → `gronn`, 1–3 → `gul`, else `rod`; without,
  `done + max(0.1, 1 / totalDays) >= elapsed` → `gronn` else `gul`, and `rod` when the target day is past. Everything delivered → `gronn`.
- `nextReleaseText(plan, todayDay)` → the first unshipped release by target day: «Neste release 2.0.1 om 10 dager · 31 %»
  (calendar days; «i dag»; «3 dager på overtid»; «ikke lest fra ADO» without a read) with the pace code, or null.
- `releaseStateCounts(r)`, `releaseSprintText(r)` (the line in 3), `releaseBurndownData(plan, r, todayDay)` (the
  numbers the SVG draws: start, target, end, today, total, unit, the actual points per working day, the forecast day, and `firstScope` = the first reading's day and total when it differs from today's).
- `sprintUnlabelledWiql(iterationPath)`: `[System.IterationPath] = '<path>' AND [Custom.Release] = '' AND
  [System.WorkItemType] IN ('Bug', 'User Story') AND [System.State] NOT IN ('Closed', 'Removed')`.
- `RELEASE_HISTORY_MAX = 120`, `RELEASE_MAX_AGE_MS = 6 h`.

## Verification

vitest (epic-tools, ado/releases, report), `tsc --noEmit`, `eslint`, `next build` (the new route); Playwright
`hosted-release-smoke.mjs` R1–R7 as before plus R8 (tempo colour and words), R9 (a second day: history, burndown,
tempo), R10 (the auto-read for a writer on load, not for a reader), R11 (the status strip), and the existing smokes.

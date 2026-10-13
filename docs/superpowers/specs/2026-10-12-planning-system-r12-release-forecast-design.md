# Planning system, R12: the chance a release is done by its target day

Amendment to `2026-10-12-planning-system-r11-release-progress-design.md`. Ordered by GO late on 12.10.2026 («build
it»), after he told the COO that SkyTracker would estimate «the probability that 82 SP are solved by 22.10» from the
people available and what they have delivered before. R11 gives the tempo of the release as a whole; R12 adds who is
there and how fast each of them has been, and turns that into one number. GO's own words: «let's play this out and
see if we learn something», so every day's forecast is kept next to what really happened.

## Where the numbers come from

- **Who is there: ADO's Capacity**, filled in per sprint (Boards → Sprints → Capacity). SkyTracker reads it, never
  writes it, and has no availability editor of its own. Per person and working day in the window:
  share of a day = the hours on the activities that deliver points (`Development` and the unnamed activity) / 7.5,
  0 on the person's days off and the team's days off. 7.5 hours is a full day (GO filled Sprint 71 that way).
  Testing and Deployment deliver no points here: QA and builds are not story points.
- **How fast each person has been: the two last finished sprints.** Every bug and story resolved on a working day in
  them (`ResolvedDate`, state Resolved or Closed, not resolved as Copied to Backlog, Duplicate, As Designed, Cannot
  Reproduce, Deferred, Obsolete or Won't Fix) with its story points, credited to the assignee, else the one who
  resolved it. That gives one row per working day: each person's points that day.
- **The window:** the working days from today through the day before the target day (the target day is the
  hand-over: 2.0.1 goes to QA on 22.10, so 13.–21.10 counts).
- **What is needed:** today's remaining points of the release (its label's scope).

## The number

A Monte Carlo over real days: 20 000 times, draw one past working day at random for every day of the window, add
each person's points from that day × their share of the day in the window, and count how often the total reaches
what is needed. The chance is that share; the drawer also says the mean and the range 8 in 10 outcomes fall inside
(p10–p90). Whole past days are drawn, not each person on their own, because a team's good and bad days come together
(hand-over days, release weeks). The random numbers come from a fixed seed, so the same data gives the same number and
a re-read the same day changes nothing.

Not modelled, said in the drawer: which person can take which item (13 of 2.0.1's 21 items have no owner), and how
the points were set (the same scale for history and release, but not calibrated by the team).

## What is shown

- **Drawer:** «44 % sjanse for at alt er levert til 22. okt · forventet 78 av 82 SP på 7 arbeidsdager · 8 av 10
  utfall mellom 37 og 121», a table per person (days available, points per day, expected points), and the basis:
  «Tempo fra Sprint 69 og Sprint 70 · tilgjengelighet fra Capacity i Sprint 71 (Development, 7,5 t = full dag)».
  Without Capacity for a sprint in the window: «Fyll inn Capacity i ADO for Sprint 72 (Development-timer per dag og
  fridager) for å få sannsynligheten.» Without deliveries in the two sprints: says so.
- **Segment tooltip, status strip, sprint report:** «44 % sjanse» after the tempo.
- **The learning record:** every day's reading keeps that day's chance and mean (`history[].forecast`); the
  burndown's table gets a column «Sjanse» so the forecast can be laid next to the actual line when the release ships.

## Data (plan JSON, additive)

```
Sprint        += id?: string            // the iteration's identifier (the team settings' iteration id), for Capacity
ReleaseHistoryPoint += forecast?: { p: number; mean: number }
Release.ado   += forecast?: ReleaseForecast
ReleaseForecast = { day, need, days, p, mean, p10, p90, people: { name, days, pace, expected }[], basis: string[], capacity: string[] }
                | { day, missing: "capacity", sprints: string[] } | { day, missing: "history" }
```

No forecast when the release is shipped, has nothing left, has no points, or today is on or past the target day (the
day's forecasts stay in the history).

## Code

- `src/features/ado/forecast.ts` (pure, tested): `forecastWindow`, `availabilityFrom`, `pacePool`, `simulate`,
  `readForecast` (reads Capacity and the two sprints through the client, memoised per refresh).
- `client.ts`: `capacities(iterationId)` → the members (Capacity) and the team's days off, on the team `Dev Team`.
- `sync.ts` `parseSprints` keeps the iteration's `identifier` as `id`; `readForecast` re-reads the iterations once when
  a cached sprint lacks it.
- `releases.ts` `refreshReleases` stores the forecast and the history point's forecast; both routes already call it.
- `epic-tools.js`: `releaseForecastText(r)` for the drawer, tooltip, strip and report; the normaliser keeps the forecast.

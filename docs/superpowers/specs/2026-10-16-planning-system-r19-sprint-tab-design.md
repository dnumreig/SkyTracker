# Planning system, R19: the Sprint tab (app health and the plan against the sprint)

Date: 16 October 2026 · Status: for GO's review.

GO in chat, 16.10:

> «lets also have a app health status bar: count of open issues and bugs… with a before and after a certain release and or
> sprint prognosis. Maybe this is its own tab for me: utviklingsleder. That I can bring up in produktforum where I have
> suggested items for the sprint planning where we account for some bug and issue burndown. And what features must be a:
> discovered according to the timeline and b: what features stories must be part of a sprint where the feature is marked
> ready for development and aligns with the start of next sprint… so we can see and track the work according to the plan.
> That makes it easy for me to report if the goal dates need to shift if we are falling behind schedule»

Decided by GO (AskUserQuestion, 16.10):
- **Bugs and issues:** counts, forecast and budget. SkyTracker does not pick the bugs.
- **Sprint scope:** by the timeline. Ones that should have started earlier are included and marked late.
- **The budget:** from the sprint mix.
- **Delivery:** a separate PR («we can do this as a separate pr»), stacked on R17 + R18's branch, because it reuses R18's
  state categories (`states.ts`) and R17's shared stylesheet and tabs.

## 0. Why

The development lead plans each sprint in produktforum with two questions: how much room to leave for bugs and issues, and
what the timeline expects to start in that sprint. Today the answers live in three places:
- the bug count in ADO;
- the discoveries and features on Tidslinjen;
- the stories in ADO's sprint.

Whether the plan still holds is worked out by hand. One tab can show all three for the next sprint, and say what it costs
when a feature that should start does not, so a goal date can be moved early, with a reason, instead of found late.

## 1. Decided and defaults

| ID | Choice | How |
|---|---|---|
| D1 | A new tab «Sprint», after Kunder | Everyone can read it; everyone signed in can refresh it, since the refresh is a read cached in the plan, like the sprint ruler |
| D2 | Open = not done, by ADO's category, the next release left out | Bugs and Issues whose state is Proposed, InProgress or Resolved (R18's map; a bug in QA is still open). Those carrying the next release's label (the first not shipped, by «Release») are on their way out in development or QA: they are left out of the counts, the severity chips and the trend, and counted apart: «Ikke telt: 9 bugs merket 2.0.1, på vei ut med releasen» (GO 19.10). Once the release is marked «Sluppet» the rule moves to the next one. Bugs by severity: A = 1 Critical, B = 2 High, C = 3 Medium, D = 4 Low |
| D3 | ~~«Etter release»~~ | Dropped 19.10: the headline is already without the next release (D2) |
| D4 | «Ved slutten av neste sprint» | Open now − expected closed + expected new. Expected closed = the budget's points ÷ the average points of bugs closed in the two last finished sprints (by count when those bugs have no points). Expected new = the average created per sprint over the same two sprints. Shown as «≈ N» |
| D5 | The budget comes from the sprint mix | (1 − `capacityFactor(plan)`) × the next sprint's expected points: each person's pace × available days from ADO Capacity, R12's rule over the next sprint's window. Without Capacity it says so, as the chance does |
| D6 | Due by the timeline | Every feature not yet delivered whose bar starts on or before the next sprint's last day. A discovery must be under way (state «utredes»). A feature ready for development (estimate, in an epic, state «klar» or «aktiv») must have open stories in the next sprint, or in the current one if it has already started. One that should have started before the next sprint, and isn't under way or has no stories in either sprint, is «sent» |
| D7 | What slipping costs | For a flagged feature: the plan with its start moved to the sprint after next, run through the timeline's own queue and status rules. Show its end's shift in weeks and its epic's status before → after, against the goal date. Nothing is moved |
| D8 | Health on Tidslinjen | The status strip gains «43 åpne bugs · 17 issues», linked to the tab |
| D9 | For produktforum | «Kopier som tekst»: a Markdown summary of health, budget, the due lists with flags, and the costs |
| D10 | Forum mode | The tab follows the forum view: large type and no write controls. Refreshing from ADO stays, since it is a read |

## 2. ADO reads (`src/features/ado/sprint-check.ts`, read-only)

- **States:** `readStateMap(client, ["Bug", "Issue", "User Story"])` (R18). Issue has New (Proposed), Active (InProgress)
  and Closed (Completed). Without the map, every state except Closed and Removed counts as open, and the tab says so.
- **Open bugs and issues:** WIQL for Bug and Issue in the open states, then `workitemsbatch` for type, state,
  `Microsoft.VSTS.Common.Severity`, `Custom.Release`, iteration path, points and `System.CreatedDate`.
- **The trend:** WIQL for Bugs and Issues created or closed since the end of the fourth-last finished sprint. The open count
  at the end of each of the last four sprints is open now − created since + closed since, the next release's items left
  out (D2). Per sprint it also records
  created bugs, closed bugs and closed bug points.
- **Due features' stories:** for the due features with an ADO id, `workitemsbatch` with relations gives the child story ids.
  The stories' state, iteration and points then give, per feature:
  - stories in total;
  - open stories;
  - open stories in the next sprint, and their points;
  - open stories in the current sprint.
- **The budget's points:** the next sprint's expected points from `pacePool` and `availabilityFrom` over
  `forecastWindow(next.start, day after next.finish)`, the pieces R12 and R18 already use.
- **Stored** in the plan as `sprintCheck` (§3) and merged with `newer` by `at`, like `sprints`:
  - route: `POST /api/ado-sprint-check`, for anyone signed in, on the person's own token;
  - the tab refreshes it on open when it is more than an hour old, and on «Oppdater fra ADO»;
  - a 401 asks the person to sign in again, as the other ADO routes do.

## 3. Data (plan JSON)

```
sprintCheck?: {
  at: string,                               // ISO, the read
  current: string | null, next: string | null,   // sprint names
  statesMissing?: true,
  bugs: { open: number, A: number, B: number, C: number, D: number, none: number,
          inNext: number, inNextPoints: number },     // inNext counts every bug planned there, the release's too (the budget)
  issues: { open: number },
  release?: { label: string, bugs: number, issues: number },   // D2: the next release's open items, left out above
  sprints: { name: string, end: string, openBugs: number, openIssues: number,
             created: number, closed: number, closedPoints: number }[],   // the last four finished, oldest first
  budget: { points: number | null, share: number, missing?: "capacity" | "history" },
  features: { [taskId: string]: { stories: number, open: number, inNext: number, inNextPoints: number, inCurrent: number } }
}
```

The normaliser keeps `sprintCheck` when `at` is a string, every count is a finite number ≥ 0, and every label and name is a
string. Otherwise it drops the field. `merge.ts` treats it like `sprints`: the newer `at` wins.

## 4. Rules (`epic-tools.js`, pure, tested)

- `nextSprint(sprints, date)` → the sprint after the current one, or the first starting after `date`; null when there is
  none.
- `sprintDue(plan, check, todayDay)` → `{ discoveries: Due[], features: Due[] }` by D6. Each `Due` is
  `{ task, epic, start, status }`, with status one of:
  - for discoveries: `"i gang"`, `"ikke startet"`, `"sent"`;
  - for features: `"planlagt"`, `"uten stories"`, `"ikke i ADO"`, `"sent"`.

  Features also carry `inNext`, `open` and `inNextPoints`. Both lists are sorted by start, then by epic.
- `slipCost(plan, taskId, todayDay)` → `{ weeks, epic: { key, name, before, after, goalDate } }`: the end's shift and the
  epic status codes before and after, from `resolveQueue` and `epicStatus`, by D7.
- `healthForecast(check)` → `{ now, endOfNext: { value, closed, created } }` by D4. `endOfNext` is null without a budget
  or history. `releaseLeftOutText(check)` → «Ikke telt: 9 bugs merket 2.0.1, på vei ut med releasen», or "" (D2).
- `budgetText(check, plan)` → for example «45 % ≈ 24 SP av ~53 · 18 SP planlagt på bugs».
- `sprintCheckMarkdown(plan, check, todayDay)` → the text for «Kopier som tekst».

## 5. The tab (`src/app/sprint/route.ts` + `sprint.html`)

A plain page like Kunder: `sky.css`, `epic-tools.js`, one h1 and a main, the title «Sprint – SkyTracker», and «Logg ut».
NAV_TABS gains `["sprint", "Sprint", "/sprint"]`. Top to bottom:

1. **App health, the headline.**
   - «43 åpne bugs · 17 issues», with the severity chips «A 1 · B 12 · C 21 · D 9».
   - Under it, what the next release leaves out (D2): «Ikke telt: 9 bugs merket 2.0.1, på vei ut med releasen».
   - A small trend with a visible caption, «Åpne bugs ved sprintslutt, uten 2.0.1»: open bugs at the end of the last four
     sprints, the release's left out there too.
   - The forecast: «ved slutten av Sprint 72 ≈ 35 (lukker ~12, ~4 nye)». A cached read made for another release (or before
     D2) is read again when the tab opens.
   - Severity uses the neutral chip style. The forecast is green when the count falls and amber when it rises: health is
     the one meaning those colours carry (R17 §6).
2. **«Sprint 72 · 26. okt – 6. nov», the next sprint.**
   - The budget line.
   - Two lists: «Utredninger som skal i gang» and «Features som skal ha stories i Sprint 72».
   - Each row has epic › feature, the owner, the bar's dates, the status chip and, when flagged, the cost line:
     «starter tidligst Sprint 73 → slutt +2 uker → «Telenor kan bygge på oss» blir gul (mål 15. des)».
   - A row links to Tidslinjen with the feature open (`/timeline#feature=<id>`, new: Tidslinjen scrolls to the row and
     opens the feature editor, read-only for readers).
3. **«Sprint 71 · dag 5 av 10», the current sprint.**
   - The features in work with their progress against the time spent (`progressSignal`).
   - Bugs closed so far this sprint.
4. **Foot:** «Lest fra ADO …» · «Oppdater fra ADO» · «Kopier som tekst».

Empty and missing states each say what is missing:
- no sprints from ADO;
- no Capacity, so no budget;
- no history;
- the states not found;
- the plan not read yet.

On Tidslinjen the strip's new part links to the tab.

## 6. What does not change

The plan's epics, features, releases and deliveries; ADO (nothing is written); Brettet, Inntak and Kunder apart from the new
tab in the top bar.

## 7. Verification

- **vitest:**
  - `nextSprint`;
  - `sprintDue`:
    - bars before, inside and after the next sprint;
    - a discovery «ny» against one «utredes»;
    - a feature with stories in the next sprint, with none, and without an ADO id;
    - late;
  - `slipCost`: one sprint later moves the end and turns the epic from green to amber;
  - `healthForecast`: at the end of the next sprint, by count when bugs lack points, and missing a budget or history;
  - the read leaves the next release's bugs and issues out of the counts, the chips and the trend, by its label;
  - `budgetText`;
  - the normaliser and the merge for `sprintCheck`;
  - `sprint-check.ts` against a fake client: the states map, the WIQL strings, the batch, the relations and the
    reconstruction of the trend.
- **The smoke** `hosted-sprint-smoke.mjs`, S1–S8, on the design review's harness, with a plan carrying `sprintCheck`:
  - the tab for a writer and a reader;
  - the health numbers and both forecasts;
  - both lists, the flags and a cost line;
  - forum mode;
  - «Kopier som tekst»;
  - Tidslinjen's strip link and `#feature=<id>`;
  - axe in light and dark.
- `tsc --noEmit`, `eslint src` and `next build`. Every existing smoke still passes, updated only where the new tab changes
  the top bar.

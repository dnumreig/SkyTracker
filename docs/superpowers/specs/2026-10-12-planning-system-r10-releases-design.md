# Planning system, R10: Releaser (the release band)

Amendment to `2026-10-08-planning-system-design.md` and the R7–R9 amendment. Decided with GO on 12.10.2026 after the
first produktforum with Tidslinjen: the forum made an epic «Prioriterte Bugs» (ADO #4818) to see the bugs chosen for
2.0.1, and could not tell a sprint from a release. A release is neither an epic (no goal, never closes) nor a feature
(a feature release is features plus bugs, so «bug features per release» split one release across epics). It is a third
thing with its own row.

## What a release is here

- A **version with a target day** («2.0.1», 22.10.2026) and, once it is out, a **shipped day**. Typed on the page by a
  writer. Nothing is read from the QA registry or the stores.
- Its **scope is the release label in ADO** (`Custom.Release`), set on bugs and stories by the dev lead with the forum
  and sprint planning (GO 12.10: «it's not QA that decides what they get when»). The label defaults to the version and
  can be overridden (`label`) for odd labels like `2.0.1+ota.2`.
- **«Oppdater fra ADO» reads the scope**: every Bug and User Story carrying the label, any state but Removed, with
  title, state, points and assignee, stored on the release (`ado.items`). Progress = points Resolved/Closed over all
  points (count of items when nobody pointed them). Bugs never become features.
- A patch release is just a segment on the band. A feature release is the segment plus the features that end on its
  line, each under its own epic. The sprint ruler stays what it is: boxes are cadence, segments are versions.

## Data (plan JSON, `TimelinePlan.data`)

```
Release      = { key, v, version, targetDate (YYYY-MM-DD), shippedDate?, note?, label?,
                 ado?: { at, label, items: ReleaseItem[] } }
ReleaseItem  = { id, type: "Bug" | "User Story", title, state, points, assignee }
plan.releases: Release[]            whole-object versioning like lanes and wishes (`v`)
plan.deletedReleases: { key: v }    tombstones like `deletedLanes`
```

The normaliser (`epic-tools.js`) drops a release without a key, version or valid target day, sorts by end day
(shipped day when set, else target day) and keeps `ado` only when it has `at` and an `items` array.

## Rules (epic-tools.js)

- `releaseSegments(plan, todayUnit)`: sorted by end; each segment starts where the previous one ends, the first two
  weeks before its own end; `shipped` when `shippedDate` is set; `overdue` when the end is past today and not shipped.
- `releaseProgress(release)`: `{ fraction, text, bugs, stories, done, total, pointsDone, pointsTotal }`; text reads
  «8 bugs, 7 stories · 10/79 SP levert», or «3 av 5 levert» without points, or «ikke lest fra ADO».
- `releaseScope(release)`: `label` or `version`.
- `dayToUnit(day)`: the chart unit of a YYYY-MM-DD day (shared with the sprint ruler).

## Events (events.ts, history.ts) and compare

`release.ny` «Ny release 2.0.1 · mål 22. okt» · `release.versjon` «Versjon: «2.0.1» → «2.0.2»» · `release.maldato`
«Måldato: 22. okt → 29. okt» (asks for a reason, like an epic's goal date) · `release.skippet` «Skippet 22. okt» /
«Skippet-dato fjernet» · `release.notat` · `release.scope` «ADO-label: …» · `release.slettet` «Release slettet: 2.0.1» ·
`release.lest` (cause ado) «Lest fra ADO: 8 bugs, 7 stories · 10/79 SP levert». Target type `release`. Compare mode
counts them as «N release(r) endret» and exports them under «Releaser».

## ADO (features/ado/releases.ts, api/ado-refresh)

`refreshReleases(plan, client, now)` runs one WIQL per release
(`[Custom.Release] = '<label>' AND [System.WorkItemType] IN ('Bug', 'User Story') AND [System.State] <> 'Removed'`),
batches the ids, maps the items, and replaces `ado` (bumping `v`, logging `release.lest`) only when the label or the
items changed. The existing «Oppdater fra ADO» route runs it after `refreshPlan`, in the same changeset. Nothing is
written to ADO. `releaseQueryUrl(label)` opens the same query in ADO.

## Page (timeline.html)

- A **«Releaser» layer in the axis**, above the sprint ruler: one segment per release with the version, a progress
  fill, ✓ when shipped, red text when overdue; a dashed **release line** down the chart at the end day. Click → the
  release drawer. Legend swatch «Release»; a help card.
- **«＋ Release»** in the toolbar (writers) opens the **release editor**: versjon, måldato, skippet, ADO-label, notat,
  «Slett». Moving the target day asks «Hvorfor?» (reason `ekstern` preselected when the day moves later).
- The **release drawer**: «Release 2.0.1 · mål 22. okt», the progress text, «lest fra ADO <when>», the items in two
  groups (Bugs, Stories) with id, title, state, points, assignee, done rows ticked; «Rediger…» and «Oppdater fra ADO»
  for writers, «Åpne i ADO» for everyone.
- «Importer (JSON)» treats releases like lanes and wishes (tombstones for what the file lacks, versions bumped past the
  stored ones, counted in the confirm).

## Verification

vitest (epic-tools, merge, events, compare, ado/releases), `tsc`, `eslint`; Playwright `hosted-release-smoke.mjs` R1–R7
(add, edit with reason, refresh from a fake ADO, shipped, reader view, import, delete) plus the existing smokes.

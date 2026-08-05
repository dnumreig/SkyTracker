# Card Completion & Per-Column Scroll — Design

**Date:** 2026-08-05
**Status:** Approved (design), pending implementation plan

## Overview

Add the ability to mark a card **completed** from its edit modal. A completed card turns
**green** and "sinks" into a scrollable **history zone at the top** of its column, above the
active (non-completed) cards. Each column scrolls **independently** with a sticky header;
on load a column lands on its **first active card** (completed history scrolled off above),
and a floating **"jump to active"** button returns you to that anchor whenever it scrolls
off-screen in either direction.

This is an internal tool — favour simplicity and clarity over configurability.

## Behaviour summary

- **Complete a card** via a "Completed" checkbox in the Edit Card modal. Completing sets a
  timestamp; unchecking clears it and the card rejoins the active list at its original position.
- **Within a column**, completed cards group at the top as history (oldest at the very top,
  most-recently-completed just above the divider); active cards keep their priority order below.
- **On load**, each column auto-scrolls so its first active card sits at the top of the scroll
  area. Scroll up to browse finished work.
- **The board fills the viewport**: the page no longer scrolls vertically; each column scrolls
  internally. Columns beyond the viewport are reached by horizontal (Shift+wheel / trackpad) pan.
- **A "jump to active" button** appears in a column when its first active card is off-screen —
  `↓ Active` when you're up in history, `↑ Active` when you're down past many active cards —
  and both scroll to the first active card.

## 1. Data model

Add one nullable field to `Card` in `prisma/schema.prisma`:

```prisma
completedAt DateTime?  // null = active; set = completed (also drives history ordering)
```

- "Completed" is derived: `completedAt != null`. Storing a timestamp (rather than a bool)
  gives history ordering and the "Completed · <date time>" label for free, and is audit-friendly.
- New migration `add_card_completed`; regenerate the (gitignored) Prisma client via
  `npx prisma generate` (postinstall also does this).
- **Gap cards cannot be completed** — the completion control is hidden for `isGap` cards.

## 2. Marking complete (UI + server)

- **`EditCardModal`** gains a **"Completed"** checkbox (hidden when `card.isGap`), using the
  existing hidden+checkbox pattern (`getAll(name).includes("true")`) so it round-trips correctly.
- It flows through the **existing `updateCard` server action** (writer-gated + audited):
  - checkbox on and card currently active → set `completedAt = new Date()`
  - checkbox off and card currently completed → set `completedAt = null`
  - otherwise leave `completedAt` unchanged (don't bump the timestamp on unrelated edits).
- Audit log records the completion/uncompletion transition.
- Unchecking returns the card to the active list at its existing `position`.

## 3. Ordering within a column

A pure helper (unit-testable, node-only) splits and orders a column's cards:

```ts
// src/features/board/completion.ts
splitColumnCards(cards): { completed: CardModel[]; active: CardModel[] }
// completed: completedAt != null, sorted by completedAt ASC (oldest top → newest above divider)
// active:    completedAt == null, sorted by position ASC (unchanged priority order)
```

Render order top→bottom: **completed history (static)** → **divider** → **active (draggable)**.

Only **active** cards are placed in the dnd-kit `SortableContext`; completed cards render as a
static, non-draggable list above. To move/reorder a completed card you un-complete it first.
This keeps `position` semantics purely about the active list.

## 4. Layout & scroll (viewport-filling)

Establish a full-height flex layout so the board fills the viewport and only columns scroll:

- `app/layout.tsx` / `app/page.tsx`: make the app shell `h-screen`/`min-h-0` flex so the board
  region gets a bounded height (no page-level vertical scroll).
- **Board container** (`DndBoard`): `flex gap-6 overflow-x-auto` with a bounded height, so extra
  columns pan horizontally (Shift+wheel / trackpad-horizontal).
- **Each column** (`SortableColumn`): `flex flex-col min-h-0` with three parts:
  1. **Sticky header** — the existing `ColumnHeader` (title; description stays a hover tooltip),
     non-scrolling at the column top.
  2. **Scroll area** — `flex-1 overflow-y-auto min-h-0`: completed history + divider + active list.
  3. **`AddCardForm`** — pinned below the scroll area (always reachable), not inside the scroll area.

Interaction rule: **vertical** wheel scrolls the column under the cursor; **horizontal**
(Shift+wheel) pans the board. Both are native to the respective overflow containers.

## 5. Initial scroll + "jump to active" button

**Anchor:** the first active card renders with a ref (an "active anchor"). If a column has no
active cards, the anchor is the bottom of the scroll area.

**Initial scroll (client, `useLayoutEffect` in the column):**
- Scroll the scroll-area so the anchor is at its top (`scrollTop = anchor.offsetTop`).
- No completed cards → anchor already at top → no-op.
- No active cards (all completed) → scroll to the bottom (end of history + add form visible).
- Re-anchor when the first-active card changes due to a mutation (e.g. after completing a card),
  guarded so it doesn't fight an in-progress manual scroll.

**Jump-to-active button:** a floating control inside the column scroll viewport, shown only when
the anchor is **out of view** (tracked via `IntersectionObserver` on the anchor within the scroll
container):
- anchor **below** the viewport (you're up in history) → **`↓ Active`**, click smooth-scrolls down
  to the anchor.
- anchor **above** the viewport (you're down past many active cards) → **`↑ Active`**, click
  smooth-scrolls up to the anchor (top of the active list).
- anchor visible → button hidden.

## 6. Completed-card appearance

- **Green treatment**, readable in light + dark: green left border + subtle tint
  (`bg-green-50 dark:bg-green-500/10`), slightly muted text (it's history), a ✓ marker. The green
  **replaces the task-type accent** while completed. Card keeps its fixed **84px** height.
- **Right-side panel unchanged** — estimate / tags (e.g. Backend, ~~Frontend~~) / date stay as-is.
- **New bottom line in the main (left) area:** `✓ Completed · 21. mai 14:32` (muted green), added
  as the last row under the description/badges via a new `formatDateTime(date)` (nb-NO, day +
  short month + time) in `dates.ts`. Fit within 84px; if it crowds the description we relax
  spacing/truncation when reviewing the real render.

## 7. Date cascade

`computeEstimatedDates` runs over **active cards only** — completed cards are skipped and get no
future date. Net effect: completing a card pulls downstream active estimates earlier, which is
correct. `SortableColumn` feeds the active list to `computeEstimatedDates` (or the function filters
`completedAt != null`).

## 8. Drag-and-drop interaction

- Only active cards are draggable (in `SortableContext`); completed cards are static.
- `moveCard` and cross-column drag of active cards are unchanged.
- Dragging is disabled for completed cards; un-complete to move one.

## 9. Edge cases

- **All cards completed:** column lands at the bottom (history end + add form); no anchor button
  needed until you scroll up.
- **Empty column:** just the add form; no button.
- **Un-complete:** `completedAt = null`; card returns to active at its `position`; dates recompute.
- **Complete while scrolled:** after the revalidate re-render, re-anchor to the (possibly new)
  first active card so the view stays on active work.

## 10. Testing

- **Unit (vitest, node env — TDD):**
  - `splitColumnCards` — completed sorted by `completedAt` asc, active by `position`.
  - `computeEstimatedDates` ignores completed cards.
  - `formatDateTime` output for a known date (nb-NO).
- **Not covered by node-only vitest** (no jsdom/RTL configured): initial scroll, anchor/button
  visibility, sticky header, overflow layout. These are verified via `next build` + on-page manual
  check — this will be stated honestly, not claimed as automated coverage.

## Files touched (anticipated)

- `prisma/schema.prisma` (+ migration `add_card_completed`)
- `src/features/board/actions.ts` — `updateCard` handles `completed`; audit transition
- `src/features/board/completion.ts` — new `splitColumnCards` helper (+ test)
- `src/features/board/dates.ts` — `formatDateTime`; cascade skips completed (+ tests)
- `src/components/board/EditCardModal.tsx` — Completed checkbox (hidden for gaps)
- `src/components/board/Card.tsx` — green state + "Completed · <datetime>" line
- `src/components/board/SortableCard.tsx` — non-draggable when completed
- `src/components/board/SortableColumn.tsx` — split render, sticky header, scroll area, pinned
  add form, initial-scroll effect, anchor + jump-to-active button
- `src/components/board/DndBoard.tsx` / `Board.tsx` — full-height + horizontal overflow
- `src/app/layout.tsx`, `src/app/page.tsx` — full-height flex shell

## Out of scope (YAGNI)

- Quick-complete ✓ on the card face (completion is via the modal).
- Bulk complete, completion analytics/reporting, configurable colours.
- Reordering within the completed history (it's time-ordered).

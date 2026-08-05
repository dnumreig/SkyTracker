# Dependency Arrows Under Per-Column Scroll + Column Polish — Design

**Date:** 2026-08-05
**Status:** Approved (design)

## Context

After the card-completion + per-column-scroll feature, each column scrolls independently inside
its own `[data-column-scroll]` viewport (between a sticky header and a pinned add-card form).
`DependencyLines.tsx` draws an SVG overlay (`absolute inset-0`) over the whole `DndBoard`
container, positioning blocker→blocked arrows by measuring `[data-card-id]` boxes relative to the
container, recomputing on a MutationObserver + window `resize` only. This breaks under per-column
scroll (observed in testing):

- **No scroll listener** → lines don't follow a scrolling column; they only "fix themselves" when a
  DOM mutation (e.g. completing a card) happens to retrigger `measure()`.
- **No clipping** → an endpoint scrolled out of its viewport is measured at its laid-out position
  (above the header / below the add-form), so lines shoot straight up between columns and cross
  boundaries.
- **Completed cards** render via `<Card>` with no `data-card-id`, so their arrows can't be measured.

Plus two UX-polish items surfaced in the same test: the jump-to-active button placement, and the
column scrollbar styling.

## Goals

1. **Clip band** — no line (endpoint, stub, or cross-column run) ever renders over a column header
   or the "+ New card" form.
2. **Off-screen endpoints → clean vertical stubs** at the viewport edge (not lines to off-screen
   positions).
3. **Anti-collision** — multiple stubs at one column edge stay visually distinct.
4. **Live scroll tracking** — lines follow column scroll in real time.
5. **Completed-card anchors** — completed cards participate as dependency endpoints.
6. **Scrollbar** — hover-reveal thin thumb, track fully transparent at all times.
7. **Jump-to-active buttons** — `↑ Active` at the top, `↓ Active` at the bottom, both reliable.

## Coordinate model

The overlay's coordinate space is the `DndBoard` container (`containerRef`), unchanged. New: the
overlay also reads every `[data-column-scroll]` element's `getBoundingClientRect` to derive each
column's **visible band** in container coordinates:

```
bandTop_i    = scrollRect_i.top    - containerRect.top    + INSET
bandBottom_i = scrollRect_i.bottom - containerRect.top    - INSET   // INSET ≈ 4px no-draw margin
```

Columns are equal-height, so their bands align; each endpoint uses its own column's band for
robustness. The shared clip band is `[max(bandTop_i), min(bandBottom_i)]`.

## 1. Clip band (no-draw zones) — goal 1, 3(item)

Wrap all drawn paths in a `<g clip-path="url(#dep-clip)">`, where `#dep-clip` is a `<clipPath>`
holding one `<rect>` spanning the full overlay width and the shared band `[bandTop, bandBottom]`.
This structurally guarantees nothing renders above the descriptor row or below "+ New card",
regardless of routing — the safety net behind §2's clamping.

## 2. Off-screen endpoint stubs — goal 2

For each dependency endpoint card, find its column band and the card's vertical center `cy`:

- `cy` inside `[bandTop, bandBottom]` → endpoint at the card (current behavior).
- `cy < bandTop` (scrolled above) → clamp endpoint Y to `bandTop`, `stub = "top"`.
- `cy > bandBottom` (scrolled below) → clamp endpoint Y to `bandBottom`, `stub = "bottom"`.

A stubbed endpoint keeps the horizontal exit side / vertical channel (`x`) the full route would
use, and the path ends in a short vertical run to the band edge capped with a **chevron marker**
(`▲` for top, `▼` for bottom) in the line's color, signaling the dependency continues off-screen.

If **both** endpoints of a dependency are off-screen, skip that line entirely (nothing meaningful is
on screen).

Extract the clamp as a pure, node-testable helper (no React/DOM) in a new module:

```ts
// src/features/board/deplines-geometry.ts
export type Stub = "none" | "top" | "bottom";
export function clampEndpointToBand(cy: number, bandTop: number, bandBottom: number):
  { y: number; stub: Stub };
```

## 3. Anti-collision — goal 3

Group stubbed endpoints by `(columnId, edge)`. Within a group, assign each stub a horizontal offset
from a fixed step sequence (`0, +8, −8, +16, −16, …`) applied to its `x`, so a top-going and a
bottom-going stub — or several the same direction — render as distinct verticals instead of
overlapping into one line. Expose the offset picker as a pure helper alongside the clamp:

```ts
export function stubOffset(indexWithinGroup: number, step?: number): number;
```

## 4. Live scroll tracking — goal 4

In the overlay's effect: query all `[data-column-scroll]` containers and attach a **passive**
`scroll` listener to each (plus keep window `resize` and the existing MutationObserver). Each
listener schedules a `requestAnimationFrame`-throttled `measure()` (coalesce bursts into one
recompute per frame). On cleanup / dependency change, remove every listener and cancel any pending
rAF. No behavioral change to `measure()`'s routing itself beyond adding the band clamp.

## 5. Completed-card anchors — goal 5

In `SortableColumn`, wrap each completed `<Card>` in a `<div data-card-id={card.id}>` (mirroring
what `SortableCard`'s wrapper provides for active cards) so completed cards are measurable
endpoints. They live in the history zone, which scrolls within the same band, so they obey §1–§3
automatically.

## 6. Scrollbar styling — goal 6

Add a `.column-scroll` class in `globals.css`, applied to the `[data-column-scroll]` div:

- **Track: fully transparent in every state** (no visible background/channel — ever).
- **Thumb: transparent by default; `--color-ocean-4` (#294285) only while hovering** the column's
  scroll area. **No layout shift** — width is reserved constant; only the thumb color changes.

```css
/* Chrome/Edge (webkit) */
.column-scroll::-webkit-scrollbar { width: 8px; }
.column-scroll::-webkit-scrollbar-track { background: transparent; }
.column-scroll::-webkit-scrollbar-thumb {
  background: transparent; border-radius: 4px;
  border: 2px solid transparent; background-clip: padding-box;
}
.column-scroll:hover::-webkit-scrollbar-thumb { background: #294285; background-clip: padding-box; }
/* Firefox */
.column-scroll { scrollbar-width: thin; scrollbar-color: transparent transparent; }
.column-scroll:hover { scrollbar-color: #294285 transparent; }
```

## 7. Jump-to-active button placement — goal 7

In `SortableColumn`, position the floating button by direction:

- `anchorPos === "above"` (scrolled **down** past the first active card) → button at **top**
  (`top-2`), label `↑ Active`.
- `anchorPos === "below"` (scrolled **up** into completed history) → button at **bottom**
  (`bottom-2`), label `↓ Active`.
- `anchorPos === "visible"` → hidden.

Verify the `↓ Active` case fires reliably: confirm the IntersectionObserver (root = scroll
container, threshold 0) detects the anchor leaving the viewport bottom; add a small `rootMargin`
if a boundary case keeps it from triggering. (During testing the down-button appeared absent — most
likely it needs enough completed cards to scroll the anchor fully out, but confirm the detection.)

## Testing

- **Unit (vitest, node):** `clampEndpointToBand` and `stubOffset` in `deplines-geometry.ts` — the
  only pure-extractable geometry.
- **Not unit-testable** (DOM/scroll/visual): clip band, live scroll tracking, stub rendering,
  scrollbar, button placement. Verified via `npx next build` + manual QA — stated honestly, never
  claimed as automated coverage.

## Files touched

- `src/features/board/deplines-geometry.ts` — new pure helpers `clampEndpointToBand`, `stubOffset` (+ test)
- `src/components/board/DependencyLines.tsx` — bands, clamp+stub, `clipPath`, anti-collision, per-column scroll listeners (rAF-throttled), chevron markers
- `src/components/board/SortableColumn.tsx` — wrap completed cards in `data-card-id`; add `.column-scroll` class; reposition jump buttons (↑ top / ↓ bottom)
- `src/app/globals.css` — `.column-scroll` scrollbar rules

## Out of scope (YAGNI)

- Rewriting the existing inter-column routing / hop-crossing algorithm.
- Dependency labels, counts, or hover interactions on arrows.
- The pre-existing "unauthenticated `/` renders as reader instead of redirecting to `/login`"
  middleware behavior (unrelated to this work).

# Dependency Arrows under Per-Column Scroll — Requirements Notes

**Date:** 2026-08-05
**Status:** Captured requirements for a FUTURE feature (its own brainstorm → spec → plan).
Depends on the per-column scroll layout shipped by
`2026-08-05-card-completion-and-column-scroll`.

## Context

`DependencyLines.tsx` draws an SVG overlay of blocker→blocked arrows across the whole board,
positioning each endpoint from its `data-card-id` box. It currently recomputes only on DOM
mutations + `window.resize` — **no scroll handler** — and assumes the whole page scrolls together.
Once columns scroll independently, arrows drift and can point at clipped positions / over the
sticky header.

## Desired behavior (from Lars, 2026-08-05)

1. **Live follow on column scroll.** Recompute arrow geometry when any column's internal scroll
   position changes (not just on DOM mutation / resize).
2. **Off-screen endpoint → stub to the column edge.** When an endpoint card is scrolled out of its
   column's visible viewport (above or below), the line does not chase the clipped card. Instead it
   terminates at that column's **top or bottom edge**, running **straight up/down**, with an
   arrowhead, to signal "this card has a dependency above/below that's currently out of view."
3. **Preserve the exit side.** The vertical stub leaves from the **same horizontal side / vertical
   channel** the full route would have used if both endpoints were visible (e.g. a dependency
   heading right toward the next column keeps exiting on the right).
4. **No collisions.** When a single column has multiple stubs (e.g. one heading to the top edge and
   one to the bottom, or several in the same direction), offset them horizontally so they render as
   distinct lines rather than collapsing onto one.

## Open questions to resolve during that feature's brainstorm

- **Both endpoints off-screen:** hide the arrow entirely, or show stubs at both columns' edges?
- **The "edge":** the column's scroll-viewport top/bottom (the `overflow-y-auto` area from the
  completion+scroll feature), inside the sticky header, and the pinned add-card form.
- **Stub arrowhead + affordance:** just an arrowhead, or a small count/badge of hidden deps?
- **Anti-collision spacing:** fixed per-stub horizontal offset vs. computed channel packing.
- **Completed cards as endpoints:** they render via `<Card>` (no `data-card-id` wrapper) — give
  them an anchor so arrows to finished work can still draw (or intentionally drop those).
- **Performance:** scroll recompute must be throttled/rAF'd; the current `measure()` is O(deps²)
  for the hop-crossing pass.

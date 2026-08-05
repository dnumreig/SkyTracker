# Dependency Arrows Under Per-Column Scroll + Column Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dependency-arrow overlay scroll-aware and clipped to each column's card viewport (clean off-screen stubs, no lines over headers/add-forms, live scroll tracking, completed-card anchors), and polish the column scrollbar + jump-to-active buttons.

**Architecture:** Keep the existing `DependencyLines` routing but add a band-clamp/clip layer: the overlay reads each `[data-column-scroll]` viewport to derive a vertical "band", clamps endpoints into it (off-screen → stub at the band edge with a chevron), clips all paths to the band, and recomputes on rAF-throttled column scroll. A small pure geometry helper is unit-tested; the rest is DOM/visual (build + manual QA). Column polish (scrollbar hover-reveal, button placement, completed-card `data-card-id`) is separate.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, SVG, vitest (node env).

## Global Constraints

- **Node 22+** for all commands.
- **Tests are node-env vitest** (`npm test`) — no jsdom/RTL. DOM/scroll/visual behavior is verified via `npx next build` + manual QA, stated honestly, never claimed as automated coverage.
- **The overlay coordinate space is the `DndBoard` container** (`containerRef`); all measurements are `getBoundingClientRect` minus `containerRect`.
- **Scrollbar: track fully transparent in EVERY state**; thumb transparent by default, `#294285` (`ocean-4`) only on `.column-scroll:hover`; **no layout shift**.
- **Off-screen marker:** chevron `▲` (top) / `▼` (bottom) in the line's color.
- **Jump buttons:** `↑ Active` at `top-2` when `anchorPos === "above"`; `↓ Active` at `bottom-2` when `anchorPos === "below"`; hidden when `"visible"`.
- **INSET = 4** (px no-draw margin inside each viewport edge).
- **Commit rule:** feature branch `feat/dependency-arrows-scroll-polish` (already checked out); commit per task; do NOT push.
- **Path alias** `@/*` → `./src/*`.

---

### Task 1: Pure geometry helpers (TDD)

**Files:**
- Create: `src/features/board/deplines-geometry.ts`
- Create: `src/features/board/deplines-geometry.test.ts`

**Interfaces:**
- Produces (consumed by Task 3):
  - `type Stub = "none" | "top" | "bottom"`
  - `clampEndpointToBand(cy: number, bandTop: number, bandBottom: number): { y: number; stub: Stub }`
  - `stubOffset(indexWithinGroup: number, step?: number): number`

- [ ] **Step 1: Write the failing test**

Create `src/features/board/deplines-geometry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { clampEndpointToBand, stubOffset } from "./deplines-geometry";

describe("clampEndpointToBand", () => {
  it("returns the center unchanged and stub 'none' when inside the band", () => {
    expect(clampEndpointToBand(50, 10, 100)).toEqual({ y: 50, stub: "none" });
  });
  it("clamps to bandTop with stub 'top' when above the band", () => {
    expect(clampEndpointToBand(-20, 10, 100)).toEqual({ y: 10, stub: "top" });
  });
  it("clamps to bandBottom with stub 'bottom' when below the band", () => {
    expect(clampEndpointToBand(180, 10, 100)).toEqual({ y: 100, stub: "bottom" });
  });
  it("treats the exact edges as inside (no stub)", () => {
    expect(clampEndpointToBand(10, 10, 100)).toEqual({ y: 10, stub: "none" });
    expect(clampEndpointToBand(100, 10, 100)).toEqual({ y: 100, stub: "none" });
  });
});

describe("stubOffset", () => {
  it("is zero for the first item in a group", () => {
    expect(stubOffset(0)).toBe(0);
  });
  it("alternates sign and grows with index", () => {
    expect(stubOffset(1)).toBe(8);
    expect(stubOffset(2)).toBe(-8);
    expect(stubOffset(3)).toBe(16);
    expect(stubOffset(4)).toBe(-16);
  });
  it("honors a custom step", () => {
    expect(stubOffset(1, 10)).toBe(10);
    expect(stubOffset(2, 10)).toBe(-10);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- deplines-geometry`
Expected: FAIL — `Cannot find module './deplines-geometry'`.

- [ ] **Step 3: Implement the helpers**

Create `src/features/board/deplines-geometry.ts`:

```ts
export type Stub = "none" | "top" | "bottom";

/** Clamp a dependency endpoint's vertical center into a column's visible band.
 *  Above the band -> clamp to bandTop (stub "top"); below -> bandBottom (stub "bottom"). */
export function clampEndpointToBand(
  cy: number,
  bandTop: number,
  bandBottom: number,
): { y: number; stub: Stub } {
  if (cy < bandTop) return { y: bandTop, stub: "top" };
  if (cy > bandBottom) return { y: bandBottom, stub: "bottom" };
  return { y: cy, stub: "none" };
}

/** Horizontal offset for the Nth stub sharing a column edge, so they don't overlap:
 *  0, +step, -step, +2*step, -2*step, ... */
export function stubOffset(indexWithinGroup: number, step = 8): number {
  if (indexWithinGroup === 0) return 0;
  const magnitude = Math.ceil(indexWithinGroup / 2) * step;
  return indexWithinGroup % 2 === 1 ? magnitude : -magnitude;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- deplines-geometry`
Expected: PASS (7 assertions).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/board/deplines-geometry.ts src/features/board/deplines-geometry.test.ts
git commit -m "feat(board): pure geometry helpers for dependency-line band clamping"
```

---

### Task 2: Column viewport polish — scrollbar, jump buttons, completed anchors

**Files:**
- Modify: `src/app/globals.css` (append `.column-scroll` rules)
- Modify: `src/components/board/SortableColumn.tsx` (scroll-div className; button placement; wrap completed cards)

**Interfaces:**
- Produces (consumed by Task 3): completed cards are wrapped in `<div data-card-id={card.id}>` so the overlay can measure them.

- [ ] **Step 1: Add the scrollbar rules to globals.css**

Append to `src/app/globals.css`:

```css
/* Column scroll viewport: transparent track always; thin thumb visible only on hover. */
.column-scroll {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.column-scroll:hover {
  scrollbar-color: #294285 transparent; /* ocean-4 */
}
.column-scroll::-webkit-scrollbar {
  width: 8px;
}
.column-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.column-scroll::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.column-scroll:hover::-webkit-scrollbar-thumb {
  background: #294285; /* ocean-4 */
  background-clip: padding-box;
}
```

- [ ] **Step 2: Apply `.column-scroll` to the scroll container**

In `src/components/board/SortableColumn.tsx`, the scroll container div (currently
`className="h-full overflow-y-auto flex flex-col gap-2 pr-1"`) → prepend the class:

```tsx
          className="column-scroll h-full overflow-y-auto flex flex-col gap-2 pr-1"
```

- [ ] **Step 3: Wrap completed cards in a `data-card-id` anchor**

In `src/components/board/SortableColumn.tsx`, the completed-cards map currently renders `<Card ... />`
directly. Wrap each in a `data-card-id` div so the dependency overlay can measure it:

```tsx
          {completed.map((card) => (
            <div key={card.id} data-card-id={card.id}>
              <Card
                card={card}
                estimatedDone={null}
                allCards={allCards}
                dependencies={dependencies}
                canEdit={canEdit}
              />
            </div>
          ))}
```

(Note: the `key` moves to the wrapper div.)

- [ ] **Step 4: Reposition the jump-to-active button by direction**

In `src/components/board/SortableColumn.tsx`, replace the single bottom-pinned button block
(currently `anchorPos !== "visible"` → one `<button>` at `bottom-2` showing `↓ Active`/`↑ Active`)
with direction-based placement:

```tsx
        {anchorPos === "above" && (
          <button
            type="button"
            onClick={() => scrollToAnchor(true)}
            aria-label="Jump to active cards"
            className="absolute left-1/2 -translate-x-1/2 top-2 z-10 rounded-full px-3 py-1 text-xs font-medium shadow-md bg-ocean-5 text-white hover:bg-ocean-6 transition"
          >
            ↑ Active
          </button>
        )}
        {anchorPos === "below" && (
          <button
            type="button"
            onClick={() => scrollToAnchor(true)}
            aria-label="Jump to active cards"
            className="absolute left-1/2 -translate-x-1/2 bottom-2 z-10 rounded-full px-3 py-1 text-xs font-medium shadow-md bg-ocean-5 text-white hover:bg-ocean-6 transition"
          >
            ↓ Active
          </button>
        )}
```

- [ ] **Step 5: Make the down-button detection reliable**

The `↓ Active` case (`anchorPos === "below"`, anchor scrolled below the viewport) must fire when you
scroll up into history. In the existing IntersectionObserver options, add a small negative bottom
`rootMargin` so the anchor counts as "gone" slightly before it's flush with the bottom edge (avoids a
boundary case where a zero-height sentinel at the exact edge reads as still intersecting). Change:

```tsx
      { root: scroller, threshold: 0 },
```
to:
```tsx
      { root: scroller, threshold: 0, rootMargin: "0px 0px -8px 0px" },
```

- [ ] **Step 6: Build**

Run: `npx next build 2>&1 | tail -12`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/components/board/SortableColumn.tsx
git commit -m "feat(board): hover-reveal scrollbar, ↑/↓ jump buttons, completed-card anchors"
```

> Full visual verification (hover scrollbar, button placement, completed anchors feeding the overlay)
> is manual QA in the final checklist — not headlessly testable here.

---

### Task 3: Scroll-aware, clipped dependency overlay

**Files:**
- Modify: `src/components/board/DependencyLines.tsx`

**Interfaces:**
- Consumes: `clampEndpointToBand`, `stubOffset`, `Stub` from `@/features/board/deplines-geometry` (Task 1); `data-card-id` on completed cards (Task 2); `[data-column-scroll]` viewports (existing).

This task modifies one intricate file. Apply each change at the anchor described; keep the existing
routing (`findColumnGaps`, `findClearY`, `buildPath`, hop logic) intact.

- [ ] **Step 1: Import the geometry helpers and extend `RoutedLine`**

At the top of `src/components/board/DependencyLines.tsx`, add the import:

```ts
import { clampEndpointToBand, stubOffset, type Stub } from "@/features/board/deplines-geometry";
```

Extend the `RoutedLine` type to carry stub flags (add two fields):

```ts
type RoutedLine = {
  id: string;
  x1: number;
  y1: number;
  vx1: number;
  clearY: number;
  vx2: number;
  x2: number;
  y2: number;
  colorIndex: number;
  stub1: Stub; // blocker (source) endpoint
  stub2: Stub; // blocked (target) endpoint
};
```

Add band state next to `const [lines, setLines] = useState<RoutedLine[]>([]);`:

```ts
  const [band, setBand] = useState<{ top: number; bottom: number } | null>(null);
```

- [ ] **Step 2: Compute the shared band in `measure()`**

In `measure()`, right after `const containerRect = container.getBoundingClientRect();`, add:

```ts
    const INSET = 4;
    const scrollEls = Array.from(container.querySelectorAll("[data-column-scroll]"));
    let bandTop = -Infinity;
    let bandBottom = Infinity;
    for (const el of scrollEls) {
      const r = el.getBoundingClientRect();
      bandTop = Math.max(bandTop, r.top - containerRect.top + INSET);
      bandBottom = Math.min(bandBottom, r.bottom - containerRect.top - INSET);
    }
    if (!Number.isFinite(bandTop) || !Number.isFinite(bandBottom) || bandBottom <= bandTop) {
      bandTop = 0;
      bandBottom = container.clientHeight;
    }
    setBand({ top: bandTop, bottom: bandBottom });
```

- [ ] **Step 3: Clamp endpoints and skip both-off-screen lines**

In the `for (const dep of dependencies)` loop, replace the two lines that compute `y1`/`y2`
(currently `const y1 = blockerRect.top + blockerRect.height / 2 - containerRect.top;` and the `y2`
equivalent) with clamped versions, and skip lines whose both ends are off-screen:

```ts
      const rawY1 = blockerRect.top + blockerRect.height / 2 - containerRect.top;
      const rawY2 = blockedRect.top + blockedRect.height / 2 - containerRect.top;
      const c1 = clampEndpointToBand(rawY1, bandTop, bandBottom);
      const c2 = clampEndpointToBand(rawY2, bandTop, bandBottom);
      if (c1.stub !== "none" && c2.stub !== "none") continue; // both endpoints off-screen
      const y1 = c1.y;
      const y2 = c2.y;
```

Then in the `result.push({ ... })` call, add the stub fields:

```ts
      result.push({
        id: dep.id,
        x1, y1, vx1, clearY, vx2, x2, y2,
        colorIndex: groupColorMap.get(dep.blockedCardId) ?? 0,
        stub1: c1.stub,
        stub2: c2.stub,
      });
```

- [ ] **Step 4: Apply anti-collision offsets to stubbed endpoints**

After the `for` loop finishes building `result` (just before `setLines(result);`), spread stubs that
share a column edge. Insert:

```ts
    // Spread stubbed endpoints that land on the same edge near the same x so they don't overlap.
    const COL_BUCKET = 100; // px; approximate a column by bucketing x
    const groupCounts = new Map<string, number>();
    for (const line of result) {
      if (line.stub1 !== "none") {
        const key = `${line.stub1}:${Math.round(line.x1 / COL_BUCKET)}`;
        const idx = groupCounts.get(key) ?? 0;
        groupCounts.set(key, idx + 1);
        line.x1 += stubOffset(idx);
      }
      if (line.stub2 !== "none") {
        const key = `${line.stub2}:${Math.round(line.x2 / COL_BUCKET)}`;
        const idx = groupCounts.get(key) ?? 0;
        groupCounts.set(key, idx + 1);
        line.x2 += stubOffset(idx);
      }
    }
```

- [ ] **Step 5: Add rAF-throttled scroll listeners**

In the effect that calls `measure()` (the one with the MutationObserver + resize listener), add
passive scroll listeners on each `[data-column-scroll]` container, coalesced via
`requestAnimationFrame`. Replace the effect body with:

```ts
  useEffect(() => {
    measure();
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const debouncedMeasure = () => {
      if (timerId !== null) clearTimeout(timerId);
      timerId = setTimeout(measure, 150);
    };
    let rafId: number | null = null;
    const rafMeasure = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        measure();
      });
    };
    const observer = new MutationObserver(debouncedMeasure);
    const container = containerRef.current;
    const scrollEls = container
      ? Array.from(container.querySelectorAll("[data-column-scroll]"))
      : [];
    if (container) {
      observer.observe(container, { childList: true, subtree: true, attributes: true });
    }
    scrollEls.forEach((el) => el.addEventListener("scroll", rafMeasure, { passive: true }));
    window.addEventListener("resize", measure);
    return () => {
      if (timerId !== null) clearTimeout(timerId);
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
      scrollEls.forEach((el) => el.removeEventListener("scroll", rafMeasure));
      window.removeEventListener("resize", measure);
    };
  }, [measure, containerRef]);
```

- [ ] **Step 6: Clip the overlay to the band and render chevrons for stubs**

In the returned `<svg>`, (a) add a `clipPath` in `<defs>` from the band, (b) wrap the lines' `<path>`
elements in a `<g clip-path="url(#dep-clip)">`, and (c) render a chevron at each stubbed endpoint,
omitting the arrowhead when the target (blocked) endpoint is stubbed.

In `<defs>`, after the markers `.map(...)`, add:

```tsx
        {band && (
          <clipPath id="dep-clip">
            <rect x={0} y={band.top} width="100%" height={Math.max(0, band.bottom - band.top)} />
          </clipPath>
        )}
```

Change the lines render so paths are clipped and stubs get chevrons. Replace the existing
`{lines.map((line) => { ... })}` block with:

```tsx
      <g clipPath={band ? "url(#dep-clip)" : undefined}>
        {lines.map((line) => {
          const hops = hopsMap.get(line.id) ?? { vx1Hops: [], vx2Hops: [] };
          const color = DEP_COLORS[line.colorIndex];
          const targetStubbed = line.stub2 !== "none";
          return (
            <g key={line.id}>
              <path
                d={buildPath(line, hops.vx1Hops, hops.vx2Hops)}
                stroke={color}
                strokeWidth={1.5}
                fill="none"
                markerEnd={targetStubbed ? undefined : `url(#dep-arrow-${line.colorIndex})`}
              />
              {line.stub1 !== "none" && (
                <path d={chevron(line.x1, line.y1, line.stub1)} stroke={color} strokeWidth={1.5} fill="none" />
              )}
              {line.stub2 !== "none" && (
                <path d={chevron(line.x2, line.y2, line.stub2)} stroke={color} strokeWidth={1.5} fill="none" />
              )}
            </g>
          );
        })}
      </g>
```

Add a `chevron` helper near `buildPath` (bottom of the file):

```ts
// A small ▲ (edge "top") or ▼ (edge "bottom") centered at (x, y), marking an off-screen endpoint.
function chevron(x: number, y: number, edge: Stub): string {
  const w = 4;
  const h = 4;
  if (edge === "top") {
    // pointing up
    return `M ${x - w} ${y + h} L ${x} ${y} L ${x + w} ${y + h}`;
  }
  // edge === "bottom", pointing down
  return `M ${x - w} ${y - h} L ${x} ${y} L ${x + w} ${y - h}`;
}
```

- [ ] **Step 7: Build**

Run: `npx next build 2>&1 | tail -12`
Expected: build succeeds (no type errors — note `RoutedLine` now requires `stub1`/`stub2`, set in Step 3).

- [ ] **Step 8: Full test suite**

Run: `npm test`
Expected: all suites pass (unchanged behavior for the pure helpers; overlay has no unit tests).

- [ ] **Step 9: Commit**

```bash
git add src/components/board/DependencyLines.tsx
git commit -m "feat(board): scroll-aware, band-clipped dependency overlay with off-screen stubs"
```

---

### Manual QA checklist (human — needs the running app + a writer login)

Not headlessly testable (DOM/scroll/visual). Run against http://localhost:3000 signed in as a writer:

- [ ] Scroll a column with a dependency crossing to another column → the line **follows live** while scrolling (no jump/disappear/reappear).
- [ ] Scroll an endpoint card out of view → its line ends in a **vertical stub with a ▲/▼ chevron at the viewport edge**, on the correct side; no line over the header or "+ New card".
- [ ] A column with a top-going and a bottom-going stub → the two stubs are **offset, not overlapping**.
- [ ] A dependency to/from a **completed** card draws correctly and obeys the same clipping.
- [ ] The orange cross-column line no longer crosses the "+ New card" / header areas.
- [ ] **Scrollbar:** invisible until you hover the column; on hover a **thin `ocean-4` thumb** appears with **no visible track/background** and **no content shift**.
- [ ] **Buttons:** scroll **down** past active → **`↑ Active` at the top**; scroll **up** into history → **`↓ Active` at the bottom**; both jump to the first active card; neither shows when the first active card is visible.

## Self-Review

**Spec coverage:** Clip band → T3 S2/S6. Off-screen stubs → T1 (`clampEndpointToBand`) + T3 S3/S6. Anti-collision → T1 (`stubOffset`) + T3 S4. Live scroll tracking → T3 S5. Completed-card anchors → T2 S3. Scrollbar → T2 S1/S2. Jump buttons → T2 S4/S5. Every spec goal maps to a task.

**Placeholder scan:** No TBD/TODO; every code step has concrete code; the one non-automatable area (visual QA) is an explicit human checklist, not a vague step.

**Type consistency:** `clampEndpointToBand`/`stubOffset`/`Stub` defined in T1 and consumed verbatim in T3. `RoutedLine.stub1`/`stub2` defined in T3 S1 and set in T3 S3, read in T3 S4/S6. `band` state defined in T3 S1, set in T3 S2, read in T3 S6. `.column-scroll` class defined in T2 S1, applied in T2 S2. `data-card-id` wrapper (T2 S3) is what T3's measurement relies on. `#294285`/`ocean-4` used consistently.

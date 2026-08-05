# Card Completion & Per-Column Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user mark a card completed (turns green, sinks into a scrollable history zone at the top of its column) while each column scrolls independently and lands on its first active card.

**Architecture:** Add a nullable `Card.completedAt` timestamp. A pure helper splits each column's cards into completed (history, sorted oldest→newest) and active (priority order). The board fills the viewport; each column is a sticky header + an internally-scrolling area (completed history + divider + draggable active list) + a pinned add-card form. Client effects scroll each column to its first active card on load and show a "jump to active" button when that anchor is off-screen.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7 (gitignored generated client), Tailwind v4, `@dnd-kit`, vitest (node env), Zod, Postgres.

## Global Constraints

- **Node 22+** for all commands (`nvm use 22` first if needed).
- **Prisma generated client is gitignored** (`/src/generated/prisma`); regenerate with `npx prisma generate` after any schema change — never hand-edit it.
- **`completed` is derived from `completedAt != null`** everywhere — do not add a separate boolean column.
- **Gap cards (`isGap`) can never be completed** — the completion control is hidden for them.
- **Writes go through server actions** in `src/features/board/actions.ts`, writer-gated (`requireWriter`) + audited, ending in `revalidatePath("/")`.
- **Checkbox form fields use the hidden+checkbox pattern**, parsed with `formData.getAll(name).includes("true")` (a lone `formData.get` returns the hidden "false").
- **UI labels are English** ("Completed", "Active"); **dates render in `nb-NO`**.
- **Tests are node-env vitest** (`npm test`) — no jsdom/RTL. DOM/scroll behavior is verified via `npx next build` + manual on-page check, stated honestly, never claimed as automated coverage.
- **Path alias** `@/*` → `./src/*`.
- **Commit rule:** this repo does not auto-commit; the per-task commit steps below are run during execution with the user's go-ahead.

---

### Task 1: Add `Card.completedAt` (schema + migration + client)

**Files:**
- Modify: `prisma/schema.prisma` (Card model, after `adoWorkItemId` at line 129)
- Generated (do not edit): `src/generated/prisma/*`

**Interfaces:**
- Produces: `CardModel.completedAt: Date | null` (consumed by every later task).

- [ ] **Step 1: Add the field to the schema**

In `prisma/schema.prisma`, inside `model Card`, add after the `adoWorkItemId` line:

```prisma
  completedAt    DateTime?    // null = active; set = completed (also drives history ordering)
```

- [ ] **Step 2: Create + apply the migration and regenerate the client**

Run (requires a dev `DATABASE_URL`; if you don't have one, start Prisma's sandbox with `npx prisma dev` in another terminal first, per `CLAUDE.md`):

```bash
npx prisma migrate dev --name add_card_completed
```

Expected: creates `prisma/migrations/<ts>_add_card_completed/migration.sql` (an `ALTER TABLE "Card" ADD COLUMN "completedAt" TIMESTAMP`), applies it, and regenerates the client.

- [ ] **Step 3: Verify the client now has the field**

Run: `grep -rn "completedAt" src/generated/prisma/ | head`
Expected: at least one match (the field is in the generated model).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.test\.ts\|vitest.config.ts"`
Expected: no app-code errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Card.completedAt for card completion"
```

---

### Task 2: `splitColumnCards` helper (TDD)

**Files:**
- Create: `src/features/board/completion.ts`
- Create: `src/features/board/completion.test.ts`

**Interfaces:**
- Consumes: `CardModel.completedAt` (Task 1).
- Produces:
  - `isCompleted(card: CardModel): boolean`
  - `splitColumnCards(cards: CardModel[]): { completed: CardModel[]; active: CardModel[] }`
    (completed sorted by `completedAt` ascending; active sorted by `position` ascending)

- [ ] **Step 1: Write the failing test**

Create `src/features/board/completion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { CardModel } from "@/generated/prisma/models";
import { isCompleted, splitColumnCards } from "./completion";

function card(p: Partial<CardModel>): CardModel {
  return {
    id: "x", boardId: "b", columnId: "c", title: "t", description: null,
    taskType: "OTHER", estimate: null, estimateType: "NONE", estimateDate: null,
    estimateWeeks: null, codeReview: false, isGap: false, gapSize: 1, position: 0,
    tags: [], adoWorkItemId: null, completedAt: null,
    createdAt: new Date(), updatedAt: new Date(), ...p,
  } as CardModel;
}

describe("isCompleted", () => {
  it("is true only when completedAt is set", () => {
    expect(isCompleted(card({ completedAt: null }))).toBe(false);
    expect(isCompleted(card({ completedAt: new Date() }))).toBe(true);
  });
});

describe("splitColumnCards", () => {
  it("splits completed from active", () => {
    const cards = [
      card({ id: "a", position: 0, completedAt: null }),
      card({ id: "b", position: 1, completedAt: new Date("2026-01-01") }),
    ];
    const { completed, active } = splitColumnCards(cards);
    expect(completed.map((c) => c.id)).toEqual(["b"]);
    expect(active.map((c) => c.id)).toEqual(["a"]);
  });

  it("orders completed oldest-first by completedAt", () => {
    const cards = [
      card({ id: "new", completedAt: new Date("2026-03-01") }),
      card({ id: "old", completedAt: new Date("2026-01-01") }),
    ];
    expect(splitColumnCards(cards).completed.map((c) => c.id)).toEqual(["old", "new"]);
  });

  it("orders active by position ascending", () => {
    const cards = [
      card({ id: "second", position: 5, completedAt: null }),
      card({ id: "first", position: 2, completedAt: null }),
    ];
    expect(splitColumnCards(cards).active.map((c) => c.id)).toEqual(["first", "second"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- completion`
Expected: FAIL — `Cannot find module './completion'`.

- [ ] **Step 3: Implement the helper**

Create `src/features/board/completion.ts`:

```ts
import type { CardModel } from "@/generated/prisma/models";

export function isCompleted(card: CardModel): boolean {
  return card.completedAt != null;
}

export function splitColumnCards(cards: CardModel[]): {
  completed: CardModel[];
  active: CardModel[];
} {
  const completed = cards
    .filter(isCompleted)
    .sort(
      (a, b) =>
        new Date(a.completedAt as Date).getTime() -
        new Date(b.completedAt as Date).getTime(),
    );
  const active = cards
    .filter((c) => !isCompleted(c))
    .sort((a, b) => a.position - b.position);
  return { completed, active };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- completion`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/board/completion.ts src/features/board/completion.test.ts
git commit -m "feat(board): splitColumnCards helper (completed history vs active)"
```

---

### Task 3: Exclude completed from the date cascade + `formatDateTime` (TDD)

**Files:**
- Modify: `src/features/board/dates.ts:8-61` (`computeEstimatedDates`) and add `formatDateTime`
- Create: `src/features/board/dates.test.ts`

**Interfaces:**
- Consumes: `CardModel.completedAt` (Task 1), `formatDate` (existing in `dates.ts`).
- Produces: `formatDateTime(date: Date): string` → e.g. `"21. mai 14:32"` (consumed by Task 6).
- Behaviour change: `computeEstimatedDates` maps completed cards to `null` and does **not** advance the date cursor for them.

- [ ] **Step 1: Write the failing test**

Create `src/features/board/dates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { CardModel } from "@/generated/prisma/models";
import { computeEstimatedDates, formatDateTime } from "./dates";

function card(p: Partial<CardModel>): CardModel {
  return {
    id: "x", boardId: "b", columnId: "c", title: "t", description: null,
    taskType: "OTHER", estimate: null, estimateType: "NONE", estimateDate: null,
    estimateWeeks: null, codeReview: false, isGap: false, gapSize: 1, position: 0,
    tags: [], adoWorkItemId: null, completedAt: null,
    createdAt: new Date(), updatedAt: new Date(), ...p,
  } as CardModel;
}

describe("computeEstimatedDates", () => {
  it("ignores completed cards: they get no date and don't advance the cursor", () => {
    const completed = card({ id: "done", estimateType: "WEEKS", estimateWeeks: 4, completedAt: new Date("2026-01-01") });
    const active = card({ id: "next", estimateType: "WEEKS", estimateWeeks: 2 });
    const result = computeEstimatedDates([completed, active]);

    expect(result.get("done")).toBeNull();

    // "next" is 2 weeks from today (the completed 4-week card did NOT push the cursor)
    const expected = new Date();
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() + 14);
    expect(result.get("next")?.getTime()).toBe(expected.getTime());
  });
});

describe("formatDateTime", () => {
  it("formats nb-NO date and time", () => {
    // local-time construction so the assertion is timezone-independent
    expect(formatDateTime(new Date(2026, 4, 21, 14, 32))).toBe("21. mai 14:32");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- dates`
Expected: FAIL — `formatDateTime` is not exported and/or completed cards still advance the cursor.

- [ ] **Step 3: Implement the changes**

In `src/features/board/dates.ts`, at the top of the `for (const card of cards)` loop in `computeEstimatedDates` (currently line 13), add a completed short-circuit as the first statement inside the loop:

```ts
  for (const card of cards) {
    if (card.completedAt != null) {
      result.set(card.id, null); // completed work has no future date and doesn't consume time
      continue;
    }

    if (card.isGap) {
```

Then add this export at the end of the file (after `formatDate`):

```ts
export function formatDateTime(date: Date): string {
  const time = date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(date)} ${time}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- dates`
Expected: PASS.

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/board/dates.ts src/features/board/dates.test.ts
git commit -m "feat(board): cascade skips completed cards + add formatDateTime"
```

---

### Task 4: `updateCard` sets/clears `completedAt`

**Files:**
- Modify: `src/features/board/actions.ts:264-334` (`updateCardSchema` + `updateCard`)

**Interfaces:**
- Consumes: `completed` form field (produced by Task 5's checkbox).
- Behaviour: `completed=true` on an active card → `completedAt = new Date()`; `completed=true` on an already-completed card → keep its existing `completedAt` (don't bump); `completed=false` → `completedAt = null`.

- [ ] **Step 1: Add `completed` to the schema**

In `updateCardSchema` (line 264), add after the `frontendApplicable` line:

```ts
  completed: z.enum(["true", "false"]),
```

- [ ] **Step 2: Parse the field**

In the `updateCardSchema.parse({ ... })` call, add after the `frontendApplicable` line:

```ts
      completed: formData.getAll("completed").includes("true") ? "true" : "false",
```

- [ ] **Step 3: Compute and persist `completedAt`**

Immediately before the `const card = await prisma.card.update({...})` call, insert:

```ts
    const existing = await prisma.card.findUniqueOrThrow({
      where: { id: parsed.id },
      select: { completedAt: true },
    });
    const completedAt =
      parsed.completed === "true" ? existing.completedAt ?? new Date() : null;
```

Then add `completedAt,` to the `data: { ... }` object of the update (e.g. after `codeReview: parsed.codeReview === "true",`).

- [ ] **Step 4: Record it in the audit detail**

In the `await audit(...)` call's detail object, add:

```ts
      completed: parsed.completed === "true",
```

- [ ] **Step 5: Typecheck + build**

Run: `npx next build 2>&1 | tail -12`
Expected: build succeeds (routes listed, no type errors).

- [ ] **Step 6: Commit**

```bash
git add src/features/board/actions.ts
git commit -m "feat(board): updateCard toggles Card.completedAt"
```

> Note: server actions have no automated tests in this repo (they need DB + auth). Verification is the build here and the manual check in Task 9.

---

### Task 5: "Completed" checkbox in the Edit modal

**Files:**
- Modify: `src/components/board/EditCardModal.tsx:112-157` (the checkbox row)

**Interfaces:**
- Consumes: nothing new. Produces the `completed` form field consumed by Task 4.

- [ ] **Step 1: Add the checkbox (hidden for gaps)**

Inside the `<div className="flex gap-6 flex-wrap">` block (starts line 112), add as the first child, before the "Gap / Spacer" label:

```tsx
            {!card.isGap && (
              <label className="flex items-center gap-2 text-sm text-ocean-1 dark:text-white">
                <input type="hidden" name="completed" value="false" />
                <input
                  type="checkbox"
                  name="completed"
                  value="true"
                  defaultChecked={card.completedAt != null}
                  className="accent-green-600"
                />
                Completed
              </label>
            )}
```

- [ ] **Step 2: Build**

Run: `npx next build 2>&1 | tail -12`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/board/EditCardModal.tsx
git commit -m "feat(board): Completed checkbox in edit modal (hidden for gaps)"
```

---

### Task 6: Green completed-card appearance + "Completed" line

**Files:**
- Modify: `src/components/board/Card.tsx` (import, `<article>` className, main content area)

**Interfaces:**
- Consumes: `formatDateTime` (Task 3), `CardModel.completedAt` (Task 1).

- [ ] **Step 1: Import `formatDateTime` and derive `completed`**

In `src/components/board/Card.tsx`, change the dates import (line 7) to include `formatDateTime`:

```tsx
import { formatDate, formatDateTime } from "@/features/board/dates";
```

Inside the component, after `const typeColors = ...` (line 27), add:

```tsx
  const completed = card.completedAt != null;
```

- [ ] **Step 2: Apply the green treatment to the `<article>`**

Replace the `<article>`'s `className` (line 48) with a conditional that swaps in green when completed:

```tsx
        className={`group border rounded-md px-3 py-2 flex gap-3 items-stretch ${
          canEdit ? "cursor-pointer" : ""
        } transition-colors h-[84px] overflow-hidden ${
          completed
            ? "border-green-500 border-l-[3px] border-l-green-500 bg-green-50 dark:bg-green-500/10 " +
              (canEdit ? "hover:bg-green-100 dark:hover:bg-green-500/20" : "")
            : "border-slate-300 dark:border-ocean-4 bg-white dark:bg-ocean-2 " +
              (canEdit ? "hover:bg-slate-50 dark:hover:bg-ocean-3 " : "") +
              (typeColors.border ? `border-l-[3px] ${typeColors.border}` : "")
        }`}
```

- [ ] **Step 3: Add the "Completed · <datetime>" line at the bottom of the main area**

In the left content column (the `<div className="flex-1 flex flex-col gap-1 min-w-0">`, line 50), add as its **last** child, after the badges `<div>` (closes at line 87):

```tsx
          {completed && card.completedAt && (
            <span className="text-[10px] text-green-600 dark:text-green-400 mt-auto truncate">
              ✓ Completed · {formatDateTime(new Date(card.completedAt))}
            </span>
          )}
```

- [ ] **Step 4: Build**

Run: `npx next build 2>&1 | tail -12`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/board/Card.tsx
git commit -m "feat(board): green completed-card style + completed timestamp line"
```

> The card is a fixed 84px with `overflow-hidden`; the completed line may crowd the description. That is accepted for v1 (we tune spacing after seeing it live).

---

### Task 7: Viewport-filling board layout

**Files:**
- Modify: `src/app/layout.tsx:30` (body)
- Modify: `src/app/page.tsx:12` (main)
- Modify: `src/components/board/Board.tsx:18` (board container)
- Modify: `src/components/board/DndBoard.tsx:143` (container div)

**Interfaces:** none (pure layout). Establishes the bounded height that Task 8's column scroll depends on.

- [ ] **Step 1: Make the body exactly viewport height, no page scroll**

In `src/app/layout.tsx`, change the `<body>` className (line 30) from `min-h-full flex flex-col` to:

```tsx
      <body className="h-full flex flex-col overflow-hidden">
```

- [ ] **Step 2: Let the main region flex and clip**

In `src/app/page.tsx`, change `<main className="flex-1 flex flex-col">` (line 12) to:

```tsx
    <main className="flex-1 flex flex-col min-h-0">
```

- [ ] **Step 3: Make the board fill height and stretch columns**

In `src/components/board/Board.tsx`, change the root `<div>` (line 18) from
`className="flex gap-6 overflow-x-auto p-6 min-h-full items-start"` to:

```tsx
    <div className="flex-1 min-h-0 flex gap-6 overflow-x-auto p-6 items-stretch">
```

- [ ] **Step 4: Make the DndBoard container full height**

In `src/components/board/DndBoard.tsx`, change the outer `<div>` (line 143) from
`className="relative flex gap-6"` to:

```tsx
    <div ref={containerRef} className="relative flex gap-6 h-full min-h-0 items-stretch">
```

- [ ] **Step 5: Build + manual check**

Run: `npx next build 2>&1 | tail -12` → expected: succeeds.
Manual (dev server): the page no longer scrolls vertically; the board pans horizontally with Shift+wheel when columns overflow. (Columns don't scroll internally yet — that's Task 8.)

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/components/board/Board.tsx src/components/board/DndBoard.tsx
git commit -m "feat(board): viewport-filling layout with horizontal board scroll"
```

---

### Task 8: Column structure — sticky header, scroll area, completed history + active, pinned add form

**Files:**
- Modify: `src/components/board/SortableColumn.tsx` (full rewrite of the returned JSX)

**Interfaces:**
- Consumes: `splitColumnCards` (Task 2), `Card` (Task 6), `SortableCard`, `AddCardForm`, `ColumnHeader`, `computeEstimatedDates` (Task 3).
- Produces: a `data-active-anchor` sentinel element and a `scrollRef` scroll container that Task 9's effects attach to.

- [ ] **Step 1: Rewrite `SortableColumn` to split and restructure**

Replace the entire body of `src/components/board/SortableColumn.tsx` with:

```tsx
"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CardModel } from "@/generated/prisma/models";
import type { DependencyModel } from "@/generated/prisma/models";
import { computeEstimatedDates } from "@/features/board/dates";
import { splitColumnCards } from "@/features/board/completion";
import type { ColumnWithCards } from "./Board";
import { SortableCard } from "./SortableCard";
import { Card } from "./Card";
import { ColumnHeader } from "./ColumnHeader";
import { AddCardForm } from "./AddCardForm";

export function SortableColumn({
  column,
  allCards,
  dependencies,
  canEdit = true,
}: {
  column: ColumnWithCards;
  allCards: CardModel[];
  dependencies: DependencyModel[];
  canEdit?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  const { completed, active } = useMemo(
    () => splitColumnCards(column.cards),
    [column.cards],
  );
  const activeIds = active.map((c) => c.id);

  const estimatedDates = useMemo(
    () => computeEstimatedDates(column.cards),
    [column.cards],
  );

  return (
    <div className="shrink-0 w-72 flex flex-col gap-2 h-full min-h-0">
      <div className="shrink-0">
        <ColumnHeader column={column} canEdit={canEdit} />
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          data-column-scroll={column.id}
          className="h-full overflow-y-auto flex flex-col gap-2 pr-1"
        >
          {completed.map((card) => (
            <Card
              key={card.id}
              card={card}
              estimatedDone={null}
              allCards={allCards}
              dependencies={dependencies}
              canEdit={canEdit}
            />
          ))}

          {completed.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400 dark:text-ocean-6 px-1">
              <span className="flex-1 border-t border-slate-200 dark:border-ocean-4" />
              Active
              <span className="flex-1 border-t border-slate-200 dark:border-ocean-4" />
            </div>
          )}

          {/* Anchor: top of the active list. Sits at the bottom when there are no active cards. */}
          <div data-active-anchor className="scroll-mt-2" />

          <SortableContext items={activeIds} strategy={verticalListSortingStrategy}>
            <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[40px]">
              {active.map((card) => (
                <SortableCard
                  key={card.id}
                  card={card}
                  estimatedDone={estimatedDates.get(card.id) ?? null}
                  allCards={allCards}
                  dependencies={dependencies}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      </div>

      {canEdit && (
        <div className="shrink-0">
          <AddCardForm columnId={column.id} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build + manual check**

Run: `npx next build 2>&1 | tail -12` → expected: succeeds.
Manual: completed cards appear green at the top with an "Active" divider below them; active cards below the divider are still draggable and reorder/move across columns; the add-card form is pinned at the bottom of each column; each column scrolls internally. (Auto-scroll-to-active and the jump button come in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add src/components/board/SortableColumn.tsx
git commit -m "feat(board): column history/active split with sticky header + pinned add form"
```

---

### Task 9: Initial scroll to first active card + "jump to active" button

**Files:**
- Modify: `src/components/board/SortableColumn.tsx` (add refs, effects, button)

**Interfaces:**
- Consumes: the `data-active-anchor` sentinel and scroll container from Task 8.

- [ ] **Step 1: Add refs, imports, and the anchor scroll helper**

At the top of `SortableColumn.tsx`, extend the React import and add refs/state inside the component:

```tsx
import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
```

Inside the component (after `const activeIds = ...`), add:

```tsx
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [anchorPos, setAnchorPos] = useState<"visible" | "above" | "below">("visible");
  const firstActiveId = active[0]?.id ?? null;

  const scrollToAnchor = useCallback((smooth: boolean) => {
    const scroller = scrollRef.current;
    const anchor = anchorRef.current;
    if (!scroller || !anchor) return;
    const top =
      anchor.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    scroller.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Land on the first active card on mount and whenever the first active card changes
  // (e.g. after completing one). Not re-run on every scroll, so it won't fight the user.
  useLayoutEffect(() => {
    scrollToAnchor(false);
  }, [firstActiveId, completed.length, scrollToAnchor]);

  // Track whether the anchor is above/below/in the viewport to drive the jump button.
  useEffect(() => {
    const scroller = scrollRef.current;
    const anchor = anchorRef.current;
    if (!scroller || !anchor) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnchorPos("visible");
          return;
        }
        const anchorTop = anchor.getBoundingClientRect().top;
        const scrollerTop = scroller.getBoundingClientRect().top;
        setAnchorPos(anchorTop < scrollerTop ? "above" : "below");
      },
      { root: scroller, threshold: 0 },
    );
    io.observe(anchor);
    return () => io.disconnect();
  }, []);
```

- [ ] **Step 2: Attach `scrollRef`/`anchorRef` and render the button**

Add `ref={scrollRef}` to the scroll container `<div data-column-scroll=...>` and `ref={anchorRef}` to the `<div data-active-anchor ...>` sentinel from Task 8.

Then, inside the `<div className="relative flex-1 min-h-0">` wrapper (as the last child, a sibling of the scroll container), add the button:

```tsx
        {anchorPos !== "visible" && (
          <button
            type="button"
            onClick={() => scrollToAnchor(true)}
            className="absolute left-1/2 -translate-x-1/2 bottom-2 z-10 rounded-full px-3 py-1 text-xs font-medium shadow-md bg-ocean-5 text-white hover:bg-ocean-6 transition"
          >
            {anchorPos === "below" ? "↓ Active" : "↑ Active"}
          </button>
        )}
```

- [ ] **Step 3: Build**

Run: `npx next build 2>&1 | tail -12`
Expected: build succeeds.

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: all suites pass (completion + dates + existing ado/sprint suites).

- [ ] **Step 5: Manual QA checklist (dev server, logged in as a writer)**

- [ ] Open the modal on an active card, tick **Completed**, Save → card turns green, moves to the top history zone with a `✓ Completed · <date time>` line; the right panel (tags/date) is unchanged.
- [ ] The column stays anchored on the first active card after completing.
- [ ] Scroll **up** into history → a **`↓ Active`** button appears; clicking returns to the first active card.
- [ ] With many active cards, scroll **down** past the first active card → an **`↑ Active`** button appears; clicking returns to the first active card.
- [ ] Reload → each column lands on its first active card; a column with everything completed shows history + the add form at the bottom.
- [ ] Un-tick **Completed** on a green card → it returns to the active list at its position; downstream active dates recompute.
- [ ] Active cards still drag/reorder and move between columns; completed cards do not drag.
- [ ] Shift+wheel pans the board horizontally; vertical wheel scrolls the column under the cursor.
- [ ] **Dependency arrows:** verify `DependencyLines` still render sensibly. With per-column internal scroll they may mis-position for off-screen/completed cards (completed cards render via `<Card>` and lack the `data-card-id` wrapper that `SortableCard` provides). If broken, that is a **known follow-up** (recompute arrows on column scroll and/or scope them to active cards) — out of scope for this plan; note it rather than silently expanding scope.

- [ ] **Step 6: Commit**

```bash
git add src/components/board/SortableColumn.tsx
git commit -m "feat(board): auto-scroll to first active card + jump-to-active button"
```

---

## Self-Review

**Spec coverage:**
- Completion data model → Task 1. Mark-complete UI + server → Tasks 5, 4. Completed-first ordering → Task 2. Green style + completed line → Task 6. Viewport-fill layout + horizontal scroll → Task 7. Sticky header + history/active + pinned add form → Task 8. Initial scroll + bidirectional jump button → Task 9. Date cascade excludes completed → Task 3. Gaps not completable → Global Constraints + Task 5. Non-draggable completed → Task 8 (completed render via `<Card>`, outside `SortableContext`). All spec sections map to a task.

**Placeholder scan:** No TBD/TODO; every code step has concrete code. The one accepted soft spot (84px crowding) and the one known risk (DependencyLines under per-column scroll) are called out explicitly, not left vague.

**Type consistency:** `splitColumnCards`/`isCompleted` (Task 2) are used verbatim in Task 8. `formatDateTime` (Task 3) is used verbatim in Task 6. `completedAt` (Task 1) is referenced consistently as `Date | null`. The `completed` form field name matches across Tasks 4 and 5. `data-active-anchor` and `scrollRef`/`anchorRef` names match across Tasks 8 and 9.

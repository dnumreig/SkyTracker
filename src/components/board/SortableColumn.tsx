"use client";

import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
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
          ref={scrollRef}
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
          <div ref={anchorRef} data-active-anchor />

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

        {anchorPos !== "visible" && (
          <button
            type="button"
            onClick={() => scrollToAnchor(true)}
            aria-label="Jump to active cards"
            className="absolute left-1/2 -translate-x-1/2 bottom-2 z-10 rounded-full px-3 py-1 text-xs font-medium shadow-md bg-ocean-5 text-white hover:bg-ocean-6 transition"
          >
            {anchorPos === "below" ? "↓ Active" : "↑ Active"}
          </button>
        )}
      </div>

      {canEdit && (
        <div className="shrink-0">
          <AddCardForm columnId={column.id} />
        </div>
      )}
    </div>
  );
}

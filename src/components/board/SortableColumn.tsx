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

import type { CardModel, ColumnModel, DependencyModel } from "@/generated/prisma/models";
import { isCompleted } from "@/features/board/completion";

// Builds the payload for the Telenor timeline tool (/timeline).
//
// Time unit: fractional months since 1 Aug 2026 — must match the tool's axis
// (BASE below mirrors gantt/timeline.html; the axis spans 17 months).
//
// Scheduling mirrors features/board/dates.ts (computeEstimatedDates): a cursor
// walks each column's active cards in priority order; WEEKS advances it,
// HARD_DATE moves it to the date, gaps behave like dates.ts. One deliberate
// divergence: SCOPES/NONE cards get a DEFAULT_WEEKS block instead of "no date",
// because a timeline bar needs a width.

const BASE_Y = 2026;
const BASE_M = 7; // august (0-indexed)
const N_MONTHS = 17;
const DEFAULT_WEEKS = 2;
const WEEK_UNITS = 7 / 30.44; // one week in month-units

export type TimelineSubtask = { id: string; label: string; start: number; end: number };
export type TimelineTask = {
  id: string;
  lane: string;
  label: string;
  start: number;
  end: number;
  deps: string[];
  subtasks: TimelineSubtask[];
  source: "skytracker";
};
export type TimelinePayload = {
  syncedAt: string;
  boardName: string;
  lane: { key: string; name: string };
  tasks: TimelineTask[];
  cardDeps: { blocker: string; blocked: string }[];
};

export function dateToUnit(d: Date): number {
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return (
    (d.getFullYear() - BASE_Y) * 12 +
    (d.getMonth() - BASE_M) +
    (d.getDate() - 1) / daysInMonth
  );
}

const clamp = (v: number) => Math.max(0, Math.min(N_MONTHS, v));

type ColumnWithCards = ColumnModel & { cards: CardModel[] };

export function buildTimelinePayload(
  boardName: string,
  columns: ColumnWithCards[],
  dependencies: DependencyModel[],
  now: Date,
): TimelinePayload {
  const today = clamp(dateToUnit(now));
  const knownCards = new Set<string>();
  const tasks: TimelineTask[] = [];

  for (const col of columns) {
    let cursor = today;
    const subtasks: TimelineSubtask[] = [];
    const active = col.cards
      .filter((c) => !isCompleted(c))
      .sort((a, b) => a.position - b.position);

    for (const card of active) {
      knownCards.add(card.id);

      if (card.isGap) {
        // Same cursor semantics as dates.ts: dated gaps consume time, bare gaps don't.
        if (card.estimateType === "HARD_DATE" && card.estimateDate) {
          cursor = clamp(dateToUnit(card.estimateDate));
        } else if (card.estimateWeeks) {
          cursor = clamp(cursor + card.estimateWeeks * WEEK_UNITS);
        }
        continue;
      }

      const start = cursor;
      let end: number;
      if (card.estimateType === "HARD_DATE" && card.estimateDate) {
        end = clamp(dateToUnit(card.estimateDate));
        if (end <= start) end = clamp(start + WEEK_UNITS / 2); // frist passert → kort strek
      } else if (card.estimateType === "WEEKS" && card.estimateWeeks) {
        end = clamp(start + card.estimateWeeks * WEEK_UNITS);
      } else {
        end = clamp(start + DEFAULT_WEEKS * WEEK_UNITS);
      }

      subtasks.push({ id: "st-card-" + card.id, label: card.title, start, end });
      cursor = end;
    }

    if (subtasks.length) {
      tasks.push({
        id: "st-col-" + col.id,
        lane: "skytracker",
        label: col.title + (col.description ? " — " + col.description : ""),
        start: Math.min(...subtasks.map((s) => s.start)),
        end: Math.max(...subtasks.map((s) => s.end)),
        deps: [],
        subtasks,
        source: "skytracker",
      });
    }
  }

  // Card-level dependencies ship as raw data only — lane-level finish-to-start
  // would push whole developer lanes around in the timeline tool.
  const cardDeps = dependencies
    .filter((d) => knownCards.has(d.blockerCardId) && knownCards.has(d.blockedCardId))
    .map((d) => ({
      blocker: "st-card-" + d.blockerCardId,
      blocked: "st-card-" + d.blockedCardId,
    }));

  return {
    syncedAt: now.toISOString(),
    boardName,
    lane: { key: "skytracker", name: "SkyTracker · Teknisk" },
    tasks,
    cardDeps,
  };
}

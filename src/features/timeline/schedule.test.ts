import { describe, expect, it } from "vitest";
import { buildTimelinePayload, dateToUnit } from "./schedule";
import type { CardModel, ColumnModel, DependencyModel } from "@/generated/prisma/models";

const NOW = new Date(2026, 7, 10); // 10 Aug 2026

function card(over: Partial<CardModel>): CardModel {
  return {
    id: "c1",
    boardId: "b1",
    columnId: "col1",
    title: "Kort",
    description: null,
    taskType: "OTHER",
    estimate: null,
    estimateType: "NONE",
    estimateDate: null,
    estimateWeeks: null,
    codeReview: false,
    isGap: false,
    gapSize: 1,
    position: 0,
    tags: [],
    adoWorkItemId: null,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as CardModel;
}

function column(cards: CardModel[], over: Partial<ColumnModel> = {}): ColumnModel & { cards: CardModel[] } {
  return {
    id: "col1",
    boardId: "b1",
    title: "THM",
    description: null,
    position: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
    cards,
  } as ColumnModel & { cards: CardModel[] };
}

describe("dateToUnit", () => {
  it("maps 1 Aug 2026 to 0 and 1 Jan 2027 to 5", () => {
    expect(dateToUnit(new Date(2026, 7, 1))).toBeCloseTo(0);
    expect(dateToUnit(new Date(2027, 0, 1))).toBeCloseTo(5);
  });
});

describe("buildTimelinePayload", () => {
  it("schedules WEEKS cards sequentially from now", () => {
    const cols = [column([
      card({ id: "a", title: "A", estimateType: "WEEKS", estimateWeeks: 4, position: 0 }),
      card({ id: "b", title: "B", estimateType: "WEEKS", estimateWeeks: 2, position: 1 }),
    ])];
    const p = buildTimelinePayload("SkyTracker", cols, [], NOW);
    const [a, b] = p.tasks[0].subtasks;
    expect(a.start).toBeCloseTo(dateToUnit(NOW));
    expect(b.start).toBeCloseTo(a.end);
    expect(a.end - a.start).toBeCloseTo(4 * (7 / 30.44));
  });

  it("excludes completed cards and lanes with no active cards", () => {
    const cols = [
      column([card({ id: "done", completedAt: NOW })]),
      column([card({ id: "open" })], { id: "col2", title: "KSO" }),
    ];
    const p = buildTimelinePayload("SkyTracker", cols, [], NOW);
    expect(p.tasks).toHaveLength(1);
    expect(p.tasks[0].label).toContain("KSO");
  });

  it("hard dates end on the date; passed deadlines get a short bar", () => {
    const cols = [column([
      card({ id: "h", estimateType: "HARD_DATE", estimateDate: new Date(2026, 9, 1), position: 0 }),
      card({ id: "p", estimateType: "HARD_DATE", estimateDate: new Date(2026, 5, 1), position: 1 }),
    ])];
    const p = buildTimelinePayload("SkyTracker", cols, [], NOW);
    const [h, past] = p.tasks[0].subtasks;
    expect(h.end).toBeCloseTo(dateToUnit(new Date(2026, 9, 1)));
    expect(past.end).toBeGreaterThan(past.start);
  });

  it("bare gaps consume no time, dated gaps move the cursor (dates.ts semantics)", () => {
    const cols = [column([
      card({ id: "g1", isGap: true, position: 0 }),
      card({ id: "g2", isGap: true, estimateType: "WEEKS", estimateWeeks: 2, position: 1 }),
      card({ id: "w", estimateType: "WEEKS", estimateWeeks: 1, position: 2 }),
    ])];
    const p = buildTimelinePayload("SkyTracker", cols, [], NOW);
    const w = p.tasks[0].subtasks[0];
    expect(p.tasks[0].subtasks).toHaveLength(1); // gaps emit no bars
    expect(w.start).toBeCloseTo(dateToUnit(NOW) + 2 * (7 / 30.44));
  });

  it("task bounds derive from subtasks; card deps ship as raw data only", () => {
    const cols = [
      column([card({ id: "a" })]),
      column([card({ id: "b", columnId: "col2" })], { id: "col2", title: "KSO" }),
    ];
    const deps = [{ id: "d1", blockerCardId: "a", blockedCardId: "b", createdAt: NOW } as DependencyModel];
    const p = buildTimelinePayload("SkyTracker", cols, deps, NOW);
    for (const t of p.tasks) {
      expect(t.start).toBeCloseTo(Math.min(...t.subtasks.map((s) => s.start)));
      expect(t.end).toBeCloseTo(Math.max(...t.subtasks.map((s) => s.end)));
      expect(t.deps).toHaveLength(0);
    }
    expect(p.cardDeps).toEqual([{ blocker: "st-card-a", blocked: "st-card-b" }]);
  });
});

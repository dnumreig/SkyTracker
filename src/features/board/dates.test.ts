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

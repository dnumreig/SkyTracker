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

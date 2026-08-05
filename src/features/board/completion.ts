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

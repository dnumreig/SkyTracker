import { describe, expect, it } from "vitest";
import { mergePlans, type Plan, type PlanTask } from "./merge";

function task(over: Partial<PlanTask>): PlanTask {
  return {
    id: "t1",
    lane: "produkt",
    label: "Oppgave",
    start: 1,
    end: 2,
    deps: [],
    subtasks: [],
    fv: {},
    ...over,
  };
}
function plan(tasks: PlanTask[], over: Partial<Plan> = {}): Plan {
  return { lanes: [{ key: "produkt", name: "Produkt" }], tasks, deleted: {}, ...over };
}

describe("mergePlans — field-level versioning", () => {
  it("edits to different tasks both survive", () => {
    const stored = plan([
      task({ id: "a", start: 5, end: 6, fv: { tid: 1 } }),
      task({ id: "b" }),
    ]);
    const incoming = plan([
      task({ id: "a" }),
      task({ id: "b", label: "Nytt navn", fv: { label: 1 } }),
    ]);
    const m = mergePlans(stored, incoming);
    expect(m.tasks.find((t) => t.id === "a")!.start).toBe(5);
    expect(m.tasks.find((t) => t.id === "b")!.label).toBe("Nytt navn");
  });

  it("edits to different fields on the SAME task both survive", () => {
    const stored = plan([task({ id: "a", start: 5, end: 6, fv: { tid: 2 } })]);
    const incoming = plan([task({ id: "a", status: "gul", statusCause: "Ekstern blokkering", fv: { status: 1 } })]);
    const m = mergePlans(stored, incoming);
    const a = m.tasks[0];
    expect(a.start).toBe(5);            // stored's newer tid wins
    expect(a.status).toBe("gul");       // incoming's newer status wins
    expect(a.fv).toMatchObject({ tid: 2, status: 1 });
  });

  it("same field, same version, different values → incoming (last write) wins that field only", () => {
    const stored = plan([task({ id: "a", label: "A hos Kristoffer", start: 9, end: 10, fv: { label: 3, tid: 5 } })]);
    const incoming = plan([task({ id: "a", label: "A hos Gjermund", fv: { label: 3 } })]);
    const m = mergePlans(stored, incoming);
    expect(m.tasks[0].label).toBe("A hos Gjermund");
    expect(m.tasks[0].start).toBe(9);   // tid untouched — stored keeps it
  });

  it("higher stored version beats lower incoming version", () => {
    const stored = plan([task({ id: "a", label: "Nyest", fv: { label: 4 } })]);
    const incoming = plan([task({ id: "a", label: "Utdatert", fv: { label: 2 } })]);
    expect(mergePlans(stored, incoming).tasks[0].label).toBe("Nyest");
  });

  it("tombstone wins over an unedited task, loses to a task edited past it", () => {
    const stored = plan([task({ id: "gone", fv: { label: 1 } }), task({ id: "kept", fv: { label: 1 } })]);
    const incoming = plan([], { deleted: { gone: 1, kept: 1 } });
    // "kept" was edited after the delete on another client
    const incoming2 = mergePlans(stored, incoming);
    expect(incoming2.tasks.find((t) => t.id === "gone")).toBeUndefined();
    expect(incoming2.tasks.find((t) => t.id === "kept")).toBeUndefined();

    const edited = plan([task({ id: "kept", label: "Redigert etter sletting", fv: { label: 2 } })]);
    const m = mergePlans(incoming2, edited);
    expect(m.tasks.find((t) => t.id === "kept")!.label).toBe("Redigert etter sletting");
  });

  it("tasks added on both sides are unioned; derived bounds follow merged subtasks", () => {
    const stored = plan([task({ id: "new-s", fv: {} })]);
    const incoming = plan([
      task({
        id: "new-i",
        subtasks: [
          { id: "s1", label: "D1", start: 2, end: 3 },
          { id: "s2", label: "D2", start: 3, end: 5 },
        ],
        start: 0,
        end: 0,
        fv: { subtasks: 1 },
      }),
    ]);
    const m = mergePlans(stored, incoming);
    expect(m.tasks.map((t) => t.id).sort()).toEqual(["new-i", "new-s"]);
    const ni = m.tasks.find((t) => t.id === "new-i")!;
    expect(ni.start).toBe(2);
    expect(ni.end).toBe(5);
  });

  it("editedBy/editedAt follow the newest edit stamp", () => {
    const stored = plan([task({ id: "a", editedBy: "Kristoffer", editedAt: "2026-08-11T10:00:00Z", start: 9, end: 10, fv: { tid: 5 } })]);
    const incoming = plan([task({ id: "a", editedBy: "Gjermund", editedAt: "2026-08-11T11:00:00Z", fv: { status: 1 }, status: "gul" })]);
    const m = mergePlans(stored, incoming);
    expect(m.tasks[0].editedBy).toBe("Gjermund");
    expect(m.tasks[0].start).toBe(9); // eldre tid-felt beholdes likevel
  });

  it("lane rename with higher version wins; unknown lanes are unioned", () => {
    const stored = plan([], { lanes: [{ key: "produkt", name: "Produkt", v: 2 }] });
    const incoming = plan([], { lanes: [{ key: "produkt", name: "Gammelt navn", v: 1 }, { key: "ny", name: "Ny strøm" }] });
    const m = mergePlans(stored, incoming);
    expect(m.lanes.find((l) => l.key === "produkt")!.name).toBe("Produkt");
    expect(m.lanes.find((l) => l.key === "ny")).toBeTruthy();
  });
});

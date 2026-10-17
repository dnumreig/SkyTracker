import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AdoWorkItem, IterationNode } from "./client";
import { ADO_CHILD_REL } from "./config";
import type { StateMap } from "./states";
import { deliveredDay, parseSprints, readStories } from "./sync";

const fixture = <T>(name: string): T => JSON.parse(readFileSync(path.join(process.cwd(), "src/features/ado/fixtures", name), "utf8")) as T;

describe("parseSprints", () => {
  it("keeps the dated «Sprint N» nodes, as days, sorted by start", () => {
    const s = parseSprints(fixture<IterationNode>("iterations.json"));
    expect(s.map((x) => x.name)).toEqual(["Sprint 68", "Sprint 69", "Sprint 70", "Sprint 71"]);
    expect(s[3]).toEqual({ name: "Sprint 71", path: "Skytale\\Sprint 71", start: "2026-10-05", finish: "2026-10-16" });
  });
  it("keeps the iteration's identifier as the sprint's id when ADO sends it (Capacity is read by it, R12)", () => {
    const s = parseSprints({ name: "Skytale", children: [{ name: "Sprint 71", identifier: "e3e86111-5688-4555-b348-01be7b153370", attributes: { startDate: "2026-10-05T00:00:00Z", finishDate: "2026-10-23T00:00:00Z" } }] });
    expect(s[0].id).toBe("e3e86111-5688-4555-b348-01be7b153370");
  });
});

describe("readStories and deliveredDay", () => {
  const items = fixture<AdoWorkItem[]>("feature-with-stories.json");
  const byId = new Map(items.map((w) => [w.id, w]));
  const feature = byId.get(4742)!;
  it("counts the child stories without the discovery story, sums points, points done, and names the latest sprint", () => {
    expect(readStories(feature, byId, 4794)).toEqual({ count: 2, pointsTotal: 8, pointsDone: 3, iteration: "Sprint 71" });
    expect(readStories(feature, byId).count).toBe(3);
  });
  it("deliveredDay is the ClosedDate day for Closed, ResolvedDate for Resolved, null otherwise", () => {
    expect(deliveredDay({ id: 1, fields: { "System.State": "Closed", "Microsoft.VSTS.Common.ClosedDate": "2026-12-03T14:12:00Z" } })).toBe("2026-12-03");
    expect(deliveredDay({ id: 1, fields: { "System.State": "Resolved", "Microsoft.VSTS.Common.ResolvedDate": "2026-12-01T09:00:00Z" } })).toBe("2026-12-01");
    expect(deliveredDay({ id: 1, fields: { "System.State": "Active" } })).toBeNull();
  });
  it("R18: with ADO's categories a story in Develop or QA counts as done; without them only Resolved and Closed do", () => {
    const story = (id: number, state: string, points: number): AdoWorkItem => ({ id, fields: { "System.WorkItemType": "User Story", "System.State": state, "Microsoft.VSTS.Scheduling.StoryPoints": points } });
    const feat: AdoWorkItem = { id: 1, fields: { "System.WorkItemType": "Feature" }, relations: [10, 11, 12].map((id) => ({ rel: ADO_CHILD_REL, url: "https://dev.azure.com/SkytaleAS/_apis/wit/workItems/" + id })) };
    const byId = new Map([story(10, "Develop", 3), story(11, "QA", 2), story(12, "Codereview", 5)].map((w) => [w.id, w]));
    const map: StateMap = new Map([["User Story/Develop", "Resolved"], ["User Story/QA", "Resolved"], ["User Story/Codereview", "InProgress"]]);
    expect(readStories(feat, byId, undefined, map)).toMatchObject({ count: 3, pointsTotal: 10, pointsDone: 5 });
    expect(readStories(feat, byId).pointsDone).toBe(0);
  });
});

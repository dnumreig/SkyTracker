import { describe, expect, it } from "vitest";
import { AdoRequestError } from "./client";
import { categoryOf, isDeveloped, readStateMap } from "./states";

const STATES: Record<string, { name: string; category: string }[]> = {
  Bug: [{ name: "New", category: "Proposed" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }, { name: "Removed", category: "Removed" }],
  "User Story": [{ name: "New", category: "Proposed" }, { name: "Codereview", category: "InProgress" }, { name: "Develop", category: "Resolved" }, { name: "QA", category: "Resolved" }, { name: "Closed", category: "Completed" }],
};
const client = (fail?: Error) => ({ states: async (t: string) => { if (fail) throw fail; return STATES[t] ?? []; } });

describe("R18: ADO's state categories", () => {
  it("maps every state of every type to its category, so a custom state counts as its category says", async () => {
    const m = await readStateMap(client(), ["Bug", "User Story"]);
    expect(categoryOf(m, "Bug", "Develop")).toBe("Resolved");
    expect(categoryOf(m, "User Story", "Codereview")).toBe("InProgress");
    expect(isDeveloped(m, "Bug", "QA")).toBe(true);
    expect(isDeveloped(m, "Bug", "Closed")).toBe(true);
    expect(isDeveloped(m, "User Story", "Codereview")).toBe(false);
  });
  it("without a map it falls back to the names Resolved and Closed; a failed call gives null, a rejected token still throws", async () => {
    expect(isDeveloped(null, "Bug", "Resolved")).toBe(true);
    expect(isDeveloped(null, "Bug", "Develop")).toBe(false);
    expect(await readStateMap(client(new Error("network")), ["Bug"])).toBeNull();
    await expect(readStateMap(client(new AdoRequestError(401, "ADO rejected the token")), ["Bug"])).rejects.toThrow(/rejected/);
  });
});

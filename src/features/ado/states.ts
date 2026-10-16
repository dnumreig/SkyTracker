// R18: ADO puts every work item state in a category (Proposed, InProgress, Resolved, Completed, Removed). Read per type once
// per refresh, so a custom state (Codereview, Develop, QA) counts as its category says, never by its name.
import { AdoRequestError, type AdoClient } from "./client";

export type StateCategory = "Proposed" | "InProgress" | "Resolved" | "Completed" | "Removed";
export type StateMap = Map<string, StateCategory>;   // key: «<type>/<state>»
const CATEGORIES: readonly string[] = ["Proposed", "InProgress", "Resolved", "Completed", "Removed"];

/** The categories of the given types' states; null when ADO did not answer (the callers fall back to the names). */
export async function readStateMap(client: Pick<AdoClient, "states">, types: string[]): Promise<StateMap | null> {
  try {
    const map: StateMap = new Map();
    for (const type of types) for (const s of await client.states(type)) if (CATEGORIES.includes(s.category)) map.set(type + "/" + s.name, s.category as StateCategory);
    return map;
  } catch (e) {
    if (e instanceof AdoRequestError && e.status === 401) throw e;   // a rejected token stops the read as before
    console.warn("ADO states skipped:", e instanceof Error ? e.message : e);
    return null;
  }
}
export function categoryOf(map: StateMap | null, type: string, state: string): StateCategory | undefined {
  return map ? map.get(type + "/" + state) : undefined;
}
/** Developed: category Resolved or Completed; without a map (or an unknown state), the names Resolved and Closed. */
export function isDeveloped(map: StateMap | null, type: string, state: string): boolean {
  const c = categoryOf(map, type, state);
  return c ? c === "Resolved" || c === "Completed" : state === "Resolved" || state === "Closed";
}

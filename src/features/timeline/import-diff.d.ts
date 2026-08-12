import type { Plan, PlanTask, TaskFieldGroup } from "./merge";

export type ImportChange = {
  kind: "ny" | "endret" | "slettet" | "bevart";
  id: string;
  label: string;
  groups?: TaskFieldGroup[];
  before?: PlanTask;
  after?: PlanTask;
};

export declare function computeImportDiff(
  current: Plan,
  incoming: Plan,
  opts?: { editor?: string; now?: string },
): { plan: Plan; changes: ImportChange[] };

export declare const IMPORT_GROUP_PROPS: Record<TaskFieldGroup, string[]>;

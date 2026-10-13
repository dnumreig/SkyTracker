import type { Plan, PlanLane, PlanTask, Sprint, TaskFieldGroup, Wish, WishSource, WishStatus, Release } from "./merge";

export declare function progressFraction(p: PlanTask["progress"] | undefined | null): number | null;
export declare function progressSignal(task: PlanTask, todayUnit: number): { code: "gronn" | "gul" | "rod"; done: number; elapsed: number } | null;
export declare function epicProgressSignal(plan: Plan, laneKey: string, todayUnit: number): "gronn" | "gul" | "rod" | null;
export declare function progressText(task: PlanTask, signal: { done: number; elapsed: number }): string;
export type CapacityMode = "transition" | "normal";
export declare const MIX: Record<CapacityMode, number>;
export declare const MIX_LABEL: Record<CapacityMode, string>;
export declare function capacityFactor(plan: Partial<Plan> | null | undefined): number;
export declare function elapsedWeeks(rawWeeks: number, factor: number): number;
export declare function queueFloor(plan: Plan, taskId: string): { floor: number | null; by: string | null; kind: "dep" | "queue" | null };
export declare function resolveQueue(plan: Plan): { id: string; by: string | null; kind: "dep" | "queue" }[];
export declare function dayKey(d: Date): string;
export declare function currentSprint(sprints: Sprint[] | undefined | null, date: Date): Sprint | null;
export declare function sprintDay(sprint: Sprint, date: Date): number;
export declare function sprintLabel(sprints: Sprint[] | undefined | null, date: Date): string;

export declare const BASE_Y: number;
export declare const BASE_M: number;
export declare const N_MONTHS: number;
export declare const WEEK: number;
export declare const SCHEMA: "epics-v1";
export declare const OWNER_DEFAULT: string;
export type EpicStatusCode = "gronn" | "gul" | "rod" | "venter" | "ingen-mal" | "tom";
export declare const STATUS_LABEL: Record<EpicStatusCode, string>;
export type FeatureState = "ny" | "utredes" | "klar" | "aktiv" | "levert";
export type EpicState = "forslag" | "aktiv" | "avsluttet";
export declare const BACKLOG: "_backlog";
export declare const FEATURE_STATES: FeatureState[];
export declare const EPIC_STATES: EpicState[];
export declare const STATE_LABEL: Record<FeatureState, string>;
export declare const EPIC_STATE_LABEL: Record<EpicState, string>;
export declare const OUTCOMES: ("nådd" | "ikke nådd" | "endret")[];
export declare const WISH_SOURCES: WishSource[];
export declare const WISH_SOURCE_LABEL: Record<WishSource, string>;
export declare const WISH_STATUSES: WishStatus[];
export declare const WISH_STATUS_LABEL: Record<WishStatus, string>;
export declare const SIZE_CLASSES: ("S" | "M" | "L" | "XL")[];
export declare const FEATURE_TYPES: ("feature" | "teknisk" | "vedlikehold")[];
export declare const FEATURE_TYPE_LABEL: Record<"feature" | "teknisk" | "vedlikehold", string>;
export declare const AREAS: string[];
export declare function normalizeAreas(v: unknown): string[];
export declare function wishesByStatus(plan: Plan): Record<WishStatus, Wish[]>;
export declare function shelfTasks(plan: Plan): PlanTask[];
/** R13: delivery of a linked feature is ADO's; an unlinked one can be marked delivered by hand. */
export declare function canMarkDelivered(task: PlanTask): boolean;
/** R13: marks it delivered on `day` (YYYY-MM-DD); a discovery becomes an estimate. Returns the field groups touched. */
export declare function markDelivered(task: PlanTask, day: string): TaskFieldGroup[];
/** R13: an estimated feature on the shelf or in an epic can go back to discovery. */
export declare function canRestartDiscovery(task: PlanTask): boolean;
/** R13: the lane rule both pages share; returns the field groups touched (empty when the lane is unchanged). */
export declare function applyLaneChange(task: PlanTask, laneKey: string, todayDay: string): TaskFieldGroup[];
/** R13: the board's column for a feature. */
export declare function boardColumn(task: PlanTask): "ny" | "utredes" | "klar" | "aktiv" | "levert";
/** R13: whether the board may move the feature to that column. */
export declare function featureTransition(task: PlanTask, to: string): boolean;
export declare function epicCounts(plan: Plan): { forslag: number; aktiv: number; avsluttet: number };
export declare function sizeClass(task: PlanTask): "S" | "M" | "L" | "XL" | "";
export declare function sizeClassDerived(task: PlanTask): "S" | "M" | "L" | "XL" | "";
export declare function sizeClassText(task: PlanTask): string;
export declare function bufferLabel(task: PlanTask): string;
export declare function rawLabel(task: PlanTask): string;
export declare function previewPlacement(plan: Plan, taskId: string, laneKey: string): {
  before: EpicStatusCode; after: EpicStatusCode; window: string;
  featureStart: number; featureWeeks: { likely: number; late: number } | null; featureWindow: string;
  pushed: { id: string; label: string; laneKey: string; weeks: number }[];
  epics: { key: string; name: string; before: EpicStatusCode; after: EpicStatusCode }[];
} | null;
export declare function dateToUnit(d: Date): number;
export declare function unitToDate(u: number): Date;
export declare function fmtDate(d: Date): string;
export declare function normalizePlan(plan: unknown): Plan;
export declare function epicStatus(plan: Plan, laneKey: string): { code: EpicStatusCode; likely?: number; late?: number };
export declare function shiftTask(task: PlanTask, delta: number): number;
export declare function resolveDeps(plan: Plan): { id: string; by: string | null }[];
export declare function rangeWeeks(task: PlanTask): { likely: number; late: number } | null;
export declare function rangeLabel(task: PlanTask): string;
export declare function goalText(lane: PlanLane): string;
export declare function exampleSeed(prev?: Plan): Plan;
export declare function isoWeek(d: Date): number;
export declare function weekSpan(u1: number, u2: number): string;
export declare function windowLabel(task: PlanTask): string;
export declare function epicWindowText(plan: Plan, laneKey: string): string;
export declare function discoveryOverdue(task: PlanTask, todayUnit: number): boolean;
export declare const RELEASE_DONE_STATES: string[];
export declare function dayToUnit(day: string): number;
export declare function releaseScope(r: Release): string;
export declare function releaseSegments(plan: Plan, todayUnit?: number): { release: Release; start: number; end: number; shipped: boolean; overdue: boolean }[];
export declare function releaseItemDone(item: { state: string }): boolean;
export declare function releaseProgress(r: Release): { fraction: number | null; text: string; bugs: number; stories: number; done: number; total: number; pointsDone: number; pointsTotal: number };
export declare function releaseWiql(label: string): string;
export declare function releaseQueryUrl(label: string): string;

/* R11: progress towards a release */
export type PaceCode = "gronn" | "gul" | "rod";
export declare const PACE_WORD: Record<PaceCode, string>;
export declare const RELEASE_HISTORY_MAX: number;
export declare const RELEASE_MAX_AGE_MS: number;
export declare function workDays(a: string, b: string): number;
export declare function workDaysBetween(a: string, b: string): number;
export declare function addWorkDays(day: string, n: number): string;
export declare function calendarDays(a: string, b: string): number;
export declare function releaseStartDay(plan: Plan, r: Release): string;
export type ReleasePace = { code: PaceCode; text: string; done: number; elapsed: number; startDay: string; elapsedDays: number; totalDays: number; tempo: number | null; forecastDay: string | null; deltaDays: number | null; readings: number };
export declare function releasePace(plan: Plan, r: Release, todayDay: string): ReleasePace | null;
export declare function nextReleaseText(plan: Plan, todayDay: string): { text: string; code: PaceCode | null; release: Release } | null;
export declare function releaseStateCounts(r: Release): { state: string; count: number }[];
export declare function releaseSprintText(r: Release): string;
export declare function releaseBurndownData(plan: Plan, r: Release, todayDay: string): { startDay: string; axisStart: string; targetDay: string; endDay: string; todayDay: string; total: number; unit: "SP" | "items"; actual: { day: string; remaining: number }[]; forecastDay: string | null; firstScope: { day: string; total: number } | null; chances: { day: string; p: number; mean: number }[] } | null;
/* R12: the chance a release is done by its target day */
export declare function releaseForecastText(r: Release, todayDay: string): { short: string | null; text: string; detail?: string; basis?: string; people?: { name: string; days: number; pace: number; expected: number }[] } | null;
export declare function sprintUnlabelledWiql(iterationPath: string): string;

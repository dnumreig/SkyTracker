// Shared logic for the epic roadmap (/timeline): time unit, plan normalisation,
// computed epic status, dependency push and the example seed. Plain script:
// the browser loads it with <script src>, vitest imports it via epic-tools.d.ts.
// One source, no drift between the page and the tests.

/* ---------- time: unit = months since 1 Aug 2026 ---------- */
const BASE_Y = 2026;
const BASE_M = 7; // august, 0-indexed
const N_MONTHS = 29; // the model ends Dec 2028; the page draws from a few months before today
const WEEK = 0.25; // one week in month units, also the drag snap
const MND = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

function dateToUnit(d) {
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return (d.getFullYear() - BASE_Y) * 12 + (d.getMonth() - BASE_M) + (d.getDate() - 1) / dim;
}
function unitToDate(u) {
  u = Math.min(N_MONTHS, u);   // units before the base month are negative: the axis reaches back in time
  const i = Math.min(N_MONTHS - 1, Math.floor(u));
  const m = (((BASE_M + i) % 12) + 12) % 12;
  const y = BASE_Y + Math.floor((BASE_M + i) / 12);
  const dim = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(dim, 1 + Math.round((u - i) * dim)));
}
function fmtDate(d) {
  return d.getDate() + ". " + MND[d.getMonth()];
}

/* ---------- plan shape ---------- */
const SCHEMA = "epics-v1";
const KINDS = ["discovery", "estimate"];
const OWNER_DEFAULT = "PM + CTO";
const BACKLOG = "_backlog";   // the shelf «Klar for veikart»: tasks without an epic
const FEATURE_STATES = ["ny", "utredes", "klar", "aktiv", "levert"];
const EPIC_STATES = ["forslag", "aktiv", "avsluttet"];
const STATE_LABEL = { ny: "Registrert", utredes: "Utredes", klar: "Klar for veikart", aktiv: "Aktiv", levert: "Levert" };
const EPIC_STATE_LABEL = { forslag: "Forslag", aktiv: "Aktiv", avsluttet: "Avsluttet" };
const OUTCOMES = ["nådd", "ikke nådd", "endret"];
// the intake (R7b): where a wish came from and what produktforum decided
const WISH_SOURCES = ["egen-plan", "investor", "kunde", "ledermote", "annet"];
const WISH_SOURCE_LABEL = { "egen-plan": "Egen plan", investor: "Investor", kunde: "Kunde", ledermote: "Ledermøte", annet: "Annet" };
const WISH_STATUSES = ["ubehandlet", "utred", "senere", "nei"];
const WISH_STATUS_LABEL = { ubehandlet: "Ubehandlet", utred: "Utred nå", senere: "Senere", nei: "Nei" };
const SIZE_CLASSES = ["S", "M", "L", "XL"];
// the four attributes from the old board (R9)
const FEATURE_TYPES = ["feature", "teknisk", "vedlikehold"];
const FEATURE_TYPE_LABEL = { feature: "Feature", teknisk: "Teknisk", vedlikehold: "Vedlikehold" };
const AREAS = ["Backend", "Frontend", "iOS", "Android", "Desktop", "Admin"];
/** Areas as typed or imported → the canonical names, deduplicated, in the canonical order; [] when none. */
function normalizeAreas(v) {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[;,]/) : [];
  const want = new Set(list.filter((x) => typeof x === "string").map((x) => x.trim().toLowerCase()));
  return AREAS.filter((a) => want.has(a.toLowerCase()));
}
const num = (v, fallback) => (typeof v === "number" && isFinite(v) ? v : fallback);

function normalizePlan(plan) {
  const p = plan && typeof plan === "object" ? plan : {};
  p.schema = SCHEMA;
  p.lanes = Array.isArray(p.lanes) ? p.lanes : [];
  p.tasks = Array.isArray(p.tasks) ? p.tasks : [];
  p.deleted = p.deleted && typeof p.deleted === "object" ? p.deleted : {};
  p.deletedLanes = p.deletedLanes && typeof p.deletedLanes === "object" ? p.deletedLanes : {};
  p.deletedWishes = p.deletedWishes && typeof p.deletedWishes === "object" ? p.deletedWishes : {};
  const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  p.wishes = (Array.isArray(p.wishes) ? p.wishes : []).filter((w) => w && typeof w === "object" && typeof w.id === "string" && w.id && text(w.title, 200)).map((w) => {
    const out = { id: w.id, v: num(w.v, 0), title: text(w.title, 200), status: WISH_STATUSES.includes(w.status) ? w.status : "ubehandlet", source: WISH_SOURCES.includes(w.source) ? w.source : "annet" };
    for (const k of ["note", "askedBy", "askedOn", "registeredBy", "registeredAt", "decidedAt", "decidedBy", "forum", "reason", "featureId"]) { const v = text(w[k], k === "note" || k === "reason" ? 2000 : 200); if (v) out[k] = v; }
    const owner = text(w.owner, 12); if (owner) out.owner = owner.toUpperCase();
    if (SIZE_CLASSES.includes(w.sizeClass)) out.sizeClass = w.sizeClass;
    return out;
  });
  // sprints (from ADO's iterations, cached by the sprints route) and the sprint goals typed on the page
  const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const okSprint = (s) => !!s && typeof s === "object" && typeof s.name === "string" && isDay(s.start) && isDay(s.finish);
  if (p.sprints && typeof p.sprints === "object" && typeof p.sprints.at === "string" && Array.isArray(p.sprints.items)) p.sprints.items = p.sprints.items.filter(okSprint);
  else delete p.sprints;
  if (p.capacity && typeof p.capacity === "object" && MIX[p.capacity.mode] && typeof p.capacity.at === "string") p.capacity = { mode: p.capacity.mode, at: p.capacity.at };
  else delete p.capacity;
  if (p.sprintGoals && typeof p.sprintGoals === "object" && !Array.isArray(p.sprintGoals)) {
    Object.keys(p.sprintGoals).forEach((k) => { const g = p.sprintGoals[k]; if (!g || typeof g !== "object" || typeof g.text !== "string" || typeof g.at !== "string") delete p.sprintGoals[k]; });
  } else delete p.sprintGoals;
  // releases (R10): a version with a target day, a shipped day once out, and the ADO read-back of its label's bugs and stories
  p.deletedReleases = p.deletedReleases && typeof p.deletedReleases === "object" ? p.deletedReleases : {};
  const validDay = (d) => { if (!isDay(d)) return false; const q = d.split("-").map(Number), dt = new Date(q[0], q[1] - 1, q[2]); return dt.getFullYear() === q[0] && dt.getMonth() === q[1] - 1 && dt.getDate() === q[2]; };   // a real calendar day, not just the shape
  p.releases = (Array.isArray(p.releases) ? p.releases : []).filter((r) => r && typeof r === "object" && typeof r.key === "string" && r.key && text(r.version, 40) && validDay(r.targetDate)).map((r) => {
    const out = { key: r.key, v: num(r.v, 0), version: text(r.version, 40), targetDate: r.targetDate };
    if (validDay(r.shippedDate)) out.shippedDate = r.shippedDate;
    const note = text(r.note, 2000); if (note) out.note = note;
    const label = text(r.label, 60); if (label && label !== out.version) out.label = label;
    if (r.ado && typeof r.ado === "object" && typeof r.ado.at === "string" && Array.isArray(r.ado.items)) {
      out.ado = { at: r.ado.at, label: typeof r.ado.label === "string" && r.ado.label ? r.ado.label : out.label || out.version, items: r.ado.items.filter((i) => i && typeof i === "object" && typeof i.id === "number").map((i) => ({
        id: i.id, type: i.type === "Bug" ? "Bug" : "User Story", title: typeof i.title === "string" ? i.title.slice(0, 200) : "", state: typeof i.state === "string" && i.state ? i.state : "New", points: Math.max(0, num(i.points, 0)), assignee: typeof i.assignee === "string" && i.assignee ? i.assignee : null, ...(typeof i.iteration === "string" && i.iteration ? { iteration: i.iteration } : {}), ...(validDay(i.delivered) ? { delivered: i.delivered } : {}),
      })) };
      const hist = new Map();   // R11: one reading per day, the day's last wins, the latest kept
      (Array.isArray(r.ado.history) ? r.ado.history : []).forEach((h) => { if (h && typeof h === "object" && validDay(h.day)) hist.set(h.day, { day: h.day, pointsDone: Math.max(0, num(h.pointsDone, 0)), pointsTotal: Math.max(0, num(h.pointsTotal, 0)), done: Math.max(0, num(h.done, 0)), total: Math.max(0, num(h.total, 0)) }); });
      if (hist.size) out.ado.history = [...hist.values()].sort((x, y) => (x.day < y.day ? -1 : 1)).slice(-RELEASE_HISTORY_MAX);
      const sprints = (Array.isArray(r.ado.sprints) ? r.ado.sprints : []).filter((s) => s && typeof s === "object" && typeof s.name === "string" && s.name).map((s) => ({ name: s.name, unlabelled: Math.max(0, num(s.unlabelled, 0)) }));
      if (sprints.length) out.ado.sprints = sprints;
    }
    return out;
  }).sort((a, b) => releaseEnd(a) - releaseEnd(b) || a.version.localeCompare(b.version));
  p.lanes.forEach((l) => {
    if (typeof l.owner !== "string" || !l.owner) l.owner = OWNER_DEFAULT;
    if (num(l.goalDate, null) === null) delete l.goalDate;
    if (!l.goalProvisional) delete l.goalProvisional;
    if (num(l.adoId, null) === null) delete l.adoId;
    if (typeof l.metric !== "string" || !l.metric.trim()) delete l.metric;
    if (!l.externalDate) delete l.externalDate;
    if (typeof l.description !== "string" || !l.description.trim()) delete l.description; else l.description = l.description.trim().slice(0, 4000);
    if (!EPIC_STATES.includes(l.state)) l.state = "aktiv";
    if (typeof l.closedReason !== "string" || !l.closedReason.trim()) delete l.closedReason;
    if (!OUTCOMES.includes(l.outcome)) delete l.outcome;
    if (typeof l.closedAt !== "string" || !l.closedAt) delete l.closedAt;
  });
  // priority = the order on the timeline (1 = top). Data, not array order, so it survives the merge.
  let nextPri = Math.max(0, ...p.lanes.map((l) => num(l.priority, 0)));
  p.lanes.forEach((l) => { if (num(l.priority, null) === null) l.priority = ++nextPri; });
  p.lanes.sort((a, b) => a.priority - b.priority); // stable: equal priorities keep their order
  const laneKeys = new Set(p.lanes.map((l) => l.key));
  p.tasks = p.tasks.filter((t) => t && typeof t.id === "string" && (laneKeys.has(t.lane) || t.lane === BACKLOG));
  p.tasks.forEach((t) => {
    t.deps = Array.isArray(t.deps) ? t.deps : [];
    t.fv = t.fv && typeof t.fv === "object" ? t.fv : {};
    if (!KINDS.includes(t.kind)) t.kind = "estimate";
    t.start = num(t.start, 0);
    t.end = num(t.end, t.start + WEEK);
    if (t.end < t.start + WEEK) t.end = t.start + WEEK;
    if (t.kind === "estimate") {
      t.endLikely = Math.min(t.end, Math.max(t.start + WEEK, num(t.endLikely, t.end)));
    } else {
      delete t.endLikely;
    }
    if (num(t.adoId, null) === null) delete t.adoId;
    if (typeof t.specPath !== "string" || !/^[A-Za-z0-9._-]+$/.test(t.specPath)) delete t.specPath;   // a folder under spec/ in Skytale.Specs
    if (typeof t.description !== "string" || !t.description.trim()) delete t.description; else t.description = t.description.trim().slice(0, 4000);
    if (t.pinned) t.pinned = true; else delete t.pinned;   // the planner's override of the queue
    if (!SIZE_CLASSES.includes(t.sizeClass)) delete t.sizeClass;   // the class the forum promised at «Start utredning» (R8)
    if (typeof t.startedAt !== "string" || !t.startedAt) delete t.startedAt;   // when the discovery was started: its place in the owner's queue (R8)
    if (!FEATURE_TYPES.includes(t.type)) delete t.type;   // R9: feature · teknisk · vedlikehold
    const areas = normalizeAreas(t.areas); if (areas.length) t.areas = areas; else delete t.areas;
    if (t.fixedEnd) t.fixedEnd = true; else delete t.fixedEnd;   // a hard date: the queue never moves it
    if (typeof t.cardId !== "string" || !t.cardId) delete t.cardId;   // the old board's card this came from (R9 import, once)
    // progress: points (ADO or typed) or a percent; the source says who wrote it
    if (t.progress && typeof t.progress === "object") {
      const pr = t.progress, out = {};
      if (num(pr.pointsTotal, 0) > 0) { out.pointsTotal = num(pr.pointsTotal, 0); out.pointsDone = Math.max(0, Math.min(out.pointsTotal, num(pr.pointsDone, 0))); }
      else if (num(pr.pct, null) !== null && pr.pct >= 0 && pr.pct <= 100) out.pct = pr.pct;
      if (typeof pr.sprint === "string" && pr.sprint) out.sprint = pr.sprint;
      out.at = typeof pr.at === "string" ? pr.at : new Date().toISOString();
      out.source = pr.source === "ado" ? "ado" : "manuell";
      if (progressFraction(out) === null) delete t.progress; else t.progress = out;
    } else delete t.progress;
    if (typeof t.assignee !== "string" || !t.assignee.trim()) delete t.assignee; else t.assignee = t.assignee.trim();
    if (num(t.bufferWeeks, null) === null || t.bufferWeeks <= 0) delete t.bufferWeeks; else t.bufferWeeks = Math.round(t.bufferWeeks);
    if (!t.raw || typeof t.raw !== "object" || num(t.raw.likely, null) === null || num(t.raw.late, null) === null) delete t.raw;
    // state: ny and levert are explicit; everything else follows from kind and lane
    if (t.state === "ny") { if (t.lane !== BACKLOG) t.lane = BACKLOG; }
    else if (t.state !== "levert") t.state = t.kind === "discovery" ? "utredes" : t.lane === BACKLOG ? "klar" : "aktiv";
    if (t.state !== "aktiv" && t.state !== "levert") { delete t.committedRange; delete t.activatedAt; }
    if (t.state !== "levert") delete t.deliveredAt;
  });
  const ids = new Set(p.tasks.map((t) => t.id));
  p.tasks.forEach((t) => {
    t.deps = t.deps.filter((d) => d !== t.id && ids.has(d));
  });
  // order = position inside the epic; missing ones go after the lane's max
  const nextOrd = {};
  p.tasks.forEach((t) => { if (num(t.order, null) !== null) nextOrd[t.lane] = Math.max(nextOrd[t.lane] || 0, t.order); });
  p.tasks.forEach((t) => { if (num(t.order, null) === null) t.order = nextOrd[t.lane] = (nextOrd[t.lane] || 0) + 1; });
  const laneIdx = new Map(p.lanes.map((l, i) => [l.key, i]));
  laneIdx.set(BACKLOG, p.lanes.length);   // the shelf sorts last
  p.tasks.sort((a, b) => laneIdx.get(a.lane) - laneIdx.get(b.lane) || a.order - b.order);
  return p;
}

/* ---------- computed epic status ---------- */
const STATUS_LABEL = {
  gronn: "Grønn: holder",
  gul: "Gul: i fare",
  rod: "Rød: sprekker",
  venter: "Venter på utredning",
  "ingen-mal": "Uten måldato",
  tom: "Ingen features ennå",
};

function epicStatus(plan, laneKey) {
  const lane = plan.lanes.find((l) => l.key === laneKey);
  const tasks = plan.tasks.filter((t) => t.lane === laneKey);
  if (!lane || !tasks.length) return { code: "tom" };
  if (tasks.some((t) => t.kind === "discovery")) return { code: "venter" };
  const likely = Math.max(...tasks.map((t) => t.endLikely));
  const late = Math.max(...tasks.map((t) => t.end));
  if (typeof lane.goalDate !== "number") return { code: "ingen-mal", likely, late };
  const goal = lane.goalDate;
  const code = late <= goal + 1e-9 ? "gronn" : likely > goal + 1e-9 ? "rod" : "gul";
  return { code, likely, late };
}
function shelfTasks(plan) { return plan.tasks.filter((t) => t.lane === BACKLOG); }
/** The intake grouped by decision, newest registration first inside each group. */
function wishesByStatus(plan) {
  const out = { ubehandlet: [], utred: [], senere: [], nei: [] };
  const sorted = [...(plan.wishes || [])].sort((a, b) => (b.registeredAt || "").localeCompare(a.registeredAt || ""));
  sorted.forEach((w) => out[w.status || "ubehandlet"].push(w));
  return out;
}
function epicCounts(plan) {
  const c = { forslag: 0, aktiv: 0, avsluttet: 0 };
  plan.lanes.forEach((l) => { c[l.state || "aktiv"]++; });
  return c;
}

/* ---------- dependencies: finish-to-start on the blocker's late end ---------- */
function shiftTask(t, d) {
  d = Math.max(d, -t.start);
  d = Math.min(d, N_MONTHS - t.end);
  if (!d) return 0;
  t.start += d;
  t.end += d;
  if (t.kind === "estimate") t.endLikely += d;
  return d;
}

/* ---------- the queue (R5): blockers first, then the same developer's earlier work, in priority order ---------- */
const MIX = { transition: 0.55, normal: 0.6 };   // the share of a sprint that goes to planned features (transition 55/35/10, normal 60/15/15/10)
const MIX_LABEL = { transition: "overgang (55 % til features)", normal: "normal (60 %)" };
function capacityFactor(plan) {
  const mode = plan && plan.capacity && MIX[plan.capacity.mode] ? plan.capacity.mode : "transition";
  return Math.round(100 / MIX[mode]) / 100;
}
function elapsedWeeks(rawWeeks, factor) { return Math.ceil(rawWeeks * factor - 1e-9); }
function queueOrder(plan) {   // active estimates in epics, in priority order; a pinned one stays put but still counts for the ones after it
  const idx = new Map(plan.lanes.map((l, i) => [l.key, i]));
  return plan.tasks
    .filter((t) => t.kind === "estimate" && t.lane !== BACKLOG && idx.has(t.lane) && t.state !== "levert")
    .sort((a, b) => idx.get(a.lane) - idx.get(b.lane) || (a.order || 0) - (b.order || 0));
}
// R8: a discovery with an owner occupies them from start to end (spec decision 4): the owner's features start when it ends
// in the order they were started (the forum's earlier decision keeps its place; a new one queues behind), else by start
function discoveryAnchors(plan) {
  return plan.tasks.filter((t) => t.kind === "discovery" && t.state !== "levert" && t.assignee)
    .sort((a, b) => (a.startedAt || "").localeCompare(b.startedAt || "") || a.start - b.start || (a.order || 0) - (b.order || 0));
}
const occupies = (d, t) => d.start < t.end - 1e-9 && d.end >= t.start - 1e-9;   // the discovery runs into the feature's window (touching counts: the feature starts when it ends)
function floorOf(plan, t, earlier) {
  const byId = new Map(plan.tasks.map((v) => [v.id, v]));
  let floor = -Infinity, by = null, kind = null;
  (t.deps || []).forEach((d) => { const p = byId.get(d); if (p && p.end > floor + 1e-9) { floor = p.end; by = d; kind = "dep"; } });
  if (t.assignee) earlier.forEach((e) => { if (e.assignee === t.assignee && e.end >= floor - 1e-9) { floor = e.end; by = e.id; kind = "queue"; } });
  if (t.assignee && t.kind === "estimate" && t.lane !== BACKLOG && t.state !== "levert") discoveryAnchors(plan).forEach((d) => { if (d.id !== t.id && d.assignee === t.assignee && occupies(d, t) && d.end > floor + 1e-9) { floor = d.end; by = d.id; kind = "queue"; } });
  return { floor: floor === -Infinity ? null : floor, by, kind };
}
/** What a task waits for: earlier discoveries of the owner for a discovery, the queue order for a feature. */
function earlierFor(plan, t) {
  if (t.kind === "discovery") { const discs = discoveryAnchors(plan), i = discs.findIndex((v) => v.id === t.id); return i < 0 ? [] : discs.slice(0, i); }
  const order = queueOrder(plan), i = order.findIndex((v) => v.id === t.id);
  return i < 0 ? [] : order.slice(0, i);
}
function queueFloor(plan, taskId) {
  const t = plan.tasks.find((v) => v.id === taskId);
  if (!t) return { floor: null, by: null, kind: null };
  return floorOf(plan, t, earlierFor(plan, t));
}
function resolveQueue(plan) {
  const shifted = []; // [{ id, by, kind }]: what each shifted feature waits for
  const note = (t, f) => { const prev = shifted.find((s) => s.id === t.id); if (prev) { prev.by = f.by; prev.kind = f.kind; } else shifted.push({ id: t.id, by: f.by, kind: f.kind }); };
  let changed = true, guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    const order = queueOrder(plan), discs = discoveryAnchors(plan), inQueue = new Set([...order, ...discs].map((t) => t.id));
    // R8: an owner's discoveries run one after the other, by start; a discovery never waits for a feature
    discs.forEach((t, i) => {
      const f = floorOf(plan, t, discs.slice(0, i));
      if (f.floor === null || t.pinned || t.fixedEnd || f.floor <= t.start + 1e-9) return;
      if (shiftTask(t, f.floor - t.start) !== 0) { note(t, f); changed = true; }
    });
    order.forEach((t, i) => {
      const f = floorOf(plan, t, order.slice(0, i));
      if (f.floor === null || t.pinned || t.fixedEnd || f.floor <= t.start + 1e-9) return;   // a fixed end is never moved (R9)
      if (shiftTask(t, f.floor - t.start) !== 0) { note(t, f); changed = true; }
    });
    // ownerless discoveries, the shelf and delivered features keep the plain rule: after a blocker's late end
    plan.tasks.filter((t) => !inQueue.has(t.id)).forEach((t) => {
      const f = floorOf(plan, t, []);
      if (f.floor === null || t.pinned || t.fixedEnd || f.floor <= t.start + 1e-9) return;
      if (shiftTask(t, f.floor - t.start) !== 0) { note(t, f); changed = true; }
    });
  }
  return shifted;
}
function resolveDeps(plan) { return resolveQueue(plan).filter((s) => s.kind === "dep").map(({ id, by }) => ({ id, by })); }

/* ---------- labels ---------- */
const weeks = (u) => Math.round(u / WEEK);
function rangeWeeks(t) {
  if (t.kind !== "estimate") return null;
  return { likely: weeks(t.endLikely - t.start), late: weeks(t.end - t.start) };
}
function rangeLabel(t) {
  const r = rangeWeeks(t);
  if (!r) return "";
  return (r.likely === r.late ? r.late : r.likely + "–" + r.late) + " uker";
}
function goalText(lane) {
  if (typeof lane.goalDate !== "number") return "Måldato settes etter utredning";
  return (lane.goalProvisional ? "Foreløpig mål " : "Måldato ") + fmtDate(unitToDate(lane.goalDate));
}

/* ---------- lifecycle labels ---------- */
/** What the dates say: S ≤ 1 week, M ≤ 2, L ≤ 4, XL above (the deck's thresholds). */
function sizeClassDerived(t) {
  if (t.kind !== "discovery") return "";
  const w = (t.end - t.start) / WEEK;
  const slack = 0.2;   // a date typed or computed to the day lands up to a day and a half off the week grid: still the same class
  return w <= 1 + slack ? "S" : w <= 2 + slack ? "M" : w <= 4 + slack ? "L" : "XL";
}
/** The class the forum promised when it exists (R8), else the derived one. */
function sizeClass(t) {
  if (t.kind !== "discovery") return "";
  return SIZE_CLASSES.includes(t.sizeClass) ? t.sizeClass : sizeClassDerived(t);
}
/** «M», or «M, nå L» when the dates have drifted from the promise. */
function sizeClassText(t) {
  const s = sizeClass(t);
  if (!s) return "";
  const d = sizeClassDerived(t);
  return SIZE_CLASSES.includes(t.sizeClass) && d !== t.sizeClass ? t.sizeClass + ", nå " + d : s;
}
function bufferLabel(t) {
  const r = rangeWeeks(t);
  if (!r) return "";
  const b = t.bufferWeeks || 0;
  const likely = r.likely - b, late = r.late - b;
  const base = (likely === late ? late : likely + "–" + late) + " uker";
  return b ? base + " + " + b + " uke" + (b === 1 ? "" : "r") + " buffer" : base;
}
function rawLabel(t) {
  const r = rangeWeeks(t);
  if (!r || !t.raw) return "";
  const b = t.bufferWeeks || 0;
  if (r.likely - b === t.raw.likely && r.late - b === t.raw.late) return "";
  return "utredning sa " + (t.raw.likely === t.raw.late ? t.raw.late : t.raw.likely + "–" + t.raw.late);
}
/* ---------- the price before a decision: the epic's colour if this feature lands there ---------- */
function previewPlacement(plan, taskId, laneKey) {   // the price before the decision: the colour, the feature's computed window, and what it pushes (R5)
  if (!plan.tasks.some((t) => t.id === taskId) || !plan.lanes.some((l) => l.key === laneKey)) return null;
  const before = epicStatus(plan, laneKey).code;
  const coloursBefore = new Map(plan.lanes.map((l) => [l.key, epicStatus(plan, l.key).code]));
  const copy = normalizePlan(JSON.parse(JSON.stringify(plan)));
  const t = copy.tasks.find((v) => v.id === taskId);
  t.lane = laneKey;
  delete t.order;
  normalizePlan(copy);
  // raw weeks become elapsed time through the sprint mix while the range still is the raw one (plus buffer)
  if (t.kind === "estimate" && t.raw) {
    const r = rangeWeeks(t), b = t.bufferWeeks || 0;
    if (r && r.likely - b === t.raw.likely && r.late - b === t.raw.late) {
      const f = capacityFactor(copy);
      t.endLikely = t.start + (elapsedWeeks(t.raw.likely, f) + b) * WEEK;
      t.end = t.start + (elapsedWeeks(t.raw.late, f) + b) * WEEK;
    }
  }
  const startsBefore = new Map(copy.tasks.map((v) => [v.id, v.start]));
  resolveQueue(copy);
  const pushed = copy.tasks
    .filter((v) => v.id !== taskId && v.start > startsBefore.get(v.id) + 1e-9)
    .map((v) => ({ id: v.id, label: v.label, laneKey: v.lane, weeks: Math.round((v.start - startsBefore.get(v.id)) / WEEK) }));
  const epics = copy.lanes
    .filter((l) => l.key !== laneKey)
    .map((l) => ({ key: l.key, name: l.name, before: coloursBefore.get(l.key), after: epicStatus(copy, l.key).code }))
    .filter((e) => e.before !== e.after);
  return {
    before, after: epicStatus(copy, laneKey).code, window: epicWindowText(copy, laneKey),
    featureStart: t.start, featureWeeks: rangeWeeks(t), featureWindow: windowLabel(t), pushed, epics,
  };
}

/* ---------- delivery window in ISO weeks, overdue discoveries ---------- */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - jan1) / 86400000 + 1) / 7);
}
function weekSpan(u1, u2) {
  const w1 = isoWeek(unitToDate(u1)), w2 = isoWeek(unitToDate(u2));
  return "uke " + (w1 === w2 ? w1 : w1 + "–" + w2);
}
function windowLabel(t) {
  return t.kind === "estimate" ? weekSpan(t.endLikely, t.end) : "";
}
function epicWindowText(plan, laneKey) {
  const st = epicStatus(plan, laneKey);
  return typeof st.likely === "number" ? "Leveres " + weekSpan(st.likely, st.late) : "";
}
function discoveryOverdue(t, today) {
  return t.kind === "discovery" && t.end < today - 1e-9;
}

/* ---------- example seed (deck slides 6, 22, 23, 24) ---------- */
// `prev` is the plan the seed replaces. Its tombstones are carried over and every
// seeded lane/task that was deleted before is versioned PAST its tombstone, so the
// server merge keeps the seed instead of silently dropping it again.
const D = (y, m, d) => dateToUnit(new Date(y, m - 1, d));
function exampleSeed(prev) {
  const est = (id, lane, label, start, likelyW, lateW, extra) =>
    Object.assign(
      { id, lane, label, kind: "estimate", start, endLikely: start + likelyW * WEEK, end: start + lateW * WEEK, deps: [], fv: {} },
      extra || {},
    );
  const disc = (id, lane, label, start, end, extra) =>
    Object.assign({ id, lane, label, kind: "discovery", start, end, deps: [], fv: {} }, extra || {});
  const lane = (key, name, extra) => Object.assign({ key, name, owner: OWNER_DEFAULT }, extra || {});
  const p = normalizePlan({
    schema: SCHEMA,
    example: true,
    lanes: [
      lane("org", "En ny organisasjon er i gang fra dag én", { goalDate: D(2027, 2, 1), goalProvisional: true }),
      lane("samtaler", "Samtaler du kan stole på"),
      lane("telenor", "Telenor kan bygge på oss", { goalDate: D(2026, 12, 15) }),
      lane("revisjon", "Vi består en ekstern sikkerhetsrevisjon"),
      lane("drift", "Vi ser nedetid før kunden gjør det"),
      lane("filer", "Filene dine er trygge i Skytale"),
      lane("kanaler", "Samarbeid i travle kanaler"),
    ],
    tasks: [
      disc("iam", "org", "IAM: brukerlivsløp", D(2026, 10, 12), D(2026, 11, 6)),
      disc("qr", "org", "Innmelding med QR-kode", D(2026, 11, 9), D(2026, 12, 4), { adoId: 4791 }),
      est("roller", "org", "Rollebasert tilgang", D(2026, 11, 9), 4, 6, { adoId: 4664, deps: ["iam"] }),
      disc("samtaler-sfu", "samtaler", "Samtaler: video og skjermdeling (SFU)", D(2026, 10, 12), D(2026, 11, 20), { adoId: 4742 }),
      disc("varsler", "samtaler", "Varsler", D(2026, 11, 23), D(2026, 12, 4)),
      est("f24", "telenor", "API for integrasjoner (F-24)", D(2026, 10, 12), 6, 9),
      est("kapasitet", "telenor", "Kapasitet i store grupper", D(2026, 11, 2), 4, 7, { adoId: 4499 }),
      disc("herding", "revisjon", "Sikkerhetsherding", D(2026, 11, 2), D(2026, 11, 20)),
      disc("overvaking", "revisjon", "Driftsovervåking", D(2026, 11, 23), D(2026, 12, 11)),
      disc("fjernsletting", "revisjon", "Fjernsletting av enhet", D(2026, 12, 7), D(2026, 12, 18), { adoId: 4790 }),
      disc("statusvarsel", "drift", "Driftsovervåking og statusvarsel", D(2026, 11, 2), D(2026, 11, 27)),
      disc("reservedrift", "drift", "Infrastruktur og reservedrift", D(2026, 11, 30), D(2026, 12, 18)),
      disc("filevault", "filer", "FileVault-fanen", D(2026, 10, 19), D(2026, 11, 13), { adoId: 4780 }),
      est("fildeling", "filer", "Fildeling i chat", D(2026, 10, 12), 3, 5, { adoId: 4492 }),
      disc("trader", "kanaler", "Tråder", D(2026, 11, 2), D(2026, 11, 27), { adoId: 4566 }),
      disc("omtaler", "kanaler", "@-omtaler", D(2026, 11, 30), D(2026, 12, 11)),
      disc("kontaktkort", "kanaler", "Kontaktkort", D(2026, 12, 14), D(2026, 12, 23)),
      disc("sok", "kanaler", "Søk", D(2027, 1, 4), D(2027, 1, 29), { adoId: 4716 }),
    ],
    deleted: {},
  });
  if (prev && typeof prev === "object") {
    const deleted = prev.deleted && typeof prev.deleted === "object" ? prev.deleted : {};
    const deletedLanes = prev.deletedLanes && typeof prev.deletedLanes === "object" ? prev.deletedLanes : {};
    p.lanes.forEach((l) => { if (deletedLanes[l.key]) l.v = deletedLanes[l.key] + 1; });
    p.tasks.forEach((t) => { if (deleted[t.id]) t.fv = { tid: deleted[t.id] + 1 }; });
    // a copy of an example feature still in the plan (say, on the shelf after its epic was deleted): the example wins every field group
    const prevTasks = new Map((Array.isArray(prev.tasks) ? prev.tasks : []).filter((t) => t && typeof t.id === "string").map((t) => [t.id, t]));
    const groups = ["tid", "label", "deps", "meta", "state", "est", "ado", "progress"];
    p.tasks.forEach((t) => { const c = prevTasks.get(t.id); if (!c) return; t.fv = t.fv || {}; groups.forEach((g) => { t.fv[g] = Math.max(t.fv[g] || 0, ((c.fv && c.fv[g]) || 0) + 1); }); });
    p.deleted = Object.assign({}, deleted);
    p.deletedLanes = Object.assign({}, deletedLanes);
  }
  return p;
}

/* ---------- progress: the v3.1 rule as a second signal (never the epic colour) ---------- */
function progressFraction(p) {
  if (!p || typeof p !== "object") return null;
  if (num(p.pointsTotal, 0) > 0) return Math.max(0, Math.min(1, num(p.pointsDone, 0) / p.pointsTotal));
  if (num(p.pct, null) !== null) return Math.max(0, Math.min(1, p.pct / 100));
  return null;
}
function progressSignal(t, today) {   // green: progress keeps up with the time spent in the likely window (10 % slack); yellow: behind; red: the late end passed
  if (t.kind !== "estimate" || t.state === "levert") return null;
  const done = progressFraction(t.progress);
  if (done === null || today < t.start - 1e-9) return null;
  const span = Math.max(WEEK, t.endLikely - t.start);
  const elapsed = Math.max(0, Math.min(1, (today - t.start) / span));
  const code = today > t.end + 1e-9 && done < 1 ? "rod" : done + 0.1 >= elapsed ? "gronn" : "gul";
  return { code, done, elapsed };
}
const SIG_RANK = { gronn: 0, gul: 1, rod: 2 };
function epicProgressSignal(plan, laneKey, today) {
  let worst = null;
  plan.tasks.filter((t) => t.lane === laneKey).forEach((t) => { const s = progressSignal(t, today); if (s && (worst === null || SIG_RANK[s.code] > SIG_RANK[worst])) worst = s.code; });
  return worst;
}
function progressText(t, s) { return "fremdrift " + Math.round(s.done * 100) + " % · tid " + Math.round(s.elapsed * 100) + " %"; }

/* ---------- releases (R10): the band above the sprint ruler ---------- */
const RELEASE_DONE_STATES = ["Resolved", "Closed"];   // what ADO calls done for a bug or a story
/** The chart unit of a YYYY-MM-DD day (local midnight), shared by the sprint ruler and the release band. */
function dayToUnit(day) { const q = String(day).split("-").map(Number); return dateToUnit(new Date(q[0], q[1] - 1, q[2])); }
/** The release label in ADO (`Custom.Release`): the version unless overridden. */
function releaseScope(r) { return r.label || r.version; }
function releaseEnd(r) { return dayToUnit(r.shippedDate || r.targetDate); }
/** The ADO query behind a release: every Bug and User Story carrying the label, any state but Removed. */
function releaseWiql(label) {
  return "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [Custom.Release] = '" + String(label).replace(/'/g, "''") + "' AND [System.WorkItemType] IN ('Bug', 'User Story') AND [System.State] <> 'Removed' ORDER BY [System.WorkItemType], [System.Id]";
}
const ADO_PROJECT_URL = "https://dev.azure.com/SkytaleAS/Skytale";
/** The same query opened in ADO's work item hub («Åpne i ADO» in the release drawer). */
function releaseQueryUrl(label) { return ADO_PROJECT_URL + "/_workitems?_a=query&wiql=" + encodeURIComponent(releaseWiql(label)); }
/** The releases as segments on the band, sorted by end day: each starts where the previous one ends, the first two weeks before its own end. */
function releaseSegments(plan, todayUnit) {
  const list = ((plan && plan.releases) || []).slice().sort((a, b) => releaseEnd(a) - releaseEnd(b) || a.version.localeCompare(b.version));
  let prev = null;
  return list.map((r) => {
    const end = releaseEnd(r);
    const start = prev === null ? end - 2 * WEEK : Math.min(prev, end - WEEK / 7);
    prev = end;
    return { release: r, start, end, shipped: !!r.shippedDate, overdue: !r.shippedDate && typeof todayUnit === "number" && end < todayUnit };
  });
}
const releaseItemDone = (i) => RELEASE_DONE_STATES.includes(i.state);
/** Points Resolved/Closed over all points (items by count when nobody pointed them), with the counts in words. */
function releaseProgress(r) {
  const a = r && r.ado;
  if (!a || !Array.isArray(a.items)) return { fraction: null, text: "ikke lest fra ADO", bugs: 0, stories: 0, done: 0, total: 0, pointsDone: 0, pointsTotal: 0 };
  const items = a.items, doneItems = items.filter(releaseItemDone);
  const pointsTotal = items.reduce((s, i) => s + (i.points || 0), 0), pointsDone = doneItems.reduce((s, i) => s + (i.points || 0), 0);
  const bugs = items.filter((i) => i.type === "Bug").length, stories = items.length - bugs, done = doneItems.length, total = items.length;
  const n = (c, one, many) => c + " " + (c === 1 ? one : many);
  const fraction = pointsTotal > 0 ? pointsDone / pointsTotal : total ? done / total : 0;
  const text = !total ? "ingenting med labelen i ADO" : n(bugs, "bug", "bugs") + ", " + n(stories, "story", "stories") + " · " + (pointsTotal > 0 ? pointsDone + "/" + pointsTotal + " SP levert" : done + " av " + total + " levert");
  return { fraction, text, bugs, stories, done, total, pointsDone, pointsTotal };
}

/* ---------- R11: progress towards a release: working days, tempo, history, sprint vs release ---------- */
const RELEASE_HISTORY_MAX = 120;              // one point per day: four months of readings
const RELEASE_MAX_AGE_MS = 6 * 3600 * 1000;   // the page re-reads the labels on load when the last read is older (writers)
const PACE_SLACK = 0.1;                       // the feature signal's slack, reused for the straight line
const PACE_LATE_DAYS = 3;                     // working days after the target that still count as yellow
const PACE_WORD = { gronn: "grønn", gul: "gul", rod: "rød" };
const dayOf = (day) => { const q = String(day).split("-").map(Number); return new Date(q[0], q[1] - 1, q[2]); };
const isWorkDay = (d) => d.getDay() !== 0 && d.getDay() !== 6;
/** Working days (Mon–Fri) from day a through day b, both inclusive; 0 when b is before a. */
function workDays(a, b) {
  if (!a || !b || b < a) return 0;
  let n = 0;
  for (const c = dayOf(a); dayKey(c) <= b; c.setDate(c.getDate() + 1)) if (isWorkDay(c)) n++;
  return n;
}
/** Working days after day a up to and including day b (a's own day never counts). */
function workDaysBetween(a, b) { return workDays(a, b) - (b >= a && isWorkDay(dayOf(a)) ? 1 : 0); }
/** The day n working days after `day` (n = 0: the day itself). */
function addWorkDays(day, n) {
  const c = dayOf(day);
  for (let left = Math.max(0, Math.ceil(n)); left > 0; ) { c.setDate(c.getDate() + 1); if (isWorkDay(c)) left--; }
  return dayKey(c);
}
/** Calendar days from a to b, negative when b is before a. */
function calendarDays(a, b) { const A = dayOf(a), B = dayOf(b); return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000); }
/** Where the release's clock starts: the sprint start of the oldest iteration among its items, else the segment's start;
 *  never before the first reading that found anything carrying the label (the scope did not exist before it: 2.0.1 was
 *  stamped a week into Sprint 71). */
function releaseStartDay(plan, r) {
  const sprints = (plan && plan.sprints && plan.sprints.items) || [];
  const starts = ((r.ado && r.ado.items) || []).map((i) => { const s = i.iteration && sprints.find((sp) => sp.name === i.iteration); return s ? s.start : null; }).filter(Boolean).sort();
  let start;
  if (starts.length) start = starts[0];
  else { const seg = releaseSegments(plan).find((s) => s.release.key === r.key); start = dayKey(unitToDate(seg ? seg.start : releaseEnd(r) - 2 * WEEK)); }
  const scoped = ((r.ado && r.ado.history) || []).find((h) => h.total > 0);
  return scoped && scoped.day > start ? scoped.day : start;
}
/** The units (points, or items when nothing has points) delivered on or before `day`; a done item without a delivered day counts from the start. */
function releaseDoneBy(r, day, usePoints) {
  return ((r.ado && r.ado.items) || []).filter((i) => releaseItemDone(i) && (!i.delivered || i.delivered <= day)).reduce((s, i) => s + (usePoints ? i.points || 0 : 1), 0);
}
const PACE_WORDS = ["null", "én", "to", "tre", "fire", "fem", "seks", "sju", "åtte", "ni", "ti", "elleve", "tolv"];
const daysWords = (n) => (n <= 12 ? PACE_WORDS[n] : String(n)) + " arbeidsdag" + (n === 1 ? "" : "er");
const dayWords = (day) => fmtDate(dayOf(day));
const pct = (f) => Math.round(f * 100) + " %";
/** The tempo signal of a release that is not out yet: the colour its segment wears and the sentence the drawer, the strip and the report say. */
function releasePace(plan, r, todayDay) {
  if (!r || r.shippedDate || !r.ado) return null;
  const pr = releaseProgress(r);
  if (!pr.total) return null;
  const units = pr.pointsTotal > 0 ? { done: pr.pointsDone, total: pr.pointsTotal } : { done: pr.done, total: pr.total };
  const startDay = releaseStartDay(plan, r);
  const elapsedDays = workDays(startDay, todayDay), totalDays = workDays(startDay, r.targetDate);
  const elapsed = totalDays > 0 ? Math.max(0, Math.min(1, elapsedDays / totalDays)) : todayDay >= r.targetDate ? 1 : 0;
  const done = pr.fraction;
  const readings = new Set((r.ado.history || []).map((h) => h.day)).size;
  const usePoints = pr.pointsTotal > 0;
  const dayBefore = dayOf(startDay); dayBefore.setDate(dayBefore.getDate() - 1);
  const since = units.done - releaseDoneBy(r, dayKey(dayBefore), usePoints);   // delivered after the clock started
  const tempo = elapsedDays > 0 && since > 0 ? since / elapsedDays : null;
  const forecastDay = tempo !== null && done < 1 ? addWorkDays(todayDay, Math.ceil((units.total - units.done) / tempo)) : null;
  const deltaDays = forecastDay ? (forecastDay > r.targetDate ? workDaysBetween(r.targetDate, forecastDay) : -workDaysBetween(forecastDay, r.targetDate)) : null;
  const past = todayDay > r.targetDate;
  let code;
  if (done >= 1) code = "gronn";
  else if (deltaDays !== null) code = deltaDays <= 0 ? "gronn" : deltaDays <= PACE_LATE_DAYS ? "gul" : "rod";
  else code = past ? "rod" : done + Math.max(PACE_SLACK, totalDays > 0 ? 1 / totalDays : 0) >= elapsed ? "gronn" : "gul";   // the straight line allows a working day, at least 10 %
  const head = pct(done) + " levert · " + pct(elapsed) + " av tiden brukt";
  const tail = done >= 1 ? "alt levert · sett «Skippet» når den er ute"
    : forecastDay ? "med dagens tempo ferdig " + dayWords(forecastDay) + (deltaDays === 0 ? ", på målet" : deltaDays > 0 ? ", " + daysWords(deltaDays) + " etter målet" : ", " + daysWords(-deltaDays) + " før målet")
    : startDay > todayDay ? "tempo regnes fra " + dayWords(startDay)   // the clock has not started: the items sit in a coming sprint
    : units.done === 0 ? "ingenting levert ennå" : "ingenting levert siden " + dayWords(startDay);
  return { code, text: head + " · " + tail, done, elapsed, startDay, elapsedDays, totalDays, tempo, forecastDay, deltaDays, readings };
}
/** The legend's status strip: the next release not yet out, how far away it is, the share delivered and the tempo colour in words. */
function nextReleaseText(plan, todayDay) {
  const r = ((plan && plan.releases) || []).filter((x) => !x.shippedDate).sort((a, b) => (a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : 0))[0];
  if (!r) return null;
  const n = calendarDays(todayDay, r.targetDate);
  const when = n > 0 ? "om " + n + (n === 1 ? " dag" : " dager") : n === 0 ? "i dag" : -n + (n === -1 ? " dag" : " dager") + " på overtid";
  const pr = releaseProgress(r), pace = releasePace(plan, r, todayDay);
  return { text: "Neste release " + r.version + " " + when + " · " + (pr.fraction === null ? "ikke lest fra ADO" : pct(pr.fraction)) + (pace ? " · " + PACE_WORD[pace.code] : ""), code: pace ? pace.code : null, release: r };
}
const STATE_ORDER = ["New", "Active", "Resolved", "Closed"];
/** The items by state, ADO's order first, then whatever else the process has. */
function releaseStateCounts(r) {
  const counts = new Map();
  ((r && r.ado && r.ado.items) || []).forEach((i) => counts.set(i.state, (counts.get(i.state) || 0) + 1));
  const rank = (s) => { const k = STATE_ORDER.indexOf(s); return k < 0 ? STATE_ORDER.length : k; };
  return [...counts.entries()].map(([state, count]) => ({ state, count })).sort((a, b) => rank(a.state) - rank(b.state) || a.state.localeCompare(b.state));
}
/** «16 items i 2.0.1: 15 i Sprint 71, 1 i Sprint 72 · Sprint 71 har 3 items uten release-label» */
function releaseSprintText(r) {
  const items = (r && r.ado && r.ado.items) || [];
  if (!items.length) return "";
  const by = new Map();
  let none = 0;
  items.forEach((i) => { if (i.iteration) by.set(i.iteration, (by.get(i.iteration) || 0) + 1); else none++; });
  const n = (c, one, many) => c + " " + (c === 1 ? one : many);
  const parts = [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], "nb")).map(([k, c]) => c + " i " + k);
  if (none) parts.push(none + " uten sprint");
  const extra = (r.ado.sprints || []).filter((s) => s.unlabelled > 0).map((s) => s.name + " har " + n(s.unlabelled, "item", "items") + " uten release-label");
  return n(items.length, "item", "items") + " i " + releaseScope(r) + ": " + parts.join(", ") + (extra.length ? " · " + extra.join(" · ") : "");
}
/** The burndown's numbers: today's scope left on every working day from the axis start to today (or the shipped day), from
 *  each item's delivered day, so a day nobody opened the page leaves no hole; the ideal line's ends, the day the tempo
 *  points at, and the scope the first reading found when it differs from today's. */
function releaseBurndownData(plan, r, todayDay) {
  const a = r && r.ado;
  if (!a || !Array.isArray(a.items) || !a.items.length) return null;
  const pr = releaseProgress(r);
  const usePoints = pr.pointsTotal > 0, unit = usePoints ? "SP" : "items", total = usePoints ? pr.pointsTotal : pr.total;
  const history = a.history || [];
  const pace = releasePace(plan, r, todayDay);
  const startDay = pace ? pace.startDay : releaseStartDay(plan, r);
  const axisStart = history.length && history[0].day < startDay ? history[0].day : startDay;   // readings before the clock's start (items moved to a later sprint) stay on the chart
  const lastDay = r.shippedDate && r.shippedDate < todayDay ? r.shippedDate : todayDay;
  const actual = [];
  for (const c = dayOf(axisStart); dayKey(c) <= lastDay; c.setDate(c.getDate() + 1)) if (isWorkDay(c)) actual.push({ day: dayKey(c), remaining: total - releaseDoneBy(r, dayKey(c), usePoints) });
  const endDay = [r.targetDate, r.shippedDate || todayDay, ...history.map((h) => h.day)].sort().pop();
  const first = history.find((h) => h.total > 0), firstTotal = first ? (usePoints ? first.pointsTotal : first.total) : null;
  return { startDay, axisStart, targetDay: r.targetDate, endDay, todayDay, total, unit, actual, forecastDay: pace ? pace.forecastDay : null, firstScope: first && firstTotal !== total ? { day: first.day, total: firstTotal } : null };
}
/** The sprint's open bugs and stories that carry no release label at all: what sprint planning still has to stamp. */
function sprintUnlabelledWiql(iterationPath) {
  return "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.IterationPath] = '" + String(iterationPath).replace(/'/g, "''") + "' AND [Custom.Release] = '' AND [System.WorkItemType] IN ('Bug', 'User Story') AND [System.State] NOT IN ('Closed', 'Removed')";
}

/* ---------- sprints: from ADO's iterations, cached in plan.sprints ---------- */
function dayKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function currentSprint(sprints, date) {
  const k = dayKey(date);
  return (Array.isArray(sprints) ? sprints : []).find((s) => s.start <= k && k <= s.finish) || null;
}
function sprintDay(sprint, date) {   // working days (Mon–Fri) from the sprint's start through `date`, 1-based; day 10 is a two-week sprint's last day
  const [y, m, d] = sprint.start.split("-").map(Number);
  let n = 0;
  for (const c = new Date(y, m - 1, d); dayKey(c) <= dayKey(date); c.setDate(c.getDate() + 1)) if (c.getDay() !== 0 && c.getDay() !== 6) n++;
  return Math.max(1, n);
}
function sprintLabel(sprints, date) {
  const s = currentSprint(sprints, date);
  return s ? s.name + " · dag " + sprintDay(s, date) : "";
}

if (typeof module !== "undefined") {
  module.exports = {
    BASE_Y, BASE_M, N_MONTHS, WEEK, SCHEMA, OWNER_DEFAULT, STATUS_LABEL,
    BACKLOG, FEATURE_STATES, EPIC_STATES, STATE_LABEL, EPIC_STATE_LABEL, OUTCOMES,
    WISH_SOURCES, WISH_SOURCE_LABEL, WISH_STATUSES, WISH_STATUS_LABEL, SIZE_CLASSES, wishesByStatus,
    FEATURE_TYPES, FEATURE_TYPE_LABEL, AREAS, normalizeAreas,
    dateToUnit, unitToDate, fmtDate, normalizePlan, epicStatus, shiftTask, resolveDeps,
    rangeWeeks, rangeLabel, goalText, exampleSeed,
    isoWeek, weekSpan, windowLabel, epicWindowText, discoveryOverdue,
    shelfTasks, epicCounts, sizeClass, sizeClassDerived, sizeClassText, bufferLabel, rawLabel, previewPlacement,
    dayKey, currentSprint, sprintDay, sprintLabel,
    dayToUnit, releaseScope, releaseSegments, releaseProgress, releaseItemDone, RELEASE_DONE_STATES, releaseWiql, releaseQueryUrl,
    workDays, workDaysBetween, addWorkDays, calendarDays, releaseStartDay, releasePace, nextReleaseText, releaseStateCounts, releaseSprintText, releaseBurndownData, sprintUnlabelledWiql, PACE_WORD, RELEASE_HISTORY_MAX, RELEASE_MAX_AGE_MS,
    progressFraction, progressSignal, epicProgressSignal, progressText,
    MIX, MIX_LABEL, capacityFactor, elapsedWeeks, queueFloor, resolveQueue,
  };
}

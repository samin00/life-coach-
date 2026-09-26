// Normalisation — ported from the original client (buildNodes, strList, mergePlan).
import { randomUUID } from "node:crypto";
import { skeletonFor, WEEKLY_CATS, MONTHLY_CATS, defaultTarget, currentHours, habitsFromMetrics } from "./fallback.js";

export const isStr = (v) => typeof v === "string" && v.trim().length > 0;
export const strList = (v, max) => (Array.isArray(v) ? v.filter(isStr).map((s) => s.trim()).slice(0, max) : []);
const newId = () => "n" + randomUUID().replace(/-/g, "").slice(0, 12);

/** Tier lists -> InterestNode[] (same weights/parenting as the client; x/y not persisted). */
export function buildNodes(interests) {
  const nodes = [];
  const primaries = interests.primary.map((label, i) => ({
    id: newId(), label, tier: "primary", weight: Math.max(60, 94 - i * 8), parentId: null,
  }));
  nodes.push(...primaries);

  const groups = primaries.map(() => []);
  // Distribute secondaries round-robin across primaries (as in the client).
  interests.secondary.forEach((label, i) => {
    if (primaries.length) groups[i % primaries.length].push(label);
    else nodes.push({ id: newId(), label, tier: "secondary", weight: 55, parentId: null });
  });
  let sIdx = 0;
  groups.forEach((labels, gi) => {
    labels.forEach((label) => {
      nodes.push({ id: newId(), label, tier: "secondary", weight: Math.max(35, 66 - sIdx * 5), parentId: primaries[gi].id });
      sIdx++;
    });
  });
  interests.emerging.forEach((label, i) => {
    nodes.push({ id: newId(), label, tier: "emerging", weight: Math.max(15, 28 - i * 5), parentId: null });
  });
  return nodes;
}

/** Validated AI analysis -> persisted analysis shape. `metrics` supplies defaults for habits / target. */
export function normalizeAnalysis(r, metrics = null) {
  const interests = {
    primary: strList(r.interests.primary, 3),
    secondary: strList(r.interests.secondary, 4),
    emerging: strList(r.interests.emerging, 2),
  };
  const patterns = [r.insight, ...(r.patterns || [])].filter(isStr).map((s) => s.trim()).slice(0, 3);
  return {
    interests: buildNodes(interests),
    patterns,
    summary: isStr(r.summary) ? r.summary.trim() : patterns[0],
    uncomfortableQuestion: r.question.trim(),
    habits: normalizeHabits(r.habits, metrics),
    screenTimeTargetHoursPerDay: normalizeTarget(r.screenTimeTargetHoursPerDay, metrics),
  };
}

export function normalizeHabits(list, metrics) {
  const valid = Array.isArray(list)
    ? list
        .filter((h) => h && isStr(h.name) && isStr(h.evidence) && ["low", "medium", "high"].includes(h.severity))
        .slice(0, 4)
        .map((h) => ({ name: h.name.trim().slice(0, 60), severity: h.severity, evidence: h.evidence.trim().slice(0, 240) }))
    : [];
  return valid.length ? valid : habitsFromMetrics(metrics);
}

/** Model's target if sane (0.25-12 h) and never above current use (when known), else defaultTarget. */
export function normalizeTarget(v, metrics) {
  const n = Number(v);
  const cur = currentHours(metrics);
  if (!Number.isFinite(n) || n < 0.25 || n > 12 || (cur && n > cur)) return defaultTarget(metrics);
  let r = Math.round(n * 4) / 4;
  if (cur && r > cur) r = Math.floor(cur * 4) / 4;
  return Math.max(0.25, r);
}

export function normalizeGoals(r) {
  return r.goals
    .filter((g) => g && isStr(g.title) && isStr(g.description))
    .slice(0, 3)
    .map((g) => ({ title: g.title.trim(), description: g.description.trim() }));
}

/**
 * Merge raw plan onto the 16-block skeleton; top up weekly/monthly to 5; map unknown categories.
 * Times are recomputed from 06:00 with CONTENT WINDOW = contentMin (see skeletonFor). Rest blocks keep
 * the fallback's tasks (usually none; SLEEP gets phone-out-of-room tasks for heavy late-night use).
 */
export function mergePlan(raw, fb, contentMin) {
  const cw = fb.daily.find((b) => b.tag === "CONTENT WINDOW");
  const blocks = skeletonFor(contentMin ?? (cw ? cw.duration : undefined));
  const daily = blocks.map((b, i) => {
    if (b.rest) return { ...b, tasks: [...fb.daily[i].tasks], note: fb.daily[i].note };
    const list = raw && Array.isArray(raw.daily) ? raw.daily : [];
    const src = list.find((x) => x && x.tag === b.tag) || list[i] || null;
    const tasks = strList(src && src.tasks, 5);
    return {
      ...b,
      tasks: tasks.length ? tasks : fb.daily[i].tasks,
      note: src && isStr(src.note) ? src.note.trim() : fb.daily[i].note,
    };
  });
  const normList = (list, key, cats, fallback) => {
    const valid = Array.isArray(list)
      ? list
          .filter((x) => x && isStr(x[key]))
          .map((x) => ({ [key]: x[key].trim(), category: cats.includes(x.category) ? x.category : cats[1] }))
      : [];
    return [...valid, ...fallback].slice(0, 5);
  };
  const weekly = normList(raw && raw.weekly, "label", WEEKLY_CATS, fb.weekly);
  const monthly = normList(raw && raw.monthly, "title", MONTHLY_CATS, fb.monthly);
  // Habit rules the model must not drop: a measurable screen-time cap (weekly + monthly) and, when the
  // fallback has one, a hard binge cap. Missing ones replace the last non-Primary item.
  const ensure = (list, key, item, re) => {
    if (!item || list.some((x) => re.test(x[key]))) return list;
    const out = [...list];
    let idx = -1;
    for (let j = out.length - 1; j >= 0; j--) {
      if (out[j].category !== "Primary" && !out[j]._locked) { idx = j; break; }
    }
    out[idx < 0 ? out.length - 1 : idx] = { ...item, _locked: true };
    return out;
  };
  const capRe = /h\/day|hours?\s*(a|per)\s*day|screen[- ]time/i;
  let w = ensure(weekly, "label", fb.weekly.find((x) => capRe.test(x.label)), capRe);
  w = ensure(w, "label", fb.weekly.find((x) => /binge/i.test(x.label)), /binge|session/i);
  const mo = ensure(monthly, "title", fb.monthly.find((x) => capRe.test(x.title)), capRe);
  const strip = (list) => list.map(({ _locked, ...x }) => x);
  return {
    daily,
    weekly: strip(w),
    monthly: strip(mo),
    weeklyNote: raw && isStr(raw.weeklyNote) ? raw.weeklyNote.trim() : fb.weeklyNote,
    monthlyNote: raw && isStr(raw.monthlyNote) ? raw.monthlyNote.trim() : fb.monthlyNote,
  };
}

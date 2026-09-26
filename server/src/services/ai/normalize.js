// Normalisation — ported from the original client (buildNodes, strList, mergePlan).
import { randomUUID } from "node:crypto";
import { SKELETON, WEEKLY_CATS, MONTHLY_CATS } from "./fallback.js";

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

/** Validated AI analysis -> persisted analysis shape. */
export function normalizeAnalysis(r) {
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
  };
}

export function normalizeGoals(r) {
  return r.goals
    .filter((g) => g && isStr(g.title) && isStr(g.description))
    .slice(0, 3)
    .map((g) => ({ title: g.title.trim(), description: g.description.trim() }));
}

/** Merge raw plan onto the fixed 16-block skeleton; top up weekly/monthly to 5; map unknown categories. */
export function mergePlan(raw, fb) {
  const daily = SKELETON.map((b, i) => {
    if (b.rest) return { ...b, tasks: [], note: "" };
    const list = raw && Array.isArray(raw.daily) ? raw.daily : [];
    const src = list.find((x) => x && (x.tag === b.tag || x.time === b.time)) || list[i] || null;
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
  return {
    daily,
    weekly: normList(raw && raw.weekly, "label", WEEKLY_CATS, fb.weekly),
    monthly: normList(raw && raw.monthly, "title", MONTHLY_CATS, fb.monthly),
    weeklyNote: raw && isStr(raw.weeklyNote) ? raw.weeklyNote.trim() : fb.weeklyNote,
    monthlyNote: raw && isStr(raw.monthlyNote) ? raw.monthlyNote.trim() : fb.monthlyNote,
  };
}

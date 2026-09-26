import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWatchHistory } from "./fixtures/generate.js";
import { extractMetrics } from "../src/services/metrics/index.js";
import { buildAnalysisFromMetrics, buildGoalsFrom, buildPlanFrom, skeletonFor, contentMinutesFor, makeFallbackPlan, defaultTarget } from "../src/services/ai/fallback.js";
import { mergePlan, normalizeAnalysis, normalizeTarget } from "../src/services/ai/normalize.js";
import { analysisPrompt, planPrompt } from "../src/services/ai/prompts.js";

const metricsOf = (p) => extractMetrics([{ name: "watch-history.json", text: JSON.stringify(generateWatchHistory(p)) }], "youtube");
const mLate = metricsOf("late");
const mDay = metricsOf("day");
const aLate = buildAnalysisFromMetrics(mLate, "");
const aDay = buildAnalysisFromMetrics(mDay, "");
const goal = { title: "Ship one real project" };

test("rule-based analysis varies with the data", () => {
  assert.notEqual(aLate.patterns[0], aDay.patterns[0]);
  assert.notEqual(aLate.uncomfortableQuestion, aDay.uncomfortableQuestion);
  assert.equal(aLate.habits[0].name, "Late-night scrolling");
  assert.equal(aLate.habits[0].severity, "high");
  assert.ok(aLate.habits.length >= 1 && aLate.habits.length <= 4);
  assert.ok(aDay.habits.length >= 1);
  assert.ok(aLate.interests.some((n) => n.tier === "primary" && n.label === "Coding"));
  assert.ok(aDay.interests.some((n) => n.tier === "primary" && n.label === "Cooking"));
  assert.equal(aLate.screenTimeTargetHoursPerDay, Math.round(Math.max(1, mLate.estHoursPerActiveDay * 0.7) * 4) / 4);
  assert.ok(aDay.screenTimeTargetHoursPerDay <= mDay.estHoursPerActiveDay, `day target ${aDay.screenTimeTargetHoursPerDay} > ${mDay.estHoursPerActiveDay}`);
});

test("static fallback only without metrics and text; manual text still varies", () => {
  const s = buildAnalysisFromMetrics(null, "");
  assert.match(s.uncomfortableQuestion, /programming tutorials/);
  const t = buildAnalysisFromMetrics(null, "I watch cooking recipe videos and baking channels every night");
  assert.ok(t.interests.some((n) => n.label === "Cooking"));
});

test("skeleton: variable content window, 16 blocks, sleep at 21:00", () => {
  for (const d of [45, 60, 90, 135, 180]) {
    const b = skeletonFor(d);
    assert.equal(b.length, 16);
    assert.equal(b.find((x) => x.tag === "CONTENT WINDOW").duration, d);
    assert.equal(b[15].time, "21:00");
    assert.ok(b.find((x) => x.tag === "FREE TIME").duration >= 20);
    const total = b.slice(0, 15).reduce((s, x) => s + x.duration, 0);
    assert.equal(total, 900);
  }
  assert.equal(contentMinutesFor(0.5), 45);
  assert.equal(contentMinutesFor(5), 180);
  assert.equal(contentMinutesFor(1.4), 85);
});

test("rule-based plan applies the habit rules", () => {
  const p = buildPlanFrom(aLate, goal, mLate);
  const cw = p.daily.find((b) => b.tag === "CONTENT WINDOW");
  assert.equal(cw.duration, contentMinutesFor(aLate.screenTimeTargetHoursPerDay));
  assert.match(cw.tasks[0], /Allowed: \d+ videos? from Fireship/);
  const wd = p.daily.find((b) => b.tag === "WIND DOWN");
  assert.match(wd.tasks.join(" "), /OUTSIDE the bedroom/);
  assert.match(wd.note, /\d+% of your activity is after midnight/);
  assert.ok(p.daily.find((b) => b.tag === "SLEEP").tasks.length > 0);
  assert.ok(p.weekly.some((w) => /≤ [\d.]+ h\/day, 5 of 7 days/.test(w.label)));
  assert.ok(p.weekly.some((w) => /binge cap/i.test(w.label)));
  assert.ok(p.monthly.some((m) => /h\/day/.test(m.title)));
  assert.equal(p.weekly.length, 5);
  assert.equal(p.monthly.length, 5);

  const q = buildPlanFrom(aDay, goal, mDay);
  assert.equal(q.daily.find((b) => b.tag === "SLEEP").tasks.length, 0);
  assert.notDeepEqual(q.daily.map((b) => b.tasks), p.daily.map((b) => b.tasks));
});

test("goals are habit-aware", () => {
  const g = buildGoalsFrom(aLate, mLate);
  assert.equal(g.length, 3);
  assert.ok(g.some((x) => /bedroom/.test(x.title)));
  assert.ok(g.some((x) => /h\/day/.test(x.title)));
});

test("mergePlan enforces content window and screen-time caps over AI output", () => {
  const fb = buildPlanFrom(aLate, goal, mLate);
  const d = contentMinutesFor(aLate.screenTimeTargetHoursPerDay);
  const raw = {
    daily: skeletonFor(45).map((b) => ({ ...b, tasks: ["a", "b", "c"], note: "n" })),
    weekly: [1, 2, 3, 4, 5].map((i) => ({ label: "w" + i, category: "Habit" })),
    monthly: [1, 2, 3, 4, 5].map((i) => ({ title: "m" + i, category: "Output" })),
  };
  const p = mergePlan(raw, fb, d);
  assert.equal(p.daily.find((b) => b.tag === "CONTENT WINDOW").duration, d);
  assert.equal(p.daily[15].time, "21:00");
  assert.ok(p.weekly.some((w) => /h\/day/.test(w.label)));
  assert.ok(p.weekly.some((w) => /binge/i.test(w.label)));
  assert.ok(p.monthly.some((m) => /h\/day/.test(m.title)));
  assert.equal(p.weekly.length, 5);
  assert.ok(!("_locked" in p.weekly[4]));
  // legacy call still works
  assert.equal(mergePlan(null, makeFallbackPlan("x", [])).daily.length, 16);
});

test("normalizeAnalysis defaults habits/target from metrics", () => {
  const a = normalizeAnalysis({ question: "q", insight: "i", interests: { primary: ["X"], secondary: [], emerging: [] }, habits: [] }, mLate);
  assert.equal(a.habits[0].name, "Late-night scrolling");
  assert.ok(a.screenTimeTargetHoursPerDay >= 1);
});

test("target never exceeds current use (default and model value)", () => {
  assert.equal(defaultTarget({ estHoursPerActiveDay: 0.6 }), 0.5);
  assert.equal(defaultTarget({ estHoursPerActiveDay: 1 }), 1);
  assert.equal(defaultTarget({ estHoursPerActiveDay: 1.2 }), 1);
  assert.equal(defaultTarget({ estHoursPerActiveDay: 5 }), 3.5);
  assert.equal(defaultTarget({ estHoursPerDay: 3, selfReported: true }), 2);
  assert.equal(defaultTarget(null), 2);
  assert.equal(normalizeTarget(1, { estHoursPerActiveDay: 0.6 }), 0.5);
  assert.equal(normalizeTarget(0.5, { estHoursPerActiveDay: 0.6 }), 0.5);
  assert.equal(normalizeTarget(0.6, { estHoursPerActiveDay: 0.6 }), 0.5);
  assert.equal(normalizeTarget(2, { estHoursPerActiveDay: 4 }), 2);
  assert.equal(normalizeTarget(3, null), 3);
  const aD = normalizeAnalysis({ question: "q", insight: "i", interests: { primary: ["X"], secondary: [], emerging: [] }, habits: [], screenTimeTargetHoursPerDay: 1 }, mDay);
  assert.ok(aD.screenTimeTargetHoursPerDay <= mDay.estHoursPerActiveDay);
});

test("content window under 45 min states the target in its note", () => {
  const p = buildPlanFrom(aDay, goal, mDay);
  const cw = p.daily.find((b) => b.tag === "CONTENT WINDOW");
  assert.equal(cw.duration, 45);
  const min = Math.round(aDay.screenTimeTargetHoursPerDay * 60);
  assert.ok(min < 45);
  assert.match(cw.note, new RegExp(`${aDay.screenTimeTargetHoursPerDay} h/day target = ${min} min`));
});

test("prompts include THE NUMBERS and the strict instruction", () => {
  const ap = analysisPrompt({ sourceType: "youtube", rawContent: "", meta: { files: [] }, metrics: mLate });
  assert.match(ap, /THE NUMBERS/);
  assert.match(ap, /Name the worst habit explicitly/);
  const pp = planPrompt({ analysis: aLate, goal, metrics: mLate });
  assert.match(pp, /CONTENT WINDOW is \d+ minutes/);
  assert.match(pp, /phone outside the bedroom/);
});

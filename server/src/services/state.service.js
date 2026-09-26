import { prisma } from "../lib/prisma.js";
import { providerInfo } from "./ai/index.js";
import { getHabitInputRow, serializeHabitInput } from "./habits.service.js";
import { getAnalysisRow, serializeAnalysis } from "./analysis.service.js";
import { getGoalRow, serializeGoal } from "./goals.service.js";
import { getPlanRow, serializePlan } from "./plan.service.js";

function deriveStep({ habitInput, analysis, goal, plan }) {
  if (!habitInput) return "source";
  if (!analysis) return "analyze";
  if (!goal) return "map";
  if (!plan) return "goals";
  return "output";
}

export async function getState(userId) {
  const [h, a, g, p] = await Promise.all([
    getHabitInputRow(userId),
    getAnalysisRow(userId),
    getGoalRow(userId),
    getPlanRow(userId),
  ]);
  const s = { habitInput: serializeHabitInput(h), analysis: serializeAnalysis(a), goal: serializeGoal(g), plan: serializePlan(p) };
  return { step: deriveStep(s), ...s, ai: providerInfo() };
}

/** Wipe all of the user's data (cascades analysis and plan). The user row itself is kept. */
export async function resetUser(userId) {
  await prisma.$transaction([
    prisma.habitInput.deleteMany({ where: { userId } }),
    prisma.goal.deleteMany({ where: { userId } }),
  ]);
  return { ok: true };
}

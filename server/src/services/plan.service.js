import { prisma } from "../lib/prisma.js";
import { parseJson, toJson } from "../lib/json.js";
import { AppError } from "../middleware/errorHandler.js";
import * as ai from "./ai/index.js";
import { requireAnalysis } from "./analysis.service.js";
import { getGoalRow, serializeGoal } from "./goals.service.js";
import { metricsForHabitInput } from "./habits.service.js";

const emptyProgress = () => ({ tasksDone: {}, weeklyDone: [false, false, false, false, false], monthlyProgress: [0, 0, 0, 0, 0] });

export function serializePlan(row) {
  if (!row) return null;
  const notes = parseJson(row.notes, {});
  return {
    id: row.id,
    goalId: row.goalId,
    createdAt: row.createdAt,
    daily: parseJson(row.dailyPlan, []),
    weekly: parseJson(row.weeklyPlan, []),
    monthly: parseJson(row.monthlyPlan, []),
    weeklyNote: notes.weeklyNote ?? "",
    monthlyNote: notes.monthlyNote ?? "",
    progress: { ...emptyProgress(), ...parseJson(row.progress, {}) },
  };
}

export async function getPlanRow(userId) {
  return prisma.plan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function getPlan(userId) {
  const row = await getPlanRow(userId);
  if (!row) throw new AppError(404, "NOT_FOUND", "No plan yet");
  return serializePlan(row);
}

export async function createPlan(userId) {
  const analysis = await requireAnalysis(userId);
  const goalRow = await getGoalRow(userId);
  if (!goalRow) throw new AppError(409, "NO_GOAL", "Choose a goal first");
  const metrics = await metricsForHabitInput(analysis.habitInputId);
  const plan = await ai.generatePlan({ analysis, goal: serializeGoal(goalRow), metrics });
  const data = {
    dailyPlan: toJson(plan.daily),
    weeklyPlan: toJson(plan.weekly),
    monthlyPlan: toJson(plan.monthly),
    notes: toJson({ weeklyNote: plan.weeklyNote, monthlyNote: plan.monthlyNote }),
    progress: toJson(emptyProgress()),
  };
  const row = await prisma.plan.upsert({
    where: { goalId: goalRow.id },
    update: data,
    create: { ...data, userId, goalId: goalRow.id },
  });
  return serializePlan(row);
}

export async function updateProgress(userId, patch) {
  const row = await getPlanRow(userId);
  if (!row) throw new AppError(404, "NOT_FOUND", "No plan yet");
  const current = serializePlan(row).progress;
  const next = { ...current };
  if (patch.tasksDone !== undefined) next.tasksDone = patch.tasksDone;
  if (patch.weeklyDone !== undefined) next.weeklyDone = patch.weeklyDone;
  if (patch.monthlyProgress !== undefined) next.monthlyProgress = patch.monthlyProgress;
  if (patch.monthlyDone !== undefined) next.monthlyDone = patch.monthlyDone;
  const updated = await prisma.plan.update({ where: { id: row.id }, data: { progress: toJson(next) } });
  return serializePlan(updated);
}

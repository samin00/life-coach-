import { prisma } from "../lib/prisma.js";
import { toJson } from "../lib/json.js";
import * as ai from "./ai/index.js";
import { requireAnalysis } from "./analysis.service.js";
import { metricsForHabitInput } from "./habits.service.js";

export function serializeGoal(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    source: row.source,
    createdAt: row.createdAt,
  };
}

export async function getGoalRow(userId) {
  return prisma.goal.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function suggestGoals(userId) {
  const analysis = await requireAnalysis(userId);
  const goals = await ai.suggestGoals(analysis, await metricsForHabitInput(analysis.habitInputId));
  await prisma.analysis.update({ where: { id: analysis.id }, data: { suggestions: toJson(goals) } });
  return { goals };
}

/** Replace the user's goal (plan cascades via onDelete). */
export async function setGoal(userId, { title, description, source }) {
  await requireAnalysis(userId);
  const row = await prisma.$transaction(async (tx) => {
    await tx.goal.deleteMany({ where: { userId } });
    return tx.goal.create({ data: { userId, title, description: description || null, source } });
  });
  return serializeGoal(row);
}

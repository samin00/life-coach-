import { prisma } from "../lib/prisma.js";
import { parseJson, toJson } from "../lib/json.js";
import { AppError } from "../middleware/errorHandler.js";
import * as ai from "./ai/index.js";
import { getHabitInputRow, serializeHabitInput } from "./habits.service.js";

export function serializeAnalysis(row) {
  if (!row) return null;
  return {
    id: row.id,
    habitInputId: row.habitInputId,
    createdAt: row.createdAt,
    interests: parseJson(row.interests, []),
    patterns: parseJson(row.patterns, []),
    summary: row.summary,
    uncomfortableQuestion: row.uncomfortableQuestion,
    answer: row.answer,
    suggestions: parseJson(row.suggestions, null),
  };
}

export async function getAnalysisRow(userId) {
  return prisma.analysis.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function requireAnalysis(userId) {
  const row = await getAnalysisRow(userId);
  if (!row) throw new AppError(409, "NO_ANALYSIS", "Run an analysis first");
  return serializeAnalysis(row);
}

export async function runAnalysis(userId) {
  const habitRow = await getHabitInputRow(userId);
  if (!habitRow) throw new AppError(409, "NO_HABIT_INPUT", "Submit your habit data first");
  const result = await ai.analyzeHabits(serializeHabitInput(habitRow));
  const data = {
    interests: toJson(result.interests),
    patterns: toJson(result.patterns),
    summary: result.summary,
    uncomfortableQuestion: result.uncomfortableQuestion,
    answer: null,
    suggestions: null,
  };
  const row = await prisma.analysis.upsert({
    where: { habitInputId: habitRow.id },
    update: data,
    create: { ...data, userId, habitInputId: habitRow.id },
  });
  return serializeAnalysis(row);
}

/** Edits to interests/answer invalidate cached goal suggestions. */
export async function updateAnalysis(userId, patch) {
  const row = await getAnalysisRow(userId);
  if (!row) throw new AppError(404, "NOT_FOUND", "No analysis to update");
  const data = { suggestions: null };
  if (patch.interests !== undefined) data.interests = toJson(patch.interests);
  if (patch.answer !== undefined) data.answer = patch.answer === null || patch.answer.trim() === "" ? null : patch.answer.trim();
  const updated = await prisma.analysis.update({ where: { id: row.id }, data });
  return serializeAnalysis(updated);
}

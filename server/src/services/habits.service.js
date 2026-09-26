import { prisma } from "../lib/prisma.js";
import { parseJson, toJson } from "../lib/json.js";
import { extractMetrics, metricsFromSelfReport } from "./metrics/index.js";

export function serializeHabitInput(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceType: row.sourceType,
    rawContent: row.rawContent,
    meta: parseJson(row.meta, { files: [], accuracy: 0 }),
    metrics: parseJson(row.metrics, null),
    createdAt: row.createdAt,
  };
}

export async function getHabitInputRow(userId) {
  return prisma.habitInput.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/** Replace the user's habit input; cascades analysis, and clears goal/plan (downstream of the old data). */
export async function replaceHabitInput(userId, { sourceType, rawContent, files, accuracy, selfReport, tzOffsetMin }) {
  const fileList = files ?? [];
  // Metrics are computed from per-file text; the text itself is not persisted (rawContent keeps the prompt excerpt).
  let metrics = fileList.some((f) => f.text) ? extractMetrics(fileList, sourceType, { tzOffsetMin }) : null;
  if (!metrics && selfReport) metrics = metricsFromSelfReport(selfReport);
  const meta = { files: fileList.map(({ name, size, kind }) => ({ name, size, kind })), accuracy };
  if (selfReport) meta.selfReport = selfReport;
  const row = await prisma.$transaction(async (tx) => {
    await tx.habitInput.deleteMany({ where: { userId } });
    await tx.goal.deleteMany({ where: { userId } });
    return tx.habitInput.create({
      data: { userId, sourceType, rawContent, meta: toJson(meta), metrics: toJson(metrics) },
    });
  });
  return serializeHabitInput(row);
}

/** Metrics of the habit input behind an analysis (null if none). */
export async function metricsForHabitInput(habitInputId) {
  const row = await prisma.habitInput.findUnique({ where: { id: habitInputId }, select: { metrics: true } });
  return row ? parseJson(row.metrics, null) : null;
}

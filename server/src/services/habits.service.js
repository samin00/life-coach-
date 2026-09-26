import { prisma } from "../lib/prisma.js";
import { parseJson, toJson } from "../lib/json.js";

export function serializeHabitInput(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceType: row.sourceType,
    rawContent: row.rawContent,
    meta: parseJson(row.meta, { files: [], accuracy: 0 }),
    createdAt: row.createdAt,
  };
}

export async function getHabitInputRow(userId) {
  return prisma.habitInput.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/** Replace the user's habit input; cascades analysis, and clears goal/plan (downstream of the old data). */
export async function replaceHabitInput(userId, { sourceType, rawContent, files, accuracy }) {
  const row = await prisma.$transaction(async (tx) => {
    await tx.habitInput.deleteMany({ where: { userId } });
    await tx.goal.deleteMany({ where: { userId } });
    return tx.habitInput.create({
      data: { userId, sourceType, rawContent, meta: toJson({ files: files ?? [], accuracy }) },
    });
  });
  return serializeHabitInput(row);
}

// Zod schemas for every request body.
import { z } from "zod";

export const MAX_RAW_CONTENT = 200_000;
export const MAX_FILE_TEXT = 1_500_000;
export const MAX_TOTAL_FILE_TEXT = 1_800_000;

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM");

export const SelfReport = z
  .object({
    hoursPerDay: z.number().min(0).max(24).optional(),
    worstHabits: z.array(z.string().trim().max(80)).max(3).optional().default([]),
    bedtime: HHMM.optional(),
    wakeTime: HHMM.optional(),
  })
  .strict();

export const HabitInputBody = z
  .object({
    sourceType: z.enum(["youtube", "instagram", "both", "manual"]),
    rawContent: z.string().max(MAX_RAW_CONTENT, `rawContent must be at most ${MAX_RAW_CONTENT} characters`),
    files: z
      .array(
        z.object({
          name: z.string().min(1).max(255),
          size: z.number().int().nonnegative(),
          kind: z.enum(["json", "html", "zip"]),
          text: z.string().max(MAX_FILE_TEXT, `file text must be at most ${MAX_FILE_TEXT} characters`).optional(),
        })
      )
      .max(50)
      .optional()
      .default([])
      .refine(
        (files) => files.reduce((s, f) => s + (f.text ? f.text.length : 0), 0) <= MAX_TOTAL_FILE_TEXT,
        `total file text must be at most ${MAX_TOTAL_FILE_TEXT} characters`
      ),
    accuracy: z.number().min(0).max(100),
    selfReport: SelfReport.optional(),
    tzOffsetMin: z.number().int().min(-840).max(840).optional(),
  })
  .strict();

export const InterestNode = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(60),
  tier: z.enum(["primary", "secondary", "emerging"]),
  weight: z.number().min(0).max(100),
  parentId: z.string().max(64).nullable(),
});

export const AnalysisPatchBody = z
  .object({
    interests: z
      .array(InterestNode)
      .max(100)
      .superRefine((nodes, ctx) => {
        const seen = new Set();
        nodes.forEach((n, i) => {
          if (seen.has(n.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, "id"], message: `Duplicate interest id "${n.id}"` });
          seen.add(n.id);
        });
      })
      .optional(),
    answer: z.string().max(5000).nullable().optional(),
  })
  .strict()
  .refine((b) => b.interests !== undefined || b.answer !== undefined, "Provide interests and/or answer");

export const GoalBody = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    source: z.enum(["suggested", "custom"]),
  })
  .strict();

const five = (item) => z.array(item).length(5);

export const ProgressPatchBody = z
  .object({
    tasksDone: z.record(z.string().regex(/^\d{1,2}-\d{1,2}$/, "keys must be blockIndex-taskIndex"), z.boolean()).optional(),
    weeklyDone: five(z.boolean()).optional(),
    monthlyDone: five(z.boolean()).optional(),
    monthlyProgress: five(z.number().min(0).max(100)).optional(),
  })
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Provide at least one progress field");

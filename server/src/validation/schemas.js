// Zod schemas for every request body.
import { z } from "zod";

export const MAX_RAW_CONTENT = 200_000;

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
        })
      )
      .max(50)
      .optional()
      .default([]),
    accuracy: z.number().min(0).max(100),
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

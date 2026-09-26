// Zod schemas for AI responses. Validation failure => fallback path.
import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const tierList = z.array(z.string()).default([]);

export const AnalysisAiSchema = z.object({
  question: nonEmpty,
  insight: nonEmpty,
  interests: z.object({
    primary: z.array(z.string()).refine((a) => a.some((s) => s.trim()), "at least one primary interest"),
    secondary: tierList,
    emerging: tierList,
  }),
  patterns: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const GoalsAiSchema = z.object({
  goals: z
    .array(z.object({ title: nonEmpty, description: nonEmpty }).passthrough())
    .min(3),
});

const blockSchema = z
  .object({
    time: z.string().optional(),
    tag: z.string().optional(),
    tasks: z.array(z.any()).optional(),
    note: z.any().optional(),
  })
  .passthrough();

export const PlanAiSchema = z.object({
  daily: z.array(blockSchema.nullable()).min(1),
  weekly: z.array(z.object({ label: z.any(), category: z.any() }).partial().passthrough().nullable()),
  monthly: z.array(z.object({ title: z.any(), category: z.any() }).partial().passthrough().nullable()),
  weeklyNote: z.string().optional(),
  monthlyNote: z.string().optional(),
});

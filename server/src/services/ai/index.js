// AI facade: prompt -> provider.complete -> parse -> zod validate -> normalise; any failure => fallback.
import { env } from "../../lib/env.js";
import { parseModelJson } from "../../lib/json.js";
import * as openai from "./openai.js";
import * as anthropic from "./anthropic.js";
import { fallbackProvider, buildAnalysisFromMetrics, buildGoalsFrom, buildPlanFrom, contentMinutesFor, defaultTarget } from "./fallback.js";
import { analysisPrompt, goalsPrompt, planPrompt } from "./prompts.js";
import { AnalysisAiSchema, GoalsAiSchema, PlanAiSchema } from "./schemas.js";
import { normalizeAnalysis, normalizeGoals, mergePlan } from "./normalize.js";

function selectProvider() {
  const wanted = env.AI_PROVIDER === "anthropic" ? anthropic : env.AI_PROVIDER === "openai" ? openai : null;
  return wanted && wanted.isConfigured() ? wanted : fallbackProvider;
}

const provider = selectProvider();

export function providerInfo() {
  return { provider: provider.name, live: provider !== fallbackProvider };
}

async function ask(prompt, maxTokens, schema, label) {
  const text = await provider.complete(prompt, { maxTokens });
  const result = schema.safeParse(parseModelJson(text));
  if (!result.success) throw new Error(`${label}: AI output failed validation`);
  return result.data;
}

function logFallback(label, err) {
  if (provider !== fallbackProvider) console.warn(`[ai] ${label} fell back: ${err.message}`);
}

export async function analyzeHabits(habitInput) {
  try {
    const r = await ask(analysisPrompt(habitInput), 1000, AnalysisAiSchema, "analysis");
    return normalizeAnalysis(r, habitInput.metrics || null);
  } catch (err) {
    logFallback("analysis", err);
    return buildAnalysisFromMetrics(habitInput.metrics || null, habitInput.rawContent || "");
  }
}

export async function suggestGoals(analysis, metrics = null) {
  try {
    const r = await ask(goalsPrompt(analysis, metrics), 1000, GoalsAiSchema, "goals");
    const goals = normalizeGoals(r);
    if (goals.length < 3) throw new Error("fewer than 3 valid goals");
    return goals;
  } catch (err) {
    logFallback("goals", err);
    return buildGoalsFrom(analysis, metrics);
  }
}

export async function generatePlan({ analysis, goal, metrics = null }) {
  const fb = buildPlanFrom(analysis, goal, metrics);
  const contentMin = contentMinutesFor(analysis.screenTimeTargetHoursPerDay ?? defaultTarget(metrics));
  try {
    const raw = await ask(planPrompt({ analysis, goal, metrics }), 4000, PlanAiSchema, "plan");
    return mergePlan(raw, fb, contentMin);
  } catch (err) {
    logFallback("plan", err);
    return fb;
  }
}

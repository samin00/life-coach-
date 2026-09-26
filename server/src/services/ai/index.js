// AI facade: prompt -> provider.complete -> parse -> zod validate -> normalise; any failure => fallback.
import { env } from "../../lib/env.js";
import { parseModelJson } from "../../lib/json.js";
import * as openai from "./openai.js";
import * as anthropic from "./anthropic.js";
import { fallbackProvider, fallbackAnalysis, fallbackGoals, makeFallbackPlan } from "./fallback.js";
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
    return normalizeAnalysis(r);
  } catch (err) {
    logFallback("analysis", err);
    return fallbackAnalysis();
  }
}

export async function suggestGoals(analysis) {
  try {
    const r = await ask(goalsPrompt(analysis), 1000, GoalsAiSchema, "goals");
    const goals = normalizeGoals(r);
    if (goals.length < 3) throw new Error("fewer than 3 valid goals");
    return goals;
  } catch (err) {
    logFallback("goals", err);
    return fallbackGoals(analysis.interests);
  }
}

export async function generatePlan({ analysis, goal }) {
  const fb = makeFallbackPlan(goal.title, analysis.interests);
  try {
    const raw = await ask(planPrompt({ analysis, goal }), 4000, PlanAiSchema, "plan");
    return mergePlan(raw, fb);
  } catch (err) {
    logFallback("plan", err);
    return fb;
  }
}

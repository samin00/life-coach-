/* Thin fetch wrapper for the Audit backend (see CONTRACT: all JSON, errors as { error: { code, message } }). */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const RATE_LIMIT_MSG = "Too many AI requests. Wait and retry.";

export async function request(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch("/api" + path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, "network_error", "Can't reach the Audit server. Is it running?");
  }
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const e = (data && data.error) || {};
    if (res.status === 429) throw new ApiError(429, e.code || "rate_limited", RATE_LIMIT_MSG);
    throw new ApiError(res.status, e.code || "http_" + res.status, e.message || `Request failed (${res.status}).`);
  }
  return data;
}

export const getState = () => request("/state");
export const saveHabits = (body) => request("/habits", { method: "POST", body });
export const analyze = () => request("/analyze", { method: "POST" });
export const updateAnalysis = (patch) => request("/analysis", { method: "PATCH", body: patch });
export const suggestGoals = () => request("/goals/suggest", { method: "POST" });
export const saveGoal = (goal) => request("/goals", { method: "POST", body: goal });
export const generatePlan = () => request("/plan", { method: "POST" });
export const getPlan = () => request("/plan");
export const updateProgress = (patch) => request("/plan/progress", { method: "PATCH", body: patch });
export const reset = () => request("/reset", { method: "DELETE" });

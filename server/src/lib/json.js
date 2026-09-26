/** Parse a JSON string column; return `fallback` on null/invalid input. */
export function parseJson(text, fallback = null) {
  if (text === null || text === undefined) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** Serialize a value for a JSON string column (null stays null). */
export function toJson(value) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

/** Parse model output: strip ``` fences, then fall back to the outermost {...}. */
export function parseModelJson(text) {
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model output is not JSON");
  }
}

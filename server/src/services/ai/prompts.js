// Prompt builders — ported from the original client (src/App.jsx).
import { SKELETON, TIERS } from "./fallback.js";

const PLATFORM_LABEL = { youtube: "YouTube", instagram: "Instagram", both: "YouTube + Instagram", manual: "Manual" };

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/** habitInput: { sourceType, rawContent, meta: { files, accuracy } } */
export function describeInput({ sourceType, rawContent, meta }) {
  const files = (meta && Array.isArray(meta.files) && meta.files) || [];
  const text = (rawContent || "").trim();
  const lines = [];
  if (files.length) {
    lines.push(`Source: uploaded export data. Platform(s): ${PLATFORM_LABEL[sourceType] || sourceType}.`);
    lines.push(
      "Files: " +
        files
          .map((f) => `${f.name} (${fmtSize(f.size)})${f.kind === "zip" ? " [zip archive — not parsed client-side, filename only]" : ""}`)
          .join(", ")
    );
    if (text) lines.push("Excerpt of file contents and user notes (truncated):\n" + text.slice(0, 12000));
    else lines.push("No readable file text is available. Infer cautiously from platform and filenames, and say so in the insight.");
  } else {
    lines.push("Source: manual self-report only. Lower accuracy — people misreport their own consumption.");
    if (text) lines.push(`User's own description of what they watch and follow:\n"${text.slice(0, 3000)}"`);
  }
  return lines.join("\n");
}

export function interestLines(nodes) {
  return TIERS.flatMap((t) => nodes.filter((n) => n.tier === t).map((n) => `- ${n.label} (${t}, ${n.weight})`)).join("\n");
}

export function answerLine(analysis) {
  const q = analysis ? analysis.uncomfortableQuestion : "";
  const a = analysis && typeof analysis.answer === "string" ? analysis.answer.trim() : "";
  return a
    ? `Their answer to your diagnostic question ("${q}"): "${a}"`
    : `They skipped your diagnostic question ("${q}"). Treat that as a signal.`;
}

export function analysisPrompt(habitInput) {
  return `You are Audit, a serious AI life coach analyzing content consumption data.

${describeInput(habitInput)}

Generate JSON:
{
  "question": "One targeted question based on detected patterns. Direct, not warm.",
  "interests": { "primary": ["2-3 main interest areas"], "secondary": ["3-4 secondary interests"], "emerging": ["1-2 topics just appearing"] },
  "insight": "One blunt honest observation about their consumption pattern.",
  "patterns": ["1-2 further blunt observations about their consumption (optional)"],
  "summary": "Two sentences summarising what their consumption says about them."
}
Interest labels must be short (1-3 words each).
Respond with JSON only. No markdown, no preamble.`;
}

export function goalsPrompt(analysis) {
  return `You are Audit, a serious AI life coach. You have mapped a user's interests from their content consumption.

Interest map (label, tier, weight 0-100):
${interestLines(analysis.interests)}

${answerLine(analysis)}

Suggest exactly 3 concrete, measurable goals with a 90-day horizon that turn their strongest interests into output. No generic self-help. No flattery.

Generate JSON:
{ "goals": [ { "title": "Short imperative goal, max 9 words", "description": "Two sentences: what done looks like, and why it fits their data." } ] }
Respond with JSON only. No markdown, no preamble.`;
}

export function planPrompt({ analysis, goal }) {
  const skeletonLines = SKELETON.map(
    (b, i) => `${i}. ${b.time} ${b.tag} ${b.title} (${b.duration} min)${b.rest ? " [REST]" : ""}`
  ).join("\n");
  return `You are Audit, a serious AI life coach building an execution plan.

Interest map (label, tier, weight 0-100):
${interestLines(analysis.interests)}

Goal: ${goal.title}${goal.description ? " — " + goal.description : ""}
${answerLine(analysis)}

The daily schedule is FIXED. These are the 16 blocks in order:
${skeletonLines}

Rest blocks (tags BREAK, MIDDAY, DINNER, FREE TIME, SLEEP) get "tasks": [] and "note": "".
Every other block gets exactly 3 concrete, specific tasks tied to the goal and interests, and one blunt audit note (one sentence, no flattery).

Generate JSON:
{
 "daily": [ { "time":"06:00","tag":"WAKE","title":"Morning Anchor","duration":30,"rest":false,"tasks":["..","..",".."],"note":"blunt audit note" } ...exactly 16 objects in the order above ],
 "weekly": [ { "label":"..","category":"Primary|Habit|Discipline|Output" } ...exactly 5 ],
 "monthly": [ { "title":"..","category":"Primary|Learning|Lifestyle|Discipline|Output" } ...exactly 5 ],
 "weeklyNote":"one blunt sentence about the week",
 "monthlyNote":"one blunt sentence about the month"
}
Respond with JSON only. No markdown, no preamble.`;
}

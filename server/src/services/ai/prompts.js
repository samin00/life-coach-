// Prompt builders. Every prompt carries THE NUMBERS (metricsSummaryText) when metrics exist.
import { skeletonFor, TIERS, contentMinutesFor, defaultTarget } from "./fallback.js";
import { metricsSummaryText } from "../metrics/index.js";

const STRICT = "Cite specific numbers from THE NUMBERS. No generic advice. Name the worst habit explicitly.";

export function numbersBlock(metrics) {
  if (!metrics) return "";
  return `THE NUMBERS (measured from their export${metrics.selfReported ? "; here self-reported" : ""}):\n${metricsSummaryText(metrics)}\n\n${STRICT}\n`;
}

function habitLines(analysis) {
  const h = (analysis && analysis.habits) || [];
  return h.length ? "Detected habits (worst first):\n" + h.map((x) => `- ${x.name} [${x.severity}]: ${x.evidence}`).join("\n") : "";
}

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
  const m = habitInput.metrics || null;
  const target = defaultTarget(m);
  return `You are Audit, a serious AI life coach analyzing content consumption data.

${numbersBlock(m)}
${describeInput(habitInput)}

Generate JSON:
{
  "question": "One targeted question based on detected patterns. Direct, not warm.",
  "interests": { "primary": ["2-3 main interest areas"], "secondary": ["3-4 secondary interests"], "emerging": ["1-2 topics just appearing"] },
  "insight": "One blunt honest observation about their consumption pattern.",
  "patterns": ["1-2 further blunt observations about their consumption (optional)"],
  "summary": "Two sentences summarising what their consumption says about them.",
  "habits": [ { "name": "short habit name, e.g. Late-night scrolling", "severity": "low|medium|high", "evidence": "the exact number(s) that prove it" } ],
  "screenTimeTargetHoursPerDay": ${target}
}
"habits": 1-4 items, worst first. Severity guide: after-midnight share >20% high, >10% medium; >4 h/day high, >2.5 h/day medium; a session >180 min high; Shorts >50% medium; 30+ day streak with no zero-day medium.
"screenTimeTargetHoursPerDay": a realistic FIRST-WEEK target in hours/day. Default ${target} (= max(1, current h/day x 0.7)); only change it with a reason.
The question and insight must quote at least one number from THE NUMBERS when present.
Interest labels must be short (1-3 words each).
Respond with JSON only. No markdown, no preamble.`;
}

export function goalsPrompt(analysis, metrics = null) {
  return `You are Audit, a serious AI life coach. You have mapped a user's interests from their content consumption.

${numbersBlock(metrics)}
${habitLines(analysis)}
Screen-time target: <= ${analysis.screenTimeTargetHoursPerDay ?? defaultTarget(metrics)} h/day.

Interest map (label, tier, weight 0-100):
${interestLines(analysis.interests)}

${answerLine(analysis)}

Suggest exactly 3 concrete, measurable goals with a 90-day horizon. At least one must attack the worst habit with a number (e.g. a screen-time cap or a curfew); at least one must turn their strongest interest into output. No generic self-help. No flattery.

Generate JSON:
{ "goals": [ { "title": "Short imperative goal, max 9 words", "description": "Two sentences: what done looks like, and why it fits their data." } ] }
Respond with JSON only. No markdown, no preamble.`;
}

export function planPrompt({ analysis, goal, metrics = null }) {
  const target = analysis.screenTimeTargetHoursPerDay ?? defaultTarget(metrics);
  const D = contentMinutesFor(target);
  const top = metrics && metrics.topChannels && metrics.topChannels[0] ? metrics.topChannels[0].name : "their top channel";
  const late = metrics ? metrics.lateNightShare || 0 : 0;
  const longest = metrics && metrics.sessions ? metrics.sessions.longestSessionMinutes : 0;
  const rules = [
    `CONTENT WINDOW is ${D} minutes (the ${target} h/day target). Its tasks must be concrete, e.g. "Allowed: 2 videos from ${top}. Timer on."`,
    late > 0.2
      ? `After-midnight share is ${Math.round(late * 100)}%: WIND DOWN tasks must include putting the phone outside the bedroom, and its note must quote ${Math.round(late * 100)}%.`
      : null,
    longest > 120 ? `Longest session was ${longest} min: one weekly goal must be a hard binge cap (e.g. no session over 60 min).` : null,
    `Weekly goals must include one measurable screen-time cap: "≤ ${target} h/day, 5 of 7 days".`,
    `Monthly goals must include a screen-time reduction goal stating the ${target} h/day target.`,
  ].filter(Boolean);
  const skeletonLines = skeletonFor(D).map(
    (b, i) => `${i}. ${b.time} ${b.tag} ${b.title} (${b.duration} min)${b.rest ? " [REST]" : ""}`
  ).join("\n");
  return `You are Audit, a serious AI life coach building an execution plan.

Interest map (label, tier, weight 0-100):
${interestLines(analysis.interests)}

Goal: ${goal.title}${goal.description ? " — " + goal.description : ""}
${answerLine(analysis)}

${numbersBlock(metrics)}
${habitLines(analysis)}
Habit rules:
${rules.map((r) => "- " + r).join("\n")}

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

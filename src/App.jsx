import React, { useState, useEffect, useRef } from "react";

/* ============================================================
   DESIGN TOKENS
   ============================================================ */
const C = {
  bg: "#080808",
  surface: "#0e0e0e",
  border: "#1c1c1c",
  accent: "#e8ff00",
  text: "#efefef",
  muted: "#666",
  danger: "#ff3b30",
  dim: "#333",
};
const FONT = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const GLOBAL_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${C.bg}; color: ${C.text}; font-family: ${FONT}; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
button, input, textarea, select { font-family: inherit; }
button, input, textarea, select { border-radius: 0; }
::placeholder { color: #444; }
::selection { background: ${C.accent}; color: ${C.bg}; }
@keyframes auditSpin { to { transform: rotate(360deg); } }
@keyframes auditFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes auditBlink { 50% { opacity: 0; } }
`;

/* ============================================================
   CLAUDE API
   ============================================================ */
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

async function askClaude(prompt, maxTokens = 1000) {
  if (!API_KEY) throw new Error("no key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  const text = data.content.map((c) => c.text || "").join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withMinDelay(promise, ms) {
  const [result] = await Promise.all([promise, sleep(ms)]);
  return result;
}

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const strList = (v, max) =>
  Array.isArray(v) ? v.filter(isStr).map((s) => s.trim()).slice(0, max) : [];

/* ============================================================
   STEP 3 — ANALYSIS
   ============================================================ */
const PLATFORM_LABEL = { youtube: "YouTube", instagram: "Instagram", both: "YouTube + Instagram" };

const FALLBACK_ANALYSIS = {
  question:
    "You've put dozens of hours into programming tutorials this quarter. Name one thing you built and shipped from them. If you can't, why are you still watching?",
  interests: {
    primary: ["Programming", "Fitness"],
    secondary: ["Productivity", "Personal Finance", "Cooking", "Photography"],
    emerging: ["Woodworking"],
  },
  insight:
    "You consume like a student and produce like a spectator. Most of your watch time is instructional content you never apply — the tutorials are the hobby, not the skill.",
};

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function describeInput({ platform, files, manualText }) {
  const lines = [];
  if (files.length) {
    lines.push(`Source: uploaded export data. Platform(s): ${PLATFORM_LABEL[platform]}.`);
    lines.push(
      "Files: " +
        files
          .map(
            (f) =>
              `${f.name} (${fmtSize(f.size)})${f.kind === "zip" ? " [zip archive — not parsed client-side, filename only]" : ""}`
          )
          .join(", ")
    );
    const excerpt = files
      .filter((f) => isStr(f.text))
      .map((f) => `--- ${f.name} ---\n${f.text}`)
      .join("\n\n")
      .slice(0, 12000);
    if (excerpt) lines.push("Excerpt of file contents (truncated):\n" + excerpt);
    else lines.push("No readable file text is available. Infer cautiously from platform and filenames, and say so in the insight.");
  } else {
    lines.push("Source: manual self-report only. Lower accuracy — people misreport their own consumption.");
  }
  if (manualText.trim()) {
    lines.push(`User's own description of what they watch and follow:\n"${manualText.trim().slice(0, 3000)}"`);
  }
  return lines.join("\n");
}

async function analyzeInput(input) {
  const prompt = `You are Audit, a serious AI life coach analyzing content consumption data.

${describeInput(input)}

Generate JSON:
{
  "question": "One targeted question based on detected patterns. Direct, not warm.",
  "interests": { "primary": ["2-3 main interest areas"], "secondary": ["3-4 secondary interests"], "emerging": ["1-2 topics just appearing"] },
  "insight": "One blunt honest observation about their consumption pattern."
}
Interest labels must be short (1-3 words each).
Respond with JSON only. No markdown, no preamble.`;
  try {
    const r = await askClaude(prompt, 1000);
    const primary = strList(r && r.interests && r.interests.primary, 3);
    const secondary = strList(r && r.interests && r.interests.secondary, 4);
    const emerging = strList(r && r.interests && r.interests.emerging, 2);
    if (!isStr(r.question) || !isStr(r.insight) || primary.length === 0) return FALLBACK_ANALYSIS;
    return { question: r.question.trim(), insight: r.insight.trim(), interests: { primary, secondary, emerging } };
  } catch (err) {
    return FALLBACK_ANALYSIS;
  }
}

function readFileExcerpt(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      let t = String(reader.result || "");
      if (/\.html?$/i.test(file.name)) {
        t = t
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"');
      }
      resolve(t.replace(/\s+/g, " ").trim().slice(0, 12000));
    };
    reader.onerror = () => resolve("");
    reader.readAsText(file.slice(0, 400000));
  });
}

/* ============================================================
   STEP 4 — BRAIN MAP MODEL
   ============================================================ */
const W = 820;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const TIERS = ["primary", "secondary", "emerging"];
const TIER_LABEL = { primary: "Primary", secondary: "Secondary", emerging: "Emerging" };

let idCounter = 0;
const newId = () => `n${Date.now().toString(36)}${(idCounter++).toString(36)}`;
const clampX = (x) => Math.max(40, Math.min(W - 40, x));
const clampY = (y) => Math.max(30, Math.min(H - 45, y));
function polar(cx, cy, rx, deg, ry = rx) {
  const a = (deg * Math.PI) / 180;
  return { x: clampX(cx + rx * Math.cos(a)), y: clampY(cy + ry * Math.sin(a)) };
}
const angleFromCenter = (n) => (Math.atan2(n.y - CY, n.x - CX) * 180) / Math.PI;

function buildNodes(interests) {
  const nodes = [];
  const np = interests.primary.length;
  // Two primaries sit left/right to use the wide canvas; otherwise start at 12 o'clock.
  const start = np === 2 ? 180 : -90;
  const primaries = interests.primary.map((label, i) => {
    const deg = start + (i * 360) / Math.max(np, 1);
    const p = polar(CX, CY, 135, deg, 120);
    return { id: newId(), label, tier: "primary", weight: Math.max(60, 94 - i * 8), parentId: null, x: p.x, y: p.y, deg };
  });
  primaries.forEach(({ deg, ...n }) => nodes.push(n));

  const groups = primaries.map(() => []);
  interests.secondary.forEach((label, i) => {
    if (primaries.length) groups[i % primaries.length].push(label);
    else {
      const p = polar(CX, CY, 200, -90 + i * 90, 170);
      nodes.push({ id: newId(), label, tier: "secondary", weight: 55, parentId: null, x: p.x, y: p.y });
    }
  });
  let sIdx = 0;
  groups.forEach((labels, gi) => {
    const parent = primaries[gi];
    labels.forEach((label, k) => {
      const deg = parent.deg + (k - (labels.length - 1) / 2) * 60;
      const p = polar(parent.x, parent.y, 110, deg);
      nodes.push({ id: newId(), label, tier: "secondary", weight: Math.max(35, 66 - sIdx * 5), parentId: parent.id, x: p.x, y: p.y });
      sIdx++;
    });
  });

  const ne = interests.emerging.length;
  interests.emerging.forEach((label, i) => {
    const slots = Math.max(np, ne, 1);
    const deg = start + ((i + 0.5) * 360) / slots;
    const p = polar(CX, CY, 330, deg, 205);
    nodes.push({ id: newId(), label, tier: "emerging", weight: Math.max(15, 28 - i * 5), parentId: null, x: p.x, y: p.y });
  });
  return nodes;
}

function placeNewNode(nodes, label, tier) {
  const count = nodes.filter((n) => n.tier === tier).length;
  const golden = count * 137.5;
  if (tier === "primary") {
    const p = polar(CX, CY, 135, -90 + golden + 25, 120);
    return { id: newId(), label, tier, weight: 70, parentId: null, x: p.x, y: p.y };
  }
  if (tier === "secondary") {
    const primaries = nodes.filter((n) => n.tier === "primary");
    if (!primaries.length) {
      const p = polar(CX, CY, 210, -90 + golden, 175);
      return { id: newId(), label, tier, weight: 50, parentId: null, x: p.x, y: p.y };
    }
    const kids = (id) => nodes.filter((n) => n.parentId === id).length;
    const parent = primaries.reduce((a, b) => (kids(b) < kids(a) ? b : a));
    const k = kids(parent.id);
    const deg = angleFromCenter(parent) + (((k * 47) % 140) - 70);
    const p = polar(parent.x, parent.y, 100, deg);
    return { id: newId(), label, tier, weight: 50, parentId: parent.id, x: p.x, y: p.y };
  }
  const p = polar(CX, CY, 330, -45 + golden, 205);
  return { id: newId(), label, tier: "emerging", weight: 25, parentId: null, x: p.x, y: p.y };
}

function nodeRadius(n) {
  if (n.tier === "primary") return 24 + n.weight * 0.14;
  if (n.tier === "secondary") return 13 + n.weight * 0.1;
  return 7 + n.weight * 0.06;
}

/* ============================================================
   STEP 5 — GOALS
   ============================================================ */
function interestLines(nodes) {
  return TIERS.flatMap((t) =>
    nodes.filter((n) => n.tier === t).map((n) => `- ${n.label} (${t}, ${n.weight})`)
  ).join("\n");
}

function answerLine(analysis, answer) {
  const q = analysis ? analysis.question : "";
  return answer.trim()
    ? `Their answer to your diagnostic question ("${q}"): "${answer.trim()}"`
    : `They skipped your diagnostic question ("${q}"). Treat that as a signal.`;
}

function fallbackGoals(nodes) {
  const prim = nodes.filter((n) => n.tier === "primary").sort((a, b) => b.weight - a.weight);
  const p1 = prim[0] ? prim[0].label : "your main interest";
  const p2 = prim[1] ? prim[1].label : prim[0] ? prim[0].label : "your second interest";
  return [
    {
      title: `Ship one real ${p1} project in 90 days`,
      description: `One project, scoped in a single sentence, published by day 90. Your data shows heavy consumption and no visible output — this flips the ratio.`,
    },
    {
      title: `Replace half your ${p2} viewing with practice`,
      description: `Every hour watched about ${p2} gets matched by an hour doing it. Track both. The gap between the numbers is the real audit.`,
    },
    {
      title: "Cap passive content at 45 minutes a day",
      description: "One fixed content window, everything else blocked. The time you win back funds the other two goals. This is the one that makes the rest possible.",
    },
  ];
}

async function suggestGoals(nodes, analysis, answer) {
  const prompt = `You are Audit, a serious AI life coach. You have mapped a user's interests from their content consumption.

Interest map (label, tier, weight 0-100):
${interestLines(nodes)}

${answerLine(analysis, answer)}

Suggest exactly 3 concrete, measurable goals with a 90-day horizon that turn their strongest interests into output. No generic self-help. No flattery.

Generate JSON:
{ "goals": [ { "title": "Short imperative goal, max 9 words", "description": "Two sentences: what done looks like, and why it fits their data." } ] }
Respond with JSON only. No markdown, no preamble.`;
  try {
    const r = await askClaude(prompt, 1000);
    const goals = Array.isArray(r && r.goals)
      ? r.goals.filter((g) => g && isStr(g.title) && isStr(g.description)).slice(0, 3)
      : [];
    if (goals.length < 3) return fallbackGoals(nodes);
    return goals.map((g) => ({ title: g.title.trim(), description: g.description.trim() }));
  } catch (err) {
    return fallbackGoals(nodes);
  }
}

/* ============================================================
   STEP 6 — PLAN
   ============================================================ */
const REST_TAGS = ["BREAK", "MIDDAY", "DINNER", "FREE TIME", "SLEEP"];
const SKELETON = [
  ["06:00", "WAKE", "Morning Anchor", 30],
  ["06:30", "MORNING", "Deep Work Block", 90],
  ["08:00", "MID-MORNING", "Learning Block", 60],
  ["09:00", "BREAK", "Short Break", 20],
  ["09:20", "LATE MORNING", "Output Block", 100],
  ["11:00", "MIDDAY", "Lunch + Reset", 60],
  ["12:00", "AFTERNOON", "Shallow Work + Admin", 90],
  ["13:30", "LATE AFTERNOON", "Second Deep Work", 90],
  ["15:00", "BREAK", "Movement Break", 30],
  ["15:30", "CONTENT WINDOW", "Allowed Content Time", 45],
  ["16:15", "EVENING", "Skills & Exploration", 75],
  ["17:30", "DINNER", "Dinner", 60],
  ["18:30", "REVIEW", "Daily Debrief", 20],
  ["18:50", "FREE TIME", "Unstructured Time", 70],
  ["20:00", "WIND DOWN", "Sleep Preparation", 60],
  ["21:00", "SLEEP", "Sleep", 540],
].map(([time, tag, title, duration]) => ({ time, tag, title, duration, rest: REST_TAGS.includes(tag) }));

const WEEKLY_CATS = ["Primary", "Habit", "Discipline", "Output"];
const MONTHLY_CATS = ["Primary", "Learning", "Lifestyle", "Discipline", "Output"];
const CAT_COLORS = {
  Primary: C.accent,
  Habit: "#00d4ff",
  Learning: "#00d4ff",
  Lifestyle: "#3dff9a",
  Discipline: "#ff8a3d",
  Output: "#c29bff",
};

function makeFallbackPlan(goalTitle, nodes) {
  const g = goalTitle.length > 60 ? goalTitle.slice(0, 57) + "..." : goalTitle;
  const prim = nodes.filter((n) => n.tier === "primary").sort((a, b) => b.weight - a.weight);
  const p1 = prim[0] ? prim[0].label : "your main interest";
  const em = nodes.find((n) => n.tier === "emerging");
  const content = {
    WAKE: {
      tasks: ["Out of bed on the first alarm. No snooze.", "500ml water and 5 minutes of daylight", `Write today's one non-negotiable for: ${g}`],
      note: "The first 30 minutes decide whether the day belongs to you or your feed. Phone stays in another room.",
    },
    MORNING: {
      tasks: [`Open the single hardest open task for: ${g}`, "Notifications off. One tab, one file, one problem.", "At 07:55 log what actually moved in one line"],
      note: "90 minutes of real work beats a full day of looking busy. If you check messages here, you chose comfort.",
    },
    "MID-MORNING": {
      tasks: ["Study one concept that directly unblocks the goal", "Summarize it in 3 bullets without looking", "Apply it once before the block ends"],
      note: "Learning without application is just higher-quality content consumption.",
    },
    "LATE MORNING": {
      tasks: ["Produce something visible: code, a draft, a set, a photo", "Hit a concrete quota before you stop", "Save and version it — no loose ends"],
      note: "Output is the only metric that counts. Count artifacts, not hours.",
    },
    AFTERNOON: {
      tasks: ["Clear inbox and messages in one pass", "Batch errands, payments and admin", "Pick tomorrow's first deep work task"],
      note: "Shallow work expands to fill whatever space you give it. 90 minutes, then it's done.",
    },
    "LATE AFTERNOON": {
      tasks: ["Return to the morning's problem with fresh eyes", "Finish it or cut it — no half-states", "Write the next concrete step for tomorrow"],
      note: "Most people fade here. That is exactly why this block is where you pull ahead.",
    },
    "CONTENT WINDOW": {
      tasks: [`Watch only saved, goal-relevant ${p1} content`, "Timer on: 45 minutes, then close the app", "Write one takeaway or it didn't count"],
      note: "This is the only window the algorithm gets. Outside it, your attention is not for sale.",
    },
    EVENING: {
      tasks: ["Deliberate practice on a secondary skill", em ? `Spend 20 minutes testing ${em.label} hands-on` : "Try one new thing hands-on for 20 minutes", "Note what energized you and what didn't"],
      note: "Exploration is allowed. Drifting isn't. Leave with a note, not just a feeling.",
    },
    REVIEW: {
      tasks: ["Check off what actually happened today", "Name the one moment you lost focus and why", "Set tomorrow's non-negotiable"],
      note: "Be precise. 'I was tired' is not a reason — it's a pattern to fix.",
    },
    "WIND DOWN": {
      tasks: ["Screens off by 20:15", "Lay out clothes, bag and first task for tomorrow", "Read fiction or stretch — nothing with a feed"],
      note: "Sleep quality is decided in this hour, not at 21:00.",
    },
  };
  return {
    daily: SKELETON.map((b) => (b.rest ? { ...b, tasks: [], note: "" } : { ...b, tasks: content[b.tag].tasks, note: content[b.tag].note })),
    weekly: [
      { label: `5 deep work blocks on: ${g}`, category: "Primary" },
      { label: "Train or move hard 4 times", category: "Habit" },
      { label: "Stay inside the content window 6 of 7 days", category: "Discipline" },
      { label: "Publish or share one finished piece of work", category: "Output" },
      { label: "Sunday review: score the week honestly", category: "Habit" },
    ],
    monthly: [
      { title: `Hit the first milestone of: ${g}`, category: "Primary" },
      { title: "Finish one structured course or book in the field", category: "Learning" },
      { title: "Average 7+ hours of sleep across the month", category: "Lifestyle" },
      { title: "Cut unplanned screen time in half", category: "Discipline" },
      { title: "Ship 4 public pieces of work", category: "Output" },
    ],
    weeklyNote: "Five commitments, not ten. If you can't hit five, the problem isn't the length of the list.",
    monthlyNote: "Progress you don't measure is progress you're imagining. Update these every Sunday, honestly.",
  };
}

function mergePlan(raw, fb) {
  const daily = SKELETON.map((b, i) => {
    if (b.rest) return { ...b, tasks: [], note: "" };
    const list = raw && Array.isArray(raw.daily) ? raw.daily : [];
    const src = list.find((x) => x && (x.tag === b.tag || x.time === b.time)) || list[i] || null;
    const tasks = strList(src && src.tasks, 5);
    return {
      ...b,
      tasks: tasks.length ? tasks : fb.daily[i].tasks,
      note: src && isStr(src.note) ? src.note.trim() : fb.daily[i].note,
    };
  });
  const normList = (list, key, cats, fallback) => {
    const valid = Array.isArray(list)
      ? list
          .filter((x) => x && isStr(x[key]))
          .map((x) => ({ [key]: x[key].trim(), category: cats.includes(x.category) ? x.category : cats[1] }))
      : [];
    return [...valid, ...fallback].slice(0, 5);
  };
  return {
    daily,
    weekly: normList(raw && raw.weekly, "label", WEEKLY_CATS, fb.weekly),
    monthly: normList(raw && raw.monthly, "title", MONTHLY_CATS, fb.monthly),
    weeklyNote: raw && isStr(raw.weeklyNote) ? raw.weeklyNote.trim() : fb.weeklyNote,
    monthlyNote: raw && isStr(raw.monthlyNote) ? raw.monthlyNote.trim() : fb.monthlyNote,
  };
}

async function generatePlan(nodes, goal, analysis, answer) {
  const fb = makeFallbackPlan(goal.title, nodes);
  const skeletonLines = SKELETON.map(
    (b, i) => `${i}. ${b.time} ${b.tag} ${b.title} (${b.duration} min)${b.rest ? " [REST]" : ""}`
  ).join("\n");
  const prompt = `You are Audit, a serious AI life coach building an execution plan.

Interest map (label, tier, weight 0-100):
${interestLines(nodes)}

Goal: ${goal.title}${goal.description ? " — " + goal.description : ""}
${answerLine(analysis, answer)}

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
  try {
    const raw = await askClaude(prompt, 4000);
    if (!raw || !Array.isArray(raw.daily) || !Array.isArray(raw.weekly) || !Array.isArray(raw.monthly)) return fb;
    return mergePlan(raw, fb);
  } catch (err) {
    return fb;
  }
}

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
function currentBlockIndex(date) {
  const m = date.getHours() * 60 + date.getMinutes();
  if (m >= 21 * 60 || m < 6 * 60) return SKELETON.length - 1;
  return SKELETON.findIndex((b) => m >= toMin(b.time) && m < toMin(b.time) + b.duration);
}
const fmtDuration = (d) => (d >= 120 && d % 60 === 0 ? `${d / 60} H` : `${d} MIN`);
const pad2 = (n) => String(n).padStart(2, "0");

/* ============================================================
   HOOKS + PRIMITIVES
   ============================================================ */
function useIsMobile(bp = 640) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < bp);
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return m;
}

const S = {
  label: { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontWeight: 500 },
  card: { background: C.surface, border: `1px solid ${C.border}`, padding: 20 },
  input: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: C.text,
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    width: "100%",
  },
  h2: { fontSize: 26, fontWeight: 600, margin: "0 0 8px", letterSpacing: "-0.01em", lineHeight: 1.2 },
  sub: { fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.6 },
};

function Btn({ children, onClick, disabled, variant = "primary", style, ...rest }) {
  const base = {
    border: "1px solid transparent",
    padding: "13px 22px",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 120ms, color 120ms, border-color 120ms",
  };
  const variants = {
    primary: disabled
      ? { background: C.border, color: "#444" }
      : { background: C.accent, color: C.bg },
    ghost: { background: "transparent", color: disabled ? "#444" : C.text, borderColor: disabled ? C.border : C.dim },
    danger: { background: "transparent", color: C.danger, borderColor: C.danger, padding: 0 },
  };
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}

function RemoveBtn({ onClick, label }) {
  return (
    <Btn variant="danger" onClick={onClick} aria-label={label} title={label} style={{ width: 28, height: 28, fontSize: 16, lineHeight: "26px", flexShrink: 0, letterSpacing: 0 }}>
      ×
    </Btn>
  );
}

function Toggle({ options, value, onChange, testId }) {
  return (
    <div style={{ display: "flex", border: `1px solid ${C.border}` }} data-testid={testId}>
      {options.map(([val, label], i) => {
        const on = value === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            aria-pressed={on}
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: "none",
              borderLeft: i ? `1px solid ${C.border}` : "none",
              background: on ? C.accent : "transparent",
              color: on ? C.bg : C.muted,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function AccuracyBar({ label, value, caption }) {
  return (
    <div style={{ ...S.card, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
        <span style={S.label}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 600, color: value ? C.accent : C.muted }} data-testid="accuracy-value">
          {value}%
        </span>
      </div>
      <div style={{ height: 6, background: C.border, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${value}%`, background: C.accent, transition: "width 300ms" }} />
      </div>
      {caption && <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>{caption}</div>}
    </div>
  );
}

const STEP_NAMES = ["source", "analyze", "map", "goals", "output"];
function StepIndicator({ step }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 36 }} aria-label="Progress">
      {STEP_NAMES.map((name, i) => {
        const on = i <= step - 1;
        const current = i === step - 1;
        return (
          <div key={name} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 3, background: on ? C.accent : C.border }} />
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginTop: 6,
                color: current ? C.accent : on ? C.text : "#444",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Loader({ messages, compact }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setI((x) => (x + 1) % messages.length), 1400);
    return () => clearInterval(iv);
  }, [messages.length]);
  return (
    <div
      data-testid="loader"
      style={{
        minHeight: compact ? 180 : "55vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
        textAlign: "center",
      }}
    >
      <div style={{ width: compact ? 32 : 46, height: compact ? 32 : 46, border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "auditSpin 0.9s linear infinite" }} />
      <div key={i} style={{ fontSize: 14, color: C.text, animation: "auditFade 300ms ease" }}>
        {messages[i]}
      </div>
      <div style={{ ...S.label, color: "#444" }}>Audit is working</div>
    </div>
  );
}

function Flash({ flash }) {
  if (!flash) return null;
  return (
    <div
      key={flash.n}
      role="status"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 50,
        background: C.accent,
        color: C.bg,
        padding: "10px 16px",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        animation: "auditFade 160ms ease",
      }}
    >
      {flash.text}
    </div>
  );
}

function Badge({ category }) {
  const col = CAT_COLORS[category] || C.muted;
  return (
    <span
      style={{
        display: "inline-block",
        border: `1px solid ${col}`,
        color: col,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "2px 6px",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {category}
    </span>
  );
}

function NoteCard({ label = "AUDIT NOTE", children }) {
  return (
    <div style={{ borderLeft: `2px solid ${C.accent}`, background: C.bg, padding: "12px 14px", marginTop: 14 }}>
      <div style={{ ...S.label, color: C.accent, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: C.text }}>{children}</div>
    </div>
  );
}

/* ============================================================
   STEP 1 — ONBOARDING
   ============================================================ */
function Onboarding({ onStart, isMobile }) {
  const features = [
    ["01", "Discover", "Upload your YouTube or Instagram export.", "We map where your attention actually goes."],
    ["02", "Define", "Confront the pattern. Answer one hard question.", "Pick a goal worth the hours."],
    ["03", "Execute", "Get a daily, weekly and monthly plan.", "Then do the work. No one else will."],
  ];
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: isMobile ? "48px 0" : "64px 0" }}>
      <div style={{ ...S.label, color: C.accent, marginBottom: 24 }}>
        Audit<span style={{ animation: "auditBlink 1s step-end infinite" }}>_</span> / life audit
      </div>
      <h1 style={{ fontSize: isMobile ? 34 : 56, lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
        Your data tells the truth. We read it.
      </h1>
      <p style={{ ...S.sub, fontSize: isMobile ? 14 : 16, maxWidth: 560, marginBottom: 44 }}>
        Audit reads what you actually consume — not what you claim you're into — and turns it into a plan you can execute. No flattery. No filler.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 10 : 0, marginBottom: 44 }}>
        {features.map(([num, title, l1, l2], i) => (
          <div key={title} style={{ ...S.card, borderLeft: !isMobile && i ? "none" : `1px solid ${C.border}`, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ ...S.label, color: C.accent }}>{num}</span>
              <span style={{ color: i < 2 ? C.muted : C.accent, fontSize: 14 }}>{i < 2 ? "→" : "■"}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              {l1}
              <br />
              {l2}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <Btn onClick={onStart} style={{ padding: "16px 30px", fontSize: 14 }}>
          Start Audit →
        </Btn>
        <span style={{ fontSize: 12, color: "#444" }}>~3 minutes. No account. Nothing stored.</span>
      </div>
    </div>
  );
}

/* ============================================================
   STEP 2 — DATA SOURCE
   ============================================================ */
const ACCEPT_RE = /\.(json|zip|html?)$/i;

function DataSource({ platform, setPlatform, files, setFiles, manualText, setManualText, onBack, onAnalyze, isMobile }) {
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState([]);
  const inputRef = useRef(null);

  function addFiles(list) {
    const arr = Array.from(list || []);
    const ok = arr.filter((f) => ACCEPT_RE.test(f.name));
    setRejected(arr.filter((f) => !ACCEPT_RE.test(f.name)).map((f) => f.name));
    ok.forEach((file) => {
      const id = newId();
      const kind = /\.zip$/i.test(file.name) ? "zip" : /\.json$/i.test(file.name) ? "json" : "html";
      setFiles((fs) => {
        if (fs.some((f) => f.name === file.name && f.size === file.size)) return fs;
        return [...fs, { id, name: file.name, size: file.size, kind, text: null, status: kind === "zip" ? "archive" : "reading" }];
      });
      if (kind !== "zip") {
        readFileExcerpt(file).then((text) =>
          setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, text, status: text ? "ready" : "empty" } : f)))
        );
      }
    });
  }

  const hasFiles = files.length > 0;
  const manualActive = !hasFiles && manualText.trim().length > 0;
  const accuracy = hasFiles ? (platform === "both" ? 85 : 65) : manualActive ? 40 : 0;
  const reading = files.some((f) => f.status === "reading");
  const valid = (hasFiles && !reading) || manualText.trim().length >= 20;
  const statusText = { reading: "reading…", ready: "text read", empty: "no readable text", archive: "zip — filename only, not parsed in-browser" };

  return (
    <div>
      <h2 style={S.h2}>Feed the audit.</h2>
      <p style={{ ...S.sub, marginBottom: 28 }}>Exports beat memory. People misreport their own habits. Files don't.</p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Upload panel */}
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: 14 }}>A / Upload export</div>
          <Toggle
            testId="platform-toggle"
            value={platform}
            onChange={setPlatform}
            options={[["youtube", "YouTube"], ["instagram", "Instagram"], ["both", "Both"]]}
          />
          <div
            role="button"
            tabIndex={0}
            data-testid="dropzone"
            onClick={() => inputRef.current && inputRef.current.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current && inputRef.current.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            style={{
              marginTop: 14,
              border: `1px dashed ${dragOver ? C.accent : C.dim}`,
              background: dragOver ? "rgba(232,255,0,0.04)" : C.bg,
              padding: "28px 16px",
              textAlign: "center",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <div style={{ fontSize: 22, color: dragOver ? C.accent : C.muted, marginBottom: 8 }}>↓</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Drop files or click to browse</div>
            <div style={{ fontSize: 11, color: C.muted }}>.json · .zip · .html</div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".json,.zip,.html,.htm"
              data-testid="file-input"
              style={{ display: "none" }}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {rejected.length > 0 && (
            <div style={{ fontSize: 12, color: C.danger, marginTop: 10 }}>Rejected (unsupported type): {rejected.join(", ")}</div>
          )}
          {hasFiles && (
            <div style={{ marginTop: 12 }}>
              {files.map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: f.kind === "zip" ? "#ff8a3d" : C.muted }}>
                      {fmtSize(f.size)} · {statusText[f.status]}
                    </div>
                  </div>
                  <RemoveBtn label={`Remove ${f.name}`} onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))} />
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#4a4a4a", marginTop: 14, lineHeight: 1.6 }}>
            YouTube: Google Takeout → YouTube → history. Instagram: Accounts Center → Download your information (JSON).
          </div>
        </div>

        {/* Manual panel */}
        <div style={{ ...S.card, display: "flex", flexDirection: "column" }}>
          <div style={{ ...S.label, marginBottom: 14 }}>B / Describe it manually</div>
          <textarea
            data-testid="manual-text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="What do you actually watch, follow and scroll? Channels, topics, how many hours. Be specific."
            rows={8}
            style={{ ...S.input, resize: "vertical", flex: 1, minHeight: 160, lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 11, color: manualText.trim().length >= 20 ? C.muted : "#444", marginTop: 8 }}>
            {manualText.trim().length} chars {manualText.trim().length < 20 ? "· min 20" : ""}
          </div>
          {manualActive && (
            <div data-testid="manual-warning" style={{ marginTop: 12, border: `1px solid #ff8a3d`, color: "#ff8a3d", padding: "10px 12px", fontSize: 12, letterSpacing: "0.04em" }}>
              ⚠ Lower accuracy — upload recommended
            </div>
          )}
        </div>
      </div>

      <AccuracyBar
        label="Estimated accuracy"
        value={accuracy}
        caption={
          hasFiles
            ? platform === "both"
              ? "Two platforms cross-checked. Best signal available."
              : "Single platform. Solid signal, partial picture."
            : manualActive
            ? "Self-reported. Expect blind spots."
            : "No input yet."
        }
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, gap: 12 }}>
        <Btn variant="ghost" onClick={onBack}>
          ← Back
        </Btn>
        <Btn onClick={onAnalyze} disabled={!valid}>
          Analyze →
        </Btn>
      </div>
    </div>
  );
}

/* ============================================================
   STEP 3 — ANALYSIS
   ============================================================ */
function Analysis({ analysis, answer, setAnswer, onContinue, onSkip }) {
  if (!analysis) {
    return <Loader messages={["Reading your data...", "Extracting patterns...", "Identifying interest clusters..."]} />;
  }
  const { primary, secondary, emerging } = analysis.interests;
  return (
    <div style={{ animation: "auditFade 300ms ease" }}>
      <h2 style={S.h2}>Pattern found.</h2>
      <p style={{ ...S.sub, marginBottom: 28 }}>
        {primary.length + secondary.length + emerging.length} interest clusters detected. Before the map, one question.
      </p>
      <div style={{ ...S.card, borderColor: C.accent, padding: 24 }} data-testid="audit-question">
        <div style={{ ...S.label, color: C.accent, marginBottom: 14 }}>■ Audit detected</div>
        <div style={{ fontSize: 18, lineHeight: 1.5, fontWeight: 500 }}>{analysis.question}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 16 }}>Signal: {primary.join(" · ")}</div>
      </div>
      <label style={{ display: "block", ...S.label, margin: "24px 0 10px" }} htmlFor="audit-answer">
        Be honest. This affects your plan.
      </label>
      <textarea
        id="audit-answer"
        data-testid="answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Be honest. This affects your plan."
        rows={5}
        style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
        <Btn variant="ghost" onClick={onSkip}>
          Skip
        </Btn>
        <Btn onClick={onContinue} disabled={!answer.trim()}>
          Continue →
        </Btn>
      </div>
    </div>
  );
}

/* ============================================================
   STEP 4 — BRAIN MAP
   ============================================================ */
function AddNodeForm({ onAdd, selectFirst, isMobile }) {
  const [label, setLabel] = useState("");
  const [tier, setTier] = useState("secondary");
  const submit = () => {
    if (!label.trim()) return;
    onAdd(label.trim(), tier);
    setLabel("");
  };
  const input = (
    <input
      key="in"
      data-testid="add-node-input"
      value={label}
      onChange={(e) => setLabel(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && submit()}
      placeholder="Add an interest"
      maxLength={40}
      style={{ ...S.input, flex: "1 1 180px", width: "auto", minWidth: 0 }}
    />
  );
  const select = (
    <select
      key="sel"
      data-testid="add-node-tier"
      value={tier}
      onChange={(e) => setTier(e.target.value)}
      style={{ ...S.input, width: isMobile ? "auto" : 150, flex: isMobile ? "1 1 120px" : "0 0 150px", cursor: "pointer" }}
    >
      {TIERS.map((t) => (
        <option key={t} value={t}>
          {TIER_LABEL[t]}
        </option>
      ))}
    </select>
  );
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      {selectFirst ? [select, input] : [input, select]}
      <Btn onClick={submit} disabled={!label.trim()} style={{ padding: "12px 20px" }} data-testid="add-node-btn">
        Add
      </Btn>
    </div>
  );
}

function Graph({ nodes, onMove, onRemove, isMobile }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [dragging, setDragging] = useState(null);
  const fs = isMobile ? 19 : 12;
  const maxChars = isMobile ? 12 : 20;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  function toSvg(clientX, clientY) {
    const svg = svgRef.current;
    const ctm = svg && svg.getScreenCTM();
    if (!ctm) {
      const rect = svg.getBoundingClientRect();
      return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
    }
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  function startDrag(id, clientX, clientY) {
    const n = byId[id];
    if (!n) return;
    const p = toSvg(clientX, clientY);
    dragRef.current = { id, dx: n.x - p.x, dy: n.y - p.y };
    setDragging(id);
  }
  function moveDrag(clientX, clientY) {
    const d = dragRef.current;
    if (!d) return;
    const p = toSvg(clientX, clientY);
    onMove(d.id, clampX(p.x + d.dx), clampY(p.y + d.dy));
  }
  function endDrag() {
    dragRef.current = null;
    setDragging(null);
  }

  const trunc = (s) => (s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s);
  const ordered = [...nodes].sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier));

  return (
    <svg
      ref={svgRef}
      data-testid="brain-graph"
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", background: C.surface, border: `1px solid ${C.border}`, userSelect: "none", WebkitUserSelect: "none", touchAction: "none" }}
      onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
      onMouseUp={endDrag}
      onMouseLeave={() => {
        endDrag();
        setHover(null);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) moveDrag(t.clientX, t.clientY);
      }}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
    >
      <defs>
        <radialGradient id="auditGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.2" />
          <stop offset="55%" stopColor={C.accent} stopOpacity="0.05" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={230} fill="url(#auditGlow)" />
      <ellipse cx={CX} cy={CY} rx={135} ry={120} fill="none" stroke="#161616" />
      <ellipse cx={CX} cy={CY} rx={330} ry={205} fill="none" stroke="#131313" strokeDasharray="2 6" />

      {nodes.map((n) => {
        if (n.tier === "primary") {
          return <line key={"l" + n.id} x1={CX} y1={CY} x2={n.x} y2={n.y} stroke={C.accent} strokeOpacity={0.4} strokeDasharray="4 6" strokeWidth={1.2} />;
        }
        const p = n.parentId && byId[n.parentId] ? byId[n.parentId] : { x: CX, y: CY };
        return <line key={"l" + n.id} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke={n.tier === "secondary" ? "#333" : "#262626"} strokeWidth={1} />;
      })}

      <circle cx={CX} cy={CY} r={9} fill={C.bg} stroke={C.accent} strokeWidth={2} />
      <circle cx={CX} cy={CY} r={3} fill={C.accent} />
      <text x={CX} y={CY + 26} textAnchor="middle" fill={C.muted} fontSize={isMobile ? 16 : 10} letterSpacing="0.15em" fontFamily={FONT}>
        YOU
      </text>

      {ordered.map((n) => {
        const r = nodeRadius(n);
        const isHover = hover === n.id;
        const fill = n.tier === "primary" ? C.accent : n.tier === "secondary" ? "#1c1c1c" : "#111";
        const stroke = n.tier === "primary" ? C.accent : n.tier === "secondary" ? (isHover ? "#666" : "#333") : isHover ? "#555" : "#2a2a2a";
        const labelColor = n.tier === "primary" ? C.text : n.tier === "secondary" ? "#999" : C.muted;
        const bx = n.x + r * 0.72 + 7;
        const by = n.y - r * 0.72 - 7;
        return (
          <g
            key={n.id}
            data-node={n.label}
            style={{ cursor: dragging === n.id ? "grabbing" : "grab", touchAction: "none" }}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
            onMouseDown={(e) => {
              e.preventDefault();
              startDrag(n.id, e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              const t = e.touches[0];
              setHover(n.id);
              if (t) startDrag(n.id, t.clientX, t.clientY);
            }}
          >
            <circle cx={n.x} cy={n.y} r={Math.max(r, 20)} fill="transparent" />
            <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke={stroke} strokeWidth={1.2} opacity={n.tier === "emerging" ? 0.85 : 1} />
            {n.tier === "primary" && (
              <text x={n.x} y={n.y + 4} textAnchor="middle" fill={C.bg} fontSize={isMobile ? 16 : 11} fontWeight={600} fontFamily={FONT} pointerEvents="none">
                {n.weight}
              </text>
            )}
            <text
              x={n.x}
              y={n.y + r + fs + 3}
              textAnchor="middle"
              fill={labelColor}
              fontSize={n.tier === "emerging" ? fs - 1 : fs}
              fontWeight={n.tier === "primary" ? 600 : 400}
              fontFamily={FONT}
              pointerEvents="none"
            >
              {trunc(n.label)}
            </text>
            {isHover && !dragging && (
              <g
                role="button"
                aria-label={`Remove ${n.label}`}
                style={{ cursor: "pointer" }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setHover(null);
                  onRemove(n.id);
                }}
              >
                <circle cx={bx} cy={by} r={isMobile ? 16 : 10} fill={C.danger} />
                <text x={bx} y={by + (isMobile ? 7 : 4.5)} textAnchor="middle" fill="#fff" fontSize={isMobile ? 22 : 14} fontWeight={600} fontFamily={FONT} pointerEvents="none">
                  ×
                </text>
              </g>
            )}
          </g>
        );
      })}

      <g pointerEvents="none">
        {[
          ["primary", "Primary"],
          ["secondary", "Secondary"],
          ["emerging", "Emerging"],
        ].map(([t, label], i) => {
          const lfs = isMobile ? 16 : 10;
          const y = H - (isMobile ? 80 : 58) + i * (isMobile ? 24 : 16);
          const fill = t === "primary" ? C.accent : t === "secondary" ? "#1c1c1c" : "#111";
          const stroke = t === "primary" ? C.accent : t === "secondary" ? "#333" : "#2a2a2a";
          return (
            <g key={t}>
              <circle cx={24} cy={y - lfs * 0.35} r={isMobile ? 7 : 5} fill={fill} stroke={stroke} />
              <text x={38} y={y} fill={C.muted} fontSize={lfs} letterSpacing="0.1em" fontFamily={FONT}>
                {label.toUpperCase()}
              </text>
            </g>
          );
        })}
      </g>
      {!isMobile && (
        <text x={W - 16} y={H - 14} textAnchor="end" fill="#3a3a3a" fontSize={10} fontFamily={FONT} pointerEvents="none">
          DRAG TO ARRANGE · HOVER TO REMOVE
        </text>
      )}
    </svg>
  );
}

function ListView({ nodes, onWeight, onRemove, onAdd, isMobile }) {
  return (
    <div style={S.card} data-testid="brain-list">
      {TIERS.map((t) => {
        const rows = nodes.filter((n) => n.tier === t);
        return (
          <div key={t} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.dim}`, paddingBottom: 8 }}>
              <span style={{ ...S.label, color: t === "primary" ? C.accent : C.muted }}>{TIER_LABEL[t]}</span>
              <span style={{ ...S.label, color: "#444" }}>{rows.length}</span>
            </div>
            {rows.length === 0 && <div style={{ fontSize: 12, color: "#444", padding: "12px 0" }}>Nothing here.</div>}
            {rows.map((n) => (
              <div
                key={n.id}
                data-row={n.label}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}`, flexWrap: isMobile ? "wrap" : "nowrap" }}
              >
                <div style={{ width: 56, height: 6, background: C.border, flexShrink: 0 }}>
                  <div style={{ width: `${n.weight}%`, height: "100%", background: C.accent }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t === "primary" ? C.text : t === "secondary" ? "#bbb" : "#888" }}>
                  {n.label}
                </div>
                <div style={{ width: 42, textAlign: "right", fontSize: 13, color: C.muted, flexShrink: 0 }}>{n.weight}%</div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={n.weight}
                  aria-label={`Weight of ${n.label}`}
                  onChange={(e) => onWeight(n.id, Number(e.target.value))}
                  style={{ width: isMobile ? "100%" : 140, accentColor: C.accent, order: isMobile ? 5 : 0, flexShrink: 0, margin: 0 }}
                />
                <RemoveBtn label={`Remove ${n.label}`} onClick={() => onRemove(n.id)} />
              </div>
            ))}
          </div>
        );
      })}
      <AddNodeForm onAdd={onAdd} selectFirst isMobile={isMobile} />
    </div>
  );
}

function BrainMap({ nodes, setNodes, insight, onNext, isMobile }) {
  const [view, setView] = useState("graph");
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(t);
  }, [flash]);
  const notify = (text) => setFlash({ text, n: Date.now() + Math.random() });

  function addNode(label, tier) {
    if (nodes.some((n) => n.label.toLowerCase() === label.toLowerCase())) {
      notify("Already mapped");
      return;
    }
    setNodes((ns) => [...ns, placeNewNode(ns, label, tier)]);
    notify("Added");
  }
  function removeNode(id) {
    setNodes((ns) => {
      const rest = ns.filter((n) => n.id !== id);
      const alt = rest.find((n) => n.tier === "primary");
      return rest.map((n) => (n.parentId === id ? { ...n, parentId: n.tier === "secondary" && alt ? alt.id : null } : n));
    });
    notify("Removed");
  }
  const moveNode = (id, x, y) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, x, y } : n)));
  const setWeight = (id, weight) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, weight } : n)));

  const quality = Math.min(95, 30 + nodes.length * 7);
  return (
    <div>
      <Flash flash={flash} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-end", gap: 16, marginBottom: 20, flexDirection: isMobile ? "column" : "row" }}>
        <div>
          <h2 style={S.h2}>Your brain map.</h2>
          <p style={S.sub}>This is where your attention goes. Correct it if it's wrong — not if it's uncomfortable.</p>
        </div>
        <div style={{ width: isMobile ? "100%" : 200, flexShrink: 0 }}>
          <Toggle testId="view-toggle" value={view} onChange={setView} options={[["graph", "Graph"], ["list", "List"]]} />
        </div>
      </div>

      {view === "graph" ? (
        <div>
          <Graph nodes={nodes} onMove={moveNode} onRemove={removeNode} isMobile={isMobile} />
          {isMobile && <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>Drag to arrange · tap a node, then × to remove</div>}
          <AddNodeForm onAdd={addNode} isMobile={isMobile} />
        </div>
      ) : (
        <ListView nodes={nodes} onWeight={setWeight} onRemove={removeNode} onAdd={addNode} isMobile={isMobile} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 20 }}>
        <AccuracyBar label="Map quality" value={quality} caption={`${nodes.length} node${nodes.length === 1 ? "" : "s"} mapped.`} />
        <div style={{ ...S.card, padding: 16, borderLeft: `2px solid ${C.accent}` }}>
          <div style={{ ...S.label, color: C.accent, marginBottom: 8 }}>Audit insight</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{insight}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
        <Btn onClick={onNext} disabled={nodes.length === 0}>
          Set Goals →
        </Btn>
      </div>
    </div>
  );
}

/* ============================================================
   STEP 5 — GOALS
   ============================================================ */
function Goals({ goalMode, onSuggest, onOwn, suggestions, loading, selected, setSelected, customGoal, setCustomGoal, onBack, onBuild, isMobile }) {
  const canBuild = goalMode === "suggest" ? selected !== null && !!suggestions : customGoal.trim().length >= 3;
  const choice = (mode, title, desc, onClick) => {
    const on = goalMode === mode;
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        style={{
          ...S.card,
          textAlign: "left",
          cursor: "pointer",
          color: C.text,
          borderColor: on ? C.accent : C.border,
          background: on ? "rgba(232,255,0,0.04)" : C.surface,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: on ? C.accent : C.text }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{desc}</div>
      </button>
    );
  };
  return (
    <div>
      <h2 style={S.h2}>Pick one goal.</h2>
      <p style={{ ...S.sub, marginBottom: 28 }}>One. Every hour in your plan will be spent against it.</p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        {choice("suggest", "Audit Suggests", "Three goals built from your map and your answer.", onSuggest)}
        {choice("own", "I Know My Goal", "You already know. Write it down.", onOwn)}
      </div>

      {goalMode === "suggest" && (
        <div style={{ marginTop: 20 }}>
          {loading || !suggestions ? (
            <Loader compact messages={["Reading your map...", "Weighing your answer...", "Drafting goals..."]} />
          ) : (
            <div style={{ display: "grid", gap: 10 }} data-testid="goal-suggestions">
              {suggestions.map((g, i) => {
                const on = selected === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-pressed={on}
                    style={{
                      ...S.card,
                      display: "flex",
                      gap: 16,
                      textAlign: "left",
                      cursor: "pointer",
                      color: C.text,
                      borderColor: on ? C.accent : C.border,
                      animation: "auditFade 300ms ease",
                    }}
                  >
                    <span style={{ ...S.label, color: on ? C.accent : "#444", paddingTop: 3 }}>{pad2(i + 1)}</span>
                    <span>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{g.title}</span>
                      <span style={{ display: "block", fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{g.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {goalMode === "own" && (
        <div style={{ marginTop: 20 }}>
          <label style={{ display: "block", ...S.label, marginBottom: 10 }} htmlFor="own-goal">
            Your goal — specific and measurable
          </label>
          <input
            id="own-goal"
            data-testid="own-goal"
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            placeholder="e.g. Run a sub-25 5K by December"
            maxLength={140}
            style={S.input}
          />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, gap: 12 }}>
        <Btn variant="ghost" onClick={onBack}>
          ← Map
        </Btn>
        <Btn onClick={onBuild} disabled={!canBuild}>
          Build My Plan →
        </Btn>
      </div>
    </div>
  );
}

/* ============================================================
   STEP 6 — PLANNER
   ============================================================ */
function Daily({ plan, done, toggleTask, isMobile }) {
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(null);
  useEffect(() => {
    let iv = null;
    const to = setTimeout(() => {
      setNow(new Date());
      iv = setInterval(() => setNow(new Date()), 60000);
    }, 60000 - (Date.now() % 60000));
    return () => {
      clearTimeout(to);
      if (iv) clearInterval(iv);
    };
  }, []);

  const current = currentBlockIndex(now);
  const total = plan.daily.reduce((s, b) => s + b.tasks.length, 0);
  const completed = plan.daily.reduce((s, b, i) => s + b.tasks.filter((_, j) => done[`${i}-${j}`]).length, 0);
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={S.label}>Local time</div>
          <div style={{ fontSize: isMobile ? 36 : 44, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1 }} data-testid="clock">
            {pad2(now.getHours())}:{pad2(now.getMinutes())}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={S.label}>Now</div>
          <div style={{ fontSize: 13, color: C.accent, marginTop: 4 }}>{current >= 0 ? plan.daily[current].title : "—"}</div>
        </div>
      </div>
      <div style={{ ...S.card, padding: 14, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={S.label}>Tasks done</span>
          <span style={{ fontSize: 13 }} data-testid="task-progress">
            {completed}/{total} · {pct}%
          </span>
        </div>
        <div style={{ height: 6, background: C.border }}>
          <div style={{ height: "100%", width: `${pct}%`, background: C.accent, transition: "width 250ms" }} />
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: isMobile ? 56 : 72, top: 8, bottom: 8, width: 1, background: C.border }} />
        {plan.daily.map((b, i) => {
          const isNow = i === current;
          const open = expanded === i && !b.rest;
          const blockDone = b.tasks.filter((_, j) => done[`${i}-${j}`]).length;
          return (
            <div key={i} style={{ display: "flex", gap: isMobile ? 10 : 14, marginBottom: 8, opacity: b.rest && !isNow ? 0.45 : 1 }} data-block={b.title}>
              <div style={{ width: isMobile ? 42 : 54, flexShrink: 0, fontSize: 12, paddingTop: 15, color: isNow ? C.accent : C.muted, textAlign: "right" }}>{b.time}</div>
              <div style={{ width: 9, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 18, position: "relative", zIndex: 1 }}>
                <div style={{ width: 9, height: 9, background: isNow ? C.accent : b.rest ? C.bg : C.dim, border: `1px solid ${isNow ? C.accent : C.dim}` }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                {isNow && (
                  <div
                    aria-hidden="true"
                    style={{ position: "absolute", inset: -5, background: C.accent, opacity: 0.1, filter: "blur(8px)", pointerEvents: "none" }}
                  />
                )}
                <div
                  role={b.rest ? undefined : "button"}
                  tabIndex={b.rest ? undefined : 0}
                  aria-expanded={b.rest ? undefined : open}
                  onClick={b.rest ? undefined : () => setExpanded(open ? null : i)}
                  onKeyDown={
                    b.rest
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpanded(open ? null : i);
                          }
                        }
                  }
                  style={{
                    position: "relative",
                    background: C.surface,
                    border: `1px solid ${isNow ? C.accent : open ? C.dim : C.border}`,
                    outline: isNow ? `1px solid rgba(232,255,0,0.25)` : "none",
                    outlineOffset: 2,
                    padding: "12px 14px",
                    cursor: b.rest ? "default" : "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, letterSpacing: "0.14em", color: isNow ? C.accent : C.muted, marginBottom: 3 }}>
                        {b.tag}
                        {isNow && <span style={{ marginLeft: 10, fontWeight: 600 }}>← NOW</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{b.title}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDuration(b.duration)}</div>
                      {!b.rest && (
                        <div style={{ fontSize: 11, color: blockDone === b.tasks.length ? C.accent : "#444", marginTop: 3 }}>
                          {blockDone}/{b.tasks.length} {open ? "▴" : "▾"}
                        </div>
                      )}
                    </div>
                  </div>
                  {open && (
                    <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12, cursor: "default" }} onClick={(e) => e.stopPropagation()}>
                      {b.tasks.map((t, j) => {
                        const k = `${i}-${j}`;
                        return (
                          <label key={k} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "7px 0", cursor: "pointer", fontSize: 13, lineHeight: 1.5 }}>
                            <input
                              type="checkbox"
                              checked={!!done[k]}
                              onChange={() => toggleTask(k)}
                              style={{ accentColor: C.accent, width: 16, height: 16, margin: "2px 0 0", flexShrink: 0, cursor: "pointer" }}
                            />
                            <span style={{ color: done[k] ? C.muted : C.text, textDecoration: done[k] ? "line-through" : "none" }}>{t}</span>
                          </label>
                        );
                      })}
                      <NoteCard>{b.note}</NoteCard>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Weekly({ plan, weeklyDone, toggleWeekly }) {
  const count = weeklyDone.filter(Boolean).length;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <span style={S.label}>This week</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: count === plan.weekly.length ? C.accent : C.text }} data-testid="weekly-count">
          {count}/{plan.weekly.length} COMPLETE
        </span>
      </div>
      <div style={{ border: `1px solid ${C.border}` }}>
        {plan.weekly.map((w, i) => {
          const on = weeklyDone[i];
          return (
            <div
              key={i}
              role="checkbox"
              aria-checked={on}
              tabIndex={0}
              data-weekly={i}
              onClick={() => toggleWeekly(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleWeekly(i);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                background: C.surface,
                borderTop: i ? `1px solid ${C.border}` : "none",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  border: `1px solid ${on ? C.accent : C.dim}`,
                  background: on ? C.accent : "transparent",
                  color: C.bg,
                  fontSize: 13,
                  lineHeight: "16px",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                {on ? "✓" : ""}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.5, color: on ? C.muted : C.text, textDecoration: on ? "line-through" : "none" }}>{w.label}</span>
              <Badge category={w.category} />
            </div>
          );
        })}
      </div>
      <NoteCard>{plan.weeklyNote}</NoteCard>
    </div>
  );
}

function Monthly({ plan, monthly, setMonthlyValue, isMobile }) {
  const avg = Math.round(monthly.reduce((s, v) => s + v, 0) / monthly.length);
  const status = avg < 40 ? ["Behind schedule", C.danger] : avg < 80 ? ["On track", C.accent] : ["Don't coast", "#3dff9a"];
  return (
    <div>
      <div style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={S.label}>Month average</div>
          <div style={{ fontSize: 13, color: status[1], marginTop: 8, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }} data-testid="monthly-status">
            {status[0]}
          </div>
        </div>
        <div style={{ fontSize: isMobile ? 48 : 64, fontWeight: 600, lineHeight: 1, color: status[1], letterSpacing: "-0.03em" }} data-testid="monthly-avg">
          {avg}%
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {plan.monthly.map((m, i) => {
          const v = monthly[i];
          return (
            <div key={i} style={S.card} data-monthly={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginBottom: 8 }}>{m.title}</div>
                  <Badge category={m.category} />
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, color: v >= 100 ? C.accent : C.text, flexShrink: 0, lineHeight: 1 }}>{v}%</div>
              </div>
              <div style={{ position: "relative", height: 8, background: C.border, marginTop: 16 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v}%`, background: CAT_COLORS[m.category] || C.accent }} />
                {[25, 50, 75, 100].map((t) => (
                  <div key={t} style={{ position: "absolute", left: `calc(${t}% - 1px)`, top: -3, bottom: -3, width: 1, background: v >= t ? C.bg : "#3a3a3a" }} />
                ))}
              </div>
              <div style={{ position: "relative", height: 14, marginTop: 4 }}>
                {[25, 50, 75, 100].map((t) => (
                  <span key={t} style={{ position: "absolute", left: `${t}%`, transform: t === 100 ? "translateX(-100%)" : "translateX(-50%)", fontSize: 9, color: v >= t ? C.muted : "#3a3a3a" }}>
                    {t}
                  </span>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={v}
                aria-label={`Progress for ${m.title}`}
                onChange={(e) => setMonthlyValue(i, Number(e.target.value))}
                style={{ width: "100%", accentColor: C.accent, marginTop: 8 }}
              />
            </div>
          );
        })}
      </div>
      <NoteCard>{plan.monthlyNote}</NoteCard>
    </div>
  );
}

function Planner({ plan, goal, onReset, isMobile }) {
  const [tab, setTab] = useState("daily");
  const [done, setDone] = useState({});
  const [weeklyDone, setWeeklyDone] = useState([false, false, false, false, false]);
  const [monthly, setMonthly] = useState([0, 0, 0, 0, 0]);

  if (!plan) {
    return <Loader messages={["Building your schedule...", "Allocating deep work...", "Cutting the noise...", "Writing audit notes..."]} />;
  }
  return (
    <div style={{ animation: "auditFade 300ms ease" }}>
      <div style={{ ...S.label, color: C.accent, marginBottom: 10 }}>Your plan</div>
      <h2 style={{ ...S.h2, marginBottom: 24 }}>{goal.title}</h2>
      <div style={{ marginBottom: 24 }}>
        <Toggle testId="planner-tabs" value={tab} onChange={setTab} options={[["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]]} />
      </div>
      {tab === "daily" && <Daily plan={plan} done={done} toggleTask={(k) => setDone((d) => ({ ...d, [k]: !d[k] }))} isMobile={isMobile} />}
      {tab === "weekly" && <Weekly plan={plan} weeklyDone={weeklyDone} toggleWeekly={(i) => setWeeklyDone((w) => w.map((v, j) => (j === i ? !v : v)))} />}
      {tab === "monthly" && (
        <Monthly plan={plan} monthly={monthly} setMonthlyValue={(i, val) => setMonthly((m) => m.map((v, j) => (j === i ? val : v)))} isMobile={isMobile} />
      )}
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 40, paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#444" }}>Nothing is saved. Screenshot it or live it.</span>
        <Btn variant="ghost" onClick={onReset}>
          Start Over
        </Btn>
      </div>
    </div>
  );
}

/* ============================================================
   ROOT
   ============================================================ */
function AuditApp({ onReset }) {
  const isMobile = useIsMobile();
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState("youtube");
  const [files, setFiles] = useState([]);
  const [manualText, setManualText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [answer, setAnswer] = useState("");
  const [nodes, setNodes] = useState([]);
  const [goalMode, setGoalMode] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [customGoal, setCustomGoal] = useState("");
  const [goal, setGoal] = useState(null);
  const [plan, setPlan] = useState(null);
  const suggestReq = useRef(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  async function startAnalysis() {
    setAnalysis(null);
    setStep(2);
    const result = await withMinDelay(analyzeInput({ platform, files, manualText }), 3000);
    setAnalysis(result);
  }
  function toMap(skip) {
    if (skip) setAnswer("");
    setNodes(buildNodes(analysis.interests));
    setStep(3);
  }
  function toGoals() {
    suggestReq.current++;
    setSuggestions(null);
    setSelectedGoal(null);
    setSuggestLoading(false);
    setGoalMode(null);
    setStep(4);
  }
  async function requestSuggestions() {
    setGoalMode("suggest");
    if (suggestions || suggestLoading) return;
    const req = ++suggestReq.current;
    setSuggestLoading(true);
    const g = await withMinDelay(suggestGoals(nodes, analysis, answer), 1500);
    if (req !== suggestReq.current) return;
    setSuggestions(g);
    setSelectedGoal(null);
    setSuggestLoading(false);
  }
  async function buildPlan() {
    const g = goalMode === "suggest" ? suggestions[selectedGoal] : { title: customGoal.trim(), description: "" };
    setGoal(g);
    setPlan(null);
    setStep(5);
    const p = await withMinDelay(generatePlan(nodes, g, analysis, answer), 3000);
    setPlan(p);
  }

  const pagePad = isMobile ? "0 16px" : "0 24px";
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: pagePad }}>
        {step === 0 ? (
          <Onboarding onStart={() => setStep(1)} isMobile={isMobile} />
        ) : (
          <div style={{ padding: isMobile ? "24px 0 64px" : "40px 0 96px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.2em", color: C.accent }}>
                AUDIT<span style={{ animation: "auditBlink 1s step-end infinite" }}>_</span>
              </span>
              <span style={{ ...S.label, color: "#444" }}>{pad2(step)} / 05</span>
            </div>
            <StepIndicator step={step} />
            {step === 1 && (
              <DataSource
                platform={platform}
                setPlatform={setPlatform}
                files={files}
                setFiles={setFiles}
                manualText={manualText}
                setManualText={setManualText}
                onBack={() => setStep(0)}
                onAnalyze={startAnalysis}
                isMobile={isMobile}
              />
            )}
            {step === 2 && <Analysis analysis={analysis} answer={answer} setAnswer={setAnswer} onContinue={() => toMap(false)} onSkip={() => toMap(true)} />}
            {step === 3 && <BrainMap nodes={nodes} setNodes={setNodes} insight={analysis ? analysis.insight : ""} onNext={toGoals} isMobile={isMobile} />}
            {step === 4 && (
              <Goals
                goalMode={goalMode}
                onSuggest={requestSuggestions}
                onOwn={() => setGoalMode("own")}
                suggestions={suggestions}
                loading={suggestLoading}
                selected={selectedGoal}
                setSelected={setSelectedGoal}
                customGoal={customGoal}
                setCustomGoal={setCustomGoal}
                onBack={() => setStep(3)}
                onBuild={buildPlan}
                isMobile={isMobile}
              />
            )}
            {step === 5 && <Planner plan={plan} goal={goal} onReset={onReset} isMobile={isMobile} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <AuditApp key={resetKey} onReset={() => setResetKey((k) => k + 1)} />
    </>
  );
}

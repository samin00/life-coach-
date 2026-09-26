// Deterministic fallback data — ported verbatim from the original client (src/App.jsx).
import { buildNodes } from "./normalize.js";

export const TIERS = ["primary", "secondary", "emerging"];
export const REST_TAGS = ["BREAK", "MIDDAY", "DINNER", "FREE TIME", "SLEEP"];
export const WEEKLY_CATS = ["Primary", "Habit", "Discipline", "Output"];
export const MONTHLY_CATS = ["Primary", "Learning", "Lifestyle", "Discipline", "Output"];

export const SKELETON = [
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

const FALLBACK_ANALYSIS_RAW = {
  question:
    "You've put dozens of hours into programming tutorials this quarter. Name one thing you built and shipped from them. If you can't, why are you still watching?",
  interests: {
    primary: ["Programming", "Fitness"],
    secondary: ["Productivity", "Personal Finance", "Cooking", "Photography"],
    emerging: ["Woodworking"],
  },
  insight:
    "You consume like a student and produce like a spectator. Most of your watch time is instructional content you never apply — the tutorials are the hobby, not the skill.",
  summary:
    "Your feed is dominated by instructional content in a few core areas. The volume of learning is high; the visible output is close to zero.",
};

/** Fallback analysis in the persisted shape (minus ids). */
export function fallbackAnalysis() {
  const r = FALLBACK_ANALYSIS_RAW;
  return {
    interests: buildNodes(r.interests),
    patterns: [r.insight],
    summary: r.summary,
    uncomfortableQuestion: r.question,
  };
}

export function fallbackGoals(nodes) {
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

export function makeFallbackPlan(goalTitle, nodes) {
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
    daily: SKELETON.map((b) => (b.rest ? { ...b, tasks: [], note: "" } : { ...b, tasks: [...content[b.tag].tasks], note: content[b.tag].note })),
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

/** Provider used when no AI key is configured: complete() always throws so callers take the fallback path. */
export const fallbackProvider = {
  name: "fallback",
  complete: async () => {
    throw new Error("No AI provider configured");
  },
};

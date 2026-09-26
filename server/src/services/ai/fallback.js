// Fallback data. With metrics (or manual text) the analysis, goals and plan are RULE-BASED from the
// user's numbers (buildAnalysisFromMetrics / buildGoalsFrom / buildPlanFrom), so different data gives
// different output. The original static fallback is kept only for "no metrics and no text at all".
import { buildNodes } from "./normalize.js";
import { TOPIC_KEYWORDS } from "../metrics/compute.js";
import { fmtHour, fmtMinutes } from "../metrics/index.js";

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

export const BASE_CONTENT_MIN = 45;
const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Target h/day -> CONTENT WINDOW minutes (rounded to 5, capped 45-180). */
export function contentMinutesFor(targetHours) {
  const m = Math.round(((Number(targetHours) || 0) * 60) / 5) * 5;
  return Math.min(180, Math.max(45, m));
}

/** First-week screen-time target: max(1, estHoursPerDay * 0.7), 1 decimal; 2 h when unknown. */
export function defaultTarget(metrics) {
  const est = metrics && Number(metrics.estHoursPerDay);
  if (!est) return 2;
  return Math.max(1, Math.round(est * 0.7 * 10) / 10);
}

/**
 * The 16-block skeleton with a variable CONTENT WINDOW. Times are recomputed cumulatively from 06:00.
 * The extra minutes are absorbed by FREE TIME (min 20), then EVENING (min 30), then AFTERNOON (min 45),
 * so SLEEP still starts at 21:00.
 */
export function skeletonFor(contentMin = BASE_CONTENT_MIN) {
  const blocks = SKELETON.map((b) => ({ ...b }));
  const cw = blocks.find((b) => b.tag === "CONTENT WINDOW");
  let extra = contentMin - cw.duration;
  cw.duration = contentMin;
  for (const [tag, min] of [["FREE TIME", 20], ["EVENING", 30], ["AFTERNOON", 45]]) {
    const b = blocks.find((x) => x.tag === tag);
    const take = Math.max(0, Math.min(extra, b.duration - min));
    b.duration -= take;
    extra -= take;
  }
  let t = 6 * 60;
  for (const b of blocks) {
    b.time = toHHMM(t);
    if (b.tag !== "SLEEP") t += b.duration;
  }
  return blocks;
}

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

// ---------------------------------------------------------------------------
// Rule-based fallback (driven by metrics)
// ---------------------------------------------------------------------------

const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const SEV_ORDER = { high: 0, medium: 1, low: 2 };
const pick = (arr, n) => arr[((n % arr.length) + arr.length) % arr.length];
const short = (s, n = 24) => (s.length > n ? s.slice(0, n - 1).trim() + "…" : s);
const hh = (h) => `${String(h).padStart(2, "0")}:00`;

/** Keyword topic counts from free text (manual description / raw excerpt). */
function textTopics(text) {
  const t = ` ${String(text || "").toLowerCase()} `;
  return Object.entries(TOPIC_KEYWORDS)
    .map(([name, words]) => ({ name, count: words.reduce((s, w) => s + (t.split(w).length - 1), 0) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Habits from thresholds. Always returns 1-4 items, worst first. */
export function habitsFromMetrics(m) {
  const H = [];
  if (!m) return [{ name: "Unmeasured consumption", severity: "medium", evidence: "No usage data to measure. You can't cut what you don't count." }];
  const late = m.lateNightShare || 0;
  if (late > 0.2 || late > 0.1) {
    H.push({
      name: "Late-night scrolling",
      severity: late > 0.2 ? "high" : "medium",
      evidence: `${pct(late)} of activity after midnight${m.lastActivityHour != null ? `; last activity typically ${fmtHour(m.lastActivityHour)}` : ""}.`,
    });
  }
  const hrs = m.estHoursPerDay || 0;
  if (hrs > 2.5) {
    H.push({
      name: "Heavy daily screen time",
      severity: hrs > 4 ? "high" : "medium",
      evidence: `~${hrs} h/day${m.activeDays ? ` across ${m.activeDays} active days` : " (self-reported)"}.`,
    });
  }
  const longest = m.sessions ? m.sessions.longestSessionMinutes : 0;
  if (longest > 120) {
    H.push({
      name: "Binge sessions",
      severity: longest > 180 ? "high" : "medium",
      evidence: `Longest session ${fmtMinutes(longest)} on ${m.sessions.longestSessionDate}; average ${Math.round(m.sessions.avgLength)} min.`,
    });
  }
  if ((m.shortsShare || 0) > 0.5) H.push({ name: "Shorts loop", severity: "medium", evidence: `${pct(m.shortsShare)} of YouTube watches are Shorts.` });
  if ((m.streakDays || 0) >= 30) H.push({ name: "No zero-days", severity: "medium", evidence: `${m.streakDays} consecutive days with activity. Not one day off.` });
  for (const w of m.worstHabits || []) H.push({ name: short(w, 40), severity: "medium", evidence: "Self-reported as one of your worst habits." });
  if (!H.length) {
    H.push({
      name: "Background viewing",
      severity: "low",
      evidence: hrs ? `~${hrs} h/day${m.peakHour != null ? `, peaking at ${hh(m.peakHour)}` : ""}. Contained, but still unplanned.` : "Usage is contained but unplanned.",
    });
  }
  return H.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]).slice(0, 4);
}

function tieredInterests(m, raw) {
  let topics = m && m.topics && m.topics.length ? m.topics : textTopics(raw);
  const channels = (m && m.topChannels) || [];
  const max = topics[0] ? topics[0].count : 0;
  const primary = topics.filter((t, i) => i < 3 && (i === 0 || t.count >= max * 0.35)).map((t) => t.name);
  const rest = topics.filter((t) => !primary.includes(t.name));
  const secondary = [...rest.slice(0, 2).map((t) => t.name), ...channels.slice(0, 4).map((c) => short(c.name))]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);
  const emerging = [...rest.slice(2).map((t) => t.name), ...channels.slice(4).map((c) => short(c.name))]
    .filter((v) => !secondary.includes(v))
    .slice(0, 2);
  if (!primary.length) {
    if (channels.length) primary.push(short(channels[0].name));
    else primary.push(m && m.shortsShare > 0.5 ? "Short-form Video" : "Mixed Feed");
  }
  return { primary, secondary: secondary.filter((s) => !primary.includes(s)), emerging };
}

/** Metrics (+ raw text) -> analysis in the persisted shape (minus ids). */
export function buildAnalysisFromMetrics(m, rawContentExcerpt = "") {
  if (!m && !String(rawContentExcerpt || "").trim()) return { ...fallbackAnalysis(), habits: habitsFromMetrics(null), screenTimeTargetHoursPerDay: 2 };
  const interests = tieredInterests(m, rawContentExcerpt);
  const habits = habitsFromMetrics(m);
  const worst = habits[0];
  const top = m && m.topChannels && m.topChannels[0];
  const p1 = interests.primary[0];
  const target = defaultTarget(m);
  const hrs = m && m.estHoursPerDay;
  let insight, question;
  const S = m && m.sessions;
  switch (worst.name) {
    case "Late-night scrolling":
      insight = `${pct(m.lateNightShare)} of your activity happens between midnight and 05:00, and your day typically ends at ${fmtHour(m.lastActivityHour)}. That isn't downtime, it's sleep you're spending on ${top ? top.name : "the feed"}.`;
      question = S
        ? `Your longest binge was ${fmtMinutes(S.longestSessionMinutes)} on ${S.longestSessionDate}, and ${pct(m.lateNightShare)} of everything you watch happens after midnight. What were you avoiding by staying up?`
        : `You're still on your phone after midnight most nights. What would tomorrow look like if you'd slept instead?`;
      break;
    case "Heavy daily screen time":
      insight = `~${hrs} h/day of screen time${m.activeDays ? ` across ${m.activeDays} active days` : ""}. Over a year that's ${Math.round(hrs * 365)} hours — ${Math.round((hrs * 365) / 40)} full work weeks handed to an algorithm.`;
      question = `At ~${hrs} h/day you spend ${Math.round(hrs * 7)} hours a week watching. Name one thing you finished last week that took even half that long.`;
      break;
    case "Binge sessions":
      insight = `Your longest session ran ${fmtMinutes(S.longestSessionMinutes)} on ${S.longestSessionDate}; sessions average ${Math.round(S.avgLength)} min. You don't watch a video, you watch until something stops you.`;
      question = `On ${S.longestSessionDate} you watched for ${fmtMinutes(S.longestSessionMinutes)} straight. What did you plan to do that day instead?`;
      break;
    case "Shorts loop":
      insight = `${pct(m.shortsShare)} of your YouTube watches are Shorts. You're training your attention span in 45-second slices, then wondering why deep work feels impossible.`;
      question = `More than half of what you watch is under a minute long. When did you last focus on one thing for an hour without checking your phone?`;
      break;
    case "No zero-days":
      insight = `${m.streakDays} consecutive days with activity${top ? `, led by ${top.name} (${top.count} views)` : ""}. There is no day off from the feed — it's infrastructure now, not entertainment.`;
      question = `You haven't gone a single day without it in ${m.streakDays} days. Could you go one day this week? If not, who's in charge?`;
      break;
    default:
      if (m && m.selfReported) {
        insight = `You named "${worst.name}" as a worst habit${hrs ? ` and claim ~${hrs} h/day` : ""}. Self-reports run low; assume the real number is higher.`;
        question = `You named "${worst.name}" yourself. What does it cost you on a normal day, in hours?`;
      } else if (m) {
        insight = `~${hrs} h/day, peaking at ${hh(m.peakHour)}${top ? `, mostly ${top.name} (${top.count} of ${m.totalEvents} events)` : ""}. Contained — but none of it is on a schedule you chose.`;
        question = `Your usage peaks at ${hh(m.peakHour)}. What should you be doing at that hour instead?`;
      } else {
        insight = `Your own description centres on ${p1}. Without an export there are no numbers to hide behind — or to prove you're in control.`;
        question = `You describe a lot of ${p1} content. How many hours of it did you watch last week — and what did you make from it?`;
      }
  }
  const patterns = [insight];
  if (m && !m.selfReported) {
    if (top) patterns.push(`${top.name} alone is ${Math.round((top.count / m.totalEvents) * 100)}% of your activity (${top.count} of ${m.totalEvents}).`);
    if (habits[1]) patterns.push(`${habits[1].name}: ${habits[1].evidence}`);
  }
  const summary = m && !m.selfReported
    ? `${m.totalEvents} events over ${m.rangeDays} days (~${hrs} h/day), dominated by ${p1}${top ? ` and ${top.name}` : ""}. Worst habit: ${worst.name.toLowerCase()} — ${worst.evidence}`
    : `Self-described feed centred on ${p1}${hrs ? ` at ~${hrs} h/day` : ""}. Worst habit: ${worst.name.toLowerCase()}.`;
  return {
    interests: buildNodes(interests),
    patterns: patterns.slice(0, 3),
    summary,
    uncomfortableQuestion: question,
    habits,
    screenTimeTargetHoursPerDay: target,
  };
}

/** Rule-based goal suggestions. */
export function buildGoalsFrom(analysis, m) {
  if (!m && !(analysis && analysis.habits && analysis.habits.length)) return fallbackGoals(analysis.interests);
  const nodes = analysis.interests || [];
  const prim = nodes.filter((n) => n.tier === "primary").sort((a, b) => b.weight - a.weight);
  const p1 = prim[0] ? prim[0].label : "your main interest";
  const target = analysis.screenTimeTargetHoursPerDay || defaultTarget(m);
  const hrs = m && m.estHoursPerDay;
  const habits = analysis.habits || habitsFromMetrics(m);
  const worst = habits[0] ? habits[0].name : "";
  const goals = [
    {
      title: `Cut screen time to ${target} h/day`,
      description: `${hrs ? `You're at ~${hrs} h/day now. ` : ""}Hold ≤ ${target} h/day on 5 of 7 days for 90 days, measured by your phone's screen-time report. Every hour you win back funds the other goals.`,
    },
  ];
  if (worst === "Late-night scrolling") {
    goals.push({ title: "Phone out of the bedroom by 23:00", description: `${pct(m.lateNightShare)} of your activity is after midnight. Done = 90 nights with the phone charging outside the bedroom, logged every morning.` });
  } else if (worst === "Binge sessions") {
    goals.push({ title: "No viewing session over 60 minutes", description: `Your longest binge was ${fmtMinutes(m.sessions.longestSessionMinutes)}. Done = 90 days where every session ends at a 60-minute timer.` });
  } else if (worst === "Shorts loop") {
    goals.push({ title: "Zero Shorts or Reels for 90 days", description: `${pct(m.shortsShare)} of your watches are Shorts. Done = feed blocked, long-form only, inside your content window.` });
  } else {
    goals.push({ title: "One zero-screen day every week", description: `${m && m.streakDays ? `${m.streakDays} days in a row with activity. ` : ""}Done = 12 full days offline in 90 days, planned in advance.` });
  }
  goals.push({
    title: `Ship one real ${p1} project in 90 days`,
    description: `Turn the ${p1} you watch into something you made. One project, scoped in a sentence, published by day 90.`,
  });
  return goals;
}

/** Rule-based plan: CONTENT WINDOW = target minutes, habit rules applied, task text picked by metric buckets. */
export function buildPlanFrom(analysis, goal, m) {
  const nodes = analysis.interests || [];
  const base = makeFallbackPlan(goal.title, nodes);
  const target = analysis.screenTimeTargetHoursPerDay || defaultTarget(m);
  const D = contentMinutesFor(target);
  const g = goal.title.length > 60 ? goal.title.slice(0, 57) + "..." : goal.title;
  const top = m && m.topChannels && m.topChannels[0] ? m.topChannels[0].name : null;
  const prim = nodes.filter((n) => n.tier === "primary").sort((a, b) => b.weight - a.weight);
  const p1 = prim[0] ? prim[0].label : "your main interest";
  const late = (m && m.lateNightShare) || 0;
  const longest = m && m.sessions ? m.sessions.longestSessionMinutes : 0;
  const hrs = m && m.estHoursPerDay;
  const peak = m && m.peakHour != null ? m.peakHour : null;
  // Buckets used to pick task variants deterministically.
  const lateB = late > 0.2 ? 2 : late > 0.1 ? 1 : 0;
  const hrsB = !hrs ? 0 : hrs > 4 ? 2 : hrs > 2.5 ? 1 : 0;
  const peakB = peak == null ? 0 : peak < 12 ? 1 : peak < 18 ? 2 : 3;
  const shortsB = m && m.shortsShare > 0.5 ? 1 : 0;
  const videos = Math.max(1, Math.round(D / 15));

  const c = {};
  c.WAKE = {
    tasks: [
      pick(["Out of bed on the first alarm. No snooze.", "Alarm across the room. Feet on the floor on the first ring.", "Up at 06:00 even if you slept late — the fix is tonight, not the snooze."], lateB),
      pick(["500ml water and 5 minutes of daylight", "Phone stays on airplane mode until 06:30", "No feed before the Deep Work Block. Not one video."], hrsB + lateB),
      `Write today's one non-negotiable for: ${g}`,
    ],
    note: lateB === 2 ? `You end most days at ${fmtHour(m.lastActivityHour)}. The morning only works if last night ended on time.` : base.daily[0].note,
  };
  c["CONTENT WINDOW"] = {
    tasks: [
      top ? `Allowed: ${videos} video${videos === 1 ? "" : "s"} from ${top}. Timer on: ${D} min.` : `Allowed: ${videos} saved ${p1} video${videos === 1 ? "" : "s"}. Timer on: ${D} min.`,
      shortsB ? "Long-form only. Shorts and Reels stay blocked." : pick(["Pick the videos before you open the app — no browsing the feed", "Watch from Watch Later only; the home feed stays closed", "Autoplay off before you press play"], peakB),
      "When the timer rings, close the app and log one takeaway",
    ],
    note: `${D} minutes is your whole budget (${target} h/day target${hrs ? `, down from ~${hrs} h` : ""}). Outside this window, your attention is not for sale.`,
  };
  c.EVENING = {
    tasks: [
      pick(["Deliberate practice on a secondary skill", `Hands-on ${p1} for 30 minutes — no tutorials`, "Build, cook, lift or write — anything with an output"], peakB),
      pick(["Walk outside for 20 minutes, phone in pocket", peak != null ? `This is near your usual peak (${hh(peak)}): phone in a drawer for the whole block` : "Phone in a drawer for the whole block", "Call or meet one person instead of scrolling"], peakB + hrsB),
      "Note what energized you and what didn't",
    ],
    note: peak != null && peak >= 17 ? `Your usage peaks at ${hh(peak)}. This block exists to occupy that hour with something that isn't a feed.` : base.daily[10].note,
  };
  c.REVIEW = {
    tasks: [
      "Check today's screen-time report and write the number down",
      `Was it ≤ ${target} h? If not, name the exact moment it broke`,
      "Set tomorrow's non-negotiable",
    ],
    note: "The number decides, not your memory of the day.",
  };
  if (lateB === 2) {
    c["WIND DOWN"] = {
      tasks: ["Phone on the charger OUTSIDE the bedroom by 20:15", "Alarm clock, not phone alarm", "Read paper or stretch — nothing with a feed"],
      note: `${pct(late)} of your activity is after midnight. The phone doesn't sleep in your room anymore.`,
    };
    c.SLEEP = {
      tasks: ["Phone stays out of the room all night", "If you wake up, no screens — lights off, back to bed"],
      note: `Every minute after midnight was ${pct(late)} of your usage. Tonight that number is zero.`,
    };
  } else {
    c["WIND DOWN"] = {
      tasks: [pick(["Screens off by 20:15", "Screens off by 20:15 — set a downtime schedule on the phone", "Phone charging in another room by 20:15"], lateB + hrsB), "Lay out clothes, bag and first task for tomorrow", "Read fiction or stretch — nothing with a feed"],
      note: lateB === 1 ? `${pct(late)} of your activity is after midnight. Close that gap before it grows.` : base.daily[14].note,
    };
  }

  const blocks = skeletonFor(D);
  const daily = blocks.map((b) => {
    const src = c[b.tag] || base.daily.find((x) => x.tag === b.tag);
    if (b.rest && !c[b.tag]) return { ...b, tasks: [], note: "" };
    return { ...b, tasks: [...src.tasks], note: src.note };
  });

  const weekly = [
    { label: `5 deep work blocks on: ${g}`, category: "Primary" },
    { label: `Screen time ≤ ${target} h/day, 5 of 7 days`, category: "Discipline" },
    longest > 120
      ? { label: `Hard binge cap: no session over 60 min (your record: ${fmtMinutes(longest)})`, category: "Discipline" }
      : lateB >= 1
      ? { label: "Phone out of the bedroom 6 of 7 nights", category: "Habit" }
      : { label: "Train or move hard 4 times", category: "Habit" },
    { label: "Publish or share one finished piece of work", category: "Output" },
    { label: "Sunday review: log 7 screen-time numbers honestly", category: "Habit" },
  ];
  const monthly = [
    { title: `Hit the first milestone of: ${g}`, category: "Primary" },
    { title: hrs ? `Cut screen time from ~${hrs} to ≤ ${target} h/day average` : `Hold screen time ≤ ${target} h/day average`, category: "Discipline" },
    { title: lateB >= 1 ? `Zero activity after midnight on 25 of 30 nights (now ${pct(late)})` : "Average 7+ hours of sleep across the month", category: "Lifestyle" },
    { title: "Finish one structured course or book in the field", category: "Learning" },
    { title: "Ship 4 public pieces of work", category: "Output" },
  ];
  return {
    daily,
    weekly,
    monthly,
    weeklyNote: `Target: ≤ ${target} h/day. ${hrs ? `You're at ~${hrs}. ` : ""}Five commitments — hit them or name why.`,
    monthlyNote: longest > 120 ? `Your record binge is ${fmtMinutes(longest)}. By month's end no session should pass 60 minutes.` : base.monthlyNote,
  };
}

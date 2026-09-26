// Pure metric computation over a list of timestamped events. No I/O, no DB.
//
// Event: { ts: epoch ms (UTC), offsetMin?: minutes east of UTC for local time (default 0),
//          platform: "youtube"|"instagram", kind: "long"|"short"|"impression"|"like"|"save",
//          channel?: string, title?: string }
//
// Screen time is estimated from sessions (events split by gaps > 30 min), not by summing a
// per-event constant. Session duration = (last event - first event) + a tail credit for the final
// event, whose own duration is unknown; a single-event session counts only its tail credit.
// Tail credits (minutes): YouTube long-form watch 8, YouTube Short 0.75, Instagram impression 0.75,
// like / save 0.3. Exports only record a start timestamp, never a duration.
//   estHoursPerActiveDay = sum(session durations) / activeDays
//   estHoursPerDay       = sum(session durations) / rangeDays (first to last event, min 1)

export const MINUTES_PER_EVENT = { long: 8, short: 0.75, impression: 0.75, like: 0.3, save: 0.3 };
export const SESSION_GAP_MIN = 30;

// Keyword buckets used to turn titles/channels into interest topics.
export const TOPIC_KEYWORDS = {
  Fitness: ["workout", "gym", "fitness", "lifting", "calisthenics", "running", "marathon", "protein", "bodybuilding", "yoga", "hypertrophy"],
  Coding: ["coding", "programming", "javascript", "python", "rust", "react", "developer", "software", "leetcode", "algorithm", "typescript", "golang", "linux"],
  Gaming: ["gaming", "gameplay", "minecraft", "fortnite", "speedrun", "playthrough", "valorant", "league of legends", "elden ring", "gta", "let's play", "twitch"],
  Finance: ["finance", "investing", "stock", "stocks", "crypto", "bitcoin", "money", "budget", "etf", "trading", "passive income", "real estate"],
  Cooking: ["cooking", "recipe", "chef", "kitchen", "baking", "food", "meal prep", "pasta"],
  Music: ["music", "guitar", "piano", "song", "album", "official video", "lyrics", "cover", "producer", "beat", "remix", "live performance"],
  News: ["news", "politics", "election", "breaking", "report", "debate", "war", "economy"],
  Comedy: ["comedy", "funny", "prank", "stand-up", "standup", "meme", "memes", "reaction", "sketch"],
  Productivity: ["productivity", "habits", "discipline", "morning routine", "self improvement", "study with me", "focus", "notion"],
  Tech: ["iphone", "review", "unboxing", "tech", "gadget", "android", "laptop", "ai "],
  Sports: ["football", "soccer", "nba", "highlights", "ufc", "f1", "formula 1", "tennis", "cricket"],
  Science: ["science", "physics", "space", "nasa", "biology", "chemistry", "documentary", "history"],
};

const r1 = (x) => Math.round(x * 10) / 10;
const r3 = (x) => Math.round(x * 1000) / 1000;
const pad2 = (n) => String(n).padStart(2, "0");

function localParts(ev) {
  const d = new Date(ev.ts + (ev.offsetMin || 0) * 60000);
  return {
    day: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(), // 0 = Sunday
    localMs: d.getTime(),
  };
}

const dayNum = (day) => Math.round(Date.parse(day + "T00:00:00Z") / 86400000);

export function topicCounts(events) {
  const counts = {};
  for (const ev of events) {
    const hay = ` ${(ev.title || "").toLowerCase()} ${(ev.channel || "").toLowerCase()} `;
    if (hay.trim() === "") continue;
    for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
      if (words.some((w) => hay.includes(w))) counts[topic] = (counts[topic] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** events -> metrics object, or null for no events. `extra` is merged in (e.g. searchCount). */
export function computeMetrics(events, extra = {}) {
  const evs = (events || []).filter((e) => e && Number.isFinite(e.ts)).sort((a, b) => a.ts - b.ts);
  if (!evs.length) return null;

  const byHour = Array(24).fill(0);
  const byWeekday = Array(7).fill(0);
  const days = new Map(); // day -> { count, lastMs }
  const lastByShiftedDay = new Map(); // "night belongs to previous day" (day boundary 05:00)
  const channels = new Map();
  const platforms = {};
  let late = 0, evening = 0, weekend = 0, ytWatches = 0, shorts = 0;

  for (const ev of evs) {
    const p = localParts(ev);
    ev._p = p;
    byHour[p.hour]++;
    byWeekday[p.weekday]++;
    if (p.hour < 5) late++;
    if (p.hour >= 21) evening++;
    if (p.weekday === 0 || p.weekday === 6) weekend++;
    platforms[ev.platform || "unknown"] = (platforms[ev.platform || "unknown"] || 0) + 1;
    if (ev.platform === "youtube" && (ev.kind === "long" || ev.kind === "short")) {
      ytWatches++;
      if (ev.kind === "short") shorts++;
    }
    if (ev.channel) channels.set(ev.channel, (channels.get(ev.channel) || 0) + 1);
    const d = days.get(p.day) || { count: 0 };
    d.count++;
    days.set(p.day, d);
    const shifted = localParts({ ts: ev.ts, offsetMin: (ev.offsetMin || 0) - 300 });
    const clock = p.hour + p.minute / 60 + (p.hour < 5 ? 24 : 0); // 01:30 -> 25.5
    const prev = lastByShiftedDay.get(shifted.day);
    if (prev === undefined || clock > prev) lastByShiftedDay.set(shifted.day, clock);
  }

  const dayKeys = [...days.keys()].sort();
  const firstDay = dayNum(dayKeys[0]);
  const lastDay = dayNum(dayKeys[dayKeys.length - 1]);
  const rangeDays = Math.max(1, lastDay - firstDay + 1);
  const activeDays = dayKeys.length;

  let streakDays = 1, run = 1;
  for (let i = 1; i < dayKeys.length; i++) {
    run = dayNum(dayKeys[i]) - dayNum(dayKeys[i - 1]) === 1 ? run + 1 : 1;
    streakDays = Math.max(streakDays, run);
  }

  // Sessions: a gap > 30 min between events starts a new session. Length = span + last event's cost.
  const sessions = [];
  let cur = null;
  for (const ev of evs) {
    if (cur && (ev.ts - cur.endTs) / 60000 <= SESSION_GAP_MIN) {
      cur.endTs = ev.ts;
      cur.lastCost = MINUTES_PER_EVENT[ev.kind] ?? 1;
      cur.count++;
    } else {
      if (cur) sessions.push(cur);
      cur = { startTs: ev.ts, endTs: ev.ts, lastCost: MINUTES_PER_EVENT[ev.kind] ?? 1, count: 1, day: ev._p.day };
    }
  }
  sessions.push(cur);
  const lengths = sessions.map((s) => (s.endTs - s.startTs) / 60000 + s.lastCost);
  const minutes = lengths.reduce((a, l) => a + l, 0);
  let longestIdx = 0;
  lengths.forEach((l, i) => {
    if (l > lengths[longestIdx]) longestIdx = i;
  });

  const lastHours = [...lastByShiftedDay.values()].sort((a, b) => a - b);
  const mid = Math.floor(lastHours.length / 2);
  const medianLast = lastHours.length % 2 ? lastHours[mid] : (lastHours[mid - 1] + lastHours[mid]) / 2;

  const peakHour = byHour.indexOf(Math.max(...byHour));
  const n = evs.length;
  evs.forEach((e) => delete e._p);

  return {
    selfReported: false,
    platforms,
    rangeDays,
    firstDay: dayKeys[0],
    lastDay: dayKeys[dayKeys.length - 1],
    totalEvents: n,
    activeDays,
    eventsPerActiveDay: r1(n / activeDays),
    estHoursPerActiveDay: r1(minutes / activeDays / 60),
    estHoursPerDay: r1(minutes / rangeDays / 60),
    lateNightShare: r3(late / n),
    eveningShare: r3(evening / n),
    weekendShare: r3(weekend / n),
    sessions: {
      count: sessions.length,
      avgLength: r1(lengths.reduce((s, l) => s + l, 0) / sessions.length),
      longestSessionMinutes: Math.round(lengths[longestIdx]),
      longestSessionDate: sessions[longestIdx].day,
    },
    topChannels: [...channels.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8),
    topics: topicCounts(evs).slice(0, 8),
    shortsShare: ytWatches ? r3(shorts / ytWatches) : 0,
    streakDays,
    lastActivityHour: r1(medianLast % 24),
    peakHour,
    byHour,
    byWeekday,
    ...extra,
  };
}

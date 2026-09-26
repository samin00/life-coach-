// Metrics entry point: route export files to parsers, merge events, compute metrics, summarise.
import { computeMetrics } from "./compute.js";
import { parseWatchHistoryJson, parseWatchHistoryHtml, countSearches } from "./youtube.js";
import { parseInstagramJson, instagramKind } from "./instagram.js";

export { computeMetrics, MINUTES_PER_EVENT } from "./compute.js";

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const looksLikeYouTubeHistory = (data) =>
  Array.isArray(data) && data.slice(0, 20).some((e) => e && typeof e.time === "string" && ("titleUrl" in e || "header" in e || "subtitles" in e));

/**
 * files: [{ name, text }] -> metrics or null when nothing parseable.
 * opts.tzOffsetMin: user's UTC offset (minutes east) applied to UTC timestamps; default 0 (treat UTC as local).
 */
export function extractMetrics(files, sourceType, opts = {}) {
  const tz = Number.isFinite(opts.tzOffsetMin) ? opts.tzOffsetMin : 0;
  const events = [];
  let searchCount = 0;
  let followingCount = 0;
  const parsedFiles = [];
  for (const f of files || []) {
    if (!f || typeof f.text !== "string" || !f.text.trim()) continue;
    const name = String(f.name || "").toLowerCase();
    const before = events.length;
    if (/\.html?$/.test(name) || /^\s*</.test(f.text)) {
      if (/search-history/.test(name)) searchCount += (f.text.match(/content-cell/g) || []).length / 2;
      else if (/youtube|watch-history|content-cell/i.test(name + f.text.slice(0, 5000))) events.push(...parseWatchHistoryHtml(f.text, tz));
    } else {
      const data = tryJson(f.text);
      if (data === undefined) continue;
      if (/search-history/.test(name)) searchCount += countSearches(data);
      else if (/watch-history/.test(name) || looksLikeYouTubeHistory(data)) events.push(...parseWatchHistoryJson(data, tz));
      else if (instagramKind(name, data)) {
        const r = parseInstagramJson(name, data, tz);
        events.push(...r.events);
        followingCount += r.followingCount;
      }
    }
    if (events.length > before) parsedFiles.push(f.name);
  }
  const extra = { sourceType, parsedFiles };
  if (searchCount) extra.searchCount = Math.round(searchCount);
  if (followingCount) extra.followingCount = followingCount;
  return computeMetrics(events, extra);
}

const HHMM = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
};

/** Manual self-report -> minimal metrics (flag selfReported). */
export function metricsFromSelfReport(sr) {
  if (!sr) return null;
  const hours = Number.isFinite(sr.hoursPerDay) ? sr.hoursPerDay : null;
  const bed = HHMM(sr.bedtime);
  const worst = (sr.worstHabits || []).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  if (hours === null && bed === null && !worst.length && !sr.wakeTime) return null;
  // Bedtime after midnight (00:00-05:00): assume the minutes past midnight are spent on the phone.
  const pastMidnight = bed !== null && bed < 5 ? bed : 0;
  const lateNightShare = hours ? Math.min(0.8, Math.round((pastMidnight / hours) * 1000) / 1000) : pastMidnight ? 0.3 : 0;
  return {
    selfReported: true,
    estHoursPerDay: hours,
    lateNightShare,
    bedtime: sr.bedtime || null,
    wakeTime: sr.wakeTime || null,
    worstHabits: worst,
    lastActivityHour: bed,
    topChannels: [],
    topics: [],
    sessions: null,
    byHour: null,
  };
}

const pct = (x) => `${Math.round((x || 0) * 100)}%`;
export const fmtMinutes = (m) => {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h ? `${h}h${String(mm).padStart(2, "0")}m` : `${mm}m`;
};
export const fmtHour = (h) => {
  if (h === null || h === undefined) return "?";
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm === 60 ? 0 : mm).padStart(2, "0")}`;
};

/** 8-12 blunt lines for prompts. */
export function metricsSummaryText(m) {
  if (!m) return "";
  const L = [];
  if (m.selfReported) {
    L.push("Self-reported (not measured) — treat as a lower bound; people under-report.");
    if (m.estHoursPerDay !== null) L.push(`Claims ~${m.estHoursPerDay} h/day of screen time.`);
    if (m.bedtime) L.push(`Bedtime ${m.bedtime}${m.wakeTime ? `, wake ${m.wakeTime}` : ""}.`);
    if (m.lateNightShare > 0) L.push(`~${pct(m.lateNightShare)} of screen time falls after midnight (from bedtime).`);
    if (m.worstHabits && m.worstHabits.length) L.push(`Self-named worst habits: ${m.worstHabits.join("; ")}.`);
    return L.join("\n");
  }
  L.push(`~${m.estHoursPerDay} h/day across ${m.activeDays} active days (of a ${m.rangeDays}-day range, ${m.firstDay} to ${m.lastDay}).`);
  L.push(`${m.totalEvents} events, ${m.eventsPerActiveDay} per active day.`);
  L.push(`${pct(m.lateNightShare)} of activity after midnight (00:00-05:00); ${pct(m.eveningShare)} between 21:00 and 24:00.`);
  if (m.sessions) L.push(`Longest binge ${fmtMinutes(m.sessions.longestSessionMinutes)} on ${m.sessions.longestSessionDate}; ${m.sessions.count} sessions averaging ${Math.round(m.sessions.avgLength)} min.`);
  L.push(`Peak hour ${String(m.peakHour).padStart(2, "0")}:00; typical last activity of the day ${fmtHour(m.lastActivityHour)}.`);
  L.push(`Longest streak: ${m.streakDays} consecutive days with activity.`);
  if (m.platforms && m.platforms.youtube) L.push(`Shorts are ${pct(m.shortsShare)} of YouTube watches.`);
  L.push(`Weekend share ${pct(m.weekendShare)}.`);
  if (m.topChannels && m.topChannels.length) L.push(`Top channels: ${m.topChannels.slice(0, 5).map((c) => `${c.name} (${c.count})`).join(", ")}.`);
  if (m.topics && m.topics.length) L.push(`Topics by keyword: ${m.topics.slice(0, 5).map((t) => `${t.name} (${t.count})`).join(", ")}.`);
  if (m.searchCount) L.push(`${m.searchCount} searches in the export.`);
  if (m.followingCount) L.push(`Follows ${m.followingCount} accounts.`);
  return L.slice(0, 12).join("\n");
}

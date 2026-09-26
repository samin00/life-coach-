import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWatchHistory } from "./fixtures/generate.js";
import { extractMetrics, metricsSummaryText, metricsFromSelfReport, computeMetrics } from "../src/services/metrics/index.js";
import { parseWatchHistoryHtml, parseTakeoutDate } from "../src/services/metrics/youtube.js";
import { parseInstagramJson } from "../src/services/metrics/instagram.js";

const late = generateWatchHistory("late");
const day = generateWatchHistory("day");
const mLate = extractMetrics([{ name: "watch-history.json", text: JSON.stringify(late) }], "youtube");
const mDay = extractMetrics([{ name: "watch-history.json", text: JSON.stringify(day) }], "youtube");

test("fixture is ~600 events across ~45 days", () => {
  assert.equal(late.length, 600);
  assert.equal(mLate.totalEvents, 600);
  assert.ok(mLate.rangeDays >= 40 && mLate.rangeDays <= 46, `rangeDays ${mLate.rangeDays}`);
});

test("late-night fixture shows late-night skew, binges and shorts", () => {
  assert.ok(mLate.lateNightShare > 0.2, `lateNightShare ${mLate.lateNightShare}`);
  assert.ok(mLate.estHoursPerDay > 0);
  // session-based: the 4h53m binge history must no longer read as ~1.5 h (rounds to 2.0; raw 2.016)
  assert.ok(mLate.estHoursPerActiveDay >= 2, `late h/active day ${mLate.estHoursPerActiveDay}`);
  assert.ok(mLate.estHoursPerActiveDay >= mLate.estHoursPerDay);
  assert.ok(mLate.sessions.longestSessionMinutes > 120);
  assert.match(mLate.sessions.longestSessionDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(mLate.topChannels[0].name, "Fireship");
  assert.ok(mLate.topChannels.length <= 8);
  assert.ok(mLate.shortsShare > 0.2);
  assert.equal(mLate.byHour.length, 24);
  assert.equal(mLate.byWeekday.length, 7);
  assert.equal(mLate.byHour.reduce((s, x) => s + x, 0), 600);
  assert.ok(mLate.topics.some((t) => t.name === "Coding"));
});

test("daytime fixture differs", () => {
  assert.ok(mDay.lateNightShare < 0.05);
  assert.ok(mDay.estHoursPerDay < mLate.estHoursPerDay);
  assert.notEqual(mDay.peakHour, mLate.peakHour);
});

test("estimate: range divides more than active days; single-event session gets only its tail credit", () => {
  const t = (s) => Date.parse(s);
  const m = computeMetrics([
    { ts: t("2026-01-01T10:00:00Z"), platform: "youtube", kind: "long" },
    { ts: t("2026-01-01T10:25:00Z"), platform: "youtube", kind: "long" },
    { ts: t("2026-01-01T10:50:00Z"), platform: "instagram", kind: "like" },
    { ts: t("2026-01-10T10:00:00Z"), platform: "instagram", kind: "like" },
  ]);
  // session 1: 50 + 0.3; session 2: 0.3 -> 50.6 min; 2 active days, 10-day range
  assert.equal(m.estHoursPerActiveDay, Math.round((50.6 / 2 / 60) * 10) / 10);
  assert.equal(m.estHoursPerDay, Math.round((50.6 / 10 / 60) * 10) / 10);
  assert.match(metricsSummaryText(m), /h per active day .*10-day range/);
});

test("computeMetrics: sessions, streak, shares on a hand-made list", () => {
  const t = (s) => Date.parse(s);
  const m = computeMetrics([
    { ts: t("2026-01-05T23:00:00Z"), platform: "youtube", kind: "long", channel: "A" },
    { ts: t("2026-01-05T23:20:00Z"), platform: "youtube", kind: "long", channel: "A" },
    { ts: t("2026-01-06T01:00:00Z"), platform: "youtube", kind: "short", channel: "B" },
    { ts: t("2026-01-07T12:00:00Z"), platform: "youtube", kind: "long", channel: "A" },
  ]);
  assert.equal(m.totalEvents, 4);
  assert.equal(m.activeDays, 3);
  assert.equal(m.streakDays, 3);
  assert.equal(m.sessions.count, 3);
  assert.equal(m.sessions.longestSessionMinutes, 28);
  assert.equal(m.lateNightShare, 0.25);
  assert.equal(m.eveningShare, 0.5);
  assert.equal(m.shortsShare, 0.25);
  assert.equal(m.topChannels[0].name, "A");
  // sessions: 23:00-23:20 + 8 (long tail) = 28; lone short 0.75; lone long 8 -> 36.75 min over 3 active / 3 range days
  assert.equal(m.estHoursPerActiveDay, Math.round((36.75 / 3 / 60) * 10) / 10);
  assert.equal(m.estHoursPerDay, Math.round((36.75 / 3 / 60) * 10) / 10);
});

test("summary text: 8-12 lines with numbers", () => {
  const lines = metricsSummaryText(mLate).split("\n");
  assert.ok(lines.length >= 8 && lines.length <= 12, `${lines.length} lines`);
  assert.match(lines.join("\n"), /h per active day across \d+ active days \(~[\d.]+ h\/day over the \d+-day range/);
  assert.match(lines.join("\n"), /after midnight/);
  assert.match(lines.join("\n"), /Longest binge \d+h\d{2}m on/);
  assert.match(lines.join("\n"), /Top channels: Fireship/);
});

test("HTML takeout variant", () => {
  const html = `<div class="outer-cell"><div class="content-cell mdl-cell">Watched&nbsp;<a href="https://www.youtube.com/watch?v=abc">Rust in 100 seconds</a><br><a href="https://www.youtube.com/channel/UCx">Fireship</a><br>Aug 14, 2026, 11:03:12 PM UTC<br></div><div class="content-cell mdl-cell"></div></div>
  <div class="outer-cell"><div class="content-cell mdl-cell">Watched&nbsp;<a href="https://www.youtube.com/shorts/xyz">Funny cat</a><br><a href="https://www.youtube.com/@cats">Cats</a><br>Aug 15, 2026, 1:10:00 AM UTC<br></div></div>`;
  const ev = parseWatchHistoryHtml(html);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].channel, "Fireship");
  assert.equal(ev[0].ts, Date.parse("2026-08-14T23:03:12Z"));
  assert.equal(ev[1].kind, "short");
  const m = extractMetrics([{ name: "watch-history.html", text: html }], "youtube");
  assert.equal(m.totalEvents, 2);
  assert.equal(parseTakeoutDate("Jan 2, 2026, 12:05:00 AM GMT+02:00").ts, Date.parse("2026-01-01T22:05:00Z"));
});

test("Instagram shapes + search history + unknown files", () => {
  const likes = { likes_media_likes: [{ title: "gymshark", string_list_data: [{ href: "x", value: "👍", timestamp: 1786000000 }] }] };
  const seen = { impressions_history_posts_seen: [{ string_map_data: { Author: { value: "memes" }, Time: { timestamp: 1786003600 } } }] };
  const following = { relationships_following: [{ string_list_data: [{ value: "a", timestamp: 1 }] }, { string_list_data: [{ value: "b", timestamp: 2 }] }] };
  assert.equal(parseInstagramJson("liked_posts.json", likes).events[0].kind, "like");
  const m = extractMetrics(
    [
      { name: "liked_posts.json", text: JSON.stringify(likes) },
      { name: "posts_viewed.json", text: JSON.stringify(seen) },
      { name: "following.json", text: JSON.stringify(following) },
      { name: "search-history.json", text: JSON.stringify([{ time: "2026-01-01T00:00:00Z" }, { time: "2026-01-02T00:00:00Z" }]) },
      { name: "weird.json", text: '{"foo": 1}' },
      { name: "broken.json", text: "{not json" },
    ],
    "instagram"
  );
  assert.equal(m.totalEvents, 2);
  assert.equal(m.followingCount, 2);
  assert.equal(m.searchCount, 2);
  assert.equal(m.platforms.instagram, 2);
});

test("nothing parseable -> null", () => {
  assert.equal(extractMetrics([{ name: "a.json", text: "[]" }], "youtube"), null);
  assert.equal(extractMetrics([], "youtube"), null);
});

test("self-report synthesis", () => {
  const m = metricsFromSelfReport({ hoursPerDay: 5, worstHabits: ["doomscrolling in bed", ""], bedtime: "01:30", wakeTime: "08:00" });
  assert.equal(m.selfReported, true);
  assert.equal(m.estHoursPerDay, 5);
  assert.equal(m.lateNightShare, 0.3);
  assert.deepEqual(m.worstHabits, ["doomscrolling in bed"]);
  assert.match(metricsSummaryText(m), /Self-reported/);
  assert.equal(metricsFromSelfReport({ worstHabits: [] }), null);
});

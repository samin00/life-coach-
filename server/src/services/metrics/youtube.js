// Google Takeout YouTube parsers (best-effort, pure).

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Offset in minutes from an ISO string ("+02:00" / "Z"); null if none. */
export function isoOffsetMin(s) {
  const m = /([+-])(\d{2}):?(\d{2})$/.exec(s);
  if (m) return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  return /z$/i.test(s) ? 0 : null;
}

const isShortUrl = (url, title) => /\/shorts\//i.test(url || "") || /#shorts/i.test(title || "");
const cleanTitle = (t) => String(t || "").replace(/^Watched\s+/i, "").trim();
const isAd = (e) => Array.isArray(e.details) && e.details.some((d) => /ads/i.test(d && d.name));

/** watch-history.json -> events. `tzOffsetMin` applies when the timestamp is UTC ("Z"). */
export function parseWatchHistoryJson(data, tzOffsetMin = 0) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const e of data) {
    if (!e || typeof e.time !== "string" || isAd(e)) continue;
    const ts = Date.parse(e.time);
    if (!Number.isFinite(ts)) continue;
    const own = isoOffsetMin(e.time);
    const sub = Array.isArray(e.subtitles) && e.subtitles[0] ? e.subtitles[0].name : undefined;
    out.push({
      ts,
      offsetMin: own === 0 || own === null ? tzOffsetMin : own,
      platform: "youtube",
      kind: isShortUrl(e.titleUrl, e.title) ? "short" : "long",
      channel: typeof sub === "string" ? sub.trim() : undefined,
      title: cleanTitle(e.title),
    });
  }
  return out;
}

const decode = (s) =>
  String(s)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;| | /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

// "Aug 14, 2026, 11:03:12 PM UTC" (optionally with a narrow no-break space before PM, or a +02:00 zone)
const DATE_RE = /([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?\s*(GMT[+-]\d{1,2}(?::?\d{2})?|[A-Z]{2,5})?/;

export function parseTakeoutDate(text, tzOffsetMin = 0) {
  const m = DATE_RE.exec(text.replace(/&nbsp;| | /g, " "));
  if (!m || MONTHS[m[1].toLowerCase()] === undefined) return null;
  let h = Number(m[4]);
  if (m[7] === "PM" && h < 12) h += 12;
  if (m[7] === "AM" && h === 12) h = 0;
  const wall = Date.UTC(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2]), h, Number(m[5]), Number(m[6] || 0));
  const zone = m[8] || "";
  const gmt = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(zone);
  if (gmt) {
    const off = (gmt[1] === "-" ? -1 : 1) * (Number(gmt[2]) * 60 + Number(gmt[3] || 0));
    return { ts: wall - off * 60000, offsetMin: off };
  }
  if (zone === "UTC" || zone === "GMT") return { ts: wall, offsetMin: tzOffsetMin };
  // Unknown named zone (e.g. "CEST"): treat the printed time as local wall-clock time.
  return { ts: wall, offsetMin: 0 };
}

/** watch-history.html -> events (regex over Takeout's outer-cell markup). */
export function parseWatchHistoryHtml(html, tzOffsetMin = 0) {
  const out = [];
  const cells = String(html).split(/class="[^"]*content-cell[^"]*"/i).slice(1);
  for (const cell of cells) {
    const body = cell.split(/<\/div>/i)[0];
    const links = [...body.matchAll(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
    if (!links.length) continue;
    const d = parseTakeoutDate(decode(body.replace(/<br\s*\/?>/gi, "\n")), tzOffsetMin);
    if (!d) continue;
    const [url, title] = [links[0][1], decode(links[0][2])];
    const channel = links[1] && /channel|@|user/i.test(links[1][1]) ? decode(links[1][2]) : undefined;
    out.push({ ...d, platform: "youtube", kind: isShortUrl(url, title) ? "short" : "long", channel, title });
  }
  return out;
}

/** search-history.json -> number of searches. */
export function countSearches(data) {
  return Array.isArray(data) ? data.filter((e) => e && typeof e.time === "string").length : 0;
}

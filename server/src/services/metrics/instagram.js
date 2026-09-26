// Instagram "Download your information" (JSON) parsers. Best-effort: tolerate unknown shapes.

const tsOf = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n; // seconds -> ms
};

/** Walk any JSON value and collect entries carrying string_list_data / string_map_data. */
function collectEntries(node, out = [], depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return out;
  if (Array.isArray(node)) {
    for (const x of node) collectEntries(x, out, depth + 1);
    return out;
  }
  if (node.string_list_data || node.string_map_data) {
    out.push(node);
    return out;
  }
  for (const v of Object.values(node)) collectEntries(v, out, depth + 1);
  return out;
}

function entryTimes(entry) {
  const times = [];
  if (Array.isArray(entry.string_list_data)) {
    for (const s of entry.string_list_data) {
      const t = s && tsOf(s.timestamp);
      if (t) times.push(t);
    }
  }
  if (entry.string_map_data && typeof entry.string_map_data === "object") {
    for (const v of Object.values(entry.string_map_data)) {
      const t = v && tsOf(v.timestamp);
      if (t) times.push(t);
    }
  }
  return times;
}

function author(entry) {
  const m = entry.string_map_data || {};
  const a = m.Author || m.author || m.Owner;
  if (a && typeof a.value === "string") return a.value;
  if (typeof entry.title === "string" && entry.title) return entry.title;
  return undefined;
}

/** Guess the kind of an Instagram file from its name and top-level keys. */
export function instagramKind(name, data) {
  const keys = data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).join(" ") : "";
  const hay = `${name} ${keys}`.toLowerCase();
  if (/following|followers|relationships/.test(hay)) return "following";
  if (/liked|likes/.test(hay)) return "like";
  if (/saved/.test(hay)) return "save";
  if (/viewed|watched|impressions|seen/.test(hay)) return "impression";
  return null;
}

/** Parse one Instagram JSON file -> { events, followingCount }. */
export function parseInstagramJson(name, data, tzOffsetMin = 0) {
  const kind = instagramKind(name, data);
  const entries = collectEntries(data);
  if (kind === "following") return { events: [], followingCount: entries.length };
  if (!kind || !entries.length) return { events: [], followingCount: 0 };
  const events = [];
  for (const e of entries) {
    for (const ts of entryTimes(e)) events.push({ ts, offsetMin: tzOffsetMin, platform: "instagram", kind, channel: author(e) });
  }
  return { events, followingCount: 0 };
}

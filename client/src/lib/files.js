/* File-upload helpers: accepted types, size formatting, text extraction. */
export const ACCEPT_RE = /\.(json|zip|html?)$/i;
export const RAW_MAX = 200000;
// Per-file text sent for server-side metrics (must match server zod caps).
export const FILE_TEXT_MAX = 1500000;
export const TOTAL_TEXT_MAX = 1800000;

/** Full file text for metrics (capped). Resolves "" on error. */
export function readFileFull(file) {
  return file
    .slice(0, FILE_TEXT_MAX)
    .text()
    .then((t) => t.slice(0, FILE_TEXT_MAX))
    .catch(() => "");
}

export function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function readFileExcerpt(file) {
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

// Build the POST /api/habits body from the DataSource state.
export function buildHabitsBody({ platform, files, manualText, accuracy, selfReport }) {
  const parts = [];
  if (manualText.trim()) parts.push(manualText.trim());
  files.forEach((f) => {
    parts.push(`--- ${f.name} (${f.kind}) ---${f.text ? "\n" + f.text : ""}`);
  });
  let budget = TOTAL_TEXT_MAX;
  const body = {
    sourceType: files.length ? platform : "manual",
    rawContent: parts.join("\n\n").slice(0, RAW_MAX),
    files: files.map(({ name, size, kind, full }) => {
      const f = { name, size, kind };
      if (full && budget > 0) {
        f.text = full.slice(0, Math.min(FILE_TEXT_MAX, budget));
        budget -= f.text.length;
      }
      return f;
    }),
    accuracy,
    tzOffsetMin: -new Date().getTimezoneOffset(),
  };
  if (!files.length && selfReport) {
    const sr = {};
    const h = parseFloat(selfReport.hoursPerDay);
    if (Number.isFinite(h) && h >= 0 && h <= 24) sr.hoursPerDay = h;
    if (selfReport.bedtime) sr.bedtime = selfReport.bedtime;
    if (selfReport.wakeTime) sr.wakeTime = selfReport.wakeTime;
    sr.worstHabits = (selfReport.worstHabits || []).map((w) => w.trim().slice(0, 80)).filter(Boolean).slice(0, 3);
    if (Object.keys(sr).length > 1 || sr.worstHabits.length) body.selfReport = sr;
  }
  return body;
}

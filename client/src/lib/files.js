/* File-upload helpers: accepted types, size formatting, text extraction. */
export const ACCEPT_RE = /\.(json|zip|html?)$/i;
export const RAW_MAX = 200000;

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
export function buildHabitsBody({ platform, files, manualText, accuracy }) {
  const parts = [];
  if (manualText.trim()) parts.push(manualText.trim());
  files.forEach((f) => {
    parts.push(`--- ${f.name} (${f.kind}) ---${f.text ? "\n" + f.text : ""}`);
  });
  return {
    sourceType: files.length ? platform : "manual",
    rawContent: parts.join("\n\n").slice(0, RAW_MAX),
    files: files.map(({ name, size, kind }) => ({ name, size, kind })),
    accuracy,
  };
}

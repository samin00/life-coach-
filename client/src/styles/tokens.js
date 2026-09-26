/* DESIGN TOKENS + shared style objects */
export const C = {
  bg: "#080808",
  surface: "#0e0e0e",
  border: "#1c1c1c",
  accent: "#e8ff00",
  text: "#efefef",
  muted: "#666",
  danger: "#ff3b30",
  dim: "#333",
};
export const FONT = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const GLOBAL_CSS = `
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

export const S = {
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

export const CAT_COLORS = {
  Primary: C.accent,
  Habit: "#00d4ff",
  Learning: "#00d4ff",
  Lifestyle: "#3dff9a",
  Discipline: "#ff8a3d",
  Output: "#c29bff",
};

import React from "react";
import { C, S, CAT_COLORS } from "../styles/tokens.js";

export function Badge({ category }) {
  const col = CAT_COLORS[category] || C.muted;
  return (
    <span
      style={{
        display: "inline-block",
        border: `1px solid ${col}`,
        color: col,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "2px 6px",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {category}
    </span>
  );
}

export function NoteCard({ label = "AUDIT NOTE", children }) {
  return (
    <div style={{ borderLeft: `2px solid ${C.accent}`, background: C.bg, padding: "12px 14px", marginTop: 14 }}>
      <div style={{ ...S.label, color: C.accent, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: C.text }}>{children}</div>
    </div>
  );
}

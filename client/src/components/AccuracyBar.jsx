import React from "react";
import { C, S } from "../styles/tokens.js";

export function AccuracyBar({ label, value, caption }) {
  return (
    <div style={{ ...S.card, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
        <span style={S.label}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 600, color: value ? C.accent : C.muted }} data-testid="accuracy-value">
          {value}%
        </span>
      </div>
      <div style={{ height: 6, background: C.border, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${value}%`, background: C.accent, transition: "width 300ms" }} />
      </div>
      {caption && <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>{caption}</div>}
    </div>
  );
}

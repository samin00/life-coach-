import React from "react";
import { C, S } from "../../styles/tokens.js";
import { Badge, NoteCard } from "../Badge.jsx";

export function Weekly({ plan, weeklyDone, toggleWeekly }) {
  const count = weeklyDone.filter(Boolean).length;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <span style={S.label}>This week</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: count === plan.weekly.length ? C.accent : C.text }} data-testid="weekly-count">
          {count}/{plan.weekly.length} COMPLETE
        </span>
      </div>
      <div style={{ border: `1px solid ${C.border}` }}>
        {plan.weekly.map((w, i) => {
          const on = weeklyDone[i];
          return (
            <div
              key={i}
              role="checkbox"
              aria-checked={on}
              tabIndex={0}
              data-weekly={i}
              onClick={() => toggleWeekly(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleWeekly(i);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                background: C.surface,
                borderTop: i ? `1px solid ${C.border}` : "none",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  border: `1px solid ${on ? C.accent : C.dim}`,
                  background: on ? C.accent : "transparent",
                  color: C.bg,
                  fontSize: 13,
                  lineHeight: "16px",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                {on ? "✓" : ""}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.5, color: on ? C.muted : C.text, textDecoration: on ? "line-through" : "none" }}>{w.label}</span>
              <Badge category={w.category} />
            </div>
          );
        })}
      </div>
      <NoteCard>{plan.weeklyNote}</NoteCard>
    </div>
  );
}

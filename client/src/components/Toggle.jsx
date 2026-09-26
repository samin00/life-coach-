import React from "react";
import { C } from "../styles/tokens.js";

export function Toggle({ options, value, onChange, testId }) {
  return (
    <div style={{ display: "flex", border: `1px solid ${C.border}` }} data-testid={testId}>
      {options.map(([val, label], i) => {
        const on = value === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            aria-pressed={on}
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: "none",
              borderLeft: i ? `1px solid ${C.border}` : "none",
              background: on ? C.accent : "transparent",
              color: on ? C.bg : C.muted,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

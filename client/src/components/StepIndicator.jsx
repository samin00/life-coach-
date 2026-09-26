import React from "react";
import { C } from "../styles/tokens.js";

export const STEP_NAMES = ["source", "analyze", "map", "goals", "output"];
export function StepIndicator({ step }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 36 }} aria-label="Progress">
      {STEP_NAMES.map((name, i) => {
        const on = i <= step - 1;
        const current = i === step - 1;
        return (
          <div key={name} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 3, background: on ? C.accent : C.border }} />
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginTop: 6,
                color: current ? C.accent : on ? C.text : "#444",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

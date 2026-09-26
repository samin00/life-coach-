import React from "react";
import { C } from "../styles/tokens.js";

export function Btn({ children, onClick, disabled, variant = "primary", style, ...rest }) {
  const base = {
    border: "1px solid transparent",
    padding: "13px 22px",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 120ms, color 120ms, border-color 120ms",
  };
  const variants = {
    primary: disabled
      ? { background: C.border, color: "#444" }
      : { background: C.accent, color: C.bg },
    ghost: { background: "transparent", color: disabled ? "#444" : C.text, borderColor: disabled ? C.border : C.dim },
    danger: { background: "transparent", color: C.danger, borderColor: C.danger, padding: 0 },
  };
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}

export function RemoveBtn({ onClick, label }) {
  return (
    <Btn variant="danger" onClick={onClick} aria-label={label} title={label} style={{ width: 28, height: 28, fontSize: 16, lineHeight: "26px", flexShrink: 0, letterSpacing: 0 }}>
      ×
    </Btn>
  );
}

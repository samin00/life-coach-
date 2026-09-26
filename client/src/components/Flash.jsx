import React from "react";
import { C } from "../styles/tokens.js";

export function Flash({ flash }) {
  if (!flash) return null;
  return (
    <div
      key={flash.n}
      role="status"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 50,
        background: C.accent,
        color: C.bg,
        padding: "10px 16px",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        animation: "auditFade 160ms ease",
      }}
    >
      {flash.text}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { C, S } from "../styles/tokens.js";

export function Loader({ messages, compact }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setI((x) => (x + 1) % messages.length), 1400);
    return () => clearInterval(iv);
  }, [messages.length]);
  return (
    <div
      data-testid="loader"
      style={{
        minHeight: compact ? 180 : "55vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
        textAlign: "center",
      }}
    >
      <div style={{ width: compact ? 32 : 46, height: compact ? 32 : 46, border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "auditSpin 0.9s linear infinite" }} />
      <div key={i} style={{ fontSize: 14, color: C.text, animation: "auditFade 300ms ease" }}>
        {messages[i]}
      </div>
      <div style={{ ...S.label, color: "#444" }}>Audit is working</div>
    </div>
  );
}

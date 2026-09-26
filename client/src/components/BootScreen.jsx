import React from "react";
import { C, S } from "../styles/tokens.js";
import { Btn } from "./Btn.jsx";

// Full-screen state while the session is restored from the server, or if that fails.
export function BootScreen({ error, onRetry }) {
  return (
    <div
      data-testid={error ? "boot-error" : "boot-loading"}
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, textAlign: "center", padding: "0 16px" }}
    >
      {error ? (
        <>
          <div style={{ ...S.label, color: C.danger }}>■ Session unavailable</div>
          <div style={{ fontSize: 14, maxWidth: 420, lineHeight: 1.6 }}>{error}</div>
          <Btn onClick={onRetry}>Retry</Btn>
        </>
      ) : (
        <>
          <div style={{ width: 46, height: 46, border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "auditSpin 0.9s linear infinite" }} />
          <div style={{ fontSize: 14 }}>Restoring session...</div>
        </>
      )}
    </div>
  );
}

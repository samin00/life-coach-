import React from "react";
import { C } from "../styles/tokens.js";

// Small red-bordered banner for API errors, dismissible.
export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      data-testid="error-banner"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        border: `1px solid ${C.danger}`,
        background: "rgba(255,59,48,0.06)",
        color: C.danger,
        padding: "10px 12px",
        fontSize: 12,
        letterSpacing: "0.04em",
        lineHeight: 1.5,
        marginBottom: 20,
        animation: "auditFade 160ms ease",
      }}
    >
      <span style={{ fontWeight: 600, flexShrink: 0 }}>■ ERROR</span>
      <span style={{ flex: 1, minWidth: 0, color: C.text }}>{error}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        style={{ background: "transparent", border: "none", color: C.danger, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}

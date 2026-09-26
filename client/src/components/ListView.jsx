import React from "react";
import { C, S } from "../styles/tokens.js";
import { TIERS, TIER_LABEL } from "../lib/layout.js";
import { RemoveBtn } from "./Btn.jsx";
import { AddNodeForm } from "./AddNodeForm.jsx";

export function ListView({ nodes, onWeight, onRemove, onAdd, isMobile }) {
  return (
    <div style={S.card} data-testid="brain-list">
      {TIERS.map((t) => {
        const rows = nodes.filter((n) => n.tier === t);
        return (
          <div key={t} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.dim}`, paddingBottom: 8 }}>
              <span style={{ ...S.label, color: t === "primary" ? C.accent : C.muted }}>{TIER_LABEL[t]}</span>
              <span style={{ ...S.label, color: "#444" }}>{rows.length}</span>
            </div>
            {rows.length === 0 && <div style={{ fontSize: 12, color: "#444", padding: "12px 0" }}>Nothing here.</div>}
            {rows.map((n) => (
              <div
                key={n.id}
                data-row={n.label}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}`, flexWrap: isMobile ? "wrap" : "nowrap" }}
              >
                <div style={{ width: 56, height: 6, background: C.border, flexShrink: 0 }}>
                  <div style={{ width: `${n.weight}%`, height: "100%", background: C.accent }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t === "primary" ? C.text : t === "secondary" ? "#bbb" : "#888" }}>
                  {n.label}
                </div>
                <div style={{ width: 42, textAlign: "right", fontSize: 13, color: C.muted, flexShrink: 0 }}>{n.weight}%</div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={n.weight}
                  aria-label={`Weight of ${n.label}`}
                  onChange={(e) => onWeight(n.id, Number(e.target.value))}
                  style={{ width: isMobile ? "100%" : 140, accentColor: C.accent, order: isMobile ? 5 : 0, flexShrink: 0, margin: 0 }}
                />
                <RemoveBtn label={`Remove ${n.label}`} onClick={() => onRemove(n.id)} />
              </div>
            ))}
          </div>
        );
      })}
      <AddNodeForm onAdd={onAdd} selectFirst isMobile={isMobile} />
    </div>
  );
}

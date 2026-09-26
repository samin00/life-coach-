import React from "react";
import { C, S, CAT_COLORS } from "../../styles/tokens.js";
import { Badge, NoteCard } from "../Badge.jsx";

export function Monthly({ plan, monthly, setMonthlyValue, isMobile }) {
  const avg = Math.round(monthly.reduce((s, v) => s + v, 0) / monthly.length);
  const status = avg < 40 ? ["Behind schedule", C.danger] : avg < 80 ? ["On track", C.accent] : ["Don't coast", "#3dff9a"];
  return (
    <div>
      <div style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={S.label}>Month average</div>
          <div style={{ fontSize: 13, color: status[1], marginTop: 8, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }} data-testid="monthly-status">
            {status[0]}
          </div>
        </div>
        <div style={{ fontSize: isMobile ? 48 : 64, fontWeight: 600, lineHeight: 1, color: status[1], letterSpacing: "-0.03em" }} data-testid="monthly-avg">
          {avg}%
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {plan.monthly.map((m, i) => {
          const v = monthly[i];
          return (
            <div key={i} style={S.card} data-monthly={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginBottom: 8 }}>{m.title}</div>
                  <Badge category={m.category} />
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, color: v >= 100 ? C.accent : C.text, flexShrink: 0, lineHeight: 1 }}>{v}%</div>
              </div>
              <div style={{ position: "relative", height: 8, background: C.border, marginTop: 16 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v}%`, background: CAT_COLORS[m.category] || C.accent }} />
                {[25, 50, 75, 100].map((t) => (
                  <div key={t} style={{ position: "absolute", left: `calc(${t}% - 1px)`, top: -3, bottom: -3, width: 1, background: v >= t ? C.bg : "#3a3a3a" }} />
                ))}
              </div>
              <div style={{ position: "relative", height: 14, marginTop: 4 }}>
                {[25, 50, 75, 100].map((t) => (
                  <span key={t} style={{ position: "absolute", left: `${t}%`, transform: t === 100 ? "translateX(-100%)" : "translateX(-50%)", fontSize: 9, color: v >= t ? C.muted : "#3a3a3a" }}>
                    {t}
                  </span>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={v}
                aria-label={`Progress for ${m.title}`}
                onChange={(e) => setMonthlyValue(i, Number(e.target.value))}
                style={{ width: "100%", accentColor: C.accent, marginTop: 8 }}
              />
            </div>
          );
        })}
      </div>
      <NoteCard>{plan.monthlyNote}</NoteCard>
    </div>
  );
}

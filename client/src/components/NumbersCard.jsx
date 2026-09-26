import React, { useState } from "react";
import { C, S } from "../styles/tokens.js";

const SEV_COLOR = { high: C.danger, medium: "#ffd60a", low: C.muted };
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
export const fmtMin = (m) => {
  if (m == null) return "—";
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h ? `${h}h${String(mm).padStart(2, "0")}m` : `${mm}m`;
};

function HourBars({ byHour }) {
  const max = Math.max(1, ...byHour);
  const W = 240, H = 48, bw = W / 24;
  return (
    <>
    <svg viewBox={`0 0 ${W} ${H + 1}`} width="100%" height={56} preserveAspectRatio="none" role="img" aria-label="Activity by hour of day" data-testid="by-hour-chart" style={{ display: "block" }}>
      <rect x="0" y={H} width={W} height="1" fill={C.dim} />
      {byHour.map((v, h) => {
        const bh = v ? Math.max(1, (v / max) * H) : 0;
        return (
          <rect key={h} x={h * bw + 1} y={H - bh} width={bw - 2} height={bh} fill={h < 5 ? C.danger : C.accent}>
            <title>{`${String(h).padStart(2, "0")}:00 — ${v}`}</title>
          </rect>
        );
      })}
    </svg>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginTop: 4 }}>
      {["00", "06", "12", "18", "23"].map((h) => (
        <span key={h}>{h}</span>
      ))}
    </div>
    </>
  );
}

export function NumbersCard({ metrics, habits = [], target, collapsible = false, testId = "numbers-card" }) {
  const [open, setOpen] = useState(!collapsible);
  if (!metrics && !habits.length) return null;
  const m = metrics || {};
  const s = m.sessions;
  const stats = [
    ["H / active day", (m.estHoursPerActiveDay ?? m.estHoursPerDay) != null ? `${m.estHoursPerActiveDay ?? m.estHoursPerDay}` : "—", "h-day"],
    ["After midnight", pct(m.lateNightShare), "late-night"],
    ["Longest binge", s ? fmtMin(s.longestSessionMinutes) : "—", "longest"],
    ["Active days / streak", m.activeDays != null ? `${m.activeDays} / ${m.streakDays}` : "—", "days"],
    ["Shorts", m.shortsShare != null ? pct(m.shortsShare) : "—", "shorts"],
    ["Target", target != null ? `≤ ${target} h` : "—", "target"],
  ];
  const top = (m.topChannels || []).slice(0, 3);
  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span style={{ ...S.label, color: C.accent }}>■ The numbers{m.selfReported ? " (self-reported)" : ""}</span>
      {collapsible && <span style={{ fontSize: 11, color: C.muted }}>{open ? "hide ▴" : "show ▾"}</span>}
    </div>
  );
  return (
    <div style={{ ...S.card, padding: 16, borderLeft: `2px solid ${C.accent}` }} data-testid={testId}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          data-testid={`${testId}-toggle`}
          style={{ all: "unset", display: "block", width: "100%", cursor: "pointer" }}
        >
          {header}
        </button>
      ) : (
        header
      )}
      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 1, background: C.border, border: `1px solid ${C.border}` }}>
            {stats.map(([label, value, id]) => (
              <div key={id} style={{ background: C.bg, padding: "10px 10px" }}>
                <div style={{ ...S.label, fontSize: 9, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 600 }} data-testid={`metric-${id}`}>
                  {value}
                </div>
              </div>
            ))}
          </div>
          {top.length > 0 && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.6 }} data-testid="metric-top-channels">
              Top: {top.map((c) => `${c.name} (${c.count})`).join(" · ")}
            </div>
          )}
          {Array.isArray(m.byHour) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...S.label, fontSize: 9, marginBottom: 6 }}>Activity by hour (red = 00–05)</div>
              <HourBars byHour={m.byHour} />
            </div>
          )}
          {habits.length > 0 && (
            <div style={{ marginTop: 14 }} data-testid="habits-list">
              {habits.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                  <span
                    data-severity={h.severity}
                    style={{ border: `1px solid ${SEV_COLOR[h.severity]}`, color: SEV_COLOR[h.severity], fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "1px 6px", flexShrink: 0 }}
                  >
                    {h.severity}
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, minWidth: 0 }}>
                    <b style={{ fontWeight: 600 }}>{h.name}</b> <span style={{ color: C.muted }}>— {h.evidence}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

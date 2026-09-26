import React, { useState, useEffect } from "react";
import { C, S } from "../../styles/tokens.js";
import { currentBlockIndex, fmtDuration, pad2 } from "../../lib/time.js";
import { NoteCard } from "../Badge.jsx";

export function Daily({ plan, done, toggleTask, isMobile }) {
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(null);
  useEffect(() => {
    let iv = null;
    const to = setTimeout(() => {
      setNow(new Date());
      iv = setInterval(() => setNow(new Date()), 60000);
    }, 60000 - (Date.now() % 60000));
    return () => {
      clearTimeout(to);
      if (iv) clearInterval(iv);
    };
  }, []);

  const current = currentBlockIndex(now, plan.daily);
  const total = plan.daily.reduce((s, b) => s + b.tasks.length, 0);
  const completed = plan.daily.reduce((s, b, i) => s + b.tasks.filter((_, j) => done[`${i}-${j}`]).length, 0);
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={S.label}>Local time</div>
          <div style={{ fontSize: isMobile ? 36 : 44, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1 }} data-testid="clock">
            {pad2(now.getHours())}:{pad2(now.getMinutes())}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={S.label}>Now</div>
          <div style={{ fontSize: 13, color: C.accent, marginTop: 4 }}>{current >= 0 ? plan.daily[current].title : "—"}</div>
        </div>
      </div>
      <div style={{ ...S.card, padding: 14, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={S.label}>Tasks done</span>
          <span style={{ fontSize: 13 }} data-testid="task-progress">
            {completed}/{total} · {pct}%
          </span>
        </div>
        <div style={{ height: 6, background: C.border }}>
          <div style={{ height: "100%", width: `${pct}%`, background: C.accent, transition: "width 250ms" }} />
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: isMobile ? 56 : 72, top: 8, bottom: 8, width: 1, background: C.border }} />
        {plan.daily.map((b, i) => {
          const isNow = i === current;
          const open = expanded === i && !b.rest;
          const blockDone = b.tasks.filter((_, j) => done[`${i}-${j}`]).length;
          return (
            <div key={i} style={{ display: "flex", gap: isMobile ? 10 : 14, marginBottom: 8, opacity: b.rest && !isNow ? 0.45 : 1 }} data-block={b.title}>
              <div style={{ width: isMobile ? 42 : 54, flexShrink: 0, fontSize: 12, paddingTop: 15, color: isNow ? C.accent : C.muted, textAlign: "right" }}>{b.time}</div>
              <div style={{ width: 9, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 18, position: "relative", zIndex: 1 }}>
                <div style={{ width: 9, height: 9, background: isNow ? C.accent : b.rest ? C.bg : C.dim, border: `1px solid ${isNow ? C.accent : C.dim}` }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                {isNow && (
                  <div
                    aria-hidden="true"
                    style={{ position: "absolute", inset: -5, background: C.accent, opacity: 0.1, filter: "blur(8px)", pointerEvents: "none" }}
                  />
                )}
                <div
                  role={b.rest ? undefined : "button"}
                  tabIndex={b.rest ? undefined : 0}
                  aria-expanded={b.rest ? undefined : open}
                  onClick={b.rest ? undefined : () => setExpanded(open ? null : i)}
                  onKeyDown={
                    b.rest
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpanded(open ? null : i);
                          }
                        }
                  }
                  style={{
                    position: "relative",
                    background: C.surface,
                    border: `1px solid ${isNow ? C.accent : open ? C.dim : C.border}`,
                    outline: isNow ? `1px solid rgba(232,255,0,0.25)` : "none",
                    outlineOffset: 2,
                    padding: "12px 14px",
                    cursor: b.rest ? "default" : "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, letterSpacing: "0.14em", color: isNow ? C.accent : C.muted, marginBottom: 3 }}>
                        {b.tag}
                        {isNow && <span style={{ marginLeft: 10, fontWeight: 600 }}>← NOW</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{b.title}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDuration(b.duration)}</div>
                      {!b.rest && (
                        <div style={{ fontSize: 11, color: blockDone === b.tasks.length ? C.accent : "#444", marginTop: 3 }}>
                          {blockDone}/{b.tasks.length} {open ? "▴" : "▾"}
                        </div>
                      )}
                    </div>
                  </div>
                  {open && (
                    <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12, cursor: "default" }} onClick={(e) => e.stopPropagation()}>
                      {b.tasks.map((t, j) => {
                        const k = `${i}-${j}`;
                        return (
                          <label key={k} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "7px 0", cursor: "pointer", fontSize: 13, lineHeight: 1.5 }}>
                            <input
                              type="checkbox"
                              checked={!!done[k]}
                              onChange={() => toggleTask(k)}
                              style={{ accentColor: C.accent, width: 16, height: 16, margin: "2px 0 0", flexShrink: 0, cursor: "pointer" }}
                            />
                            <span style={{ color: done[k] ? C.muted : C.text, textDecoration: done[k] ? "line-through" : "none" }}>{t}</span>
                          </label>
                        );
                      })}
                      <NoteCard>{b.note}</NoteCard>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React from "react";
import { C, S } from "../styles/tokens.js";
import { Btn } from "../components/Btn.jsx";
import { Loader } from "../components/Loader.jsx";
import { pad2 } from "../lib/time.js";

export default function Goals({ goalMode, onSuggest, onOwn, suggestions, loading, selected, setSelected, customGoal, setCustomGoal, onBack, onBuild, busy, isMobile }) {
  const canBuild = goalMode === "suggest" ? selected !== null && !!suggestions : customGoal.trim().length >= 3;
  const choice = (mode, title, desc, onClick) => {
    const on = goalMode === mode;
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        style={{
          ...S.card,
          textAlign: "left",
          cursor: "pointer",
          color: C.text,
          borderColor: on ? C.accent : C.border,
          background: on ? "rgba(232,255,0,0.04)" : C.surface,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: on ? C.accent : C.text }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{desc}</div>
      </button>
    );
  };
  return (
    <div>
      <h2 style={S.h2}>Pick one goal.</h2>
      <p style={{ ...S.sub, marginBottom: 28 }}>One. Every hour in your plan will be spent against it.</p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        {choice("suggest", "Audit Suggests", "Three goals built from your map and your answer.", onSuggest)}
        {choice("own", "I Know My Goal", "You already know. Write it down.", onOwn)}
      </div>

      {goalMode === "suggest" && (
        <div style={{ marginTop: 20 }}>
          {loading || !suggestions ? (
            <Loader compact messages={["Reading your map...", "Weighing your answer...", "Drafting goals..."]} />
          ) : (
            <div style={{ display: "grid", gap: 10 }} data-testid="goal-suggestions">
              {suggestions.map((g, i) => {
                const on = selected === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-pressed={on}
                    style={{
                      ...S.card,
                      display: "flex",
                      gap: 16,
                      textAlign: "left",
                      cursor: "pointer",
                      color: C.text,
                      borderColor: on ? C.accent : C.border,
                      animation: "auditFade 300ms ease",
                    }}
                  >
                    <span style={{ ...S.label, color: on ? C.accent : "#444", paddingTop: 3 }}>{pad2(i + 1)}</span>
                    <span>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{g.title}</span>
                      <span style={{ display: "block", fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{g.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {goalMode === "own" && (
        <div style={{ marginTop: 20 }}>
          <label style={{ display: "block", ...S.label, marginBottom: 10 }} htmlFor="own-goal">
            Your goal — specific and measurable
          </label>
          <input
            id="own-goal"
            data-testid="own-goal"
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            placeholder="e.g. Run a sub-25 5K by December"
            maxLength={140}
            style={S.input}
          />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, gap: 12 }}>
        <Btn variant="ghost" onClick={onBack} disabled={busy}>
          ← Map
        </Btn>
        <Btn onClick={onBuild} disabled={busy || !canBuild}>
          Build My Plan →
        </Btn>
      </div>
    </div>
  );
}

import React from "react";
import { C, S } from "../styles/tokens.js";
import { Btn } from "../components/Btn.jsx";
import { Loader } from "../components/Loader.jsx";
import { NumbersCard } from "../components/NumbersCard.jsx";

export default function Analysis({ analysis, metrics, answer, setAnswer, onContinue, onSkip, busy }) {
  if (!analysis) {
    return <Loader messages={["Reading your data...", "Extracting patterns...", "Identifying interest clusters..."]} />;
  }
  const interests = analysis.interests || [];
  const primary = interests.filter((n) => n.tier === "primary").map((n) => n.label);
  return (
    <div style={{ animation: "auditFade 300ms ease" }}>
      <h2 style={S.h2}>Pattern found.</h2>
      <p style={{ ...S.sub, marginBottom: 28 }}>
        {interests.length} interest clusters detected. Before the map, one question.
      </p>
      <div style={{ marginBottom: 12 }}>
        <NumbersCard metrics={metrics} habits={analysis.habits || []} target={analysis.screenTimeTargetHoursPerDay} />
      </div>
      <div style={{ ...S.card, borderColor: C.accent, padding: 24 }} data-testid="audit-question">
        <div style={{ ...S.label, color: C.accent, marginBottom: 14 }}>■ Audit detected</div>
        <div style={{ fontSize: 18, lineHeight: 1.5, fontWeight: 500 }}>{analysis.uncomfortableQuestion}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 16 }}>Signal: {primary.join(" · ")}</div>
      </div>
      <label style={{ display: "block", ...S.label, margin: "24px 0 10px" }} htmlFor="audit-answer">
        Be honest. This affects your plan.
      </label>
      <textarea
        id="audit-answer"
        data-testid="answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Be honest. This affects your plan."
        rows={5}
        style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
        <Btn variant="ghost" onClick={onSkip} disabled={busy}>
          Skip
        </Btn>
        <Btn onClick={onContinue} disabled={busy || !answer.trim()}>
          Continue →
        </Btn>
      </div>
    </div>
  );
}

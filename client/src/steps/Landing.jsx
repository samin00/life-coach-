import React from "react";
import { C, S } from "../styles/tokens.js";
import { Btn } from "../components/Btn.jsx";

export default function Landing({ onStart, isMobile }) {
  const features = [
    ["01", "Discover", "Upload your YouTube or Instagram export.", "We map where your attention actually goes."],
    ["02", "Define", "Confront the pattern. Answer one hard question.", "Pick a goal worth the hours."],
    ["03", "Execute", "Get a daily, weekly and monthly plan.", "Then do the work. No one else will."],
  ];
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: isMobile ? "48px 0" : "64px 0" }}>
      <div style={{ ...S.label, color: C.accent, marginBottom: 24 }}>
        Audit<span style={{ animation: "auditBlink 1s step-end infinite" }}>_</span> / life audit
      </div>
      <h1 style={{ fontSize: isMobile ? 34 : 56, lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
        Your data tells the truth. We read it.
      </h1>
      <p style={{ ...S.sub, fontSize: isMobile ? 14 : 16, maxWidth: 560, marginBottom: 44 }}>
        Audit reads what you actually consume — not what you claim you're into — and turns it into a plan you can execute. No flattery. No filler.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 10 : 0, marginBottom: 44 }}>
        {features.map(([num, title, l1, l2], i) => (
          <div key={title} style={{ ...S.card, borderLeft: !isMobile && i ? "none" : `1px solid ${C.border}`, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ ...S.label, color: C.accent }}>{num}</span>
              <span style={{ color: i < 2 ? C.muted : C.accent, fontSize: 14 }}>{i < 2 ? "→" : "■"}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              {l1}
              <br />
              {l2}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <Btn onClick={onStart} style={{ padding: "16px 30px", fontSize: 14 }}>
          Start Audit →
        </Btn>
        <span style={{ fontSize: 12, color: "#444" }}>~3 minutes. No account. Progress is saved.</span>
      </div>
    </div>
  );
}

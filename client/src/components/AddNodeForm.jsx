import React, { useState } from "react";
import { S } from "../styles/tokens.js";
import { TIERS, TIER_LABEL } from "../lib/layout.js";
import { Btn } from "./Btn.jsx";

export function AddNodeForm({ onAdd, selectFirst, isMobile }) {
  const [label, setLabel] = useState("");
  const [tier, setTier] = useState("secondary");
  const submit = () => {
    if (!label.trim()) return;
    onAdd(label.trim(), tier);
    setLabel("");
  };
  const input = (
    <input
      key="in"
      data-testid="add-node-input"
      value={label}
      onChange={(e) => setLabel(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && submit()}
      placeholder="Add an interest"
      maxLength={40}
      style={{ ...S.input, flex: "1 1 180px", width: "auto", minWidth: 0 }}
    />
  );
  const select = (
    <select
      key="sel"
      data-testid="add-node-tier"
      value={tier}
      onChange={(e) => setTier(e.target.value)}
      style={{ ...S.input, width: isMobile ? "auto" : 150, flex: isMobile ? "1 1 120px" : "0 0 150px", cursor: "pointer" }}
    >
      {TIERS.map((t) => (
        <option key={t} value={t}>
          {TIER_LABEL[t]}
        </option>
      ))}
    </select>
  );
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      {selectFirst ? [select, input] : [input, select]}
      <Btn onClick={submit} disabled={!label.trim()} style={{ padding: "12px 20px" }} data-testid="add-node-btn">
        Add
      </Btn>
    </div>
  );
}

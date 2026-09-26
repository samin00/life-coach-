import React, { useState, useEffect } from "react";
import { C, S } from "../styles/tokens.js";
import { Btn } from "../components/Btn.jsx";
import { Toggle } from "../components/Toggle.jsx";
import { Flash } from "../components/Flash.jsx";
import { AccuracyBar } from "../components/AccuracyBar.jsx";
import { BrainGraph as Graph } from "../components/BrainGraph.jsx";
import { ListView } from "../components/ListView.jsx";
import { AddNodeForm } from "../components/AddNodeForm.jsx";
import { placeNewNode } from "../lib/layout.js";

export default function BrainMap({ nodes, setNodes, insight, onNext, busy, isMobile }) {
  const [view, setView] = useState("graph");
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(t);
  }, [flash]);
  const notify = (text) => setFlash({ text, n: Date.now() + Math.random() });

  function addNode(label, tier) {
    if (nodes.some((n) => n.label.toLowerCase() === label.toLowerCase())) {
      notify("Already mapped");
      return;
    }
    setNodes((ns) => [...ns, placeNewNode(ns, label, tier)], 0);
    notify("Added");
  }
  function removeNode(id) {
    setNodes((ns) => {
      const rest = ns.filter((n) => n.id !== id);
      const alt = rest.find((n) => n.tier === "primary");
      return rest.map((n) => (n.parentId === id ? { ...n, parentId: n.tier === "secondary" && alt ? alt.id : null } : n));
    }, 0);
    notify("Removed");
  }
  const moveNode = (id, x, y) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, x, y } : n)));
  const setWeight = (id, weight) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, weight } : n)), 400);

  const quality = Math.min(95, 30 + nodes.length * 7);
  return (
    <div>
      <Flash flash={flash} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-end", gap: 16, marginBottom: 20, flexDirection: isMobile ? "column" : "row" }}>
        <div>
          <h2 style={S.h2}>Your brain map.</h2>
          <p style={S.sub}>This is where your attention goes. Correct it if it's wrong — not if it's uncomfortable.</p>
        </div>
        <div style={{ width: isMobile ? "100%" : 200, flexShrink: 0 }}>
          <Toggle testId="view-toggle" value={view} onChange={setView} options={[["graph", "Graph"], ["list", "List"]]} />
        </div>
      </div>

      {view === "graph" ? (
        <div>
          <Graph nodes={nodes} onMove={moveNode} onRemove={removeNode} isMobile={isMobile} />
          {isMobile && <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>Drag to arrange · tap a node, then × to remove</div>}
          <AddNodeForm onAdd={addNode} isMobile={isMobile} />
        </div>
      ) : (
        <ListView nodes={nodes} onWeight={setWeight} onRemove={removeNode} onAdd={addNode} isMobile={isMobile} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 20 }}>
        <AccuracyBar label="Map quality" value={quality} caption={`${nodes.length} node${nodes.length === 1 ? "" : "s"} mapped.`} />
        <div style={{ ...S.card, padding: 16, borderLeft: `2px solid ${C.accent}` }}>
          <div style={{ ...S.label, color: C.accent, marginBottom: 8 }}>Audit insight</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{insight}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
        <Btn onClick={onNext} disabled={busy || nodes.length === 0}>
          Set Goals →
        </Btn>
      </div>
    </div>
  );
}

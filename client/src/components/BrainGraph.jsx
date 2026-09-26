import React, { useState, useRef } from "react";
import { C, FONT } from "../styles/tokens.js";
import { W, H, CX, CY, TIERS, clampX, clampY, nodeRadius } from "../lib/layout.js";

export function BrainGraph({ nodes, onMove, onRemove, isMobile }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [dragging, setDragging] = useState(null);
  const fs = isMobile ? 19 : 12;
  const maxChars = isMobile ? 12 : 20;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  function toSvg(clientX, clientY) {
    const svg = svgRef.current;
    const ctm = svg && svg.getScreenCTM();
    if (!ctm) {
      const rect = svg.getBoundingClientRect();
      return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
    }
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  function startDrag(id, clientX, clientY) {
    const n = byId[id];
    if (!n) return;
    const p = toSvg(clientX, clientY);
    dragRef.current = { id, dx: n.x - p.x, dy: n.y - p.y };
    setDragging(id);
  }
  function moveDrag(clientX, clientY) {
    const d = dragRef.current;
    if (!d) return;
    const p = toSvg(clientX, clientY);
    onMove(d.id, clampX(p.x + d.dx), clampY(p.y + d.dy));
  }
  function endDrag() {
    dragRef.current = null;
    setDragging(null);
  }

  const trunc = (s) => (s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s);
  const ordered = [...nodes].sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier));

  return (
    <svg
      ref={svgRef}
      data-testid="brain-graph"
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", background: C.surface, border: `1px solid ${C.border}`, userSelect: "none", WebkitUserSelect: "none", touchAction: "none" }}
      onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
      onMouseUp={endDrag}
      onMouseLeave={() => {
        endDrag();
        setHover(null);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) moveDrag(t.clientX, t.clientY);
      }}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
    >
      <defs>
        <radialGradient id="auditGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.2" />
          <stop offset="55%" stopColor={C.accent} stopOpacity="0.05" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={230} fill="url(#auditGlow)" />
      <ellipse cx={CX} cy={CY} rx={135} ry={120} fill="none" stroke="#161616" />
      <ellipse cx={CX} cy={CY} rx={330} ry={205} fill="none" stroke="#131313" strokeDasharray="2 6" />

      {nodes.map((n) => {
        if (n.tier === "primary") {
          return <line key={"l" + n.id} x1={CX} y1={CY} x2={n.x} y2={n.y} stroke={C.accent} strokeOpacity={0.4} strokeDasharray="4 6" strokeWidth={1.2} />;
        }
        const p = n.parentId && byId[n.parentId] ? byId[n.parentId] : { x: CX, y: CY };
        return <line key={"l" + n.id} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke={n.tier === "secondary" ? "#333" : "#262626"} strokeWidth={1} />;
      })}

      <circle cx={CX} cy={CY} r={9} fill={C.bg} stroke={C.accent} strokeWidth={2} />
      <circle cx={CX} cy={CY} r={3} fill={C.accent} />
      <text x={CX} y={CY + 26} textAnchor="middle" fill={C.muted} fontSize={isMobile ? 16 : 10} letterSpacing="0.15em" fontFamily={FONT}>
        YOU
      </text>

      {ordered.map((n) => {
        const r = nodeRadius(n);
        const isHover = hover === n.id;
        const fill = n.tier === "primary" ? C.accent : n.tier === "secondary" ? "#1c1c1c" : "#111";
        const stroke = n.tier === "primary" ? C.accent : n.tier === "secondary" ? (isHover ? "#666" : "#333") : isHover ? "#555" : "#2a2a2a";
        const labelColor = n.tier === "primary" ? C.text : n.tier === "secondary" ? "#999" : C.muted;
        const bx = n.x + r * 0.72 + 7;
        const by = n.y - r * 0.72 - 7;
        return (
          <g
            key={n.id}
            data-node={n.label}
            style={{ cursor: dragging === n.id ? "grabbing" : "grab", touchAction: "none" }}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
            onMouseDown={(e) => {
              e.preventDefault();
              startDrag(n.id, e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              const t = e.touches[0];
              setHover(n.id);
              if (t) startDrag(n.id, t.clientX, t.clientY);
            }}
          >
            <circle cx={n.x} cy={n.y} r={Math.max(r, 20)} fill="transparent" />
            <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke={stroke} strokeWidth={1.2} opacity={n.tier === "emerging" ? 0.85 : 1} />
            {n.tier === "primary" && (
              <text x={n.x} y={n.y + 4} textAnchor="middle" fill={C.bg} fontSize={isMobile ? 16 : 11} fontWeight={600} fontFamily={FONT} pointerEvents="none">
                {n.weight}
              </text>
            )}
            <text
              x={n.x}
              y={n.y + r + fs + 3}
              textAnchor="middle"
              fill={labelColor}
              fontSize={n.tier === "emerging" ? fs - 1 : fs}
              fontWeight={n.tier === "primary" ? 600 : 400}
              fontFamily={FONT}
              pointerEvents="none"
            >
              {trunc(n.label)}
            </text>
            {isHover && !dragging && (
              <g
                role="button"
                aria-label={`Remove ${n.label}`}
                style={{ cursor: "pointer" }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setHover(null);
                  onRemove(n.id);
                }}
              >
                <circle cx={bx} cy={by} r={isMobile ? 16 : 10} fill={C.danger} />
                <text x={bx} y={by + (isMobile ? 7 : 4.5)} textAnchor="middle" fill="#fff" fontSize={isMobile ? 22 : 14} fontWeight={600} fontFamily={FONT} pointerEvents="none">
                  ×
                </text>
              </g>
            )}
          </g>
        );
      })}

      <g pointerEvents="none">
        {[
          ["primary", "Primary"],
          ["secondary", "Secondary"],
          ["emerging", "Emerging"],
        ].map(([t, label], i) => {
          const lfs = isMobile ? 16 : 10;
          const y = H - (isMobile ? 80 : 58) + i * (isMobile ? 24 : 16);
          const fill = t === "primary" ? C.accent : t === "secondary" ? "#1c1c1c" : "#111";
          const stroke = t === "primary" ? C.accent : t === "secondary" ? "#333" : "#2a2a2a";
          return (
            <g key={t}>
              <circle cx={24} cy={y - lfs * 0.35} r={isMobile ? 7 : 5} fill={fill} stroke={stroke} />
              <text x={38} y={y} fill={C.muted} fontSize={lfs} letterSpacing="0.1em" fontFamily={FONT}>
                {label.toUpperCase()}
              </text>
            </g>
          );
        })}
      </g>
      {!isMobile && (
        <text x={W - 16} y={H - 14} textAnchor="end" fill="#3a3a3a" fontSize={10} fontFamily={FONT} pointerEvents="none">
          DRAG TO ARRANGE · HOVER TO REMOVE
        </text>
      )}
    </svg>
  );
}

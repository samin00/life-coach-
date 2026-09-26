/* Brain map geometry: node layout is computed client-side; x/y are never persisted. */
export const W = 820;
export const H = 520;
export const CX = W / 2;
export const CY = H / 2;
export const TIERS = ["primary", "secondary", "emerging"];
export const TIER_LABEL = { primary: "Primary", secondary: "Secondary", emerging: "Emerging" };

let idCounter = 0;
export const newId = () => `n${Date.now().toString(36)}${(idCounter++).toString(36)}`;
export const clampX = (x) => Math.max(40, Math.min(W - 40, x));
export const clampY = (y) => Math.max(30, Math.min(H - 45, y));
export function polar(cx, cy, rx, deg, ry = rx) {
  const a = (deg * Math.PI) / 180;
  return { x: clampX(cx + rx * Math.cos(a)), y: clampY(cy + ry * Math.sin(a)) };
}
export const angleFromCenter = (n) => (Math.atan2(n.y - CY, n.x - CX) * 180) / Math.PI;

// Lay out server interest nodes ({id,label,tier,weight,parentId}) on the canvas.
// Same geometry as the original buildNodes: primaries on the inner ellipse,
// secondaries fanned around their parent, emerging on the outer dashed ring.
export function layoutNodes(interests) {
  const list = Array.isArray(interests) ? interests : [];
  const out = [];
  const prim = list.filter((n) => n.tier === "primary");
  const np = prim.length;
  // Two primaries sit left/right to use the wide canvas; otherwise start at 12 o'clock.
  const start = np === 2 ? 180 : -90;
  const placed = {};
  prim.forEach((n, i) => {
    const deg = start + (i * 360) / Math.max(np, 1);
    const p = polar(CX, CY, 135, deg, 120);
    placed[n.id] = { ...n, x: p.x, y: p.y, deg };
  });
  prim.forEach((n) => {
    const { deg, ...rest } = placed[n.id];
    out.push(rest);
  });

  const secs = list.filter((n) => n.tier === "secondary");
  const groups = {};
  const orphans = [];
  secs.forEach((n) => {
    let pid = n.parentId && placed[n.parentId] ? n.parentId : null;
    if (pid) (groups[pid] = groups[pid] || []).push(n);
    else orphans.push(n);
  });
  Object.keys(groups).forEach((pid) => {
    const parent = placed[pid];
    const kids = groups[pid];
    kids.forEach((n, k) => {
      const deg = parent.deg + (k - (kids.length - 1) / 2) * 60;
      const p = polar(parent.x, parent.y, 110, deg);
      out.push({ ...n, x: p.x, y: p.y });
    });
  });
  orphans.forEach((n, i) => {
    const p = polar(CX, CY, 200, -90 + i * 90 + (np ? 45 : 0), 170);
    out.push({ ...n, x: p.x, y: p.y });
  });

  const em = list.filter((n) => n.tier === "emerging");
  em.forEach((n, i) => {
    const slots = Math.max(np, em.length, 1);
    const deg = start + ((i + 0.5) * 360) / slots;
    const p = polar(CX, CY, 330, deg, 205);
    out.push({ ...n, x: p.x, y: p.y });
  });
  return out;
}

// Strip client-only layout fields before persisting.
export const toServerNodes = (nodes) =>
  nodes.map(({ id, label, tier, weight, parentId }) => ({ id, label, tier, weight, parentId: parentId || null }));

export function placeNewNode(nodes, label, tier) {
  const count = nodes.filter((n) => n.tier === tier).length;
  const golden = count * 137.5;
  if (tier === "primary") {
    const p = polar(CX, CY, 135, -90 + golden + 25, 120);
    return { id: newId(), label, tier, weight: 70, parentId: null, x: p.x, y: p.y };
  }
  if (tier === "secondary") {
    const primaries = nodes.filter((n) => n.tier === "primary");
    if (!primaries.length) {
      const p = polar(CX, CY, 210, -90 + golden, 175);
      return { id: newId(), label, tier, weight: 50, parentId: null, x: p.x, y: p.y };
    }
    const kids = (id) => nodes.filter((n) => n.parentId === id).length;
    const parent = primaries.reduce((a, b) => (kids(b) < kids(a) ? b : a));
    const k = kids(parent.id);
    const deg = angleFromCenter(parent) + (((k * 47) % 140) - 70);
    const p = polar(parent.x, parent.y, 100, deg);
    return { id: newId(), label, tier, weight: 50, parentId: parent.id, x: p.x, y: p.y };
  }
  const p = polar(CX, CY, 330, -45 + golden, 205);
  return { id: newId(), label, tier: "emerging", weight: 25, parentId: null, x: p.x, y: p.y };
}

export function nodeRadius(n) {
  if (n.tier === "primary") return 24 + n.weight * 0.14;
  if (n.tier === "secondary") return 13 + n.weight * 0.1;
  return 7 + n.weight * 0.06;
}

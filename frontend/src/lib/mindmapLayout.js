// Mind-map layout engine — pure functions, no dependencies.
//
// layoutMap(map) -> {
//   width, height,                      // canvas bbox in px
//   nodes: [{id, label, note, color, tier, x, y, w, h, lines, parent}],
//   links: [{from, to, x1, y1, x2, y2, cx1, cy1, cx2, cy2, dashed, label}],
//   rings: [{tier, r, color}],          // radial maps only
// }
// Node (x, y) is the TOP-LEFT corner. Links are cubic beziers.
// Hierarchy links: parent -> child (dashed=false). Cross-relations: dashed=true.
// Deterministic: no Date/random/canvas measuring — same input, same output,
// which is what makes the server-side PDF render match the screen.

export const TIER_COLORS = ['#bc5c38', '#6f8f66', '#4a7f9e', '#8b5e83', '#c25c6e']

const CHAR_W = 7.0        // px per char at 13px font (approximation)
const LINE_H = 18         // px per wrapped line
const PAD_X = 16
const PAD_Y = 10
const MAX_LINES = 3
const WRAP_AT = 18        // chars per line before wrapping
const H_GAP = 70          // horizontal column gap
const V_GAP = 14          // vertical gap between siblings
const RING_PAD = 56       // radial: breathing room around each ring

export function tierColor(tier, override) {
  return override || TIER_COLORS[((tier % TIER_COLORS.length) + TIER_COLORS.length) % TIER_COLORS.length]
}

export function wrapLabel(label) {
  const words = String(label || '').split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (!cur) { cur = w }
    else if ((cur + ' ' + w).length <= WRAP_AT) { cur += ' ' + w }
    else { lines.push(cur); cur = w }
    if (lines.length === MAX_LINES) break
  }
  if (cur && lines.length < MAX_LINES) lines.push(cur)
  const used = lines.join(' ').length
  const total = String(label || '').length
  if (lines.length && used < total) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, WRAP_AT - 1) + '…'
  }
  return lines.length ? lines : ['']
}

function nodeBox(node, tier) {
  const lines = wrapLabel(node.label)
  const textW = Math.max(...lines.map((l) => l.length), 1) * CHAR_W
  const w = Math.max(96, textW + PAD_X * 2)
  const h = Math.max(38, lines.length * LINE_H + PAD_Y * 2)
  return {
    id: node.id,
    label: node.label,
    note: node.note || '',
    color: tierColor(tier, node.color),
    tier,
    parent: node.parent,
    lines,
    w,
    h,
  }
}

function childrenOf(map) {
  const kids = new Map()
  for (const n of map.nodes || []) {
    if (n.parent) {
      if (!kids.has(n.parent)) kids.set(n.parent, [])
      kids.get(n.parent).push(n)
    }
  }
  return kids
}

function depthOf(parents, id) {
  let d = 0
  let cur = id
  const seen = new Set()
  while (parents[cur] != null && !seen.has(cur)) {
    seen.add(cur)
    cur = parents[cur]
    d++
  }
  return d
}

function bezier(x1, y1, x2, y2, dashed, from, to, label) {
  const dx = x2 - x1
  const dy = y2 - y1
  return {
    from,
    to,
    x1, y1, x2, y2,
    cx1: x1 + dx * 0.35 - dy * 0.12,
    cy1: y1 + dy * 0.35 + dx * 0.12,
    cx2: x2 - dx * 0.35 - dy * 0.12,
    cy2: y2 - dy * 0.35 + dx * 0.12,
    dashed: !!dashed,
    label: label || '',
  }
}

// ---------- classic mind map (root centered, branches left/right) ----------

function layoutMindmap(map) {
  const kids = childrenOf(map)
  const root = (map.nodes || []).find((n) => !n.parent)
  if (!root) return emptyLayout(map)

  const parents = {}
  for (const n of map.nodes || []) parents[n.id] = n.parent

  const boxes = new Map()
  for (const n of map.nodes || []) {
    boxes.set(n.id, nodeBox(n, depthOf(parents, n.id)))
  }

  const rootKids = kids.get(root.id) || []
  const split = Math.ceil(rootKids.length / 2)
  const sides = {
    right: rootKids.slice(split), // first half left (reading order)
    left: rootKids.slice(0, split),
  }

  const placed = new Map() // id -> {x, y}
  const colMax = { left: {}, right: {} }

  // measure: count leaves for vertical slotting
  function leaves(id) {
    const ch = kids.get(id) || []
    if (!ch.length) return 1
    return ch.reduce((s, c) => s + leaves(c.id), 0)
  }

  function placeSide(sideRoots, sign) {
    // column widths per depth on this side
    const widths = {}
    const walkW = (id, d) => {
      widths[d] = Math.max(widths[d] || 0, boxes.get(id).w)
      for (const c of kids.get(id) || []) walkW(c.id, d + 1)
    }
    for (const r of sideRoots) walkW(r.id, 1)
    // x positions per depth
    const xs = {}
    let acc = 0
    for (let d = 1; d <= Math.max(...Object.keys(widths).map(Number), 0); d++) {
      acc += (widths[d - 1] || 0) + H_GAP
      xs[d] = acc
    }

    let cursor = 0 // vertical slot cursor
    const place = (id, d) => {
      const b = boxes.get(id)
      const ch = kids.get(id) || []
      let y
      if (!ch.length) {
        y = cursor
        cursor += b.h + V_GAP
      } else {
        const ys = ch.map((c) => place(c.id, d + 1))
        y = (ys[0] + ys[ys.length - 1]) / 2
      }
      placed.set(id, { x: xs[d], y })
      return y
    }
    for (const r of sideRoots) {
      place(r.id, 1)
      cursor += V_GAP * 2 // extra space between top-level branches
    }
    return widths
  }

  placeSide(sides.left, -1)
  const leftHeights = 0
  placeSide(sides.right, 1)

  // compute bbox for both sides; left side is mirrored around root
  const rootBox = boxes.get(root.id)
  const outNodes = []
  const outLinks = []

  // Both sides grow outward from the root box, mirrored:
  // right: x = root.w + gap + outward;  left: x = -(gap + outward + w)
  for (const [id, p] of placed) {
    const b = boxes.get(id)
    const onLeft = chainOnSide(id, sides.left)
    const x = onLeft ? -(H_GAP + p.x + b.w) : rootBox.w + H_GAP + p.x
    outNodes.push({ ...b, x, y: p.y })
  }

  function chainOnSide(id, sideRoots) {
    let cur = id
    const sideIds = new Set(sideRoots.map((s) => s.id))
    while (parents[cur] != null) {
      if (sideIds.has(cur)) return true
      cur = parents[cur]
    }
    return false
  }

  // root vertically centered against the whole tree
  let treeMinY = Infinity
  let treeMaxY = -Infinity
  for (const [id, p] of placed) {
    treeMinY = Math.min(treeMinY, p.y)
    treeMaxY = Math.max(treeMaxY, p.y + boxes.get(id).h)
  }
  const rootY = (treeMinY + treeMaxY) / 2 - rootBox.h / 2
  outNodes.push({ ...rootBox, x: 0, y: rootY })

  // links
  const posOf = new Map(outNodes.map((n) => [n.id, n]))
  for (const n of map.nodes || []) {
    if (!n.parent || !posOf.has(n.id) || !posOf.has(n.parent)) continue
    const c = posOf.get(n.id)
    const p = posOf.get(n.parent)
    const sign = c.x >= p.x ? 1 : -1
    const x1 = p.x + (sign > 0 ? p.w : 0)
    const y1 = p.y + p.h / 2
    const x2 = c.x + (sign > 0 ? 0 : c.w)
    const y2 = c.y + c.h / 2
    outLinks.push(bezier(x1, y1, x2, y2, false, n.parent, n.id))
  }
  for (const l of map.links || []) {
    const a = posOf.get(l.from)
    const b = posOf.get(l.to)
    if (!a || !b) continue
    outLinks.push(bezier(
      a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2,
      true, l.from, l.to, l.label,
    ))
  }

  return normalize(outNodes, outLinks, [])
}

function emptyLayout(map) {
  return { width: 400, height: 300, nodes: [], links: [], rings: [] }
}

// ---------- hierarchical radial ("onion") ----------

function layoutRadial(map) {
  const kids = childrenOf(map)
  const root = (map.nodes || []).find((n) => !n.parent)
  if (!root) return emptyLayout(map)

  const parents = {}
  for (const n of map.nodes || []) parents[n.id] = n.parent

  const boxes = new Map()
  for (const n of map.nodes || []) {
    boxes.set(n.id, nodeBox(n, depthOf(parents, n.id)))
  }

  function leafWeight(id) {
    const ch = kids.get(id) || []
    if (!ch.length) return 1
    return ch.reduce((s, c) => s + leafWeight(c.id), 0)
  }

  // tier -> total width of its nodes (for ring sizing)
  const tierWidths = new Map()
  const tierHeights = new Map()
  for (const [id, b] of boxes) {
    const t = b.tier
    tierWidths.set(t, (tierWidths.get(t) || 0) + b.w)
    tierHeights.set(t, Math.max(tierHeights.get(t) || 0, b.h))
  }

  // angular sectors: each node spans its children proportionally to leaf weight
  const span = new Map() // id -> [a0, a1]
  span.set(root.id, [-Math.PI / 2, -Math.PI / 2 + 2 * Math.PI])
  const order = []
  const queue = [root.id]
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    const [a0, a1] = span.get(id)
    const ch = kids.get(id) || []
    const total = ch.reduce((s, c) => s + leafWeight(c.id), 0) || 1
    let a = a0
    for (const c of ch) {
      const w = ((a1 - a0) * leafWeight(c.id)) / total
      span.set(c.id, [a, a + w])
      a += w
      queue.push(c.id)
    }
  }
  const midAngle = (id) => {
    const s = span.get(id) || [0, 0]
    return (s[0] + s[1]) / 2
  }
  // extent of an axis-aligned box along the radial direction at its angle
  const radialExtent = (id) => {
    const b = boxes.get(id)
    const m = midAngle(id)
    return (Math.abs(Math.cos(m)) * b.w + Math.abs(Math.sin(m)) * b.h) / 2
  }

  // ring radii: grow enough that same-angle parent/child boxes never collide
  // AND each tier's boxes fit around the circumference
  const maxTier = Math.max(...[...boxes.values()].map((b) => b.tier), 0)
  const rootBox = boxes.get(root.id)
  const radii = { 0: 0 }
  let prev = radialExtent(root.id) + RING_PAD * 0.4
  for (let t = 1; t <= maxTier; t++) {
    // worst radial gap needed along any edge entering this tier
    let edgeNeed = 0
    for (const n of map.nodes || []) {
      const b = boxes.get(n.id)
      if (b.tier !== t || !n.parent) continue
      edgeNeed = Math.max(edgeNeed, radialExtent(n.parent) + radialExtent(n.id))
    }
    const circumferenceNeed = (tierWidths.get(t) || 0) / (2 * Math.PI * 0.55)
    const r = Math.max(prev + edgeNeed + RING_PAD * 0.55, circumferenceNeed)
    radii[t] = r
    prev = r
  }

  const outNodes = []
  for (const [id, b] of boxes) {
    const m = midAngle(id)
    const r = radii[b.tier] || 0
    const cx = Math.cos(m) * r
    const cy = Math.sin(m) * r
    outNodes.push({ ...b, x: cx - b.w / 2, y: cy - b.h / 2, cx, cy })
  }

  const posOf = new Map(outNodes.map((n) => [n.id, n]))
  const outLinks = []
  for (const n of map.nodes || []) {
    if (!n.parent || !posOf.has(n.id) || !posOf.has(n.parent)) continue
    const c = posOf.get(n.id)
    const p = posOf.get(n.parent)
    outLinks.push(bezier(
      p.x + p.w / 2, p.y + p.h / 2, c.x + c.w / 2, c.y + c.h / 2,
      false, n.parent, n.id,
    ))
  }
  for (const l of map.links || []) {
    const a = posOf.get(l.from)
    const b = posOf.get(l.to)
    if (!a || !b) continue
    outLinks.push(bezier(
      a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2,
      true, l.from, l.to, l.label,
    ))
  }

  // rings around the root center
  const rings = []
  for (let t = 1; t <= maxTier; t++) {
    rings.push({ tier: t, r: radii[t], color: tierColor(t) })
  }

  return normalize(outNodes, outLinks, rings)
}

// shift everything into positive space + padding; attach rings to root center
function normalize(nodes, links, rings) {
  const PAD = 60
  if (!nodes.length) return emptyLayout()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.y + n.h)
  }
  for (const l of links) {
    minX = Math.min(minX, l.x1, l.x2)
    minY = Math.min(minY, l.y1, l.y2)
    maxX = Math.max(maxX, l.x1, l.x2)
    maxY = Math.max(maxY, l.y1, l.y2)
  }
  const dx = PAD - minX
  const dy = PAD - minY
  for (const n of nodes) {
    n.x += dx
    n.y += dy
    if (n.cx != null) n.cx += dx
    if (n.cy != null) n.cy += dy
  }
  for (const l of links) {
    l.x1 += dx; l.y1 += dy; l.x2 += dx; l.y2 += dy
    l.cx1 += dx; l.cy1 += dy; l.cx2 += dx; l.cy2 += dy
  }
  const width = Math.ceil(maxX + dx + PAD)
  const height = Math.ceil(maxY + dy + PAD)
  return { width, height, nodes, links, rings }
}

export function layoutMap(map) {
  if (!map || !Array.isArray(map.nodes) || map.nodes.length === 0) {
    return emptyLayout(map)
  }
  return map.kind === 'radial' ? layoutRadial(map) : layoutMindmap(map)
}

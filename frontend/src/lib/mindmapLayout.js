// Mindly-style layout engine — pure functions, no dependencies.
//
// layoutMap(map) -> {
//   width, height,
//   nodes: [{id, label, note, color, text_color, tier, x, y, w, h, r, shape, lines, parent}],
//   links: [{from, to, x1, y1, x2, y2, cx1, cy1, cx2, cy2, dashed, label}],
//   rings: [],  // Mindly style carries no rings; kept for payload compatibility
// }
// Node (x, y) is the TOP-LEFT corner of the node's bounding box; for
// 'circle' nodes w === h === 2r and (x + r, y + r) is the center.
// Hierarchy links: parent -> child (dashed=false). Cross-relations: dashed=true.
// Deterministic: no Date/random/canvas — same input, same output, so the
// server-side PDF matches the screen.

// Back-compat alias: the classic mind-map tier palette.
export const TIER_COLORS = ['#bc5c38', '#6f8f66', '#4a7f9e', '#8b5e83', '#c25c6e']
// Mindly radial: one hue per root branch, depth shades toward white.
export const BRANCH_COLORS = ['#e0754d', '#6f8f66', '#4a7f9e', '#8b5e83', '#c25c6e', '#c9a227', '#5c8d89']
export const ROOT_COLOR = '#d96b43'

const CHAR_W_RATIO = 0.52 // char width as fraction of font size
const LINE_GAP = 1.32 // line height as fraction of font size
const SIB_GAP = 0.10 // radians of breathing room between sibling fans
const R0 = 56 // root radius
const SHRINK = 0.80 // radius multiplier per depth
const R_MIN = 22 // radius floor

export function nodeRadius(tier) {
  return Math.max(R_MIN, Math.round(R0 * Math.pow(SHRINK, tier)))
}

function fontSizeFor(r) {
  return Math.max(9, Math.min(18, Math.round(r * 0.38)))
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

function lighten(hex, t) {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t)
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function textColorFor(fill) {
  return luminance(fill) > 0.62 ? '#4a3f38' : '#ffffff'
}

export function wrapLabel(label, maxChars = 18, maxLines = 3) {
  const words = String(label || '').split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  let overflow = false
  for (const raw of words) {
    // a single word longer than the available width must be clipped too
    const w = raw.length > maxChars ? raw.slice(0, Math.max(1, maxChars - 1)) + '…' : raw
    if (!cur) {
      cur = w
    } else if ((cur + ' ' + w).length <= maxChars) {
      cur += ' ' + w
    } else {
      lines.push(cur)
      cur = w
      if (lines.length === maxLines) {
        overflow = true
        cur = ''
        break
      }
    }
  }
  if (cur) {
    if (lines.length < maxLines) lines.push(cur)
    else overflow = true
  }
  // ellipsis only when words genuinely did not fit
  if (overflow && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, Math.max(1, maxChars - 1)) + '…'
  }
  return lines.length ? lines : ['']
}

// wrap a label to fit a circle of radius r. Mindly rule: never truncate
// while the font can shrink — scale the font down (floor 7px) until the
// longest word fits, then wrap to 3 lines; ellipsis only as last resort.
function wrapForCircle(label, r) {
  let fs = fontSizeFor(r)
  const words = String(label || '').split(/\s+/).filter(Boolean)
  const longest = words.reduce((s, w) => Math.max(s, w.length), 1)
  const maxCharsAt = (size) => {
    const usable = 2 * Math.sqrt(Math.max(0.1, r * r - Math.pow(r * 0.52, 2))) * 0.92
    return Math.max(3, Math.floor(usable / (size * CHAR_W_RATIO)))
  }
  while (longest > maxCharsAt(fs) && fs > 7) fs -= 1
  return { lines: wrapLabel(label, maxCharsAt(fs), 3), fs }
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

function emptyLayout() {
  return { width: 400, height: 300, nodes: [], links: [], rings: [] }
}

// ---------- classic mind map (root centered, branches left/right) ----------

function layoutMindmap(map) {
  const kids = childrenOf(map)
  const root = (map.nodes || []).find((n) => !n.parent)
  if (!root) return emptyLayout()

  const parents = {}
  for (const n of map.nodes || []) parents[n.id] = n.parent

  const boxes = new Map()
  for (const n of map.nodes || []) {
    const tier = depthOf(parents, n.id)
    const lines = wrapLabel(n.label, 18, 3)
    const fs = 13
    const textW = Math.max(...lines.map((l) => l.length), 1) * fs * CHAR_W_RATIO
    const w = Math.max(96, textW + 32)
    const h = Math.max(38, lines.length * fs * LINE_GAP + 20)
    boxes.set(n.id, {
      id: n.id,
      label: n.label,
      note: n.note || '',
      color: n.color || TIER_COLORS[tier % TIER_COLORS.length],
      text_color: '#4a3f38',
      shape: 'rect',
      tier,
      parent: n.parent,
      lines,
      w,
      h,
    })
  }

  const rootBox = boxes.get(root.id)
  const rootKids = kids.get(root.id) || []
  const split = Math.ceil(rootKids.length / 2)
  const sides = {
    left: rootKids.slice(0, split),
    right: rootKids.slice(split),
  }

  const placed = new Map()
  const H_GAP = 70
  const V_GAP = 14

  function placeSide(sideRoots) {
    const widths = {}
    const walkW = (id, d) => {
      widths[d] = Math.max(widths[d] || 0, boxes.get(id).w)
      for (const c of kids.get(id) || []) walkW(c.id, d + 1)
    }
    for (const r of sideRoots) walkW(r.id, 1)
    const xs = {}
    let acc = 0
    const maxD = Math.max(0, ...Object.keys(widths).map(Number))
    for (let d = 1; d <= maxD; d++) {
      acc += (widths[d - 1] || 0) + H_GAP
      xs[d] = acc
    }

    let cursor = 0
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
      cursor += V_GAP * 2
    }
  }

  placeSide(sides.left)
  placeSide(sides.right)

  const outNodes = []
  const outLinks = []

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

  let treeMinY = Infinity
  let treeMaxY = -Infinity
  for (const [id, p] of placed) {
    treeMinY = Math.min(treeMinY, p.y)
    treeMaxY = Math.max(treeMaxY, p.y + boxes.get(id).h)
  }
  outNodes.push({ ...rootBox, x: 0, y: (treeMinY + treeMaxY) / 2 - rootBox.h / 2 })

  const posOf = new Map(outNodes.map((n) => [n.id, n]))
  for (const n of map.nodes || []) {
    if (!n.parent || !posOf.has(n.id) || !posOf.has(n.parent)) continue
    const c = posOf.get(n.id)
    const p = posOf.get(n.parent)
    const sign = c.x >= p.x ? 1 : -1
    outLinks.push(bezier(
      p.x + (sign > 0 ? p.w : 0), p.y + p.h / 2,
      c.x + (sign > 0 ? 0 : c.w), c.y + c.h / 2,
      false, n.parent, n.id,
    ))
  }
  for (const l of map.links || []) {
    const a = posOf.get(l.from)
    const b = posOf.get(l.to)
    if (!a || !b) continue
    outLinks.push(bezier(a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2, true, l.from, l.to, l.label))
  }

  return normalize(outNodes, outLinks)
}

// ---------- Mindly radial: circles on orbital "bead chain" arcs ----------

function layoutRadial(map) {
  const kids = childrenOf(map)
  const root = (map.nodes || []).find((n) => !n.parent)
  if (!root) return emptyLayout()

  const parents = {}
  for (const n of map.nodes || []) parents[n.id] = n.parent

  // each root branch owns a palette hue; deeper nodes shade toward white
  const branchHue = new Map()
  ;(kids.get(root.id) || []).forEach((c, i) => branchHue.set(c.id, BRANCH_COLORS[i % BRANCH_COLORS.length]))

  function hueOf(id) {
    let cur = id
    while (cur != null && !branchHue.has(cur)) cur = parents[cur]
    return branchHue.get(cur) || ROOT_COLOR
  }

  const specs = new Map()
  for (const n of map.nodes || []) {
    const tier = depthOf(parents, n.id)
    const r = nodeRadius(tier)
    const isRoot = !n.parent
    const base = n.color || hueOf(n.id)
    const fill = isRoot ? (n.color || ROOT_COLOR) : lighten(base, Math.min(0.55, 0.14 * (tier - 1)))
    const { lines, fs } = wrapForCircle(n.label, r)
    specs.set(n.id, {
      id: n.id,
      label: n.label,
      note: n.note || '',
      color: fill,
      text_color: textColorFor(fill),
      shape: 'circle',
      r,
      fs,
      tier,
      parent: n.parent,
      lines,
    })
  }

  function leafWeight(id) {
    const ch = kids.get(id) || []
    if (!ch.length) return 1
    return ch.reduce((s, c) => s + leafWeight(c.id), 0)
  }

  const placed = new Map()

  function placeChildren(id, cx, cy, dir) {
    const ch = kids.get(id) || []
    if (!ch.length) return
    const spec = specs.get(id)
    const maxChildR = Math.max(...ch.map((c) => specs.get(c.id).r))
    const totalWeight = ch.reduce((s, c) => s + leafWeight(c.id), 0) || 1
    const desc = totalWeight
    let baseOrbit = spec.r + maxChildR + 8 + Math.min(26, 3.2 * Math.max(0, desc - 1))

    // beads must physically fit around the arc: grow the orbit until the
    // circumference can hold every child's diameter (Mindly chains ride
    // further out as they get longer)
    const maxSpan = id === root.id ? Math.PI * 2 : Math.PI * 1.85
    const gaps = id === root.id ? ch.length : ch.length - 1
    const beadWidth = ch.reduce((s, c) => s + 2 * (specs.get(c.id).r + 3.2), 0)
    const orbitMin = Math.ceil(beadWidth / Math.max(0.5, maxSpan - gaps * SIB_GAP))
    const orbit = Math.max(baseOrbit, orbitMin)

    // angular demand per child: its own diameter at minimum, more when the
    // subtree is heavy so big branches claim more room
    const arcs = ch.map((c) => {
      const own = 2 * Math.asin(Math.min(1, (specs.get(c.id).r + 3.2) / orbit))
      const share = (leafWeight(c.id) / totalWeight) * Math.PI * 1.45
      return Math.max(own, Math.min(Math.PI * 0.94, share))
    })
    // root fans wrap a full circle: reserve one extra gap for the seam so the
    // first and last children never collide at the wrap-around
    const arcSum = arcs.reduce((s, a) => s + a, 0)
    if (arcSum + gaps * SIB_GAP > maxSpan) {
      const k = Math.max(0.2, (maxSpan - gaps * SIB_GAP) / arcSum)
      for (let i = 0; i < arcs.length; i++) arcs[i] *= k
    }
    const span = arcs.reduce((s, a) => s + a, 0) + gaps * SIB_GAP

    let a = dir - span / 2
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i]
      const mid = a + arcs[i] / 2
      const ccx = cx + Math.cos(mid) * orbit
      const ccy = cy + Math.sin(mid) * orbit
      placed.set(c.id, { x: ccx, y: ccy })
      placeChildren(c.id, ccx, ccy, mid)
      a += arcs[i] + SIB_GAP
    }
  }

  placed.set(root.id, { x: 0, y: 0 })
  placeChildren(root.id, 0, 0, -Math.PI / 2)

  const outNodes = []
  for (const n of map.nodes || []) {
    const s = specs.get(n.id)
    const p = placed.get(n.id) || { x: 0, y: 0 }
    outNodes.push({ ...s, x: p.x - s.r, y: p.y - s.r, w: s.r * 2, h: s.r * 2 })
  }

  const posOf = new Map(outNodes.map((n) => [n.id, n]))
  const outLinks = []

  // Mindly connectors: siblings are beads on a string — consecutive siblings
  // are joined by an arc of their shared orbit, and the chain hangs off the
  // parent with one short spoke (single children get a gentle curve).
  for (const n of map.nodes || []) {
    const ch = kids.get(n.id) || []
    if (!ch.length) continue
    const p = posOf.get(n.id)
    const px = p.x + p.r
    const py = p.y + p.r
    const centers = ch.map((c) => {
      const q = posOf.get(c.id)
      return { node: q, cx: q.x + q.r, cy: q.y + q.r }
    })
    const R = Math.hypot(centers[0].cx - px, centers[0].cy - py) || 1

    if (ch.length === 1) {
      const c = centers[0]
      const dx = c.cx - px
      const dy = c.cy - py
      const dist = Math.hypot(dx, dy) || 1
      outLinks.push(bezier(
        px + (dx / dist) * p.r, py + (dy / dist) * p.r,
        c.cx - (dx / dist) * c.node.r, c.cy - (dy / dist) * c.node.r,
        false, n.id, ch[0].id,
      ))
      continue
    }

    // spoke: parent edge -> middle child edge
    const mid = centers[Math.floor(centers.length / 2)]
    const mdx = mid.cx - px
    const mdy = mid.cy - py
    const mdist = Math.hypot(mdx, mdy) || 1
    outLinks.push(bezier(
      px + (mdx / mdist) * p.r, py + (mdy / mdist) * p.r,
      mid.cx - (mdx / mdist) * mid.node.r, mid.cy - (mdy / mdist) * mid.node.r,
      false, n.id, ch[Math.floor(centers.length / 2)].id,
    ))

    // chain arcs: edge of one bead to edge of the next along the orbit
    for (let i = 0; i < centers.length - 1; i++) {
      const a = centers[i]
      const b = centers[i + 1]
      let t1 = Math.atan2(a.cy - py, a.cx - px)
      let t2 = Math.atan2(b.cy - py, b.cx - px)
      // take the short way around
      while (t2 - t1 > Math.PI) t2 -= 2 * Math.PI
      while (t2 - t1 < -Math.PI) t2 += 2 * Math.PI
      const dir = Math.sign(t2 - t1) || 1
      const s = t1 + dir * (a.node.r / R)
      const e = t2 - dir * (b.node.r / R)
      const delta = e - s
      const k = (4 / 3) * Math.tan(Math.abs(delta) / 4) * R
      const sx = px + Math.cos(s) * R
      const sy = py + Math.sin(s) * R
      const ex = px + Math.cos(e) * R
      const ey = py + Math.sin(e) * R
      outLinks.push({
        from: ch[i].id,
        to: ch[i + 1].id,
        x1: sx, y1: sy, x2: ex, y2: ey,
        cx1: sx - Math.sin(s) * k * dir, cy1: sy + Math.cos(s) * k * dir,
        cx2: ex + Math.sin(e) * k * dir, cy2: ey - Math.cos(e) * k * dir,
        dashed: false,
        label: '',
      })
    }
  }
  for (const l of map.links || []) {
    const a = posOf.get(l.from)
    const b = posOf.get(l.to)
    if (!a || !b) continue
    outLinks.push(bezier(a.x + a.r, a.y + a.r, b.x + b.r, b.y + b.r, true, l.from, l.to, l.label))
  }

  return normalize(outNodes, outLinks)
}

// shift everything into positive space + padding
function normalize(nodes, links) {
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
  const dx = PAD - minX
  const dy = PAD - minY
  for (const n of nodes) {
    n.x += dx
    n.y += dy
  }
  for (const l of links) {
    l.x1 += dx; l.y1 += dy; l.x2 += dx; l.y2 += dy
    l.cx1 += dx; l.cy1 += dy; l.cx2 += dx; l.cy2 += dy
  }
  return {
    width: Math.ceil(maxX + dx + PAD),
    height: Math.ceil(maxY + dy + PAD),
    nodes,
    links,
    rings: [],
  }
}

export function layoutMap(map) {
  if (!map || !Array.isArray(map.nodes) || map.nodes.length === 0) {
    return emptyLayout()
  }
  return map.kind === 'radial' ? layoutRadial(map) : layoutMindmap(map)
}

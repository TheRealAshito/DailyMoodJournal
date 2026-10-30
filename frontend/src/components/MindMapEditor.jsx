import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'
import { layoutMap, TIER_COLORS } from '../lib/mindmapLayout'

// ---------- small pure helpers ----------

function errDetail(err) {
  const d = err.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => (x && typeof x.msg === 'string' ? x.msg : '')).filter(Boolean).join('; ')
  return err.message || ''
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi)
}

// Blend a tier color ~85% toward white for the node fill.
function tint(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#f5efe8'
  const n = parseInt(m[1], 16)
  const mix = (c) => Math.round(c + (255 - c) * 0.85)
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Midpoint of the cubic bezier (t = 0.5).
function bezierMid(l) {
  return {
    x: (l.x1 + 3 * l.cx1 + 3 * l.cx2 + l.x2) / 8,
    y: (l.y1 + 3 * l.cy1 + 3 * l.cy2 + l.y2) / 8,
  }
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function safeFilename(title, ext) {
  return `${String(title || 'mindmap').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)}.${ext}`
}

let idSeq = 0
function nextId() {
  return `n_${Date.now().toString(36)}_${(idSeq++).toString(36)}`
}

// Whole subtree (self + all descendants) so delete removes the branch cleanly.
function subtreeIds(nodes, rootId) {
  const kids = new Map()
  for (const n of nodes || []) {
    if (n.parent) {
      if (!kids.has(n.parent)) kids.set(n.parent, [])
      kids.get(n.parent).push(n.id)
    }
  }
  const out = []
  const queue = [rootId]
  const seen = new Set()
  while (queue.length) {
    const id = queue.shift()
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    for (const c of kids.get(id) || []) queue.push(c)
  }
  return out
}

// Normalize to the wire shape the API validates (labels 1-120, notes <= 2000).
function toPayload(m) {
  return {
    title: m.title,
    nodes: (m.nodes || []).map((n) => ({
      id: n.id,
      parent: n.parent ?? null,
      label: n.label,
      note: (n.note || '').slice(0, 2000),
      ...(n.color ? { color: n.color } : {}),
    })),
    links: (m.links || []).map((l) => ({
      from: l.from,
      to: l.to,
      ...(l.label ? { label: l.label } : {}),
    })),
  }
}

// Standalone SVG string mirroring the on-screen rendering (white background,
// legend included) — rasterized to PNG at 2.5x.
function buildExportSvg(map, layout) {
  const W = layout.width
  const H = layout.height
  const p = []
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`)
  p.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`)
  const root = (layout.nodes || []).find((n) => n.tier === 0)
  if (root) {
    const rx = root.x + root.w / 2
    const ry = root.y + root.h / 2
    for (const ring of layout.rings || []) {
      p.push(`<circle cx="${rx}" cy="${ry}" r="${ring.r}" fill="${ring.color}" fill-opacity="0.04" stroke="${ring.color}" stroke-opacity="0.35" stroke-width="1.5"/>`)
    }
  }
  for (const l of layout.links || []) {
    const stroke = l.dashed ? '#b4a392' : '#8a7b6d'
    p.push(`<path d="M ${l.x1} ${l.y1} C ${l.cx1} ${l.cy1} ${l.cx2} ${l.cy2} ${l.x2} ${l.y2}" stroke="${stroke}" stroke-width="1.5" fill="none"${l.dashed ? ' stroke-dasharray="6 4"' : ''}/>`)
  }
  for (const l of layout.links || []) {
    if (!l.label) continue
    const m = bezierMid(l)
    p.push(`<text x="${m.x}" y="${m.y}" font-size="10" fill="#8a7b6d" text-anchor="middle" font-family="sans-serif" stroke="#ffffff" stroke-width="3" paint-order="stroke">${xmlEscape(l.label)}</text>`)
  }
  for (const n of layout.nodes || []) {
    p.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10" fill="${tint(n.color)}" stroke="${n.color}" stroke-width="2"/>`)
    n.lines.forEach((line, i) => {
      const y = n.y + n.h / 2 + (i - (n.lines.length - 1) / 2) * 18 + 4.7
      p.push(`<text x="${n.x + n.w / 2}" y="${y}" font-size="13" fill="#2b2420" text-anchor="middle" font-family="sans-serif">${xmlEscape(line)}</text>`)
    })
  }
  // tier legend, top-right corner
  const maxTier = (layout.nodes || []).reduce((s, n) => Math.max(s, n.tier), 0)
  if ((layout.nodes || []).length) {
    const lw = 78
    const lx = W - lw - 12
    const ly = 12
    p.push(`<rect x="${lx - 8}" y="${ly - 6}" width="${lw}" height="${(maxTier + 1) * 20 + 12}" rx="8" fill="#ffffff" fill-opacity="0.92" stroke="#e0d6c8"/>`)
    for (let tier = 0; tier <= maxTier; tier++) {
      const cy = ly + tier * 20 + 4
      p.push(`<rect x="${lx}" y="${cy}" width="12" height="12" rx="3" fill="${TIER_COLORS[tier % TIER_COLORS.length]}"/>`)
      p.push(`<text x="${lx + 18}" y="${cy + 10}" font-size="11" fill="#2b2420" font-family="sans-serif">T${tier}</text>`)
    }
  }
  p.push('</svg>')
  return p.join('\n')
}

// ---------- editor ----------

export default function MindMapEditor() {
  const { id } = useParams()
  const { t } = useI18n()

  const [map, setMap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [titleDraft, setTitleDraft] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [childOpen, setChildOpen] = useState(false)
  const [childLabel, setChildLabel] = useState('')
  const [relationFrom, setRelationFrom] = useState(null)
  const [relationDraft, setRelationDraft] = useState(null) // {from, to, label}
  const [relationError, setRelationError] = useState('')
  const [rootLabel, setRootLabel] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportError, setExportError] = useState('')
  const [vb, setVb] = useState(null) // null = fit to layout
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [panning, setPanning] = useState(false)
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 639px)').matches)

  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const mapRef = useRef(null)
  const saveTimer = useRef(null)
  const dirtyRef = useRef(false)
  const dragRef = useRef(null)
  const dragMovedRef = useRef(false)

  // ----- load -----
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError('')
    setMap(null)
    mapRef.current = null
    setSelectedId(null)
    setRelationFrom(null)
    setRelationDraft(null)
    setVb(null)
    api.get(`/mindmaps/${id}`)
      .then(({ data }) => {
        if (!alive) return
        setMap(data)
        mapRef.current = data
        setTitleDraft(data.title || '')
      })
      .catch((err) => {
        if (alive) setLoadError(errDetail(err) || t('mindmap_map_load_error'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // flush pending edits on unmount
  useEffect(() => () => {
    clearTimeout(saveTimer.current)
    const m = mapRef.current
    if (m && dirtyRef.current) {
      api.patch(`/mindmaps/${m.id}`, toPayload(m)).catch(() => {})
    }
  }, [])

  // container size for zoom math + toolbar placement
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const onChange = (e) => setIsNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // ----- autosave (debounced whole-document PATCH) -----
  const saveNow = async () => {
    const m = mapRef.current
    if (!m) return
    setSaveState('saving')
    try {
      await api.patch(`/mindmaps/${m.id}`, toPayload(m))
      dirtyRef.current = false
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  const scheduleSave = () => {
    dirtyRef.current = true
    setSaveState('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(saveNow, 600)
  }

  const mutate = (fn) => {
    setMap((prev) => {
      if (!prev) return prev
      const next = fn(prev)
      mapRef.current = next
      return next
    })
    scheduleSave()
  }

  // ----- derived layout -----
  const layout = useMemo(() => layoutMap(map), [map])
  const vbActual = vb || { x: 0, y: 0, w: layout.width || 400, h: layout.height || 300 }
  const selectedNode = layout.nodes.find((n) => n.id === selectedId) || null
  const selectedRaw = (map?.nodes || []).find((n) => n.id === selectedId) || null
  const root = layout.nodes.find((n) => n.tier === 0) || null
  const maxTier = layout.nodes.reduce((s, n) => Math.max(s, n.tier), 0)

  const scale = size.w && vbActual.w ? Math.min(size.w / vbActual.w, size.h / vbActual.h) : 1
  const offX = (size.w - vbActual.w * scale) / 2
  const offY = (size.h - vbActual.h * scale) / 2
  const toScreen = (x, y) => [offX + (x - vbActual.x) * scale, offY + (y - vbActual.y) * scale]

  // ----- node operations -----
  const onNodeClick = (nid) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    if (relationFrom && nid !== relationFrom) {
      const exists = (map.links || []).some(
        (l) => (l.from === relationFrom && l.to === nid) || (l.from === nid && l.to === relationFrom),
      )
      if (exists) {
        setRelationError(t('mindmap_relation_error'))
        return
      }
      setRelationDraft({ from: relationFrom, to: nid, label: '' })
      setRelationFrom(null)
      setRelationError('')
      return
    }
    setRelationError('')
    setSelectedId(nid)
    const node = (map.nodes || []).find((n) => n.id === nid)
    setRenameDraft(node ? node.label : '')
    setChildOpen(false)
    setChildLabel('')
  }

  const commitRename = () => {
    const label = renameDraft.trim()
    if (!selectedId || !label || label.length > 120) return
    mutate((m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === selectedId ? { ...n, label } : n)) }))
  }

  const onNoteChange = (value) => {
    mutate((m) => ({
      ...m,
      nodes: m.nodes.map((n) => (n.id === selectedId ? { ...n, note: value.slice(0, 2000) } : n)),
    }))
  }

  const setColor = (hex) => {
    mutate((m) => ({
      ...m,
      nodes: m.nodes.map((n) => {
        if (n.id !== selectedId) return n
        const next = { ...n }
        if (hex) next.color = hex
        else delete next.color
        return next
      }),
    }))
  }

  const addChild = () => {
    const label = childLabel.trim()
    if (!label || label.length > 120 || !selectedId) return
    const nid = nextId()
    mutate((m) => ({ ...m, nodes: [...m.nodes, { id: nid, parent: selectedId, label, note: '' }] }))
    setSelectedId(nid)
    setRenameDraft(label)
    setChildLabel('')
    setChildOpen(false)
  }

  const openAddNode = () => {
    if (!map || !(map.nodes || []).length) return
    const root = (map.nodes || []).find((n) => !n.parent)
    const parent = (map.nodes || []).find((n) => n.id === selectedId) || root
    if (!parent) return
    setSelectedId(parent.id)
    setRenameDraft(parent.label)
    setChildOpen(true)
    setChildLabel('')
  }

  const deleteNode = () => {
    if (!selectedId) return
    if (!window.confirm(t('mindmap_delete_confirm'))) return
    const ids = new Set(subtreeIds(map.nodes, selectedId))
    mutate((m) => ({
      ...m,
      nodes: m.nodes.filter((n) => !ids.has(n.id)),
      links: (m.links || []).filter((l) => !ids.has(l.from) && !ids.has(l.to)),
    }))
    setSelectedId(null)
  }

  const confirmRelation = () => {
    const d = relationDraft
    if (!d) return
    const label = (d.label || '').trim()
    mutate((m) => ({
      ...m,
      links: [...(m.links || []), { from: d.from, to: d.to, ...(label ? { label } : {}) }],
    }))
    setRelationDraft(null)
  }

  const createRoot = (ev) => {
    ev.preventDefault()
    const label = rootLabel.trim()
    if (!label || label.length > 120) return
    const nid = nextId()
    mutate((m) => ({ ...m, nodes: [{ id: nid, parent: null, label, note: '' }] }))
    setRootLabel('')
  }

  const commitTitle = () => {
    const title = titleDraft.trim()
    if (!map) return
    if (!title || title.length > 120) {
      setTitleDraft(map.title)
      return
    }
    if (title !== map.title) mutate((m) => ({ ...m, title }))
  }

  // ----- zoom / pan -----
  const zoomBy = (factor) => {
    setVb((prev) => {
      const base = prev || vbActual
      const w = clamp(base.w * factor, 80, (layout.width || 400) * 12)
      const ratio = w / base.w
      const h = base.h * ratio
      const cx = base.x + base.w / 2
      const cy = base.y + base.h / 2
      return { x: cx - w / 2, y: cy - h / 2, w, h }
    })
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = svgRef.current
    if (!el) return
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      vb: { ...vbActual },
      rect: el.getBoundingClientRect(),
      moved: false,
    }
    dragMovedRef.current = false
    setPanning(true)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      d.moved = true
      dragMovedRef.current = true
    }
    if (!d.moved) return
    const k = Math.max(d.vb.w / (d.rect.width || 1), d.vb.h / (d.rect.height || 1))
    setVb({ x: d.vb.x - dx * k, y: d.vb.y - dy * k, w: d.vb.w, h: d.vb.h })
  }

  const onPointerUp = () => {
    dragRef.current = null
    setPanning(false)
  }

  // ----- export -----
  const exportPng = () => {
    setExportOpen(false)
    setExportError('')
    try {
      const svg = buildExportSvg(map, layout)
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(layout.width * 2.5)
          canvas.height = Math.round(layout.height * 2.5)
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)
          canvas.toBlob((b) => {
            if (b) downloadBlob(b, safeFilename(map.title, 'png'))
            else setExportError(t('mindmap_export_error'))
          }, 'image/png')
        } catch {
          setExportError(t('mindmap_export_error'))
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        setExportError(t('mindmap_export_error'))
      }
      img.src = url
    } catch {
      setExportError(t('mindmap_export_error'))
    }
  }

  const exportPdf = async () => {
    setExportOpen(false)
    setExportError('')
    try {
      const layoutPayload = { ...layout, kind: map.kind, title: map.title }
      const resp = await api.post(`/mindmaps/${map.id}/export/pdf`, { layout: layoutPayload }, { responseType: 'blob' })
      downloadBlob(resp.data, safeFilename(map.title, 'pdf'))
    } catch {
      setExportError(t('mindmap_export_error'))
    }
  }

  // ----- render -----
  if (loading) {
    return <div className="flex justify-center py-16"><div className="spin" /></div>
  }

  if (loadError) {
    return (
      <div className="fade-up max-w-2xl mx-auto">
        <div className="card card-pad text-center">
          <p className="text-custom-muted">{loadError}</p>
          <Link to="/maps" className="btn btn-secondary mt-4">{t('mindmap_back')}</Link>
        </div>
      </div>
    )
  }

  if (!map) return null

  const kindLabel = map.kind === 'radial' ? t('mindmap_kind_radial') : t('mindmap_kind_mindmap')
  const isEmpty = (map.nodes || []).length === 0

  const toolbarStyle = isNarrow
    ? { position: 'fixed', left: 8, right: 8, bottom: 8, maxHeight: '55vh', overflowY: 'auto' }
    : selectedNode
      ? {
          position: 'absolute',
          width: 300,
          left: clamp(toScreen(selectedNode.x, selectedNode.y)[0] + selectedNode.w * scale + 12, 8, Math.max(8, size.w - 308)),
          top: clamp(toScreen(selectedNode.x, selectedNode.y)[1], 8, Math.max(8, size.h - 430)),
          maxHeight: 'calc(100% - 16px)',
          overflowY: 'auto',
        }
      : { display: 'none' }

  return (
    <div className="fade-up">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link to="/maps" className="btn btn-ghost btn-sm">← {t('mindmap_back')}</Link>
        <input
          className="input input-compact flex-1 min-w-0 max-w-md"
          value={titleDraft}
          maxLength={120}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          aria-label={t('title')}
        />
        <span className="badge">{kindLabel}</span>
        <span className={`text-xs ${saveState === 'error' ? 'text-accent' : 'text-custom-muted'}`}>
          {saveState === 'saving' ? t('mindmap_saving')
            : saveState === 'saved' ? t('mindmap_saved')
              : saveState === 'error' ? t('mindmap_save_error') : ''}
        </span>
        {!isEmpty && (
          <button className="btn btn-primary btn-sm ml-auto" onClick={openAddNode}>
            + {t('mindmap_add_node')}
          </button>
        )}
        <div className={`relative ${isEmpty ? 'ml-auto' : ''}`}>
          <button className="btn btn-secondary btn-sm" onClick={() => setExportOpen((v) => !v)}>
            {t('mindmap_export')}
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 mt-1 z-50 card p-1 w-44">
                <button className="btn btn-ghost btn-sm w-full justify-start" onClick={exportPng}>
                  {t('mindmap_export_png')}
                </button>
                <button className="btn btn-ghost btn-sm w-full justify-start" onClick={exportPdf}>
                  {t('mindmap_export_pdf')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {exportError ? (
        <div className="card card-pad mb-3 text-custom-muted">{exportError}</div>
      ) : null}

      {/* canvas */}
      <div ref={containerRef} className="relative card overflow-hidden" style={{ minHeight: '70vh' }}>
        <svg
          ref={svgRef}
          viewBox={`${vbActual.x} ${vbActual.y} ${vbActual.w} ${vbActual.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
          style={{ background: '#ffffff', touchAction: 'none', cursor: panning ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* radial rings behind everything */}
          {root && (layout.rings || []).map((ring) => (
            <circle
              key={ring.tier}
              cx={root.x + root.w / 2}
              cy={root.y + root.h / 2}
              r={ring.r}
              fill={ring.color}
              fillOpacity={0.04}
              stroke={ring.color}
              strokeOpacity={0.35}
              strokeWidth={1.5}
            />
          ))}

          {/* links */}
          {layout.links.map((l, i) => (
            <path
              key={`p${i}`}
              d={`M ${l.x1} ${l.y1} C ${l.cx1} ${l.cy1} ${l.cx2} ${l.cy2} ${l.x2} ${l.y2}`}
              stroke={l.dashed ? '#b4a392' : '#8a7b6d'}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray={l.dashed ? '6 4' : undefined}
            />
          ))}
          {layout.links.map((l, i) => (l.label ? (() => {
            const m = bezierMid(l)
            return (
              <text
                key={`t${i}`}
                x={m.x}
                y={m.y}
                fontSize={10}
                fill="#8a7b6d"
                textAnchor="middle"
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {l.label}
              </text>
            )
          })() : null))}

          {/* nodes */}
          {layout.nodes.map((n) => {
            const selected = n.id === selectedId
            return (
              <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => onNodeClick(n.id)}>
                {selected && (
                  <rect
                    x={n.x - 4}
                    y={n.y - 4}
                    width={n.w + 8}
                    height={n.h + 8}
                    rx={13}
                    fill="none"
                    stroke={n.color}
                    strokeOpacity={0.35}
                    strokeWidth={2}
                  />
                )}
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  rx={10}
                  fill={tint(n.color)}
                  stroke={n.color}
                  strokeWidth={selected ? 3 : 2}
                />
                {n.lines.map((line, i) => (
                  <text
                    key={i}
                    x={n.x + n.w / 2}
                    y={n.y + n.h / 2 + (i - (n.lines.length - 1) / 2) * 18 + 4.7}
                    fontSize={13}
                    fill="#2b2420"
                    textAnchor="middle"
                  >
                    {line}
                  </text>
                ))}
              </g>
            )
          })}
        </svg>

        {/* tier legend */}
        {!isEmpty && (
          <div className="absolute top-2 right-2 z-20 card p-2">
            <div className="flex flex-col gap-1">
              {Array.from({ length: maxTier + 1 }, (_, tier) => (
                <div key={tier} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded"
                    style={{ backgroundColor: TIER_COLORS[tier % TIER_COLORS.length] }}
                  />
                  <span className="text-xs text-custom-muted">T{tier}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* zoom controls */}
        <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => zoomBy(1 / 0.8)}
            title={t('mindmap_zoom_out')}
            aria-label={t('mindmap_zoom_out')}
          >
            −
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => zoomBy(0.8)}
            title={t('mindmap_zoom_in')}
            aria-label={t('mindmap_zoom_in')}
          >
            +
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setVb(null)}>
            {t('mindmap_fit')}
          </button>
        </div>

        {/* relation mode hint */}
        {relationFrom && (
          <div className="absolute top-2 left-2 z-30 card card-pad py-2 px-3 flex items-center gap-2">
            <span className="text-sm text-accent">{t('mindmap_relation_hint')}</span>
            {relationError ? <span className="text-sm text-accent">{relationError}</span> : null}
            <button className="btn btn-ghost btn-sm" onClick={() => { setRelationFrom(null); setRelationError('') }}>
              {t('mindmap_cancel')}
            </button>
          </div>
        )}

        {/* relation label prompt */}
        {relationDraft && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 card card-pad w-72">
            <label className="form-label">{t('mindmap_relation_label')}</label>
            <input
              className="input input-compact"
              value={relationDraft.label}
              maxLength={80}
              autoFocus
              onChange={(e) => setRelationDraft({ ...relationDraft, label: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmRelation() }}
            />
            <div className="flex items-center gap-2 mt-2">
              <button className="btn btn-primary btn-sm" onClick={confirmRelation}>
                {t('mindmap_relation_add')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setRelationDraft(null)}>
                {t('mindmap_cancel')}
              </button>
            </div>
          </div>
        )}

        {/* discoverability hint: nothing selected but the map has nodes */}
        {!isEmpty && !selectedId && (
          <div className="absolute left-3 top-3 z-10 text-xs text-custom-muted bg-white/80 rounded-lg px-2.5 py-1.5">
            {t('mindmap_select_node')}
          </div>
        )}

        {/* root creation for empty maps */}
        {isEmpty && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
            <form className="card card-pad w-full max-w-sm" onSubmit={createRoot}>
              <h3 className="section-title">{t('mindmap_root_prompt')}</h3>
              <input
                className="input mt-3"
                value={rootLabel}
                maxLength={120}
                autoFocus
                placeholder={t('mindmap_root_placeholder')}
                onChange={(e) => setRootLabel(e.target.value)}
              />
              <button type="submit" className="btn btn-primary mt-3" disabled={!rootLabel.trim()}>
                {t('mindmap_add')}
              </button>
            </form>
          </div>
        )}

        {/* node toolbar */}
        {selectedNode && selectedRaw && (
          <div className="card card-pad z-30" style={toolbarStyle}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {map.kind === 'radial' ? <span className="badge shrink-0">T{selectedNode.tier}</span> : null}
                <span className="font-semibold break-words">{selectedRaw.label}</span>
              </div>
              <button
                className="btn btn-ghost btn-sm shrink-0"
                aria-label={t('mindmap_cancel')}
                onClick={() => setSelectedId(null)}
              >
                ×
              </button>
            </div>

            <label className="form-label">{t('mindmap_rename')}</label>
            <input
              className="input input-compact"
              value={renameDraft}
              maxLength={120}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />

            <label className="form-label mt-2">{t('mindmap_note')}</label>
            <textarea
              className="input"
              rows={3}
              maxLength={2000}
              value={selectedRaw.note || ''}
              onChange={(e) => onNoteChange(e.target.value)}
            />

            <label className="form-label mt-2">{t('mindmap_color')}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {TIER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={c}
                  className={`w-6 h-6 rounded-full border-2 ${selectedRaw.color === c ? 'border-accent' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => setColor(null)}>
                {t('mindmap_color_default')}
              </button>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setChildOpen((v) => !v); setChildLabel('') }}
              >
                {t('mindmap_add_child')}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setRelationFrom(selectedId); setRelationError('') }}
              >
                {t('mindmap_add_relation')}
              </button>
              <button className="btn btn-danger btn-sm" onClick={deleteNode}>
                {t('mindmap_delete_node')}
              </button>
            </div>

            {childOpen && (
              <div className="flex items-center gap-2 mt-2">
                {map.kind === 'radial' && selectedNode ? (
                  <span className="badge shrink-0">→ T{selectedNode.tier + 1}</span>
                ) : null}
                <input
                  className="input input-compact flex-1 min-w-0"
                  value={childLabel}
                  maxLength={120}
                  autoFocus
                  placeholder={t('mindmap_child_placeholder')}
                  onChange={(e) => setChildLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChild() } }}
                />
                <button className="btn btn-primary btn-sm" onClick={addChild} disabled={!childLabel.trim()}>
                  {t('mindmap_add')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

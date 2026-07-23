import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import { useI18n } from '../i18n'

const SAVE_DELAY = 800

async function downloadPdf(url, filename) {
  try {
    const resp = await fetch(url, { credentials: 'include' })
    if (!resp.ok) { alert('Failed to generate PDF'); return }
    const blob = await resp.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename || 'freewrite.pdf'
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (e) { alert('Failed to download PDF') }
}

export default function FreeWrite() {
  const { t } = useI18n()
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const timer = useRef(null)
  const textareaRef = useRef(null)

  // Load session list on mount
  useEffect(() => {
    api.get('/freewrite')
      .then((r) => {
        const list = r.data.sessions || []
        setSessions(list)
        if (list.length > 0) {
          setActiveId(list[0].id)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  // Load active session content when activeId changes
  useEffect(() => {
    if (!activeId) {
      setTitle('')
      setContent('')
      return
    }
    api.get(`/freewrite/${activeId}`)
      .then((r) => {
        setTitle(r.data.title || '')
        setContent(r.data.content || '')
      })
      .catch(() => {})
  }, [activeId])

  // Auto-save
  const doSave = useCallback(() => {
    if (!activeId) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setSaving(true)
      api.put(`/freewrite/${activeId}`, { title, content })
        .then((r) => {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeId
                ? { ...s, title: r.data.title, updated_at: r.data.updated_at }
                : s
            )
          )
        })
        .catch(() => {})
        .finally(() => setSaving(false))
    }, SAVE_DELAY)
  }, [activeId, title, content])

  useEffect(() => {
    doSave()
  }, [title, content, doSave])

  async function handleNew() {
    const t = newTitle.trim() || ''
    try {
      const r = await api.post('/freewrite', { title: t })
      const s = r.data
      setSessions((prev) => [s, ...prev])
      setActiveId(s.id)
      setNewTitle('')
    } catch {}
  }

  async function handleDelete(id) {
    if (!confirm(t('fw_delete_confirm'))) return
    try {
      await api.delete(`/freewrite/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
      if (activeId === id) {
        setActiveId(sessions.length > 1 ? sessions.find((s) => s.id !== id).id : null)
      }
    } catch {}
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function selectAll() {
    setSelectedIds(new Set(sessions.map((s) => s.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  function handleExportPdf(ids) {
    const param = ids.length > 0 ? `?ids=${ids.join(',')}` : ''
    downloadPdf(`/api/freewrite/export/pdf${param}`, 'freewrite.pdf')
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  if (!loaded) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-xl font-bold">{t('free_write')}</h1>
        <div className="flex items-center gap-3 text-xs text-custom-muted">
          <span>{wordCount} {wordCount === 1 ? t('fw_word') : t('fw_words')}</span>
          {saving && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" title={t('fw_saving')} />}
        </div>
      </div>

      {/* Notebook layout: sidebar + editor */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar — session list */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          {/* New session */}
          <div className="flex gap-1">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNew() } }}
              placeholder={t('fw_new_session')}
              className="flex-1 px-2 py-1.5 rounded-lg border border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 min-w-0"
            />
            <button onClick={handleNew} className="px-2.5 py-1.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 shrink-0" title={t('fw_create')}>
              +
            </button>
          </div>

          {/* Export controls */}
          {sessions.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <button
                  onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()) }}
                  className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectMode ? 'bg-cyan-500 text-white' : 'border border-custom text-custom hover:border-cyan-400'
                  }`}
                >
                  {selectMode ? t('fw_cancel') : t('fw_select')}
                </button>
                <button
                  onClick={() => handleExportPdf([])}
                  className="flex-1 px-2 py-1 rounded-lg text-xs font-medium border border-custom text-custom hover:border-cyan-400"
                  title={t('fw_export_all')}
                >
                  {t('fw_export_all')}
                </button>
              </div>
              {selectMode && (
                <div className="flex gap-1">
                  <button onClick={selectAll} className="flex-1 px-2 py-1 rounded-lg text-xs text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20">
                    {t('fw_select_all')}
                  </button>
                  <button onClick={deselectAll} className="flex-1 px-2 py-1 rounded-lg text-xs text-custom-muted hover:bg-custom-secondary">
                    {t('fw_deselect_all')}
                  </button>
                  <button
                    onClick={() => { handleExportPdf([...selectedIds]); setSelectMode(false); setSelectedIds(new Set()) }}
                    disabled={selectedIds.size === 0}
                    className="flex-1 px-2 py-1 rounded-lg text-xs font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40"
                  >
                    PDF ({selectedIds.size})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Session list */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-custom-muted text-center pt-4">{t('fw_no_sessions')}</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => { if (selectMode) { toggleSelect(s.id) } else { setActiveId(s.id) } }}
                className={`group flex items-start gap-1 px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  selectMode
                    ? selectedIds.has(s.id)
                      ? 'bg-cyan-100 dark:bg-cyan-900/30 border border-cyan-400'
                      : 'hover:bg-custom-secondary border border-transparent'
                    : activeId === s.id
                      ? 'bg-cyan-500 text-white'
                      : 'text-custom hover-bg'
                }`}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="mt-1 accent-cyan-500 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className={`text-xs truncate ${
                    selectMode
                      ? 'text-custom-muted'
                      : activeId === s.id ? 'text-white/70' : 'text-custom-muted'
                  }`}>
                    {s.updated_at ? new Date(s.updated_at).toLocaleString() : ''}
                  </div>
                </div>
                {!selectMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                    className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none px-1 rounded ${
                      activeId === s.id ? 'hover:bg-white/20 text-white/70' : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400'
                    }`}
                    title={t('fw_delete')}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Editor — full content area */}
        <div className="flex-1 flex flex-col card-bg border border-custom rounded-xl shadow-sm min-w-0">
          {activeId ? (
            <>
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-custom">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('fw_session_title')}
                  className="flex-1 bg-transparent text-custom font-semibold placeholder-custom-muted/50 outline-none text-base"
                />
                {!selectMode && (
                  <button
                    onClick={() => handleExportPdf([activeId])}
                    className="px-3 py-1 rounded-lg text-xs font-medium border border-custom text-custom hover:border-cyan-400 shrink-0 ml-2"
                    title={t('fw_export_pdf')}
                  >
                    PDF
                  </button>
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('fw_write_here')}
                className="flex-1 bg-transparent text-custom placeholder-custom-muted/50 p-5 text-base leading-relaxed outline-none resize-none rounded-b-xl"
                style={{ fontFamily: 'inherit', lineHeight: '1.8' }}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-custom-muted text-sm">
              {t('fw_empty')}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-custom-muted mt-3 text-center shrink-0">
        {t('fw_auto_save')}
      </p>
    </div>
  )
}

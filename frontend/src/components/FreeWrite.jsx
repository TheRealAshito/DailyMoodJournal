import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'

const SAVE_DELAY = 800

export default function FreeWrite() {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
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
    if (!confirm('Delete this free write session?')) return
    try {
      await api.delete(`/freewrite/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeId === id) {
        setActiveId(sessions.length > 1 ? sessions.find((s) => s.id !== id).id : null)
      }
    } catch {}
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
        <h1 className="text-xl font-bold">Free Write</h1>
        <div className="flex items-center gap-3 text-xs text-custom-muted">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          {saving && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" title="Saving..." />}
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
              placeholder="New session..."
              className="flex-1 px-2 py-1.5 rounded-lg border border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 min-w-0"
            />
            <button onClick={handleNew} className="px-2.5 py-1.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 shrink-0" title="Create new session">
              +
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-custom-muted text-center pt-4">No sessions yet</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`group flex items-start gap-1 px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  activeId === s.id
                    ? 'bg-cyan-500 text-white'
                    : 'text-custom hover-bg'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className={`text-xs truncate ${activeId === s.id ? 'text-white/70' : 'text-custom-muted'}`}>
                    {s.updated_at ? new Date(s.updated_at).toLocaleString() : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                  className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none px-1 rounded ${
                    activeId === s.id ? 'hover:bg-white/20 text-white/70' : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400'
                  }`}
                  title="Delete session"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Editor — full content area */}
        <div className="flex-1 flex flex-col card-bg border border-custom rounded-xl shadow-sm min-w-0">
          {activeId ? (
            <>
              <div className="px-4 pt-3 pb-2 border-b border-custom">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Session title..."
                  className="w-full bg-transparent text-custom font-semibold placeholder-custom-muted/50 outline-none text-base"
                />
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write anything that comes to mind..."
                className="flex-1 bg-transparent text-custom placeholder-custom-muted/50 p-5 text-base leading-relaxed outline-none resize-none rounded-b-xl"
                style={{ fontFamily: 'inherit', lineHeight: '1.8' }}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-custom-muted text-sm">
              Create a new session to start writing
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-custom-muted mt-3 text-center shrink-0">
        Auto-saves as you type. Each session is a separate free write.
      </p>
    </div>
  )
}

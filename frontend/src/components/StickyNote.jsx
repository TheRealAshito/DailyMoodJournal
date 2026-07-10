import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'

const MIN_HEIGHT = 90
const UPDATE_DELAY = 600

export default function StickyNote() {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const timer = useRef(null)
  const textareaRef = useRef(null)

  // Load note from settings on mount
  useEffect(() => {
    api.get('/settings')
      .then((r) => {
        const content = r.data?.sticky_note || ''
        setNote(content)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  // Auto-save with debounce
  const saveNote = useCallback((content) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setSaving(true)
      api.put('/settings', { sticky_note: content })
        .catch(() => {})
        .finally(() => setSaving(false))
    }, UPDATE_DELAY)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setNote(val)
    saveNote(val)
  }

  function toggle() {
    setExpanded((prev) => {
      if (!prev) {
        // Expanding — focus textarea on next tick
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
      return !prev
    })
  }

  function handleKeyDown(e) {
    // Escape collapses without saving text changes (auto-save already handled)
    if (e.key === 'Escape') {
      setExpanded(false)
      textareaRef.current?.blur()
    }
  }

  const hasNote = note.trim().length > 0

  return (
    <>
      {/* Pin button — always visible on the right edge */}
      <button
        onClick={toggle}
        title={hasNote ? 'View note' : 'Add a note'}
        className={`fixed right-3 top-20 z-50 w-9 h-9 flex items-center justify-center rounded-full shadow-md transition-all duration-200 hover:scale-110
          ${hasNote || expanded
            ? 'bg-amber-200 dark:bg-amber-400/80 text-amber-700 dark:text-amber-900'
            : 'bg-amber-100 dark:bg-amber-300/50 text-amber-500 dark:text-amber-700 hover:bg-amber-200'
          }`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 2H8C6.9 2 6 2.9 6 4v16c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-2v2h2v2h-2v2h-2v-2H9v-2h2v-2H9V9h2V7h2v2h2v2z" />
        </svg>
      </button>

      {/* Post-it overlay */}
      {expanded && (
        <div className="fixed inset-0 z-40" onClick={toggle} />
      )}

      {/* Post-it note */}
      <div
        className={`fixed right-4 z-50 transition-all duration-200 ease-in-out origin-top-right
          ${expanded
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 pointer-events-none translate-y-2'
          }
          top-20`}
        style={{ maxWidth: '300px', width: 'calc(100vw - 2rem)' }}
      >
        <div
          className="relative bg-amber-100 dark:bg-amber-300/20 rounded-lg shadow-xl border border-amber-200 dark:border-amber-400/30"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          {/* Pin icon top-left */}
          <div className="absolute -top-2 -left-2 z-10">
            <svg className="w-5 h-5 text-amber-500 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 2H8C6.9 2 6 2.9 6 4v16c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-2v2h2v2h-2v2h-2v-2H9v-2h2v-2H9V9h2V7h2v2h2v2z" />
            </svg>
          </div>

          {/* Close button */}
          <button
            onClick={toggle}
            className="absolute top-1 right-2 text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 text-lg leading-none z-10"
          >
            &times;
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={note}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a sticky note..."
            className="w-full bg-transparent text-amber-900 dark:text-amber-100 placeholder-amber-400/60 dark:placeholder-amber-600/60 text-sm leading-relaxed p-4 pr-7 outline-none resize-none rounded-lg"
            style={{ minHeight: MIN_HEIGHT, fontFamily: 'inherit' }}
            rows={4}
          />

          {/* Saving indicator */}
          {saving && (
            <div className="absolute bottom-2 right-3">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

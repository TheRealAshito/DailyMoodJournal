import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useI18n } from '../i18n'

const SAVE_DELAY = 800

export default function FreeWrite() {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const timer = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    api.get('/freewrite')
      .then((r) => {
        setContent(r.data.content || '')
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    const words = content.trim()
      ? content.trim().split(/\s+/).length
      : 0
    setWordCount(words)
  }, [content])

  function handleChange(e) {
    const val = e.target.value
    setContent(val)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setSaving(true)
      api.put('/freewrite', { content: val })
        .catch(() => {})
        .finally(() => setSaving(false))
    }, SAVE_DELAY)
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Free Write</h1>
        <div className="flex items-center gap-3 text-xs text-custom-muted">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          {saving && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
        </div>
      </div>

      <div className="card-bg border border-custom rounded-xl shadow-sm">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          placeholder="Write anything that comes to mind..."
          className="w-full min-h-[60vh] bg-transparent text-custom placeholder-custom-muted/50 p-6 text-base leading-relaxed outline-none resize-none rounded-xl"
          style={{ fontFamily: 'inherit', lineHeight: '1.8' }}
        />
      </div>

      <p className="text-xs text-custom-muted mt-3 text-center">
        Auto-saves as you type. No dates, no moods, no tags — just your thoughts.
      </p>
    </div>
  )
}

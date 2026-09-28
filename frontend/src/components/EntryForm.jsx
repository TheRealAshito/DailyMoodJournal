import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'
import MoodSlider from './MoodSlider'
import FormattedDateInput from './FormattedDateInput'

const PROMPT_CATEGORIES = {
  self_reflection: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  gratitude: [0, 1, 2, 3, 4, 5, 6, 7],
  growth_learning: [0, 1, 2, 3, 4, 5, 6, 7],
  emotional_awareness: [0, 1, 2, 3, 4, 5, 6, 7],
  relationships: [0, 1, 2, 3, 4, 5, 6, 7],
  goals_purpose: [0, 1, 2, 3, 4, 5, 6, 7],
  mindfulness: [0, 1, 2, 3, 4, 5, 6, 7],
  resilience: [0, 1, 2, 3, 4, 5, 6, 7],
}

function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function localTimeStr(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function EntryForm() {
  const { t } = useI18n()
  const { encodedPath } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlDate = searchParams.get('date')
  const now = new Date()
  const [settings, setSettings] = useState({ reflection_categories: ['self_reflection', 'gratitude', 'growth_learning', 'emotional_awareness'] })
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState(3)
  const [selectedTags, setSelectedTags] = useState([])
  const [body, setBody] = useState('')
  const [edate, setEdate] = useState(urlDate || localDateStr(now))
  const [etime, setEtime] = useState(localTimeStr(now))
  const [includePrompts, setIncludePrompts] = useState(false)
  const [prompts, setPrompts] = useState([])
  const [responses, setResponses] = useState([])
  const [scaleValues, setScaleValues] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!encodedPath)

  const isEditing = !!encodedPath

  // --- Draft autosave (persists unsaved form state, like FreeWrite) ---
  const SAVE_DELAY = 2000
  const draftKey = isEditing ? decodeURIComponent(encodedPath) : 'new'
  const draftTimer = useRef(null)
  const initialEntry = useRef(null)      // pristine entry state (for discard while editing)
  const skipNextAutosave = useRef(false) // don't re-save right after restoring a draft
  const [draftReady, setDraftReady] = useState(false)
  const [draftStatus, setDraftStatus] = useState('') // '' | 'saving' | 'saved'
  const [restoredAt, setRestoredAt] = useState(null) // updated_at of restored draft

  // Always-fresh snapshot for flush-on-hide listeners
  const latestPayload = useRef({})
  latestPayload.current = {
    title, body, mood, tags: selectedTags, scales: scaleValues,
    date: edate, time: etime,
    include_prompts: includePrompts, prompts, responses,
  }
  const draftReadyRef = useRef(false)
  draftReadyRef.current = draftReady

  useEffect(() => {
    api.get('/settings')
      .then((r) => setSettings(r.data))
      .catch(() => {})
  }, [])

  function applyForm(s) {
    setTitle(s.title || '')
    setBody(s.body || '')
    setMood(s.mood ?? 3)
    setSelectedTags(s.tags || [])
    setScaleValues(s.scales || {})
    if (s.date) setEdate(s.date)
    if (s.time) setEtime(s.time)
    setIncludePrompts(!!s.include_prompts)
    setPrompts(s.prompts || [])
    setResponses(s.responses || [])
  }

  function hasDraftContent(p) {
    return Boolean(
      (p.title || '').trim() || (p.body || '').trim() ||
      (p.responses || []).some((r) => (r || '').trim()) ||
      (p.tags || []).length > 0 || Object.keys(p.scales || {}).length > 0
    )
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isEditing) {
        const path = decodeURIComponent(encodedPath)
        try {
          const r = await api.get(`/entries/${encodeURIComponent(path)}`)
          if (cancelled) return
          const e = r.data
          let date = e.date?.slice(0, 10) || localDateStr(new Date())
          let time = e.date?.slice(11, 16) || localTimeStr(new Date())
          try {
            const dt = new Date(e.date)
            date = localDateStr(dt)
            time = localTimeStr(dt)
          } catch {}
          initialEntry.current = {
            title: e.title || '', body: e.body || '', mood: e.mood ?? 3,
            tags: e.tags || [], scales: e.scales || {}, date, time,
            include_prompts: false, prompts: [], responses: [],
          }
          applyForm(initialEntry.current)
        } catch {
          if (!cancelled) { setError('Failed to load entry.'); setFetching(false) }
          return
        }
      }
      // Restore an unsaved draft (new entry or this edit) if one exists
      try {
        const dr = await api.get(`/drafts/${encodeURIComponent(draftKey)}`)
        if (cancelled) return
        if (dr.data?.payload) {
          skipNextAutosave.current = true
          applyForm(dr.data.payload)
          setRestoredAt(dr.data.updated_at || null)
        }
      } catch {}
      if (!cancelled) {
        setFetching(false)
        setDraftReady(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [encodedPath, isEditing])

  // Debounced draft autosave whenever the form changes
  useEffect(() => {
    if (!draftReady) return
    if (skipNextAutosave.current) { skipNextAutosave.current = false; return }
    const payload = latestPayload.current
    if (!hasDraftContent(payload)) return
    if (draftTimer.current) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      setDraftStatus('saving')
      api.put(`/drafts/${encodeURIComponent(draftKey)}`, payload)
        .then(() => setDraftStatus('saved'))
        .catch(() => {})
    }, SAVE_DELAY)
    return () => clearTimeout(draftTimer.current)
  }, [title, body, mood, selectedTags, scaleValues, edate, etime, includePrompts, prompts, responses, draftReady, draftKey])

  // Flush the draft immediately when the page is hidden or closed
  // (mobile app switches kill the page before the debounce fires)
  useEffect(() => {
    function flush() {
      if (draftTimer.current) { clearTimeout(draftTimer.current); draftTimer.current = null }
      const payload = latestPayload.current
      if (!draftReadyRef.current || !hasDraftContent(payload)) return
      setDraftStatus('saving')
      // keepalive fetch survives page teardown on mobile app switches
      // (a cancelled axios request would lose the last keystrokes)
      fetch(`/api/drafts/${encodeURIComponent(draftKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify(payload),
      })
        .then((r) => { if (r.ok) setDraftStatus('saved') })
        .catch(() => {})
    }
    function onVisibility() { if (document.hidden) flush() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [draftKey])

  async function handleDiscardDraft() {
    try { await api.delete(`/drafts/${encodeURIComponent(draftKey)}`) } catch {}
    setRestoredAt(null)
    setDraftStatus('')
    skipNextAutosave.current = true
    if (isEditing && initialEntry.current) {
      applyForm(initialEntry.current)
    } else {
      applyForm({})
    }
  }

  function togglePrompts() {
    if (!includePrompts) {
      const cats = settings.reflection_categories || ['self_reflection', 'gratitude', 'growth_learning', 'emotional_awareness']
      const prompts = cats.map((cat) => {
        const pool = PROMPT_CATEGORIES[cat] || PROMPT_CATEGORIES.self_reflection
        const idx = pool[Math.floor(Math.random() * pool.length)]
        return { category: cat, key: `prompt_${cat}_${idx}` }
      })
      setPrompts(prompts)
      setResponses(prompts.map(() => ''))
    }
    setIncludePrompts(!includePrompts)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required.'); return }
    setLoading(true)

    const tagList = selectedTags
    const dateTime = `${edate}T${etime}:00`

    let fullBody = body
    if (includePrompts && prompts.length > 0) {
      const lines = []
      lines.push('## Reflection')
      prompts.forEach((p, i) => {
        lines.push('')
        lines.push(`**${t(p.key)}**`)
        lines.push(`${responses[i] || ''}`)
      })
      lines.push('')
      lines.push('---')
      fullBody = lines.join('\n') + '\n\n' + fullBody
    }

    const payload = { title: title.trim(), date: dateTime, mood, tags: tagList, body: fullBody, scales: scaleValues }

    try {
      if (isEditing) {
        const path = decodeURIComponent(encodedPath)
        await api.put(`/entries/${encodeURIComponent(path)}`, payload)
      } else {
        await api.post('/entries', payload)
      }
      // Entry saved — the draft is no longer needed
      try { await api.delete(`/drafts/${encodeURIComponent(draftKey)}`) } catch {}
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">{isEditing ? t('edit') : t('new_entry')}</h1>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      {restoredAt && (
        <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 mb-4 text-sm flex items-center justify-between gap-3">
          <span>{t('draft_restored')}{restoredAt.length > 10 ? ` (${restoredAt.slice(11, 16)})` : ''}</span>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="px-3 py-1.5 rounded-lg border-custom bg-custom-secondary text-custom text-xs font-medium hover-bg whitespace-nowrap"
          >
            {t('draft_discard')}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">{t('title')}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400" autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('date')}</label>
            <FormattedDateInput value={edate} onChange={setEdate} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('time')}</label>
            <input type="time" value={etime} onChange={(e) => setEtime(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
        </div>

        <MoodSlider value={mood} onChange={setMood} disabled={false} />

        {(settings.custom_scales || []).length > 0 && (
          <div className="space-y-4">
            {(settings.custom_scales || []).map((scale) => (
              <div key={scale.name}>
                <label className="block text-sm font-medium mb-1">
                  {scale.name}
                  <span className="ml-2 text-xs text-custom-muted">{scaleValues[scale.name] ?? Math.round((scale.min + scale.max) / 2)} / {scale.max}</span>
                </label>
                <input
                  type="range"
                  min={scale.min}
                  max={scale.max}
                  step={scale.step || 1}
                  value={scaleValues[scale.name] ?? Math.round((scale.min + scale.max) / 2)}
                  onChange={(e) => setScaleValues({ ...scaleValues, [scale.name]: parseInt(e.target.value, 10) })}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-custom-secondary accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-custom-muted mt-0.5">
                  <span>{scale.min}</span>
                  <span>{scale.max}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">{t('tags')}</label>
          <div className="flex flex-wrap gap-2">
            {(settings.tags?.[settings.language] || settings.tags?.en || []).map((tag) => {
              const active = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (active) {
                      setSelectedTags(selectedTags.filter((t) => t !== tag))
                    } else {
                      setSelectedTags([...selectedTags, tag])
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    active
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'bg-custom-secondary border border-custom text-custom hover:border-cyan-400'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
          {selectedTags.length > 0 && (
            <p className="text-xs text-custom-muted mt-1">{selectedTags.join(', ')}</p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2 cursor-pointer">
            <input type="checkbox" checked={includePrompts} onChange={togglePrompts} className="w-4 h-4 accent-cyan-500" />
            {t('include_reflection')}
          </label>

          {includePrompts && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-4 text-sm">
              <p className="font-medium text-indigo-700 dark:text-indigo-300">{t('reflection_tip')}</p>
            </div>
          )}

          {includePrompts && prompts.map((p, i) => (
            <div key={i} className="mb-3">
              <p className="text-sm font-medium text-indigo-600 mb-1">{t(p.key)}</p>
              <textarea
                value={responses[i]}
                onChange={(e) => {
                  const copy = [...responses]
                  copy[i] = e.target.value
                  setResponses(copy)
                }}
                rows={2}
                placeholder={t('reflection_placeholder')}
                className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('body')}</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Write your thoughts here..." className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400" />
        </div>

        <div className="flex gap-3 items-center">
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50">
            {loading ? '...' : t('save')}
          </button>
          <button type="button" onClick={() => navigate('/')} className="px-6 py-2.5 border-custom bg-custom-secondary text-custom rounded-lg font-medium hover-bg">
            {t('cancel')}
          </button>
          <span className="text-xs text-custom-muted">
            {draftStatus === 'saving' ? t('draft_saving') : draftStatus === 'saved' ? t('draft_saved') : ''}
          </span>
        </div>
      </form>
    </div>
  )
}

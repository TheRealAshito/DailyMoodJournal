import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'
import MoodSlider from './MoodSlider'

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

export default function EntryForm() {
  const { t } = useI18n()
  const { encodedPath } = useParams()
  const navigate = useNavigate()
  const [settings, setSettings] = useState({ reflection_categories: ['self_reflection', 'gratitude', 'growth_learning', 'emotional_awareness'] })
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState(3)
  const [tags, setTags] = useState('')
  const [body, setBody] = useState('')
  const [edate, setEdate] = useState(new Date().toISOString().slice(0, 10))
  const [etime, setEtime] = useState(new Date().toTimeString().slice(0, 5))
  const [includePrompts, setIncludePrompts] = useState(false)
  const [prompts, setPrompts] = useState([])
  const [responses, setResponses] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!encodedPath)

  const isEditing = !!encodedPath

  useEffect(() => {
    api.get('/settings')
      .then((r) => setSettings(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEditing) return
    const path = decodeURIComponent(encodedPath)
    api.get(`/entries/${encodeURIComponent(path)}`)
      .then((r) => {
        const e = r.data
        setTitle(e.title || '')
        setMood(e.mood ?? 3)
        setTags((e.tags || []).join(', '))
        setBody(e.body || '')
        try {
          const dt = new Date(e.date)
          setEdate(dt.toISOString().slice(0, 10))
          setEtime(dt.toTimeString().slice(0, 5))
        } catch {
          setEdate(e.date?.slice(0, 10) || new Date().toISOString().slice(0, 10))
        }
      })
      .catch(() => setError('Failed to load entry.'))
      .finally(() => setFetching(false))
  }, [encodedPath, isEditing])

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

    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
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

    const payload = { title: title.trim(), date: dateTime, mood, tags: tagList, body: fullBody }

    try {
      if (isEditing) {
        const path = decodeURIComponent(encodedPath)
        await api.put(`/entries/${encodeURIComponent(path)}`, payload)
      } else {
        await api.post('/entries', payload)
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">{isEditing ? t('edit') : t('new_entry')}</h1>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">{t('title')}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('date')}</label>
            <input type="date" value={edate} onChange={(e) => setEdate(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('time')}</label>
            <input type="time" value={etime} onChange={(e) => setEtime(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>

        <MoodSlider value={mood} onChange={setMood} disabled={false} />

        <div>
          <label className="block text-sm font-medium mb-1">{t('tags')}</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="work, gratitude, reflection" className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2 cursor-pointer">
            <input type="checkbox" checked={includePrompts} onChange={togglePrompts} className="w-4 h-4 accent-purple-600" />
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
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Write your thoughts here..." className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
            {loading ? '...' : t('save')}
          </button>
          <button type="button" onClick={() => navigate('/')} className="px-6 py-2.5 border-custom bg-custom-secondary text-custom rounded-lg font-medium hover-bg">
            {t('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}

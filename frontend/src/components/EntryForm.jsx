import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'
import MoodSlider from './MoodSlider'

const COGNITIVE_DISTORTIONS = {
  catastrophizing: { name: 'Catastrophizing', description: 'Expecting the worst-case scenario to happen, even when there is little evidence.' },
  black_and_white: { name: 'Black-and-White Thinking', description: 'Seeing situations in only two categories instead of on a spectrum.' },
  overgeneralization: { name: 'Overgeneralization', description: 'Taking a single negative event and seeing it as a never-ending pattern.' },
  mental_filter: { name: 'Mental Filtering', description: 'Dwelling exclusively on one negative detail while ignoring positives.' },
  mind_reading: { name: 'Mind Reading', description: 'Assuming you know what others are thinking without evidence.' },
  fortune_telling: { name: 'Fortune Telling', description: 'Predicting a negative outcome will happen as if it were a fact.' },
  emotional_reasoning: { name: 'Emotional Reasoning', description: 'Believing that because you feel a certain way, it must be true.' },
  labeling: { name: 'Labeling', description: 'Attaching a global negative label to yourself or others.' },
  personalization: { name: 'Personalization', description: 'Taking responsibility for events not entirely under your control.' },
  should_statements: { name: '"Should" Statements', description: 'Holding yourself to rigid rules about how you or others "should" behave.' },
}

const CBT_PROMPTS = {
  distortions: [
    'Which cognitive distortion might be at play here?',
    'What would you say to a close friend who had this exact thought?',
    'What evidence contradicts this belief?',
    'Are you treating a feeling as if it were a fact?',
  ],
  gratitude: [
    'What went well today, even if small?',
    'What are you grateful for right now?',
    'What skill or strength did you use today?',
  ],
  reframing: [
    'How might this look different a month from now?',
    'What can you learn from this experience?',
    'What would your compassionate self say?',
  ],
}

function getRandomPrompt(category) {
  const prompts = CBT_PROMPTS[category] || CBT_PROMPTS.distortions
  return prompts[Math.floor(Math.random() * prompts.length)]
}

export default function EntryForm() {
  const { t } = useI18n()
  const { encodedPath } = useParams()
  const navigate = useNavigate()
  const [settings, setSettings] = useState({ cbt_enabled_categories: ['distortions', 'reframing'], cbt_show_education: true })
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState(3)
  const [tags, setTags] = useState('')
  const [body, setBody] = useState('')
  const [edate, setEdate] = useState(new Date().toISOString().slice(0, 10))
  const [etime, setEtime] = useState(new Date().toTimeString().slice(0, 5))
  const [includeCBT, setIncludeCBT] = useState(false)
  const [cbtPrompts, setCbtPrompts] = useState([])
  const [cbtResponses, setCbtResponses] = useState([])
  const [distortion, setDistortion] = useState(null)
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

  function toggleCBT() {
    if (!includeCBT) {
      const distortions = Object.values(COGNITIVE_DISTORTIONS)
      const randomDist = distortions[Math.floor(Math.random() * distortions.length)]
      setDistortion(randomDist)
      const categories = settings.cbt_enabled_categories || ['distortions', 'reframing']
      const prompts = categories.map((cat) => ({
        category: cat,
        text: getRandomPrompt(cat),
      }))
      setCbtPrompts(prompts)
      setCbtResponses(prompts.map(() => ''))
    }
    setIncludeCBT(!includeCBT)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required.'); return }
    setLoading(true)

    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    const dateTime = `${edate}T${etime}:00`

    let fullBody = body
    if (includeCBT && cbtPrompts.length > 0) {
      const lines = []
      lines.push('## CBT Reflection')
      lines.push(`**Distortion**: ${distortion?.name || ''}`)
      cbtPrompts.forEach((p, i) => {
        lines.push('')
        lines.push(`**Prompt**: ${p.text}`)
        lines.push(`**Response**: ${cbtResponses[i] || ''}`)
      })
      lines.push('')
      lines.push('---')
      fullBody = lines.join('\\n') + '\\n\\n' + fullBody
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
            <input type="checkbox" checked={includeCBT} onChange={toggleCBT} className="w-4 h-4 accent-purple-600" />
            {t('include_cbt')}
          </label>

          {includeCBT && distortion && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-4 text-sm">
              <p className="font-semibold text-purple-700 dark:text-purple-300">Cognitive Distortion — {distortion.name}</p>
              <p className="text-custom-muted mt-1">{distortion.description}</p>
            </div>
          )}

          {includeCBT && cbtPrompts.map((p, i) => (
            <div key={i} className="mb-3">
              <p className="text-sm font-medium text-purple-600 mb-1">{p.text}</p>
              <textarea
                value={cbtResponses[i]}
                onChange={(e) => {
                  const copy = [...cbtResponses]
                  copy[i] = e.target.value
                  setCbtResponses(copy)
                }}
                rows={2}
                placeholder="Write your response here..."
                className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
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

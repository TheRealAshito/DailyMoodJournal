import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'
import EntryCard from './EntryCard'

const MOOD_COLORS = ['#4a148c', '#6a1b9a', '#9c27b0', '#9e9e9e', '#66bb6a', '#43a047', '#2e7d32']

const DAY_KEYS = ['day_0','day_1','day_2','day_3','day_4','day_5','day_6']

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()
  const adjustedStart = startDow === 0 ? 6 : startDow - 1
  const grid = []
  let week = []
  for (let i = 0; i < adjustedStart; i++) week.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(d)
    if (week.length === 7) {
      grid.push(week)
      week = []
    }
  }
  if (week.length > 0) grid.push(week)
  return grid
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function Calendar() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [entries, setEntries] = useState([])
  const [moodByDay, setMoodByDay] = useState({})
  const [selectedDate, setSelectedDate] = useState(localDateStr(today))
  const [dayEntries, setDayEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/entries?year=${year}&month=${month + 1}`)
      .then((r) => {
        const items = r.data.entries || []
        setEntries(items)
        const byDay = {}
        items.forEach((e) => {
          const d = e.date.slice(0, 10)
          if (!byDay[d]) byDay[d] = []
          byDay[d].push(e.mood)
        })
        setMoodByDay(byDay)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => {
    api.get(`/entries/day/${selectedDate}`)
      .then((r) => setDayEntries(r.data.entries || []))
      .catch(() => setDayEntries([]))
  }, [selectedDate])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  function dayMood(day) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const moods = moodByDay[key]
    if (!moods || moods.length === 0) return null
    return moods[0]
  }

  const grid = getMonthGrid(year, month)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">{t('journal')}</h1>
        <button onClick={() => navigate('/new')} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors">
          {t('new_entry')}
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-3 py-1 rounded-lg text-sm border-custom bg-custom-secondary text-custom hover-bg">{t('prev')}</button>
        <h2 className="text-lg font-semibold">{t(`month_${month}`)} {year}</h2>
        <button onClick={nextMonth} className="px-3 py-1 rounded-lg text-sm border-custom bg-custom-secondary text-custom hover-bg">{t('next')}</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5 mb-6">
          {DAY_KEYS.map((k) => (
            <div key={k} className="text-center text-xs text-custom-muted font-medium py-2">{t(k)}</div>
          ))}
          {grid.flat().map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />
            const mood = dayMood(day)
            const color = mood !== null ? MOOD_COLORS[mood] : 'transparent'
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateKey === localDateStr(today)
            return (
              <button
                key={`day-${day}`}
                onClick={() => navigate(`/new?date=${dateKey}`)}
                className="calendar-cell aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium transition-all hover:ring-2 hover:ring-purple-400"
                style={{ backgroundColor: mood !== null ? color : undefined }}
              >
                <span className={mood !== null || isToday ? 'text-white drop-shadow-md' : 'text-custom'}>{day}</span>
                {isToday && !mood && <div className="w-1 h-1 rounded-full bg-purple-600 mt-0.5" />}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {MOOD_COLORS.map((color, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: color }}>{i}</span>
        ))}
      </div>

      <div className="mb-4">
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
      </div>

      <h3 className="font-semibold mb-3">{t('entries_for')} {selectedDate}</h3>

      {dayEntries.length === 0 ? (
        <p className="text-custom-muted text-sm">{t('no_entries')} <button onClick={() => navigate('/new')} className="text-purple-600 hover:underline">{t('write_one')}</button></p>
      ) : (
        <div className="space-y-3">
          {dayEntries.map((entry) => (
            <EntryCard key={entry.path} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

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
  const todayStr = localDateStr(today)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-custom">{t('journal')}</h1>
          <p className="text-sm text-custom-muted mt-0.5">{t('total_entries')}: {entries.length}</p>
        </div>
        <button onClick={() => navigate('/new')} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-all shadow-sm hover:shadow-md active:scale-95">
          + {t('new_entry')}
        </button>
      </div>

      {/* Calendar card */}
      <div className="card-bg border border-custom rounded-2xl p-5 mb-6 shadow-sm">
        {/* Month navigator */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl border border-custom bg-custom-secondary text-custom hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>

          <div className="text-center">
            <h2 className="text-lg font-bold text-custom">{t(`month_${month}`)} <span className="text-custom-muted font-normal">{year}</span></h2>
          </div>

          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl border border-custom bg-custom-secondary text-custom hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_KEYS.map((k) => (
                <div key={k} className="text-center text-xs font-semibold text-custom-muted uppercase tracking-wide py-1">{t(k)}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {grid.flat().map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />

                const mood = dayMood(day)
                const color = mood !== null ? MOOD_COLORS[mood] : null
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = dateKey === todayStr
                const isSelected = dateKey === selectedDate

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setSelectedDate(dateKey)}
                    onDoubleClick={() => navigate(`/new?date=${dateKey}`)}
                    className={`
                      relative flex flex-col items-center justify-center py-2 rounded-xl text-sm font-medium transition-all
                      ${isSelected ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' : color ? 'ring-2' : ''}
                      ${isToday && !isSelected ? 'ring-1 ring-purple-300' : ''}
                      ${!isSelected && !isToday ? 'hover:bg-custom-secondary' : ''}
                    `}
                    style={color && !isSelected ? { '--tw-ring-color': color } : {}}
                  >
                    <span className={`${isToday ? 'text-purple-600 font-bold' : 'text-custom'}`}>{day}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Mood legend */}
      <div className="flex flex-wrap items-center gap-3 mb-6 px-1">
        <span className="text-xs font-medium text-custom-muted mr-1">{t('mood')}:</span>
        {MOOD_COLORS.map((color, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs text-custom-muted">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {i}
          </span>
        ))}
      </div>

      {/* Selected day entries */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-custom">
            {t('entries_for')}
            <span className="ml-2 text-custom-muted font-normal text-sm">{selectedDate}</span>
          </h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {dayEntries.length === 0 ? (
          <div className="card-bg border border-custom rounded-2xl p-8 text-center">
            <p className="text-custom-muted text-sm mb-3">{t('no_entries')}</p>
            <button onClick={() => navigate('/new')} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">{t('write_one')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {dayEntries.map((entry) => (
              <EntryCard key={entry.path} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

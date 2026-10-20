import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'
import { useConstants } from '../contexts/ConstantsContext'
import { useDateFormat } from '../contexts/DateFormatContext'
import EntryCard from './EntryCard'
import FormattedDateInput from './FormattedDateInput'

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
  const { mood_colors: MOOD_COLORS } = useConstants()
  const { formatDate } = useDateFormat()
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
      {/* Header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="display text-2xl">{t('journal')}</h1>
          <p className="text-sm text-custom-muted mt-0.5">{t('total_entries')}: {entries.length}</p>
        </div>
        {/* Desktop: inline button. Mobile: hidden (FAB below) */}
        <button
          onClick={() => navigate('/new')}
          className="btn btn-primary max-sm:!hidden"
        >
          + {t('new_entry')}
        </button>
      </div>

      {/* Calendar card */}
      <div className="card p-3 sm:p-5 mb-6">
        {/* Month navigator */}
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <button onClick={prevMonth} className="btn btn-secondary w-9 h-9 !p-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>

          <div className="text-center">
            <h2 className="display text-lg">{t(`month_${month}`)} <span className="text-custom-muted font-normal">{year}</span></h2>
          </div>

          <button onClick={nextMonth} className="btn btn-secondary w-9 h-9 !p-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="spin" /></div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_KEYS.map((k) => (
                <div key={k} className="text-center text-xs font-semibold text-custom-muted uppercase tracking-wide py-1">{t(k)}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
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
                    className={`calendar-cell
                      relative flex flex-col items-center justify-center py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all
                      ${isSelected ? 'ring-2 bg-accent-soft' : color ? 'ring-2' : isToday ? 'ring-1' : ''}
                      ${!isSelected && !isToday ? 'hover-bg' : ''}
                    `}
                    style={
                      isSelected ? { '--tw-ring-color': 'var(--accent)' } :
                      color ? { '--tw-ring-color': color } :
                      isToday ? { '--tw-ring-color': 'var(--accent)' } : {}
                    }
                  >
                    <span className={`${isToday ? 'text-accent font-bold' : 'text-custom'}`}>{day}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Mood legend */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 px-1">
        <span className="text-xs font-medium text-custom-muted mr-1">{t('mood')}:</span>
        {Object.entries(MOOD_COLORS).map(([i, color]) => (
          <span key={i} className="inline-flex items-center gap-1 text-xs text-custom-muted">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: color }} />
            {i}
          </span>
        ))}
      </div>

      {/* Selected day entries */}
      <div className="mb-4">
        {/* Stacks on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h3 className="section-title">
            {t('entries_for')}
            <span className="ml-2 text-custom-muted font-normal text-sm">{formatDate(selectedDate)}</span>
          </h3>
          <FormattedDateInput
            value={selectedDate}
            onChange={(iso) => setSelectedDate(iso)}
            className="input input-compact !pr-9"
          />
        </div>

        {dayEntries.length === 0 ? (
          <div className="card p-6 sm:p-8 text-center">
            <p className="text-custom-muted text-sm mb-3">{t('no_entries')}</p>
            <button onClick={() => navigate('/new')} className="btn btn-primary">{t('write_one')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {dayEntries.map((entry) => (
              <EntryCard key={entry.path} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB — fixed bottom-right */}
      <button
        onClick={() => navigate('/new')}
        className="btn btn-primary fixed bottom-6 right-6 z-30 w-14 h-14 !p-0 !rounded-full sm:!hidden"
        aria-label={t('new_entry')}
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}

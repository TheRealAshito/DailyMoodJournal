import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import api from '../api'
import { useI18n } from '../i18n'
import { useConstants } from '../contexts/ConstantsContext'

const DAY_KEYS = ['day_0','day_1','day_2','day_3','day_4','day_5','day_6']

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="card-bg border border-custom rounded-lg p-2 text-sm shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-custom-muted">{p.name}: {p.value}</p>
        ))}
      </div>
    )
  }
  return null
}

export default function Stats() {
  const { t, locale } = useI18n()
  const { mood_colors: MOOD_COLORS } = useConstants()

  // Filter state
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [period, setPeriod] = useState('day')
  const [allTags, setAllTags] = useState([])

  // Data
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch available tags for filter
  useEffect(() => {
    api.get('/entries/tags/all')
      .then((r) => setAllTags(r.data.tags || []))
      .catch(() => {})
  }, [])

  // Build query string and fetch stats
  const fetchStats = useCallback(() => {
    setLoading(true)
    let url = `/stats?period=${period}`
    if (fromDate) url += `&from_date=${fromDate}`
    if (toDate) url += `&to_date=${toDate}`
    if (selectedTags.length > 0) url += `&tags=${selectedTags.join(',')}`
    api.get(url)
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [period, fromDate, toDate, selectedTags])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  function toggleTag(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  // Loading state
  if (!stats && loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Empty state
  if (!stats || stats.total_entries === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">{t('stats')}</h1>
        <div className="card-bg border border-custom rounded-xl p-6 mb-6">
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <label className="block text-xs text-custom-muted mb-1">{t('date_range')} — from</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
            <div>
              <label className="block text-xs text-custom-muted mb-1">{t('date_range')} — to</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
            <button onClick={fetchStats}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">
              {t('search')}
            </button>
          </div>
        </div>
        <p className="text-custom-muted">{t('no_entries')}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">{t('stats')}</h1>

      {/* Filter bar */}
      <div className="card-bg border border-custom rounded-xl p-5 mb-6 space-y-4">
        {/* Date range + Period + Search */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-custom-muted mb-1">{t('date_range')} — {t('date')} from</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
          <div>
            <label className="block text-xs text-custom-muted mb-1">{t('date_range')} — to</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
          <div>
            <label className="block text-xs text-custom-muted mb-1">{t('period')}</label>
            <div className="flex gap-1">
              {['day', 'week', 'month'].map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p ? 'bg-cyan-500 text-white' : 'border border-custom text-custom hover-bg'
                  }`}>
                  {t(p === 'day' ? 'daily' : p === 'week' ? 'weekly' : 'monthly')}
                </button>
              ))}
            </div>
          </div>
          <button onClick={fetchStats}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">
            {t('search')}
          </button>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div>
            <label className="block text-xs text-custom-muted mb-1">{t('filter_by_tags')}</label>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedTags.includes(tag) ? 'bg-cyan-500 text-white' : 'border border-custom text-custom hover:border-cyan-400'
                  }`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card-bg border border-custom rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{stats.total_entries}</p>
              <p className="text-xs text-custom-muted">{t('total_entries')}</p>
            </div>
            <div className="card-bg border border-custom rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{stats.avg_mood}/6</p>
              <p className="text-xs text-custom-muted">{t('avg_mood')}</p>
            </div>
            <div className="card-bg border border-custom rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{stats.current_streak}</p>
              <p className="text-xs text-custom-muted">{t('current_streak')}</p>
            </div>
            <div className="card-bg border border-custom rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{stats.longest_streak}</p>
              <p className="text-xs text-custom-muted">{t('longest_streak')}</p>
            </div>
          </div>

          {/* Mood over time */}
          {stats.mood_by_date && stats.mood_by_date.length > 0 && (
            <div className="card-bg border border-custom rounded-xl p-4 mb-6">
              <h3 className="font-semibold mb-4">{t('mood_over_time')}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.mood_by_date}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-custom-muted/20" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis domain={[0, 6]} ticks={[0, 1, 2, 3, 4, 5, 6]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avg_mood" name="Mood" radius={[4, 4, 0, 0]}>
                    {stats.mood_by_date.map((entry, index) => (
                      <Cell key={index} fill={MOOD_COLORS[Math.round(entry.avg_mood)] || MOOD_COLORS[3]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Tag mood correlation */}
            {stats.tag_mood_correlation && stats.tag_mood_correlation.length > 0 && (
              <div className="card-bg border border-custom rounded-xl p-4">
                <h3 className="font-semibold mb-4">{t('tag_mood_correlation')}</h3>
                <ResponsiveContainer width="100%" height={Math.max(150, stats.tag_mood_correlation.length * 40)}>
                  <BarChart data={stats.tag_mood_correlation} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-custom-muted/20" />
                    <XAxis type="number" domain={[0, 6]} ticks={[0, 1, 2, 3, 4, 5, 6]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="tag" tick={{ fontSize: 11 }} width={75} />
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="card-bg border border-custom rounded-lg p-2 text-sm shadow-lg">
                          <p className="font-medium">{payload[0].payload.tag}</p>
                          <p className="text-custom-muted">{t('avg_mood_per_tag')}: {payload[0].value}/6</p>
                          <p className="text-custom-muted">{t('entries_with_tag')}: {payload[0].payload.count}</p>
                        </div>
                      ) : null
                    } />
                    <Bar dataKey="avg_mood" name={t('avg_mood_per_tag')} radius={[0, 4, 4, 0]}>
                      {stats.tag_mood_correlation.map((entry, i) => (
                        <Cell key={i} fill={MOOD_COLORS[Math.round(entry.avg_mood)] || MOOD_COLORS[3]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Day of week */}
            {stats.day_of_week_mood && stats.day_of_week_mood.length > 0 && (
              <div className="card-bg border border-custom rounded-xl p-4">
                <h3 className="font-semibold mb-4">{t('day_of_week_mood')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.day_of_week_mood.map((d) => ({
                    ...d,
                    day_label: t(DAY_KEYS[d.day_index]),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-custom-muted/20" />
                    <XAxis dataKey="day_label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 6]} ticks={[0, 1, 2, 3, 4, 5, 6]} tick={{ fontSize: 11 }} />
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="card-bg border border-custom rounded-lg p-2 text-sm shadow-lg">
                          <p className="font-medium">{payload[0].payload.day_label}</p>
                          <p className="text-custom-muted">{t('avg_mood')}: {payload[0].value}/6</p>
                          <p className="text-custom-muted">{t('total_entries')}: {payload[0].payload.count}</p>
                        </div>
                      ) : null
                    } />
                    <Bar dataKey="avg_mood" name={t('avg_mood')} radius={[4, 4, 0, 0]}>
                      {stats.day_of_week_mood.map((entry, i) => (
                        <Cell key={i} fill={MOOD_COLORS[Math.round(entry.avg_mood)] || MOOD_COLORS[3]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Mood distribution */}
            {stats.mood_distribution && stats.mood_distribution.length > 0 && (
              <div className="card-bg border border-custom rounded-xl p-4">
                <h3 className="font-semibold mb-4">{t('mood_distribution')}</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.mood_distribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-custom-muted/20" />
                    <XAxis dataKey="mood" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="card-bg border border-custom rounded-lg p-2 text-sm shadow-lg">
                          <p className="font-medium">{t(`mood_${payload[0].payload.mood}`)} ({payload[0].payload.mood})</p>
                          <p className="text-custom-muted">{t('total_entries')}: {payload[0].value}</p>
                        </div>
                      ) : null
                    } />
                    <Bar dataKey="count" name={t('total_entries')} radius={[4, 4, 0, 0]}>
                      {stats.mood_distribution.map((entry, index) => (
                        <Cell key={index} fill={MOOD_COLORS[index] || MOOD_COLORS[3]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tag frequency */}
            {stats.tag_frequency && stats.tag_frequency.length > 0 && (
              <div className="card-bg border border-custom rounded-xl p-4">
                <h3 className="font-semibold mb-4">{t('tag_frequency')}</h3>
                <ResponsiveContainer width="100%" height={Math.max(150, stats.tag_frequency.length * 35)}>
                  <BarChart data={stats.tag_frequency} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-custom-muted/20" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="tag" tick={{ fontSize: 11 }} width={75} />
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="card-bg border border-custom rounded-lg p-2 text-sm shadow-lg">
                          <p className="font-medium">{payload[0].payload.tag}</p>
                          <p className="text-custom-muted">{t('usage_count')}: {payload[0].value}</p>
                        </div>
                      ) : null
                    } />
                    <Bar dataKey="count" name={t('usage_count')} radius={[0, 4, 4, 0]} fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Custom scales */}
          {stats.scales_by_date && Object.keys(stats.scales_by_date).length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Custom Scales</h2>
              {Object.entries(stats.scales_by_date).map(([scaleName, data]) => (
                <div key={scaleName} className="card-bg border border-custom rounded-xl p-4 mb-4">
                  <h3 className="font-semibold mb-4">{scaleName}</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-custom-muted/20" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="card-bg border border-custom rounded-lg p-2 text-sm shadow-lg">
                            <p className="font-medium">{label}</p>
                            <p className="text-custom-muted">{scaleName}: {payload[0].value}</p>
                          </div>
                        ) : null
                      } />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

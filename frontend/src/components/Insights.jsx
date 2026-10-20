import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import api from '../api'
import { useI18n } from '../i18n'
import { useConstants } from '../contexts/ConstantsContext'
import EntryCard from './EntryCard'
import FormattedDateInput from './FormattedDateInput'

const DAY_KEYS = ['day_0', 'day_1', 'day_2', 'day_3', 'day_4', 'day_5', 'day_6']

const tickProps = { fontSize: 11, fill: 'var(--text-muted)' }

const ChartTooltipCard = ({ title, lines }) => (
  <div className="card p-2 text-sm shadow-lg">
    <p className="font-medium">{title}</p>
    {lines.map((line, i) => (
      <p key={i} className="text-custom-muted">{line}</p>
    ))}
  </div>
)

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <ChartTooltipCard
        title={label}
        lines={payload.map((p) => `${p.name}: ${p.value}`)}
      />
    )
  }
  return null
}

export default function Insights() {
  const { t } = useI18n()
  const { mood_colors: MOOD_COLORS } = useConstants()

  // Shared filter state (drives charts AND matching entries)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [period, setPeriod] = useState('day')
  const [allTags, setAllTags] = useState([])

  // Data
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [results, setResults] = useState([])
  const [resultsLoading, setResultsLoading] = useState(true)

  const hasActiveFilters = Boolean(fromDate || toDate || selectedTags.length > 0)

  // Fetch available tags for the filter chips
  useEffect(() => {
    api.get('/entries/tags/all')
      .then((r) => setAllTags(r.data.tags || []))
      .catch(() => {})
  }, [])

  // Fetch stats + matching entries together, driven by the shared filters
  const fetchData = useCallback(() => {
    setStatsLoading(true)
    setResultsLoading(true)

    let statsUrl = `/stats?period=${period}`
    if (fromDate) statsUrl += `&from_date=${fromDate}`
    if (toDate) statsUrl += `&to_date=${toDate}`
    if (selectedTags.length > 0) statsUrl += `&tags=${selectedTags.join(',')}`
    api.get(statsUrl)
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))

    let searchUrl = '/search?'
    if (selectedTags.length > 0) searchUrl += `tags=${selectedTags.join(',')}&`
    if (fromDate) searchUrl += `from_date=${fromDate}&`
    if (toDate) searchUrl += `to_date=${toDate}&`
    api.get(searchUrl)
      .then((r) => setResults(r.data.entries || []))
      .catch(() => setResults([]))
      .finally(() => setResultsLoading(false))
  }, [period, fromDate, toDate, selectedTags])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function toggleTag(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function clearFilters() {
    setFromDate('')
    setToDate('')
    setSelectedTags([])
    setPeriod('day')
  }

  async function handlePdfExport() {
    let url = `/api/stats/pdf?period=${period}`
    if (fromDate) url += `&from_date=${fromDate}`
    if (toDate) url += `&to_date=${toDate}`
    if (selectedTags.length > 0) url += `&tags=${selectedTags.join(',')}`
    try {
      const resp = await fetch(url, { credentials: 'include' })
      if (!resp.ok) { alert('Failed to generate PDF'); return }
      const blob = await resp.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = resp.headers.get('content-disposition')?.match(/filename=(.+)/)?.[1] || 'stats.pdf'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      alert('Failed to download PDF')
    }
  }

  const hasData = Boolean(stats && stats.total_entries > 0)

  return (
    <div>
      <h1 className="display text-2xl mb-6">{t('insights')}</h1>

      {/* Unified filter bar */}
      <div className="card card-pad mb-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44">
            <label className="form-label">{t('date_range')} — from</label>
            <FormattedDateInput
              value={fromDate}
              onChange={setFromDate}
              className="input input-compact"
            />
          </div>
          <div className="w-44">
            <label className="form-label">{t('date_range')} — to</label>
            <FormattedDateInput
              value={toDate}
              onChange={setToDate}
              className="input input-compact"
            />
          </div>
          <div>
            <span className="form-label">{t('period')}</span>
            <div className="flex gap-1">
              {['day', 'week', 'month'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {t(p === 'day' ? 'daily' : p === 'week' ? 'weekly' : 'monthly')}
                </button>
              ))}
            </div>
          </div>
          <button onClick={clearFilters} className="btn btn-ghost btn-sm ml-auto">
            {t('clear_filters')}
          </button>
        </div>

        {allTags.length > 0 && (
          <div className="mt-4">
            <span className="form-label">{t('filter_by_tags')}</span>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`chip ${selectedTags.includes(tag) ? 'chip-active' : ''}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats / charts */}
      {statsLoading && !stats ? (
        <div className="flex justify-center py-12">
          <div className="spin" />
        </div>
      ) : !hasData ? (
        <div className="card card-pad mb-8">
          <p className="text-custom-muted">{t('no_entries')}</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card card-hover card-pad text-center">
              <p className="display text-2xl text-accent">{stats.total_entries}</p>
              <p className="text-xs text-custom-muted">{t('total_entries')}</p>
            </div>
            <div className="card card-hover card-pad text-center">
              <p className="display text-2xl text-accent">{stats.avg_mood}/6</p>
              <p className="text-xs text-custom-muted">{t('avg_mood')}</p>
            </div>
            <div className="card card-hover card-pad text-center">
              <p className="display text-2xl text-accent">{stats.current_streak}</p>
              <p className="text-xs text-custom-muted">{t('current_streak')}</p>
            </div>
            <div className="card card-hover card-pad text-center">
              <p className="display text-2xl text-accent">{stats.longest_streak}</p>
              <p className="text-xs text-custom-muted">{t('longest_streak')}</p>
            </div>
          </div>

          {/* Mood over time */}
          {stats.mood_by_date && stats.mood_by_date.length > 0 && (
            <div className="card card-pad mb-6">
              <h3 className="section-title mb-4">{t('mood_over_time')}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.mood_by_date}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={tickProps} angle={-45} textAnchor="end" height={60} />
                  <YAxis domain={[0, 6]} ticks={[0, 1, 2, 3, 4, 5, 6]} tick={tickProps} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avg_mood" name={t('avg_mood')} radius={[4, 4, 0, 0]}>
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
              <div className="card card-pad">
                <h3 className="section-title mb-4">{t('tag_mood_correlation')}</h3>
                <ResponsiveContainer width="100%" height={Math.max(150, stats.tag_mood_correlation.length * 40)}>
                  <BarChart data={stats.tag_mood_correlation} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 6]} ticks={[0, 1, 2, 3, 4, 5, 6]} tick={tickProps} />
                    <YAxis type="category" dataKey="tag" tick={tickProps} width={75} />
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length ? (
                        <ChartTooltipCard
                          title={payload[0].payload.tag}
                          lines={[
                            `${t('avg_mood_per_tag')}: ${payload[0].value}/6`,
                            `${t('entries_with_tag')}: ${payload[0].payload.count}`,
                          ]}
                        />
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
              <div className="card card-pad">
                <h3 className="section-title mb-4">{t('day_of_week_mood')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.day_of_week_mood.map((d) => ({
                    ...d,
                    day_label: t(DAY_KEYS[d.day_index]),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day_label" tick={tickProps} />
                    <YAxis domain={[0, 6]} ticks={[0, 1, 2, 3, 4, 5, 6]} tick={tickProps} />
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length ? (
                        <ChartTooltipCard
                          title={payload[0].payload.day_label}
                          lines={[
                            `${t('avg_mood')}: ${payload[0].value}/6`,
                            `${t('total_entries')}: ${payload[0].payload.count}`,
                          ]}
                        />
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
              <div className="card card-pad">
                <h3 className="section-title mb-4">{t('mood_distribution')}</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.mood_distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mood" tick={tickProps} />
                    <YAxis tick={tickProps} />
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length ? (
                        <ChartTooltipCard
                          title={`${t(`mood_${payload[0].payload.mood}`)} (${payload[0].payload.mood})`}
                          lines={[`${t('total_entries')}: ${payload[0].value}`]}
                        />
                      ) : null
                    } />
                    <Bar dataKey="count" name={t('total_entries')} radius={[4, 4, 0, 0]}>
                      {stats.mood_distribution.map((entry, index) => (
                        <Cell key={index} fill={MOOD_COLORS[entry.mood] || MOOD_COLORS[3]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tag frequency */}
            {stats.tag_frequency && stats.tag_frequency.length > 0 && (
              <div className="card card-pad">
                <h3 className="section-title mb-4">{t('tag_frequency')}</h3>
                <ResponsiveContainer width="100%" height={Math.max(150, stats.tag_frequency.length * 35)}>
                  <BarChart data={stats.tag_frequency} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={tickProps} />
                    <YAxis type="category" dataKey="tag" tick={tickProps} width={75} />
                    <Tooltip content={({ active, payload }) =>
                      active && payload?.length ? (
                        <ChartTooltipCard
                          title={payload[0].payload.tag}
                          lines={[`${t('usage_count')}: ${payload[0].value}`]}
                        />
                      ) : null
                    } />
                    <Bar dataKey="count" name={t('usage_count')} radius={[0, 4, 4, 0]} fill="var(--accent)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Custom scales */}
          {stats.scales_by_date && Object.keys(stats.scales_by_date).length > 0 && (
            <div className="mt-8">
              <h2 className="section-title mb-4">{t('custom_scales_title')}</h2>
              {Object.entries(stats.scales_by_date).map(([scaleName, data]) => (
                <div key={scaleName} className="card card-pad mb-4">
                  <h3 className="section-title mb-4">{scaleName}</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={tickProps} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={tickProps} />
                      <Tooltip content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <ChartTooltipCard
                            title={label}
                            lines={[`${scaleName}: ${payload[0].value}`]}
                          />
                        ) : null
                      } />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--accent)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-2 mb-8">
            <button onClick={handlePdfExport} className="btn btn-secondary btn-sm">
              PDF
            </button>
          </div>
        </>
      )}

      <div className="divider mb-8" />

      {/* Matching entries */}
      <section>
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="section-title">{t('matching_entries')}</h2>
          {!resultsLoading && (
            <span className="badge">{t('found_entries', { count: results.length })}</span>
          )}
        </div>

        {resultsLoading ? (
          <div className="flex justify-center py-8">
            <div className="spin" />
          </div>
        ) : results.length === 0 ? (
          <p className="text-custom-muted">
            {hasActiveFilters ? t('no_results') : t('no_entries')}
          </p>
        ) : (
          <div className="space-y-3">
            {results.map((entry) => (
              <EntryCard key={entry.path} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

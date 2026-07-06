import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../api'
import { useI18n } from '../i18n'

const MOOD_COLORS = ['#4a148c', '#6a1b9a', '#9c27b0', '#9e9e9e', '#66bb6a', '#43a047', '#2e7d32']

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="card-bg border border-custom rounded-lg p-2 text-sm shadow-lg">
        <p className="font-medium">{label}</p>
        <p className="text-custom-muted">Mood: {payload[0].value}</p>
      </div>
    )
  }
  return null
}

export default function Stats() {
  const { t } = useI18n()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/stats')
      .then((r) => setStats(r.data))
      .catch(() => {})
  }, [])

  if (!stats) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (stats.total_entries === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">{t('stats')}</h1>
        <p className="text-custom-muted">{t('no_entries')}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">{t('stats')}</h1>

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

      {stats.mood_by_date && stats.mood_by_date.length > 0 && (
        <div className="card-bg border border-custom rounded-xl p-4 mb-6">
          <h3 className="font-semibold mb-4">{t('mood_over_time')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.mood_by_date}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
              <YAxis domain={[0, 6]} ticks={[0, 1, 2, 3, 4, 5, 6]} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg_mood" radius={[4, 4, 0, 0]}>
                {stats.mood_by_date.map((entry, index) => (
                  <Cell key={index} fill={MOOD_COLORS[Math.round(entry.avg_mood)] || MOOD_COLORS[3]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.mood_distribution && stats.mood_distribution.length > 0 && (
        <div className="card-bg border border-custom rounded-xl p-4">
          <h3 className="font-semibold mb-4">{t('mood_distribution')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.mood_distribution}>
              <XAxis dataKey="mood" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {stats.mood_distribution.map((entry, index) => (
                  <Cell key={index} fill={MOOD_COLORS[index] || MOOD_COLORS[3]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.scales_by_date && Object.keys(stats.scales_by_date).length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Custom Scales</h2>
          {Object.entries(stats.scales_by_date).map(([scaleName, data]) => (
            <div key={scaleName} className="card-bg border border-custom rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-4">{scaleName}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data}>
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
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

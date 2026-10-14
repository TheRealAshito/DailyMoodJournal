import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'

export default function NudgeBanner() {
  const { t } = useI18n()
  const [status, setStatus] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    api.get('/reminders/status')
      .then((r) => setStatus(r.data))
      .catch(() => {})
  }, [])

  if (dismissed || !status || status.has_entry_today) return null

  return (
    <div className="max-w-6xl mx-auto w-full px-4 md:px-0 pt-3">
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-700/50 bg-gradient-to-r from-amber-50 to-indigo-50 dark:from-amber-900/20 dark:to-indigo-900/20 px-4 py-3 shadow-sm">
        <p className="flex-1 text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
          {status.streak_at_risk
            ? t('nudge_streak_risk', { days: status.current_streak })
            : t('nudge_no_entry_today')}
        </p>
        <Link to="/new" className="text-sm font-medium text-indigo-600 dark:text-indigo-300 hover:underline whitespace-nowrap">
          {t('nudge_new_entry')}
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          aria-label={t('nudge_dismiss')}
          title={t('nudge_dismiss')}
        >
          ×
        </button>
      </div>
    </div>
  )
}

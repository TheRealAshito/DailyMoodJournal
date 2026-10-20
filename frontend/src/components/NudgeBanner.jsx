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
      <div className="card flex items-center gap-3 px-4 py-3 !bg-[var(--accent-soft)]">
        <p className="flex-1 text-sm text-custom leading-relaxed">
          {status.streak_at_risk
            ? t('nudge_streak_risk', { days: status.current_streak })
            : t('nudge_no_entry_today')}
        </p>
        <Link to="/new" className="btn btn-primary btn-sm">
          {t('nudge_new_entry')}
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="btn btn-ghost btn-sm"
          aria-label={t('nudge_dismiss')}
          title={t('nudge_dismiss')}
        >
          ×
        </button>
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'
const MOOD_COLORS = ['#4a148c', '#6a1b9a', '#9c27b0', '#9e9e9e', '#66bb6a', '#43a047', '#2e7d32']

export default function EntryCard({ entry }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const mood = entry.mood ?? 3

  async function handleDelete() {
    if (!confirm('Delete this entry?')) return
    try {
      await api.delete(`/entries/${encodeURIComponent(entry.path)}`)
      window.location.reload()
    } catch (err) {
      alert('Failed to delete.')
    }
  }

  return (
    <div className="card-bg border border-custom rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <h4 className="font-semibold">{entry.title}</h4>
          <p className="text-xs text-custom-muted">{entry.date}</p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: MOOD_COLORS[mood] }}>
          {t(`mood_${mood}`)} ({mood})
        </span>
      </div>
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {entry.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">{tag}</span>
          ))}
        </div>
      )}
      <div className="text-sm whitespace-pre-wrap text-custom">{entry.body || ''}</div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-custom">
        <button onClick={() => navigate(`/edit/${encodeURIComponent(entry.path)}`)} className="text-sm text-cyan-500 hover:underline">{t('edit')}</button>
        <button onClick={handleDelete} className="text-sm text-red-500 hover:underline">{t('delete')}</button>
      </div>
    </div>
  )
}

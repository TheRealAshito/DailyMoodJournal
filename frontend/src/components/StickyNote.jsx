import { useAuth } from '../contexts/AuthContext'

export default function StickyNote() {
  const { user } = useAuth()
  const note = user?.settings?.sticky_note?.trim()

  if (!note) return null

  return (
    <div className="max-w-6xl mx-auto w-full px-4 md:px-0 pt-3">
      <div className="relative bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl px-4 py-3 shadow-sm">
        {/* Pin dot */}
        <div className="absolute -top-1.5 left-6 w-3 h-3 bg-amber-400 dark:bg-amber-600 rounded-full shadow-sm border border-amber-500 dark:border-amber-500" />
        <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">{note}</p>
      </div>
    </div>
  )
}

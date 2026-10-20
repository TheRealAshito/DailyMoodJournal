import { useAuth } from '../contexts/AuthContext'

export default function StickyNote() {
  const { user } = useAuth()
  const note = user?.settings?.sticky_note?.trim()

  if (!note) return null

  return (
    <div className="max-w-6xl mx-auto w-full px-4 md:px-0 pt-3">
      <div className="card relative px-4 py-3 !bg-[var(--warning-soft)]">
        {/* Pin dot */}
        <div className="absolute -top-1.5 left-6 w-3 h-3 bg-accent rounded-full shadow-sm" />
        <p className="text-sm text-custom leading-relaxed whitespace-pre-wrap">{note}</p>
      </div>
    </div>
  )
}

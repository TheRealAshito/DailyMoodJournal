import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'

function errDetail(err) {
  const d = err.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => (x && typeof x.msg === 'string' ? x.msg : '')).filter(Boolean).join('; ')
  return err.message || ''
}

const KIND_OPTIONS = ['mindmap', 'radial']

export default function MindMapGallery() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [maps, setMaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('mindmap')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/mindmaps')
      setMaps(data.maps || [])
    } catch (err) {
      setError(errDetail(err) || t('mindmap_list_error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(ev) {
    ev.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || creating) return
    setCreating(true)
    setError('')
    try {
      const { data } = await api.post('/mindmaps', { title: trimmed, kind })
      navigate(`/maps/${data.id}`)
    } catch (err) {
      setError(errDetail(err) || t('mindmap_list_error'))
      setCreating(false)
    }
  }

  async function handleDelete(ev, id) {
    ev.stopPropagation()
    if (!window.confirm(t('mindmap_delete_map_confirm'))) return
    try {
      await api.delete(`/mindmaps/${id}`)
      load()
    } catch (err) {
      setError(errDetail(err) || t('mindmap_list_error'))
    }
  }

  const kindLabel = (k) => (k === 'radial' ? t('mindmap_kind_radial') : t('mindmap_kind_mindmap'))
  const fmtDate = (iso) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale)
  }

  return (
    <div className="fade-up max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="display text-2xl">{t('mindmap_title')}</h1>
          <p className="text-custom-muted mt-1">{t('mindmap_intro')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {t('mindmap_new')}
        </button>
      </div>

      {error ? (
        <div className="card card-pad mb-4 text-custom-muted">{error}</div>
      ) : null}

      {showCreate && (
        <form className="card card-pad mb-6 fade-up" onSubmit={handleCreate}>
          <label className="form-label" htmlFor="mindmap-new-title">{t('title')}</label>
          <input
            id="mindmap-new-title"
            className="input mb-4"
            value={title}
            maxLength={120}
            placeholder={t('mindmap_title_placeholder')}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {KIND_OPTIONS.map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={`select-card card-pad text-left ${kind === k ? 'on' : ''}`}
              >
                <div className="font-semibold">{kindLabel(k)}</div>
                <div className="text-sm text-custom-muted mt-1">
                  {k === 'radial' ? t('mindmap_kind_radial_desc') : t('mindmap_kind_mindmap_desc')}
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={creating || !title.trim()}>
              {t('mindmap_create')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
              {t('mindmap_cancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="spin" /></div>
      ) : maps.length === 0 ? (
        <div className="card card-pad text-center py-12">
          <h2 className="section-title">{t('mindmap_empty')}</h2>
          <p className="text-custom-muted mt-2 max-w-xl mx-auto">{t('mindmap_empty_desc')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto mt-6 text-left">
            {KIND_OPTIONS.map((k) => (
              <div key={k} className="card card-pad border border-custom">
                <div className="font-semibold">{kindLabel(k)}</div>
                <div className="text-sm text-custom-muted mt-1">
                  {k === 'radial' ? t('mindmap_kind_radial_desc') : t('mindmap_kind_mindmap_desc')}
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary mt-6" onClick={() => setShowCreate(true)}>
            {t('mindmap_new')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((m) => (
            <div
              key={m.id}
              className="card card-hover p-5 cursor-pointer"
              onClick={() => navigate(`/maps/${m.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold break-words">{m.title}</h3>
                <button
                  className="btn btn-ghost btn-sm shrink-0"
                  title={t('delete')}
                  aria-label={t('delete')}
                  onClick={(ev) => handleDelete(ev, m.id)}
                >
                  {t('delete')}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="badge">{kindLabel(m.kind)}</span>
                <span className="text-sm text-custom-muted">
                  {t('mindmap_nodes_count', { count: m.node_count ?? (m.nodes || []).length })}
                </span>
              </div>
              <div className="text-xs text-custom-muted mt-2">
                {t('mindmap_updated', { date: fmtDate(m.updated_at) })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

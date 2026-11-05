import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useI18n } from '../i18n'
import { useTheme } from '../contexts/ThemeContext'
import { useDateFormat } from '../contexts/DateFormatContext'
import FormattedDateInput from './FormattedDateInput'

const CATEGORIES = [
  { key: 'self_reflection' },
  { key: 'gratitude' },
  { key: 'growth_learning' },
  { key: 'emotional_awareness' },
  { key: 'relationships' },
  { key: 'goals_purpose' },
  { key: 'mindfulness' },
  { key: 'resilience' },
]

const ACCENT_COLORS = [
  { key: 'terracotta', label: 'accent_terracotta', hex: '#bc5c38' },
  { key: 'sage', label: 'accent_sage', hex: '#6f8f66' },
  { key: 'ocean', label: 'accent_ocean', hex: '#4a7f9e' },
  { key: 'plum', label: 'accent_plum', hex: '#8b5e83' },
  { key: 'rose', label: 'accent_rose', hex: '#c25c6e' },
]

const THEME_OPTIONS = [
  { value: 'light', labelKey: 'theme_light', icon: 'sun' },
  { value: 'dark', labelKey: 'theme_dark', icon: 'moon' },
]

const NAV_CATEGORIES = [
  { key: 'general', labelKey: 'settings_category_general' },
  { key: 'journal', labelKey: 'settings_category_journal' },
  { key: 'reminders', labelKey: 'settings_category_reminders' },
  { key: 'privacy', labelKey: 'settings_category_privacy' },
  { key: 'data', labelKey: 'settings_category_data' },
]

function ThemeIcon({ name }) {
  if (name === 'sun') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </svg>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function ManagerRow({ title, count, open, onToggle, children }) {
  return (
    <div className="border-b border-custom last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover-bg transition-colors"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm font-semibold text-custom truncate">{title}</span>
          <span className="badge">{count}</span>
        </span>
        <span className="text-custom-muted"><ChevronIcon open={open} /></span>
      </button>
      {open && <div className="px-4 pb-4 pt-3 border-t border-custom">{children}</div>}
    </div>
  )
}

export default function Settings() {
  const { t, changeLocale } = useI18n()
  const { theme, setTheme, accent, setAccent } = useTheme()
  const { dateFormat, setDateFormat } = useDateFormat()

  async function extractBlobError(err) {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text()
        const json = JSON.parse(text)
        if (typeof json.detail === 'string') return json.detail
        if (Array.isArray(json.detail)) return json.detail[0]?.msg || text
        return text
      } catch {
        return `HTTP ${err.response.status}`
      }
    }
    return err.response?.data?.detail || err.message || t('unknown_error')
  }

  const [settings, setSettings] = useState(null)
  const [activeCat, setActiveCat] = useState('general')
  const [openManager, setOpenManager] = useState(null)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwOk, setPwOk] = useState(false)
  const [expMsg, setExpMsg] = useState('')
  const [exportFmt, setExportFmt] = useState('tar.gz')
  const [impMsg, setImpMsg] = useState('')
  const [impFiles, setImpFiles] = useState([])
  const [newTag, setNewTag] = useState('')
  const [newScaleName, setNewScaleName] = useState('')
  const [newScaleMax, setNewScaleMax] = useState(10)
  const [pdfFrom, setPdfFrom] = useState('')
  const [pdfTo, setPdfTo] = useState('')
  const fileRef = useRef(null)
  const [remMsg, setRemMsg] = useState('')
  const [remOk, setRemOk] = useState(false)
  const [ntfyToken, setNtfyToken] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinRequire, setPinRequire] = useState(false)
  const [pinMsg, setPinMsg] = useState('')
  const [pinOk, setPinOk] = useState(false)
  const [devices, setDevices] = useState([])
  const [devMsg, setDevMsg] = useState('')
  const [devOk, setDevOk] = useState(false)
  const [stickyBaseline, setStickyBaseline] = useState(null)
  const [stickyMsg, setStickyMsg] = useState('')
  const [stickyOk, setStickyOk] = useState(false)

  useEffect(() => {
    api.get('/settings').then((r) => {
      setSettings(r.data)
      setStickyBaseline(r.data.sticky_note || '')
    }).catch(() => {})
    api.get('/auth/my-devices').then((r) => setDevices(r.data?.devices || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (settings) setPinRequire(!!settings.pin_required_on_device)
  }, [settings?.pin_enabled, settings?.pin_required_on_device])

  function chooseTheme(next) {
    setTheme(next)
    api.put('/settings', { theme: next }).catch(() => {})
  }

  function chooseAccent(next) {
    setAccent(next)
    api.put('/settings', { accent: next }).catch(() => {})
  }

  async function changePassword() {
    setPwMsg('')
    if (newPw.length < 6) { setPwOk(false); setPwMsg(t('password_min_length')); return }
    if (newPw !== confirmPw) { setPwOk(false); setPwMsg(t('password_mismatch')); return }
    try {
      await api.put('/auth/password', { old_password: oldPw, new_password: newPw })
      setPwOk(true)
      setPwMsg(t('password_changed'))
    } catch (err) {
      const detail = err.response?.data?.detail
      setPwOk(false)
      setPwMsg(detail || t('password_change_failed'))
    }
  }

  async function saveStickyNote() {
    setStickyMsg('')
    try {
      await api.put('/settings', { sticky_note: settings.sticky_note || '' })
      setStickyBaseline(settings.sticky_note || '')
      setStickyOk(true)
      setStickyMsg(t('settings_saved'))
    } catch (err) {
      const msg = await extractBlobError(err)
      setStickyOk(false)
      setStickyMsg(msg || t('settings_error'))
    }
  }

  async function handleExport() {
    try {
      const r = await api.get(`/export?format=${exportFmt}`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      const cd = r.headers['content-disposition']
      const match = cd && cd.match(/filename="?([^\";]+)"?/)
      a.download = match ? match[1] : `export.${exportFmt}`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      const msg = await extractBlobError(err)
      setExpMsg(msg || t('export_failed'))
    }
  }

  async function handleExportPDF() {
    try {
      let url = '/export/pdf'
      if (pdfFrom || pdfTo) {
        const p = new URLSearchParams()
        if (pdfFrom) p.set('from_date', pdfFrom)
        if (pdfTo) p.set('to_date', pdfTo)
        url += '?' + p.toString()
      }
      const r = await api.get(url, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      const cd = r.headers['content-disposition']
      const match = cd && cd.match(/filename="?([^\";]+)"?/)
      a.download = match ? match[1] : 'journal.pdf'
      a.href = blobUrl
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      const msg = await extractBlobError(err)
      setExpMsg(msg || t('pdf_export_failed'))
    }
  }

  async function handleImport() {
    setImpMsg('')
    setImpFiles([])
    const files = fileRef.current?.files
    if (!files || files.length === 0) return
    const form = new FormData()
    for (const f of files) form.append('files', f)
    try {
      const r = await api.post('/export/import', form)
      const data = r.data
      setImpMsg(t('import_result', { imported: data.imported, skipped: data.skipped }))
      setImpFiles(data.files || [])
    } catch {
      setImpMsg(t('import_failed'))
    }
  }

  function updateCategory(cat) {
    if (!settings) return
    const cats = settings.reflection_categories || []
    const updated = cats.includes(cat) ? cats.filter((c) => c !== cat) : [...cats, cat]
    const newS = { ...settings, reflection_categories: updated }
    setSettings(newS)
    api.put('/settings', { reflection_categories: updated }).catch(() => {})
  }

  function handleAddTag() {
    const tag = newTag.trim()
    if (!tag) return
    const lang = settings.language || 'en'
    const current = settings.tags?.[lang] || settings.tags?.en || []
    if (current.includes(tag)) return
    const updated = [...current, tag]
    const newTags = { ...settings.tags, [lang]: updated }
    const newS = { ...settings, tags: newTags }
    setSettings(newS)
    setNewTag('')
    api.put('/settings', { tags: newTags }).catch(() => {})
  }

  function handleAddScale() {
    const name = newScaleName.trim()
    if (!name) return
    const max = parseInt(newScaleMax, 10)
    if (isNaN(max) || max < 1 || max > 100) return
    const current = settings.custom_scales || []
    if (current.some((s) => s.name.toLowerCase() === name.toLowerCase())) return
    const scale = { name, min: 0, max, step: 1 }
    const updated = [...current, scale]
    const newS = { ...settings, custom_scales: updated }
    setSettings(newS)
    setNewScaleName('')
    setNewScaleMax(10)
    api.put('/settings', { custom_scales: updated }).catch(() => {})
  }

  async function saveReminders() {
    setRemMsg('')
    try {
      const body = {
        reminder_enabled: !!settings.reminder_enabled,
        reminder_time: settings.reminder_time || '20:00',
        reminder_timezone: settings.reminder_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        ntfy_url: settings.ntfy_url || '',
        ntfy_priority: Number(settings.ntfy_priority) || 3,
      }
      if (ntfyToken.trim()) body.ntfy_token = ntfyToken.trim()
      await api.put('/settings', body)
      setNtfyToken('')
      setRemOk(true)
      setRemMsg(t('settings_saved'))
    } catch (err) {
      const msg = await extractBlobError(err)
      setRemOk(false)
      setRemMsg(msg || t('settings_error'))
    }
  }

  async function savePin() {
    setPinMsg('')
    const pinVal = newPin.trim()
    if (!/^\d{4,8}$/.test(pinVal)) {
      setPinOk(false)
      setPinMsg(t('pin_invalid'))
      return
    }
    try {
      await api.post('/settings/pin', { pin: pinVal, require_on_device: pinRequire })
      setSettings({ ...settings, pin_enabled: true, pin_required_on_device: pinRequire })
      setNewPin('')
      setPinOk(true)
      setPinMsg(t('pin_saved'))
    } catch (err) {
      const msg = await extractBlobError(err)
      setPinOk(false)
      setPinMsg(msg || t('settings_error'))
    }
  }

  async function removePin() {
    setPinMsg('')
    if (!window.confirm(t('remove_pin_confirm'))) return
    try {
      await api.delete('/settings/pin')
      setSettings({ ...settings, pin_enabled: false, pin_required_on_device: false })
      setPinRequire(false)
      setPinOk(true)
      setPinMsg(t('pin_removed'))
    } catch (err) {
      const msg = await extractBlobError(err)
      setPinOk(false)
      setPinMsg(msg || t('settings_error'))
    }
  }

  async function loadDevices() {
    try {
      const r = await api.get('/auth/my-devices')
      setDevices(r.data?.devices || [])
    } catch {}
  }

  async function forgetDevice(deviceId) {
    setDevMsg('')
    try {
      await api.delete(`/auth/my-devices/${encodeURIComponent(deviceId)}`)
      setDevOk(true)
      setDevMsg(t('settings_saved'))
      await loadDevices()
    } catch (err) {
      const msg = await extractBlobError(err)
      setDevOk(false)
      setDevMsg(msg || t('settings_error'))
    }
  }

  async function forgetAllDevices() {
    setDevMsg('')
    if (!window.confirm(t('forget_all_confirm'))) return
    try {
      await api.delete('/auth/my-devices')
      setDevOk(true)
      setDevMsg(t('settings_saved'))
      await loadDevices()
    } catch (err) {
      const msg = await extractBlobError(err)
      setDevOk(false)
      setDevMsg(msg || t('settings_error'))
    }
  }

  if (!settings) return <div className="flex justify-center py-20"><div className="spin" /></div>

  const tagList = settings.tags?.[settings.language] || settings.tags?.en || []
  const scaleList = settings.custom_scales || []
  const activeCats = settings.reflection_categories || []
  const stickyDirty = stickyBaseline !== null && (settings.sticky_note || '') !== stickyBaseline

  return (
    <div className="max-w-3xl fade-up">
      <h1 className="display text-2xl mb-4">{t('settings')}</h1>

      {/* Mobile: horizontal category pills */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-4">
        {NAV_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setActiveCat(c.key)}
            className={`chip whitespace-nowrap ${activeCat === c.key ? 'chip-active' : ''}`}
          >
            {t(c.labelKey)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        {/* Desktop: left-rail category nav */}
        <nav className="hidden md:block w-44 shrink-0">
          <div className="flex flex-col gap-1 sticky top-6">
            {NAV_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setActiveCat(c.key)}
                aria-current={activeCat === c.key ? 'page' : undefined}
                className={`nav-item w-full text-left ${activeCat === c.key ? 'nav-item-active' : ''}`}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>
        </nav>

        {/* Content panel */}
        <div className="flex-1 min-w-0 space-y-5">
          {activeCat === 'general' && (
            <div className="space-y-5">
              <div className="card card-pad">
                <h3 className="section-title mb-4">{t('appearance')}</h3>

                <p className="form-label">{t('theme')}</p>
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  {THEME_OPTIONS.map((opt) => {
                    const active = theme === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => chooseTheme(opt.value)}
                        aria-pressed={active}
                        className={`select-card flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium ${active ? 'on' : 'text-custom'}`}
                      >
                        <ThemeIcon name={opt.icon} />
                        <span>{t(opt.labelKey)}</span>
                      </button>
                    )
                  })}
                </div>

                <p className="form-label">{t('accent')}</p>
                <div className="grid grid-cols-5 gap-2">
                  {ACCENT_COLORS.map((a) => {
                    const active = accent === a.key
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => chooseAccent(a.key)}
                        aria-pressed={active}
                        className={`select-card flex flex-col items-center gap-1.5 px-2 py-2.5 text-xs font-medium ${active ? 'on' : 'text-custom'}`}
                      >
                        <span className="w-5 h-5 rounded-full border border-custom" style={{ backgroundColor: a.hex }} />
                        <span className="w-full truncate text-center">{t(a.label)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="card card-pad">
                <h3 className="section-title mb-3">{t('language')}</h3>
                <div className="flex gap-2">
                  {['en', 'pt-BR'].map((lang) => (
                    <button
                      key={lang}
                      onClick={async () => {
                        changeLocale(lang)
                        try {
                          await api.put('/settings', { language: lang })
                          const r = await api.get('/settings')
                          setSettings(r.data)
                        } catch {}
                      }}
                      className={`btn ${settings.language === lang ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {lang === 'en' ? t('language_english') : t('language_portuguese')}
                    </button>
                  ))}
                </div>

                <div className="divider my-4" />

                <h3 className="section-title mb-1">{t('date_format')}</h3>
                <p className="text-sm text-custom-muted mb-3">{t('date_format_desc')}</p>
                <div className="flex gap-2 flex-wrap">
                  {['YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY'].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => {
                        setDateFormat(fmt)
                        api.put('/settings', { date_format: fmt }).catch(() => {})
                      }}
                      className={`btn ${dateFormat === fmt ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeCat === 'journal' && (
            <div className="space-y-5">
              <div className="card card-pad">
                <h3 className="section-title mb-1">{t('sticky_note')}</h3>
                <p className="text-sm text-custom-muted mb-3">{t('sticky_note_desc')}</p>
                <textarea
                  value={settings.sticky_note || ''}
                  onChange={(e) => { setSettings({ ...settings, sticky_note: e.target.value }); setStickyMsg('') }}
                  placeholder={t('sticky_note_placeholder')}
                  rows={3}
                  className="input resize-none"
                />
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={saveStickyNote} disabled={!stickyDirty} className="btn btn-primary">
                    {t('save_settings')}
                  </button>
                  {stickyMsg && (
                    <p className={`text-sm ${stickyOk ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{stickyMsg}</p>
                  )}
                  {!stickyMsg && stickyDirty && <p className="text-xs text-custom-muted">{t('unsaved_changes')}</p>}
                </div>
              </div>

              <div className="card overflow-hidden">
                <ManagerRow
                  title={t('tags')}
                  count={tagList.length}
                  open={openManager === 'tags'}
                  onToggle={() => setOpenManager(openManager === 'tags' ? null : 'tags')}
                >
                  <p className="text-sm text-custom-muted mb-3">{t('tags_desc')}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tagList.map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                        <button
                          onClick={() => {
                            const lang = settings.language || 'en'
                            const current = settings.tags?.[lang] || settings.tags?.en || []
                            const updated = current.filter((t) => t !== tag)
                            const newTags = { ...settings.tags, [lang]: updated }
                            const newS = { ...settings, tags: newTags }
                            setSettings(newS)
                            api.put('/settings', { tags: newTags }).catch(() => {})
                          }}
                          className="ml-0.5 text-[var(--danger)] opacity-70 hover:opacity-100 transition-opacity"
                          title={t('remove_tag')}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddTag()
                        }
                      }}
                      placeholder={t('new_tag_placeholder')}
                      className="input flex-1"
                    />
                    <button onClick={handleAddTag} className="btn btn-primary">{t('settings_add')}</button>
                  </div>
                </ManagerRow>

                <ManagerRow
                  title={t('reflection_categories')}
                  count={activeCats.length}
                  open={openManager === 'categories'}
                  onToggle={() => setOpenManager(openManager === 'categories' ? null : 'categories')}
                >
                  <p className="text-sm text-custom-muted mb-3">{t('reflection_categories_desc')}</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => {
                      const active = activeCats.includes(cat.key)
                      return (
                        <button key={cat.key} onClick={() => updateCategory(cat.key)} className={`chip cursor-pointer ${active ? 'chip-active' : ''}`}>
                          {t(cat.key)}
                        </button>
                      )
                    })}
                  </div>
                </ManagerRow>

                <ManagerRow
                  title={t('custom_scales_title')}
                  count={scaleList.length}
                  open={openManager === 'scales'}
                  onToggle={() => setOpenManager(openManager === 'scales' ? null : 'scales')}
                >
                  <p className="text-sm text-custom-muted mb-3">{t('custom_scales_desc')}</p>

                  {scaleList.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {scaleList.map((scale, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-custom-secondary border border-custom text-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-custom">{scale.name}</span>
                            <span className="text-xs text-custom-muted">{scale.min}–{scale.max}</span>
                          </div>
                          <button
                            onClick={() => {
                              const updated = (settings.custom_scales || []).filter((_, idx) => idx !== i)
                              const newS = { ...settings, custom_scales: updated }
                              setSettings(newS)
                              api.put('/settings', { custom_scales: updated }).catch(() => {})
                            }}
                            className="text-[var(--danger)] hover:opacity-80 text-lg leading-none"
                            title={t('remove_scale')}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap items-end">
                    <div className="flex-1 min-w-[140px]">
                      <label className="form-label">{t('scale_name_label')}</label>
                      <input
                        type="text"
                        value={newScaleName}
                        onChange={(e) => setNewScaleName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddScale() } }}
                        placeholder={t('scale_name_placeholder')}
                        className="input"
                      />
                    </div>
                    <div className="w-20">
                      <label className="form-label">{t('scale_max_label')}</label>
                      <input
                        type="number"
                        value={newScaleMax}
                        onChange={(e) => setNewScaleMax(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddScale() } }}
                        min="1"
                        max="100"
                        className="input"
                      />
                    </div>
                    <button onClick={handleAddScale} className="btn btn-primary">{t('settings_add')}</button>
                  </div>
                </ManagerRow>
              </div>
            </div>
          )}

          {activeCat === 'reminders' && (
            <div className="card card-pad">
              <h3 className="section-title mb-3">{t('reminders')}</h3>
              <p className="text-sm text-custom-muted mb-3">{t('reminders_desc')}</p>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-custom cursor-pointer">
                  <input type="checkbox" checked={!!settings.reminder_enabled} onChange={(e) => setSettings({ ...settings, reminder_enabled: e.target.checked })} className="rounded border-custom accent-[var(--accent)]" />
                  {t('reminder_enabled')}
                </label>
                <div className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="form-label">{t('reminder_time')}</label>
                    <input type="time" value={settings.reminder_time || '20:00'} onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value })} className="input" />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="form-label">{t('reminder_timezone')}</label>
                    <input type="text" value={settings.reminder_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={(e) => setSettings({ ...settings, reminder_timezone: e.target.value })} className="input" />
                  </div>
                </div>
                <div>
                  <label className="form-label">{t('ntfy_url')}</label>
                  <input type="text" value={settings.ntfy_url || ''} onChange={(e) => setSettings({ ...settings, ntfy_url: e.target.value })} placeholder="https://ntfy.example.com" className="input" />
                  <p className="text-xs text-custom-muted mt-1">{t('ntfy_url_help')}</p>
                </div>
                <div>
                  <label className="form-label">{t('ntfy_priority')}</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((p) => (
                      <button key={p} type="button" onClick={() => setSettings({ ...settings, ntfy_priority: p })} className={`btn btn-sm w-10 justify-center ${Number(settings.ntfy_priority || 3) === p ? 'btn-primary' : 'btn-secondary'}`}>{p}</button>
                    ))}
                  </div>
                  <p className="text-xs text-custom-muted mt-1">{t('ntfy_priority_desc')}</p>
                </div>
                <div>
                  <label className="form-label">{t('ntfy_token')}</label>
                  <input type="password" value={ntfyToken} onChange={(e) => setNtfyToken(e.target.value)} placeholder={t('ntfy_token_unchanged')} autoComplete="off" className="input" />
                </div>
                <button onClick={saveReminders} className="btn btn-primary">{t('save_settings')}</button>
                {remMsg && <p className={`text-sm ${remOk ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{remMsg}</p>}
              </div>
            </div>
          )}

          {activeCat === 'privacy' && (
            <div className="space-y-5">
              <div className="card card-pad">
                <h3 className="section-title mb-3">{t('device_pin_title')}</h3>
                <p className="text-sm text-custom-muted mb-3">{t('device_pin_desc')}</p>
                <div className="space-y-3">
                  <div>
                    <label className="form-label">{settings.pin_enabled ? t('change_pin') : t('set_pin')}</label>
                    <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder={t('pin_placeholder')} autoComplete="off" className="input" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-custom cursor-pointer">
                    <input type="checkbox" checked={pinRequire} onChange={(e) => setPinRequire(e.target.checked)} className="rounded border-custom accent-[var(--accent)]" />
                    {t('require_on_device')}
                  </label>
                  <div className="flex gap-2">
                    <button onClick={savePin} className="btn btn-primary">{settings.pin_enabled ? t('change_pin') : t('set_pin')}</button>
                    {settings.pin_enabled && (
                      <button onClick={removePin} className="btn btn-danger">{t('remove_pin')}</button>
                    )}
                  </div>
                  {pinMsg && <p className={`text-sm ${pinOk ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{pinMsg}</p>}
                </div>
              </div>

              <div className="card card-pad">
                <h3 className="section-title mb-3">{t('remembered_devices')}</h3>
                {devices.length === 0 ? (
                  <p className="text-sm text-custom-muted">{t('no_remembered_devices')}</p>
                ) : (
                  <>
                    <div className="space-y-2 mb-3">
                      {devices.map((d) => (
                        <div key={d.device_id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-custom-secondary border border-custom text-sm">
                          <div>
                            <span className="font-medium text-custom">{d.label || d.device_id}</span>
                            {d.current && <span className="text-xs text-custom-muted ml-2">{t('this_device')}</span>}
                            <div className="text-xs text-custom-muted">{t('device_last_used')}: {d.last_used_at ? new Date(d.last_used_at).toLocaleString() : '—'}</div>
                          </div>
                          <button onClick={() => forgetDevice(d.device_id)} className="btn btn-danger btn-sm whitespace-nowrap">{t('forget_device')}</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={forgetAllDevices} className="btn btn-danger">{t('forget_all_devices')}</button>
                  </>
                )}
                {devMsg && <p className={`text-sm mt-2 ${devOk ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{devMsg}</p>}
              </div>

              <div className="card card-pad">
                <h3 className="section-title mb-3">{t('change_password')}</h3>
                <p className="text-xs text-custom-muted mb-3">{t('password_change_warning')}</p>
                <div className="space-y-3">
                  <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder={t('current_password')} className="input" />
                  <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t('new_password')} className="input" />
                  <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder={t('confirm_password')} className="input" />
                  <button onClick={changePassword} className="btn btn-primary">{t('change_password')}</button>
                  {pwMsg && <p className={`text-sm ${pwOk ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{pwMsg}</p>}
                </div>
              </div>
            </div>
          )}

          {activeCat === 'data' && (
            <div className="space-y-5">
              <div className="card card-pad">
                <h3 className="section-title mb-3">{t('export')}</h3>
                <div className="flex items-end gap-3 mb-3">
                  <div>
                    <label className="form-label">{t('export_format')}</label>
                    <select value={exportFmt} onChange={(e) => setExportFmt(e.target.value)} className="input max-w-[10rem]">
                      <option value="tar.gz">.tar.gz</option>
                      <option value="zip">.zip</option>
                    </select>
                  </div>
                  <button onClick={handleExport} className="btn btn-primary">{t('build_export')}</button>
                </div>
                {expMsg && <p className="text-sm text-[var(--danger)]">{expMsg}</p>}
              </div>

              <div className="card card-pad">
                <h3 className="section-title mb-3">{t('export_pdf')}</h3>
                <p className="text-sm text-custom-muted mb-3">{t('export_pdf_desc')}</p>
                <div className="flex gap-3 mb-3 items-end">
                  <div className="flex-1 min-w-[130px]">
                    <label className="form-label">{t('pdf_date_from')}</label>
                    <FormattedDateInput value={pdfFrom} onChange={setPdfFrom} className="input !pr-9" />
                  </div>
                  <div className="flex-1 min-w-[130px]">
                    <label className="form-label">{t('pdf_date_to')}</label>
                    <FormattedDateInput value={pdfTo} onChange={setPdfTo} className="input !pr-9" />
                  </div>
                  <div className="text-xs text-custom-muted pb-2">{t('pdf_all_entries')}</div>
                </div>
                <button onClick={handleExportPDF} className="btn btn-primary">{t('export_pdf_btn')}</button>
                {expMsg && <p className="text-sm text-[var(--danger)] mt-2">{expMsg}</p>}
              </div>

              <div className="card card-pad">
                <h3 className="section-title mb-3">{t('import')}</h3>
                <p className="text-sm text-custom-muted mb-3">{t('import_files')}</p>
                <input type="file" ref={fileRef} multiple accept=".tar.gz,.tgz,.zip,.md,.txt" className="mb-3 text-sm" />
                <div>
                  <button onClick={handleImport} className="btn btn-primary">{t('import')}</button>
                </div>
                {impMsg && <p className="text-sm mt-2 text-custom-muted">{impMsg}</p>}
                {impFiles.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {impFiles.map((f, i) => (
                      <div key={i} className={`text-xs flex items-center gap-2 ${f.status === 'imported' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        <span>{f.status === 'imported' ? '✓' : '✗'}</span>
                        <span className="truncate">{f.filename}</span>
                        {f.reason && <span className="text-custom-muted">— {f.reason}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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

export default function Settings() {
  const { t, changeLocale } = useI18n()
  const { theme, setTheme } = useTheme()
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
    return err.response?.data?.detail || err.message || 'Unknown error'
  }

  const [settings, setSettings] = useState(null)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
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

  useEffect(() => {
    api.get('/settings').then((r) => setSettings(r.data)).catch(() => {})
    api.get('/auth/my-devices').then((r) => setDevices(r.data?.devices || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (settings) setPinRequire(!!settings.pin_required_on_device)
  }, [settings?.pin_enabled, settings?.pin_required_on_device])

  async function changePassword() {
    setPwMsg('')
    if (newPw.length < 6) { setPwMsg('Min 6 characters.'); return }
    if (newPw !== confirmPw) { setPwMsg('Passwords dont match.'); return }
    try {
      await api.put('/auth/password', { old_password: oldPw, new_password: newPw })
      setPwMsg('Password changed!')
    } catch (err) {
      const detail = err.response?.data?.detail
      setPwMsg(detail || 'Failed to change password.')
    }
  }

  async function handleExport() {
    try {
      const r = await api.get(`/export?format=${exportFmt}`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      const cd = r.headers['content-disposition']
      const match = cd && cd.match(/filename="?([^";]+)"?/)
      a.download = match ? match[1] : `export.${exportFmt}`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      const msg = await extractBlobError(err)
      setExpMsg(msg || 'Export failed.')
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
      const match = cd && cd.match(/filename="?([^";]+)"?/)
      a.download = match ? match[1] : 'journal.pdf'
      a.href = blobUrl
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      const msg = await extractBlobError(err)
      setExpMsg(msg || 'PDF export failed.')
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
      setImpMsg(`Imported ${data.imported}, skipped ${data.skipped}`)
      setImpFiles(data.files || [])
    } catch {
      setImpMsg('Import failed.')
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
      setRemMsg(msg || 'Failed.')
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
      setPinMsg(msg || 'Failed.')
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
      setPinMsg(msg || 'Failed.')
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
      setDevMsg(msg || 'Failed.')
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
      setDevMsg(msg || 'Failed.')
    }
  }

  if (!settings) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">{t('settings')}</h1>

      <div className="space-y-6">
        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('theme')}</h3>
          <button onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            setTheme(next)
            api.put('/settings', { theme: next }).catch(() => {})
          }} className="px-4 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm font-medium">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('language')}</h3>
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
                className={`px-4 py-2 rounded-lg text-sm font-medium ${settings.language === lang ? 'bg-cyan-500 text-white' : 'border-custom bg-custom-secondary text-custom'}`}
              >
                {lang === 'en' ? 'English' : 'Português'}
              </button>
            ))}
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('date_format')}</h3>
          <p className="text-sm text-custom-muted mb-3">{t('date_format_desc')}</p>
          <div className="flex gap-2 flex-wrap">
            {['YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY'].map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                  setDateFormat(fmt)
                  api.put('/settings', { date_format: fmt }).catch(() => {})
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${dateFormat === fmt ? 'bg-cyan-500 text-white' : 'border-custom bg-custom-secondary text-custom'}`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">📌 {t('sticky_note')}</h3>
          <p className="text-sm text-custom-muted mb-3">{t('sticky_note_desc')}</p>
          <textarea
            value={settings.sticky_note || ''}
            onChange={(e) => setSettings({ ...settings, sticky_note: e.target.value })}
            onBlur={() => api.put('/settings', { sticky_note: settings.sticky_note || '' }).catch(() => {})}
            placeholder={t('sticky_note_placeholder')}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
          />
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('reflection_categories')}</h3>
          <p className="text-sm text-custom-muted mb-3">Choose which prompt categories appear when you enable reflection prompts on an entry.</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const active = (settings.reflection_categories || []).includes(cat.key)
              return (
                <button key={cat.key} onClick={() => updateCategory(cat.key)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${active ? 'bg-cyan-500 text-white' : 'border border-custom text-custom'}`}>
                  {t(cat.key)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">🏷️ Tags</h3>
          <p className="text-sm text-custom-muted mb-3">Manage your available tags. These appear as clickable buttons when writing an entry.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {(settings.tags?.[settings.language] || settings.tags?.en || []).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
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
                  className="ml-0.5 hover:text-red-500 transition-colors"
                  title="Remove tag"
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
              placeholder="New tag name"
              className="flex-1 px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <button onClick={handleAddTag} className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">Add</button>
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">📊 Custom Scales</h3>
          <p className="text-sm text-custom-muted mb-3">Add custom numeric scales (e.g. Anxiety, Energy) to rate alongside mood on every entry.</p>

          {(settings.custom_scales || []).length > 0 && (
            <div className="space-y-2 mb-3">
              {(settings.custom_scales || []).map((scale, i) => (
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
                    className="text-red-500 hover:text-red-700 text-lg leading-none"
                    title="Remove scale"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-custom-muted mb-1">Name</label>
              <input
                type="text"
                value={newScaleName}
                onChange={(e) => setNewScaleName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddScale() } }}
                placeholder="e.g. Anxiety"
                className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs text-custom-muted mb-1">Max</label>
              <input
                type="number"
                value={newScaleMax}
                onChange={(e) => setNewScaleMax(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddScale() } }}
                min="1"
                max="100"
                className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <button onClick={handleAddScale} className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">Add</button>
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('export')}</h3>
          <div className="flex items-center gap-3 mb-3">
            <select value={exportFmt} onChange={(e) => setExportFmt(e.target.value)} className="px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm">
              <option value="tar.gz">.tar.gz</option>
              <option value="zip">.zip</option>
            </select>
            <button onClick={handleExport} className="px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600">{t('build_export')}</button>
          </div>
          {expMsg && <p className="text-sm text-red-500">{expMsg}</p>}
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">📄 {t('export_pdf')}</h3>
          <p className="text-sm text-custom-muted mb-3">{t('export_pdf_desc')}</p>
          <div className="flex gap-3 mb-3 items-end">
            <div>
              <label className="block text-xs text-custom-muted mb-1">{t('pdf_date_from')}</label>
              <FormattedDateInput value={pdfFrom} onChange={setPdfFrom} className="px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
            <div>
              <label className="block text-xs text-custom-muted mb-1">{t('pdf_date_to')}</label>
              <FormattedDateInput value={pdfTo} onChange={setPdfTo} className="px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
            <div className="text-xs text-custom-muted pb-2">{t('pdf_all_entries')}</div>
          </div>
          <button onClick={handleExportPDF} className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">{t('export_pdf_btn')}</button>
          {expMsg && <p className="text-sm text-red-500 mt-2">{expMsg}</p>}
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('import')}</h3>
          <p className="text-sm text-custom-muted mb-3">{t('import_files')}</p>
          <input type="file" ref={fileRef} multiple accept=".tar.gz,.tgz,.zip,.md,.txt" className="mb-3 text-sm" />
          <button onClick={handleImport} className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">{t('import')}</button>
          {impMsg && <p className="text-sm mt-2 text-custom-muted">{impMsg}</p>}
          {impFiles.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {impFiles.map((f, i) => (
                <div key={i} className={`text-xs flex items-center gap-2 ${f.status === 'imported' ? 'text-green-600' : 'text-red-500'}`}>
                  <span>{f.status === 'imported' ? '✓' : '✗'}</span>
                  <span className="truncate">{f.filename}</span>
                  {f.reason && <span className="text-custom-muted">— {f.reason}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">⏰ {t('reminders')}</h3>
          <p className="text-sm text-custom-muted mb-3">{t('reminders_desc')}</p>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-custom cursor-pointer">
              <input type="checkbox" checked={!!settings.reminder_enabled} onChange={(e) => setSettings({ ...settings, reminder_enabled: e.target.checked })} className="rounded border-custom" />
              {t('reminder_enabled')}
            </label>
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="block text-xs text-custom-muted mb-1">{t('reminder_time')}</label>
                <input type="time" value={settings.reminder_time || '20:00'} onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value })} className="px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-custom-muted mb-1">{t('reminder_timezone')}</label>
                <input type="text" value={settings.reminder_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={(e) => setSettings({ ...settings, reminder_timezone: e.target.value })} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-custom-muted mb-1">{t('ntfy_url')}</label>
              <input type="text" value={settings.ntfy_url || ''} onChange={(e) => setSettings({ ...settings, ntfy_url: e.target.value })} placeholder="https://ntfy.example.com" className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              <p className="text-xs text-custom-muted mt-1">{t('ntfy_url_help')}</p>
            </div>
            <div>
              <label className="block text-xs text-custom-muted mb-1">{t('ntfy_priority')}</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((p) => (
                  <button key={p} type="button" onClick={() => setSettings({ ...settings, ntfy_priority: p })} className={`w-10 h-9 rounded-lg text-sm font-medium ${Number(settings.ntfy_priority || 3) === p ? 'bg-cyan-500 text-white' : 'border-custom bg-custom-secondary text-custom'}`}>{p}</button>
                ))}
              </div>
              <p className="text-xs text-custom-muted mt-1">{t('ntfy_priority_desc')}</p>
            </div>
            <div>
              <label className="block text-xs text-custom-muted mb-1">{t('ntfy_token')}</label>
              <input type="password" value={ntfyToken} onChange={(e) => setNtfyToken(e.target.value)} placeholder={t('ntfy_token_unchanged')} autoComplete="off" className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
            <button onClick={saveReminders} className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">{t('save_settings')}</button>
            {remMsg && <p className={`text-sm ${remOk ? 'text-green-600' : 'text-red-500'}`}>{remMsg}</p>}
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">🔐 {t('device_pin_title')}</h3>
          <p className="text-sm text-custom-muted mb-3">{t('device_pin_desc')}</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-custom-muted mb-1">{settings.pin_enabled ? t('change_pin') : t('set_pin')}</label>
              <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder={t('pin_placeholder')} autoComplete="off" className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
            <label className="flex items-center gap-2 text-sm text-custom cursor-pointer">
              <input type="checkbox" checked={pinRequire} onChange={(e) => setPinRequire(e.target.checked)} className="rounded border-custom" />
              {t('require_on_device')}
            </label>
            <div className="flex gap-2">
              <button onClick={savePin} className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">{settings.pin_enabled ? t('change_pin') : t('set_pin')}</button>
              {settings.pin_enabled && (
                <button onClick={removePin} className="px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">{t('remove_pin')}</button>
              )}
            </div>
            {pinMsg && <p className={`text-sm ${pinOk ? 'text-green-600' : 'text-red-500'}`}>{pinMsg}</p>}
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('remembered_devices')}</h3>
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
                    <button onClick={() => forgetDevice(d.device_id)} className="text-red-500 hover:text-red-700 text-sm font-medium whitespace-nowrap">{t('forget_device')}</button>
                  </div>
                ))}
              </div>
              <button onClick={forgetAllDevices} className="px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">{t('forget_all_devices')}</button>
            </>
          )}
          {devMsg && <p className={`text-sm mt-2 ${devOk ? 'text-green-600' : 'text-red-500'}`}>{devMsg}</p>}
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('change_password')}</h3>
          <p className="text-xs text-custom-muted mb-3">{t('password_change_warning')}</p>
          <div className="space-y-3">
            <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder={t('current_password')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm" />
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t('new_password')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm" />
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder={t('confirm_password')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm" />
            <button onClick={changePassword} className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">{t('change_password')}</button>
            {pwMsg && <p className={`text-sm ${pwMsg.includes('changed') ? 'text-green-600' : 'text-red-500'}`}>{pwMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

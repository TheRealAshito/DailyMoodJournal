import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useI18n } from '../i18n'
import { useTheme } from '../contexts/ThemeContext'

const CATEGORIES = [
  { key: 'distortions', label: 'Cognitive Distortions' },
  { key: 'gratitude', label: 'Gratitude' },
  { key: 'reframing', label: 'Reframing' },
]

export default function Settings() {
  const { t, changeLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState(null)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [exportFmt, setExportFmt] = useState('tar.gz')
  const [impMsg, setImpMsg] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    api.get('/settings').then((r) => setSettings(r.data)).catch(() => {})
  }, [])

  async function changePassword() {
    setPwMsg('')
    if (newPw.length < 6) { setPwMsg('Min 6 characters.'); return }
    if (newPw !== confirmPw) { setPwMsg('Passwords dont match.'); return }
    try {
      await api.put('/auth/password', { old_password: oldPw, new_password: newPw })
      setPwMsg('Password changed!')
      setOldPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      setPwMsg(err.response?.data?.detail || 'Failed.')
    }
  }

  async function handleExport() {
    try {
      const r = await api.get(`/export?format=${exportFmt}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a'); a.href = url
      a.download = `dailymood_export.${exportFmt === 'tar.gz' ? 'tar.gz' : 'zip'}`
      a.click(); window.URL.revokeObjectURL(url)
    } catch {
      alert('Export failed.')
    }
  }

  async function handleImport() {
    setImpMsg('')
    const files = fileRef.current?.files
    if (!files || files.length === 0) return
    const form = new FormData()
    for (const f of files) form.append('files', f)
    try {
      const r = await api.post('/export/import', form)
      setImpMsg(`Imported ${r.data.imported}, skipped ${r.data.skipped}`)
    } catch {
      setImpMsg('Import failed.')
    }
  }

  function updateCbt(cat) {
    if (!settings) return
    const cats = settings.cbt_enabled_categories || []
    const updated = cats.includes(cat) ? cats.filter((c) => c !== cat) : [...cats, cat]
    const newS = { ...settings, cbt_enabled_categories: updated }
    setSettings(newS)
    api.put('/settings', { cbt_enabled_categories: updated }).catch(() => {})
  }

  if (!settings) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">{t('settings')}</h1>

      <div className="space-y-6">
        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('theme')}</h3>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="px-4 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm font-medium">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('language')}</h3>
          <div className="flex gap-2">
            <button onClick={() => changeLocale('en')} className={`px-4 py-2 rounded-lg text-sm font-medium ${settings.language === 'en' ? 'bg-purple-600 text-white' : 'border-custom bg-custom-secondary text-custom'}`}>
              English
            </button>
            <button onClick={() => changeLocale('pt-BR')} className={`px-4 py-2 rounded-lg text-sm font-medium ${settings.language === 'pt-BR' ? 'bg-purple-600 text-white' : 'border-custom bg-custom-secondary text-custom'}`}>
              Português
            </button>
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('cbt_prompts')}</h3>
          <p className="text-sm text-custom-muted mb-3">Choose which prompt categories appear when CBT is enabled on an entry.</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const active = (settings.cbt_enabled_categories || []).includes(cat.key)
              return (
                <button key={cat.key} onClick={() => updateCbt(cat.key)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${active ? 'bg-purple-600 text-white' : 'border-custom bg-custom-secondary text-custom'}`}>
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('export')}</h3>
          <div className="flex items-center gap-3 mb-3">
            <select value={exportFmt} onChange={(e) => setExportFmt(e.target.value)} className="px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm">
              <option value="tar.gz">.tar.gz</option>
              <option value="zip">.zip</option>
            </select>
            <button onClick={handleExport} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">{t('build_export')}</button>
          </div>
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('import')}</h3>
          <p className="text-sm text-custom-muted mb-3">{t('import_files')}</p>
          <input type="file" ref={fileRef} multiple accept=".tar.gz,.tgz,.zip,.md,.txt" className="mb-3 text-sm" />
          <button onClick={handleImport} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">{t('import')}</button>
          {impMsg && <p className="text-sm mt-2 text-custom-muted">{impMsg}</p>}
        </div>

        <div className="card-bg border border-custom rounded-xl p-5">
          <h3 className="font-semibold mb-3">{t('change_password')}</h3>
          <div className="space-y-3">
            <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder={t('current_password')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t('new_password')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder={t('confirm_password')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
            <button onClick={changePassword} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">{t('change_password')}</button>
            {pwMsg && <p className={`text-sm ${pwMsg.includes('changed') ? 'text-green-600' : 'text-red-500'}`}>{pwMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

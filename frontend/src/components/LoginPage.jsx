import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n'

function deviceLabel() {
  const ua = navigator.userAgent
  const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} on ${os}` : browser
}

export default function LoginPage() {
  const { login, deviceLogin } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberDevice, setRememberDevice] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState([])
  const [pickerVisible, setPickerVisible] = useState(true)
  const [pinUser, setPinUser] = useState('')
  const [pin, setPin] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  useEffect(() => {
    api.get('/auth/devices')
      .then((r) => {
        const users = r.data?.users || []
        setDevices(users)
        setPickerVisible(users.length > 0)
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    try {
      await login(username.trim(), password, { remember_device: rememberDevice, device_label: deviceLabel() })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeviceLogin(user) {
    setError('')
    setPinUser('')
    setPin('')
    setLoading(true)
    try {
      await deviceLogin(user)
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'PIN required') {
        setPinUser(user)
      } else {
        setError(typeof detail === 'string' ? detail : t('device_login_failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handlePinSubmit(e) {
    e.preventDefault()
    setError('')
    if (!pin.trim()) return
    setPinLoading(true)
    try {
      await deviceLogin(pinUser, pin.trim())
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'PIN required') {
        setError(t('pin_incorrect'))
      } else {
        setError(typeof detail === 'string' ? detail : t('device_login_failed'))
      }
    } finally {
      setPinLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-center mb-1">{String.fromCodePoint(0x1F4D4)} DailyMood</h1>
      <p className="text-center text-custom-muted mb-6">{t('login')}</p>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      {pinUser ? (
        <form onSubmit={handlePinSubmit} className="space-y-4">
          <p className="text-sm text-custom-muted">{t('pin_required_for', { username: pinUser })}</p>
          <div>
            <label className="block text-sm font-medium mb-1">{t('pin_label')}</label>
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400" autoFocus />
          </div>
          <button type="submit" disabled={pinLoading} className="w-full py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50">
            {pinLoading ? '...' : t('login')}
          </button>
          <button type="button" onClick={() => { setPinUser(''); setPin(''); setError('') }} className="w-full text-sm text-cyan-500 hover:underline">
            {t('back')}
          </button>
        </form>
      ) : pickerVisible && devices.length > 0 ? (
        <div className="space-y-3">
          {devices.map((u) => (
            <div key={u.username}>
              <button
                onClick={() => handleDeviceLogin(u.username)}
                disabled={loading}
                className="w-full py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
              >
                {t('continue_as', { username: u.username })}
              </button>
              {u.label && <p className="text-xs text-custom-muted text-center mt-1">{u.label}</p>}
            </div>
          ))}
          <button type="button" onClick={() => setPickerVisible(false)} className="w-full text-sm text-cyan-500 hover:underline pt-1">
            {t('sign_in_another_user')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('username')}</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
          <label className="flex items-center gap-2 text-sm text-custom cursor-pointer">
            <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} className="rounded border-custom" />
            {t('remember_device')}
          </label>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50">
            {loading ? '...' : t('login')}
          </button>
          {devices.length > 0 && (
            <button type="button" onClick={() => setPickerVisible(true)} className="w-full text-sm text-cyan-500 hover:underline">
              {t('back')}
            </button>
          )}
        </form>
      )}

      <div className="mt-4 text-center space-y-2">
        <Link to="/reset-password" className="text-sm text-cyan-500 hover:underline block">{t('forgot_password')}</Link>
        <p className="text-sm text-custom-muted">{t('no_account')} <Link to="/signup" className="text-cyan-500 hover:underline">{t('create_account')}</Link></p>
      </div>
    </div>
  )
}

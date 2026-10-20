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
    <div className="card w-full max-w-sm px-8 py-9 fade-up">
      <h1 className="display text-2xl text-center mb-1">{String.fromCodePoint(0x1F4D4)} DailyMood</h1>
      <p className="text-center text-custom-muted mb-6">{t('login')}</p>

      {error && <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2.5 mb-4 text-sm">{error}</div>}

      {pinUser ? (
        <form onSubmit={handlePinSubmit} className="space-y-4">
          <p className="text-sm text-custom-muted">{t('pin_required_for', { username: pinUser })}</p>
          <div>
            <label className="form-label">{t('pin_label')}</label>
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} className="input" autoFocus />
          </div>
          <button type="submit" disabled={pinLoading} className="btn btn-primary btn-lg w-full">
            {pinLoading ? '...' : t('login')}
          </button>
          <button type="button" onClick={() => { setPinUser(''); setPin(''); setError('') }} className="btn btn-ghost w-full">
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
                className="btn btn-primary w-full"
              >
                {t('continue_as', { username: u.username })}
              </button>
              {u.label && <p className="text-xs text-custom-muted text-center mt-1">{u.label}</p>}
            </div>
          ))}
          <button type="button" onClick={() => setPickerVisible(false)} className="btn btn-ghost w-full">
            {t('sign_in_another_user')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">{t('username')}</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input" autoFocus />
          </div>
          <div>
            <label className="form-label">{t('password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm text-custom cursor-pointer">
            <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} className="rounded border-custom accent-[var(--accent)]" />
            {t('remember_device')}
          </label>
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
            {loading ? '...' : t('login')}
          </button>
          {devices.length > 0 && (
            <button type="button" onClick={() => setPickerVisible(true)} className="btn btn-ghost w-full">
              {t('back')}
            </button>
          )}
        </form>
      )}

      <div className="mt-4 text-center space-y-2">
        <Link to="/reset-password" className="text-sm text-accent hover:underline block">{t('forgot_password')}</Link>
        <p className="text-sm text-custom-muted">{t('no_account')} <Link to="/signup" className="text-accent hover:underline">{t('create_account')}</Link></p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useI18n } from '../i18n'

export default function ResetPasswordPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [step, setStep] = useState('username')
  const [username, setUsername] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUsername() {
    setError('')
    setLoading(true)
    try {
      const r = await api.post('/auth/password-reset-request', { username: username.trim() })
      if (r.data.question) {
        setQuestion(r.data.question)
        setStep('answer')
      } else {
        setError('User not found.')
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : (detail?.[0]?.msg || 'Error.'))
    }
    setLoading(false)
  }

  async function handleAnswer() {
    setError('')
    setLoading(true)
    try {
      const r = await api.post('/auth/password-reset-verify', { username: username.trim(), answer })
      setToken(r.data.token)
      setStep('new_password')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : (detail?.[0]?.msg || 'Error.'))
    }
    setLoading(false)
  }

  async function handleReset() {
    setError('')
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/password-reset-complete', { username, token, new_password: newPassword })
      setSuccess('Password reset! Redirecting...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : (detail?.[0]?.msg || 'Failed.'))
    }
    setLoading(false)
  }

  return (
    <div className="card w-full max-w-sm px-8 py-9 fade-up">
      <h1 className="display text-2xl text-center mb-1">{String.fromCodePoint(0x1F4D4)} DailyMood</h1>
      <p className="text-center text-custom-muted mb-6">{t('reset_password')}</p>

      {error && <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2.5 mb-4 text-sm">{error}</div>}
      {success && <div className="rounded-lg border border-[var(--success)] bg-custom-secondary text-[var(--success)] px-3 py-2.5 mb-4 text-sm">{success}</div>}

      {step === 'username' && (
        <div className="space-y-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('username')} className="input" autoFocus />
          <button onClick={handleUsername} disabled={loading} className="btn btn-primary btn-lg w-full">{t('continue')}</button>
        </div>
      )}

      {step === 'answer' && (
        <div className="space-y-4">
          <p className="text-sm text-custom-muted">{question}</p>
          <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t('security_answer')} className="input" autoFocus />
          <button onClick={handleAnswer} disabled={loading} className="btn btn-primary btn-lg w-full">{t('verify')}</button>
        </div>
      )}

      {step === 'new_password' && (
        <div className="space-y-4">
          <p className="text-xs text-custom-muted">{t('reset_password_warning')}</p>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('new_password')} className="input" autoFocus />
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t('confirm_password')} className="input" />
          <button onClick={handleReset} disabled={loading} className="btn btn-primary btn-lg w-full">{t('reset_password')}</button>
        </div>
      )}

      <p className="mt-4 text-center text-sm text-custom-muted">
        <Link to="/login" className="text-accent hover:underline">{t('back_to_login')}</Link>
      </p>
    </div>
  )
}

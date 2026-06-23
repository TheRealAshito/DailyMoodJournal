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
      const r = await api.post('/auth/password-reset-request', { username })
      if (r.data.question) {
        setQuestion(r.data.question)
        setStep('answer')
      } else {
        setError('User not found.')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error.')
    }
    setLoading(false)
  }

  async function handleAnswer() {
    setError('')
    setLoading(true)
    try {
      const r = await api.post('/auth/password-reset-verify', { username, password: answer })
      setToken(r.data.token)
      setStep('new_password')
    } catch (err) {
      setError(err.response?.data?.detail || 'Incorrect answer.')
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
      setError(err.response?.data?.detail || 'Failed.')
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-center mb-1">{String.fromCodePoint(0x1F4D4)} DailyMood</h1>
      <p className="text-center text-custom-muted mb-6">{t('reset_password')}</p>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-lg p-3 mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 rounded-lg p-3 mb-4 text-sm">{success}</div>}

      {step === 'username' && (
        <div className="space-y-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('username')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" autoFocus />
          <button onClick={handleUsername} disabled={loading} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">{t('continue')}</button>
        </div>
      )}

      {step === 'answer' && (
        <div className="space-y-4">
          <p className="text-sm text-custom-muted">{question}</p>
          <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t('security_answer')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" autoFocus />
          <button onClick={handleAnswer} disabled={loading} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">{t('verify')}</button>
        </div>
      )}

      {step === 'new_password' && (
        <div className="space-y-4">
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('new_password')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" autoFocus />
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t('confirm_password')} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <button onClick={handleReset} disabled={loading} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">{t('reset_password')}</button>
        </div>
      )}

      <p className="mt-4 text-center text-sm text-custom-muted">
        <Link to="/login" className="text-purple-600 hover:underline">{t('back_to_login')}</Link>
      </p>
    </div>
  )
}

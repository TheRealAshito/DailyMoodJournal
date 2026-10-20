import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n'

const QUESTIONS = [
  "What is your first pet's name?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What is your favorite book?",
  "What was the name of your first school?",
  "What is your childhood best friend's name?",
]

export default function SignupPage() {
  const { signup } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [question, setQuestion] = useState(QUESTIONS[0])
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password || !answer.trim()) {
      setError('Please fill in all fields.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await signup(username.trim(), password, question, answer)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card w-full max-w-sm px-8 py-9 fade-up">
      <h1 className="display text-2xl text-center mb-1">{String.fromCodePoint(0x1F4D4)} DailyMood</h1>
      <p className="text-center text-custom-muted mb-6">{t('signup')}</p>

      {error && <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2.5 mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">{t('username')}</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input" autoFocus />
        </div>
        <div>
          <label className="form-label">{t('password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </div>
        <div>
          <label className="form-label">{t('confirm_password')}</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
        </div>
        <div>
          <label className="form-label">{t('security_question')}</label>
          <select value={question} onChange={(e) => setQuestion(e.target.value)} className="input">
            {QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">{t('security_answer')}</label>
          <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} className="input" />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
          {loading ? '...' : t('signup')}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-custom-muted">
        <Link to="/login" className="text-accent hover:underline">{t('back_to_login')}</Link>
      </p>
    </div>
  )
}

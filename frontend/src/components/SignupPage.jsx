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
      await signup(username, password, question, answer)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-center mb-1">DailyMood</h1>
      <p className="text-center text-custom-muted mb-6">{t('signup')}</p>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('username')}</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('confirm_password')}</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('security_question')}</label>
          <select value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500">
            {QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('security_answer')}</label>
          <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} className="w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <button type="submit" disabled={loading} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
          {loading ? '...' : t('signup')}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-custom-muted">
        <Link to="/login" className="text-purple-600 hover:underline">{t('back_to_login')}</Link>
      </p>
    </div>
  )
}

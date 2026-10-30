import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useTheme } from './contexts/ThemeContext'
import { useDateFormat } from './contexts/DateFormatContext'
import { useI18n } from './i18n'
import ErrorBoundary from './components/ErrorBoundary'
import AppShell from './components/AppShell'
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import ResetPasswordPage from './components/ResetPasswordPage'
import Calendar from './components/Calendar'
import EntryForm from './components/EntryForm'
import Insights from './components/Insights'
import Trackers from './components/Trackers'
import MindMapGallery from './components/MindMapGallery'
import MindMapEditor from './components/MindMapEditor'
import Settings from './components/Settings'
import Help from './components/Help'
import FreeWrite from './components/FreeWrite'

function ProtectedLayout() {
  return (
    <AppShell>
      <Routes>
        <Route index element={<Calendar />} />
        <Route path="new" element={<EntryForm />} />
        <Route path="edit/:encodedPath" element={<EntryForm />} />
        <Route path="insights" element={<Insights />} />
        <Route path="trackers" element={<Trackers />} />
        <Route path="maps" element={<MindMapGallery />} />
        <Route path="maps/:id" element={<MindMapEditor />} />
        <Route path="settings" element={<Settings />} />
        <Route path="freewrite" element={<FreeWrite />} />
        <Route path="help" element={<Help />} />
        {/* Old paths keep working via redirects */}
        <Route path="search" element={<Navigate to="/insights" replace />} />
        <Route path="stats" element={<Navigate to="/insights" replace />} />
        <Route path="about-cbt" element={<Navigate to="/help" replace />} />
        <Route path="how-to-use" element={<Navigate to="/help" replace />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const { changeLocale } = useI18n()
  const { setTheme, setAccent } = useTheme()
  const { setDateFormat } = useDateFormat()

  // Sync locale, theme, accent, and date format from backend settings
  useEffect(() => {
    if (user?.settings?.language) {
      changeLocale(user.settings.language)
    }
    if (user?.settings?.theme) {
      setTheme(user.settings.theme)
    }
    if (user?.settings?.accent) {
      setAccent(user.settings.accent)
    }
    if (user?.settings?.date_format) {
      setDateFormat(user.settings.date_format)
    }
  }, [user?.settings?.language, user?.settings?.theme, user?.settings?.accent, user?.settings?.date_format])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-custom">
        <div className="spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-custom px-4">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/*" element={<ProtectedLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

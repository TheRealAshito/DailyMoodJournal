import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useI18n } from './i18n'
import Navbar from './components/Navbar'
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import ResetPasswordPage from './components/ResetPasswordPage'
import HowToUse from './components/HowToUse'
import Calendar from './components/Calendar'
import EntryForm from './components/EntryForm'
import Search from './components/Search'
import Stats from './components/Stats'
import Settings from './components/Settings'
import AboutCBT from './components/AboutCBT'

function ProtectedLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-custom">
      <Navbar />
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Routes>
          <Route index element={<Calendar />} />
          <Route path="new" element={<EntryForm />} />
          <Route path="edit/:encodedPath" element={<EntryForm />} />
          <Route path="search" element={<Search />} />
          <Route path="stats" element={<Stats />} />
          <Route path="settings" element={<Settings />} />
          <Route path="about-cbt" element={<AboutCBT />} />
          <Route path="how-to-use" element={<HowToUse />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const { changeLocale } = useI18n()

  // Sync locale from backend settings whenever user state changes
  useEffect(() => {
    if (user?.settings?.language) {
      changeLocale(user.settings.language)
    }
  }, [user?.settings?.language])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-custom">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
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
    <Routes>
      <Route path="/*" element={<ProtectedLayout />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../i18n'

const NAV_ITEMS = [
  { to: '/', icon: '\uD83D\uDCC5', key: 'journal', end: true },
  { to: '/new', icon: '\u270F\uFE0F', key: 'new_entry', end: false },
  { to: '/search', icon: '\uD83D\uDD0D', key: 'search', end: false },
  { to: '/stats', icon: '\uD83D\uDCCA', key: 'stats', end: false },
  { to: '/about-cbt', icon: '\uD83E\uDDE0', key: 'about_cbt', end: false },
  { to: '/settings', icon: '\u2699\uFE0F', key: 'settings', end: false },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t, locale, changeLocale } = useI18n()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sidebar-bg border-b border-custom sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-4">
        <h1 className="text-lg font-bold text-purple-600 whitespace-nowrap">\uD83D\uDCD4 DailyMood</h1>

        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-purple-600 text-white'
                    : 'text-custom hover-bg'
                }`
              }
            >
              {item.icon} {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-custom-muted hidden sm:inline">{user?.username}</span>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="px-2 py-1.5 rounded-lg text-sm text-custom hover-bg transition-colors"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
          </button>

          <div className="flex gap-0.5">
            <button
              onClick={() => changeLocale('en')}
              className={`px-1.5 py-1 rounded text-xs font-medium ${
                locale === 'en' ? 'bg-purple-600 text-white' : 'text-custom-muted hover-bg'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => changeLocale('pt-BR')}
              className={`px-1.5 py-1 rounded text-xs font-medium ${
                locale === 'pt-BR' ? 'bg-purple-600 text-white' : 'text-custom-muted hover-bg'
              }`}
            >
              PT
            </button>
          </div>

          <button onClick={handleLogout} className="px-2 py-1.5 rounded-lg text-sm text-red-500 hover-bg" title="Logout">
            \uD83D\uDEAA
          </button>
        </div>
      </div>
    </header>
  )
}

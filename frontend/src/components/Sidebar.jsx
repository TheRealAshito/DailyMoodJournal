import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../i18n'

const NAV_ITEMS = [
  { to: '/new', icon: '\u270f\ufe0f', key: 'new_entry' },
  { to: '/', icon: '\U0001f4c5', key: 'journal' },
  { to: '/search', icon: '\U0001f50d', key: 'search' },
  { to: '/stats', icon: '\U0001f4ca', key: 'stats' },
  { to: '/about-cbt', icon: '\U0001f9e0', key: 'about_cbt' },
  { to: '/settings', icon: '\u2699\ufe0f', key: 'settings' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t, locale, changeLocale } = useI18n()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="w-64 sidebar-bg border-r border-custom flex flex-col h-screen">
      <div className="p-4 border-b border-custom">
        <h1 className="text-lg font-bold text-purple-600">\U0001f4d4 DailyMood</h1>
        <p className="text-sm text-custom-muted mt-1">{user?.username}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-purple-600 text-white'
                  : 'text-custom hover-bg'
              }`
            }
          >
            <span>{item.icon}</span>
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-custom space-y-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-custom hover-bg transition-colors"
        >
          <span>{theme === 'dark' ? '\u2600\ufe0f' : '\U0001f319'}</span>
          {t(theme === 'dark' ? 'light_mode' : 'dark_mode')}
        </button>

        <div className="flex gap-1">
          <button
            onClick={() => changeLocale('en')}
            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              locale === 'en'
                ? 'bg-purple-600 text-white'
                : 'text-custom-muted hover-bg'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => changeLocale('pt-BR')}
            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              locale === 'pt-BR'
                ? 'bg-purple-600 text-white'
                : 'text-custom-muted hover-bg'
            }`}
          >
            PT-BR
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-500 hover-bg transition-colors"
        >
          <span>\U0001f6aa</span>
          {t('logout')}
        </button>
      </div>
    </aside>
  )
}

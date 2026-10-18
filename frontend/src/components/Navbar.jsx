import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../i18n'
import api from '../api'

const NAV_ITEMS = [
  { to: '/', icon: '\uD83D\uDCC5', key: 'journal', end: true },
  { to: '/new', icon: '\u270F\uFE0F', key: 'new_entry', end: false },
  { to: '/freewrite', icon: '\uD83D\uDCDD', key: 'free_write', end: false },
  { to: '/search', icon: '\uD83D\uDD0D', key: 'search', end: false },
  { to: '/stats', icon: '\uD83D\uDCCA', key: 'stats', end: false },
  { to: '/trackers', icon: '\uD83D\uDCC8', key: 'trackers', end: false },
  { to: '/about-cbt', icon: '\uD83E\uDDE0', key: 'about_cbt', end: false },
]

function LogoutButton({ onLogout, t }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="px-2 py-1.5 rounded-lg text-sm text-red-500 hover-bg" title={t('logout')}>
        {String.fromCodePoint(0x1F6AA)}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-custom bg-custom-secondary shadow-lg p-2 space-y-1 z-50">
          <button onClick={() => { setOpen(false); onLogout(false) }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-custom hover-bg transition-colors">
            {t('logout_keep')}
          </button>
          <button onClick={() => { setOpen(false); onLogout(true) }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-500 hover-bg transition-colors">
            {t('logout_forget')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout(forgetDevice = false) {
    await logout(forgetDevice)
    navigate('/login')
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    api.put('/settings', { theme: next }).catch(() => {})
  }

  return (
    <>
      <header className="sidebar-bg border-b border-custom sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-4">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-1.5 rounded-lg text-custom hover-bg transition-colors"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <h1 className="text-lg font-bold text-cyan-500 whitespace-nowrap">{String.fromCodePoint(0x1F4D4)} DailyMood</h1>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500 text-white'
                      : 'text-custom hover-bg'
                  }`
                }
              >
                {item.icon} {t(item.key)}
              </NavLink>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="text-xs text-custom-muted">{user?.username}</span>

            <NavLink
              to="/how-to-use"
              className={({ isActive }) =>
                `px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-cyan-500 text-white' : 'text-custom hover-bg'
                }`
              }
              title={t('howto')}
            >
              ❓
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-cyan-500 text-white' : 'text-custom hover-bg'
                }`
              }
              title={t('settings')}
            >
              ⚙️
            </NavLink>
            <button
              onClick={toggleTheme}
              className="px-2 py-1.5 rounded-lg text-sm text-custom hover-bg transition-colors"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
            </button>

            <LogoutButton onLogout={handleLogout} t={t} />
          </div>

          {/* Mobile actions — just settings + logout */}
          <div className="flex md:hidden items-center gap-1 ml-auto shrink-0">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-cyan-500 text-white' : 'text-custom hover-bg'
                }`
              }
            >
              ⚙️
            </NavLink>
            <LogoutButton onLogout={handleLogout} t={t} />
          </div>
        </div>
      </header>

      {/* Mobile slide-out overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />
          {/* Drawer */}
          <nav
            className="absolute top-14 left-0 w-64 max-w-[80vw] sidebar-bg border-r border-custom shadow-xl h-[calc(100vh-3.5rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 space-y-1">
              {/* Username */}
              <div className="px-3 py-2 text-xs text-custom-muted border-b border-custom mb-2">
                {user?.username}
              </div>

              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-cyan-500 text-white'
                        : 'text-custom hover-bg'
                    }`
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  {t(item.key)}
                </NavLink>
              ))}

              {/* Divider */}
              <div className="border-t border-custom my-2" />

              {/* How to use */}
              <NavLink
                to="/how-to-use"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-cyan-500 text-white' : 'text-custom hover-bg'
                  }`
                }
              >
                <span className="text-base">❓</span>
                {t('howto')}
              </NavLink>

              {/* Theme toggle */}
              <button
                onClick={() => { toggleTheme(); setMenuOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-custom hover-bg transition-colors w-full text-left"
              >
                <span className="text-base">{theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}</span>
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}

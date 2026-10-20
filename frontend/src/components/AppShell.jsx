import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../i18n'
import api from '../api'
import StickyNote from './StickyNote'
import NudgeBanner from './NudgeBanner'

/* Minimal stroke icon set (1.6px, rounded) — no icon font, no CDN. */
const ICONS = {
  journal: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" /><path d="M8 7.5h7M8 11h7" /></>,
  pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  notebook: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18M12 8h4M12 12h4" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.4 9a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.4-2.6 3.6" /><circle cx="12" cy="17" r="0.8" fill="currentColor" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>,
  moon: <><path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  logout: <><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></>,
}

export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

const NAV_PRIMARY = [
  { to: '/', icon: 'journal', key: 'journal', end: true },
  { to: '/new', icon: 'pen', key: 'new_entry' },
  { to: '/freewrite', icon: 'notebook', key: 'free_write' },
]
const NAV_SECONDARY = [
  { to: '/insights', icon: 'chart', key: 'insights' },
  { to: '/trackers', icon: 'target', key: 'trackers' },
]
const NAV_FOOTER = [
  { to: '/help', icon: 'help', key: 'help' },
  { to: '/settings', icon: 'settings', key: 'settings' },
]
const MOBILE_TABS = [
  { to: '/', icon: 'journal', key: 'journal', end: true },
  { to: '/new', icon: 'pen', key: 'new_entry' },
  { to: '/insights', icon: 'chart', key: 'insights' },
  { to: '/trackers', icon: 'target', key: 'trackers' },
]

export default function AppShell({ children }) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    api.put('/settings', { theme: next }).catch(() => {})
  }

  async function handleLogout(forgetDevice = false) {
    await logout(forgetDevice)
    navigate('/login')
  }

  const items = (list, onNavigate) =>
    list.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
      >
        <Icon name={item.icon} size={19} />
        <span>{t(item.key)}</span>
      </NavLink>
    ))

  return (
    <div className="min-h-screen bg-custom">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-[248px] flex-col sidebar-bg border-r border-custom z-40">
        <div className="px-5 pt-6 pb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{String.fromCodePoint(0x1F4D4)}</span>
            <div>
              <div className="display text-lg leading-tight">DailyMood</div>
              <div className="text-[11px] text-custom-muted leading-tight">{t('app_tagline')}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
          {items(NAV_PRIMARY)}
          <div className="pt-4 pb-1 px-2 text-[10.5px] font-semibold uppercase tracking-widest text-custom-muted">
            {t('nav_section_insights')}
          </div>
          {items(NAV_SECONDARY)}
          <div className="pt-4 pb-1 px-2 text-[10.5px] font-semibold uppercase tracking-widest text-custom-muted">
            {t('nav_section_support')}
          </div>
          {items(NAV_FOOTER)}
        </nav>

        <div className="p-3 border-t border-custom space-y-1">
          <button onClick={toggleTheme} className="nav-item w-full">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
            <span>{theme === 'dark' ? t('theme_light') : t('theme_dark')}</span>
          </button>
          <div className="relative">
            <button onClick={() => setAccountOpen(!accountOpen)} className="nav-item w-full">
              <Icon name="user" size={19} />
              <span className="truncate flex-1 text-left">{user?.username}</span>
            </button>
            {accountOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 card card-pad py-2 fade-up" style={{ boxShadow: 'var(--shadow-lg)' }}>
                <button
                  onClick={() => { setAccountOpen(false); handleLogout(false) }}
                  className="nav-item w-full"
                >
                  <Icon name="logout" size={18} />
                  <span>{t('logout_keep')}</span>
                </button>
                <button
                  onClick={() => { setAccountOpen(false); handleLogout(true) }}
                  className="nav-item w-full"
                  style={{ color: 'var(--danger)' }}
                >
                  <Icon name="logout" size={18} />
                  <span>{t('logout_forget')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ---------- Content column ---------- */}
      <div className="md:pl-[248px]">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 sidebar-bg border-b border-custom">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              <span className="text-xl">{String.fromCodePoint(0x1F4D4)}</span>
              <span className="display text-base">DailyMood</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleTheme} className="p-2 rounded-full text-custom-muted hover-bg" aria-label={t('theme')}>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
              </button>
              <NavLink to="/settings" className="p-2 rounded-full text-custom-muted hover-bg" aria-label={t('settings')}>
                <Icon name="settings" size={20} />
              </NavLink>
            </div>
          </div>
        </header>

        <StickyNote />
        <NudgeBanner />

        <main key={location.pathname} className="fade-up px-4 pt-5 pb-28 md:px-10 md:pt-8 md:pb-12 max-w-5xl">
          {children}
        </main>
      </div>

      {/* ---------- Mobile bottom tabs ---------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 sidebar-bg border-t border-custom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch justify-around px-2 pt-1.5 pb-1">
          {MOBILE_TABS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => `tab-item flex-1 ${isActive ? 'tab-item-active' : ''}`}>
              {({ isActive }) => (
                <>
                  <span className={`tab-icon ${isActive ? 'tab-item-active' : ''}`}><Icon name={item.icon} size={20} /></span>
                  <span>{t(item.key)}</span>
                </>
              )}
            </NavLink>
          ))}
          <button onClick={() => setMenuOpen(true)} className="tab-item flex-1">
            <span className="tab-icon"><Icon name="menu" size={20} /></span>
            <span>{t('menu')}</span>
          </button>
        </div>
      </nav>

      {/* ---------- Mobile menu sheet ---------- */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(30,20,10,0.45)' }} />
          <div className="absolute bottom-0 inset-x-0 card fade-up" style={{ borderRadius: '1.25rem 1.25rem 0 0', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-9 h-1.5 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="px-3 pb-6 pt-2 space-y-1">
              {items(NAV_PRIMARY.slice(2), () => setMenuOpen(false))}
              <div className="divider my-2" />
              {items(NAV_FOOTER, () => setMenuOpen(false))}
              <button onClick={() => { toggleTheme(); setMenuOpen(false) }} className="nav-item w-full">
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
                <span>{theme === 'dark' ? t('theme_light') : t('theme_dark')}</span>
              </button>
              <div className="divider my-2" />
              <button onClick={() => { setMenuOpen(false); handleLogout(false) }} className="nav-item w-full">
                <Icon name="logout" size={19} />
                <span>{t('logout_keep')}</span>
              </button>
              <button onClick={() => { setMenuOpen(false); handleLogout(true) }}
                className="nav-item w-full" style={{ color: 'var(--danger)' }}>
                <Icon name="logout" size={19} />
                <span>{t('logout_forget')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export const ACCENTS = ['terracotta', 'sage', 'ocean', 'plum', 'rose']

function applyAccent(accent) {
  const value = ACCENTS.includes(accent) ? accent : 'terracotta'
  document.documentElement.dataset.accent = value
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Default to dark; apply the class immediately to avoid flash
    document.documentElement.classList.add('dark')
    return 'dark'
  })
  const [accent, setAccentState] = useState(() => {
    const saved = localStorage.getItem('accent') || 'terracotta'
    applyAccent(saved)
    return ACCENTS.includes(saved) ? saved : 'terracotta'
  })

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [theme])

  function setAccent(next) {
    const value = ACCENTS.includes(next) ? next : 'terracotta'
    setAccentState(value)
    applyAccent(value)
    try { localStorage.setItem('accent', value) } catch { /* private mode */ }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}

import { createContext, useContext, useState, useEffect } from 'react'

const I18nContext = createContext(null)

const LOCALE_CACHE = {}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState('en')
  const [messages, setMessages] = useState({})

  useEffect(() => {
    const stored = localStorage.getItem('dailymood_language') || 'en'
    setLocale(stored)
  }, [])

  useEffect(() => {
    if (LOCALE_CACHE[locale]) {
      setMessages(LOCALE_CACHE[locale])
      return
    }
    fetch(`/locales/${locale}.json`)
      .then((r) => r.json())
      .then((data) => {
        LOCALE_CACHE[locale] = data
        setMessages(data)
      })
      .catch(() => {
        if (locale !== 'en') {
          fetch('/locales/en.json')
            .then((r) => r.json())
            .then((data) => setMessages(data))
        }
      })
  }, [locale])

  function changeLocale(lang) {
    setLocale(lang)
    localStorage.setItem('dailymood_language', lang)
  }

  return (
    <I18nContext.Provider value={{ locale, messages, changeLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  return {
    t: (key, params = {}) => {
      let text = ctx.messages[key] || key
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v)
      })
      return text
    },
    locale: ctx.locale,
    changeLocale: ctx.changeLocale,
  }
}

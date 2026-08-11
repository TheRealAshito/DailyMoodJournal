import { createContext, useContext, useState } from 'react'

const DateFormatContext = createContext(null)

const DEFAULT_FORMAT = 'YYYY-MM-DD'

// Format a date string (YYYY-MM-DD or ISO) according to the selected format
export function formatDateStr(dateStr, format) {
  if (!dateStr) return ''
  const d = dateStr.slice(0, 10) // Get YYYY-MM-DD part
  const parts = d.split('-')
  if (parts.length !== 3) return dateStr
  const [y, m, day] = parts
  switch (format) {
    case 'DD-MM-YYYY': return `${day}-${m}-${y}`
    case 'MM-DD-YYYY': return `${m}-${day}-${y}`
    default: return `${y}-${m}-${day}`
  }
}

export function DateFormatProvider({ children }) {
  const [dateFormat, setDateFormat] = useState(DEFAULT_FORMAT)

  function formatDate(dateStr) {
    return formatDateStr(dateStr, dateFormat)
  }

  return (
    <DateFormatContext.Provider value={{ dateFormat, setDateFormat, formatDate }}>
      {children}
    </DateFormatContext.Provider>
  )
}

export function useDateFormat() {
  const ctx = useContext(DateFormatContext)
  if (!ctx) return { dateFormat: DEFAULT_FORMAT, setDateFormat: () => {}, formatDate: (d) => d }
  return ctx
}

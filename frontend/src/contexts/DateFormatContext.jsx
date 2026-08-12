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

// Parse a date string in the given format back to YYYY-MM-DD
export function parseDateStr(str, format) {
  if (!str) return null
  // Normalize separators: accept / or . as well as -
  const cleaned = str.trim().replace(/[/.]/g, '-')
  const parts = cleaned.split('-')
  if (parts.length !== 3) return null

  let y, m, d
  switch (format) {
    case 'DD-MM-YYYY':
      [d, m, y] = parts
      break
    case 'MM-DD-YYYY':
      [m, d, y] = parts
      break
    default: // YYYY-MM-DD
      [y, m, d] = parts
  }

  // Validate
  const yi = parseInt(y, 10)
  const mi = parseInt(m, 10)
  const di = parseInt(d, 10)
  if (isNaN(yi) || isNaN(mi) || isNaN(di)) return null
  if (yi < 1000 || yi > 9999) return null
  if (mi < 1 || mi > 12) return null
  if (di < 1 || di > 31) return null

  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Get placeholder string for the format (e.g. "DD-MM-YYYY")
export function getFormatPlaceholder(format) {
  return format || DEFAULT_FORMAT
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

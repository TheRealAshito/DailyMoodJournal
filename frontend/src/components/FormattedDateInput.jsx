import { useRef, useState, useEffect } from 'react'
import { useDateFormat, formatDateStr, parseDateStr, getFormatPlaceholder } from '../contexts/DateFormatContext'

export default function FormattedDateInput({ value, onChange, className = '' }) {
  const { dateFormat } = useDateFormat()
  const hiddenRef = useRef(null)
  const [displayValue, setDisplayValue] = useState('')

  // Sync display when value or format changes
  useEffect(() => {
    setDisplayValue(formatDateStr(value, dateFormat))
  }, [value, dateFormat])

  function handleTextChange(e) {
    const raw = e.target.value
    setDisplayValue(raw)
    const iso = parseDateStr(raw, dateFormat)
    if (iso) {
      onChange(iso)
    }
  }

  function handleTextBlur() {
    // On blur, re-sync display to the canonical formatted value
    setDisplayValue(formatDateStr(value, dateFormat))
  }

  function handlePickerChange(e) {
    const iso = e.target.value // Already YYYY-MM-DD from native picker
    if (iso) {
      onChange(iso)
      setDisplayValue(formatDateStr(iso, dateFormat))
    }
  }

  function openPicker() {
    if (hiddenRef.current?.showPicker) {
      hiddenRef.current.showPicker()
    } else {
      hiddenRef.current?.click()
    }
  }

  const placeholder = getFormatPlaceholder(dateFormat)

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        placeholder={placeholder}
        className={className + ' pr-9'}
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-custom-muted hover:text-cyan-500 transition-colors p-0.5"
        title="Open calendar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      <input
        ref={hiddenRef}
        type="date"
        value={value || ''}
        onChange={handlePickerChange}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}

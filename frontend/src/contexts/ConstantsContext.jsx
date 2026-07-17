import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

// Fallback values (same as backend config.py) — used if fetch fails
const FALLBACK = {
  mood_colors: { 0: '#4a148c', 1: '#6a1b9a', 2: '#9c27b0', 3: '#9e9e9e', 4: '#66bb6a', 5: '#43a047', 6: '#2e7d32' },
  mood_labels: { 0: 'Terrible', 1: 'Bad', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Great', 6: 'Amazing' },
  mood_emojis: { 0: '\u{1F61E}', 1: '\u{1F622}', 2: '\u{1F615}', 3: '\u{1F610}', 4: '\u{1F642}', 5: '\u{1F60A}', 6: '\u{1F929}' },
  default_tags: {},
}

const ConstantsContext = createContext(FALLBACK)

export function ConstantsProvider({ children }) {
  const [constants, setConstants] = useState(FALLBACK)

  useEffect(() => {
    api.get('/constants')
      .then((r) => setConstants(r.data))
      .catch(() => {}) // fallback stays
  }, [])

  return (
    <ConstantsContext.Provider value={constants}>
      {children}
    </ConstantsContext.Provider>
  )
}

export function useConstants() {
  return useContext(ConstantsContext)
}

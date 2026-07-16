import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/auth/me')
      .then((r) => {
        setUser({ username: r.data.username, settings: r.data.settings })
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const r = await api.post('/auth/login', { username, password })
    setUser({ username: r.data.username, settings: r.data.settings })
    return r.data
  }, [])

  const signup = useCallback(async (username, password, security_question, security_answer) => {
    const r = await api.post('/auth/signup', { username, password, security_question, security_answer })
    setUser({ username: r.data.username, settings: r.data.settings })
    return r.data
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

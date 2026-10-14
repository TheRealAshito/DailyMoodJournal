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

  const login = useCallback(async (username, password, opts = {}) => {
    const body = { username, remember_device: !!opts.remember_device }
    if (password) body.password = password
    if (opts.pin) body.pin = opts.pin
    if (opts.device_label) body.device_label = opts.device_label
    const r = await api.post('/auth/login', body)
    setUser({ username: r.data.username, settings: r.data.settings })
    return r.data
  }, [])

  const deviceLogin = useCallback(async (username, pin) => {
    const body = { username }
    if (pin) body.pin = pin
    const r = await api.post('/auth/device-login', body)
    setUser({ username: r.data.username, settings: r.data.settings })
    return r.data
  }, [])

  const signup = useCallback(async (username, password, security_question, security_answer) => {
    const r = await api.post('/auth/signup', { username, password, security_question, security_answer })
    setUser({ username: r.data.username, settings: r.data.settings })
    return r.data
  }, [])

  const logout = useCallback(async (forgetDevice = false) => {
    await api.post('/auth/logout', { forget_device: !!forgetDevice })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, deviceLogin, signup, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

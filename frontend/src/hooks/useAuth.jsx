/**
 * JobTrack AI — Hook de autenticación
 * Maneja sesión (login/signup/logout), persiste el token en localStorage
 * y lo refresca automáticamente cuando expira (~1h).
 */
import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { fbLogin, fbRegister, fbSendPasswordReset, fbRefreshToken } from '../firebase-client'

const AuthContext = createContext(null)
const STORAGE_KEY = 'jobtrack_session'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // { uid, email }
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Al montar: intenta restaurar sesión guardada
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) { setLoading(false); return }

    const session = JSON.parse(saved)
    fbRefreshToken(session.refreshToken)
      .then(({ token, refreshToken, uid }) => {
        setToken(token)
        setUser({ uid, email: session.email })
        persistSession({ email: session.email, refreshToken })
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setLoading(false))
  }, [])

  const persistSession = (session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }

  const login = useCallback(async (email, password) => {
    setError(null)
    try {
      const r = await fbLogin(email, password)
      setUser({ uid: r.uid, email: r.email })
      setToken(r.token)
      persistSession({ email: r.email, refreshToken: r.refreshToken })
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }, [])

  const signup = useCallback(async (email, password) => {
    setError(null)
    try {
      const r = await fbRegister(email, password)
      setUser({ uid: r.uid, email: r.email })
      setToken(r.token)
      persistSession({ email: r.email, refreshToken: r.refreshToken })
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }, [])

  const resetPassword = useCallback(async (email) => {
    setError(null)
    try {
      await fbSendPasswordReset(email)
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, signup, resetPassword, logout, setError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

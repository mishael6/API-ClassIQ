import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('classiq_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  const login = async (credentials) => {
    setLoading(true)
    try {
      const { data } = await authApi.login(credentials)
      if (data.token) {
        localStorage.setItem('classiq_token', data.token)
        localStorage.setItem('classiq_user', JSON.stringify(data.user))
        setUser(data.user)
      }
      return data
    } finally {
      setLoading(false)
    }
  }

  const adminLogin = async (credentials) => {
    setLoading(true)
    try {
      const { data } = await authApi.adminLogin(credentials)
      if (data.token) {
        localStorage.setItem('classiq_token', data.token)
        localStorage.setItem('classiq_user', JSON.stringify(data.user))
        setUser(data.user)
      }
      return data
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try { await authApi.logout() } catch {}
    localStorage.removeItem('classiq_token')
    localStorage.removeItem('classiq_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

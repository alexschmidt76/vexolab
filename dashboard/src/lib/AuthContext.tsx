import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { api } from "../api"
import { User } from "../../../shared/types"

type AuthContextType = {
  token: string | null
  user: User | null
  loading: boolean
  login: (token: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("orvitlab_token"))
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const stored = localStorage.getItem("orvitlab_token")
      if (!stored) { setLoading(false); return }
      try {
        const { data } = await api(stored).get("/users/me")
        setToken(stored)
        setUser(data)
      } catch {
        localStorage.removeItem("orvitlab_token")
        setToken(null)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  async function login(jwt: string) {
    const { data } = await api(jwt).get("/users/me")
    localStorage.setItem("orvitlab_token", jwt)
    setToken(jwt)
    setUser(data)
  }

  function logout() {
    localStorage.removeItem("orvitlab_token")
    setToken(null)
    setUser(null)
  }

  async function refreshUser() {
    if (!token) return
    const { data } = await api(token).get("/users/me")
    setUser(data)
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
